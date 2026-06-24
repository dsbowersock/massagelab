export const REGISTRATION_VERIFICATION_SENT_MESSAGE = "Check your email to verify your account."
export const REGISTRATION_VERIFICATION_FAILED_MESSAGE =
  "Your account was created, but MassageLab could not send the verification email. Please try again later or contact support."

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
