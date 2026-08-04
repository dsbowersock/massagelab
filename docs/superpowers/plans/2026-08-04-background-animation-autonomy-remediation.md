# Background Animation Autonomy Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gradient Blinds, Pixel Snow, Faulty Terminal, and Grid Distortion visibly animate as autonomous backgrounds on phones without requiring pointer input or showing a broken initial frame.

**Architecture:** Keep each existing renderer and stored-settings surface intact, and repair motion at the renderer boundary. Time-based motion must remain deterministic for a given timestamp, pointer input remains additive where supported, compact phones may animate at their existing reduced DPR, and reduced-motion/hidden-document states render one representative static frame.

**Tech Stack:** React 19 client components, TypeScript, raw WebGL/WebGL2 shaders, the shared `shouldAnimateAmbientBackground` policy, Node test runner, Playwright Chromium.

## Global Constraints

- Keep every existing background ID and approved display name unchanged.
- Do not generate or replace preview media in this plan; preview work remains blocked until live renderers are accurate.
- Gradient Blinds must move the blinds and gradient itself, not only animate per-pixel noise.
- Pixel Snow must animate on compact phone viewports at the existing compact DPR cap and must never use shader time `0` as its representative first/static frame.
- Faulty Terminal must have visible autonomous shader structure at defaults; cursor/touch response may enhance it but may not be required to reveal it.
- Grid Distortion must have continuous ambient deformation at defaults; cursor deformation remains additive and optional.
- `prefers-reduced-motion: reduce` and a hidden document render a stable representative frame without scheduling a continuing animation loop.
- Do not add dependencies, change catalog ownership/entitlement behavior, alter palette roles, or change the future five-playing-preview contract.

---

### Task 1: Gradient Blinds moves independently of noise and pointer input

**Files:**
- Modify: `components/backgrounds/effects/massage-lab-gradient-blinds-background.tsx`
- Test: `tests/background-animation-autonomy.test.mjs`

**Interfaces:**
- Consumes: `shouldAnimateAmbientBackground(...)` and the existing `iTime`, `uBlindCount`, `uMirror`, and gradient uniforms.
- Produces: shader output whose gradient position and blind phase change over time while all existing settings keep their meanings.

- [ ] **Step 1: Write the failing source-contract test**

Add a test that reads the renderer source and requires two named shader constants and their use in separate calculations:

```js
test("Gradient Blinds animates its gradient and blind phase", () => {
  assert.match(source, /const float GRADIENT_DRIFT_RATE = 0\.11;/)
  assert.match(source, /const float BLIND_DRIFT_RATE = 0\.18;/)
  assert.match(source, /sin\(iTime \* GRADIENT_DRIFT_RATE\) \* 0\.12/)
  assert.match(source, /uvMod\.x \+ iTime \* BLIND_DRIFT_RATE/)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/background-animation-autonomy.test.mjs`

Expected: FAIL because the named drift constants and phase calculations do not exist.

- [ ] **Step 3: Add bounded gradient drift and continuous blind-phase drift**

In `fragmentShaderSource`, define:

```glsl
const float GRADIENT_DRIFT_RATE = 0.11;
const float BLIND_DRIFT_RATE = 0.18;
```

Compute the base gradient from a bounded oscillating coordinate so it never introduces a wrap seam:

```glsl
float gradientDrift = sin(iTime * GRADIENT_DRIFT_RATE) * 0.12;
float t = clamp(uvMod.x + gradientDrift, 0.0, 1.0);
```

Compute the blind stripe from its own continuously advancing coordinate:

```glsl
float blindCoordinate = uvMod.x + iTime * BLIND_DRIFT_RATE;
float stripe = fract(blindCoordinate * max(uBlindCount, 1.0));
```

Keep mirror behavior applied to the gradient coordinate and keep `uShineFlip` applied to the stripe. Do not replace existing noise, spotlight, angle, distortion, blend-mode, or pointer behavior.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/background-animation-autonomy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/backgrounds/effects/massage-lab-gradient-blinds-background.tsx tests/background-animation-autonomy.test.mjs
git commit -m "fix: animate Gradient Blinds structure"
```

---

### Task 2: Pixel Snow animates on phones from a representative scene time

**Files:**
- Modify: `components/backgrounds/effects/massage-lab-pixel-snow-background.tsx`
- Test: `tests/background-animation-autonomy.test.mjs`

**Interfaces:**
- Consumes: `shouldAnimateAmbientBackground({ allowCompactViewport })` and the existing Pixel Snow shader time uniform.
- Produces: compact-phone motion at DPR 1 and a deterministic nonzero representative frame for first paint and reduced motion.

- [ ] **Step 1: Extend the failing source-contract test**

```js
test("Pixel Snow animates compact viewports and avoids the time-zero singular frame", () => {
  assert.match(source, /const PIXEL_SNOW_SCENE_TIME_OFFSET = 11\.7/)
  assert.match(source, /allowCompactViewport:\s*true/)
  assert.match(source, /PIXEL_SNOW_SCENE_TIME_OFFSET \+ \(timestamp - startTime\) \* 0\.001/)
  assert.doesNotMatch(source, /const time = animate \? \(timestamp - startTime\) \* 0\.001 : 0/)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/background-animation-autonomy.test.mjs`

Expected: FAIL because compact animation is currently disallowed and the static frame uses time zero.

- [ ] **Step 3: Use a deterministic nonzero scene offset and allow compact animation**

Add this module constant:

```ts
const PIXEL_SNOW_SCENE_TIME_OFFSET = 11.7
```

Pass `allowCompactViewport: true` to `shouldAnimateAmbientBackground`. Preserve the compact DPR cap of `1`. Resolve time as:

```ts
const time = animate
  ? PIXEL_SNOW_SCENE_TIME_OFFSET + (timestamp - startTime) * 0.001
  : PIXEL_SNOW_SCENE_TIME_OFFSET
```

Do not change the three flake variants, density, direction, palette, ray-march iteration limits, or existing tuning ranges.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/background-animation-autonomy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/backgrounds/effects/massage-lab-pixel-snow-background.tsx tests/background-animation-autonomy.test.mjs
git commit -m "fix: animate Pixel Snow on compact screens"
```

---

### Task 3: Faulty Terminal has visible autonomous defaults

**Files:**
- Modify: `components/backgrounds/effects/massage-lab-faulty-terminal-background.tsx`
- Modify: `lib/chimer-timer.js`
- Test: `tests/background-animation-autonomy.test.mjs`
- Test: `tests/chimer-timer.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_CHIMER_SETTINGS`, `normalizeChimerSettings`, and the renderer's `noiseAmp`, `mouseReact`, and time uniforms.
- Produces: one aligned default noise amplitude of `0.24` in persistence and rendering; pointer response remains optional and additive.

- [ ] **Step 1: Write failing default-alignment tests**

In `tests/chimer-timer.test.mjs`, assert that omitted or invalid Faulty Terminal noise resolves to `0.24`. In `tests/background-animation-autonomy.test.mjs`, read both files and require:

```js
assert.match(rendererSource, /noiseAmp:\s*0\.24/)
assert.match(settingsSource, /massageLabFaultyTerminalNoiseAmp:\s*0\.24/)
```

Also retain source assertions that `uNoiseAmp` shapes `fbm` and that mouse influence is guarded by `uUseMouse`, proving autonomous structure and pointer enhancement are separate paths.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `node --test tests/background-animation-autonomy.test.mjs tests/chimer-timer.test.mjs`

Expected: FAIL because both current defaults are zero.

- [ ] **Step 3: Align the renderer and stored-settings defaults**

Change only these defaults from `0` to `0.24`:

```ts
noiseAmp: 0.24,
```

```js
massageLabFaultyTerminalNoiseAmp: 0.24,
```

Keep `mouseReact`, `mouseStrength`, `timeScale`, page-load reveal, palette tint, and every sanitizer range unchanged. Existing users who explicitly saved `0` must continue to receive `0`; only missing/invalid/reset values use `0.24`.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/background-animation-autonomy.test.mjs tests/chimer-timer.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/backgrounds/effects/massage-lab-faulty-terminal-background.tsx lib/chimer-timer.js tests/background-animation-autonomy.test.mjs tests/chimer-timer.test.mjs
git commit -m "fix: give Faulty Terminal autonomous structure"
```

---

### Task 4: Grid Distortion continuously drifts with pointer input as an additive layer

**Files:**
- Modify: `components/backgrounds/effects/massage-lab-grid-distortion-background.tsx`
- Test: `tests/background-animation-autonomy.test.mjs`

**Interfaces:**
- Consumes: the fragment shader's `time` uniform, sampled pointer displacement texture, and existing `strength` option.
- Produces: time-varying ambient UV displacement scaled by `strength`, added to the sampled pointer displacement.

- [ ] **Step 1: Add a failing shader-contract test**

```js
test("Grid Distortion combines ambient drift with pointer deformation", () => {
  assert.match(source, /uniform float uStrength;/)
  assert.match(source, /vec2 ambientOffset = vec2\(/)
  assert.match(source, /sin\(uv\.y \* 9\.0 \+ time \* 0\.73\)/)
  assert.match(source, /cos\(uv\.x \* 7\.0 - time \* 0\.61\)/)
  assert.match(source, /newUV = uv - offset \* 0\.02 \+ ambientOffset/)
  assert.match(source, /uniform1f\(resources\.uniforms\.strength, options\.strength\)/)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/background-animation-autonomy.test.mjs`

Expected: FAIL because the fragment shader currently uses only the decaying pointer data texture.

- [ ] **Step 3: Add bounded ambient UV movement in the shader**

Add `uStrength` to `GridDistortionResources`, resource creation, and render-time uniform wiring. In the fragment shader, keep the pointer texture path and add:

```glsl
vec2 ambientOffset = vec2(
  sin(uv.y * 9.0 + time * 0.73),
  cos(uv.x * 7.0 - time * 0.61)
) * (0.012 * uStrength);
vec2 newUV = uv - offset * 0.02 + ambientOffset;
```

Continue uploading/relaxing the pointer data texture only while animation is permitted. When reduced motion is active, render at the representative existing `time = 0` without scheduling RAF. `cursorInteraction: false` must disable only pointer injection/listeners, not ambient drift.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/background-animation-autonomy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/backgrounds/effects/massage-lab-grid-distortion-background.tsx tests/background-animation-autonomy.test.mjs
git commit -m "fix: add ambient Grid Distortion motion"
```

---

### Task 5: Prove phone motion and reduced-motion stability in a real browser

**Files:**
- Modify: `tests/browser/background-palette.spec.ts`
- Modify: `docs/project-log.md`
- Test: `tests/background-animation-autonomy.test.mjs`
- Test: `tests/background-options.test.mjs`
- Test: `tests/browser/background-palette.spec.ts`

**Interfaces:**
- Consumes: the existing `/dev/buttons` background palette fixture and its helpers for selecting a real effect.
- Produces: Playwright evidence that all four real renderers change on a 390x844 phone and remain stable under reduced motion.

- [ ] **Step 1: Add failing parameterized browser tests with decoded visual evidence**

Add separate fresh-context no-preference and reduced-motion parameterized cases per renderer whose titles begin `keeps repaired backgrounds autonomous on phones and stable for reduced motion`. For each ID below, select the real renderer in the existing fixture:

```ts
const autonomousIds = [
  "massage-lab-gradient-blinds",
  "massage-lab-pixel-snow",
  "massage-lab-faulty-terminal",
  "massage-lab-grid-distortion",
] as const
```

At viewport `390x844` and `reducedMotion: "no-preference"`, take a clipped host screenshot, wait `700ms`, take another, and require exact `Buffer.equals(...) === false`. For Pixel Snow, also sample the central 20% of the first screenshot and assert it is not a single uniform opaque square. In a separate fresh context, start with `reducedMotion: "reduce"`, add the production `chimer-running` class after the first fixture load, select the same ID, take two named screenshots `400ms` apart, and require exact `Buffer.equals(...) === true`. Write every first/later screenshot directly to a named `testInfo.outputPath(...)` image with an ID/motion-specific filename while retaining the returned buffers for assertions; compare the boolean result so assertion reporting never formats an enormous byte-by-byte Buffer diff. Capture the full host composite with Playwright `scale: "css"` and normalize only the enclosing review fixture card to square corners before capture. This removes nondeterministic fixture-only rounded-edge rasterization without excluding or changing the `BackgroundHost`, fallback, label overlap, or product/background pixels.

Add one additional fresh-context compact case for Faulty Terminal and one for Grid Distortion at `360x780`, preserving the compact drawing-buffer cap, pointer-free Grid Distortion settle, `700ms` exact Buffer inequality, and first/later named test-output images. Before the first named Grid Distortion capture at both `390x844` and `360x780`, wait for at least 160 chained browser animation frames after renderer readiness; `130 * 0.9^160` makes the seeded displacement negligible, so the following `700ms` delta isolates time-driven ambient offset rather than pointer decay. Run all ten cases serially so Chromium releases each renderer/motion-mode context before the next case.

- [ ] **Step 2: Run the integrated browser proof on the remediated branch**

Run: `npm run test:browser -- tests/browser/background-palette.spec.ts --project=mobile-chromium --grep "keeps repaired backgrounds autonomous" --workers=1`

Expected: PASS on the integrated branch. Tasks 1-4 already preserve their individual RED evidence against the pre-remediation renderer contracts; do not rewrite branch history or create a second worktree merely to reproduce an obsolete browser baseline here.

- [ ] **Step 3: Make the fixture/test timing deterministic without adding a production-only seam**

Use the existing real renderer fixture, a fresh browser context per parameterized case, and the completed-draw helper before the first capture. Mask only fixture controls that are outside the background host. Do not mock canvas/WebGL, do not assert data attributes in place of pixels, and do not change preview media. If screenshot equality is affected only by nondeterministic rounded-edge rasterization, normalize that fixture-only ancestor while retaining the complete real `BackgroundHost` composite.

The integrated contract test may reconcile only its stale pointer-only Grid Distortion assertion; do not broaden that edit into unrelated background-option contracts.

- [ ] **Step 4: Record the completed remediation in the chronological project log**

Add a dated 2026-08-04 entry stating that Gradient Blinds now moves its gradient/blinds, Pixel Snow animates at compact DPR from a representative scene time, Faulty Terminal has visible autonomous defaults, and Grid Distortion combines ambient and pointer deformation. State explicitly that preview generation remains deferred until the remaining live-background audit is resolved.

- [ ] **Step 5: Run the plan gate**

Run:

```bash
node --test tests/background-animation-autonomy.test.mjs tests/chimer-timer.test.mjs tests/background-options.test.mjs
npm run test:browser -- tests/browser/background-palette.spec.ts --project=mobile-chromium --grep "keeps repaired backgrounds autonomous"
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands PASS; the production build completes all configured routes.

- [ ] **Step 6: Commit**

```bash
git add tests/browser/background-palette.spec.ts tests/background-options.test.mjs docs/project-log.md
git commit -m "test: prove autonomous phone backgrounds"
```
