# MassageLab Visual System

This page documents the shared visual-control layer that grew out of the July 2026 Chimer/sitewide rollout. Use these primitives before adding one-off classes, route-local button colors, native sliders, or bespoke loading indicators.

## Review Surface

Use `/dev/buttons` as the review route for shared controls and route-owned proposals. It currently shows button variants, sliders, color controls, toggles, route-owned controls, and the indeterminate loader.

## Buttons

Use `components/ui/button.tsx` for button-like actions.

- `default`: primary molded orange action for ordinary forward/save/submit work.
- `secondary`: quieter molded action for important alternate paths.
- `cta` and `ctaBlue`: public acquisition, membership, pricing, and high-attention calls to action.
- `attention`: rare strategic CTA with the metal attention treatment; do not use it for repeated utility controls.
- `glow`: polished secondary or premium-adjacent action when the surrounding surface supports it.
- `outline`: lower-priority tactile action.
- `ghost` and `link`: shell, inline, table, navigation, and dense utility actions.
- `destructive`: destructive action using the shared tactile behavior.

Tactile variants use the shared press-feedback path in `lib/press-feedback.ts`. Feedback respects disabled and `aria-disabled` states and the user's haptic opt-out. Use `pressFeedback={false}` only when a route-owned control already handles its own physical feedback.

## Range And Slider Controls

Use `components/ui/slider.tsx` for Radix slider semantics and `components/ui/range-control.tsx` when a label and visible value should travel with the slider.

Use `RangeControl` for settings where the current numeric value matters. Use the compact `Slider` directly when a surrounding label/value already exists, such as media volume or dense workspace controls.

Use `components/chimer-controls/ColorSlider.tsx` for single-channel color values such as hue, saturation, lightness, alpha, opacity, and RGB-like controls. It wraps `RangeControl` so color-channel sliders keep the same split-pill treatment.

Keep determinate progress bars as progress bars. Do not replace a known percentage, track position, or upload progress with a loader.

## Switches, Toggles, And Segmented Choices

Use `components/ui/switch.tsx` for binary controls and `components/ui/toggle-control.tsx` when a label, description, density, and switch belong together.

Use `components/ui/segmented-toggle-group.tsx` for single-choice mode selectors. It preserves Radix keyboard behavior, supports icon-only choices with tooltips, and uses the shared mechanical selected-state motion.

Use route-owned examples from `/dev/buttons` before promoting dense navigation rows, Clock/Chimer tabs, or Anatomime controls into shared primitives.

## Color Controls

Use the shared Chimer color-control exports for color input until a thinner `components/ui/color-picker.tsx` wrapper exists:

- `ColorPickerInput` for controlled color values.
- `ColorPickerSwatch` for standalone swatch editing.
- `GlobalColorPicker` for multi-color palettes.
- `ColorPickerFormInput` when a native form needs a named hidden value.

Color controls pass explicit string values through `value` and `onValueChange` or `onChange`. Do not synthesize native input events to move controlled color state.

## Loader

Use `components/ui/loader.tsx` for true indeterminate waiting states. The default is the orange shader-based `variant="dither"` treatment with a per-instance random shape: sphere, swirl, or ripple. Callers can tune `shape`, `variant`, `size`, `speed`, `color`, and `label`; pass `shape` only when a fixed visual form is required.

Every visible loader should have a useful label. If a loader is nested inside a button or row that already has visible text, mark the loader decorative with `aria-hidden="true"` and let the surrounding text own the accessible name.

Keep skeletons when the page shape is informative, and keep progress bars when completion is measurable. The loader is for waits where the user cannot be given useful progress.

## Motion And Reduced Motion

Shared controls must respect `prefers-reduced-motion`. Physical press depression can remain, but attention rings, segmented motion, loader animation, and decorative shimmer should reduce or pause.

Do not add hover-only motion or haptics. Press, release, keyboard activation, and explicit pointer interaction are the supported feedback paths.

## Route-Owned Exceptions

Chimer immersive controls, Clock visual/background settings, Anatomime gameplay/setup controls, the dense calendar workspace, admin media review, and local-first clinical forms can keep route-owned layouts when shared primitives would reduce usability or density. Promote those patterns only after a focused `/dev/buttons` review and route-specific validation.
