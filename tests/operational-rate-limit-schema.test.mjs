import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const [schema, migration, deployment, releaseChecklist] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../prisma/migrations/20260831120000_operational_rate_limit_bucket/migration.sql",
      import.meta.url,
    ),
    "utf8",
  ).catch(() => ""),
  readFile(new URL("../docs/wiki/deployment.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/release-checklist.md", import.meta.url), "utf8"),
])

/** Returns a required capture so a missing declaration fails in its owning test. */
function requiredCapture(source, pattern, label) {
  const match = source.match(pattern)
  assert.ok(match, `expected ${label}`)
  return match[1]
}

/** Normalizes layout-only whitespace without weakening SQL token checks. */
function normalizeSql(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\(/g, "(")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim()
}

/** Produces ordered SQL statements after removing comments. */
function sqlStatements(source) {
  return source
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map(normalizeSql)
    .filter(Boolean)
}

describe("operational rate-limit persistence", () => {
  it("keeps the three active delivery-claim fields and adds one append-only retry-key owner", () => {
    const entries = requiredCapture(
      schema,
      /model\s+AdminEmailIntent\s*\{([\s\S]*?)\}/,
      "AdminEmailIntent model",
    )
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+/g, " "))

    assert.ok(entries.includes("deliveryClaimTokenHash String?"))
    assert.ok(entries.includes("deliveryClaimExpiresAt DateTime?"))
    assert.ok(entries.includes("deliveryClaimOperationKeyHash String? @unique"))
    assert.equal(entries.filter((line) => /deliveryClaim/.test(line)).length, 3)

    const retryKeyEntries = requiredCapture(
      schema,
      /model\s+AdminEmailRetryOperationKey\s*\{([\s\S]*?)\}/,
      "AdminEmailRetryOperationKey model",
    )
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter(Boolean)
    assert.deepEqual(retryKeyEntries, [
      "id String @id @default(cuid())",
      "emailIntentId String",
      "operationKeyHash String @unique",
      "createdAt DateTime @default(now())",
      "emailIntent AdminEmailIntent @relation(fields: [emailIntentId], references: [id], onDelete: Restrict)",
      "@@index([emailIntentId, createdAt])",
    ])

    const statuses = requiredCapture(
      schema,
      /enum\s+AdminEmailIntentStatus\s*\{([\s\S]*?)\}/,
      "AdminEmailIntentStatus enum",
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    assert.deepEqual(statuses, ["PENDING", "DELIVERED", "FAILED"])
  })

  it("declares the exact closed operational scope enum", () => {
    const values = requiredCapture(
      schema,
      /enum\s+OperationalRateLimitScope\s*\{([\s\S]*?)\}/,
      "OperationalRateLimitScope enum",
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    assert.deepEqual(values, ["GLOBAL", "NETWORK", "ACCOUNT", "RESOURCE"])
  })

  it("declares the exact bucket fields, defaults, unique owner, and cleanup indexes", () => {
    const entries = requiredCapture(
      schema,
      /model\s+OperationalRateLimitBucket\s*\{([\s\S]*?)\}/,
      "OperationalRateLimitBucket model",
    )
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter(Boolean)

    assert.deepEqual(entries, [
      "id String @id @default(cuid())",
      "policy String",
      "scope OperationalRateLimitScope",
      "keyHash String",
      "count Int @default(0)",
      "windowStart DateTime @default(now())",
      "blockedUntil DateTime?",
      "updatedAt DateTime @updatedAt",
      "@@unique([policy, scope, keyHash])",
      "@@index([updatedAt])",
      "@@index([blockedUntil])",
    ])
  })

  it("creates the limiter, active claim fields, and append-only retry-key owner in one migration", () => {
    assert.deepEqual(sqlStatements(migration), [
      "BEGIN",
      'CREATE TYPE "OperationalRateLimitScope" AS ENUM(\'GLOBAL\', \'NETWORK\', \'ACCOUNT\', \'RESOURCE\')',
      'CREATE TABLE "OperationalRateLimitBucket"("id" TEXT NOT NULL, "policy" TEXT NOT NULL, "scope" "OperationalRateLimitScope" NOT NULL, "keyHash" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "blockedUntil" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OperationalRateLimitBucket_pkey" PRIMARY KEY("id"))',
      'CREATE UNIQUE INDEX "OperationalRateLimitBucket_policy_scope_keyHash_key" ON "OperationalRateLimitBucket"("policy", "scope", "keyHash")',
      'CREATE INDEX "OperationalRateLimitBucket_updatedAt_idx" ON "OperationalRateLimitBucket"("updatedAt")',
      'CREATE INDEX "OperationalRateLimitBucket_blockedUntil_idx" ON "OperationalRateLimitBucket"("blockedUntil")',
      'ALTER TABLE "AdminEmailIntent" ADD COLUMN "deliveryClaimTokenHash" TEXT, ADD COLUMN "deliveryClaimExpiresAt" TIMESTAMP(3), ADD COLUMN "deliveryClaimOperationKeyHash" TEXT',
      'CREATE UNIQUE INDEX "AdminEmailIntent_deliveryClaimOperationKeyHash_key" ON "AdminEmailIntent"("deliveryClaimOperationKeyHash")',
      'CREATE TABLE "AdminEmailRetryOperationKey"("id" TEXT NOT NULL, "emailIntentId" TEXT NOT NULL, "operationKeyHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AdminEmailRetryOperationKey_pkey" PRIMARY KEY("id"))',
      'CREATE UNIQUE INDEX "AdminEmailRetryOperationKey_operationKeyHash_key" ON "AdminEmailRetryOperationKey"("operationKeyHash")',
      'CREATE INDEX "AdminEmailRetryOperationKey_emailIntentId_createdAt_idx" ON "AdminEmailRetryOperationKey"("emailIntentId", "createdAt")',
      'ALTER TABLE "AdminEmailRetryOperationKey" ADD CONSTRAINT "AdminEmailRetryOperationKey_emailIntentId_fkey" FOREIGN KEY("emailIntentId") REFERENCES "AdminEmailIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
      "COMMIT",
    ])
  })

  it("keeps the entire approved migration inside one explicit transaction", () => {
    const statements = sqlStatements(migration)

    assert.equal(statements[0], "BEGIN")
    assert.equal(statements.at(-1), "COMMIT")
    assert.equal(statements.filter((statement) => statement === "BEGIN").length, 1)
    assert.equal(statements.filter((statement) => statement === "COMMIT").length, 1)
  })

  it("requires a fresh zero-row AdminEmailIntent preflight before the single migration", () => {
    assert.match(migration, /intentionally non-concurrent[\s\S]*exactly zero rows[\s\S]*approved single migration/i)
    assert.doesNotMatch(
      migration,
      /CREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY\s+"AdminEmailIntent_deliveryClaimOperationKeyHash_key"/i,
    )

    for (const source of [deployment, releaseChecklist]) {
      assert.match(source, /count-only Production `AdminEmailIntent` row-count preflight/i)
      assert.match(source, /immediately before[^.]*20260831120000_operational_rate_limit_bucket/i)
      assert.match(source, /current read-only aggregate evidence\s+is `0`[^.]*must be refreshed/i)
      assert.match(source, /proceed only when the exact count is `0`/i)
      assert.match(source, /nonzero[^.]*stop[^.]*re-review/i)
    }
  })

  it("contains no other existing-table change, data manipulation, or trigger", () => {
    assert.equal((migration.match(/\bALTER\s+TABLE\b/gi) ?? []).length, 2)
    assert.match(migration, /ALTER\s+TABLE\s+"AdminEmailIntent"/i)
    assert.match(migration, /ALTER\s+TABLE\s+"AdminEmailRetryOperationKey"/i)
    assert.doesNotMatch(migration, /ALTER\s+TABLE\s+"(?!AdminEmailIntent"|AdminEmailRetryOperationKey")/i)
    assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|TRIGGER)\b|\b(?:UPDATE\s+"|DELETE\s+FROM|INSERT\s+INTO)\b/i)
    assert.equal((migration.match(/\bREFERENCES\b/gi) ?? []).length, 1)
    assert.doesNotMatch(migration, /AuthRateLimitBucket/)
  })
})
