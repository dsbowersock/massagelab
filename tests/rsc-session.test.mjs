import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import ts from "typescript"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const sessionFieldReadPattern = /\bsession\s*\??\./
const userFieldReadPattern = /\buser\s*\??\./
const rscSessionConsumers = [
  "components/sidebar/sidebar.tsx",
  "app/page.tsx",
  "app/account/page.tsx",
  "app/admin/page.tsx",
  "app/anatomy/corrections/page.tsx",
  "app/calendar/page.tsx",
  "app/calendar/availability/page.tsx",
  "app/calendar/booking/page.tsx",
  "app/calendar/new/page.tsx",
  "app/calendar/new/appointment/page.tsx",
  "app/calendar/new/class/page.tsx",
  "app/calendar/new/personal/page.tsx",
  "app/calendar/new/reminder/page.tsx",
  "app/calendar/requests/page.tsx",
  "app/calendar/services/page.tsx",
  "app/calendar/services/new/page.tsx",
  "app/calendar/services/[serviceId]/page.tsx",
  "app/calendar/sync/page.tsx",
  "app/education/flashcards/page.tsx",
  "app/education/flashcards/decks/page.tsx",
  "app/education/flashcards/decks/[slug]/page.tsx",
  "app/legal/accept/page.tsx",
  "app/notes/page.tsx",
  "app/onboarding/page.tsx",
  "app/pricing/page.tsx",
  "app/support/page.tsx",
  "app/tools/business-planner/income/page.tsx",
  "app/wellness/page.tsx",
  "app/book/public-booking-page.tsx",
  "app/notes/therapist-notes-gate.tsx",
  "app/dev/rsc-session-proof/page.tsx",
]

function source(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath)
  assert.ok(existsSync(absolutePath), `Expected ${relativePath} to exist`)
  return readFileSync(absolutePath, "utf8")
}

/** Restricts render discovery to production TypeScript modules, not declarations or colocated fixtures. */
function isProductionSourceFile(fileName) {
  return /\.(?:ts|tsx)$/.test(fileName)
    && !fileName.endsWith(".d.ts")
    && !/\.(?:test|spec|story|stories)\.(?:ts|tsx)$/.test(fileName)
}

function discoverSourceFiles(relativeRoot) {
  const discovered = []
  const visit = (relativeDirectory) => {
    for (const entry of readdirSync(path.join(projectRoot, relativeDirectory), { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name)
      if (entry.isDirectory()) visit(relativePath)
      else if (isProductionSourceFile(entry.name)) discovered.push(relativePath.replaceAll("\\", "/"))
    }
  }
  visit(relativeRoot)
  return discovered
}

/** Reprints parser-recognized TypeScript without comments while preserving executable and literal text. */
function sourceWithoutComments(sourceText) {
  const sourceFile = ts.createSourceFile(
    "rsc-session-leak-scan.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  return ts.createPrinter({ removeComments: true }).printFile(sourceFile)
}

/** Reports the exact forbidden executable data class while retaining identifier variants. */
function assertNoLeakPatterns(sourceText, relativePath, forbiddenPatterns) {
  const executableSource = sourceWithoutComments(sourceText)
  for (const { label, pattern } of forbiddenPatterns) {
    assert.doesNotMatch(executableSource, pattern, `${relativePath} must not contain ${label}`)
  }
}

describe("RSC session snapshot proof boundary", () => {
  it("detects ordinary and optional-chained session field reads", () => {
    for (const sourceText of ["session.user", "session?.user"]) {
      assert.match(sourceText, sessionFieldReadPattern)
    }
    for (const sourceText of ["user.id", "user?.id"]) {
      assert.match(sourceText, userFieldReadPattern)
    }
  })

  it("ignores comments in leak scans without stripping comment-like literals", () => {
    const scanned = sourceWithoutComments(`
      const url = "https://example.test/sessionValue"
      const marker = "/* cookieValue retained in a string */"
      const template = \`value \${marker} // tokenValue retained in an interpolated template\`
      const emptyArray = [/* forbiddenUserId */]
      consume(/* forbiddenEmail */)
      const emptyObject = {/* forbiddenToken */}
      // userId in a comment
      /* emailValue in a block comment */
    `)

    assert.doesNotMatch(scanned, /userId|emailValue/)
    assert.doesNotMatch(scanned, /forbidden(?:UserId|Email|Token)/)
    assert.match(scanned, /https:\/\/example\.test\/sessionValue/)
    assert.match(scanned, /cookieValue retained in a string/)
    assert.match(scanned, /tokenValue retained in an interpolated template/)
  })

  it("skips request headers when proof mode is disabled but still returns the real session", async () => {
    let headersCalls = 0
    let authCalls = 0
    const expectedSession = { user: { id: "user-1" } }

    await withRscProofMode(undefined, async () => {
      const proof = loadRscProofBoundary({
        async headers() {
          headersCalls += 1
          throw new Error("headers must stay unavailable outside proof mode")
        },
        async getCurrentSession() {
          authCalls += 1
          return expectedSession
        },
      })
      assert.equal(await proof.getCurrentSession(), expectedSession)
    })
    assert.equal(headersCalls, 0)
    assert.equal(authCalls, 1)
  })

  it("reads one valid proof header and records one consumable Browser-QA entry", async () => {
    const proofId = "123e4567-e89b-42d3-a456-426614174000"
    let headersCalls = 0
    let authCalls = 0

    await withRscProofMode("1", async () => {
      const proof = loadRscProofBoundary({
        async headers() {
          headersCalls += 1
          return new Headers({ "x-massagelab-rsc-session-proof": proofId })
        },
        async getCurrentSession() {
          authCalls += 1
          return null
        },
      })
      assert.equal(await proof.getCurrentSession(), null)
      assert.equal(proof.consumeRscSessionProofCount(proofId), 1)
    })
    assert.equal(headersCalls, 1)
    assert.equal(authCalls, 1)
  })

  it("enables the auth-entry counter only in the isolated Browser-QA artifact", () => {
    const buildScript = source("scripts/build-browser-qa.mjs")
    const nextConfig = source("next.config.mjs")

    assert.match(buildScript, /NEXT_PUBLIC_RSC_SESSION_PROOF:\s*"1"/)
    assert.match(nextConfig, /rscSessionProofEnabled/)
    assert.match(nextConfig, /NEXT_PUBLIC_RSC_SESSION_PROOF === "1"/)
    assert.doesNotMatch(nextConfig, /@\/auth/)
    assert.match(nextConfig, /beforeFiles: rscSessionProofEnabled/)
    assert.match(nextConfig, /destination: "\/_not-found"/)
  })

  it("stores only bounded proof counters and deletes each counter on read", () => {
    const proof = source("lib/rsc-session-proof.ts")

    assert.match(proof, /import "server-only"/)
    assert.match(proof, /new Map<string, number>\(\)/)
    assert.match(proof, /MAX_OUTSTANDING_PROOFS\s*=\s*32/)
    assert.match(proof, /MAX_SESSION_ENTRIES_PER_PROOF\s*=\s*64/)
    assert.match(proof, /proofCounters\.delete\(proofId\)/)
    assert.match(proof, /proofCounters\.keys\(\)\.next\(\)\.value/)
    assertNoLeakPatterns(proof, "lib/rsc-session-proof.ts", [
      { label: "timer retention", pattern: /\bset(?:Timeout|Interval)\b/ },
      { label: "session-value identifiers", pattern: /\b[\w$]*sessionValue[\w$]*\b/i },
      { label: "cookie-value identifiers", pattern: /\b[\w$]*cookieValue[\w$]*\b/i },
      { label: "user-id identifiers", pattern: /\b[\w$]*userId[\w$]*\b/i },
      { label: "email-bearing identifiers", pattern: /\b[\w$]*email[\w$]*\b/i },
      { label: "token-bearing identifiers", pattern: /\b[\w$]*token[\w$]*\b/i },
    ])
  })

  it("counts the real auth loader and keeps the ordinary production route unavailable", () => {
    const page = source("app/dev/rsc-session-proof/page.tsx")

    assert.match(page, /process\.env\.NEXT_PUBLIC_RSC_SESSION_PROOF !== "1"/)
    assert.match(page, /notFound\(\)/)
    assert.match(page, /getCurrentSession\(\)/)
    assert.match(page, /consumeRscSessionProofCount/)
    assert.match(page, /data-rsc-session-count/)
    assertNoLeakPatterns(page, "app/dev/rsc-session-proof/page.tsx", [
      { label: "serialized values", pattern: /\bJSON\.stringify\b/ },
      { label: "session field reads", pattern: sessionFieldReadPattern },
      { label: "user field reads", pattern: userFieldReadPattern },
      { label: "email-bearing identifiers", pattern: /\b[\w$]*email[\w$]*\b/i },
      { label: "cookie-bearing identifiers", pattern: /\b[\w$]*cookie[\w$]*\b/i },
      { label: "token-bearing identifiers", pattern: /\b[\w$]*token[\w$]*\b/i },
    ])
  })

  it("dedupes only Server Component callers with React's request-scoped cache", () => {
    const wrapper = source("lib/rsc-session.ts")
    assert.match(wrapper, /import "server-only"/)
    assert.match(wrapper, /import \{ cache \} from "react"/)
    assert.match(wrapper, /import \{ getCurrentSession \} from "@\/auth"/)
    assert.match(wrapper, /from "@\/lib\/rsc-session-proof"/)
    assert.match(wrapper, /NEXT_PUBLIC_RSC_SESSION_PROOF === "1"/)
    assert.match(wrapper, /export const getCurrentRscSession = cache\(loadCurrentRscSession\)/)
    assertNoLeakPatterns(wrapper, "lib/rsc-session.ts", [
      { label: "timer retention", pattern: /\bset(?:Timeout|Interval)\b/ },
      { label: "map-backed retention", pattern: /\bnew\s+Map\b/ },
      { label: "TTL-bearing identifiers", pattern: /\b[\w$]*ttl[\w$]*\b/i },
      { label: "expiry-bearing identifiers", pattern: /\b[\w$]*expires[\w$]*\b/i },
      { label: "persistence-bearing identifiers", pattern: /\b[\w$]*persist[\w$]*\b/i },
    ])

    for (const relativePath of rscSessionConsumers) {
      const consumer = source(relativePath)
      assert.match(consumer, /from "@\/lib\/rsc-session"/)
      assert.doesNotMatch(consumer, /from "@\/auth"/)
    }

    const renderSources = [
      ...discoverSourceFiles("app"),
      ...discoverSourceFiles("components"),
    ]
    const renderSourceContents = new Map(
      renderSources.map((relativePath) => [relativePath, source(relativePath)]),
    )
    const discoveredConsumers = renderSources.filter((relativePath) => (
      /from "@\/lib\/rsc-session"/.test(renderSourceContents.get(relativePath))
    ))
    assert.deepEqual(discoveredConsumers.sort(), [...rscSessionConsumers].sort())

    const unexpectedDirectAuthConsumers = renderSources.filter((relativePath) => {
      if (!/from "@\/auth"/.test(renderSourceContents.get(relativePath))) return false
      return !relativePath.startsWith("app/api/")
        && !relativePath.endsWith("/actions.ts")
        && !relativePath.includes("/actions/")
    })
    assert.deepEqual(unexpectedDirectAuthConsumers, [])
  })

  it("leaves mutation and route-handler authentication on the direct auth owner", () => {
    for (const relativePath of [
      "app/api/account/preferences/route.ts",
      "app/api/account/profile/route.ts",
      "app/api/billing/checkout/route.ts",
      "app/api/billing/portal/route.ts",
      "app/api/book/[practiceSlug]/sequence-options/route.ts",
      "app/account/actions.ts",
    ]) {
      const route = source(relativePath)
      assert.match(route, /from "@\/auth"/)
      assert.doesNotMatch(route, /@\/lib\/rsc-session/)
    }

    const webhook = source("app/api/billing/webhook/route.ts")
    assert.doesNotMatch(webhook, /getCurrentSession|@\/lib\/rsc-session/)
  })
})

function loadRscProofBoundary({ headers, getCurrentSession }) {
  return loadCompiledModule(source("lib/rsc-session-proof.ts"), "rsc-session-proof.runtime.test.ts", {
    "server-only": {},
    "next/headers": { headers },
    "../auth": { getCurrentSession },
  })
}

async function withRscProofMode(value, callback) {
  const previous = process.env.NEXT_PUBLIC_RSC_SESSION_PROOF
  if (value === undefined) delete process.env.NEXT_PUBLIC_RSC_SESSION_PROOF
  else process.env.NEXT_PUBLIC_RSC_SESSION_PROOF = value
  try {
    return await callback()
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_RSC_SESSION_PROOF
    else process.env.NEXT_PUBLIC_RSC_SESSION_PROOF = previous
  }
}
