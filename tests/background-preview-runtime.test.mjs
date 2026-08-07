import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildPublishedRuntimeManifest,
  serializePublishedRuntimeManifest,
} from "../scripts/chimer-preview-generation/published-runtime-manifest.mjs"
import {
  chooseSupportedPreviewCodec,
  getVerticalPublishedPreviewPosterUrl,
  qualityForPreviewConnection,
  resolvePendingPreviewRendition,
  resolvePublishedPreviewCatalogBaseUrl,
  selectPublishedPreviewRendition,
} from "../lib/background-preview-runtime.js"

const approvedCatalogUrl = new URL(
  "../public/chimer/background-preview-catalog/index.json",
  import.meta.url,
)
const publishedManifestUrl = new URL(
  "../data/background-preview-published-manifest.json",
  import.meta.url,
)

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"))
}

test("the generated browser artifact retains the approved runtime contract only", async () => {
  const approvedCatalog = await readJson(approvedCatalogUrl)
  const manifest = buildPublishedRuntimeManifest(approvedCatalog)
  const entries = Object.values(manifest.entries)

  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.catalogRevision, "catalog-approved-1")
  assert.equal(entries.length, 84)
  assert.equal(entries.filter((entry) => entry.mediaKind === "animated").length, 82)
  assert.equal(entries.filter((entry) => entry.mediaKind === "poster-only").length, 2)
  assert.equal(entries.reduce((total, entry) => total + entry.renditions.length, 0), 1_476)
  assert.equal(entries.reduce((total, entry) => total + Object.keys(entry.posters).length, 0), 252)

  for (const [backgroundId, entry] of Object.entries(manifest.entries)) {
    assert.equal(entry.backgroundId, backgroundId)
    assert.deepEqual(Object.keys(entry.posters), ["landscape", "square", "vertical"])
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["backgroundId", "loopBoundaryMs", "mediaKind", "posters", "renditions"].sort(),
    )
    for (const rendition of entry.renditions) {
      assert.deepEqual(
        Object.keys(rendition).sort(),
        ["aspect", "quality", "codec", "url", "mimeType"].sort(),
      )
    }
  }

  const serialized = serializePublishedRuntimeManifest(manifest)
  for (const forbiddenField of [
    "reviewStatus",
    "recipeRevision",
    "batchSlug",
    "loopStrategy",
    "sha256",
    "bytes",
    "width",
    "height",
    "durationMs",
    "fps",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(`"${forbiddenField}"`))
  }
})

test("runtime generation fails closed for an unapproved or incomplete catalog", async () => {
  const approvedCatalog = await readJson(approvedCatalogUrl)
  const candidateCatalog = structuredClone(approvedCatalog)
  candidateCatalog.entries[0].reviewStatus = "candidate"
  assert.throws(
    () => buildPublishedRuntimeManifest(candidateCatalog),
    /requires every entry to be approved/,
  )

  const missingEntryCatalog = structuredClone(approvedCatalog)
  missingEntryCatalog.entries.pop()
  assert.throws(
    () => buildPublishedRuntimeManifest(missingEntryCatalog),
    /exactly 84 entries/,
  )

  const missingRenditionCatalog = structuredClone(approvedCatalog)
  missingRenditionCatalog.entries.find((entry) => entry.mediaKind === "animated").renditions.pop()
  assert.throws(
    () => buildPublishedRuntimeManifest(missingRenditionCatalog),
    /exactly 1,476 renditions/,
  )

  const encodedTraversalCatalog = structuredClone(approvedCatalog)
  encodedTraversalCatalog.entries[0].renditions[0].url = "safe/%2e%2e/escaped.webm"
  assert.throws(
    () => buildPublishedRuntimeManifest(encodedTraversalCatalog),
    /must not contain traversal segments/,
  )
})

test("the checked-in runtime artifact is generated from the approved catalog", async () => {
  const approvedCatalog = await readJson(approvedCatalogUrl)
  const checkedInManifest = await readJson(publishedManifestUrl)
  assert.equal(
    JSON.stringify(checkedInManifest),
    JSON.stringify(buildPublishedRuntimeManifest(approvedCatalog)),
  )
})

test("catalog base resolution fails closed in Production and supports the local development prefix", () => {
  assert.equal(resolvePublishedPreviewCatalogBaseUrl({ nodeEnv: "production" }), null)
  assert.equal(
    resolvePublishedPreviewCatalogBaseUrl({
      nodeEnv: "production",
      configuredBaseUrl: "https://media.massagelab.app/chimer/background-preview-catalog/catalog-approved-1/",
    }),
    "https://media.massagelab.app/chimer/background-preview-catalog/catalog-approved-1",
  )
  for (const configuredBaseUrl of [
    "http://media.massagelab.app/catalog",
    "https://catalog.r2.dev/release",
    "https://sub.catalog.r2.dev/release",
    "https://localhost/catalog",
    "https://127.0.0.1/catalog",
    "https://user:secret@media.massagelab.app/catalog",
    "https://media.massagelab.app/catalog?revision=1",
    "https://media.massagelab.app/catalog#revision",
  ]) {
    assert.equal(
      resolvePublishedPreviewCatalogBaseUrl({ nodeEnv: "production", configuredBaseUrl }),
      null,
      configuredBaseUrl,
    )
  }
  assert.equal(
    resolvePublishedPreviewCatalogBaseUrl({ nodeEnv: "development" }),
    "/chimer/background-preview-catalog",
  )
})

test("connection information maps deterministically to one initial quality", () => {
  assert.equal(qualityForPreviewConnection(undefined), "standard")
  assert.equal(qualityForPreviewConnection({}), "standard")
  assert.equal(qualityForPreviewConnection({ effectiveType: "4g" }), "high")
  assert.equal(qualityForPreviewConnection({ effectiveType: "3g" }), "standard")
  assert.equal(qualityForPreviewConnection({ effectiveType: "2g" }), "low")
  assert.equal(qualityForPreviewConnection({ effectiveType: "slow-2g" }), "low")
  assert.equal(qualityForPreviewConnection({ effectiveType: "4g", saveData: true }), "low")
  assert.equal(qualityForPreviewConnection({ effectiveType: "unknown" }), "standard")
})

test("codec choice prefers supported VP9, falls back to H.264, and otherwise returns null", () => {
  const renditions = [
    { codec: "h264", mimeType: "video/mp4; codecs=avc1.64001E" },
    { codec: "vp9", mimeType: "video/webm; codecs=vp9" },
  ]

  assert.equal(chooseSupportedPreviewCodec(renditions, () => "probably"), "vp9")
  assert.equal(
    chooseSupportedPreviewCodec(renditions, (mimeType) => mimeType.startsWith("video/mp4") ? "maybe" : ""),
    "h264",
  )
  assert.equal(chooseSupportedPreviewCodec(renditions, () => ""), null)
  assert.equal(chooseSupportedPreviewCodec(renditions, undefined), null)
})

test("poster and rendition selection expose one resolved URL and no alternates", async () => {
  const manifest = await readJson(publishedManifestUrl)
  const entry = manifest.entries["massage-lab-moving-gradient"]
  const catalogBaseUrl = "/chimer/background-preview-catalog"

  assert.equal(
    getVerticalPublishedPreviewPosterUrl(entry, catalogBaseUrl),
    "/chimer/background-preview-catalog/massage-lab-moving-gradient/recipe-1/vertical/poster.webp",
  )
  assert.equal(getVerticalPublishedPreviewPosterUrl(entry, "https://catalog.r2.dev/release"), null)

  const selected = selectPublishedPreviewRendition({
    entry,
    aspect: "vertical",
    quality: "standard",
    codec: "vp9",
    catalogBaseUrl,
  })
  assert.deepEqual(selected, {
    aspect: "vertical",
    quality: "standard",
    codec: "vp9",
    url: "/chimer/background-preview-catalog/massage-lab-moving-gradient/recipe-1/vertical/standard.webm",
    mimeType: "video/webm; codecs=vp9",
  })
  assert.equal(Array.isArray(selected), false)
  assert.equal("alternates" in selected, false)
  assert.equal(
    selectPublishedPreviewRendition({
      entry,
      aspect: "vertical",
      quality: "standard",
      codec: "vp9",
      catalogBaseUrl: null,
    }),
    null,
  )
  assert.equal(
    selectPublishedPreviewRendition({
      entry: {
        ...entry,
        renditions: [{
          aspect: "vertical",
          quality: "standard",
          codec: "vp9",
          url: "safe/%2e%2e/escaped.webm",
          mimeType: "video/webm; codecs=vp9",
        }],
      },
      aspect: "vertical",
      quality: "standard",
      codec: "vp9",
      catalogBaseUrl,
    }),
    null,
  )
  assert.equal(
    selectPublishedPreviewRendition({
      entry: manifest.entries["solid-color"],
      aspect: "vertical",
      quality: "standard",
      codec: "vp9",
      catalogBaseUrl,
    }),
    null,
  )
})

test("pending quality resolution preserves the current aspect and codec", async () => {
  const manifest = await readJson(publishedManifestUrl)
  const entry = manifest.entries["massage-lab-moving-gradient"]
  const catalogBaseUrl = "https://media.massagelab.app/chimer/background-preview-catalog/catalog-approved-1"
  const currentRendition = selectPublishedPreviewRendition({
    entry,
    aspect: "vertical",
    quality: "standard",
    codec: "h264",
    catalogBaseUrl,
  })
  const pendingRendition = resolvePendingPreviewRendition({
    entry,
    currentRendition,
    pendingQuality: "low",
    catalogBaseUrl,
  })

  assert.equal(pendingRendition.aspect, "vertical")
  assert.equal(pendingRendition.codec, "h264")
  assert.equal(pendingRendition.quality, "low")
  assert.match(pendingRendition.url, /\/vertical\/low\.mp4$/)
  assert.equal(
    resolvePendingPreviewRendition({
      entry,
      currentRendition: null,
      pendingQuality: "high",
      catalogBaseUrl,
    }),
    null,
  )
})
