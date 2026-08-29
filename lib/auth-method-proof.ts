import type { PrismaClient } from "@prisma/client"
import { getAuthSecret } from "@/lib/auth-env"
import {
  checkCredentialRateLimit,
  clearCredentialAccountFailures,
  recordCredentialFailure,
} from "@/lib/auth-rate-limit"
import {
  decryptSecret,
  normalizeEmail,
  verifyBackupCode,
  verifyPassword,
  verifyTotpCode,
} from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"
import { resolveNormalizedUserId } from "@/lib/normalized-user-email"

export type PasswordMethodProofResult =
  | { status: "VERIFIED"; userId: string; backupCodeConsumed: boolean; authSessionVersion: number }
  | { status: "EMAIL_UNVERIFIED" | "INVALID" | "TWO_FACTOR_REQUIRED" | "TWO_FACTOR_INVALID" | "RATE_LIMITED" }

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

type VerifyPasswordMethodProofInput = {
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
 * Owns password and optional 2FA proof for both login and account-method changes.
 * The service deliberately clears only account-scoped failure pressure on success.
 */
export async function verifyPasswordMethodProof(
  input: VerifyPasswordMethodProofInput,
): Promise<PasswordMethodProofResult> {
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
  if (!input.userId && !await credentialProofAllowed(deps, submittedLimiterInput)) {
    return { status: "RATE_LIMITED" }
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
  if (input.userId && !await credentialProofAllowed(deps, limiterInput)) {
    return { status: "RATE_LIMITED" }
  }

  const passwordIsValid = user?.passwordCredential
    ? await deps.verifyPassword(user.passwordCredential.passwordHash, input.password)
    : false
  if (!user || !passwordIsValid) {
    await deps.recordCredentialFailure({ ...limiterInput, purpose: "LOGIN" })
    return { status: "INVALID" }
  }
  if (!user.emailVerified) return { status: "EMAIL_UNVERIFIED" }

  let backupCodeConsumed = false
  if (user.twoFactorSecret?.enabledAt) {
    const code = input.twoFactorCode ?? ""
    if (!code) return { status: "TWO_FACTOR_REQUIRED" }

    let validTotp = false
    try {
      validTotp = deps.verifyTotpCode(deps.decryptSecret(user.twoFactorSecret.encryptedSecret), code)
    } catch {
      validTotp = false
    }

    if (!validTotp) {
      let validBackupCodeId: string | null = null
      for (const backupCode of user.backupCodes) {
        if (await deps.verifyBackupCode(backupCode.codeHash, code)) {
          validBackupCodeId = backupCode.id
          break
        }
      }
      if (validBackupCodeId) {
        const consumed = await prismaClient.backupCode.updateMany({
          where: { id: validBackupCodeId, usedAt: null },
          data: { usedAt: now },
        })
        backupCodeConsumed = consumed.count === 1
      }
      if (!backupCodeConsumed) {
        await deps.recordCredentialFailure({ ...limiterInput, purpose: "TWO_FACTOR" })
        return { status: "TWO_FACTOR_INVALID" }
      }
    }
  }

  await deps.clearCredentialAccountFailures({ prismaClient, email: accountEmail, secret })
  return {
    status: "VERIFIED",
    userId: user.id,
    backupCodeConsumed,
    authSessionVersion: user.authSessionVersion,
  }
}

async function credentialProofAllowed(
  deps: ProofDependencies,
  input: Omit<Parameters<typeof checkCredentialRateLimit>[0], "purpose">,
) {
  for (const purpose of ["LOGIN", "TWO_FACTOR"] as const) {
    const decision = await deps.checkCredentialRateLimit({ ...input, purpose })
    if (!decision.allowed) return false
  }
  return true
}
