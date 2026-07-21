import type { Prisma, PrismaClient } from "@prisma/client"

type CommerceTransactionOptions = {
  /** Maximum total transaction attempts, including the initial attempt; capped at three. */
  maxRetries?: number
}

const RETRYABLE_TRANSACTION_CODES = new Set(["P2034", "55P03", "40P01"])
const FULL_JITTER_MS = 35
const MAX_COMMERCE_TRANSACTION_ATTEMPTS = 3

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidateCode = (error as { code?: unknown }).code
  return typeof candidateCode === "string" && RETRYABLE_TRANSACTION_CODES.has(candidateCode)
}

function jitterMs(attempt: number): number {
  return Math.min((attempt + 1) * 50 + Math.floor(Math.random() * FULL_JITTER_MS), 250)
}

/** Bounds the legacy retry-named option to total transaction attempts. */
function getCommerceTransactionAttemptLimit(maxRetries: number): number {
  if (!Number.isFinite(maxRetries)) {
    return MAX_COMMERCE_TRANSACTION_ATTEMPTS
  }

  return Math.min(Math.max(Math.trunc(maxRetries), 1), MAX_COMMERCE_TRANSACTION_ATTEMPTS)
}

/**
 * Runs a short serializable database transaction with a pooled Neon-compatible retry policy.
 *
 * Pooled Neon connections are not session-affine, so session advisory locks cannot protect
 * commerce writes. Callbacks must perform database-only work: never Stripe/network I/O. Use
 * unique/check constraints and predicate updates to enforce ownership and state transitions.
 * The legacy `maxRetries` option specifies total attempts, including the initial attempt, and
 * is capped at three.
 */
export async function runCommerceTransaction<T>(
  prismaClient: Pick<PrismaClient, "$transaction">,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  { maxRetries = MAX_COMMERCE_TRANSACTION_ATTEMPTS }: CommerceTransactionOptions = {},
): Promise<T> {
  let lastError: unknown
  const maxAttempts = getCommerceTransactionAttemptLimit(maxRetries)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prismaClient.$transaction(callback, { isolationLevel: "Serializable" })
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt >= maxAttempts - 1) {
        throw error
      }

      lastError = error
      await new Promise((resolve) => setTimeout(resolve, jitterMs(attempt)))
    }
  }

  throw lastError
}
