import { createHmac, randomInt } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { getAuthSecret } from "@/lib/auth-env"
import { normalizeEmail } from "@/lib/auth-security"
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import type { AuthAttemptPurpose } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"

export type AuthRateLimitScope = "ACCOUNT" | "NETWORK"
export type AuthRateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }
type EmailWorkPurpose = "REGISTER" | "PASSWORD_RESET"
type CredentialPurpose = "LOGIN" | "TWO_FACTOR"
type BucketPolicy = { account?: number; network: number }
type BucketRecord = {
  scope: AuthRateLimitScope
  count: number
  windowStart: Date
  blockedUntil: Date | null
}
type RateLimitClient = Pick<PrismaClient, "$transaction" | "authRateLimitBucket">

const WINDOW_MS = 15 * 60 * 1000
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
const DEFAULT_PRUNE_ROWS = 100
const POLICIES: Record<AuthAttemptPurpose, BucketPolicy> = {
  REGISTER: { account: 5, network: 12 },
  PASSWORD_RESET: { account: 5, network: 20 },
  LOGIN: { account: 8, network: 30 },
  TWO_FACTOR: { account: 8, network: 30 },
  GOOGLE_INTENT: { network: 30 },
}

type BaseInput = { prismaClient?: RateLimitClient; secret?: string; now?: Date }
type AccountNetworkInput = BaseInput & {
  email: string
  networkIdentifier: string
  shouldPrune?: () => boolean
}
type CredentialInput = AccountNetworkInput & { purpose: CredentialPurpose }

/** Produces the only identifier persisted by the limiter: a domain-separated HMAC. */
export function authRateLimitKeyHash({ purpose, scope, identifier, secret }: {
  purpose: AuthAttemptPurpose
  scope: AuthRateLimitScope
  identifier: string
  secret: string
}) {
  const normalizedIdentifier = scope === "ACCOUNT" ? normalizeEmail(identifier) : String(identifier).trim()
  if (!secret) throw new Error("AUTH_SECRET is required for auth rate limiting.")
  return createHmac("sha256", secret).update(`${purpose}\0${scope}\0${normalizedIdentifier}`).digest("hex")
}

/** Consumes accepted registration/reset work before database, hashing, or mail work. */
export async function consumeEmailWorkRateLimit(
  input: AccountNetworkInput & { purpose: EmailWorkPurpose },
): Promise<AuthRateLimitDecision> {
  if (input.purpose !== "REGISTER" && input.purpose !== "PASSWORD_RESET") {
    throw new Error("Email-work rate limiting supports only registration and password reset.")
  }
  const decision = await consumeBuckets(input, ["ACCOUNT", "NETWORK"])
  await schedulePrune(input)
  return decision
}

/** Consumes a privacy-safe network quota before any Google intent access. */
export async function consumeGoogleIntentStartRateLimit(
  input: BaseInput & { networkIdentifier: string; shouldPrune?: () => boolean },
): Promise<AuthRateLimitDecision> {
  const decision = await consumeBuckets({ ...input, purpose: "GOOGLE_INTENT", email: "" }, ["NETWORK"])
  await schedulePrune(input)
  return decision
}

/** Checks credential failure buckets without charging a healthy sign-in. */
export async function checkCredentialRateLimit(input: CredentialInput): Promise<AuthRateLimitDecision> {
  const now = input.now ?? new Date()
  const client = input.prismaClient ?? prisma
  const secret = resolveSecret(input.secret)
  const buckets = bucketIdentities(input.purpose, input.email, input.networkIdentifier, secret, ["ACCOUNT", "NETWORK"])
  const records = await Promise.all(buckets.map((bucket) => client.authRateLimitBucket.findUnique({
    where: { purpose_scope_keyHash: bucket },
  })))
  return blockedDecision(records, input.purpose, now)
}

/** Records only a failed password, TOTP, or backup-code proof. */
export async function recordCredentialFailure(input: CredentialInput): Promise<AuthRateLimitDecision> {
  const decision = await consumeBuckets(input, ["ACCOUNT", "NETWORK"])
  await schedulePrune(input)
  return decision
}

/** Clears the successful account's failures without weakening the shared network bucket. */
export async function clearCredentialAccountFailures({ prismaClient = prisma, email, secret }: {
  prismaClient?: Pick<PrismaClient, "authRateLimitBucket">
  email: string
  secret?: string
}) {
  const resolvedSecret = resolveSecret(secret)
  await Promise.all((["LOGIN", "TWO_FACTOR"] as const).map((purpose) => prismaClient.authRateLimitBucket.deleteMany({
    where: {
      purpose,
      scope: "ACCOUNT",
      keyHash: authRateLimitKeyHash({ purpose, scope: "ACCOUNT", identifier: email, secret: resolvedSecret }),
    },
  })))
}

/** Deletes only a bounded, preselected set of inactive stale bucket IDs. */
export async function pruneAuthRateLimits({ prismaClient = prisma, before, maxRows }: {
  prismaClient?: Pick<PrismaClient, "authRateLimitBucket">
  before: Date
  maxRows: number
}): Promise<number> {
  const take = Math.min(Math.max(Math.trunc(maxRows), 0), DEFAULT_PRUNE_ROWS)
  if (take === 0) return 0
  const stale = await prismaClient.authRateLimitBucket.findMany({
    where: {
      updatedAt: { lt: before },
      OR: [{ blockedUntil: null }, { blockedUntil: { lt: before } }],
    },
    orderBy: { updatedAt: "asc" },
    take,
    select: { id: true },
  })
  if (stale.length === 0) return 0
  const deleted = await prismaClient.authRateLimitBucket.deleteMany({ where: { id: { in: stale.map(({ id }) => id) } } })
  return deleted.count
}

/** Exposes a deterministic test hook around the privacy-neutral one-in-64 sample. */
export async function maybePruneAuthRateLimits({
  prismaClient = prisma,
  before,
  maxRows = DEFAULT_PRUNE_ROWS,
  shouldPrune = () => randomInt(64) === 0,
}: {
  prismaClient?: Pick<PrismaClient, "authRateLimitBucket">
  before: Date
  maxRows?: number
  shouldPrune?: () => boolean
}): Promise<number> {
  return shouldPrune() ? pruneAuthRateLimits({ prismaClient, before, maxRows }) : 0
}

async function consumeBuckets(
  input: AccountNetworkInput & { purpose: AuthAttemptPurpose },
  scopes: AuthRateLimitScope[],
): Promise<AuthRateLimitDecision> {
  const client = input.prismaClient ?? prisma
  const now = input.now ?? new Date()
  const secret = resolveSecret(input.secret)
  const identities = bucketIdentities(input.purpose, input.email, input.networkIdentifier, secret, scopes)

  return runCommerceTransaction(client as PrismaClient, async (tx) => {
    const existing = await Promise.all(identities.map((identity) => tx.authRateLimitBucket.findUnique({
      where: { purpose_scope_keyHash: identity },
    })))
    const blocked = blockedDecision(existing, input.purpose, now)
    if (!blocked.allowed) return blocked

    for (let index = 0; index < identities.length; index += 1) {
      const identity = identities[index]
      const record = existing[index]
      const expired = !record || record.windowStart.getTime() + WINDOW_MS <= now.getTime()
      const windowStart = expired ? now : record.windowStart
      const count = expired ? 1 : record.count + 1
      const blockedUntil = count >= bucketLimit(input.purpose, identity.scope)
        ? new Date(windowStart.getTime() + WINDOW_MS)
        : null

      await tx.authRateLimitBucket.upsert({
        where: { purpose_scope_keyHash: identity },
        create: { ...identity, count, windowStart, blockedUntil, updatedAt: now },
        update: { count, windowStart, blockedUntil, updatedAt: now },
      })
    }
    return { allowed: true }
  })
}

function blockedDecision(
  records: Array<BucketRecord | null>,
  purpose: AuthAttemptPurpose,
  now: Date,
): AuthRateLimitDecision {
  let latestBlock: Date | null = null
  for (const record of records) {
    if (!record || record.windowStart.getTime() + WINDOW_MS <= now.getTime()) continue
    const block = record.blockedUntil && record.blockedUntil > now
      ? record.blockedUntil
      : record.count >= bucketLimit(purpose, record.scope)
        ? new Date(record.windowStart.getTime() + WINDOW_MS)
        : null
    if (block && (!latestBlock || block > latestBlock)) latestBlock = block
  }
  return latestBlock
    ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((latestBlock.getTime() - now.getTime()) / 1000)) }
    : { allowed: true }
}

function bucketIdentities(
  purpose: AuthAttemptPurpose,
  email: string,
  networkIdentifier: string,
  secret: string,
  scopes: AuthRateLimitScope[],
) {
  return scopes.map((scope) => ({
    purpose,
    scope,
    keyHash: authRateLimitKeyHash({
      purpose,
      scope,
      identifier: scope === "ACCOUNT" ? email : networkIdentifier,
      secret,
    }),
  }))
}

function bucketLimit(purpose: AuthAttemptPurpose, scope: AuthRateLimitScope) {
  const limit = scope === "ACCOUNT" ? POLICIES[purpose].account : POLICIES[purpose].network
  if (!limit) throw new Error(`${purpose} does not support ${scope} rate limiting.`)
  return limit
}

async function schedulePrune(input: BaseInput & { shouldPrune?: () => boolean }) {
  const now = input.now ?? new Date()
  await maybePruneAuthRateLimits({
    prismaClient: input.prismaClient,
    before: new Date(now.getTime() - STALE_AFTER_MS),
    maxRows: DEFAULT_PRUNE_ROWS,
    shouldPrune: input.shouldPrune,
  })
}

function resolveSecret(secret?: string) {
  const resolved = secret ?? getAuthSecret()
  if (!resolved) throw new Error("AUTH_SECRET is required for auth rate limiting.")
  return resolved
}
