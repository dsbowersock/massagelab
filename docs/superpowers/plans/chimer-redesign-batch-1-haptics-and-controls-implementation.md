# Chimer Redesign — Batch 1: Interaction Foundations

## Objective
Complete safe interaction foundations before moving into full Controls/Backgrounds redesign:
- finish tactile/haptic wiring for existing Chimer controls,
- add a reusable local press helper pattern,
- document behavior so future button/slider components can adopt it consistently.

## Files expected to change (current batch)
- `app/chimer/set-timer.tsx`
- `app/chimer/running-timer.tsx`
- `components/chimer/` (or existing Chimer UI components, if they exist)
- `app/account/app-settings-panel.tsx` (if needed for setting clarity polish)

## Work items
1. Add internal `createPressHandler` pattern (or equivalent) in Chimer interaction surfaces to centralize:
   - optional haptic trigger (if enabled),
   - callback execution.
2. Wrap all high-intent control activations with press handling:
   - time preset selection,
   - interval preset selection,
   - notification toggles,
   - background selection/preview quick actions,
   - setup navigation (Back/Next/Start),
   - saved preset save/apply actions,
   - running timer primary controls as appropriate.
3. Ensure keyboard activation also triggers haptic intent while preserving mouse/tap behavior.
4. Add graceful fallback so haptics are no-op when disabled/unavailable.
5. Add brief inline comments where timing-sensitive interaction behavior was adjusted.

## Constraints
- No background conversion/registration logic changes.
- Keep existing Chimer behavior fully functional with defaults.
- Keep existing visual identity and color palette.
- No broad refactors; one feature batch at a time.

## Done criteria for Batch 1
- No new console errors.
- New haptic pattern is used for at least one additional high-intent control in each of setup + active timer surfaces.
- Setting `hapticFeedbackEnabled` respected for each added touch point.
- User has a short in-repo note indicating how to extend this pattern to upcoming stepper and slider/button components.
