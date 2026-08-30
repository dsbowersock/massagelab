import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { Prisma, PrismaClient } from "@prisma/client"
import { getAuthSecret } from "@/lib/auth-env"
import { normalizeEmail } from "@/lib/auth-security"
import { ensureUserRole } from "@/lib/auth-users"
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import { resolveNormalizedUserId } from "@/lib/normalized-user-email"
import { isGoogleIdentityUniqueConstraint } from "@/lib/prisma-identity-unique-constraint"
import { prisma } from "@/lib/prisma"

export const AUTH_METHOD_INTENT_COOKIE = "ml-auth-method-binding"

export type GoogleIntentPurpose = "SIGN_IN_OR_LINK" | "LINK_GOOGLE" | "ADD_PASSWORD" | "REMOVE_PASSWORD"
type AuthIntentClient = Pick<PrismaClient, "$transaction" | "$queryRaw" | "authMethodIntent" | "user" | "account">
type SessionIdentity = { id?: string | null; email?: string | null } | null | undefined
type GoogleAccountProof = { type: string; provider: "google"; providerAccountId: string }
type GoogleProfileProof = { email: string; name: string | null; image: string | null }
type EnsureRole = (userId: string, email: string | null, database: Prisma.TransactionClient) => Promise<unknown>

export type GoogleAuthenticationDecision =
  | { kind: "CONTINUE"; userId: string; created?: boolean }
  | { kind: "LINK_REQUIRED"; userId: string }
  | { kind: "REAUTH_COMPLETE"; purpose: Exclude<GoogleIntentPurpose, "SIGN_IN_OR_LINK">; userId: string }
  | { kind: "REJECTED"; recoveryPath: GoogleRecoveryPath }

type GoogleRecoveryPath =
  | "/login?auth=google-retry"
  | "/login?auth=google-unavailable"
  | "/account?tab=security&auth=google-retry"

const INTENT_LIFETIME_MS = 10 * 60 * 1000
const MAX_PRUNE_ROWS = 100
const SECURITY_PURPOSES = new Set<GoogleIntentPurpose>(["LINK_GOOGLE", "ADD_PASSWORD", "REMOVE_PASSWORD"])

/** Creates an opaque browser proof; only its domain-separated HMAC is persisted. */
export async function startAuthMethodIntent({
  prismaClient = prisma,
  purpose,
  targetUserId,
  secret = getAuthSecret(),
  now = new Date(),
  randomBytesFn = randomBytes,
}: {
  prismaClient?: AuthIntentClient
  purpose: GoogleIntentPurpose
  targetUserId?: string | null
  secret?: string
  now?: Date
  randomBytesFn?: (size: number) => Buffer
}) {
  if (!isGoogleIntentPurpose(purpose)) throw new Error("Unsupported Google intent purpose.")
  if (SECURITY_PURPOSES.has(purpose) && !targetUserId) {
    throw new Error("This Google intent purpose requires a target user.")
  }
  const resolvedSecret = requireSecret(secret)
  const browserBindingToken = randomBytesFn(32).toString("base64url")
  const browserBindingHash = bindingHash(browserBindingToken, resolvedSecret)
  const expiresAt = new Date(now.getTime() + INTENT_LIFETIME_MS)

  const intent = await runCommerceTransaction(prismaClient as PrismaClient, async (tx) => (
    tx.authMethodIntent.create({
      data: {
        purpose,
        targetUserId: targetUserId ?? null,
        provider: "google",
        browserBindingHash,
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    })
  ))

  await pruneStaleAuthMethodIntents(prismaClient, now).catch(() => undefined)

  return { intentId: intent.id, expiresAt: intent.expiresAt, browserBindingToken }
}

/**
 * Removes bounded expired rows after creation; maintenance failure never rejects
 * a committed intent. Unexpired consumed security proofs remain available for
 * the subsequent account mutation that atomically clears their provider proof.
 */
async function pruneStaleAuthMethodIntents(prismaClient: AuthIntentClient, now: Date): Promise<void> {
  const stale = await prismaClient.authMethodIntent.findMany({
    where: { expiresAt: { lt: now } },
    orderBy: { updatedAt: "asc" },
    take: MAX_PRUNE_ROWS,
    select: { id: true },
  })
  if (stale.length > 0) {
    await prismaClient.authMethodIntent.deleteMany({ where: { id: { in: stale.map(({ id }) => id) } } })
  }
}

/** Serializes the private cookie without exposing any database or identity proof. */
export function serializeAuthMethodIntentBinding(intentId: string, browserBindingToken: string) {
  return `${intentId}.${browserBindingToken}`
}

/** Rejects malformed cookie values before the database sees attacker-controlled IDs. */
export function parseAuthMethodIntentBinding(value: unknown) {
  if (typeof value !== "string") return null
  const separator = value.indexOf(".")
  const intentId = value.slice(0, separator)
  const browserBindingToken = value.slice(separator + 1)
  if (separator < 1 || !/^[A-Za-z0-9_-]{8,128}$/.test(intentId) || !/^[A-Za-z0-9_-]{43}$/.test(browserBindingToken)) {
    return null
  }
  return { intentId, browserBindingToken }
}

/**
 * Resolves the exact cookie-bound intent while returning only the internal ID
 * and target needed by a server route. Provider proof fields never leave this
 * service boundary or enter rendered markup.
 */
export async function resolveBoundAuthMethodIntent({
  prismaClient = prisma,
  cookieValue,
  purpose,
  status,
  secret = getAuthSecret(),
  now = new Date(),
}: {
  prismaClient?: AuthIntentClient
  cookieValue: unknown
  purpose: GoogleIntentPurpose
  status: "PENDING" | "PROVIDER_PROVEN" | "CONSUMED"
  secret?: string
  now?: Date
}): Promise<{ id: string; targetUserId: string | null } | null> {
  const binding = parseAuthMethodIntentBinding(cookieValue)
  if (!binding || !isGoogleIntentPurpose(purpose) || !["PENDING", "PROVIDER_PROVEN", "CONSUMED"].includes(status)) return null
  const capturedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : null
  if (!capturedNow) return null
  const resolvedSecret = requireSecret(secret)
  const intent = await prismaClient.authMethodIntent.findUnique({ where: { id: binding.intentId } })
  if (
    !intent
    || intent.provider !== "google"
    || intent.purpose !== purpose
    || intent.status !== status
    || (status === "CONSUMED" ? !intent.consumedAt : intent.consumedAt !== null)
    || intent.expiresAt <= capturedNow
    || !hashesEqual(intent.browserBindingHash, bindingHash(binding.browserBindingToken, resolvedSecret))
  ) return null
  return { id: intent.id, targetUserId: intent.targetUserId }
}

/**
 * Decides Google authentication before Auth.js adapter mutation. Serializable
 * retries plus exact predicate updates make one intent single-use under races.
 */
export async function prepareGoogleAuthentication({
  prismaClient = prisma,
  intentId,
  browserBindingToken,
  profile,
  account,
  currentSessionUser,
  secret = getAuthSecret(),
  now = new Date(),
  ensureRole = ensureUserRole,
}: {
  prismaClient?: AuthIntentClient
  intentId: string
  browserBindingToken: string
  profile: unknown
  account: unknown
  currentSessionUser?: SessionIdentity
  secret?: string
  now?: Date
  ensureRole?: EnsureRole
}): Promise<GoogleAuthenticationDecision> {
  const profileProof = verifiedGoogleProfile(profile)
  if (!profileProof) return rejected("SIGN_IN_OR_LINK", currentSessionUser, true)
  const accountProof = allowlistedGoogleAccount(account)
  if (!accountProof || !intentId || !browserBindingToken) {
    return rejected("SIGN_IN_OR_LINK", currentSessionUser)
  }

  const resolvedSecret = requireSecret(secret)
  const operation = () => runCommerceTransaction(prismaClient as PrismaClient, async (tx) => {
    const intent = await tx.authMethodIntent.findUnique({ where: { id: intentId } })
    const purpose = isGoogleIntentPurpose(intent?.purpose) ? intent.purpose : "SIGN_IN_OR_LINK"
    if (
      !intent
      || intent.provider !== "google"
      || intent.status !== "PENDING"
      || intent.consumedAt
      || intent.expiresAt <= now
      || !hashesEqual(intent.browserBindingHash, bindingHash(browserBindingToken, resolvedSecret))
    ) {
      return rejected(purpose, currentSessionUser)
    }

    if (purpose === "SIGN_IN_OR_LINK" && currentSessionUser) {
      const sessionId = typeof currentSessionUser.id === "string" ? currentSessionUser.id : ""
      const sessionEmail = normalizeEmail(currentSessionUser.email)
      const resolvedSessionUser = sessionId ? await tx.user.findUnique({ where: { id: sessionId } }) : null
      if (
        !resolvedSessionUser
        || resolvedSessionUser.id !== sessionId
        || normalizeEmail(resolvedSessionUser.email) !== profileProof.email
        || sessionEmail !== profileProof.email
      ) {
        return rejected(purpose, currentSessionUser)
      }
    }

    if (SECURITY_PURPOSES.has(purpose)) {
      return prepareSecurityReauthentication({
        tx,
        intent,
        purpose: purpose as Exclude<GoogleIntentPurpose, "SIGN_IN_OR_LINK">,
        profileProof,
        accountProof,
        currentSessionUser,
        now,
      })
    }

    const [resolvedUserId, accountByProvider] = await Promise.all([
      resolveNormalizedUserId({ prismaClient: tx, email: profileProof.email }),
      tx.account.findUnique({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: accountProof.providerAccountId } },
      }),
    ])
    const userByEmail = resolvedUserId ? await tx.user.findUnique({ where: { id: resolvedUserId } }) : null

    if (accountByProvider) {
      const providerUser = await tx.user.findUnique({ where: { id: accountByProvider.userId } })
      if (!providerUser || normalizeEmail(providerUser.email) !== profileProof.email || (userByEmail && userByEmail.id !== providerUser.id)) {
        return rejected(purpose, currentSessionUser)
      }
      if (!await consumePendingIntent(tx, intent.id, now)) return rejected(purpose, currentSessionUser)
      return { kind: "CONTINUE" as const, userId: providerUser.id }
    }

    if (userByEmail) {
      const proved = await tx.authMethodIntent.updateMany({
        where: { id: intent.id, targetUserId: null, status: "PENDING", consumedAt: null, expiresAt: { gt: now } },
        data: {
          targetUserId: userByEmail.id,
          status: "PROVIDER_PROVEN",
          providerAccountId: accountProof.providerAccountId,
          providerEmailHash: emailHash(profileProof.email, resolvedSecret),
          providerProvenAt: now,
        },
      })
      return proved.count === 1
        ? { kind: "LINK_REQUIRED" as const, userId: userByEmail.id }
        : rejected(purpose, currentSessionUser)
    }

    const user = await tx.user.create({
      data: {
        email: profileProof.email,
        emailVerified: now,
        name: profileProof.name,
        image: profileProof.image,
        profile: { create: { displayName: profileProof.name } },
        accounts: { create: accountProof },
      },
    })
    await ensureRole(user.id, user.email, tx)
    if (!await consumePendingIntent(tx, intent.id, now)) return rejected(purpose, currentSessionUser)
    return { kind: "CONTINUE" as const, userId: user.id, created: true }
  })

  try {
    return await operation()
  } catch (error) {
    // A different browser may win the normalized User or Google Account unique
    // constraint after our initial read. Restart once to resolve its committed owner.
    if (!isGoogleIdentityUniqueConstraint(error)) throw error
    return operation()
  }
}

async function prepareSecurityReauthentication({
  tx,
  intent,
  purpose,
  profileProof,
  accountProof,
  currentSessionUser,
  now,
}: {
  tx: Prisma.TransactionClient
  intent: { id: string; targetUserId: string | null }
  purpose: Exclude<GoogleIntentPurpose, "SIGN_IN_OR_LINK">
  profileProof: GoogleProfileProof
  accountProof: GoogleAccountProof
  currentSessionUser: SessionIdentity
  now: Date
}): Promise<GoogleAuthenticationDecision> {
  const sessionId = typeof currentSessionUser?.id === "string" ? currentSessionUser.id : ""
  const sessionEmail = normalizeEmail(currentSessionUser?.email)
  if (!sessionId || intent.targetUserId !== sessionId || sessionEmail !== profileProof.email) {
    return rejected(purpose, currentSessionUser)
  }
  const account = await tx.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: accountProof.providerAccountId } },
  })
  if (!account || account.userId !== sessionId) return rejected(purpose, currentSessionUser)
  if (!await consumePendingIntent(tx, intent.id, now, { providerAccountId: accountProof.providerAccountId, providerProvenAt: now })) {
    return rejected(purpose, currentSessionUser)
  }
  return { kind: "REAUTH_COMPLETE", purpose, userId: sessionId }
}

async function consumePendingIntent(
  tx: Prisma.TransactionClient,
  intentId: string,
  now: Date,
  proof: { providerAccountId?: string; providerProvenAt?: Date } = {},
) {
  const consumed = await tx.authMethodIntent.updateMany({
    where: { id: intentId, status: "PENDING", consumedAt: null, expiresAt: { gt: now } },
    data: { status: "CONSUMED", consumedAt: now, ...proof },
  })
  return consumed.count === 1
}

function verifiedGoogleProfile(profile: unknown): GoogleProfileProof | null {
  const value = asRecord(profile)
  const email = normalizeEmail(value.email)
  if (!email || value.email_verified !== true) return null
  return {
    email,
    name: typeof value.name === "string" ? value.name.trim() || null : null,
    image: typeof value.picture === "string" ? value.picture : null,
  }
}

function allowlistedGoogleAccount(account: unknown): GoogleAccountProof | null {
  const value = asRecord(account)
  if (value.provider !== "google" || typeof value.providerAccountId !== "string" || !value.providerAccountId) return null
  return {
    type: "oauth",
    provider: "google",
    providerAccountId: value.providerAccountId,
  }
}

function rejected(purpose: GoogleIntentPurpose, session: SessionIdentity, unavailable = false): GoogleAuthenticationDecision {
  if (SECURITY_PURPOSES.has(purpose) || session) {
    return { kind: "REJECTED", recoveryPath: "/account?tab=security&auth=google-retry" }
  }
  return {
    kind: "REJECTED",
    recoveryPath: unavailable ? "/login?auth=google-unavailable" : "/login?auth=google-retry",
  }
}

function isGoogleIntentPurpose(value: unknown): value is GoogleIntentPurpose {
  return value === "SIGN_IN_OR_LINK" || value === "LINK_GOOGLE" || value === "ADD_PASSWORD" || value === "REMOVE_PASSWORD"
}

function bindingHash(token: string, secret: string) {
  return createHmac("sha256", secret).update(`auth-method-binding\0${token}`).digest("hex")
}

function emailHash(email: string, secret: string) {
  return createHmac("sha256", secret).update(`verified-google-email\0${email}`).digest("hex")
}

function hashesEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex")
  const rightBytes = Buffer.from(right, "hex")
  return leftBytes.length === rightBytes.length && leftBytes.length > 0 && timingSafeEqual(leftBytes, rightBytes)
}

function requireSecret(secret: string) {
  if (!secret) throw new Error("AUTH_SECRET is required for auth-method intents.")
  return secret
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
