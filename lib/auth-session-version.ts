export type AuthSessionVersionDecision =
  | { accepted: true; version: number }
  | { accepted: false }

type DecideAuthSessionVersionInput = {
  currentVersion: unknown
  tokenVersion: unknown
  isSignIn: boolean
}

/**
 * Decides whether a JWT proves it was issued for the account's current
 * revocation version. New sign-ins adopt the database value; later requests
 * must match it, except for legacy unversioned tokens while the value is zero.
 */
export function decideAuthSessionVersion({
  currentVersion,
  tokenVersion,
  isSignIn,
}: DecideAuthSessionVersionInput): AuthSessionVersionDecision {
  if (!isValidAuthSessionVersion(currentVersion)) return { accepted: false }

  if (isSignIn) {
    return { accepted: true, version: currentVersion }
  }

  if (tokenVersion === undefined && currentVersion === 0) {
    return { accepted: true, version: 0 }
  }

  if (!isValidAuthSessionVersion(tokenVersion) || tokenVersion !== currentVersion) {
    return { accepted: false }
  }

  return { accepted: true, version: currentVersion }
}

function isValidAuthSessionVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}
