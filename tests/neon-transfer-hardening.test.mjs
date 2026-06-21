import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("Neon transfer hardening", () => {
  it("keeps DB-backed flashcard media loading cached and projected", async () => {
    const source = await readFile(new URL("../lib/anatomy-study-media.ts", import.meta.url), "utf8")

    assert.match(source, /STUDY_MEDIA_CACHE_TTL_MS/)
    assert.match(source, /studyMediaOptionsCache/)
    assert.match(source, /pendingStudyMediaOptions/)
    assert.match(source, /select: studyMediaAssetSelect/)
    assert.match(source, /source: \{ slug: \{ in: PUBLIC_FLASHCARD_IMAGE_SOURCE_SLUGS \} \}/)
    assert.match(source, /usageScope: "OPEN_REUSE"/)
    assert.match(source, /reviewStatus: "REVIEWED"/)
    assert.match(source, /mediaAssets: value\.mediaAssets\.map/)
    assert.match(source, /mediaEntityLinks: value\.mediaEntityLinks\.map/)
    assert.doesNotMatch(source, /entityLinks:\s*\{[\s\S]*where:\s*\{\s*reviewStatus: "APPROVED"/)
    assert.doesNotMatch(source, /include:\s*\{\s*source: true,\s*entityLinks: true,\s*\}/)
  })

  it("preserves DB media-link review overrides before the public approval filter", async () => {
    const mediaSource = await readFile(new URL("../lib/anatomy-study-media.ts", import.meta.url), "utf8")
    const studySource = await readFile(new URL("../lib/anatomy-study.ts", import.meta.url), "utf8")

    assert.doesNotMatch(mediaSource, /entityLinks:\s*\{[\s\S]*where:\s*\{\s*reviewStatus: "APPROVED"/)
    assert.match(studySource, /\.filter\(\(link\) => \(link\.reviewStatus \?\? "approved"\) === "approved"\)/)
  })

  it("keeps admin media review rows on explicit asset snippets", async () => {
    const source = await readFile(new URL("../app/admin/anatomy/media-review/page.tsx", import.meta.url), "utf8")

    assert.match(source, /const mediaReviewAssetSelect = \{/)
    assert.match(source, /source:\s*\{\s*select:\s*\{[\s\S]*slug: true,[\s\S]*label: true/)
    assert.match(source, /asset:\s*\{\s*select: mediaReviewAssetSelect/)
    assert.doesNotMatch(source, /asset:\s*\{\s*include:\s*\{\s*source: true/)
  })

  it("keeps anatomy admin browser media candidates on snippets", async () => {
    const source = await readFile(new URL("../app/admin/anatomy/browser-data.ts", import.meta.url), "utf8")

    assert.match(source, /const anatomyMediaAssetSnippetSelect = \{/)
    assert.match(source, /entityLinks:\s*\{\s*select: anatomyMediaEntitySnippetSelect/)
    assert.match(source, /select: anatomyMediaAssetSnippetSelect/)
    assert.doesNotMatch(source, /include:\s*\{\s*source: true,\s*entityLinks: true,\s*\}/)
  })

  it("keeps maintenance scripts from fetching full media or request records", async () => {
    const coverageSource = await readFile(new URL("../scripts/anatomy-media-view-coverage.ts", import.meta.url), "utf8")
    const requestsSource = await readFile(new URL("../scripts/anatomy-media-view-requests.ts", import.meta.url), "utf8")

    assert.match(coverageSource, /entityLinks:\s*\{\s*select:\s*\{[\s\S]*entityType: true,[\s\S]*entitySlug: true/)
    assert.doesNotMatch(coverageSource, /include:\s*\{\s*entityLinks: true\s*\}/)
    assert.match(requestsSource, /select:\s*\{[\s\S]*entityType: true,[\s\S]*entitySlug: true,[\s\S]*requestedView: true/)
  })
})
