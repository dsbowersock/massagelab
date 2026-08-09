import Link from "next/link"
import { randomUUID } from "node:crypto"
import { notFound } from "next/navigation"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireFullAdminUser } from "@/lib/admin/access"
import { retryFailedEmailIntentAction } from "./email-actions"
import {
  ADMIN_USER_DETAIL_SECTIONS,
  getAdminUserDetailSection,
  parseAdminUserDetailSection,
  type AdminUserDetailSection,
} from "@/lib/admin/user-detail"
import { prisma } from "@/lib/prisma"

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Server-rendered detail tabs deliberately load one bounded section per request. */
export default async function AdminUserDetailPage({ params, searchParams }: AdminUserDetailPageProps) {
  await requireFullAdminUser()
  const { userId } = await params
  const section = parseAdminUserDetailSection(singleValue((await searchParams).section))
  const detail = await getAdminUserDetailSection({ prismaClient: prisma, userId, section })
  if (!detail) notFound()

  return (
    <AppPageShell title="Account detail" className="p-3 sm:p-6 lg:p-8" contentClassName="gap-4">
      <Card className={appSurfaceClassName}>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Account detail</p>
              <h1 className="text-2xl font-semibold">{detail.target.name?.trim() || detail.target.email?.trim() || "Unnamed account"}</h1>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detail.target.email ?? "No email"} · {detail.target.id}</p>
            </div>
            <Button asChild variant="outline"><Link href="/admin/users">Back to directory</Link></Button>
          </div>

          <nav aria-label="Account detail sections" className="flex flex-wrap gap-2">
            {ADMIN_USER_DETAIL_SECTIONS.map((item) => (
              <Button key={item} asChild variant={item === section ? "default" : "outline"} size="sm">
                <Link href={sectionHref(userId, item)} aria-current={item === section ? "page" : undefined}>{sectionLabel(item)}</Link>
              </Button>
            ))}
          </nav>

          <section aria-labelledby={`${section}-heading`} className={`${appInsetClassName} space-y-4 p-4`}>
            <h2 id={`${section}-heading`} className="text-lg font-semibold">{sectionLabel(section)}</h2>
            {section === "activity"
              ? <ActivitySection detail={detail.data} userId={userId} />
              : section === "billing"
                ? <BillingSection detail={detail.data} />
                : <DetailSection detail={detail.data} section={section} />}
          </section>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}

type ActivityEmail = {
  intentId: string
  kind: string
  status: string
  failureCode: string | null
  attemptCount: number
  lastAttemptAt: string | null
  deliveredAt: string | null
}

type ActivityEntry = {
  title: string
  explanation: string
  effectiveValue: string | null
  occurredAt: string | null
  action: { kind: string; outcome: string; occurredAt: string | null }
  email: ActivityEmail | null
}

/** Renders the operator-safe activity projection and its single audited retry path. */
function ActivitySection({ detail, userId }: { detail: Record<string, unknown>; userId: string }) {
  const entries = Array.isArray(detail.entries) ? detail.entries as ActivityEntry[] : []
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No account activity yet.</p>

  return <ol className="space-y-3">{entries.map((entry, index) => {
    const email = entry.email
    const canRetry = email?.status === "FAILED"
      && email.kind !== "PASSWORD_RESET"
      && email.failureCode !== "RECIPIENT_UNAVAILABLE"
    const failedPasswordReset = email?.status === "FAILED" && email.kind === "PASSWORD_RESET"
    const operationId = randomUUID()
    return (
      <li key={`${entry.occurredAt ?? "activity"}-${index}`} className="rounded-md border bg-background/60 p-3">
        <p className="font-medium">{entry.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{entry.explanation}</p>
        {entry.effectiveValue ? <p className="mt-1 text-sm">Effective value: {entry.effectiveValue}</p> : null}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <ActivityValue label="Occurred" value={entry.occurredAt} />
          <ActivityValue label="Action outcome" value={`${entry.action.kind}: ${entry.action.outcome}`} />
          {email ? <>
            <ActivityValue label="Email delivery" value={email.status} />
            <ActivityValue label="Attempts" value={String(email.attemptCount)} />
            <ActivityValue label="Last attempt" value={email.lastAttemptAt} />
            <ActivityValue label="Failure code" value={email.failureCode} />
          </> : null}
        </dl>
        {canRetry ? (
          <form action={retryFailedEmailIntentAction.bind(null, userId)} className="mt-3">
            <input type="hidden" name="intentId" value={email.intentId} />
            <input type="hidden" name="operationId" value={operationId} />
            <Button type="submit" size="sm">Retry failed email</Button>
          </form>
        ) : null}
        {failedPasswordReset ? <p className="mt-3 text-sm text-muted-foreground">Send a new reset link will be available after the password reset action is added.</p> : null}
      </li>
    )
  })}</ol>
}

/** Keeps absent optional timestamps and failure codes visibly distinct from stored empty strings. */
function ActivityValue({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd>{value ?? "None"}</dd></div>
}

function DetailSection({ detail, section }: { detail: Record<string, unknown>; section: AdminUserDetailSection }) {
  const rows = detailRows(detail, section)
  return <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => (
    <div key={label} className="min-w-0 rounded-md border bg-background/60 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{value}</dd>
    </div>
  ))}</dl>
}

type BillingOrder = {
  status: string
  fulfillmentStatus: string
  totalCents: number
  currency: string
  createdAt: string | null
  reconciliationState: string
  detailHref: string
  items: unknown
  refunds: unknown
  disputes: unknown
}

/** Renders bounded local commerce evidence and links to the existing full commerce review owner. */
function BillingSection({ detail }: { detail: Record<string, unknown> }) {
  const commerce = isRecord(detail.commerce) ? detail.commerce : {}
  const orders = Array.isArray(commerce.recentOrders) ? commerce.recentOrders as BillingOrder[] : []
  return (
    <div className="space-y-4">
      <DetailSection detail={{ subscriptions: detail.subscriptions }} section="billing" />
      <div className="space-y-2">
        <h3 className="font-medium">Recent commerce orders</h3>
        <p className="text-xs text-muted-foreground">
          Showing {orders.length} of {String(commerce.totalOrderCount ?? 0)} local orders{commerce.truncated ? "; older orders are omitted." : "."}
        </p>
        {orders.length ? orders.map((order) => (
          <article key={order.detailHref} className="min-w-0 space-y-2 rounded-md border bg-background/60 p-3 text-sm">
            <p className="font-medium">{order.status} · {order.fulfillmentStatus}</p>
            <p className="text-muted-foreground">
              {formatMoney(order.totalCents, order.currency)} · {order.createdAt ?? "Time unavailable"} · Reconciliation: {order.reconciliationState}
            </p>
            <p className="break-words text-muted-foreground">Items: {objectValue(order.items)}</p>
            <p className="break-words text-muted-foreground">Refunds: {objectValue(order.refunds)}</p>
            <p className="break-words text-muted-foreground">Disputes: {objectValue(order.disputes)}</p>
            <Button asChild size="sm" variant="outline"><Link href={order.detailHref}>Review order</Link></Button>
          </article>
        )) : <p className="text-sm text-muted-foreground">No commerce orders yet.</p>}
      </div>
    </div>
  )
}

/** Converts the already privacy-bounded loader result into readable operator labels without exposing hidden fields. */
function detailRows(detail: Record<string, unknown>, section: AdminUserDetailSection): Array<[string, string]> {
  if (section === "security") return [
    ["Sign-in provider types", objectValue(detail.providers)], ["Connection rows", objectValue(detail.connections)],
    ["Password configured", yesNo(detail.passwordConfigured)],
    ["Two-factor authentication", yesNo(detail.twoFactorEnabled)], ["Active sessions", String(detail.activeSessionCount ?? 0)],
  ]
  if (section === "overview") return [
    ["Email verification", yesNo(detail.emailVerified)], ["Profile image", String(detail.image ?? "Unavailable")], ["Profile", objectValue(detail.profile)],
    ["Practice relationships", objectValue(detail.practices)], ["Credentials", objectValue(detail.credentials)],
    ["Learning", objectValue(detail.learning)], ["Achievement count", nestedValue(detail.learning, "achievementCount")],
  ]
  if (section === "access") return [
    ["Role assignments", listValue(detail.roles)], ["Effective feature keys", listValue(detail.features)],
    ["Effective capabilities", objectValue(detail.capabilities)], ["Membership sources", objectValue(detail.subscriptions)],
    ["Credit wallet", objectValue(detail.wallet)], ["Background ownership", objectValue(detail.ownership)],
  ]
  if (section === "billing") return [["Supporter subscriptions", objectValue(detail.subscriptions)]]
  return [["Account activity", listValue(detail.entries)]]
}

function sectionHref(userId: string, section: AdminUserDetailSection) {
  return `/admin/users/${encodeURIComponent(userId)}?section=${section}`
}

function sectionLabel(section: AdminUserDetailSection) {
  return section[0].toUpperCase() + section.slice(1)
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function yesNo(value: unknown) {
  return value ? "Yes" : "No"
}

function listValue(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "None"
  return value.map(objectValue).join(" · ")
}

function objectValue(value: unknown): string {
  if (Array.isArray(value)) return listValue(value)
  if (!value || typeof value !== "object") return String(value ?? "None")
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${humanize(key)}: ${typeof item === "object" ? objectValue(item) : String(item ?? "None")}`)
    .join(", ")
}

function nestedValue(value: unknown, key: string) {
  return isRecord(value) ? String(value[key] ?? "Unavailable") : "Unavailable"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function formatMoney(cents: number, currency: string) {
  if (!Number.isSafeInteger(cents) || !/^[a-z]{3}$/i.test(currency)) return "Amount unavailable"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100)
}

function humanize(value: string): string {
  return value.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())
}
