import type { Prisma, PrismaClient } from "@prisma/client"
import { getAuthSecret } from "@/lib/auth-env"
import {
  checkCredentialRateLimit,
  clearCredentialAccountFailure,
  recordCredentialFailure,
} from "@/lib/auth-rate-limit"
import {
  decryptSecret,
  normalizeEmail,
  verifyBackupCode,
  verifyTotpCode,
} from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"

export type PreparedTwoFactorProof = {
  userId: string
  authSessionVersion: number
  twoFactorSecretId: string
  enabledAtMs: number
  updatedAtMs: number
  kind: "TOTP" | "BACKUP_CODE"
  backupCodeId: string | null
}

export type CurrentTwoFactorProofResult =
  | { status: "VERIFIED"; proof: PreparedTwoFactorProof }
  | { status: "NOT_ENABLED" | "TWO_FACTOR_REQUIRED" | "TWO_FACTOR_INVALID" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }

type LoadedTwoFactorUser = {
  id: string
  email: string | null
  authSessionVersion: number
  twoFactorSecret: {
    id: string
    userId: string
    encryptedSecret: string
    enabledAt: Date | null
    updatedAt: Date
  } | null
  backupCodes: Array<{
    id: string
    userId: string
    codeHash: string
  }>
}

type TwoFactorProofDependencies = {
  decryptSecret: typeof decryptSecret
  verifyTotpCode: typeof verifyTotpCode
  verifyBackupCode: typeof verifyBackupCode
}

type ProofPrismaClient = Pick<
  PrismaClient,
  "user" | "backupCode" | "authRateLimitBucket" | "$transaction"
>

export type ProofTransactionClient = Pick<
  Prisma.TransactionClient,
  "user" | "twoFactorSecret" | "backupCode"
>

const defaultDependencies: TwoFactorProofDependencies = {
  decryptSecret,
  verifyTotpCode,
  verifyBackupCode,
}

/**
 * Matches a submitted current-factor code against one already-loaded enabled
 * secret without consuming backup state or retaining code/secret material.
 */
export async function proveLoadedTwoFactorCode(input: {
  user: LoadedTwoFactorUser | null
  twoFactorCode: string
  dependencies?: Partial<TwoFactorProofDependencies>
}): Promise<CurrentTwoFactorProofResult> {
  const twoFactorSecret = input.user?.twoFactorSecret
  if (!input.user || !twoFactorSecret?.enabledAt) return { status: "NOT_ENABLED" }
  if (!input.twoFactorCode) return { status: "TWO_FACTOR_REQUIRED" }

  const deps = { ...defaultDependencies, ...input.dependencies }
  let validTotp = false
  try {
    validTotp = deps.verifyTotpCode(
      deps.decryptSecret(twoFactorSecret.encryptedSecret),
      input.twoFactorCode,
    )
  } catch {
    validTotp = false
  }

  let backupCodeId: string | null = null
  if (!validTotp) {
    for (const backupCode of input.user.backupCodes) {
      if (await deps.verifyBackupCode(backupCode.codeHash, input.twoFactorCode)) {
        backupCodeId = backupCode.id
        break
      }
    }
    if (!backupCodeId) return { status: "TWO_FACTOR_INVALID" }
  }

  return {
    status: "VERIFIED",
    proof: {
      userId: input.user.id,
      authSessionVersion: input.user.authSessionVersion,
      twoFactorSecretId: twoFactorSecret.id,
      enabledAtMs: twoFactorSecret.enabledAt.getTime(),
      updatedAtMs: twoFactorSecret.updatedAt.getTime(),
      kind: validTotp ? "TOTP" : "BACKUP_CODE",
      backupCodeId,
    },
  }
}

/**
 * Prepares current-factor proof for a later mutation transaction. Only the
 * TWO_FACTOR limiter is consulted or changed, and no backup row is consumed.
 */
export async function prepareCurrentTwoFactorProof(input: {
  prismaClient?: ProofPrismaClient
  userId: string
  twoFactorCode: string
  networkIdentifier: string
  secret?: string
  now?: Date
}): Promise<CurrentTwoFactorProofResult> {
  const prismaClient = input.prismaClient ?? prisma
  const now = input.now ?? new Date()
  const secret = input.secret ?? getAuthSecret()
  const user = await prismaClient.user.findUnique({
    where: { id: input.userId },
    include: {
      twoFactorSecret: true,
      backupCodes: { where: { usedAt: null }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!user?.twoFactorSecret?.enabledAt) return { status: "NOT_ENABLED" }

  const accountEmail = normalizeEmail(user.email)
  const limiterInput = {
    prismaClient,
    purpose: "TWO_FACTOR" as const,
    email: accountEmail,
    networkIdentifier: input.networkIdentifier,
    secret,
    now,
  }
  const decision = await checkCredentialRateLimit(limiterInput)
  if (!decision.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: decision.retryAfterSeconds }
  }

  const result = await proveLoadedTwoFactorCode({
    user,
    twoFactorCode: input.twoFactorCode,
  })
  if (result.status === "TWO_FACTOR_INVALID") {
    await recordCredentialFailure(limiterInput)
    return result
  }
  if (result.status !== "VERIFIED") return result

  await clearCredentialAccountFailure({
    prismaClient,
    purpose: "TWO_FACTOR",
    email: accountEmail,
    secret,
  })
  return result
}

/**
 * Revalidates an exact enabled-secret and session-version snapshot inside the
 * caller's transaction, then atomically consumes a prepared backup proof.
 */
export async function consumePreparedTwoFactorProof(
  tx: ProofTransactionClient,
  proof: PreparedTwoFactorProof,
  now: Date,
): Promise<boolean> {
  const [user, twoFactorSecret] = await Promise.all([
    tx.user.findFirst({
      where: { id: proof.userId, authSessionVersion: proof.authSessionVersion },
      select: { id: true },
    }),
    tx.twoFactorSecret.findFirst({
      where: {
        id: proof.twoFactorSecretId,
        userId: proof.userId,
        enabledAt: new Date(proof.enabledAtMs),
        updatedAt: new Date(proof.updatedAtMs),
      },
      select: { id: true },
    }),
  ])
  if (!user || !twoFactorSecret) return false
  if (proof.kind === "TOTP") return proof.backupCodeId === null
  if (!proof.backupCodeId) return false

  const consumed = await tx.backupCode.updateMany({
    where: {
      id: proof.backupCodeId,
      userId: proof.userId,
      usedAt: null,
    },
    data: { usedAt: now },
  })
  return consumed.count === 1
}
