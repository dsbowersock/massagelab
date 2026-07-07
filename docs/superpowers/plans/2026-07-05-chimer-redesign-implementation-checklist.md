# Chimer Visual Customization Implementation Checklist

## Scope

Create a guided Chimer setup flow and redesign the existing Chimer Settings popup without changing current background conversion or registration internals. Preserve existing palette/branding, behavior compatibility, and entitlement gating (`chimer_custom_colors` and related checks).

## Reference Assets

- Harmony icon set provided by user:
  - `public/massagelab_color_harmony_icons/png-512/{custom,analogous,complementary,compound,monochromatic,shades,split-complementary,square,triad}.png`
  - `public/massagelab_color_harmony_icons/svg/{custom,analogous,complementary,compound,monochromatic,shades,split-complementary,square,triad}.svg`
- Do not remove existing functionality. Background conversion internals should remain behavior-compatible; the current foundation now touches selector/registry metadata only for visual picker and preview-field support:
  - `components/backgrounds/backgroundRegistry.ts`
  - `components/backgrounds/BackgroundSelector.tsx`

## Invariant Rules (must hold in all batches)

- Keep all existing Chimer behaviors functional while work is incremental.
- Keep feature keys as behavioral switches, not display-label checks.
- Preserve keyboard focus visibility, reduced-motion behavior, and mobile tap targets.
- Slider/toggle/button updates must be progressive and isolated to Chimer surfaces first.
- No third-party code copy/paste; recreate behavior with compatible patterns.

## Batch 1 — Baseline audit + API contracts

1. [ ] Reconfirm the current setup/settings behavior and data schema in:
  - `app/chimer/page.tsx`
  - `app/chimer/set-timer.tsx`
  - `app/chimer/running-timer.tsx`
  - `components/chimer/background-controls/*` (if present)
2. [ ] Capture current state payload shape used by session start and settings persistence:
  - `ChimerSettings`
  - default values / stored values / merge precedence
3. [ ] Add plan-only notes for “do not break” edges:
  - existing timer start flow
  - session persistence
  - saved preferences sync conflict path
  - entitlement sanitation
4. [ ] Verify whether existing settings modal tabs currently include:
  - `timer`
  - `display`
  - `background`

## Batch 2 — Reusable primitives (non-invasive)

1. [ ] Add controlled UI component shells (new files under `components/chimer/controls/`) with optional old-control fallback:
  - `StyledRangeControl`
  - `StyledToggleControl`
  - `TactileButton`
  - `CTAButton`
  - `GlowButton`
  - `LoaderWrapper` (orange dithered sphere integration point)
  - `NumberFieldControl`
  - `ColorSliderControl`
  - `HarmonyToggleGroup`
  - `HapticPressHelper`
  - `GlobalColorPickerPanel`
2. [ ] Keep default props and class tokens compatible with existing usage.
3. [ ] Add only style-level updates and utility aliases (no behavior wiring yet).

## Batch 3 — Haptic feedback foundation

1. [ ] Add user preference store for haptics and default policy.
2. [ ] Create a thin helper:
  - checks `navigator.vibrate` support
  - no-op when unsupported
  - duration default 15ms
  - optional cancellation on high-frequency actions
3. [ ] Add setting UI placeholder for:
  - `Haptic feedback: On/Off`
4. [ ] Ensure helper is only called for intentional activations (click/tap/keyboard-activation, not hover).

## Batch 4 — Setup stepper (pre-start)

1. [ ] Add multi-step pre-start setup flow in `app/chimer/set-timer.tsx`:
  - Step 1: Enter time
  - Step 2: Choose interval
  - Step 3: Choose notification
  - Step 4: Choose background
  - Step 5: Start timer
2. [ ] Keep “skip optional” controls and support returning users reusing last successful setup.
3. [ ] Add optional “save session preset” path and preserve existing direct-start behavior as compatibility fallback until parity.
4. [ ] Add pre-start battery warning on confirm step with the exact user-provided copy.

## Batch 5 — Settings popup redesign

1. [x] In `app/chimer/running-timer.tsx`, preserve modal entrypoint but redesign surface layout.
2. [x] Rename `Display` tab to `Controls`.
3. [x] Keep current `Backgrounds` tab slot and content architecture.
4. [x] Group existing controls under `Controls`:
  - selected background controls
  - clock font
  - clock color
  - clock stroke
  - clock drop shadow
  - clock outer glow
  - background-specific toggles/sliders
  - harmony picker integration point

## Batch 6 — Backgrounds tab categories + card/slider style system

1. [x] Replace source tabs with category tabs:
  - All, Static, Animated, Interactive, Shader, Image, Video, Premium, Saved
2. [x] Re-surface background options as visual cards/carousel items.
3. [x] Show metadata on each card:
  - name
  - preview state
  - category
  - free/premium badge
  - selected state
  - save/favorite affordance
  - quick apply
4. [x] Use carousel/card preference order:
  - Shadcn Studio Radix Carousel 12 first
  - then ScrollX UI expandable
  - then Componentry Collection Surfer
  - then BEUI Cylinder as last fallback

## Batch 7 — Preview media strategy

1. [x] Add optional preview media fields to background metadata model consumed by UI.
2. [x] Implement lazy preview loading keyed to visible carousel items.
3. [x] Pause or stop offscreen preview rendering.
4. [x] Ensure only selected background renders live shader/animated scene in timer execution path.
5. [x] Document a simple generation CLI option for future automation (Remotion/Playwright/Puppeteer note).
6. [x] Generate and attach landscape, square, and vertical WebM preview media assets for each active Chimer background.

## Batch 8 — Global color system + harmony palettes

1. [x] Add Chimer-local global color settings UI using Dice-style form/card layout.
2. [ ] Fields:
  - Primary, Secondary, Accent, Background, Text/Foreground, CTA start/end
3. [ ] Add harmony selector with horizontal toggle buttons using provided grayscale icons.
4. [ ] Save harmony output into palette model:
  - palette name
  - source color
  - harmony mode
  - generated colors
  - created date
  - default flag
5. [x] Enable palette reuse inside Chimer for:
  - background accents
  - clock
  - gradients
  - glow effects
6. [ ] Promote saved palettes into broader site/account theme settings if this becomes a sitewide Appearance panel.

## Batch 9 — Interaction polish and loader rollout

1. [x] Replace range/toggle controls used in Chimer setup/settings first.
2. [x] Ensure new controls preserve value/min/max/step and keyboard access.
3. [ ] Add vertical pill style sliders with in-card label + value alignment.
4. [ ] Add tactile press feedback using transform/shadow transitions (subtle).
5. [ ] Add CTA gradient treatment for high-priority actions and optional animated ring.
6. [ ] Add orange sphere dither loader hook for:
  - background loading
  - preview loading
  - palette generation/loading

## Batch 10 — Persistence and reuse hooks

1. [x] Persist saved setup presets with:
  - time
  - interval
  - notification
  - background
2. [x] Persist haptics preference and Chimer global color palette preference.
3. [ ] Ensure preset restore path works on:
  - desktop
  - tablet
  - phone
  - treatment-room display
4. [ ] Keep timer start behavior stable when presets are incomplete or stale.

## Batch 11 — Future-only documentation

1. [ ] Add a brief doc note (non-functional) for Componentry music player inspiration only.
2. [ ] Explicitly mark music player implementation deferred to later phase.

## Batch 12 — Validation and acceptance sweep

1. [ ] Keyboard navigation passes for setup and settings popup.
2. [ ] Reduce-motion variants for loaders and press animations.
3. [ ] Verified no accidental regression in current timer start and Chimer run loop.
4. [ ] Confirm no autoplay of heavy media except selected item.
5. [ ] Confirm existing entitlement behavior and non-premium fallback paths unchanged.
6. [ ] Final acceptance checklist:
  - setup before timer start
  - background choose-before-start
  - settings entrypoint unchanged
  - Display → Controls rename
  - background category tabs
  - visual card/carousel list
  - haptics on/off
  - global color + harmony palette save/reuse
  - orange sphere loader available
  - no behavioral changes to background conversion/registration
