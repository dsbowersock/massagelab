import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  normalizeAdaptiveCarouselItems,
  reconcileAdaptiveCarouselCenter,
} from "../components/carousels/adaptive-carousel-model.js"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

describe("Carousel Lab source boundaries", () => {
  it("records both adapted CodePens and their public-Pen MIT license boundary", () => {
    const ledger = read("docs/carousel-sources.md")

    assert.match(ledger, /https:\/\/codepen\.io\/jh3y\/pen\/ZEqNVxx/)
    assert.match(ledger, /https:\/\/codepen\.io\/jh3y\/pen\/PovoorJ/)
    assert.match(ledger, /https:\/\/blog\.codepen\.io\/documentation\/licensing\//)
    assert.match(ledger, /MIT/)
    assert.match(
      ledger,
      /^- Source title: CSS Scroll Driven Animation Cover Flow \[Infinite Edition \]$/m,
    )
    assert.match(ledger, /^- Source title: CSS Scroll-Driven Image Carousel$/m)
    assert.match(ledger, /^- Author: jh3y \/ Jhey$/m)
    assert.match(ledger, /GSAP/)
    assert.match(ledger, /ScrollTrigger/)
    assert.match(ledger, /Tweakpane/)
  })

  it("uses the existing Embla runtime and no source-demo dependencies", () => {
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    const stage = read("components/carousels/adaptive-carousel-stage.tsx")
    const combined = `${controller}\n${stage}`
    assert.match(controller, /from "embla-carousel-react"/)
    assert.doesNotMatch(combined, /gsap|ScrollTrigger|Tweakpane|<iframe/i)
  })

  it("keeps shared presentation styling locally scoped", () => {
    const css = read("components/carousels/adaptive-carousel-stage.module.css")
    assert.doesNotMatch(css, /(^|\n)\s*(body|:root|\*)\s*[{,]/)
    assert.match(css, /prefers-reduced-motion/)
    assert.match(css, /container-type:\s*inline-size/)
  })

  it("separates Embla loop positioning from presentation transforms", () => {
    const stage = read("components/carousels/adaptive-carousel-stage.tsx")
    const css = read("components/carousels/adaptive-carousel-stage.module.css")
    const slideRule = css.match(/\.slide\s*\{([\s\S]*?)\n\}/)?.[1] ?? ""
    const presentationRule = css.match(/\.presentation\s*\{([\s\S]*?)\n\}/)?.[1] ?? ""

    assert.match(stage, /data-carousel-transform="true"/)
    assert.doesNotMatch(slideRule, /(?:^|\s)transform\s*:/)
    assert.match(presentationRule, /transform:\s*[\s\S]*?translate3d/)
    assert.match(slideRule, /z-index:\s*var\(--carousel-z-index, 1\)/)
    assert.doesNotMatch(css, /\.slide\[data-centered="true"\]\s*\{[^}]*z-index/)
  })

  it("keeps stations circular while Background motion-off navigation stays finite", () => {
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    assert.match(controller, /const staticPresentation = reducedMotion \|\| tuning\.motion === false/)
    assert.match(
      controller,
      /const effectiveLoop = surface === "stations" \|\| !staticPresentation[\s\S]*?\? resolveEffectiveCarouselLoop\([\s\S]*?: false/,
    )
    assert.match(controller, /duration: staticPresentation \? 0 : 45/)
    assert.match(controller, /if \(!effectiveLoop && event\.key === "Home"\)/)
    assert.match(controller, /if \(!effectiveLoop && event\.key === "End"\)/)
  })

  it("starts Embla at the reconciled mount identity before its first select", () => {
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    const initialReconciliations = controller.match(
      /reconcileAdaptiveCarouselCenter\(items, initialItemId, selectedItemId\)/g,
    ) ?? []

    assert.equal(initialReconciliations.length, 1)
    assert.match(
      controller,
      /const \[initialCenter\] = useState\(\(\) => \{\s+const id = reconcileAdaptiveCarouselCenter\(items, initialItemId, selectedItemId\)\s+const index = Math\.max\(0, items\.findIndex\(\(item\) => item\.id === id\)\)\s+return \{ id, index \}\s+\}\)/,
    )
    assert.match(controller, /startIndex: initialCenter\.index/)
    assert.match(
      controller,
      /const \[centeredId, setCenteredId\] = useState<string \| null>\(initialCenter\.id\)/,
    )

    const startIndexPosition = controller.indexOf("startIndex: initialCenter.index")
    const firstSelectPosition = controller.search(/^    select\(\)$/m)
    assert.ok(startIndexPosition >= 0 && startIndexPosition < firstSelectPosition)
  })

  it("exposes when the shared stage has initialized Embla for browser gestures", () => {
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    const stage = read("components/carousels/adaptive-carousel-stage.tsx")

    assert.match(controller, /const isCarouselReady = Boolean\(api\)/)
    assert.match(controller, /isCarouselReady,/)
    assert.match(stage, /data-carousel-ready=\{isCarouselReady \? "true" : "false"\}/)
  })

  it("cancels stale dependency frames before scheduling current transforms", () => {
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    const listenerEffect = controller.match(
      /useEffect\(\(\) => \{\s+if \(!api\) return\s+const select = \(\) => \{[\s\S]*?\n  \}, \[api, effectiveLoop, items, scheduleTransformWrite\]\)/,
    )?.[0]

    assert.ok(listenerEffect, "expected the Embla listener effect")
    assert.match(listenerEffect, /scheduleTransformWrite\(\)/)
    assert.match(listenerEffect, /select\(\)\s+api\.on\("select", select\)/)
    assert.match(
      listenerEffect,
      /api\.off\("scroll", scheduleTransformWrite\)[\s\S]*?if \(frameRef\.current !== null\) \{[\s\S]*?cancelAnimationFrame\(frameRef\.current\)[\s\S]*?frameRef\.current = null/,
    )
    assert.match(
      controller,
      /\}, \[\s+api,[\s\S]*?bufferedLoop,[\s\S]*?emblaLoop,[\s\S]*?visibleRadius,[\s\S]*?\]\)[\s\S]*?\}, \[writeTransforms\]\)/,
    )
  })

  it("does not turn an in-progress Embla selection into an instant jump", () => {
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    assert.doesNotMatch(controller, /api\.scrollTo\(nextIndex, true\)/)
  })

  it("does not let Embla drag capture suppress interactive card controls", () => {
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    assert.match(controller, /interactiveSlideSelector/)
    assert.match(
      controller,
      /const targetElement = target instanceof Element\s+\? target\s+: target instanceof Node\s+\? target\.parentElement\s+: null/,
    )
    assert.match(controller, /if\s*\(\s*!targetElement\s*\)\s*return true/)
    assert.match(controller, /targetElement\.closest\(interactiveSlideSelector\)/)
    assert.match(controller, /watchDrag:\s*\(_api, event\) => shouldStartCarouselDrag\(event\)/)
  })

  it("normalizes item identity once at the stage boundary", () => {
    const stage = read("components/carousels/adaptive-carousel-stage.tsx")
    assert.match(stage, /normalizeAdaptiveCarouselItems/)

    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => warnings.push(args)
    try {
      const normalized = normalizeAdaptiveCarouselItems([
        { id: "", label: "Missing" },
        { id: "first", label: "First" },
        { id: "first", label: "Duplicate" },
        { id: "second", label: "Second" },
      ])
      assert.deepEqual(normalized.map(({ id }) => id), ["first", "second"])
      assert.equal(warnings.length, 2)
    } finally {
      console.warn = originalWarn
    }
  })

  it("preserves preferred, selected, then first-item centering precedence", () => {
    const items = [
      { id: "first", label: "First" },
      { id: "second", label: "Second" },
      { id: "third", label: "Third" },
    ]
    assert.equal(reconcileAdaptiveCarouselCenter(items, "third", "second"), "third")
    assert.equal(reconcileAdaptiveCarouselCenter(items, "missing", "second"), "second")
    assert.equal(reconcileAdaptiveCarouselCenter(items, "missing", "also-missing"), "first")
  })

  it("uses real Background data with isolated access fixtures and nearby video previews", () => {
    const surface = read("app/dev/buttons/carousel-lab/background-lab-surface.tsx")
    const card = read("app/dev/buttons/carousel-lab/background-lab-card.tsx")
    const combined = `${surface}\n${card}`

    assert.match(surface, /backgroundRegistry/)
    assert.match(surface, /matchesBackgroundVisualFilter/)
    assert.match(surface, /readSavedBackgroundIds/)
    assert.match(card, /detailLevel !== "shell"/)
    assert.match(card, /Use free credit/)
    assert.match(card, /Buy for \$1/)
    assert.match(card, /Unlock all/)
    assert.doesNotMatch(combined, /fetch\(|stripe|checkout|server action/i)
  })

  it("keeps 3D transforms inside the shared approved radial stage", () => {
    const stage = read("components/carousels/adaptive-carousel-stage.tsx")
    const css = read("components/carousels/adaptive-carousel-stage.module.css")

    assert.match(css, /\.track\s*\{[\s\S]*?transform-style:\s*preserve-3d/)
    assert.match(stage, /data-presentation=\{presentation\}/)
    assert.match(css, /rotateY\(var\(--carousel-rotate-y/)
  })

  it("keeps Station artwork separate from actions and exposes lab-only details", () => {
    const sharedCard = read("components/atmosphere/station-carousel-card.tsx")
    const labCard = read("app/dev/buttons/carousel-lab/station-lab-card.tsx")
    const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
    const stageCss = read("components/carousels/adaptive-carousel-stage.module.css")

    assert.match(sharedCard, /data-carousel-artwork/)
    assert.match(sharedCard, /data-carousel-station-details/)
    assert.match(sharedCard, /data-carousel-drag-surface="true"/)
    assert.match(sharedCard, /DialogTrigger/)
    assert.match(sharedCard, /DialogContent/)
    assert.match(sharedCard, /displayMode === "carousel"/)
    assert.match(labCard, /displayMode="carousel"/)
    assert.match(sharedCard, /MetalFavoriteIcon kind="heart" selected=\{isFavorite\}/)
    assert.match(controller, /dragSurface\.matches\(interactiveSlideSelector\)/)
    assert.match(stageCss, /touch-action:\s*pan-y pinch-zoom/)
  })

  it("keeps readable Glow actions in the requested Background preview-card corners", () => {
    const card = read("app/dev/buttons/carousel-lab/background-lab-card.tsx")
    const metalIcon = read("components/ui/metal-favorite-icon.tsx")

    assert.match(card, /data-carousel-primary-action/)
    assert.match(card, /data-carousel-favorite-action/)
    assert.match(card, /absolute inset-x-3 top-3/)
    assert.match(card, /data-carousel-primary-action[\s\S]*?variant="glow"/)
    assert.match(card, /data-carousel-favorite-action[\s\S]*?variant="glow"[\s\S]*?purpleGlowClassName/)
    assert.doesNotMatch(card, /\{option\.provider\}/)
    assert.match(card, /filter\(\(tag\) => !\["shader", "video"\]/)
    assert.match(card, /MetalFavoriteIcon kind="star" selected=\{saved\}/)
    assert.match(metalIcon, /data-metal-icon-trace/)
    assert.match(metalIcon, /linearGradient/)
    assert.match(metalIcon, /stroke=\{selected \? `url\(#\$\{gradientId\}\)` : "currentColor"\}/)
    assert.match(metalIcon, /fill=\{selected \? "hsl\(var\(--button-cta-face\)\)" : "none"\}/)
    assert.match(metalIcon, /animateTransform/)
    assert.match(metalIcon, /selected && !reducedMotion/)
  })

  it("keeps production Background actions and metadata off the preview artwork", () => {
    const card = read("components/backgrounds/background-carousel-card.tsx")
    assert.equal(existsSync(new URL("../components/backgrounds/background-carousel-control-tray.tsx", import.meta.url)), true)
    const tray = read("components/backgrounds/background-carousel-control-tray.tsx")

    assert.doesNotMatch(card, /data-carousel-primary-action|data-carousel-favorite-action/)
    assert.doesNotMatch(card, /visualDescriptor|previewTags|acquisitionHint/)
    assert.match(tray, /data-background-carousel-controls/)
    assert.match(tray, /data-carousel-primary-action/)
    assert.match(tray, /data-carousel-favorite-action/)
    assert.match(tray, /DialogTrigger/)
  })

  it("sizes every retained card independently and hides distant shells", () => {
    const stage = read("components/carousels/adaptive-carousel-stage.tsx")
    const css = read("components/carousels/adaptive-carousel-stage.module.css")
    const panel = read("app/dev/buttons/carousel-lab/tuning-panel.tsx")

    assert.match(stage, /--carousel-card-height/)
    assert.match(stage, /--carousel-summary-card-height/)
    assert.match(panel, /key:\s*"cardHeight"/)
    assert.match(panel, /visual height independently of its width/)
    assert.match(css, /height:\s*var\(--carousel-card-height\)/)
    assert.match(css, /data-surface="stations"[\s\S]*?data-detail-level="summary"[\s\S]*?--carousel-summary-card-height/)
    assert.match(css, /\.shell\s*\{[\s\S]*?border:\s*0[\s\S]*?background:\s*transparent/)
  })

  it("resolves responsive Background sizing from available carousel width only", () => {
    const lab = read("app/dev/buttons/carousel-lab/carousel-lab.tsx")
    const panel = read("app/dev/buttons/carousel-lab/tuning-panel.tsx")

    assert.match(lab, /ResizeObserver/)
    assert.match(lab, /previewColumn\.getBoundingClientRect\(\)\.width/)
    assert.match(lab, /getResponsiveBackgroundTuning\(viewportProfile, storedTuning\)/)
    assert.match(lab, /data-carousel-responsive-profile/)
    assert.match(panel, /Responsive sizing/)
    assert.match(panel, /disabled=\{responsiveSizing\}/)
    assert.match(panel, /Music Station card sizes stay fixed on every screen and device/)
  })

  it("keeps only Background Existing and the selected Station Background Picker", () => {
    const lab = read("app/dev/buttons/carousel-lab/carousel-lab.tsx")
    const surface = read("app/dev/buttons/carousel-lab/station-lab-surface.tsx")

    assert.match(lab, /value:\s*"background-picker",\s*label:\s*"Background Picker"/)
    assert.doesNotMatch(lab, /label:\s*"Cover Flow"/)
    assert.doesNotMatch(lab, /label:\s*"3D Carousel"/)
    assert.match(lab, /surface === "stations"[\s\S]*?option\.value === "background-picker"/)
    assert.doesNotMatch(surface, /loop-\d|sourceId/)
  })

  it("describes every tuning property in plain language", () => {
    const panel = read("app/dev/buttons/carousel-lab/tuning-panel.tsx")
    assert.match(panel, /description:/)
    assert.match(panel, /aria-describedby=\{descriptionId\}/)
    assert.match(panel, /Changes how strongly depth is projected/)
    assert.match(panel, /Sets how many card positions complete one full cylinder/)
    assert.match(panel, /Controls where the edge fade begins/)
  })

  it("reuses the production Station card and real Music provider in the lab", () => {
    const workspace = read("app/browse/workspace.tsx")
    const productionCarousel = read("components/atmosphere/station-carousel.tsx")
    const sharedCard = read("components/atmosphere/station-carousel-card.tsx")
    const labSurface = read("app/dev/buttons/carousel-lab/station-lab-surface.tsx")
    assert.match(workspace, /AtmosphereStationCarousel/)
    assert.match(productionCarousel, /AtmosphereStationCarouselCard/)
    assert.match(sharedCard, /music\.playStation/)
    assert.match(sharedCard, /music\.stopCurrent/)
    assert.match(sharedCard, /music\.toggleFavorite/)
    assert.match(sharedCard, /MusicLoadingProgress/)
    assert.match(labSurface, /groupAtmosphereStations/)
    assert.match(labSurface, /getVisibleAtmosphereStations/)
    assert.match(labSurface, /useMusic\(\)/)
  })

  it("keeps measured-space Favorites rendering under the workspace playback boundary", () => {
    const workspace = read("app/browse/workspace.tsx")
    const productionCarousel = read("components/atmosphere/station-carousel.tsx")
    const favoritesSurface = read("components/atmosphere/favorites-speed-dial.tsx")
    const responsiveModel = read("components/carousels/adaptive-carousel-model.js")
    const styles = read("app/globals.css")

    assert.match(workspace, /AtmosphereFavoritesSpeedDial/)
    assert.match(workspace, /STATION_CAROUSEL_LARGE_SCREEN_TUNING\.favoritesRatio/)
    assert.match(workspace, /FAVORITES_MIN_SURROUNDING_GAP_PX\s*=\s*4/)
    assert.match(workspace, /FAVORITES_BALANCED_FILL_RATIO\s*=\s*0\.8/)
    assert.match(workspace, /FAVORITES_MIN_USEFUL_EDGE_PX\s*=\s*STATION_CAROUSEL_TUNING\.cardWidth/)
    assert.match(workspace, /ResizeObserver/)
    assert.match(workspace, /data-favorites-fit/)
    assert.match(workspace, /data-carousel-slide.*data-centered/)
    assert.match(workspace, /--ml-atmosphere-favorites-edge/)
    assert.match(workspace, /--ml-atmosphere-workspace-scale-rem/)
    assert.match(workspace, /minimumEdge\s*=\s*centeredCardRect\.width\s*\*\s*FAVORITES_TO_CENTER_CARD_RATIO/)
    assert.match(workspace, /preferredEdge\s*=\s*Math\.min/)
    assert.match(workspace, /Math\.min\([\s\S]*?maximumFittingEdge,[\s\S]*?Math\.max\(minimumEdge, preferredEdge\)/)
    assert.match(workspace, /remainingVerticalSpace\s*\/\s*2/)
    assert.match(workspace, /maximumFittingEdge\s*>=\s*FAVORITES_MIN_USEFUL_EDGE_PX/)
    assert.match(workspace, /--ml-atmosphere-favorites-edge/)
    assert.match(workspace, /favoriteIds=\{music\.favorites\}/)
    assert.match(productionCarousel, /onCenteredStationChange\?\./)
    assert.doesNotMatch(favoritesSurface, /useMusic\(|new Audio|AudioContext|stopCurrent|pauseCurrent/)
    assert.doesNotMatch(styles, /@media \(min-height: 44\.01rem\)/)
    assert.match(styles, /data-favorites-fit="true"/)
    assert.doesNotMatch(styles, /@container ml-atmosphere-carousel-slot \(min-height:/)
    assert.doesNotMatch(styles, /@container ml-atmosphere-favorites-slot \(min-width:/)
    assert.match(styles, /inline-size: min\(100cqi, 100cqb, var\(--ml-atmosphere-favorites-edge\)\)/)
    assert.match(styles, /place-self: start center/)
    assert.match(styles, /\.ml-atmosphere-favorites-mosaic[\s\S]*?overflow:\s*visible/)
    assert.match(styles, /\.ml-atmosphere-rail-content[\s\S]*max-inline-size: none/)
    assert.match(styles, /var\(--ml-atmosphere-workspace-scale-rem\)/)
    assert.match(responsiveModel, /referenceWidth:\s*960/)
    assert.match(responsiveModel, /maxScale:\s*2\.5/)
    assert.match(responsiveModel, /maxHeaderScale:\s*1\.5/)
    assert.match(responsiveModel, /favoritesRatio:\s*1\.3/)
    assert.match(responsiveModel, /fitRoundingBuffer:\s*2/)
    assert.match(responsiveModel, /minimumFavoritesGap:\s*8/)
    assert.match(responsiveModel, /safeHeight[\s\S]*stackedBaseHeight/)
    assert.match(favoritesSurface, /aria-label="Favorites"/)
    assert.match(favoritesSurface, /appMediaTileClassName/)
    assert.match(favoritesSurface, /favoriteTileClassName[\s\S]*?ml-atmosphere-favorite-tile/)
    assert.doesNotMatch(favoritesSurface, /<h2|atmosphere-favorites-heading/)
    assert.doesNotMatch(workspace, /devicePixelRatio|visualViewport\.scale|userAgent/)
  })

  it("renders an instructional zero-Favorites state without promoting the centered station", () => {
    const favoritesSurface = read("components/atmosphere/favorites-speed-dial.tsx")

    assert.match(favoritesSurface, /Add favorites to make your speed dial/)
    assert.match(favoritesSurface, /Heart a station and it will appear here\./)
    assert.doesNotMatch(favoritesSurface, /onAddFavorite/)
    assert.doesNotMatch(favoritesSurface, /Add \{centeredStation\.title\} to favorites/)
  })

  it("bookends the Station categories with Favorites and the branded Atmoshaper preview", () => {
    const carousel = read("components/atmosphere/station-carousel.tsx")
    const workspace = read("app/browse/workspace.tsx")

    const favoritesButton = carousel.indexOf("handleGroupChange(FAVORITES_CATEGORY_ID)")
    const stationButtons = carousel.indexOf("stationGroups.map((candidate)")
    const atmoshaperButton = carousel.indexOf("handleGroupChange(ATMOSHAPER_CATEGORY_ID)")
    assert.ok(favoritesButton >= 0 && favoritesButton < stationButtons)
    assert.ok(atmoshaperButton > stationButtons)
    assert.match(carousel, /<MetalFavoriteIcon kind="heart" selected \/>/)
    assert.match(carousel, /buildAtmosphereFavoritesSpeedDialModel\(music\.favorites, stations\)\.allFavorites/)
    assert.match(carousel, /Heart a station and it will appear here\./)
    assert.match(carousel, /ml-atmosphere-station-special-icon/)
    assert.match(carousel, /ml-atmosphere-station-special-content/)
    assert.match(carousel, /data-special-state="favorites"/)
    assert.match(carousel, /title: "Atmoshaper"/)
    assert.match(carousel, /Layer ambient sounds into your own soundscape\./)
    assert.match(carousel, /<strong>Coming soon<\/strong>/)
    assert.match(carousel, /stationGroupIdByStationId\.get\(station\.id\) \?\? group\.id/)
    assert.match(carousel, /\[group\?\.id, stationItems\.length\]/)
    assert.match(carousel, /onViewChange\?\.\(nextView\)[\s\S]*?setGroupId\(nextGroupId\)/)
    assert.match(workspace, /atmosphereCarouselView === "stations"/)
    assert.match(workspace, /onViewChange=\{setAtmosphereCarouselView\}/)
  })

  it("renders unavailable Favorites through the shared inert tile state", () => {
    const favoritesSurface = read("components/atmosphere/favorites-speed-dial.tsx")

    assert.match(favoritesSurface, /getAtmosphereFavoriteStationTileState/)
    assert.match(favoritesSurface, /disabled=\{tileState\.disabled\}/)
    assert.match(favoritesSurface, /if \(!tileState\.canPlay\) return/)
  })

  it("preserves Station category positions and cancels lab prewarm on category change and unmount", () => {
    const surface = read("app/dev/buttons/carousel-lab/station-lab-surface.tsx")

    assert.match(surface, /positionsRef\s*=\s*useRef\(new Map<string, string>\(\)\)/)
    assert.match(surface, /positionsRef\.current\.set\(group\.id, stationId\)/)
    assert.match(surface, /const handleGroupChange[\s\S]*?prewarmAbortRef\.current\?\.abort\(\)[\s\S]*?setGroupId\(nextGroupId\)/)
    assert.match(surface, /useEffect\(\(\) => \(\) => \{\s*prewarmAbortRef\.current\?\.abort\(\)\s*\}, \[\]\)/)
    assert.match(surface, /onCenteredItemChange=\{handleCenteredItemChange\}/)
    assert.doesNotMatch(surface, /music\.(playStation|stopCurrent|toggleFavorite)/)
  })

  it("mounts one dev-only prototype and never imports the lab from production routes", () => {
    const page = read("app/dev/buttons/page.tsx")
    const lab = read("app/dev/buttons/carousel-lab/carousel-lab.tsx")
    const productionSources = [
      read("app/chimer/running-timer.tsx"),
      read("app/browse/workspace.tsx"),
      read("components/backgrounds/BackgroundSelector.tsx"),
    ].join("\n")

    assert.match(page, /<CarouselLab/)
    assert.match(lab, /massagelab-carousel-lab-v1|CAROUSEL_LAB_STORAGE_KEY/)
    assert.match(lab, /surface === "backgrounds"/)
    assert.match(lab, /<BackgroundLabSurface/)
    assert.match(lab, /<StationLabSurface/)
    assert.match(read("app/dev/buttons/carousel-lab/carousel-stage.tsx"), /AdaptiveCarouselStage as CarouselStage/)
    assert.match(productionSources, /BackgroundCarousel|AtmosphereStationCarousel/)
    assert.doesNotMatch(productionSources, /dev\/buttons\/carousel-lab|CarouselLab/)
  })

  it("propagates abort signals only through optional Station payload prewarming", () => {
    const provider = read("components/providers/music-provider.tsx")
    const runtime = read("lib/atmosphere/generative-fm-runtime.ts")

    assert.match(provider, /prewarmStation:[\s\S]*?signal\?: AbortSignal/)
    assert.match(provider, /startAbortableGenerativeFmPrewarm\(\s*getRuntime,\s*options\.signal/)
    assert.match(provider, /prewarmGenerativeFmPiece\([\s\S]*?signal: options\.signal/)
    assert.match(runtime, /type GenerativeFmPrewarmOptions[\s\S]*?signal\?: AbortSignal/)
    assert.match(runtime, /startAbortableGenerativeFmPrewarm\(\s*\(\) => getPreparedGenerativeFmRuntime/)
    assert.match(runtime, /prewarmGenerativeFmSamplePayloads\(prepared, signal\)/)
    assert.match(runtime, /warmSamplePayloadUrls\(sampleUrls, signal\)/)
    assert.match(runtime, /signal\?\.throwIfAborted\(\)/)
    assert.doesNotMatch(runtime, /getPreparedGenerativeFmRuntime\([^\n]*signal/)
  })
})
