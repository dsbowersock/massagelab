import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
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

describe("RSC session snapshot proof boundary", () => {
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
