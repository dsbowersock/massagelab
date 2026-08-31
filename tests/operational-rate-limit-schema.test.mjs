import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const [schema, migration] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../prisma/migrations/20260831120000_operational_rate_limit_bucket/migration.sql",
      import.meta.url,
    ),
    "utf8",
  ).catch(() => ""),
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

  it("creates only the approved enum, table, unique key, and cleanup indexes in order", () => {
    assert.deepEqual(sqlStatements(migration), [
      'CREATE TYPE "OperationalRateLimitScope" AS ENUM(\'GLOBAL\', \'NETWORK\', \'ACCOUNT\', \'RESOURCE\')',
      'CREATE TABLE "OperationalRateLimitBucket"("id" TEXT NOT NULL, "policy" TEXT NOT NULL, "scope" "OperationalRateLimitScope" NOT NULL, "keyHash" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "blockedUntil" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OperationalRateLimitBucket_pkey" PRIMARY KEY("id"))',
      'CREATE UNIQUE INDEX "OperationalRateLimitBucket_policy_scope_keyHash_key" ON "OperationalRateLimitBucket"("policy", "scope", "keyHash")',
      'CREATE INDEX "OperationalRateLimitBucket_updatedAt_idx" ON "OperationalRateLimitBucket"("updatedAt")',
      'CREATE INDEX "OperationalRateLimitBucket_blockedUntil_idx" ON "OperationalRateLimitBucket"("blockedUntil")',
    ])
  })

  it("contains no existing-table changes, data manipulation, trigger, or foreign key", () => {
    assert.doesNotMatch(migration, /\b(?:ALTER|DROP|TRUNCATE|UPDATE|DELETE|INSERT)\b/i)
    assert.doesNotMatch(migration, /\b(?:TRIGGER|REFERENCES)\b/i)
    assert.doesNotMatch(migration, /AuthRateLimitBucket/)
  })
})
