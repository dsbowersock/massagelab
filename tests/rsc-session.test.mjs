import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
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

function discoverSourceFiles(relativeRoot) {
  const discovered = []
  const visit = (relativeDirectory) => {
    for (const entry of readdirSync(path.join(projectRoot, relativeDirectory), { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name)
      if (entry.isDirectory()) visit(relativePath)
      else if (/\.(?:ts|tsx)$/.test(entry.name)) discovered.push(relativePath.replaceAll("\\", "/"))
    }
  }
  visit(relativeRoot)
  return discovered
}

describe("RSC session snapshot proof boundary", () => {
  it("skips request headers when proof mode is disabled but still returns the real session", async () => {
    let headersCalls = 0
    let authCalls = 0
    const expectedSession = { user: { id: "user-1" } }
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

    await withRscProofMode(undefined, async () => {
      assert.equal(await proof.getCurrentSession(), expectedSession)
    })
    assert.equal(headersCalls, 0)
    assert.equal(authCalls, 1)
  })

  it("reads one valid proof header and records one consumable Browser-QA entry", async () => {
    const proofId = "123e4567-e89b-42d3-a456-426614174000"
    let headersCalls = 0
    let authCalls = 0
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

    await withRscProofMode("1", async () => {
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
    assert.doesNotMatch(proof, /setTimeout|setInterval|sessionValue|cookieValue|userId|email|token/)
  })

  it("counts the real auth loader and keeps the ordinary production route unavailable", () => {
    const page = source("app/dev/rsc-session-proof/page.tsx")

    assert.match(page, /process\.env\.NEXT_PUBLIC_RSC_SESSION_PROOF !== "1"/)
    assert.match(page, /notFound\(\)/)
    assert.match(page, /getCurrentSession\(\)/)
    assert.match(page, /consumeRscSessionProofCount/)
    assert.match(page, /data-rsc-session-count/)
    assert.doesNotMatch(page, /JSON\.stringify|session\.|user\.|email|cookie|token/)
  })

  it("dedupes only Server Component callers with React's request-scoped cache", () => {
    const wrapper = source("lib/rsc-session.ts")
    assert.match(wrapper, /import "server-only"/)
    assert.match(wrapper, /import \{ cache \} from "react"/)
    assert.match(wrapper, /import \{ getCurrentSession \} from "@\/auth"/)
    assert.match(wrapper, /from "@\/lib\/rsc-session-proof"/)
    assert.match(wrapper, /NEXT_PUBLIC_RSC_SESSION_PROOF === "1"/)
    assert.match(wrapper, /export const getCurrentRscSession = cache\(loadCurrentRscSession\)/)
    assert.doesNotMatch(wrapper, /setTimeout|setInterval|new Map|ttl|expires|persist/i)

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
