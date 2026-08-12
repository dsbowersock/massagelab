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

export type PasswordResetTokenEligibilityInput = {
  prismaClient: Pick<PrismaClient, "passwordResetToken">
  tokenHash: string
  now?: Date
}

/**
 * Checks whether a hashed reset token is currently worth the password-hashing cost.
 *
 * This read-only boolean gate projects no account data and is never authoritative:
 * confirmPasswordReset must still win the transactional compare-and-set claim.
 */
export async function isPasswordResetTokenEligible(
  input: PasswordResetTokenEligibilityInput,
): Promise<boolean> {
  const now = captureNow(input.now)
  validateOpaqueHash(input.tokenHash, "reset token hash")

  const token = await input.prismaClient.passwordResetToken.findFirst({
    where: {
      tokenHash: input.tokenHash,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true },
  })

  return token !== null
}

/**
 * Atomically consumes a valid reset link, replaces the password, and revokes sessions.
 *
 * The predicate update is the authoritative token claim. The result deliberately
 * reveals no user or token state, including when a concurrent request loses the claim.
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
      select: { id: true, userId: true },
    })

    if (!token) {
      return { status: "INVALID" }
    }

    const claim = await tx.passwordResetToken.updateMany({
      where: {
        id: token.id,
        userId: token.userId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    })
    if (claim.count !== 1) {
      return { status: "INVALID" }
    }

    await tx.passwordCredential.upsert({
      where: { userId: token.userId },
      create: { userId: token.userId, passwordHash: input.passwordHash },
      update: { passwordHash: input.passwordHash },
    })
    await tx.passwordResetToken.updateMany({
      where: { userId: token.userId, consumedAt: null },
      data: { consumedAt: now },
    })
    await tx.user.update({
      where: { id: token.userId },
      data: { authSessionVersion: { increment: 1 } },
    })
    await tx.session.deleteMany({ where: { userId: token.userId } })

    return { status: "UPDATED" }
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
