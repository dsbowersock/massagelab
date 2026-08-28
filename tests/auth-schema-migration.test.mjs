import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const [schema, migration, preflight, cleanup, packageJsonSource] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(
    new URL("../prisma/migrations/20260828120000_identity_method_safety/migration.sql", import.meta.url),
    "utf8",
  ).catch(() => ""),
  readFile(new URL("../scripts/check-normalized-email-collisions.mjs", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../scripts/cleanup-legacy-auth-attempts.mjs", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
])
const packageJson = JSON.parse(packageJsonSource)

describe("identity method safety persistence", () => {
  it("keeps the deployed limiter intact while adding privacy-safe active storage", () => {
    assert.match(schema, /enum AuthAttemptScope[\s\S]*ACCOUNT[\s\S]*NETWORK/)
    assert.match(schema, /enum AuthAttemptPurpose[\s\S]*GOOGLE_INTENT/)
    const legacyAttemptModel = schema.match(/model AuthAttempt\s*\{[\s\S]*?\n\}/)?.[0] ?? ""
    const activeBucketModel = schema.match(/model AuthRateLimitBucket\s*\{[\s\S]*?\n\}/)?.[0] ?? ""
    assert.match(legacyAttemptModel, /key\s+String/)
    assert.match(legacyAttemptModel, /@@unique\(\[purpose, key\]\)/)
    assert.doesNotMatch(legacyAttemptModel, /keyHash|AuthAttemptScope/)
    assert.match(activeBucketModel, /scope\s+AuthAttemptScope/)
    assert.match(activeBucketModel, /keyHash\s+String/)
    assert.match(activeBucketModel, /@@unique\(\[purpose, scope, keyHash\]\)/)
  })

  it("adds expiring method intents and idempotent security-email delivery state", () => {
    assert.match(schema, /model AuthMethodIntent[\s\S]*browserBindingHash\s+String/)
    assert.match(schema, /enum AccountSecurityEmailIntentStatus[\s\S]*PROCESSING[\s\S]*DELIVERED[\s\S]*FAILED/)
    assert.match(schema, /enum AccountSecurityEmailKind[\s\S]*PASSWORD_CHANGED/)
    assert.match(
      schema,
      /model AccountSecurityEmailIntent[\s\S]*idempotencyKey\s+String\s+@unique[\s\S]*claimTokenHash\s+String\?[\s\S]*claimExpiresAt\s+DateTime\?/,
    )
    assert.doesNotMatch(
      schema.match(/model AuthMethodIntent[\s\S]*?\n\}/)?.[0] ?? "",
      /accessToken|refreshToken|idToken|rawPayload/,
    )
    assert.match(schema, /authMethodIntents\s+AuthMethodIntent\[\]\s+@relation\("AuthMethodIntentTarget"\)/)
    assert.match(
      schema,
      /accountSecurityEmailIntents\s+AccountSecurityEmailIntent\[\]\s+@relation\("AccountSecurityEmailUser"\)/,
    )
  })

  it("uses an expansion-only migration and a count-only collision preflight", () => {
    assert.match(migration, /CREATE TABLE "AuthRateLimitBucket"/)
    assert.doesNotMatch(migration, /(?:"AuthAttempt"|\bAuthAttempt\b)/)
    assert.doesNotMatch(migration, /\bAuthAttempt_purpose_key_key\b/)
    assert.match(migration, /CREATE UNIQUE INDEX "User_normalized_email_key"[\s\S]*lower\(btrim\("email"\)\)/)
    assert.match(migration, /CREATE TABLE "AuthMethodIntent"/)
    assert.match(migration, /CREATE TABLE "AccountSecurityEmailIntent"/)
    assert.match(preflight, /normalized_collision_count/)
    assert.doesNotMatch(preflight, /SELECT[\s\S]*email[\s\S]*console\.log/i)
  })

  it("registers privacy-safe preflight and dormant cleanup commands", () => {
    assert.match(cleanup, /AUTH_LEGACY_ATTEMPT_CLEANUP/)
    assert.match(cleanup, /LIMIT \$\{maxRows\}/)
    assert.doesNotMatch(cleanup, /console\.(?:log|error)\([^\n]*(?:key|email|ip)/i)
    assert.doesNotMatch(cleanup, /AuthRateLimitBucket/)
    assert.equal(packageJson.scripts["auth:check-normalized-emails"], "node scripts/check-normalized-email-collisions.mjs")
    assert.equal(packageJson.scripts["auth:cleanup-legacy-attempts"], "node scripts/cleanup-legacy-auth-attempts.mjs")
  })
})
