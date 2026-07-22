import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import {
  derivePaymentDisputeProjection,
  resumePendingBackgroundRefund,
} from "../lib/commerce/reversal-service.ts"
import { getStripeClient } from "../lib/stripe-billing.js"

const DEFAULT_RECONCILIATION_BATCH_SIZE = 100

function issue(code, orderId, paymentId, relatedIdName, relatedId, ownershipId) {
  return {
    code,
    orderId,
    paymentId,
    [relatedIdName]: relatedId,
    ownershipId,
  }
}

/** Derives identifier-only drift findings from a commerce snapshot. */
export function collectCommerceReconciliationIssues(orders) {
  const issues = []
  for (const order of orders) {
    const payments = order.payments ?? []
    for (const payment of payments) {
      if (
        ["PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)
        && order.status !== payment.status
      ) {
        issues.push({
          code: "ORDER_PAYMENT_STATUS_MISMATCH",
          orderId: order.id,
          paymentId: payment.id,
        })
      }
    }
    for (const refund of order.refunds ?? []) {
      const payment = payments.find((candidate) => candidate.id === refund.paymentId) ?? payments[0]
      const paymentDisputeProjection = derivePaymentDisputeProjection(payment?.disputes ?? [])
      if (
        refund.status === "PENDING"
        && refund.stripeRefundId === `pending:${refund.id}`
      ) {
        issues.push({
          code: "PENDING_REFUND_PROCESSOR_UNRESOLVED",
          orderId: order.id,
          paymentId: payment?.id,
          refundId: refund.id,
        })
      }
      if (refund.status === "PENDING" && refund.processedAt) {
        issues.push({
          code: "PENDING_REFUND_ALREADY_PROCESSED",
          orderId: order.id,
          paymentId: payment?.id,
          refundId: refund.id,
        })
      }
      for (const refundItem of refund.items ?? []) {
        const ownership = refundItem.orderItem?.ownership
        if (!ownership || ownership.source !== "PURCHASE") continue
        if (
          refund.status === "SUCCEEDED"
          && paymentDisputeProjection?.status !== "LOST"
          && ownership.status !== "REFUND_REVOKED"
        ) {
          issues.push(issue("REFUND_OWNERSHIP_NOT_REVOKED", order.id, payment?.id, "refundId", refund.id, ownership.id))
        } else if (refund.status === "FAILED" && ownership.status === "REFUND_PENDING") {
          issues.push(issue("FAILED_REFUND_OWNERSHIP_NOT_RESTORED", order.id, payment?.id, "refundId", refund.id, ownership.id))
        } else if (refund.status === "PENDING" && ownership.status === "ACTIVE") {
          issues.push(issue("PENDING_REFUND_OWNERSHIP_NOT_SUSPENDED", order.id, payment?.id, "refundId", refund.id, ownership.id))
        }
      }
    }

    for (const payment of payments) {
      for (const dispute of payment.disputes ?? []) {
        if (dispute.status === "OPEN" && dispute.closedAt) {
          issues.push({
            code: "OPEN_DISPUTE_ALREADY_CLOSED",
            orderId: order.id,
            paymentId: payment.id,
            disputeId: dispute.id,
          })
        } else if (dispute.status !== "OPEN" && !dispute.closedAt) {
          issues.push({
            code: "CLOSED_DISPUTE_MISSING_CLOSED_AT",
            orderId: order.id,
            paymentId: payment.id,
            disputeId: dispute.id,
          })
        }
      }
      const disputeProjection = derivePaymentDisputeProjection(payment.disputes ?? [])
      if (!disputeProjection?.disputeId) continue
      for (const item of order.items ?? []) {
        const ownership = item.ownership
        if (!ownership || ownership.source !== "PURCHASE") continue
        if (disputeProjection.status === "OPEN" && ownership.status === "ACTIVE") {
          issues.push(issue("OPEN_DISPUTE_OWNERSHIP_NOT_SUSPENDED", order.id, payment.id, "disputeId", disputeProjection.disputeId, ownership.id))
        } else if (disputeProjection.status === "WON" && ownership.status === "DISPUTE_SUSPENDED") {
          issues.push(issue("WON_DISPUTE_OWNERSHIP_NOT_RESTORED", order.id, payment.id, "disputeId", disputeProjection.disputeId, ownership.id))
        } else if (disputeProjection.status === "LOST" && ["ACTIVE", "DISPUTE_SUSPENDED", "REFUND_PENDING"].includes(ownership.status)) {
          issues.push(issue("LOST_DISPUTE_OWNERSHIP_NOT_REVOKED", order.id, payment.id, "disputeId", disputeProjection.disputeId, ownership.id))
        }
      }
    }
  }
  return issues
}

/** Reads by default; repair may only resume an idempotent unresolved refund. */
export async function runCommerceReconciliation({
  prismaClient,
  repair = false,
  batchSize = DEFAULT_RECONCILIATION_BATCH_SIZE,
  resumeRefund = (refundId) => resumePendingBackgroundRefund({
    prismaClient,
    refundId,
    createProcessorRefund: async (request) => getStripeClient().refunds.create({
      payment_intent: request.paymentIntentId,
      amount: request.amountCents,
      metadata: request.metadata,
    }, { idempotencyKey: request.idempotencyKey }),
  }),
}) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer.")
  }

  const issues = []
  let repaired = 0
  let cursor
  while (true) {
    const orders = await prismaClient.commerceOrder.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        items: { include: { ownership: true } },
        payments: { include: { disputes: true } },
        refunds: {
          include: { items: { include: { orderItem: { include: { ownership: true } } } } },
        },
      },
    })
    if (orders.length === 0) break

    const pageIssues = collectCommerceReconciliationIssues(orders)
    issues.push(...pageIssues)
    if (repair) {
      for (const finding of pageIssues) {
        if (finding.code !== "PENDING_REFUND_PROCESSOR_UNRESOLVED") continue
        const result = await resumeRefund(finding.refundId)
        if (result?.changed) repaired += 1
      }
    }
    if (orders.length < batchSize) break
    cursor = orders.at(-1).id
  }
  return { mode: repair ? "repair" : "read-only", issues, repaired }
}

async function main() {
  const { prisma } = await import("../lib/prisma.ts")
  const repair = process.argv.includes("--repair")
  const report = await runCommerceReconciliation({ prismaClient: prisma, repair })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main()
}
