import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import * as normalizedEmailCheck from "../scripts/check-normalized-email-collisions.mjs"

const {
  countNormalizedEmailCollisions,
  formatNormalizedEmailCheckError,
  requireDirectNormalizedEmailCheckUrl,
  runNormalizedEmailCollisionCheckCli,
} = normalizedEmailCheck

const directUrl = "postgresql://operator:secret@ep-example.us-east-2.aws.neon.tech:5432/massagelab?sslmode=require"
const pooledUrl = "postgresql://operator:secret@ep-example-pooler.us-east-2.aws.neon.tech/massagelab?sslmode=require"

const [
  schema,
  migration,
  normalizedIndexMigration,
  preflight,
  cleanup,
  packageJsonSource,
  deployment,
  releaseChecklist,
  releasePlan,
] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(
    new URL("../prisma/migrations/20260828120000_identity_method_safety/migration.sql", import.meta.url),
    "utf8",
  ).catch(() => ""),
  readFile(
    new URL("../prisma/migrations/20260828121000_identity_normalized_email_index/migration.sql", import.meta.url),
    "utf8",
  ).catch(() => ""),
  readFile(new URL("../scripts/check-normalized-email-collisions.mjs", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../scripts/cleanup-legacy-auth-attempts.mjs", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/deployment.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/release-checklist.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/superpowers/plans/2026-08-28-release-soft-launch.md", import.meta.url), "utf8"),
])
const packageJson = JSON.parse(packageJsonSource)

/** Returns one exact checklist step bounded by the next checked or unchecked step heading. */
function releasePlanStepSection(source, stepHeading, nextStepNumber) {
  const startMarker = `**${stepHeading}**`
  const start = source.indexOf(startMarker)
  if (start === -1) return ""

  const remaining = source.slice(start)
  const nextHeading = new RegExp(`^- \\[[ xX]\\] \\*\\*Step ${nextStepNumber}:`, "m").exec(remaining)
  if (!nextHeading) return ""
  return remaining.slice(0, nextHeading.index)
}

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
    assert.doesNotMatch(migration, /User_normalized_email_key/)
    assert.equal(
      normalizedIndexMigration.replaceAll("\r\n", "\n").trim(),
      'CREATE UNIQUE INDEX CONCURRENTLY "User_normalized_email_key"\n  ON "User" (lower(btrim("email"))) WHERE "email" IS NOT NULL;',
    )
    assert.match(migration, /CREATE TABLE "AuthMethodIntent"/)
    assert.match(migration, /CREATE TABLE "AccountSecurityEmailIntent"/)
    for (const enumName of [
      "AuthAttemptScope",
      "AuthMethodIntentPurpose",
      "AuthMethodIntentStatus",
      "AccountSecurityEmailKind",
      "AccountSecurityEmailIntentStatus",
    ]) {
      assert.match(migration, new RegExp(`CREATE TYPE "${enumName}" AS ENUM`))
    }
    assert.match(migration, /CREATE UNIQUE INDEX "AuthRateLimitBucket_purpose_scope_keyHash_key"/)
    assert.match(migration, /CREATE UNIQUE INDEX "AuthMethodIntent_browserBindingHash_key"/)
    assert.match(migration, /CREATE UNIQUE INDEX "AccountSecurityEmailIntent_idempotencyKey_key"/)
    assert.match(migration, /CONSTRAINT "AuthMethodIntent_targetUserId_fkey"[\s\S]*ON DELETE CASCADE ON UPDATE CASCADE/)
    assert.match(migration, /CONSTRAINT "AccountSecurityEmailIntent_userId_fkey"[\s\S]*ON DELETE CASCADE ON UPDATE CASCADE/)
    assert.match(preflight, /normalized_collision_count/)
  })

  it("documents collision preflight, concurrent index recovery, and the required recovery notice without contradiction", () => {
    assert.match(deployment, /CREATE UNIQUE INDEX CONCURRENTLY/)
    assert.match(deployment, /invalid index/i)
    assert.match(deployment, /stop[^.]*migration/i)
    assert.match(releaseChecklist, /second Admin evidence(?:\/action)? bundle/i)
    assert.match(releaseChecklist, /PASSWORD_RECOVERED/)
    assert.match(releaseChecklist, /account-security[^.]*deliver(?:y|ed)|deliver(?:y|ed)[^.]*account-security/i)
    assert.doesNotMatch(releaseChecklist, /must not create[^\n]*account-change email intent/i)
  })

  it("blocks legacy limiter cleanup until every identity writer is drained by deployment SHA", () => {
    // Bound the first slice to Step 5 before Step 6 and the second to the complete
    // identity-writer drain interval before the bounded-pause paragraph. These
    // anchors prevent unrelated prose from satisfying the deployment-SHA drain gate.
    const pausedBridgeDrain = releasePlanStepSection(
      releasePlan,
      "Step 5: Prove the paused bridge and drain every pre-bridge writer",
      6,
    )
    const identityWriterDrain = pausedBridgeDrain.match(
      /Use that same complete drain interval[\s\S]*?(?=\r?\n\r?\nDuring this bounded pause)/,
    )?.[0] ?? ""

    assert.notEqual(pausedBridgeDrain, "", "release plan must contain the bounded paused-bridge drain section")
    assert.notEqual(identityWriterDrain, "", "paused-bridge section must contain the identity-writer drain interval")
    assert.match(identityWriterDrain, /deployment\/SHA-scoped/)
    assert.match(identityWriterDrain, /immutable deployment ID mapped to its full Git SHA/)
    assert.match(identityWriterDrain, /normalized method\/path/)
    assert.match(identityWriterDrain, /POST \/api\/account\/register/)
    assert.match(identityWriterDrain, /POST \/api\/auth\/callback\/credentials/)
    assert.match(identityWriterDrain, /POST \/api\/account\/password-reset\/request/)
    assert.match(
      identityWriterDrain,
      /zero pre-bridge receives or starts after alias cutover and zero pre-bridge executions still running at the drain boundary/i,
    )
    assert.match(identityWriterDrain, /AuthAttempt[^.]*cleanup[^.]*forbidden/i)
    assert.match(identityWriterDrain, /read-only/i)
  })

  it("requires complete migration integrity on both paused and unpaused deployment readbacks", () => {
    const pausedReadback = releasePlanStepSection(
      releasePlan,
      "Step 5: Prove the paused bridge and drain every pre-bridge writer",
      6,
    )
    const unpausedReadback = releasePlanStepSection(
      releasePlan,
      "Step 6: Deploy the unpaused bridge only after drain proof",
      7,
    )

    assert.notEqual(pausedReadback, "", "release plan must contain the paused deployment readback")
    assert.notEqual(unpausedReadback, "", "release plan must contain the unpaused deployment readback")
    for (const readback of [pausedReadback, unpausedReadback]) {
      assert.match(readback, /all five reviewed migrations current in the required order/)
      assert.match(readback, /every committed migration current/)
      assert.match(readback, /zero unexpected or failed migrations/)
    }
  })

  it("bounds release-plan steps across checked and unchecked next headings", () => {
    for (const checkbox of [" ", "x", "X"]) {
      assert.equal(
        releasePlanStepSection(
          `- [ ] **Step 5: Current gate**\nrequired claim\n- [${checkbox}] **Step 6: Next gate**`,
          "Step 5: Current gate",
          6,
        ),
        "**Step 5: Current gate**\nrequired claim\n",
      )
    }
    assert.equal(releasePlanStepSection("missing current step", "Step 5: Current gate", 6), "")
    assert.equal(
      releasePlanStepSection("- [ ] **Step 5: Current gate**", "Step 5: Current gate", 6),
      "",
    )
  })

  it("registers privacy-safe preflight and dormant cleanup commands", () => {
    assert.match(cleanup, /AUTH_LEGACY_ATTEMPT_CLEANUP/)
    assert.match(cleanup, /LIMIT \$\{maxRows\}/)
    assert.doesNotMatch(cleanup, /console\.(?:log|error)\([^\n]*(?:key|email|ip)/i)
    assert.doesNotMatch(cleanup, /AuthRateLimitBucket/)
    assert.equal(packageJson.scripts["auth:check-normalized-emails"], "node scripts/check-normalized-email-collisions.mjs")
    assert.equal(packageJson.scripts["auth:cleanup-legacy-attempts"], "node scripts/cleanup-legacy-auth-attempts.mjs")
  })

  it("accepts only an explicit direct non-pooler Neon target", () => {
    assert.equal(requireDirectNormalizedEmailCheckUrl({
      AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: `  ${directUrl}  `,
    }), directUrl)
    assert.throws(() => requireDirectNormalizedEmailCheckUrl({}), /required/i)
    assert.throws(
      () => requireDirectNormalizedEmailCheckUrl({ AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: pooledUrl }),
      /direct non-pooler Neon/i,
    )
    assert.throws(
      () => requireDirectNormalizedEmailCheckUrl({
        AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: "postgresql://operator:secret@database.example.test/massagelab",
      }),
      /direct non-pooler Neon/i,
    )
  })

  it("executes one fixed count-only collision query and rejects invalid results", async () => {
    const calls = []
    const count = await countNormalizedEmailCollisions({
      async $queryRawUnsafe(...args) {
        calls.push(args)
        return [{ normalized_collision_count: 0 }]
      },
    })

    assert.equal(count, 0)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].length, 1)
    assert.equal(calls[0][0].trim(), `SELECT COUNT(*)::int AS normalized_collision_count
FROM (
  SELECT lower(btrim("email"))
  FROM "User"
  WHERE "email" IS NOT NULL
  GROUP BY lower(btrim("email"))
  HAVING COUNT(*) > 1
) collisions`)

    for (const invalidRows of [[], [{ normalized_collision_count: -1 }], [{ normalized_collision_count: 1.5 }]]) {
      await assert.rejects(
        countNormalizedEmailCollisions({ $queryRawUnsafe: async () => invalidRows }),
        /invalid count/i,
      )
    }
  })

  it("prints only the count and marks nonzero collisions as a failure", async () => {
    assert.equal(typeof runNormalizedEmailCollisionCheckCli, "function")
    for (const expectedCount of [0, 2]) {
      const output = []
      const exitCodes = []
      let clients = 0
      let disconnects = 0
      const result = await runNormalizedEmailCollisionCheckCli({
        env: { AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: directUrl },
        createPrismaClient: (connectionString) => {
          assert.equal(connectionString, directUrl)
          clients += 1
          return {
            $queryRawUnsafe: async () => [{ normalized_collision_count: expectedCount }],
            async $disconnect() {
              disconnects += 1
            },
          }
        },
        writeLine: (line) => output.push(line),
        setExitCode: (code) => exitCodes.push(code),
      })

      assert.equal(result, expectedCount)
      assert.deepEqual(output, [`normalized_collision_count=${expectedCount}`])
      assert.deepEqual(exitCodes, expectedCount === 0 ? [] : [1])
      assert.equal(clients, 1)
      assert.equal(disconnects, 1)
    }
  })

  it("requires an explicit correctly named client factory before collision queries", async () => {
    assert.doesNotMatch(preflight, /createPrismaClient\s*=\s*createNormalizedEmailCheckPrismaClient/)
    assert.match(
      preflight,
      /runNormalizedEmailCollisionCheckCli\(\{[\s\S]*env:\s*process\.env[\s\S]*createPrismaClient:\s*createNormalizedEmailCheckPrismaClient/,
    )

    let misspelledFactoryCalls = 0
    const baseRequest = {
      env: { AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: directUrl },
      writeLine: () => assert.fail("missing injection must fail before output"),
      setExitCode: () => assert.fail("missing injection must fail before setting an exit code"),
    }
    await assert.rejects(runNormalizedEmailCollisionCheckCli(baseRequest), /explicit.*createPrismaClient/i)
    await assert.rejects(
      runNormalizedEmailCollisionCheckCli({
        ...baseRequest,
        createPrsimaClient: () => {
          misspelledFactoryCalls += 1
          throw new Error("misspelled injection must never be called")
        },
      }),
      /explicit.*createPrismaClient/i,
    )
    assert.equal(misspelledFactoryCalls, 0)
  })

  it("disconnects after invalid results and redacts URL and secret-bearing errors", async () => {
    assert.equal(typeof runNormalizedEmailCollisionCheckCli, "function")
    let disconnects = 0
    await assert.rejects(
      runNormalizedEmailCollisionCheckCli({
        env: { AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL: directUrl },
        createPrismaClient: () => ({
          $queryRawUnsafe: async () => [],
          async $disconnect() {
            disconnects += 1
          },
        }),
        writeLine: () => assert.fail("invalid results must not emit a count"),
        setExitCode: () => assert.fail("invalid results must reject before setting a collision exit code"),
      }),
      /invalid count/i,
    )
    assert.equal(disconnects, 1)

    const formatted = formatNormalizedEmailCheckError(
      new Error("connect postgresql://operator:raw-secret@db.example/app password=raw-secret token=raw-token"),
    )
    assert.equal(formatted, "connect [redacted] [redacted] [redacted]")
    assert.doesNotMatch(formatted, /operator|raw-secret|raw-token|postgresql|password=|token=/i)
  })
})
