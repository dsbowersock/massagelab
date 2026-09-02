import { createHmac, timingSafeEqual } from "node:crypto"
import type { PrismaClient } from "@prisma/client"

import { getAuthSecret } from "./auth-env.ts"
import { consumeFreshGoogleReauth, isFreshConsumedGoogleReauth } from "./auth-method-intent-proof.ts"
import { hashPassword, normalizeEmail } from "./auth-security.js"
import { runCommerceTransaction } from "./commerce/transactions.ts"
import { prisma } from "./prisma.ts"
import { queueAccountSecurityEmail } from "./account-security-email-intents.ts"

const FRESH_PROOF_MS = 5 * 60 * 1000

export type AuthMethodMutationRejectionCode =
  | "INVALID_PROOF"
  | "RATE_LIMITED"
  | "TWO_FACTOR_REQUIRED"
  | "TWO_FACTOR_INVALID"
  | "INTENT_EXPIRED"
  | "LAST_METHOD"
  | "ALREADY_LINKED"
  | "CONFLICT"

export type AuthMethodMutationResult =
  | { status: "UPDATED"; emailIntentId: string; googleLinked: boolean; passwordEnabled: boolean }
  | { status: "REJECTED"; code: Exclude<AuthMethodMutationRejectionCode, "RATE_LIMITED"> }
  | { status: "REJECTED"; code: "RATE_LIMITED"; retryAfterSeconds: number }

type MethodClient = Pick<PrismaClient, "$transaction" | "$queryRaw" | "user" | "backupCode" | "authRateLimitBucket">
type ProofFunction = typeof import("./auth-method-proof.ts").verifyPasswordMethodProof

type DirectProofInput = {
  prismaClient?: MethodClient
  userId: string
  password: string
  twoFactorCode?: string
  networkIdentifier: string
  confirmed: boolean
  now?: Date
  verifyPasswordMethodProofFn?: ProofFunction
}

/** Links the exact proven Google identity after a fresh Credentials-session confirmation. */
export async function confirmGoogleLink(input: {
  prismaClient?: MethodClient
  intentId: string
  sessionUserId: string
  lastPasswordAuthenticatedAt?: number
  confirmed: boolean
  secret?: string
  now?: Date
}): Promise<AuthMethodMutationResult> {
  const now = captureNow(input.now)
  if (!now || input.confirmed !== true || !freshEpochClaim(input.lastPasswordAuthenticatedAt, now)) return rejected("INVALID_PROOF")
  const client = input.prismaClient ?? prisma
  const secret = input.secret ?? getAuthSecret()
  if (!validIdentifier(input.intentId) || !validIdentifier(input.sessionUserId) || !secret) return rejected("INVALID_PROOF")

  return safelyMutate(client, async (tx) => {
    const intent = await tx.authMethodIntent.findUnique({ where: { id: input.intentId } })
    if (intent && intent.targetUserId !== input.sessionUserId) return rejected("INVALID_PROOF")
    if (!isMatchingLinkIntent(intent, input.sessionUserId, now)) return rejected("INTENT_EXPIRED")
    const user = await loadMethodUser(tx, input.sessionUserId)
    if (!user?.email) return rejected("INVALID_PROOF")
    const normalizedEmail = normalizeEmail(user.email)
    if (!normalizedEmail || !safeHashEqual(intent.providerEmailHash, verifiedGoogleEmailHash(normalizedEmail, secret))) {
      return rejected("INVALID_PROOF")
    }
    const providerOwner = await tx.account.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: intent.providerAccountId } },
    })
    if (providerOwner) return rejected(providerOwner.userId === user.id ? "ALREADY_LINKED" : "CONFLICT")

    const consumed = await tx.authMethodIntent.updateMany({
      where: {
        id: intent.id,
        targetUserId: user.id,
        purpose: "SIGN_IN_OR_LINK",
        status: "PROVIDER_PROVEN",
        provider: "google",
        providerAccountId: intent.providerAccountId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { status: "CONSUMED", consumedAt: now },
    })
    if (consumed.count !== 1) return rejected("INTENT_EXPIRED")
    await tx.account.create({
      data: { userId: user.id, type: "oauth", provider: "google", providerAccountId: intent.providerAccountId },
    })
    const emailIntent = await queueAccountSecurityEmail(tx, {
      userId: user.id,
      kind: "GOOGLE_LINKED",
      recipientEmail: normalizedEmail,
      idempotencyKey: `google-linked:${user.id}:${intent.id}`,
    })
    return updated(emailIntent.id, true, Boolean(user.passwordCredential))
  })
}

/** Adds a Google-reauthenticated password method or changes one after direct proof. */
export async function setPasswordMethod(input: {
  prismaClient?: MethodClient
  userId: string
  googleReauthPreflight?: { intentId: string; targetUserId: string | null }
  mode: "ADD" | "CHANGE"
  currentPassword?: string
  newPassword: string
  twoFactorCode?: string
  networkIdentifier?: string
  confirmed: boolean
  now?: Date
  verifyPasswordMethodProofFn?: ProofFunction
  hashPasswordFn?: (password: string) => Promise<string>
}): Promise<AuthMethodMutationResult> {
  const now = captureNow(input.now)
  if (!now || input.confirmed !== true || !validIdentifier(input.userId) || !validNewPassword(input.newPassword)) return rejected("INVALID_PROOF")
  const client = input.prismaClient ?? prisma
  let provedVersion: number | null = null
  if (input.mode === "CHANGE") {
    const proof = await directProof({
      ...input,
      prismaClient: client,
      password: input.currentPassword ?? "",
      networkIdentifier: input.networkIdentifier ?? "",
      verifyPasswordMethodProofFn: input.verifyPasswordMethodProofFn,
      now,
    })
    if (proof.status === "REJECTED") return proof
    provedVersion = proof.authSessionVersion
  } else if (
    input.mode !== "ADD"
    || !validIdentifier(input.googleReauthPreflight?.intentId ?? "")
    || input.googleReauthPreflight?.targetUserId !== input.userId
  ) {
    return rejected("INVALID_PROOF")
  }

  let newPasswordHash: string
  try {
    newPasswordHash = await (input.hashPasswordFn ?? hashPassword)(input.newPassword)
  } catch {
    return rejected("CONFLICT")
  }
  if (!validHash(newPasswordHash)) return rejected("CONFLICT")

  return safelyMutate(client, async (tx) => {
    const user = await loadMethodUser(tx, input.userId)
    if (!user?.email) return rejected("CONFLICT")
    if (provedVersion !== null && user.authSessionVersion !== provedVersion) return rejected("CONFLICT")
    if (input.mode === "ADD" && user.passwordCredential) return rejected("ALREADY_LINKED")
    if (input.mode === "CHANGE" && !user.passwordCredential) return rejected("INVALID_PROOF")

    let consumedIntentId: string | null = null
    if (input.mode === "ADD") {
      const intent = await tx.authMethodIntent.findUnique({ where: { id: input.googleReauthPreflight?.intentId } })
      if (!isFreshConsumedGoogleReauth(intent, "ADD_PASSWORD", user.id, now)) return rejected("INTENT_EXPIRED")
      if (!user.accounts.some((account: { provider: string; providerAccountId: string }) => account.provider === "google" && account.providerAccountId === intent.providerAccountId)) {
        return rejected("CONFLICT")
      }
      if (!await consumeFreshGoogleReauth(tx, intent, "ADD_PASSWORD", user.id, now)) return rejected("INTENT_EXPIRED")
      consumedIntentId = intent.id
      await tx.passwordCredential.create({ data: { userId: user.id, passwordHash: newPasswordHash } })
    } else {
      await tx.passwordCredential.update({ where: { userId: user.id }, data: { passwordHash: newPasswordHash } })
      await incrementSessionVersion(tx, user.id)
    }

    const kind = input.mode === "ADD" ? "PASSWORD_ENABLED" : "PASSWORD_CHANGED"
    const idempotencyOwner = consumedIntentId ?? String(provedVersion)
    const emailIntent = await queueAccountSecurityEmail(tx, {
      userId: user.id,
      kind,
      recipientEmail: normalizeEmail(user.email),
      idempotencyKey: `${kind.toLowerCase().replaceAll("_", "-")}:${user.id}:${idempotencyOwner}`,
    })
    return updated(emailIntent.id, user.accounts.some((account: { provider: string }) => account.provider === "google"), true)
  })
}

/**
 * Removes every Google account only after password/2FA proof outside the
 * transaction. A delete-count mismatch rejects before session state changes.
 */
export async function removeGoogleMethod(input: DirectProofInput): Promise<AuthMethodMutationResult> {
  const now = captureNow(input.now)
  if (!now || input.confirmed !== true || !validIdentifier(input.userId)) return rejected("INVALID_PROOF")
  const client = input.prismaClient ?? prisma
  const proof = await directProof({ ...input, prismaClient: client, now })
  if (proof.status === "REJECTED") return proof

  return safelyMutate(client, async (tx) => {
    const user = await loadMethodUser(tx, input.userId)
    if (!user?.email || user.authSessionVersion !== proof.authSessionVersion) return rejected("CONFLICT")
    const googleAccountCount = user.accounts.filter((account: { provider: string }) => account.provider === "google").length
    if (googleAccountCount === 0) return rejected("CONFLICT")
    if (!user.passwordCredential) return rejected("LAST_METHOD")
    const removed = await tx.account.deleteMany({ where: { userId: user.id, provider: "google" } })
    if (removed.count !== googleAccountCount) return rejected("CONFLICT")
    await incrementSessionVersion(tx, user.id)
    const emailIntent = await queueAccountSecurityEmail(tx, {
      userId: user.id,
      kind: "GOOGLE_UNLINKED",
      recipientEmail: normalizeEmail(user.email),
      idempotencyKey: `google-unlinked:${user.id}:${proof.authSessionVersion}`,
    })
    return updated(emailIntent.id, false, true)
  })
}

/** Removes password only after consuming the exact fresh Google reauthentication. */
export async function removePasswordMethod(input: {
  prismaClient?: MethodClient
  userId: string
  intentId: string
  confirmed: boolean
  now?: Date
}): Promise<AuthMethodMutationResult> {
  const now = captureNow(input.now)
  if (!now || input.confirmed !== true || !validIdentifier(input.userId) || !validIdentifier(input.intentId)) return rejected("INVALID_PROOF")
  const client = input.prismaClient ?? prisma

  return safelyMutate(client, async (tx) => {
    const [user, intent] = await Promise.all([
      loadMethodUser(tx, input.userId),
      tx.authMethodIntent.findUnique({ where: { id: input.intentId } }),
    ])
    if (!user?.email) return rejected("CONFLICT")
    if (!isFreshConsumedGoogleReauth(intent, "REMOVE_PASSWORD", user.id, now)) return rejected("INTENT_EXPIRED")
    if (!user.passwordCredential) return rejected("INTENT_EXPIRED")
    const googleAccount = user.accounts.find((account: { provider: string; providerAccountId: string }) => account.provider === "google" && account.providerAccountId === intent.providerAccountId)
    if (!googleAccount) return rejected(user.accounts.some((account: { provider: string }) => account.provider === "google") ? "CONFLICT" : "LAST_METHOD")
    if (!await consumeFreshGoogleReauth(tx, intent, "REMOVE_PASSWORD", user.id, now)) return rejected("INTENT_EXPIRED")
    const removed = await tx.passwordCredential.deleteMany({ where: { userId: user.id } })
    if (removed.count !== 1) return rejected("CONFLICT")
    await incrementSessionVersion(tx, user.id)
    const emailIntent = await queueAccountSecurityEmail(tx, {
      userId: user.id,
      kind: "PASSWORD_DISABLED",
      recipientEmail: normalizeEmail(user.email),
      idempotencyKey: `password-disabled:${user.id}:${intent.id}`,
    })
    return updated(emailIntent.id, true, false)
  })
}

async function directProof(input: DirectProofInput & { prismaClient: MethodClient; now: Date }): Promise<
  { status: "VERIFIED"; authSessionVersion: number } | Extract<AuthMethodMutationResult, { status: "REJECTED" }>
> {
  if (!input.password || !input.networkIdentifier) return proofRejected("INVALID_PROOF")
  try {
    const proofService = input.verifyPasswordMethodProofFn ?? (await import("./auth-method-proof.ts")).verifyPasswordMethodProof
    const result = await proofService({
      prismaClient: input.prismaClient,
      userId: input.userId,
      password: input.password,
      twoFactorCode: input.twoFactorCode,
      networkIdentifier: input.networkIdentifier,
      now: input.now,
    })
    if (result.status === "VERIFIED") return { status: "VERIFIED", authSessionVersion: result.authSessionVersion }
    if (result.status === "RATE_LIMITED") return rateLimited(result.retryAfterSeconds)
    if (result.status === "TWO_FACTOR_REQUIRED") return proofRejected("TWO_FACTOR_REQUIRED")
    if (result.status === "TWO_FACTOR_INVALID") return proofRejected("TWO_FACTOR_INVALID")
    return proofRejected("INVALID_PROOF")
  } catch {
    return proofRejected("CONFLICT")
  }
}

async function safelyMutate(client: MethodClient, mutation: (tx: any) => Promise<AuthMethodMutationResult>): Promise<AuthMethodMutationResult> {
  try {
    return await runCommerceTransaction(client, mutation)
  } catch {
    return rejected("CONFLICT")
  }
}

async function loadMethodUser(tx: any, userId: string) {
  return tx.user.findUnique({
    where: { id: userId },
    include: { accounts: true, passwordCredential: true, twoFactorSecret: true },
  })
}

function isMatchingLinkIntent(intent: any, userId: string, now: Date): boolean {
  return Boolean(intent
    && intent.targetUserId === userId
    && intent.purpose === "SIGN_IN_OR_LINK"
    && intent.status === "PROVIDER_PROVEN"
    && intent.provider === "google"
    && validIdentifier(intent.providerAccountId)
    && typeof intent.providerEmailHash === "string"
    && intent.consumedAt === null
    && intent.expiresAt instanceof Date
    && intent.expiresAt > now)
}

async function incrementSessionVersion(tx: any, userId: string): Promise<void> {
  await tx.user.update({ where: { id: userId }, data: { authSessionVersion: { increment: 1 } } })
}

function verifiedGoogleEmailHash(email: string, secret: string): string {
  return createHmac("sha256", secret).update(`verified-google-email\0${email}`).digest("hex")
}

function safeHashEqual(left: unknown, right: string): boolean {
  if (typeof left !== "string") return false
  const leftBytes = Buffer.from(left, "hex")
  const rightBytes = Buffer.from(right, "hex")
  return leftBytes.length === rightBytes.length && leftBytes.length > 0 && timingSafeEqual(leftBytes, rightBytes)
}

function freshEpochClaim(value: unknown, now: Date): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false
  const age = now.getTime() - value
  return age >= 0 && age <= FRESH_PROOF_MS
}

function captureNow(value?: Date): Date | null {
  const date = value === undefined ? new Date() : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 191
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512
}

function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 1024
}

function rejected(code: Exclude<AuthMethodMutationRejectionCode, "RATE_LIMITED">): AuthMethodMutationResult {
  return { status: "REJECTED", code }
}

function proofRejected(code: Exclude<AuthMethodMutationRejectionCode, "RATE_LIMITED">): Extract<AuthMethodMutationResult, { status: "REJECTED" }> {
  return { status: "REJECTED", code }
}

function rateLimited(retryAfterSeconds: number): Extract<AuthMethodMutationResult, { code: "RATE_LIMITED" }> {
  const boundedRetryAfter = Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
    ? Math.min(retryAfterSeconds, 900)
    : 1
  return { status: "REJECTED", code: "RATE_LIMITED", retryAfterSeconds: boundedRetryAfter }
}

function updated(emailIntentId: string, googleLinked: boolean, passwordEnabled: boolean): AuthMethodMutationResult {
  return { status: "UPDATED", emailIntentId, googleLinked, passwordEnabled }
}
