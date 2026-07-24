import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  buildVerificationEmailUrl,
  buildVerificationLoginPath,
  normalizeEmailVerificationParams,
  REGISTRATION_VERIFICATION_FAILED_MESSAGE,
  REGISTRATION_VERIFICATION_SENT_MESSAGE,
  registrationVerificationResponse,
  sendRegistrationVerification,
} from "../lib/auth-registration.js"

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

  it("lets unverified existing accounts request a fresh verification email with the same password", async () => {
    const registerRoute = await readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8")

    assert.match(registerRoute, /!existingUser\.emailVerified/)
    assert.match(registerRoute, /verifyPassword\(existingUser\.passwordCredential\.passwordHash, password\)/)
    assert.match(registerRoute, /const emailVerificationToken = await prisma\.emailVerificationToken\.create/)
    assert.match(registerRoute, /userId: existingUser\.id/)
    assert.match(registerRoute, /metadata: legalRequestMetadata\(request\)/)
    assert.match(registerRoute, /safePostLegalAcceptanceCallback\(body\.callbackUrl\)/)
    assert.match(
      registerRoute,
      /registrationVerificationResponse\(\s*await sendRegistrationVerification\(sendVerificationEmail, email, verificationToken, callbackUrl\),\s*\)/,
    )
    assert.match(registerRoute, /Preserve usable links from overlapping resend requests/)
    assert.match(registerRoute, /if \(resendResult\.status === 200\)/)
    assert.match(registerRoute, /id: \{ not: emailVerificationToken\.id \}/)
    assert.match(registerRoute, /expiresAt: \{ lt: resendRequestedAt \}/)
    assert.match(registerRoute, /id: emailVerificationToken\.id/)
  })

  it("presents Google registration and email-password registration on the register page", async () => {
    const registerPage = await readFile(new URL("../app/register/page.tsx", import.meta.url), "utf8")
    const registerForm = await readFile(new URL("../app/register/register-form.tsx", import.meta.url), "utf8")

    assert.match(registerPage, /hasGoogleAuthConfig/)
    assert.match(registerPage, /initialCallbackUrl=\{callbackUrl\}/)
    assert.match(registerPage, /Only allow same-origin, root-relative post-registration redirects/)
    assert.match(registerPage, /callbackUrl\?: string \| string\[\]/)
    assert.match(registerPage, /firstQueryValue\(\(await searchParams\)\.callbackUrl\)/)
    assert.match(registerForm, /Continue with Google/)
    assert.match(registerForm, /signIn\("google", \{ redirectTo: googleRedirectTo \}\)/)
    assert.match(registerForm, /Create account with email/)
    assert.match(registerForm, /callbackUrl: initialCallbackUrl/)
    assert.match(registerForm, /buildRegistrationLegalProviderRedirectPath/)
    assert.match(registerForm, /REGISTRATION_REQUEST_FAILED_MESSAGE/)
    assert.match(registerForm, /if \(isSubmitting\) return/)
    assert.match(registerForm, /finally \{\s*setIsSubmitting\(false\)/)
    assert.match(registerForm, /role=\{statusIsError \? "alert" : "status"\}/)
    assert.match(registerForm, /aria-live=\{statusIsError \? "assertive" : "polite"\}/)
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
