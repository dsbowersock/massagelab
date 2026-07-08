# Sitewide Visual Control Inventory

Date: 2026-07-07
Branch: `codex/sitewide-control-system-foundation`

## Purpose

This audit records the first-pass decision map for making MassageLab buttons and controls feel cohesive without forcing the Chimer treatment onto dense or route-owned workflows. The approved visual direction is physical and mechanical, with the Chimer Continue button as the strongest local reference.

## Inventory Counts

Read-only inventory commands were run against `app` and `components`:

| Control family | Matches | Files | Notes |
| --- | ---: | ---: | --- |
| Buttons | 433 | 93 | Includes imports and JSX usage of `components/ui/button`. Largest hotspots are admin anatomy, public booking, media review, flashcards, notes intake, browse, account, and home. |
| Range / slider controls | 957 | 12 | Chimer owns nearly all usage: `app/chimer/running-timer.tsx` and `app/chimer/set-timer.tsx` account for 942 matches. |
| Switches / toggles | 17 | 8 | Current usage is small and split across UI primitives, Chimer controls, theme switcher, calendar workspace, and SOAP objective form controls. |
| Color controls | 20 | 2 | Current color picker usage is Chimer-only: `app/chimer/running-timer.tsx` and `components/chimer-controls/GlobalColorPicker.tsx`. |

Top current button hotspots:

- `app/admin/anatomy/page.tsx`: 20 matches.
- `app/book/[practiceSlug]/booking-picker.tsx`: 18 matches.
- `app/admin/anatomy/media-review/page.tsx`: 16 matches.
- `app/education/flashcards/flashcard-runner.tsx`: 16 matches.
- `app/notes/intake/client-page.tsx`: 14 matches.
- `app/browse/workspace.tsx`: 11 matches.
- `app/account/page.tsx`: 11 matches.
- `app/page.tsx`: 10 matches.

## External Reference Notes

These references are direction only. Do not copy third-party component code or visual trade dress into MassageLab without a license and dependency review.

- React Bits scrubber target: dark recessed rounded track, label inside the control, right-aligned value, subtle vertical ticks, rounded fill block, compact height, and a narrow vertical handle. The production CSS bundle currently exposes the `.preview-options` layout rule that keeps scrubbers in the route option grid, while the nested scrubber class names visible in the provided screenshot are not exposed as plain CSS in the current public bundle. Use the screenshot and extracted layout behavior as visual notes, then implement MassageLab-owned styles.
- Cult UI Metal Button target: rare strategic CTA attention ring. The foundation batch adopts the MIT `metal-fx` package through a focused MassageLab wrapper for strategic CTAs only; gallery examples can run continuously for review, while production CTAs should keep a rare pulse cadence, respect reduced motion, and avoid normal utility controls.
- EinUI Default Glow target: glass/glow accent for premium or polished secondary CTAs. Prefer a tokenized CSS implementation over adding a dependency.

## Button Role Taxonomy

- Mechanical primary: forward, high-intent actions such as Continue, Start, Begin session, Save important setup choices, Submit, Create, Book, Subscribe, Upgrade, and Send support message.
- Mechanical secondary: important alternatives such as Back, Retry, Sync, Review plans, Save draft, Export, Copy/share, and guided-step alternatives.
- Strategic attention: rare acquisition or monetization CTAs such as Sign up, Subscribe, Upgrade, Start membership, and similar public conversion buttons. Candidate for future ring/glow treatment.
- Quiet utility: shell controls, icon buttons, filters, table row actions, date navigation, pagination, compact calendar controls, and repeated dense-workspace actions.
- Text/link actions: legal links, inline help, reset links, low-emphasis navigation, and subtle secondary text actions.
- Route-owned controls: Chimer immersive controls, Anatomime gameplay, calendar workspace, admin anatomy/media review, public booking date/time selection, local-first clinical forms, and background customization controls.

## Surface Decision Map

### Shell And Navigation

- Mobile main bar, sidebar, top bar, quick-action speed dial, theme switcher, and music mini-player controls should stay quiet utility. They can share focus, active, disabled, and haptic press language, but should not become large mechanical buttons.
- The main create/plus action may use a compact mechanical primary treatment, but only after checking phone widths and app-bar stacking.
- Navigation labels and route wordmarks remain text/link or brand affordances, not mechanical CTAs.

### Public And Marketing

- Homepage: primary signup/start actions are strategic attention candidates; secondary tool links are mechanical secondary or quiet utility depending on density.
- `/tools`: tool entry actions should be mechanical secondary unless a specific tool launch is the page's primary action.
- `/pricing` and membership cards: subscribe/start membership/upgrade actions are strategic attention candidates. Plan comparison toggles and detail links stay quiet.
- `/support`: send support message is mechanical primary; diagnostic/report helpers are mechanical secondary; support links stay text-like.
- `/legal`, `/about`, `/about/derrick`, `/roadmap`, and anatomy corrections: keep most actions quiet or mechanical secondary. Only submit/correction actions should be mechanical primary.

### Auth, Account, And Onboarding

- Login, register, reset password, verify email, and onboarding submit/continue buttons should become mechanical primary.
- Account save buttons and security setup actions should be mechanical primary when they commit user settings; account navigation shortcuts stay quiet or secondary.
- Sign-out, destructive account actions, and security-sensitive actions need explicit destructive or outline treatment with strong focus states, not flashy attention styles.

### Education

- Flashcard setup Start/Save/Create actions should be mechanical primary.
- Deck browse filters, prompt-mode chips, previous/next controls, and review controls should be quiet utility or compact mechanical secondary.
- Flashcard runner answer/reveal controls need route review before migration because ergonomics and repetition matter more than visual weight.

### Wellness

- Wellness start/log/save actions should be mechanical primary or secondary depending on the workflow step.
- Body region selectors, reminder toggles, ROM entry controls, and breathing guide controls should use compact/dense controls once shared toggle and range variants exist.
- Keep clinical-adjacent copy and states calm; avoid strategic attention effects on self-tracking workflows.

### Business Planner

- Calculate, save worksheet, export/copy, and start template actions are mechanical primary or secondary.
- Repeated worksheet inputs, numeric controls, and sliders should use compact shared controls.
- Tool tabs and field affordances should stay quiet utility.

### Local-First Records

- SOAP, intake, journal, ROM, transcript review, body diagram, consent, and professional-record vault actions must preserve local-first behavior and visible focus.
- Unlock/create vault, save encrypted record, export, import, and submit-review actions are mechanical primary or secondary.
- Step navigation, inline edits, body diagram controls, and repeated clinical fields should stay compact and calm.
- No visual-system migration should change storage, encryption, entitlement checks, consent, or export warning behavior.

### Public Booking

- Continue, choose time, request/book, join waitlist, and guest/contact submit actions are mechanical primary.
- Service selectors, add-on chips, pressure selectors, date/time slots, provider options, and login prompts are route-owned. Apply shared pressed/focus language only after checking the booking flow on mobile.
- Date/time grid controls should stay compact and scannable rather than becoming large CTAs.

### Calendar Management

- Create appointment/personal/class/reminder, save event, sync, connect Google, and publish/share booking link actions are mechanical primary or secondary.
- FullCalendar navigation, view selectors, drag/resize affordances, top-bar controls, requests tables, availability grids, and service row actions are dense route-owned controls.
- Use compact variants and avoid strategic attention effects inside the operator workspace.

### Admin

- Admin dashboard entry points can be mechanical secondary.
- Anatomy browser search/add/import/save actions need compact mechanical secondary or quiet utility treatment.
- Media review approve/reject/request actions are route-owned and should retain fast repeated-use ergonomics. Visual alignment should focus on pressed state, focus, and disabled states, not larger chrome.

### Anatomime

- Landing/setup start and host/join actions can be mechanical primary.
- In-game guess, skip, score, steal, host transfer, and review controls are route-owned gameplay controls. Do not migrate until the shared button language proves it can preserve pace and touch ergonomics.

### Chimer, Clock, Music, And Browse

- Chimer setup and running timer controls are the reference, not the first migration target. Keep them route-owned until shared primitives prove parity.
- Chimer ranges, toggles, color pickers, number fields, harmony controls, and loader are the source for future shared components.
- Clock controls should use the shared color picker and compact settings controls later, while preserving signed-in account sync.
- Music volume and background controls should use compact range/toggle variants later. Playback controls stay quiet icon utility.
- Browse remains compatibility workspace; keep controls compact and avoid public CTA attention effects.

### Shared Primitives

- `components/ui/button.tsx`: add opt-in mechanical, CTA, glow, and attention variants. Do not broadly restyle all existing callers in the foundation batch.
- `components/ui/slider.tsx`: later update Radix slider styling to the MassageLab range language.
- `components/ui/switch.tsx`, `toggle.tsx`, and `toggle-group.tsx`: later add compact physical states and optional haptic press feedback.
- `components/ui/app-surface.tsx`: keep as the current page/surface layout base for account/public/tool surfaces.
- `components/ui/calendar.tsx`, `carousel.tsx`, `pagination.tsx`, and `sidebar.tsx`: keep quiet utility by default.

## Canonical Control Decisions

- Haptics: sitewide where appropriate, user-disableable through `massage-lab-settings.hapticFeedbackEnabled`, no hover haptics, no double vibration across pointer/keyboard activation, and silent no-op when unsupported.
- Sliders/ranges: migrate sitewide in later batches unless a local control is more appropriate. Chimer remains the source; React Bits is the visual reference. Use compact/dense adaptations for repeated tools.
- Toggles/switches/segmented controls: adapt the physical style per surface, with roomy/compact/dense versions.
- Color picker: Chimer's color picker is the canonical source. Promote it to shared UI before migrating other color inputs.
- Loader: the orange dithered Chimer loader becomes the sitewide indeterminate loader. Keep skeletons or inline progress where they communicate more.

## First Implementation Slice

Proceed only with:

- Shared press-feedback helper in `lib/press-feedback.ts`.
- Compatibility re-export from `components/chimer-controls/haptics.ts`.
- Opt-in button variants and press-feedback props in `components/ui/button.tsx`.
- Chimer button wrappers updated to use the shared button foundation.
- Global button tokens in `app/globals.css`.

Do not migrate route buttons, sliders, toggles, color pickers, loader usage, or dense workspace controls in this slice.
