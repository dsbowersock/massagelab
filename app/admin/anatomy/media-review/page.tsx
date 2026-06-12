import Link from "next/link"
import { redirect } from "next/navigation"
import type { AnatomyMediaReviewStatus, Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import {
  ANATOMY_MEDIA_REVIEW_REASONS,
  ANATOMY_MEDIA_VIEW_REQUEST_REASONS,
  ANATOMY_MEDIA_VIEW_REQUEST_VIEWS,
  bodyParts3dComposerUrl,
  normalizeAnatomyMediaViewRequestView,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dImageUrl,
} from "@/lib/anatomy-media-review"
import type { AccountRole } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"
import { reviewAnatomyMediaQueueDecisionAction } from "@/app/admin/anatomy/actions"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type AnatomyMediaReviewQueuePageProps = {
  searchParams?: Promise<{
    status?: string
    offset?: string
  }>
}

type QueueStatusKey = "needs-review" | "rejected" | "approved" | "all"

type QueueStatusOption = {
  key: QueueStatusKey
  label: string
  reviewStatus: AnatomyMediaReviewStatus | null
}

type MediaQueueRow = {
  id: string
  entityType: string
  entitySlug: string
  role: string
  notes: string | null
  reviewStatus: string
  reviewReason: string | null
  reviewNote: string | null
  displayPriority: number
  asset: Record<string, unknown>
}

type QueueData = {
  rows: MediaQueueRow[]
  total: number
  allCount: number
  needsReviewCount: number
  rejectedCount: number
  approvedCount: number
  openRequestCount: number
}

const QUEUE_STATUS_OPTIONS: QueueStatusOption[] = [
  { key: "needs-review", label: "Needs Review", reviewStatus: "NEEDS_REVIEW" },
  { key: "rejected", label: "Rejected", reviewStatus: "REJECTED" },
  { key: "approved", label: "Approved", reviewStatus: "APPROVED" },
  { key: "all", label: "All", reviewStatus: null },
]

const QUEUE_TAKE = 6

export default async function AnatomyMediaReviewQueuePage({ searchParams }: AnatomyMediaReviewQueuePageProps) {
  await requireAnatomyAdminAccess()

  const params = await searchParams
  const selectedStatus = queueStatusFromParam(params?.status)
  const offset = queueOffsetFromParam(params?.offset)
  const data = await getMediaReviewQueueData(selectedStatus, offset)

  if (data.rows.length === 0 && data.total > 0 && offset > 0) {
    redirect(mediaReviewQueueHref(selectedStatus.key))
  }

  const currentRow = data.rows[0] ?? null
  const upcomingRows = data.rows.slice(1)

  return (
    <AppPageShell width="standard" className="p-0 sm:p-6 lg:p-8" contentClassName="gap-0 sm:gap-5">
      <div className="sticky top-0 z-20 border-b border-border/80 bg-background/95 p-3 shadow-lg shadow-black/20 backdrop-blur sm:static sm:rounded-md sm:border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Image review queue</h1>
            <p className="text-xs text-muted-foreground">{data.total} in {selectedStatus.label.toLowerCase()} queue</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin">Dashboard</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/anatomy">Browser</Link>
            </Button>
          </div>
        </div>
        <QueueStatusTabs selectedStatus={selectedStatus} data={data} />
      </div>

      <main className="space-y-3 p-3 sm:p-0">
        <QueueSummary data={data} />
        {currentRow ? (
          <ImageReviewCard row={currentRow} selectedStatus={selectedStatus} offset={offset} upcomingRows={upcomingRows} />
        ) : (
          <EmptyQueue selectedStatus={selectedStatus} />
        )}
      </main>
    </AppPageShell>
  )
}

async function requireAnatomyAdminAccess() {
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

async function getMediaReviewQueueData(selectedStatus: QueueStatusOption, offset: number): Promise<QueueData> {
  const where: Prisma.AnatomyMediaEntityWhereInput = selectedStatus.reviewStatus
    ? { reviewStatus: selectedStatus.reviewStatus }
    : {}

  const [
    rows,
    total,
    allCount,
    needsReviewCount,
    rejectedCount,
    approvedCount,
    openRequestCount,
  ] = await Promise.all([
    prisma.anatomyMediaEntity.findMany({
      where,
      include: {
        asset: {
          include: {
            source: true,
          },
        },
      },
      orderBy: [
        { reviewStatus: "asc" },
        { displayPriority: "asc" },
        { createdAt: "asc" },
      ],
      skip: offset,
      take: QUEUE_TAKE,
    }),
    prisma.anatomyMediaEntity.count({ where }),
    prisma.anatomyMediaEntity.count(),
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "NEEDS_REVIEW" } }),
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "REJECTED" } }),
    prisma.anatomyMediaEntity.count({ where: { reviewStatus: "APPROVED" } }),
    prisma.anatomyMediaViewRequest.count({ where: { status: "OPEN" } }),
  ])

  return {
    rows: rows as unknown as MediaQueueRow[],
    total,
    allCount,
    needsReviewCount,
    rejectedCount,
    approvedCount,
    openRequestCount,
  }
}

function QueueStatusTabs({ selectedStatus, data }: { selectedStatus: QueueStatusOption; data: QueueData }) {
  const counts: Record<QueueStatusKey, number> = {
    "needs-review": data.needsReviewCount,
    rejected: data.rejectedCount,
    approved: data.approvedCount,
    all: data.allCount,
  }

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {QUEUE_STATUS_OPTIONS.map((status) => (
        <Button key={status.key} asChild size="sm" variant={selectedStatus.key === status.key ? "default" : "outline"} className="shrink-0">
          <Link href={mediaReviewQueueHref(status.key)}>
            {status.label} ({counts[status.key]})
          </Link>
        </Button>
      ))}
    </div>
  )
}

function QueueSummary({ data }: { data: QueueData }) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <QueueMetric label="Needs review" value={data.needsReviewCount} />
      <QueueMetric label="Rejected" value={data.rejectedCount} />
      <QueueMetric label="Approved" value={data.approvedCount} />
      <QueueMetric label="Open requests" value={data.openRequestCount} href="/admin/anatomy?view=maintenance" />
    </section>
  )
}

function QueueMetric({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value.toLocaleString()}</p>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={`${appInsetClassName} block p-3 transition hover:border-primary/60 hover:bg-accent`}>
        {content}
      </Link>
    )
  }

  return <div className={`${appInsetClassName} p-3`}>{content}</div>
}

function ImageReviewCard({
  row,
  selectedStatus,
  offset,
  upcomingRows,
}: {
  row: MediaQueueRow
  selectedStatus: QueueStatusOption
  offset: number
  upcomingRows: MediaQueueRow[]
}) {
  const asset = row.asset
  const previewUrl = mediaPreviewUrl(asset)
  const sourceUrl = mediaBodyParts3dSourceUrl(asset)
  const composerUrl = mediaBodyParts3dComposerUrl(asset)
  const metadataLine = mediaMetadataLine(asset)
  const currentView = mediaViewFromAsset(asset)
  const browserHref = anatomyBrowserHref(row.entityType, row.entitySlug)
  const skipHref = mediaReviewQueueHref(selectedStatus.key, offset + 1)

  return (
    <Card className={appSurfaceClassName}>
      <CardContent className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-md border border-border/80 bg-white">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- anatomy media previews may come from R2 or reviewed external source URLs.
              <img src={previewUrl} alt={recordText(asset, "title") || "Anatomy media preview"} className="h-auto max-h-[68vh] min-h-[18rem] w-full object-contain p-2" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid min-h-[18rem] place-items-center p-4 text-center text-sm text-muted-foreground">No preview URL</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={skipHref}>Skip</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={browserHref}>Open item</Link>
            </Button>
            {composerUrl ? <ExternalButton href={composerUrl}>BodyParts3D</ExternalButton> : null}
            {sourceUrl ? <ExternalButton href={sourceUrl}>Generated image</ExternalButton> : null}
            {previewUrl && previewUrl !== sourceUrl ? <ExternalButton href={previewUrl}>Stored image</ExternalButton> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">{formatLabel(row.entityType)} / {formatLabel(row.role)}</p>
            <h2 className="text-xl font-semibold leading-tight">{titleFromSlug(row.entitySlug)}</h2>
            <p className="break-words text-sm font-medium">{recordText(asset, "title") || recordText(asset, "slug")}</p>
            <p className="text-sm text-muted-foreground">
              {[formatLabel(recordText(asset, "mediaType")), sourceLabel(asset), formatLabel(row.reviewStatus)].filter(Boolean).join(" / ")}
            </p>
            {metadataLine ? <p className="text-sm text-muted-foreground">{metadataLine}</p> : null}
            {row.reviewReason ? <p className="text-sm text-muted-foreground">Current reason: {formatLabel(row.reviewReason)}</p> : null}
            {row.reviewNote ? <p className="rounded-md border border-border/80 bg-muted/30 p-2 text-sm text-muted-foreground">{row.reviewNote}</p> : null}
          </div>

          <QuickApproveForm row={row} selectedStatus={selectedStatus} offset={offset} />
          <NeedsBetterViewForm row={row} selectedStatus={selectedStatus} offset={offset} currentView={currentView} />
          <RejectImageForm row={row} selectedStatus={selectedStatus} offset={offset} />

          {upcomingRows.length > 0 ? (
            <div className={`${appInsetClassName} p-3`}>
              <p className="text-sm font-medium">Next in queue</p>
              <div className="mt-2 space-y-2">
                {upcomingRows.slice(0, 4).map((upcomingRow, index) => (
                  <Link key={upcomingRow.id} href={mediaReviewQueueHref(selectedStatus.key, offset + index + 1)} className="block rounded-md border border-border/70 p-2 text-sm transition hover:border-primary/60 hover:bg-accent">
                    <span className="font-medium">{titleFromSlug(upcomingRow.entitySlug)}</span>
                    <span className="block text-xs text-muted-foreground">{formatLabel(upcomingRow.role)} / {formatLabel(upcomingRow.reviewStatus)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function QuickApproveForm({ row, selectedStatus, offset }: { row: MediaQueueRow; selectedStatus: QueueStatusOption; offset: number }) {
  return (
    <form action={reviewAnatomyMediaQueueDecisionAction}>
      <BaseDecisionFields row={row} selectedStatus={selectedStatus} offset={queueOffsetAfterDecision(selectedStatus, offset, "APPROVED")} reviewStatus="APPROVED" />
      <Button type="submit" className="h-12 w-full text-base">Approve image</Button>
    </form>
  )
}

function NeedsBetterViewForm({
  row,
  selectedStatus,
  offset,
  currentView,
}: {
  row: MediaQueueRow
  selectedStatus: QueueStatusOption
  offset: number
  currentView: string
}) {
  return (
    <form action={reviewAnatomyMediaQueueDecisionAction} className={`${appInsetClassName} space-y-3 p-3`}>
      <BaseDecisionFields row={row} selectedStatus={selectedStatus} offset={queueOffsetAfterDecision(selectedStatus, offset, "NEEDS_REVIEW")} reviewStatus="NEEDS_REVIEW" />
      <input type="hidden" name="create_view_request" value="1" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`better-view-reason-${row.id}`}
          name="review_reason"
          label="Flag reason"
          values={ANATOMY_MEDIA_REVIEW_REASONS}
          defaultValue={row.reviewReason || "too_tight"}
        />
        <SelectField
          id={`better-view-request-${row.id}`}
          name="requested_view"
          label="View needed"
          values={ANATOMY_MEDIA_VIEW_REQUEST_VIEWS}
          defaultValue={currentView}
        />
      </div>
      <SelectField
        id={`better-view-request-reason-${row.id}`}
        name="request_reason"
        label="Request type"
        values={ANATOMY_MEDIA_VIEW_REQUEST_REASONS}
        defaultValue="too_tight"
      />
      <div className="space-y-2">
        <Label htmlFor={`better-view-note-${row.id}`}>What needs to be better?</Label>
        <Textarea
          id={`better-view-note-${row.id}`}
          name="review_note"
          rows={3}
          defaultValue={row.reviewNote ?? ""}
          placeholder="Example: wider lateral view with the whole foot visible and the target muscle not touching the edge."
        />
      </div>
      <input type="hidden" name="request_note" value="" />
      <Button type="submit" variant="secondary" className="h-12 w-full text-base">Needs better view</Button>
    </form>
  )
}

function RejectImageForm({ row, selectedStatus, offset }: { row: MediaQueueRow; selectedStatus: QueueStatusOption; offset: number }) {
  return (
    <form action={reviewAnatomyMediaQueueDecisionAction} className={`${appInsetClassName} space-y-3 p-3`}>
      <BaseDecisionFields row={row} selectedStatus={selectedStatus} offset={queueOffsetAfterDecision(selectedStatus, offset, "REJECTED")} reviewStatus="REJECTED" />
      <SelectField
        id={`reject-reason-${row.id}`}
        name="review_reason"
        label="Reject reason"
        values={ANATOMY_MEDIA_REVIEW_REASONS}
        defaultValue={row.reviewReason || "bad_match"}
      />
      <div className="space-y-2">
        <Label htmlFor={`reject-note-${row.id}`}>Review note</Label>
        <Textarea id={`reject-note-${row.id}`} name="review_note" rows={2} defaultValue={row.reviewNote ?? ""} placeholder="Short note about what is wrong." />
      </div>
      <Button type="submit" variant="destructive" className="h-12 w-full text-base">Reject image</Button>
    </form>
  )
}

/**
 * Advances after a decision only when the reviewed row remains visible in the
 * active queue; otherwise the next row shifts into the current offset.
 */
function queueOffsetAfterDecision(selectedStatus: QueueStatusOption, offset: number, nextReviewStatus: AnatomyMediaReviewStatus) {
  const rowRemainsInCurrentQueue = selectedStatus.key === "all" || selectedStatus.reviewStatus === nextReviewStatus

  return rowRemainsInCurrentQueue ? offset + 1 : offset
}

function BaseDecisionFields({
  row,
  selectedStatus,
  offset,
  reviewStatus,
}: {
  row: MediaQueueRow
  selectedStatus: QueueStatusOption
  offset: number
  reviewStatus: AnatomyMediaReviewStatus
}) {
  return (
    <>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="review_status" value={reviewStatus} />
      <input type="hidden" name="display_priority" value={String(row.displayPriority)} />
      <input type="hidden" name="notes" value={row.notes ?? ""} />
      <input type="hidden" name="queue_status" value={selectedStatus.key} />
      <input type="hidden" name="queue_offset" value={String(offset)} />
      {reviewStatus === "APPROVED" ? <input type="hidden" name="review_note" value="" /> : null}
    </>
  )
}

function SelectField({
  id,
  name,
  label,
  values,
  defaultValue,
}: {
  id: string
  name: string
  label: string
  values: readonly string[]
  defaultValue: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={name} defaultValue={defaultValue} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        {values.map((value) => (
          <option key={value} value={value}>
            {formatLabel(value)}
          </option>
        ))}
      </select>
    </div>
  )
}

function EmptyQueue({ selectedStatus }: { selectedStatus: QueueStatusOption }) {
  return (
    <Card className={appSurfaceClassName}>
      <CardContent className="p-5 text-center">
        <h2 className="text-lg font-semibold">No images in this queue</h2>
        <p className="mt-2 text-sm text-muted-foreground">There are no {selectedStatus.label.toLowerCase()} item-image links to review right now.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/admin">Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={mediaReviewQueueHref("all")}>Browse all images</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noreferrer">{children}</a>
    </Button>
  )
}

function queueStatusFromParam(value: string | undefined): QueueStatusOption {
  return QUEUE_STATUS_OPTIONS.find((status) => status.key === value) ?? QUEUE_STATUS_OPTIONS[0]
}

function queueOffsetFromParam(value: string | undefined) {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
}

function mediaReviewQueueHref(status: QueueStatusKey, offset = 0) {
  const params = new URLSearchParams()
  params.set("status", status)
  if (offset > 0) params.set("offset", String(offset))

  return `/admin/anatomy/media-review?${params.toString()}`
}

function anatomyBrowserHref(entityType: string, entitySlug: string) {
  const params = new URLSearchParams()
  params.set("entityType", entityType)
  params.set("entitySlug", entitySlug)

  return `/admin/anatomy?${params.toString()}`
}

function mediaPreviewUrl(asset: Record<string, unknown>) {
  return recordText(asset, "remoteUrl") || recordText(asset, "thumbnailUrl") || recordText(asset, "sourceUrl")
}

function mediaBodyParts3dSourceUrl(asset: Record<string, unknown>) {
  const sourceUrl = safeBodyParts3dImageUrl(recordText(asset, "sourceUrl"))
  if (sourceUrl) return sourceUrl

  const metadata = recordObject(asset, "metadata")
  return safeBodyParts3dImageUrl(recordText(metadata, "bodyparts3dSourceUrl") || recordText(metadata, "sourceUrl"))
}

function mediaBodyParts3dComposerUrl(asset: Record<string, unknown>) {
  const metadata = recordObject(asset, "metadata")
  const partIds = normalizeBodyParts3dPartIds(recordStringArray(metadata, "bodyparts3dPartIds"))

  if (partIds.length === 0) {
    return ""
  }

  return bodyParts3dComposerUrl({
    partIds,
    treeName: recordText(metadata, "bodyparts3dTreeName") === "partof" ? "partof" : "isa",
  })
}

function mediaMetadataLine(asset: Record<string, unknown>) {
  const metadata = recordObject(asset, "metadata")
  const view = recordText(metadata, "bodyparts3dViewTitle") || formatLabel(recordText(metadata, "bodyparts3dView"))
  const partIds = recordStringArray(metadata, "bodyparts3dPartIds")

  return [
    view ? `View: ${view}` : "",
    partIds.length > 0 ? `Parts: ${partIds.join(", ")}` : "",
  ].filter(Boolean).join(" / ")
}

function mediaViewFromAsset(asset: Record<string, unknown>) {
  const metadata = recordObject(asset, "metadata")
  return normalizeAnatomyMediaViewRequestView(recordText(metadata, "bodyparts3dView"))
}

function sourceLabel(asset: Record<string, unknown>) {
  return relationText(asset, "source", "label") || relationText(asset, "source", "slug")
}

function formatLabel(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : ""
}

function titleFromSlug(value: string) {
  return formatLabel(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

function recordText(row: unknown, key: string) {
  const value = asRecord(row)[key]

  if (value === null || value === undefined) {
    return ""
  }

  return String(value)
}

function relationText(row: unknown, relationKey: string, valueKey: string) {
  return recordText(asRecord(row)[relationKey], valueKey)
}

function recordObject(row: unknown, key: string) {
  const value = asRecord(row)[key]
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function recordStringArray(row: unknown, key: string) {
  const value = asRecord(row)[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => String(item)).filter(Boolean)
}
