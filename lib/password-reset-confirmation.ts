import type { PrismaClient } from "@prisma/client"

import { runCommerceTransaction } from "./commerce/transactions.ts"

export type ConfirmPasswordResetInput = {
  prismaClient: Pick<PrismaClient, "$transaction">
  tokenHash: string
  passwordHash: string
  now?: Date
}

export type ConfirmPasswordResetResult =
  | { status: "UPDATED" }
  | { status: "INVALID" }

/**
 * Checks whether a password-reset token is presently eligible for consumption.
 *
 * The return value deliberately reveals no user or token state. Every successful
 * effect added by the complete reset flow is committed atomically; this initial
 * contract intentionally performs no mutation until its compare-and-set claim
 * is introduced.
 */
export async function confirmPasswordReset(
  input: ConfirmPasswordResetInput,
): Promise<ConfirmPasswordResetResult> {
  const now = captureNow(input.now)
  validateOpaqueHash(input.tokenHash, "reset token hash")
  validateOpaqueHash(input.passwordHash, "password hash")

  return runCommerceTransaction(input.prismaClient, async (tx) => {
    const token = await tx.passwordResetToken.findUnique({
      where: { tokenHash: input.tokenHash },
      select: { id: true, userId: true, expiresAt: true, consumedAt: true },
    })

    if (!token || token.consumedAt || token.expiresAt.getTime() <= now.getTime()) {
      return { status: "INVALID" }
    }

    // Task 2 makes the predicate update claim authoritative for concurrent requests.
    return { status: "INVALID" }
  })
}

function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid reset time.")
  return now
}

function validateOpaqueHash(value: string, label: string): void {
  if (typeof value !== "string" || value.length < 1 || value.length > 512) {
    throw new Error(`Provide a valid ${label}.`)
  }
}
