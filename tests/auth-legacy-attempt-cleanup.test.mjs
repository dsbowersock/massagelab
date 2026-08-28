import assert from "node:assert/strict"
import { describe, it } from "node:test"

const directUrl = "postgresql://operator:secret@ep-example.us-east-2.aws.neon.tech:5432/massagelab?sslmode=require"
const pooledUrl = "postgresql://operator:secret@ep-example-pooler.us-east-2.aws.neon.tech/massagelab?sslmode=require"

async function loadCleanupModule() {
  try {
    return await import("../scripts/cleanup-legacy-auth-attempts.mjs")
  } catch (error) {
    assert.fail(`cleanup module must be importable: ${error instanceof Error ? error.code ?? error.message : error}`)
  }
}

describe("legacy auth-attempt cleanup", () => {
  it("fingerprints a direct target without connecting or exposing the target", async () => {
    const { runLegacyAuthAttemptCleanupCli } = await loadCleanupModule()
    const output = []
    let executions = 0

    await runLegacyAuthAttemptCleanupCli({
      args: ["--print-fingerprint"],
      env: { AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl },
      executeCleanup: async () => {
        executions += 1
        return 0
      },
      writeLine: (line) => output.push(line),
    })

    assert.equal(executions, 0)
    assert.equal(output.length, 1)
    assert.match(output[0], /^[0-9a-f]{64}$/)
    assert.doesNotMatch(output[0], /operator|secret|neon|massagelab|postgres|:\/\//i)
  })

  it("fails closed unless every mutation gate is exact", async () => {
    const { fingerprintLegacyAuthAttemptTarget, runLegacyAuthAttemptCleanupCli } = await loadCleanupModule()
    const expectedFingerprint = fingerprintLegacyAuthAttemptTarget(directUrl)
    let executions = 0
    const executeCleanup = async () => {
      executions += 1
      return 0
    }
    const run = (args, env = {}) => runLegacyAuthAttemptCleanupCli({
      args,
      env: { AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl, ...env },
      executeCleanup,
      writeLine: () => assert.fail("refused cleanup must not emit a success line"),
    })

    await assert.rejects(run([`--expected-fingerprint=${expectedFingerprint}`, "--max-rows=1"]), /AUTH_LEGACY_ATTEMPT_CLEANUP=1/)
    await assert.rejects(run(["--max-rows=1"], { AUTH_LEGACY_ATTEMPT_CLEANUP: "1" }), /expected-fingerprint/i)
    await assert.rejects(
      run([`--expected-fingerprint=${"0".repeat(64)}`, "--max-rows=1"], { AUTH_LEGACY_ATTEMPT_CLEANUP: "1" }),
      /fingerprint.*match/i,
    )
    await assert.rejects(
      run([`--expected-fingerprint=${expectedFingerprint.toUpperCase()}`, "--max-rows=1"], { AUTH_LEGACY_ATTEMPT_CLEANUP: "1" }),
      /64 lowercase hex/i,
    )
    for (const maxRows of ["0", "101", "1.5", "not-a-number"]) {
      await assert.rejects(
        run([`--expected-fingerprint=${expectedFingerprint}`, `--max-rows=${maxRows}`], { AUTH_LEGACY_ATTEMPT_CLEANUP: "1" }),
        /max-rows.*1\.\.100/i,
      )
    }
    await assert.rejects(
      runLegacyAuthAttemptCleanupCli({
        args: [`--expected-fingerprint=${expectedFingerprint}`, "--max-rows=1"],
        env: {
          AUTH_LEGACY_ATTEMPT_CLEANUP: "1",
          AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: pooledUrl,
        },
        executeCleanup,
        writeLine: () => assert.fail("pooled target must not emit a success line"),
      }),
      /direct.*Neon/i,
    )
    assert.equal(executions, 0)
  })

  it("runs one bounded deletion and reports only the affected count", async () => {
    const { fingerprintLegacyAuthAttemptTarget, runLegacyAuthAttemptCleanupCli } = await loadCleanupModule()
    const expectedFingerprint = fingerprintLegacyAuthAttemptTarget(directUrl)
    const output = []
    const executions = []

    const result = await runLegacyAuthAttemptCleanupCli({
      args: [`--expected-fingerprint=${expectedFingerprint}`, "--max-rows=2"],
      env: {
        AUTH_LEGACY_ATTEMPT_CLEANUP: "1",
        AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl,
      },
      executeCleanup: async (request) => {
        executions.push(request)
        return 2
      },
      writeLine: (line) => output.push(line),
    })

    assert.equal(result, 2)
    assert.equal(executions.length, 1)
    assert.equal(executions[0].connectionString, directUrl)
    assert.match(executions[0].sql, /DELETE FROM "AuthAttempt"/)
    assert.match(executions[0].sql, /LIMIT 2/)
    assert.doesNotMatch(executions[0].sql, /AuthRateLimitBucket/)
    assert.deepEqual(output, ["legacy_auth_attempt_rows_deleted=2"])
    assert.doesNotMatch(output[0], /key|email|ip|operator|secret|neon|massagelab|postgres|:\/\//i)
  })
})
