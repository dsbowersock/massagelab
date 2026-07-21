type CommerceTransactionOptions = {
  maxRetries?: number
}

const RETRYABLE_TRANSACTION_CODES = new Set(["P2034", "55P03", "40P01"])
const FULL_JITTER_MS = 35

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

/** Runs a transaction callback with a pooled-Neon-compatible serializable retry policy. */
export async function runCommerceTransaction<T>(
  prismaClient: {
    $transaction: (callback: (tx: unknown) => Promise<T>, options?: { isolationLevel?: string }) => Promise<T>
  },
  callback: (tx: unknown) => Promise<T>,
  { maxRetries = 3 }: CommerceTransactionOptions = {},
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await prismaClient.$transaction(callback, { isolationLevel: "Serializable" })
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt >= maxRetries - 1) {
        throw error
      }

      lastError = error
      await new Promise((resolve) => setTimeout(resolve, jitterMs(attempt)))
    }
  }

  throw lastError
}
