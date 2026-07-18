# DNA and Twisted Cubes Premium Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DNA and Twisted Cubes as enabled premium, source-preserving React/CSS backgrounds with bounded visual controls, Track 4A palette/draft/preset integration, representative reduced-motion states, and generated video previews with poster fallbacks.

**Architecture:** Implement each effect as a lazy-loaded React component with a scoped CSS Module and a DOM-independent helper module. Keep persisted non-color values in the existing sanitized Chimer preference object, resolve colors only through Track 4A's typed palette adapter, and pass one shared configuration through `BackgroundHost` to Chimer, Clock, Music visualizer, and ambient contexts. Extend the existing preview pipeline with WebP posters and a reusable media renderer instead of introducing a second asset system.

**Tech Stack:** Next.js App Router, React 19, TypeScript/JavaScript with focused JSDoc, CSS Modules, existing shared range controls, Node test runner, Playwright, FFmpeg/WebP preview generation.

**Approved design:** `docs/superpowers/specs/2026-07-18-dna-twisted-cubes-backgrounds-design.md`

## Global Constraints

- Start only after Tracks 1, 2, and 4A are merged into refreshed `main`; suggested branch: `codex/dna-twisted-cubes-backgrounds`.
- Before editing, compare the landed Track 1 ownership resolver, Track 2 immersive shell, and Track 4A palette/draft contracts with the interfaces consumed below. Reconcile names only; do not recreate, bypass, or fork those systems.
- Preserve the user-owned `TODO.md` modification and exclude it from every commit.
- Use the attached MIT archives only as source references. Do not copy global `body`, `:root`, universal-selector, font, minimum-height, or `touch-action` rules.
- Add no iframe, Canvas, WebGL, animation library, pointer-drag behavior, runtime dependency, public source artifact, shuffle-colors action, Prisma migration, or Roadmap entry.
- Keep source colors and source property defaults until the user changes them. All property changes remain Track 4A draft operations and persist only on Apply.
- Use the canonical `premium_backgrounds` entitlement/permanent-ownership resolution. The renderers receive access-safe props and never inspect sessions, plan labels, carts, credits, or billing records.
- Keep one committed configuration across active Chimer, ordinary `/clock`, `/clock?source=music`, and ambient hosts.

## Target File Map

- Create `lib/background-effect-layout.js` for responsive effective transform clamps shared by both effects.
- Create `lib/dna-background.js` and `tests/dna-background.test.mjs` for DNA sanitization, timing, phase, assignments, and Chimer-setting conversion.
- Create `components/backgrounds/effects/massage-lab-dna-background.tsx` and `.module.css` for the isolated DNA renderer.
- Create `tests/dna-background-component.test.mjs` for markup, lifecycle, style-isolation, and reduced-motion contracts.
- Create `lib/twisted-cubes-background.js` and `tests/twisted-cubes-background.test.mjs` for Twisted Cubes sanitization, timing, alpha, interpolation, and Chimer-setting conversion.
- Create `components/backgrounds/effects/massage-lab-twisted-cubes-background.tsx` and `.module.css` for the isolated Twisted Cubes renderer.
- Create `tests/twisted-cubes-background-component.test.mjs` for markup, style-isolation, gradient, and reduced-motion contracts.
- Create `components/chimer-controls/DnaBackgroundControls.tsx` and `TwistedCubesBackgroundControls.tsx`.
- Create `components/backgrounds/BackgroundPreviewMedia.tsx` and `tests/background-preview-media.test.mjs`.
- Create `tests/browser/dna-twisted-cubes-backgrounds.spec.ts`.
- Modify `lib/chimer-timer.js`, `components/backgrounds/backgroundRegistry.ts`, `backgroundPaletteRegistry.ts`, `resolveBackgroundEffectProps.ts`, `BackgroundHost.tsx`, `BackgroundSelector.tsx`, `backgroundPreviewManifest.ts`, and `effects/css-backgrounds.tsx`.
- Modify `app/chimer/page.tsx`, `app/chimer/running-timer.tsx`, `app/chimer/running-timer.module.css`, `app/dev/buttons/background-palette-gallery.tsx`, and `app/dev/buttons/page.tsx`.
- Modify `scripts/chimer-preview-generation/render.mjs`, `manifest.mjs`, `tests/background-options.test.mjs`, `tests/background-palette-registry.test.mjs`, `tests/chimer-timer.test.mjs`, `tests/chimer-entitlements.test.mjs`, `tests/sitewide-control-rollout.test.mjs`, `docs/background-sources.md`, `docs/project-state.md`, and `docs/project-log.md`.
- Generate six `.webm` and six `.webp` files under `public/chimer/background-previews/`, plus regenerated `index.json` and `components/backgrounds/backgroundPreviewManifest.ts`.

---

## Task 1: Define responsive layout and DNA domain rules

**Files:**

- Create: `lib/background-effect-layout.js`
- Create: `lib/dna-background.js`
- Create: `tests/dna-background.test.mjs`

**Consumes:** Plain numeric Chimer settings and an injected random function.

**Produces:** Sanitized DNA options, duration/delay/phase calculations, setting conversion helpers, random role-index assignments, and viewport-only effective transform bounds.

- [ ] **Step 1: Write failing sanitizer and timing tests**

Cover source defaults, every minimum/maximum, integer strand count, invalid numeric fallback, speed-to-duration conversion, and sine-based phase calculation. Use this public contract:

```js
export const DEFAULT_DNA_BACKGROUND_OPTIONS = Object.freeze({
  strandCount: 13,
  nodeMotionSpeed: 1,
  strandRotationSpeed: 1,
  strandAngle: 30,
  scale: 1,
  positionX: 0,
  positionY: 0,
  strandSpacing: 0.5,
  connectorWidth: 94,
  connectorThickness: 30,
  outlineThickness: 0.5,
});

export function sanitizeDnaBackgroundOptions(value) {}
export function getDnaNodeCycleSeconds(speed) {}
export function getDnaStrandRotationSeconds(speed) {}
export function getDnaStrandDelaySeconds({ oneBasedIndex, total, speed }) {}
export function getDnaStrandPhase({ oneBasedIndex, total }) {}
```

Assert defaults produce `2` and `14` second durations. `getDnaStrandPhase` must calculate with `Math.sin`, not return a CSS `sin()` expression.

Run: `node --test tests/dna-background.test.mjs`

Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Add failing random-assignment and responsive-bound tests**

Define:

```js
export function createDnaNodeRoleAssignments(nodeCount, random = Math.random) {}
export function resolveResponsiveBackgroundTransform({
  scale,
  positionX,
  positionY,
  compactViewport,
}) {}
```

Require two role assignments per strand, values limited to integers `0..3`, deterministic injected randomness, and invalid random results clamped into that range. For the layout helper, use this exact rendering-only rule:

- shortest viewport edge below `480px`: effective scale maximum `1`, X/Y maximum magnitude `20%`;
- otherwise: effective scale maximum `1.2`, X/Y maximum magnitude `35%`.

The helper never changes the stored values passed to it.

`compactViewport` is the shared host signal for `(max-width: 479px), (max-height: 479px)`; the effect components do not install their own viewport listeners.

- [ ] **Step 3: Add failing settings-conversion tests**

Use the exact flat preference keys:

```js
massageLabDnaStrandCount
massageLabDnaNodeMotionSpeed
massageLabDnaStrandRotationSpeed
massageLabDnaStrandAngle
massageLabDnaScale
massageLabDnaPositionX
massageLabDnaPositionY
massageLabDnaStrandSpacing
massageLabDnaConnectorWidth

massageLabDnaConnectorThickness
massageLabDnaOutlineThickness
```

Define and test:

```js
export function getDnaBackgroundOptionsFromChimerSettings(settings) {}
export function toDnaChimerSettingsPatch(patch) {}
```

Require a partial UI patch to emit only corresponding Chimer keys, never colors or derived runtime data.

- [ ] **Step 4: Implement both pure modules with focused JSDoc**

Sanitize with finite-number checks and explicit clamps. Use `2 / speed` and `14 / speed` for durations. Keep both modules DOM-, React-, storage-, account-, and registry-import-free.

- [ ] **Step 5: Run focused tests and commit**

```powershell
node --test tests/dna-background.test.mjs
git add lib/background-effect-layout.js lib/dna-background.js tests/dna-background.test.mjs
git commit -m "feat: define dna background behavior"
```

---

## Task 2: Build the scoped DNA React renderer

**Files:**

- Create: `components/backgrounds/effects/massage-lab-dna-background.tsx`
- Create: `components/backgrounds/effects/massage-lab-dna-background.module.css`
- Create: `tests/dna-background-component.test.mjs`
- Modify: `components/backgrounds/effects/css-backgrounds.tsx`

**Consumes:** Sanitized `MassageLabDnaOptions`, seven named role colors, `reduceMotion`, and the shared responsive layout helper.

**Produces:** One decorative, non-interactive DNA effect root with at most 25 strands and 50 nodes.

- [ ] **Step 1: Write failing type and source-isolation tests**

Add this exact option shape to `BackgroundEffectProps`:

```ts
export interface MassageLabDnaOptions {
  strandCount: number;
  nodeMotionSpeed: number;
  strandRotationSpeed: number;
  strandAngle: number;
  scale: number;
  positionX: number;
  positionY: number;
  strandSpacing: number;
  connectorWidth: number;
  connectorThickness: number;
  outlineThickness: number;
  backgroundColor: string;
  nodeColors: readonly [string, string, string, string];
  connectorColor: string;
  outlineColor: string;
}

export interface BackgroundEffectProps {
  reduceMotion?: boolean;
  compactViewport?: boolean;
  massageLabDna?: MassageLabDnaOptions;
}
```

Test that the component and CSS Module exist, use no iframe/Canvas/WebGL/network/listener APIs, import no billing/account modules, expose no focusable control, and contain no global `body`, `:root`, universal-selector, font, `min-height`, or `touch-action` rule.

Run:


```powershell
node --experimental-strip-types --test tests/dna-background-component.test.mjs
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 2: Implement stable mount-time assignments**

Initialize assignment state from `createDnaNodeRoleAssignments(strandCount * 2)`. Regenerate only when `strandCount` changes; ordinary palette, geometry, position, scale, and speed renders retain the current array. A remount gets a new real-random distribution.

Render this scoped structure:

```tsx
<div className={styles.root} data-reduce-motion={reduceMotion || undefined}>
  <div className={styles.scene} style={sceneStyle}>
    {strands.map((strand) => (
      <span className={styles.strand} style={strand.style} key={strand.index}>
        <span className={styles.connector} />
        <span className={styles.node} data-side="start" />
        <span className={styles.node} data-side="end" />
      </span>
    ))}
  </div>
</div>
```

Pass sine phase, role colors, durations, delay, angle, spacing, connector dimensions, and outline thickness through root/strand CSS variables. Do not place random assignments in persisted settings or component props.

- [ ] **Step 3: Recreate source motion and static representation**

Scope the 2-second opposite node crossover, connector collapse timing, and 14-second whole-strand rotation to the module. At `data-reduce-motion`, pause both animations and set a representative mid-cycle transform while retaining count, angle, spacing, scale, position, geometry, outlines, and current colors.

- [ ] **Step 4: Verify structure and type safety**

```powershell
node --experimental-strip-types --test tests/dna-background-component.test.mjs
npm run typecheck
```

Expected: PASS.


- [ ] **Step 5: Commit**


```powershell
git add components/backgrounds/effects/massage-lab-dna-background.tsx components/backgrounds/effects/massage-lab-dna-background.module.css components/backgrounds/effects/css-backgrounds.tsx tests/dna-background-component.test.mjs
git commit -m "feat: add dna background renderer"
```

---

## Task 3: Define Twisted Cubes domain and gradient rules

**Files:**

- Create: `lib/twisted-cubes-background.js`
- Create: `tests/twisted-cubes-background.test.mjs`
- Modify: `tests/dna-background.test.mjs`

**Consumes:** Plain options, six resolved anchor colors, layer index/count, and the shared responsive layout helper.

**Produces:** Sanitized options, rotation/delay/alpha calculations, source HSL output, piecewise sRGB interpolation, and Chimer-setting conversion.

- [ ] **Step 1: Write failing sanitizer, timing, and alpha tests**

Use this public contract:

```js
export const DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS = Object.freeze({
  layerCount: 20,
  rotationSpeed: 1,
  layerStagger: 0.1,
  viewAngleX: -35,
  viewAngleY: -45,
  scale: 1,
  positionX: 0,
  positionY: 0,
  layerDepthSpacing: 50,
  opacityFalloff: 0.85,
  outlineThickness: 0.0075,
});

export function sanitizeTwistedCubesBackgroundOptions(value) {}
export function getTwistedCubeCycleSeconds(speed) {}
export function getTwistedCubeDelaySeconds({ oneBasedIndex, count, stagger }) {}
export function getTwistedCubeAlpha({ oneBasedIndex, count, opacityFalloff }) {}
```

Require `4 / speed`, default first/last delay parity with the source-normalized `(-(count - 2) + oneBasedIndex) * stagger`, and alpha `clamp(1 - (opacityFalloff / count) * oneBasedIndex, 0, 1)`. At defaults, layer 20 must equal `0.15` within floating-point tolerance.

Run: `node --test tests/twisted-cubes-background.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Write failing source and Custom/Harmony color tests**

Define:

```js
export function getTwistedCubeSourceOutline({ oneBasedIndex, count }) {}
export function interpolateTwistedCubeOutline({ anchors, oneBasedIndex, count }) {}
```

Source mode returns continuous `hsl()` values from 180 through 340 degrees at 80% saturation and 60% lightness. Custom/Harmony must parse six valid hex anchors and perform five-segment piecewise sRGB interpolation. Require layer 1 to equal anchor 1 exactly and the deepest layer to equal anchor 6 exactly; intermediate layers must be smooth rather than repeated bands.

- [ ] **Step 3: Add settings conversion and shared layout tests**

Use these exact flat keys:

```js
massageLabTwistedCubesLayerCount
massageLabTwistedCubesRotationSpeed
massageLabTwistedCubesLayerStagger
massageLabTwistedCubesViewAngleX
massageLabTwistedCubesViewAngleY
massageLabTwistedCubesScale
massageLabTwistedCubesPositionX
massageLabTwistedCubesPositionY
massageLabTwistedCubesLayerDepthSpacing
massageLabTwistedCubesOpacityFalloff
massageLabTwistedCubesOutlineThickness
```

Define `getTwistedCubesBackgroundOptionsFromChimerSettings` and `toTwistedCubesChimerSettingsPatch`. Reuse `resolveResponsiveBackgroundTransform`; do not duplicate viewport rules.

- [ ] **Step 4: Implement the pure module and run tests**

Clamp all approved ranges, round count, handle malformed colors with adapter-provided source anchors, and keep calculated colors/alpha out of persistence.

```powershell
node --test tests/dna-background.test.mjs tests/twisted-cubes-background.test.mjs
git add lib/twisted-cubes-background.js tests/twisted-cubes-background.test.mjs tests/dna-background.test.mjs
git commit -m "feat: define twisted cubes behavior"
```

---

## Task 4: Build the scoped Twisted Cubes React renderer

**Files:**

- Create: `components/backgrounds/effects/massage-lab-twisted-cubes-background.tsx`
- Create: `components/backgrounds/effects/massage-lab-twisted-cubes-background.module.css`
- Create: `tests/twisted-cubes-background-component.test.mjs`
- Modify: `components/backgrounds/effects/css-backgrounds.tsx`

**Consumes:** Sanitized `MassageLabTwistedCubesOptions`, palette mode, one background color, six outline anchors, and `reduceMotion`.

**Produces:** One decorative 3D CSS scene with at most 30 layers and 180 faces.

- [ ] **Step 1: Write failing type, structure, and isolation tests**

Add this option type:

```ts
export interface MassageLabTwistedCubesOptions {
  layerCount: number;
  rotationSpeed: number;
  layerStagger: number;
  viewAngleX: number;
  viewAngleY: number;
  scale: number;
  positionX: number;
  positionY: number;
  layerDepthSpacing: number;
  opacityFalloff: number;
  outlineThickness: number;
  paletteMode: "source" | "resolved";
  backgroundColor: string;
  outlineAnchors: readonly [string, string, string, string, string, string];
}
```

Require scoped CSS only, no pointer/touch/cursor listeners or drag state, no iframe/Canvas/WebGL/runtime request, and exactly six face elements per generated layer.

Run: `node --experimental-strip-types --test tests/twisted-cubes-background-component.test.mjs`

Expected: FAIL because the renderer does not exist.

- [ ] **Step 2: Implement calculated per-layer variables**

Generate one wrapper/cube/cuboid plus six faces per sanitized layer. For each layer, choose `getTwistedCubeSourceOutline` when `paletteMode === "source"`; otherwise call `interpolateTwistedCubeOutline`. Pass outline color, alpha, negative delay, depth, and relative outline thickness as CSS variables.

- [ ] **Step 3: Recreate source 3D motion and static state**

Scope the four-stage X/Y/Z source rotation and cubic-bezier timing. Apply X/Y viewing angle, scene scale, X/Y position, depth spacing, face fill, falloff, and outline thickness independently. At reduced motion, pause animation at a representative middle phase while retaining every configured property and the resolved gradient.

- [ ] **Step 4: Run focused tests and commit**

```powershell
node --experimental-strip-types --test tests/twisted-cubes-background-component.test.mjs
npm run typecheck
git add components/backgrounds/effects/massage-lab-twisted-cubes-background.tsx components/backgrounds/effects/massage-lab-twisted-cubes-background.module.css components/backgrounds/effects/css-backgrounds.tsx tests/twisted-cubes-background-component.test.mjs
git commit -m "feat: add twisted cubes renderer"
```

---

## Task 5: Integrate settings, registries, palette adapters, and access

**Files:**

- Modify: `lib/chimer-timer.js`
- Modify: `components/backgrounds/backgroundRegistry.ts`
- Modify: `components/backgrounds/backgroundPaletteRegistry.ts`
- Modify: `components/backgrounds/resolveBackgroundEffectProps.ts`
- Modify: `components/backgrounds/effects/css-backgrounds.tsx`
- Modify: `tests/chimer-timer.test.mjs`
- Modify: `tests/background-options.test.mjs`
- Modify: `tests/background-palette-registry.test.mjs`
- Modify: `tests/chimer-entitlements.test.mjs`

**Consumes:** Landed Track 1 access metadata, Track 4A's adapter contract, flat Chimer property keys, and both lazy component loaders.

**Produces:** Two enabled premium definitions and exhaustive palette/property adapters without new ownership or color state.

- [ ] **Step 1: Add failing setting and registry tests**

Add all 22 keys from Tasks 1 and 3 to `DEFAULT_CHIMER_SETTINGS` and `sanitizeChimerSettings`. Assert exact source defaults and approved clamps. Add stable IDs to `BackgroundId`:

```ts
| "massage-lab-dna"
| "massage-lab-twisted-cubes"
```

Require both definitions to be enabled, premium, MIT verified, medium motion/cost, and in `chimer`, `clock`, `music`, and `ambient`. Require lazy loaders to point directly to the new modules.

Run:

```powershell
node --experimental-strip-types --test tests/background-options.test.mjs tests/background-palette-registry.test.mjs
node --test tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs
```

Expected: FAIL because the settings and registry definitions are absent.

- [ ] **Step 2: Add the DNA adapter**

Declare exactly these roles and zero-based swatch indexes:

```ts
[
  { id: "background", label: "Background", sourceColor: "hsl(210 80% 12%)", defaultSwatch: 3 },
  { id: "node-one", label: "Node 1", sourceColor: "hsl(44 98% 60%)", defaultSwatch: 0 },
  { id: "node-two", label: "Node 2", sourceColor: "hsl(197 50% 44%)", defaultSwatch: 1 },
  { id: "node-three", label: "Node 3", sourceColor: "hsl(300 100% 100%)", defaultSwatch: 2 },
  { id: "node-four", label: "Node 4", sourceColor: "hsl(331 76% 50%)", defaultSwatch: 5 },
  { id: "connector", label: "Connector", sourceColor: "#ffffff", defaultSwatch: 4 },
  { id: "outline", label: "Outline", sourceColor: "#000000", defaultSwatch: 6 },
]
```

Set renderer family `css-dom`, status `supported`, and source behavior `fixed`. List all 11 DNA setting keys in `visualPropertyKeys` and source defaults in `sourceVisualProperties`. `applyRoleColors` must update only `massageLabDna` colors and preserve its non-color options.

- [ ] **Step 3: Add the Twisted Cubes adapter**

Declare Background plus `outline-one` through `outline-six`, mapping Background to Swatch 4 and outlines to Swatches 1, 2, 3, 5, 6, 7. Use source-derived anchors at 180, 212, 244, 276, 308, and 340 degrees for labels/fallbacks.

Set `sourceBehavior: "automatic"`. In Source, `resolveBackgroundEffectProps` leaves `paletteMode: "source"` so the renderer uses the continuous HSL formula. In Custom/Harmony, `applyRoleColors` sets `paletteMode: "resolved"` and supplies all six resolved anchors. Never persist intermediate colors.

- [ ] **Step 4: Add static-capable reduced-motion metadata**

Extend `BackgroundDefinition` with:

```ts
supportsReducedMotionStatic?: boolean;
```

Set it `true` for both new definitions. This metadata is only a host lifecycle capability; it does not alter access, motion preference, or registry category behavior.

- [ ] **Step 5: Verify access and resolver behavior**

Use Track 1/4A's canonical resolver. Test subscriber access, permanent ownership after cancellation, refund/chargeback ownership removal, locked background fallback, `chimer_custom_colors`, ownership-based color customization, and Source-only effective mode without customization access. Do not add any component-side access branch.

- [ ] **Step 6: Run focused tests and commit**

```powershell
node --experimental-strip-types --test tests/background-options.test.mjs tests/background-palette-registry.test.mjs
node --test tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs
npm run typecheck
git add lib/chimer-timer.js components/backgrounds/backgroundRegistry.ts components/backgrounds/backgroundPaletteRegistry.ts components/backgrounds/resolveBackgroundEffectProps.ts components/backgrounds/effects/css-backgrounds.tsx tests/chimer-timer.test.mjs tests/background-options.test.mjs tests/background-palette-registry.test.mjs tests/chimer-entitlements.test.mjs
git commit -m "feat: register dna and twisted cubes backgrounds"
```

---

## Task 6: Wire draft-aware Visual controls and shared rendering contexts

**Files:**

- Create: `components/chimer-controls/DnaBackgroundControls.tsx`
- Create: `components/chimer-controls/TwistedCubesBackgroundControls.tsx`
- Modify: `app/chimer/page.tsx`
- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/running-timer.module.css`
- Modify: `components/backgrounds/BackgroundHost.tsx`
- Modify: `tests/sitewide-control-rollout.test.mjs`
- Modify: `tests/background-visual-draft.test.mjs`
- Modify: `tests/background-palette-sync.test.mjs`

**Consumes:** Track 2's single active Visual panel and mode-aware immersive display, Track 4A's selected-background draft dispatcher, committed Chimer settings, and the adapters from Task 5.

**Produces:** Slider-only grouped controls and one shared live configuration in every immersive context.

- [ ] **Step 1: Write failing Visual-control and draft tests**

Require controls only when their matching background is selected. Every slider emits a partial property patch to the Track 4A draft; it never calls local storage or the account API. Require Undo/Redo, Reset visual properties, Apply, Cancel, preset save/apply, default Visual preset, dirty guard, and selection guard to include all new keys.

Require these exact control groups and ranges:

| DNA group | Controls |
| --- | --- |
| Motion | Node motion speed `0.25..3 step .05`; Strand rotation speed `0.1..3 step .05` |
| Geometry | Strand count `7..25 step 1`; angle `-180..180 step 1`; spacing `0..2 step .05` |
| Position and scale | scale `.4..1.2 step .01`; X/Y `-35..35 step 1` |
| Connector | width `60..100 step 1`; thickness `10..60 step 1` |
| Outline | thickness `0..1.5 step .05` |

| Twisted Cubes group | Controls |
| --- | --- |
| Motion | Rotation speed `.25..3 step .05`; Layer stagger `0..0.3 step .01` |
| View angles | X/Y `-80..80 step 1` |
| Geometry and depth | Layer count `6..30 step 1`; depth `10..70 step 1` |
| Position and scale | scale `.4..1.2 step .01`; X/Y `-35..35 step 1` |
| Fade | falloff `0..0.95 step .01` |
| Outline | relative thickness `.0025..0.02 step .0005` |

Run:

```powershell
node --test tests/background-visual-draft.test.mjs tests/background-palette-sync.test.mjs tests/sitewide-control-rollout.test.mjs
```

Expected: FAIL because the new controls and properties are not wired.

- [ ] **Step 2: Build the two adaptive control groups**

Use `StyledRangeControl` for every value; do not add number inputs, drag surfaces, or shuffle. Format speed as `1.00x`, angle as degrees, position/connector as percentages, spacing/depth as `vmin`, scale as percent, and Twisted outline as a relative percent. Keep the existing control arrangement and Track 4A shared Colors/preset sections.

Use one component contract for each:

```ts
interface BackgroundPropertyControlsProps<TOptions> {
  value: TOptions;
  disabled?: boolean;
  onChange: (patch: Partial<TOptions>) => void;
}
```

- [ ] **Step 3: Pass compact option objects through every host**

`ChimerPage` keeps committed settings. `RunningTimer` derives DNA/Twisted option objects from committed or current Visual draft values and passes them to `BackgroundHost`. Ordinary Clock and Music visualizer reuse the same conversion path; no route-specific copies or music-background preference are introduced.

The two new option objects are the only new `BackgroundEffectProps` entries. Do not add 22 individual host props.

- [ ] **Step 4: Mount static-capable effects under reduced motion**

Add one `matchMedia("(max-width: 479px), (max-height: 479px)")` subscription in `BackgroundHost` and pass its boolean as `compactViewport`. Both effects use the shared pure helper to derive effective scale/X/Y; neither effect owns a resize or media-query listener.

Change the host lifecycle to:

```ts
const shouldLoadEffect = Boolean(
  entry.component &&
    (!reduceMotion || entry.motionIntensity === "static" || entry.supportsReducedMotionStatic),
);
```

Pass `reduceMotion` in resolved effect props. Both renderers pause internally, while other animated backgrounds keep the existing fallback behavior.

- [ ] **Step 5: Verify persistence and context sharing**

Test local/account Apply, save retry, presets, invalid-value sanitization, cancellation retention, Chimer-to-Clock navigation, ordinary Clock, and `/clock?source=music`. Assert DNA random assignments and Twisted derived colors/alpha never enter the payload.

- [ ] **Step 6: Run focused tests and commit**

```powershell
node --test tests/background-visual-draft.test.mjs tests/background-palette-sync.test.mjs tests/sitewide-control-rollout.test.mjs
npm run typecheck
git add components/chimer-controls/DnaBackgroundControls.tsx components/chimer-controls/TwistedCubesBackgroundControls.tsx app/chimer/page.tsx app/chimer/running-timer.tsx app/chimer/running-timer.module.css components/backgrounds/BackgroundHost.tsx tests/sitewide-control-rollout.test.mjs tests/background-visual-draft.test.mjs tests/background-palette-sync.test.mjs
git commit -m "feat: add dna and cubes visual controls"
```

---

## Task 7: Add generated posters and preview-media fallback rendering

**Files:**

- Modify: `scripts/chimer-preview-generation/render.mjs`
- Modify: `scripts/chimer-preview-generation/manifest.mjs`
- Modify: `components/backgrounds/backgroundPreviewManifest.ts` (generated)
- Modify: `components/backgrounds/backgroundRegistry.ts`
- Create: `components/backgrounds/BackgroundPreviewMedia.tsx`
- Modify: `components/backgrounds/BackgroundSelector.tsx`
- Create: `tests/background-preview-media.test.mjs`
- Modify: `tests/background-options.test.mjs`
- Modify: `docs/background-sources.md`
- Generate: `public/chimer/background-previews/massage-lab-dna*.webm`
- Generate: `public/chimer/background-previews/massage-lab-dna*.webp`
- Generate: `public/chimer/background-previews/massage-lab-twisted-cubes*.webm`
- Generate: `public/chimer/background-previews/massage-lab-twisted-cubes*.webp`
- Modify: `public/chimer/background-previews/index.json` (generated)

**Consumes:** Existing Playwright/FFmpeg preview recording, the two enabled registry entries, and the existing landscape/square/vertical variants.

**Produces:** Short looping videos, matching WebP posters, typed manifest URLs/hashes, and a reusable fallback-safe card renderer.

- [ ] **Step 1: Write failing manifest and preview-component tests**

Extend variant and entry types with poster fields:

```ts
export type BackgroundPreviewVariant = {
  previewMediaUrl: string;
  previewPosterUrl?: string;
  posterBytes?: number;
  posterSha256?: string;
  // existing dimensions, duration, fps, bytes, and sha256
};

export type BackgroundPreviewManifestEntry = {
  previewImageUrl?: string;
  previewSquareImageUrl?: string;
  previewVerticalImageUrl?: string;
  // existing video and variant fields
};
```

Extend `BackgroundDefinition` and its manifest merge with square/vertical image fields, and use `preview.previewImageUrl` as the primary poster even though the primary media type remains `video`.

Require URL-base resolution for posters, matching dimensions, nonzero byte counts, SHA-256 values for both formats, and manifest regeneration without rendering. Require `BackgroundPreviewMedia` to prefer video, set the WebP as `poster`, remain muted/looping/inline/decorative, and show registry `fallbackStyle` when neither asset loads.

Run: `node --experimental-strip-types --test tests/background-preview-media.test.mjs tests/background-options.test.mjs`

Expected: FAIL because poster fields and the media component do not exist.

- [ ] **Step 2: Extend render and manifest generation**

After each WebM encode, extract a representative frame at one-third of the clip:

```js
async function encodePoster(videoPath, posterPath, durationMs) {
  await runProcess("ffmpeg", [
    "-y",
    "-ss", (durationMs / 3000).toFixed(3),
    "-i", videoPath,
    "-frames:v", "1",
    "-c:v", "libwebp",
    "-quality", "78",
    posterPath,
  ]);
}
```

Use matching suffixes: `.webp`, `-square.webp`, and `-vertical.webp`. If a WebM already exists without `--force`, generate its missing poster rather than skipping the variant. `manifest.mjs` must discover and hash both asset types.

- [ ] **Step 3: Render media in picker cards**

Use `BackgroundPreviewMedia` in selected and rail cards. Choose the registry's aspect-appropriate video/poster fields, set `preload="metadata"`, and preserve the existing fallback gradient behind media. Follow Track 6's active-card policy: selected/active cards may play, while inactive and offscreen cards show their poster rather than autoplaying every video.

- [ ] **Step 4: Generate and validate assets**

```powershell
npm run chimer:preview:render -- --ids massage-lab-dna,massage-lab-twisted-cubes --force
npm run chimer:preview:manifest
node --experimental-strip-types --test tests/background-preview-media.test.mjs tests/background-options.test.mjs
```

Expected: six WebM files, six WebP files, two manifest entries with three variants each, and passing tests.

- [ ] **Step 5: Update the source ledger**

Record both CodePen URLs, Jhey, MIT verified, 2026 copyright, archive name, enabled premium internal-app use, React/CSS adaptation, Track 4A palette integration, and generated video/poster status. Do not expose the attached archives.

- [ ] **Step 6: Commit generated assets and workflow**

```powershell
git add scripts/chimer-preview-generation/render.mjs scripts/chimer-preview-generation/manifest.mjs components/backgrounds/backgroundPreviewManifest.ts components/backgrounds/backgroundRegistry.ts components/backgrounds/BackgroundPreviewMedia.tsx components/backgrounds/BackgroundSelector.tsx tests/background-preview-media.test.mjs tests/background-options.test.mjs docs/background-sources.md public/chimer/background-previews/index.json public/chimer/background-previews/massage-lab-dna.webm public/chimer/background-previews/massage-lab-dna-square.webm public/chimer/background-previews/massage-lab-dna-vertical.webm public/chimer/background-previews/massage-lab-dna.webp public/chimer/background-previews/massage-lab-dna-square.webp public/chimer/background-previews/massage-lab-dna-vertical.webp public/chimer/background-previews/massage-lab-twisted-cubes.webm public/chimer/background-previews/massage-lab-twisted-cubes-square.webm public/chimer/background-previews/massage-lab-twisted-cubes-vertical.webm public/chimer/background-previews/massage-lab-twisted-cubes.webp public/chimer/background-previews/massage-lab-twisted-cubes-square.webp public/chimer/background-previews/massage-lab-twisted-cubes-vertical.webp
git commit -m "feat: add dna and cubes preview media"
```

---

## Task 8: Add development review and browser/performance coverage

**Files:**

- Modify: `app/dev/buttons/background-palette-gallery.tsx`
- Modify: `app/dev/buttons/page.tsx`
- Modify: `tests/sitewide-control-rollout.test.mjs`
- Create: `tests/browser/dna-twisted-cubes-backgrounds.spec.ts`

**Consumes:** Real adapters, controls, `BackgroundHost`, generated previews, and the development-only `/dev/buttons` guard.

**Produces:** One reviewable gallery and automated coverage for defaults, palette modes, motion, responsiveness, access, and lifecycle.

- [ ] **Step 1: Add failing development-gallery tests**

Require DNA and Twisted Cubes specimens in Source, Custom, Harmony, reduced motion, compact viewport, access-locked, draft-dirty, and applied states. Use the real controls and host; do not create test-only renderers or a production access bypass.

- [ ] **Step 2: Build review specimens**

Show source-default and edited-property cases, all seven dynamic role labels, smooth Twisted anchor interpolation, and preview video/poster behavior. Keep the route development-only. DNA's live specimens use production randomness; deterministic assignment assertions stay in the injected pure-helper tests.

- [ ] **Step 3: Write Playwright acceptance tests**

Cover desktop, phone portrait, short landscape, 200% zoom, and reduced motion. Assert:

- source defaults mount without unexpected fallback or console/page errors;
- DNA role assignments stay stable across palette/property edits and change after count change/remount;
- Custom/Harmony recolor DNA without reshuffling;
- Twisted Source is continuous HSL while Custom/Harmony uses exact endpoint anchors and smooth intermediate colors;
- every slider updates the live draft, Undo/Redo works, Cancel restores, and Apply persists;
- Visual presets retain all non-color keys, while Color presets remain separate;
- responsive clamps affect only rendered transforms;
- static reduced-motion representations retain saved geometry/colors;
- no pointer drag, shuffle, focusable effect surface, or unexpected horizontal overflow;
- subscribers and permanent owners can use the backgrounds, while inaccessible users get the canonical locked flow;
- switching among Chimer, Clock, and Music visualizer keeps the same configuration; and
- unmount removes effect DOM and animations without disrupting timer or audio state.

- [ ] **Step 4: Add bounded-DOM and lifecycle checks**

Require at most 25 DNA strands/50 nodes and 30 Twisted layers/180 faces. During repeated property edits, assert only the selected effect remains mounted and no document/window/listener/animation-frame API is introduced by either component.

- [ ] **Step 5: Run review tests and commit**

```powershell
node --test tests/sitewide-control-rollout.test.mjs
npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts
git add app/dev/buttons/background-palette-gallery.tsx app/dev/buttons/page.tsx tests/sitewide-control-rollout.test.mjs tests/browser/dna-twisted-cubes-backgrounds.spec.ts
git commit -m "test: add dna and cubes review coverage"
```

---

## Task 9: Complete source comparison, full validation, and canonical docs

**Files:**

- Modify: implementation/test files only for still-valid findings
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Consumes:** The complete Track 4B branch and both attached source archives.

**Produces:** A validated, documented, merge-ready branch with source parity and no Track 4B Roadmap entry.

- [ ] **Step 1: Perform source-default comparison**

Run the supplied archives locally and compare DNA crossover geometry, phase, connector collapse, strand rotation, default composition, and Twisted four-stage 3D rotation, default angles, delay, depth, fade, face fill, and hue progression. Fix only deviations from the approved adaptation; document intentional responsive/static differences.

- [ ] **Step 2: Run the complete automated gate**

```powershell
node --test tests/dna-background.test.mjs tests/twisted-cubes-background.test.mjs tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs tests/background-visual-draft.test.mjs tests/background-palette-sync.test.mjs tests/sitewide-control-rollout.test.mjs
node --experimental-strip-types --test tests/dna-background-component.test.mjs tests/twisted-cubes-background-component.test.mjs tests/background-preview-media.test.mjs tests/background-options.test.mjs tests/background-palette-registry.test.mjs
npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts tests/browser/background-palette.spec.ts
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

Expected: every command passes; no console errors, unexpected fallback, pending palette adapter, missing poster, or unbounded value remains.

- [ ] **Step 3: Perform manual acceptance review**

Review `/dev/buttons`, active Chimer, ordinary `/clock`, `/clock?source=music`, and the Background picker at desktop, phone portrait, short landscape, 200% zoom, and reduced motion. Verify source defaults, both palette modes, dynamic labels/mapping, all sliders, draft actions, separate preset types, responsive bounds, preview posters, access states, and context sharing.

- [ ] **Step 4: Update canonical documentation**

Update `docs/project-state.md` with both enabled premium backgrounds, IDs, ownership/color-access behavior, shared settings, reduced-motion support, and preview assets. Append `docs/project-log.md` with source/license evidence, implementation commits, source comparison, validation results, and any intentional limitations. Do not modify `docs/roadmap.md` or `TODO.md`.

- [ ] **Step 5: Commit final documentation and fixes**

```powershell
git add docs/project-state.md docs/project-log.md
git commit -m "docs: record dna and twisted cubes rollout"
```

Before committing, verify `git status --short` still contains the user-owned `TODO.md` modification and `git diff --cached --name-only` does not.

---

## Final Acceptance Checklist

- DNA and Twisted Cubes are enabled premium backgrounds in Chimer, Clock, Music, and ambient categories.
- Both use native React plus scoped CSS Modules and add no runtime dependency, iframe, Canvas, WebGL, pointer drag, or shuffle action.
- Source colors and source property values remain visible until edited.
- DNA renders 7-25 strands, keeps mount-stable random four-role node assignment, uses React sine phases, and exposes separate node/strand speeds.
- Twisted Cubes renders 6-30 layers, preserves continuous Source HSL, smoothly interpolates six Custom/Harmony anchors, and exposes separate speed/stagger.
- Both support bounded scale/X/Y controls without mutating stored values.
- Track 4A owns every color, role mapping, draft, Undo/Redo, Apply/Cancel, Color preset, and Visual preset behavior; no duplicate color fields exist.
- One sanitized non-color configuration is shared across active Chimer, Clock, Music visualizer, and ambient hosts.
- Subscription and permanent ownership use the canonical access resolver; refund/chargeback revocation removes ownership access without deleting sanitized preferences.
- Reduced motion mounts representative static states only for these explicitly capable effects.
- Three video and three WebP poster variants exist for each background and resolve through the generated manifest.
- The picker uses posters as video fallbacks and preserves registry fallback styling when media fails.
- The source ledger records both verified MIT sources and adaptation details.
- Focused tests, exhaustive palette tests, browser tests, lint, typecheck, full tests, build, and diff check pass.
- `TODO.md` remains untouched by every Track 4B commit, and no public Roadmap entry is added.
