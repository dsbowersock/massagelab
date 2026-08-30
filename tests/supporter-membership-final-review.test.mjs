import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  getUserMembershipPricingStatus,
  resolveMembershipPricingMode,
} from "../lib/membership.js"
import {
  recurringPriceSemanticMismatches,
  recurringPriceSemanticsMatch,
  SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
  SUPPORTER_MEMBERSHIP_PRODUCT_NAME,
  SUPPORTER_MEMBERSHIP_PRICE_CONTRACT,
  SUPPORTER_RECURRING_TAX_BEHAVIOR,
  SUPPORTER_RECURRING_TAX_CODE,
} from "../lib/stripe-price-contract.js"
import { TARGET_PRICE_SPECS } from "../lib/stripe-supporter-membership-migration-contract.js"
import { safeErrorCode } from "../lib/safe-error-code.js"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  findElements,
} from "./helpers/compiled-module.mjs"
import { renderMembershipPricingCards } from "./helpers/membership-pricing-cards.mjs"

const LEGACY_RUNTIME_PRICE_KEYS = Object.freeze([
  "STRIPE_SUPPORTER_MONTHLY_PRICE_ID",
  "STRIPE_SUPPORTER_YEARLY_PRICE_ID",
  "STRIPE_THERAPIST_MONTHLY_PRICE_ID",
  "STRIPE_THERAPIST_YEARLY_PRICE_ID",
  "STRIPE_PRACTICE_MONTHLY_PRICE_ID",
  "STRIPE_PRACTICE_YEARLY_PRICE_ID",
])

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

function TestComponent() {}

/**
 * Renders the real public Pricing page with controlled session, Customer,
 * subscription, and lookup-failure inputs. The component double records the
 * mode passed to MembershipPricingCards without rendering its internals.
 * Returns the card's action props plus Customer/subscription query counters.
 */
async function renderPublicPricing({
  session,
  stripeCustomer = null,
  subscriptions,
  membershipStatusError = null,
  renderedPricingModes = [],
}) {
  const pricingPageSource = await readFile(
    new URL("../app/pricing/page.tsx", import.meta.url),
    "utf8",
  )
  let subscriptionQueries = 0
  let stripeCustomerQueries = 0
  function MembershipPricingCards() {}
  const createPricingElement = (type, props, key) => {
    if (type === MembershipPricingCards) {
      renderedPricingModes.push(props.mode)
    }
    return createElement(type, props, key)
  }

  const pricingPage = loadCompiledModule(
    pricingPageSource,
    "app/pricing/page.tsx",
    {
      "react/jsx-runtime": {
        Fragment: Symbol.for("supporter-final-review.fragment"),
        jsx: createPricingElement,
        jsxs: createPricingElement,
      },
      "next/link": TestComponent,
      "lucide-react": {
        HeartHandshake: TestComponent,
        ShieldCheck: TestComponent,
        Sparkles: TestComponent,
      },
      "@/auth": {
        getCurrentSession: async () => session,
      },
      "@/lib/donations": {
        DONATION_OPTIONS: [],
      },
      "@/lib/membership": {
        getUserMembershipPricingStatus,
        resolveMembershipPricingMode,
      },
      "@/lib/membership-pricing": {
        getMembershipPricingCatalog: async () => ({
          defaultInterval: "year",
          intervals: [],
          plans: [],
        }),
      },
      "@/lib/prisma": {
        prisma: {
          stripeCustomer: {
            async findUnique() {
              stripeCustomerQueries += 1
              return stripeCustomer
            },
          },
          membershipSubscription: {
            async findMany() {
              subscriptionQueries += 1
              if (membershipStatusError) {
                throw membershipStatusError
              }
              return subscriptions
            },
          },
        },
      },
      "@/components/membership/pricing-cards": {
        MembershipPricingCards,
      },
      "@/components/ui/app-surface": {
        AppNotice: TestComponent,
        AppPageShell: TestComponent,
        AppSurface: TestComponent,
        appCalloutClassName: "test-callout",
      },
      "@/components/ui/button": {
        Button: TestComponent,
      },
      "@/components/ui/metal-attention-button": {
        MetalAttentionButton: TestComponent,
      },
      "@/lib/seo": {
        createPublicPageMetadata: () => ({}),
      },
      "@/lib/safe-error-code": {
        safeErrorCode,
      },
    },
  )

  const tree = await pricingPage.default({
    searchParams: Promise.resolve({}),
  })
  const pricingCards = findElement(
    tree,
    (element) => element.type === MembershipPricingCards,
  )

  assert.ok(pricingCards, "PricingPage should render MembershipPricingCards")
  return {
    activeMembershipLevel: pricingCards.props.activeMembershipLevel ?? null,
    mode: pricingCards.props.mode,
    portalActionAvailable: pricingCards.props.portalActionAvailable,
    stripeCustomerQueries,
    subscriptionQueries,
  }
}

/** Supplies the complete non-secret migration configuration for the fixture. */
function migrationEnvironment() {
  return {
    STRIPE_SECRET_KEY: "sk_test_do_not_print",
    MASSAGELAB_STRIPE_MIGRATION_MODE: "test",
    MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: "none",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "prod_supporter",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORT_2_PRODUCT_ID: "CREATE_NEW",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORT_5_PRODUCT_ID: "CREATE_NEW",
    MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_month",
    MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_YEARLY_PRICE_ID: "price_supporter_year",
    MASSAGELAB_STRIPE_MIGRATION_THERAPIST_PRODUCT_ID: "prod_therapist",
    MASSAGELAB_STRIPE_MIGRATION_THERAPIST_MONTHLY_PRICE_ID: "price_therapist_month",
    MASSAGELAB_STRIPE_MIGRATION_THERAPIST_YEARLY_PRICE_ID: "price_therapist_year",
    MASSAGELAB_STRIPE_MIGRATION_PRACTICE_PRODUCT_ID: "prod_practice",
    MASSAGELAB_STRIPE_MIGRATION_PRACTICE_MONTHLY_PRICE_ID: "price_practice_month",
    MASSAGELAB_STRIPE_MIGRATION_PRACTICE_YEARLY_PRICE_ID: "price_practice_year",
    MASSAGELAB_STRIPE_MIGRATION_STUDENT_COUPON_ID: "coupon_student",
    MASSAGELAB_STRIPE_MIGRATION_EARLY_ACCESS_COUPON_ID: "coupon_early",
    MASSAGELAB_STRIPE_MIGRATION_PORTAL_CONFIGURATION_ID: "bpc_membership",
    STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_target_support_1_month",
  }
}

/** Creates a retrieved recurring Stripe Price with expanded currency options. */
function migrationPrice(id, product, unitAmount, interval, overrides = {}) {
  return {
    id,
    active: true,
    livemode: false,
    product,
    unit_amount: unitAmount,
    currency: "usd",
    billing_scheme: "per_unit",
    recurring: {
      interval,
      interval_count: 1,
      trial_period_days: null,
      usage_type: "licensed",
    },
    tax_behavior: "exclusive",
    transform_quantity: null,
    currency_options: null,
    metadata: {},
    ...overrides,
  }
}

/** Builds the read-only Stripe catalog/Portal fixture used by verify mode. */
function migrationStripeFixture(targetPrice) {
  const products = [
    {
      id: "prod_supporter",
      active: true,
      livemode: false,
      name: "MassageLab Supporter",
      tax_code: null,
      metadata: {
        app: "massagelab",
        massagelab_membership_level: "SUPPORTER",
      },
    },
    {
      id: "prod_therapist",
      active: true,
      livemode: false,
      name: "MassageLab Therapist",
      metadata: { app: "massagelab" },
    },
    {
      id: "prod_practice",
      active: true,
      livemode: false,
      name: "MassageLab Practice",
      metadata: { app: "massagelab" },
    },
  ]
  const prices = [
    migrationPrice("price_supporter_month", "prod_supporter", 900, "month"),
    migrationPrice("price_supporter_year", "prod_supporter", 9000, "year"),
    migrationPrice("price_therapist_month", "prod_therapist", 2900, "month"),
    migrationPrice("price_therapist_year", "prod_therapist", 27900, "year"),
    migrationPrice("price_practice_month", "prod_practice", 7900, "month"),
    migrationPrice("price_practice_year", "prod_practice", 75900, "year"),
    targetPrice,
  ]

  return {
    balance: {
      retrieve: async () => ({ livemode: false }),
    },
    subscriptions: {
      list: async () => ({ data: [], has_more: false }),
    },
    products: {
      list: async () => ({ data: products, has_more: false }),
    },
    prices: {
      list: async ({ active, product }) => ({
        data: active ? prices.filter((candidate) => candidate.product === product) : [],
        has_more: false,
      }),
      retrieve: async (id) => {
        const candidate = prices.find((price) => price.id === id)
        if (!candidate) {
          throw Object.assign(new Error("No such price"), { code: "resource_missing" })
        }
        return candidate
      },
    },
    billingPortal: {
      configurations: {
        retrieve: async () => ({ livemode: false }),
      },
    },
  }
}

describe("Supporter membership final-review contracts", () => {
  it("keeps return URLs identifier-free while preserving Checkout and Portal ownership", async () => {
    const [checkoutSource, portalSource, accountSource] = await Promise.all([
      readFile(new URL("../lib/membership-checkout.js", import.meta.url), "utf8"),
      readFile(new URL("../app/api/billing/portal/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    ])

    assert.match(checkoutSource, /account\?tab=membership&checkout=success/)
    assert.match(checkoutSource, /account\?tab=membership&checkout=cancelled/)
    assert.match(portalSource, /account\?tab=membership&portal=returned/)
    assert.doesNotMatch(`${checkoutSource}\n${accountSource}`, /CHECKOUT_SESSION_ID|session_id/)
    assert.match(checkoutSource, /resolveStripePriceId/)
    assert.match(checkoutSource, /createStripeCheckoutSession/)
    assert.match(portalSource, /createStripeCustomerPortalSession/)
  })
  it("routes members to Portal mode and non-members to the appropriate pricing action", async () => {
    const member = await renderPublicPricing({
      session: { user: { id: "user_member" } },
      stripeCustomer: { userId: "user_member", stripeCustomerId: "cus_member" },
      subscriptions: [{
        status: "active",
        membershipLevel: "SUPPORTER",
        currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
      }],
    })
    const signedInNonMember = await renderPublicPricing({
      session: { user: { id: "user_non_member" } },
      subscriptions: [],
    })
    const guest = await renderPublicPricing({
      session: null,
      subscriptions: [],
    })

    assert.deepEqual(member, {
      activeMembershipLevel: "SUPPORTER",
      mode: "portal",
      portalActionAvailable: true,
      stripeCustomerQueries: 1,
      subscriptionQueries: 1,
    })
    assert.deepEqual(signedInNonMember, {
      activeMembershipLevel: null,
      mode: "checkout",
      portalActionAvailable: false,
      stripeCustomerQueries: 1,
      subscriptionQueries: 1,
    })
    assert.deepEqual(guest, {
      activeMembershipLevel: null,
      mode: "auth",
      portalActionAvailable: false,
      stripeCustomerQueries: 0,
      subscriptionQueries: 0,
    })

    const [memberCards, signedInNonMemberCards, guestCards] = await Promise.all([
      renderMembershipPricingCards({
        mode: member.mode,
        activeMembershipLevel: member.activeMembershipLevel,
        portalActionAvailable: member.portalActionAvailable,
      }),
      renderMembershipPricingCards({
        mode: signedInNonMember.mode,
        activeMembershipLevel: signedInNonMember.activeMembershipLevel,
        portalActionAvailable: signedInNonMember.portalActionAvailable,
      }),
      renderMembershipPricingCards({
        mode: guest.mode,
        activeMembershipLevel: guest.activeMembershipLevel,
        portalActionAvailable: guest.portalActionAvailable,
      }),
    ])
    const formActions = (tree) => findElements(
      tree,
      (element) => element.type === "form",
    ).map((element) => element.props.action)

    assert.deepEqual(formActions(memberCards), ["/api/billing/portal", "/api/billing/portal"])
    assert.match(elementText(memberCards), /Change support amount or billing period/)
    assert.match(elementText(memberCards), /Manage billing account/)
    assert.doesNotMatch(elementText(memberCards), /Support with \$1(?!\d)|Choose \$1(?!\d)/)

    assert.deepEqual(formActions(signedInNonMemberCards), ["/api/billing/checkout"])
    assert.match(elementText(signedInNonMemberCards), /Support with \$1(?!\d)/)
    assert.doesNotMatch(elementText(signedInNonMemberCards), /Change support amount or billing period/)

    assert.deepEqual(formActions(guestCards), [])
    assert.match(elementText(guestCards), /Choose \$1(?!\d)/)
    const guestAuthChoices = findElements(
      guestCards,
      (element) => (
        element.type === "a"
        && element.props["data-membership-auth-amount-choice"] != null
      ),
    )
    assert.deepEqual(
      guestAuthChoices.map((element) => ({
        choiceId: element.props["data-membership-auth-amount-choice"],
        href: element.props.href,
      })),
      [{
        choiceId: "support-1",
        href: "/login?callbackUrl=%2Fpricing%3FsupporterAmountChoiceId%3Dsupport-1%26interval%3Dmonth",
      }],
    )
  })

  it("keeps Portal mode unavailable after a successful lookup without a Stripe Customer", async () => {
    const result = await renderPublicPricing({
      session: { user: { id: "user_member_without_customer" } },
      subscriptions: [{
        status: "active",
        membershipLevel: "SUPPORTER",
        currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
      }],
    })

    assert.deepEqual(result, {
      activeMembershipLevel: "SUPPORTER",
      mode: "portal",
      portalActionAvailable: false,
      stripeCustomerQueries: 1,
      subscriptionQueries: 1,
    })
  })

  it("fails closed to Portal mode with sanitized logging when membership lookup rejects", async (context) => {
    const membershipStatusError = new Error("membership database unavailable for user@example.com")
    membershipStatusError.code = "unsafe\nuser@example.com"
    const renderedPricingModes = []
    const logged = []
    context.mock.method(console, "error", (...args) => logged.push(args))

    const result = await renderPublicPricing({
      session: { user: { id: "user_unknown_membership" } },
      subscriptions: [],
      membershipStatusError,
      renderedPricingModes,
    })

    assert.deepEqual(result, {
      activeMembershipLevel: null,
      mode: "portal",
      portalActionAvailable: false,
      stripeCustomerQueries: 1,
      subscriptionQueries: 1,
    })
    assert.deepEqual(renderedPricingModes, ["portal"])
    assert.deepEqual(logged, [[
      "Unable to load membership pricing status",
      { code: "unexpected_error" },
    ]])
    assert.equal(logged.flat().includes(membershipStatusError), false)
    assert.doesNotMatch(JSON.stringify(logged), /user@example\.com|database unavailable/)
  })

  it("keeps retired setup and early-access controls out of the repository layout", async () => {
    const [environmentExample, readinessCheck] = await Promise.all([
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../scripts/stripe-readiness-check.mjs", import.meta.url), "utf8"),
    ])

    assert.doesNotMatch(environmentExample, /MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED/)
    assert.doesNotMatch(readinessCheck, /MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED|early access/i)
    await assert.rejects(
      readFile(new URL("../scripts/stripe-live-membership-setup.mjs", import.meta.url), "utf8"),
      (error) => error?.code === "ENOENT",
    )
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

  it("uses the shared recurring Price-semantics contract in readiness", async () => {
    const readinessSource = await readFile(
      new URL("../lib/stripe-readiness.js", import.meta.url),
      "utf8",
    )
    const expected = {
      key: "STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID",
      amountChoiceId: "support-1",
      interval: "month",
      unitAmount: 100,
    }
    const readinessCandidate = migrationPrice(
      "price_target_support_1_month",
      {
        id: "prod_supporter",
        active: true,
        name: "MassageLab Supporter Membership",
        tax_code: "txcd_10000000",
        metadata: {
          app: "massagelab",
          massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
          massagelab_membership_level: "SUPPORTER",
          massagelab_supporter_amount_choice: "support-1",
        },
      },
      expected.unitAmount,
      expected.interval,
      { billing_scheme: "tiered" },
    )
    const readinessCalls = []
    const readiness = loadCompiledModule(
      readinessSource,
      "lib/stripe-readiness.js",
      {
        "./donations.js": {
          ONE_TIME_SUPPORT_TAX_CODE: "txcd_90000001",
        },
        "./stripe-price-contract.js": {
          SUPPORTER_MEMBERSHIP_PRODUCT_NAME,
          SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
          SUPPORTER_MEMBERSHIP_PRICE_CONTRACT,
          SUPPORTER_RECURRING_TAX_BEHAVIOR,
          SUPPORTER_RECURRING_TAX_CODE,
          recurringPriceSemanticMismatches(candidate, contract) {
            const mismatches = recurringPriceSemanticMismatches(candidate, contract)
            readinessCalls.push({ candidate, contract, mismatches })
            return mismatches
          },
        },
      },
    )

    assert.deepEqual(
      readiness.validateRetrievedMembershipPrice(readinessCandidate, expected),
      [`${expected.key} billing_scheme must be per_unit.`],
    )
    assert.equal(readinessCalls.length, 1)
    assert.deepEqual(readinessCalls[0].contract, {
      interval: "month",
      taxBehavior: "exclusive",
      unitAmount: 100,
    })
    assert.deepEqual(readinessCalls[0].mismatches, ["billing_scheme"])
  })

  it("uses the shared recurring Price-semantics contract in migration verification", async () => {
    const migrationSource = await readFile(
      new URL("../scripts/stripe-supporter-membership-migration.mjs", import.meta.url),
      "utf8",
    )
    const expected = {
      interval: "month",
      unitAmount: 100,
    }
    const targetPrice = migrationPrice(
      "price_target_support_1_month",
      "prod_supporter",
      expected.unitAmount,
      expected.interval,
      { billing_scheme: "tiered" },
    )
    const migrationCalls = []
    const helperObserved = new Error("shared recurring Price helper observed")
    assert.match(migrationSource, /import\.meta\.url/)
    assert.equal(
      [...migrationSource.matchAll(/\bawait main\(\)/g)].length,
      1,
      "the migration source must expose exactly one CLI entrypoint call",
    )
    // Test-only: replace import.meta.url for a stable URL and the single await main() to suppress CLI startup before loading.
    const migration = loadCompiledModule(
      migrationSource
        .replaceAll(
          "import.meta.url",
          JSON.stringify("test://supporter-membership-migration"),
        )
        .replaceAll(/\bawait main\(\)/g, "void 0"),
      "scripts/stripe-supporter-membership-migration.mjs",
      {
        stripe: class TestStripe {},
        "../lib/stripe-price-contract.js": {
          SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
          SUPPORTER_MEMBERSHIP_PRICE_CONTRACT,
          SUPPORTER_RECURRING_TAX_BEHAVIOR,
          SUPPORTER_RECURRING_TAX_CODE,
          recurringPriceSemanticsMatch(candidate, contract) {
            const matches = recurringPriceSemanticsMatch(candidate, contract)
            if (contract.taxBehavior === SUPPORTER_RECURRING_TAX_BEHAVIOR) {
              migrationCalls.push({ candidate, contract, matches })
              throw helperObserved
            }
            return matches
          },
        },
        "../lib/stripe-webhook-contract.js": {
          STRIPE_API_VERSION: "test-api-version",
        },
        "../lib/stripe-supporter-membership-migration-contract.js": {
          TARGET_PRICE_SPECS,
        },
      },
    )

    await assert.rejects(
      migration.runSupporterMembershipMigration({
        stripe: migrationStripeFixture(targetPrice),
        mode: "verify",
        env: migrationEnvironment(),
      }),
      (error) => error === helperObserved,
    )
    assert.equal(migrationCalls.length, 1)
    assert.deepEqual(migrationCalls[0].contract, {
      interval: "month",
      taxBehavior: "exclusive",
      unitAmount: 100,
    })
    assert.equal(migrationCalls[0].matches, false)
  })

  it("retrieves readiness Prices with the expansion required by semantic validation", async () => {
    const readinessCommand = await readFile(
      new URL("../scripts/stripe-readiness-check.mjs", import.meta.url),
      "utf8",
    )
    assert.match(
      readinessCommand,
      /stripe\.prices\.retrieve\(priceId,\s*\{\s*expand:\s*\["product",\s*"currency_options"\]\s*\}\)/,
    )
  })
})
