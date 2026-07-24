import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const LEGACY_RUNTIME_PRICE_KEYS = Object.freeze([
  "STRIPE_SUPPORTER_MONTHLY_PRICE_ID",
  "STRIPE_SUPPORTER_YEARLY_PRICE_ID",
  "STRIPE_THERAPIST_MONTHLY_PRICE_ID",
  "STRIPE_THERAPIST_YEARLY_PRICE_ID",
  "STRIPE_PRACTICE_MONTHLY_PRICE_ID",
  "STRIPE_PRACTICE_YEARLY_PRICE_ID",
])

describe("Supporter membership final-review contracts", () => {
  it("routes signed-in current members from public pricing to Customer Portal mode", async () => {
    const [pricingPage, pricingCards, accountPage] = await Promise.all([
      readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/membership/pricing-cards.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    ])

    assert.match(pricingPage, /getUserMembershipPricingStatus/)
    assert.match(pricingPage, /resolveMembershipPricingMode/)
    assert.match(pricingCards, /mode:\s*"checkout"\s*\|\s*"auth"\s*\|\s*"portal"/)
    assert.match(pricingCards, /mode === "portal"/)
    assert.match(pricingCards, /mode === "portal" && active/)
    assert.match(pricingCards, /Manage in portal/)
    assert.match(pricingCards, /action="\/api\/billing\/portal"/)
    assert.match(pricingCards, /Manage or change support amount/)
    assert.match(accountPage, /resolveMembershipPricingMode/)
  })

  it("keeps legacy runtime Price mappings until inventory and webhook reconciliation are final", async () => {
    const [environmentExample, billingWiki, deploymentWiki, releaseChecklist] = await Promise.all([
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../docs/wiki/billing-memberships.md", import.meta.url), "utf8"),
      readFile(new URL("../docs/wiki/deployment.md", import.meta.url), "utf8"),
      readFile(new URL("../docs/wiki/release-checklist.md", import.meta.url), "utf8"),
    ])

    for (const key of LEGACY_RUNTIME_PRICE_KEYS) {
      assert.match(environmentExample, new RegExp(`^${key}=$`, "m"))
    }
    assert.match(
      environmentExample,
      /Keep these legacy runtime mappings until subscriber inventory proves none remain and webhook reconciliation is final\./,
    )
    assert.match(
      billingWiki,
      /Do not remove the six legacy runtime Price mappings until subscriber inventory proves none remain and webhook reconciliation is final\./,
    )
    assert.match(
      deploymentWiki,
      /Legacy runtime Price mappings remain webhook-only compatibility inputs and cannot satisfy public catalog readiness\./,
    )
    assert.match(
      releaseChecklist,
      /Retain the six legacy runtime Price mappings until subscriber inventory proves none remain and webhook reconciliation is final\./,
    )
  })

  it("shares one strict recurring Price-semantics helper between readiness and migration", async () => {
    const [readiness, readinessCommand, migration] = await Promise.all([
      readFile(new URL("../lib/stripe-readiness.js", import.meta.url), "utf8"),
      readFile(new URL("../scripts/stripe-readiness-check.mjs", import.meta.url), "utf8"),
      readFile(new URL("../scripts/stripe-supporter-membership-migration.mjs", import.meta.url), "utf8"),
    ])

    assert.match(readiness, /stripe-price-contract\.js/)
    assert.match(migration, /stripe-price-contract\.js/)
    assert.match(
      readinessCommand,
      /stripe\.prices\.retrieve\(priceId,\s*\{\s*expand:\s*\["product",\s*"currency_options"\]\s*\}\)/,
    )
  })
})
