#!/usr/bin/env node

/**
 * Checks the Stripe membership environment without printing secret values.
 * Use `--live` for production readiness and `--verify-stripe` when network
 * access is available to retrieve configured Price records from Stripe.
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import Stripe from "stripe"
import { config as loadDotenv } from "dotenv"

const REQUIRED_PRICE_VARS = Object.freeze([
  ["STRIPE_SUPPORTER_MONTHLY_PRICE_ID", "SUPPORTER", "month"],
  ["STRIPE_SUPPORTER_YEARLY_PRICE_ID", "SUPPORTER", "year"],
  ["STRIPE_THERAPIST_MONTHLY_PRICE_ID", "THERAPIST", "month"],
  ["STRIPE_THERAPIST_YEARLY_PRICE_ID", "THERAPIST", "year"],
  ["STRIPE_PRACTICE_MONTHLY_PRICE_ID", "PRACTICE", "month"],
  ["STRIPE_PRACTICE_YEARLY_PRICE_ID", "PRACTICE", "year"],
])

const rawArgs = process.argv.slice(2)
const args = new Set(rawArgs.filter((arg) => !arg.startsWith("--env-file=")))
const envFileArg = rawArgs.find((arg) => arg.startsWith("--env-file="))
const explicitEnvFile = envFileArg ? envFileArg.slice("--env-file=".length) : ""
const liveMode = args.has("--live")
const verifyStripe = args.has("--verify-stripe")
const noDotenv = args.has("--no-dotenv")

const failures = []
const warnings = []
const priceIds = new Map()

if (!noDotenv) {
  loadEnvironment(explicitEnvFile)
}

function addFailure(message) {
  failures.push(message)
}

function addWarning(message) {
  warnings.push(message)
}

function envValue(key) {
  return process.env[key]?.trim() ?? ""
}

function loadEnvironment(envFile) {
  const candidates = envFile
    ? [envFile]
    : [".env.local", ".env"]

  if (envFile) {
    const absolutePath = path.resolve(envFile)
    if (!fs.existsSync(absolutePath)) {
      addFailure(`Env file not found: ${absolutePath}`)
      return
    }
  }

  for (const candidate of candidates) {
    const absolutePath = path.resolve(candidate)
    if (fs.existsSync(absolutePath)) {
      loadDotenv({ path: absolutePath, override: false, quiet: true })
    }
  }
}

function checkSecretKey() {
  const key = envValue("STRIPE_SECRET_KEY")
  if (!key) {
    addFailure("STRIPE_SECRET_KEY is missing.")
    return
  }

  if (liveMode && !key.startsWith("sk_live_")) {
    addFailure("STRIPE_SECRET_KEY must be a live secret key for production readiness.")
    return
  }

  if (!liveMode && !key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    addWarning("STRIPE_SECRET_KEY is configured but does not use the expected sk_test_ or sk_live_ prefix.")
  }
}

function checkWebhookSecret() {
  const secret = envValue("STRIPE_WEBHOOK_SECRET")
  if (!secret) {
    addFailure("STRIPE_WEBHOOK_SECRET is missing.")
    return
  }

  if (!secret.startsWith("whsec_")) {
    addFailure("STRIPE_WEBHOOK_SECRET should use Stripe's whsec_ webhook signing secret format.")
  }
}

function checkPriceIds() {
  for (const [key, level, interval] of REQUIRED_PRICE_VARS) {
    const priceId = envValue(key)
    if (!priceId) {
      addFailure(`${key} is missing.`)
      continue
    }

    if (!priceId.startsWith("price_")) {
      addFailure(`${key} must be a Stripe Price ID.`)
      continue
    }

    if (priceIds.has(priceId)) {
      const duplicate = priceIds.get(priceId)
      addFailure(`${key} duplicates ${duplicate.key}; each membership interval needs its own Price ID.`)
      continue
    }

    priceIds.set(priceId, { key, level, interval })
  }
}

function checkEarlyAccessFlag() {
  const value = envValue("MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED")
  if (!value) {
    addWarning("MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED is not set; checkout will treat early access as disabled.")
    return
  }

  if (!["true", "false"].includes(value.toLowerCase())) {
    addFailure("MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED must be true or false.")
  }

  if (liveMode && value.toLowerCase() === "true") {
    addWarning("Early-access discount is enabled in live mode. Confirm this is intentional before public signups.")
  }
}

async function verifyStripePrices() {
  if (!verifyStripe || failures.length > 0) {
    return
  }

  const stripe = new Stripe(envValue("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-02-25.clover",
  })

  for (const [priceId, expected] of priceIds) {
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] })
      if (!price.active) {
        addFailure(`${expected.key} points to an inactive Stripe Price.`)
      }

      if (price.recurring?.interval !== expected.interval) {
        addFailure(`${expected.key} must be a ${expected.interval} recurring Price.`)
      }

      if (price.currency !== "usd") {
        addWarning(`${expected.key} currency is ${price.currency}; expected usd for current MassageLab pricing.`)
      }

      const product = price.product
      if (!product || typeof product === "string") {
        addWarning(`${expected.key} could not expand its Product for name/active checks.`)
      } else {
        if (!product.active) {
          addFailure(`${expected.key} belongs to an inactive Stripe Product.`)
        }

        const productName = String(product.name ?? "").toLowerCase()
        const expectedLevelName = expected.level.toLowerCase()
        const productNameMatches = productName.includes(expectedLevelName)
          || (expected.level === "PRACTICE" && productName.includes("practice"))
        if (!productNameMatches) {
          addWarning(`${expected.key} Product name does not obviously match ${expected.level}.`)
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown Stripe error"
      addFailure(`${expected.key} could not be retrieved from Stripe: ${detail}`)
    }
  }
}

function printResults() {
  console.log(`Stripe readiness mode: ${liveMode ? "live" : "non-live"}`)
  console.log(`Stripe API retrieval: ${verifyStripe ? "enabled" : "skipped"}`)

  for (const warning of warnings) {
    console.log(`WARN ${warning}`)
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`)
    }
    process.exitCode = 1
    return
  }

  console.log("PASS Stripe membership environment is ready for the selected mode.")
}

checkSecretKey()
checkWebhookSecret()
checkPriceIds()
checkEarlyAccessFlag()
await verifyStripePrices()
printResults()
