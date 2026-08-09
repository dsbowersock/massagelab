import Link from "next/link"
import { notFound } from "next/navigation"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireFullAdminUser } from "@/lib/admin/access"
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
            <DetailSection detail={detail.data} section={section} />
          </section>
        </CardContent>
      </Card>
    </AppPageShell>
  )
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

/** Converts the already privacy-bounded loader result into readable operator labels without exposing hidden fields. */
function detailRows(detail: Record<string, unknown>, section: AdminUserDetailSection): Array<[string, string]> {
  if (section === "security") return [
    ["Sign-in providers", listValue(detail.providers)], ["Password configured", yesNo(detail.passwordConfigured)],
    ["Two-factor authentication", yesNo(detail.twoFactorEnabled)], ["Active sessions", String(detail.activeSessionCount ?? 0)],
  ]
  if (section === "overview") return [
    ["Email verification", yesNo(detail.emailVerified)], ["Profile", objectValue(detail.profile)],
    ["Practice relationships", listValue(detail.practices)], ["Credentials", listValue(detail.credentials)], ["Learning", objectValue(detail.learning)],
  ]
  if (section === "access") return [
    ["Role assignments", listValue(detail.roles)], ["Effective feature keys", listValue(detail.features)],
    ["Credit wallet", objectValue(detail.wallet)], ["Background ownership", objectValue(detail.ownership)],
  ]
  if (section === "billing") return [["Subscriptions", listValue(detail.subscriptions)], ["Commerce summary", objectValue(detail.commerce)]]
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
  if (!value || typeof value !== "object") return String(value ?? "None")
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${humanize(key)}: ${typeof item === "object" ? objectValue(item) : String(item ?? "None")}`)
    .join(", ")
}

function humanize(value: string): string {
  return value.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())
}
