import type { Prisma, PrismaClient } from "@prisma/client"
import QRCode from "qrcode"

import { getAuthSecret } from "@/lib/auth-env"
import {
  consumeFreshGoogleReauth,
  isFreshConsumedGoogleReauth,
  type FreshGoogleReauthIntent,
} from "@/lib/auth-method-intent-proof"
import { verifyPasswordMethodProof } from "@/lib/auth-method-proof"
import {
  checkCredentialRateLimit,
  clearCredentialAccountFailure,
  recordCredentialFailure,
  type AuthRateLimitDecision,
} from "@/lib/auth-rate-limit"
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  normalizeEmail,
  verifyTotpCode,
} from "@/lib/auth-security"
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import { prisma } from "@/lib/prisma"
import {
  signTwoFactorEnrollmentBinding,
  verifyTwoFactorEnrollmentBinding,
} from "@/lib/two-factor-enrollment-binding"

export type TwoFactorManagementFailureCode =
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "PASSWORD_REQUIRED"
  | "PRIMARY_PROOF_INVALID"
  | "GOOGLE_PROOF_EXPIRED"
  | "TWO_FACTOR_REQUIRED"
  | "TWO_FACTOR_INVALID"
  | "ALREADY_ENABLED"
  | "NOT_ENABLED"
  | "ENROLLMENT_EXPIRED"
  | "CONFLICT"

export type StartEnrollmentResult =
  | {
      status: "SETUP_READY"
      qrCode: string
      manualCode: string
      enrollmentBinding: string
    }
  | { status: "REJECTED"; code: TwoFactorManagementFailureCode; retryAfterSeconds?: number }

export type EnableTwoFactorResult =
  | { status: "ENABLED"; backupCodes: string[] }
  | { status: "REJECTED"; code: TwoFactorManagementFailureCode; retryAfterSeconds?: number }

export type PrimaryProof =
  | { kind: "PASSWORD"; password: string }
  | { kind: "GOOGLE"; intentId: string }

type TwoFactorManagementClient = Pick<
  PrismaClient,
  | "$transaction"
  | "$queryRaw"
  | "user"
  | "twoFactorSecret"
  | "backupCode"
  | "session"
  | "authMethodIntent"
  | "authRateLimitBucket"
>

type MethodState = {
  id: string
  email: string | null
  authSessionVersion: number
  passwordCredential: { id: string; userId: string } | null
  accounts: Array<{ id: string; userId: string; provider: string; providerAccountId: string }>
  twoFactorSecret: SecretRow | null
}

type SecretRow = {
  id: string
  userId: string
  encryptedSecret: string
  enabledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type PasswordProofService = typeof verifyPasswordMethodProof

type TwoFactorManagementDependencies = {
  verifyPasswordMethodProof: PasswordProofService
  isFreshConsumedGoogleReauth: typeof isFreshConsumedGoogleReauth
  consumeFreshGoogleReauth: typeof consumeFreshGoogleReauth
  generateTotpSecret: typeof generateTotpSecret
  encryptSecret: typeof encryptSecret
  renderQrCode: (otpauthUrl: string) => Promise<string>
  decryptSecret: typeof decryptSecret
  verifyTotpCode: typeof verifyTotpCode
  generateBackupCodes: typeof generateBackupCodes
  hashBackupCode: typeof hashBackupCode
  checkCredentialRateLimit: typeof checkCredentialRateLimit
  recordCredentialFailure: typeof recordCredentialFailure
  clearCredentialAccountFailure: typeof clearCredentialAccountFailure
}

type StartTwoFactorEnrollmentInput = {
  prismaClient?: TwoFactorManagementClient
  userId: string
  primaryProof: PrimaryProof
  networkIdentifier: string
  confirmed: boolean
  authSecret?: string
  now?: Date
  dependencies?: Partial<TwoFactorManagementDependencies>
}

type EnableTwoFactorInput = {
  prismaClient?: TwoFactorManagementClient
  userId: string
  enrollmentBinding: string
  code: string
  confirmed: boolean
  networkIdentifier: string
  authSecret?: string
  now?: Date
  dependencies?: Partial<TwoFactorManagementDependencies>
}

const defaultDependencies: TwoFactorManagementDependencies = {
  verifyPasswordMethodProof,
  isFreshConsumedGoogleReauth,
  consumeFreshGoogleReauth,
  generateTotpSecret,
  encryptSecret,
  renderQrCode: (otpauthUrl) => QRCode.toDataURL(otpauthUrl),
  decryptSecret,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  checkCredentialRateLimit,
  recordCredentialFailure,
  clearCredentialAccountFailure,
}

class EnrollmentConflict extends Error {}

/**
 * Creates or replaces a disabled pending authenticator enrollment only after a
 * fresh primary proof. Enabled rows are rejected before proof or secret work,
 * and Google proof consumption commits with the exact pending-row write.
 */
export async function startTwoFactorEnrollment(
  input: StartTwoFactorEnrollmentInput,
): Promise<StartEnrollmentResult> {
  const now = captureNow(input.now)
  if (
    !now
    || input.confirmed !== true
    || !validIdentifier(input.userId)
    || !validNetworkIdentifier(input.networkIdentifier)
    || !validPrimaryProof(input.primaryProof)
  ) {
    return rejected("INVALID_REQUEST")
  }

  const client = input.prismaClient ?? prisma
  const deps = { ...defaultDependencies, ...input.dependencies }
  const authSecret = input.authSecret ?? getAuthSecret()
  if (!validSecret(authSecret)) return rejected("INVALID_REQUEST")

  const preflight = await loadMethodState(client, input.userId)
  if (!preflight) return rejected("PRIMARY_PROOF_INVALID")
  if (preflight.twoFactorSecret?.enabledAt) return rejected("ALREADY_ENABLED")
  if (!preflight.passwordCredential) return rejected("PASSWORD_REQUIRED")

  let googleIntent: FreshGoogleReauthIntent | null = null
  if (input.primaryProof.kind === "PASSWORD") {
    let proof
    try {
      proof = await deps.verifyPasswordMethodProof({
        prismaClient: client,
        userId: input.userId,
        password: input.primaryProof.password,
        networkIdentifier: input.networkIdentifier,
        secret: authSecret,
        now,
      })
    } catch {
      return rejected("CONFLICT")
    }
    if (proof.status === "RATE_LIMITED") return rejected("RATE_LIMITED")
    if (
      proof.status !== "VERIFIED"
      || proof.userId !== preflight.id
      || proof.authSessionVersion !== preflight.authSessionVersion
    ) {
      return rejected("PRIMARY_PROOF_INVALID")
    }
  } else {
    if (!hasLinkedGoogle(preflight) || !validIdentifier(input.primaryProof.intentId)) {
      return rejected("PRIMARY_PROOF_INVALID")
    }
    const intent = await client.authMethodIntent.findUnique({
      where: { id: input.primaryProof.intentId },
    })
    if (!deps.isFreshConsumedGoogleReauth(intent, "LINK_GOOGLE", preflight.id, now)) {
      return rejected("GOOGLE_PROOF_EXPIRED")
    }
    if (!googleAccountMatchesIntent(preflight, intent)) return rejected("PRIMARY_PROOF_INVALID")
    googleIntent = intent
  }

  let setup: { secret: string; otpauthUrl: string }
  let encryptedSecret: string
  let qrCode: string
  try {
    setup = deps.generateTotpSecret(preflight.email ?? "")
    if (!validSecret(setup.secret) || !validSecret(setup.otpauthUrl)) throw new EnrollmentConflict()
    encryptedSecret = deps.encryptSecret(setup.secret)
    if (!validSecret(encryptedSecret)) throw new EnrollmentConflict()
    qrCode = await deps.renderQrCode(setup.otpauthUrl)
    if (!validQrCode(qrCode)) throw new EnrollmentConflict()
  } catch {
    return rejected("CONFLICT")
  }

  try {
    const committed = await runCommerceTransaction(client, async (tx) => {
      const current = await loadMethodState(tx, input.userId)
      if (!current || current.authSessionVersion !== preflight.authSessionVersion) {
        throw new EnrollmentConflict()
      }
      if (current.twoFactorSecret?.enabledAt) {
        return { status: "REJECTED", code: "ALREADY_ENABLED" } as const
      }
      if (!current.passwordCredential || methodSnapshotChanged(preflight, current)) {
        throw new EnrollmentConflict()
      }

      if (googleIntent) {
        const currentIntent = await tx.authMethodIntent.findUnique({ where: { id: googleIntent.id } })
        if (
          !deps.isFreshConsumedGoogleReauth(currentIntent, "LINK_GOOGLE", current.id, now)
          || !googleAccountMatchesIntent(current, currentIntent)
          || !await deps.consumeFreshGoogleReauth(tx, currentIntent, now)
        ) {
          throw new EnrollmentConflict()
        }
      }

      const row = await writeExactPendingSecret({
        tx,
        expected: preflight.twoFactorSecret,
        current: current.twoFactorSecret,
        userId: current.id,
        encryptedSecret,
        now,
      })
      return { status: "COMMITTED", row } as const
    })

    if (committed.status === "REJECTED") return committed
    const enrollmentBinding = signTwoFactorEnrollmentBinding({
      authSecret,
      userId: preflight.id,
      authSessionVersion: preflight.authSessionVersion,
      twoFactorSecretId: committed.row.id,
      encryptedSecret: committed.row.encryptedSecret,
      updatedAt: committed.row.updatedAt,
      now,
    })
    return {
      status: "SETUP_READY",
      qrCode,
      manualCode: setup.secret,
      enrollmentBinding,
    }
  } catch {
    return rejected("CONFLICT")
  }
}

/**
 * Enables only the exact pending row named by a valid same-browser binding.
 * Code verification and backup hashing occur before the short transaction;
 * row CAS, backup replacement, version increment, and Session deletion commit
 * or roll back as one unit.
 */
export async function enableTwoFactor(input: EnableTwoFactorInput): Promise<EnableTwoFactorResult> {
  const now = captureNow(input.now)
  if (
    !now
    || input.confirmed !== true
    || !validIdentifier(input.userId)
    || !validNetworkIdentifier(input.networkIdentifier)
    || typeof input.enrollmentBinding !== "string"
  ) {
    return rejected("INVALID_REQUEST")
  }
  if (typeof input.code !== "string" || input.code.trim().length === 0) {
    return rejected("TWO_FACTOR_REQUIRED")
  }

  const client = input.prismaClient ?? prisma
  const deps = { ...defaultDependencies, ...input.dependencies }
  const authSecret = input.authSecret ?? getAuthSecret()
  if (!validSecret(authSecret)) return rejected("INVALID_REQUEST")

  const preflight = await loadMethodState(client, input.userId)
  if (!preflight) return rejected("ENROLLMENT_EXPIRED")
  if (preflight.twoFactorSecret?.enabledAt) return rejected("ALREADY_ENABLED")
  const pending = preflight.twoFactorSecret
  if (!pending) return rejected("ENROLLMENT_EXPIRED")

  const binding = verifyTwoFactorEnrollmentBinding({
    authSecret,
    value: input.enrollmentBinding,
    userId: preflight.id,
    authSessionVersion: preflight.authSessionVersion,
    twoFactorSecretId: pending.id,
    encryptedSecret: pending.encryptedSecret,
    updatedAt: pending.updatedAt,
    now,
  })
  if (!binding) return rejected("ENROLLMENT_EXPIRED")

  const limiterInput = {
    prismaClient: client,
    purpose: "TWO_FACTOR" as const,
    email: normalizeEmail(preflight.email),
    networkIdentifier: input.networkIdentifier,
    secret: authSecret,
    now,
  }
  let limiter: AuthRateLimitDecision
  try {
    limiter = await deps.checkCredentialRateLimit(limiterInput)
  } catch {
    return rejected("CONFLICT")
  }
  if (!limiter.allowed) return rejected("RATE_LIMITED", limiter.retryAfterSeconds)

  let validCode = false
  try {
    validCode = deps.verifyTotpCode(deps.decryptSecret(pending.encryptedSecret), input.code)
  } catch {
    validCode = false
  }
  if (!validCode) {
    try {
      const failure = await deps.recordCredentialFailure(limiterInput)
      return failure.allowed
        ? rejected("TWO_FACTOR_INVALID")
        : rejected("TWO_FACTOR_INVALID", failure.retryAfterSeconds)
    } catch {
      return rejected("CONFLICT")
    }
  }

  let plaintextCodes: string[]
  let codeHashes: string[]
  try {
    plaintextCodes = deps.generateBackupCodes(8)
    if (!validBackupCodes(plaintextCodes)) throw new EnrollmentConflict()
    codeHashes = await Promise.all(plaintextCodes.map((code) => deps.hashBackupCode(code)))
    if (!validBackupHashes(codeHashes)) throw new EnrollmentConflict()
  } catch {
    return rejected("CONFLICT")
  }

  try {
    const result = await runCommerceTransaction(client, async (tx) => {
      const current = await loadMethodState(tx, input.userId)
      if (!current || current.authSessionVersion !== preflight.authSessionVersion) {
        throw new EnrollmentConflict()
      }
      if (current.twoFactorSecret?.enabledAt) {
        return { status: "REJECTED", code: "ALREADY_ENABLED" } as const
      }
      if (!exactSecretSnapshot(current.twoFactorSecret, pending)) throw new EnrollmentConflict()

      const enabled = await tx.twoFactorSecret.updateMany({
        where: {
          id: pending.id,
          userId: preflight.id,
          encryptedSecret: pending.encryptedSecret,
          enabledAt: null,
          updatedAt: pending.updatedAt,
        },
        data: { enabledAt: now, updatedAt: now },
      })
      if (enabled.count !== 1) throw new EnrollmentConflict()

      await tx.backupCode.deleteMany({ where: { userId: preflight.id } })
      const created = await tx.backupCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId: preflight.id, codeHash })),
      })
      if (created.count !== codeHashes.length) throw new EnrollmentConflict()

      const version = await tx.user.updateMany({
        where: { id: preflight.id, authSessionVersion: preflight.authSessionVersion },
        data: { authSessionVersion: { increment: 1 } },
      })
      if (version.count !== 1) throw new EnrollmentConflict()
      await tx.session.deleteMany({ where: { userId: preflight.id } })
      return { status: "ENABLED", backupCodes: plaintextCodes } as const
    })
    if (result.status === "ENABLED") {
      try {
        // Limiter cleanup is ancillary after the security mutation commits; an
        // outage here must not tell the caller that the atomic enable failed.
        await deps.clearCredentialAccountFailure({
          prismaClient: client,
          purpose: "TWO_FACTOR",
          email: normalizeEmail(preflight.email),
          secret: authSecret,
        })
      } catch {
        // A later valid proof can clear the account-scoped bucket safely.
      }
    }
    return result
  } catch {
    return rejected("CONFLICT")
  }
}

async function writeExactPendingSecret(input: {
  tx: Prisma.TransactionClient
  expected: SecretRow | null
  current: SecretRow | null
  userId: string
  encryptedSecret: string
  now: Date
}): Promise<SecretRow> {
  if (!input.expected) {
    if (input.current) throw new EnrollmentConflict()
    return input.tx.twoFactorSecret.create({
      data: {
        userId: input.userId,
        encryptedSecret: input.encryptedSecret,
        enabledAt: null,
        createdAt: input.now,
        updatedAt: input.now,
      },
    })
  }
  if (!exactSecretSnapshot(input.current, input.expected) || input.expected.enabledAt) {
    throw new EnrollmentConflict()
  }
  const replaced = await input.tx.twoFactorSecret.updateMany({
    where: {
      id: input.expected.id,
      userId: input.userId,
      encryptedSecret: input.expected.encryptedSecret,
      enabledAt: null,
      updatedAt: input.expected.updatedAt,
    },
    data: { encryptedSecret: input.encryptedSecret, updatedAt: input.now },
  })
  if (replaced.count !== 1) throw new EnrollmentConflict()
  const row = await input.tx.twoFactorSecret.findUnique({ where: { id: input.expected.id } })
  if (!row || row.enabledAt) throw new EnrollmentConflict()
  return row
}

async function loadMethodState(
  client: Pick<TwoFactorManagementClient, "user"> | Pick<Prisma.TransactionClient, "user">,
  userId: string,
): Promise<MethodState | null> {
  return client.user.findUnique({
    where: { id: userId },
    include: {
      passwordCredential: true,
      accounts: { where: { provider: "google" } },
      twoFactorSecret: true,
    },
  })
}

function methodSnapshotChanged(before: MethodState, current: MethodState): boolean {
  return Boolean(before.passwordCredential) !== Boolean(current.passwordCredential)
    || googleAccountIds(before).join("\0") !== googleAccountIds(current).join("\0")
}

function googleAccountIds(user: MethodState): string[] {
  return user.accounts
    .filter((account) => account.provider === "google")
    .map((account) => `${account.id}:${account.providerAccountId}`)
    .sort()
}

function hasLinkedGoogle(user: MethodState): boolean {
  return user.accounts.some((account) => account.provider === "google" && validIdentifier(account.providerAccountId))
}

function googleAccountMatchesIntent(user: MethodState, intent: FreshGoogleReauthIntent): boolean {
  return user.accounts.some((account) => (
    account.provider === "google"
    && account.providerAccountId === intent.providerAccountId
  ))
}

function exactSecretSnapshot(left: SecretRow | null, right: SecretRow): boolean {
  return Boolean(left
    && left.id === right.id
    && left.userId === right.userId
    && left.encryptedSecret === right.encryptedSecret
    && sameDate(left.enabledAt, right.enabledAt)
    && sameDate(left.updatedAt, right.updatedAt))
}

function sameDate(left: Date | null, right: Date | null): boolean {
  return left === null || right === null
    ? left === right
    : left.getTime() === right.getTime()
}

function validPrimaryProof(value: unknown): value is PrimaryProof {
  if (!value || typeof value !== "object") return false
  const proof = value as Record<string, unknown>
  if (proof.kind === "PASSWORD") return typeof proof.password === "string" && proof.password.length > 0
  return proof.kind === "GOOGLE" && validIdentifier(proof.intentId)
}

function validBackupCodes(codes: unknown): codes is string[] {
  return Array.isArray(codes)
    && codes.length === 8
    && new Set(codes).size === 8
    && codes.every((code) => validSecret(code))
}

function validBackupHashes(hashes: unknown): hashes is string[] {
  return Array.isArray(hashes)
    && hashes.length === 8
    && hashes.every((hash) => validSecret(hash) && hash.length <= 512)
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 191
}

function validNetworkIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512
}

function validSecret(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function validQrCode(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/")
}

function captureNow(value?: Date): Date | null {
  const date = value === undefined ? new Date() : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function rejected(
  code: TwoFactorManagementFailureCode,
  retryAfterSeconds?: number,
): { status: "REJECTED"; code: TwoFactorManagementFailureCode; retryAfterSeconds?: number } {
  return retryAfterSeconds === undefined
    ? { status: "REJECTED", code }
    : { status: "REJECTED", code, retryAfterSeconds }
}
