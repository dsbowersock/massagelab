import { isBrowserQaDatabaseTargetAuthorized } from "./assert-browser-qa-database-target.mjs"

/** Exact values required for Browser-QA client, server, upload, and framework telemetry. */
export const BROWSER_QA_TELEMETRY_ENVIRONMENT = Object.freeze({
  NEXT_PUBLIC_SENTRY_DSN: "",
  SENTRY_DSN: "",
  SENTRY_AUTH_TOKEN: "",
  NEXT_TELEMETRY_DISABLED: "1",
})

/**
 * Explicitly disables every hosted mutation provider consumed by the app.
 * Keeping these keys in the child environment also blocks `.env.local` from
 * restoring developer credentials while Browser QA owns the server or build.
 */
export const BROWSER_QA_INERT_PROVIDER_ENVIRONMENT = Object.freeze({
  AUTH_GOOGLE_ID: "browser-qa-inert-google-client-id.invalid",
  AUTH_GOOGLE_SECRET: "browser-qa-inert-google-client-secret.invalid",
  AUTH_GOOGLE_CLIENT_ID: "",
  AUTH_GOOGLE_CLIENT_SECRET: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  SMTP_HOST: "",
  SMTP_FROM: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_PORT: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  NEXT_PUBLIC_STRIPE_DONATION_URL: "",
  STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "",
  STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "",
  STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "",
  STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "",
  STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "",
  STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "",
  STRIPE_SUPPORTER_MONTHLY_PRICE_ID: "",
  STRIPE_SUPPORTER_YEARLY_PRICE_ID: "",
  STRIPE_THERAPIST_MONTHLY_PRICE_ID: "",
  STRIPE_THERAPIST_YEARLY_PRICE_ID: "",
  STRIPE_PRACTICE_MONTHLY_PRICE_ID: "",
  STRIPE_PRACTICE_YEARLY_PRICE_ID: "",
  STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED: "false",
  STRIPE_SUPPORTER_TAX_PRODUCT_CODE: "",
  STRIPE_SUPPORTER_TAX_PROVIDER_READY: "false",
  STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY: "false",
  STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED: "false",
  STRIPE_ONE_TIME_SUPPORT_AUTOMATIC_TAX_ENABLED: "false",
  STRIPE_ONE_TIME_SUPPORT_TAX_PRODUCT_CODE: "",
  STRIPE_ONE_TIME_SUPPORT_TAX_PROVIDER_READY: "false",
  STRIPE_ONE_TIME_SUPPORT_TAX_REGISTRATIONS_READY: "false",
  STRIPE_ONE_TIME_SUPPORT_TAX_CLASSIFICATION_CONFIRMED: "false",
  BACKGROUND_COMMERCE_PURCHASING_ENABLED: "false",
  BACKGROUND_COMMERCE_PRICE_CENTS: "",
  BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "",
  BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION: "",
  BACKGROUND_COMMERCE_WEBHOOK_READY: "false",
  BACKGROUND_COMMERCE_RECONCILIATION_READY: "false",
  BACKGROUND_COMMERCE_TAX_MODE: "disabled",
  BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "",
  BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "false",
  BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "false",
  ADMIN_BILLING_GOODWILL_LIVE_ENABLED: "false",
  MASSAGELAB_MEMBERSHIP_WEBHOOK_WRITES_PAUSED: "1",
  MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED: "true",
  MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED: "false",
  CLOUDFLARE_ACCOUNT_ID: "",
  CLOUDFLARE_API_TOKEN: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  MASSAGELAB_R2_BUCKET: "",
  MASSAGELAB_R2_ENDPOINT: "",
  MASSAGELAB_PUBLIC_MEDIA_BUCKET: "",
  MASSAGELAB_PUBLIC_MEDIA_R2_ENDPOINT: "",
  GOOGLE_CALENDAR_CLIENT_ID: "",
  GOOGLE_CALENDAR_CLIENT_SECRET: "",
  GOOGLE_CALENDAR_REDIRECT_URI: "",
  CALENDAR_SYNC_ENCRYPTION_KEY: "",
  ABLY_API_KEY: "",
  MASSAGELAB_ENABLE_HOSTED_PHI_SYNC: "false",
  MASSAGELAB_HIPAA_BAA_CONFIRMED: "false",
  MASSAGELAB_HIPAA_RISK_REVIEW_CONFIRMED: "false",
  MASSAGELAB_ENABLE_SENTRY_TEST_ROUTE: "false",
  AUTH_SECURITY_NOTICE_RETRY_SEND: "0",
})

/** Database aliases and maintenance gates that must never reach Browser QA. */
export const BROWSER_QA_INERT_DATABASE_ALIAS_ENVIRONMENT = Object.freeze({
  DATABASE_URL_UNPOOLED: "",
  BACKGROUND_CREDIT_BACKFILL_DATABASE_URL: "",
  AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: "",
  AUTH_LEGACY_ATTEMPT_CLEANUP: "0",
  AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: "",
  AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL: "",
  AUTH_SECURITY_NOTICE_RETRY_DATABASE: "0",
})

/**
 * Keeps only the exact fingerprint-authorized disposable pair and guard inputs.
 * Unauthorized inputs are overwritten without returning or logging their values.
 * @param {Record<string, string | undefined>} [environment]
 */
export function resolveBrowserQaDatabaseEnvironment(environment = process.env) {
  const authorized = isBrowserQaDatabaseTargetAuthorized(environment)
  return {
    ...BROWSER_QA_INERT_DATABASE_ALIAS_ENVIRONMENT,
    DATABASE_URL: authorized ? environment.MASSAGELAB_BROWSER_QA_DATABASE_URL : "",
    DIRECT_URL: authorized ? environment.MASSAGELAB_BROWSER_QA_DIRECT_URL : "",
    MASSAGELAB_BROWSER_QA_DATABASE: authorized ? "1" : "",
    MASSAGELAB_BROWSER_QA_DATABASE_URL: authorized ? environment.MASSAGELAB_BROWSER_QA_DATABASE_URL : "",
    MASSAGELAB_BROWSER_QA_DIRECT_URL: authorized ? environment.MASSAGELAB_BROWSER_QA_DIRECT_URL : "",
    MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: authorized
      ? environment.MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT
      : "",
  }
}

/** Fails closed without including a rejected value in the error. */
export function assertBrowserQaTelemetryEnvironment(
  environment,
  { label = "Browser QA" } = {},
) {
  for (const [name, expected] of Object.entries(BROWSER_QA_TELEMETRY_ENVIRONMENT)) {
    if (environment[name] !== expected) {
      throw new Error(`${label} requires explicit telemetry-disabled ${name}`)
    }
  }
}

/**
 * Resolves the child-only Browser-QA build environment. Database values are
 * either the exact fingerprint-approved pair or explicit empties that block
 * dotenv fallback; arbitrary inherited URLs are never forwarded.
 */
export function resolveBrowserQaBuildEnvironment(environment = process.env) {
  return {
    ...environment,
    ...BROWSER_QA_INERT_PROVIDER_ENVIRONMENT,
    NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA: "1",
    NEXT_PUBLIC_RSC_SESSION_PROOF: "1",
    ...BROWSER_QA_TELEMETRY_ENVIRONMENT,
    ...resolveBrowserQaDatabaseEnvironment(environment),
  }
}
