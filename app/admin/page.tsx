import Link from "next/link"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { loadAdminActor } from "@/lib/admin/access"
import { dashboardSections } from "@/lib/admin/dashboard-sections"
import { getAdminUserMetrics } from "@/lib/admin/user-directory"
import { listCommerceAdminOperations } from "@/lib/commerce/admin-service"
import { prisma } from "@/lib/prisma"

type AnatomyReviewMetrics = {
  mediaLinksNeedingReview: number
  rejectedMediaLinks: number
  approvedMediaLinks: number
}

type AnatomyEditorMetrics = {
  openMediaViewRequests: number
  reviewedReusableAssets: number
}

export default async function AdminDashboardPage() {
  const session = await getCurrentSession()
  const actor = await loadAdminActor({
    prismaClient: prisma,
    sessionUserId: session?.user?.id ?? null,
  })
  const sections = dashboardSections(actor ?? { roles: [] })

  if (!actor || sections.length === 0) {
    redirect(session?.user?.id ? "/account" : "/login")
  }

  const visible = new Set(sections)
  const [reviewMetrics, editorMetrics, commerceQueue, userMetrics] = await Promise.all([
    visible.has("anatomy-review") ? getAnatomyReviewMetrics() : Promise.resolve(null),
    visible.has("anatomy") ? getAnatomyEditorMetrics() : Promise.resolve(null),
    visible.has("commerce") ? listCommerceAdminOperations({ prismaClient: prisma }) : Promise.resolve(null),
    visible.has("users") ? getAdminUserMetrics({ prismaClient: prisma }) : Promise.resolve(null),
  ])

  return (
    <AppPageShell title="Admin" className="p-3 sm:p-6 lg:p-8" contentClassName="gap-4">
      <Card className={appSurfaceClassName}>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold leading-tight">Admin dashboard</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Quick entry points for the work your current administrative roles allow.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visible.has("anatomy-review") ? (
                <Button asChild>
                  <Link href="/admin/anatomy/media-review">Review images</Link>
                </Button>
              ) : null}
              {visible.has("anatomy") ? (
                <Button asChild variant="outline">
                  <Link href="/admin/anatomy">Anatomy browser</Link>
                </Button>
              ) : null}
              {commerceQueue ? (
                <Button asChild variant="outline">
                  <Link href="/admin/commerce">Commerce ({commerceQueue.length})</Link>
                </Button>
              ) : null}
            </div>
          </div>

          {reviewMetrics ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Anatomy image review</h2>
                <p className="text-sm text-muted-foreground">
                  Review linked images before they are allowed back into flashcard prompts.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                <DashboardMetric label="Needs review" value={reviewMetrics.mediaLinksNeedingReview} href="/admin/anatomy/media-review?status=needs-review" />
                <DashboardMetric label="Rejected" value={reviewMetrics.rejectedMediaLinks} href="/admin/anatomy/media-review?status=rejected" />
                <DashboardMetric label="Approved" value={reviewMetrics.approvedMediaLinks} href="/admin/anatomy/media-review?status=approved" />
              </div>
            </section>
          ) : null}

          {editorMetrics ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Anatomy editing</h2>
                <p className="text-sm text-muted-foreground">
                  Inspect anatomy content, source records, requests, and reusable assets.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DashboardMetric label="Open requests" value={editorMetrics.openMediaViewRequests} href="/admin/anatomy?view=maintenance" />
                <DashboardMetric label="Reusable assets" value={editorMetrics.reviewedReusableAssets} href="/admin/anatomy?view=queries&quick=has-open-media" />
              </div>
            </section>
          ) : null}

          {userMetrics ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Account operations</h2>
                <p className="text-sm text-muted-foreground">Safe aggregate account and support-operation counts.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                <DashboardStat>{userMetrics.totalAccounts.toLocaleString()} total accounts</DashboardStat>
                <DashboardStat>{userMetrics.verifiedAccounts.toLocaleString()} verified accounts</DashboardStat>
                <DashboardStat>{userMetrics.activeSupporters.toLocaleString()} active Supporters</DashboardStat>
                <DashboardStat>{userMetrics.unresolvedOperations.toLocaleString()} unresolved operations</DashboardStat>
                <DashboardStat>{userMetrics.activeTemporaryGrants.toLocaleString()} active temporary grants</DashboardStat>
                <DashboardStat>{userMetrics.expiringTemporaryGrants.toLocaleString()} temporary grants expiring within 30 days</DashboardStat>
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-3">
            {visible.has("users") ? (
              <DashboardAction
                href="/admin/users"
                title="User operations"
                description="Search account-operation details with bounded filters, while keeping credentials, payment instruments, metadata, and clinical records out of this surface."
              />
            ) : null}
            {visible.has("anatomy-review") ? (
              <DashboardAction
                href="/admin/anatomy/media-review"
                title="Fast image review"
                description="Approve, reject, or request a better BodyParts3D view from a phone-friendly queue."
              />
            ) : null}
            {visible.has("anatomy") ? (
              <DashboardAction
                href="/admin/anatomy"
                title="Full anatomy browser"
                description="Search and inspect anatomy data, citations, IDs, media, relationships, and source records."
              />
            ) : null}
            {visible.has("anatomy") ? (
              <DashboardAction
                href="/admin/anatomy?view=maintenance"
                title="Maintenance"
                description="Check correction flags, source records, open media requests, and review-oriented admin lists."
              />
            ) : null}
            {commerceQueue ? (
              <DashboardAction
                href="/admin/commerce"
                title={`Commerce (${commerceQueue.length})`}
                description="Review payment exceptions, pending refunds, disputes, and reconciliation states."
              />
            ) : null}
          </section>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}
async function getAnatomyReviewMetrics(): Promise<AnatomyReviewMetrics> {
  const [mediaLinksNeedingReview, rejectedMediaLinks, approvedMediaLinks] = await Promise.all([
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "NEEDS_REVIEW" } }),
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "REJECTED" } }),
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "APPROVED" } }),
  ])

  return { mediaLinksNeedingReview, rejectedMediaLinks, approvedMediaLinks }
}

async function getAnatomyEditorMetrics(): Promise<AnatomyEditorMetrics> {
  const [openMediaViewRequests, reviewedReusableAssets] = await Promise.all([
    prisma.anatomyMediaViewRequest.count({ where: { status: "OPEN" } }),
    prisma.anatomyMediaAsset.count({ where: { usageScope: "OPEN_REUSE", reviewStatus: "REVIEWED" } }),
  ])

  return { openMediaViewRequests, reviewedReusableAssets }
}

function DashboardMetric({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className={`${appInsetClassName} block p-3 transition hover:border-primary/60 hover:bg-accent`}>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value.toLocaleString()}</p>
    </Link>
  )
}
function DashboardStat({ children }: { children: ReactNode }) {
  return <p className={`${appInsetClassName} p-3 text-sm font-medium`}>{children}</p>
}
function DashboardAction({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Button asChild variant="outline" className="h-auto items-start justify-start whitespace-normal p-4 text-left">
      <Link href={href}>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">{description}</span>
        </span>
      </Link>
    </Button>
  )
}
