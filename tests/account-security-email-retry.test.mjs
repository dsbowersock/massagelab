import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const scriptUrl = new URL("../scripts/retry-account-security-email-intents.mjs", import.meta.url)
const directUrl = "postgresql://operator:secret@ep-example.us-east-2.aws.neon.tech:5432/massagelab?sslmode=require"
const pooledUrl = "postgresql://operator:secret@ep-example-pooler.us-east-2.aws.neon.tech/massagelab?sslmode=require"

async function loadRetryModule() {
  assert.equal(existsSync(fileURLToPath(scriptUrl)), true, "retry command must exist")
  return import(scriptUrl.href)
}

describe("account-security email operational retry", () => {
  it("is registered as an explicit dormant package command", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
    assert.equal(packageJson.scripts["auth:retry-security-notices"], "node scripts/retry-account-security-email-intents.mjs")
  })

  it("fingerprints a direct target without connecting", async () => {
    const { fingerprintAccountSecurityEmailRetryTarget, runAccountSecurityEmailRetryCli } = await loadRetryModule()
    const output = []
    let clients = 0
    await runAccountSecurityEmailRetryCli({
      args: ["--print-fingerprint"],
      env: { AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL: directUrl },
      createPrismaClient: () => { clients += 1; throw new Error("must not connect") },
      deliverIntent: () => assert.fail("must not send"),
      writeLine: (line) => output.push(line),
    })
    assert.equal(clients, 0)
    assert.equal(output.length, 1)
    assert.match(output[0], /^[0-9a-f]{64}$/)
    assert.notEqual(
      fingerprintAccountSecurityEmailRetryTarget(directUrl.replace("operator", "other-role")),
      fingerprintAccountSecurityEmailRetryTarget(directUrl),
    )
  })

  it("rejects ambiguous or target-altering parameters before connecting or sending", async () => {
    const { fingerprintAccountSecurityEmailRetryTarget, runAccountSecurityEmailRetryCli } = await loadRetryModule()
    const expectedFingerprint = fingerprintAccountSecurityEmailRetryTarget(directUrl)
    let clients = 0
    let deliveries = 0
    for (const suffix of [
      "&sslmode=verify-full",
      "&application_name=retry",
      "&schema=private",
      "&options=-csearch_path%3Dprivate",
      "&search_path=private",
    ]) {
      await assert.rejects(
        runAccountSecurityEmailRetryCli({
          args: [`--expected-fingerprint=${expectedFingerprint}`, "--max-rows=1"],
          env: {
            AUTH_SECURITY_NOTICE_RETRY_DATABASE: "1",
            AUTH_SECURITY_NOTICE_RETRY_SEND: "1",
            AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL: `${directUrl}${suffix}`,
          },
          createPrismaClient: () => { clients += 1; throw new Error("must not connect") },
          deliverIntent: async () => { deliveries += 1; return { status: "DELIVERED" } },
          writeLine: () => assert.fail("invalid target must not report retry success"),
        }),
        /parameter|duplicate|allowed/i,
      )
    }
    assert.equal(clients, 0)
    assert.equal(deliveries, 0)
  })

  it("fails closed before connecting unless direct-target, database, send, fingerprint, and bound gates are exact", async () => {
    const { fingerprintAccountSecurityEmailRetryTarget, runAccountSecurityEmailRetryCli } = await loadRetryModule()
    const fingerprint = fingerprintAccountSecurityEmailRetryTarget(directUrl)
    let clients = 0
    const createPrismaClient = () => { clients += 1; throw new Error("refused run must not connect") }
    const base = {
      args: [`--expected-fingerprint=${fingerprint}`, "--max-rows=1"],
      env: { AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL: directUrl },
      createPrismaClient,
      deliverIntent: async () => ({ status: "DELIVERED" }),
      writeLine: () => assert.fail("refused run must not print success"),
    }
    await assert.rejects(runAccountSecurityEmailRetryCli(base), /DATABASE=1/)
    await assert.rejects(runAccountSecurityEmailRetryCli({ ...base, env: { ...base.env, AUTH_SECURITY_NOTICE_RETRY_DATABASE: "1" } }), /SEND=1/)
    await assert.rejects(runAccountSecurityEmailRetryCli({ ...base, args: [`--expected-fingerprint=${"0".repeat(64)}`, "--max-rows=1"], env: { ...base.env, AUTH_SECURITY_NOTICE_RETRY_DATABASE: "1", AUTH_SECURITY_NOTICE_RETRY_SEND: "1" } }), /fingerprint.*match/i)
    for (const maxRows of ["0", "101", "1.5"]) {
      await assert.rejects(runAccountSecurityEmailRetryCli({ ...base, args: [`--expected-fingerprint=${fingerprint}`, `--max-rows=${maxRows}`], env: { ...base.env, AUTH_SECURITY_NOTICE_RETRY_DATABASE: "1", AUTH_SECURITY_NOTICE_RETRY_SEND: "1" } }), /max-rows.*1\.\.100/i)
    }
    await assert.rejects(runAccountSecurityEmailRetryCli({ ...base, env: { AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL: pooledUrl, AUTH_SECURITY_NOTICE_RETRY_DATABASE: "1", AUTH_SECURITY_NOTICE_RETRY_SEND: "1" } }), /direct.*Neon/i)
    assert.equal(clients, 0)
  })

  it("selects a bounded due set and delegates PENDING, FAILED, and expired PROCESSING recovery with count-only output", async () => {
    const { fingerprintAccountSecurityEmailRetryTarget, runAccountSecurityEmailRetryCli } = await loadRetryModule()
    const fingerprint = fingerprintAccountSecurityEmailRetryTarget(directUrl)
    const now = new Date("2026-08-28T12:00:00.000Z")
    const selected = [
      { id: "pending-private-id" },
      { id: "failed-private-id" },
      { id: "expired-private-id" },
      { id: "must-not-run-outside-bound" },
    ]
    const delivered = []
    const output = []
    let disconnects = 0
    const result = await runAccountSecurityEmailRetryCli({
      args: [`--expected-fingerprint=${fingerprint}`, "--max-rows=3"],
      env: {
        AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL: directUrl,
        AUTH_SECURITY_NOTICE_RETRY_DATABASE: "1",
        AUTH_SECURITY_NOTICE_RETRY_SEND: "1",
      },
      now,
      createPrismaClient: () => ({
        accountSecurityEmailIntent: {
          async findMany(query) {
            assert.equal(query.take, 3)
            assert.deepEqual(query.select, { id: true })
            assert.deepEqual(query.where.OR, [
              { status: { in: ["PENDING", "FAILED"] } },
              { status: "PROCESSING", claimExpiresAt: { lt: now } },
            ])
            return selected
          },
        },
        async $disconnect() { disconnects += 1 },
      }),
      deliverIntent: async ({ intentId }) => {
        delivered.push(intentId)
        return { status: intentId.startsWith("failed") ? "FAILED" : "DELIVERED", attempted: true, attemptCount: 1 }
      },
      writeLine: (line) => output.push(line),
    })
    assert.deepEqual(result, { selected: 3, delivered: 2, failed: 1, ambiguous: 0, busy: 0 })
    assert.deepEqual(delivered, selected.slice(0, 3).map(({ id }) => id))
    assert.equal(disconnects, 1)
    assert.deepEqual(output, ["account_security_notice_retry_selected=3 delivered=2 failed=1 ambiguous=0 busy=0"])
    assert.doesNotMatch(output[0], /private|@|postgres|recipient|subject|message|claim/i)
  })

  it("requires explicit injected client and delivery owners with no implicit live defaults", async () => {
    assert.equal(existsSync(fileURLToPath(scriptUrl)), true, "retry command must exist")
    const source = await readFile(scriptUrl, "utf8")
    assert.doesNotMatch(source, /createPrismaClient\s*=\s*createAccountSecurityEmailRetryPrismaClient/)
    assert.doesNotMatch(source, /deliverIntent\s*=\s*deliverAccountSecurityEmailIntent/)
  })

  it("preserves safe failure context while redacting recipients, URLs, and secrets", async () => {
    const { formatAccountSecurityEmailRetryError } = await loadRetryModule()

    const formatted = formatAccountSecurityEmailRetryError(new Error(
      "Database timeout for person@example.com at postgresql://operator:secret@example.neon.tech/db password=hunter2",
    ))

    assert.match(formatted, /Database timeout/)
    assert.doesNotMatch(formatted, /person@example\.com|postgresql|operator|secret|neon|hunter2|password=/i)
    assert.ok(formatted.length <= 500)
  })
})
