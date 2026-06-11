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
    const browserStart = pageSource.indexOf("function AnatomyDatabaseBrowser")
    const maintenanceStart = pageSource.indexOf("function MaintenanceView")
    const browserBody = pageSource.slice(browserStart, maintenanceStart)
    const maintenanceBody = pageSource.slice(maintenanceStart)

    assert.match(pageSource, /<AnatomyBrowserStickyFrame/)
    assert.match(stickyFrameSource, /data-anatomy-browser-toolbar/)
    assert.match(stickyFrameSource, /sticky top-0/)
    assert.match(pageSource, /data-anatomy-table-header/)
    assert.match(pageSource, /data-anatomy-table-header-cell/)
    assert.match(scrollSource, /--anatomy-browser-sticky-offset/)
    assert.doesNotMatch(browserBody, /counts\.map/)
    assert.match(maintenanceBody, /counts\.map/)
  })

  it("surfaces full citation backlog and clickable external identifier detail", async () => {
    const pageSource = await readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8")

    assert.match(pageSource, /const ANATOMY_DETAIL_LOOKUP_TAKE = 2000/)
    assert.match(pageSource, /prisma\.anatomyCitation\.findMany\({[\s\S]*take: ANATOMY_DETAIL_LOOKUP_TAKE/)
    assert.match(pageSource, /prisma\.externalAnatomyIdentifier\.findMany\({[\s\S]*take: ANATOMY_DETAIL_LOOKUP_TAKE/)
    assert.match(pageSource, /function externalIdentifierHref/)
    assert.match(pageSource, /function citationHref/)
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

    assert.match(pageSource, /function MediaReviewPanel/)
    assert.match(pageSource, /<img src=\{previewUrl\}/)
    assert.match(pageSource, /updateAnatomyMediaReviewAction/)
    assert.match(pageSource, /linkAnatomyMediaAssetAction/)
    assert.match(pageSource, /importBodyParts3dMediaAction/)
    assert.match(pageSource, /take: 500/)
    assert.match(actionsSource, /uploadAnatomyMediaToR2/)
    assert.match(actionsSource, /reviewStatus: "APPROVED"/)
    assert.match(importFieldsSource, /bodyParts3dImageUrl/)
    assert.match(importFieldsSource, /BodyParts3D URL Override/)
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
