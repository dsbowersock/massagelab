import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import { SOURCE_USAGE_SCOPES } from "@/lib/anatomy-admin-source-input"
import {
  ANATOMY_ADMIN_QUICK_QUERIES,
  buildAnatomyEntityHref,
  anatomyQueries,
  normalizeAnatomySearchQuery,
  parseAnatomyEntitySelection,
  type AnatomyEntitySelection,
  type AnatomyQuickQueryKey,
  type AnatomySearchResult,
} from "@/lib/anatomy-queries"
import {
  ANATOMY_MEDIA_REVIEW_REASONS,
  ANATOMY_MEDIA_REVIEW_STATUSES,
  bodyParts3dComposerUrl,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dImageUrl,
} from "@/lib/anatomy-media-review"
import type { AccountRole } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"
import {
  createAnatomyAliasAction,
  createAnatomyEntityRelationshipAction,
  createAnatomyRelationshipAction,
  createAnatomySourceAction,
  createAnatomyTermAction,
  importBodyParts3dMediaAction,
  linkAnatomyMediaAssetAction,
  updateAnatomyTermAction,
  updateAnatomyMediaReviewAction,
  updateCorrectionFlagAction,
} from "@/app/admin/anatomy/actions"
import { AppPageShell, appInsetClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AnatomyBrowserStickyFrame } from "./anatomy-browser-sticky-frame"
import { BodyParts3dImportFields } from "./bodyparts3d-import-fields"
import { SyncedHorizontalScroll } from "./synced-horizontal-scroll"

type AnatomyTermRow = {
  id: string
  slug: string
  kind: string
  preferredName: string
  summary: string | null
  regions: string[]
  bodySystems: string[]
  difficulty: string
  status: string
}

type CorrectionFlagRow = {
  id: string
  issueType: string
  message: string
  status: string
  resolutionNote: string | null
  term: {
    preferredName: string
  } | null
}

const TERM_KINDS = ["SYSTEM", "ORGAN", "TISSUE", "BONE", "MUSCLE", "JOINT", "NERVE", "VESSEL", "LIGAMENT", "TENDON", "CELL", "OTHER"]
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"]
const STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]
const FLAG_STATUSES = ["OPEN", "RESOLVED", "REJECTED"]
const MEDIA_REVIEW_STATUSES = [...ANATOMY_MEDIA_REVIEW_STATUSES]
const MEDIA_REVIEW_REASONS = [...ANATOMY_MEDIA_REVIEW_REASONS]
const MEDIA_ROLES = ["PRIMARY", "REFERENCE", "REGION_CONTEXT", "GAME_PROMPT", "CLIENT_EDUCATION"]
const ANATOMY_DETAIL_LOOKUP_TAKE = 2000

type AnatomyAdminPageProps = {
  searchParams?: Promise<{
    q?: string
    quick?: string
    view?: string
    entityType?: string
    entitySlug?: string
  }>
}

type AnatomyFoundationCount = {
  label: string
  value: number
}

type AnatomyQuickResult = {
  title: string
  description: string
  rows: AnatomyQuickResultRow[]
}

type AnatomyQuickResultRow = {
  title: string
  subtitle?: string
  meta?: string
  detail?: string
}

type AnatomyBrowserView =
  | "muscles"
  | "structures"
  | "concepts"
  | "movement"
  | "neurovascular"
  | "language"
  | "queries"
  | "sources"
  | "maintenance"

type AnatomyBrowserData = {
  regions: Record<string, unknown>[]
  muscles: Record<string, unknown>[]
  structures: Record<string, unknown>[]
  concepts: Record<string, unknown>[]
  bones: Record<string, unknown>[]
  boneLandmarks: Record<string, unknown>[]
  joints: Record<string, unknown>[]
  jointMovements: Record<string, unknown>[]
  rangesOfMotion: Record<string, unknown>[]
  nerves: Record<string, unknown>[]
  ligaments: Record<string, unknown>[]
  bloodSupply: Record<string, unknown>[]
  painRegions: Record<string, unknown>[]
  clientTerms: Record<string, unknown>[]
  entityTerms: Record<string, unknown>[]
  sources: Record<string, unknown>[]
  relationships: Record<string, unknown>[]
  citations: Record<string, unknown>[]
  externalIdentifiers: Record<string, unknown>[]
  mediaAssets: Record<string, unknown>[]
  spatialModels: Record<string, unknown>[]
  spatialEntityMaps: Record<string, unknown>[]
  movementVisualizations: Record<string, unknown>[]
  entityNames: Record<string, string>
  entityOptions: Array<{ entityType: string; entitySlug: string; label: string }>
}

type AnatomyEntityDetailPayload = Awaited<ReturnType<typeof anatomyQueries.getAnatomyEntityDetail>> | null

type DataTableColumn<T> = {
  header: string
  className?: string
  render: (row: T) => React.ReactNode
}

const BROWSER_VIEWS: Array<{ key: AnatomyBrowserView; label: string }> = [
  { key: "muscles", label: "Muscles" },
  { key: "structures", label: "Structures" },
  { key: "concepts", label: "Concepts" },
  { key: "movement", label: "Joints & ROM" },
  { key: "neurovascular", label: "Nerves & vessels" },
  { key: "language", label: "Terms & pain" },
  { key: "queries", label: "Queries" },
  { key: "sources", label: "Sources" },
  { key: "maintenance", label: "Maintenance" },
]

export default async function AnatomyAdminPage({ searchParams }: AnatomyAdminPageProps) {
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

  const params = await searchParams
  const searchQuery = normalizeAnatomySearchQuery(params?.q ?? "")
  const quickQueryKey = quickQueryFromParam(params?.quick)
  const selectedView = browserViewFromParam(params?.view, quickQueryKey, searchQuery)
  const selectedEntity = parseAnatomyEntitySelection(params?.entityType, params?.entitySlug)

  const [termRows, flagRows, foundationCounts, browserData, searchResults, quickResult, selectedEntityDetail] = await Promise.all([
    prisma.anatomyTerm.findMany({
      select: {
        id: true,
        slug: true,
        kind: true,
        preferredName: true,
        summary: true,
        regions: true,
        bodySystems: true,
        difficulty: true,
        status: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.anatomyCorrectionFlag.findMany({
      include: {
        term: {
          select: { preferredName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getAnatomyFoundationCounts(),
    getAnatomyBrowserData(),
    searchQuery ? anatomyQueries.searchAnatomyEntities(searchQuery, 18) : Promise.resolve([]),
    getAnatomyQuickResult(quickQueryKey),
    selectedEntity
      ? anatomyQueries.getAnatomyEntityDetail(selectedEntity.entityType, selectedEntity.entitySlug).catch(() => null)
      : Promise.resolve(null),
  ])
  const terms = termRows as AnatomyTermRow[]
  const flags = flagRows as CorrectionFlagRow[]

  return (
    <AdminShell>
      <AnatomyDatabaseBrowser
        counts={foundationCounts}
        searchQuery={searchQuery}
        searchResults={searchResults}
        quickResult={quickResult}
        selectedQuickQueryKey={quickQueryKey}
        selectedView={selectedView}
        selectedEntity={selectedEntity}
        selectedEntityDetail={selectedEntityDetail}
        browserData={browserData}
        terms={terms}
        flags={flags}
      />
    </AdminShell>
  )
}

function AnatomyDatabaseBrowser({
  counts,
  searchQuery,
  searchResults,
  quickResult,
  selectedQuickQueryKey,
  selectedView,
  selectedEntity,
  selectedEntityDetail,
  browserData,
  terms,
  flags,
}: {
  counts: AnatomyFoundationCount[]
  searchQuery: string
  searchResults: AnatomySearchResult[]
  quickResult: AnatomyQuickResult | null
  selectedQuickQueryKey?: AnatomyQuickQueryKey
  selectedView: AnatomyBrowserView
  selectedEntity: AnatomyEntitySelection | null
  selectedEntityDetail: AnatomyEntityDetailPayload
  browserData: AnatomyBrowserData
  terms: AnatomyTermRow[]
  flags: CorrectionFlagRow[]
}) {
  return (
    <Card className={appSurfaceClassName}>
      <CardContent className="p-1 sm:p-6">
        <AnatomyBrowserStickyFrame
          toolbar={(
            <>
              <form action="/admin/anatomy" className="grid gap-2 sm:gap-3 md:grid-cols-[1fr_auto]">
                <input type="hidden" name="view" value={selectedView === "maintenance" ? "muscles" : selectedView} />
                <div className="space-y-2">
                  <Label htmlFor="anatomy-search" data-anatomy-search-label>
                    Search normalized anatomy
                  </Label>
                  <Input
                    id="anatomy-search"
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Search upper trap, shoulder blade, rotator cuff, base of skull..."
                    data-anatomy-compact-control
                    className="h-10 transition-[height]"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" data-anatomy-compact-control className="h-10 w-full bg-primary transition-[height] hover:bg-brand-orange-glow md:w-auto">
                    Search database
                  </Button>
                </div>
              </form>

              <div data-anatomy-view-tabs className="flex gap-2 overflow-x-auto pb-1">
                {BROWSER_VIEWS.map((view) => (
                  <Button key={view.key} asChild variant={selectedView === view.key ? "default" : "outline"} size="sm" className="shrink-0">
                    <Link href={browserViewHref(view.key)}>{view.label}</Link>
                  </Button>
                ))}
              </div>
            </>
          )}
        >
          {searchQuery ? <SearchResultsTable searchQuery={searchQuery} searchResults={searchResults} /> : null}
          {selectedEntity ? (
            <EntityDetailPanel
              data={browserData}
              selectedEntity={selectedEntity}
              selectedEntityDetail={selectedEntityDetail}
              selectedView={selectedView}
              searchQuery={searchQuery}
            />
          ) : null}

          {selectedView === "muscles" ? <MusclesTable data={browserData} searchQuery={searchQuery} /> : null}
          {selectedView === "structures" ? <StructuresTables data={browserData} searchQuery={searchQuery} /> : null}
          {selectedView === "concepts" ? <ConceptsTable data={browserData} searchQuery={searchQuery} /> : null}
          {selectedView === "movement" ? <MovementTables data={browserData} searchQuery={searchQuery} /> : null}
          {selectedView === "neurovascular" ? <NeurovascularTables data={browserData} searchQuery={searchQuery} /> : null}
          {selectedView === "language" ? <LanguageTables data={browserData} searchQuery={searchQuery} /> : null}
          {selectedView === "sources" ? <SourcesTable data={browserData} /> : null}
          {selectedView === "maintenance" ? <MaintenanceView counts={counts} terms={terms} flags={flags} /> : null}

          {selectedView === "queries" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {ANATOMY_ADMIN_QUICK_QUERIES.map((query) => (
                  <Button key={query.key} asChild variant={selectedQuickQueryKey === query.key ? "default" : "outline"} size="sm">
                    <Link href={`/admin/anatomy?view=queries&quick=${query.key}`}>{query.label}</Link>
                  </Button>
                ))}
              </div>

              <QuickResultPanel quickResult={quickResult} />
            </div>
          ) : null}
        </AnatomyBrowserStickyFrame>
      </CardContent>
    </Card>
  )
}

function QuickResultPanel({ quickResult }: { quickResult: AnatomyQuickResult | null }) {
  if (!quickResult) {
    return (
      <div className={`${appInsetClassName} p-4`}>
        <p className="text-sm text-muted-foreground">Choose a query to inspect a focused relationship result.</p>
      </div>
    )
  }

  return (
    <div className={`${appInsetClassName} space-y-3 p-4`}>
      <div>
        <h3 className="font-semibold">{quickResult.title}</h3>
        <p className="text-sm text-muted-foreground">{quickResult.description}</p>
      </div>
      {quickResult.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No normalized anatomy rows matched this query.</p>
      ) : (
        <DataTable
          rows={quickResult.rows}
          rowKey={(row) => `${row.title}-${row.subtitle ?? row.meta ?? ""}`}
          columns={[
            {
              header: "Result",
              render: (row) => <NameCell title={row.title} subtitle={row.subtitle} meta={row.meta} />,
            },
            {
              header: "Detail",
              render: (row) => <span>{row.detail || "-"}</span>,
            },
          ]}
        />
      )}
    </div>
  )
}

function SearchResultsTable({
  searchQuery,
  searchResults,
}: {
  searchQuery: string
  searchResults: AnatomySearchResult[]
}) {
  return (
    <div className={`${appInsetClassName} space-y-3 p-4`}>
      <div>
        <h3 className="font-semibold">Search results</h3>
        <p className="text-sm text-muted-foreground">Matches for {searchQuery}.</p>
      </div>
      {searchResults.length === 0 ? (
        <p className="text-sm text-muted-foreground">No normalized anatomy results matched {searchQuery}.</p>
      ) : (
        <DataTable
          rows={searchResults}
          rowKey={(result) => `${result.entityType}-${result.slug}`}
          columns={[
            {
              header: "Entity",
              render: (result) => (
                <NameCell
                  title={result.label}
                  subtitle={result.slug}
                  meta={formatLabel(result.entityType)}
                  href={entityHref(result.entityType, result.slug, viewForEntityType(result.entityType), searchQuery)}
                />
              ),
            },
            {
              header: "Matched term",
              render: (result) => result.matchedTerm ? `${result.matchedTerm}${result.termType ? ` (${formatLabel(result.termType)})` : ""}` : "-",
            },
            {
              header: "Detail",
              render: (result) => result.detail || "-",
            },
            {
              header: "Source",
              render: (result) => result.sourceLabel || "-",
            },
          ]}
        />
      )}
    </div>
  )
}

function MusclesTable({ data, searchQuery }: { data: AnatomyBrowserData; searchQuery: string }) {
  return (
    <DataTable
      rows={data.muscles}
      rowKey={(muscle) => recordText(muscle, "slug")}
      columns={[
        {
          header: "Muscle",
          className: "min-w-[220px]",
          render: (muscle) => (
            <NameCell
              title={recordText(muscle, "name")}
              subtitle={recordText(muscle, "formalName")}
              meta={`${formatLabel(recordText(muscle, "relativeDepth"))} / ${relationText(muscle, "region", "name")}`}
              href={entityHref("MUSCLE", recordText(muscle, "slug"), "muscles", searchQuery)}
            />
          ),
        },
        {
          header: "Terms",
          render: (muscle) => (
            <CompactList
              items={[
                ...recordStringArray(muscle, "alternateNames"),
                ...entityTermLabels(data, "MUSCLE", recordText(muscle, "slug")),
              ]}
            />
          ),
        },
        {
          header: "Attachments",
          className: "min-w-[260px]",
          render: (muscle) => <CompactList items={attachmentLines(recordArray(muscle, "attachments"))} />,
        },
        {
          header: "Innervation",
          render: (muscle) => <CompactList items={recordArray(muscle, "innervations").map((row) => relationText(row, "nerve", "name"))} />,
        },
        {
          header: "Actions",
          className: "min-w-[240px]",
          render: (muscle) => <CompactList items={actionLines(recordArray(muscle, "actions"))} />,
        },
        {
          header: "Blood",
          render: (muscle) => (
            <CompactList
              items={relationshipLabels(data, {
                sourceType: "BLOOD_SUPPLY",
                relationshipType: "supplies",
                targetType: "MUSCLE",
                targetSlug: recordText(muscle, "slug"),
                returnSide: "source",
              })}
            />
          ),
        },
        {
          header: "Depth",
          render: (muscle) => <CompactList items={depthRelationshipLabels(data, recordText(muscle, "slug"))} />,
        },
      ]}
    />
  )
}

function StructuresTables({ data, searchQuery }: { data: AnatomyBrowserData; searchQuery: string }) {
  return (
    <div className="space-y-4">
      <SectionPanel title="Anatomy structures">
        <DataTable
          rows={data.structures}
          rowKey={(structure) => recordText(structure, "slug")}
          columns={[
            {
              header: "Structure",
              render: (structure) => (
                <NameCell
                  title={recordText(structure, "name")}
                  subtitle={formatLabel(recordText(structure, "structureType"))}
                  meta={relationText(structure, "region", "name")}
                  href={entityHref("ANATOMY_STRUCTURE", recordText(structure, "slug"), "structures", searchQuery)}
                />
              ),
            },
            {
              header: "Description",
              render: (structure) => recordText(structure, "description") || "-",
            },
            {
              header: "Relationships",
              render: (structure) => (
                <CompactList
                  items={selectedEntityRelationships(data, {
                    entityType: "ANATOMY_STRUCTURE",
                    entitySlug: recordText(structure, "slug"),
                  }).map((relationship) => `${formatLabel(relationship.relationshipType)} ${relationship.label}`)}
                />
              ),
            },
            {
              header: "Source",
              render: (structure) => relationText(structure, "source", "label") || "-",
            },
          ]}
        />
      </SectionPanel>

      <SectionPanel title="Bones and landmarks">
        <DataTable
          rows={data.bones}
          rowKey={(bone) => recordText(bone, "slug")}
          columns={[
            {
              header: "Bone",
              render: (bone) => (
                <NameCell
                  title={recordText(bone, "name")}
                  subtitle={recordText(bone, "formalName")}
                  meta={relationText(bone, "region", "name")}
                  href={entityHref("BONE", recordText(bone, "slug"), "structures", searchQuery)}
                />
              ),
            },
            {
              header: "Landmarks",
              render: (bone) => <CompactList items={recordArray(bone, "landmarks").map((landmark) => recordText(landmark, "name"))} />,
            },
            {
              header: "Attached muscles",
              render: (bone) => <CompactList items={uniqueStrings(recordArray(bone, "attachments").map((row) => relationText(row, "muscle", "name")))} />,
            },
            {
              header: "Source",
              render: (bone) => relationText(bone, "source", "label") || "-",
            },
          ]}
        />
      </SectionPanel>
    </div>
  )
}

function ConceptsTable({ data, searchQuery }: { data: AnatomyBrowserData; searchQuery: string }) {
  return (
    <SectionPanel title="Physiology and kinesiology concepts">
      <DataTable
        rows={data.concepts}
        rowKey={(concept) => recordText(concept, "slug")}
        columns={[
          {
            header: "Concept",
            render: (concept) => (
              <NameCell
                title={recordText(concept, "name")}
                subtitle={formatLabel(recordText(concept, "conceptType"))}
                meta={formatLabel(recordText(concept, "bodySystem"))}
                href={entityHref("ANATOMY_CONCEPT", recordText(concept, "slug"), "concepts", searchQuery)}
              />
            ),
          },
          {
            header: "Terms",
            render: (concept) => <CompactList items={entityTermLabels(data, "ANATOMY_CONCEPT", recordText(concept, "slug"))} />,
          },
          {
            header: "Description",
            className: "min-w-[360px]",
            render: (concept) => recordText(concept, "description") || "-",
          },
          {
            header: "Source",
            render: (concept) => relationText(concept, "source", "label") || "-",
          },
        ]}
      />
    </SectionPanel>
  )
}

function MovementTables({ data, searchQuery }: { data: AnatomyBrowserData; searchQuery: string }) {
  return (
    <div className="space-y-4">
      <SectionPanel title="Joints, movements, ROM, and ligaments">
        <DataTable
          rows={data.joints}
          rowKey={(joint) => recordText(joint, "slug")}
          columns={[
            {
              header: "Joint",
              render: (joint) => (
                <NameCell
                  title={recordText(joint, "name")}
                  subtitle={recordText(joint, "jointType")}
                  meta={relationText(joint, "region", "name")}
                  href={entityHref("JOINT", recordText(joint, "slug"), "movement", searchQuery)}
                />
              ),
            },
            {
              header: "Movements",
              render: (joint) => <CompactList items={recordArray(joint, "movements").map((movement) => movementLine(movement))} />,
            },
            {
              header: "ROM",
              render: (joint) => <CompactList items={recordArray(joint, "rangesOfMotion").map((rom) => romLine(rom))} />,
            },
            {
              header: "Ligaments",
              render: (joint) => <CompactList items={recordArray(joint, "ligaments").map((ligament) => recordText(ligament, "name"))} />,
            },
          ]}
        />
      </SectionPanel>
    </div>
  )
}

function NeurovascularTables({ data, searchQuery }: { data: AnatomyBrowserData; searchQuery: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Nerves">
        <DataTable
          rows={data.nerves}
          rowKey={(nerve) => recordText(nerve, "slug")}
          columns={[
            {
              header: "Nerve",
              render: (nerve) => (
                <NameCell
                  title={recordText(nerve, "name")}
                  subtitle={recordStringArray(nerve, "nerveRoots").join(", ")}
                  meta={relationText(nerve, "region", "name")}
                  href={entityHref("NERVE", recordText(nerve, "slug"), "neurovascular", searchQuery)}
                />
              ),
            },
            {
              header: "Innervates",
              render: (nerve) => <CompactList items={recordArray(nerve, "innervations").map((row) => relationText(row, "muscle", "name"))} />,
            },
            {
              header: "Relationships",
              render: (nerve) => (
                <CompactList
                  items={[
                    ...relationshipLabels(data, {
                      sourceType: "NERVE",
                      sourceSlug: recordText(nerve, "slug"),
                      relationshipType: "includes_branch",
                      targetType: "NERVE",
                      returnSide: "target",
                    }),
                    ...relationshipLabels(data, {
                      sourceType: "NERVE",
                      sourceSlug: recordText(nerve, "slug"),
                      relationshipType: "may_affect_region",
                      targetType: "PAIN_MAP_REGION",
                      returnSide: "target",
                    }),
                  ]}
                />
              ),
            },
          ]}
        />
      </SectionPanel>

      <SectionPanel title="Vessels">
        <DataTable
          rows={data.bloodSupply}
          rowKey={(vessel) => recordText(vessel, "slug")}
          columns={[
            {
              header: "Vessel",
              render: (vessel) => (
                <NameCell
                  title={recordText(vessel, "name")}
                  subtitle={formatLabel(recordText(vessel, "kind"))}
                  meta={relationText(vessel, "region", "name")}
                  href={entityHref("BLOOD_SUPPLY", recordText(vessel, "slug"), "neurovascular", searchQuery)}
                />
              ),
            },
            {
              header: "Supplies",
              render: (vessel) => (
                <CompactList
                  items={relationshipLabels(data, {
                    sourceType: "BLOOD_SUPPLY",
                    sourceSlug: recordText(vessel, "slug"),
                    relationshipType: "supplies",
                    targetType: "MUSCLE",
                    returnSide: "target",
                  })}
                />
              ),
            },
          ]}
        />
      </SectionPanel>
    </div>
  )
}

function LanguageTables({ data, searchQuery }: { data: AnatomyBrowserData; searchQuery: string }) {
  return (
    <div className="space-y-4">
      <SectionPanel title="Formal, common, and alternate terms">
        <DataTable
          rows={data.entityTerms}
          rowKey={(term) => recordText(term, "slug")}
          columns={[
            {
              header: "Term",
              render: (term) => <NameCell title={recordText(term, "term")} subtitle={formatLabel(recordText(term, "termType"))} meta={recordText(term, "languageOfOrigin")} />,
            },
            {
              header: "Entity",
              render: (term) => entityLabel(data, recordText(term, "anatomyEntityType"), recordText(term, "anatomyEntitySlug")),
            },
            {
              header: "Notes",
              render: (term) => recordText(term, "notes") || "-",
            },
          ]}
        />
      </SectionPanel>

      <SectionPanel title="Client language">
        <DataTable
          rows={data.clientTerms}
          rowKey={(term) => recordText(term, "slug")}
          columns={[
            {
              header: "Phrase",
              render: (term) => (
                <NameCell
                  title={recordText(term, "term")}
                  subtitle={formatLabel(recordText(term, "confidence"))}
                  href={entityHref("CLIENT_TERM", recordText(term, "slug"), "language", searchQuery)}
                />
              ),
            },
            {
              header: "Maps to",
              render: (term) => (
                <CompactList
                  items={[
                    relationText(term, "mappedRegion", "name"),
                    relationText(term, "mappedMuscle", "name"),
                    relationText(term, "mappedJoint", "name"),
                    relationText(term, "mappedStructure", "name"),
                  ]}
                />
              ),
            },
            {
              header: "Plain language",
              render: (term) => recordText(term, "plainLanguageDescription"),
            },
          ]}
        />
      </SectionPanel>

      <SectionPanel title="Pain regions">
        <DataTable
          rows={data.painRegions}
          rowKey={(region) => recordText(region, "slug")}
          columns={[
            {
              header: "Pain region",
              render: (region) => (
                <NameCell
                  title={recordText(region, "name")}
                  subtitle={recordText(region, "plainLanguageDescription")}
                  meta={relationText(region, "region", "name")}
                  href={entityHref("PAIN_MAP_REGION", recordText(region, "slug"), "language", searchQuery)}
                />
              ),
            },
            {
              header: "Map metadata",
              render: (region) => `${formatLabel(recordText(region, "laterality"))} / ${formatLabel(recordText(region, "surface"))}`,
            },
            {
              header: "Overlaps",
              render: (region) => (
                <CompactList
                  items={relationshipLabels(data, {
                    sourceType: "PAIN_MAP_REGION",
                    sourceSlug: recordText(region, "slug"),
                    relationshipType: "overlaps_region",
                    targetType: "REGION",
                    returnSide: "target",
                  })}
                />
              ),
            },
          ]}
        />
      </SectionPanel>
    </div>
  )
}

function SourcesTable({ data }: { data: AnatomyBrowserData }) {
  return (
    <DataTable
      rows={data.sources}
      rowKey={(source) => recordText(source, "slug")}
      columns={[
        {
          header: "Source",
          render: (source) => <NameCell title={recordText(source, "label")} subtitle={recordText(source, "slug")} meta={`${recordText(source, "license") || "No license"} / ${formatLabel(recordText(source, "usageScope"))}`} />,
        },
        {
          header: "License URL",
          render: (source) => {
            const url = recordText(source, "licenseUrl")

            return url ? <Link href={url} className="text-primary underline-offset-4 hover:underline">{url}</Link> : "-"
          },
        },
        {
          header: "Attribution",
          render: (source) => recordText(source, "attribution"),
        },
        {
          header: "URL",
          render: (source) => {
            const url = recordText(source, "url")

            return url ? <Link href={url} className="text-primary underline-offset-4 hover:underline">{url}</Link> : "-"
          },
        },
      ]}
    />
  )
}

function MaintenanceView({ counts, terms, flags }: { counts: AnatomyFoundationCount[]; terms: AnatomyTermRow[]; flags: CorrectionFlagRow[] }) {
  return (
    <div className="space-y-4">
      <SectionPanel title="Dataset summary">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {counts.map((count) => (
            <div key={count.label} className={`${appInsetClassName} p-3`}>
              <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">{count.label}</p>
              <p className="mt-1 text-lg font-semibold">{count.value}</p>
            </div>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Create anatomy term">
        <form action={createAnatomyTermAction} className="grid gap-4 md:grid-cols-2">
          <TextField id="preferred_name" label="Preferred name" required />
          <TextField id="slug" label="Slug" placeholder="auto-generated if blank" />
          <SelectField id="kind" label="Kind" values={TERM_KINDS} />
          <SelectField id="difficulty" label="Difficulty" values={DIFFICULTIES} defaultValue="MEDIUM" />
          <SelectField id="status" label="Status" values={STATUSES} defaultValue="DRAFT" />
          <TextField id="body_systems" label="Body systems" placeholder="skeletal, muscular" />
          <TextField id="regions" label="Regions" placeholder="upper-extremity, thorax" />
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea id="summary" name="summary" rows={3} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">
              Create term
            </Button>
          </div>
        </form>
      </SectionPanel>

      <SectionPanel title="Aliases, relationships, and sources">
        <div className="grid gap-4 lg:grid-cols-3">
          <form action={createAnatomyAliasAction} className={`${appInsetClassName} space-y-3 p-4`}>
            <h3 className="font-semibold">Add alias</h3>
            <TermSelect terms={terms} id="term_id" label="Term" />
            <TextField id="alias" label="Alias" required />
            <Button type="submit" variant="outline">Add alias</Button>
          </form>

          <form action={createAnatomyRelationshipAction} className={`${appInsetClassName} space-y-3 p-4`}>
            <h3 className="font-semibold">Add relationship</h3>
            <TermSelect terms={terms} id="source_term_id" label="Source term" />
            <TextField id="relationship_type" label="Type" placeholder="part-of, innervates, attaches-to" required />
            <TermSelect terms={terms} id="target_term_id" label="Target term" />
            <Button type="submit" variant="outline">Add relationship</Button>
          </form>

          <form action={createAnatomySourceAction} className={`${appInsetClassName} space-y-3 p-4`}>
            <h3 className="font-semibold">Add source</h3>
            <TextField id="label" label="Label" required />
            <TextField id="slug" label="Slug" />
            <TextField id="url" label="URL" />
            <TextField id="license" label="License" />
            <TextField id="license_url" name="license_url" label="License URL" />
            <SelectField id="usage_scope" name="usage_scope" label="Usage scope" values={SOURCE_USAGE_SCOPES} defaultValue="REVIEW_ONLY" />
            <TextField id="accessed_at" name="accessed_at" label="Accessed date" placeholder="YYYY-MM-DD" />
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <TextField id="attribution" label="Attribution" required />
            <Button type="submit" variant="outline">Add source</Button>
          </form>
        </div>
      </SectionPanel>

      <SectionPanel title="Recent terms">
        {terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No database terms found yet. Run `npm run anatomy:seed` to import the local library.</p>
        ) : (
          <div className="space-y-3">
            {terms.map((term) => (
              <form key={term.id} action={updateAnatomyTermAction} className={`${appInsetClassName} p-4`}>
                <input type="hidden" name="id" value={term.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField id={`name-${term.id}`} name="preferred_name" label={term.slug} defaultValue={term.preferredName} />
                  <SelectField id={`difficulty-${term.id}`} name="difficulty" label="Difficulty" values={DIFFICULTIES} defaultValue={term.difficulty} />
                  <SelectField id={`status-${term.id}`} name="status" label="Status" values={STATUSES} defaultValue={term.status} />
                  <TextField id={`systems-${term.id}`} name="body_systems" label="Body systems" defaultValue={term.bodySystems.join(", ")} />
                  <TextField id={`regions-${term.id}`} name="regions" label="Regions" defaultValue={term.regions.join(", ")} />
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`summary-${term.id}`}>Summary</Label>
                    <Textarea id={`summary-${term.id}`} name="summary" defaultValue={term.summary ?? ""} rows={2} />
                  </div>
                </div>
                <Button type="submit" variant="outline" className="mt-4">
                  Save term
                </Button>
              </form>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel title="Correction flags">
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No correction flags yet.</p>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <form key={flag.id} action={updateCorrectionFlagAction} className={`${appInsetClassName} p-4`}>
                <input type="hidden" name="id" value={flag.id} />
                <div className="mb-3">
                  <p className="text-sm font-medium">{flag.term?.preferredName ?? "General content issue"}</p>
                  <p className="text-sm text-muted-foreground">{flag.issueType}: {flag.message}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
                  <SelectField id={`flag-status-${flag.id}`} name="status" label="Status" values={FLAG_STATUSES} defaultValue={flag.status} />
                  <TextField id={`flag-note-${flag.id}`} name="resolution_note" label="Resolution note" defaultValue={flag.resolutionNote ?? ""} />
                  <Button type="submit" variant="outline">Update</Button>
                </div>
              </form>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel title="Seed import">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/anatomime">Open Anatomime</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account">Back to account</Link>
          </Button>
        </div>
      </SectionPanel>
    </div>
  )
}

function EntityDetailPanel({
  data,
  selectedEntity,
  selectedEntityDetail,
  selectedView,
  searchQuery,
}: {
  data: AnatomyBrowserData
  selectedEntity: AnatomyEntitySelection
  selectedEntityDetail: AnatomyEntityDetailPayload
  selectedView: AnatomyBrowserView
  searchQuery: string
}) {
  const detail = selectedEntityDisplayDetail(data, selectedEntity, selectedEntityDetail)
  const relatedRows = selectedEntityRelationships(data, selectedEntity, selectedEntityDetail)
  const citationRows = selectedEntityCitations(data, selectedEntity, selectedEntityDetail)
  const identifierRows = selectedEntityExternalIdentifiers(data, selectedEntity, selectedEntityDetail)
  const mediaRows = selectedEntityMediaAssets(data, selectedEntity, selectedEntityDetail)
  const spatialMappingRows = selectedEntitySpatialMappings(data, selectedEntity, selectedEntityDetail)
  const movementVisualizationRows = selectedEntityMovementVisualizations(data, selectedEntity, selectedEntityDetail)

  if (!detail) {
    return (
      <section className={`${appInsetClassName} p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Item not found</h3>
            <p className="text-sm text-muted-foreground">{selectedEntity.entityType} / {selectedEntity.entitySlug}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={browserViewHref(selectedView)}>Clear selection</Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className={`${appInsetClassName} space-y-4 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-normal text-muted-foreground">{formatLabel(selectedEntity.entityType)}</p>
          <h3 className="text-lg font-semibold">{detail.label}</h3>
          {detail.subtitle ? <p className="text-sm text-muted-foreground">{detail.subtitle}</p> : null}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={browserViewHref(selectedView)}>Clear selection</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoBlock label="Slug" value={selectedEntity.entitySlug} />
        <InfoBlock label="Region" value={detail.region || "-"} />
        <InfoBlock label="Source" value={detail.source || "-"} />
      </div>

      {detail.description ? <p className="text-sm leading-6">{detail.description}</p> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={`${appInsetClassName} p-3`}>
          <p className="mb-2 text-sm font-medium">Typed facts</p>
          <CompactList items={detail.facts} empty="No typed facts surfaced for this item yet." />
        </div>
        <div className={`${appInsetClassName} p-3`}>
          <p className="mb-2 text-sm font-medium">Terms</p>
          <CompactList items={detail.terms} empty="No formal/common terms found yet." />
        </div>
      </div>

      <MediaReviewPanel
        data={data}
        selectedEntity={selectedEntity}
        entityLabel={detail.label}
        mediaRows={mediaRows}
        identifierRows={identifierRows}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={`${appInsetClassName} p-3`}>
          <p className="mb-2 text-sm font-medium">Spatial mappings</p>
          <CompactList
            items={spatialMappingRows.map((map) => [
              relationText(map, "model", "name") || recordText(map, "modelSlug"),
              recordText(map, "label") || recordText(map, "slug"),
              formatLabel(recordText(map, "mappingPrecision")),
              formatLabel(recordText(map, "reviewStatus")),
            ].filter(Boolean).join(" / "))}
            empty="No spatial mappings found yet."
          />
        </div>
        <div className={`${appInsetClassName} p-3`}>
          <p className="mb-2 text-sm font-medium">Movement visualizations</p>
          <CompactList
            items={movementVisualizationRows.map((visualization) => [
              relationText(visualization, "model", "name") || recordText(visualization, "modelSlug"),
              relationText(visualization, "movement", "movementName") || recordText(visualization, "slug"),
              recordText(visualization, "plane"),
              formatLabel(recordText(visualization, "reviewStatus")),
            ].filter(Boolean).join(" / "))}
            empty="No movement visualization rows found yet."
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Relationships</p>
        {relatedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No generic relationships found yet.</p>
        ) : (
          <DataTable
            rows={relatedRows}
            rowKey={(row) => `${row.direction}-${row.relationshipType}-${row.entityType}-${row.entitySlug}`}
            columns={[
              {
                header: "Direction",
                render: (row) => formatLabel(row.direction),
              },
              {
                header: "Relationship",
                render: (row) => formatLabel(row.relationshipType),
              },
              {
                header: "Related item",
                render: (row) => (
                  <Link href={entityHref(row.entityType, row.entitySlug, viewForEntityType(row.entityType), searchQuery)} className="text-primary underline-offset-4 hover:underline">
                    {row.label}
                  </Link>
                ),
              },
              {
                header: "Source",
                render: (row) => row.source || "-",
              },
            ]}
          />
        )}
      </div>

      <form action={createAnatomyEntityRelationshipAction} className="grid gap-3 rounded-md border border-border/80 bg-background/80 p-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <input type="hidden" name="source_entity_type" value={selectedEntity.entityType} />
        <input type="hidden" name="source_entity_slug" value={selectedEntity.entitySlug} />
        <div className="space-y-2">
          <Label htmlFor="relationship_type">Add relationship</Label>
          <select id="relationship_type" name="relationship_type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {["related_to", "deep_to", "superficial_to", "supplies", "includes_branch", "may_affect_region", "overlaps_region"].map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="target_entity">Target item</Label>
          <select id="target_entity" name="target_entity" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {data.entityOptions
              .filter((option) => option.entityType !== selectedEntity.entityType || option.entitySlug !== selectedEntity.entitySlug)
              .map((option) => (
                <option key={`${option.entityType}:${option.entitySlug}`} value={`${option.entityType}:${option.entitySlug}`}>
                  {option.label} ({formatLabel(option.entityType)})
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source_id">Source</Label>
          <select id="source_id" name="source_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">No source</option>
            {data.sources.map((source) => (
              <option key={recordText(source, "id")} value={recordText(source, "id")}>
                {recordText(source, "label")}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">Add</Button>
      </form>

      <div className="grid gap-3 lg:grid-cols-2">
        <CollapsedEvidenceSection title="Citations" count={citationRows.length}>
          <CitationList rows={citationRows} />
        </CollapsedEvidenceSection>
        <CollapsedEvidenceSection title="External IDs" count={identifierRows.length}>
          <ExternalIdentifierList rows={identifierRows} />
        </CollapsedEvidenceSection>
      </div>
    </section>
  )
}

function MediaReviewPanel({
  data,
  selectedEntity,
  entityLabel,
  mediaRows,
  identifierRows,
}: {
  data: AnatomyBrowserData
  selectedEntity: AnatomyEntitySelection
  entityLabel: string
  mediaRows: Record<string, unknown>[]
  identifierRows: Record<string, unknown>[]
}) {
  const reviewRows = mediaReviewRows(mediaRows, selectedEntity)
  const linkedRoleKeys = new Set(reviewRows.map((row) => mediaRoleKey(recordText(row.asset, "id"), recordText(row.link, "role"))))
  const candidateRows = mediaCandidateRows(data, linkedRoleKeys)
  const suggestedPartIds = suggestedBodyParts3dPartIds(mediaRows, identifierRows)

  return (
    <section className={`${appInsetClassName} space-y-4 p-3`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Media Review</p>
          <p className="text-xs text-muted-foreground">Review images linked to {entityLabel} and pick better views when needed.</p>
        </div>
        <span className="w-fit rounded-md border border-border/80 px-2 py-1 text-xs text-muted-foreground">{reviewRows.length} linked</span>
      </div>
      <p className="rounded-md border border-border/80 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
        Replacement flow: mark a bad image as Needs Review or Rejected, then import a better BodyParts3D view or link an existing image below. The replacement appears in this review list after saving.
      </p>

      {reviewRows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/80 bg-background/70 p-4 text-sm text-muted-foreground">
          No media assets are linked to this item yet.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {reviewRows.map(({ asset, link }) => {
            const linkId = recordText(link, "id")
            const previewUrl = mediaPreviewUrl(asset)
            const bodyParts3dSourceUrl = mediaBodyParts3dSourceUrl(asset)
            const bodyParts3dComposerHref = mediaBodyParts3dComposerUrl(asset)
            const reviewStatus = recordText(link, "reviewStatus") || "APPROVED"
            const reviewReason = recordText(link, "reviewReason")
            const priority = recordNumber(link, "displayPriority", 100)

            return (
              <article key={`${recordText(asset, "id")}-${recordText(link, "role")}-${linkId || selectedEntity.entitySlug}`} className="overflow-hidden rounded-md border border-border/80 bg-background/70">
                <div className="grid gap-3 p-3 md:grid-cols-[13rem_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-md border border-border/80 bg-white">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- anatomy media is already reviewed remote/source content.
                      <img src={previewUrl} alt={recordText(asset, "title") || "Anatomy media preview"} className="aspect-square h-full w-full object-contain p-2" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <div className="grid aspect-square place-items-center p-3 text-center text-sm text-muted-foreground">No preview URL</div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-3">
                    <div className="space-y-1">
                      <h4 className="break-words text-sm font-semibold">{recordText(asset, "title") || recordText(asset, "slug")}</h4>
                      <p className="text-xs text-muted-foreground">
                        {[formatLabel(recordText(asset, "mediaType")), formatLabel(recordText(asset, "usageScope")), sourceLabel(asset)].filter(Boolean).join(" / ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[`Role: ${formatLabel(recordText(link, "role") || "REFERENCE")}`, `Status: ${formatLabel(reviewStatus)}`, `Order: ${priority}`].join(" / ")}
                      </p>
                      {reviewReason ? <p className="text-xs text-muted-foreground">Reason: {formatLabel(reviewReason)}</p> : null}
                      {mediaMetadataLine(asset) ? <p className="text-xs text-muted-foreground">{mediaMetadataLine(asset)}</p> : null}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {bodyParts3dComposerHref ? <ExternalTextLink href={bodyParts3dComposerHref}>Open BodyParts3D composer</ExternalTextLink> : null}
                        {bodyParts3dSourceUrl ? <ExternalTextLink href={bodyParts3dSourceUrl}>Open generated image</ExternalTextLink> : null}
                        {previewUrl && previewUrl !== bodyParts3dSourceUrl ? <ExternalTextLink href={previewUrl}>{bodyParts3dSourceUrl ? "Open stored image" : "Open preview"}</ExternalTextLink> : null}
                      </div>
                    </div>

                    {linkId ? (
                      <form action={updateAnatomyMediaReviewAction} className="grid gap-3">
                        <input type="hidden" name="id" value={linkId} />
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`review-status-${linkId}`}>Review</Label>
                            <select id={`review-status-${linkId}`} name="review_status" defaultValue={reviewStatus} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                              {MEDIA_REVIEW_STATUSES.map((status) => (
                                <option key={status} value={status}>{formatLabel(status)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`review-reason-${linkId}`}>Reason when flagged</Label>
                            <select id={`review-reason-${linkId}`} name="review_reason" defaultValue={reviewReason} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                              <option value="">No reason for approved</option>
                              {MEDIA_REVIEW_REASONS.map((reason) => (
                                <option key={reason} value={reason}>{formatLabel(reason)}</option>
                              ))}
                            </select>
                          </div>
                          <TextField
                            id={`display-priority-${linkId}`}
                            name="display_priority"
                            label="Sort order"
                            defaultValue={String(priority)}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={999}
                            hint="Lower numbers show earlier; 100 is the default."
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`review-note-${linkId}`}>Review note</Label>
                            <Textarea id={`review-note-${linkId}`} name="review_note" defaultValue={recordText(link, "reviewNote")} rows={2} />
                            <p className="text-xs text-muted-foreground">Why this image is approved, needs review, or rejected.</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`link-notes-${linkId}`}>Link note</Label>
                            <Textarea id={`link-notes-${linkId}`} name="notes" defaultValue={recordText(link, "notes")} rows={2} />
                            <p className="text-xs text-muted-foreground">Context for why this image belongs to this item.</p>
                          </div>
                        </div>
                        <Button type="submit" size="sm" className="w-fit">Save Review</Button>
                      </form>
                    ) : (
                      <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        This asset appears in the detail query but does not include a matching entity link.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <form action={linkAnatomyMediaAssetAction} className="space-y-3 rounded-md border border-border/80 bg-background/70 p-3">
          <input type="hidden" name="entity_type" value={selectedEntity.entityType} />
          <input type="hidden" name="entity_slug" value={selectedEntity.entitySlug} />
          <div>
            <p className="text-sm font-medium">Link Existing Image</p>
            <p className="text-xs text-muted-foreground">Use when the right image is already in the database. Roles are not exclusive, so multiple images can share the same role.</p>
          </div>
          {candidateRows.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="candidate-asset-id">Image</Label>
                <select id="candidate-asset-id" name="asset_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {candidateRows.map((asset) => (
                    <option key={recordText(asset, "id")} value={recordText(asset, "id")}>
                      {recordText(asset, "title") || recordText(asset, "slug")} ({sourceLabel(asset) || formatLabel(recordText(asset, "usageScope"))})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  id="candidate-role"
                  name="role"
                  label="Role to add"
                  values={MEDIA_ROLES}
                  defaultValue="PRIMARY"
                  hint="Link another image with the same role when both should be used."
                />
                <TextField
                  id="candidate-display-priority"
                  name="display_priority"
                  label="Sort order"
                  defaultValue="100"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  hint="Lower numbers show earlier; 100 is the default."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate-notes">Note</Label>
                <Textarea id="candidate-notes" name="notes" rows={2} placeholder="Why this existing image belongs to this item" />
              </div>
              <Button type="submit" size="sm">Link Existing Image</Button>
            </>
          ) : (
            <p className="rounded-md border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
              No reviewed image candidates with an available role are in the current admin result window. Import a BodyParts3D view below when a better view is not already available.
            </p>
          )}
        </form>

        <form action={importBodyParts3dMediaAction} className="space-y-3 rounded-md border border-border/80 bg-background/70 p-3">
          <input type="hidden" name="entity_type" value={selectedEntity.entityType} />
          <input type="hidden" name="entity_slug" value={selectedEntity.entitySlug} />
          <div>
            <p className="text-sm font-medium">Import BodyParts3D View</p>
            <p className="text-xs text-muted-foreground">Create a new BodyParts3D still from presets or a pasted BodyParts3D API image URL, upload it, and link it to this item.</p>
          </div>
          <BodyParts3dImportFields key={`${selectedEntity.entityType}:${selectedEntity.entitySlug}`} initialPartIds={suggestedPartIds.join(", ")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              id="bodyparts3d-role"
              name="role"
              label="Role to add"
              values={MEDIA_ROLES}
              defaultValue="PRIMARY"
              hint="Roles are not exclusive; use the same image for multiple game or reference roles when needed."
            />
            <TextField
              id="bodyparts3d-display-priority"
              name="display_priority"
              label="Sort order"
              defaultValue="100"
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              hint="Lower numbers show earlier; 100 is the default."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bodyparts3d-notes">Note</Label>
            <Textarea id="bodyparts3d-notes" name="notes" rows={2} placeholder="Why this generated BodyParts3D view is useful" />
          </div>
          <Button type="submit" size="sm">Import and Link View</Button>
        </form>
      </div>
    </section>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${appInsetClassName} p-3`}>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  )
}

function SectionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${appInsetClassName} p-4`}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function DataTable<T>({
  rows,
  rowKey,
  columns,
}: {
  rows: T[]
  rowKey: (row: T) => string
  columns: Array<DataTableColumn<T>>
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No records found.</p>
  }

  const tableMinWidth = Math.max(760, columns.length * 190)
  const headerCells = columns.map((column) => (
    <th key={column.header} data-anatomy-table-header-cell scope="col" className={`px-3 py-2 font-medium ${column.className ?? ""}`}>
      <div
        data-anatomy-resizable-column
        className="min-w-[8rem] resize-x overflow-auto pr-4"
        title="Drag the lower-right edge to resize this column"
      >
        {column.header}
      </div>
    </th>
  ))

  return (
    <SyncedHorizontalScroll
      minWidth={tableMinWidth}
      stickyHeader={(
        <table className="w-full border-collapse text-left text-sm">
          <thead data-anatomy-table-header className="bg-muted text-xs uppercase tracking-normal text-muted-foreground">
            <tr>{headerCells}</tr>
          </thead>
        </table>
      )}
    >
      <table className="w-full border-collapse text-left text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-border/70">
              {columns.map((column) => (
                <td key={column.header} className={`align-top px-3 py-3 ${column.className ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SyncedHorizontalScroll>
  )
}

function NameCell({
  title,
  subtitle,
  meta,
  href,
}: {
  title: string
  subtitle?: string | null
  meta?: string | null
  href?: string
}) {
  const heading = href ? (
    <Link href={href} className="text-primary underline-offset-4 hover:underline">
      {title || "-"}
    </Link>
  ) : title || "-"

  return (
    <div className="min-w-0">
      <p className="font-medium leading-5">{heading}</p>
      {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      {meta ? <p className="mt-1 text-[11px] uppercase tracking-normal text-muted-foreground">{meta}</p> : null}
    </div>
  )
}

function CompactList({ items, empty = "-" }: { items: string[]; empty?: string }) {
  const values = uniqueStrings(items.filter(Boolean))

  if (values.length === 0) {
    return <span className="text-muted-foreground">{empty}</span>
  }

  return <span>{values.join("; ")}</span>
}

function CollapsedEvidenceSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <details className={`${appInsetClassName} group overflow-hidden`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="rounded-md border border-border/80 px-2 py-1 text-xs text-muted-foreground">
          {count}
        </span>
      </summary>
      <div className="max-h-72 overflow-y-auto border-t border-border/80 p-3 pr-2">
        {children}
      </div>
    </details>
  )
}

function CitationList({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <span className="text-muted-foreground">No citations found yet.</span>
  }

  return (
    <ul className="space-y-2 text-sm">
      {rows.map((citation) => {
        const href = citationHref(citation)
        const sourceLabel = relationText(citation, "source", "label") || recordText(citation, "sourceRef")

        return (
          <li key={recordText(citation, "slug") || `${recordText(citation, "factType")}-${recordText(citation, "sourceLocator")}`}>
            <p className="font-medium">
              <ExternalTextLink href={href}>
                {[formatLabel(recordText(citation, "factType")), sourceLabel].filter(Boolean).join(" / ")}
              </ExternalTextLink>
            </p>
            <p className="text-xs text-muted-foreground">
              {[recordText(citation, "sourceLocator"), formatLabel(recordText(citation, "reviewStatus"))].filter(Boolean).join(" / ")}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function ExternalIdentifierList({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <span className="text-muted-foreground">No external identifiers found yet.</span>
  }

  return (
    <ul className="space-y-2 text-sm">
      {rows.map((identifier) => {
        const href = externalIdentifierHref(identifier)
        const provider = recordText(identifier, "provider")
        const identifierValue = recordText(identifier, "identifier")

        return (
          <li key={recordText(identifier, "id") || `${provider}-${identifierValue}`}>
            <p className="font-medium">
              <ExternalTextLink href={href}>
                {[provider, identifierValue].filter(Boolean).join(" / ")}
              </ExternalTextLink>
            </p>
            <p className="text-xs text-muted-foreground">{recordText(identifier, "label") || relationText(identifier, "source", "label") || "-"}</p>
          </li>
        )
      })}
    </ul>
  )
}

function ExternalTextLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href) {
    return <>{children}</>
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
      {children}
    </a>
  )
}

function browserViewHref(view: AnatomyBrowserView) {
  return view === "muscles" ? "/admin/anatomy" : `/admin/anatomy?view=${view}`
}

function entityHref(entityType: string, entitySlug: string, view: AnatomyBrowserView, searchQuery = "") {
  return buildAnatomyEntityHref({
    entityType: entityType as AnatomyEntitySelection["entityType"],
    entitySlug,
    view,
    q: searchQuery || undefined,
  })
}

function viewForEntityType(entityType: string): AnatomyBrowserView {
  switch (entityType) {
    case "ANATOMY_CONCEPT":
      return "concepts"
    case "ANATOMY_STRUCTURE":
    case "BONE":
    case "BONE_LANDMARK":
      return "structures"
    case "JOINT":
    case "JOINT_MOVEMENT":
    case "RANGE_OF_MOTION":
    case "LIGAMENT":
      return "movement"
    case "NERVE":
    case "BLOOD_SUPPLY":
      return "neurovascular"
    case "PAIN_MAP_REGION":
    case "CLIENT_TERM":
      return "language"
    case "MUSCLE":
    default:
      return "muscles"
  }
}

function browserViewFromParam(value: string | undefined, quickQueryKey?: AnatomyQuickQueryKey, searchQuery?: string): AnatomyBrowserView {
  if (BROWSER_VIEWS.some((view) => view.key === value)) {
    return value as AnatomyBrowserView
  }

  if (quickQueryKey) {
    return "queries"
  }

  if (searchQuery) {
    return "muscles"
  }

  return "muscles"
}

function formatLabel(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : ""
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function recordStringArray(row: unknown, key: string) {
  return recordArray(row, key).map((value) => String(value)).filter(Boolean)
}

function attachmentLines(attachments: unknown[]) {
  return attachments.map((attachment) => {
    const type = formatLabel(recordText(attachment, "type"))
    const bone = relationText(attachment, "bone", "name")
    const landmark = relationText(attachment, "landmark", "name")

    return [type, [bone, landmark].filter(Boolean).join(" - ")].filter(Boolean).join(": ")
  })
}

function actionLines(actions: unknown[]) {
  return actions.map((action) => {
    const movement = relationText(action, "movement", "movementName")
    const role = formatLabel(recordText(action, "role"))

    return [movement, role].filter(Boolean).join(" / ")
  })
}

function movementLine(movement: unknown) {
  const name = recordText(movement, "movementName")
  const plane = recordText(movement, "plane")
  const axis = recordText(movement, "axis")

  return [name, [plane, axis].filter(Boolean).join(" / ")].filter(Boolean).join(" - ")
}

function romUnitLabel(unit: string) {
  switch (unit) {
    case "centimeters":
      return "cm"
    case "millimeters":
      return "mm"
    case "degrees":
      return "deg"
    default:
      return formatLabel(unit)
  }
}

function romLine(rom: unknown) {
  const movement = relationText(rom, "movement", "movementName")
  const min = recordText(rom, "typicalMinValue") || recordText(rom, "typicalMinDegrees")
  const max = recordText(rom, "typicalMaxValue") || recordText(rom, "typicalMaxDegrees")
  const unit = recordText(rom, "measurementUnit") || "degrees"

  return [movement, min && max ? `${min}-${max} ${romUnitLabel(unit)}` : ""].filter(Boolean).join(": ")
}

function entityTermLabels(data: AnatomyBrowserData, entityType: string, entitySlug: string) {
  return data.entityTerms
    .filter((term) => recordText(term, "anatomyEntityType") === entityType && recordText(term, "anatomyEntitySlug") === entitySlug)
    .map((term) => `${recordText(term, "term")} (${formatLabel(recordText(term, "termType"))})`)
}

function entityLabel(data: AnatomyBrowserData, entityType: string, entitySlug: string) {
  return data.entityNames[entityKey(entityType, entitySlug)] ?? entitySlug
}

function entityKey(entityType: string, entitySlug: string) {
  return `${entityType}:${entitySlug}`
}

function relationshipLabels(
  data: AnatomyBrowserData,
  filter: {
    sourceType?: string
    sourceSlug?: string
    relationshipType: string
    targetType?: string
    targetSlug?: string
    returnSide: "source" | "target"
  },
) {
  return data.relationships
    .filter((relationship) => {
      if (filter.sourceType && recordText(relationship, "sourceEntityType") !== filter.sourceType) return false
      if (filter.sourceSlug && recordText(relationship, "sourceEntitySlug") !== filter.sourceSlug) return false
      if (filter.targetType && recordText(relationship, "targetEntityType") !== filter.targetType) return false
      if (filter.targetSlug && recordText(relationship, "targetEntitySlug") !== filter.targetSlug) return false
      return recordText(relationship, "relationshipType") === filter.relationshipType
    })
    .map((relationship) => {
      const typeKey = filter.returnSide === "source" ? "sourceEntityType" : "targetEntityType"
      const slugKey = filter.returnSide === "source" ? "sourceEntitySlug" : "targetEntitySlug"

      return entityLabel(data, recordText(relationship, typeKey), recordText(relationship, slugKey))
    })
}

function depthRelationshipLabels(data: AnatomyBrowserData, muscleSlug: string) {
  return selectedEntityRelationships(data, { entityType: "MUSCLE", entitySlug: muscleSlug })
    .filter((row) => row.relationshipType === "deep_to" || row.relationshipType === "superficial_to")
    .map((row) => `${formatLabel(row.relationshipType)} ${row.label}`)
}

function selectedEntityDisplayDetail(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  authoritativeDetail: AnatomyEntityDetailPayload,
) {
  const row = authoritativeDetail?.entity ? asRecord(authoritativeDetail.entity) : selectedEntityRecord(data, selectedEntity)

  if (!row || Object.keys(row).length === 0) {
    return null
  }

  const description = recordText(row, "description") || recordText(row, "plainLanguageDescription")
  const facts = selectedEntityFacts(data, selectedEntity, row, authoritativeDetail)

  return {
    label: entityDisplayLabel(data, selectedEntity, row),
    subtitle: [
      recordText(row, "formalName"),
      recordText(row, "jointType"),
      formatLabel(recordText(row, "structureType")),
      formatLabel(recordText(row, "conceptType")),
      formatLabel(recordText(row, "bodySystem")),
      formatLabel(recordText(row, "relativeDepth")),
      formatLabel(recordText(row, "kind")),
      formatLabel(recordText(row, "confidence")),
    ].filter(Boolean).join(" / "),
    region: relationText(row, "region", "name") || relationText(row, "mappedRegion", "name"),
    source: relationText(row, "source", "label"),
    description,
    terms: [
      ...recordStringArray(row, "alternateNames"),
      ...entityTermLabels(data, selectedEntity.entityType, selectedEntity.entitySlug),
    ],
    facts,
  }
}

function selectedEntityRecord(data: AnatomyBrowserData, selectedEntity: AnatomyEntitySelection) {
  switch (selectedEntity.entityType) {
    case "REGION":
      return data.regions.find((region) => recordText(region, "slug") === selectedEntity.entitySlug)
    case "ANATOMY_CONCEPT":
      return data.concepts.find((concept) => recordText(concept, "slug") === selectedEntity.entitySlug)
    case "ANATOMY_STRUCTURE":
      return data.structures.find((structure) => recordText(structure, "slug") === selectedEntity.entitySlug)
    case "BONE":
      return data.bones.find((bone) => recordText(bone, "slug") === selectedEntity.entitySlug)
    case "BONE_LANDMARK":
      return data.boneLandmarks.find((landmark) => recordText(landmark, "slug") === selectedEntity.entitySlug)
    case "JOINT":
      return data.joints.find((joint) => recordText(joint, "slug") === selectedEntity.entitySlug)
    case "JOINT_MOVEMENT":
      return data.jointMovements.find((movement) => recordText(movement, "slug") === selectedEntity.entitySlug)
    case "RANGE_OF_MOTION":
      return data.rangesOfMotion.find((rom) => recordText(rom, "slug") === selectedEntity.entitySlug)
    case "MUSCLE":
      return data.muscles.find((muscle) => recordText(muscle, "slug") === selectedEntity.entitySlug)
    case "NERVE":
      return data.nerves.find((nerve) => recordText(nerve, "slug") === selectedEntity.entitySlug)
    case "LIGAMENT":
      return data.ligaments.find((ligament) => recordText(ligament, "slug") === selectedEntity.entitySlug)
    case "BLOOD_SUPPLY":
      return data.bloodSupply.find((vessel) => recordText(vessel, "slug") === selectedEntity.entitySlug)
    case "PAIN_MAP_REGION":
      return data.painRegions.find((region) => recordText(region, "slug") === selectedEntity.entitySlug)
    case "CLIENT_TERM":
      return data.clientTerms.find((term) => recordText(term, "slug") === selectedEntity.entitySlug)
    case "MUSCLE_ATTACHMENT":
    case "MUSCLE_ACTION":
    case "MUSCLE_INNERVATION":
      return undefined
  }
}

function entityDisplayLabel(data: AnatomyBrowserData, selectedEntity: AnatomyEntitySelection, row: Record<string, unknown>) {
  return (
    data.entityNames[entityKey(selectedEntity.entityType, selectedEntity.entitySlug)] ||
    recordText(row, "name") ||
    recordText(row, "movementName") ||
    recordText(row, "term") ||
    recordText(row, "title") ||
    selectedEntity.entitySlug
  )
}

function selectedEntityFacts(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  row: Record<string, unknown>,
  authoritativeDetail?: AnatomyEntityDetailPayload,
) {
  switch (selectedEntity.entityType) {
    case "REGION":
      return [
        relationText(row, "parentRegion", "name") ? `Parent region: ${relationText(row, "parentRegion", "name")}` : "",
        recordText(row, "bodySystem") ? `Body system: ${formatLabel(recordText(row, "bodySystem"))}` : "",
      ].filter(Boolean)
    case "MUSCLE":
      return [
        ...attachmentLines(recordArray(row, "attachments")),
        ...recordArray(row, "innervations").map((innervation) => `Innervated by ${relationText(innervation, "nerve", "name")}`),
        ...actionLines(recordArray(row, "actions")),
        ...relationshipLabels(data, {
          sourceType: "BLOOD_SUPPLY",
          relationshipType: "supplies",
          targetType: "MUSCLE",
          targetSlug: selectedEntity.entitySlug,
          returnSide: "source",
        }).map((label) => `Supplied by ${label}`),
        ...depthRelationshipLabels(data, selectedEntity.entitySlug),
      ]
    case "BONE":
      return [
        ...recordArray(row, "landmarks").map((landmark) => `Landmark: ${recordText(landmark, "name")}`),
        ...uniqueStrings(recordArray(row, "attachments").map((attachment) => `Attachment: ${relationText(attachment, "muscle", "name")}`)),
      ]
    case "BONE_LANDMARK":
      return [
        relationText(row, "bone", "name") ? `Bone: ${relationText(row, "bone", "name")}` : "",
      ].filter(Boolean)
    case "JOINT":
      return [
        ...recordArray(row, "movements").map((movement) => `Movement: ${movementLine(movement)}`),
        ...recordArray(row, "rangesOfMotion").map((rom) => `ROM: ${romLine(rom)}`),
        ...recordArray(row, "ligaments").map((ligament) => `Ligament: ${recordText(ligament, "name")}`),
      ]
    case "JOINT_MOVEMENT":
      return [
        relationText(row, "joint", "name") ? `Joint: ${relationText(row, "joint", "name")}` : "",
        recordText(row, "plane") ? `Plane: ${formatLabel(recordText(row, "plane"))}` : "",
        recordText(row, "axis") ? `Axis: ${formatLabel(recordText(row, "axis"))}` : "",
      ].filter(Boolean)
    case "RANGE_OF_MOTION":
      return [
        relationText(row, "joint", "name") ? `Joint: ${relationText(row, "joint", "name")}` : "",
        relationText(row, "movement", "movementName") ? `Movement: ${relationText(row, "movement", "movementName")}` : "",
        romLine(row) ? `ROM: ${romLine(row)}` : "",
      ].filter(Boolean)
    case "NERVE":
      return recordArray(row, "innervations").map((innervation) => `Innervates ${relationText(innervation, "muscle", "name")}`)
    case "LIGAMENT":
      return [
        relationText(row, "joint", "name") ? `Joint: ${relationText(row, "joint", "name")}` : "",
        relationText(row, "region", "name") ? `Region: ${relationText(row, "region", "name")}` : "",
      ].filter(Boolean)
    case "BLOOD_SUPPLY":
      return relationshipLabels(data, {
        sourceType: "BLOOD_SUPPLY",
        sourceSlug: selectedEntity.entitySlug,
        relationshipType: "supplies",
        targetType: "MUSCLE",
        returnSide: "target",
      }).map((label) => `Supplies ${label}`)
    case "ANATOMY_STRUCTURE":
      return [
        recordText(row, "structureType") ? `Type: ${formatLabel(recordText(row, "structureType"))}` : "",
        ...selectedEntityRelationships(data, selectedEntity, authoritativeDetail).map((relationship) => `${formatLabel(relationship.relationshipType)} ${relationship.label}`),
      ].filter(Boolean)
    case "ANATOMY_CONCEPT":
      return [
        recordText(row, "conceptType") ? `Type: ${formatLabel(recordText(row, "conceptType"))}` : "",
        recordText(row, "bodySystem") ? `Body system: ${formatLabel(recordText(row, "bodySystem"))}` : "",
        ...selectedEntityRelationships(data, selectedEntity, authoritativeDetail).map((relationship) => `${formatLabel(relationship.relationshipType)} ${relationship.label}`),
      ].filter(Boolean)
    case "PAIN_MAP_REGION":
      return [
        recordText(row, "laterality") ? `Laterality: ${formatLabel(recordText(row, "laterality"))}` : "",
        recordText(row, "surface") ? `Surface: ${formatLabel(recordText(row, "surface"))}` : "",
        ...relationshipLabels(data, {
          sourceType: "PAIN_MAP_REGION",
          sourceSlug: selectedEntity.entitySlug,
          relationshipType: "overlaps_region",
          targetType: "REGION",
          returnSide: "target",
        }).map((label) => `Overlaps ${label}`),
      ].filter(Boolean)
    case "CLIENT_TERM":
      return [
        relationText(row, "mappedRegion", "name") ? `Region: ${relationText(row, "mappedRegion", "name")}` : "",
        relationText(row, "mappedMuscle", "name") ? `Muscle: ${relationText(row, "mappedMuscle", "name")}` : "",
        relationText(row, "mappedJoint", "name") ? `Joint: ${relationText(row, "mappedJoint", "name")}` : "",
        relationText(row, "mappedStructure", "name") ? `Structure: ${relationText(row, "mappedStructure", "name")}` : "",
      ].filter(Boolean)
  }

  return []
}

function selectedEntityRelationships(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  authoritativeDetail?: AnatomyEntityDetailPayload,
) {
  if (authoritativeDetail) {
    return [
      ...authoritativeDetail.relationships.outgoing.map((relationship) => relationshipRowFromDetail(data, relationship, "outgoing")),
      ...authoritativeDetail.relationships.incoming.map((relationship) => relationshipRowFromDetail(data, relationship, "incoming")),
    ]
  }

  return data.relationships
    .flatMap((relationship) => {
      const sourceMatches = recordText(relationship, "sourceEntityType") === selectedEntity.entityType && recordText(relationship, "sourceEntitySlug") === selectedEntity.entitySlug
      const targetMatches = recordText(relationship, "targetEntityType") === selectedEntity.entityType && recordText(relationship, "targetEntitySlug") === selectedEntity.entitySlug

      if (!sourceMatches && !targetMatches) {
        return []
      }

      const entityType = sourceMatches ? recordText(relationship, "targetEntityType") : recordText(relationship, "sourceEntityType")
      const entitySlug = sourceMatches ? recordText(relationship, "targetEntitySlug") : recordText(relationship, "sourceEntitySlug")

      return [{
        direction: sourceMatches ? "outgoing" : "incoming",
        relationshipType: recordText(relationship, "relationshipType"),
        entityType,
        entitySlug,
        label: entityLabel(data, entityType, entitySlug),
        source: relationText(relationship, "source", "label"),
      }]
    })
}

function relationshipRowFromDetail(data: AnatomyBrowserData, relationship: unknown, direction: "outgoing" | "incoming") {
  const entityType = direction === "outgoing" ? recordText(relationship, "targetEntityType") : recordText(relationship, "sourceEntityType")
  const entitySlug = direction === "outgoing" ? recordText(relationship, "targetEntitySlug") : recordText(relationship, "sourceEntitySlug")

  return {
    direction,
    relationshipType: recordText(relationship, "relationshipType"),
    entityType,
    entitySlug,
    label: entityLabel(data, entityType, entitySlug),
    source: relationText(relationship, "source", "label"),
  }
}

function selectedEntityCitations(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  authoritativeDetail?: AnatomyEntityDetailPayload,
) {
  if (authoritativeDetail) {
    return authoritativeDetail.citations as Record<string, unknown>[]
  }

  return data.citations.filter((citation) => (
    recordText(citation, "entityType") === selectedEntity.entityType &&
    recordText(citation, "entitySlug") === selectedEntity.entitySlug
  ))
}

function selectedEntityExternalIdentifiers(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  authoritativeDetail?: AnatomyEntityDetailPayload,
) {
  if (authoritativeDetail) {
    return authoritativeDetail.externalIdentifiers as Record<string, unknown>[]
  }

  return data.externalIdentifiers.filter((identifier) => (
    recordText(identifier, "entityType") === selectedEntity.entityType &&
    recordText(identifier, "entitySlug") === selectedEntity.entitySlug
  ))
}

function selectedEntityMediaAssets(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  authoritativeDetail?: AnatomyEntityDetailPayload,
) {
  if (authoritativeDetail) {
    return authoritativeDetail.mediaAssets as Record<string, unknown>[]
  }

  return data.mediaAssets.filter((asset) => (
    recordArray(asset, "entityLinks").some((link) => (
      recordText(link, "entityType") === selectedEntity.entityType &&
      recordText(link, "entitySlug") === selectedEntity.entitySlug
    ))
  ))
}

type MediaReviewRow = {
  asset: Record<string, unknown>
  link: Record<string, unknown>
}

function mediaReviewRows(mediaRows: Record<string, unknown>[], selectedEntity: AnatomyEntitySelection): MediaReviewRow[] {
  return mediaRows.flatMap((asset) => (
    recordArray(asset, "entityLinks")
      .filter((link) => (
        recordText(link, "entityType") === selectedEntity.entityType &&
        recordText(link, "entitySlug") === selectedEntity.entitySlug
      ))
      .map((link) => ({ asset, link: asRecord(link) }))
  ))
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

function sourceLabel(asset: Record<string, unknown>) {
  return relationText(asset, "source", "label") || relationText(asset, "source", "slug")
}

function mediaRoleKey(assetId: string, role: string) {
  return `${assetId}:${(role || "REFERENCE").toUpperCase()}`
}

function hasAvailableMediaRole(asset: Record<string, unknown>, linkedRoleKeys: Set<string>) {
  const id = recordText(asset, "id")
  return Boolean(id) && MEDIA_ROLES.some((role) => !linkedRoleKeys.has(mediaRoleKey(id, role)))
}

function mediaCandidateRows(data: AnatomyBrowserData, linkedRoleKeys: Set<string>) {
  return data.mediaAssets
    .filter((asset) => {
      const id = recordText(asset, "id")
      if (!id || !hasAvailableMediaRole(asset, linkedRoleKeys)) return false
      if (!["IMAGE", "DIAGRAM"].includes(recordText(asset, "mediaType"))) return false
      if (!mediaPreviewUrl(asset)) return false

      return recordText(asset, "usageScope") === "OPEN_REUSE" && recordText(asset, "reviewStatus") === "REVIEWED"
    })
    .slice(0, 160)
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

function suggestedBodyParts3dPartIds(mediaRows: Record<string, unknown>[], identifierRows: Record<string, unknown>[]) {
  const mediaPartIds = mediaRows.flatMap((asset) => recordStringArray(recordObject(asset, "metadata"), "bodyparts3dPartIds"))
  const identifierPartIds = identifierRows
    .filter((identifier) => recordText(identifier, "provider").toUpperCase() === "FMA")
    .map((identifier) => recordText(identifier, "identifier"))

  return normalizeBodyParts3dPartIds([...mediaPartIds, ...identifierPartIds])
}

function selectedEntitySpatialMappings(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  authoritativeDetail?: AnatomyEntityDetailPayload,
) {
  if (authoritativeDetail) {
    return authoritativeDetail.spatialMappings as Record<string, unknown>[]
  }

  return data.spatialEntityMaps.filter((map) => (
    recordText(map, "entityType") === selectedEntity.entityType &&
    recordText(map, "entitySlug") === selectedEntity.entitySlug
  ))
}

function selectedEntityMovementVisualizations(
  data: AnatomyBrowserData,
  selectedEntity: AnatomyEntitySelection,
  authoritativeDetail?: AnatomyEntityDetailPayload,
) {
  if (authoritativeDetail) {
    return authoritativeDetail.movementVisualizations as Record<string, unknown>[]
  }

  return data.movementVisualizations.filter((visualization) => {
    const primaryMatches = (
      recordText(visualization, "primaryEntityType") === selectedEntity.entityType &&
      recordText(visualization, "primaryEntitySlug") === selectedEntity.entitySlug
    )
    const jointMatches = selectedEntity.entityType === "JOINT" && relationText(visualization, "joint", "slug") === selectedEntity.entitySlug
    const movementMatches = selectedEntity.entityType === "JOINT_MOVEMENT" && relationText(visualization, "movement", "slug") === selectedEntity.entitySlug

    return primaryMatches || jointMatches || movementMatches
  })
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppPageShell title="Anatomy Admin" className="p-0 sm:p-6 lg:p-8" contentClassName="gap-0 sm:gap-6">
      {children}
    </AppPageShell>
  )
}

function TextField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  required,
  type,
  inputMode,
  min,
  max,
  hint,
}: {
  id: string
  name?: string
  label: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  type?: React.HTMLInputTypeAttribute
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  min?: number
  max?: number
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name ?? id}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function SelectField({
  id,
  name,
  label,
  values,
  defaultValue,
  hint,
}: {
  id: string
  name?: string
  label: string
  values: string[]
  defaultValue?: string
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name ?? id}
        defaultValue={defaultValue ?? values[0]}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {values.map((value) => (
          <option key={value} value={value}>
            {formatLabel(value)}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function TermSelect({ terms, id, label }: { terms: AnatomyTermRow[]; id: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        {terms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.preferredName}
          </option>
        ))}
      </select>
    </div>
  )
}

function quickQueryFromParam(value: string | undefined) {
  return ANATOMY_ADMIN_QUICK_QUERIES.find((query) => query.key === value)?.key
}

async function getAnatomyFoundationCounts(): Promise<AnatomyFoundationCount[]> {
  const [
    regions,
    bones,
    landmarks,
    joints,
    movements,
    rom,
    muscles,
    structures,
    concepts,
    nerves,
    ligaments,
    bloodSupply,
    painRegions,
    clientTerms,
    entityTerms,
    relationships,
    citations,
    externalIdentifiers,
    mediaAssets,
    spatialModels,
    spatialEntityMaps,
    movementVisualizations,
  ] = await Promise.all([
    prisma.anatomyRegion.count(),
    prisma.bone.count(),
    prisma.boneLandmark.count(),
    prisma.joint.count(),
    prisma.jointMovement.count(),
    prisma.rangeOfMotion.count(),
    prisma.muscle.count(),
    prisma.anatomyStructure.count(),
    prisma.anatomyConcept.count(),
    prisma.nerve.count(),
    prisma.ligament.count(),
    prisma.bloodSupply.count(),
    prisma.painMapRegion.count(),
    prisma.clientTerm.count(),
    prisma.anatomyEntityTerm.count(),
    prisma.anatomyRelationship.count({ where: { sourceEntityType: { not: null } } }),
    prisma.anatomyCitation.count(),
    prisma.externalAnatomyIdentifier.count(),
    prisma.anatomyMediaAsset.count(),
    prisma.anatomySpatialModel.count(),
    prisma.anatomySpatialEntityMap.count(),
    prisma.anatomyMovementVisualization.count(),
  ])

  return [
    { label: "Regions", value: regions },
    { label: "Bones", value: bones },
    { label: "Landmarks", value: landmarks },
    { label: "Joints", value: joints },
    { label: "Movements", value: movements },
    { label: "ROM values", value: rom },
    { label: "Muscles", value: muscles },
    { label: "Structures", value: structures },
    { label: "Concepts", value: concepts },
    { label: "Nerves", value: nerves },
    { label: "Ligaments", value: ligaments },
    { label: "Vessels", value: bloodSupply },
    { label: "Pain regions", value: painRegions },
    { label: "Client terms", value: clientTerms },
    { label: "Entity terms", value: entityTerms },
    { label: "Relationships", value: relationships },
    { label: "Citations", value: citations },
    { label: "External IDs", value: externalIdentifiers },
    { label: "Media assets", value: mediaAssets },
    { label: "Spatial models", value: spatialModels },
    { label: "Spatial maps", value: spatialEntityMaps },
    { label: "Movement visuals", value: movementVisualizations },
  ]
}

async function getAnatomyBrowserData(): Promise<AnatomyBrowserData> {
  const [
    regions,
    muscles,
    structures,
    concepts,
    bones,
    boneLandmarks,
    joints,
    jointMovements,
    rangesOfMotion,
    nerves,
    ligaments,
    bloodSupply,
    painRegions,
    clientTerms,
    entityTerms,
    sources,
    relationships,
    citations,
    externalIdentifiers,
    mediaAssets,
    spatialModels,
    spatialEntityMaps,
    movementVisualizations,
  ] = await Promise.all([
    prisma.anatomyRegion.findMany({
      include: {
        parentRegion: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 120,
    }),
    prisma.muscle.findMany({
      include: {
        region: true,
        source: true,
        attachments: {
          include: { bone: true, landmark: true },
          orderBy: { type: "asc" },
        },
        innervations: {
          include: { nerve: true },
          orderBy: { slug: "asc" },
        },
        actions: {
          include: { joint: true, movement: true },
          orderBy: { slug: "asc" },
        },
      },
      orderBy: { name: "asc" },
      take: 80,
    }),
    prisma.anatomyStructure.findMany({
      include: {
        region: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 120,
    }),
    prisma.anatomyConcept.findMany({
      include: {
        source: true,
      },
      orderBy: { name: "asc" },
      take: 120,
    }),
    prisma.bone.findMany({
      include: {
        region: true,
        source: true,
        landmarks: { orderBy: { name: "asc" } },
        attachments: {
          include: { muscle: true, landmark: true },
          orderBy: { type: "asc" },
        },
      },
      orderBy: { name: "asc" },
      take: 80,
    }),
    prisma.boneLandmark.findMany({
      include: {
        bone: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 160,
    }),
    prisma.joint.findMany({
      include: {
        region: true,
        source: true,
        movements: { orderBy: { movementName: "asc" } },
        rangesOfMotion: {
          include: { movement: true, source: true },
          orderBy: { slug: "asc" },
        },
        ligaments: { orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
      take: 80,
    }),
    prisma.jointMovement.findMany({
      include: {
        joint: true,
        source: true,
      },
      orderBy: { movementName: "asc" },
      take: 160,
    }),
    prisma.rangeOfMotion.findMany({
      include: {
        joint: true,
        movement: true,
        source: true,
      },
      orderBy: { slug: "asc" },
      take: 160,
    }),
    prisma.nerve.findMany({
      include: {
        region: true,
        source: true,
        innervations: {
          include: { muscle: true },
          orderBy: { slug: "asc" },
        },
      },
      orderBy: { name: "asc" },
      take: 80,
    }),
    prisma.ligament.findMany({
      include: {
        region: true,
        joint: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 160,
    }),
    prisma.bloodSupply.findMany({
      include: {
        region: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 80,
    }),
    prisma.painMapRegion.findMany({
      include: {
        region: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 80,
    }),
    prisma.clientTerm.findMany({
      include: {
        mappedRegion: true,
        mappedMuscle: true,
        mappedJoint: true,
        mappedStructure: true,
        source: true,
      },
      orderBy: { term: "asc" },
      take: 80,
    }),
    prisma.anatomyEntityTerm.findMany({
      include: { source: true },
      orderBy: [{ anatomyEntityType: "asc" }, { anatomyEntitySlug: "asc" }, { termType: "asc" }],
      take: 120,
    }),
    prisma.anatomySource.findMany({
      orderBy: { label: "asc" },
      take: 80,
    }),
    prisma.anatomyRelationship.findMany({
      include: { source: true },
      where: {
        sourceEntityType: { not: null },
      },
      orderBy: [{ sourceEntityType: "asc" }, { sourceEntitySlug: "asc" }, { relationshipType: "asc" }],
      take: 160,
    }),
    prisma.anatomyCitation.findMany({
      include: { source: true },
      orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }, { factType: "asc" }],
      take: ANATOMY_DETAIL_LOOKUP_TAKE,
    }),
    prisma.externalAnatomyIdentifier.findMany({
      include: { source: true },
      orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }, { provider: "asc" }],
      take: ANATOMY_DETAIL_LOOKUP_TAKE,
    }),
    prisma.anatomyMediaAsset.findMany({
      include: { source: true, entityLinks: true },
      orderBy: [{ usageScope: "asc" }, { title: "asc" }],
      take: 500,
    }),
    prisma.anatomySpatialModel.findMany({
      include: { source: true, mediaAsset: true },
      orderBy: [{ reviewStatus: "asc" }, { name: "asc" }],
      take: 80,
    }),
    prisma.anatomySpatialEntityMap.findMany({
      include: { model: true, source: true },
      orderBy: [{ reviewStatus: "asc" }, { entityType: "asc" }, { entitySlug: "asc" }],
      take: 160,
    }),
    prisma.anatomyMovementVisualization.findMany({
      include: {
        model: true,
        joint: true,
        movement: true,
        rangeOfMotion: true,
        source: true,
      },
      orderBy: [{ reviewStatus: "asc" }, { slug: "asc" }],
      take: 80,
    }),
  ])

  const entityNames: Record<string, string> = {}
  const addEntityName = (entityType: string, slug: string, label: string) => {
    entityNames[entityKey(entityType, slug)] = label
  }

  for (const region of regions) addEntityName("REGION", region.slug, region.name)
  for (const muscle of muscles) addEntityName("MUSCLE", muscle.slug, muscle.name)
  for (const structure of structures) addEntityName("ANATOMY_STRUCTURE", structure.slug, structure.name)
  for (const concept of concepts) addEntityName("ANATOMY_CONCEPT", concept.slug, concept.name)
  for (const bone of bones) {
    addEntityName("BONE", bone.slug, bone.name)
    for (const landmark of bone.landmarks) addEntityName("BONE_LANDMARK", landmark.slug, landmark.name)
  }
  for (const landmark of boneLandmarks) addEntityName("BONE_LANDMARK", landmark.slug, landmark.name)
  for (const joint of joints) {
    addEntityName("JOINT", joint.slug, joint.name)
    for (const movement of joint.movements) addEntityName("JOINT_MOVEMENT", movement.slug, movement.movementName)
    for (const ligament of joint.ligaments) addEntityName("LIGAMENT", ligament.slug, ligament.name)
  }
  for (const movement of jointMovements) addEntityName("JOINT_MOVEMENT", movement.slug, movement.movementName)
  for (const rom of rangesOfMotion) addEntityName("RANGE_OF_MOTION", rom.slug, rom.slug)
  for (const ligament of ligaments) addEntityName("LIGAMENT", ligament.slug, ligament.name)
  for (const nerve of nerves) addEntityName("NERVE", nerve.slug, nerve.name)
  for (const vessel of bloodSupply) addEntityName("BLOOD_SUPPLY", vessel.slug, vessel.name)
  for (const painRegion of painRegions) addEntityName("PAIN_MAP_REGION", painRegion.slug, painRegion.name)
  for (const clientTerm of clientTerms) addEntityName("CLIENT_TERM", clientTerm.slug, clientTerm.term)
  const entityOptions = Object.entries(entityNames)
    .map(([key, label]) => {
      const [entityType, entitySlug] = key.split(":", 2)

      return { entityType, entitySlug, label }
    })
    .sort((left, right) => left.label.localeCompare(right.label))

  return {
    regions: regions as Record<string, unknown>[],
    muscles: muscles as Record<string, unknown>[],
    structures: structures as Record<string, unknown>[],
    concepts: concepts as Record<string, unknown>[],
    bones: bones as Record<string, unknown>[],
    boneLandmarks: boneLandmarks as Record<string, unknown>[],
    joints: joints as Record<string, unknown>[],
    jointMovements: jointMovements as Record<string, unknown>[],
    rangesOfMotion: rangesOfMotion as Record<string, unknown>[],
    nerves: nerves as Record<string, unknown>[],
    ligaments: ligaments as Record<string, unknown>[],
    bloodSupply: bloodSupply as Record<string, unknown>[],
    painRegions: painRegions as Record<string, unknown>[],
    clientTerms: clientTerms as Record<string, unknown>[],
    entityTerms: entityTerms as Record<string, unknown>[],
    sources: sources as Record<string, unknown>[],
    relationships: relationships as Record<string, unknown>[],
    citations: citations as Record<string, unknown>[],
    externalIdentifiers: externalIdentifiers as Record<string, unknown>[],
    mediaAssets: mediaAssets as Record<string, unknown>[],
    spatialModels: spatialModels as Record<string, unknown>[],
    spatialEntityMaps: spatialEntityMaps as Record<string, unknown>[],
    movementVisualizations: movementVisualizations as Record<string, unknown>[],
    entityNames,
    entityOptions,
  }
}

async function getAnatomyQuickResult(key: AnatomyQuickQueryKey | undefined): Promise<AnatomyQuickResult | null> {
  switch (key) {
    case "scapula-attachments": {
      const rows = await anatomyQueries.getMusclesAttachedToBone("scapula")

      return {
        title: "Muscles attached to the scapula",
        description: "Uses typed MuscleAttachment rows joined through Bone and BoneLandmark records.",
        rows: rows.map((row) => ({
          title: recordText(row, "name"),
          subtitle: recordText(row, "formalName"),
          meta: relationText(row, "region", "name"),
          detail: attachmentSummary(row),
        })),
      }
    }
    case "accessory-nerve": {
      const rows = await anatomyQueries.getMusclesByInnervation("accessory-nerve")

      return {
        title: "Accessory nerve innervation",
        description: "Uses typed MuscleInnervation rows joined through Nerve records.",
        rows: rows.map((row) => ({
          title: recordText(row, "name"),
          subtitle: recordText(row, "formalName"),
          meta: relationText(row, "region", "name"),
          detail: innervationSummary(row),
        })),
      }
    }
    case "shoulder-abduction": {
      const rows = await anatomyQueries.getMusclesForMovement("shoulder-abduction")

      return {
        title: "Shoulder abduction contributors",
        description: "Uses typed MuscleAction rows so role and contraction type remain queryable.",
        rows: rows.map((row) => ({
          title: relationText(row, "muscle", "name"),
          subtitle: `${recordText(row, "role")} / ${recordText(row, "contractionType")}`,
          meta: `${relationText(row, "joint", "name")} - ${relationText(row, "movement", "movementName")}`,
          detail: recordText(row, "description"),
        })),
      }
    }
    case "cervical-rotation-rom": {
      const row = await anatomyQueries.getRangeOfMotion("cervical-spine", "cervical-rotation")

      return {
        title: "Typical cervical rotation ROM",
        description: "Uses a typed RangeOfMotion row joined through Joint and JointMovement.",
        rows: row ? [{
          title: `${relationText(row, "joint", "name")} - ${relationText(row, "movement", "movementName")}`,
          subtitle: romLine(row),
          meta: relationText(row, "source", "label"),
          detail: `${recordText(row, "measurementPosition")} ${recordText(row, "notes")}`.trim(),
        }] : [],
      }
    }
    case "scapular-pain-overlaps": {
      const rows = await anatomyQueries.getPainMapOverlaps("scapular-region")

      return {
        title: "Pain-map regions overlapping the scapular region",
        description: "Uses generic AnatomyRelationship rows for cross-entity overlap relationships.",
        rows: rows.map((row) => ({
          title: recordText(row, "sourceEntitySlug"),
          subtitle: `${recordText(row, "sourceEntityType")} -> ${recordText(row, "targetEntityType")}`,
          meta: relationText(row, "source", "label"),
          detail: recordText(row, "relationshipType"),
        })),
      }
    }
    case "between-shoulder-blades":
    case "top-of-shoulder":
    case "base-of-skull-client-language": {
      const searchTerm = key === "base-of-skull-client-language" ? "base of skull" : key.replaceAll("-", " ")
      const rows = await anatomyQueries.getClientTermMappings(searchTerm)

      return {
        title: `Client language: ${searchTerm}`,
        description: "Uses ClientTerm rows mapped to normalized regions, muscles, and joints.",
        rows: rows.map((row) => ({
          title: recordText(row, "term"),
          subtitle: recordText(row, "confidence"),
          meta: [
            relationText(row, "mappedRegion", "name"),
            relationText(row, "mappedMuscle", "name"),
            relationText(row, "mappedJoint", "name"),
            relationText(row, "mappedStructure", "name"),
          ].filter(Boolean).join(" / "),
          detail: recordText(row, "plainLanguageDescription"),
        })),
      }
    }
    case "has-reviewed-citations": {
      const rows = await prisma.anatomyCitation.findMany({
        where: { reviewStatus: "REVIEWED" },
        include: { source: true },
        orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }, { factType: "asc" }],
        take: 40,
      })

      return {
        title: "Reviewed citation records",
        description: "Shows facts with explicit reviewed citation records.",
        rows: rows.map((row) => ({
          title: `${row.entityType} / ${row.entitySlug}`,
          subtitle: row.factType,
          meta: row.source.label,
          detail: [row.sourceLocator, row.citationNote].filter(Boolean).join(" - "),
        })),
      }
    }
    case "missing-citations": {
      const rows = await prisma.anatomyCitation.findMany({
        where: { reviewStatus: { not: "REVIEWED" } },
        include: { source: true },
        orderBy: [{ reviewStatus: "asc" }, { entityType: "asc" }, { entitySlug: "asc" }],
        take: 40,
      })

      return {
        title: "Citation records needing review",
        description: "Shows citation candidates that are not locked as reviewed yet.",
        rows: rows.map((row) => ({
          title: `${row.entityType} / ${row.entitySlug}`,
          subtitle: row.factType,
          meta: formatLabel(row.reviewStatus),
          detail: [row.source.label, row.sourceLocator].filter(Boolean).join(" - "),
        })),
      }
    }
    case "has-open-media": {
      const rows = await prisma.anatomyMediaAsset.findMany({
        where: { usageScope: "OPEN_REUSE", reviewStatus: "REVIEWED" },
        include: { source: true, entityLinks: true },
        orderBy: { title: "asc" },
        take: 40,
      })

      return {
        title: "Reviewed open-license media",
        description: "Shows media/model candidates safe for open-license reuse.",
        rows: rows.map((row) => ({
          title: row.title,
          subtitle: `${row.mediaType} / ${row.license}`,
          meta: row.source.label,
          detail: row.entityLinks.map((link) => `${link.entityType}:${link.entitySlug}`).join("; "),
        })),
      }
    }
    case "spatial-review-queue": {
      const [maps, visualizations] = await Promise.all([
        prisma.anatomySpatialEntityMap.findMany({
          where: { reviewStatus: { not: "REVIEWED" } },
          include: { model: true, source: true },
          orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }],
          take: 40,
        }),
        prisma.anatomyMovementVisualization.findMany({
          where: { reviewStatus: { not: "REVIEWED" } },
          include: {
            model: true,
            joint: true,
            movement: true,
            source: true,
          },
          orderBy: { slug: "asc" },
          take: 40,
        }),
      ])

      return {
        title: "3D and spatial review queue",
        description: "Shows body-map mappings and ROM visualization anchors that stay review-only until runtime mesh, node, and rig details are confirmed.",
        rows: [
          ...maps.map((row) => ({
            title: `${row.entityType} / ${row.entitySlug}`,
            subtitle: `${row.model.name} / ${formatLabel(row.mappingPrecision)}`,
            meta: formatLabel(row.reviewStatus),
            detail: [row.source.label, row.notes].filter(Boolean).join(" - "),
          })),
          ...visualizations.map((row) => ({
            title: `${row.joint.name} / ${row.movement.movementName}`,
            subtitle: row.model.name,
            meta: formatLabel(row.reviewStatus),
            detail: [row.source.label, row.notes].filter(Boolean).join(" - "),
          })),
        ],
      }
    }
    case "game-ready-prompts": {
      const rows = await anatomyQueries.getAnatomyGamePromptPool({ regionSlug: "shoulder-girdle", take: 40 })

      return {
        title: "Game-ready anatomy prompt pool",
        description: "Shows structures with attachments, actions, and innervation ready for anatomy games.",
        rows: rows.map((row) => ({
          title: recordText(row, "name"),
          subtitle: relationText(row, "region", "name"),
          meta: `Actions ${recordArray(row, "actions").length} / Attachments ${recordArray(row, "attachments").length}`,
          detail: actionLines(recordArray(row, "actions")).join("; "),
        })),
      }
    }
    default:
      return null
  }
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

function recordNumber(row: unknown, key: string, fallback = 0) {
  const parsed = Number(asRecord(row)[key])
  return Number.isFinite(parsed) ? parsed : fallback
}

function recordObject(row: unknown, key: string) {
  const value = asRecord(row)[key]
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function externalIdentifierHref(identifier: unknown) {
  return normalizedExternalHref(recordText(identifier, "iri")) || normalizedExternalHref(recordText(identifier, "url")) || normalizedExternalHref(relationText(identifier, "source", "url"))
}

function citationHref(citation: unknown) {
  return normalizedExternalHref(recordText(citation, "sourceLocator")) || normalizedExternalHref(relationText(citation, "source", "url"))
}

function normalizedExternalHref(value: string) {
  if (!value) {
    return ""
  }

  try {
    const url = new URL(value)

    return url.protocol === "http:" || url.protocol === "https:" ? value : ""
  } catch {
    return ""
  }
}

function recordArray(row: unknown, key: string) {
  const value = asRecord(row)[key]

  return Array.isArray(value) ? value : []
}

function attachmentSummary(row: unknown) {
  return recordArray(row, "attachments")
    .map((attachment) => {
      const type = recordText(attachment, "type")
      const bone = relationText(attachment, "bone", "name")
      const landmark = relationText(attachment, "landmark", "name")

      return [type, bone, landmark].filter(Boolean).join(": ")
    })
    .filter(Boolean)
    .join("; ")
}

function innervationSummary(row: unknown) {
  return recordArray(row, "innervations")
    .map((innervation) => {
      const nerve = relationText(innervation, "nerve", "name")
      const description = recordText(innervation, "description")

      return [nerve, description].filter(Boolean).join(": ")
    })
    .filter(Boolean)
    .join("; ")
}
