import type { PrismaClient } from "@prisma/client"

import { queueAccountSecurityEmail } from "./account-security-email-intents.ts"
import { normalizeEmail } from "./auth-security.js"
import { runCommerceTransaction } from "./commerce/transactions.ts"

/**
 * Inputs for the authoritative password-reset confirmation boundary.
 *
 * `tokenHash` and `passwordHash` are already-derived opaque hashes. `clock`
 * supplies one real `Date` per transaction attempt so a retry never reuses an
 * earlier expiry decision. The Prisma client must support the complete atomic
 * reset bundle through `$transaction`.
 */
export type ConfirmPasswordResetInput = {
  prismaClient: Pick<PrismaClient, "$transaction">
  tokenHash: string
  passwordHash: string
  clock?: () => Date
}

export type ConfirmPasswordResetResult =
  | { status: "UPDATED"; emailIntentId: string }
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
 * Atomically consumes one eligible reset link, replaces the password, and revokes sessions.
 *
 * Returns only the generic `UPDATED` or `INVALID` result. Each transaction
 * attempt captures its own current time immediately before reading token state,
 * so retries re-evaluate expiry. The compare-and-set predicate update is the
 * authoritative claim; after it succeeds, password replacement, consumption of
 * every outstanding account token, `authSessionVersion` increment, and adapter
 * Session deletion commit or roll back together. A concurrent loser receives
 * `INVALID` without revealing user or token state.
 */
export async function confirmPasswordReset(
  input: ConfirmPasswordResetInput,
): Promise<ConfirmPasswordResetResult> {
  validateOpaqueHash(input.tokenHash, "reset token hash")
  validateOpaqueHash(input.passwordHash, "password hash")
  const clock = input.clock ?? systemResetClock
  if (typeof clock !== "function") throw new Error("Provide a valid reset clock.")

  return runCommerceTransaction(input.prismaClient, async (tx) => {
    // A retry is a new authoritative attempt. Its expiry predicate must not
    // inherit a timestamp captured before the retry began.
    const now = captureClockNow(clock())
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
    const updatedUser = await tx.user.update({
      where: { id: token.userId },
      data: { authSessionVersion: { increment: 1 } },
    })
    await tx.session.deleteMany({ where: { userId: token.userId } })
    if (!updatedUser.email) throw new Error("Password recovery requires an account email.")
    // The reset-token owner is stable across transaction retries. Reusing it
    // lets the queue upsert return the same notice instead of adding another.
    const emailIntent = await queueAccountSecurityEmail(tx, {
      userId: token.userId,
      kind: "PASSWORD_RECOVERED",
      recipientEmail: normalizeEmail(updatedUser.email),
      idempotencyKey: `password-recovered:${token.id}`,
    })

    return { status: "UPDATED", emailIntentId: emailIntent.id }
  })
}

function systemResetClock(): Date {
  return new Date()
}

function captureClockNow(value: Date): Date {
  if (!(value instanceof Date)) throw new Error("Provide a valid reset time.")
  const now = new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid reset time.")
  return now
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
