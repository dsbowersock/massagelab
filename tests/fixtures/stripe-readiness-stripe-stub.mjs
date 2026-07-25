import {
  STRIPE_PINNED_WEBHOOK_EVENTS,
  STRIPE_PINNED_WEBHOOK_URL,
} from "../../lib/stripe-webhook-contract.js"

function supporterPrice(priceId) {
  const configuredPrices = [
    [process.env.STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID, 100, "month"],
    [process.env.STRIPE_SUPPORTER_1_YEARLY_PRICE_ID, 1000, "year"],
    [process.env.STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID, 200, "month"],
    [process.env.STRIPE_SUPPORTER_2_YEARLY_PRICE_ID, 2000, "year"],
    [process.env.STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID, 500, "month"],
    [process.env.STRIPE_SUPPORTER_5_YEARLY_PRICE_ID, 5000, "year"],
  ]
  const configuredPrice = configuredPrices.find(([candidateId]) => candidateId === priceId)
  if (!configuredPrice) {
    throw new Error("Unexpected readiness Price fixture")
  }
  if (process.env.STRIPE_READINESS_STUB_FAIL_PRICE_ID === priceId) {
    throw new Error("Simulated Stripe Price retrieval failure")
  }

  const [, unitAmount, interval] = configuredPrice
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
      active: true,
      name: "MassageLab Supporter Membership",
      tax_code: "txcd_10000000",
    },
  }
}

/** Hermetic Stripe client used only by readiness CLI child-process tests. */
export default class StripeReadinessStub {
  constructor(_apiKey, config = {}) {
    this.config = config
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
