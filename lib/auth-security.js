// @ts-check

import crypto from "node:crypto"
import { hash, verify } from "@node-rs/argon2"
import { generateSecret, generateURI, verifySync as verifyTotpSync } from "otplib"

const TOKEN_BYTES = 32
const BACKUP_CODE_BYTES = 5

/**
 * @param {unknown} email
 */
export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : ""
}

/**
 * @param {string} password
 */
export async function hashPassword(password) {
  return hash(password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  })
}

/**
 * @param {string} passwordHash
 * @param {string} password
 */
export async function verifyPassword(passwordHash, password) {
  if (!passwordHash || !password) {
    return false
  }

  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

/**
 * @param {number} [bytes]
 */
export function generateRandomToken(bytes = TOKEN_BYTES) {
  return crypto.randomBytes(bytes).toString("base64url")
}

/**
 * @param {string} token
 */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/**
 * @param {number} minutes
 */
export function tokenExpiresIn(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000)
}

/**
 * @param {{ consumedAt?: Date | null, expiresAt: Date } | null | undefined} tokenRecord
 * @param {Date} [now]
 */
export function isTokenUsable(tokenRecord, now = new Date()) {
  return Boolean(tokenRecord && !tokenRecord.consumedAt && tokenRecord.expiresAt > now)
}

/**
 * @param {string} rawKey
 * @param {string} [keyName]
 */
function encryptionKey(rawKey, keyName = "TOTP_ENCRYPTION_KEY") {
  const normalizedKey = rawKey.trim()
  if (!normalizedKey && process.env.NODE_ENV === "production") {
    throw new Error(`${keyName} is required in production.`)
  }

  return crypto.createHash("sha256").update(normalizedKey || `development-only-${keyName.toLowerCase()}`).digest()
}

/**
 * @param {string} secret
 * @param {string} [rawKey]
 * @param {string} [keyName]
 */
export function encryptSecret(secret, rawKey = process.env.TOTP_ENCRYPTION_KEY ?? "", keyName = "TOTP_ENCRYPTION_KEY") {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(rawKey, keyName), iv)
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".")
}

/**
 * @param {string} payload
 * @param {string} [rawKey]
 * @param {string} [keyName]
 */
export function decryptSecret(payload, rawKey = process.env.TOTP_ENCRYPTION_KEY ?? "", keyName = "TOTP_ENCRYPTION_KEY") {
  const [ivValue, tagValue, encryptedValue] = String(payload).split(".")

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted secret payload")
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(rawKey, keyName), Buffer.from(ivValue, "base64url"))
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

/**
 * @param {string} email
 * @param {string} [issuer]
 */
export function generateTotpSecret(email, issuer = "MassageLab") {
  const secret = generateSecret()
  return {
    secret,
    otpauthUrl: generateURI({
      issuer,
      label: email,
      secret,
    }),
  }
}

/**
 * @param {string} secret
 * @param {string} code
 */
export function verifyTotpCode(secret, code) {
  return verifyTotpSync({ secret, token: String(code).replace(/\s+/g, "") }).valid
}

/**
 * @param {number} [count]
 */
export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const value = crypto.randomBytes(BACKUP_CODE_BYTES).toString("hex").toUpperCase()
    return `${value.slice(0, 5)}-${value.slice(5)}`
  })
}

/**
 * @param {string} code
 */
export async function hashBackupCode(code) {
  return hashPassword(normalizeBackupCode(code))
}

/**
 * @param {string} codeHash
 * @param {string} code
 */
export async function verifyBackupCode(codeHash, code) {
  return verifyPassword(codeHash, normalizeBackupCode(code))
}

/**
 * @param {string} code
 */
export function normalizeBackupCode(code) {
  return String(code).replace(/[^a-z0-9]/gi, "").toUpperCase()
}
