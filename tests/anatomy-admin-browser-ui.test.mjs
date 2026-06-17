import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("Anatomy admin browser table UI", () => {
  it("exposes top and bottom horizontal scroll tracks with resizable columns", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")
    const scrollSource = await readFile(new URL("../app/admin/anatomy/synced-horizontal-scroll.tsx", import.meta.url), "utf8")

    assert.match(pageSource, /<SyncedHorizontalScroll/)
    assert.match(scrollSource, /data-anatomy-table-scroll="top"/)
    assert.match(scrollSource, /data-anatomy-table-scroll="bottom"/)
    assert.match(pageSource, /data-anatomy-resizable-column/)
  })

  it("keeps anatomy query controls and table headers sticky without top-loading count chips", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")
    const scrollSource = await readFile(new URL("../app/admin/anatomy/synced-horizontal-scroll.tsx", import.meta.url), "utf8")
    const stickyFrameSource = await readFile(new URL("../app/admin/anatomy/anatomy-browser-sticky-frame.tsx", import.meta.url), "utf8")
    const globalsSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8")
    const browserStart = pageSource.indexOf("function AnatomyDatabaseBrowser")
    const maintenanceStart = pageSource.indexOf("function MaintenanceView")
    const browserBody = pageSource.slice(browserStart, maintenanceStart)
    const maintenanceBody = pageSource.slice(maintenanceStart)

    assert.match(pageSource, /<AnatomyBrowserStickyFrame/)
    assert.match(stickyFrameSource, /data-anatomy-browser-toolbar/)
    assert.match(stickyFrameSource, /data-compact/)
    assert.match(stickyFrameSource, /closest\("\.ml-app-scroll"\)/)
    assert.match(stickyFrameSource, /sticky top-0/)
    assert.match(pageSource, /data-anatomy-search-label/)
    assert.match(pageSource, /data-anatomy-compact-control/)
    assert.match(pageSource, /data-anatomy-view-tabs/)
    assert.match(globalsSource, /\[data-anatomy-browser-toolbar\]\[data-compact="true"\]/)
    assert.match(pageSource, /className="p-0 sm:p-6 lg:p-8"/)
    assert.match(pageSource, /contentClassName="gap-0 sm:gap-6"/)
    assert.match(pageSource, /data-anatomy-table-header/)
    assert.match(pageSource, /data-anatomy-table-header-cell/)
    assert.match(scrollSource, /--anatomy-browser-sticky-offset/)
    assert.doesNotMatch(browserBody, /counts\.map/)
    assert.match(maintenanceBody, /counts\.map/)
  })

  it("separates anatomy browser tabs and exposes body-system views", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")
    const entityViewsStart = pageSource.indexOf("const ENTITY_BROWSER_VIEWS")
    const hiddenEntityViewsStart = pageSource.indexOf("const SYSTEM_REDUNDANT_ENTITY_BROWSER_VIEWS")
    const bodySystemConfigsStart = pageSource.indexOf("const BODY_SYSTEM_CONFIGS")
    const tissueTypeConfigsStart = pageSource.indexOf("const TISSUE_TYPE_CONFIGS")
    const entityViewsSource = pageSource.slice(entityViewsStart, hiddenEntityViewsStart)
    const hiddenEntityViewsSource = pageSource.slice(hiddenEntityViewsStart, pageSource.indexOf("const BODY_SYSTEM_BROWSER_VIEWS"))
    const bodySystemConfigsSource = pageSource.slice(bodySystemConfigsStart, tissueTypeConfigsStart)
    const tissueTypeConfigsSource = pageSource.slice(tissueTypeConfigsStart, pageSource.indexOf("type TissueTypeBrowserView"))

    for (const label of [
      "Joints",
      "ROM",
      "Terms",
      "Pain",
    ]) {
      assert.match(entityViewsSource, new RegExp(`label: "${label.replace("/", "\\/")}"`))
    }

    for (const label of [
      "Muscles",
      "Ligaments",
      "Nerves",
      "Vessels",
    ]) {
      assert.doesNotMatch(entityViewsSource, new RegExp(`label: "${label}"`))
      assert.match(hiddenEntityViewsSource, new RegExp(`label: "${label}"`))
    }

    for (const label of [
      "Integumentary",
      "Skeletal",
      "Muscular",
      "Nervous",
      "Cardiovascular",
      "Lymphatic",
      "Respiratory",
      "Digestive",
      "Endocrine",
      "Urinary",
      "Reproductive",
    ]) {
      assert.match(bodySystemConfigsSource, new RegExp(`label: "${label}"`))
    }

    for (const label of [
      "Musculoskeletal",
      "Lymphatic/immune",
      "Sensory",
    ]) {
      assert.doesNotMatch(bodySystemConfigsSource, new RegExp(`label: "${label.replace("/", "\\/")}"`))
    }

    for (const label of [
      "Epithelial",
      "Connective",
      "Muscle tissue",
      "Nervous tissue",
    ]) {
      assert.match(tissueTypeConfigsSource, new RegExp(`label: "${label}"`))
    }

    assert.doesNotMatch(pageSource, /Joints & ROM/)
    assert.doesNotMatch(pageSource, /Nerves & vessels/)
    assert.doesNotMatch(pageSource, /Terms & pain/)
    assert.match(pageSource, /function BodySystemTables/)
    assert.match(pageSource, /function TissueTypeTables/)
    assert.match(pageSource, /ariaLabel="Tissue type views"/)
    assert.match(pageSource, /relationshipType: "belongs_to_system"/)
    assert.match(pageSource, /relationshipType: "belongs_to_tissue_type"/)
    assert.match(pageSource, /relationshipType: "includes_structure"/)
    assert.match(pageSource, /LEGACY_BROWSER_VIEW_REDIRECTS/)
  })

  it("surfaces full citation backlog and clickable external identifier detail", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")

    assert.match(pageSource, /const ANATOMY_DETAIL_LOOKUP_TAKE = 2000/)
    assert.match(pageSource, /prisma\.anatomyCitation\.findMany\({[\s\S]*take: ANATOMY_DETAIL_LOOKUP_TAKE/)
    assert.match(pageSource, /prisma\.externalAnatomyIdentifier\.findMany\({[\s\S]*take: ANATOMY_DETAIL_LOOKUP_TAKE/)
    assert.match(pageSource, /function externalIdentifierHref/)
    assert.match(pageSource, /function citationHref/)
    assert.match(pageSource, /function CollapsedEvidenceSection/)
    assert.match(pageSource, /<CollapsedEvidenceSection title="Citations"/)
    assert.match(pageSource, /<CollapsedEvidenceSection title="External IDs"/)
    assert.match(pageSource, /target="_blank"/)
  })

  it("surfaces spatial review state in counts, quick queries, and entity details", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")

    assert.match(pageSource, /spatial-review-queue/)
    assert.match(pageSource, /Spatial models/)
    assert.match(pageSource, /Spatial maps/)
    assert.match(pageSource, /Movement visuals/)
    assert.match(pageSource, /function selectedEntitySpatialMappings/)
    assert.match(pageSource, /function selectedEntityMovementVisualizations/)
    assert.match(pageSource, /Spatial mappings/)
    assert.match(pageSource, /Movement visualizations/)
    assert.match(pageSource, /anatomySpatialEntityMap\.findMany/)
    assert.match(pageSource, /anatomyMovementVisualization\.findMany/)
  })

  it("surfaces visual media review, candidate approval, and BodyParts3D import controls", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")
    const actionsSource = await readFile(new URL("../app/admin/anatomy/actions.ts", import.meta.url), "utf8")
    const importFieldsSource = await readFile(new URL("../app/admin/anatomy/bodyparts3d-import-fields.tsx", import.meta.url), "utf8")
    const reviewHelperSource = await readFile(new URL("../lib/anatomy-media-review.ts", import.meta.url), "utf8")

    assert.match(pageSource, /function MediaReviewPanel/)
    assert.match(pageSource, /<img src=\{previewUrl\}/)
    assert.match(pageSource, /Replacement flow/)
    assert.match(pageSource, /function mediaBodyParts3dSourceUrl/)
    assert.match(pageSource, /function mediaBodyParts3dComposerUrl/)
    assert.match(pageSource, /Open BodyParts3D composer/)
    assert.match(pageSource, /Open generated image/)
    assert.match(pageSource, /Open stored image/)
    assert.match(pageSource, /Link Existing Image/)
    assert.match(pageSource, /Sort order/)
    assert.match(pageSource, /updateAnatomyMediaReviewAction/)
    assert.match(pageSource, /linkAnatomyMediaAssetAction/)
    assert.match(pageSource, /importBodyParts3dMediaAction/)
    assert.match(pageSource, /function mediaReviewRows/)
    assert.match(pageSource, /function mediaRoleKey/)
    assert.match(pageSource, /take: 500/)
    assert.match(actionsSource, /uploadAnatomyMediaToR2/)
    assert.match(actionsSource, /prisma\.\$transaction/)
    assert.match(actionsSource, /bodyParts3dSourceDescriptor/)
    assert.match(actionsSource, /function bodyParts3dImportSource/)
    assert.match(actionsSource, /function bodyParts3dRequestImportDescriptor/)
    assert.match(actionsSource, /sameBodyParts3dPartIds\(descriptor\.partIds, expectedPartIds\)/)
    assert.match(actionsSource, /descriptor\.cameraMode !== expectedCameraMode/)
    assert.match(actionsSource, /anatomyMediaViewRequest\.delete/)
    assert.match(actionsSource, /sourceKey: importSource\.sourceKey/)
    assert.match(actionsSource, /bodyparts3dImageWidth: importSource\.imageWidth/)
    assert.match(actionsSource, /width: importSource\.imageWidth/)
    assert.match(actionsSource, /bodyparts3dCameraParameters/)
    assert.match(actionsSource, /treeName/)
    assert.match(actionsSource, /reviewStatus: "APPROVED"/)
    assert.match(actionsSource, /bodyparts3dSourceUrl: sourceUrl/)
    assert.match(reviewHelperSource, /Superior View/)
    assert.match(reviewHelperSource, /Inferior View/)
    assert.match(reviewHelperSource, /Transverse View/)
    assert.match(importFieldsSource, /bodyParts3dImageUrl/)
    assert.match(importFieldsSource, /bodyParts3dComposerUrl/)
    assert.match(importFieldsSource, /safeBodyParts3dRenderableImageUrl/)
    assert.match(importFieldsSource, /copyResetTimeoutRef/)
    assert.match(importFieldsSource, /window\.clearTimeout/)
    assert.match(importFieldsSource, /View shortcuts/)
    assert.match(importFieldsSource, /Transverse is an approximation using the top orientation/)
    assert.match(importFieldsSource, /Open BodyParts3D parts composer/)
    assert.match(importFieldsSource, /Open generated image/)
    assert.match(importFieldsSource, /current preset preview/)
    assert.match(importFieldsSource, /Copy generated image URL/)
    assert.match(importFieldsSource, /Leave blank when a preset preview looks right/)
    assert.match(importFieldsSource, /Custom BodyParts3D URL/)
    assert.match(importFieldsSource, /Open BodyParts3D home/)
    assert.match(pageSource, /function MediaViewCoverageChips/)
    assert.match(pageSource, /Request better view/)
    assert.match(pageSource, /createAnatomyMediaViewRequestAction/)
    assert.match(pageSource, /Open media view requests/)
    assert.match(pageSource, /openRows\.length === 0/)
    assert.match(pageSource, /openRows\.map/)
    assert.match(actionsSource, /createAnatomyMediaViewRequestAction/)
    assert.match(actionsSource, /linkReviewStatus: "NEEDS_REVIEW"/)
  })

  it("adds a mobile-first image review queue backed by link review state", async () => {
    const adminSource = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8")
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")
    const queueSource = await readFile(new URL("../app/admin/anatomy/media-review/page.tsx", import.meta.url), "utf8")
    const queueImageSource = await readFile(new URL("../app/admin/anatomy/media-review/review-image-preview.tsx", import.meta.url), "utf8")
    const actionsSource = await readFile(new URL("../app/admin/anatomy/actions.ts", import.meta.url), "utf8")
    const accessSource = await readFile(new URL("../lib/anatomy-admin-access.ts", import.meta.url), "utf8")
    const navigationSource = await readFile(new URL("../lib/navigation.js", import.meta.url), "utf8")

    assert.match(accessSource, /import "server-only"/)
    assert.match(accessSource, /export async function requireAnatomyAdminUser/)
    assert.match(adminSource, /function AdminDashboardPage/)
    assert.match(adminSource, /requireAnatomyAdminUser/)
    assert.match(adminSource, /Admin dashboard/)
    assert.match(adminSource, /Review images/)
    assert.match(adminSource, /Anatomy browser/)
    assert.match(adminSource, /mediaLinksNeedingReview/)
    assert.match(adminSource, /href="\/admin\/anatomy\/media-review"/)
    assert.doesNotMatch(pageSource, /function AnatomyAdminDashboard/)
    assert.match(queueSource, /function AnatomyMediaReviewQueuePage/)
    assert.match(pageSource, /requireAnatomyAdminUser/)
    assert.match(queueSource, /requireAnatomyAdminUser/)
    assert.match(queueSource, /Image review queue/)
    assert.match(queueSource, /Approve image/)
    assert.match(queueSource, /Needs better view/)
    assert.match(queueSource, /Reject image/)
    assert.match(queueSource, /IMAGE_REVIEW_MEDIA_TYPES/)
    assert.match(queueSource, /mediaType: \{ in: IMAGE_REVIEW_MEDIA_TYPES \}/)
    assert.match(queueSource, /parseMediaReviewQueueFilters/)
    assert.match(queueSource, /getAnatomyStudyCards/)
    assert.match(queueSource, /function entityFiltersForQueueFilters/)
    assert.match(queueSource, /function mediaReviewQueueWhere/)
    assert.match(queueSource, /function mediaReviewQueueOrderBy/)
    assert.match(queueSource, /metadata: \{[\s\S]*path: \["bodyparts3dView"\]/)
    assert.match(queueSource, /anatomyMediaViewRequest\.findMany/)
    assert.match(queueSource, /filteredTotal/)
    assert.match(queueSource, /function QueuePresetLinks/)
    assert.match(queueSource, /Anatomy batches/)
    assert.match(queueSource, /Image problem batches/)
    assert.match(queueSource, /function QueueActiveFilters/)
    assert.match(queueSource, /Clear filters/)
    assert.match(queueSource, /function QueueAdvancedFilters/)
    assert.match(queueSource, /name="entityType"/)
    assert.match(queueSource, /name="reason"/)
    assert.match(queueSource, /name="view"/)
    assert.match(queueSource, /name="request"/)
    assert.match(queueSource, /name="sort"/)
    assert.match(queueSource, /name="q"/)
    assert.match(queueSource, /mediaReviewQueueFormFields/)
    assert.match(queueSource, /name=\{name\} value=\{value\}/)
    assert.match(queueSource, /function linkedImageSummariesForRows/)
    assert.match(queueSource, /Images linked to this item/)
    assert.match(queueSource, /This queue reviews one linked image at a time/)
    assert.match(queueSource, /Why flag this image\?/)
    assert.match(queueSource, /Replacement view/)
    assert.match(queueSource, /What should change\?/)
    assert.match(queueSource, /safeBodyParts3dRenderableImageUrl/)
    assert.match(queueSource, /isImageReviewAsset/)
    assert.match(queueSource, /<ReviewImagePreview/)
    assert.match(queueImageSource, /export function ReviewImagePreview/)
    assert.match(queueImageSource, /fallbackUrl/)
    assert.match(queueImageSource, /onError/)
    assert.match(queueImageSource, /This image URL could not be loaded/)
    assert.match(queueSource, /reviewAnatomyMediaQueueDecisionAction/)
    assert.match(queueSource, /mediaReviewQueueOffsetAfterDecision/)
    assert.doesNotMatch(queueSource, /function queueOffsetAfterDecision/)
    assert.match(queueSource, /prisma\.anatomyMediaEntity\.findMany/)
    assert.match(queueSource, /prisma\.anatomyMediaViewRequest\.count/)
    assert.match(actionsSource, /function mediaReviewQueueRedirectPath/)
    assert.match(actionsSource, /requireAnatomyAdminUser/)
    assert.match(actionsSource, /export async function reviewAnatomyMediaQueueDecisionAction/)
    assert.match(actionsSource, /anatomyMediaEntity\.update/)
    assert.match(actionsSource, /create_view_request/)
    assert.match(actionsSource, /anatomyMediaViewRequest\.create/)
    assert.match(actionsSource, /revalidatePath\("\/admin\/anatomy\/media-review"\)/)
    assert.match(navigationSource, /admin-dashboard/)
    assert.match(navigationSource, /admin-anatomy-media-review/)
    assert.match(navigationSource, /\/admin\/anatomy\/media-review/)
  })

  it("shows complete anatomy source metadata fields in the admin source form", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")
    const actionsSource = await readFile(new URL("../app/admin/anatomy/actions.ts", import.meta.url), "utf8")

    assert.match(pageSource, /name="license_url"/)
    assert.match(pageSource, /name="usage_scope"/)
    assert.match(pageSource, /name="accessed_at"/)
    assert.match(pageSource, /name="notes"/)
    assert.match(actionsSource, /parseAnatomyAdminSourceInput/)
    assert.match(actionsSource, /licenseUrl: sourceInput\.licenseUrl/)
    assert.match(actionsSource, /usageScope: sourceInput\.usageScope/)
    assert.match(actionsSource, /accessedAt: sourceInput\.accessedAt/)
    assert.match(actionsSource, /notes: sourceInput\.notes/)
  })
})
