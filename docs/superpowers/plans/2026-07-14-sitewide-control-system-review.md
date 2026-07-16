---
id: plan-2026-07-14-sitewide-control-system-review
type: plan
date: 2026-07-14
source: docs/audits/2026-07-14-sitewide-control-system-review.md
base_commit: e24445dc
branch: codex/sitewide-control-system-review
---

# Sitewide Control-System Review And Rollout Plan

## Context

The 2026-07-07 rollout successfully established shared buttons, press feedback, sliders, toggles, color behavior, loaders, and several reviewed route examples. The current code still distributes base visual construction across generic shadcn components, `app/globals.css`, Chimer CSS modules, Anatomime CSS, shell classes, and route-local card/button markup. The next milestone is therefore a control-system review lab, not a broad restyle.

This plan makes `/dev/buttons` the review gate for every reusable control and surface family. It adds or reinforces one shared contract per family, proves protected route visuals through shared composition, and blocks broad production-route migration until the matrix has been reviewed.

User feedback after the first draft resolves the earlier ambiguous route examples. Anatomime and public-booking choice cards use the selectable-card family, and admin filters use dense shared fields. Wellness body-region selection remains a route-owned anatomical visualization because its intended hit areas are muscle/region shaped rather than ordinary controls. Its recommended first renderer is an accessible SVG body map backed by renderer-independent region data and selection state, leaving a future 3D body free to reuse the same model. Drawer category headers and child links remain within the existing sidebar family unless a real non-drawer consumer justifies extraction. The flashcard informational-carousel dots already look appropriate and remain unchanged.

Applied findings: none. The repo has no `.agents/planning-rules/` or `.agents/findings/` directory. The constraints come from the current project docs, the 2026-07-07 rollout plan, the dated audit, and the user's direction in this task.

## Approval Decision — 2026-07-15

The user approved the shared control and surface matrix for production rollout with one explicit holdback: the Wellness anatomical map is not approved. Keep that specimen clearly labeled as a deferred review prototype and exclude it from S6-S9 production migrations. The remaining approved families may proceed in the narrow branch sequence below, beginning with S6 ordinary action buttons.

## Intent And Acceptance Examples

The user request in this task is the intent issue. The bounded context is the shared visual-control system and its development-only QA route.

```gherkin
Feature: Shared MassageLab control system

  Scenario: Review every reusable control family before migration
    Given the site contains shared and route-owned visual controls
    When a developer opens /dev/buttons in development
    Then the page shows each control family, its supported states, tones, densities, effects, and protected route examples

  Scenario: Routes choose intent without owning base control mechanics
    Given a reviewed shared control family
    When a production route adopts that family
    Then the route selects variant, tone, density, effect, or selected behavior without redefining base geometry, focus, disabled, press, or hover policy

  Scenario: Protected visuals migrate without regression
    Given an approved Chimer, Anatomime, pricing, or account control
    When its implementation moves to a shared primitive
    Then its approved appearance and interaction remain unchanged

  Scenario: Dense route exceptions remain usable
    Given a calendar, booking, gameplay, admin, color-picker, or clinical workspace control
    When shared adoption would reduce density or usability
    Then the layout remains route-owned and the exception is documented while shared tokens and mechanics are reused where practical

  Scenario: Broad migration waits for approval
    Given the complete review matrix has not been approved
    When this branch is implemented
    Then no broad production-route migration is included
```

## Boundaries

**Always**

- Preserve the current MassageLab palette, protected route visuals, semantics, keyboard behavior, visible focus, disabled behavior, reduced-motion handling, and haptic opt-out.
- Keep PHI-bearing workflows local-first; this work changes presentation and interaction only.
- Use feature-key entitlements when an existing gated control is involved.
- Keep `TODO.md` untouched; its current local modification belongs to the user.
- Add focused JSDoc/comments to non-obvious shared contracts and adapters.
- Keep compatibility exports while moving authority from route namespaces into `components/ui`.

**Ask first**

- Any visual choice marked proposed rather than approved in the review lab.
- Any production-route migration beyond the explicitly approved batch.
- Any change that alters Chimer's approved result instead of reproducing it.
- Any dependency addition or third-party code reuse; license review is required first.

**Never in the review milestone**

- A giant universal control component.
- Bulk rewriting the 943 Chimer native range inputs or 251 Chimer native selects.
- Forcing gameplay cards, booking grids, or dense admin/calendar controls into ordinary `Button` geometry merely because they are clickable; they still use the appropriate shared card, field, navigation, or dense-control family.
- Hover-only lift/motion or hover haptics.
- Route CSS that introduces a new base geometry for an ordinary shared control.

## Baseline Audit

Detailed evidence and classifications live in `docs/audits/2026-07-14-sitewide-control-system-review.md`.

| Metric | Command | Result |
| --- | --- | --- |
| Checkout | `git branch --show-current` and `git log -1 --oneline` | `codex/sitewide-control-system-review` from `e24445dc` |
| Preserved local edit | `git status --short` before planning | `M TODO.md` |
| Shared UI surface | `rg --files components/ui` | 63 files |
| Review route | `rg --files app/dev/buttons` | 6 files |
| Shared/native buttons | `rg -o '<Button' ...`; `rg -o '<button' ...` | 358 shared JSX matches; 125 native matches |
| Shared/native ranges | shared-import and native-tag scans | 7 shared files; 946 native matches, 943 in Chimer |
| Shared/native selects | shared-import and native-tag scans | 14 shared files; 283 native matches, 251 in Chimer |
| Existing tests | `rg -n '/dev/buttons|SegmentedToggleGroup|RangeControl|Loader' tests app/dev` | Source-contract coverage exists in `tests/app-settings.test.mjs`, `tests/chimer-color-picker.test.mjs`, and `tests/sitewide-loader.test.mjs`; no complete review-route matrix test exists |

## Shared Family Contracts

The contracts below separate structure from visual axes. A family may include a primitive plus small composition helpers; it must not become one component that conditionally renders unrelated structures.

### Button family

- Authority: `components/ui/button.tsx` plus `components/ui/metal-attention-button.tsx` for ring composition.
- Preserve existing variant aliases for compatibility.
- Separate, where practical, base variant from `tone` and opt-in `effect` so setup, Anatomime, pricing, and calendar colors do not require route geometry.
- Keep sizes centralized. Add a reviewed compact size only if existing `sm` cannot reproduce Chimer quick-duration controls.
- Treat loading content as composition with `Loader`, not a separate button implementation.

### Segmented-choice and tab families

- `SegmentedToggleGroup` owns form-like single-choice mechanics, selection movement, density, tone, icon-only behavior, and optional attention ring.
- `Tabs` keeps content-navigation semantics but gains a shared visual treatment for inset/compact route tabs.
- Do not use Tabs for form values or segmented choices for content panels.
- Do not represent Chimer duration presets as a segmented control. Duration is an editable value, not a mutually exclusive mode.

### Select family

- One shared visual contract supplies height, radius, padding, focus, disabled, error, cutout/inset surface, density, and tone.
- `SelectTrigger` consumes it for Radix behavior.
- A thin native-form select adapter consumes the same contract where native form submission or very large option sets justify native semantics.

### Switch, toggle, slider, and range families

- Extend existing shared contracts rather than creating replacements.
- Add missing disabled, compact/dense, route-tone, and review examples.
- Chimer may keep dense route layout, but shared `Slider`/`RangeControl` or a thin compatibility adapter must eventually own input mechanics.

### Color family

- Promote public authority to `components/ui/color-picker.tsx` or a small `components/ui/color-controls/` family.
- Keep `components/chimer-controls/*` as compatibility re-exports/adapters during migration.
- Keep specialized picker internals route-owned when they are not general controls.

### Text-field family

- `Input` and `Textarea` remain separate native elements sharing reviewed density, tone, surface, focus, disabled, and error contracts.
- A small field-message/label composition may be shared; it must not hide form semantics.

### Selectable-card family

- Add a dedicated `SelectableCard` or `ControlCard` for card-shaped buttons/links.
- It owns selected, disabled, focus, press, tone, icon inset, and quiet/reviewed states.
- Gameplay objects can remain route-owned or use a specialized variant after review.
- Anatomime setup cards, flashcard prompt cards, and public-booking service/provider choices must use this family when they behave as card-shaped selections.

### Notice/status family

- Consolidate the visual contract used by `AppNotice` and `Alert` for info, success, warning, error, sync/conflict, loading, and empty states.
- Preserve semantic roles; not every informational surface should use `role="alert"`.

### Loading family

- Keep `Loader`, `Progress`, and `Skeleton` separate because they communicate different information.
- Expand the review route to show random loader, fixed shapes, representative skeletons, and determinate progress.

### Navigation family

- Keep drawer categories and nested routes within the existing `components/ui/sidebar.tsx` family.
- Continue using `Button` for actual topbar/bottom-nav icon buttons where its semantics fit.
- Navigation controls choose active/inactive/disabled state without inheriting strategic action styling.
- Preserve distinct `SidebarSectionTrigger` and nested `SidebarMenuButton` treatments. Extract a broader navigation-row component only after a second non-drawer consumer proves reuse.

### Surface family

- Keep `AppSurface`, `AppInset`, `Card`, `Dialog`, `Popover`, and `Sheet` as structural primitives.
- Extract shared surface variants/tokens for card, inset, flat/no-gradient, route, floating/dialog, and popover construction.
- Do not make `AppSurface` conditionally render every overlay or container type.

## Review Matrix Information Architecture

Keep the `/dev/buttons` URL for now and rename its visible title to "Control system review". Use sections or nested tabs that remain navigable on mobile:

1. Foundations: tokens, focus, disabled, pressed, selected, density, tone, and effect legends.
2. Actions: buttons and icon buttons.
3. Choices: segmented controls, tabs, selects, switches, toggles, sliders, color controls.
4. Fields: inputs, textareas, terms checkbox row, native/Radix select adapters.
5. Cards and status: selectable cards, notices, empty/loading/sync states.
6. Loading: loaders, progress, skeletons.
7. Navigation and surfaces: drawer rows, app-bar buttons, cards, insets, route containers, dialogs, popovers.
8. Protected route proofs: Chimer, Clock, Anatomime, pricing, and account examples.

The Chimer duration proof uses the approved direction while leaving production unchanged: keep the clickable `HH:MM` timer, add concise instruction, add compact shared minus/plus controls for hours and minutes, and omit the eight quick-preset buttons from the specimen.

Every family section shows the applicable default, interactive hover, pressed/active, focus-visible, disabled, selected, compact/dense, route-tone, and proposed states. Use real controls for keyboard/pointer QA and clearly labeled forced-state specimens only where side-by-side comparison needs them.

## Files To Modify In The Review Milestone

Exact file creation may be adjusted to keep each gallery focused, but responsibility must remain separated by family.

| File | Planned change |
| --- | --- |
| `app/dev/buttons/page.tsx` | Rename/restructure the page as the control-system review shell and navigation. |
| `app/dev/buttons/button-gallery.tsx` | **New** focused button/tone/effect/state matrix extracted from the page. |
| `app/dev/buttons/choice-gallery.tsx` | **New** tabs, segmented controls, selects, toggles, switches, and terms row. |
| `app/dev/buttons/field-gallery.tsx` | **New** input, textarea, select adapter, focus/disabled/error matrix. |
| `app/dev/buttons/card-status-gallery.tsx` | **New** selectable cards, notices, loading/empty/sync states. |
| `app/dev/buttons/surface-navigation-gallery.tsx` | **New** navigation rows, icon controls, cards, insets, dialogs, and popovers. |
| Existing gallery files | Retain or split slider/color, loader, metal-ring, and protected route examples without route-owned base styling. |
| `components/ui/button.tsx` | Backward-compatible tone/effect/size contract only if required by approved specimens. |
| `components/ui/tabs.tsx` | Shared tab visual variants. |
| `components/ui/select.tsx` and a native adapter | Shared select visual contract. |
| `components/ui/input.tsx`, `textarea.tsx` | Shared density/tone/status/surface props. |
| `components/ui/segmented-toggle-group.tsx`, `switch.tsx`, `toggle.tsx`, `slider.tsx`, `range-control.tsx` | Fill matrix gaps without changing defaults unexpectedly. |
| `components/ui/selectable-card.tsx` | **New** shared card-as-control primitive. |
| `components/ui/notice.tsx` or `app-surface.tsx`/`alert.tsx` | Shared status-tone contract and compatibility path. |
| `components/ui/sidebar.tsx`, `components/sidebar/app-sidebar-client.tsx` | Review existing drawer section/nested-route variants; do not extract a general navigation-row primitive without another consumer. |
| `components/ui/surface-variants.ts` | **New if needed** shared surface construction tokens for existing structural primitives. |
| `components/ui/color-*` and `components/chimer-controls/*` | Shared public authority plus compatibility exports; no behavior change. |
| `app/globals.css` | Shared tokens and family classes only; no new route-only normal-control CSS. |
| `tests/visual-system-review.test.mjs` | **New** source/contract coverage for complete review-family presence and compatibility exports. |
| `tests/browser/public-routes.spec.ts` or focused new spec | Development-route desktop/mobile navigation and interaction smoke. |
| `docs/wiki/visual-system.md` | Document approved family contracts, tones/effects, and exceptions after review decisions. |
| `docs/project-state.md`, `docs/project-log.md` | Update only when the review milestone or a production batch is actually completed. |

## Authority/Consumer Admission Gate

The broad migration is intentionally not admitted yet. Current inventory is sufficient to plan the review route but not to dispatch production rewrites. Before each migration slice, capture exact newline-delimited consumers with the command shown, classify every path, and assign every path to one slice. A changed inventory invalidates that slice.

| Authority | Inventory command | Current classification |
| --- | --- | --- |
| `Button`, `buttonVariants` | `rg -l 'components/ui/button|<Button|<button' app components --glob '*.tsx'` | Incomplete for broad migration; admit only named route files after approval. |
| `SegmentedToggleGroup`, `TabsTrigger` | `rg -l 'segmented-toggle-group|components/ui/tabs|<TabsTrigger|aria-pressed' app components --glob '*.tsx'` | Shared consumers; serialize contract work before route migration. |
| `SelectTrigger`, native select adapter | `rg -l 'components/ui/select|<select' app components --glob '*.tsx'` | Shared; Chimer bulk consumers remain excluded until a dedicated parity plan. |
| `Slider`, `RangeControl` | `rg -l 'components/ui/(slider|range-control)|type="range"' app components --glob '*.tsx'` | Shared; 943 Chimer matches require dedicated adapter/batch manifest. |
| `Input`, `Textarea` | `rg -l 'components/ui/(input|textarea)|<input|<textarea' app components --glob '*.tsx'` | Incomplete until native hidden/file/radio controls are dispositioned. |
| `SelectableCard` | Inventory native card buttons by route after the primitive is reviewed. | Greenfield authority; consumers not admitted. |
| Notice/surface/navigation contracts | Inventory imports and route classes after contract names are approved. | Incomplete; review-only first. |

## Implementation Slices

### S1 — Review lab shell and evidence contract

**Behavior:** A developer can navigate every control family on desktop and mobile without entering a production route.

**Write scope:** `app/dev/buttons/page.tsx`, small review-only layout helpers, `tests/visual-system-review.test.mjs`.

```gherkin
Given the development-only review route
When it renders at desktop or phone width
Then every required family is reachable and the page remains non-indexable and production-hidden
```

Validation: focused Node source test, typecheck, lint, desktop/mobile browser navigation.

### S2 — Action and choice contracts

**Behavior:** Buttons, segmented choices, tabs, selects, switches, and toggles can express reviewed variants, tones, densities, effects, selected states, and disabled states without route geometry.

**Write scope:** the relevant `components/ui` files, `app/globals.css`, button/choice galleries, compatibility wrappers, focused tests.

```gherkin
Given an action or choice specimen
When its tone, density, effect, selected state, or disabled state changes
Then its base geometry, focus behavior, press policy, and semantics still come from the family authority
```

### S3 — Range, color, and text-field contracts

**Behavior:** Sliders, ranges, color controls, inputs, textareas, and both select adapters share reviewed state treatment while preserving native/Radix semantics.

**Write scope:** range/field/color authorities, compatibility exports, field and slider/color galleries, focused tests.

```gherkin
Given a field or value-control specimen
When it is compact, disabled, focused, invalid, or route-toned
Then it preserves its value contract and keyboard behavior while using shared construction
```

### S4 — Cards, status, loading, navigation, and surfaces

**Behavior:** Non-button control cards and structural surfaces use their own shared families and do not borrow normal button geometry.

**Write scope:** new/selectively extended shared primitives, galleries, surface tokens, focused tests.

```gherkin
Given a selectable card, notice, loader, progress bar, skeleton, navigation row, or app surface
When its supported state is reviewed
Then the specimen uses the correct family semantics and shared visual contract
```

Required route-shaped specimens: Anatomime setup/card choices, flashcard prompt cards, booking service/provider cards, dense admin filters, existing drawer category headers/nested links, and a wellness anatomical-map exception example that demonstrates shared state/accessibility rules without imposing rectangular shared-control geometry. The wellness specimen should document the progressive renderer contract: canonical region IDs and selection state feed an accessible SVG map plus keyboard-usable list now and may feed a 3D body later. The existing flashcard informational-carousel dots are approved as-is and need no new specimen.

### S5 — Protected route proof and approval gate

**Behavior:** The review lab reproduces approved Chimer, Clock, Anatomime, pricing, and account controls before production code moves.

**Write scope:** review-only protected examples, visual-system wiki, focused browser screenshots/evidence; no production route files.

```gherkin
Given the protected route examples in the review lab
When the user compares them with the approved production controls
Then the user can approve, reject, or revise each proposed shared mapping before migration
```

The approval set includes the chosen Chimer duration-entry specimen: keep the clickable timer, add a concise instruction, add compact hour/minute minus/plus controls, and remove the quick-preset grid in the later production batch.

### S6 — First production migration: ordinary action buttons (post-approval)

**Dependencies:** S1-S5 approved.

**Behavior:** Named ordinary actions use shared `Button` composition while protected appearance remains unchanged.

**Candidate write scope:** Chimer Continue/setup actions, ordinary Anatomime primary/secondary/danger actions, pricing/account effect adapters, and their focused tests/docs. Exact files are frozen only after the button consumer manifest is re-run.

```gherkin
Given an approved ordinary route action
When it migrates to the shared Button family
Then the route no longer owns base geometry and the approved visual/interaction result is unchanged
```

### S7 — Production choices and fields (post-approval, separate batch)

Migrate low-risk tabs, select fields, toggles, ranges, color controls, inputs, and textareas only after each family's review approval. Chimer's bulk range/select surface requires a dedicated adapter plan and is not part of a low-risk sweep.

### S8 — Production cards, notices, navigation, and surfaces (post-approval, separate batch)

Migrate ordinary selectable cards, status surfaces, navigation rows, and containers. Preserve documented dense/gameplay/clinical exceptions.

### S9 — Exception reconciliation (post-approval, last)

Review remaining Chimer settings, booking grids, calendar workspace, admin media review, Anatomime gameplay, and clinical layouts one surface at a time. Record direct migration or a thin adapter for every ordinary control. A legitimate interactive-visualization exception, such as the wellness body map, may retain purpose-specific shapes and positioning while adopting shared state tokens and accessibility policy wherever technically practical. Implement its region taxonomy and selection behavior separately from the renderer; use an accessible SVG map and equivalent keyboard-operable list as the practical first production treatment, while treating 3D as an optional later renderer over the same contract.

## Execution Order And Branch Boundaries

- Current branch/PR: audit plus S1-S5 only. Stop at visual approval.
- Next branch: S6 ordinary action-button migration.
- Later narrow branches: S7, S8, then individually approved S9 surfaces.
- Do not parallelize slices that write `app/globals.css`, the same shared primitive, or the review-page shell.

## File Dependency Matrix

| Consumer | Depends on | Order |
| --- | --- | --- |
| Review shell | Existing gallery exports | Shell first, gallery registration after each slice |
| Button/choice galleries | Shared action/choice contracts | Contract before specimen |
| Field/color galleries | Shared field/range/color contracts and compatibility exports | Contract before specimen |
| Card/status/surface galleries | New or extended family primitives | Contract before specimen |
| Protected proofs | All approved shared contracts | Last review slice |
| Production migrations | Approved review specimens and frozen consumer manifest | Separate post-approval branches |

## File-Conflict Matrix

| Shared file | Conflicting slices | Resolution |
| --- | --- | --- |
| `app/dev/buttons/page.tsx` | S1-S5 | S1 owns shell; later slices only register exports in sequence. |
| `app/globals.css` | S2-S4 | Serialize by family and keep family sections separate. |
| `docs/wiki/visual-system.md` | S2-S5 | Update once at S5 from approved decisions. |
| Chimer compatibility exports | S2-S3 | Button compatibility before color/range authority changes. |
| Production route files | S6-S9 | Never shared with review slices; use separate branches/batches. |

**Wave decision:** sequential. Shared CSS, review navigation, and cross-family tokens make same-branch parallel writes collision-prone.

## Conformance Checks

| Slice | Check type | Check |
| --- | --- | --- |
| S1 | content | Review route lists every required family and retains production `notFound()` guard. |
| S1 | browser | `/dev/buttons` loads and all review sections are reachable at desktop and mobile widths. |
| S2 | tests | Button/choice compatibility aliases and state specimens are present; keyboard semantics remain Radix/native. |
| S3 | tests | Field/range/color value contracts and compatibility exports remain intact. |
| S4 | tests | Cards/status/loading/navigation/surface specimens use the correct semantic elements. |
| S5 | content | Every protected mapping in the audit has a review specimen and an approval status. |
| S6+ | inventory | Exact authority/consumer manifest is complete before route files are edited. |

## Verification

For each implementation slice:

```powershell
npm run typecheck
npm run lint
npm run test
git diff --check
```

Before handoff of the full review milestone:

```powershell
npm run build
npm run test:browser -- --project=desktop-chromium
```

Run focused `/dev/buttons` browser coverage at desktop and mobile widths. Check keyboard-only navigation, visible focus, disabled controls, pressed/selected states, reduced motion, and light/dark themes. Production route browser checks are required only in post-approval migration batches and must cover every touched route.

## Planning Rules Compliance

| Rule | Status | Justification |
| --- | --- | --- |
| Mechanical enforcement | PASS | Source tests, typecheck/lint/test/build, browser checks, and inventory gates are named. |
| External validation | PASS | User visual approval is required before route migration. |
| Feedback loops | PASS | Review milestone stops before production migration. |
| Separation over layering | PASS | One contract per family; structural surfaces remain separate. |
| Process gates first | PASS | Matrix and manifest gates precede broad migration. |
| Cross-layer consistency | PASS | Compatibility exports and docs are part of relevant slices. |
| Phased rollout | PASS | Review, action buttons, choices/fields, structural families, then exceptions. |
| Pre-decomposition symbol verify | PASS | Current authorities and consumers were inspected live. |
| Mechanical count verification | PASS | Dated audit records commands and results. |
| Small batches/refactor separation | PASS | Review work and production migrations are separate branches. |
| Test thoroughness matched to stakes | PASS | Focused tests per slice; full build/browser checks at milestone and route changes. |

## Approval Gate

No UI implementation or production migration should begin until the user reviews this plan and the dated audit. On approval, start with S1 and stop again after S5 so the complete review matrix can be visually inspected before S6.
