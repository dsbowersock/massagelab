import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeFiles = {
  confirm: "../app/api/account/security/google/link/confirm/route.ts",
  unlink: "../app/api/account/security/google/unlink/route.ts",
  password: "../app/api/account/security/password/route.ts",
  disable: "../app/api/account/security/password/disable/route.ts",
}

const routeSources = Object.fromEntries(await Promise.all(
  Object.entries(routeFiles).map(async ([key, path]) => [key, await readFile(new URL(path, import.meta.url), "utf8")]),
))
const linkFormSource = await readFile(new URL("../app/account/link-google/link-google-form.tsx", import.meta.url), "utf8")
const linkPageSource = await readFile(new URL("../app/account/link-google/page.tsx", import.meta.url), "utf8")
const methodsPanelSource = await readFile(new URL("../app/account/security/sign-in-methods-panel.tsx", import.meta.url), "utf8")
const securityPanelSource = await readFile(new URL("../app/account/security/security-panel.tsx", import.meta.url), "utf8")
const linkRecoveryUrl = new URL("../lib/google-link-confirmation-recovery.ts", import.meta.url)

const UPDATED = {
  status: "UPDATED",
  emailIntentId: "notice-1",
  googleLinked: true,
  passwordEnabled: true,
}

describe("account security route adapters", () => {
  it("requires authentication for every account-method mutation", async () => {
    for (const routeName of Object.keys(routeFiles)) {
      const scenario = loadRoute(routeName, { session: null })
      const response = await scenario.POST(requestFor(routeName, validBody(routeName)))
      assert.equal(response.status, 401, routeName)
      assert.deepEqual(response.body, {
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign in and try again.",
      }, routeName)
      assert.deepEqual(scenario.serviceCalls, [], routeName)
      assert.equal(scenario.scheduled.length, 0, routeName)
    }
  })

  it("accepts only each route's narrow proof fields and exact confirmation", async () => {
    const malformed = [
      ["confirm", { confirmed: "true" }],
      ["confirm", { confirmed: true, password: "must-not-enter-this-route" }],
      ["unlink", { confirmed: true, password: "password", providerAccountId: "secret-provider-id" }],
      ["password", { mode: "ADD", newPassword: "a-long-new-password", confirmed: 1 }],
      ["password", { mode: "REMOVE", newPassword: "a-long-new-password", confirmed: true }],
      ["disable", { confirmed: true, twoFactorCode: "123456" }],
    ]
    for (const [routeName, body] of malformed) {
      const scenario = loadRoute(routeName)
      const response = await scenario.POST(requestFor(routeName, body))
      assert.equal(response.status, 400, `${routeName}: ${JSON.stringify(body)}`)
      assert.equal(response.body.code, "INVALID_REQUEST")
      assert.deepEqual(scenario.serviceCalls, [])
    }
  })

  it("requires an exact bound matching intent and fresh matching Credentials session", async () => {
    for (const options of [
      { resolvedIntent: null },
      { resolvedIntent: { id: "intent-1", targetUserId: "other-user" } },
      { session: { user: { id: "user-1" }, lastPasswordAuthenticatedAt: Date.parse("2026-08-28T11:54:59.999Z") } },
      { session: { user: { id: "user-1" } } },
    ]) {
      const scenario = loadRoute("confirm", options)
      const response = await scenario.POST(requestFor("confirm", { confirmed: true }))
      assert.equal(response.status, 403)
      assert.equal(response.body.code, "PROOF_EXPIRED")
      assert.deepEqual(scenario.serviceCalls, [])
    }
  })

  it("passes only the cookie-resolved intent and fresh session claim to Google link confirmation", async () => {
    const scenario = loadRoute("confirm")
    const response = await scenario.POST(requestFor("confirm", { confirmed: true }, "intent-cookie-value"))

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, {
      code: "GOOGLE_LINKED",
      message: "Google sign-in is now linked to this MassageLab account.",
      googleLinked: true,
      hasPasswordCredential: true,
    })
    assert.deepEqual(scenario.intentCalls, [{
      cookieValue: "intent-cookie-value",
      purpose: "SIGN_IN_OR_LINK",
      status: "PROVIDER_PROVEN",
    }])
    assert.deepEqual(scenario.serviceCalls, [{
      intentId: "intent-1",
      sessionUserId: "user-1",
      lastPasswordAuthenticatedAt: Date.parse("2026-08-28T12:00:00.000Z"),
      confirmed: true,
    }])
    assert.equal(scenario.scheduled.length, 1)
    await scenario.scheduled[0]()
    assert.deepEqual(scenario.deliveryCalls, ["notice-1"])
    assertCookieCleared(response)
  })

  it("maps proof-domain rejections safely and never schedules delivery on rejection", async () => {
    for (const [routeName, code, status] of [
      ["unlink", "TWO_FACTOR_REQUIRED", 403],
      ["unlink", "LAST_METHOD", 409],
      ["password", "ALREADY_LINKED", 409],
      ["password", "INVALID_PROOF", 403],
      ["disable", "INTENT_EXPIRED", 403],
      ["confirm", "CONFLICT", 409],
    ]) {
      const scenario = loadRoute(routeName, { result: { status: "REJECTED", code } })
      const response = await scenario.POST(requestFor(routeName, validBody(routeName)))
      assert.equal(response.status, status, `${routeName}:${code}`)
      assert.equal(response.body.code, code === "INTENT_EXPIRED" ? "PROOF_EXPIRED" : code)
      assert.equal(scenario.scheduled.length, 0)
      assert.equal(response.cookieSets.length, 0)
      assert.deepEqual(Object.keys(response.body).sort(), ["code", "message"])
    }
  })

  it("delegates unlink, password add/change, and password disable once, then schedules notice and clears consumed bindings", async () => {
    const cases = [
      ["unlink", { ...UPDATED, googleLinked: false }, false],
      ["password", UPDATED, true],
      ["disable", { ...UPDATED, passwordEnabled: false }, true],
    ]
    for (const [routeName, result, clearsCookie] of cases) {
      const scenario = loadRoute(routeName, { result })
      const response = await scenario.POST(requestFor(routeName, validBody(routeName)))
      assert.equal(response.status, 200, routeName)
      assert.equal(scenario.serviceCalls.length, 1, routeName)
      assert.equal(scenario.scheduled.length, 1, routeName)
      assert.deepEqual(Object.keys(response.body).sort(), ["code", "googleLinked", "hasPasswordCredential", "message"])
      assert.equal(response.body.googleLinked, result.googleLinked)
      assert.equal(response.body.hasPasswordCredential, result.passwordEnabled)
      assert.equal(response.cookieSets.length, clearsCookie ? 1 : 0)
      if (clearsCookie) assertCookieCleared(response)
    }
  })

  it("proves ADD before hashing and passes only raw new password into the proof-owning service", async () => {
    const events = []
    const scenario = loadRoute("password", {
      onResolveIntent: () => events.push("preflight"),
      onHash: () => events.push("route-hash"),
      onMutate: (input) => {
        events.push("service")
        assert.equal(input.newPassword, "a-long-new-password")
        assert.equal(Object.hasOwn(input, "newPasswordHash"), false)
        assert.deepEqual(input.googleReauthPreflight, { intentId: "intent-1", targetUserId: "user-1" })
      },
    })

    const response = await scenario.POST(requestFor("password", validBody("password")))

    assert.equal(response.status, 200)
    assert.deepEqual(events, ["preflight", "service"])
  })

  it("keeps raw proof and provider material out of responses, logs, and route-owned persistence", () => {
    for (const [name, source] of Object.entries(routeSources)) {
      assert.doesNotMatch(source, /console\s*\.|logger\s*\./, name)
      assert.doesNotMatch(source, /providerAccountId|providerEmailHash|browserBindingHash/, name)
      assert.doesNotMatch(source, /\.(?:create|update|updateMany|upsert|delete|deleteMany)\s*\(/, name)
    }
  })
})

describe("recoverable account-method UI contracts", () => {
  it("allowlists actionable matching-account recovery without rendering arbitrary response text", async () => {
    assert.equal(
      existsSync(fileURLToPath(linkRecoveryUrl)),
      true,
      "missing controlled Google-link recovery owner",
    )
    const recoverySource = await readFile(linkRecoveryUrl, "utf8")
    const {
      resolveCredentialLinkRecovery,
      resolveGoogleLinkConfirmationRecovery,
    } = loadCompiledModule(recoverySource, "lib/google-link-confirmation-recovery.test.ts")

    assert.deepEqual(resolveCredentialLinkRecovery("TWO_FACTOR_REQUIRED"), {
      message: "Enter your authenticator or backup code, then try again.",
      needsTwoFactor: true,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("TWO_FACTOR_INVALID"), {
      message: "The authenticator or backup code was not accepted. Check the code and try again.",
      needsTwoFactor: true,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("INVALID_CREDENTIALS"), {
      message: "The account email or password was not accepted. Try again or reset your password.",
      needsTwoFactor: false,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("CredentialsSignin"), {
      message: "The account email or password was not accepted. Try again or reset your password.",
      needsTwoFactor: false,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("EMAIL_UNVERIFIED"), {
      message: "Verify this account's email, then try again.",
      needsTwoFactor: false,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("RATE_LIMITED"), {
      message: "Too many attempts. Wait a little, then try again.",
      needsTwoFactor: false,
    })

    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(403, "PROOF_EXPIRED"), {
      message: "This confirmation expired or belongs to another session. Start again with Google sign-in.",
    })
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(401, "AUTHENTICATION_REQUIRED"), {
      message: "Your password confirmation ended. Start again with Google sign-in, then confirm the password account.",
    })
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(409, "ALREADY_LINKED"), {
      message: "Google sign-in is already linked. Return to Account Security to review your sign-in methods.",
    })
    for (const code of ["CONFLICT", "LAST_METHOD"]) {
      assert.deepEqual(resolveGoogleLinkConfirmationRecovery(409, code), {
        message: "Your sign-in methods changed. Refresh Account Security, then start Google sign-in again if it is not linked.",
      })
    }
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(400, "INVALID_REQUEST"), {
      message: "Confirm that Google and password should open the same account, then try again.",
    })

    const generic = { message: "Something went wrong. Please try again." }
    assert.deepEqual(resolveCredentialLinkRecovery("private-provider-detail"), generic)
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(500, "PROOF_EXPIRED"), generic)
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(403, "private-provider-detail"), generic)
    assert.match(linkFormSource, /resolveCredentialLinkRecovery/)
    assert.match(linkFormSource, /resolveGoogleLinkConfirmationRecovery/)
    assert.doesNotMatch(linkFormSource, /result\.message/)
  })

  it("signs in with Credentials before link confirmation and sends confirmation only", () => {
    const signInIndex = linkFormSource.indexOf('signIn("credentials"')
    const confirmIndex = linkFormSource.indexOf('fetch("/api/account/security/google/link/confirm"')
    assert.ok(signInIndex >= 0)
    assert.ok(confirmIndex > signInIndex)
    const confirmationBody = linkFormSource.slice(confirmIndex, confirmIndex + 600)
    assert.match(confirmationBody, /JSON\.stringify\(\{\s*confirmed:\s*true\s*\}\)/)
    assert.doesNotMatch(confirmationBody, /password|twoFactorCode|provider|intent/i)
    assert.match(linkFormSource, /same MassageLab account/i)
    assert.match(linkFormSource, /redirect:\s*false/)
  })

  it("never reveals intent or provider identifiers from the link page", () => {
    assert.doesNotMatch(linkPageSource, /intentId|providerAccountId|providerEmailHash|browserBindingToken/)
    assert.match(linkPageSource, /AUTH_METHOD_INTENT_COOKIE/)
    assert.match(linkPageSource, /validIntent/)
  })

  it("splits method controls from TOTP and uses explicit recoverable states", () => {
    assert.match(securityPanelSource, /<SignInMethodsPanel/)
    assert.doesNotMatch(securityPanelSource, /\/api\/account\/security\/(?:password|google\/unlink)/)
    assert.match(securityPanelSource, /Authenticator-app 2FA/)
    assert.match(methodsPanelSource, /type MethodActionState\s*=\s*"idle"\s*\|\s*"proving"\s*\|\s*"saving"\s*\|\s*"redirecting"\s*\|\s*"success"\s*\|\s*"error"/)
    assert.match(methodsPanelSource, /try\s*\{[\s\S]*catch[\s\S]*finally/)
    assert.match(methodsPanelSource, /aria-busy/)
    assert.match(methodsPanelSource, /role=\{[^}]*"alert"[^}]*"status"/)
    assert.match(methodsPanelSource, /aria-live=\{[^}]*"assertive"[^}]*"polite"/)
  })

  it("keeps every sign-in method action's proof and confirmation state isolated", () => {
    for (const owner of [
      "addPassword",
      "addPasswordConfirmed",
      "changeCurrentPassword",
      "changeNewPassword",
      "changeTwoFactorCode",
      "changePasswordConfirmed",
      "unlinkPassword",
      "unlinkTwoFactorCode",
      "unlinkGoogleConfirmed",
      "disablePasswordConfirmed",
    ]) {
      assert.match(methodsPanelSource, new RegExp(`\\[${owner},\\s*set${owner[0].toUpperCase()}${owner.slice(1)}\\]`), owner)
    }
    assert.doesNotMatch(methodsPanelSource, /\[confirmChange,|\[currentPassword,|\[newPassword,|\[twoFactorCode,/)
    assert.match(methodsPanelSource, /mode,\s*currentPassword:\s*changeCurrentPassword,\s*newPassword:\s*changeNewPassword,\s*twoFactorCode:\s*changeTwoFactorCode,\s*confirmed:\s*changePasswordConfirmed/)
    assert.match(methodsPanelSource, /password:\s*unlinkPassword,\s*twoFactorCode:\s*unlinkTwoFactorCode,\s*confirmed:\s*unlinkGoogleConfirmed/)
    assert.match(methodsPanelSource, /JSON\.stringify\(\{\s*confirmed:\s*disablePasswordConfirmed\s*\}\)/)
  })
})

function loadRoute(routeName, {
  session = {
    user: { id: "user-1" },
    lastPasswordAuthenticatedAt: Date.parse("2026-08-28T12:00:00.000Z"),
  },
  result,
  resolvedIntent = { id: "intent-1", targetUserId: "user-1" },
  onResolveIntent = () => {},
  onHash = () => {},
  onMutate = () => {},
} = {}) {
  const source = routeSources[routeName]
  const scheduled = []
  const serviceCalls = []
  const deliveryCalls = []
  const intentCalls = []
  const prisma = {}
  const services = {
    async confirmGoogleLink(input) { serviceCalls.push(publicServiceInput(input)); return result ?? UPDATED },
    async removeGoogleMethod(input) { serviceCalls.push(publicServiceInput(input)); return result ?? { ...UPDATED, googleLinked: false } },
    async setPasswordMethod(input) { onMutate(input); serviceCalls.push(publicServiceInput(input)); return result ?? UPDATED },
    async removePasswordMethod(input) { serviceCalls.push(publicServiceInput(input)); return result ?? { ...UPDATED, passwordEnabled: false } },
  }
  const dependencies = {
    "next/server": {
      after: (callback) => scheduled.push(callback),
      NextResponse: responseAdapter(),
    },
    "@/auth": { getCurrentSession: async () => session },
    "@/lib/account-security-email-intents": {
      deliverAccountSecurityEmailIntent: async ({ intentId }) => { deliveryCalls.push(intentId) },
    },
    "@/lib/account-security-methods": services,
    "@/lib/account-surface-data": { clearAccountSurfaceDataCache: () => {} },
    "@/lib/auth-env": { getAuthSecret: () => "route-secret" },
    "@/lib/auth-method-intents": {
      AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
      resolveBoundAuthMethodIntent: async (input) => {
        onResolveIntent(input)
        intentCalls.push({ cookieValue: input.cookieValue, purpose: input.purpose, status: input.status })
        assert.equal(input.prismaClient, prisma)
        assert.equal(input.secret, "route-secret")
        return resolvedIntent
      },
    },
    "@/lib/auth-request": { authRequestNetworkIdentifier: () => "network" },
    "@/lib/auth-security": { hashPassword: async () => { onHash(); return "argon2-hash" } },
    "@/lib/prisma": { prisma },
  }
  const routeModule = loadCompiledModule(source, `${routeName}-account-security-route.test.ts`, dependencies)
  const factoryName = {
    confirm: "createGoogleLinkConfirmHandler",
    unlink: "createGoogleUnlinkHandler",
    password: "createPasswordMethodHandler",
    disable: "createPasswordDisableHandler",
  }[routeName]
  const POST = routeModule[factoryName]({
    prismaClient: prisma,
    getSession: async () => session,
    secret: "route-secret",
    resolveIntent: dependencies["@/lib/auth-method-intents"].resolveBoundAuthMethodIntent,
    mutate: services[{
      confirm: "confirmGoogleLink",
      unlink: "removeGoogleMethod",
      password: "setPasswordMethod",
      disable: "removePasswordMethod",
    }[routeName]],
    scheduleAfter: dependencies["next/server"].after,
    deliver: dependencies["@/lib/account-security-email-intents"].deliverAccountSecurityEmailIntent,
    hashPassword: dependencies["@/lib/auth-security"].hashPassword,
    clock: () => new Date("2026-08-28T12:00:00.000Z"),
    clearCache: () => {},
  })
  return { POST, scheduled, serviceCalls, deliveryCalls, intentCalls }
}

function publicServiceInput(input) {
  const copy = { ...input }
  delete copy.prismaClient
  delete copy.verifyPasswordMethodProofFn
  delete copy.newPasswordHash
  delete copy.newPassword
  delete copy.hashPasswordFn
  delete copy.googleReauthPreflight
  delete copy.secret
  delete copy.now
  delete copy.networkIdentifier
  return copy
}

function responseAdapter() {
  return {
    json(body, init = {}) {
      const response = {
        body,
        status: init.status ?? 200,
        cookieSets: [],
      }
      response.cookies = { set: (...args) => response.cookieSets.push(args) }
      return response
    },
  }
}

function requestFor(routeName, body, cookie = "intent-cookie-value") {
  const path = {
    confirm: "google/link/confirm",
    unlink: "google/unlink",
    password: "password",
    disable: "password/disable",
  }[routeName]
  return new Request(`https://massagelab.test/api/account/security/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `ml-auth-method-binding=${cookie}`,
      "x-forwarded-for": "203.0.113.9",
    },
    body: JSON.stringify(body),
  })
}

function validBody(routeName) {
  if (routeName === "confirm" || routeName === "disable") return { confirmed: true }
  if (routeName === "unlink") return { password: "current-password", twoFactorCode: "123456", confirmed: true }
  return { mode: "ADD", newPassword: "a-long-new-password", confirmed: true }
}

function assertCookieCleared(response) {
  assert.equal(response.cookieSets.length, 1)
  const [name, value, options] = response.cookieSets[0]
  assert.equal(name, "ml-auth-method-binding")
  assert.equal(value, "")
  assert.equal(options.maxAge, 0)
  assert.equal(options.httpOnly, true)
  assert.equal(options.sameSite, "lax")
  assert.equal(options.path, "/")
  assert.equal(typeof options.secure, "boolean")
}
