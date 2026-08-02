import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  parseProbeDimensions,
  parseProbeDurationSeconds,
  resolveProbeDurationSeconds,
} from "../scripts/chimer-preview-generation/probe-result.mjs"
import { normalizeGeneratedPreviewManifestItem } from "../scripts/chimer-preview-generation/manifest-url-normalization.mjs"

const componentSource = readFileSync(
  new URL("../components/backgrounds/BackgroundPreviewMedia.tsx", import.meta.url),
  "utf8",
)
const cardSource = readFileSync(
  new URL("../components/backgrounds/background-carousel-card.tsx", import.meta.url),
  "utf8",
)
const manifestGeneratorSource = readFileSync(
  new URL("../scripts/chimer-preview-generation/manifest.mjs", import.meta.url),
  "utf8",
)
const renderSource = readFileSync(
  new URL("../scripts/chimer-preview-generation/render.mjs", import.meta.url),
  "utf8",
)
const previewSceneSource = readFileSync(
  new URL("../app/chimer/background-preview/[backgroundId]/preview-scene.tsx", import.meta.url),
  "utf8",
)
const reviewFixtureSource = readFileSync(
  new URL("../app/dev/buttons/background-preview-media-review.tsx", import.meta.url),
  "utf8",
)

describe("background preview media", () => {
  it("renders a decorative video with a WebP poster over the registry fallback", () => {
    const videoMarkup = componentSource.match(/<video(?:(?!\n\s*<[A-Za-z/])[\s\S])*?\/>/)?.[0]
    assert.ok(videoMarkup, "decorative preview video markup exists")
    assert.match(videoMarkup, /poster=\{posterUrl\}/)
    assert.match(videoMarkup, /\bmuted\b/)
    assert.match(videoMarkup, /\bloop\b/)
    assert.match(videoMarkup, /\bplaysInline\b/)
    assert.match(videoMarkup, /preload="metadata"/)
    assert.match(videoMarkup, /aria-hidden="true"/)
    assert.match(videoMarkup, /onError=\{\(\) => setVideoFailed\(true\)\}/)
    assert.match(componentSource, /fallbackStyle/)
  })

  it("keeps inactive cards on posters and limits playback to active selected cards", () => {
    assert.match(cardSource, /<BackgroundPreviewMedia/)
    assert.match(cardSource, /active=\{active && selected && detailLevel !== "shell"\}/)
    assert.match(cardSource, /reducedMotion=\{reducedMotion\}/)
    assert.match(componentSource, /const showVideo = active && !reducedMotion/)
    assert.doesNotMatch(cardSource, /<video/)
  })

  it("resynchronizes playback when an active preview swaps to another nonempty source", () => {
    // This source contract intentionally keeps both inputs in the replay effect;
    // browser coverage exercises the resulting media restart behavior.
    assert.match(componentSource, /\}, \[(?=[^\]]*\bshowVideo\b)(?=[^\]]*\bvideoUrl\b)[^\]]*\]\)/)
  })

  it("generates quality-78 WebP posters one-third through each actual encoded video", () => {
    assert.match(renderSource, /async function encodePoster/)
    assert.match(renderSource, /const seekSeconds = probeVideoDurationSeconds\(videoPath, fallbackDurationMs\) \/ 3/)
    assert.match(renderSource, /"-show_entries", "format=duration"/)
    assert.match(renderSource, /"-c:v", "libwebp"/)
    assert.match(renderSource, /"-quality", "78"/)
    assert.match(renderSource, /!existsSync\(posterPath\) \|\| statSync\(posterPath\)\.size <= 0/)
    assert.match(renderSource, /is empty after poster encoding/)
    assert.match(renderSource, /function probeVariantDimensions\(filePath\)[\s\S]*parseProbeDimensions\(result, filePath\)/)
    assert.match(renderSource, /function mediaMatchesVariant\(filePath, variant\)[\s\S]*probeVariantDimensions\(filePath\)[\s\S]*variant\.outputWidth[\s\S]*variant\.outputHeight/)
    assert.match(renderSource, /const videoIsUsable = mediaMatchesVariant\(outputPath, variant\)/)
    assert.match(renderSource, /const posterIsUsable = mediaMatchesVariant\(posterPath, variant\)[\s\S]*?if \(videoIsUsable && posterIsUsable && !options\.force\) \{[\s\S]*?skipped: true/)
    assert.match(renderSource, /if \(videoIsUsable && !options\.force\) \{[\s\S]*?await encodePoster\(outputPath, posterPath, options\.durationMs\)/)
    assert.match(renderSource, /function assertVariantMedia\(outputPath, posterPath, variant\)[\s\S]*probeVariantDimensions\(filePath\)[\s\S]*captureVariant[\s\S]*assertVariantMedia\(outputPath, posterPath, variant\)/)
  })

  it("offers a deterministic missing-video fixture while retaining a valid poster", () => {
    assert.match(reviewFixtureSource, /__missing-preview__\.webm/)
    assert.match(reviewFixtureSource, /missingVideo \? "Use working video" : "Use missing video"/)
    assert.match(
      reviewFixtureSource,
      /const preview = backgroundPreviewManifest\[previewName\][\s\S]*?resolveVerticalPreviewMediaUrls\(preview, previewName\)[\s\S]*?videoUrl=\{videoUrl\}[\s\S]*?posterUrl=\{posterUrl\}/,
    )
  })

  it("suppresses delayed Next development chrome before recording", () => {
    assert.match(renderSource, /page\.addStyleTag\(\{[\s\S]*?nextjs-portal \{ display: none !important; \}/)
    assert.ok(
      renderSource.indexOf("page.addStyleTag") < renderSource.indexOf("page.waitForTimeout(options.warmupMs"),
      "development chrome is hidden before the warmup and recording window",
    )
  })

  it("captures Track 4B effects through the shared canonical host-option resolver", () => {
    assert.match(previewSceneSource, /resolveDnaTwistedCubesBackgroundHostProps/)
    assert.match(previewSceneSource, /settings: DEFAULT_CHIMER_SETTINGS/)
    assert.match(previewSceneSource, /\.\.\.PREVIEW_TRACK_4B_EFFECT_PROPS/)
  })

  it("hashes poster metadata and resolves poster URLs through the configured base", () => {
    for (const field of ["previewPosterUrl", "posterBytes", "posterSha256"]) {
      assert.match(manifestGeneratorSource, new RegExp(`\\b${field}\\b`))
    }
    assert.match(manifestGeneratorSource, /previewImageUrl/)
    assert.match(manifestGeneratorSource, /previewSquareImageUrl/)
    assert.match(manifestGeneratorSource, /previewVerticalImageUrl/)
    assert.match(manifestGeneratorSource, /validateDimensions\(posterPath, variant\.width, variant\.height\)/)
    assert.match(manifestGeneratorSource, /resolvePreviewMediaUrl\(variant\.previewPosterUrl\)/)
  })

  it("routes guessed vertical preview fallbacks through the configured media base", async () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL
    process.env.NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL = "https://media.example.test/previews"
    try {
      const { resolveVerticalPreviewMediaUrls } = await import(
        `../components/backgrounds/backgroundPreviewManifest.ts?fallback-base=${Date.now()}`
      )
      assert.deepEqual(resolveVerticalPreviewMediaUrls(undefined, "missing-preview"), {
        videoUrl: "https://media.example.test/previews/missing-preview-vertical.webm",
        posterUrl: "https://media.example.test/previews/missing-preview-vertical.webp",
      })
    } finally {
      if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL
      else process.env.NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL = originalBaseUrl
    }
  })

  it("normalizes every copied manifest URL back to the raw local preview prefix", () => {
    assert.match(renderSource, /\.map\(\(entry\) => normalizeGeneratedPreviewManifestItem\(\{/)
    assert.match(manifestGeneratorSource, /const normalizedFallbackVariants = normalizeGeneratedPreviewManifestItem\(\{/)
    const normalized = normalizeGeneratedPreviewManifestItem({
      previewMediaUrl: "https://media.massagelab.app/chimer/background-previews/main.webm?cache=1",
      previewVideoUrl: "https://custom.example.test/assets/main.webm",
      previewImageUrl: "https://custom.example.test/assets/main.webp",
      previewSquareVideoUrl: "https://custom.example.test/assets/main-square.webm",
      previewSquareImageUrl: "https://custom.example.test/assets/main-square.webp",
      previewVerticalVideoUrl: "https://custom.example.test/assets/main-vertical.webm",
      previewVerticalImageUrl: "https://custom.example.test/assets/main-vertical.webp",
      variants: {
        landscape: {
          key: "landscape",
          previewMediaUrl: "https://custom.example.test/assets/main.webm#fragment",
          previewPosterUrl: "https://custom.example.test/assets/main.webp",
          previewMediaType: "video",
        },
        square: {
          key: "square",
          previewMediaUrl: "https://media.massagelab.app/chimer/background-previews/main-square.webm",
          previewPosterUrl: "https://media.massagelab.app/chimer/background-previews/main-square.webp",
          previewMediaType: "video",
        },
      },
    })

    assert.deepEqual(normalized, {
      previewMediaUrl: "/chimer/background-previews/main.webm",
      previewVideoUrl: "/chimer/background-previews/main.webm",
      previewImageUrl: "/chimer/background-previews/main.webp",
      previewSquareVideoUrl: "/chimer/background-previews/main-square.webm",
      previewSquareImageUrl: "/chimer/background-previews/main-square.webp",
      previewVerticalVideoUrl: "/chimer/background-previews/main-vertical.webm",
      previewVerticalImageUrl: "/chimer/background-previews/main-vertical.webp",
      variants: {
        landscape: {
          key: "landscape",
          previewMediaUrl: "/chimer/background-previews/main.webm",
          previewPosterUrl: "/chimer/background-previews/main.webp",
          previewMediaType: "video",
        },
        square: {
          key: "square",
          previewMediaUrl: "/chimer/background-previews/main-square.webm",
          previewPosterUrl: "/chimer/background-previews/main-square.webp",
          previewMediaType: "video",
        },
      },
    })
    assert.doesNotMatch(JSON.stringify(normalized), /https?:\/\/|custom\.example|media\.massagelab/)
  })

  it("reports FFprobe spawn and decoder failures before parsing dimensions", () => {
    assert.deepEqual(
      parseProbeDimensions({ status: 0, stdout: "384x216\n", stderr: "" }, "preview.webm"),
      { width: 384, height: 216 },
    )

    const spawnError = new Error("spawn ffprobe ENOENT")
    assert.throws(
      () => parseProbeDimensions({ error: spawnError, status: null }, "preview.webm"),
      (error) => error.cause === spawnError && /spawn ffprobe ENOENT/.test(error.message),
    )
    assert.throws(
      () => parseProbeDimensions({ status: 1, stdout: "", stderr: "invalid codec parameters" }, "preview.webm"),
      /FFprobe failed for preview\.webm with exit code 1: invalid codec parameters/,
    )
    assert.throws(
      () => parseProbeDimensions({ status: 0, stdout: "N\/Ax216\n", stderr: "" }, "preview.webm"),
      /invalid dimensions for preview\.webm: N\/Ax216/,
    )
  })

  it("parses only positive finite FFprobe durations", () => {
    assert.equal(
      parseProbeDurationSeconds({ status: 0, stdout: "5.875000\n", stderr: "" }, "preview.webm"),
      5.875,
    )
    assert.throws(
      () => parseProbeDurationSeconds({ status: 0, stdout: "0\n", stderr: "" }, "preview.webm"),
      /invalid duration for preview\.webm: 0/,
    )
    assert.throws(
      () => parseProbeDurationSeconds({ status: 0, stdout: "N\/A\n", stderr: "" }, "preview.webm"),
      /invalid duration for preview\.webm: N\/A/,
    )
  })

  it("uses duration fallbacks only for successful probes with unusable output", () => {
    assert.equal(resolveProbeDurationSeconds({ status: 0, stdout: "4.25", stderr: "" }, "clip.webm", 6000), 4.25)
    assert.equal(resolveProbeDurationSeconds({ status: 0, stdout: "", stderr: "" }, "clip.webm", 6000), 6)
    assert.equal(resolveProbeDurationSeconds({ status: 0, stdout: "N/A", stderr: "" }, "clip.webm", 6000), 6)
    assert.throws(
      () => resolveProbeDurationSeconds({ error: new Error("spawn failed") }, "clip.webm", 6000),
      /spawn failed/,
    )
  })
})
