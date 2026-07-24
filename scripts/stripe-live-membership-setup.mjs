#!/usr/bin/env node

/**
 * Creates or reuses live Stripe membership resources for MassageLab.
 *
 * Required input:
 *   STRIPE_SECRET_KEY=sk_live_...
 *
 * Optional input:
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * The script writes the Vercel-ready Stripe env values to the requested output
 * file and intentionally does not print secret values to stdout.
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import Stripe from "stripe"
import { config as loadDotenv } from "dotenv"

const STRIPE_API_VERSION = "2026-02-25.clover"
const DEFAULT_WEBHOOK_URL = "https://www.massagelab.app/api/billing/webhook"
const WEBHOOK_EVENTS = Object.freeze([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
])

const PLANS = Object.freeze([
  {
    level: "SUPPORTER",
    name: "MassageLab Supporter",
    description: "Alpha supporter membership for MassageLab.",
    prices: [
      { envKey: "STRIPE_SUPPORTER_MONTHLY_PRICE_ID", interval: "month", unitAmount: 900 },
      { envKey: "STRIPE_SUPPORTER_YEARLY_PRICE_ID", interval: "year", unitAmount: 9000 },
    ],
  },
  {
    level: "THERAPIST",
    name: "MassageLab Therapist",
    description: "Individual therapist membership for MassageLab.",
    prices: [
      { envKey: "STRIPE_THERAPIST_MONTHLY_PRICE_ID", interval: "month", unitAmount: 2900 },
      { envKey: "STRIPE_THERAPIST_YEARLY_PRICE_ID", interval: "year", unitAmount: 27900 },
    ],
  },
  {
    level: "PRACTICE",
    name: "MassageLab Practice",
    description: "Team and practice membership for MassageLab.",
    prices: [
      { envKey: "STRIPE_PRACTICE_MONTHLY_PRICE_ID", interval: "month", unitAmount: 7900 },
      { envKey: "STRIPE_PRACTICE_YEARLY_PRICE_ID", interval: "year", unitAmount: 75900 },
    ],
  },
])

const COUPONS = Object.freeze([
  {
    id: "kfRFWYmC",
    name: "Student to Therapist 20% Discount",
    percent_off: 20,
    duration: "forever",
  },
])

const rawArgs = process.argv.slice(2)
const envFile = argValue("--env-file")
const outputFile = argValue("--output")
const webhookUrl = argValue("--webhook-url") || DEFAULT_WEBHOOK_URL

if (!envFile || !outputFile) {
  fail("Usage: npm run stripe:live:setup -- --env-file=C:\\tmp\\live-stripe.env --output=C:\\tmp\\massagelab-live-stripe.generated.env")
}

loadEnvironment(envFile)

const apiKey = envValue("STRIPE_SECRET_KEY")
if (!apiKey.startsWith("sk_live_")) {
  fail("STRIPE_SECRET_KEY must be a live sk_live_ key.")
}

const stripe = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION })
const output = new Map([["STRIPE_SECRET_KEY", apiKey]])
const notes = []

for (const plan of PLANS) {
  const product = await ensureProduct(plan)
  notes.push(`Product ready: ${plan.name}`)

  for (const priceSpec of plan.prices) {
    const price = await ensurePrice(product, plan, priceSpec)
    output.set(priceSpec.envKey, price.id)
    notes.push(`Price ready: ${priceSpec.envKey}`)
  }
}

for (const couponSpec of COUPONS) {
  await ensureCoupon(couponSpec)
  notes.push(`Coupon ready: ${couponSpec.id}`)
}

const webhookSecret = await ensureWebhookSecret()
output.set("STRIPE_WEBHOOK_SECRET", webhookSecret)
writeOutputFile(outputFile, output)

for (const note of notes) {
  console.log(note)
}
console.log(`Wrote Vercel-ready Stripe env values to ${path.resolve(outputFile)}`)
console.log("Secret values were not printed. Delete the output file after applying Vercel env values.")

function argValue(name) {
  const prefix = `${name}=`
  const match = rawArgs.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : ""
}

function envValue(key) {
  return process.env[key]?.trim() ?? ""
}

function loadEnvironment(file) {
  const absolutePath = path.resolve(file)
  if (!fs.existsSync(absolutePath)) {
    fail(`Env file not found: ${absolutePath}`)
  }

  loadDotenv({ path: absolutePath, override: true, quiet: true })
}

async function listAll(listPromise) {
  return listPromise.autoPagingToArray({ limit: 10_000 })
}

async function ensureProduct(plan) {
  const products = await listAll(stripe.products.list({ active: true, limit: 100 }))
  const existing = products.find((product) => product.metadata?.massagelab_membership_level === plan.level)
    ?? products.find((product) => product.name === plan.name)

  if (existing) {
    if (existing.metadata?.massagelab_membership_level !== plan.level) {
      await stripe.products.update(existing.id, {
        metadata: {
          ...existing.metadata,
          massagelab_membership_level: plan.level,
        },
      })
    }
    return existing
  }

  return stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: {
      massagelab_membership_level: plan.level,
      app: "massagelab",
    },
  })
}

async function ensurePrice(product, plan, priceSpec) {
  const prices = await listAll(stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  }))
  const existing = prices.find((price) => (
    price.unit_amount === priceSpec.unitAmount
    && price.currency === "usd"
    && price.recurring?.interval === priceSpec.interval
  ))

  if (existing) {
    return existing
  }

  return stripe.prices.create({
    product: product.id,
    unit_amount: priceSpec.unitAmount,
    currency: "usd",
    recurring: { interval: priceSpec.interval },
    lookup_key: `massagelab_${plan.level.toLowerCase()}_${priceSpec.interval}`,
    metadata: {
      app: "massagelab",
      massagelab_membership_level: plan.level,
      massagelab_billing_interval: priceSpec.interval,
    },
  })
}

async function ensureCoupon(couponSpec) {
  try {
    return await stripe.coupons.retrieve(couponSpec.id)
  } catch (error) {
    if (error?.code !== "resource_missing") {
      throw error
    }
  }

  return stripe.coupons.create(couponSpec)
}

async function ensureWebhookSecret() {
  const configuredSecret = envValue("STRIPE_WEBHOOK_SECRET")
  const endpoints = await listAll(stripe.webhookEndpoints.list({ limit: 100 }))
  const existing = endpoints.find((endpoint) => endpoint.url === webhookUrl && endpoint.status !== "disabled")

  if (existing) {
    const enabledEvents = new Set(existing.enabled_events ?? [])
    const desiredEvents = [...new Set([...enabledEvents, ...WEBHOOK_EVENTS])]
    if (desiredEvents.length !== enabledEvents.size) {
      await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: desiredEvents,
      })
    }

    if (!configuredSecret.startsWith("whsec_")) {
      fail(`A live webhook endpoint already exists for ${webhookUrl}, but Stripe does not reveal existing signing secrets through the API. Add STRIPE_WEBHOOK_SECRET to the input env file from the Stripe Dashboard, then rerun.`)
    }
    return configuredSecret
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: WEBHOOK_EVENTS,
    description: "MassageLab production billing webhook",
    metadata: { app: "massagelab" },
  })

  if (!endpoint.secret?.startsWith("whsec_")) {
    fail("Stripe created the webhook endpoint but did not return a signing secret.")
  }

  return endpoint.secret
}

function writeOutputFile(file, values) {
  const absolutePath = path.resolve(file)
  const parent = path.dirname(absolutePath)
  fs.mkdirSync(parent, { recursive: true })

  const body = [...values.entries()]
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`)
    .join("\n")
  fs.writeFileSync(absolutePath, `${body}\n`, { encoding: "utf8", flag: "w", mode: 0o600 })
  fs.chmodSync(absolutePath, 0o600)
}

function quoteEnvValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`
}

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exit(1)
}
