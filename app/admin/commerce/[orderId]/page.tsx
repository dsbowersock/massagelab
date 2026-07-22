import Link from "next/link"
import { notFound } from "next/navigation"
import { AppPageShell, appSurfaceClassName } from "../../../../components/ui/app-surface.tsx"
import { Button } from "../../../../components/ui/button.tsx"
import { Card, CardContent } from "../../../../components/ui/card.tsx"
import { requireCommerceAdminUser } from "../../../../lib/commerce/admin-access.ts"
import { getCommerceAdminOrderDetail } from "../../../../lib/commerce/admin-service.ts"
import { prisma } from "../../../../lib/prisma.ts"
import { reconcileCommerceOrderIssueAction, refundCommerceOrderItemsAction } from "../actions.ts"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export default async function CommerceAdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireCommerceAdminUser()
  const { orderId } = await params
  const detail = await getCommerceAdminOrderDetail({ prismaClient: prisma, orderId })
  if (!detail) notFound()
  const refundableItems = detail.items.filter((item) => item.refundable)

  return (
    <AppPageShell title="Commerce order" className="p-3 sm:p-6 lg:p-8" contentClassName="gap-4">
      <Card className={appSurfaceClassName}>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{detail.account.label}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">Account {detail.account.id} · Order {detail.id}</p>
              <p className="mt-2 text-sm">{detail.status} · {money.format(detail.amounts.totalAmount / 100)}</p>
            </div>
            <Button asChild variant="outline"><Link href="/admin/commerce">Commerce queue</Link></Button>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Immutable items and amounts</h2>
            {detail.items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong>{item.label}</strong><span>{money.format(item.totalAmount / 100)}</span></div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">Item {item.id} · Background {item.backgroundId}</p>
                <p className="mt-1 text-xs text-muted-foreground">Fulfillment {item.fulfillmentStatus} · Ownership {item.ownershipStatus ?? "none"}</p>
              </div>
            ))}
          </section>

          {refundableItems.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Exact-item refund</h2>
              <form action={refundCommerceOrderItemsAction} className="space-y-3 rounded-lg border p-4">
                <input type="hidden" name="orderId" value={detail.id} />
                {refundableItems.map((item) => (
                  <label key={item.id} className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" name="orderItemId" value={item.id} />
                    <span>{item.label} · {money.format(item.totalAmount / 100)}</span>
                  </label>
                ))}
                <label className="block text-sm font-medium">Reason code
                  <input name="reasonCode" required maxLength={64} className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" placeholder="CUSTOMER_REQUEST" />
                </label>
                <Button type="submit">Prepare selected refund</Button>
              </form>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Refunds and disputes</h2>
            {[...detail.refunds.map((refund) => ({ key: `refund-${refund.id}`, text: `Refund ${refund.id} · ${refund.status} · ${money.format(refund.amount / 100)}` })), ...detail.disputes.map((dispute) => ({ key: `dispute-${dispute.id}`, text: `Dispute ${dispute.id} · ${dispute.status} · ${money.format(dispute.amount / 100)}` }))].map((entry) => <p key={entry.key} className="rounded-lg border p-3 text-sm">{entry.text}</p>)}
          </section>

          {detail.reconciliationIssues.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Deterministic reconciliation</h2>
              {detail.reconciliationIssues.map((issue, index) => (
                <div key={`${issue.code}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="font-mono text-xs">{issue.code}</span>
                  {issue.repairable ? (
                    <form action={reconcileCommerceOrderIssueAction}>
                      <input type="hidden" name="code" value={issue.code} />
                      <input type="hidden" name="orderId" value={issue.orderId} />
                      {issue.paymentId ? <input type="hidden" name="paymentId" value={issue.paymentId} /> : null}
                      {issue.refundId ? <input type="hidden" name="refundId" value={issue.refundId} /> : null}
                      {issue.disputeId ? <input type="hidden" name="disputeId" value={issue.disputeId} /> : null}
                      {issue.ownershipId ? <input type="hidden" name="ownershipId" value={issue.ownershipId} /> : null}
                      <Button type="submit" variant="outline">Apply exact repair</Button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted-foreground">Manual operator review</span>
                  )}
                </div>
              ))}
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Status history</h2>
            {detail.history.map((event) => (
              <div key={event.id} className="rounded-lg border p-3 text-sm">
                <strong>{event.type}</strong>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{event.aggregateType} {event.aggregateId}</p>
                <p className="mt-1 text-xs text-muted-foreground">{event.fromStatus ?? "created"} → {event.toStatus ?? "recorded"} · {event.createdAt}</p>
              </div>
            ))}
          </section>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}
