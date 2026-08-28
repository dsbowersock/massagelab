import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const directUrl = "postgresql://operator:secret@ep-example.us-east-2.aws.neon.tech:5432/massagelab?sslmode=require"
const pooledUrl = "postgresql://operator:secret@ep-example-pooler.us-east-2.aws.neon.tech/massagelab?sslmode=require"
const cleanupSource = await readFile(new URL("../scripts/cleanup-legacy-auth-attempts.mjs", import.meta.url), "utf8")

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

    await runLegacyAuthAttemptCleanupCli({
      args: ["--print-fingerprint"],
      env: { AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl },
      writeLine: (line) => output.push(line),
    })

    assert.equal(output.length, 1)
    assert.match(output[0], /^[0-9a-f]{64}$/)
    assert.doesNotMatch(output[0], /operator|secret|neon|massagelab|postgres|:\/\//i)
  })

  it("requires an explicit correctly named client factory before mutation", async () => {
    assert.doesNotMatch(cleanupSource, /createPrismaClient\s*=\s*createCleanupPrismaClient/)
    assert.match(
      cleanupSource,
      /runLegacyAuthAttemptCleanupCli\(\{[\s\S]*args:\s*process\.argv\.slice\(2\)[\s\S]*createPrismaClient:\s*createCleanupPrismaClient/,
    )

    const { fingerprintLegacyAuthAttemptTarget, runLegacyAuthAttemptCleanupCli } = await loadCleanupModule()
    const expectedFingerprint = fingerprintLegacyAuthAttemptTarget(directUrl)
    let misspelledFactoryCalls = 0
    const baseRequest = {
      args: [`--expected-fingerprint=${expectedFingerprint}`, "--max-rows=1"],
      env: {
        AUTH_LEGACY_ATTEMPT_CLEANUP: "1",
        AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl,
      },
      writeLine: () => assert.fail("missing injection must fail before output"),
    }

    await assert.rejects(runLegacyAuthAttemptCleanupCli(baseRequest), /explicit.*createPrismaClient/i)
    await assert.rejects(
      runLegacyAuthAttemptCleanupCli({
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

  it("fails closed unless every mutation gate is exact", async () => {
    const { fingerprintLegacyAuthAttemptTarget, runLegacyAuthAttemptCleanupCli } = await loadCleanupModule()
    const expectedFingerprint = fingerprintLegacyAuthAttemptTarget(directUrl)
    let clientsCreated = 0
    const createPrismaClient = () => {
      clientsCreated += 1
      throw new Error("refused cleanup must not create a client")
    }
    const run = (args, env = {}) => runLegacyAuthAttemptCleanupCli({
      args,
      env: { AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl, ...env },
      createPrismaClient,
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
        createPrismaClient,
        writeLine: () => assert.fail("pooled target must not emit a success line"),
      }),
      /direct.*Neon/i,
    )
    assert.equal(clientsCreated, 0)
  })

  it("runs one bounded deletion and reports only the affected count", async () => {
    const { fingerprintLegacyAuthAttemptTarget, runLegacyAuthAttemptCleanupCli } = await loadCleanupModule()
    const expectedFingerprint = fingerprintLegacyAuthAttemptTarget(directUrl)
    const output = []
    const state = { clients: 0, transactions: 0, statements: 0, disconnects: 0, sql: "" }

    const result = await runLegacyAuthAttemptCleanupCli({
      args: [`--expected-fingerprint=${expectedFingerprint}`, "--max-rows=2"],
      env: {
        AUTH_LEGACY_ATTEMPT_CLEANUP: "1",
        AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl,
      },
      createPrismaClient: (connectionString) => {
        assert.equal(connectionString, directUrl)
        state.clients += 1
        return {
          $executeRawUnsafe: () => assert.fail("deletion must execute through the transaction client"),
          async $transaction(callback) {
            state.transactions += 1
            return callback({
              async $executeRawUnsafe(sql) {
                state.statements += 1
                state.sql = sql
                return 2
              },
            })
          },
          async $disconnect() {
            state.disconnects += 1
          },
        }
      },
      writeLine: (line) => output.push(line),
    })

    assert.equal(result, 2)
    assert.deepEqual(state, {
      clients: 1,
      transactions: 1,
      statements: 1,
      disconnects: 1,
      sql: state.sql,
    })
    assert.match(state.sql, /DELETE FROM "AuthAttempt"/)
    assert.match(state.sql, /LIMIT 2/)
    assert.doesNotMatch(state.sql, /AuthRateLimitBucket/)
    assert.deepEqual(output, ["legacy_auth_attempt_rows_deleted=2"])
    assert.doesNotMatch(output[0], /key|email|ip|operator|secret|neon|massagelab|postgres|:\/\//i)
  })

  it("rejects negative or excessive affected counts from the transaction client", async () => {
    const { fingerprintLegacyAuthAttemptTarget, runLegacyAuthAttemptCleanupCli } = await loadCleanupModule()
    const expectedFingerprint = fingerprintLegacyAuthAttemptTarget(directUrl)

    for (const affectedCount of [-1, 3]) {
      let transactions = 0
      let statements = 0
      let disconnects = 0
      await assert.rejects(
        runLegacyAuthAttemptCleanupCli({
          args: [`--expected-fingerprint=${expectedFingerprint}`, "--max-rows=2"],
          env: {
            AUTH_LEGACY_ATTEMPT_CLEANUP: "1",
            AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL: directUrl,
          },
          createPrismaClient: () => ({
            async $transaction(callback) {
              transactions += 1
              return callback({
                async $executeRawUnsafe() {
                  statements += 1
                  return affectedCount
                },
              })
            },
            async $disconnect() {
              disconnects += 1
            },
          }),
          writeLine: () => assert.fail("invalid counts must not emit a success line"),
        }),
        /invalid affected-row count/i,
      )
      assert.deepEqual({ transactions, statements, disconnects }, { transactions: 1, statements: 1, disconnects: 1 })
    }
  })
})
