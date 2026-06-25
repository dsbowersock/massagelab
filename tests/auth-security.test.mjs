import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { generateSync } from "otplib"
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateRandomToken,
  generateTotpSecret,
  hashBackupCode,
  hashPassword,
  hashToken,
  isTokenUsable,
  normalizeBackupCode,
  normalizeEmail,
  tokenExpiresIn,
  verifyBackupCode,
  verifyPassword,
  verifyTotpCode,
} from "../lib/auth-security.js"

describe("Auth security helpers", () => {
  it("normalizes emails before auth lookups", () => {
    assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com")
  })

  it("hashes and verifies passwords with Argon2id", async () => {
    const passwordHash = await hashPassword("correct horse battery staple")

    assert.equal(await verifyPassword(passwordHash, "correct horse battery staple"), true)
    assert.equal(await verifyPassword(passwordHash, "wrong password"), false)
  })

  it("hashes random tokens for single-use email flows", () => {
    const token = generateRandomToken()
    assert.notEqual(token, generateRandomToken())
    assert.equal(hashToken(token), hashToken(token))
    assert.notEqual(hashToken(token), token)
  })

  it("checks token expiry and consumed state", () => {
    assert.equal(isTokenUsable({ expiresAt: tokenExpiresIn(5), consumedAt: null }), true)
    assert.equal(isTokenUsable({ expiresAt: tokenExpiresIn(-5), consumedAt: null }), false)
    assert.equal(isTokenUsable({ expiresAt: tokenExpiresIn(5), consumedAt: new Date() }), false)
  })

  it("encrypts TOTP secrets and validates authenticator codes", () => {
    const setup = generateTotpSecret("user@example.com")
    const encrypted = encryptSecret(setup.secret, "test-key")
    const decrypted = decryptSecret(encrypted, "test-key")
    const code = generateSync({ secret: setup.secret })

    assert.notEqual(encrypted, setup.secret)
    assert.equal(decrypted, setup.secret)
    assert.equal(verifyTotpCode(decrypted, code), true)
    assert.equal(verifyTotpCode(decrypted, "000000"), false)
  })

  it("requires an explicit TOTP encryption key in production", () => {
    const previousNodeEnv = process.env.NODE_ENV
    const previousTotpKey = process.env.TOTP_ENCRYPTION_KEY

    try {
      process.env.NODE_ENV = "production"
      delete process.env.TOTP_ENCRYPTION_KEY

      assert.throws(() => encryptSecret("secret"), /TOTP_ENCRYPTION_KEY/)
      assert.throws(() => decryptSecret("iv.tag.payload"), /TOTP_ENCRYPTION_KEY/)
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = previousNodeEnv
      }

      if (previousTotpKey === undefined) {
        delete process.env.TOTP_ENCRYPTION_KEY
      } else {
        process.env.TOTP_ENCRYPTION_KEY = previousTotpKey
      }
    }
  })

  it("names custom encryption keys in production errors", () => {
    const previousNodeEnv = process.env.NODE_ENV

    try {
      process.env.NODE_ENV = "production"

      assert.throws(() => encryptSecret("secret", "", "CALENDAR_SYNC_ENCRYPTION_KEY"), /CALENDAR_SYNC_ENCRYPTION_KEY/)
      assert.throws(() => decryptSecret("iv.tag.payload", "", "CALENDAR_SYNC_ENCRYPTION_KEY"), /CALENDAR_SYNC_ENCRYPTION_KEY/)
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = previousNodeEnv
      }
    }
  })

  it("generates and verifies single-use backup code material", async () => {
    const [backupCode] = generateBackupCodes(1)
    const codeHash = await hashBackupCode(backupCode)

    assert.equal(normalizeBackupCode(backupCode), backupCode.replace("-", ""))
    assert.equal(await verifyBackupCode(codeHash, backupCode), true)
    assert.equal(await verifyBackupCode(codeHash, "WRONG-CODE"), false)
  })
})
