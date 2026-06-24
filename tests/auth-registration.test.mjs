import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  REGISTRATION_VERIFICATION_FAILED_MESSAGE,
  REGISTRATION_VERIFICATION_SENT_MESSAGE,
  registrationVerificationResponse,
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
    assert.match(registerRoute, /registrationVerificationResponse\(await sendVerificationEmail\(email, verificationToken\)\)/)
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
    assert.match(registerForm, /buildRegistrationLegalProviderRedirectPath/)
    assert.match(registerForm, /REGISTRATION_REQUEST_FAILED_MESSAGE/)
    assert.match(registerForm, /if \(isSubmitting\) return/)
    assert.match(registerForm, /finally \{\s*setIsSubmitting\(false\)/)
    assert.match(registerForm, /role=\{statusIsError \? "alert" : "status"\}/)
    assert.match(registerForm, /aria-live=\{statusIsError \? "assertive" : "polite"\}/)
  })
})
