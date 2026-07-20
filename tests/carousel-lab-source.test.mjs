import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  normalizeCarouselLabItems,
  reconcileCenteredId,
} from "../app/dev/buttons/carousel-lab/carousel-lab-model.js"

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
    const controller = read("app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts")
    const stage = read("app/dev/buttons/carousel-lab/carousel-stage.tsx")
    const combined = `${controller}\n${stage}`
    assert.match(controller, /from "embla-carousel-react"/)
    assert.doesNotMatch(combined, /gsap|ScrollTrigger|Tweakpane|<iframe/i)
  })

  it("keeps presentation styling scoped to the lab", () => {
    const css = read("app/dev/buttons/carousel-lab/carousel-stage.module.css")
    assert.doesNotMatch(css, /(^|\n)\s*(body|:root|\*)\s*[{,]/)
    assert.match(css, /prefers-reduced-motion/)
    assert.match(css, /data-carousel-artwork/)
  })

  it("forces a finite keyboard rail when carousel motion is off", () => {
    const controller = read("app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts")
    assert.match(controller, /const finiteRail = reducedMotion \|\| tuning\.motion === false/)
    assert.match(controller, /const effectiveLoop = finiteRail\s+\? false/)
    assert.match(controller, /if \(!effectiveLoop && event\.key === "Home"\)/)
    assert.match(controller, /if \(!effectiveLoop && event\.key === "End"\)/)
  })

  it("starts Embla at the reconciled mount identity before its first select", () => {
    const controller = read("app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts")
    const initialReconciliations = controller.match(
      /reconcileCenteredId\(items, initialItemId, selectedItemId\)/g,
    ) ?? []

    assert.equal(initialReconciliations.length, 1)
    assert.match(
      controller,
      /const \[initialCenter\] = useState\(\(\) => \{\s+const id = reconcileCenteredId\(items, initialItemId, selectedItemId\)\s+const index = Math\.max\(0, items\.findIndex\(\(item\) => item\.id === id\)\)\s+return \{ id, index \}\s+\}\)/,
    )
    assert.match(controller, /startIndex: initialCenter\.index/)
    assert.match(
      controller,
      /const \[centeredId, setCenteredId\] = useState<string \| null>\(initialCenter\.id\)/,
    )

    const startIndexPosition = controller.indexOf("startIndex: initialCenter.index")
    const firstSelectPosition = controller.indexOf("\n    select()\n")
    assert.ok(startIndexPosition >= 0 && startIndexPosition < firstSelectPosition)
  })

  it("cancels stale dependency frames before scheduling current transforms", () => {
    const controller = read("app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts")
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
      /\}, \[api, effectiveLoop, items, presentation, reducedMotion, surface, tuning\]\)[\s\S]*?\}, \[writeTransforms\]\)/,
    )
  })

  it("normalizes item identity once at the stage boundary", () => {
    const stage = read("app/dev/buttons/carousel-lab/carousel-stage.tsx")
    assert.match(stage, /normalizeCarouselLabItems/)

    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => warnings.push(args)
    try {
      const normalized = normalizeCarouselLabItems([
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
    assert.equal(reconcileCenteredId(items, "third", "second"), "third")
    assert.equal(reconcileCenteredId(items, "missing", "second"), "second")
    assert.equal(reconcileCenteredId(items, "missing", "also-missing"), "first")
  })

  it("uses real Background data with isolated access fixtures and centered-only video", () => {
    const surface = read("app/dev/buttons/carousel-lab/background-lab-surface.tsx")
    const card = read("app/dev/buttons/carousel-lab/background-lab-card.tsx")
    const combined = `${surface}\n${card}`

    assert.match(surface, /backgroundRegistry/)
    assert.match(surface, /matchesBackgroundVisualFilter/)
    assert.match(surface, /readSavedBackgroundIds/)
    assert.match(card, /detailLevel === "full" && centered/)
    assert.match(card, /Use free credit/)
    assert.match(card, /Buy for \$1/)
    assert.match(card, /Unlock all/)
    assert.doesNotMatch(combined, /fetch\(|stripe|checkout|server action/i)
  })

  it("reuses the production Station card and real Music provider in the lab", () => {
    const workspace = read("app/browse/workspace.tsx")
    const sharedCard = read("components/atmosphere/station-carousel-card.tsx")
    const labSurface = read("app/dev/buttons/carousel-lab/station-lab-surface.tsx")
    assert.match(workspace, /AtmosphereStationCarouselCard/)
    assert.match(sharedCard, /music\.playStation/)
    assert.match(sharedCard, /music\.stopCurrent/)
    assert.match(sharedCard, /music\.toggleFavorite/)
    assert.match(sharedCard, /MusicLoadingProgress/)
    assert.match(labSurface, /groupAtmosphereStations/)
    assert.match(labSurface, /getVisibleAtmosphereStations/)
    assert.match(labSurface, /useMusic\(\)/)
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
