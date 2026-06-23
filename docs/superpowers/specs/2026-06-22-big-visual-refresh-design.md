# Big Visual Refresh Design

Date: 2026-06-22

## Purpose

MassageLab should feel more modern, media-rich, and mobile-native while staying professional and consistent with its current product boundaries. The refresh adapts the strongest ideas from the annotated layout references:

- A bottom-first mobile shell with persistent high-value actions.
- A Radarr-style quick-action speed dial.
- YouTube Music-inspired rails, visual tiles, and bottom-stacked audio behavior.
- A compact nzb360-style account settings experience.
- A coherence pass that makes shared pages feel like one product instead of unrelated tools.

This is a design spec only. Implementation should follow as one coordinated visual refresh plan with internal layers so review remains manageable.

## Current Context

The existing app already has useful foundations:

- `lib/app-settings.js` stores app bar position, sidebar side, sidebar trigger position, and theme mode.
- `components/layout-wrapper.tsx` owns the main shell, app bar placement, scroll area, and persistent music mini-player.
- `components/calendar/calendar-operator-top-bar.tsx` already contains global Music, Clock, Calendar, Theme, and sidebar controls.
- `components/sidebar/app-sidebar-client.tsx` resolves the drawer and sidebar navigation from tested route metadata.
- `components/ui/app-surface.tsx` provides shared page shells, surfaces, notices, tiles, and action links.
- `app/page.tsx`, `lib/onboarding-preferences.js`, and account settings already connect homepage tools, onboarding preferences, and saved settings.
- `/music` uses horizontal rails and a persistent player, making it a useful model for richer tool discovery.

The refresh should build on these pieces instead of replacing them.

## Scope

The Big Visual Refresh includes:

1. Global shell and navigation across phone, tablet, and desktop.
2. Global quick-create action launcher and signed-in customization model.
3. Homepage and tool discovery redesign.
4. Account settings redesign.
5. Shared visual coherence across public and signed-in pages.

The refresh does not include:

- New hosted PHI storage or clinical sync.
- New membership-only quick-action sections before those features are ready.
- New plan-name based entitlement checks.
- A forced public onboarding questionnaire.
- A route rewrite that changes product behavior unrelated to layout or navigation.

## Design Principles

- Keep user choice: users can still choose app bar position, drawer side, and theme mode.
- Use existing theme colors: light, dark, and system modes decide palette; the refresh should not become a black-only entertainment UI.
- Prefer useful controls over decorative chrome.
- Keep mobile fast: primary controls must be thumb-reachable, obvious, and stable.
- Scale up from mobile to tablet and desktop instead of treating desktop as a separate product.
- Preserve local-first PHI boundaries and feature-key entitlement checks.
- Keep route-specific exceptions where workflows require them, especially Chimer, Clock, Calendar, Anatomime gameplay, and professional records.

## Responsive Shell

### Phone

The default phone shell uses a bottom main bar:

`Home / Music / Clock / + / Theme / Calendar / More`

The default drawer side is left. When the drawer side is left, `Home` stays on the left edge and `More` stays on the right edge:

`Home / Music / Clock / + / Theme / Calendar / More`

When the drawer side is right, `More` and `Home` swap so the drawer toggle stays near the drawer edge:

`More / Music / Clock / + / Theme / Calendar / Home`

The `More` button opens the nav drawer. The drawer keeps the current route-aware navigation model and should remain configurable left or right.

The audio player remains bottom-based for better listening UX. When active, it stacks directly above the bottom main bar, similar to YouTube Music. It should not move to the top just because the app bar is at the bottom.

The `+` button opens above the button and must clear the main bar, safe area, and active audio player.

### Tablet

Tablet portrait behaves closer to phone: bottom-first controls, stacked audio player, wider drawer, and larger quick-action labels.

Tablet landscape behaves closer to desktop: persistent rail or sidebar can remain visible, but the same global controls and quick-create menu should stay available.

Tool discovery rails should gain more columns, larger tile art, and less vertical crowding on tablet.

### Desktop

Desktop keeps the sidebar/rail model, but it should adopt the same visual vocabulary as mobile:

- Clearer active states.
- Compact grouped nav sections.
- A polished drawer/rail transition.
- The same global `+` quick-create menu available from the app bar or shell controls.
- Music player remains bottom-based.

The desktop layout should not copy the phone bottom bar literally if the sidebar is already visible, but the same controls should be discoverable and consistent.

## Quick-Create Launcher

The global `+` button opens a Radarr-style vertical speed dial above the button:

- Circular icon buttons rise above the `+`.
- Each action has a compact label.
- The launcher closes when the user chooses an action, taps outside, changes route, or presses Escape.
- Keyboard focus moves into the launcher and returns to `+` on close.
- The launcher must avoid overlapping the bottom audio player and main bar.

### Anonymous Defaults

Anonymous users see two groups.

Available now:

- Start Chimer
- Start flashcards
- Play Anatomime
- Add wellness quick log
- Add body-sensation check-in
- Start breathing guide
- Start/restart a public music station

Sign in to save:

- Create calendar item
- Save wellness history
- Customize home shortcuts
- Customize quick actions

There is no `Membership required` group in the first version. Membership-gated quick actions can be added later when those features are mature enough to justify the menu space.

### Signed-In Defaults

Signed-in users get role-aware defaults from onboarding and saved preferences:

- Student: flashcards, Anatomime, saved deck, study progress, business planner.
- Therapist: appointment, reminder, practice operations, Chimer, and local documentation where entitled.
- Client: wellness log, body sensation, ROM/check-in, reminders, favorite station.
- Educator: Anatomime room, flashcards, deck/community study tools.
- Practice/team: calendar, requests, services, booking settings, staff/practice actions.

These defaults are prepopulated from onboarding role and use-case selections. Users can customize the visible speed-dial actions after sign-in.

### Customization

Signed-in customization should store explicit quick-action choices separately from computed role defaults. This preserves the existing rule used for homepage shortcuts: computed defaults should not be mistaken for user selections.

The visible speed dial should have a cap so it stays usable. Extra actions belong in an "All quick actions" surface or the More drawer.

## Homepage And Tool Discovery

The homepage becomes a hybrid landing page and app hub.

The first viewport stays professional and clear:

- Strong MassageLab identity.
- Concise value proposition.
- Immediate calls to action.
- No forced role questionnaire or public onboarding gate.
- The optional "what are you here for?" router can remain as a launcher, not a form.

Below the first viewport, discovery becomes more media-rich:

- Rails for Continue, Practice, Study, Wellness, Music, Local-first records, Business tools, and Available tools.
- Larger visual tiles with icons or artwork, status labels, and one clear action.
- Richer visual density inspired by YouTube Music, using MassageLab theme colors and professional content.
- Full available-tools catalog remains near the bottom for complete scanning.

Signed-in users see personalized rails near the top:

- Recent tools.
- Saved home shortcuts.
- Flashcard progress.
- Favorite or recent music stations.
- Relevant calendar and workflow shortcuts.

Anonymous users see curated public defaults and useful prompts where sign-in adds persistence.

## Account Settings

Account settings should move closer to the nzb360-style mobile settings screen.

### Phone

The phone settings index uses:

- Search near the top.
- Grouped sections such as General, Account, Preferences, Practice, Support, and Legal.
- Compact icon rows with label, status hint, and chevron or menu action.
- Focused detail screens or panels with an obvious back affordance.
- Easy access to layout, theme, drawer side, home shortcuts, and quick actions.

### Tablet And Desktop

Tablet and desktop keep an efficient two-column layout:

- Left rail uses the same grouped icon-row model as mobile.
- Right side shows the selected detail panel.
- Search filters the same data model across viewport sizes.
- Current account, security, billing, support, and app settings sections remain recognizable.

## Shared Visual Coherence

The coherence pass aligns:

- Tool tiles.
- Rail cards.
- Settings rows.
- App surfaces.
- Nav drawer items.
- Empty states.
- Page headers.
- Bottom and top safe-area spacing.
- Active, hover, focus, and disabled states.

The shared style should be compact, polished, and practical:

- Cards remain at restrained radius and should not be nested inside other cards.
- Text must not overflow buttons, rails, or tiles.
- Icons should use the existing Lucide pattern where possible.
- Theme colors remain the source of truth.
- Mobile controls must leave room for keyboard, safe area, active audio player, and dense forms.

Route-specific exceptions can remain, but they should integrate with the shell:

- Chimer and Clock may keep immersive layouts.
- Calendar workspace may keep dense operator controls.
- Anatomime gameplay may keep route-owned game layout.
- Local-first professional records may keep workflow-specific forms and vault controls.

## Data And State Flow

App settings continue to normalize through `lib/app-settings.js`.

The shell reads settings from the settings provider and derives:

- App bar position.
- Drawer side.
- Theme mode.
- More/Home order.
- Audio player stack spacing.

Navigation continues to resolve through `lib/navigation.js` and server-provided sidebar context.

Quick-create actions should be defined as structured metadata:

- Stable action id.
- Label.
- Icon.
- Target route or handler.
- Availability state.
- Audience or role defaults.
- Optional sign-in prompt.
- Optional feature-key requirement for future gated actions.

Anonymous actions should be computed from public capability and current route state. Signed-in actions should merge onboarding-derived defaults, explicit user customization, and route/action availability.

Music quick actions should use the existing music provider state for favorite, active, or recent station behavior where available.

Homepage rails should reuse tool catalog metadata where possible so shell shortcuts, home shortcuts, and discovery tiles do not drift.

## Error Handling And Empty States

The shell must handle missing or failed personalization gracefully:

- If saved quick-action preferences fail to load, fall back to role defaults or anonymous defaults.
- If music has no favorite or recent station, show a public starter station action.
- If a route requires sign-in, show a clear sign-in prompt rather than a broken action.
- If role defaults are unavailable, use mixed public defaults.
- If a user has no calendar access, create-calendar actions should explain sign-in or setup requirements.

Account settings search should show a compact "No settings match" state.

Homepage rails should hide empty personalized rails rather than rendering blank sections.

## Accessibility

The refreshed shell must support:

- Keyboard navigation through the main bar, speed dial, drawer, and settings rows.
- Escape and outside-click dismissal for the speed dial.
- Focus return to the `+` button after closing the speed dial.
- Clear aria labels for icon-only controls.
- Tooltips on desktop for unfamiliar icon controls.
- Reduced motion support for rail movement and speed-dial animation.
- Safe hit targets for phone and tablet.
- Visible focus states in both light and dark themes.

## Testing Strategy

Automated coverage should focus on behavior and layout contracts:

- App settings normalization for bottom app bar default, drawer side, and Home/More ordering.
- Quick-action default computation for anonymous and role-derived signed-in users.
- Explicit quick-action customization staying separate from computed defaults.
- Navigation resolver compatibility with the refreshed shell.
- Music player bottom stacking with bottom app bar.
- Homepage rail rendering for anonymous and signed-in contexts.
- Account settings search and mobile index/detail navigation.

Browser tests should cover:

- Mobile bottom bar layout with and without active music player.
- Left and right drawer side ordering.
- Speed dial open, dismiss, and action navigation.
- Homepage rails on mobile and desktop.
- Account settings grouped index and detail navigation on mobile.
- Representative route spacing for forms, Calendar, Chimer, Clock, Music, and Education.

Manual visual review should include:

- Phone portrait.
- Phone landscape where supported.
- Tablet portrait.
- Tablet landscape.
- Desktop with sidebar left and right.
- Light, dark, and system theme modes.

## Acceptance Criteria

- The default shell is bottom-first on mobile with the approved control order.
- Audio playback controls remain bottom-based and stack cleanly above the bottom main bar.
- More opens the nav drawer and swaps sides with Home based on drawer side.
- The quick-create launcher opens as a vertical speed dial above `+`.
- Anonymous quick actions match the approved Available now and Sign in to save groups.
- Signed-in quick actions are role-aware, customizable, and separate explicit choices from computed defaults.
- Homepage supports both landing-page clarity and rail-based tool discovery.
- Account settings use compact grouped icon rows on mobile and a matching rail/detail model on larger screens.
- Shared visual primitives make pages feel coherent without changing local-first PHI boundaries or feature-key entitlement rules.
