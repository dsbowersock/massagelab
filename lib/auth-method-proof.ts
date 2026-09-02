import type { PrismaClient } from "@prisma/client"
import { getAuthSecret } from "@/lib/auth-env"
import {
  checkCredentialRateLimit,
  clearCredentialAccountFailures,
  recordCredentialFailure,
  type AuthRateLimitDecision,
} from "@/lib/auth-rate-limit"
import {
  decryptSecret,
  normalizeEmail,
  verifyBackupCode,
  verifyPassword,
  verifyTotpCode,
} from "@/lib/auth-security"
import {
  proveLoadedTwoFactorCode,
  type PreparedTwoFactorProof,
} from "@/lib/auth-two-factor-proof"
import { prisma } from "@/lib/prisma"
import { resolveNormalizedUserId } from "@/lib/normalized-user-email"

type PasswordMethodProofFailure =
  | { status: "EMAIL_UNVERIFIED" | "INVALID" | "TWO_FACTOR_REQUIRED" | "TWO_FACTOR_INVALID" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }

export type PasswordMethodProofResult =
  | { status: "VERIFIED"; userId: string; backupCodeConsumed: boolean; authSessionVersion: number }
  | PasswordMethodProofFailure

export type PreparedPasswordMethodProofResult =
  | {
      status: "VERIFIED"
      userId: string
      authSessionVersion: number
      preparedTwoFactorProof: PreparedTwoFactorProof
    }
  | PasswordMethodProofFailure

type ProofDependencies = {
  checkCredentialRateLimit: typeof checkCredentialRateLimit
  recordCredentialFailure: typeof recordCredentialFailure
  clearCredentialAccountFailures: typeof clearCredentialAccountFailures
  verifyPassword: typeof verifyPassword
  decryptSecret: typeof decryptSecret
  verifyTotpCode: typeof verifyTotpCode
  verifyBackupCode: typeof verifyBackupCode
  normalizeEmail: typeof normalizeEmail
  resolveNormalizedUserId: typeof resolveNormalizedUserId
}

type ProofPrismaClient = Pick<PrismaClient, "user" | "backupCode" | "authRateLimitBucket" | "$transaction" | "$queryRaw">

// A committed public hash keeps absent-account proof on the same Argon2id cost
// path as a real password without granting any account access.
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$bUFBRG4hL2WSNUbHiLUYsw$6jTrIgK0H7DXwGxU4KepF7eqc/UO/psuEFRjzbcr4Ps"

export type VerifyPasswordMethodProofInput = {
  prismaClient?: ProofPrismaClient
  userId?: string
  email?: string
  password: string
  twoFactorCode?: string
  networkIdentifier: string
  secret?: string
  now?: Date
  dependencies?: Partial<ProofDependencies>
}

export type PreparePasswordMethodProofForTwoFactorManagementInput =
  Omit<VerifyPasswordMethodProofInput, "twoFactorCode"> & { twoFactorCode: string }

type InternalPasswordMethodProofInput = VerifyPasswordMethodProofInput & {
  backupCodeConsumption: "IMMEDIATE" | "DEFERRED"
}

type InternalPasswordMethodProofResult =
  | PasswordMethodProofResult
  | {
      status: "VERIFIED"
      userId: string
      backupCodeConsumed: false
      authSessionVersion: number
      preparedTwoFactorProof: PreparedTwoFactorProof
    }

const defaultDependencies: ProofDependencies = {
  checkCredentialRateLimit,
  recordCredentialFailure,
  clearCredentialAccountFailures,
  verifyPassword,
  decryptSecret,
  verifyTotpCode,
  verifyBackupCode,
  normalizeEmail,
  resolveNormalizedUserId,
}

/**
 * Verifies password and optional 2FA for login/account-method callers. Backup
 * codes are always consumed immediately; deferred capability is not exposed.
 */
export async function verifyPasswordMethodProof(
  input: VerifyPasswordMethodProofInput,
): Promise<PasswordMethodProofResult> {
  const result = await verifyPasswordMethodProofInternal({
    ...input,
    backupCodeConsumption: "IMMEDIATE",
  })
  if (result.status !== "VERIFIED") return result
  return {
    status: "VERIFIED",
    userId: result.userId,
    backupCodeConsumed: result.backupCodeConsumed,
    authSessionVersion: result.authSessionVersion,
  }
}

/**
 * Verifies password plus an enabled current factor without consuming its backup
 * code, returning a required prepared proof for the management transaction.
 */
export async function preparePasswordMethodProofForTwoFactorManagement(
  input: PreparePasswordMethodProofForTwoFactorManagementInput,
): Promise<PreparedPasswordMethodProofResult> {
  const result = await verifyPasswordMethodProofInternal({
    ...input,
    backupCodeConsumption: "DEFERRED",
  })
  if (result.status !== "VERIFIED") return result
  if (!("preparedTwoFactorProof" in result)) return { status: "TWO_FACTOR_REQUIRED" }
  return {
    status: "VERIFIED",
    userId: result.userId,
    authSessionVersion: result.authSessionVersion,
    preparedTwoFactorProof: result.preparedTwoFactorProof,
  }
}

async function verifyPasswordMethodProofInternal(
  input: InternalPasswordMethodProofInput,
): Promise<InternalPasswordMethodProofResult> {
  const deps = { ...defaultDependencies, ...input.dependencies }
  const prismaClient = input.prismaClient ?? prisma
  const now = input.now ?? new Date()
  const secret = input.secret ?? getAuthSecret()
  const submittedEmail = deps.normalizeEmail(input.email)
  const submittedLimiterInput = {
    prismaClient,
    email: submittedEmail,
    networkIdentifier: input.networkIdentifier,
    secret,
    now,
  }
  const submittedDecision = !input.userId
    ? await credentialProofDecision(deps, submittedLimiterInput)
    : { allowed: true } as const
  if (!submittedDecision.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: submittedDecision.retryAfterSeconds }
  }
  const resolvedUserId = input.userId ?? await deps.resolveNormalizedUserId({
    prismaClient,
    email: submittedEmail,
  })
  const user = resolvedUserId
    ? await prismaClient.user.findUnique({
      where: { id: resolvedUserId },
      include: {
        passwordCredential: true,
        twoFactorSecret: true,
        backupCodes: { where: { usedAt: null }, orderBy: { createdAt: "asc" } },
      },
    })
    : null
  const accountEmail = deps.normalizeEmail(user?.email ?? submittedEmail)
  const limiterInput = {
    prismaClient,
    email: accountEmail,
    networkIdentifier: input.networkIdentifier,
    secret,
    now,
  }
  const accountDecision = input.userId
    ? await credentialProofDecision(deps, limiterInput)
    : { allowed: true } as const
  if (!accountDecision.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: accountDecision.retryAfterSeconds }
  }

  const passwordMatches = await deps.verifyPassword(
    user?.passwordCredential?.passwordHash ?? DUMMY_PASSWORD_HASH,
    input.password,
  )
  const passwordIsValid = Boolean(user?.passwordCredential && passwordMatches)
  if (!user || !passwordIsValid) {
    await deps.recordCredentialFailure({ ...limiterInput, purpose: "LOGIN" })
    return { status: "INVALID" }
  }
  if (!user.emailVerified) return { status: "EMAIL_UNVERIFIED" }
  if (input.backupCodeConsumption === "DEFERRED" && !user.twoFactorSecret?.enabledAt) {
    return { status: "TWO_FACTOR_REQUIRED" }
  }

  let backupCodeConsumed = false
  let preparedTwoFactorProof: PreparedTwoFactorProof | undefined
  if (user.twoFactorSecret?.enabledAt) {
    const factorResult = await proveLoadedTwoFactorCode({
      user,
      twoFactorCode: input.twoFactorCode ?? "",
      dependencies: {
        decryptSecret: deps.decryptSecret,
        verifyTotpCode: deps.verifyTotpCode,
        verifyBackupCode: deps.verifyBackupCode,
      },
    })
    if (factorResult.status !== "VERIFIED") {
      if (factorResult.status === "TWO_FACTOR_INVALID") {
        await deps.recordCredentialFailure({ ...limiterInput, purpose: "TWO_FACTOR" })
      }
      if (factorResult.status === "TWO_FACTOR_REQUIRED") return { status: "TWO_FACTOR_REQUIRED" }
      return { status: "TWO_FACTOR_INVALID" }
    }

    preparedTwoFactorProof = factorResult.proof
    if (preparedTwoFactorProof.kind === "BACKUP_CODE" && input.backupCodeConsumption !== "DEFERRED") {
      const consumed = await prismaClient.backupCode.updateMany({
        where: {
          id: preparedTwoFactorProof.backupCodeId ?? "",
          userId: user.id,
          usedAt: null,
        },
        data: { usedAt: now },
      })
      backupCodeConsumed = consumed.count === 1
      if (!backupCodeConsumed) {
        await deps.recordCredentialFailure({ ...limiterInput, purpose: "TWO_FACTOR" })
        return { status: "TWO_FACTOR_INVALID" }
      }
    }
  }

  await deps.clearCredentialAccountFailures({ prismaClient, email: accountEmail, secret })
  const verified = {
    status: "VERIFIED",
    userId: user.id,
    backupCodeConsumed,
    authSessionVersion: user.authSessionVersion,
  } as const
  return input.backupCodeConsumption === "DEFERRED" && preparedTwoFactorProof
    ? { ...verified, preparedTwoFactorProof }
    : verified
}

/**
 * Denies credential proof when either the LOGIN or TWO_FACTOR limiter is
 * blocked, returning the longest retry delay among the blocked decisions.
 */
async function credentialProofDecision(
  deps: ProofDependencies,
  input: Omit<Parameters<typeof checkCredentialRateLimit>[0], "purpose">,
): Promise<AuthRateLimitDecision> {
  let allowed = true
  let retryAfterSeconds = 0
  for (const purpose of ["LOGIN", "TWO_FACTOR"] as const) {
    const decision = await deps.checkCredentialRateLimit({ ...input, purpose })
    if (!decision.allowed) {
      allowed = false
      retryAfterSeconds = Math.max(retryAfterSeconds, decision.retryAfterSeconds)
    }
  }
  return allowed ? { allowed: true } : { allowed: false, retryAfterSeconds }
}
