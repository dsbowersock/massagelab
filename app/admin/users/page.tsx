import Link from "next/link"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireFullAdminUser } from "@/lib/admin/access"
import {
  getAdminUserMetrics,
  listAdminUsers,
  parseUserDirectoryQuery,
  type AdminUserDirectoryQuery,
} from "@/lib/admin/user-directory"
import { prisma } from "@/lib/prisma"

type UserDirectoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminUserDirectoryPage({ searchParams }: UserDirectoryPageProps) {
  await requireFullAdminUser()
  const query = parseUserDirectoryQuery(toSingleValueQuery(await searchParams))
  const [directory, metrics] = await Promise.all([
    listAdminUsers({ prismaClient: prisma, input: query }),
    getAdminUserMetrics({ prismaClient: prisma }),
  ])

  return (
    <AppPageShell title="User directory" className="p-3 sm:p-6 lg:p-8" contentClassName="gap-4">
      <Card className={appSurfaceClassName}>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">User directory</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Search bounded account-operation details. This view intentionally omits credentials, payment instruments, metadata, and clinical records.
              </p>
            </div>
            <Button asChild variant="outline"><Link href="/admin">Admin dashboard</Link></Button>
          </div>

          <section aria-label="Directory summary" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricCard label="Accounts" value={metrics.totalAccounts} />
            <MetricCard label="Verified accounts" value={metrics.verifiedAccounts} />
            <MetricCard label="Active Supporters" value={metrics.activeSupporters} />
            <MetricCard label="Unresolved operations" value={metrics.unresolvedOperations} />
          </section>

          <form action="/admin/users" method="get" className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Search name, email, or account ID</span>
              <input name="q" defaultValue={query.query} maxLength={100} className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
            </label>
            <DirectorySelect label="Email" name="emailVerified" value={query.emailVerified} options={[["verified", "Verified"], ["unverified", "Unverified"]]} />
            <DirectorySelect label="Credits" name="creditState" value={query.creditState} options={[["positive", "Positive"], ["zero", "Zero"]]} />
            <DirectorySelect label="Role" name="role" value={query.role} options={ROLE_OPTIONS} />
            <DirectorySelect label="Role status" name="roleStatus" value={query.roleStatus} options={ROLE_STATUS_OPTIONS} />
            <DirectorySelect label="Subscription" name="subscriptionStatus" value={query.subscriptionStatus} options={SUBSCRIPTION_STATUS_OPTIONS} />
            <DirectorySelect label="Operations" name="unresolvedIssue" value={query.unresolvedIssue} options={[["yes", "Unresolved"], ["no", "Clear"]]} />
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Results per page</span>
              <select name="pageSize" defaultValue={String(query.pageSize)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">Apply filters</Button>
              <Button asChild type="button" variant="ghost"><Link href="/admin/users">Clear</Link></Button>
            </div>
          </form>

          {directory.items.length === 0 ? (
            <div className={`${appInsetClassName} p-5 text-sm text-muted-foreground`}>
              No accounts match these filters. Adjust the search or clear the filters to return to the directory.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 font-medium">Account</th>
                      <th className="p-3 font-medium">Verification</th>
                      <th className="p-3 font-medium">Roles</th>
                      <th className="p-3 font-medium">Subscription</th>
                      <th className="p-3 font-medium">Credits</th>
                      <th className="p-3 font-medium">Operations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.items.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="p-3"><AccountIdentity user={user} /></td>
                        <td className="p-3">{user.emailVerified ? "Verified" : "Unverified"}</td>
                        <td className="p-3">{rolesLabel(user.roles)}</td>
                        <td className="p-3">{user.subscriptionStatus ?? "None"}</td>
                        <td className="p-3">{user.creditBalance}</td>
                        <td className="p-3">{user.unresolvedIssueCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">
                {directory.items.map((user) => (
                  <article key={user.id} className={`${appInsetClassName} space-y-2 p-3 text-sm`}>
                    <AccountIdentity user={user} />
                    <p>{user.emailVerified ? "Verified" : "Unverified"} · {rolesLabel(user.roles)}</p>
                    <p className="text-muted-foreground">Subscription: {user.subscriptionStatus ?? "None"} · Credits: {user.creditBalance} · Operations: {user.unresolvedIssueCount}</p>
                  </article>
                ))}
              </div>
            </>
          )}

          <nav aria-label="Directory pages" className="flex items-center justify-between gap-3">
            {directory.previousCursor ? (
              <Button asChild variant="outline"><Link href={directoryHref(query, directory.previousCursor)}>Previous</Link></Button>
            ) : <span />}
            {directory.nextCursor ? (
              <Button asChild variant="outline"><Link href={directoryHref(query, directory.nextCursor)}>Next</Link></Button>
            ) : <span />}
          </nav>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}

const ROLE_OPTIONS = [
  ["USER", "User"], ["STUDENT", "Student"], ["LICENSED_THERAPIST", "Licensed therapist"], ["CLIENT", "Client"], ["EDITOR", "Editor"],
  ["ANATOMY_REVIEWER", "Anatomy reviewer"], ["ANATOMY_EDITOR", "Anatomy editor"], ["ADMIN", "Admin"],
] as const
const ROLE_STATUS_OPTIONS = [["verified", "Verified"], ["pending", "Pending"], ["rejected", "Rejected"], ["revoked", "Revoked"]] as const
const SUBSCRIPTION_STATUS_OPTIONS = [
  ["active", "Active"], ["trialing", "Trialing"], ["past_due", "Past due"], ["unpaid", "Unpaid"], ["paused", "Paused"], ["incomplete", "Incomplete"], ["incomplete_expired", "Incomplete expired"], ["canceled", "Canceled"],
] as const

function MetricCard({ label, value }: { label: string; value: number }) {
  return <div className={`${appInsetClassName} p-3`}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value.toLocaleString()}</p></div>
}

function DirectorySelect({ label, name, value, options }: { label: string; name: string; value: string | null; options: ReadonlyArray<readonly [string, string]> }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">Any</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function AccountIdentity({ user }: { user: { id: string; name: string | null; email: string | null } }) {
  return <div><p className="font-medium">{user.name?.trim() || user.email?.trim() || "Unnamed account"}</p><p className="font-mono text-xs text-muted-foreground">{user.email ?? "No email"} · {user.id}</p></div>
}

function rolesLabel(roles: Array<{ role: string; status: string }>) {
  return roles.length ? roles.map((role) => `${role.role} (${role.status.toLowerCase()})`).join(", ") : "None"
}

function toSingleValueQuery(searchParams: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))
}

function directoryHref(query: AdminUserDirectoryQuery, cursor: string) {
  const params = new URLSearchParams()
  if (query.query) params.set("q", query.query)
  if (query.emailVerified) params.set("emailVerified", query.emailVerified)
  if (query.role) params.set("role", query.role)
  if (query.roleStatus) params.set("roleStatus", query.roleStatus)
  if (query.subscriptionStatus) params.set("subscriptionStatus", query.subscriptionStatus)
  if (query.creditState) params.set("creditState", query.creditState)
  if (query.unresolvedIssue) params.set("unresolvedIssue", query.unresolvedIssue)
  params.set("pageSize", String(query.pageSize))
  params.set("cursor", cursor)
  return `/admin/users?${params.toString()}`
}
