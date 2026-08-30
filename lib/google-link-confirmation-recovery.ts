export const GENERIC_GOOGLE_LINK_RECOVERY_MESSAGE = "Something went wrong. Please try again."

export type GoogleLinkRecovery = {
  message: string
  needsTwoFactor?: boolean
}

/** Maps only MassageLab-owned Credentials codes to safe matching-account next steps. */
export function resolveCredentialLinkRecovery(code: unknown): GoogleLinkRecovery {
  if (code === "TWO_FACTOR_REQUIRED") {
    return {
      message: "Enter your authenticator or backup code, then try again.",
      needsTwoFactor: true,
    }
  }
  if (code === "TWO_FACTOR_INVALID") {
    return {
      message: "The authenticator or backup code was not accepted. Check the code and try again.",
      needsTwoFactor: true,
    }
  }
  if (code === "INVALID_CREDENTIALS" || code === "CredentialsSignin") {
    return {
      message: "The account email or password was not accepted. Try again or reset your password.",
      needsTwoFactor: false,
    }
  }
  if (code === "EMAIL_UNVERIFIED") {
    return {
      message: "Verify this account's email, then try again.",
      needsTwoFactor: false,
    }
  }
  if (code === "RATE_LIMITED") {
    return {
      message: "Too many attempts. Wait a little, then try again.",
      needsTwoFactor: false,
    }
  }
  return { message: GENERIC_GOOGLE_LINK_RECOVERY_MESSAGE }
}

/** Requires an exact status/code pair so arbitrary response text never reaches the UI. */
export function resolveGoogleLinkConfirmationRecovery(status: number, code: unknown): GoogleLinkRecovery {
  if (status === 403 && code === "PROOF_EXPIRED") {
    return {
      message: "This confirmation expired or belongs to another session. Start again with Google sign-in.",
    }
  }
  if (status === 401 && code === "AUTHENTICATION_REQUIRED") {
    return {
      message: "Your password confirmation ended. Start again with Google sign-in, then confirm the password account.",
    }
  }
  if (status === 409 && code === "ALREADY_LINKED") {
    return {
      message: "Google sign-in is already linked. Return to Account Security to review your sign-in methods.",
    }
  }
  if (status === 409 && (code === "CONFLICT" || code === "LAST_METHOD")) {
    return {
      message: "Your sign-in methods changed. Refresh Account Security, then start Google sign-in again if it is not linked.",
    }
  }
  if (status === 400 && code === "INVALID_REQUEST") {
    return {
      message: "Confirm that Google and password should open the same account, then try again.",
    }
  }
  return { message: GENERIC_GOOGLE_LINK_RECOVERY_MESSAGE }
}
