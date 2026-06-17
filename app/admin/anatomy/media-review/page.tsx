import Link from "next/link"
import { redirect } from "next/navigation"
import type { AnatomyEntityType, AnatomyMediaReviewStatus, AnatomyMediaType, Prisma } from "@prisma/client"
import { requireAnatomyAdminUser } from "@/lib/anatomy-admin-access"
import {
  ANATOMY_MEDIA_REVIEW_REASONS,
  ANATOMY_MEDIA_VIEW_REQUEST_REASONS,
  ANATOMY_MEDIA_VIEW_REQUEST_VIEWS,
  bodyParts3dComposerUrl,
  normalizeAnatomyMediaViewRequestView,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dRenderableImageUrl,
} from "@/lib/anatomy-media-review"
import {
  MEDIA_REVIEW_QUEUE_ENTITY_TYPES,
  MEDIA_REVIEW_QUEUE_PRESETS,
  MEDIA_REVIEW_QUEUE_REASONS,
  MEDIA_REVIEW_QUEUE_REQUESTS,
  MEDIA_REVIEW_QUEUE_SORTS,
  MEDIA_REVIEW_QUEUE_STATUS_OPTIONS,
  MEDIA_REVIEW_QUEUE_VIEWS,
  activeMediaReviewQueueChips,
  mediaReviewQueueFormFields,
  mediaReviewQueueHref,
  parseMediaReviewQueueFilters,
} from "@/lib/anatomy-media-review-queue"
import { ANATOMY_STUDY_CATEGORIES, getAnatomyStudyCards, type AnatomyStudyCategory } from "@/lib/anatomy-study"
import { prisma } from "@/lib/prisma"
import { reviewAnatomyMediaQueueDecisionAction } from "@/app/admin/anatomy/actions"
import { ReviewImagePreview } from "@/app/admin/anatomy/media-review/review-image-preview"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type AnatomyMediaReviewQueuePageProps = {
  searchParams?: Promise<{
    status?: string
    preset?: string
    entityType?: string
    reason?: string
    view?: string
    request?: string
    sort?: string
    q?: string
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
  linkedImages: LinkedImageSummary[]
}

type LinkedImageSummary = {
  id: string
  role: string
  reviewStatus: string
  reviewReason: string | null
  displayPriority: number
  asset: Record<string, unknown>
}

type QueueData = {
  rows: MediaQueueRow[]
  total: number
  filteredTotal: number
  allCount: number
  needsReviewCount: number
  rejectedCount: number
  approvedCount: number
  openRequestCount: number
}

const QUEUE_TAKE = 6
const IMAGE_REVIEW_MEDIA_TYPES = ["IMAGE", "DIAGRAM"] as const satisfies AnatomyMediaType[]
const STUDY_CATEGORY_KEYS = new Set<string>(ANATOMY_STUDY_CATEGORIES)
const STUDY_CATEGORY_TO_ENTITY_TYPE: Record<string, AnatomyEntityType> = {
  bone: "BONE",
  bone_landmark: "BONE_LANDMARK",
  joint: "JOINT",
  joint_movement: "JOINT_MOVEMENT",
  range_of_motion: "RANGE_OF_MOTION",
  muscle: "MUSCLE",
  muscle_attachment: "MUSCLE_ATTACHMENT",
  muscle_action: "MUSCLE_ACTION",
  nerve: "NERVE",
  muscle_innervation: "MUSCLE_INNERVATION",
  ligament: "LIGAMENT",
  anatomy_structure: "ANATOMY_STRUCTURE",
  anatomy_concept: "ANATOMY_CONCEPT",
  pain_map_region: "PAIN_MAP_REGION",
}

export default async function AnatomyMediaReviewQueuePage({ searchParams }: AnatomyMediaReviewQueuePageProps) {
  await requireAnatomyAdminUser()

  const params = await searchParams
  const filters = parseMediaReviewQueueFilters(params ?? {})
  const selectedStatus = (MEDIA_REVIEW_QUEUE_STATUS_OPTIONS.find((status) => status.key === filters.status) ?? MEDIA_REVIEW_QUEUE_STATUS_OPTIONS[0]) as QueueStatusOption
  const data = await getMediaReviewQueueData(filters)

  if (data.rows.length === 0 && data.filteredTotal > 0 && filters.offset > 0) {
    redirect(mediaReviewQueueHref(filters, { offset: 0 }))
  }

  const currentRow = data.rows[0] ?? null
  const upcomingRows = data.rows.slice(1)

  return (
    <AppPageShell width="standard" className="p-0 sm:p-6 lg:p-8" contentClassName="gap-0 sm:gap-5">
      <div className="sticky top-0 z-20 border-b border-border/80 bg-background/95 p-3 shadow-lg shadow-black/20 backdrop-blur sm:static sm:rounded-md sm:border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Image review queue</h1>
            <p className="text-xs text-muted-foreground">
              {data.filteredTotal.toLocaleString()} in this batch / {data.total.toLocaleString()} in {selectedStatus.label.toLowerCase()} queue
            </p>
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
        <QueueStatusTabs selectedStatus={selectedStatus} data={data} filters={filters} />
        <QueuePresetLinks filters={filters} />
        <QueueActiveFilters filters={filters} />
        <QueueAdvancedFilters filters={filters} />
      </div>

      <main className="space-y-3 p-3 sm:p-0">
        <QueueSummary data={data} />
        {currentRow ? (
          <ImageReviewCard row={currentRow} filters={filters} upcomingRows={upcomingRows} />
        ) : (
          <EmptyQueue selectedStatus={selectedStatus} />
        )}
      </main>
    </AppPageShell>
  )
}

/**
 * Resolves public study preset filters into admin media-link filters while
 * retaining explicit entity-type batches that are not part of public cards.
 */
function entityFiltersForQueueFilters(filters: ReturnType<typeof parseMediaReviewQueueFilters>): Prisma.AnatomyMediaEntityWhereInput[] {
  const studyCategories = filters.categories.filter((category): category is AnatomyStudyCategory => STUDY_CATEGORY_KEYS.has(category))
  const cards = getAnatomyStudyCards({
    ...(studyCategories.length > 0 ? { categories: studyCategories } : {}),
    regions: filters.regions,
    difficulty: "hard",
  })
  const entityFilters = new Map<string, Prisma.AnatomyMediaEntityWhereInput>()

  for (const card of cards) {
    const entityType = STUDY_CATEGORY_TO_ENTITY_TYPE[card.entityType]
    if (!entityType) continue
    const key = `${entityType}:${card.entitySlug}`
    entityFilters.set(key, { entityType, entitySlug: card.entitySlug })
  }

  for (const entityType of filters.entityTypes) {
    entityFilters.set(`type:${entityType}`, { entityType: entityType as AnatomyEntityType })
  }

  return [...entityFilters.values()]
}

async function openRequestEntityFilters() {
  const rows = await prisma.anatomyMediaViewRequest.findMany({
    where: { status: "OPEN" },
    select: {
      entityType: true,
      entitySlug: true,
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  })

  return rows.map((row) => ({
    entityType: row.entityType,
    entitySlug: row.entitySlug,
  }))
}

async function mediaReviewQueueWhere(filters: ReturnType<typeof parseMediaReviewQueueFilters>) {
  const andFilters: Prisma.AnatomyMediaEntityWhereInput[] = [
    { asset: { mediaType: { in: IMAGE_REVIEW_MEDIA_TYPES } } },
  ]

  if (filters.reviewStatus) andFilters.push({ reviewStatus: filters.reviewStatus as AnatomyMediaReviewStatus })
  if (filters.reason) andFilters.push({ reviewReason: filters.reason })
  if (filters.view) {
    andFilters.push({
      asset: {
        metadata: {
          path: ["bodyparts3dView"],
          equals: filters.view,
        },
      },
    })
  }
  if (filters.q) {
    andFilters.push({
      OR: [
        { entitySlug: { contains: filters.q, mode: "insensitive" } },
        { asset: { title: { contains: filters.q, mode: "insensitive" } } },
        { asset: { slug: { contains: filters.q, mode: "insensitive" } } },
        { asset: { source: { label: { contains: filters.q, mode: "insensitive" } } } },
        { asset: { source: { slug: { contains: filters.q, mode: "insensitive" } } } },
      ],
    })
  }

  const entityFilters = entityFiltersForQueueFilters(filters)
  if (filters.request === "open") {
    const requestEntityFilters = await openRequestEntityFilters()
    if (requestEntityFilters.length === 0) andFilters.push({ id: "__no-open-request-media-review-rows__" })
    else andFilters.push({ OR: requestEntityFilters })
  }
  if (entityFilters.length > 0) {
    andFilters.push({ OR: entityFilters })
  }

  return { AND: andFilters } satisfies Prisma.AnatomyMediaEntityWhereInput
}

function mediaReviewQueueOrderBy(filters: ReturnType<typeof parseMediaReviewQueueFilters>): Prisma.AnatomyMediaEntityOrderByWithRelationInput[] {
  switch (filters.sort) {
    case "newest":
      return [{ createdAt: "desc" }]
    case "oldest":
      return [{ createdAt: "asc" }]
    case "entity":
      return [{ entitySlug: "asc" }, { displayPriority: "asc" }, { createdAt: "asc" }]
    case "priority":
    default:
      return [{ reviewStatus: "asc" }, { displayPriority: "asc" }, { createdAt: "asc" }]
  }
}

async function getMediaReviewQueueData(filters: ReturnType<typeof parseMediaReviewQueueFilters>): Promise<QueueData> {
  const where = await mediaReviewQueueWhere(filters)
  const imageReviewWhere: Prisma.AnatomyMediaEntityWhereInput = {
    asset: { mediaType: { in: IMAGE_REVIEW_MEDIA_TYPES } },
  }
  const statusWhere: Prisma.AnatomyMediaEntityWhereInput = {
    ...imageReviewWhere,
    ...(filters.reviewStatus ? { reviewStatus: filters.reviewStatus as AnatomyMediaReviewStatus } : {}),
  }

  const [
    rows,
    filteredTotal,
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
      orderBy: mediaReviewQueueOrderBy(filters),
      skip: filters.offset,
      take: QUEUE_TAKE,
    }),
    prisma.anatomyMediaEntity.count({ where }),
    prisma.anatomyMediaEntity.count({ where: statusWhere }),
    prisma.anatomyMediaEntity.count({ where: imageReviewWhere }),
    prisma.anatomyMediaEntity.count({ where: { ...imageReviewWhere, reviewStatus: "NEEDS_REVIEW" } }),
    prisma.anatomyMediaEntity.count({ where: { ...imageReviewWhere, reviewStatus: "REJECTED" } }),
    prisma.anatomyMediaEntity.count({ where: { ...imageReviewWhere, reviewStatus: "APPROVED" } }),
    prisma.anatomyMediaViewRequest.count({ where: { status: "OPEN" } }),
  ])

  const linkedImagesByEntity = await linkedImageSummariesForRows(rows)

  return {
    rows: rows.map((row) => ({
      ...row,
      linkedImages: linkedImagesByEntity.get(entityKey(row.entityType, row.entitySlug)) ?? [],
    })) as unknown as MediaQueueRow[],
    total,
    filteredTotal,
    allCount,
    needsReviewCount,
    rejectedCount,
    approvedCount,
    openRequestCount,
  }
}

/**
 * Collects the real image/diagram links for each queued anatomy item so the
 * one-card review flow still shows whether sibling views already exist.
 */
async function linkedImageSummariesForRows(rows: Array<{ entityType: AnatomyEntityType; entitySlug: string }>) {
  const entityFilters: Prisma.AnatomyMediaEntityWhereInput[] = [...new Map(rows.map((row) => [entityKey(row.entityType, row.entitySlug), {
    entityType: row.entityType,
    entitySlug: row.entitySlug,
  }])).values()]

  if (entityFilters.length === 0) {
    return new Map<string, LinkedImageSummary[]>()
  }

  const links = await prisma.anatomyMediaEntity.findMany({
    where: {
      OR: entityFilters,
      asset: { mediaType: { in: IMAGE_REVIEW_MEDIA_TYPES } },
    },
    select: {
      id: true,
      entityType: true,
      entitySlug: true,
      role: true,
      reviewStatus: true,
      reviewReason: true,
      displayPriority: true,
      asset: {
        include: {
          source: true,
        },
      },
    },
    orderBy: [
      { role: "asc" },
      { displayPriority: "asc" },
      { createdAt: "asc" },
    ],
  })
  const grouped = new Map<string, LinkedImageSummary[]>()

  for (const link of links) {
    const key = entityKey(link.entityType, link.entitySlug)
    const current = grouped.get(key) ?? []
    current.push({
      id: link.id,
      role: link.role,
      reviewStatus: link.reviewStatus,
      reviewReason: link.reviewReason,
      displayPriority: link.displayPriority,
      asset: link.asset as unknown as Record<string, unknown>,
    })
    grouped.set(key, current)
  }

  return grouped
}

function QueueStatusTabs({
  selectedStatus,
  data,
  filters,
}: {
  selectedStatus: QueueStatusOption
  data: QueueData
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
}) {
  const counts: Record<QueueStatusKey, number> = {
    "needs-review": data.needsReviewCount,
    rejected: data.rejectedCount,
    approved: data.approvedCount,
    all: data.allCount,
  }

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {MEDIA_REVIEW_QUEUE_STATUS_OPTIONS.map((statusOption) => {
        const status = statusOption as QueueStatusOption

        return (
          <Button key={status.key} asChild size="sm" variant={selectedStatus.key === status.key ? "default" : "outline"} className="shrink-0">
            <Link href={mediaReviewQueueHref(filters, { status: status.key, offset: 0 })}>
              {status.label} ({counts[status.key]})
            </Link>
          </Button>
        )
      })}
    </div>
  )
}

function QueuePresetLinks({ filters }: { filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  const anatomyPresets = MEDIA_REVIEW_QUEUE_PRESETS.filter((preset) => preset.group === "anatomy")
  const cleanupPresets = MEDIA_REVIEW_QUEUE_PRESETS.filter((preset) => preset.group === "cleanup")

  return (
    <div className="mt-3 space-y-2">
      <PresetGroup label="Anatomy batches" presets={anatomyPresets} filters={filters} />
      <PresetGroup label="Image problem batches" presets={cleanupPresets} filters={filters} />
    </div>
  )
}

function PresetGroup({
  label,
  presets,
  filters,
}: {
  label: string
  presets: typeof MEDIA_REVIEW_QUEUE_PRESETS
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {presets.map((preset) => {
          const linkFilters = {
            // Presets with their own status must clear the current status so normalization applies the preset's status instead.
            status: preset.filters.status ? "" : filters.status,
            sort: filters.sort,
          }

          return (
            <Button key={preset.key} asChild size="sm" variant={filters.preset === preset.key ? "default" : "outline"} className="shrink-0">
              <Link href={mediaReviewQueueHref(linkFilters, { preset: preset.key, offset: 0 })}>{preset.label}</Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function QueueActiveFilters({ filters }: { filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  const chips = activeMediaReviewQueueChips(filters)
  if (chips.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span key={chip.key} className="rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
          {chip.label}
        </span>
      ))}
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/anatomy/media-review">Clear filters</Link>
      </Button>
    </div>
  )
}

function QueueAdvancedFilters({ filters }: { filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  return (
    <details className="mt-3 rounded-md border border-border/80 bg-muted/20 p-3">
      <summary className="cursor-pointer text-sm font-medium">Advanced filters</summary>
      <form action="/admin/anatomy/media-review" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="status" value={filters.status} />
        {filters.preset ? <input type="hidden" name="preset" value={filters.preset} /> : null}
        <SelectField id="queue-entity-type" name="entityType" label="Entity type" values={["", ...MEDIA_REVIEW_QUEUE_ENTITY_TYPES.map((option) => option.key)]} defaultValue={filters.entityType} />
        <SelectField id="queue-reason" name="reason" label="Review reason" values={["", ...MEDIA_REVIEW_QUEUE_REASONS.map((option) => option.key)]} defaultValue={filters.reason} />
        <SelectField id="queue-view" name="view" label="BodyParts3D view" values={["", ...MEDIA_REVIEW_QUEUE_VIEWS.map((option) => option.key)]} defaultValue={filters.view} />
        <SelectField id="queue-request" name="request" label="Request state" values={["", ...MEDIA_REVIEW_QUEUE_REQUESTS.map((option) => option.key)]} defaultValue={filters.request} />
        <SelectField id="queue-sort" name="sort" label="Sort" values={MEDIA_REVIEW_QUEUE_SORTS.map((option) => option.key)} defaultValue={filters.sort} />
        <div className="space-y-2">
          <Label htmlFor="queue-search">Search</Label>
          <input id="queue-search" name="q" defaultValue={filters.q} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" size="sm">Apply filters</Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/anatomy/media-review">Reset</Link>
          </Button>
        </div>
      </form>
    </details>
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
  filters,
  upcomingRows,
}: {
  row: MediaQueueRow
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
  upcomingRows: MediaQueueRow[]
}) {
  const asset = row.asset
  const previewUrl = mediaPreviewUrl(asset)
  const sourceUrl = mediaBodyParts3dSourceUrl(asset)
  const fallbackUrl = sourceUrl && sourceUrl !== previewUrl ? sourceUrl : ""
  const composerUrl = mediaBodyParts3dComposerUrl(asset)
  const metadataLine = mediaMetadataLine(asset)
  const currentView = mediaViewFromAsset(asset)
  const browserHref = anatomyBrowserHref(row.entityType, row.entitySlug)
  const skipHref = mediaReviewQueueHref(filters, { offset: filters.offset + 1 })

  return (
    <Card className={appSurfaceClassName}>
      <CardContent className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-md border border-border/80 bg-white">
            {previewUrl ? (
              <ReviewImagePreview
                key={row.id}
                primaryUrl={previewUrl}
                fallbackUrl={fallbackUrl}
                alt={recordText(asset, "title") || "Anatomy media preview"}
              />
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

          <LinkedImageSummaryPanel row={row} />
          <QuickApproveForm row={row} filters={filters} />
          <NeedsBetterViewForm row={row} filters={filters} currentView={currentView} />
          <RejectImageForm row={row} filters={filters} />

          {upcomingRows.length > 0 ? (
            <div className={`${appInsetClassName} p-3`}>
              <p className="text-sm font-medium">Next in queue</p>
              <div className="mt-2 space-y-2">
                {upcomingRows.slice(0, 4).map((upcomingRow, index) => (
                  <Link key={upcomingRow.id} href={mediaReviewQueueHref(filters, { offset: filters.offset + index + 1 })} className="block rounded-md border border-border/70 p-2 text-sm transition hover:border-primary/60 hover:bg-accent">
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

function LinkedImageSummaryPanel({ row }: { row: MediaQueueRow }) {
  const linkedImages = row.linkedImages
  if (linkedImages.length === 0) return null

  return (
    <section className={`${appInsetClassName} space-y-2 p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Images linked to this item</p>
        <span className="rounded-md border border-border/80 px-2 py-1 text-xs text-muted-foreground">{linkedImages.length} total</span>
      </div>
      <p className="text-xs text-muted-foreground">This queue reviews one linked image at a time; other views for the same item appear as their own cards.</p>
      <div className="grid gap-2">
        {linkedImages.slice(0, 8).map((link) => {
          const metadataLine = mediaMetadataLine(link.asset)
          const isCurrent = link.id === row.id

          return (
            <div key={link.id} className={`rounded-md border p-2 text-xs ${isCurrent ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{mediaViewLabel(link.asset)}</span>
                {isCurrent ? <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[0.7rem] font-medium text-primary-foreground">Current</span> : null}
              </div>
              <p className="mt-1 text-muted-foreground">
                {[formatLabel(link.role), formatLabel(link.reviewStatus), link.reviewReason ? formatLabel(link.reviewReason) : ""].filter(Boolean).join(" / ")}
              </p>
              {metadataLine ? <p className="mt-1 text-muted-foreground">{metadataLine}</p> : null}
            </div>
          )
        })}
      </div>
      {linkedImages.length > 8 ? <p className="text-xs text-muted-foreground">{linkedImages.length - 8} more linked images are available from the anatomy browser.</p> : null}
    </section>
  )
}

function QuickApproveForm({ row, filters }: { row: MediaQueueRow; filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  return (
    <form action={reviewAnatomyMediaQueueDecisionAction}>
      <BaseDecisionFields row={row} filters={filters} offset={filters.offset} reviewStatus="APPROVED" />
      <Button type="submit" className="h-12 w-full text-base">Approve image</Button>
    </form>
  )
}

function NeedsBetterViewForm({
  row,
  filters,
  currentView,
}: {
  row: MediaQueueRow
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
  currentView: string
}) {
  return (
    <form action={reviewAnatomyMediaQueueDecisionAction} className={`${appInsetClassName} space-y-3 p-3`}>
      <BaseDecisionFields row={row} filters={filters} offset={filters.offset} reviewStatus="NEEDS_REVIEW" />
      <input type="hidden" name="create_view_request" value="1" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`better-view-reason-${row.id}`}
          name="review_reason"
          label="Why flag this image?"
          values={ANATOMY_MEDIA_REVIEW_REASONS}
          defaultValue={row.reviewReason || "too_tight"}
        />
        <SelectField
          id={`better-view-request-${row.id}`}
          name="requested_view"
          label="Replacement view"
          values={ANATOMY_MEDIA_VIEW_REQUEST_VIEWS}
          defaultValue={currentView}
        />
      </div>
      <SelectField
        id={`better-view-request-reason-${row.id}`}
        name="request_reason"
        label="What should change?"
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
          placeholder="Example: wider lateral view with the whole structure visible and the target not touching the edge."
        />
      </div>
      <input type="hidden" name="request_note" value="" />
      <Button type="submit" variant="secondary" className="h-12 w-full text-base">Needs better view</Button>
    </form>
  )
}

function RejectImageForm({ row, filters }: { row: MediaQueueRow; filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  return (
    <form action={reviewAnatomyMediaQueueDecisionAction} className={`${appInsetClassName} space-y-3 p-3`}>
      <BaseDecisionFields row={row} filters={filters} offset={filters.offset} reviewStatus="REJECTED" />
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

function BaseDecisionFields({
  row,
  filters,
  offset,
  reviewStatus,
}: {
  row: MediaQueueRow
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
  offset: number
  reviewStatus: AnatomyMediaReviewStatus
}) {
  const queueFields = mediaReviewQueueFormFields({ ...filters, offset })

  return (
    <>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="review_status" value={reviewStatus} />
      <input type="hidden" name="display_priority" value={String(row.displayPriority)} />
      <input type="hidden" name="notes" value={row.notes ?? ""} />
      {queueFields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
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
            {value ? formatLabel(value) : "Any"}
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
            <Link href={mediaReviewQueueHref({ status: "all" })}>Browse all images</Link>
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

function anatomyBrowserHref(entityType: string, entitySlug: string) {
  const params = new URLSearchParams()
  params.set("entityType", entityType)
  params.set("entitySlug", entitySlug)

  return `/admin/anatomy?${params.toString()}`
}

function mediaPreviewUrl(asset: Record<string, unknown>) {
  if (!isImageReviewAsset(asset)) return ""

  return recordText(asset, "remoteUrl") || recordText(asset, "thumbnailUrl") || mediaBodyParts3dSourceUrl(asset)
}

function mediaBodyParts3dSourceUrl(asset: Record<string, unknown>) {
  const metadata = recordObject(asset, "metadata")
  const candidates = [
    recordText(asset, "sourceUrl"),
    recordText(metadata, "bodyparts3dSourceUrl"),
    recordText(metadata, "sourceUrl"),
    recordText(metadata, "sourceAssetUrl"),
  ]

  for (const candidate of candidates) {
    const sourceUrl = safeBodyParts3dRenderableImageUrl(candidate)
    if (sourceUrl) return sourceUrl
  }

  return ""
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

function mediaViewLabel(asset: Record<string, unknown>) {
  return recordText(asset, "title") || mediaMetadataLine(asset) || recordText(asset, "slug") || "Linked image"
}

function isImageReviewAsset(asset: Record<string, unknown>) {
  const mediaType = recordText(asset, "mediaType")
  return mediaType === "IMAGE" || mediaType === "DIAGRAM"
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

function entityKey(entityType: string, entitySlug: string) {
  return `${entityType}:${entitySlug}`
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
