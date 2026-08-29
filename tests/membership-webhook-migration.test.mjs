import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const [schema, migration] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../prisma/migrations/20260828130000_membership_subscription_convergence/migration.sql",
      import.meta.url,
    ),
    "utf8",
  ).catch(() => ""),
])

/** Normalizes insignificant SQL whitespace while preserving contract tokens. */
function normalizeSql(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\(/g, "(")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim()
}

/** Returns a required capture so missing DDL fails inside the owning test. */
function requiredCapture(source, pattern, label) {
  const match = source.match(pattern)
  assert.ok(match, `expected ${label}`)
  return match[1]
}

/** Reads only indexes owned by the new receipt table. */
function receiptIndexes(source) {
  return [...source.matchAll(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+"([^"]+)"\s+ON\s+"MembershipWebhookReceipt"\s*\(([^)]+)\)\s*;/gi,
  )].map((match) => ({
    unique: Boolean(match[1]),
    name: match[2],
    columns: [...match[3].matchAll(/"([^"]+)"/g)].map((column) => column[1]),
  }))
}

/** Splits the bounded receipt-table body into formatting-independent entries. */
function receiptTableEntries(source) {
  return requiredCapture(
    source,
    /CREATE\s+TABLE\s+"MembershipWebhookReceipt"\s*\(([\s\S]*?)\)\s*;/i,
    "MembershipWebhookReceipt table",
  )
    .split(",")
    .map(normalizeSql)
}

/** Produces formatting-independent SQL statements without migration comments. */
function sqlStatements(source) {
  return source
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map(normalizeSql)
    .filter(Boolean)
}

/** Parses every ALTER that mentions either compatibility-sensitive table. */
function targetedAlterStatements(source) {
  return sqlStatements(source)
    .filter((statement) => (
      /\bALTER\s+TABLE\b/i.test(statement)
      && /"(?:MembershipSubscription|MembershipWebhookReceipt)"/.test(statement)
    ))
    .map((statement) => {
      const match = statement.match(
        /^ALTER\s+TABLE\s+"(MembershipSubscription|MembershipWebhookReceipt)"\s+(.+)$/i,
      )
      assert.ok(match, `unrecognized targeted ALTER TABLE statement: ${statement}`)
      return {
        table: match[1],
        operation: normalizeSql(match[2]),
      }
    })
}

const expectedWatermarkClauses = [
  'ADD COLUMN "lastStripeEventId" TEXT',
  'ADD COLUMN "lastStripeEventCreatedAt" TIMESTAMP(3)',
  'ADD COLUMN "lastStripeAuthoritativeAt" TIMESTAMP(3)',
]

const expectedReceiptForeignKey = 'ADD CONSTRAINT "MembershipWebhookReceipt_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE'

/** Allows only the two reviewed ALTER statements and scans all receipt DDL. */
function assertTargetedAlterContract(source) {
  assert.deepEqual(targetedAlterStatements(source), [
    {
      table: "MembershipSubscription",
      operation: expectedWatermarkClauses.join(", "),
    },
    {
      table: "MembershipWebhookReceipt",
      operation: expectedReceiptForeignKey,
    },
  ])

  const receiptDdl = sqlStatements(source)
    .filter((statement) => /"MembershipWebhookReceipt/i.test(statement))
    .join("\n")
  assert.doesNotMatch(receiptDdl, /payload|address|paymentMethod|secret|token/i)
}

const targetedAlterMutations = [
  {
    name: "SET NOT NULL",
    sql: 'ALTER TABLE "MembershipSubscription" ALTER COLUMN "lastStripeEventId" SET NOT NULL;',
  },
  {
    name: "SET DEFAULT",
    sql: 'ALTER TABLE "MembershipSubscription" ALTER COLUMN "lastStripeEventCreatedAt" SET DEFAULT CURRENT_TIMESTAMP;',
  },
  {
    name: "DROP COLUMN",
    sql: 'ALTER TABLE "MembershipSubscription" DROP COLUMN "lastStripeAuthoritativeAt";',
  },
  {
    name: "RENAME COLUMN",
    sql: 'ALTER TABLE "MembershipSubscription" RENAME COLUMN "lastStripeEventId" TO "stripeEventId";',
  },
  {
    name: "ALTER TYPE",
    sql: 'ALTER TABLE "MembershipSubscription" ALTER COLUMN "lastStripeEventId" TYPE VARCHAR(255);',
  },
  {
    name: "extra membership ADD COLUMN",
    sql: 'ALTER TABLE "MembershipSubscription" ADD COLUMN "legacyState" TEXT;',
  },
  {
    name: "receipt payload ADD COLUMN",
    sql: 'ALTER TABLE "MembershipWebhookReceipt" ADD COLUMN "payload" JSONB;',
  },
  {
    name: "receipt secret non-ALTER DDL",
    sql: 'CREATE INDEX "MembershipWebhookReceipt_secret_idx" ON "MembershipWebhookReceipt"("secret");',
  },
  {
    name: "second receipt FK ALTER",
    sql: `ALTER TABLE "MembershipWebhookReceipt"
      ADD CONSTRAINT "MembershipWebhookReceipt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  },
]

describe("membership webhook persistence", () => {
  it("adds the durable privacy-safe Prisma receipt contract", () => {
    assert.match(
      schema,
      /enum MembershipWebhookReceiptStatus[\s\S]*RECEIVED[\s\S]*APPLIED[\s\S]*IGNORED/,
    )
    const receiptModel = schema.match(/model MembershipWebhookReceipt[\s\S]*?\r?\n\}/)?.[0] ?? ""
    assert.match(receiptModel, /@@unique\(\[provider, providerEventId\]\)/)
    assert.match(receiptModel, /@@index\(\[status, receivedAt\]\)/)
    assert.match(receiptModel, /@@index\(\[stripeSubscriptionId, providerEventCreatedAt\]\)/)
    assert.match(receiptModel, /@@index\(\[userId, receivedAt\]\)/)
    assert.doesNotMatch(receiptModel, /payload|address|paymentMethod|secret|token/i)
  })

  it("creates the exact SQL receipt-status enum", () => {
    const enumValues = requiredCapture(
      migration,
      /CREATE\s+TYPE\s+"MembershipWebhookReceiptStatus"\s+AS\s+ENUM\s*\(([^)]*)\)\s*;/i,
      "MembershipWebhookReceiptStatus enum",
    )
      .split(",")
      .map((value) => value.trim().replace(/^'|'$/g, ""))

    assert.deepEqual(enumValues, ["RECEIVED", "APPLIED", "IGNORED"])
  })

  it("adds exactly three nullable no-default freshness watermarks", () => {
    assert.match(schema, /lastStripeEventId\s+String\?/)
    assert.match(schema, /lastStripeEventCreatedAt\s+DateTime\?/)
    assert.match(schema, /lastStripeAuthoritativeAt\s+DateTime\?/)
    assertTargetedAlterContract(migration)
  })

  it("creates the full receipt table with exact SQL nullability and defaults", () => {
    const receiptColumns = receiptTableEntries(migration)

    assert.deepEqual(receiptColumns, [
      '"id" TEXT NOT NULL',
      '"userId" TEXT',
      '"provider" TEXT NOT NULL',
      '"providerEventId" TEXT NOT NULL',
      '"eventType" TEXT NOT NULL',
      '"providerEventCreatedAt" TIMESTAMP(3) NOT NULL',
      '"providerObjectId" TEXT NOT NULL',
      '"stripeSubscriptionId" TEXT',
      '"status" "MembershipWebhookReceiptStatus" NOT NULL DEFAULT \'RECEIVED\'',
      '"attemptCount" INTEGER NOT NULL DEFAULT 0',
      '"failureCode" TEXT',
      '"receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
      '"lastAttemptedAt" TIMESTAMP(3)',
      '"processedAt" TIMESTAMP(3)',
      'CONSTRAINT "MembershipWebhookReceipt_pkey" PRIMARY KEY("id")',
    ])
  })

  it("uses exact connector-safe receipt index names and column orders", () => {
    assert.deepEqual(receiptIndexes(migration), [
      {
        unique: true,
        name: "MembershipWebhookReceipt_provider_providerEventId_key",
        columns: ["provider", "providerEventId"],
      },
      {
        unique: false,
        name: "MembershipWebhookReceipt_status_receivedAt_idx",
        columns: ["status", "receivedAt"],
      },
      {
        unique: false,
        name: "MembershipWebhookReceipt_stripeSubscriptionId_providerEvent_idx",
        columns: ["stripeSubscriptionId", "providerEventCreatedAt"],
      },
      {
        unique: false,
        name: "MembershipWebhookReceipt_userId_receivedAt_idx",
        columns: ["userId", "receivedAt"],
      },
    ])
  })

  it("keeps every quoted PostgreSQL identifier within 63 characters", () => {
    const overlongIdentifiers = [...new Set(
      [...migration.matchAll(/"([^"]+)"/g)]
        .map((match) => match[1])
        .filter((identifier) => identifier.length > 63),
    )]

    assert.deepEqual(overlongIdentifiers, [])
  })

  it("keeps the migration additive, privacy-safe, and user-detachable", () => {
    assertTargetedAlterContract(migration)
    assert.doesNotMatch(
      migration,
      /(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+"MembershipSubscription"/i,
    )
  })

  for (const mutation of targetedAlterMutations) {
    it(`rejects appended targeted ALTER mutation: ${mutation.name}`, () => {
      assert.throws(
        () => assertTargetedAlterContract(`${migration}\n${mutation.sql}`),
        undefined,
        `${mutation.name} must not satisfy the migration contract`,
      )
    })
  }
})
