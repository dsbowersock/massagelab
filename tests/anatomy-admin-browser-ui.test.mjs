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
})
