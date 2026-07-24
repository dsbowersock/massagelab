import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { describe, it } from "node:test"
import ts from "typescript"

import {
  getUserMembershipPricingStatus,
  resolveMembershipPricingMode,
} from "../lib/membership.js"
import {
  recurringPriceSemanticMismatches,
  recurringPriceSemanticsMatch,
} from "../lib/stripe-price-contract.js"

const LEGACY_RUNTIME_PRICE_KEYS = Object.freeze([
  "STRIPE_SUPPORTER_MONTHLY_PRICE_ID",
  "STRIPE_SUPPORTER_YEARLY_PRICE_ID",
  "STRIPE_THERAPIST_MONTHLY_PRICE_ID",
  "STRIPE_THERAPIST_YEARLY_PRICE_ID",
  "STRIPE_PRACTICE_MONTHLY_PRICE_ID",
  "STRIPE_PRACTICE_YEARLY_PRICE_ID",
])

const requireFromTest = createRequire(import.meta.url)

/**
 * Compiles a production module only inside this test so its dependencies can
 * be observed without adding test-only exports or changing runtime behavior.
 */
function loadCompiledModule(source, fileName, dependencies = {}) {
  const compiledSource = ts.transpileModule(source.replace(/^#!.*\r?\n/, ""), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileName.replace(/\.mjs$/, ".js"),
  }).outputText
  const compiledModule = { exports: {} }
  const executeModule = new Function("require", "exports", "module", compiledSource)

  executeModule((specifier) => (
    Object.hasOwn(dependencies, specifier)
      ? dependencies[specifier]
      : requireFromTest(specifier)
  ), compiledModule.exports, compiledModule)

  return compiledModule.exports
}

function createElement(type, props, key) {
  return {
    type,
    key: key ?? null,
    props: props ?? {},
  }
}

function findElement(tree, predicate) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findElement(child, predicate)
      if (match) {
        return match
      }
    }
    return null
  }

  if (!tree || typeof tree !== "object") {
    return null
  }

  if (predicate(tree)) {
    return tree
  }

  return findElement(tree.props?.children, predicate)
}

function findElements(tree, predicate, matches = []) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      findElements(child, predicate, matches)
    }
    return matches
  }

  if (!tree || typeof tree !== "object") {
    return matches
  }

  if (predicate(tree)) {
    matches.push(tree)
  }
  findElements(tree.props?.children, predicate, matches)
  return matches
}

function renderFunctionComponents(tree) {
  if (Array.isArray(tree)) {
    return tree.map(renderFunctionComponents)
  }
  if (!tree || typeof tree !== "object") {
    return tree ?? null
  }
  if (typeof tree.type === "function") {
    return renderFunctionComponents(tree.type(tree.props))
  }

  return {
    ...tree,
    props: {
      ...tree.props,
      children: renderFunctionComponents(tree.props?.children),
    },
  }
}

function elementText(tree) {
  if (Array.isArray(tree)) {
    return tree.map(elementText).join("")
  }
  if (typeof tree === "string" || typeof tree === "number") {
    return String(tree)
  }
  if (!tree || typeof tree !== "object") {
    return ""
  }
  return elementText(tree.props?.children)
}

function passThroughElement(type) {
  return function PassThroughElement(props) {
    return createElement(type, props)
  }
}

function TestComponent() {}

async function renderPublicPricing({
  session,
  subscriptions,
  membershipStatusError = null,
  renderedPricingModes = [],
}) {
  const pricingPageSource = await readFile(
    new URL("../app/pricing/page.tsx", import.meta.url),
    "utf8",
  )
  let subscriptionQueries = 0
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
    subscriptionQueries,
  }
}

async function renderMembershipPricingCards({ mode, activeMembershipLevel }) {
  const pricingCardsSource = await readFile(
    new URL("../components/membership/pricing-cards.tsx", import.meta.url),
    "utf8",
  )
  const Div = passThroughElement("div")
  const Button = passThroughElement("button")
  const Link = passThroughElement("a")
  const price = {
    membershipLevel: "SUPPORTER",
    interval: "month",
    priceId: "price_supporter_1_month",
    unitAmount: 100,
    currency: "usd",
    displayPrice: "$1",
    displayInterval: "/month",
    isConfigured: true,
    isLookupAvailable: true,
    yearlySavings: null,
  }
  const catalog = {
    defaultInterval: "month",
    intervals: [{
      id: "month",
      label: "Monthly",
      nudge: "Flexible",
    }],
    plans: [{
      membershipLevel: "SUPPORTER",
      name: "MassageLab Supporter Membership",
      eyebrow: "Alpha support",
      description: "Support current features and careful future development.",
      currentFeatures: ["Access to all backgrounds"],
      roadmapNotes: ["Funds privacy-preserving product work."],
      amountChoices: [{
        id: "support-1",
        month: 100,
        year: 1000,
        prices: { month: price },
      }],
    }],
  }
  const pricingCards = loadCompiledModule(
    pricingCardsSource,
    "components/membership/pricing-cards.tsx",
    {
      "react/jsx-runtime": {
        Fragment: Symbol.for("supporter-final-review.fragment"),
        jsx: createElement,
        jsxs: createElement,
      },
      "next/link": Link,
      "lucide-react": {
        BadgeDollarSign: TestComponent,
        CheckCircle2: TestComponent,
        Palette: TestComponent,
        ShieldCheck: TestComponent,
      },
      "@/components/ui/app-surface": {
        appCalloutClassName: "test-callout",
        appSurfaceClassName: "test-surface",
      },
      "@/components/ui/badge": {
        Badge: Div,
      },
      "@/components/ui/button": {
        Button,
      },
      "@/components/ui/card": {
        Card: Div,
        CardContent: Div,
        CardDescription: Div,
        CardHeader: Div,
        CardTitle: Div,
      },
      "@/components/ui/metal-attention-button": {
        MetalAttentionButton: Button,
      },
      "@/components/ui/tabs": {
        Tabs: Div,
        TabsContent: Div,
        TabsList: Div,
        TabsTrigger: Div,
      },
      "@/lib/legal-documents": {
        getLegalDocumentByKey: () => ({
          label: "Membership Billing and Refund Terms",
          route: "/legal/membership-billing-refunds",
        }),
        legalDocumentAcceptanceId: () => "membership-billing-refunds:test",
      },
      "@/lib/membership-pricing": {
        resolveMembershipPriceForInterval: (choice, interval) => (
          choice.prices?.[interval] ?? null
        ),
      },
      "@/lib/utils": {
        cn: (...classes) => classes.filter(Boolean).join(" "),
      },
    },
  )

  return renderFunctionComponents(pricingCards.MembershipPricingCards({
    activeMembershipLevel,
    catalog,
    mode,
  }))
}

function migrationEnvironment() {
  return {
    STRIPE_SECRET_KEY: "sk_test_do_not_print",
    MASSAGELAB_STRIPE_MIGRATION_MODE: "test",
    MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: "none",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "prod_supporter",
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
      list: async ({ active }) => ({
        data: active ? prices : [],
        has_more: false,
      }),
    },
    billingPortal: {
      configurations: {
        retrieve: async () => ({ livemode: false }),
      },
    },
  }
}

describe("Supporter membership final-review contracts", () => {
  it("routes members to Portal mode and non-members to the appropriate pricing action", async () => {
    const member = await renderPublicPricing({
      session: { user: { id: "user_member" } },
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
      subscriptionQueries: 1,
    })
    assert.deepEqual(signedInNonMember, {
      activeMembershipLevel: null,
      mode: "checkout",
      subscriptionQueries: 1,
    })
    assert.deepEqual(guest, {
      activeMembershipLevel: null,
      mode: "auth",
      subscriptionQueries: 0,
    })

    const [memberCards, signedInNonMemberCards, guestCards] = await Promise.all([
      renderMembershipPricingCards(member),
      renderMembershipPricingCards(signedInNonMember),
      renderMembershipPricingCards(guest),
    ])
    const formActions = (tree) => findElements(
      tree,
      (element) => element.type === "form",
    ).map((element) => element.props.action)

    assert.deepEqual(formActions(memberCards), ["/api/billing/portal"])
    assert.match(elementText(memberCards), /Manage or change support amount/)
    assert.doesNotMatch(elementText(memberCards), /Support with \$1|Choose \$1/)

    assert.deepEqual(formActions(signedInNonMemberCards), ["/api/billing/checkout"])
    assert.match(elementText(signedInNonMemberCards), /Support with \$1/)
    assert.doesNotMatch(elementText(signedInNonMemberCards), /Manage or change support amount/)

    assert.deepEqual(formActions(guestCards), [])
    assert.match(elementText(guestCards), /Choose \$1/)
    assert.equal(
      findElements(
        guestCards,
        (element) => (
          element.type === "a"
          && element.props.href === "/login?callbackUrl=%2Fpricing"
        ),
      ).length,
      1,
    )
  })

  it("fails closed without rendering Checkout when authenticated membership lookup rejects", async () => {
    const membershipStatusError = new Error("membership database unavailable")
    const renderedPricingModes = []

    await assert.rejects(
      () => renderPublicPricing({
        session: { user: { id: "user_unknown_membership" } },
        subscriptions: [],
        membershipStatusError,
        renderedPricingModes,
      }),
      (error) => error === membershipStatusError,
    )
    assert.deepEqual(renderedPricingModes, [])
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

  it("executes one strict recurring Price-semantics contract in readiness and migration", async () => {
    const [readinessSource, readinessCommand, migrationSource] = await Promise.all([
      readFile(new URL("../lib/stripe-readiness.js", import.meta.url), "utf8"),
      readFile(new URL("../scripts/stripe-readiness-check.mjs", import.meta.url), "utf8"),
      readFile(new URL("../scripts/stripe-supporter-membership-migration.mjs", import.meta.url), "utf8"),
    ])
    const expected = {
      key: "STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID",
      interval: "month",
      unitAmount: 100,
    }
    const readinessCandidate = migrationPrice(
      "price_target_support_1_month",
      { id: "prod_supporter", tax_code: "txcd_10000000" },
      expected.unitAmount,
      expected.interval,
      { billing_scheme: "tiered" },
    )
    const readinessCalls = []
    const readiness = loadCompiledModule(
      readinessSource,
      "lib/stripe-readiness.js",
      {
        "./stripe-price-contract.js": {
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

    const targetPrice = migrationPrice(
      "price_target_support_1_month",
      "prod_supporter",
      expected.unitAmount,
      expected.interval,
      { billing_scheme: "tiered" },
    )
    const migrationCalls = []
    const helperObserved = new Error("shared recurring Price helper observed")
    const migration = loadCompiledModule(
      migrationSource
        .replaceAll(
          "import.meta.url",
          JSON.stringify("test://supporter-membership-migration"),
        )
        .replace(/\bawait main\(\)/, "void main()"),
      "scripts/stripe-supporter-membership-migration.mjs",
      {
        stripe: class TestStripe {},
        "../lib/stripe-price-contract.js": {
          recurringPriceSemanticsMatch(candidate, contract) {
            const matches = recurringPriceSemanticsMatch(candidate, contract)
            if (contract.taxBehavior === "exclusive") {
              migrationCalls.push({ candidate, contract, matches })
              throw helperObserved
            }
            return matches
          },
        },
        "../lib/stripe-webhook-contract.js": {
          STRIPE_API_VERSION: "test-api-version",
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

    assert.match(
      readinessCommand,
      /stripe\.prices\.retrieve\(priceId,\s*\{\s*expand:\s*\["product",\s*"currency_options"\]\s*\}\)/,
    )
  })
})
