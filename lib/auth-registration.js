import { safePostLegalAcceptanceCallback } from "./legal-acceptance-gate.js"

export const REGISTRATION_VERIFICATION_SENT_MESSAGE = "Check your email to verify your account."
export const REGISTRATION_VERIFICATION_FAILED_MESSAGE =
  "Your account was created, but MassageLab could not send the verification email. Please try again later or contact support."

/**
 * Builds the account-verification URL while limiting any post-login return to
 * an app-local destination.
 *
 * @param {string} siteUrl
 * @param {string} token
 * @param {unknown} callbackUrl
 * @returns {string}
 */
export function buildVerificationEmailUrl(siteUrl, token, callbackUrl) {
  const params = new URLSearchParams({ token })
  if (callbackUrl) {
    params.set("callbackUrl", safePostLegalAcceptanceCallback(callbackUrl))
  }
  return `${siteUrl}/verify-email?${params.toString()}`
}

/**
 * Builds the login destination shown after email verification.
 *
 * @param {boolean} verified
 * @param {unknown} callbackUrl
 * @returns {string}
 */
export function buildVerificationLoginPath(verified, callbackUrl) {
  const params = new URLSearchParams({
    callbackUrl: safePostLegalAcceptanceCallback(callbackUrl),
  })
  if (verified) params.set("verified", "1")
  return `/login?${params.toString()}`
}

/**
 * Local development exposes devLink without SMTP; production requires actual delivery.
 *
 * @param {{ delivered?: boolean, devLink?: string } | null | undefined} mailResult
 */
export function registrationVerificationResponse(mailResult) {
  const hasVerificationPath = Boolean(mailResult?.delivered || mailResult?.devLink)

  return {
    status: hasVerificationPath ? 200 : 503,
    body: {
      message: hasVerificationPath
        ? REGISTRATION_VERIFICATION_SENT_MESSAGE
        : REGISTRATION_VERIFICATION_FAILED_MESSAGE,
      ...(mailResult?.devLink ? { devLink: mailResult.devLink } : {}),
    },
  }
}
