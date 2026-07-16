# Sitewide Control-System Review

Date: 2026-07-14
Branch: `codex/sitewide-control-system-review`
Base: `e24445dc Refine route-owned visual controls (#131)`

## Purpose

This audit updates the 2026-07-07 visual-control inventory against the current checkout. The July rollout established strong shared foundations, but the remaining work is no longer a button-restyle exercise. It is a control-system consolidation: each reusable control family needs one shared visual and interaction contract, while routes choose intent, tone, density, effect, and selected behavior.

Protected visuals are migration targets when a shared contract can reproduce them. "Protected" means the approved result must not regress; it does not require route-owned implementation.

## Approval Disposition — 2026-07-15

The user approved every reviewed shared control and surface family for staged production rollout except the Wellness anatomical map. The anatomy map remains a review-only holdback; do not migrate or introduce it on production routes until a later focused review approves its renderer and region geometry.

## Baseline Evidence

All commands were read-only and ran against `app` and `components` with `--glob '*.tsx'` unless noted.

| Metric | Command | Result |
| --- | --- | ---: |
| Shared UI files | `rg --files components/ui` | 63 files |
| `/dev/buttons` implementation | `rg --files app/dev/buttons` | 6 files |
| Shared `Button` consumer/definition files | `rg -l 'components/ui/button' app components --glob '*.tsx'` | 100 files |
| Shared `Button` JSX matches | `rg -o '<Button' app components --glob '*.tsx'` | 358 matches |
| Native button files | `rg -l '<button' app components --glob '*.tsx'` | 19 files |
| Native button matches | `rg -o '<button' app components --glob '*.tsx'` | 125 matches |
| Shared tabs/segmented files | `rg -l 'components/ui/(tabs|segmented-toggle-group)' app components --glob '*.tsx'` | 12 files |
| Shared select files | `rg -l 'components/ui/select' app components --glob '*.tsx'` | 14 files |
| Native select files | `rg -l '<select' app components --glob '*.tsx'` | 18 files |
| Native select matches | `rg -o '<select' app components --glob '*.tsx'` | 283 matches |
| Shared toggle/switch files | `rg -l 'components/ui/(switch|toggle|toggle-control|toggle-group|segmented-toggle-group)' app components --glob '*.tsx'` | 9 files |
| Shared slider/range files | `rg -l 'components/ui/(slider|range-control)' app components --glob '*.tsx'` | 7 files |
| Native range files | `rg -l 'type="range"' app components --glob '*.tsx'` | 5 files |
| Native range matches | `rg -o 'type="range"' app components --glob '*.tsx'` | 946 matches |
| Shared input files | `rg -l 'components/ui/input' app components --glob '*.tsx'` | 44 files |
| Shared textarea files | `rg -l 'components/ui/textarea' app components --glob '*.tsx'` | 20 files |
| Shared card/surface files | `rg -l 'components/ui/(card|app-surface)' app components --glob '*.tsx'` | 91 files |
| Shared loading files | `rg -l 'components/ui/(loader|progress|skeleton)' app components --glob '*.tsx'` | 10 files |
| Shared navigation files | `rg -l 'components/ui/(sidebar|navigation-menu|menubar|breadcrumb|pagination)' app components --glob '*.tsx'` | 4 files |
| Shared overlay files | `rg -l 'components/ui/(dialog|alert-dialog|popover|sheet|dropdown-menu|hover-card)' app components --glob '*.tsx'` | 9 files |

The raw counts are migration signals, not automatic rewrite targets. Chimer alone accounts for 943 of 946 native range matches and 251 of 283 native select matches:

| Native control | `app/chimer/running-timer.tsx` | `app/chimer/set-timer.tsx` | Other files |
| --- | ---: | ---: | ---: |
| Range | 476 | 467 | 3 |
| Select | 124 | 127 | 32 |

The Chimer settings layout is a legitimate dense route-owned surface, but its range/select mechanics should eventually be supplied by shared primitives or thin Chimer adapters after visual parity is proven.

## Current Shared Authorities

| Family | Current authority | Current status |
| --- | --- | --- |
| Buttons | `components/ui/button.tsx`, `components/ui/metal-attention-button.tsx` | Strong base; variant currently mixes intent, tone, and effect. |
| Segmented choices | `components/ui/segmented-toggle-group.tsx`, `components/ui/toggle-group.tsx` | Shared selection mechanics exist; route tones and compact/disabled matrix are incomplete. |
| Tabs | `components/ui/tabs.tsx` | Radix semantics exist; visual treatment remains generic or route-owned. |
| Select/dropdown | `components/ui/select.tsx` | Radix semantics exist; no shared density/tone/status/cutout contract and native selects remain separate. |
| Switch/toggle | `components/ui/switch.tsx`, `components/ui/toggle.tsx`, `components/ui/toggle-control.tsx` | Shared size/density and limited tone support exist. |
| Slider/range | `components/ui/slider.tsx`, `components/ui/range-control.tsx` | Shared mechanics exist; Chimer has a compatibility wrapper but most dense settings remain native. |
| Color controls | `components/chimer-controls/GlobalColorPicker.tsx`, `ColorSlider.tsx`, `HarmonyToggleGroup.tsx`, `ColorPickerFormInput.tsx` | Canonical behavior exists but authority still lives under the Chimer namespace. |
| Text fields | `components/ui/input.tsx`, `components/ui/textarea.tsx` | Shared base exists; no density/tone/status/inset contract. |
| Selectable cards | None | Repeated route-owned card-as-button implementations need a shared primitive. |
| Notices/status | `components/ui/app-surface.tsx` (`AppNotice`), `components/ui/alert.tsx` | Two partial APIs; neither covers the required status matrix. |
| Loading/progress | `components/ui/loader.tsx`, `progress.tsx`, `skeleton.tsx` | Shared primitives exist; review coverage is incomplete. |
| Navigation | `components/ui/sidebar.tsx` plus shell-specific classes | Shell primitives exist; no small shared route-row contract spanning drawer/topbar/bottom-nav states. |
| Surfaces/overlays | `components/ui/app-surface.tsx`, `card.tsx`, `dialog.tsx`, `popover.tsx`, `sheet.tsx` | Shared pieces exist but surface construction is duplicated and lacks explicit variants. |

## Classification

### Can migrate directly to an existing shared primitive

- Ordinary action buttons already matching `Button` geometry but carrying route-local color, hover, or shadow classes.
- Straightforward binary settings that can use `Switch` or `ToggleControl` without changing layout.
- Labeled settings ranges that already match `RangeControl`'s number-value API.
- Indeterminate waits currently represented by ad hoc spinners where `Loader` is more informative than a progress bar or skeleton.
- Standard text fields and textareas that only add spacing/width classes.
- Generic cards and containers already visually equivalent to `AppSurface` or `AppInset`.

### Needs a new shared tone, variant, effect, or adapter

- Chimer setup actions: shared `Button`, setup tone `#4AAAAA`, shared default/compact sizes, no hover-only lift.
- Chimer Continue: shared `Button` with the approved orange face and always-on metal ring while enabled.
- Anatomime ordinary actions: shared `Button` with Anatomime tone and inset icon treatment.
- Pricing donations: shared `Button` with glow-flicker effect and staggered timing.
- Membership/account CTAs: shared `Button` with attention treatment.
- Tabs: shared inset/compact treatment rather than `running-timer.module.css` owning base track/trigger mechanics.
- Native and Radix selects: one visual contract consumed by a Radix trigger and a native-form adapter.
- Inputs/textareas: shared inset, density, tone, and error states.
- Selectable cards: a dedicated `SelectableCard`/`ControlCard` family rather than stretching `Button` into card geometry.
- Notices: one status contract for info, success, warning, error, sync/conflict, loading, and empty states.
- Navigation rows: a shared active/inactive/disabled contract that remains quieter than action buttons.
- Surface construction: shared card/inset/flat/floating/route/dialog/popover variants without forcing one component to render every structure.
- Color controls: move the public authority to `components/ui` while keeping Chimer compatibility re-exports and specialized picker internals.

### Legitimate route-owned layout exceptions

- Dense FullCalendar/operator workspace controls.
- Public booking service, provider, pressure, date, and time selection grids.
- Anatomime gameplay cards and repeated in-game scoring/choice controls that behave as game objects rather than ordinary buttons.
- Chimer background-settings layout and specialized color-picker internals; shared controls should own mechanics inside the route layout.
- Admin anatomy/media-review repeated-action density.
- Local-first clinical form layouts, body diagrams, and record-selection workspaces where readability and touch density dictate structure.

These exceptions may own layout and information density. They should still consume shared tokens, focus rules, disabled behavior, and primitives whenever that does not reduce usability.

Route-owned layout is not an exemption from the shared style. Every exception must still use a shared control family or a thin adapter for its base mechanics unless the adapter itself would make the control less usable.

### User-resolved direction

- Chimer duration entry: the large `HH:MM` timer remains the primary editor. Replace the current eight quick-duration buttons with a concise instruction such as "Select hours or minutes to set the session length" plus compact shared minus/plus controls beneath the hour and minute values. A single press changes one minute, a held press repeats slowly and accelerates, and a quick double press changes five minutes. This makes the editable values discoverable and keyboard/touch accessible while using fewer controls than the preset grid. Production remains unchanged until the review specimen confirms the layout.
- Anatomime team-count choices, region buttons, and term cards must follow the shared system while fitting their purpose. Ordinary actions use `Button`; card-shaped choices use `SelectableCard`; true gameplay objects may retain route-owned layout over those shared mechanics.
- Flashcard setup prompt cards must follow the shared selectable-card treatment. The three small pagination dots below the informational carousel already look appropriate and remain unchanged.
- Wellness body-region selection is a route-specific interactive anatomy representation. The intended end state uses muscle/region-shaped hit areas positioned over a body representation, not ordinary rectangular buttons or cards. Keep that structure route-owned; reuse shared focus, selected, disabled, color, motion, and accessibility rules where they fit. An accessible SVG overlay with labeled interactive paths and a keyboard-usable region list is the recommended practical first renderer. Keep canonical region IDs, labels, front/back grouping, and selection state independent of the SVG so a future 3D body can consume the same region model without rewriting the workflow. A 3D renderer is a future enhancement, not a prerequisite for replacing the current rectangular grid.
- Drawer section rows are collapsible category headers such as Education; nested route rows are child destinations such as Flashcards and Decks. Keep these within the existing sidebar family (`SidebarSectionTrigger`, `SidebarMenuButton`, and nested variants). Do not create a general sitewide navigation-row component unless a real non-drawer consumer appears.
- Public-booking service and provider choices must use the shared selectable-card/control-card family while retaining the booking flow's scannable grid layout.
- Dense admin import and filter controls must use shared dense field, select, toggle, and button variants. Density may be route-specific; the visual and interaction contract may not be route-specific.

## Protected Visual Mapping

| Protected result | Shared target | Must preserve |
| --- | --- | --- |
| Chimer Continue | `Button` + default/orange tone + always-on `MetalAttentionRing` effect | Orange face, enabled-only ring, current press depth, no extra lower lip. |
| Chimer setup actions | `Button` + setup tone + default size | `#4AAAAA`, 40px action height, no hover lift, tactile press. |
| Chimer duration editing | Clickable `HH:MM` timer + shared instruction/notice + compact shared accelerating step buttons | Timer remains the primary editor; one-minute single/held steps, accelerating hold, and five-minute double press; replace the quick-preset grid only after approval. |
| Anatomime actions | `Button` + Anatomime tone | Current action hierarchy and inset icon treatment. |
| Pricing donations | `Button` + pricing tone + glow-flicker effect | Current orange glow/flicker and per-button timing offset. |
| Membership/account CTAs | `Button` + attention variant/effect | Approved strategic attention treatment. |
| Harmony picker | `SegmentedControl` + attention selected tone + always-on ring | Purple selected face, ring, optional sibling reflection. |

## Proposed `/dev/buttons` Review Matrix

The route name may remain `/dev/buttons`, but its page title and navigation should identify it as the control-system review lab.

| Section | Minimum examples |
| --- | --- |
| Buttons | All current variants; setup, Anatomime, pricing tones; none/glow/glow-flicker/metal effects; icon/loading/disabled; compact/default/large. |
| Segmented controls and tabs | Default inset, compact, icon-only, disabled, attention-selected, setup/Clock/Chimer/Anatomime tones, content tabs versus form choices. |
| Select fields | Radix and native-form adapters; default/compact/cutout; focus/disabled/error; route tones. |
| Switches and toggles | Checked/unchecked, compact/dense, disabled, route tones. |
| Sliders/ranges | Raw slider, labeled range, compact, hue/channel, disabled, route tones. |
| Color controls | Picker input, swatch, global picker, Harmony picker, swatch grid, saved palette, selected/disabled/error/focus. |
| Text fields | Input and textarea; default/inset/compact; focus/disabled/error; route tones. |
| Selectable cards | Default/selected/disabled; orange/Anatomime/quiet; icon inset; button-card and link-card examples. |
| Notices/status | Info/success/warning/error/sync/loading/empty. |
| Loading/progress | Random loader; fixed sphere/swirl/ripple; skeleton shapes; determinate progress. |
| Navigation | Drawer section/route rows; bottom-nav and topbar icons; active/inactive/disabled. |
| Surfaces | Card, inset, flat/no-gradient, route container, dialog, popover, notice, Clock/Chimer/Anatomime/pricing samples. |
| Pricing/account | Membership CTA, Get Started, donations, terms checkbox row, account entry actions. |
| Protected route proof | Chimer Continue/setup/quick duration, Anatomime actions/cards, Harmony picker, Clock tabs/select/container. |

Each interactive section must expose or provide directly testable examples of default, hover, pressed/active, focus-visible, disabled, selected, and compact/dense states where applicable. Forced-state presentation may be used for visual comparison, but real interactive controls must remain present for keyboard and pointer QA.

## First Production Migration After Approval

The first production batch should migrate normal action buttons that still own base geometry. It must not include gameplay cards, dense booking/calendar choices, or a bulk Chimer settings rewrite.

1. Add approved shared button tone/effect axes while retaining existing variant aliases.
2. Migrate Chimer Continue and setup actions only after the review lab proves pixel/interaction parity; keep duration-entry behavior separate from the button migration.
3. Migrate ordinary Anatomime primary/secondary/danger actions; leave gameplay cards and dense choice grids for a separate decision.
4. Keep pricing membership and donation actions on shared `Button`, replacing effect-only route classes with the reviewed shared effect API where practical.
5. Validate affected routes at desktop and mobile widths before widening to another family.

## Audit Conclusion

The current implementation is ready for a review-surface milestone, not a broad route migration. Shared buttons, toggles, ranges, color behavior, loaders, and surfaces provide enough foundation to build the complete review matrix. Tabs, selects, fields, selectable cards, notices, navigation rows, and surface variants require shared contracts or adapters before production routes can stop owning their base styling.
