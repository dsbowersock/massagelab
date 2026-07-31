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

Final exact command:

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
- No remaining Task 8 blocker is known.

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
