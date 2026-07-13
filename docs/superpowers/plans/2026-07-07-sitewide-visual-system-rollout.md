# Sitewide Visual System Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the Chimer visual redesign pieces into MassageLab's shared UI system so buttons, sliders, toggles, color pickers, loaders, and haptic press feedback feel consistent across the site without breaking existing workflows.

**Architecture:** Keep the merged Chimer implementation as the reference behavior for the physical/mechanical feel, but do not apply that treatment blindly to every existing button. First complete a sitewide button/control decision audit so every route and shared surface has an assigned action role. Then move reusable primitives into `components/ui` and shared helpers under `lib`. Chimer-specific files stay as compatibility wrappers or route-specific layouts. Keep the rollout on one feature branch and move through review-sized batches: shared primitives first, low-risk account/public surfaces second, tool surfaces third, and dense/admin surfaces last.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, CSS Modules, Radix/shadcn primitives, existing MassageLab app settings, browser Vibration API, existing npm validation scripts, Playwright/browser QA where visual verification is needed.

## Global Constraints

- Preserve existing MassageLab colors and identity. Use the Chimer styling direction and the user's approved orange/blue/brown palettes, not third-party reference colors.
- Do not copy third-party code into shared components unless the license is explicitly compatible. Recreate interaction effects with original MassageLab code when the license, dependency footprint, or performance profile is unclear.
- Treat external visual references as direction, not trade dress. React Bits range controls, Cult UI's metal ring button, and EinUI's Default Glow glass button are reference points for feel and interaction; final styling should be MassageLab-owned and tokenized.
- Keep Chimer, Anatomime, calendar workspace, and other route-owned experiences functional while migrating shared primitives.
- Preserve keyboard support, focus states, disabled states, and accessible names.
- Respect `prefers-reduced-motion`; tactile depression can remain, but springy or attention-ring motion must reduce or stop.
- Haptics should be sitewide where appropriate for physical press feedback. They must use the existing app setting, remain user-disableable, avoid hover feedback, avoid double-vibration across activation paths, and fail silently when `navigator.vibrate` is unavailable.
- Do not add new premium gates during the visual-system rollout. If a control is gated elsewhere, use feature-key entitlements and make disabled reasons clear on hover/focus/click.
- Keep PHI-bearing notes, intake, journal, ROM, and clinical workflows local-first. This rollout should be visual and interaction-level only.
- Avoid one large "restyle everything" PR. Each implementation batch should be reviewable, validated, and reversible.
- Do not remove Chimer-specific behavior until shared wrappers have parity and Chimer has been re-tested.

---

## Button And Control Direction

The desired button language is physical/mechanical, using the Chimer Continue button as the reference for high-intent actions. Cohesion does not mean every button should be equally tactile or visually loud. Some existing buttons are already appropriate for their job; those should receive only the shared spacing, focus, pressed, disabled, and token treatment needed to feel consistent.

Use this taxonomy before changing visual styles:

- **Mechanical primary:** high-intent forward actions such as Continue, Start, Begin session, Save important setup choices, Submit, Create, Book, Subscribe, Upgrade, and Send support message. These should be closest to the Chimer Continue button.
- **Mechanical secondary:** important but less dominant actions such as Back, Retry, Sync, Review plans, Save draft, Export, Copy/share a primary artifact, and guided-step alternatives. These can feel physical but quieter than primary.
- **Strategic attention:** rare acquisition or monetization actions such as Sign up, Subscribe, Upgrade, Start membership, and similarly important public CTAs. These may use an animated metal ring or glass glow accent if the surface review confirms the extra attention is warranted.
- **Quiet utility:** shell controls, icon buttons, navigation drawer controls, table/admin row actions, filter chips, date navigation, calendar range controls, previous/next controls, and repeated dense-workspace actions. These should stay compact and calm while sharing the same focus/pressed state language.
- **Text/link actions:** legal links, inline navigation, low-emphasis help, reset, and subtle secondary actions. These should remain text-like unless a surface review says otherwise.
- **Route-owned controls:** Chimer immersive controls, Anatomime gameplay controls, calendar workspace controls, admin anatomy/media review controls, public booking date/time selection, and local-first clinical form controls must be reviewed in context before migration.

The audit should classify all surfaces before implementation starts, then each PR should migrate only the classifications approved for that batch.

---

## Current Confirmed Anchors

- Shared button primitive: `components/ui/button.tsx`
  - Already has tactile-ish shadow and active transform styling.
  - Needs the final orange primary and blue secondary treatment to become canonical instead of relying on one-off `className="bg-primary hover:bg-brand-orange-glow"` overrides.
- Shared app surface helpers: `components/ui/app-surface.tsx`
  - Already centralizes page shell, surface, inset, action row, media tile, and notice styles.
  - Keep using this for account/public tool surfaces; do not force it onto Chimer full-screen surfaces.
- Shared haptic helper: `lib/haptics.ts`
  - Reads `massage-lab-settings.hapticFeedbackEnabled`.
  - Triggers the browser Vibration API safely.
- Chimer-specific visual controls:
  - `components/chimer-controls/TactileButton.tsx`
  - `components/chimer-controls/CTAButton.tsx`
  - `components/chimer-controls/GlowButton.tsx`
  - `components/chimer-controls/StyledRangeControl.tsx`
  - `components/chimer-controls/StyledToggleControl.tsx`
  - `components/chimer-controls/NumberField.tsx`
  - `components/chimer-controls/ColorSlider.tsx`
  - `components/chimer-controls/GlobalColorPicker.tsx`
  - `components/chimer-controls/Loader.tsx`
  - `components/chimer-controls/HarmonyToggleGroup.tsx`
- App settings provider:
  - `components/providers/settings-provider.tsx`
  - `lib/app-settings.js`
  - `app/account/app-settings-panel.tsx`
  - Existing key: `hapticFeedbackEnabled`
- Existing shared controls to upgrade:
  - `components/ui/slider.tsx`
  - `components/ui/switch.tsx`
  - `components/ui/toggle.tsx`
  - `components/ui/toggle-group.tsx`
  - `components/ui/input.tsx`
  - `components/ui/popover.tsx`
  - `components/ui/select.tsx`
  - `components/ui/tooltip.tsx`

---

## PR Batch Plan

0. Batch 0 or planning checkpoint: all-surface button/control decision audit. No style migration until this is reviewed.
1. Batch 1: Shared primitive extraction, compatibility wrappers, and homepage-visible CTA/tool button migration with opt-in mechanical variants first.
2. Batch 2: Account, settings, remaining public CTA surfaces, login/register, pricing, support, legal, about, and roadmap surfaces.
3. Batch 3: Wellness, business-planner, education, notes, public booking, music, and browse controls.
4. Batch 4: Admin, calendar, Anatomime, and dense tool surfaces after the primitives are stable and each surface decision is confirmed.
5. Batch 5: Chimer cleanup pass that removes duplicate Chimer-only implementations only after shared primitives have proven parity.

After each batch:

1. Run the validation commands for the touched scope.
2. Run CodeRabbit on the current branch diff.
3. Fix only still-valid CodeRabbit issues for that batch.
4. Stop for user visual inspection before starting the next batch.

---

## Task 1: Create a Current UI Inventory

- [x] Start a new feature branch from fresh `main`.

```powershell
git switch main
git pull --ff-only
git switch -c codex/sitewide-control-system-foundation
```

- [x] Capture the current component usage inventory.

```powershell
rg -n -e 'from "@/components/ui/button"' -e '<Button' app components --glob '*.tsx' > C:\tmp\massagelab-button-usage.txt
rg -n -e 'type="range"' -e 'from "@/components/ui/slider"' -e '<Slider' app components --glob '*.tsx' > C:\tmp\massagelab-slider-usage.txt
rg -n -e 'from "@/components/ui/switch"' -e '<Switch' -e 'from "@/components/ui/toggle"' -e '<Toggle' app components --glob '*.tsx' > C:\tmp\massagelab-toggle-usage.txt
rg -n -e 'input type="color"' -e 'ColorPicker' -e 'ColorPickerSwatch' app components --glob '*.tsx' > C:\tmp\massagelab-color-control-usage.txt
```

- [x] Add a full audit note at `docs/audits/2026-07-07-sitewide-visual-control-inventory.md`.
  - Include counts for buttons, range controls, switches/toggles, and color controls.
  - Classify every route and shared component group into one of the button/control roles above.
  - Include a route-by-route decision map for:
    - Shell/navigation: mobile main bar, quick actions, sidebar, top bar, theme switcher, global music player.
    - Public and marketing: homepage, tools, pricing, support, legal, about, roadmap, anatomy corrections.
    - Auth/account/onboarding: login, register, password reset, email verification, onboarding, account home, security, settings, preference sync.
    - Education: education hub, flashcards setup, deck browsing, runner, progress dashboard.
    - Wellness: wellness hub, pattern reports, ROM, body sensation, reminders, breathing guide.
    - Business planner: income, break-even, launch checklist, service menu, plan outline, add-on profit.
    - Local-first records: notes hub, professional-record vault, SOAP, intake, journal, ROM, transcript review, body diagram, consent and info panels.
    - Public booking: booking landing page, service/details/time picker, waitlist, login/guest prompts, distance check, date/time controls.
    - Calendar management: calendar home, top bar, workspace, creation menu, appointment/personal/class/reminder forms, requests, services, availability, sync, booking settings, share links.
    - Admin: admin dashboard, anatomy browser, media review queue, BodyParts3D import helpers.
    - Anatomime: landing/setup, local game, host room, shared session join/player flows.
    - Chimer/Clock/Music/Browse: Chimer setup, running timer, settings modal, background picker, Clock route, Music page, Browse compatibility workspace.
    - Shared primitives: Button, Slider, Switch, Toggle, ToggleGroup, AppSurface action rows, Calendar, Carousel, Pagination, Sidebar.
  - Record any route-owned exceptions that should not be forced into the shared visual pattern.
- Identify buttons that are essentially fine as-is and should only receive token/focus/pressed-state alignment.
- Identify buttons that should become mechanical primary or mechanical secondary.
- Identify buttons that qualify for strategic attention treatment.
- Identify dense surfaces where shared variants must stay compact.

Expected result:

```text
docs/audits/2026-07-07-sitewide-visual-control-inventory.md created with an all-surface decision map and migration role assignments.
```

---

## Task 2: Promote Shared Press Feedback

- [x] Create `lib/press-feedback.ts`.
  - Move handler-wrapping logic from `components/chimer-controls/haptics.ts` into this shared file.
  - Keep `triggerHapticFeedback` in `lib/haptics.ts`.
  - Export helpers for mouse, touch, keyboard, and click activation.
  - Do not vibrate on hover.
  - Do not double-vibrate when keyboard activation also fires click.

Target interface:

```ts
import type { HapticPattern } from "@/lib/haptics"

export interface PressFeedbackOptions {
  disabled?: boolean
  hapticsEnabled?: boolean
  hapticDurationMs?: HapticPattern
}

export function playPressFeedback(options?: PressFeedbackOptions): void
export function wrapPressHandler<EventType>(
  handler: ((event: EventType) => void) | undefined,
  options?: PressFeedbackOptions,
): (event: EventType) => void
```

- [x] Update `components/chimer-controls/haptics.ts` to re-export the shared helpers.
  - Keep Chimer imports working.
  - Do not create a parallel haptic implementation.

Expected result:

```text
Chimer controls and future shared components use the same press-feedback helper.
```

Validation:

```powershell
npm run typecheck
npm run lint
```

---

## Task 3: Make `components/ui/button.tsx` the Canonical Button System

- [x] Extend `ButtonProps` in `components/ui/button.tsx`.
  - Add optional `hapticsEnabled?: boolean`.
  - Add optional `hapticDurationMs?: HapticPattern`.
  - Add optional `pressFeedback?: boolean`.
  - Default `pressFeedback` to true only where it does not create double feedback through wrappers or route-owned controls.
  - Keep `pressFeedback` false for `variant="link"` unless a caller opts in.
  - Keep haptics disabled when `disabled` or `aria-disabled` is true.

- [x] Update `buttonVariants`.
  - Keep the existing `default` usable for ordinary actions unless the audit explicitly promotes it.
  - Add the orange physical/mechanical treatment similar to the approved Chimer Continue button as an opt-in primary variant.
  - Add a quieter blue physical/mechanical variant for secondary forward actions. Avoid black/right-side gradients.
  - Keep `outline`, `ghost`, and `link` quieter for dense surfaces.
  - Add `cta` for high-attention orange CTA buttons.
  - Add `ctaBlue` for high-attention blue CTA buttons.
  - Add `glow` for glass/default-glow style premium, empty-state, or polished secondary actions.
  - Add `attention` only for strategic sign up, subscribe, upgrade, begin session, save important setup choices, and support CTAs.
  - Use the adopted `MetalAttentionButton` wrapper only after the audit confirms a strategic CTA belongs there; the wrapper uses the MIT `metal-fx` package, suppresses motion for reduced-motion users, and keeps production rings on a rare pulse cadence rather than normal utility controls.
  - Preserve existing `size` variants.

Suggested variant names:

```ts
variant: {
  default: "...orange tactile...",
  secondary: "...blue tactile...",
  cta: "...orange gradient tactile...",
  ctaBlue: "...blue gradient tactile...",
  glow: "...glass glow...",
  attention: "...gradient plus animated ring...",
  destructive: "...destructive tactile...",
  outline: "...quiet tactile outline...",
  ghost: "...low chrome...",
  link: "...text link...",
}
```

- [x] Use CSS variables for shared button colors instead of repeating raw gradients in route files.
  - Add variables in `app/globals.css` if they do not already exist:

```css
:root {
  --button-orange-start: var(--brand-orange);
  --button-orange-end: var(--brand-orange-glow);
  --button-blue-start: 222 79% 58%;
  --button-blue-end: 216 88% 46%;
  --button-depth-border: 24 18% 12%;
}
```

- [x] Respect reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  .tactile-button-motion {
    transition-duration: 0.01ms;
  }
}
```

- [x] Update Chimer wrappers:
  - `components/chimer-controls/TactileButton.tsx` should wrap `Button` with the shared press feedback instead of duplicating handler wrapping.
  - `components/chimer-controls/CTAButton.tsx` should render `Button variant="cta"` plus Chimer-only class names only when needed.
  - `components/chimer-controls/GlowButton.tsx` should render `Button variant="glow"`.

Expected result:

```text
All callers can opt into the same tactile visual language through shared variants, with Chimer wrappers preserving compatibility and dense surfaces staying quiet unless reviewed.
```

Validation:

```powershell
npm run typecheck
npm run lint
npm run test -- --runInBand
```

If `npm run test -- --runInBand` is not a valid script shape, run the repo's standard test command instead:

```powershell
npm run test
```

---

## Task 4: Replace One-Off Button Color Overrides in Low-Risk Surfaces

- [x] Migrate these patterns first:

```tsx
<Button className="bg-primary hover:bg-brand-orange-glow">
<Button className="w-full bg-primary hover:bg-brand-orange-glow">
<Button className="justify-self-start bg-primary hover:bg-brand-orange-glow">
```

- [x] Replace them with variants:

```tsx
<Button variant="cta">
<Button variant="cta" className="w-full">
<Button variant="cta" className="justify-self-start">
```

- [x] First migration group:
  - `app/login/login-form.tsx`
  - `app/register/register-form.tsx`
  - `app/reset-password/reset-password-form.tsx`
  - `app/verify-email/page.tsx`
  - `app/support/support-contact-form.tsx`
  - `app/support/support-diagnostic-report.tsx`
  - `app/pricing/page.tsx`
  - `components/membership/pricing-cards.tsx`
  - `app/about/page.tsx`
  - `app/about/derrick/page.tsx`
  - `app/roadmap/page.tsx`

- [x] Second migration group:
  - `app/account/page.tsx`
  - `app/account/security/security-panel.tsx`
  - `app/account/account-settings-shell.tsx`
  - `app/account/app-settings-panel.tsx`
  - `app/account/preference-sync.tsx`

- [x] Keep icon-only shell/navigation buttons conservative.
  - Do not apply high-attention CTA variants to `components/shell/mobile-main-bar.tsx` or `components/shell/quick-action-speed-dial.tsx` unless specifically reviewing those surfaces.

Batch note, 2026-07-09:

- Removed the remaining low-risk `bg-primary hover:bg-brand-orange-glow` button overrides from the listed public, auth, support, pricing, membership, about, roadmap, account, and security surfaces.
- Auth/save/setup/account primary actions now rely on the shared default molded button; public about links use the quieter secondary treatment; pricing, membership checkout, and roadmap acquisition/donation actions use shared CTA variants.
- `app/account/account-settings-shell.tsx`, `app/account/app-settings-panel.tsx`, and `app/account/preference-sync.tsx` had no matching one-off orange button overrides in this batch, so their existing quiet/dense controls were left unchanged.
- `/dev/buttons` now includes current rollout examples for the public/auth/account surfaces in this batch so visual review can compare the exact shared variant choices before page-by-page inspection.

Expected result:

```text
Primary site actions use shared orange CTA or blue secondary variants instead of hand-authored gradient classes.
```

Validation:

```powershell
npm run typecheck
npm run lint
```

Visual QA:

- `/login`
- `/register`
- `/pricing`
- `/support`
- `/account`
- `/about`

Check desktop and mobile widths.

---

## Task 5: Promote Styled Range Controls

- [ ] Create `components/ui/range-control.tsx` from the Chimer `StyledRangeControl` behavior.
  - Keep native `<input type="range">`.
  - Preserve `min`, `max`, `step`, `value`, `disabled`, and keyboard accessibility.
  - Use the React Bits reference shape as the target visual language:
    - Recessed dark capsule track.
    - Large rounded fill segment behind the label.
    - Subtle vertical tick marks across the track.
    - Right-aligned numeric value/unit.
    - Chunky vertical thumb/handle.
    - Compact 40px-ish control height where space is tight.
  - Use label-left and value-right layout.
  - Use a compact height suitable for non-Chimer tools.
  - Expose a `density` prop with `default`, `compact`, and `dense`.
  - Expose a `surface` or variant option if dark/recessed styling needs a lighter adaptation on bright forms.

Target interface:

```ts
export interface RangeControlProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  displayValue?: string
  description?: string
  disabled?: boolean
  density?: "default" | "compact" | "dense"
  hapticsEnabled?: boolean
}
```

- [ ] Update `components/chimer-controls/StyledRangeControl.tsx`.
  - Either re-export `RangeControl` or wrap it with Chimer-specific default styling.
  - Keep Chimer existing props compatible.

- [ ] Upgrade `components/ui/slider.tsx`.
  - Keep Radix slider semantics.
  - Update its track/thumb styling to match the MassageLab control language.
  - Do not replace Radix slider with native range in places where Radix is already used.

- [ ] Migrate range usages sitewide unless the surface audit identifies a more appropriate local control.
  - Use the full React Bits-inspired range for roomy customization/settings surfaces.
  - Use compact/dense adaptations for Music volume, calendar, booking, admin, and repeated tool controls.
  - Use specialized pickers instead of sliders when the value model is better served by another control, such as H:M:S duration pickers.

- [ ] Leave dense Chimer background option ranges alone until the shared control is proven. Chimer has many route-specific controls inside `app/chimer/running-timer.tsx`; migrate those in the Chimer cleanup PR.

Expected result:

```text
New range controls no longer look like plain browser sliders, and existing Radix sliders get a matching visual treatment.
```

Validation:

```powershell
npm run typecheck
npm run lint
```

Visual QA:

- Keyboard arrow adjustment.
- Tab focus visibility.
- Disabled state.
- Mobile touch drag.
- Reduced motion.

---

## Task 6: Promote Toggle, Switch, and Segmented Controls

- [ ] Update `components/ui/switch.tsx`.
  - Adapt the Chimer/React Bits-style physical toggle treatment where it fits.
  - Preserve Radix switch role and state attributes.
  - Add optional haptic press feedback through shared helpers.
  - Keep compact sizing for dense forms.

- [ ] Update `components/ui/toggle.tsx` and `components/ui/toggle-group.tsx`.
  - Add tactile selected state.
  - Keep outline and ghost variants for dense contexts.
  - Use blue secondary selected styling when the action is not primary/orange.

- [ ] Create `components/ui/toggle-control.tsx`.
  - This is the sitewide equivalent of `StyledToggleControl`.
  - Use a shared container, label, description, and switch/toggle on the right.
  - Provide roomy, compact, and dense layouts so settings pages, filters, and admin tools can use the same grammar without feeling oversized.

Target interface:

```ts
export interface ToggleControlProps {
  label: string
  description?: string
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  disabled?: boolean
  hapticsEnabled?: boolean
  className?: string
}
```

- [ ] Update `components/chimer-controls/StyledToggleControl.tsx` to wrap `ToggleControl`.

- [ ] Create `components/ui/segmented-toggle-group.tsx`.
  - Use the React Aria ToggleButtonGroup behavior as an interaction reference.
  - Keep implementation local using existing Radix/shadcn primitives.
  - Support labels, icons, horizontal scroll or wrapping, selected state, disabled state, and tooltips.

Expected result:

```text
Switches, binary controls, and segmented options share one MassageLab tactile system.
```

Validation:

```powershell
npm run typecheck
npm run lint
```

Visual QA:

- `/account/settings` or the account settings route that exposes haptics.
- `/chimer` settings modal.
- Any existing toggle-group route found in the inventory.

---

## Task 7: Promote the Color Picker

- [ ] Create `components/ui/color-picker.tsx`.
  - Use the Chimer `GlobalColorPicker` internals as the implementation source.
  - Use existing `components/ui/popover.tsx`.
  - Match the Dice UI visual composition:
    - Trigger is a clean color swatch, not a swatch inside an extra visible container.
    - Popover contains a color area.
    - Popover contains an eye-dropper button when supported.
    - Popover contains a hue slider.
    - Popover contains format select and hex input.
    - Do not include an alpha/transparency slider for this rollout.
  - Keep hex normalization and keyboard/pointer support.

Target exports:

```ts
export function ColorPicker(props: ColorPickerProps): JSX.Element
export function ColorPickerSwatch(props: ColorPickerSwatchProps): JSX.Element
export function ColorPickerField(props: ColorPickerFieldProps): JSX.Element
```

- [ ] Update `components/chimer-controls/GlobalColorPicker.tsx`.
  - Import shared `ColorPickerField` and `ColorPickerSwatch`.
  - Keep Chimer's `GlobalColorPicker` layout and palette-saving behavior in place.

- [ ] Treat the color picker as the canonical sitewide color input.
  - Migrate every current and future color input to the shared color picker unless a surface has a documented reason not to.
  - Keep Chimer first because it already owns the richest color workflow.

- [ ] Create `components/ui/global-color-settings.tsx` when a non-Chimer sitewide settings panel needs the same field layout.
  - Keep fields as `Primary color`, `Color 2`, `Color 3`, `Color 4`, `Color 5`, `Color 6`.
  - Put harmony controls inside this section, above the generated colors.
  - Remove redundant preview cards when the selected swatches already show the values.

- [ ] Migrate current color inputs in Chimer first.
  - Clock color.
  - Lamp main color.
  - Lamp orb color.
  - Global colors.

- [ ] Migrate non-Chimer color inputs after Chimer color picker behavior is stable.

Expected result:

```text
Color pickers open reliably, look like standalone swatches, and use one shared popover implementation without an alpha slider.
```

Validation:

```powershell
npm run typecheck
npm run lint
```

Manual QA:

- Open the color picker by mouse, touch, and keyboard.
- Pick from the color area.
- Drag the hue slider.
- Type a hex value.
- Cancel by clicking outside.
- Confirm account-synced Chimer colors still persist when signed in.

---

## Task 8: Promote Number and Color Slider Fields

- [ ] Create `components/ui/number-field.tsx` from the Chimer `NumberField`.
  - Preserve native number input semantics.
  - Keep compact steppers optional.
  - Use shared press feedback for stepper buttons.

- [ ] Create `components/ui/color-slider.tsx` from the Chimer `ColorSlider`.
  - Keep single-channel controls for hue, saturation, brightness, lightness, opacity, and RGB channels.
  - Use the shared `RangeControl` visual language.
  - Do not force all numeric range controls to become color sliders.

- [ ] Update Chimer wrappers:
  - `components/chimer-controls/NumberField.tsx`
  - `components/chimer-controls/ColorSlider.tsx`

Expected result:

```text
Incremental numeric controls and single-channel visual controls are reusable outside Chimer.
```

Validation:

```powershell
npm run typecheck
npm run lint
```

---

## Task 9: Promote Loader and Loading States

- [x] Create `components/ui/loader.tsx` from `components/chimer-controls/Loader.tsx`.
  - Preserve the orange dithered sphere default.
  - Support `shape="sphere"`, `variant="dither"`, `color`, `speed`, `size`, and accessible labels.
  - Respect reduced motion with a static or slower state.

- [x] Update `components/chimer-controls/Loader.tsx` to re-export or wrap the shared loader.

- [x] Use the orange dithered loader sitewide any time a true loader is needed.
  - Keep skeletons or inline progress where they are more informative than a spinner.
  - Use the loader for indeterminate waits, generation/prep states, async saves, uploads/imports, and visual/background loading.

- [x] Replace obvious low-risk loading states:
  - Chimer background preview loading preserved through the shared compatibility re-export.
  - Palette generation reviewed; it remains synchronous, so no loader was added.
  - Account/settings async save states.
  - Support form sending state if it does not disrupt layout.

Batch note, 2026-07-12:

- Added `components/ui/loader.tsx` from the published `ds.asanshay.com` shadcn registry loader as the canonical labeled shader-based dithered sphere loader.
- Replaced the earlier CSS approximation with the source shader-based sphere/dither renderer while preserving MassageLab orange defaults, accessible labels, and reduced-motion handling.
- Updated omitted `shape` props to randomly select sphere, swirl, or ripple per loader instance while preserving explicit shapes for fixed comparison examples.
- Kept `components/chimer-controls/Loader.tsx` as a compatibility re-export so existing Chimer preview loading stays on the same implementation.
- Added `/dev/buttons` loader examples for size, color, sphere/swirl/ripple comparison, and inline decorative action states.
- Migrated low-risk indeterminate waits in the account Suspense fallback, account preference sync action, and support diagnostic send action.
- Left determinate music preparation on `Progress` and left palette generation without a loader because the current path has no async wait state.

Expected result:

```text
Loading states use one MassageLab premium-feeling loader where appropriate, without adding animation noise everywhere.
```

Validation:

```powershell
npm run typecheck
npm run lint
```

---

## Task 10: Migrate Site Surfaces in Safe Batches

### Batch A: Public, Account, and Auth

- [ ] Migrate public CTA buttons to `variant="cta"` or `variant="attention"` only where the action is truly high priority.
- [ ] Migrate secondary account actions to `variant="secondary"` or `variant="outline"`.
- [ ] Replace custom orange hover classes with shared variants.
- [ ] Use `AppSurface`, `AppInset`, `AppNotice`, and shared field controls where they already fit.

Primary files:

```text
app/login/login-form.tsx
app/register/register-form.tsx
app/reset-password/reset-password-form.tsx
app/verify-email/page.tsx
app/support/support-contact-form.tsx
app/support/support-diagnostic-report.tsx
app/pricing/page.tsx
components/membership/pricing-cards.tsx
app/account/page.tsx
app/account/security/security-panel.tsx
app/account/app-settings-panel.tsx
app/about/page.tsx
app/about/derrick/page.tsx
app/roadmap/page.tsx
```

### Batch B: Wellness, Business Planner, and Education

- [ ] Migrate tool buttons and settings controls after Batch A validates.
- [ ] Use compact range/toggle controls for repeated settings.
- [ ] Keep tool layouts dense enough for repeated use.

Primary files:

```text
app/wellness/page.tsx
app/wellness/breathing/page.tsx
components/wellness/*.tsx
app/tools/business-planner/**/*
app/education/flashcards/**/*
```

### Batch C: Notes and Local-First Clinical Tools

- [ ] Migrate buttons and local controls without changing storage behavior.
- [ ] Do not alter clinical data flow, local-first vault behavior, consent, or export logic.
- [ ] Keep focus and contrast high for treatment-room use.

Primary files:

```text
app/notes/**/*
```

### Batch D: Admin, Calendar, Anatomime, and Dense Workspaces

- [ ] Review each dense workspace before migrating.
- [ ] Prefer compact shared variants.
- [ ] Preserve data-table density, keyboard operation, and admin affordances.
- [ ] Treat Anatomime and calendar workspace as route-owned exceptions unless a shared primitive can be swapped without layout changes.

Primary files:

```text
app/admin/**/*
app/calendar/**/*
components/calendar/**/*
app/anatomime/**/*
```

Expected result:

```text
The site uses a consistent MassageLab tactile visual system while route-specific tools retain their ergonomics.
```

---

## Task 11: Chimer Compatibility and Cleanup

- [ ] After Batches A-D, revisit Chimer.
- [ ] Replace Chimer-specific components with shared components only where the visual and behavior parity is exact.
- [ ] Keep Chimer-specific modules when they encode timer/background behavior rather than reusable visual primitives.
- [ ] Run Chimer-specific checks:

```powershell
node --test tests/background-options.test.mjs tests/chimer-entitlements.test.mjs tests/chimer-timer.test.mjs
npm run typecheck
npm run lint
```

- [ ] Verify manually:
  - Setup flow duration clock still uses the digital clickable hour/minute UI.
  - Important buttons keep tactile depression.
  - Haptic setting disables vibration.
  - Chimer settings tabs remain usable on mobile, tablet, and desktop.
  - MassageLab Lamp and the other backgrounds still animate.
  - Account-synced Clock color, Lamp main color, and Lamp orb color still persist for signed-in users.

Expected result:

```text
Chimer keeps the approved experience while duplicate visual code is reduced.
```

---

## Task 12: Validation Matrix

This section means each batch should leave clear proof that the migrated controls still work. It is not a requirement to run every possible browser route for every small style change; choose the narrowest validation that matches the touched surfaces, then record exactly what passed.

Run this command set for each PR batch:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

If the build emits Babel deoptimization notes for large Chimer files, record them as known non-failing warnings when the command exits successfully.

Run browser/visual checks for the surfaces touched in the batch:

```powershell
npm run test:browser
```

When `test:browser` is too broad for the batch, run the existing route-specific browser test pattern used in the repo and record the exact command in the PR notes.

Manual visual checklist:

- Desktop, tablet, and phone widths.
- Dark and light theme modes if the surface supports both.
- Reduced-motion browser setting.
- Keyboard-only operation.
- Touch tap on tactile buttons.
- Haptics enabled and disabled.
- Unsupported haptics environment.
- Form submit buttons.
- Link-style buttons.
- Disabled and loading buttons.
- Range drag, keyboard arrows, and visible focus.
- Switch/toggle press and selected state.
- Color picker open, select, type hex, close.

---

## Task 13: Documentation Updates

Keep documentation proportional. The goal is to prevent future one-off styles and preserve the decision map, not to create a heavy design-system manual before the components prove themselves.

- [x] Update `docs/project-state.md`.
  - Add the currently completed rollout batch.
  - Mention which shared primitives are canonical.
  - List route-owned exceptions.

- [x] Update `docs/project-log.md`.
  - Add dated entries per PR batch.
  - Include validation commands and any known non-failing warnings.

- [x] Add or update `docs/wiki/visual-system.md`.
  - Document button variants and when to use them.
  - Document range, toggle, switch, number field, color picker, and loader usage.
  - Document haptic feedback behavior and opt-out.
  - Document reduced-motion expectations.

- [x] Link the wiki page from `docs/wiki/index.md`.

Expected result:

```text
Future agents and contributors know which shared components to use instead of adding one-off visual styles.
```

---

## Self-Review Checklist

Before each PR:

- [ ] No third-party colors or unlicensed code were copied.
- [ ] No route behavior changed except the intended visual/control component swap.
- [ ] No premium gates were added or removed.
- [ ] Haptics use the shared app setting.
- [ ] Reduced motion is respected.
- [ ] Focus states are visible.
- [ ] Buttons use canonical variants instead of one-off orange/blue classes.
- [ ] Sliders preserve min/max/step and keyboard input.
- [ ] Toggles and switches preserve ARIA/Radix semantics.
- [ ] Color pickers open and update values correctly.
- [ ] Chimer still works after compatibility wrapper changes.
- [ ] Validation commands passed or known non-failing warnings are documented.

---

## Recommended First Implementation Slice

Start with only these files:

```text
docs/audits/2026-07-07-sitewide-visual-control-inventory.md
lib/press-feedback.ts
components/chimer-controls/haptics.ts
components/ui/button.tsx
components/chimer-controls/TactileButton.tsx
components/chimer-controls/CTAButton.tsx
components/chimer-controls/GlowButton.tsx
app/page.tsx
components/home/home-tool-rails.tsx
app/globals.css
docs/project-state.md
docs/project-log.md
```

Stop after the all-surface audit, the opt-in shared button/press-feedback foundation, Chimer compatibility wrappers, and the homepage-visible button pass. Do not touch sliders, toggles, color pickers, route-owned dense workspaces, or broad remaining button migrations until the audit classifications are reviewed.

Completed first-slice validation on 2026-07-08:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Notes:

- `npm run lint` passed after the standard large Chimer file Babel deoptimization notes.
- `git diff --check` passed with Windows line-ending conversion warnings only.
- CodeRabbit review completed on 2026-07-08. Valid feedback was applied for reduced-motion handling, legacy metal-ring interval compatibility, single-child metal-ring enforcement, shared press-feedback cleanup, Chimer CTA ring-wrapper semantics, homepage card focus visibility, and reduced-motion/destructive button CSS coverage. The `.ml-button-tactile` and `.ml-metal-attention-root-idle` selector comments were verified against emitted classes and did not require code changes.
- A follow-up CodeRabbit pass after those fixes applied the remaining valid local items: the Attention disabled gallery example now uses the same wrapper as the enabled state, the signed-out membership CTA uses the lower-priority `ctaBlue` treatment beside the primary account CTA, and the press-feedback default path avoids redundant helper checks. The disabled `asChild` handler concern was already covered by `wrapPressHandler` returning before invoking handlers when `disabled` or `aria-disabled` is set; private Button helper tests and CTA extraction were left out of this visual batch to avoid broadening scope.

---

## 2026-07-12 Main Refresh And Next-Chat Handoff

Current state after the merged `codex/sitewide-toggle-controls` PR:

- `main` has been refreshed from `origin/main`.
- New chats should still start by reading `docs/project-state.md`, `docs/project-log.md`, and `docs/wiki/index.md`; those files remain the current source of truth over this historical rollout checklist.
- `/dev/buttons` is the live review surface for approved shared controls and route-owned proposals before production rollout.
- The checkbox tasks above are retained as the original staged rollout plan. Use this handoff section as the current-status override when a task checkbox has not yet been reconciled.

Merged visual-control foundations:

- Shared buttons, press feedback, and Chimer compatibility wrappers are in place. Haptic feedback should remain click-like on press and release, avoid scroll-pass triggers, and respect the user opt-out setting.
- The metal effect is split into a reusable static ring primitive, a random play/pause attention wrapper, and a button convenience component. Keep the normal and attention versions available, keep reflection-target passthrough available, and avoid coupling ring appearance to later button CSS changes.
- Shared sliders use the split-pill/fader-thumb treatment. Use the compact no-label form when name and value are not needed, and the split label/value form when users need the value. Context-specific left-pill color is the intended differentiation; do not introduce the older roomy range control in new work.
- Shared switch, toggle, toggle-row, and segmented-control treatments are approved, including the physical switch shape, selected-state movement animation, and route-appropriate colors.
- Shared color pickers are approved through `GlobalColorPicker`, `ColorPickerFormInput`, `ColorSlider`, and `NumberField` patterns. All site color inputs should use the shared picker; dark and light swatches should retain the same silhouette and shadow system.
- Route-owned review examples now cover Clock tabs, time-format choices, select fields, side-drawer navigation, Anatomime controls, and the approved Chimer setup selection/action button treatment. Production rollout has started, but route-owned exceptions should stay explicit until promoted to shared components.
- User review after the Chimer select-field rollback confirms Chimer page buttons and route-owned controls are done/protected except for the explicitly reopened setup-button surface. Do not include broader Chimer control restyling in future visual-control batches unless the user explicitly reopens that surface.
- `/dev/buttons` includes the Chimer setup button example using the requested `#4AAAAA` face color, and that treatment is now applied to Chimer setup selection/action buttons only; step navigation such as Continue/Back keeps its prior treatment.

Current completion audit:

- Done: audit, shared button primitive, press feedback/haptics, Chimer compatibility wrappers, homepage/public/auth/account button migrations, sliders/ranges, toggles/switches/segmented controls, shared color pickers, number/color-slider helpers, loader, docs/wiki, approved route-owned examples for Clock, drawer navigation, and Anatomime, plus the Chimer setup selection/action button treatment.
- Protected: Chimer page controls/buttons are already approved and should not be reworked without a new explicit request, except for the now-applied setup-button exception.
- Still optional from the original plan: user-selected non-Chimer route-owned cleanup for dense or product-specific surfaces such as wellness/business/education/notes/public booking/music/admin/calendar/Anatomime, only when a shared primitive can be swapped without reducing usability.

Next-chat starting sequence:

1. Start from refreshed `main` and create a new `codex/...` branch before further implementation.
2. Re-check `/dev/buttons` first, then compare only the production surfaces being touched in the next batch.
3. Continue only with explicitly chosen non-Chimer route-owned tabs, dropdown/select fields, containers, drawer/navigation treatments, loaders, or unmigrated Anatomime/Clock controls. Check the user's current to-do priority before starting another visual-control batch.
4. Keep each PR batch narrow, validate with targeted checks, then use the usual GitHub/CodeRabbit review loop before the next visual-inspection batch.
