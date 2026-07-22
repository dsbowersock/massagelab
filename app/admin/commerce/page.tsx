import Link from "next/link"
import { AppPageShell, appSurfaceClassName } from "../../../components/ui/app-surface.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Card, CardContent } from "../../../components/ui/card.tsx"
import { requireCommerceAdminUser } from "../../../lib/commerce/admin-access.ts"
import { listCommerceAdminOperations } from "../../../lib/commerce/admin-service.ts"
import { prisma } from "../../../lib/prisma.ts"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export default async function CommerceAdminPage() {
  await requireCommerceAdminUser()
  const queue = await listCommerceAdminOperations({ prismaClient: prisma })

  return (
    <AppPageShell title="Commerce" className="p-3 sm:p-6 lg:p-8" contentClassName="gap-4">
      <Card className={appSurfaceClassName}>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Background commerce</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Review payment exceptions, pending refunds, disputes, and deterministic reconciliation findings.
              </p>
            </div>
            <Button asChild variant="outline"><Link href="/admin">Admin dashboard</Link></Button>
          </div>

          {queue.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">No actionable commerce operations.</p>
          ) : (
            <div className="space-y-3">
              {queue.map((entry) => (
                <article key={entry.orderId} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="font-semibold">{entry.accountLabel}</h2>
                      <p className="font-mono text-xs text-muted-foreground">Account {entry.accountId} · Order {entry.orderId}</p>
                      <p className="text-sm">{entry.status} · {money.format(entry.totalAmount / 100)}</p>
                    </div>
                    <Button asChild><Link href={`/admin/commerce/${entry.orderId}`}>Review order</Link></Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {entry.status === "REVIEW_REQUIRED" ? <span className="rounded-full border px-2 py-1">Review required</span> : null}
                    {entry.pendingRefundCount ? <span className="rounded-full border px-2 py-1">{entry.pendingRefundCount} pending refund</span> : null}
                    {entry.openDisputeCount ? <span className="rounded-full border px-2 py-1">{entry.openDisputeCount} open dispute</span> : null}
                    {entry.reconciliationIssueCount ? <span className="rounded-full border px-2 py-1">{entry.reconciliationIssueCount} reconciliation</span> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  )
}
