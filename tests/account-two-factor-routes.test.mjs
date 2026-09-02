import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  noStoreJsonHeaders,
  parseTrustedAccountSecurityJson,
} from "../lib/account-security-request.ts"
import { authRequestNetworkIdentifier } from "../lib/auth-request.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const SITE_URL = "https://massagelab.test"
const NOW = new Date("2026-08-29T12:00:00.000Z")
const BACKUP_CODES = Object.freeze(Array.from({ length: 8 }, (_, index) => `backup-${index + 1}`))

const ROUTES = {
  setup: {
    source: "../app/api/account/security/totp/setup/route.ts",
    filename: "two-factor-setup-route.test.ts",
    factory: "createTwoFactorSetupHandler",
    path: "/api/account/security/totp/setup",
    body: { proofMethod: "PASSWORD", password: "correct horse battery staple", confirmed: true },
    success: {
      status: "SETUP_READY",
      qrCode: "data:image/png;base64,cXI=",
      manualCode: "TOTP-MANUAL-CODE",
      enrollmentBinding: "signed-enrollment-binding",
      privateRowId: "secret-row-1",
    },
    publicSuccess: {
      code: "TWO_FACTOR_SETUP_READY",
      qrCode: "data:image/png;base64,cXI=",
      manualCode: "TOTP-MANUAL-CODE",
    },
  },
  enable: {
    source: "../app/api/account/security/totp/enable/route.ts",
    filename: "two-factor-enable-route.test.ts",
    factory: "createTwoFactorEnableHandler",
    path: "/api/account/security/totp/enable",
    body: { code: "123456", confirmed: true },
    success: { status: "ENABLED", backupCodes: BACKUP_CODES, privateVersion: 9 },
    publicSuccess: { code: "TWO_FACTOR_ENABLED", backupCodes: BACKUP_CODES },
  },
  disable: {
    source: "../app/api/account/security/totp/disable/route.ts",
    filename: "two-factor-disable-route.test.ts",
    factory: "createTwoFactorDisableHandler",
    path: "/api/account/security/totp/disable",
    body: {
      proofMethod: "PASSWORD",
      password: "correct horse battery staple",
      twoFactorCode: "123456",
      confirmed: true,
    },
    success: { status: "DISABLED", privateUserId: "user-1" },
    publicSuccess: { code: "TWO_FACTOR_DISABLED" },
  },
  regenerate: {
    source: "../app/api/account/security/backup-codes/route.ts",
    filename: "two-factor-backup-route.test.ts",
    factory: "createBackupCodeRegenerationHandler",
    path: "/api/account/security/backup-codes",
    body: {
      proofMethod: "PASSWORD",
      password: "correct horse battery staple",
      twoFactorCode: "backup-current",
      confirmed: true,
    },
    success: { status: "BACKUP_CODES_REGENERATED", backupCodes: BACKUP_CODES, privateIntentId: "intent-1" },
    publicSuccess: { code: "BACKUP_CODES_REGENERATED", backupCodes: BACKUP_CODES },
  },
}

const routeSources = Object.fromEntries(await Promise.all(
  Object.entries(ROUTES).map(async ([name, route]) => [
    name,
    await readFile(new URL(route.source, import.meta.url), "utf8"),
  ]),
))
const prismaSchemaSource = await readFile(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
)
const routeBoundarySource = await readFile(
  new URL("../lib/account-two-factor-route-boundary.ts", import.meta.url),
  "utf8",
)
const routeBoundary = loadCompiledModule(
  routeBoundarySource,
  "lib/account-two-factor-route-boundary.test.ts",
  {
    "next/server": { NextResponse: responseAdapter() },
    "@/lib/account-security-request": { noStoreJsonHeaders },
    "@/lib/auth-method-intents": { AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding" },
  },
)

describe("two-factor management route boundaries", () => {
  it("exports one dependency-injected thin-handler factory per route", () => {
    for (const name of Object.keys(ROUTES)) {
      const scenario = loadRoute(name)
      assert.equal(typeof scenario.POST, "function", name)
    }
  })

  for (const name of Object.keys(ROUTES)) {
    it(`${name} rejects provenance, media, and unknown-key failures before session, proof, service, or cache work`, async () => {
      for (const { label, request, expectedStatus, expectedCode } of [
        {
          label: "missing origin",
          request: routeRequest(name, ROUTES[name].body, { origin: null }),
          expectedStatus: 403,
          expectedCode: "UNTRUSTED_REQUEST",
        },
        {
          label: "attacker origin",
          request: routeRequest(name, ROUTES[name].body, { origin: "https://attacker.example" }),
          expectedStatus: 403,
          expectedCode: "UNTRUSTED_REQUEST",
        },
        {
          label: "non-JSON media",
          request: routeRequest(name, ROUTES[name].body, { contentType: "text/plain" }),
          expectedStatus: 400,
          expectedCode: "INVALID_REQUEST",
        },
        {
          label: "unknown body key",
          request: routeRequest(name, { ...ROUTES[name].body, userId: "attacker-selected" }),
          expectedStatus: 400,
          expectedCode: "INVALID_REQUEST",
        },
      ]) {
        const scenario = loadRoute(name)
        const response = await scenario.POST(request)
        const body = await response.json()

        assert.equal(response.status, expectedStatus, `${name}: ${label}`)
        assert.deepEqual(body, { code: expectedCode }, `${name}: ${label}`)
        assert.deepEqual(scenario.counts(), {
          moduleSession: 0,
          session: 0,
          intent: 0,
          service: 0,
          cache: 0,
        }, name)
        assertNoStore(response)
      }
    })

    it(`${name} returns exact unauthenticated and success payloads with no private result leakage`, async () => {
      const anonymous = loadRoute(name, { session: null })
      const denied = await anonymous.POST(routeRequest(name, ROUTES[name].body))
      assert.equal(denied.status, 401)
      assert.deepEqual(await denied.json(), { code: "AUTHENTICATION_REQUIRED" })
      assert.equal(anonymous.serviceCalls.length, 0)
      assertNoStore(denied)

      const scenario = loadRoute(name)
      const response = await scenario.POST(routeRequest(name, ROUTES[name].body))
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), ROUTES[name].publicSuccess)
      assert.equal(scenario.serviceCalls.length, 1)
      assert.equal(scenario.cacheCalls.length, 1)
      assertNoStore(response)
    })
  }

  it("rejects oversized union bodies promptly before session, proof, service, cache, or terminal cookie work", { timeout: 2_000 }, async () => {
    const oversizedBodies = {
      setup: { ...ROUTES.setup.body, password: "x".repeat(5_000) },
      enable: { ...ROUTES.enable.body, code: "x".repeat(5_000) },
      disable: { ...ROUTES.disable.body, password: "x".repeat(5_000) },
      regenerate: { ...ROUTES.regenerate.body, password: "x".repeat(5_000) },
    }

    for (const [name, body] of Object.entries(oversizedBodies)) {
      const scenario = loadRoute(name)
      const response = await settlesWithin(
        scenario.POST(routeRequest(name, body)),
        500,
        `${name} oversized request did not settle`,
      )

      assert.equal(response.status, 400, name)
      assert.deepEqual(await response.json(), { code: "INVALID_REQUEST" }, name)
      assert.deepEqual(scenario.counts(), {
        moduleSession: 0,
        session: 0,
        intent: 0,
        service: 0,
        cache: 0,
      }, name)
      assert.equal(cookieSets(response).length, 0, `${name}: oversized rejection must not enter terminal cookie handling`)
      assertNoStore(response)
    }
  })

  it("validates exact discriminated bodies and forwards only the server session owner plus network identifier", async () => {
    const invalidCases = [
      ["setup", { proofMethod: "GOOGLE", password: "must-not-be-accepted", confirmed: true }],
      ["setup", { proofMethod: "PASSWORD", confirmed: true }],
      ["setup", { proofMethod: "PASSWORD", password: "proof", confirmed: false }],
      ["enable", { code: "123456" }],
      ["disable", { proofMethod: "GOOGLE", password: "must-not-be-accepted", twoFactorCode: "123456", confirmed: true }],
      ["disable", { proofMethod: "PASSWORD", twoFactorCode: "123456", confirmed: true }],
      ["regenerate", { proofMethod: "GOOGLE", twoFactorCode: "123456", confirmed: "true" }],
    ]
    for (const [name, body] of invalidCases) {
      const scenario = loadRoute(name)
      const response = await scenario.POST(routeRequest(name, body))
      assert.equal(response.status, 400, `${name}: ${JSON.stringify(body)}`)
      assert.deepEqual(await response.json(), { code: "INVALID_REQUEST" })
      assert.equal(scenario.serviceCalls.length, 0)
      assert.equal(scenario.intentCalls.length, 0)
      assertNoStore(response)
    }

    for (const name of Object.keys(ROUTES)) {
      const scenario = loadRoute(name)
      await scenario.POST(routeRequest(name, ROUTES[name].body, {
        forwardedFor: "203.0.113.71, 10.0.0.2",
        vercelForwardedFor: "198.51.100.71, 10.0.0.3",
      }))
      const input = scenario.serviceCalls[0]
      assert.equal(input.userId, "user-1", name)
      assert.equal(Object.hasOwn(input, "email"), false, name)
      assert.equal(input.networkIdentifier, "198.51.100.71", name)
      assert.equal(input.confirmed, true, name)
      assert.equal(input.now, NOW, name)
      assert.equal(scenario.clockCalls, 1, name)
    }
  })

  it("resolves only the action-bound consumed Google proof and clears it only after commit", async () => {
    const purposeByRoute = {
      setup: "ENROLL_TWO_FACTOR",
      disable: "DISABLE_TWO_FACTOR",
      regenerate: "REGENERATE_TWO_FACTOR_BACKUP_CODES",
    }
    for (const name of ["setup", "disable", "regenerate"]) {
      const googleBody = name === "setup"
        ? { proofMethod: "GOOGLE", confirmed: true }
        : { proofMethod: "GOOGLE", twoFactorCode: "123456", confirmed: true }
      const scenario = loadRoute(name)
      const response = await scenario.POST(routeRequest(name, googleBody))

      assert.deepEqual(scenario.intentCalls, [{
        cookieValue: "google-binding",
        purpose: purposeByRoute[name],
        status: "CONSUMED",
        now: NOW,
      }], name)
      assert.deepEqual(scenario.serviceCalls[0].primaryProof, {
        kind: "GOOGLE",
        intentId: "intent-1",
      }, name)
      assert.equal(scenario.serviceCalls[0].now, NOW, name)
      assert.equal(scenario.clockCalls, 1, name)
      assertBindingCookieCleared(response)

      const rejected = loadRoute(name, { result: { status: "REJECTED", code: "GOOGLE_PROOF_EXPIRED" } })
      const failed = await rejected.POST(routeRequest(name, googleBody))
      assert.equal(failed.status, 403)
      assert.equal(cookieSets(failed).length, 0, name)

      const missing = loadRoute(name, { resolvedIntent: null })
      const expired = await missing.POST(routeRequest(name, googleBody))
      assert.equal(expired.status, 403)
      assert.deepEqual(await expired.json(), { code: "GOOGLE_PROOF_EXPIRED" })
      assert.equal(missing.serviceCalls.length, 0, name)
      assert.equal(cookieSets(expired).length, 0, name)
    }

    for (const name of ["setup", "disable", "regenerate"]) {
      const passwordScenario = loadRoute(name)
      await passwordScenario.POST(routeRequest(name, ROUTES[name].body))
      assert.equal(passwordScenario.intentCalls.length, 0, name)
      assert.deepEqual(passwordScenario.serviceCalls[0].primaryProof, {
        kind: "PASSWORD",
        password: "correct horse battery staple",
      }, name)
    }
  })

  it("writes the five-minute enrollment cookie without embedding the TOTP secret", async () => {
    for (const secureCookies of [false, true]) {
      const scenario = loadRoute("setup", { secureCookies })
      const response = await scenario.POST(routeRequest("setup", ROUTES.setup.body))
      const enrollmentCookie = cookieSets(response).find(([cookieName]) => cookieName === "ml-two-factor-enrollment")
      assert.ok(enrollmentCookie, "setup must write the enrollment cookie")
      const [name, value, options] = enrollmentCookie

      assert.equal(name, "ml-two-factor-enrollment")
      assert.equal(value, "signed-enrollment-binding")
      assert.doesNotMatch(value, /TOTP-MANUAL-CODE/)
      assert.deepEqual(options, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 300,
        secure: secureCookies,
        path: "/api/account/security/totp",
      })
    }
  })

  it("retains enable binding for retryable proof results and clears every terminal binding result", async () => {
    for (const [code, retryAfterSeconds] of [["TWO_FACTOR_INVALID"], ["RATE_LIMITED", 47]]) {
      const scenario = loadRoute("enable", {
        result: { status: "REJECTED", code, retryAfterSeconds },
      })
      const response = await scenario.POST(routeRequest("enable", ROUTES.enable.body))
      assert.equal(cookieSets(response).length, 0, code)
      if (code === "RATE_LIMITED") {
        assert.equal(response.status, 429)
        assert.equal(response.headers.get("Retry-After"), "47")
      }
    }

    for (const result of [
      ROUTES.enable.success,
      { status: "REJECTED", code: "TWO_FACTOR_REQUIRED" },
      { status: "REJECTED", code: "ENROLLMENT_EXPIRED" },
      { status: "REJECTED", code: "CONFLICT" },
      { status: "REJECTED", code: "ALREADY_ENABLED" },
    ]) {
      const scenario = loadRoute("enable", { result })
      const response = await scenario.POST(routeRequest("enable", ROUTES.enable.body))
      assertEnrollmentCookieCleared(response)
    }
  })

  it("clears the enable binding when session lookup fails before service work", async () => {
    const scenario = loadRoute("enable", { sessionError: new Error("private session failure") })
    const response = await scenario.POST(routeRequest("enable", ROUTES.enable.body))

    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { code: "CONFLICT" })
    assert.equal(scenario.serviceCalls.length, 0)
    assertEnrollmentCookieCleared(response)
    assertNoStore(response)
  })

  it("keeps RATE_LIMITED public when a real service result omits retry metadata", async () => {
    for (const name of Object.keys(ROUTES)) {
      const scenario = loadRoute(name, {
        result: { status: "REJECTED", code: "RATE_LIMITED" },
      })
      const response = await scenario.POST(routeRequest(name, ROUTES[name].body))

      assert.equal(response.status, 429, name)
      assert.deepEqual(await response.json(), { code: "RATE_LIMITED" }, name)
      assert.equal(response.headers.get("Retry-After"), "1", name)
      assertNoStore(response)
    }
  })

  it("bounds Retry-After to a positive safe whole-second public value", async () => {
    for (const [retryAfterSeconds, expectedHeader] of [
      [900, "900"],
      [901, "900"],
      [Number.MAX_SAFE_INTEGER, "900"],
      [0, "1"],
      [-1, "1"],
      [1.5, "1"],
    ]) {
      const scenario = loadRoute("setup", {
        result: { status: "REJECTED", code: "RATE_LIMITED", retryAfterSeconds },
      })
      const response = await scenario.POST(routeRequest("setup", ROUTES.setup.body))

      assert.equal(response.status, 429)
      assert.equal(response.headers.get("Retry-After"), expectedHeader, String(retryAfterSeconds))
    }
  })

  it("maps only allowlisted service failures to fixed status/code-only no-store responses", async () => {
    const cases = [
      ["setup", "INVALID_REQUEST", 400],
      ["setup", "RATE_LIMITED", 429],
      ["setup", "PASSWORD_REQUIRED", 409],
      ["setup", "PRIMARY_PROOF_INVALID", 403],
      ["setup", "GOOGLE_PROOF_EXPIRED", 403],
      ["setup", "ALREADY_ENABLED", 409],
      ["enable", "TWO_FACTOR_REQUIRED", 400],
      ["enable", "TWO_FACTOR_INVALID", 403],
      ["enable", "ENROLLMENT_EXPIRED", 403],
      ["disable", "NOT_ENABLED", 409],
      ["disable", "CONFLICT", 409],
    ]
    for (const [name, code, status] of cases) {
      const result = { status: "REJECTED", code, retryAfterSeconds: code === "RATE_LIMITED" ? 61 : undefined }
      const scenario = loadRoute(name, { result })
      const response = await scenario.POST(routeRequest(name, ROUTES[name].body))
      assert.equal(response.status, status, `${name}:${code}`)
      const payload = await response.json()
      assert.deepEqual(payload, { code })
      assert.deepEqual(Object.keys(payload), ["code"])
      assertNoStore(response)
      if (status === 429) assert.equal(response.headers.get("Retry-After"), "61")
      assert.equal(scenario.cacheCalls.length, 0, `${name}:${code}`)
    }
  })

  it("maps a malformed runtime service code to the private CONFLICT fallback", async () => {
    const scenario = loadRoute("setup", {
      result: { status: "REJECTED", code: "NOT_A_REAL_SERVICE_CODE" },
    })
    const response = await scenario.POST(routeRequest("setup", ROUTES.setup.body))

    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { code: "CONFLICT" })
    assertNoStore(response)
  })

  it("keeps routes free of email scheduling, direct persistence, and proof logging", () => {
    const prismaDelegateNames = [...prismaSchemaSource.matchAll(/^\s*model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gm)]
      .map(([, modelName]) => `${modelName[0].toLowerCase()}${modelName.slice(1)}`)
    assert.ok(prismaDelegateNames.length > 0, "Prisma schema must expose model delegates")
    const escapedDelegates = prismaDelegateNames
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    const prismaMutation = new RegExp(
      `\\b[A-Za-z_$][\\w$]*\\s*\\.\\s*(?:${escapedDelegates.join("|")})\\s*\\.\\s*`
        + "(?:create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\\s*\\(",
    )
    assert.match("db.user.update({})", prismaMutation)
    assert.doesNotMatch("response.cookies.delete()", prismaMutation)
    assert.doesNotMatch("ownerLocks.delete(userId)", prismaMutation)
    for (const [name, source] of Object.entries(routeSources)) {
      assert.doesNotMatch(source, /\bafter\s*\(|import\s*\{\s*after\b|deliverAccountSecurityEmail|sendEmail|scheduleEmail/i, name)
      assert.doesNotMatch(source, /console\s*\.|logger\s*\./, name)
      assert.doesNotMatch(source, prismaMutation, name)
    }
  })

  it("uses one shared route boundary for management parsing, public failures, and cookies", () => {
    for (const [name, source] of Object.entries(routeSources)) {
      assert.match(source, /@\/lib\/account-two-factor-route-boundary/, name)
      assert.doesNotMatch(source, /function (?:requestFailure|serviceFailure|failureStatus|jsonCode|requestIp|readCookie)\b/, name)
    }
    for (const name of ["setup", "disable", "regenerate"]) {
      assert.doesNotMatch(routeSources[name], /function (?:parseManageRequest|clearGoogleBindingCookie)\b/, name)
    }
  })
})

function loadRoute(name, {
  session = { user: { id: "user-1", email: "ignored-client@example.test" } },
  sessionError,
  result = ROUTES[name].success,
  resolvedIntent = { id: "intent-1", targetUserId: "user-1" },
  secureCookies = false,
} = {}) {
  const moduleSessionCalls = []
  const sessionCalls = []
  const intentCalls = []
  const serviceCalls = []
  const cacheCalls = []
  let clockCalls = 0
  const modulePrismaClient = { moduleDatabaseAdapter: true }
  const prismaClient = { privateDatabaseAdapter: true }
  const service = async (input) => {
    assert.equal(input.prismaClient, prismaClient, `${name} must forward the injected Prisma client`)
    serviceCalls.push(input)
    return result
  }
  const dependencies = {
    "next/server": { NextResponse: responseAdapter() },
    qrcode: {
      __esModule: true,
      default: { toDataURL: async () => "data:image/png;base64,cXI=" },
      toDataURL: async () => "data:image/png;base64,cXI=",
    },
    "@/auth": {
      getCurrentSession: async () => {
        moduleSessionCalls.push(true)
        return session
      },
    },
    "@/lib/account-security-request": { noStoreJsonHeaders, parseTrustedAccountSecurityJson },
    "@/lib/account-surface-data": { clearAccountSurfaceDataCache: () => {} },
    "@/lib/auth-env": { getAuthSecret: () => "route-secret", getSiteUrl: () => SITE_URL },
    "@/lib/auth-request": { authRequestNetworkIdentifier },
    "@/lib/auth-method-intents": {
      AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
      resolveBoundAuthMethodIntent: async () => resolvedIntent,
    },
    "@/lib/auth-security": {
      decryptSecret: (value) => value,
      encryptSecret: (value) => value,
      generateBackupCodes: () => BACKUP_CODES,
      generateTotpSecret: () => ({ secret: "TOTP-MANUAL-CODE", otpauthUrl: "otpauth://totp/test" }),
      hashBackupCode: async (value) => `hash:${value}`,
      verifyTotpCode: () => true,
    },
    "@/lib/account-two-factor-management": {
      startTwoFactorEnrollment: service,
      enableTwoFactor: service,
      disableTwoFactor: service,
      regenerateBackupCodes: service,
    },
    "@/lib/account-two-factor-route-boundary": routeBoundary,
    "@/lib/two-factor-enrollment-binding": {
      TWO_FACTOR_ENROLLMENT_COOKIE: "ml-two-factor-enrollment",
    },
    "@/lib/prisma": { prisma: modulePrismaClient },
  }
  const routeModule = loadCompiledModule(routeSources[name], ROUTES[name].filename, dependencies)
  const factory = routeModule[ROUTES[name].factory]
  assert.equal(typeof factory, "function", `${name} route factory`)
  const POST = factory({
    prismaClient,
    getSession: async () => {
      sessionCalls.push(true)
      if (sessionError) throw sessionError
      return session
    },
    expectedSiteUrl: SITE_URL,
    parseRequest: parseTrustedAccountSecurityJson,
    secret: "route-secret",
    resolveIntent: async (input) => {
      intentCalls.push({
        cookieValue: input.cookieValue,
        purpose: input.purpose,
        status: input.status,
        now: input.now,
      })
      return resolvedIntent
    },
    mutate: service,
    clock: () => {
      clockCalls += 1
      return NOW
    },
    clearCache: (userId, surface) => cacheCalls.push({ userId, surface }),
    secureCookies,
  })

  return {
    POST,
    sessionCalls,
    intentCalls,
    serviceCalls,
    cacheCalls,
    get clockCalls() { return clockCalls },
    counts: () => ({
      moduleSession: moduleSessionCalls.length,
      session: sessionCalls.length,
      intent: intentCalls.length,
      service: serviceCalls.length,
      cache: cacheCalls.length,
    }),
  }
}

function responseAdapter() {
  return {
    json(body, init = {}) {
      const response = new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...init.headers },
      })
      response.cookieSets = []
      response.cookies = { set: (...args) => response.cookieSets.push(args) }
      return response
    },
  }
}

function routeRequest(name, body, {
  origin = SITE_URL,
  fetchSite = "same-origin",
  contentType = "application/json",
  forwardedFor = "203.0.113.41",
  vercelForwardedFor = null,
  cookies = "ml-auth-method-binding=google-binding; ml-two-factor-enrollment=enrollment-binding",
} = {}) {
  const headers = new Headers({ cookie: cookies, "x-forwarded-for": forwardedFor })
  if (vercelForwardedFor !== null) headers.set("x-vercel-forwarded-for", vercelForwardedFor)
  if (origin !== null) headers.set("origin", origin)
  if (fetchSite !== null) headers.set("sec-fetch-site", fetchSite)
  if (contentType !== null) headers.set("content-type", contentType)
  return new Request(`${SITE_URL}${ROUTES[name].path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

function cookieSets(response) {
  return response.cookieSets ?? []
}

function assertNoStore(response) {
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  assert.equal(response.headers.get("Pragma"), "no-cache")
}

function assertBindingCookieCleared(response) {
  const bindingCookie = cookieSets(response).find(([cookieName]) => cookieName === "ml-auth-method-binding")
  assert.ok(bindingCookie, "response must clear the Google binding cookie")
  const [name, value, options] = bindingCookie
  assert.equal(name, "ml-auth-method-binding")
  assert.equal(value, "")
  assert.deepEqual(options, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure: false,
    path: "/",
  })
}

function assertEnrollmentCookieCleared(response) {
  const enrollmentCookie = cookieSets(response).find(([cookieName]) => cookieName === "ml-two-factor-enrollment")
  assert.ok(enrollmentCookie, "response must clear the enrollment cookie")
  const [name, value, options] = enrollmentCookie
  assert.equal(name, "ml-two-factor-enrollment")
  assert.equal(value, "")
  assert.deepEqual(options, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 0,
    secure: false,
    path: "/api/account/security/totp",
  })
}

async function settlesWithin(promise, timeoutMs, message) {
  let timeoutId
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}
