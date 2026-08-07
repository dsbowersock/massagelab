import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  PUBLISHED_CATALOG_REVISION,
  PUBLISHED_RUNTIME_SCHEMA_VERSION,
  buildPublishedRuntimeManifest,
  renderPublishedRuntimeManifestModule,
  serializePublishedRuntimeManifest,
} from "../scripts/chimer-preview-generation/published-runtime-manifest.mjs"
import { resolveCatalogPreviewUrl } from "../components/backgrounds/backgroundPreviewCatalogUrl.ts"
import {
  assertBackgroundPreviewPublishedManifestIdentity,
} from "../components/backgrounds/backgroundPreviewPublishedManifest.ts"
import { normalizePublishedPreviewCustomDomainBaseUrl } from "../lib/background-preview-catalog-base-url.js"
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
const publishedManifestModuleUrl = new URL(
  "../components/backgrounds/backgroundPreviewPublishedManifest.ts",
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
  const animatedEntry = encodedTraversalCatalog.entries.find((entry) => entry.mediaKind === "animated")
  assert.ok(animatedEntry, "approved catalog must contain an animated traversal fixture target")
  animatedEntry.renditions[0].url = "safe/%2e%2e/escaped.webm"
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

test("the generated typed wrapper matches the checked-in module and validates its identity", async () => {
  const source = renderPublishedRuntimeManifestModule()
  assert.equal((await readFile(publishedManifestModuleUrl, "utf8")).replace(/\r\n/g, "\n"), source)
  assert.match(source, new RegExp(`readonly schemaVersion: ${PUBLISHED_RUNTIME_SCHEMA_VERSION}`))
  assert.match(source, new RegExp(`readonly catalogRevision: "${PUBLISHED_CATALOG_REVISION}"`))
  assert.match(source, /assertBackgroundPreviewPublishedManifestIdentity\(manifest\)/)
  assert.match(source, /BackgroundPreviewPublishedAspect = "landscape" \| "square" \| "vertical"/)
  assert.match(source, /BackgroundPreviewPublishedQuality = "low" \| "standard" \| "high"/)
  assert.match(source, /BackgroundPreviewPublishedCodec = "vp9" \| "h264"/)
})

test("the generated typed wrapper rejects malformed manifest identities", () => {
  assert.doesNotThrow(() => assertBackgroundPreviewPublishedManifestIdentity({
    schemaVersion: 1,
    catalogRevision: "catalog-approved-1",
  }))
  for (const malformed of [
    null,
    "not a manifest",
    {},
    { schemaVersion: 2, catalogRevision: "catalog-approved-1" },
    { schemaVersion: 1, catalogRevision: "catalog-candidate-1" },
  ]) {
    assert.throws(
      () => assertBackgroundPreviewPublishedManifestIdentity(malformed),
      /schemaVersion 1 and catalogRevision catalog-approved-1/,
    )
  }
})

test("development catalog URL resolution stays JSON-free at the client boundary", async () => {
  assert.equal(resolveCatalogPreviewUrl("entry/vertical/high.webm"), "/chimer/background-preview-catalog/entry/vertical/high.webm")
  assert.equal(resolveCatalogPreviewUrl("/already-rooted.webp"), "/already-rooted.webp")
  assert.equal(resolveCatalogPreviewUrl("https://media.example.test/preview.webm"), "https://media.example.test/preview.webm")
  assert.equal(resolveCatalogPreviewUrl("//media.example.test/preview.webm"), "//media.example.test/preview.webm")

  const helperSource = await readFile(
    new URL("../components/backgrounds/backgroundPreviewCatalogUrl.ts", import.meta.url),
    "utf8",
  )
  const clientSource = await readFile(
    new URL("../app/dev/bgpreviews/preview-pilot-review.tsx", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(helperSource, /index\.json|backgroundPreviewCatalogManifest/)
  assert.match(clientSource, /import type \{[\s\S]*?\} from "@\/components\/backgrounds\/backgroundPreviewCatalogManifest"/)
  assert.match(clientSource, /resolveCatalogPreviewUrl[^\n]+backgroundPreviewCatalogUrl/)
  assert.doesNotMatch(clientSource, /import \{ resolveCatalogPreviewUrl \} from "@\/components\/backgrounds\/backgroundPreviewCatalogManifest"/)
})

test("catalog publisher and runtime share the exact HTTPS custom-domain contract", async () => {
  const { normalizeCatalogPublicBaseUrl } = await import(
    "../scripts/chimer-preview-generation/catalog-r2-public-base-url.mjs"
  )
  const cases = [
    ["approved custom domain", "https://media.massagelab.app", "https://media.massagelab.app"],
    [
      "approved release path",
      "https://media.massagelab.app/chimer/background-preview-catalog/catalog-approved-1/",
      "https://media.massagelab.app/chimer/background-preview-catalog/catalog-approved-1",
    ],
    ["explicit HTTPS port", "https://media.massagelab.app:8443/catalog/", "https://media.massagelab.app:8443/catalog"],
    ["malformed URL", "not a URL", null],
    ["non-HTTPS scheme", "http://media.massagelab.app/catalog", null],
    ["trailing-dot host", "https://media.massagelab.app./catalog", null],
    ["single-label localhost", "https://localhost/catalog", null],
    ["IPv4 host", "https://127.0.0.1/catalog", null],
    ["abbreviated IPv4 host", "https://127.1/catalog", null],
    ["IPv6 host", "https://[::1]/catalog", null],
    ["r2.dev apex", "https://r2.dev/catalog", null],
    ["r2.dev subdomain", "https://catalog.r2.dev/release", null],
    ["username", "https://user@media.massagelab.app/catalog", null],
    ["credentials", "https://user:secret@media.massagelab.app/catalog", null],
    ["query string", "https://media.massagelab.app/catalog?revision=1", null],
    ["fragment", "https://media.massagelab.app/catalog#revision", null],
  ]

  for (const [label, configuredBaseUrl, expected] of cases) {
    assert.equal(
      normalizePublishedPreviewCustomDomainBaseUrl(configuredBaseUrl),
      expected,
      `${label}: shared contract`,
    )
    assert.equal(
      resolvePublishedPreviewCatalogBaseUrl({ nodeEnv: "production", configuredBaseUrl }),
      expected,
      `${label}: runtime`,
    )
    if (expected) {
      assert.equal(normalizeCatalogPublicBaseUrl(configuredBaseUrl), expected, `${label}: uploader`)
    } else {
      assert.throws(
        () => normalizeCatalogPublicBaseUrl(configuredBaseUrl),
        /valid absolute HTTPS custom-domain URL/,
        `${label}: uploader`,
      )
    }
  }
})

test("catalog base resolution fails closed in Production and supports the local development prefix", () => {
  assert.equal(resolvePublishedPreviewCatalogBaseUrl({ nodeEnv: "production" }), null)
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
    { aspect: "vertical", quality: "low", codec: "h264", mimeType: "video/mp4; codecs=avc1.64000D" },
    { aspect: "vertical", quality: "standard", codec: "h264", mimeType: "video/mp4; codecs=avc1.64001E" },
    { aspect: "vertical", quality: "standard", codec: "vp9", mimeType: "video/webm; codecs=vp9" },
  ]
  const chooseStandardCodec = (canPlayType) => chooseSupportedPreviewCodec({
    renditions,
    aspect: "vertical",
    quality: "standard",
    canPlayType,
  })

  assert.equal(chooseStandardCodec(() => "probably"), "vp9")
  assert.equal(
    chooseStandardCodec((mimeType) => mimeType === "video/mp4; codecs=avc1.64001E" ? "maybe" : ""),
    "h264",
  )
  assert.equal(chooseStandardCodec(() => ""), null)
  assert.equal(chooseStandardCodec(undefined), null)
})

test("codec choice never infers target-tier H.264 support from another profile level", () => {
  const renditions = [
    { aspect: "vertical", quality: "low", codec: "h264", mimeType: "video/mp4; codecs=avc1.64000D" },
    { aspect: "vertical", quality: "high", codec: "h264", mimeType: "video/mp4; codecs=avc1.64001F" },
    { aspect: "vertical", quality: "high", codec: "vp9", mimeType: "video/webm; codecs=vp9" },
  ]
  const mixedTierSupport = (mimeType) => mimeType === "video/mp4; codecs=avc1.64000D" ? "probably" : ""

  assert.equal(chooseSupportedPreviewCodec({
    renditions,
    aspect: "vertical",
    quality: "high",
    canPlayType: mixedTierSupport,
  }), null)
  assert.equal(chooseSupportedPreviewCodec({
    renditions,
    aspect: "vertical",
    quality: "low",
    canPlayType: mixedTierSupport,
  }), "h264")
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
