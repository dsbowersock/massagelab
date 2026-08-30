import { createHmac, timingSafeEqual } from "node:crypto"

const BINDING_DOMAIN = "two-factor-enrollment-binding"
const ROW_FINGERPRINT_DOMAIN = "two-factor-enrollment-row-fingerprint"
const BINDING_LIFETIME_MS = 5 * 60 * 1000
const MAX_ENCODED_BINDING_LENGTH = 2048
const MAX_IDENTIFIER_LENGTH = 191

export const TWO_FACTOR_ENROLLMENT_COOKIE = "ml-two-factor-enrollment"

export type TwoFactorEnrollmentBinding = {
  version: 1
  userId: string
  authSessionVersion: number
  twoFactorSecretId: string
  secretRowFingerprint: string
  updatedAtMs: number
  issuedAtMs: number
  expiresAtMs: number
}

type EnrollmentRowSnapshot = {
  authSecret: string
  userId: string
  authSessionVersion: number
  twoFactorSecretId: string
  encryptedSecret: string
  updatedAt: Date
}

type SignEnrollmentBindingInput = EnrollmentRowSnapshot & {
  now?: Date
}

type VerifyEnrollmentBindingInput = EnrollmentRowSnapshot & {
  value: string
  now?: Date
}

/**
 * Signs a five-minute, canonical enrollment snapshot. The cookie value carries
 * only a domain-separated fingerprint of the encrypted database value, never
 * the encrypted or decrypted TOTP secret itself.
 */
export function signTwoFactorEnrollmentBinding(input: SignEnrollmentBindingInput): string {
  const issuedAtMs = dateMilliseconds(input.now ?? new Date())
  const updatedAtMs = dateMilliseconds(input.updatedAt)
  if (updatedAtMs === null || !validRowSnapshot(input, updatedAtMs) || issuedAtMs === null) {
    throw new Error("Invalid two-factor enrollment binding input.")
  }

  const binding: TwoFactorEnrollmentBinding = {
    version: 1,
    userId: input.userId,
    authSessionVersion: input.authSessionVersion,
    twoFactorSecretId: input.twoFactorSecretId,
    secretRowFingerprint: fingerprintSecretRow(input, updatedAtMs),
    updatedAtMs,
    issuedAtMs,
    expiresAtMs: issuedAtMs + BINDING_LIFETIME_MS,
  }
  if (!Number.isSafeInteger(binding.expiresAtMs)) {
    throw new Error("Invalid two-factor enrollment binding input.")
  }

  const payloadSegment = Buffer.from(canonicalBindingJson(binding), "utf8").toString("base64url")
  const signatureSegment = signPayload(payloadSegment, input.authSecret).toString("base64url")
  const value = `${payloadSegment}.${signatureSegment}`
  if (value.length > MAX_ENCODED_BINDING_LENGTH) {
    throw new Error("Invalid two-factor enrollment binding input.")
  }
  return value
}

/**
 * Verifies signature, canonical encoding, time bounds, identity, session
 * version, and the exact encrypted-secret row snapshot in constant time where
 * secret-derived digests are compared.
 */
export function verifyTwoFactorEnrollmentBinding(
  input: VerifyEnrollmentBindingInput,
): TwoFactorEnrollmentBinding | null {
  const nowMs = dateMilliseconds(input.now ?? new Date())
  const updatedAtMs = dateMilliseconds(input.updatedAt)
  if (updatedAtMs === null || !validRowSnapshot(input, updatedAtMs) || nowMs === null) return null
  if (typeof input.value !== "string" || input.value.length === 0 || input.value.length > MAX_ENCODED_BINDING_LENGTH) {
    return null
  }

  const segments = input.value.split(".")
  if (segments.length !== 2) return null
  const [payloadSegment, signatureSegment] = segments
  const payloadBytes = decodeCanonicalBase64Url(payloadSegment)
  const suppliedSignature = decodeCanonicalBase64Url(signatureSegment)
  if (!payloadBytes || !suppliedSignature || suppliedSignature.length !== 32) return null

  const expectedSignature = signPayload(payloadSegment, input.authSecret)
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) return null

  let serializedPayload: string
  let parsed: unknown
  try {
    serializedPayload = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes)
    parsed = JSON.parse(serializedPayload)
  } catch {
    return null
  }
  if (!isValidBinding(parsed)) return null
  if (canonicalBindingJson(parsed) !== serializedPayload) return null

  if (
    parsed.userId !== input.userId
    || parsed.authSessionVersion !== input.authSessionVersion
    || parsed.twoFactorSecretId !== input.twoFactorSecretId
    || parsed.updatedAtMs !== updatedAtMs
  ) {
    return null
  }

  const expectedFingerprint = fingerprintSecretRow(input, updatedAtMs)
  if (!safeDigestTextEqual(parsed.secretRowFingerprint, expectedFingerprint)) return null

  const lifetime = parsed.expiresAtMs - parsed.issuedAtMs
  const age = nowMs - parsed.issuedAtMs
  if (
    lifetime <= 0
    || lifetime > BINDING_LIFETIME_MS
    || age < 0
    || age > BINDING_LIFETIME_MS
    || nowMs >= parsed.expiresAtMs
  ) {
    return null
  }

  return parsed
}

function fingerprintSecretRow(input: EnrollmentRowSnapshot, updatedAtMs: number): string {
  const canonicalRow = JSON.stringify({
    twoFactorSecretId: input.twoFactorSecretId,
    userId: input.userId,
    updatedAtMs,
    encryptedSecret: input.encryptedSecret,
  })
  return createHmac("sha256", input.authSecret)
    .update(`${ROW_FINGERPRINT_DOMAIN}\0${canonicalRow}`)
    .digest("base64url")
}

function signPayload(payloadSegment: string, authSecret: string): Buffer {
  return createHmac("sha256", authSecret)
    .update(`${BINDING_DOMAIN}\0${payloadSegment}`)
    .digest()
}

function canonicalBindingJson(binding: TwoFactorEnrollmentBinding): string {
  return JSON.stringify({
    version: binding.version,
    userId: binding.userId,
    authSessionVersion: binding.authSessionVersion,
    twoFactorSecretId: binding.twoFactorSecretId,
    secretRowFingerprint: binding.secretRowFingerprint,
    updatedAtMs: binding.updatedAtMs,
    issuedAtMs: binding.issuedAtMs,
    expiresAtMs: binding.expiresAtMs,
  })
}

function isValidBinding(value: unknown): value is TwoFactorEnrollmentBinding {
  if (!isRecord(value)) return false
  const exactKeys = [
    "version",
    "userId",
    "authSessionVersion",
    "twoFactorSecretId",
    "secretRowFingerprint",
    "updatedAtMs",
    "issuedAtMs",
    "expiresAtMs",
  ]
  if (Object.keys(value).length !== exactKeys.length || exactKeys.some((key) => !Object.hasOwn(value, key))) {
    return false
  }

  return value.version === 1
    && validIdentifier(value.userId)
    && validNonnegativeInteger(value.authSessionVersion)
    && validIdentifier(value.twoFactorSecretId)
    && typeof value.secretRowFingerprint === "string"
    && decodeCanonicalBase64Url(value.secretRowFingerprint)?.length === 32
    && validNonnegativeInteger(value.updatedAtMs)
    && validNonnegativeInteger(value.issuedAtMs)
    && validNonnegativeInteger(value.expiresAtMs)
}

function validRowSnapshot(input: EnrollmentRowSnapshot, updatedAtMs: number): boolean {
  return validAuthSecret(input.authSecret)
    && validIdentifier(input.userId)
    && validNonnegativeInteger(input.authSessionVersion)
    && validIdentifier(input.twoFactorSecretId)
    && typeof input.encryptedSecret === "string"
    && input.encryptedSecret.length > 0
    && validNonnegativeInteger(updatedAtMs)
}

function validAuthSecret(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH
}

function validNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function dateMilliseconds(value: unknown): number | null {
  if (!(value instanceof Date)) return null
  const milliseconds = value.getTime()
  return validNonnegativeInteger(milliseconds) ? milliseconds : null
}

function decodeCanonicalBase64Url(value: unknown): Buffer | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const decoded = Buffer.from(value, "base64url")
    return decoded.toString("base64url") === value ? decoded : null
  } catch {
    return null
  }
}

function safeDigestTextEqual(left: string, right: string): boolean {
  const leftBytes = decodeCanonicalBase64Url(left)
  const rightBytes = decodeCanonicalBase64Url(right)
  return Boolean(
    leftBytes
    && rightBytes
    && leftBytes.length === rightBytes.length
    && timingSafeEqual(leftBytes, rightBytes),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
