import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

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

describe("background preview media", () => {
  it("renders a decorative video with a WebP poster over the registry fallback", () => {
    assert.match(componentSource, /<video/)
    assert.match(componentSource, /poster=\{posterUrl\}/)
    assert.match(componentSource, /muted/)
    assert.match(componentSource, /loop/)
    assert.match(componentSource, /playsInline/)
    assert.match(componentSource, /preload="metadata"/)
    assert.match(componentSource, /aria-hidden="true"/)
    assert.match(componentSource, /fallbackStyle/)
    assert.match(componentSource, /onError/)
  })

  it("keeps inactive cards on posters and limits playback to active selected cards", () => {
    assert.match(cardSource, /<BackgroundPreviewMedia/)
    assert.match(cardSource, /active=\{active && selected && detailLevel !== "shell"/)
    assert.doesNotMatch(cardSource, /<video/)
  })

  it("generates one-third-duration quality-78 WebP posters, including missing posters", () => {
    assert.match(renderSource, /async function encodePoster/)
    assert.match(renderSource, /durationMs \/ 3000/)
    assert.match(renderSource, /"-c:v", "libwebp"/)
    assert.match(renderSource, /"-quality", "78"/)
    assert.match(renderSource, /existsSync\(outputPath\).*existsSync\(posterPath\)/s)
  })

  it("captures Track 4B effects through the shared canonical host-option resolver", () => {
    assert.match(previewSceneSource, /resolveDnaTwistedCubesBackgroundHostProps/)
    assert.match(previewSceneSource, /settings: DEFAULT_CHIMER_SETTINGS/)
    assert.match(previewSceneSource, /\.\.\.PREVIEW_TRACK_4B_EFFECT_PROPS/)
  })

  it("hashes poster metadata and resolves poster URLs through the configured base", () => {
    for (const field of ["previewPosterUrl", "posterBytes", "posterSha256"]) {
      assert.match(manifestGeneratorSource, new RegExp(field))
    }
    assert.match(manifestGeneratorSource, /previewImageUrl/)
    assert.match(manifestGeneratorSource, /previewSquareImageUrl/)
    assert.match(manifestGeneratorSource, /previewVerticalImageUrl/)
    assert.match(manifestGeneratorSource, /validateDimensions\(posterPath, variant\.width, variant\.height\)/)
    assert.match(manifestGeneratorSource, /resolvePreviewMediaUrl\(variant\.previewPosterUrl\)/)
  })
})
