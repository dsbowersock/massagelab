import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import type { AccountRole } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type AdminDashboardMetrics = {
  mediaLinksNeedingReview: number
  rejectedMediaLinks: number
  approvedMediaLinks: number
  openMediaViewRequests: number
  reviewedReusableAssets: number
}

export default async function AdminDashboardPage() {
  await requireAdminDashboardAccess()
  const metrics = await getAdminDashboardMetrics()

  return (
    <AppPageShell title="Admin" className="p-3 sm:p-6 lg:p-8" contentClassName="gap-4">
      <Card className={appSurfaceClassName}>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold leading-tight">Admin dashboard</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Quick entry points for the admin work that needs attention first.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/anatomy/media-review">Review images</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/anatomy">Anatomy browser</Link>
              </Button>
            </div>
          </div>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Anatomy image work</h2>
              <p className="text-sm text-muted-foreground">
                Review linked images before they are allowed back into flashcard prompts.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              <DashboardMetric label="Needs review" value={metrics.mediaLinksNeedingReview} href="/admin/anatomy/media-review?status=needs-review" />
              <DashboardMetric label="Rejected" value={metrics.rejectedMediaLinks} href="/admin/anatomy/media-review?status=rejected" />
              <DashboardMetric label="Approved" value={metrics.approvedMediaLinks} href="/admin/anatomy/media-review?status=approved" />
              <DashboardMetric label="Open requests" value={metrics.openMediaViewRequests} href="/admin/anatomy?view=maintenance" />
              <DashboardMetric label="Reusable assets" value={metrics.reviewedReusableAssets} href="/admin/anatomy?view=queries&quick=has-open-media" />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <DashboardAction
              href="/admin/anatomy/media-review"
              title="Fast image review"
              description="Approve, reject, or request a better BodyParts3D view from a phone-friendly queue."
            />
            <DashboardAction
              href="/admin/anatomy"
              title="Full anatomy browser"
              description="Search and inspect all anatomy data, citations, IDs, media, relationships, and source records."
            />
            <DashboardAction
              href="/admin/anatomy?view=maintenance"
              title="Maintenance"
              description="Check correction flags, source records, open media requests, and review-oriented admin lists."
            />
          </section>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}

async function requireAdminDashboardAccess() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const roles = await prisma.userRole.findMany({
    where: { userId: session.user.id },
    select: { role: true },
  })
  const roleValues = (roles as Array<{ role: AccountRole }>).map((roleRow) => roleRow.role)

  if (!canManageAnatomyContent(roleValues)) {
    redirect("/account")
  }
}

async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const [
    mediaLinksNeedingReview,
    rejectedMediaLinks,
    approvedMediaLinks,
    openMediaViewRequests,
    reviewedReusableAssets,
  ] = await Promise.all([
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "NEEDS_REVIEW" } }),
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "REJECTED" } }),
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "APPROVED" } }),
    prisma.anatomyMediaViewRequest.count({ where: { status: "OPEN" } }),
    prisma.anatomyMediaAsset.count({ where: { usageScope: "OPEN_REUSE", reviewStatus: "REVIEWED" } }),
  ])

  return {
    mediaLinksNeedingReview,
    rejectedMediaLinks,
    approvedMediaLinks,
    openMediaViewRequests,
    reviewedReusableAssets,
  }
}

function DashboardMetric({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className={`${appInsetClassName} block p-3 transition hover:border-primary/60 hover:bg-accent`}>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value.toLocaleString()}</p>
    </Link>
  )
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
