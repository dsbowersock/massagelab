type TwoFactorRecovery = { message: string }

const GENERIC_RECOVERY: TwoFactorRecovery = {
  message: "Something went wrong. Please try again.",
}

const RECOVERY_BY_OUTCOME = new Map<string, TwoFactorRecovery>([
  ["401:AUTHENTICATION_REQUIRED", { message: "Your sign-in session ended. Sign in and try again." }],
  ["400:INVALID_REQUEST", { message: "Check the required fields and confirmation, then try again." }],
  ["403:UNTRUSTED_REQUEST", { message: "Refresh Account Security and try again from this page." }],
  ["429:RATE_LIMITED", { message: "Too many attempts. Wait a little, then try again." }],
  ["409:PASSWORD_REQUIRED", { message: "Add a password sign-in method before setting up two-factor authentication." }],
  ["403:PRIMARY_PROOF_INVALID", { message: "Your password or Google confirmation was not accepted. Try again." }],
  ["403:GOOGLE_PROOF_EXPIRED", { message: "Your Google confirmation expired. Confirm with Google again." }],
  ["400:TWO_FACTOR_REQUIRED", { message: "Enter your current authenticator or backup code." }],
  ["403:TWO_FACTOR_INVALID", { message: "The authenticator or backup code was not accepted. Check it and try again." }],
  ["409:ALREADY_ENABLED", { message: "Two-factor authentication is already enabled. Refresh Account Security." }],
  ["409:NOT_ENABLED", { message: "Two-factor authentication is not enabled. Refresh Account Security." }],
  ["403:ENROLLMENT_EXPIRED", { message: "This setup expired. Start two-factor setup again." }],
  ["409:CONFLICT", { message: "Your security settings changed. Refresh Account Security and try again." }],
])

/**
 * Converts only an exact public status/code pair into fixed client guidance.
 * Arbitrary server fields are ignored so provider or exception text can never
 * become account-security UI content.
 */
export function resolveTwoFactorManagementRecovery(status: number, result: unknown): TwoFactorRecovery {
  if (!isJsonObject(result) || typeof result.code !== "string") return GENERIC_RECOVERY
  return RECOVERY_BY_OUTCOME.get(`${status}:${result.code}`) ?? GENERIC_RECOVERY
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
