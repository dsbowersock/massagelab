import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8")

describe("Sitewide control-system review lab", () => {
  it("keeps the development route hidden while exposing every review family", async () => {
    const pageSource = await readSource("../app/dev/buttons/page.tsx")

    assert.match(pageSource, /Control system review/)
    assert.match(pageSource, /process\.env\.NODE_ENV === "production"/)
    assert.match(pageSource, /notFound\(\)/)
    assert.match(pageSource, /index: false/)
    assert.match(pageSource, /ButtonGallery/)
    assert.match(pageSource, /ChoiceGallery/)
    assert.match(pageSource, /FieldGallery/)
    assert.match(pageSource, /CardStatusGallery/)
    assert.match(pageSource, /SurfaceNavigationGallery/)
    assert.match(pageSource, /ProtectedRouteGallery/)
  })

  it("provides shared family authorities instead of review-only control geometry", async () => {
    const [
      buttonSource,
      tabsSource,
      selectFieldSource,
      inputSource,
      textareaSource,
      selectableCardSource,
      noticeSource,
      surfaceSource,
      stepperSource,
    ] = await Promise.all([
      readSource("../components/ui/button.tsx"),
      readSource("../components/ui/tabs.tsx"),
      readSource("../components/ui/select-field.tsx"),
      readSource("../components/ui/input.tsx"),
      readSource("../components/ui/textarea.tsx"),
      readSource("../components/ui/selectable-card.tsx"),
      readSource("../components/ui/notice.tsx"),
      readSource("../components/ui/app-surface.tsx"),
      readSource("../components/ui/accelerating-step-button.tsx"),
    ])

    assert.match(buttonSource, /tone:/)
    assert.match(buttonSource, /effect:/)
    assert.match(buttonSource, /compact:/)
    assert.match(tabsSource, /TabsListProps/)
    assert.match(tabsSource, /TabsTriggerProps/)
    assert.match(selectFieldSource, /export interface SelectFieldProps/)
    assert.match(inputSource, /inputVariants/)
    assert.match(textareaSource, /textareaVariants/)
    assert.match(selectableCardSource, /export interface SelectableCardProps/)
    assert.match(noticeSource, /NoticeTone/)
    assert.match(surfaceSource, /AppSurfaceVariant/)
    assert.match(stepperSource, /doubleStep/)
    assert.match(stepperSource, /repeatDelay/)
  })

  it("shows all required states and route-shaped review specimens", async () => {
    const gallerySources = await Promise.all([
      readSource("../app/dev/buttons/button-gallery.tsx"),
      readSource("../app/dev/buttons/choice-gallery.tsx"),
      readSource("../app/dev/buttons/field-gallery.tsx"),
      readSource("../app/dev/buttons/card-status-gallery.tsx"),
      readSource("../app/dev/buttons/surface-navigation-gallery.tsx"),
      readSource("../app/dev/buttons/protected-route-gallery.tsx"),
      readSource("../app/dev/buttons/wellness-region-preview.tsx"),
    ])
    const gallerySource = gallerySources.join("\n")

    for (const marker of [
      "Base",
      "Hover",
      "Pressed",
      "Focus visible",
      "Disabled",
      "Selected",
      "Compact",
      "Chimer duration entry",
      "Wellness anatomical map",
      "Booking service choice",
      "Dense admin filters",
      "Donation glow flicker",
    ]) {
      assert.match(gallerySource, new RegExp(marker))
    }

    assert.match(gallerySource, /role="button"/)
    assert.match(gallerySource, /aria-pressed/)
    assert.match(gallerySource, /Keyboard-accessible region list/)
    assert.match(gallerySource, /Anterior body regions/)
    assert.match(gallerySource, /Posterior body regions/)
    assert.match(gallerySource, /Perspective/)
    assert.match(gallerySource, /anterior\.svg/)
    assert.match(gallerySource, /posterior\.svg/)
    assert.match(gallerySource, /anterior-lateral\.svg/)
    assert.match(gallerySource, /posterior-lateral\.svg/)
    assert.match(gallerySource, /translate\(22 0\) scale\(0\.83 1\)/)
    assert.match(gallerySource, /lateralFrontRegionPaths/)
    assert.match(gallerySource, /lateralBackRegionPaths/)
    assert.match(gallerySource, /applyRegionPaths/)
    assert.match(gallerySource, /bodyClipPaths/)
    assert.match(gallerySource, /referenceFilterId/)
    assert.match(gallerySource, /feColorMatrix/)
    assert.match(gallerySource, /mapAnteriorLaterality/)
    assert.match(gallerySource, /regionsByPerspective\[perspective\]\[view\]/)
    assert.match(gallerySource, /fill-transparent/)
  })

  it("mirrors the CTA blue corner treatment on the purple CTA and attention faces", async () => {
    const styleSource = await readSource("../app/globals.css")

    assert.match(styleSource, /--button-cta-corner: var\(--button-blue-mid\)/)
    assert.match(
      styleSource,
      /\.ml-button-press-motion\.ml-button-cta,\s+\.ml-button-press-motion\.ml-button-attention \{[\s\S]*?hsl\(var\(--button-cta-corner\)\) 100%/,
    )
  })

  it("keeps the next review refinements on shared controls", async () => {
    const [
      buttonGallerySource,
      loaderGallerySource,
      noticeSource,
      navigationSource,
      styleSource,
    ] = await Promise.all([
      readSource("../app/dev/buttons/button-gallery.tsx"),
      readSource("../app/dev/buttons/loader-gallery.tsx"),
      readSource("../components/ui/notice.tsx"),
      readSource("../app/dev/buttons/surface-navigation-gallery.tsx"),
      readSource("../app/globals.css"),
    ])

    assert.match(buttonGallerySource, /<Button variant="default">Hold press<\/Button>/)
    assert.match(loaderGallerySource, /const buttonLoaderSize = 18/)
    assert.match(loaderGallerySource, /const buttonLoaderShapes = \["sphere", "swirl", "ripple"\] as const/)
    assert.match(noticeSource, /tone === "loading"[\s\S]*?<Loader[\s\S]*?size=\{20\}/)
    assert.match(navigationSource, /variant="ctaBlue" size="icon" aria-label="Music"/)
    assert.match(navigationSource, /variant="ctaBlue" size="icon" aria-label="Music inactive"/)
    assert.equal((navigationSource.match(/variant="ctaBlue"/g) ?? []).length, 8)
    assert.match(styleSource, /--button-alert-edge: 350 88% 68%/)
    assert.match(styleSource, /--ml-switch-thumb-face: 0 0% 98%/)
    assert.match(styleSource, /--ml-button-top-highlight: 0 0% 100%/)
    assert.doesNotMatch(styleSource, /border-top-color: hsl\(var\(--foreground\)/)
    assert.match(styleSource, /border: 2px solid hsl\(var\(--brand-orange\) \/ 0\.44\)/)
    assert.match(styleSource, /linear-gradient\(130deg, hsl\(var\(--brand-orange\) \/ 0\.12\), hsl\(0 0% 15% \/ 0\.92\)\)/)
    assert.doesNotMatch(styleSource, /@keyframes ml-liquid-drift/)

    const lightGlowRule = styleSource.match(
      /\.light \.ml-button-press-motion\.ml-button-glow \{([\s\S]*?)\n  \}/,
    )?.[1]
    assert.ok(lightGlowRule)
    assert.match(lightGlowRule, /border-top-color: hsl\(var\(--button-orange-start\) \/ 0\.58\)/)
    assert.match(lightGlowRule, /radial-gradient\(120% 85% at var\(--ml-glow-sheen-position\) 8%/)
    assert.match(lightGlowRule, /linear-gradient\(122deg, hsl\(var\(--button-default-face\) \/ 0\.78\)/)
    assert.doesNotMatch(lightGlowRule, /hsl\(215 24% 16% \/ 0\.92\)/)
    assert.match(lightGlowRule, /backdrop-filter: blur\(12px\) saturate\(1\.8\) brightness\(1\.05\)/)
    assert.doesNotMatch(lightGlowRule, /--ml-glow-(?:sheen-strong|border|fill)/)
    assert.match(lightGlowRule, /0 0 36px hsl\(var\(--brand-orange\) \/ 0\.64\)/)
    assert.match(
      styleSource,
      /\.ml-button-press-motion\.ml-button-outline \{[\s\S]*?text-shadow: none !important;/,
    )
    assert.match(styleSource, /\.ml-button-press-motion\.ml-button-outline svg \{[\s\S]*?filter: none !important;/)
    assert.match(
      styleSource,
      /\.ml-button-press-motion\.ml-button-outline:active[\s\S]*?transform: translateY\(1px\);/,
    )
    assert.match(
      styleSource,
      /\.metal-fx-root\.ml-metal-attention-root\[data-theme\],[\s\S]*?align-self: flex-start;[\s\S]*?height: fit-content !important;/,
    )
    assert.match(
      styleSource,
      /\.metal-fx-root\.ml-metal-attention-root\[data-theme\],[\s\S]*?padding: 1px;/,
    )
    assert.match(styleSource, /\.ml-metal-attention-root:has\(> \.metal-fx-content > \.ml-button-tactile\)/)
    assert.match(
      styleSource,
      /\.ml-metal-attention-root > \.metal-fx-content > \.ml-button-tactile \{[\s\S]*?transform: none !important;/,
    )
  })

  it("renders Harmony choices as wrapping shared buttons instead of one segmented track", async () => {
    const [harmonySource, harmonyStyles] = await Promise.all([
      readSource("../components/chimer-controls/HarmonyToggleGroup.tsx"),
      readSource("../components/chimer-controls/chimer-controls.module.css"),
    ])

    assert.match(harmonySource, /variant=\{isSelected \? "attention" : "ctaBlue"\}/)
    assert.match(harmonySource, /aria-pressed=\{isSelected\}/)
    assert.match(harmonySource, /<MetalAttentionRing/)
    assert.doesNotMatch(harmonySource, /SegmentedToggleGroup/)
    assert.match(
      harmonyStyles,
      /Harmony choices are individual shared buttons[\s\S]*?\.harmonyList \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap;/,
    )
  })
})
