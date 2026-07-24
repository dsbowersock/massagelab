import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  isExplicitTrue,
  REQUIRED_SUPPORTER_PRICE_CONTRACT,
  validateRetrievedMembershipPrice,
} from "../lib/stripe-readiness.js"
import { recurringPriceSemanticMismatches } from "../lib/stripe-price-contract.js"

const readinessScriptPath = fileURLToPath(
  new URL("../scripts/stripe-readiness-check.mjs", import.meta.url),
)

function supporterProduct(overrides = {}) {
  return {
    active: true,
    name: "MassageLab Supporter Membership",
    tax_code: "txcd_10000000",
    ...overrides,
  }
}

const membershipPrices = {
  STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1_monthly",
  STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_yearly",
  STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_monthly",
  STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_yearly",
  STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_monthly",
  STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_yearly",
}

/**
 * Returns the complete hermetic child environment for readiness checks.
 */
function readinessEnvironment(overrides = {}) {
  return {
    PATH: process.env.PATH,
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...(process.env.COMSPEC ? { COMSPEC: process.env.COMSPEC } : {}),
    STRIPE_SECRET_KEY: "sk_test_readiness",
    STRIPE_WEBHOOK_SECRET: "whsec_readiness",
    BACKGROUND_COMMERCE_PURCHASING_ENABLED: "true",
    BACKGROUND_COMMERCE_PRICE_CENTS: "100",
    BACKGROUND_COMMERCE_CURRENCY: "usd",
    BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "US",
    BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION: "2026-07-digital-purchases-v2",
    BACKGROUND_COMMERCE_WEBHOOK_READY: "true",
    BACKGROUND_COMMERCE_WEBHOOK_EVENTS: "checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,refund.created,refund.updated,refund.failed,charge.dispute.created,charge.dispute.updated,charge.dispute.closed",
    BACKGROUND_COMMERCE_RECONCILIATION_READY: "true",
    BACKGROUND_COMMERCE_TAX_MODE: "stripe",
    BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10000000",
    BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "true",
    BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "true",
    STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED: "true",
    STRIPE_SUPPORTER_TAX_PRODUCT_CODE: "txcd_10000000",
    STRIPE_SUPPORTER_TAX_PROVIDER_READY: "true",
    STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY: "true",
    STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED: "true",
    ...membershipPrices,
    ...overrides,
  }
}

/**
 * Runs readiness in a hermetic child process so repository dotenv files cannot
 * satisfy or alter an individual deployment-contract test.
 */
function runReadiness(overrides = {}, args = []) {
  return spawnSync(process.execPath, [readinessScriptPath, "--no-dotenv", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: readinessEnvironment(overrides),
  })
}

describe("Stripe readiness background-commerce contract", () => {
  it("accepts boolean true or a trimmed case-insensitive true string and rejects other values", () => {
    assert.deepEqual(
      [true, " TRUE ", false, "1", "yes", undefined].map(isExplicitTrue),
      [true, true, false, false, false, false],
    )
  })

  it("ignores the retired Early Access environment flag", () => {
    const result = runReadiness({ MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED: "not-a-boolean" })

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /EARLY_ACCESS|Early Access|early access/)
  })
  it("requires the approved Supporter amounts during Stripe Price verification", () => {
    assert.deepEqual(
      REQUIRED_SUPPORTER_PRICE_CONTRACT.map(({ key, unitAmount }) => [key, unitAmount]),
      [
        ["STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID", 100],
        ["STRIPE_SUPPORTER_1_YEARLY_PRICE_ID", 1000],
        ["STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID", 200],
        ["STRIPE_SUPPORTER_2_YEARLY_PRICE_ID", 2000],
        ["STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID", 500],
        ["STRIPE_SUPPORTER_5_YEARLY_PRICE_ID", 5000],
      ],
    )

    const expected = REQUIRED_SUPPORTER_PRICE_CONTRACT[2]
    assert.deepEqual(
      validateRetrievedMembershipPrice({
        active: true,
        billing_scheme: "per_unit",
        recurring: {
          interval: expected.interval,
          interval_count: 1,
          trial_period_days: null,
          usage_type: "licensed",
        },
        currency: "usd",
        unit_amount: 201,
        tax_behavior: "exclusive",
        transform_quantity: null,
        currency_options: null,
        product: supporterProduct(),
      }, expected),
      [`${expected.key} must have unit_amount ${expected.unitAmount}; received 201.`],
    )
  })
  it("requires exclusive recurring tax Prices on the confirmed Supporter classification", () => {
    const expected = REQUIRED_SUPPORTER_PRICE_CONTRACT[0]
    const basePrice = {
      active: true,
      billing_scheme: "per_unit",
      recurring: {
        interval: expected.interval,
        interval_count: 1,
        trial_period_days: null,
        usage_type: "licensed",
      },
      currency: "usd",
      unit_amount: expected.unitAmount,
      tax_behavior: "exclusive",
      transform_quantity: null,
      currency_options: null,
      product: supporterProduct(),
    }

    assert.deepEqual(validateRetrievedMembershipPrice(basePrice, expected), [])
    assert.deepEqual(
      validateRetrievedMembershipPrice({
        ...basePrice,
        tax_behavior: "inclusive",
        product: supporterProduct({ tax_code: "txcd_10202003" }),
      }, expected),
      [
        `${expected.key} must use exclusive tax behavior.`,
        `${expected.key} Product must use tax code txcd_10000000.`,
      ],
    )
  })
  it("fails closed with structured Price checks when Stripe retrieval is nullish", () => {
    const expected = REQUIRED_SUPPORTER_PRICE_CONTRACT[0]

    assert.deepEqual(
      validateRetrievedMembershipPrice(null, expected),
      [
        `${expected.key} points to an inactive Stripe Price.`,
        `${expected.key} must have unit_amount ${expected.unitAmount}; received missing.`,
        `${expected.key} must use usd currency; received missing.`,
        `${expected.key} billing_scheme must be per_unit.`,
        `${expected.key} must be a ${expected.interval} recurring Price.`,
        `${expected.key} recurring interval_count must be exactly 1.`,
        `${expected.key} recurring usage_type must be licensed.`,
        `${expected.key} must use exclusive tax behavior.`,
        `${expected.key} must be retrieved with currency_options expanded.`,
        `${expected.key} Product must be expanded for validation.`,
      ],
    )
  })
  it("requires the same strict recurring Price semantics as the migration", () => {
    const expected = REQUIRED_SUPPORTER_PRICE_CONTRACT[0]
    const basePrice = {
      active: true,
      billing_scheme: "per_unit",
      recurring: {
        interval: expected.interval,
        interval_count: 1,
        trial_period_days: null,
        usage_type: "licensed",
      },
      currency: "usd",
      unit_amount: expected.unitAmount,
      tax_behavior: "exclusive",
      transform_quantity: null,
      currency_options: null,
      product: supporterProduct(),
    }
    assert.deepEqual(
      validateRetrievedMembershipPrice({
        ...basePrice,
        currency_options: {
          usd: {
            unit_amount: expected.unitAmount,
            tax_behavior: "exclusive",
          },
        },
      }, expected),
      [],
      "Stripe may expand currency_options with only the base currency",
    )
    const cases = [
      [
        (candidate) => { candidate.active = false },
        `${expected.key} points to an inactive Stripe Price.`,
      ],
      [
        (candidate) => { candidate.product.active = false },
        `${expected.key} belongs to an inactive Stripe Product.`,
      ],
      [
        (candidate) => { candidate.product.name = "MassageLab Supporter" },
        `${expected.key} Product name must be MassageLab Supporter Membership.`,
      ],
      [
        (candidate) => { candidate.currency = "cad" },
        `${expected.key} must use usd currency; received cad.`,
      ],
      [
        (candidate) => { candidate.recurring.interval = "year" },
        `${expected.key} must be a month recurring Price.`,
      ],
      [
        (candidate) => { candidate.recurring.interval_count = 2 },
        `${expected.key} recurring interval_count must be exactly 1.`,
      ],
      [
        (candidate) => { candidate.recurring.trial_period_days = 14 },
        `${expected.key} must not define a recurring trial period.`,
      ],
      [
        (candidate) => { candidate.recurring.usage_type = "metered" },
        `${expected.key} recurring usage_type must be licensed.`,
      ],
      [
        (candidate) => { candidate.billing_scheme = "tiered" },
        `${expected.key} billing_scheme must be per_unit.`,
      ],
      [
        (candidate) => {
          candidate.transform_quantity = { divide_by: 10, round: "up" }
        },
        `${expected.key} must not transform quantity.`,
      ],
      [
        (candidate) => {
          candidate.currency_options = {
            usd: {
              unit_amount: expected.unitAmount + 1,
              tax_behavior: "exclusive",
            },
          }
        },
        `${expected.key} must not define additional currency options.`,
      ],
      [
        (candidate) => {
          candidate.currency_options = {
            usd: {
              unit_amount: expected.unitAmount,
              tax_behavior: "inclusive",
            },
          }
        },
        `${expected.key} must not define additional currency options.`,
      ],
      [
        (candidate) => {
          candidate.currency_options = {
            usd: {
              unit_amount: expected.unitAmount,
              tax_behavior: "exclusive",
            },
            eur: {
              unit_amount: expected.unitAmount,
              tax_behavior: "exclusive",
            },
          }
        },
        `${expected.key} must not define additional currency options.`,
      ],
      [
        (candidate) => {
          candidate.currency_options = { usd: null }
        },
        `${expected.key} must not define additional currency options.`,
      ],
      [
        (candidate) => {
          candidate.currency_options = "usd"
        },
        `${expected.key} must not define additional currency options.`,
      ],
    ]

    for (const [mutate, expectedFailure] of cases) {
      const candidate = structuredClone(basePrice)
      mutate(candidate)
      assert.deepEqual(
        validateRetrievedMembershipPrice(candidate, expected),
        [expectedFailure],
      )
    }

    const withoutExpandedCurrencyOptions = structuredClone(basePrice)
    delete withoutExpandedCurrencyOptions.currency_options
    assert.deepEqual(
      validateRetrievedMembershipPrice(withoutExpandedCurrencyOptions, expected),
      [`${expected.key} must be retrieved with currency_options expanded.`],
      "missing currency_options cannot prove the expanded Price has no alternatives",
    )
  })

  it("checks tax behavior only when it belongs to the caller's Price contract", () => {
    const legacyPrice = {
      billing_scheme: "per_unit",
      recurring: {
        interval: "month",
        interval_count: 1,
        trial_period_days: null,
        usage_type: "licensed",
      },
      currency: "usd",
      unit_amount: 900,
      tax_behavior: "unspecified",
      transform_quantity: null,
      currency_options: null,
    }

    assert.deepEqual(
      recurringPriceSemanticMismatches(legacyPrice, {
        interval: "month",
        unitAmount: 900,
      }),
      [],
      "legacy retirement identity deliberately does not classify historical tax behavior",
    )
    assert.deepEqual(
      recurringPriceSemanticMismatches(legacyPrice, {
        interval: "month",
        unitAmount: 900,
        taxBehavior: "exclusive",
      }),
      ["tax_behavior"],
      "the current Supporter catalog must require its explicit tax behavior",
    )
  })
  it("requires six unique Supporter amount Prices and ignores legacy catalog variables", () => {
    const missing = runReadiness({ STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "" })
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /STRIPE_SUPPORTER_2_YEARLY_PRICE_ID is missing/)

    const duplicate = runReadiness({ STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: membershipPrices.STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID })
    assert.equal(duplicate.status, 1)
    assert.match(duplicate.stderr, /STRIPE_SUPPORTER_5_YEARLY_PRICE_ID duplicates STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID/)

    const legacyOnly = runReadiness({
      ...Object.fromEntries(Object.keys(membershipPrices).map((key) => [key, ""])),
      STRIPE_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_legacy_monthly",
      STRIPE_SUPPORTER_YEARLY_PRICE_ID: "price_supporter_legacy_yearly",
      STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist_monthly",
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
      STRIPE_PRACTICE_MONTHLY_PRICE_ID: "price_practice_monthly",
      STRIPE_PRACTICE_YEARLY_PRICE_ID: "price_practice_yearly",
    })
    assert.equal(legacyOnly.status, 1)
    assert.match(legacyOnly.stderr, /STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID is missing/)
  })
  it("reports the complete fail-closed commerce configuration without changing membership readiness output", () => {
    const result = runReadiness()

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /PASS Stripe membership environment is ready for the selected mode\./)
    assert.match(result.stdout, /Supporter recurring automatic tax enabled: true/)
    assert.match(result.stdout, /Supporter recurring tax classification confirmed: true/)
    assert.match(result.stdout, /Background commerce readiness: ready/)
    assert.match(result.stdout, /Background commerce fixed USD price configured: true/)
    assert.match(result.stdout, /Background commerce webhook event coverage complete: true/)
    assert.doesNotMatch(result.stdout, /sk_test_readiness|whsec_readiness/)
  })

  it("fails when any required commerce webhook event is absent", () => {
    const result = runReadiness({
      BACKGROUND_COMMERCE_WEBHOOK_EVENTS: "checkout.session.completed,refund.created",
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL Background commerce webhook event coverage is incomplete\./)
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_test_readiness|whsec_readiness/)
  })

  it("fails when the configured commerce webhook contract includes unrecognized extras", () => {
    const result = runReadiness({
      BACKGROUND_COMMERCE_WEBHOOK_EVENTS: "checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,refund.created,refund.updated,refund.failed,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,customer.created",
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL Background commerce webhook event coverage is incomplete\./)
  })

  it("fails closed on stale price, currency, country, document, webhook, reconciliation, and tax settings", () => {
    const cases = [
      ["price", { BACKGROUND_COMMERCE_PRICE_CENTS: "200" }],
      ["currency", { BACKGROUND_COMMERCE_CURRENCY: "cad" }],
      ["country", { BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "CA" }],
      ["document", { BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION: "stale" }],
      ["webhook", { BACKGROUND_COMMERCE_WEBHOOK_READY: "false" }],
      ["reconciliation", { BACKGROUND_COMMERCE_RECONCILIATION_READY: "false" }],
      ["tax", { BACKGROUND_COMMERCE_TAX_MODE: "unknown" }],
      ["tax code", { BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "" }],
      ["wrong tax code", { BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10202003" }],
      ["tax provider", { BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "false" }],
      ["tax registrations", { BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "false" }],
    ]

    for (const [name, overrides] of cases) {
      const result = runReadiness(overrides)
      assert.equal(result.status, 1, `${name}: ${result.stdout}${result.stderr}`)
      assert.match(result.stderr, /FAIL Background commerce/, name)
    }
  })

  it("fails closed on every Supporter recurring-tax deployment gate", () => {
    const cases = [
      ["enablement", { STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED: "false" }],
      ["tax code", { STRIPE_SUPPORTER_TAX_PRODUCT_CODE: "" }],
      ["wrong tax code", { STRIPE_SUPPORTER_TAX_PRODUCT_CODE: "txcd_10202003" }],
      ["provider", { STRIPE_SUPPORTER_TAX_PROVIDER_READY: "false" }],
      ["registrations", { STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY: "false" }],
      ["classification", { STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED: "false" }],
    ]

    for (const [name, overrides] of cases) {
      const result = runReadiness(overrides)
      assert.equal(result.status, 1, `${name}: ${result.stdout}${result.stderr}`)
      assert.match(result.stderr, /FAIL Supporter recurring tax/, name)
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_test_readiness|whsec_readiness/)
    }
  })

  it("loads every Supporter recurring-tax gate from an explicit env file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "massagelab-readiness-"))
    const envFile = join(directory, "supporter-tax.env")
    const supporterTaxKeys = [
      "STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED",
      "STRIPE_SUPPORTER_TAX_PRODUCT_CODE",
      "STRIPE_SUPPORTER_TAX_PROVIDER_READY",
      "STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY",
      "STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED",
    ]
    const environment = readinessEnvironment()
    for (const key of supporterTaxKeys) {
      delete environment[key]
    }
    assert.equal(
      Object.hasOwn(environment, "STRIPE_SUPPORTER_TAX_PRODUCT_CODE"),
      false,
      "the valid tax code must exist only in the temporary env file",
    )

    try {
      await writeFile(envFile, [
        "STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED=true",
        "STRIPE_SUPPORTER_TAX_PRODUCT_CODE=\" txcd_10000000 \"",
        "STRIPE_SUPPORTER_TAX_PROVIDER_READY=true",
        "STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY=true",
        "STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED=true",
      ].join("\n"))

      const dotenvDisabled = spawnSync(
        process.execPath,
        [
          readinessScriptPath,
          "--no-dotenv",
          `--env-file=${envFile}`,
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: environment,
        },
      )
      assert.equal(dotenvDisabled.error, undefined, dotenvDisabled.error?.message)
      assert.equal(dotenvDisabled.status, 1)
      assert.match(
        dotenvDisabled.stderr,
        /FAIL Supporter recurring tax automatic-tax enablement is not configured\./,
      )

      const result = spawnSync(
        process.execPath,
        [
          readinessScriptPath,
          `--env-file=${envFile}`,
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: environment,
        },
      )

      assert.equal(result.error, undefined, result.error?.message)
      assert.equal(result.status, 0, result.stderr || result.stdout)
      assert.match(result.stdout, /Supporter recurring automatic tax enabled: true/)
      assert.match(result.stdout, /Supporter recurring tax classification confirmed: true/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it("rejects live international commerce while background purchases remain U.S.-only", () => {
    const result = runReadiness({
      STRIPE_SECRET_KEY: "sk_live_readiness",
      BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "US,CA",
    }, ["--live"])

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL Background commerce purchase-country allowlist is not configured\./)
  })

  it("requires Stripe retrieval before live readiness can pass", () => {
    const result = runReadiness({
      STRIPE_SECRET_KEY: "sk_live_readiness",
    }, ["--live"])

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL Live Stripe readiness requires --verify-stripe\./)
    assert.match(result.stdout, /Stripe API retrieval requested: false/)
    assert.match(result.stdout, /Stripe API retrieval performed: false/)
    assert.doesNotMatch(result.stdout, /PASS Stripe membership environment is ready/)
  })

  it("reports requested Stripe verification as not performed when local gates fail first", () => {
    const result = runReadiness({
      STRIPE_SECRET_KEY: "sk_live_readiness",
      STRIPE_WEBHOOK_SECRET: "",
    }, ["--live", "--verify-stripe"])

    assert.equal(result.status, 1)
    assert.match(result.stdout, /Stripe API retrieval requested: true/)
    assert.match(result.stdout, /Stripe API retrieval performed: false/)
  })

  it("checks the complete Price ID inventory before retrieval and reporting", async () => {
    const source = await readFile(readinessScriptPath, "utf8")
    const checkPriceIdsIndex = source.lastIndexOf("\ncheckPriceIds()")
    const verifyPricesIndex = source.lastIndexOf("\nawait verifyStripePrices()")
    const printResultsIndex = source.lastIndexOf("\nprintResults(")
    const validateRetrievedPriceIndex = source.indexOf(
      "validateRetrievedMembershipPrice(price, expected)",
    )
    const retrievalPerformedIndex = source.indexOf(
      "stripeRetrievalPerformed = true",
    )

    assert.ok(checkPriceIdsIndex >= 0)
    assert.ok(checkPriceIdsIndex < verifyPricesIndex)
    assert.ok(verifyPricesIndex < printResultsIndex)
    assert.ok(validateRetrievedPriceIndex >= 0)
    assert.ok(validateRetrievedPriceIndex < retrievalPerformedIndex)
    assert.equal(
      source.match(/stripeRetrievalPerformed = true/g)?.length,
      1,
    )

    const result = runReadiness({
      ...Object.fromEntries(Object.keys(membershipPrices).map((key) => [key, ""])),
    }, ["--verify-stripe"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID is missing/)
    assert.match(result.stdout, /Stripe API retrieval requested: true/)
    assert.match(result.stdout, /Stripe API retrieval performed: false/)
  })
})
