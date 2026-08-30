const FRESH_GOOGLE_REAUTH_MS = 5 * 60 * 1000

export type SecurityGoogleReauthPurpose =
  | "LINK_GOOGLE"
  | "ADD_PASSWORD"
  | "REMOVE_PASSWORD"

export type FreshGoogleReauthIntent = {
  id: string
  targetUserId: string
  purpose: SecurityGoogleReauthPurpose
  status: "CONSUMED"
  provider: "google"
  providerAccountId: string
  providerProvenAt: Date
  expiresAt: Date
}

export type GoogleProofTransactionClient = {
  authMethodIntent: {
    updateMany(input: {
      where: {
        id: string
        targetUserId: string
        purpose: SecurityGoogleReauthPurpose
        status: "CONSUMED"
        provider: "google"
        providerAccountId: string
        providerProvenAt: Date
        expiresAt: { gt: Date }
      }
      data: { providerProvenAt: null }
    }): Promise<{ count: number }>
  }
}

/** Validates the short-lived Google proof used for account-security mutations. */
export function isFreshConsumedGoogleReauth(
  intent: unknown,
  purpose: SecurityGoogleReauthPurpose,
  userId: string,
  now: Date,
): intent is FreshGoogleReauthIntent {
  if (!isRecord(intent)) return false
  const providerProvenAt = intent.providerProvenAt
  const expiresAt = intent.expiresAt

  return validIdentifier(intent.id)
    && intent.targetUserId === userId
    && intent.purpose === purpose
    && intent.status === "CONSUMED"
    && intent.provider === "google"
    && validIdentifier(intent.providerAccountId)
    && providerProvenAt instanceof Date
    && freshDateClaim(providerProvenAt, now)
    && expiresAt instanceof Date
    && expiresAt > now
}

/** Consumes the exact proof once; the caller's transaction owns rollback. */
export async function consumeFreshGoogleReauth(
  tx: GoogleProofTransactionClient,
  intent: FreshGoogleReauthIntent,
  now: Date,
): Promise<boolean> {
  if (!isFreshConsumedGoogleReauth(intent, intent.purpose, intent.targetUserId, now)) return false

  const consumed = await tx.authMethodIntent.updateMany({
    where: {
      id: intent.id,
      targetUserId: intent.targetUserId,
      purpose: intent.purpose,
      status: "CONSUMED",
      provider: "google",
      providerAccountId: intent.providerAccountId,
      providerProvenAt: intent.providerProvenAt,
      expiresAt: { gt: now },
    },
    data: { providerProvenAt: null },
  })
  return consumed.count === 1
}

function freshDateClaim(value: Date, now: Date): boolean {
  const age = now.getTime() - value.getTime()
  return Number.isFinite(age) && age >= 0 && age <= FRESH_GOOGLE_REAUTH_MS
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 191
}
