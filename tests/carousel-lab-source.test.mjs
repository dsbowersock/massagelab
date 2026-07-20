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
})
