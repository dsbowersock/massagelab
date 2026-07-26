import {
  STRIPE_API_VERSION,
  STRIPE_PINNED_WEBHOOK_EVENTS,
  STRIPE_PINNED_WEBHOOK_URL,
} from "../../lib/stripe-webhook-contract.js"

function supporterPrice(priceId) {
  const configuredPrices = [
    [process.env.STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID, 100, "month", "support-1"],
    [process.env.STRIPE_SUPPORTER_1_YEARLY_PRICE_ID, 1000, "year", "support-1"],
    [process.env.STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID, 200, "month", "support-2"],
    [process.env.STRIPE_SUPPORTER_2_YEARLY_PRICE_ID, 2000, "year", "support-2"],
    [process.env.STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID, 500, "month", "support-5"],
    [process.env.STRIPE_SUPPORTER_5_YEARLY_PRICE_ID, 5000, "year", "support-5"],
  ]
  const configuredPrice = configuredPrices.find(([candidateId]) => candidateId === priceId)
  if (!configuredPrice) {
    throw new Error("Unexpected readiness Price fixture")
  }
  if (process.env.STRIPE_READINESS_STUB_FAIL_PRICE_ID === priceId) {
    throw new Error("Simulated Stripe Price retrieval failure")
  }

  const [, unitAmount, interval, amountChoiceId] = configuredPrice
  const singleSupporterProduct =
    process.env.STRIPE_READINESS_STUB_SINGLE_SUPPORTER_PRODUCT === "true"
  const productAmountChoiceId = singleSupporterProduct ? "support-1" : amountChoiceId
  return {
    id: priceId,
    active: true,
    billing_scheme: "per_unit",
    currency: "usd",
    unit_amount: unitAmount,
    recurring: {
      interval,
      interval_count: 1,
      trial_period_days: null,
      usage_type: "licensed",
    },
    tax_behavior: "exclusive",
    transform_quantity: null,
    currency_options: null,
    product: {
      // Model the retired topology as one internally consistent Product so
      // per-slot metadata checks and aggregate topology checks both run.
      id: singleSupporterProduct
        ? "prod_support_1"
        : `prod_${amountChoiceId.replace("-", "_")}`,
      active: true,
      name: "MassageLab Supporter Membership",
      tax_code: "txcd_10000000",
      metadata: {
        app: "massagelab",
        massagelab_catalog: "supporter_membership_v1",
        massagelab_membership_level: "SUPPORTER",
        massagelab_supporter_amount_choice: productAmountChoiceId,
      },
    },
  }
}

/** Hermetic Stripe client used only by readiness CLI child-process tests. */
export default class StripeReadinessStub {
  constructor(_apiKey, config = {}) {
    // Match the app's pinned Stripe client while preserving explicit test overrides.
    this.config = {
      ...config,
      apiVersion: config.apiVersion ?? STRIPE_API_VERSION,
    }
    this.prices = {
      retrieve: async (priceId) => supporterPrice(priceId),
    }
    this.webhookEndpoints = {
      list: async () => ({
        data: [{
          url: STRIPE_PINNED_WEBHOOK_URL,
          status: "enabled",
          api_version: this.config.apiVersion,
          enabled_events: [...STRIPE_PINNED_WEBHOOK_EVENTS],
        }],
      }),
    }
  }
}
