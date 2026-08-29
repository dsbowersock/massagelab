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

describe("membership webhook persistence", () => {
  it("adds a durable privacy-safe receipt contract", () => {
    assert.match(
      schema,
      /enum MembershipWebhookReceiptStatus[\s\S]*RECEIVED[\s\S]*APPLIED[\s\S]*IGNORED/,
    )
    const receiptModel = schema.match(/model MembershipWebhookReceipt[\s\S]*?\n\}/)?.[0] ?? ""
    assert.match(receiptModel, /@@unique\(\[provider, providerEventId\]\)/)
    assert.match(receiptModel, /@@index\(\[status, receivedAt\]\)/)
    assert.match(receiptModel, /@@index\(\[stripeSubscriptionId, providerEventCreatedAt\]\)/)
    assert.match(receiptModel, /@@index\(\[userId, receivedAt\]\)/)
    assert.doesNotMatch(receiptModel, /payload|address|paymentMethod|secret|token/i)
  })

  it("adds nullable freshness watermarks without rewriting membership rows", () => {
    assert.match(schema, /lastStripeEventId\s+String\?/)
    assert.match(schema, /lastStripeEventCreatedAt\s+DateTime\?/)
    assert.match(schema, /lastStripeAuthoritativeAt\s+DateTime\?/)
    assert.match(migration, /CREATE TABLE "MembershipWebhookReceipt"/)
    assert.match(migration, /ADD COLUMN\s+"lastStripeEventId" TEXT/)
    assert.doesNotMatch(migration, /UPDATE "MembershipSubscription"/)
  })

  it("creates receipt indexes and an optional user relation", () => {
    assert.match(
      migration,
      /CREATE INDEX "MembershipWebhookReceipt_status_receivedAt_idx"[\s\S]*\("status", "receivedAt"\)/,
    )
    assert.match(
      migration,
      /CREATE INDEX "MembershipWebhookReceipt_stripeSubscriptionId_providerEventCreatedAt_idx"[\s\S]*\("stripeSubscriptionId", "providerEventCreatedAt"\)/,
    )
    assert.match(
      migration,
      /CREATE INDEX "MembershipWebhookReceipt_userId_receivedAt_idx"[\s\S]*\("userId", "receivedAt"\)/,
    )
    assert.match(
      migration,
      /FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE/,
    )
  })
})
