# MassageLab Visual System

This page documents the shared visual-control layer that grew out of the July 2026 Chimer/sitewide rollout. Use these primitives before adding one-off classes, route-local control colors, native ranges, or bespoke loading indicators.

## Review Surface

Use `/dev/buttons` as the development-only visual approval gate for the complete control system. The route is hidden in production and non-indexable. Its review sections cover:

- buttons, tones, effects, sizes, icons, loading, and interaction states;
- segmented controls, tabs, toggles, switches, and exclusive choices;
- native and Radix selects, inputs, textareas, sliders, ranges, and color controls;
- selectable cards, notices, empty states, loaders, progress, and skeletons;
- drawer/app-bar navigation plus card, inset, route, dialog, popover, and flat surfaces;
- protected Chimer, Clock, Anatomime, pricing, account, booking, admin, and wellness specimens.

Review real hover, pressed, focus-visible, disabled, selected, compact, light/dark, reduced-motion, desktop, and phone behavior before approving a new contract or production migration.

The Wellness anatomical map remains a deferred review-only specimen. Do not treat its current artwork or region geometry as approved production UI, and do not include it in S6-S9 rollout batches until a separate anatomy-focused review reopens it.

## Shared Contract Rule

Build one shared authority per control family. Route code chooses intent rather than reconstructing mechanics.

Routes may choose variant, tone, density, effect, selected behavior, and icon treatment. Shared family authorities own height, radius, padding, depth, hover policy, press motion, disabled state, focus-visible behavior, haptics, and selected-state mechanics.

Protected means the approved visual and interaction result must not regress. It does not mean the implementation must remain route-owned.

## Buttons

Use `components/ui/button.tsx` for button-like actions.

- `default`: primary molded orange action for ordinary forward/save/submit work.
- `secondary`: quieter molded action using the reviewed `hsl(204, 100%, 55%)` blue face.
- `cta` and `ctaBlue`: public acquisition, membership, pricing, and high-attention calls to action. CTA and Attention use purple faces with a shared blue lower-right corner; CTA Blue mirrors that relationship with a blue face and violet corner.
- `attention`: rare strategic CTA used with the shared metal attention effect.
- `glow`: polished secondary or premium-adjacent action.
- `outline`: lower-priority outline-only action with no filled face; semantic tones may change its border and content color.
- `ghost` and `link`: shell, inline, table, navigation, and dense utility actions.
- `destructive`: destructive action using the shared tactile behavior.

Button tones are semantic palette overlays:

- `setup`: approved Chimer setup teal (`#4AAAAA`).
- `anatomime`: Anatomime action intent while preserving the shared physical construction.
- `pricing`: stable pricing/donation color authority.

Button effects are independent from tone. Use `effect="glowFlicker"` for the reviewed donation flicker and `MetalAttentionRing` or `MetalAttentionButton` for an always-on or scheduled metal ring. Use `size="compact"` for short action rows that are still normal buttons.

The global theme switcher consumes shared button variants directly: it uses `glow` while dark mode is active and `default` while light mode is active.

Button highlight material is theme-stable: molded upper edges use the dedicated light-reflection token in both themes instead of deriving from `foreground`. Dark-mode Glow is protected and retains its approved face, geometry, hover, press, and halo unchanged. The light-mode override starts from that same dark-slate identity and orange edge, then borrows only GlassCN `liquid` material cues—layered sheen, bottom lens, side rails, and backdrop blur/saturation—so the glass remains visible against a bright page without creating a second button construction. Pricing/donation faces keep their approved surface instead of becoming transparent. The `setup` tone is reusable setup intent; Chimer is its first consumer, not its owner.

Current Glow review correction: the light-theme face uses translucent orange layers derived from the Default palette rather than the earlier slate fill. Its layered sheen, bottom lens, side rails, blur, orange edge, and halo remain light-only material treatment; dark-mode Glow remains protected and unchanged.

Outline buttons keep the shared focus, disabled, press, and geometry contracts, but their content remains flat: do not apply tactile inset text shadows or icon filters. Light-mode Glow may use a stronger orange halo for contrast against bright surfaces without changing the protected dark-mode face or halo. Metal attention wrappers must fit the emphasized child rather than inherit grid-row height. Quick-create uses shared Default in both shell bars, and the theme control belongs at the outer edge opposite the configured sidebar.

Use `components/ui/accelerating-step-button.tsx` for compact stepper actions that need immediate single steps, a larger quick double press, and accelerated one-step repetition while held. The Chimer duration specimen uses one-minute single/held steps and five-minute double presses.

Tactile variants use `lib/press-feedback.ts`. Feedback respects disabled and `aria-disabled` states and the user's haptic opt-out.

Production rollout status: S6 ordinary actions use shared Button directly or through thin semantic aliases. Chimer setup actions select the `setup` tone, Continue keeps the shared default face inside its always-on ring, Anatomime maps primary/secondary/destructive intent to shared default/outline/destructive variants with the `anatomime` tone, and pricing donations compose `tone="pricing"` with `effect="glowFlicker"`. Route classes may control only layout participation such as width or flex basis.

## Tabs, Segmented Controls, Toggles, And Switches

Use `components/ui/tabs.tsx` for shared tab lists and triggers. Lists support default/inset construction, default/compact density, and default/setup/Anatomime/attention tones. The reviewed default selected face is `hsl(248, 25%, 40%)`.

Use `components/ui/segmented-toggle-group.tsx` for exclusive mode selectors. It preserves Radix keyboard behavior, supports icon-only choices with tooltips, uses visible inactive hover/press feedback and an inset focus outline, and uses shared mechanical selected-state motion. Its `fit` option compresses equal-width icon segments when every option must remain visible on a narrow screen.

Use `components/ui/switch.tsx` for binary controls, `components/ui/toggle.tsx` for standalone pressed controls, and `components/ui/toggle-control.tsx` when a label, description, density, and switch belong together. Switch tracks do not translate on press; only the theme-stable neutral/silver thumb compresses and moves. The thumb does not inherit route color or invert between themes. Selected alert toggles use a lighter pink edge so their lower-right construction stays distinct from destructive depth.

## Selects, Inputs, And Textareas

Use `components/ui/select.tsx` for portaled Radix menus and `components/ui/select-field.tsx` for browser-native selects. Both use the approved Clock-style inset face and expose default/compact/dense density, default/inset/cutout surfaces, route tones, disabled state, and error state.

Use `components/ui/input.tsx` and `components/ui/textarea.tsx` for text entry. They expose the same density, surface, tone, and error vocabulary. Native input types that are structurally different—hidden, file, checkbox, radio, and color internals—keep their native semantics.

Dense admin layouts may choose dense variants and route-specific grid placement; they must still use the shared field, select, switch, and button families.

## Range And Slider Controls

Use `components/ui/slider.tsx` for Radix slider semantics and `components/ui/range-control.tsx` when a label and visible value should travel with the slider.

Use `RangeControl` where the current numeric value matters. Use compact `Slider` when a surrounding label/value already exists, such as media volume or dense workspace controls.

Use `components/chimer-controls/ColorSlider.tsx` for single-channel color values. It wraps `RangeControl` so hue, saturation, lightness, alpha, opacity, and RGB-like controls keep the same split-pill treatment.

Keep determinate progress bars as progress bars. Do not replace a known percentage, track position, or upload progress with a loader.

## Color Controls

Use the shared Chimer color-control exports until a thinner `components/ui/color-picker.tsx` authority is introduced:

- `ColorPickerInput` for controlled color values.
- `ColorPickerSwatch` for standalone swatch editing.
- `GlobalColorPicker` for multi-color palettes and the Harmony picker. Harmony icon choices use responsive individual CTA Blue buttons rather than a segmented track; the selected family uses the shared Attention face and fitted metal ring. Palette swatches share one six-color row without individual card containers.
- `ColorPickerFormInput` when a native form needs a named hidden value.

Color controls pass explicit strings through `value` and `onValueChange` or `onChange`. Do not synthesize native input events.

## Selectable Cards

Use `components/ui/selectable-card.tsx` for card-shaped choices such as booking services/providers, flashcard setup prompts, and purpose-shaped Anatomime choices.

Selectable cards support default/orange/setup/Anatomime/quiet tones, default/compact/dense layouts, selected state, disabled state, and optional icon inset. Gameplay objects may retain route-specific information layout while composing these shared mechanics.

## Notices, Loading, And Empty States

Use `components/ui/notice.tsx` for info, success, warning, error, sync, loading, and empty status surfaces. Error and warning tones use alert semantics; non-urgent states use status semantics. Loading notices render the shared loader at a compact status size and omit a fixed shape so sphere, swirl, or ripple is selected randomly.

Error notice copy must remain high-contrast against its tinted surface. Determinate progress uses a muted inset remainder track and a vivid filled segment so partial and complete states remain distinguishable in both themes.

Use `components/ui/loader.tsx` for true indeterminate waits. The default randomly selects sphere, swirl, or ripple. Pass a fixed shape only when the visual form itself is under review. Button loaders use the shared 18px mini treatment; production buttons normally omit `shape` so any of the three approved forms may appear.

Every visible loader needs a useful label. If surrounding visible text owns the accessible name, mark the nested loader decorative. Keep skeletons when content shape is informative and progress bars when completion is measurable.

## App Surfaces And Navigation

Use `components/ui/app-surface.tsx` for card, inset, route, dialog, popover, and flat/no-gradient construction. Structural surfaces must not borrow Button geometry.

Ordinary topbar and bottom-navigation destinations use CTA Blue while retaining shell-specific size and accessible names. The quick-create plus and theme control keep their semantic variants. Drawer/sidebar toggles mirror the theme control: shared Default in light mode and shared Glow in dark mode.

Drawer categories and nested route rows remain in the existing sidebar family because they are shell-only controls. Do not add a general navigation-row primitive until a real second consumer appears. Topbar and bottom-navigation icon actions use shared Button variants and shell-specific touch sizing.

## Motion And Reduced Motion

Shared controls must respect `prefers-reduced-motion`. Physical press depression may remain, but attention rings, segmented motion, loaders, and decorative shimmer must reduce or pause.

Do not add hover-only lift or haptics. Press, release, keyboard activation, and explicit pointer interaction are the supported feedback paths.

## Route-Owned Exceptions

Route ownership is structural, not a license to duplicate normal-control styling.

- Chimer immersive layout, specialized picker internals, dense calendar placement, gameplay objects, and local-first clinical form layout may remain route-owned where their structure is genuinely specialized.
- Booking choices use `SelectableCard`; dense admin controls use shared field/select/toggle/button families.
- Drawer rows remain in the sidebar family while they have no non-shell consumer.
- Flashcard informational-carousel pagination dots remain unchanged.
- Wellness body-region selection is a deferred route-owned anatomical visualization. The `/dev/buttons` specimen remains a review prototype only and is explicitly excluded from the production design rollout until its renderer and region geometry receive separate visual approval. The prototype explores an accessible anterior/posterior SVG map plus a keyboard-operable list over renderer-independent region IDs and selection state, using direct and lateral Openclipart references under CC0/public-domain terms. A later approved SVG or 3D renderer may reuse the canonical region contract; the current prototype must not be treated as production-ready.

Any exception still adopts shared tokens, focus, selected, disabled, motion, and accessibility policy wherever technically practical. Review it in `/dev/buttons` before production changes.
