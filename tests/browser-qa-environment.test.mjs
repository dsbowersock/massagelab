import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { runInNewContext } from "node:vm"

import playwrightConfig, {
  assertBrowserQaOwnedServerRequirement,
  browserQaTelemetryEnvironment,
  resolvePlaywrightWebServerEnvironment,
} from "../playwright.config.ts"
import { fingerprintBrowserQaDatabaseTarget } from "../scripts/assert-browser-qa-database-target.mjs"
import {
  assertBrowserQaTelemetryEnvironment,
  BROWSER_QA_INERT_DATABASE_ALIAS_ENVIRONMENT,
  BROWSER_QA_INERT_PROVIDER_ENVIRONMENT,
  resolveBrowserQaBuildEnvironment,
} from "../scripts/browser-qa-environment.mjs"

const runtimeUrl = "postgresql://browser_qa:runtime-secret@qa-runtime.example.test:5432/massagelab_browser_qa?sslmode=require"
const directUrl = "postgresql://browser_owner:direct-secret@qa-direct.example.test:5433/massagelab_browser_qa?sslmode=require"

function completeAuthorizedEnvironment() {
  return {
    DATABASE_URL: runtimeUrl,
    DIRECT_URL: directUrl,
    MASSAGELAB_BROWSER_QA_DATABASE: "1",
    MASSAGELAB_BROWSER_QA_DATABASE_URL: runtimeUrl,
    MASSAGELAB_BROWSER_QA_DIRECT_URL: directUrl,
    MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl),
    VERCEL_ENV: "preview",
  }
}

const expectedInertProviderEnvironment = Object.freeze({
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

const expectedInertDatabaseAliasEnvironment = Object.freeze({
  DATABASE_URL_UNPOOLED: "",
  BACKGROUND_CREDIT_BACKFILL_DATABASE_URL: "",
  AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: "",
  AUTH_LEGACY_ATTEMPT_CLEANUP: "0",
  AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: "",
  AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL: "",
  AUTH_SECURITY_NOTICE_RETRY_DATABASE: "0",
})

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

function getWorkflowJob(workflow, jobId) {
  const start = workflow.indexOf(`  ${jobId}:`)
  assert.notEqual(start, -1, `Expected workflow job ${jobId}`)
  const nextJob = workflow.slice(start + 1).search(/^  [a-z_]+:\r?$/m)
  return nextJob === -1 ? workflow.slice(start) : workflow.slice(start, start + 1 + nextJob)
}

test("hosted direct Browser-QA builds use the full isolated build resolver", async () => {
  const workflow = await readProjectFile(".github/workflows/ci.yml")
  const browserBuild = getWorkflowJob(workflow, "browser_build")
  const browserQa = getWorkflowJob(workflow, "browser_qa")
  const environment = Object.fromEntries(
    Object.keys(browserQaTelemetryEnvironment).map((name) => {
      const match = browserBuild.match(new RegExp(`^      ${name}: "([^"]*)"\\r?$`, "m"))
      assert.ok(match, `Expected browser_build to set ${name}`)
      return [name, match[1]]
    }),
  )

  assert.deepEqual(environment, browserQaTelemetryEnvironment)
  assert.doesNotThrow(() => assertBrowserQaTelemetryEnvironment(environment))
  assert.match(browserBuild, /^        run: npm run build:browser-qa\r?$/m)
  assert.equal((workflow.match(/^      NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA: "1"\r?$/gm) ?? []).length, 1)
  assert.match(browserQa, /^        run: npm run build:browser-qa\r?$/m)
})

test("Playwright-owned Browser QA replaces provider credentials in the child environment only", () => {
  const environment = {
    AUTH_GOOGLE_ID: "developer-google-id",
    AUTH_GOOGLE_SECRET: "developer-google-secret",
    SMTP_HOST: "developer-smtp-host",
    SMTP_FROM: "developer-smtp-from",
    SMTP_USER: "developer-smtp-user",
    SMTP_PASSWORD: "developer-smtp-password",
    SMTP_PORT: "587",
  }
  const resolved = resolvePlaywrightWebServerEnvironment(environment, "http://localhost:3999")

  assert.equal(resolved.AUTH_GOOGLE_ID, "browser-qa-inert-google-client-id.invalid")
  assert.equal(resolved.AUTH_GOOGLE_SECRET, "browser-qa-inert-google-client-secret.invalid")
  for (const name of ["SMTP_HOST", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD", "SMTP_PORT"]) {
    assert.equal(resolved[name], "")
  }
  assert.equal(environment.AUTH_GOOGLE_ID, "developer-google-id")
  assert.equal(environment.SMTP_HOST, "developer-smtp-host")
})

test("Browser-QA build and server overwrite every mutation-capable provider setting", () => {
  assert.deepEqual(BROWSER_QA_INERT_PROVIDER_ENVIRONMENT, expectedInertProviderEnvironment)
  const rejectedValue = "ambient-provider-value-must-not-survive"
  const publicOrigins = {
    MASSAGELAB_R2_PUBLIC_BASE_URL: "https://anatomy-media.example.test",
    MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL: "https://public-media.example.test",
    NEXT_PUBLIC_CHIMER_PREVIEW_CATALOG_BASE_URL: "https://catalog.example.test",
    NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL: "https://preview.example.test",
  }
  const ambientProviderEnvironment = Object.fromEntries(
    Object.keys(expectedInertProviderEnvironment).map((name) => [name, rejectedValue]),
  )
  const environment = {
    ...ambientProviderEnvironment,
    ...completeAuthorizedEnvironment(),
    ...publicOrigins,
    AUTH_SECRET: "local-browser-qa-auth-secret",
    NEXTAUTH_SECRET: "local-browser-qa-auth-secret",
  }

  for (const resolved of [
    resolveBrowserQaBuildEnvironment(environment),
    resolvePlaywrightWebServerEnvironment(environment, "http://localhost:3999"),
  ]) {
    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedInertProviderEnvironment).map((name) => [name, resolved[name]])),
      expectedInertProviderEnvironment,
    )
    assert.equal(resolved.DATABASE_URL, runtimeUrl)
    assert.equal(resolved.DIRECT_URL, directUrl)
    assert.equal(resolved.AUTH_SECRET, "local-browser-qa-auth-secret")
    assert.equal(resolved.NEXTAUTH_SECRET, "local-browser-qa-auth-secret")
    for (const [name, value] of Object.entries(publicOrigins)) assert.equal(resolved[name], value)
    assert.doesNotMatch(JSON.stringify(resolved), new RegExp(rejectedValue))
  }
})

test("Playwright-owned server uses its computed origin and an inert telemetry/database boundary", () => {
  assert.equal(playwrightConfig.webServer.env.AUTH_URL, playwrightConfig.use.baseURL)
  assert.equal(playwrightConfig.webServer.env.NEXTAUTH_URL, playwrightConfig.use.baseURL)
  assert.equal(playwrightConfig.webServer.reuseExistingServer, false)
  assert.deepEqual(
    Object.fromEntries(Object.keys(browserQaTelemetryEnvironment).map((name) => [
      name,
      playwrightConfig.webServer.env[name],
    ])),
    browserQaTelemetryEnvironment,
  )

  const customOrigin = "http://localhost:3999"
  const authorized = completeAuthorizedEnvironment()
  const owned = resolvePlaywrightWebServerEnvironment(authorized, customOrigin)
  assert.equal(owned.AUTH_URL, customOrigin)
  assert.equal(owned.NEXTAUTH_URL, customOrigin)
  assert.equal(owned.DATABASE_URL, runtimeUrl)
  assert.equal(owned.DIRECT_URL, directUrl)
  const databaseFree = resolvePlaywrightWebServerEnvironment({
    DATABASE_URL: "postgresql://unapproved.example.test/db",
    DIRECT_URL: "postgresql://unapproved-direct.example.test/db",
  }, customOrigin)
  assert.equal(databaseFree.DATABASE_URL, "")
  assert.equal(databaseFree.DIRECT_URL, "")

  assert.throws(
    () => assertBrowserQaOwnedServerRequirement(true),
    /requires Playwright's owned web server/i,
  )
  assert.doesNotThrow(() => assertBrowserQaOwnedServerRequirement(false))
})

test("Browser-QA and migration builds disable provider telemetry while preserving production behavior", async () => {
  const source = await readProjectFile("next.config.mjs")
  const buildScript = await readProjectFile("scripts/build-browser-qa.mjs")
  const start = source.indexOf("const migrationParityBuild =")
  assert.notEqual(start, -1)
  assert.equal((source.match(/export default withSentryConfig/g) ?? []).length, 1)
  const executable = source.slice(start).replace("export default withSentryConfig", "result = withSentryConfig")
  const configure = (environment) => {
    const sandbox = {
      process: { env: environment },
      root: "/browser-qa-test",
      withSentryConfig: (_config, options) => options,
      assertBrowserQaTelemetryEnvironment,
    }
    runInNewContext(executable, sandbox)
    return sandbox.result
  }

  for (const mode of [undefined, "0", "true"]) {
    const environment = {
      ATMOSHAPER_MIGRATION_PARITY: mode,
      NEXT_PUBLIC_SENTRY_DSN: "ordinary-public-dsn",
      SENTRY_DSN: "ordinary-dsn",
      SENTRY_AUTH_TOKEN: "ordinary-token",
      NEXT_TELEMETRY_DISABLED: "0",
    }
    const original = { ...environment }
    const ordinary = configure(environment)
    assert.equal(ordinary.telemetry, undefined)
    assert.equal(ordinary.authToken, "ordinary-token")
    assert.deepEqual(environment, original)
  }

  const browserQaEnvironment = {
    NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA: "1",
    ...browserQaTelemetryEnvironment,
  }
  const browserQa = configure(browserQaEnvironment)
  assert.equal(browserQa.telemetry, false)
  assert.equal(browserQa.authToken, "")
  for (const name of Object.keys(browserQaTelemetryEnvironment)) {
    assert.throws(
      () => configure({ ...browserQaEnvironment, [name]: "must-not-appear-in-errors" }),
      (error) => error.message.includes(name) && !error.message.includes("must-not-appear-in-errors"),
    )
  }
  assert.match(buildScript, /env: resolveBrowserQaBuildEnvironment\(process\.env\)/)

  const migrationEnvironment = {
    ...browserQaTelemetryEnvironment,
    ATMOSHAPER_MIGRATION_PARITY: "1",
  }
  const migration = configure(migrationEnvironment)
  assert.equal(migration.telemetry, false)
  assert.equal(migration.authToken, "")
  for (const name of Object.keys(browserQaTelemetryEnvironment)) {
    for (const rejected of [undefined, "must-not-appear-in-errors"]) {
      assert.throws(
        () => configure({ ...migrationEnvironment, [name]: rejected }),
        (error) => error.message.includes(name) && !error.message.includes("must-not-appear-in-errors"),
      )
    }
  }
})

test("Browser-QA build environment forwards only the fingerprint-approved database pair", () => {
  assert.deepEqual(BROWSER_QA_INERT_DATABASE_ALIAS_ENVIRONMENT, expectedInertDatabaseAliasEnvironment)
  const rejectedValue = "rejected-database-value-must-not-survive"
  const unauthorizedInput = {
    ...Object.fromEntries(Object.keys(expectedInertDatabaseAliasEnvironment).map((name) => [name, rejectedValue])),
    DATABASE_URL: rejectedValue,
    DIRECT_URL: rejectedValue,
    MASSAGELAB_BROWSER_QA_DATABASE: "1",
    MASSAGELAB_BROWSER_QA_DATABASE_URL: rejectedValue,
    MASSAGELAB_BROWSER_QA_DIRECT_URL: rejectedValue,
    MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: rejectedValue,
    NEXT_PUBLIC_SENTRY_DSN: "rogue-public-dsn",
    SENTRY_DSN: "rogue-server-dsn",
    SENTRY_AUTH_TOKEN: "rogue-upload-token",
    NEXT_TELEMETRY_DISABLED: "0",
  }
  for (const unauthorized of [
    resolveBrowserQaBuildEnvironment(unauthorizedInput),
    resolvePlaywrightWebServerEnvironment(unauthorizedInput, "http://localhost:3999"),
  ]) {
    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedInertDatabaseAliasEnvironment).map((name) => [name, unauthorized[name]])),
      expectedInertDatabaseAliasEnvironment,
    )
    assert.equal(unauthorized.DATABASE_URL, "")
    assert.equal(unauthorized.DIRECT_URL, "")
    assert.equal(unauthorized.MASSAGELAB_BROWSER_QA_DATABASE, "")
    assert.equal(unauthorized.MASSAGELAB_BROWSER_QA_DATABASE_URL, "")
    assert.equal(unauthorized.MASSAGELAB_BROWSER_QA_DIRECT_URL, "")
    assert.equal(unauthorized.MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT, "")
    assert.doesNotMatch(JSON.stringify(unauthorized), new RegExp(rejectedValue))
  }
  const unauthorized = resolveBrowserQaBuildEnvironment(unauthorizedInput)
  assert.equal(unauthorized.NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA, "1")
  assert.equal(unauthorized.NEXT_PUBLIC_RSC_SESSION_PROOF, "1")
  assert.doesNotThrow(() => assertBrowserQaTelemetryEnvironment(unauthorized))
  assert.equal(unauthorizedInput.DATABASE_URL, rejectedValue)

  const authorizedInput = {
    ...Object.fromEntries(Object.keys(expectedInertDatabaseAliasEnvironment).map((name) => [name, rejectedValue])),
    ...completeAuthorizedEnvironment(),
  }
  for (const authorized of [
    resolveBrowserQaBuildEnvironment(authorizedInput),
    resolvePlaywrightWebServerEnvironment(authorizedInput, "http://localhost:3999"),
  ]) {
    assert.equal(authorized.DATABASE_URL, runtimeUrl)
    assert.equal(authorized.DIRECT_URL, directUrl)
    assert.equal(authorized.MASSAGELAB_BROWSER_QA_DATABASE, "1")
    assert.equal(authorized.MASSAGELAB_BROWSER_QA_DATABASE_URL, runtimeUrl)
    assert.equal(authorized.MASSAGELAB_BROWSER_QA_DIRECT_URL, directUrl)
    assert.equal(
      authorized.MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT,
      authorizedInput.MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT,
    )
    for (const [name, value] of Object.entries(expectedInertDatabaseAliasEnvironment)) {
      assert.equal(authorized[name], value)
    }
    assert.doesNotMatch(JSON.stringify(authorized), new RegExp(rejectedValue))
  }
})
