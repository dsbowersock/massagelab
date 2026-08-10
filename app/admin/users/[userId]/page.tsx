import Link from "next/link"
import { randomUUID } from "node:crypto"
import { notFound } from "next/navigation"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireFullAdminUser } from "@/lib/admin/access"
import { RetryEmailForm } from "./retry-email-form"
import { CreditGrantControls } from "./credit-action-form"
import { RoleChangeControls, SelfRoleManagementNotice, type RoleEvidence } from "./role-change-form"
import {
  FreshPasswordResetForm,
  SecurityActionControls,
  SelfSecurityManagementNotice,
} from "./security-action-forms"
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
  const actor = await requireFullAdminUser()
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
              ? <ActivitySection detail={detail.data} userId={userId} canMutate={actor.id !== userId} />
              : section === "billing"
                ? <BillingSection detail={detail.data} />
                : section === "access"
                  ? <AccessSection
                      detail={detail.data}
                      userId={userId}
                      targetName={detail.target.name}
                      targetEmail={detail.target.email}
                      canManageRoles={actor.id !== userId}
                    />
                  : section === "security"
                    ? <SecuritySection
                        detail={detail.data}
                        userId={userId}
                        targetEmail={detail.target.email}
                        canManageSecurity={actor.id !== userId}
                      />
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
  id: string
  title: string
  explanation: string
  effectiveValue: string | null
  occurredAt: string | null
  action: { kind: string; outcome: string; occurredAt: string | null }
  email: ActivityEmail | null
}

/** Renders safe activity plus either audited notification retry or fresh reset creation. */
function ActivitySection({ detail, userId, canMutate }: { detail: Record<string, unknown>; userId: string; canMutate: boolean }) {
  const entries = Array.isArray(detail.entries) ? detail.entries as ActivityEntry[] : []
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No account activity yet.</p>

  return <ol className="space-y-3">{entries.map((entry) => {
    const email = entry.email
    const canRetry = email?.status === "FAILED"
      && email.kind !== "PASSWORD_RESET"
      && email.failureCode !== "RECIPIENT_UNAVAILABLE"
    const failedPasswordReset = email?.status === "FAILED" && email.kind === "PASSWORD_RESET"
    // Each rendered retry form gets one key that useActionState submits
    // unchanged. A consumed key replays; revalidatePath normally renders a
    // fresh form with a fresh key after the action completes.
    const operationId = randomUUID()
    return (
      <li key={entry.id} data-activity-id={entry.id} className="rounded-md border bg-background/60 p-3">
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
        {canRetry && canMutate ? (
          <RetryEmailForm userId={userId} intentId={email.intentId} operationId={operationId} />
        ) : null}
        {failedPasswordReset && canMutate ? (
          <FreshPasswordResetForm
            userId={userId}
            operationId={operationId}
            submitLabel="Send a new reset link"
          />
        ) : null}
        {(canRetry || failedPasswordReset) && !canMutate ? (
          <p className="mt-3 text-sm text-muted-foreground">Self-target account actions are read-only.</p>
        ) : null}
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
    <div key={label} data-detail-key={label} className="min-w-0 rounded-md border bg-background/60 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd data-detail-value="" className="mt-1 break-words text-sm">{value}</dd>
    </div>
  ))}</dl>
}

/** Adds bounded mutation controls beneath the existing Access projection. */
function AccessSection({
  detail,
  userId,
  targetName,
  targetEmail,
  canManageRoles,
}: {
  detail: Record<string, unknown>
  userId: string
  targetName: string | null
  targetEmail: string | null
  canManageRoles: boolean
}) {
  const roles = Array.isArray(detail.roles)
    ? detail.roles.filter(isAccessRoleEvidence)
    : []
  const operationIds = {
    ANATOMY_REVIEWER: randomUUID(),
    ANATOMY_EDITOR: randomUUID(),
    creditGrant: randomUUID(),
  }
  const normalizedTargetEmail = targetEmail?.trim() || ""
  const creditEvidence = detail.emailVerified === true && normalizedTargetEmail
    ? readCreditGrantEvidence(detail.wallet)
    : null
  const targetLabel = targetName?.trim()
    ? `${targetName.trim()} (${normalizedTargetEmail})`
    : normalizedTargetEmail || "Unnamed account"
  return (
    <div className="space-y-5">
      <DetailSection detail={detail} section="access" />
      {canManageRoles ? (
        <RoleChangeControls userId={userId} roles={roles} operationIds={operationIds} />
      ) : <SelfRoleManagementNotice />}
      {creditEvidence ? (
        <CreditGrantControls
          userId={userId}
          targetLabel={targetLabel}
          preparedBalance={creditEvidence.preparedBalance}
          automaticInitialCredits={creditEvidence.automaticInitialCredits}
          operationId={operationIds.creditGrant}
        />
      ) : (
        <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
          Background-credit controls are unavailable because verified account or wallet evidence is incomplete. Refresh the account before trying again.
        </p>
      )}
    </div>
  )
}

/** Fails closed unless the Access projection explicitly identifies wallet presence and a safe balance. */
function readCreditGrantEvidence(value: unknown): {
  preparedBalance: number
  automaticInitialCredits: 0 | 2
} | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.balance) || (value.balance as number) < 0) return null
  if (value.state === "AVAILABLE") {
    return { preparedBalance: value.balance as number, automaticInitialCredits: 0 }
  }
  if (value.state === "MISSING" && value.balance === 0) {
    return { preparedBalance: 0, automaticInitialCredits: 2 }
  }
  return null
}

/** Adds only bounded remediation controls beneath the safe Security projection. */
function SecuritySection({
  detail,
  userId,
  targetEmail,
  canManageSecurity,
}: {
  detail: Record<string, unknown>
  userId: string
  targetEmail: string | null
  canManageSecurity: boolean
}) {
  const expectedAuthSessionVersion = safeCount(detail.authSessionVersion)
  const expectedSessionCount = safeCount(detail.compatibilitySessionCount)
  const normalizedTargetEmail = normalizeEmail(targetEmail)
  const operationIds = {
    revokeSessions: randomUUID(),
    passwordReset: randomUUID(),
    twoFactorReset: randomUUID(),
  }
  const supportedState = expectedAuthSessionVersion !== null && expectedSessionCount !== null

  return (
    <div className="space-y-5">
      <DetailSection detail={detail} section="security" />
      <p className="text-sm text-muted-foreground">
        User.authSessionVersion is the canonical sign-in-token invalidation owner. A version increment invalidates older tokens immediately; Auth.js observes the mismatch and signs the user out on the next successful database-backed refresh.
      </p>
      {!canManageSecurity ? <SelfSecurityManagementNotice /> : supportedState ? (
        <SecurityActionControls
          userId={userId}
          targetEmail={normalizedTargetEmail || null}
          emailVerified={detail.emailVerified === true}
          passwordConfigured={detail.passwordConfigured === true}
          twoFactorEnabled={detail.twoFactorEnabled === true}
          expectedAuthSessionVersion={expectedAuthSessionVersion}
          expectedSessionCount={expectedSessionCount}
          operationIds={operationIds}
        />
      ) : (
        <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
          Security controls are unavailable because the current account state is incomplete. Refresh the account before trying again.
        </p>
      )}
    </div>
  )
}

function isAccessRoleEvidence(value: unknown): value is RoleEvidence {
  return isRecord(value) && typeof value.role === "string" && typeof value.status === "string"
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
  if (section === "security") {
    const compatibilitySessionCount = safeCount(detail.compatibilitySessionCount)
    return [
      ["Sign-in provider types", objectValue(detail.providers)], ["Connection rows", objectValue(detail.connections)],
      ["Password configured", yesNo(detail.passwordConfigured)],
      ["Verified email", yesNo(detail.emailVerified)],
      ["Two-factor authentication", yesNo(detail.twoFactorEnabled)],
      ["Compatibility Session rows", `${compatibilitySessionCount === null ? "Unavailable" : compatibilitySessionCount} (adapter evidence only; not a count of active JWT sessions or users signed out)`],
    ]
  }
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

/** Accepts only nonnegative safe integers for optimistic security-state comparisons. */
function safeCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/** Normalizes only the optional client-side comparison value; the server security service remains authoritative. */
function normalizeEmail(value: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}
