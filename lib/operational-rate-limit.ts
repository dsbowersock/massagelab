import { createHmac, randomInt } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { getAuthSecret } from "./auth-env.ts"
import { runCommerceTransaction } from "./commerce/transactions.ts"
import {
  resolveOperationalRateLimitRules,
  type OperationalRateLimitRequest,
  type OperationalRateLimitRule,
  type OperationalRateLimitScope,
} from "./operational-rate-limit-policy.ts"
import { prisma } from "./prisma.ts"

export type {
  OperationalAccountSubject,
  OperationalBookingSubject,
  OperationalRateLimitRequest,
  OperationalRateLimitScope,
} from "./operational-rate-limit-policy.ts"

export type OperationalRateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: "RATE_LIMITED"; retryAfterSeconds: number }
  | { allowed: false; reason: "UNAVAILABLE" }

export type OperationalRateLimitClient =
  Pick<PrismaClient, "$transaction" | "operationalRateLimitBucket">

type OperationalBucketRecord = {
  count: number
  windowStart: Date
  blockedUntil: Date | null
}

type PreparedRule = OperationalRateLimitRule & {
  keyHash: string
}

const HMAC_DOMAIN = "operational-rate-limit:v1"
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
const DEFAULT_PRUNE_ROWS = 100
const VALID_SCOPES = new Set<OperationalRateLimitScope>(["GLOBAL", "NETWORK", "ACCOUNT", "RESOURCE"])
const DIAGNOSTIC_OPERATION_ALLOWLIST = {
  ANATOMIME_ROOM_CREATE: true,
  ANATOMIME_ROOM_JOIN_INGRESS: true,
  ANATOMIME_ROOM_JOIN: true,
  ANATOMIME_REALTIME_TOKEN_INGRESS: true,
  ANATOMIME_REALTIME_TOKEN_START: true,
  ANATOMIME_REALTIME_TOKEN_ISSUE: true,
  ANATOMIME_UNJOINED_LOOKUP: true,
  BOOKING_AVAILABILITY: true,
  BOOKING_CREATE: true,
  WAITLIST_JOIN: true,
  DONATION_CHECKOUT: true,
  PROBLEM_REPORT: true,
  EMAIL_PUBLIC_AUTH: true,
  EMAIL_SECURITY: true,
} satisfies Record<OperationalRateLimitRequest["operation"], true>
const DIAGNOSTIC_OPERATIONS = new Set<string>(Object.keys(DIAGNOSTIC_OPERATION_ALLOWLIST))
const emittedFailureDiagnostics = new Set<string>()

type OperationalFailureClass = "DEFINITION" | "PERSISTENCE"

/**
 * Emits at most one privacy-safe warning for each finite operation/failure pair
 * in this runtime. Unknown caller labels collapse to UNKNOWN, and request or
 * error data never crosses this diagnostic boundary.
 */
function reportOperationalFailureOnce(input: unknown, failureClass: OperationalFailureClass) {
  let operation = "UNKNOWN"
  try {
    if (input && typeof input === "object" && "operation" in input) {
      const candidate = (input as { operation?: unknown }).operation
      if (typeof candidate === "string" && DIAGNOSTIC_OPERATIONS.has(candidate)) {
        operation = candidate
      }
    }
  } catch {
    // Hostile getters remain the fixed UNKNOWN label.
  }

  const diagnosticKey = `${operation}:${failureClass}`
  if (emittedFailureDiagnostics.has(diagnosticKey)) return
  emittedFailureDiagnostics.add(diagnosticKey)
  try {
    console.warn("Operational rate limiter unavailable.", { operation, failureClass })
  } catch {
    // Observability must not alter the fail-closed limiter result.
  }
}

/**
 * Checks and consumes every fixed rule for one allowlisted operation in a
 * single bounded Serializable transaction. Invalid input and unavailable
 * persistence fail closed before protected work begins.
 */
export async function consumeOperationalRateLimit(
  input: OperationalRateLimitRequest & {
    prismaClient?: OperationalRateLimitClient
    secret?: string
    now?: Date
    shouldPrune?: () => boolean
  },
): Promise<OperationalRateLimitDecision> {
  let client: OperationalRateLimitClient
  let now: Date
  let preparedRules: PreparedRule[]

  try {
    client = input.prismaClient ?? prisma
    now = input.now ?? new Date()
    if (!Number.isFinite(now.getTime())) throw new Error("A valid limiter time is required.")
    const secret = resolveSecret(input.secret)
    const rules = resolveOperationalRateLimitRules(input)
    if (!rules || rules.length === 0) throw new Error("Unknown operational rate-limit operation.")
    preparedRules = rules
      .map((rule) => ({
        ...rule,
        keyHash: operationalRateLimitKeyHash({
          policy: rule.policy,
          scope: rule.scope,
          normalizedSubjectComponents: rule.normalizedSubjectComponents,
          secret,
        }),
      }))
      .sort(comparePreparedRules)
  } catch {
    reportOperationalFailureOnce(input, "DEFINITION")
    return { allowed: false, reason: "UNAVAILABLE" }
  }

  let decision: OperationalRateLimitDecision
  try {
    decision = await runCommerceTransaction(client, async (tx) => {
      const existing = await Promise.all(preparedRules.map((rule) => (
        tx.operationalRateLimitBucket.findUnique({
          where: {
            policy_scope_keyHash: {
              policy: rule.policy,
              scope: rule.scope,
              keyHash: rule.keyHash,
            },
          },
        })
      )))

      const latestBlock = latestActiveBlock(existing, preparedRules, now)
      if (latestBlock) {
        return {
          allowed: false,
          reason: "RATE_LIMITED",
          retryAfterSeconds: Math.max(1, Math.ceil((latestBlock.getTime() - now.getTime()) / 1000)),
        } as const
      }

      for (let index = 0; index < preparedRules.length; index += 1) {
        const rule = preparedRules[index]
        const record = existing[index]
        const expired = !record || fixedWindowEnd(record.windowStart, rule.windowMs) <= now
        const windowStart = expired ? now : record.windowStart
        const count = expired ? 1 : record.count + 1
        const blockedUntil = count >= rule.limit
          ? fixedWindowEnd(windowStart, rule.windowMs)
          : null
        const identity = {
          policy: rule.policy,
          scope: rule.scope,
          keyHash: rule.keyHash,
        }

        await tx.operationalRateLimitBucket.upsert({
          where: { policy_scope_keyHash: identity },
          create: { ...identity, count, windowStart, blockedUntil, updatedAt: now },
          update: { count, windowStart, blockedUntil, updatedAt: now },
        })
      }

      return { allowed: true } as const
    })
  } catch {
    reportOperationalFailureOnce(input, "PERSISTENCE")
    return { allowed: false, reason: "UNAVAILABLE" }
  }

  await schedulePrune({
    prismaClient: client,
    now,
    shouldPrune: input.shouldPrune,
  })
  return decision
}

/** Produces the only subject identity persisted by the operational limiter. */
export function operationalRateLimitKeyHash(input: {
  policy: string
  scope: OperationalRateLimitScope
  normalizedSubjectComponents: readonly { label: string; value: string }[]
  secret: string
}): string {
  if (!input.secret || !input.policy || !VALID_SCOPES.has(input.scope)) {
    throw new Error("A valid operational limiter key definition is required.")
  }
  if (!Array.isArray(input.normalizedSubjectComponents) || input.normalizedSubjectComponents.length === 0) {
    throw new Error("At least one normalized subject component is required.")
  }

  const fields = [
    HMAC_DOMAIN,
    input.policy,
    input.scope,
    String(input.normalizedSubjectComponents.length),
  ]
  for (const component of input.normalizedSubjectComponents) {
    if (!component || typeof component.label !== "string" || !component.label || typeof component.value !== "string" || !component.value) {
      throw new Error("Normalized subject components must be nonempty labeled strings.")
    }
    fields.push(component.label, component.value)
  }

  const hmac = createHmac("sha256", input.secret)
  for (const field of fields) appendLengthDelimitedField(hmac, field)
  return hmac.digest("hex")
}

/** Deletes only a bounded, preselected set of inactive stale bucket IDs. */
export async function pruneOperationalRateLimits({
  prismaClient = prisma,
  before,
  maxRows,
}: {
  prismaClient?: Pick<PrismaClient, "operationalRateLimitBucket">
  before: Date
  maxRows: number
}): Promise<number> {
  const take = Math.min(Math.max(Math.trunc(maxRows), 0), DEFAULT_PRUNE_ROWS)
  if (take === 0) return 0
  const inactiveWhere = {
    updatedAt: { lt: before },
    OR: [{ blockedUntil: null }, { blockedUntil: { lt: before } }],
  }
  const stale = await prismaClient.operationalRateLimitBucket.findMany({
    where: inactiveWhere,
    orderBy: { updatedAt: "asc" },
    take,
    select: { id: true },
  })
  if (stale.length === 0) return 0
  const deleted = await prismaClient.operationalRateLimitBucket.deleteMany({
    where: {
      id: { in: stale.map(({ id }) => id) },
      ...inactiveWhere,
    },
  })
  return deleted.count
}

/** Exposes a deterministic hook around the privacy-neutral one-in-64 sample. */
export async function maybePruneOperationalRateLimits({
  prismaClient = prisma,
  before,
  maxRows = DEFAULT_PRUNE_ROWS,
  shouldPrune = () => randomInt(64) === 0,
}: {
  prismaClient?: Pick<PrismaClient, "operationalRateLimitBucket">
  before: Date
  maxRows?: number
  shouldPrune?: () => boolean
}): Promise<number> {
  try {
    return shouldPrune()
      ? await pruneOperationalRateLimits({ prismaClient, before, maxRows })
      : 0
  } catch {
    // Sampling and stale cleanup are best effort and never alter the limiter decision.
    return 0
  }
}

function latestActiveBlock(
  records: Array<OperationalBucketRecord | null>,
  rules: readonly PreparedRule[],
  now: Date,
): Date | null {
  let latest: Date | null = null
  for (let index = 0; index < rules.length; index += 1) {
    const record = records[index]
    if (!record) continue
    const windowEnd = fixedWindowEnd(record.windowStart, rules[index].windowMs)
    if (windowEnd <= now) continue
    const candidate = record.blockedUntil && record.blockedUntil > now
      ? record.blockedUntil
      : record.count >= rules[index].limit
        ? windowEnd
        : null
    if (candidate && (!latest || candidate > latest)) latest = candidate
  }
  return latest
}

function fixedWindowEnd(windowStart: Date, windowMs: number): Date {
  return new Date(windowStart.getTime() + windowMs)
}

/** Uses runtime-independent UTF-16 code-unit order for canonical database lock acquisition. */
function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function comparePreparedRules(left: PreparedRule, right: PreparedRule): number {
  return compareCodeUnits(left.policy, right.policy)
    || compareCodeUnits(left.scope, right.scope)
    || compareCodeUnits(left.keyHash, right.keyHash)
}

function appendLengthDelimitedField(hmac: ReturnType<typeof createHmac>, value: string) {
  const bytes = Buffer.from(value, "utf8")
  const length = Buffer.allocUnsafe(4)
  length.writeUInt32BE(bytes.length)
  hmac.update(length)
  hmac.update(bytes)
}

/**
 * Completes sampled cleanup before returning because serverless hosts may stop unawaited work.
 * Only the default one-in-64 sample pays cleanup latency, and failure stays neutral to the decision.
 */
async function schedulePrune({
  prismaClient,
  now,
  shouldPrune,
}: {
  prismaClient: OperationalRateLimitClient
  now: Date
  shouldPrune?: () => boolean
}) {
  try {
    await maybePruneOperationalRateLimits({
      prismaClient,
      before: new Date(now.getTime() - STALE_AFTER_MS),
      maxRows: DEFAULT_PRUNE_ROWS,
      shouldPrune,
    })
  } catch {
    // Cleanup is best effort and intentionally logs no request-derived data.
  }
}

function resolveSecret(secret: string | undefined): string {
  const resolved = secret === undefined ? getAuthSecret() : secret
  if (!resolved) throw new Error("AUTH_SECRET is required for operational rate limiting.")
  return resolved
}
