# Chimer Visual Customization Redesign — Implementation Checklist

> Status: Continue from prior foundation work on `codex/chimer-redesign-foundation`.

## Context
- Existing branch includes a haptics foundation in progress.
- Use only current MassageLab color system.
- Do not duplicate/refactor background conversion/registration paths in this phase.
- Preserve existing timer behavior and non-customization user flows.
- Keep this work in small, reversible batches.
- Harmony icon assets are available at:
  - `public/massagelab_color_harmony_icons`

## Batch 0 (done / in-progress)
- [x] Add `hapticFeedbackEnabled` to global app settings schema/defaults.
- [x] Add typed settings sync in settings provider.
- [x] Add `triggerHapticFeedback` utility.
- [x] Add Account/Settings UI control for haptic feedback toggle.
- [x] Plumb haptic setting into Chimer entry page (`app/chimer/page.tsx`) and timer setup (`app/chimer/set-timer.tsx`).
- [x] Finish haptic coverage for high-intent setup/running controls added in this branch.

## Safe batch plan

### Batch 1 — Interaction polish foundations
- [x] Finish haptic tap wiring to remaining high-intent Chimer setup controls in `set-timer`.
- [x] Add reusable tactile press class/variant primitives.
- [x] Add Orange dithered sphere loader wrapper and update loader call sites for Chimer loading states.
- [ ] Add concise implementation comments where intent is non-obvious.

### Batch 2 — Chimer setup flow (pre-start)
- [x] Implement Stepper scaffold with 5-step sequence:
  1) Enter time
  2) Choose interval
  3) Choose notification
  4) Choose background
  5) Start timer
- [x] Add skip behavior for optional steps.
- [x] Add last-used preset restore.
- [x] Add "save preset" and "start without animated background" actions.

### Batch 3 — Chimer settings popup redesign (first pass)
- [x] Keep existing entry point (Settings button only).
- [x] Rename tab `Display` → `Controls`.
- [x] Add/update `Backgrounds` tab.
- [x] Rework layout into:
  - Controls: clock visual controls + selected background controls + toggles
  - Backgrounds: category-based catalog and saved/favorites filtering.

### Batch 4 — Control system upgrade
- [x] Add base styled controls:
  - `StyledRangeControl`
  - `StyledToggleControl`
  - `TactileButton`
  - `CTAButton`
  - `GlowButton`
- [x] Add `NumberField`, `ColorSlider`, and segmented choice wrappers inspired by React Aria behavior.
- [x] Ensure accessibility, keyboard focus, and reduced-motion compliance for new controls.

### Batch 5 — Background discovery and preview workflow
- [x] Add category/type tabs: All, Static, Animated, Interactive, Shader, Image, Video, Premium, Saved.
- [x] Replace source-based tab system in Backgrounds view.
- [x] Migrate background choices to card/carousel interaction.
- [x] Add preview-media support in the background metadata/UI path:
  - lazy-load preview media when fields are present,
  - pause offscreen videos,
  - render live background only on selection.
- [x] Generate and attach landscape, square, and vertical WebM preview media assets for each enabled Chimer background.
- [x] Document generate-workflow for previews (Remotion/Puppeteer preference + fallback).
  - [Preview generation workflow doc](chimer-background-preview-media-workflow.md)

### Batch 6 — Color + harmony system
- [x] Add Global Colors area (primary/secondary/accent/background/text/CTA start/end).
- [x] Add palette save + reuse pipeline.
- [x] Add harmony group toggle row with local icons.
- [x] Allow generated palettes to drive Chimer clock/background/button/glow styles.

### Batch 7 — Completion + guardrails
- [x] Add haptic disable safety in all new press interactions.
- [x] Add motion/loader improvements.
- [ ] Verify Chimer still starts and runs without setup. *(Pending: manual run-through on desktop + mobile after this batch)*
- [x] Document music player inspiration only (componentry reference) without implementation.
  - [Music player future note](chimer-music-player-inspiration-note-2026-07-06.md)
- [ ] Update plan/docs only for deferred items if code paths are incomplete.

## Notes
- Step 1 "Enter time" should include presets, custom entry, optional saved presets.
- Step 2 interval should include no interval + presets + custom + optional cue preview.
- Step 3 notification should include sound + visual + vibration combos with intensity/volume controls where relevant.
- Step 4 background should show selected preview, recommended group, quick apply, free/premium markers.
- Setup completion notice text:
  - Chimer can use extra battery power... plug in your device before starting so it does not lose power during the session.
- Keep every new control in existing visual language and dark card-like treatment.
