# Background Layering and Framing Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove four proven duplicate patterned underlays, make Ripple Grid visibly cover the full viewport, and keep Dark Veil framed at every supported resolution scale.

**Architecture:** Keep fallback ownership in `BackgroundHost`, with a small typed policy that suppresses a fallback only when the matching live renderer is visibly mounted. The policy is independent of whether that mounted renderer is animated, paused, or reduced-motion static. Ripple Grid retains its aspect and palette math but changes edge falloff from transparency to bounded brightness. Dark Veil gives its shader drawing-buffer dimensions, the same coordinate space used by `gl_FragCoord`.

**Tech Stack:** Next.js 16, React 19, TypeScript, raw WebGL, Canvas 2D, Node `node:test`, Playwright desktop Chromium with phone-sized viewports.

## Global Constraints

- Scope is exactly Ripple Grid, Dot Field, Dot Grid, Shape Grid, Dark Veil, and the shared host seam necessary for their layering.
- Suppress only the four proven patterned fallbacks after their matching live effect mounts. Retain fallbacks for initial paint, loading, errors, and every non-mounted renderer.
- A visibly mounted static or reduced-motion effect also suppresses its duplicate underlay; do not preserve a duplicate merely because motion is paused or reduced.
- Do not alter other or transparent-effect fallback behavior.
- Ripple Grid retains current responsive aspect behavior, source/rainbow/custom/harmony palette behavior, option names/bounds, and cursor behavior.
- Dark Veil retains its `0.25..1` resolution-scale range, controls, and persistence contract.
- Use TDD; add the failing focused test/source contract before each implementation.
- Add focused JSDoc/comments for the policy and shader-coordinate invariants.
- Browser proof covers phone portrait (`390x844`) and short landscape (`844x390`), initial and later frames where animated, reduced motion, runtime health, and visual inspection.
- Run typecheck, lint, build, browser QA, and `git diff --check`.
- Do not change preview media/assets/manifests/playback/adaptive runtime, names/IDs/order, settings migrations, entitlements, or unrelated renderers/controls.

---

## File Structure

- Create `components/backgrounds/backgroundUnderlayPolicy.ts`: pure typed decision for the Host fallback element.
- Create `tests/background-underlay-policy.test.mjs`: mount, static/reduced mount, loading/error, and unrelated-effect unit coverage.
- Modify `components/backgrounds/BackgroundHost.tsx`: consume the policy and expose its resolved state to diagnostics.
- Modify `components/backgrounds/effects/massage-lab-ripple-grid-background.tsx`: full-frame opaque edge coverage.
- Modify `components/backgrounds/effects/massage-lab-dark-veil-background.tsx`: drawing-buffer shader resolution.
- Modify `tests/background-options.test.mjs`: source contracts for both shader invariants.
- Modify `app/dev/buttons/background-palette-gallery.tsx`: dev-only force-motion control and deterministic Dark Veil minimum-scale fixture.
- Modify `tests/browser/background-palette.spec.ts`: real-renderer responsive, visual, and reduced-motion proof.
- Modify `docs/project-log.md`: factual completion record after all checks pass.

### Task 1: Add a typed, mount-aware fallback-underlay policy

**Files:**

- Create: `components/backgrounds/backgroundUnderlayPolicy.ts`
- Create: `tests/background-underlay-policy.test.mjs`
- Modify: `components/backgrounds/BackgroundHost.tsx:1-30,408-495`

**Interfaces:**

- Produces: `PATTERNED_ACTIVE_RENDERER_IDS: ReadonlySet<string>`, containing exactly the four affected IDs.
- Produces: `shouldRenderBackgroundFallbackUnderlay(input: { backgroundId: string; effectMounted: boolean }): boolean`.
- Consumes: `entry.id` and `Boolean(BackgroundComponent)` in `BackgroundHost`.
- Guarantees: every non-mounted state renders its fallback; any visibly mounted affected renderer, including a static reduced-motion rendering, removes its duplicate fallback.

- [ ] **Step 1: Write the failing policy tests**

Create `tests/background-underlay-policy.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PATTERNED_ACTIVE_RENDERER_IDS,
  shouldRenderBackgroundFallbackUnderlay,
} from "../components/backgrounds/backgroundUnderlayPolicy.ts"

const affectedIds = [
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-shape-grid",
]

describe("background fallback underlay policy", () => {
  it("suppresses exactly the four patterned underlays whenever their effect is visibly mounted", () => {
    assert.deepEqual([...PATTERNED_ACTIVE_RENDERER_IDS].sort(), [...affectedIds].sort())
    for (const backgroundId of affectedIds) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectMounted: true }), false)
    }
  })

  it("retains the fallback during initial paint, loading, errors, and reduced-motion non-mounts", () => {
    for (const backgroundId of affectedIds) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectMounted: false }), true)
    }
  })

  it("does not alter unrelated or transparent renderer fallback behavior", () => {
    for (const backgroundId of ["massage-lab-dark-veil", "massage-lab-waves", "massage-lab-aurora"]) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectMounted: true }), true)
    }
  })
})
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `node --experimental-strip-types --test tests/background-underlay-policy.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `backgroundUnderlayPolicy.ts`.

- [ ] **Step 3: Implement the policy**

Create `components/backgrounds/backgroundUnderlayPolicy.ts`:

```ts
/**
 * These renderers paint their own patterned field. Their registry fallback is
 * useful before lazy mount, but duplicates the visible active renderer after it
 * mounts, including when that renderer is static for reduced motion.
 */
export const PATTERNED_ACTIVE_RENDERER_IDS: ReadonlySet<string> = new Set([
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-shape-grid",
])

/** Preserves non-mounted fallbacks and limits underlay suppression to proven duplicate patterns. */
export function shouldRenderBackgroundFallbackUnderlay({
  backgroundId,
  effectMounted,
}: {
  backgroundId: string
  effectMounted: boolean
}): boolean {
  return !effectMounted || !PATTERNED_ACTIVE_RENDERER_IDS.has(backgroundId)
}
```

- [ ] **Step 4: Run the focused policy test**

Run: `node --experimental-strip-types --test tests/background-underlay-policy.test.mjs`

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Wire the policy into the Host without changing load behavior**

In `components/backgrounds/BackgroundHost.tsx`, import `shouldRenderBackgroundFallbackUnderlay`. Immediately after `BackgroundComponent` is resolved, add:

```ts
  const shouldRenderFallbackUnderlay = shouldRenderBackgroundFallbackUnderlay({
    backgroundId: entry.id,
    effectMounted: Boolean(BackgroundComponent),
  })
```

Add this diagnostic attribute beside `data-background-effect-mounted`:

```tsx
      data-background-underlay={shouldRenderFallbackUnderlay ? "visible" : "suppressed"}
```

Replace the unconditional fallback element with:

```tsx
      {shouldRenderFallbackUnderlay ? (
        <div
          // Registry fallbacks mix legacy background shorthand and longhands.
          // Remounting this decorative layer avoids stale style-family reconciliation.
          key={fallbackRemountKey}
          className={cn(styles.fallback, entry.fallbackClassName)}
          style={fallbackStyle}
        />
      ) : null}
```

Do not change `shouldLoadEffect`, `loadStatus`, `data-background-fallback-only`, fallback-style resolution, palette resolution, or CSS. A failed, loading, or reduced-motion-skipped effect has no `BackgroundComponent`, so it retains the fallback. A mounted static effect has one and suppresses the duplicate.

- [ ] **Step 6: Run focused policy and Host diagnostics tests**

Run: `node --experimental-strip-types --test tests/background-underlay-policy.test.mjs tests/background-host-diagnostics.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/backgrounds/backgroundUnderlayPolicy.ts components/backgrounds/BackgroundHost.tsx tests/background-underlay-policy.test.mjs
git commit -m "Fix duplicate patterned background underlays"
```

### Task 2: Keep Ripple Grid visible across the entire drawing buffer

**Files:**

- Modify: `components/backgrounds/effects/massage-lab-ripple-grid-background.tsx:61-153`
- Modify: `tests/background-options.test.mjs:4077-4164`

**Interfaces:**

- Consumes: existing `iResolution`, `gridColor`, `enableRainbow`, `fadeDistance`, `vignetteStrength`, and `opacity` uniforms.
- Preserves: `MassageLabRippleGridBackground`, `ResolvedRippleGridOptions`, aspect correction, palette adaptation, pointer behavior, resize/DPR handling, and all option bounds.
- Produces: nonzero alpha at all four corners when `opacity > 0`; fade/vignette shape brightness rather than revealing the Host underlay. The fragment shader clamps straight RGB to `0..1` before multiplying it once by `opacity`, and emits alpha equal to `opacity`; WebGL uses `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` and the context declares `premultipliedAlpha: true`, so drawing-buffer and browser-visible alpha remain linear, bounded, and never squared or re-multiplied.

- [ ] **Step 1: Add failing source-contract assertions**

In the existing Ripple Grid test in `tests/background-options.test.mjs`, add:

```js
    assert.match(effectSource, /float radialFade = exp\(-2\.0 \* clamp\(pow\(dist, fadeDistance\), 0\.0, 1\.0\)\);/)
    assert.match(effectSource, /float edgeCoverage = mix\(0\.72, 1\.0, radialFade \* vignette\);/)
    assert.match(effectSource, /vec3 straightColor = clamp\(color \* t \* edgeCoverage, 0\.0, 1\.0\);/)
    assert.match(effectSource, /gl_FragColor = vec4\(straightColor \* opacity, opacity\);/)
    assert.doesNotMatch(effectSource, /gl_FragColor = vec4\(color \* t \* edgeCoverage \* opacity, opacity\);/)
    assert.doesNotMatch(effectSource, /float alpha = length\(color\) \* finalFade \* opacity;/)
    assert.match(effectSource, /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\)/)
    assert.doesNotMatch(effectSource, /gl\.blendFunc\(gl\.SRC_ALPHA, gl\.ONE_MINUS_SRC_ALPHA\)/)
    assert.match(effectSource, /premultipliedAlpha:\s*true/)
    assert.doesNotMatch(effectSource, /premultipliedAlpha:\s*false/)
```

- [ ] **Step 2: Verify the contract fails**

Run: `node --test --test-name-pattern="Ripple Grid" tests/background-options.test.mjs`

Expected: FAIL because the current shader exposes transparent corners through `finalFade`.

- [ ] **Step 3: Implement bounded edge brightness**

Replace the old `ddd`, `finalFade`, `alpha`, and output code in the Ripple fragment shader with:

```glsl
    float radialFade = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));

    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);
```

Immediately before output, use:

```glsl
    // Edge controls shape grid brightness but must not reveal the Host underlay.
    float edgeCoverage = mix(0.72, 1.0, radialFade * vignette);
    vec3 straightColor = clamp(color * t * edgeCoverage, 0.0, 1.0);
    gl_FragColor = vec4(straightColor * opacity, opacity);
```

Clamp the straight RGB to `0..1` before premultiplication so every RGB channel remains bounded by alpha. Use `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` and `premultipliedAlpha: true` for the premultiplied shader output; `SRC_ALPHA` would square the stored alpha and a straight-alpha context could re-multiply RGB during browser composition. Do not alter `uv.x *= iResolution.x / iResolution.y`, rotation, ripple/cursor calculations, palette branch, uniforms, or options. The explicit `0.72` minimum keeps corners visibly patterned while alpha remains full-buffer `opacity`.

- [ ] **Step 4: Run focused source and palette tests**

Run: `node --test --test-name-pattern="Ripple Grid" tests/background-options.test.mjs`

Expected: PASS.

Run: `node --experimental-strip-types --test --test-name-pattern="Ripple Grid" tests/background-palette-registry.test.mjs`

Expected: PASS; Source rainbow and Custom/Harmony semantics are unchanged.

- [ ] **Step 5: Commit**

```bash
git add components/backgrounds/effects/massage-lab-ripple-grid-background.tsx tests/background-options.test.mjs
git commit -m "Keep Ripple Grid visible across the viewport"
```

### Task 3: Align Dark Veil shader coordinates with its scaled drawing buffer

**Files:**

- Modify: `components/backgrounds/effects/massage-lab-dark-veil-background.tsx:217-239`
- Modify: `tests/background-options.test.mjs:1748-1823`

**Interfaces:**

- Consumes: CSS container bounds, capped DPR, and existing `resolutionScale`.
- Preserves: `MassageLabDarkVeilBackground`, visible CSS canvas dimensions, `uResolution`, all controls, and animation/reduced-motion lifecycle.
- Produces: `uResolution === vec2(canvas.width, canvas.height)`, matching `gl_FragCoord.xy` and framing the complete CPPN at every `0.25..1` scale.

- [ ] **Step 1: Add failing coordinate-space source assertions**

In the existing Dark Veil test in `tests/background-options.test.mjs`, add:

```js
    assert.match(effectSource, /canvas\.width = Math\.max\(1, Math\.floor\(width \* dpr \* options\.resolutionScale\)\)/)
    assert.match(effectSource, /canvas\.height = Math\.max\(1, Math\.floor\(height \* dpr \* options\.resolutionScale\)\)/)
    assert.match(effectSource, /resolution\[0\] = canvas\.width/)
    assert.match(effectSource, /resolution\[1\] = canvas\.height/)
    assert.doesNotMatch(effectSource, /resolution\[0\] = width/)
    assert.doesNotMatch(effectSource, /resolution\[1\] = height/)
```

- [ ] **Step 2: Verify the contract fails**

Run: `node --test --test-name-pattern="Dark Veil" tests/background-options.test.mjs`

Expected: FAIL because the shader receives CSS dimensions even when its drawing buffer is scaled.

- [ ] **Step 3: Use drawing-buffer dimensions for the shader uniform**

In `resizeCanvas()`, retain the current canvas sizing and CSS width/height assignments. Replace only the `resolution` assignments with:

```ts
      // gl_FragCoord is drawing-buffer pixels, including DPR and resolutionScale.
      // Matching uResolution prevents the CPPN from cropping at sub-1 scales.
      resolution[0] = canvas.width
      resolution[1] = canvas.height
```

Leave `viewportWidth` and `viewportHeight` as CSS dimensions; they drive the compact/animation decision rather than shader coordinates.

- [ ] **Step 4: Run focused source and settings contracts**

Run: `node --test --test-name-pattern="Dark Veil" tests/background-options.test.mjs`

Expected: PASS.

Run: `node --test --test-name-pattern="MassageLab Dark Veil" tests/chimer-timer.test.mjs`

Expected: PASS; persisted bounds remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add components/backgrounds/effects/massage-lab-dark-veil-background.tsx tests/background-options.test.mjs
git commit -m "Fix Dark Veil resolution-scale framing"
```

### Task 4: Add real-renderer portrait, landscape, motion, and reduced-motion evidence

**Files:**

- Modify: `app/dev/buttons/background-palette-gallery.tsx:630-995`
- Modify: `tests/browser/background-palette.spec.ts:41-245,435-510`

**Interfaces:**

- Consumes: existing guarded `/dev/buttons` review fixture and `BackgroundHost` diagnostics.
- Produces: a development-only `Force live review animation` checkbox (default `true`) and deterministic `massageLabDarkVeil={{ resolutionScale: 0.25, speed: 1 }}` fixture props.
- Produces: attached Playwright output images only; no committed image/media asset. Its Ripple Grid fixture uses non-default `opacity: 0.5` so stored corner alpha and browser-visible compositing can prove the corrected linear, bounded premultiplied-alpha contract.
- Uses: existing `desktop-chromium` project with explicit phone-sized viewports.

- [ ] **Step 1: Add the failing browser test**

In `tests/browser/background-palette.spec.ts`, add:

```ts
const PATTERNED_ACTIVE_RENDERER_IDS = [
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-shape-grid",
] as const
```

Add a test named `keeps patterned live renderers unlayered and framed on phone viewports`. For both `{ name: "phone-portrait", width: 390, height: 844 }` and `{ name: "short-landscape", width: 844, height: 390 }`, select every patterned ID and assert:

```ts
await expect(host).toHaveAttribute("data-background-effect-mounted", "true")
await expect(host).toHaveAttribute("data-background-underlay", "suppressed")
expect(await host.locator(":scope > *").count(), `${viewport.name}:${id}`).toBe(1)
```

Add this helper and use it against Ripple Grid's real canvas before and after `await page.waitForTimeout(350)`; every returned corner alpha must be greater than zero. With the deterministic `opacity: 0.5` fixture, each returned corner alpha must also be near 128, using a small 8-bit storage tolerance (for example, `Math.abs(alpha - 128) <= 2`):

```ts
async function readWebGlCornerAlphas(canvas: Locator) {
  return canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl")
    if (!gl) throw new Error("Ripple Grid review canvas did not expose WebGL.")
    const { width, height } = element as HTMLCanvasElement
    return [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => {
      const pixel = new Uint8Array(4)
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      return pixel[3]
    })
  })
}
```

Attach `await host.screenshot()` as `image/png` at initial and later frames for Ripple and Dark Veil in both viewports. For Dark Veil, assert the visible canvas fills its host and its buffer is quarter scale:

```ts
expect(framing.bufferWidth).toBe(Math.max(1, Math.floor(framing.cssWidth * Math.min(2, Math.max(1, framing.dpr)) * 0.25)))
expect(framing.bufferHeight).toBe(Math.max(1, Math.floor(framing.cssHeight * Math.min(2, Math.max(1, framing.dpr)) * 0.25)))
```

End with existing captured page/console-error assertions and `document.documentElement.scrollWidth <= window.innerWidth + 1`.

- [ ] **Step 2: Verify the browser test fails**

Run: `npm run test:browser -- tests/browser/background-palette.spec.ts --project=desktop-chromium --grep "keeps patterned live renderers unlayered and framed"`

Expected: FAIL before Tasks 1-3 and the Dark Veil fixture are complete.

- [ ] **Step 3: Add only the dev-review controls required for proof**

In `BackgroundPaletteGallery`, add:

```ts
const [forceLiveReviewAnimation, setForceLiveReviewAnimation] = useState(true)
```

Add this checkbox before the live stage:

```tsx
<label className="flex items-center gap-2 text-sm font-medium">
  <input
    type="checkbox"
    checked={forceLiveReviewAnimation}
    onChange={(event) => setForceLiveReviewAnimation(event.currentTarget.checked)}
    aria-label="Force live review animation"
  />
  Force live review animation
</label>
```

Replace the literal Host prop with:

```tsx
forceAmbientMotionForReview={forceLiveReviewAnimation}
```

Add this bounded prop beside the existing review renderer props:

```tsx
massageLabDarkVeil={{ resolutionScale: 0.25, speed: 1 }}
```

Add the bounded Ripple Grid review prop beside it:

```tsx
massageLabRippleGrid={{ opacity: 0.5 }}
```

Do not add production settings, persistence, preview components, or preview media changes.

- [ ] **Step 4: Cover actual reduced motion without the dev override**

At the end of the same browser test:

```ts
await page.emulateMedia({ reducedMotion: "reduce" })
await openPaletteGallery(page)
await page.getByLabel("Force live review animation").uncheck()
await selectBackground(page, "massage-lab-ripple-grid")
await expect(host).toHaveAttribute("data-background-diagnostic-reduced-motion", "true")
await expect(host).toHaveAttribute("data-background-effect-mounted", "false")
await expect(host).toHaveAttribute("data-background-underlay", "visible")
```

This proves a reduced-motion non-mount retains fallback. The Task 1 unit test separately proves any mounted static/reduced effect suppresses the duplicate.

- [ ] **Step 5: Run and inspect the focused visual proof**

Run: `npm run test:browser -- tests/browser/background-palette.spec.ts --project=desktop-chromium --grep "keeps patterned live renderers unlayered and framed"`

Expected: PASS. Inspect the eight attached images in Playwright output: initial/later Ripple and Dark Veil in portrait and landscape. Ripple Grid must have visible corners without a second stationary pattern; Dark Veil's quarter-scale composition must remain full-frame. Do not stage generated output.

- [ ] **Step 6: Commit**

```bash
git add app/dev/buttons/background-palette-gallery.tsx tests/browser/background-palette.spec.ts
git commit -m "Cover background layering and framing on phones"
```

### Task 5: Run the complete gate and record the completed scope

**Files:**

- Modify: `docs/project-log.md:after the current 2026-08-03 entries`

**Interfaces:**

- Consumes: completed policy, shader contracts, and browser evidence.
- Produces: one factual completion record limited to this remediation.

- [ ] **Step 1: Run focused contracts together**

Run: `node --experimental-strip-types --test tests/background-underlay-policy.test.mjs tests/background-host-diagnostics.test.mjs tests/background-options.test.mjs tests/background-palette-registry.test.mjs tests/chimer-timer.test.mjs`

Expected: PASS.

- [ ] **Step 2: Re-run the exact browser visual gate**

Run: `npm run test:browser -- tests/browser/background-palette.spec.ts --project=desktop-chromium --grep "keeps patterned live renderers unlayered and framed"`

Expected: PASS with attached portrait/landscape initial/later images and no runtime errors.

- [ ] **Step 3: Run repository validation separately**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 4: Add the factual project-log entry**

Add `## 2026-08-04 — Background layering and framing remediation` and one bullet stating: active Ripple Grid, Dot Field, Dot Grid, and Shape Grid now remove only their duplicate patterned fallback after mount; non-mounted loading/error/reduced-motion fallbacks remain; Ripple Grid has bounded non-transparent edge coverage; and Dark Veil uses drawing-buffer resolution. Include the exact phone viewport and validation coverage. Do not mention preview/media/adaptive-runtime work, catalog work, or unrelated renderers.

- [ ] **Step 5: Re-run documentation-sensitive focused contracts**

Run: `node --test --test-name-pattern="Dark Veil|Ripple Grid" tests/background-options.test.mjs`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add docs/project-log.md
git commit -m "Document background layering remediation"
```

## Self-Review

- Spec coverage: Task 1 is targeted to exactly four fallback IDs and explicitly handles mounted static/reduced state; Task 2 preserves Ripple Grid's aspect/palette/options while ending transparent edges; Task 3 fixes Dark Veil's full-frame coordinate mismatch at every existing scale; Task 4 provides portrait, landscape, initial/later-frame, runtime-health, visual, and reduced-motion evidence; Task 5 runs the required validation gates.
- Type consistency: Task 1 defines and Host consumes the exact `{ backgroundId, effectMounted }` signature. Browser assertions use exactly `visible` and `suppressed`, which Task 1 writes. Source assertions in Tasks 2 and 3 match their implementation snippets.
- Placeholder scan: no TBD, TODO, “implement later”, undefined helper, or generic test instruction remains. Each task has exact paths, code, commands, expected results, and a commit boundary.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-background-layering-and-framing-remediation.md`.

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task and review between tasks.
2. **Inline Execution** — execute the tasks in this session with checkpoints.
