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

    const watermarkClauses = requiredCapture(
      migration,
      /ALTER\s+TABLE\s+"MembershipSubscription"\s+([\s\S]*?);/i,
      "MembershipSubscription watermark ALTER TABLE",
    )
      .split(",")
      .map(normalizeSql)

    assert.deepEqual(watermarkClauses, [
      'ADD COLUMN "lastStripeEventId" TEXT',
      'ADD COLUMN "lastStripeEventCreatedAt" TIMESTAMP(3)',
      'ADD COLUMN "lastStripeAuthoritativeAt" TIMESTAMP(3)',
    ])
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
    const normalizedMigration = normalizeSql(migration)
    assert.match(
      normalizedMigration,
      /ALTER TABLE "MembershipWebhookReceipt" ADD CONSTRAINT "MembershipWebhookReceipt_userId_fkey" FOREIGN KEY\("userId"\) REFERENCES "User"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE;/,
    )
    assert.doesNotMatch(
      migration,
      /(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+"MembershipSubscription"/i,
    )

    const receiptColumnNames = receiptTableEntries(migration)
      .map((entry) => entry.match(/^"([^"]+)"/)?.[1])
      .filter(Boolean)
      .join(" ")
    assert.doesNotMatch(receiptColumnNames, /payload|address|paymentMethod|secret|token/i)
  })
})
