# Task 8 implementer report: development review and browser/performance coverage

## Scope and base

- Worktree: `C:\tmp\massagelab-track4b-dna-twisted-cubes`
- Branch: `codex/track4b-dna-twisted-cubes`
- Exact base: `4971109bdd598f7afa719af8e52aa388c80283b4`
- Commit message: `test: add dna and cubes review coverage`
- Commit hash: recorded by `git rev-parse HEAD` in the final implementer handoff because this report is part of that commit.

The primary checkout was read only. Package/lock files, Prisma sources, `docs/roadmap.md`, and `TODO.md` were not changed. No media was uploaded and no external mutation was performed.

## RED evidence

The first focused run after adding the Task 8 source contract was:

```text
node --test tests/sitewide-control-rollout.test.mjs
14 passed, 1 failed
ENOENT: tests/browser/dna-twisted-cubes-backgrounds.spec.ts
```

This established that the existing development gallery did not yet provide the dedicated Track 4B browser contract.

## Implementation and architecture reconciliation

- Extended the existing development-only `BackgroundPaletteGallery`; no new route or production access bypass was added.
- Left `app/dev/buttons/page.tsx` unchanged because it already guards `/dev/buttons` in production and already mounts the Background palettes tab.
- Added one selected-effect Track 4B review fixture using the production `DnaBackgroundControls`, `TwistedCubesBackgroundControls`, `BackgroundPaletteEditor`, `BackgroundHost`, palette adapters, option sanitizers, Host category resolver, and canonical Visual draft reducer/commit builder.
- Added Source, Custom, Harmony, reduced-motion, compact-viewport, subscriber, permanent-owner, locked, dirty, and applied review states. Dynamic role labels and resolved role colors come from the selected real adapter.
- Added generated vertical poster/video specimens for DNA and Twisted Cubes through `backgroundPreviewManifest` and `BackgroundPreviewMedia`. The existing full poster/playback/fallback/cleanup review remains mounted below it.
- Added shared Chimer/Clock/Music configuration outputs from the production category resolver and retained the existing production Music continuity probe.
- Extended `playwright.config.ts` and its browser-harness source contract so either exact development-only palette spec starts the development server; ordinary production QA ignores both.
- Added a dedicated deterministic Playwright suite that inspects real DOM and CSS custom properties rather than screenshots or test-only renderers.

### Accessibility finding and fix

The first browser run proved that the real Track 4B sliders were keyboard-operable but unnamed in the browser accessibility tree. `RangeControl` supplied `aria-labelledby` and `aria-describedby` to the Radix Slider root, while `SliderPrimitive.Thumb` owned the `slider` role. The thumb therefore exposed no accessible name.

`components/ui/slider.tsx` now forwards `aria-label`, `aria-labelledby`, and `aria-describedby` to the real thumb. The browser suite uses semantic role/name locators after this fix, and the focused source contract prevents regression. This shared-primitive change is intentionally broader than the gallery because it fixes the actual control authority used by all 22 new DNA/Twisted sliders.

## Browser matrix and results

Original implementation-round exact command at `abf4bfaf`:

```text
npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts
14 passed (desktop-chromium and mobile-chromium)
```

Coverage proves:

- source defaults load without fallback, page errors, or console errors;
- DNA transient role assignments remain stable across palette/property edits and refresh after count change/remount;
- Custom and Harmony recolor DNA without reshuffling;
- Twisted Source produces 20 unique continuous HSL values, while Custom/Harmony retain exact endpoint anchors and smooth RGB intermediates;
- all 11 sliders per selected background update the live draft;
- Undo, Redo, Cancel, Apply, Visual preset, and Color preset boundaries follow the canonical reducer, with Apply written to a development-only persistence key;
- stored scale/X/Y values remain unchanged while compact rendering clamps to `1` and `20%`;
- reduced motion retains geometry/colors while computed effect animation is `none`;
- DNA remains at or below 25 strands/50 nodes and Twisted at or below 30 layers/180 faces;
- only the selected Track 4B effect remains mounted; neither effect owns document/window/listener/RAF APIs;
- no shuffle action, pointer-drag affordance, focusable effect surface, or horizontal overflow appears;
- subscriber and permanent-owner snapshots load the requested effect, while locked access follows the canonical fallback and disables controls;
- Chimer, Clock, and Music resolve identical non-color configuration;
- switching/unmounting effects removes their DOM while the real Music session id and elapsed playback continue;
- both generated vertical posters and videos resolve through the production preview component.

The first complete matrix was 11/12 because mobile read the Music session id before the existing 500 ms diagnostics interval published it. The final test waits for the numeric session id before asserting identity; it does not relax continuity behavior.

## Validation

- `node --test tests/sitewide-control-rollout.test.mjs`: 15/15 passed.
- `node --test tests/browser-qa-harness.test.mjs tests/sitewide-control-rollout.test.mjs`: 16/16 passed.
- `npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts`: 14/14 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed. ESLint emitted only Babel's informational large-file note for the pre-existing `app/chimer/running-timer.tsx`.
- `npm run test`: 1,857/1,857 passed after updating the browser-harness inventory assertion.
- `npm run build`: passed; Next compiled, typechecked, and generated 101 pages. The standard prebuild Prisma client generation changed no tracked Prisma or package files.
- `git diff --check`: passed.

## Preservation checks

- Isolated-worktree `TODO.md` SHA-256 before/after: `034BE9755BE897094EA6E1229D0E7C662BF32C2A27AE917E8A5A7FCE890CE51C`.
- Primary-checkout `TODO.md` SHA-256 before/after: `C2DBD02A98631A6653DD5F1111EC030FDF00BC353B5A19B81AFFC7548811CDD5`.
- Final diff contains no package/lock, Prisma, Roadmap, TODO, generated media, or primary-checkout files.

## Self-review and concerns

- Review fixture persistence is deliberately namespaced to `massage-lab:dev:track-4b-review-applied`; it cannot create a production access or storage bypass.
- Production randomness remains in live DNA specimens. Deterministic role-generation assertions remain in the existing injected pure-helper tests; browser comparisons only require the production stability contract.
- Tone printed expected development-server warnings before user activation. The test then starts playback from a real button action, observes a running audio context, and verifies session continuity; captured page and console-error arrays remain empty.
- No remaining Task 8 blocker was known at the original `abf4bfaf` implementation-round handoff; Fix Rounds 1–4 below supersede that historical status.

## Fix Round 1

Task 8 was reviewed again from commit `abf4bfaf4fd3da5dc19451e4906f1299956cb62b`. The follow-up keeps the same development-only route and production adapters while closing five acceptance-evidence gaps:

- DNA assignment refresh now waits for the post-effect replacement after a count change, compares overlapping assignments, returns to the original count, captures the settled equal-length array, and compares it with a fresh equal-length remount.
- The slider, rendered-output, responsive/reduced-motion, and subscriber/owner/locked matrices now run for both DNA and Twisted Cubes. Each effect exposes exactly 11 independently named real sliders and is checked for its actual CSS variables, motion/static state, colors, and bounded DOM geometry.
- Selecting either effect creates a fresh canonical Visual draft and opening snapshot. Twisted Cubes now has direct Apply, post-Apply edit, and Cancel restoration proof, so switching from DNA cannot leave an incompatible opening snapshot.
- Harmony expectations are derived through `resolveBackgroundRoleColors` with the selected real adapter, palette, and mapping. DNA renderer variables must equal those resolved roles without changing assignments; Twisted endpoints and every intermediate must equal `interpolateTwistedCubeOutline` over the resolved anchors.
- The 200% check uses Chromium CDP `Emulation.setPageScaleFactor`, verifies `visualViewport.scale`, focused-slider containment, and horizontal layout, and restores page scale in `finally`.

The redundant `aria-label` passed by `ColorSlider` was removed. Browser coverage now proves the Radix Thumb owns the accessible name/description, the Slider Root has no duplicate naming attributes, and raw Slider, `RangeControl`, and `ColorSlider` specimens expose the expected accessible text.

### Fix Round 1 validation

- `node --test tests/sitewide-control-rollout.test.mjs`: 15/15 passed.
- `node --test tests/browser-qa-harness.test.mjs tests/sitewide-control-rollout.test.mjs`: 16/16 passed.
- `npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts --project=desktop-chromium`: 8/8 passed.
- `npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts --project=mobile-chromium`: 8/8 passed.
- Sensitive-case repeat (`DNA assignments|200% page scale`, `--repeat-each=3`): 12/12 passed across desktop and mobile.
- `npm run typecheck`: passed.
- `npm run lint`: passed with only Babel's existing large-file informational note for `app/chimer/running-timer.tsx`.
- `npm run test`: 1,857/1,857 passed.
- `npm run build`: passed; Next compiled, typechecked, and generated 101 pages. Prebuild Prisma generation changed no tracked Prisma or package files.
- `git diff --check`: passed.

The fix-round diff contains no package/lock, Prisma, roadmap, TODO, generated-media, or primary-checkout files. The isolated `TODO.md` SHA-256 remains `034BE9755BE897094EA6E1229D0E7C662BF32C2A27AE917E8A5A7FCE890CE51C`. No push was performed.

## Fix Round 2

Task 8 was reviewed again from commit `f891b97fdd056682622c86b85625161a04f23745`. The remaining gap was acceptance evidence: the prior per-slider loop proved only that the aggregate property JSON changed, while the renderer helper proved only that variables were nonempty.

### Authoritative terminology reconciliation

The review request named geometry models that are not present in this branch's production contracts (`strandLength`, `nodeSize`, `nodeSpacing`, `tilt`, `phaseOffset`, `twistAngle`, `cubeSize`, and adjustable `perspective`). Repository search confirmed that adding those names would invent a second product model. Per the real-gallery/real-Host constraint, Fix Round 2 instead covers the authoritative 11 controls currently exported by each production control component:

- DNA: node motion speed, strand rotation speed, strand count, strand angle, strand spacing, scale, position X/Y, connector width/thickness, and outline thickness.
- Twisted Cubes: rotation speed, layer stagger, view angle X/Y, layer count, layer depth spacing, scale, position X/Y, opacity falloff, and relative outline thickness.

No production option, control, sanitizer, renderer, or CSS behavior was changed.

### Exact renderer evidence

- Every accessible control name is explicitly mapped to its one canonical flat Chimer settings key.
- Each isolated `ArrowRight` edit must change exactly that key, and its value must equal the real slider thumb's `aria-valuenow`.
- The intended production CSS variable or DOM count must equal the value produced by the real domain helper and unit conversion. DNA coverage includes node-cycle duration/delay, strand rotation, count/phase/rest scale, angle/spacing, responsive transform, connector half-width derivations, thickness, and outline. Twisted coverage includes cycle, stagger delay, view angles, layer count, depth, responsive transform, alpha falloff, and outline thickness.
- A per-key allowlist identifies documented coupled renderer derivations. All other captured renderer sentinels, including resolved colors, must remain unchanged.
- Cancel resets every isolated edit before the next control; canonical Undo/Redo/Cancel/Apply and Twisted Apply-then-Cancel proof remain covered.

The reduced-motion matrix now pushes all 11 settings for the selected effect to their exact upper bounds, then checks saved settings without responsive mutation. Across desktop, phone portrait, short landscape, and real CDP 200% page scale, it verifies:

- exact adapter/palette-resolver Harmony colors;
- every DNA root/scene/strand geometry and timing variable, strand/node counts, and static strand/connector/node animations;
- every Twisted root/scene/layer outline, alpha, delay, depth, thickness, face count, and static cube animation;
- production compact clamps only for scale and position, derived through the real responsive transform helper.

### Fix Round 2 validation

- `node --test tests/browser-qa-harness.test.mjs tests/sitewide-control-rollout.test.mjs`: 16/16 passed.
- `npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts --project=desktop-chromium`: 8/8 passed.
- `npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts --project=mobile-chromium`: 8/8 passed.
- Sensitive exact-render/reduced-state repeat with `--repeat-each=3 --workers=2`: 12/12 passed across desktop and mobile in 2.9 minutes.
- `npm run typecheck`: passed.
- `npm run lint`: passed with only Babel's existing large-file informational note for `app/chimer/running-timer.tsx`.
- `npm run test`: 1,857/1,857 passed.
- `npm run build`: passed; Next compiled, typechecked, and generated 101 pages. Prebuild Prisma generation changed no tracked Prisma or package files.
- `git diff --check`: passed.

The first stress attempt used six concurrent workers with the original 60-second case timeout. All reduced-state repeats and all mobile exact-render repeats passed, while three desktop exact-render cases timed out near the final Undo/Redo interaction under dev-server contention. The exhaustive exact-render case now has a 120-second budget; the bounded two-worker repeat above passed without assertion or timeout failures.

The Fix Round 2 diff contains only the dedicated browser suite, its focused source contract, and this report. Package/lock, Prisma, roadmap, TODO, generated-media, production behavior, and primary-checkout files remain unchanged. Both isolated and primary `TODO.md` SHA-256 values remain `034BE9755BE897094EA6E1229D0E7C662BF32C2A27AE917E8A5A7FCE890CE51C` and `C2DBD02A98631A6653DD5F1111EC030FDF00BC353B5A19B81AFFC7548811CDD5`. No push was performed.

## Fix Round 3

Task 8 was reviewed again from commit `45a5641b0cc65487b0ba6b4f78cb4f176afe20dc`. Fix Round 2 proved exact canonical keys and inline custom-property declarations, but a production stylesheet could still ignore or miswire those declarations. Fix Round 3 adds concrete computed-consumer evidence without changing production code.

### Concrete CSS consumer coverage

For every isolated edit across the 22 authoritative controls, the browser suite now captures both the existing inline-variable state and a `getComputedStyle` snapshot of the real CSS targets:

- DNA root, scene, first/last strand, connector, and both node sides;
- Twisted root, scene, view, first/second layer, cube, and first face.

The per-control mapping now proves concrete consumers as follows:

- DNA motion speeds: normalized connector/node and strand animation durations/delays;
- DNA count/spacing: strand/node DOM counts, concrete row gap, strand height, connector height, and both-node dimensions;
- DNA angle: paused-time-zero strand transform matrix;
- DNA scale/position: concrete scene transform matrix after responsive normalization;
- DNA connector width/thickness: concrete strand/connector/node dimensions and margins;
- DNA outline: concrete connector/node border widths;
- Twisted speed/stagger: normalized cube duration/delay;
- Twisted view angles: concrete view transform matrix;
- Twisted count: layer/face counts and concrete first-face opacity;
- Twisted depth: concrete second-layer 3D transform;
- Twisted scale/position: concrete scene transform matrix;
- Twisted falloff: concrete face opacity;
- Twisted outline: concrete face border width.

Computed root backgrounds, border/background colors, perspective, unaffected dimensions/transforms, and other representative consumers are retained as unrelated sentinels. The allowlist includes only real derived coupling found in the stylesheet: connector dimensions alter percentage-based connector/node translations, and Twisted's negative delay makes the time-zero cube matrix depend on duration, stagger, and layer count.

Expected computed values are produced independently from the settings/domain contract and normalized through the browser before comparison. Animation times use exact CSSOM-normalized strings. Layout `top` uses an independent containing block to preserve Chromium's subpixel quantization. Scene transforms use a hidden clone of the real scene so aspect-ratio layout retains the exact unrounded production geometry while the expected transform itself is supplied by the test contract.

### Reduced-motion concrete proof

The full reduced-state matrix still verifies every inline setting/color/geometry value and now additionally proves:

- DNA concrete root/connector/node backgrounds, outline borders, strand/connector/node dimensions, margins, scene/strand/connector/node transform matrices, counts, and `animation-name: none`;
- Twisted concrete root/face backgrounds, outline border color/width, face opacity/dimensions, the computed `100vmin` perspective, scene/view/layer/cube transform matrices, layer/face counts, and `animation-name: none`.

Harmony colors are normalized from the real registry adapter/palette resolver before concrete color comparison. No pseudo-element is involved in either renderer's production CSS. No production consumer miswire was uncovered, so no production file was changed.

### Fix Round 3 validation

- `node --test tests/browser-qa-harness.test.mjs tests/sitewide-control-rollout.test.mjs`: 16/16 passed.
- `npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts --project=desktop-chromium`: 8/8 passed.
- `npm run test:browser -- tests/browser/dna-twisted-cubes-backgrounds.spec.ts --project=mobile-chromium`: 8/8 passed.
- Computed-consumer/reduced-state repeat with `--repeat-each=3 --workers=2`: 12/12 passed across desktop and mobile in 3.0 minutes.
- `npm run typecheck`: passed.
- `npm run lint`: passed with only Babel's existing large-file informational note for `app/chimer/running-timer.tsx`.
- `npm run test`: 1,857/1,857 passed.
- `npm run build`: passed; Next compiled, typechecked, and generated 101 pages. Prebuild Prisma generation changed no tracked Prisma or package files.
- `git diff --check`: passed.

The Fix Round 3 diff contains only the dedicated browser suite, its focused source guard, and this report. Package/lock, Prisma, roadmap, TODO, generated-media, production behavior, and primary-checkout files remain unchanged. Both isolated and primary `TODO.md` SHA-256 values remain `034BE9755BE897094EA6E1229D0E7C662BF32C2A27AE917E8A5A7FCE890CE51C` and `C2DBD02A98631A6653DD5F1111EC030FDF00BC353B5A19B81AFFC7548811CDD5`. No push was performed.

## Fix Round 4

Task 8 was reviewed again from commit `18e0e28a76c1d030b23dba4c5988c4493f6580fa`. Fix Round 3 had the right computed-consumer targets, but its exception map and source guard did not positively prove every permitted coupled field or freeze the complete slider-to-consumer contract.

### Complete runtime-owned consumer contract

`tests/browser/dna-twisted-cubes-consumer-contract.mjs` now contains the single structured 22-entry acceptance map. Every entry fixes the effect id, accessible label, canonical key, concrete target, computed properties, direct render changes, and allowed coupled snapshot fields. The browser loop derives both 11-control matrices from this table and uses each entry's `allowedRenderChanges` and `allowedCouplings` as its only exception sets; the former separate allowlists were removed.

The focused Node guard imports the same runtime table and asserts exactly 22 unique entries against a complete literal projection. A missing, reordered, relabelled, retargeted, re-keyed, or recoupled entry now fails CI. The guard also requires the reduced-motion duration/delay evidence and fixed-geometry tokens used by the browser suite.

### Positive computed coupling and static-state proof

The structured consumer contract fails on every unapproved computed change and positively asserts the representative direct and coupled consumers below:

- DNA count and spacing assert concrete row/strand/connector/node geometry; count also asserts connector and both-node delays and transforms.
- DNA node speed asserts connector and both-node duration, delay, and paused time-zero transform. Connector width and thickness assert all affected dimensions, margins, and connector/both-node transforms.
- Twisted rotation speed, layer stagger, and layer count assert the concrete paused time-zero cube transform; stagger and count also assert the normalized negative delay.
- All previously direct angle, responsive scene transform, depth, opacity, border, count, and dimension consumers remain exact.

Animated transform expectations come from reconstructed keyframes and independently supplied domain timing, sampled on hidden target-shaped specimens at CSS time zero. The oracle applies CSS timing functions per keyframe interval and therefore covers the negative-delay phase without reading the production animation's computed transform back into its expectation.

Reduced motion now asserts `animation-name: none`, exact `0s` duration, and exact `0s` delay for the DNA strand, connector, start node, end node, and Twisted cube. Both DNA node sides also have independent concrete border/color evidence. Fixed geometry is independently normalized from `height: 65vmin` plus `aspect-ratio: 2 / 5` for the DNA scene and `50vmin` square geometry for the Twisted scene and faces; face expectations no longer derive from the captured production scene dimensions.

No production consumer miswire was uncovered, so no production file was changed.

### Fix Round 4 validation

This block is historical evidence captured at commit `57f27162`; it records the validation state at that commit. Current final pre-PR acceptance is recorded in `docs/project-log.md`.

- `node --test tests/browser-qa-harness.test.mjs tests/sitewide-control-rollout.test.mjs`: 16/16 passed.
- Combined desktop/mobile browser acceptance: 16/16 passed (8/8 per project).
- Computed-consumer/reduced-state repeat with `--repeat-each=3 --workers=2`: 12/12 passed across desktop and mobile in 3.4 minutes.
- `npm run typecheck`: passed.
- `npm run lint`: passed with only Babel's existing large-file informational note for `app/chimer/running-timer.tsx`.
- `npm run test`: 1,857/1,857 passed.
- `npm run build`: passed; Next compiled, typechecked, and generated 101 pages. Prebuild Prisma generation changed no tracked Prisma or package files.
- `git diff --check`: passed.

The first strengthened desktop run exposed a test-oracle mismatch: Web Animations easing had been applied once to the whole reconstructed effect, while CSS applies `animation-timing-function` per keyframe interval. Moving the independent easing to each keyframe interval made the exact consumer and oracle matrices agree; the focused rerun and all exhaustive/repeat runs then passed.

The Fix Round 4 diff contains only the dedicated browser suite, its new structured consumer-contract fixture, the focused source guard, and this report. Package/lock, Prisma, roadmap, TODO, generated-media, production behavior, and primary-checkout files remain unchanged. Both isolated and primary `TODO.md` SHA-256 values remain `034BE9755BE897094EA6E1229D0E7C662BF32C2A27AE917E8A5A7FCE890CE51C` and `C2DBD02A98631A6653DD5F1111EC030FDF00BC353B5A19B81AFFC7548811CDD5`. No push was performed.
