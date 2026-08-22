# AtmoShaper Overlay Drawer, Preview, and Sound Library Implementation Plan

> **For agentic workers:** Use `aegis:subagent-driven-development` task-by-task. Each task receives a fresh implementation worker followed by spec-compliance and code-quality review. Use the current isolated worktree and do not push, merge, deploy, publish media, or mutate live providers.

**Goal:** Replace the fixed Current Mix column/bottom tray with an opposite-sidebar collapsed rail and overlay drawer, add one temporary sound-preview path that can promote smoothly into the committed mix, and make the Sound Library visually cohesive with the Atmosphere station experience.

**Architecture:** `MusicProvider` remains the sole global audio owner. The existing AtmoShaper controller gains one ephemeral preview slot alongside committed recipe handles; the provider coordinates preview-only ownership without publishing a global player or Media Session until the preview is promoted into a real mix. The UI uses the existing settings owner to derive the opposite drawer side, the existing Radix Sheet primitive in modal or modeless mode according to measured workspace geometry, and focused AtmoShaper components for the rail, sortable rows, generated noise artwork, and library-source policies.

**Tech Stack:** Next.js 16, React 19, TypeScript/JSDoc, Tone.js, Radix/shadcn controls, `@dnd-kit/core`/`sortable`/`utilities`, CSS container queries, Node test runner, Playwright Chromium.

**Baseline/Authority Refs:**

- `AGENTS.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/superpowers/specs/2026-08-21-atmoshaper-design.md`
- `docs/superpowers/plans/2026-08-21-atmoshaper-core-mixer.md`
- Current baseline commit: `2e69515c8f23eefcbc98ece6c9a53a2f30755314`

**Compatibility Boundary:** Ordinary Atmosphere playback, the single persistent player, Media Session, interruptions, stopped-recipe editing, retained failed replacements, sidebar settings, app-bar/player safe areas, and the production browser-QA boundary must remain unchanged except where explicitly extended for a temporary preview. No catalog media, saving, subscription access, commerce, artwork upload, public sharing, or Lo-Fi YouTube behavior belongs to this plan.

**TDD Route:**

- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Test posture: minimum implementation followed by focused deterministic and browser regression coverage
- Reason: the approved UI redesign did not request strict RED/GREEN execution; the existing deterministic and browser harnesses provide proportional post-change proof.
- Verification: focused Node tests after each task, then the existing AtmoShaper/Media Session desktop-and-mobile browser gate and full repository validation.

**Verification:**

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run build:browser-qa
npm run test:browser -- tests/browser/atmoshaper.spec.ts tests/browser/music-media-session.spec.ts --project=desktop-chromium --project=mobile-chromium
npm run build
npm run atmoshaper:assert-production-bundle
git diff --check
```

## Planning Readiness

### Aegis Visibility

Planning is useful because temporary preview extends the audio-owner contract, the drawer retires two existing responsive surfaces, and the work crosses controller, provider, workspace, accessibility, dependency, browser, and documentation boundaries.

### Plan Basis

- **Facts:** The core mixer and initial workspace are implemented and validated. `MusicProvider` is the global owner. `createAtmoShaperMixController` owns committed handles. Current Mix is a fixed wide column plus narrow bottom tray/Sheet. The repository has no sortable drag dependency. Canonical station artwork, glow buttons, semantic success buttons, settings context, and the necessary browser harness already exist.
- **Approved requirements:** opposite-sidebar persistent rail; overlay drawer on every geometry; modeless roomy behavior; focus-contained narrow behavior; first addition opens the drawer; later additions do not; layer icons and condensed mute/transport controls; drag-handle reorder; Preview before Add; cohesive glow tabs/art/buttons.
- **Measured responsive rule:** the AtmoShaper workspace is roomy only at a measured minimum of `42rem` inline size and `32rem` block size; every other geometry is narrow. Drawer/rail dimensions remain fluid inside those modes, and tests record real workspace geometry rather than matching device names.

### BaselineUsageDraft

- Required baseline refs: project state, project log, wiki index, approved AtmoShaper spec, implemented core-mixer plan.
- Delivered context refs: approved design discussion and current worktree handoff.
- Acknowledged before plan refs: all required baseline refs.
- Cited in plan refs: all required baseline refs listed in the header.
- Missing refs: none.
- Decision: continue.

### Requirement Ready Check

- Requirement source refs: approved AtmoShaper specification and the section-by-section UI approval completed on 2026-08-22.
- Goals and scope refs: specification Goals, Workspace And Responsive Behavior, Temporary Sound Preview, Sound Library Visual Language, Accessibility And Motion, Testing And Validation.
- User/scenario refs: browse sounds, audition one source, add it, discover Current Mix, collapse it, continue browsing, reopen a chosen layer, reorder layers, and use the experience across phone through television geometries.
- Requirement item refs: all approved drawer, rail, preview, styling, reordering, ownership, accessibility, and responsive requirements.
- Acceptance/verification criteria refs: specification Acceptance Criteria and this plan's browser matrix.
- Open blocker questions: none.
- Decision: ready.

### Change Necessity

- User-visible need: Current Mix currently consumes or crowds layout space, library styling is visually disconnected, cards lack meaningful art, reordering uses text buttons, and sounds cannot be auditioned before commitment.
- No-change/non-code option: copy or documentation cannot alter layout, interaction, audio ownership, or preview behavior.
- Why code change is necessary: the approved experience requires new runtime/provider methods, stateful drawer behavior, sortable interaction, card rendering, styles, and acceptance coverage.
- Minimum change boundary: existing AtmoShaper controller/runtime/provider and workspace surfaces plus focused new AtmoShaper UI/policy files; no schema, commerce, catalog, or unrelated shell changes.
- Decision: code-change.

### Existence Check

- Proposed new surfaces: one preview slot inside the existing mixer controller; focused Current Mix rail/sortable-row components; procedural noise artwork; pure library identity helpers; dnd-kit packages.
- Existing owner/reuse candidate: `MusicProvider`, `createAtmoShaperMixController`, Radix Sheet, settings context, `AtmosphereStationArtwork`, glow/success Button variants, immutable recipe helpers.
- Why existing surface is insufficient: committed recipe handles cannot represent an uncommitted preview; the existing tray cannot supply an opposite-edge overlay rail; the repository has no touch-and-keyboard sortable list utility.
- Creation proof: new files remain presentation or pure-policy helpers; global audio authority stays in `MusicProvider`, and runtime handle authority stays in the existing controller.
- Entropy/retirement impact: old fixed-column/tray markup, CSS, `CurrentMixTray`, and Move earlier/later controls are removed in the same work package.
- Decision: add-with-proof while reusing canonical owners.

### Architecture Integrity Lens

- Invariant: exactly one provider-owned audible session; preview is ephemeral and never becomes a second global player.
- Canonical owner/contract: `MusicProvider` coordinates ordinary station, committed AtmoShaper, and preview-only ownership; `createAtmoShaperMixController` owns every AtmoShaper adapter handle.
- Responsibility overlap: UI creates layer descriptions and requests actions but never manipulates Tone nodes; the rail reflects recipe/runtime state but owns no recipe.
- Higher-level simplification: use one preview handle in the existing controller and promote its stable layer id rather than creating a second preview runtime or duplicating audio during Add.
- Retirement/falsifier: any second player, independent preview audio context, UI-owned audio handle, or retained old tray fails the architecture check.
- Verdict: proceed.

### Complexity Budget

- Artifact class: shared provider/controller plus feature UI.
- Target pressure: `music-provider.tsx` 2,179 lines; `mix-controller.js` 336; `current-mix.tsx` 320; `sound-library.tsx` 269; `app/globals.css` 4,434.
- Projected pressure: provider and controller are at risk if preview policy is written inline without helpers; Current Mix and Sound Library are over the comfortable single-component boundary for the approved additions.
- Budget result: at-risk.
- Planned governance: keep provider changes orchestration-only; extract rail, sortable row, noise art, and pure library/workspace policies; retire old markup/styles during replacement; do not add another audio owner.

### Plan-Time Complexity Check

- Target files: provider, controller/runtime, Current Mix, Sound Library, workspace, global AtmoShaper CSS.
- Existing size/shape signals: large provider and stylesheet; feature components already combine multiple responsibilities.
- Owner fit: provider/controller remain correct audio owners; presentation and pure state decisions can be extracted locally.
- Add-in-place risk: monolithic drawer, sorting, preview, and art additions would make review and lifecycle correctness difficult.
- Better file boundary: new `current-mix-rail.tsx`, `sortable-layer-row.tsx`, `noise-artwork.tsx`, and `sound-library-model.js`; extend but do not duplicate provider/controller owners.
- Recommendation: split tasks and extract focused feature files.

### Plan Pressure Test

- Owner/contract/retirement: explicit and bounded.
- Architecture integrity/higher-level path: preview promotion reuses the existing controller and stable recipe ids.
- Verification scope: deterministic lifecycle/model tests, source boundaries, browser behavior, geometry, accessibility, build boundary, and full repository gate.
- Task executability: each task names files, method contracts, commands, expected outcomes, and commit boundaries.
- Pressure result: proceed.

## File Map

### Audio and provider

- Modify `lib/atmoshaper/mix-controller.js`: one ephemeral preview slot and promotion.
- Modify `lib/atmoshaper/runtime.ts`: expose preview methods through the existing lazy runtime and shared master.
- Modify `components/providers/music-provider.tsx`: coordinate preview-only ownership and public actions without a second player.
- Modify `tests/atmoshaper-mix-controller.test.mjs`, `tests/atmoshaper-runtime-boundary.test.mjs`, and `tests/atmoshaper-provider-source.test.mjs`.

### Workspace and library

- Modify `components/atmoshaper/use-atmoshaper-recipe.ts`: return the next committed recipe from Add and announce positional moves.
- Modify `components/atmoshaper/atmoshaper-workspace.tsx`: drawer state, measured modal mode, opposite side, first-layer discovery, and preview cleanup.
- Modify `components/atmoshaper/current-mix.tsx`: expanded editor/transport and active-layer focus.
- Create `components/atmoshaper/current-mix-rail.tsx`: collapsed transport/layer rail.
- Create `components/atmoshaper/sortable-layer-row.tsx`: dnd-kit pointer/touch/keyboard row.
- Modify `components/atmoshaper/sound-library.tsx`: glow categories, Preview/Add, preview strip, selected brainwave preset, and station art.
- Create `components/atmoshaper/noise-artwork.tsx`: static procedural white/pink/brown noise visuals.
- Create `components/atmoshaper/brainwave-artwork.tsx`: static binaural wave and isochronic pulse imagery.
- Create `components/atmoshaper/sound-library-model.js`: source identity, preview matching, and candidate promotion policies.
- Modify `components/atmoshaper/workspace-model.js`: opposite-side, first-layer-open, and measured drawer-mode pure decisions.
- Modify `app/globals.css`: full-width library, rail, overlay drawer, card/grid/art, safe-area, and reduced-motion rules; remove old tray/column rules.
- Modify `package.json` and `package-lock.json`: dnd-kit packages only.

### Acceptance and docs

- Modify `tests/atmoshaper-workspace-model.test.mjs`, `tests/atmoshaper-workspace-source.test.mjs`, `tests/atmoshaper-layout-source.test.mjs`.
- Create `tests/atmoshaper-sound-library-model.test.mjs`.
- Modify `tests/browser/atmoshaper.spec.ts` and preserve `tests/browser/music-media-session.spec.ts` unchanged unless a proven compatibility assertion needs extension.
- Modify `docs/wiki/atmosphere-audio.md` and `docs/project-log.md` after validation.
- Keep `docs/superpowers/specs/2026-08-21-atmoshaper-design.md` and this plan as the authority/evidence pair.

---

## Task 1: Add one preview slot to the existing mixer runtime

**Files:**

- Modify: `lib/atmoshaper/mix-controller.js`
- Modify: `lib/atmoshaper/runtime.ts`
- Modify: `tests/atmoshaper-mix-controller.test.mjs`
- Modify: `tests/atmoshaper-runtime-boundary.test.mjs`

**Why:** Preview must use the same adapter factory, master output, ramps, cancellation leases, and disposal guarantees as committed layers.

**Change Necessity:** A UI-only sound check would either commit the source prematurely or create an unmanaged second audio path. The minimum stable change is one ephemeral slot inside the canonical mixer controller.

**Impact/Compatibility:** Existing `start`, `applyRecipe`, pause/resume, retry, failed replacement, stop, dispose, and snapshots remain compatible. `preview` is added as a separate snapshot field and never appears in `recipe.layers` or `activeLayers` before promotion.

**Verification:**

```powershell
node --test tests/atmoshaper-mix-controller.test.mjs tests/atmoshaper-runtime-boundary.test.mjs
npm run typecheck
```

Expected: all selected tests pass; UI/provider files still have no static Tone/runtime import.

- [x] **Step 1:** Extend the controller snapshot with `preview: null | { layer, status, error? }` and expose `startPreview(layer)`, `setPreviewVolume(volume)`, `stopPreview()`, and `promotePreview(recipe)`.
- [x] **Step 2:** Implement one preview request lease. A replacement may be prepared silently, but the prior preview must fade out and dispose before the replacement becomes audible; then fade the replacement in. Stale adapters must self-dispose, and failure must leave committed handles/status untouched.
- [x] **Step 3:** Keep the preview layer id stable. `setPreviewVolume` updates only the preview handle/layer. `promotePreview` adopts the same handle when the supplied recipe contains the same id/kind/source, clears preview state, and reconciles the remaining recipe without a duplicate adapter or audible restart.
- [x] **Step 4:** Make pause/resume operate on both committed handles and an active preview; make stop/dispose retire preview and committed handles. A preview-only controller keeps committed status `stopped` while publishing preview status separately.
- [x] **Step 5:** Reuse one `createAdapter` function in `runtime.ts` for committed and preview sources and expose the four preview methods through the existing lazy-loaded runtime type.
- [x] **Step 6:** Add deterministic cases for preview-only start, smooth replacement, per-preview volume, failure isolation, pause/resume, stop/dispose, stale lease cleanup, and exact-handle promotion.
- [x] **Step 7:** Run the focused commands and inspect `git diff --check`.
- [x] **Step 8:** Commit only this task as `feat(atmoshaper): add temporary preview runtime`.

---

## Task 2: Coordinate preview ownership in MusicProvider

**Files:**

- Modify: `components/providers/music-provider.tsx`
- Modify: `tests/atmoshaper-provider-source.test.mjs`
- Modify: `tests/atmosphere-provider-lazy-boundary.test.mjs`

**Why:** Preview must replace an ordinary station safely, layer over an active AtmoShaper mix, stop on global ownership changes, and promote into the one global player without publishing a second player.

**Change Necessity:** Runtime methods alone cannot arbitrate the ordinary-station controller, playback leases, interruption monitor, Media Session, player visibility, or route-level cleanup. `MusicProvider` is already the canonical authority.

**Impact/Compatibility:** Preview-only playback leaves `activePlaybackKind`, player metadata, media carrier, and Media Session unclaimed. An active committed mix retains its existing metadata/player while preview layers over it. Promotion turns the existing runtime into the committed AtmoShaper owner and only then publishes player/media metadata.

**Verification:**

```powershell
node --test tests/atmoshaper-provider-source.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs
npm run typecheck
```

Expected: tests pass; the provider retains a dynamic import of `lib/atmoshaper/runtime` and no static Tone or AtmoShaper runtime import.

- [x] **Step 1:** Extend `MusicContextType` and its default/value memo with `atmoShaperPreview`, `previewAtmoShaperLayer(layer)`, `setAtmoShaperPreviewVolume(volume)`, `stopAtmoShaperPreview()`, and `promoteAtmoShaperPreview(recipe)`.
- [x] **Step 2:** Add provider refs/state for the preview snapshot and a preview request lease. Reuse the existing AtmoShaper runtime when a committed mix owns it; otherwise lazily create a preview-only runtime after awaiting ordinary-station disposal.
- [x] **Step 3:** Keep preview-only playback outside the global player and Media Session: do not set `activePlaybackKind`, station title/artwork, playback lifecycle, or carrier solely for preview. Still initialize the existing interruption monitor and pause/resume the preview through provider interruption callbacks.
- [x] **Step 4:** Starting an ordinary station stops preview first. Starting a non-promotion AtmoShaper recipe stops preview before normal startup. Explicit AtmoShaper Stop retires preview as well as committed audio. Stale preview requests cannot stop or republish a newer station/mix.
- [x] **Step 5:** Implement promotion as an ownership transfer over the existing runtime: publish AtmoShaper metadata/player/carrier, call `runtime.promotePreview(recipe)`, settle playback lifecycle from the resulting snapshot, and avoid `disposeAtmoShaperRuntime()` on the promoted handle.
- [x] **Step 6:** Extend the existing provider-owned browser-QA diagnostics type with the public preview snapshot fields needed by acceptance, then extend source-boundary tests to prove replacement order, preview-only non-publication, interruption routing, terminal cleanup, promotion ownership, lazy imports, and stale-lease guards. Do not add a new browser global or expose Tone nodes.
- [x] **Step 7:** Run the focused commands and `git diff --check`.
- [x] **Step 8:** Commit only this task as `feat(atmoshaper): coordinate sound previews`.

---

## Task 3: Redesign the Sound Library and connect Preview/Add

**Files:**

- Modify: `components/atmoshaper/use-atmoshaper-recipe.ts`
- Modify: `components/atmoshaper/atmoshaper-workspace.tsx`
- Modify: `components/atmoshaper/current-mix.tsx`
- Modify: `components/atmoshaper/sound-library.tsx`
- Create: `components/atmoshaper/noise-artwork.tsx`
- Create: `components/atmoshaper/brainwave-artwork.tsx`
- Create: `components/atmoshaper/sound-library-model.js`
- Modify: `app/globals.css` (Sound Library/art/card rules only)
- Create: `tests/atmoshaper-sound-library-model.test.mjs`
- Modify: `tests/atmoshaper-workspace-source.test.mjs`

**Why:** Users need to audition sources before commitment and recognize the library as part of the same Atmosphere experience.

**Change Necessity:** Existing tabs, blank cards, Add-only actions, and direct brainwave-add buttons cannot express selected presets, preview state, promotion, meaningful art, or the approved visual hierarchy.

**Impact/Compatibility:** Recipe exclusivity and station-replacement confirmation remain owned by existing domain/helpers. Ambient catalog stays honest placeholder copy. Preview uses generated sources and existing playable stations only.

**Verification:**

```powershell
node --test tests/atmoshaper-sound-library-model.test.mjs tests/atmoshaper-workspace-source.test.mjs
npm run typecheck
npm run lint
```

Expected: tests and checks pass with no health claims, persistence UI, catalog-media fetches, or Tone imports in components.

- [x] **Step 1:** Add pure helpers that create stable candidate layers, derive a comparable source/configuration key, detect whether the active preview matches a card, and resolve a library commit as either `{ type: "select-existing", layerId }` for the same committed kind/source/settings or `{ type: "commit", layer }`. Exclusive source replacement with different settings remains owned by the existing recipe-domain helper.
- [x] **Step 2:** Make `actions.addLayer(layer)` return the immutable next recipe while still dispatching it. Add a move announcement that includes the layer name and one-based position without announcing slider changes.
- [x] **Step 3:** Replace generic TabsList styling with the Atmosphere glow-pill rail by rendering each Radix `TabsTrigger asChild` around the existing non-nested `Button variant="glow" size="compact"`. Drive purple selected and warm inactive styling from Radix `data-state`, retain Tabs keyboard semantics, horizontal overflow, full endpoint padding, and selected-pill scroll visibility.
- [x] **Step 4:** Create `NoiseArtwork` with a static inline SVG `feTurbulence` texture and white/pink/brown tint palettes. Mark it decorative and keep headings/control labels as the accessible source names.
- [x] **Step 5:** Render canonical `AtmosphereStationArtwork` using `resolveAtmosphereStationArtworkInput(station)` on station cards. Do not duplicate station art generation or use the API image route.
- [x] **Step 6:** Create decorative static `BrainwaveArtwork`: binaural cards show distinct left/right wave paths and isochronic cards show a pulsed amplitude envelope. Restructure both panels so Delta, Theta, Alpha, Beta, and Gamma glow buttons select the active preset; selected uses purple glow, alternatives use warm glow. Preview and Add use the selected/advanced values.
- [x] **Step 7:** Add Preview/Stop Preview and forest-green `variant="success"` Add actions to every currently available source. If the matching source is previewing, Add calls `actions.addLayer(preview.layer)` and immediately requests `music.promoteAtmoShaperPreview(nextRecipe)`; otherwise Add remains a silent recipe edit. If the pure commit resolver reports `select-existing`, do not allocate or promote a new id: request workspace selection of that existing layer instead.
- [x] **Step 8:** Add a sticky in-library Previewing strip containing source name, labeled preview-volume control, failure text/Retry, and Stop Preview. Starting another Preview replaces the first through the provider.
- [x] **Step 9:** Introduce controlled selected-layer state at the workspace boundary now, pass `onSelectLayer(layerId)` to Sound Library, and make `CurrentMix` accept/focus the active layer. Reuse this state in Task 4 rather than creating a second selection owner. An existing-source Add opens the current editor surface and focuses that row.
- [x] **Step 10:** Add a workspace unmount cleanup effect that calls the stable `music.stopAtmoShaperPreview()` action. This is the implementation boundary that stops preview when the user leaves AtmoShaper; provider ownership changes still handle ordinary-station and Stop-all cleanup.
- [x] **Step 11:** Add fluid card-grid, art, Previewing-strip, loading-width, contrast, and reduced-motion CSS without named-device selectors.
- [x] **Step 12:** Cover candidate identity, same-id promotion, existing-source selection without duplication, differing brainwave settings, station/noise identity, source labels, buildable glow/success composition, canonical station art, procedural noise art, static brainwave wave/pulse art, route-unmount cleanup, and absence of persistence behavior.
- [x] **Step 13:** Run the focused commands and `git diff --check`.
- [x] **Step 14:** Commit only this task as `feat(atmoshaper): redesign sound library`.

---

## Task 4: Replace the column/tray with an opposite-edge rail and overlay drawer

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `components/atmoshaper/atmoshaper-workspace.tsx`
- Modify: `components/atmoshaper/current-mix.tsx`
- Create: `components/atmoshaper/current-mix-rail.tsx`
- Create: `components/atmoshaper/sortable-layer-row.tsx`
- Modify: `components/atmoshaper/workspace-model.js`
- Modify: `app/globals.css` (workspace/drawer/rail retirement and replacement)
- Modify: `tests/atmoshaper-workspace-model.test.mjs`
- Modify: `tests/atmoshaper-workspace-source.test.mjs`
- Modify: `tests/atmoshaper-layout-source.test.mjs`

**Why:** Current Mix should remain immediately reachable without consuming a permanent second column, and reordering should use a direct, accessible handle instead of verbose positional buttons.

**Change Necessity:** CSS alone cannot supply pointer/touch/keyboard sorting, first-add drawer state, active-layer focus, modal versus modeless behavior, or the saved sidebar preference.

**Impact/Compatibility:** The Sound Library reserves only rail width. Drawer opening never changes its grid width. Existing recipe actions, failed/retained rows, transport, volume, mute, retry, remove, safe-area, player, and focus-after-removal behavior remain supported.

**Verification:**

```powershell
node --test tests/atmoshaper-workspace-model.test.mjs tests/atmoshaper-workspace-source.test.mjs tests/atmoshaper-layout-source.test.mjs
npm run typecheck
npm run lint
```

Expected: tests pass; old Current Mix desktop-column, bottom-tray, bottom-Sheet, and Move earlier/later contracts are absent.

- [x] **Step 1:** Install pinned sortable packages with `npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2`; commit only resulting dependency/lock changes with this task.
- [x] **Step 2:** Add pure workspace decisions: opposite side for `left|right`, first-layer auto-open only for the zero-to-one committed transition, and measured drawer mode. Classify as `roomy` only when the measured AtmoShaper workspace is at least `42rem` wide and `32rem` tall; otherwise classify as `narrow`. This deliberately makes short landscape such as 844x390 narrow without any device-name, orientation, or zoom branch.
- [x] **Step 3:** Measure the workspace with `ResizeObserver`, consume `useSettings().settings.sidebarPosition`, and control one Radix Sheet. Use `modal={false}` plus a non-blocking hidden overlay for roomy mode; use modal focus containment and subtle overlay for narrow mode. Pass `side` opposite the app sidebar. The expected browser matrix is narrow at 375x667, 412x915, and 844x390, and roomy at 768x1024, 912x1368, 1440x900, and 2560x1440 when the measured workspace clears both thresholds.
- [x] **Step 4:** Create the persistent rail with drawer toggle, master Play/Pause, master Stop, and ordered layer tiles. Play/Pause controls the committed recipe; Stop retires both the committed mix and any active preview. Each tile opens/focuses its layer and exposes Mute/Unmute plus loading/muted/failed state in text and iconography. Preview never appears as a rail layer.
- [x] **Step 5:** Reuse the controlled selected-layer state introduced in Task 3. A zero-to-one addition opens and selects the first layer; later additions keep a closed drawer closed, while an already-open drawer may select the new layer. Rail selection always opens to the chosen row.
- [x] **Step 6:** Replace Move earlier/later controls with dnd-kit `PointerSensor`, `TouchSensor`, and `KeyboardSensor` using `sortableKeyboardCoordinates`. Restrict listeners to the visible handle; use a 6px pointer distance constraint and a touch constraint of 180ms delay with 8px tolerance so scrolling, sliders, and row actions remain usable. Keep retained predecessor rows non-sortable, and call the existing `actions.moveLayer(id, index)` only after a valid drop.
- [x] **Step 7:** Configure dnd-kit screen-reader instructions/announcements for grab, position, drop, and cancel. Preserve the existing polite application live region for the final recipe position and existing stable focus-after-removal behavior.
- [x] **Step 8:** Make `CurrentMix` focus/scroll the active layer after drawer mount, use forest-green Play AtmoShaper, and preserve neutral Stop, destructive Remove, and retry semantics. Expanded binaural and isochronic rows render the existing live `BrainwaveLayerControls`, mapping `carrierHz` plus `beatHz` or `pulseHz` into `actions.updateLayer` (and retained-row restoration when required). Station and noise rows keep only the generic controls because they have no other supported source settings.
- [x] **Step 9:** Record the exact connected `HTMLElement` that requested each open: primary rail toggle, individual rail layer tile, existing-source selection, or first-add discovery. On drawer close, prevent Radix's default restoration and focus that recorded opener when still connected, with the primary rail toggle as fallback.
- [x] **Step 10:** Replace the two-column/tray CSS with a full-width library plus fixed rail and portaled side drawer. Bound roomy drawer width, make narrow width nearly full content width, reserve player/app-bar/sidebar/safe areas, and prevent document overflow. Remove the old `.ml-atmoshaper-current-mix-desktop`, `.ml-atmoshaper-mix-tray`, tray transport, and bottom-sheet rules.
- [x] **Step 11:** Add reduced-motion side transitions and geometry assertions that prohibit library width changes between closed/open roomy states.
- [x] **Step 12:** Run the focused commands, `rg -n "CurrentMixTray|Move earlier|Move later|ml-atmoshaper-mix-tray|ml-atmoshaper-current-mix-desktop" components/atmoshaper app/globals.css tests/atmoshaper-*`, and `git diff --check`. Expected grep result: no production references; test text may mention retired terms only in negative assertions.
- [x] **Step 13:** Commit only this task as `feat(atmoshaper): add overlay mix drawer`.

---

## Task 5: Prove the complete interaction and update canonical evidence

**Files:**

- Modify: `tests/browser/atmoshaper.spec.ts`
- Modify only if needed for a proven compatibility assertion: `tests/browser/music-media-session.spec.ts`
- Modify: `docs/wiki/atmosphere-audio.md`
- Modify: `docs/project-log.md`
- Keep updated: `docs/superpowers/specs/2026-08-21-atmoshaper-design.md`
- Keep: `docs/superpowers/plans/2026-08-22-atmoshaper-overlay-drawer-preview-ui.md`

**Why:** Source tests cannot prove real focus containment, modeless interaction, pointer/touch sorting, audio preview/promotion, geometry, overflow, or player ownership.

**Change Necessity:** Browser acceptance and canonical documentation are required evidence for the cross-cutting behavior and retirement claim.

**Impact/Compatibility:** The final gate must preserve all existing core-mixer and Media Session acceptance. Browser QA remains compile-time isolated and absent from the final production bundle.

**Verification:** Use the full command block from the plan header.

- [x] **Step 1:** Consume the provider-owned public preview diagnostics added in Task 2 and confirm the existing failure injection remains guarded, loopback-only, consumed once, and removed from ordinary production bundles. Do not add another browser global or private Tone-node inspection.
- [x] **Step 2:** Add desktop and mobile Chromium cases for preview alone without a global player, preview layered over a committed mix, smooth preview replacement, volume change, failed preview recovery, Stop Preview, and Add promotion retaining one audible handle/id and producing exactly one global player.
- [x] **Step 3:** Add ordinary-station-to-preview replacement, preview-to-ordinary replacement, leaving AtmoShaper cleanup, interruption pause/recovery, and explicit Stop-all cleanup cases.
- [x] **Step 4:** For both sidebar positions, assert rail and drawer appear on the opposite side. On roomy geometry, open the drawer, confirm Sound Library width does not change, and operate a visible library Add control while the drawer stays open. On narrow geometry, prove backdrop, focus containment, Escape close, and focus restoration to the exact opener, including an individual rail layer tile.
- [x] **Step 5:** Prove first-layer auto-open and later-addition stability, layer-icon open/focus/mute, rail loading/failure indicators, and accurate rail order after sorting.
- [x] **Step 6:** Prove pointer/touch handle sorting plus keyboard grab/arrow/drop/cancel. Assert recipe order changes but active layer ids and playback remain stable.
- [x] **Step 7:** Assert glow-pill endpoint visibility and keyboard behavior, selected purple/inactive warm glow, forest-green Add/Play, white/pink/brown procedural art, canonical station art ids, static binaural wave/isochronic pulse imagery, selected brainwave glow, accessible labels, and reduced-motion behavior.
- [x] **Step 8:** Run geometry/no-overflow cases at 375×667, 412×915, 844×390, 768×1024, 912×1368, 1440×900, and 2560×1440, plus 200% text. Record workspace, library, rail, drawer, app bar, player, and document scroll rectangles in assertion messages; assert the measured threshold formula and expected roomy/narrow classification rather than device labels.
- [x] **Step 9:** Run the full QA browser gate. Fix product code only for failures that contradict the approved specification; do not weaken prior core-mixer or Media Session assertions.
- [x] **Step 10:** Run the ordinary production build and `npm run atmoshaper:assert-production-bundle` after the QA run so no QA marker remains in final artifacts.
- [x] **Step 11:** Update `docs/wiki/atmosphere-audio.md` with the rail/drawer, preview ownership, promotion, reorder semantics, and retained future-scope boundary. Append a dated `docs/project-log.md` entry containing only verified results.
- [x] **Step 12:** Run the complete validation block and `git diff --check` from a fresh ordinary build.
- [x] **Step 13:** Self-review against every UI acceptance criterion and scan production scope with:

```powershell
rg -n "CurrentMixTray|Move earlier|Move later|ml-atmoshaper-mix-tray|ml-atmoshaper-current-mix-desktop|TODO|FIXME|Not implemented" components/atmoshaper lib/atmoshaper components/providers/music-provider.tsx app/globals.css
```

Expected: no retired Current Mix implementation and no incomplete redesign marker. Existing deliberate ambient-catalog follow-up copy is permitted when it does not match an implementation marker.

- [x] **Step 14:** Commit the verified acceptance/docs slice as `test(atmoshaper): verify redesigned mixer`.

## Risks and Mitigations

- **Preview creates a second owner:** keep every adapter in the existing controller/runtime and every cross-source decision in `MusicProvider`; browser test zero/one player and source replacement.
- **Promotion clicks or doubles audio:** use the same stable preview layer id and adopt its live handle before reconciliation; deterministic tests count adapter creation/disposal.
- **Modeless drawer blocks the library:** use nonmodal Radix root and non-intercepting overlay on roomy geometry; browser-click the uncovered library.
- **Focus escapes the phone drawer:** use modal Radix behavior only for measured narrow geometry and verify tab/Shift+Tab/Escape/focus restoration.
- **Touch sorting conflicts with scrolling:** use handle-only activation and a movement/delay constraint; keep row body/slider scrollable and interactive.
- **Provider complexity grows:** orchestration only in provider; controller owns handles, UI model owns identity decisions, feature components own presentation.
- **Global CSS regressions:** scope all additions under `.ml-atmoshaper-*`, retire old rules in the same task, and run full build/browser geometry.
- **QA code leaks into production:** preserve compile-time disabled module substitution and finish with an ordinary production build plus recursive marker scan.

## Retirement and Rollback

- Retire `CurrentMixTray`, the fixed `.ml-atmoshaper-current-mix-desktop` column, bottom Sheet/tray markup, tray transport CSS, narrow tray breakpoints, and Move earlier/later controls when Task 4 lands.
- Do not retain a fallback layout or alternate preview player. Git commits provide the rollback surface.
- If preview promotion cannot adopt the existing handle without violating controller invariants, stop and return to design; do not ship audible duplicate/restart behavior as a compatibility fallback.
- If dnd-kit conflicts with React 19 or the player/Sheet interaction after focused verification, revert the dependency task and return to design for an accessible handle implementation; do not keep a half-working pointer-only path.
- The 84-sound catalog, saved mixes, subscription recall, permanent slots, custom artwork, community sharing, and Lo-Fi remain explicitly unimplemented after this plan.

## Execution Readiness View

- **Intent Lock:** implement only the approved AtmoShaper UI redesign and temporary preview behavior.
- **Scope Fence:** no catalog acquisition/media, persistence, entitlements, commerce, uploads, public sharing, Lo-Fi, deploy, push, or merge.
- **Baseline Lock:** start from `2e69515c8f23eefcbc98ece6c9a53a2f30755314` plus the approved spec/plan docs in `codex/atmoshaper-design`.
- **Approved Behavior:** opposite rail, overlay drawer, roomy modeless/narrow modal behavior, first-layer discovery, later-add stability, layer icons/mute, accessible drag handles, preview/replace/promote, cohesive library visuals.
- **Owner/Contract Constraints:** `MusicProvider` owns global audio; mixer controller owns all Atmo adapters; recipe remains the committed source of truth; preview is ephemeral.
- **Compatibility Boundary:** ordinary stations, single player, Media Session, interruptions, stopped edits, retained failures, lazy runtime, QA production boundary, settings, and safe areas remain green.
- **Retirement Boundary:** old column/tray/Move buttons are deleted rather than retained as fallback.
- **Task Batches:** Task 1 runtime; Task 2 provider; Task 3 library; Task 4 rail/drawer/sorting; Task 5 acceptance/docs.
- **Test Obligations:** focused deterministic/source tests per task; full desktop/mobile AtmoShaper plus Media Session browser gate; full repository and production-boundary validation.
- **Review Gates:** fresh implementation worker, spec-compliance review, then code-quality review for every task; final whole-diff review before completion.
- **Drift/Rewind Rules:** stop for scope expansion, second audio owner/player, unadoptable preview promotion, incompatible sorting dependency, or required device-name/zoom branching. Revert only the current scoped task commit when rewinding.
- **Evidence Required Before Completion:** task commits, focused command output, 110-case-or-larger unchanged browser baseline plus new cases green, full deterministic suite, typecheck, lint, Prisma, ordinary build, QA marker absence, geometry receipts, clean diff check, and user visual acceptance.
- **Advisory Boundary:** method-pack execution guidance only; not authoritative completion or release approval.

## Execution Route

- Decision: subagent-driven.
- Evidence: the user selected subagent-driven execution; five coherent sequential tasks have bounded file ownership and benefit from fresh-context implementation plus two-stage review.
- Fallback: inline execution using `aegis:executing-plans` if subagent capacity or environment launch fails.
- User confirmation required: no.
