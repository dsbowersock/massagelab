import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPosterArgs,
  buildRenditionEncodeArgs,
} from "../scripts/chimer-preview-generation/ffmpeg-plan.mjs"
import {
  calculateFrameVariation,
  parseMediaProbe,
  validateAnimatedFrameVariation,
  validateLoopSeam,
  validateCatalogManifest,
  validatePilotManifest,
  validateRenditionMetadata,
} from "../scripts/chimer-preview-generation/media-validation.mjs"
import {
  readGenerationCheckpoint,
  sanitizeGenerationError,
  updateGenerationCheckpoint,
} from "../scripts/chimer-preview-generation/generation-checkpoint.mjs"
import { getPreviewRenditionMimeType } from "../scripts/chimer-preview-generation/rendition-plan.mjs"
import {
  CATALOG_PREVIEW_ASPECTS,
  CATALOG_PREVIEW_CODECS,
  CATALOG_PREVIEW_QUALITIES,
} from "../scripts/chimer-preview-generation/preview-release-contract.mjs"
import { assertCatalogManifest } from "../components/backgrounds/backgroundPreviewCatalogManifest.ts"

function catalogManifestFixture(mediaKind = "animated") {
  const posters = Object.fromEntries(["landscape", "square", "vertical"].map((aspect) => [aspect, {
    url: `fixture/recipe-1/${aspect}/poster.webp`,
    width: 1,
    height: 1,
    bytes: 1,
    sha256: "a".repeat(64),
  }]))
  const renditions = CATALOG_PREVIEW_ASPECTS.flatMap((aspect) =>
    CATALOG_PREVIEW_QUALITIES.flatMap((quality) =>
      CATALOG_PREVIEW_CODECS.map((codec) => ({
        aspect,
        quality,
        codec,
        url: `fixture/recipe-1/${aspect}/${quality}.${codec === "vp9" ? "webm" : "mp4"}`,
        mimeType: getPreviewRenditionMimeType(codec, quality),
        width: 384,
        height: 216,
        durationMs: 10_000,
        fps: 24,
        bytes: 1,
        sha256: "b".repeat(64),
      }))),
  )
  return {
    schemaVersion: 3,
    catalogRevision: "catalog-approved-1",
    entries: [{
      backgroundId: "fixture-background",
      recipeRevision: "recipe-1",
      reviewStatus: "approved",
      batchSlug: "01-foundations",
      mediaKind,
      loopStrategy: mediaKind === "animated" ? "natural" : "static",
      loopBoundaryMs: mediaKind === "animated" ? 10_000 : 0,
      renditions: mediaKind === "animated" ? renditions : [],
      posters,
    }],
  }
}

describe("background preview encoding plans", () => {
  it("declares the encoded High-profile H.264 level for each quality tier", () => {
    assert.equal(getPreviewRenditionMimeType("h264", "low"), "video/mp4; codecs=avc1.64000D")
    assert.equal(getPreviewRenditionMimeType("h264", "standard"), "video/mp4; codecs=avc1.64001E")
    assert.equal(getPreviewRenditionMimeType("h264", "high"), "video/mp4; codecs=avc1.64001F")
    assert.equal(getPreviewRenditionMimeType("vp9", "high"), "video/webm; codecs=vp9")
  })

  it("builds bounded VP9 output with Lanczos scaling", () => {
    const args = buildRenditionEncodeArgs({
      inputPath: "master.webm",
      outputPath: "high.webm",
      codec: "vp9",
      width: 540,
      height: 960,
      fps: 24,
      durationMs: 10000,
      loopStrategy: "natural",
      crossfadeMs: 0,
    })
    assert.deepEqual(args.slice(-12), [
      "-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "2",
      "-crf", "30", "-b:v", "0", "-an", "high.webm",
    ])
    assert.ok(args.includes("fps=24,scale=540:960:flags=lanczos,format=yuv420p"))
  })

  it("uses libx264 fast-start output for compatibility renditions", () => {
    const args = buildRenditionEncodeArgs({
      inputPath: "master.webm",
      outputPath: "standard.mp4",
      codec: "h264",
      width: 640,
      height: 360,
      fps: 24,
      durationMs: 10000,
      loopStrategy: "crossfade",
      crossfadeMs: 800,
    })
    assert.ok(args.includes("libx264"))
    assert.ok(args.includes("+faststart"))
    const filter = args[args.indexOf("-filter_complex") + 1]
    assert.match(filter, /xfade=transition=fade:duration=0\.800:offset=9\.200/)
    assert.match(filter, /format=yuv420p\[outv\]$/)
  })

  it("extracts one high-dimension WebP poster at the authored time", () => {
    const args = buildPosterArgs({
      inputPath: "master.webm",
      outputPath: "poster.webp",
      width: 960,
      height: 540,
      posterTimeMs: 4000,
      durationMs: 12000,
    })
    assert.deepEqual(args, [
      "-y", "-ss", "4.000", "-i", "master.webm",
      "-vf", "scale=960:540:flags=lanczos", "-frames:v", "1",
      "-c:v", "libwebp", "-quality", "84", "-an", "poster.webp",
    ])
    assert.throws(() => buildPosterArgs({
      inputPath: "master.webm",
      outputPath: "poster.webp",
      width: 960,
      height: 540,
      posterTimeMs: 12000,
      durationMs: 12000,
    }), /poster time must be within/)
  })
})

describe("background preview media validation", () => {
  it("rejects animated captures whose sampled decoded frames are identical", () => {
    assert.equal(calculateFrameVariation(["a", "a", "a", "a"]), 0)
    assert.deepEqual(validateAnimatedFrameVariation({
      backgroundId: "animated",
      motionIntensity: "medium",
      frameHashes: ["a", "a", "a", "a"],
    }), ["animated: decoded samples did not prove animation"])
    assert.deepEqual(validateAnimatedFrameVariation({
      backgroundId: "animated",
      motionIntensity: "medium",
      frameHashes: ["a", "b", "c", "d", "e"],
    }), [])
  })

  it("applies different seam limits to natural and crossfade loops", () => {
    assert.deepEqual(validateLoopSeam({ strategy: "natural", normalizedDifference: 0.02 }), [])
    assert.deepEqual(validateLoopSeam({ strategy: "natural", normalizedDifference: 0.25 }), [
      "natural loop seam difference 0.250 exceeds 0.080",
    ])
    assert.deepEqual(validateLoopSeam({ strategy: "crossfade", normalizedDifference: 0.09 }), [])
    assert.deepEqual(validateLoopSeam({ strategy: "crossfade", normalizedDifference: 0.13 }), [
      "crossfade loop seam difference 0.130 exceeds 0.120",
    ])
  })

  it("parses fail-closed FFprobe metadata", () => {
    const actual = parseMediaProbe({ stdout: JSON.stringify({
      streams: [{
        codec_type: "video",
        codec_name: "vp9",
        pix_fmt: "yuv420p",
        width: 540,
        height: 960,
        avg_frame_rate: "24/1",
      }],
      format: { duration: "10.000" },
    }) }, "high.webm")
    assert.deepEqual(validateRenditionMetadata(actual, {
      codec: "vp9", pixelFormat: "yuv420p", width: 540, height: 960,
      fps: 24, durationMs: 10000,
    }), [])
    assert.throws(() => parseMediaProbe({ stdout: "{}" }, "missing.webm"), /exactly one video stream/)
  })

  it("requires a complete hashed v2 pilot manifest", () => {
    const backgroundId = "massage-lab-silk"
    const recipeRevision = "recipe-1"
    const renditions = ["landscape", "square", "vertical"].flatMap((aspect) =>
      ["low", "standard", "high"].flatMap((quality) => [
        { codec: "vp9", extension: "webm" },
        { codec: "h264", extension: "mp4" },
      ].map(({ codec, extension }) => ({
        aspect,
        quality,
        codec,
        url: `${backgroundId}/${recipeRevision}/${aspect}/${quality}.${extension}`,
        mimeType: getPreviewRenditionMimeType(codec, quality),
        width: 1,
        height: 1,
        durationMs: 9200,
        fps: 24,
        bytes: 1,
        sha256: "a".repeat(64),
      }))),
    )
    const posters = Object.fromEntries(["landscape", "square", "vertical"].map((aspect) => [aspect, {
      url: `${backgroundId}/${recipeRevision}/${aspect}/poster.webp`,
      width: 1,
      height: 1,
      bytes: 1,
      sha256: "b".repeat(64),
    }]))
    const entry = { backgroundId, recipeRevision, loopStrategy: "crossfade", loopBoundaryMs: 9200, renditions, posters }
    assert.deepEqual(validatePilotManifest([entry]), [])
    assert.match(validatePilotManifest([{ ...entry, renditions: renditions.slice(1) }]).join("\n"), /exactly 18 renditions/)
    assert.match(validatePilotManifest([{ ...entry, renditions: renditions.map((item, index) => index === 0
      ? { ...item, sha256: "bad", bytes: 0 }
      : item) }]).join("\n"), /positive bytes/)
  })

  it("accepts poster-only catalog entries without fabricated videos", () => {
    const backgroundId = "solid-color"
    const recipeRevision = "recipe-1"
    const posters = Object.fromEntries(["landscape", "square", "vertical"].map((aspect) => [aspect, {
      url: `${backgroundId}/${recipeRevision}/${aspect}/poster.webp`,
      width: 1,
      height: 1,
      bytes: 1,
      sha256: "b".repeat(64),
    }]))
    const entry = {
      backgroundId,
      recipeRevision,
      mediaKind: "poster-only",
      loopStrategy: "static",
      loopBoundaryMs: 0,
      renditions: [],
      posters,
    }
    assert.deepEqual(validateCatalogManifest([entry]), [])
    assert.match(validateCatalogManifest([{ ...entry, renditions: [{}] }]).join("\n"), /must not contain video renditions/)
  })

  it("updates generation checkpoints atomically by background and aspect", () => {
    const writes = []
    const io = {
      exists: () => false,
      read: () => "",
      writeAtomic: (path, value) => writes.push([path, value]),
    }
    assert.deepEqual(readGenerationCheckpoint("catalog", io), { schemaVersion: 1, aspects: {} })
    updateGenerationCheckpoint("catalog", "massage-lab-dna", "vertical", { status: "complete" }, io)
    assert.equal(writes.length, 1)
    assert.equal(JSON.parse(writes[0][1]).aspects["massage-lab-dna:vertical"].status, "complete")

    assert.throws(
      () => readGenerationCheckpoint("catalog", { ...io, exists: () => true, read: () => "{" }),
      (error) => {
        assert.match(error.message, /catalog.*generation-state\.json: invalid generation checkpoint/)
        assert.equal(error.cause instanceof SyntaxError, true)
        return true
      },
    )
  })

  it("redacts Windows, POSIX, and file URL paths without erasing command diagnostics", () => {
    assert.equal(
      sanitizeGenerationError(new Error("C:\\Users\\derri\\capture\\high.webm failed: ffmpeg -v error")),
      "<local-path> failed: ffmpeg -v error",
    )
    assert.equal(
      sanitizeGenerationError(new Error("/home/derri/catalog/high.webm failed: ffprobe -version")),
      "<local-path> failed: ffprobe -version",
    )
    assert.equal(
      sanitizeGenerationError(new Error("/tmp/massagelab-preview/raw.webm failed: encoder unavailable")),
      "<local-path> failed: encoder unavailable",
    )
    assert.equal(
      sanitizeGenerationError(new Error("file:///home/derri/catalog/index.json: invalid manifest")),
      "<local-path>: invalid manifest",
    )
    assert.equal(
      sanitizeGenerationError(new Error("/workspace/catalog/high.webm failed: ffmpeg -v error")),
      "<local-path> failed: ffmpeg -v error",
    )
    assert.equal(
      sanitizeGenerationError(new Error("'/srv/render/output.webm': decoder unavailable")),
      "<local-path>: decoder unavailable",
    )
    assert.equal(
      sanitizeGenerationError(new Error("fetch https://media.example.test/workspace/high.webm failed")),
      "fetch https://media.example.test/workspace/high.webm failed",
    )
    assert.equal(
      sanitizeGenerationError(new Error('curl "https://media.example.test/srv/high.webm" --fail')),
      'curl "https://media.example.test/srv/high.webm" --fail',
    )
  })

  it("accepts complete animated and poster-only catalog descriptors", () => {
    assert.doesNotThrow(() => assertCatalogManifest(catalogManifestFixture("animated")))
    assert.doesNotThrow(() => assertCatalogManifest(catalogManifestFixture("poster-only")))
  })

  it("requires the complete unique three-by-three-by-two animated rendition matrix", () => {
    const cases = [
      ["17-of-18 missing identity", (entry) => { entry.renditions.pop() }, /complete 18-rendition identity matrix; missing/],
      ["18-item replacement duplicate", (entry) => {
        entry.renditions[entry.renditions.length - 1] = structuredClone(entry.renditions[0])
      }, /duplicate rendition identity/],
      ["19-item extra duplicate", (entry) => {
        entry.renditions.push(structuredClone(entry.renditions[0]))
      }, /duplicate rendition identity/],
    ]

    for (const [label, mutate, expected] of cases) {
      const manifest = catalogManifestFixture("animated")
      mutate(manifest.entries[0])
      assert.throws(() => assertCatalogManifest(manifest), expected, label)
    }
  })

  it("fails closed for every required catalog field and descriptor contract", () => {
    const mutations = [
      ["schema", (manifest) => { manifest.schemaVersion = 2 }, /schema version 3/],
      ["revision", (manifest) => { manifest.catalogRevision = "   " }, /revision must be a nonempty string/],
      ["entries", (manifest) => { manifest.entries = null }, /entries must be an array/],
      ["recipe revision", (manifest) => { manifest.entries[0].recipeRevision = "" }, /recipeRevision must be a nonempty string/],
      ["review status", (manifest) => { manifest.entries[0].reviewStatus = "published" }, /reviewStatus is unsupported/],
      ["batch slug", (manifest) => { manifest.entries[0].batchSlug = " " }, /batchSlug must be a nonempty string/],
      ["media kind", (manifest) => { manifest.entries[0].mediaKind = "video" }, /mediaKind is unsupported/],
      ["loop strategy", (manifest) => { manifest.entries[0].loopStrategy = "static" }, /loopStrategy is unsupported/],
      ["loop boundary", (manifest) => { manifest.entries[0].loopBoundaryMs = 0 }, /loopBoundaryMs must be a positive safe integer/],
      ["renditions collection", (manifest) => { manifest.entries[0].renditions = {} }, /renditions must be an array/],
      ["animated rendition", (manifest) => { manifest.entries[0].renditions = [] }, /requires video renditions/],
      ["poster-only rules", (manifest) => { manifest.entries[0].mediaKind = "poster-only" }, /requires static looping, a zero boundary, and no video renditions/],
      ["rendition missing field", (manifest) => { delete manifest.entries[0].renditions[0].width }, /rendition 0 must contain exactly/],
      ["rendition extra field", (manifest) => { manifest.entries[0].renditions[0].extra = true }, /rendition 0 must contain exactly/],
      ["rendition aspect", (manifest) => { manifest.entries[0].renditions[0].aspect = "panorama" }, /aspect is unsupported/],
      ["rendition quality", (manifest) => { manifest.entries[0].renditions[0].quality = "ultra" }, /quality is unsupported/],
      ["rendition codec", (manifest) => { manifest.entries[0].renditions[0].codec = "av1" }, /codec is unsupported/],
      ["rendition URL", (manifest) => { manifest.entries[0].renditions[0].url = "" }, /URL must be a nonempty string/],
      ["rendition MIME", (manifest) => { manifest.entries[0].renditions[0].mimeType = "video/mp4" }, /MIME type is unsupported for vp9/],
      ["rendition width", (manifest) => { manifest.entries[0].renditions[0].width = 0 }, /width must be a positive safe integer/],
      ["rendition height", (manifest) => { manifest.entries[0].renditions[0].height = 1.5 }, /height must be a positive safe integer/],
      ["rendition duration", (manifest) => { manifest.entries[0].renditions[0].durationMs = 0 }, /durationMs must be a positive safe integer/],
      ["rendition fps", (manifest) => { manifest.entries[0].renditions[0].fps = 0 }, /fps must be a positive safe integer/],
      ["rendition bytes", (manifest) => { manifest.entries[0].renditions[0].bytes = -1 }, /bytes must be a positive safe integer/],
      ["rendition hash", (manifest) => { manifest.entries[0].renditions[0].sha256 = "bad" }, /SHA-256 hex digest/],
      ["posters collection", (manifest) => { manifest.entries[0].posters = [] }, /posters must be an object/],
      ["missing poster aspect", (manifest) => { delete manifest.entries[0].posters.square }, /posters must contain exactly/],
      ["extra poster aspect", (manifest) => { manifest.entries[0].posters.panorama = manifest.entries[0].posters.landscape }, /posters must contain exactly/],
      ["poster missing field", (manifest) => { delete manifest.entries[0].posters.landscape.bytes }, /landscape poster must contain exactly/],
      ["poster extra field", (manifest) => { manifest.entries[0].posters.landscape.extra = true }, /landscape poster must contain exactly/],
      ["poster URL", (manifest) => { manifest.entries[0].posters.landscape.url = "" }, /poster URL must be a nonempty string/],
      ["poster width", (manifest) => { manifest.entries[0].posters.landscape.width = 0 }, /poster width must be a positive safe integer/],
      ["poster height", (manifest) => { manifest.entries[0].posters.landscape.height = 0 }, /poster height must be a positive safe integer/],
      ["poster bytes", (manifest) => { manifest.entries[0].posters.landscape.bytes = 0 }, /poster bytes must be a positive safe integer/],
      ["poster hash", (manifest) => { manifest.entries[0].posters.landscape.sha256 = "bad" }, /SHA-256 hex digest/],
    ]

    for (const [label, mutate, expected] of mutations) {
      const manifest = catalogManifestFixture("animated")
      mutate(manifest)
      assert.throws(() => assertCatalogManifest(manifest), expected, label)
    }
  })

  it("rejects empty, whitespace-only, and duplicate catalog background IDs", () => {
    const entry = (backgroundId) => ({ ...catalogManifestFixture("poster-only").entries[0], backgroundId })
    const manifest = (entries) => ({ schemaVersion: 3, catalogRevision: "catalog-approved-1", entries })

    assert.throws(() => assertCatalogManifest(manifest([entry("")])), /nonempty and unique/)
    assert.throws(() => assertCatalogManifest(manifest([entry("   ")])), /nonempty and unique/)
    assert.throws(() => assertCatalogManifest(manifest([entry("same"), entry("same")])), /nonempty and unique/)
  })
})
