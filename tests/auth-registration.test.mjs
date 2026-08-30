import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import {
  buildVerificationEmailUrl,
  buildVerificationLoginPath,
  normalizeEmailVerificationParams,
  REGISTRATION_VERIFICATION_FAILED_MESSAGE,
  REGISTRATION_VERIFICATION_SENT_MESSAGE,
  registrationVerificationResponse,
  sendRegistrationVerification,
} from "../lib/auth-registration.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

describe("registration email delivery policy", () => {
  it("returns success only when verification has a deliverable path", () => {
    assert.deepEqual(registrationVerificationResponse({ delivered: true }), {
      status: 200,
      body: { message: REGISTRATION_VERIFICATION_SENT_MESSAGE },
    })
    assert.deepEqual(registrationVerificationResponse({ delivered: false }), {
      status: 503,
      body: { message: REGISTRATION_VERIFICATION_FAILED_MESSAGE },
    })
  })

  it("allows development verification links without SMTP delivery", () => {
    assert.deepEqual(registrationVerificationResponse({ delivered: false, devLink: "/verify-email?token=dev" }), {
      status: 200,
      body: {
        message: REGISTRATION_VERIFICATION_SENT_MESSAGE,
        devLink: "/verify-email?token=dev",
      },
    })
  })

  it("delegates every valid account state to the enumeration-safe registration owner", async () => {
    const registerRoute = await readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8")

    assert.match(registerRoute, /registerPasswordAccount\(\{/)
    assert.match(registerRoute, /verifyPassword,/)
    assert.match(registerRoute, /ensureUserRole,/)
    assert.match(registerRoute, /recordLegalAcceptances,/)
    assert.match(registerRoute, /legalMetadata: legalRequestMetadata\(request\)/)
    assert.match(registerRoute, /safePostLegalAcceptanceCallback\(body\.callbackUrl\)/)
    assert.match(registerRoute, /PUBLIC_ACCOUNT_ENTRY_MESSAGE[\s\S]*status: 202/)
    assert.doesNotMatch(registerRoute, /prisma\.(?:user|emailVerificationToken|passwordResetToken)\./)
    assert.doesNotMatch(registerRoute, /account already exists/i)
  })

  it("validates before delegating quota-first work and maps exact rate-limit metadata", async () => {
    const registerRoute = await readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8")

    assert.ok(registerRoute.indexOf("isPublicAccountEmail(email)") < registerRoute.indexOf("registerPasswordAccount({"))
    assert.ok(registerRoute.indexOf("missingLegalDocuments.length") < registerRoute.indexOf("registerPasswordAccount({"))
    assert.match(registerRoute, /consumeRateLimit: consumeEmailWorkRateLimit/)
    assert.match(registerRoute, /result\.retryAfterSeconds/)
    assert.match(registerRoute, /"Retry-After": String\(result\.retryAfterSeconds\)/)
    assert.doesNotMatch(registerRoute, /assertRateLimit|recordFailedAttempt|rateLimitKey|prisma\.authAttempt/)
  })

  it("returns neutral 202 before an unresolved provider task scheduled through Next after", async () => {
    const afterCallbacks = []
    let providerStarted = false
    let releaseProvider
    const provider = new Promise((resolve) => { releaseProvider = resolve })
    const { POST } = await loadRegistrationRoute({
      afterCallbacks,
      registerWork: async (input) => {
        input.scheduleAccountWork(() => {
          providerStarted = true
          return provider
        })
        return { status: "ACCEPTED" }
      },
    })

    const response = await POST(new Request("https://massagelab.app/api/account/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", password: "a-long-password", acceptedLegalDocuments: [] }),
    }))

    assert.equal(response.status, 202)
    assert.equal(providerStarted, false)
    assert.equal(afterCallbacks.length, 1)
    const delivery = afterCallbacks[0]()
    assert.equal(providerStarted, true)
    releaseProvider({ delivered: false })
    await delivery
  })

  it("presents Google registration and email-password registration on the register page", async () => {
    const registerPage = await readFile(new URL("../app/register/page.tsx", import.meta.url), "utf8")
    const registerForm = await readFile(new URL("../app/register/register-form.tsx", import.meta.url), "utf8")
    const loginForm = await readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8")

    assert.match(registerPage, /hasGoogleAuthConfig/)
    assert.match(registerPage, /initialCallbackUrl=\{callbackUrl\}/)
    assert.match(registerPage, /Only allow same-origin, root-relative post-registration redirects/)
    assert.match(registerPage, /callbackUrl\?: string \| string\[\]/)
    assert.match(registerPage, /firstQueryValue\(\(await searchParams\)\.callbackUrl\)/)
    assert.match(registerForm, /Continue with Google/)
    assert.match(registerForm, /startGoogleAuthMethodIntent\(googleRedirectTo\)/)
    assert.match(registerForm, /Create account with email/)
    assert.match(registerForm, /callbackUrl: initialCallbackUrl/)
    assert.match(registerForm, /buildRegistrationLegalProviderRedirectPath/)
    assert.match(registerForm, /REGISTRATION_REQUEST_FAILED_MESSAGE/)
    assert.match(registerForm, /if \(!beginEntryAction\("email"\)\) return/)
    assert.match(registerForm, /if \(!navigating\) finishEntryAction\(\)/)
    assert.match(registerForm, /role=\{statusIsError \? "alert" : "status"\}/)
    assert.match(registerForm, /aria-live=\{statusIsError \? "assertive" : "polite"\}/)
    for (const [name, source] of [["login", loginForm], ["register", registerForm]]) {
      assert.match(source, /useEntryAction\(\)/, name)
      assert.match(source, /startGoogleAuthMethodIntent\(googleRedirectTo\)/, name)
      assert.doesNotMatch(source, /emailSubmissionLock|googleSubmissionLock|registrationSubmissionLock/, name)
      assert.match(source, /disabled=\{entryAction !== "idle"\}/, name)
    }
    assert.match(loginForm, /entryAction === "email" \? "Signing in…" : "Sign in with email"/)
    assert.match(loginForm, /entryAction === "google" \? "Starting Google sign-in…" : "Continue with Google"/)
    assert.match(registerForm, /entryAction === "email" \? "Creating account…" : "Create account with email"/)
    assert.match(registerForm, /entryAction === "google" \? "Starting Google registration…" : "Continue with Google"/)
  })

  it("preserves an app-local callback through email verification and sign-in", async () => {
    const authMail = await readFile(new URL("../lib/auth-mail.ts", import.meta.url), "utf8")
    const verifyPage = await readFile(new URL("../app/verify-email/page.tsx", import.meta.url), "utf8")
    const callbackUrl = "/clock?source=music&panel=background&commerceCart=open"
    const verificationUrl = new URL(
      buildVerificationEmailUrl("https://www.massagelab.app", "token-safe", callbackUrl),
    )

    assert.equal(verificationUrl.searchParams.get("token"), "token-safe")
    assert.equal(verificationUrl.searchParams.get("callbackUrl"), callbackUrl)
    assert.equal(
      buildVerificationLoginPath(true, verificationUrl.searchParams.get("callbackUrl")),
      "/login?callbackUrl=%2Fclock%3Fsource%3Dmusic%26panel%3Dbackground%26commerceCart%3Dopen&verified=1",
    )
    assert.equal(
      new URL(
        buildVerificationEmailUrl("https://www.massagelab.app", "token-safe", "https://example.com"),
      ).searchParams.get("callbackUrl"),
      "/onboarding",
    )
    assert.equal(
      buildVerificationLoginPath(false, "https://example.com"),
      "/login?callbackUrl=%2Fonboarding",
    )

    const unsafeCallbacks = [
      "//example.com/clock",
      "https://massagelab.app.example.com/clock",
      "/\\example.com/clock",
      "\\example.com/clock",
      { path: "/clock" },
      42,
    ]
    for (const unsafeCallback of unsafeCallbacks) {
      const unsafeVerificationUrl = new URL(
        buildVerificationEmailUrl("https://www.massagelab.app", "token-safe", unsafeCallback),
      )
      assert.equal(unsafeVerificationUrl.searchParams.get("callbackUrl"), "/onboarding")
      assert.equal(
        buildVerificationLoginPath(false, unsafeCallback),
        "/login?callbackUrl=%2Fonboarding",
      )
      assert.equal(
        buildVerificationLoginPath(true, unsafeCallback),
        "/login?callbackUrl=%2Fonboarding&verified=1",
      )
    }

    assert.deepEqual(
      normalizeEmailVerificationParams({
        token: "token-safe",
        callbackUrl,
      }),
      { token: "token-safe", callbackUrl },
    )
    assert.deepEqual(
      normalizeEmailVerificationParams({
        token: ["token-safe", "token-repeated"],
        callbackUrl: ["//example.com", callbackUrl],
      }),
      { token: "", callbackUrl: "/onboarding" },
    )
    assert.deepEqual(
      normalizeEmailVerificationParams({
        token: "token-safe",
        callbackUrl: [callbackUrl, "/other"],
      }),
      { token: "token-safe", callbackUrl: "/onboarding" },
    )

    let delivered
    const deliveryResult = await sendRegistrationVerification(
      async (email, token, safeCallbackUrl) => {
        delivered = { email, token, callbackUrl: safeCallbackUrl }
        return { delivered: true }
      },
      "person@example.com",
      "token-safe",
      "https://example.com/checkout",
    )
    assert.deepEqual(deliveryResult, { delivered: true })
    assert.deepEqual(delivered, {
      email: "person@example.com",
      token: "token-safe",
      callbackUrl: "/onboarding",
    })

    assert.match(authMail, /buildVerificationEmailUrl\(getSiteUrl\(\), token, callbackUrl\)/)
    assert.match(verifyPage, /normalizeEmailVerificationParams\(await searchParams\)/)
    assert.match(verifyPage, /buildVerificationLoginPath\(verified, callbackUrl\)/)
  })
})

async function loadRegistrationRoute({ afterCallbacks, registerWork }) {
  const source = await readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8")
  return loadCompiledModule(source, "account-register-route.review-test.ts", {
    "next/server": {
      after: (callback) => afterCallbacks.push(callback),
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/auth-env": { getAuthSecret: () => "secret" },
    "@/lib/auth-mail": {
      sendAccountChangeEmail: async () => ({ delivered: true }),
      sendPasswordResetEmail: async () => ({ delivered: true }),
      sendVerificationEmail: async () => ({ delivered: true }),
    },
    "@/lib/auth-rate-limit": { consumeEmailWorkRateLimit: async () => ({ allowed: true }) },
    "@/lib/auth-entry-messages": {
      PUBLIC_ACCOUNT_ENTRY_MESSAGE: "Check that email address for the appropriate sign-in, verification, or recovery next step.",
    },
    "@/lib/auth-request": {
      authRequestNetworkIdentifier: () => "network",
      isPublicAccountEmail: () => true,
    },
    "@/lib/auth-registration-service": {
      registerPasswordAccount: registerWork,
    },
    "@/lib/auth-registration": { sendRegistrationVerification: (sender, ...args) => sender(...args) },
    "@/lib/auth-security": {
      generateRandomToken: () => "token",
      hashPassword: async () => "hash",
      hashToken: () => "token-hash",
      normalizeEmail: (value) => String(value ?? "").trim().toLowerCase(),
      tokenExpiresIn: () => new Date(),
      verifyPassword: async () => true,
    },
    "@/lib/auth-users": { ensureUserRole: async () => "USER" },
    "@/lib/legal-acceptance": {
      acceptedDocumentIdsFromInput: () => new Set(),
      legalRequestMetadata: () => ({}),
      missingRequiredLegalDocuments: () => [],
      recordLegalAcceptances: async () => [],
    },
    "@/lib/legal-acceptance-gate": { safePostLegalAcceptanceCallback: () => "/onboarding" },
    "@/lib/legal-documents": { requiredLegalDocumentsForEvent: () => [] },
    "@/lib/prisma": { prisma: {} },
  })
}
