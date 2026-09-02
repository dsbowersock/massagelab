import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"

const bindingModule = await import("../lib/two-factor-enrollment-binding.ts")

const AUTH_SECRET = "test-auth-secret-with-enough-entropy"
const NOW = new Date("2026-08-29T12:00:00.000Z")
const UPDATED_AT = new Date("2026-08-29T11:59:00.000Z")
const ENCRYPTED_SECRET = "aes-gcm:v1:ciphertext-that-is-not-a-totp-secret"
const RAW_TOTP_SECRET = "JBSWY3DPEHPK3PXP"
const BASE_INPUT = {
  authSecret: AUTH_SECRET,
  userId: "user-1",
  authSessionVersion: 7,
  twoFactorSecretId: "two-factor-row-1",
  encryptedSecret: ENCRYPTED_SECRET,
  updatedAt: UPDATED_AT,
  now: NOW,
}

describe("same-browser two-factor enrollment binding", () => {
  it("signs canonical JSON for five minutes without serializing secret material", () => {
    assert.equal(bindingModule.TWO_FACTOR_ENROLLMENT_COOKIE, "ml-two-factor-enrollment")
    assert.equal(typeof bindingModule.signTwoFactorEnrollmentBinding, "function")
    assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")

    const value = bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT)
    const verified = bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value })
    const [payloadSegment] = value.split(".")
    const serializedPayload = Buffer.from(payloadSegment, "base64url").toString("utf8")

    assert.deepEqual(verified, {
      version: 1,
      userId: "user-1",
      authSessionVersion: 7,
      twoFactorSecretId: "two-factor-row-1",
      secretRowFingerprint: verified.secretRowFingerprint,
      updatedAtMs: UPDATED_AT.getTime(),
      issuedAtMs: NOW.getTime(),
      expiresAtMs: NOW.getTime() + 5 * 60_000,
    })
    assert.match(verified.secretRowFingerprint, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(value, bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT))
    assert.equal(serializedPayload.includes(ENCRYPTED_SECRET), false)
    assert.equal(serializedPayload.includes(RAW_TOTP_SECRET), false)
    assert.equal(Object.hasOwn(verified, "encryptedSecret"), false)
    assert.equal(Object.hasOwn(verified, "secret"), false)
  })

  it("accepts the test signer positive control through the production verifier", () => {
    const payload = decodePayload(bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT))
    const value = signedPayload(payload)

    assert.deepEqual(
      bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value }),
      payload,
    )
  })

  it("rejects payload or signature tampering", () => {
    assert.equal(typeof bindingModule.signTwoFactorEnrollmentBinding, "function")
    assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")
    const value = bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT)
    const [payload, signature] = value.split(".")
    const payloadBytes = Buffer.from(payload, "base64url")
    payloadBytes[0] ^= 1
    const signatureBytes = Buffer.from(signature, "base64url")
    signatureBytes[0] ^= 1
    const tamperedPayload = `${payloadBytes.toString("base64url")}.${signature}`
    const tamperedSignature = `${payload}.${signatureBytes.toString("base64url")}`

    assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value: tamperedPayload }), null)
    assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value: tamperedSignature }), null)
  })

  for (const [label, override] of [
    ["wrong user", { userId: "user-2" }],
    ["wrong auth-session version", { authSessionVersion: 8 }],
    ["wrong secret row", { twoFactorSecretId: "two-factor-row-2" }],
    ["wrong row timestamp", { updatedAt: new Date(UPDATED_AT.getTime() + 1) }],
    ["wrong encrypted-row fingerprint", { encryptedSecret: `${ENCRYPTED_SECRET}-changed` }],
    ["wrong AUTH_SECRET", { authSecret: "different-auth-secret" }],
  ]) {
    it(`rejects the ${label}`, () => {
      assert.equal(typeof bindingModule.signTwoFactorEnrollmentBinding, "function")
      assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")
      const value = bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT)
      assert.equal(
        bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, ...override, value }),
        null,
      )
    })
  }

  it("rejects a future issue time and an expired binding", () => {
    assert.equal(typeof bindingModule.signTwoFactorEnrollmentBinding, "function")
    assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")
    const futureValue = bindingModule.signTwoFactorEnrollmentBinding({
      ...BASE_INPUT,
      now: new Date(NOW.getTime() + 1),
    })
    const currentValue = bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT)

    assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value: futureValue }), null)
    assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({
      ...BASE_INPUT,
      value: currentValue,
      now: new Date(NOW.getTime() + 5 * 60_000),
    }), null)
  })

  it("rejects signed claims older than five minutes or with an excessive lifetime", () => {
    assert.equal(typeof bindingModule.signTwoFactorEnrollmentBinding, "function")
    assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")
    const value = bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT)
    const payload = decodePayload(value)
    const stale = signedPayload({
      ...payload,
      issuedAtMs: NOW.getTime() - 5 * 60_000 - 1,
      expiresAtMs: NOW.getTime() + 1,
    })
    const longLived = signedPayload({
      ...payload,
      expiresAtMs: payload.issuedAtMs + 5 * 60_000 + 1,
    })

    assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value: stale }), null)
    assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value: longLived }), null)
  })

  for (const [label, value] of [
    ["empty value", ""],
    ["missing signature", "eyJ2ZXJzaW9uIjoxfQ"],
    ["extra segment", "a.b.c"],
    ["non-base64url payload", "not+base64url.signature"],
    ["padded encoding", "e30=.signature"],
    ["malformed JSON", signedSerializedPayload("{")],
    ["oversized encoding", `${"a".repeat(2049)}.signature`],
  ]) {
    it(`rejects ${label}`, () => {
      assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")
      assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value }), null)
    })
  }

  it("rejects signed noncanonical, extra-key, malformed-fingerprint, and duplicate-key payloads", () => {
    assert.equal(typeof bindingModule.signTwoFactorEnrollmentBinding, "function")
    assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")
    const payload = decodePayload(bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT))
    const reordered = signedSerializedPayload(JSON.stringify({ userId: payload.userId, version: 1, ...payload }))
    const extra = signedSerializedPayload(JSON.stringify({ ...payload, encryptedSecret: ENCRYPTED_SECRET }))
    const badFingerprint = signedPayload({ ...payload, secretRowFingerprint: "f".repeat(43) })
    const duplicate = signedSerializedPayload(canonicalSerializedPayload(payload).replace(
      '"userId":"user-1"',
      '"userId":"user-1","userId":"user-1"',
    ))

    for (const value of [reordered, extra, badFingerprint, duplicate]) {
      assert.equal(bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value }), null)
    }
  })

  it("rejects signed non-integer, out-of-range, and inconsistent time claims", () => {
    assert.equal(typeof bindingModule.signTwoFactorEnrollmentBinding, "function")
    assert.equal(typeof bindingModule.verifyTwoFactorEnrollmentBinding, "function")
    const payload = decodePayload(bindingModule.signTwoFactorEnrollmentBinding(BASE_INPUT))
    const invalidPayloads = [
      { ...payload, version: 2 },
      { ...payload, authSessionVersion: 7.5 },
      { ...payload, authSessionVersion: -1 },
      { ...payload, updatedAtMs: "1788004740000" },
      { ...payload, issuedAtMs: Number.MAX_SAFE_INTEGER + 1 },
      { ...payload, expiresAtMs: payload.issuedAtMs },
      { ...payload, userId: "" },
      { ...payload, twoFactorSecretId: "x".repeat(192) },
    ]

    for (const invalid of invalidPayloads) {
      assert.equal(
        bindingModule.verifyTwoFactorEnrollmentBinding({ ...BASE_INPUT, value: signedPayload(invalid) }),
        null,
      )
    }
  })
})

function decodePayload(value) {
  return JSON.parse(Buffer.from(value.split(".")[0], "base64url").toString("utf8"))
}

function canonicalSerializedPayload(payload) {
  return JSON.stringify({
    version: payload.version,
    userId: payload.userId,
    authSessionVersion: payload.authSessionVersion,
    twoFactorSecretId: payload.twoFactorSecretId,
    secretRowFingerprint: payload.secretRowFingerprint,
    updatedAtMs: payload.updatedAtMs,
    issuedAtMs: payload.issuedAtMs,
    expiresAtMs: payload.expiresAtMs,
  })
}

function signedPayload(payload) {
  return signedSerializedPayload(canonicalSerializedPayload(payload))
}

function signedSerializedPayload(serializedPayload) {
  const payloadSegment = Buffer.from(serializedPayload, "utf8").toString("base64url")
  const signature = createHmac("sha256", AUTH_SECRET)
    .update(`two-factor-enrollment-binding\0${payloadSegment}`)
    .digest("base64url")
  return `${payloadSegment}.${signature}`
}
