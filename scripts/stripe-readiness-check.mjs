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
import { DIGITAL_PURCHASES_REFUNDS_VERSION } from "../lib/legal-documents.js"
import {
  STRIPE_API_VERSION,
  STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS,
  STRIPE_PINNED_WEBHOOK_URL,
  validatePinnedStripeWebhookEndpoint,
} from "../lib/stripe-webhook-contract.js"

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
let commerceWebhookCoverageComplete = false
let verifiedWebhookCoverageComplete = !verifyStripe
let verifiedWebhookEndpointEnabled = !verifyStripe
let verifiedWebhookApiVersionCurrent = !verifyStripe

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

function isExplicitTrue(value) {
  return String(value ?? "").trim().toLowerCase() === "true"
}

/**
 * Validates only explicit, deploy-time background-commerce signals. Values are
 * reported as booleans or non-secret identifiers so the check cannot expose
 * Stripe credentials or processor payloads.
 */
function checkBackgroundCommerceReadiness() {
  const purchasingEnabled = isExplicitTrue(envValue("BACKGROUND_COMMERCE_PURCHASING_ENABLED"))
  const fixedUsdPriceConfigured = envValue("BACKGROUND_COMMERCE_PRICE_CENTS") === "100"
    && envValue("BACKGROUND_COMMERCE_CURRENCY").toLowerCase() === "usd"
  const purchaseCountries = envValue("BACKGROUND_COMMERCE_PURCHASE_COUNTRIES")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean)
  const purchaseCountryAllowlistConfigured = purchaseCountries.length === 1
    && purchaseCountries[0] === "US"
  const digitalPurchaseDocumentCurrent = envValue("BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION")
    === DIGITAL_PURCHASES_REFUNDS_VERSION
  const configuredEvents = new Set(envValue("BACKGROUND_COMMERCE_WEBHOOK_EVENTS")
    .split(",")
    .map((event) => event.trim())
    .filter(Boolean))
  commerceWebhookCoverageComplete = configuredEvents.size === STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS.length
    && STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS.every((event) => configuredEvents.has(event))
  const webhookReady = isExplicitTrue(envValue("BACKGROUND_COMMERCE_WEBHOOK_READY"))
  const reconciliationReady = isExplicitTrue(envValue("BACKGROUND_COMMERCE_RECONCILIATION_READY"))
  const taxMode = envValue("BACKGROUND_COMMERCE_TAX_MODE").toLowerCase()
  const taxModeConfigured = taxMode === "disabled" || taxMode === "stripe"
  const taxCodeConfigured = /^txcd_\d+$/.test(envValue("BACKGROUND_COMMERCE_TAX_PRODUCT_CODE"))
  const taxProviderReady = isExplicitTrue(envValue("BACKGROUND_COMMERCE_TAX_PROVIDER_READY"))
  const taxRegistrationsReady = isExplicitTrue(envValue("BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY"))
  const stripeTaxReady = taxMode === "stripe"
    && taxCodeConfigured
    && taxProviderReady
    && taxRegistrationsReady
  const internationalEnabled = purchaseCountries.some((country) => country !== "US")

  if (!purchasingEnabled) addFailure("Background commerce purchasing enablement is not configured.")
  if (!fixedUsdPriceConfigured) addFailure("Background commerce fixed USD price is not configured.")
  if (!purchaseCountryAllowlistConfigured) addFailure("Background commerce purchase-country allowlist is not configured.")
  if (!digitalPurchaseDocumentCurrent) addFailure("Background commerce digital-purchase document version is not current.")
  if (!webhookReady) addFailure("Background commerce webhook readiness is not configured.")
  if (!commerceWebhookCoverageComplete) addFailure("Background commerce webhook event coverage is incomplete.")
  if (!reconciliationReady) addFailure("Background commerce reconciliation readiness is not configured.")
  if (!taxModeConfigured) addFailure("Background commerce tax mode is not configured.")
  if (taxMode === "stripe" && !stripeTaxReady) {
    addFailure(liveMode
      ? "Live Stripe Tax requires an explicit product tax code, provider readiness, and registrations readiness."
      : "Background commerce Stripe Tax configuration is incomplete.")
  }
  if (liveMode && internationalEnabled && !stripeTaxReady) {
    addFailure("Live international background commerce requires Stripe tax mode with explicit registration and product-code readiness.")
  }

  return {
    fixedUsdPriceConfigured,
    purchaseCountryAllowlistConfigured,
    digitalPurchaseDocumentCurrent,
    webhookReady,
    reconciliationReady,
    taxMode: taxModeConfigured ? taxMode : "missing",
  }
}

async function verifyStripePrices() {
  if (!verifyStripe || failures.length > 0) {
    return
  }

  const stripe = new Stripe(envValue("STRIPE_SECRET_KEY"), {
    apiVersion: STRIPE_API_VERSION,
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

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
    const endpoint = endpoints.data.find((candidate) => candidate.url === STRIPE_PINNED_WEBHOOK_URL)
    const endpointResult = validatePinnedStripeWebhookEndpoint(endpoint)
    verifiedWebhookCoverageComplete = endpointResult.eventSetExact
    verifiedWebhookEndpointEnabled = endpointResult.enabled
    verifiedWebhookApiVersionCurrent = endpointResult.apiVersionCurrent
    if (!endpointResult.endpointFound) addFailure("The pinned Stripe webhook endpoint was not found.")
    if (endpointResult.endpointFound && !endpointResult.enabled) addFailure("The pinned Stripe webhook endpoint is not enabled.")
    if (endpointResult.endpointFound && !endpointResult.apiVersionCurrent) {
      addFailure("The pinned Stripe webhook endpoint API version does not match the app.")
    }
    if (endpointResult.endpointFound && !endpointResult.eventSetExact) {
      addFailure("The pinned Stripe webhook endpoint event set does not exactly match the app contract.")
    }
  } catch {
    verifiedWebhookCoverageComplete = false
    verifiedWebhookEndpointEnabled = false
    verifiedWebhookApiVersionCurrent = false
    addFailure("The pinned Stripe webhook endpoint could not be verified.")
  }
}

function printResults(commerce) {
  console.log(`Stripe readiness mode: ${liveMode ? "live" : "non-live"}`)
  console.log(`Stripe API retrieval: ${verifyStripe ? "enabled" : "skipped"}`)
  console.log(`Background commerce fixed USD price configured: ${commerce.fixedUsdPriceConfigured}`)
  console.log(`Background commerce purchase-country allowlist configured: ${commerce.purchaseCountryAllowlistConfigured}`)
  console.log(`Background commerce digital-purchase document current: ${commerce.digitalPurchaseDocumentCurrent}`)
  console.log(`Background commerce webhook readiness configured: ${commerce.webhookReady}`)
  console.log(`Background commerce webhook event coverage complete: ${commerceWebhookCoverageComplete && verifiedWebhookCoverageComplete}`)
  console.log(`Pinned Stripe webhook endpoint enabled: ${verifiedWebhookEndpointEnabled}`)
  console.log(`Pinned Stripe webhook API version current: ${verifiedWebhookApiVersionCurrent}`)
  console.log(`Background commerce reconciliation configured: ${commerce.reconciliationReady}`)
  console.log(`Background commerce tax mode: ${commerce.taxMode}`)

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

  console.log("Background commerce readiness: ready")
  console.log("PASS Stripe membership environment is ready for the selected mode.")
}

checkSecretKey()
checkWebhookSecret()
checkPriceIds()
checkEarlyAccessFlag()
const commerce = checkBackgroundCommerceReadiness()
await verifyStripePrices()
printResults(commerce)
