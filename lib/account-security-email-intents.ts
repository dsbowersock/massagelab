import { createHash, randomBytes } from "node:crypto"
import type { AccountSecurityEmailKind, PrismaClient } from "@prisma/client"

import { sendAccountChangeEmail } from "./auth-mail.ts"

const CLAIM_LEASE_MS = 5 * 60 * 1000

const SECURITY_EMAIL_COPY: Record<AccountSecurityEmailKind, { subject: string; message: string }> = {
  GOOGLE_LINKED: {
    subject: "Google sign-in linked to your MassageLab account",
    message: "Google sign-in was linked to your MassageLab account. If you made this change, no action is needed. If you did not, reset your password and contact support. You may receive this notice more than once if delivery had to be retried.",
  },
  GOOGLE_UNLINKED: {
    subject: "Google sign-in removed from your MassageLab account",
    message: "Google sign-in was removed from your MassageLab account. If you made this change, no action is needed. If you did not, reset your password and contact support. You may receive this notice more than once if delivery had to be retried.",
  },
  PASSWORD_ENABLED: {
    subject: "Password sign-in enabled for your MassageLab account",
    message: "Password sign-in was enabled for your MassageLab account. If you made this change, no action is needed. If you did not, reset your password and contact support. You may receive this notice more than once if delivery had to be retried.",
  },
  PASSWORD_CHANGED: {
    subject: "MassageLab account password changed",
    message: "The password for your MassageLab account was changed. If you made this change, no action is needed. If you did not, reset your password and contact support. You may receive this notice more than once if delivery had to be retried.",
  },
  PASSWORD_DISABLED: {
    subject: "Password sign-in disabled for your MassageLab account",
    message: "Password sign-in was disabled for your MassageLab account. If you made this change, no action is needed. If you did not, use your remaining sign-in method and contact support. You may receive this notice more than once if delivery had to be retried.",
  },
  PASSWORD_RECOVERED: {
    subject: "Password sign-in added or replaced for your MassageLab account",
    message: "Password sign-in was added or replaced for your MassageLab account. This can add email and password to an existing account, or replace an existing password. Existing sign-in methods remain connected. If you made this change, no action is needed. If you did not, contact support. You may receive this notice more than once if delivery had to be retried.",
  },
}

type SecurityEmailClient = Pick<PrismaClient, "accountSecurityEmailIntent">
type SecurityEmailSender = typeof sendAccountChangeEmail

export type AccountSecurityEmailDeliveryResult =
  | { status: "DELIVERED"; attempted: true; attemptCount: number }
  | { status: "FAILED"; attempted: true; attemptCount: number; code: "DELIVERY_FAILED" }
  | { status: "AMBIGUOUS"; attempted: true; attemptCount: number }
  | { status: "BUSY"; attempted: false; attemptCount: number }

/** Queues immutable allowlisted copy in the same transaction as its credential mutation. */
export async function queueAccountSecurityEmail(
  tx: SecurityEmailClient,
  input: {
    userId: string
    kind: AccountSecurityEmailKind
    recipientEmail: string
    idempotencyKey: string
  },
): Promise<{ id: string }> {
  const copy = SECURITY_EMAIL_COPY[input.kind]
  if (!copy || !validIdentifier(input.userId) || !validEmail(input.recipientEmail) || !validIdentifier(input.idempotencyKey)) {
    throw new Error("Invalid account-security email intent.")
  }

  return tx.accountSecurityEmailIntent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      userId: input.userId,
      kind: input.kind,
      recipientEmail: input.recipientEmail,
      subject: copy.subject,
      message: copy.message,
      idempotencyKey: input.idempotencyKey,
    },
    update: {},
    select: { id: true },
  })
}

/**
 * Claims one intent with a five-minute lease before transport and completes it
 * by exact token-hash CAS. Provider acceptance can be ambiguous, so expired
 * claims are intentionally retryable and delivery is at-least-once. Once the
 * provider has been called, a lost completion claim is AMBIGUOUS rather than
 * BUSY because another worker may have retried the same notice.
 */
export async function deliverAccountSecurityEmailIntent({
  prismaClient,
  intentId,
  send = sendAccountChangeEmail,
  now = new Date(),
  randomBytesFn = randomBytes,
}: {
  prismaClient: SecurityEmailClient
  intentId: string
  send?: SecurityEmailSender
  now?: Date
  randomBytesFn?: (size: number) => Buffer
}): Promise<AccountSecurityEmailDeliveryResult> {
  const capturedNow = validDate(now)
  if (!validIdentifier(intentId) || !capturedNow) {
    return { status: "BUSY", attempted: false, attemptCount: 0 }
  }
  const claimToken = randomBytesFn(32)
  if (!Buffer.isBuffer(claimToken) || claimToken.length !== 32) {
    return { status: "BUSY", attempted: false, attemptCount: 0 }
  }
  const claimTokenHash = hashClaimToken(claimToken)
  const claimExpiresAt = new Date(capturedNow.getTime() + CLAIM_LEASE_MS)

  const claimed = await prismaClient.accountSecurityEmailIntent.updateMany({
    where: {
      id: intentId,
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "PROCESSING", claimExpiresAt: { lt: capturedNow } },
      ],
    },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      claimTokenHash,
      claimExpiresAt,
      lastAttemptedAt: capturedNow,
      failureCode: null,
    },
  })
  const current = await prismaClient.accountSecurityEmailIntent.findUnique({ where: { id: intentId } })
  if (claimed.count !== 1 || !current || current.claimTokenHash !== claimTokenHash) {
    return { status: "BUSY", attempted: false, attemptCount: current?.attemptCount ?? 0 }
  }

  let delivered = false
  try {
    const result = await send(current.recipientEmail, current.subject, current.message)
    delivered = result.delivered === true
  } catch {
    // Never log recipient, content, or provider diagnostics.
    console.error("Account-security email delivery failed")
  }

  const finished = await prismaClient.accountSecurityEmailIntent.updateMany({
    where: { id: intentId, status: "PROCESSING", claimTokenHash },
    data: {
      status: delivered ? "DELIVERED" : "FAILED",
      deliveredAt: delivered ? capturedNow : null,
      failureCode: delivered ? null : "DELIVERY_FAILED",
      claimTokenHash: null,
      claimExpiresAt: null,
    },
  })
  if (finished.count !== 1) {
    return { status: "AMBIGUOUS", attempted: true, attemptCount: current.attemptCount }
  }
  return delivered
    ? { status: "DELIVERED", attempted: true, attemptCount: current.attemptCount }
    : { status: "FAILED", attempted: true, attemptCount: current.attemptCount, code: "DELIVERY_FAILED" }
}

function hashClaimToken(token: Buffer): string {
  return createHash("sha256").update("account-security-email-claim\0").update(token).digest("hex")
}

function validDate(value: Date): Date | null {
  const date = value instanceof Date ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date : null
}

function validIdentifier(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 191
}

function validEmail(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 320 && !/[\r\n]/.test(value)
}
