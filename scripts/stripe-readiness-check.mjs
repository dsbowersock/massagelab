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
import { BACKGROUND_COMMERCE_TAX_PRODUCT_CODE } from "../lib/commerce/constants.js"
import { DIGITAL_PURCHASES_REFUNDS_VERSION } from "../lib/legal-documents.js"
import {
  getSupporterRecurringTaxReadiness,
  REQUIRED_SUPPORTER_PRICE_CONTRACT,
  validateRetrievedMembershipPrice,
} from "../lib/stripe-readiness.js"
import {
  STRIPE_API_VERSION,
  STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS,
  STRIPE_PINNED_WEBHOOK_URL,
  validatePinnedStripeWebhookEndpoint,
} from "../lib/stripe-webhook-contract.js"

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
  for (const expected of REQUIRED_SUPPORTER_PRICE_CONTRACT) {
    const priceId = envValue(expected.key)
    if (!priceId) {
      addFailure(`${expected.key} is missing.`)
      continue
    }

    if (!priceId.startsWith("price_")) {
      addFailure(`${expected.key} must be a Stripe Price ID.`)
      continue
    }

    if (priceIds.has(priceId)) {
      const duplicate = priceIds.get(priceId)
      addFailure(`${expected.key} duplicates ${duplicate.key}; each membership interval needs its own Price ID.`)
      continue
    }

    priceIds.set(priceId, expected)
  }
}

function isExplicitTrue(value) {
  return String(value ?? "").trim().toLowerCase() === "true"
}

/**
 * Validates the non-secret deployment attestations required for recurring
 * Supporter Automatic Tax. Stripe retrieval separately proves Product/Price
 * classification when --verify-stripe is enabled.
 */
function checkSupporterRecurringTaxReadiness() {
  const recurringTax = getSupporterRecurringTaxReadiness(process.env)

  if (!recurringTax.automaticTaxEnabled) {
    addFailure("Supporter recurring tax automatic-tax enablement is not configured.")
  }
  if (!recurringTax.taxProductCodeConfigured) {
    addFailure("Supporter recurring tax product classification is not configured.")
  }
  if (!recurringTax.taxProviderReady) {
    addFailure("Supporter recurring tax provider readiness is not configured.")
  }
  if (!recurringTax.taxRegistrationsReady) {
    addFailure("Supporter recurring tax registrations are not confirmed.")
  }
  if (!recurringTax.taxClassificationConfirmed) {
    addFailure("Supporter recurring tax classification is not professionally confirmed.")
  }

  return recurringTax
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
  const taxModeRecognized = taxMode === "disabled" || taxMode === "stripe"
  const taxProductCodeConfigured = envValue("BACKGROUND_COMMERCE_TAX_PRODUCT_CODE")
    === BACKGROUND_COMMERCE_TAX_PRODUCT_CODE
  const taxProviderReady = isExplicitTrue(envValue("BACKGROUND_COMMERCE_TAX_PROVIDER_READY"))
  const taxRegistrationsReady = isExplicitTrue(envValue("BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY"))
  const stripeTaxReady = taxMode === "stripe"
    && taxProductCodeConfigured
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
  if (!taxModeRecognized) addFailure("Background commerce tax mode is not configured.")
  if (taxMode === "disabled") addFailure("Paid background commerce requires Stripe automatic tax.")
  if (taxMode === "stripe" && !taxProductCodeConfigured) {
    addFailure("Background commerce Stripe Tax product code is not configured.")
  }
  if (taxMode === "stripe" && !taxProviderReady) {
    addFailure("Background commerce Stripe Tax provider readiness is not configured.")
  }
  if (taxMode === "stripe" && !taxRegistrationsReady) {
    addFailure("Background commerce Stripe Tax registrations are not confirmed.")
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
    taxMode: taxModeRecognized ? taxMode : "missing",
    taxProductCodeConfigured,
    taxProviderReady,
    taxRegistrationsReady,
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
      for (const failure of validateRetrievedMembershipPrice(price, expected)) {
        addFailure(failure)
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

function printResults(supporterTax, commerce) {
  console.log(`Stripe readiness mode: ${liveMode ? "live" : "non-live"}`)
  console.log(`Stripe API retrieval: ${verifyStripe ? "enabled" : "skipped"}`)
  console.log(`Supporter recurring automatic tax enabled: ${supporterTax.automaticTaxEnabled}`)
  console.log(`Supporter recurring tax product code configured: ${supporterTax.taxProductCodeConfigured}`)
  console.log(`Supporter recurring tax provider ready: ${supporterTax.taxProviderReady}`)
  console.log(`Supporter recurring tax registrations confirmed: ${supporterTax.taxRegistrationsReady}`)
  console.log(`Supporter recurring tax classification confirmed: ${supporterTax.taxClassificationConfirmed}`)
  console.log(`Background commerce fixed USD price configured: ${commerce.fixedUsdPriceConfigured}`)
  console.log(`Background commerce purchase-country allowlist configured: ${commerce.purchaseCountryAllowlistConfigured}`)
  console.log(`Background commerce digital-purchase document current: ${commerce.digitalPurchaseDocumentCurrent}`)
  console.log(`Background commerce webhook readiness configured: ${commerce.webhookReady}`)
  console.log(`Background commerce webhook event coverage complete: ${commerceWebhookCoverageComplete && verifiedWebhookCoverageComplete}`)
  console.log(`Pinned Stripe webhook endpoint enabled: ${verifiedWebhookEndpointEnabled}`)
  console.log(`Pinned Stripe webhook API version current: ${verifiedWebhookApiVersionCurrent}`)
  console.log(`Background commerce reconciliation configured: ${commerce.reconciliationReady}`)
  console.log(`Background commerce tax mode: ${commerce.taxMode}`)
  console.log(`Background commerce tax product code configured: ${commerce.taxProductCodeConfigured}`)
  console.log(`Background commerce tax provider ready: ${commerce.taxProviderReady}`)
  console.log(`Background commerce tax registrations confirmed: ${commerce.taxRegistrationsReady}`)

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
const supporterTax = checkSupporterRecurringTaxReadiness()
const commerce = checkBackgroundCommerceReadiness()
await verifyStripePrices()
printResults(supporterTax, commerce)
