# App Shell, Install, and Help Design

Date: 2026-07-17

## Purpose

Refine MassageLab's global shell so its navigation remains recognizable while making the app bar more stable, route-aware, and useful. This track also focuses the existing quick-action launcher and adds discoverable installation, help, and feedback paths.

This is a design specification only. It covers Track 5 of the larger planning effort and does not implement the work.

## Goals

- Extend the configured top or bottom app bar across the full viewport width.
- Keep the navigation-drawer button in the outer corner nearest its configured drawer side.
- Keep the MassageLab home brand immediately medial to the drawer button, including while the drawer is open.
- Preserve the current appearance of global tool buttons while adding a glow to the tool for the current route.
- Keep the current full-screen quick-action overlay but focus its signed-out contents and preserve role-aware signed-in behavior.
- Add conditional PWA installation, public help, and privacy-safe feedback links to the avatar/settings menu.
- Preserve the existing responsive shell, music-player stacking, route-owned toolbars, theme settings, and accessibility behavior.

## Non-Goals

This track does not include:

- A Plex-style shell rewrite or direct copying of Plex code or assets.
- A compact anchored replacement for the current quick-action overlay.
- A new personal-recording tool.
- A new feedback database, support API, or diagnostic transport.
- New roles, onboarding questions, or quick-action personalization storage.
- Changes to Clock, Chimer, Music backgrounds, carousels, premium-background commerce, or the public Roadmap.
- Automatic PWA install prompts.

## Current Context

The existing application already provides the right boundaries for an incremental refinement:

- `components/calendar/calendar-operator-top-bar.tsx` owns the desktop app bar, global controls, configured top or bottom placement, sidebar-side ordering, and route-owned secondary toolbar.
- The responsive shell and mobile controls already honor the app-bar and sidebar settings and stack with the global music player.
- `components/sidebar/app-sidebar-client.tsx` owns the drawer, home branding, and signed-in or guest account menu.
- `lib/navigation.js` provides shared route metadata and the existing route-active helper.
- `components/shell/quick-action-speed-dial.tsx` owns the current full-screen dimmed quick-action overlay and its focus behavior.
- `lib/quick-actions.js` owns the route-backed quick-action catalog, role and use-case defaults, explicit user choices, and seven-action limit.
- `components/providers/service-worker-provider.tsx` registers the service worker, but no shared provider currently captures the browser's install prompt.
- `/support` already provides the privacy-safe problem-reporting and diagnostic flow.

The implementation should refine these units instead of replacing the shell architecture or creating a single global navigation controller.

## Chosen Approach

Use an incremental shared-shell refinement.

The app-bar component remains responsible for visual ordering and responsive space allocation. Navigation metadata remains responsible for route semantics. The quick-action resolver remains responsible for selecting actions. The account menu remains the presentation surface for account and support links. A small install provider owns browser-only PWA capability state.

This approach was selected over:

1. A centralized shell state provider for navigation, branding, quick actions, account links, and installation. That would couple unrelated concerns and make route-specific shell behavior harder to maintain.
2. A broad Plex-inspired shell replacement. That would create unnecessary migration risk and could erase existing MassageLab settings and route-owned toolbar behavior.

The Plex reference informs only the full-width bar, corner drawer control, and medial brand relationship.

## App-Bar Layout

### Full-width placement

The visible app bar spans the full viewport width in either configured top or bottom position. It must not begin after the expanded sidebar or visually shorten when the sidebar opens.

The shell continues to reserve the correct page and safe-area space for the configured position. When the global music player is present, its expanded and collapsed layouts continue to stack without covering the bar or its controls.

### Drawer control and branding

The drawer button occupies the outer corner nearest the configured drawer side:

- Left drawer: drawer button at the left edge, followed inward by the home brand.
- Right drawer: drawer button at the right edge, preceded inward by the home brand.

The brand remains inside the app bar whether the drawer is open, collapsed, docked, or rendered as a mobile drawer. Opening the drawer does not move the wordmark into the drawer or remove the app-bar home link.

The home brand uses the wordmark while space permits and collapses to the existing logo mark when space is constrained. Global tool actions take priority over the full wordmark. The brand remains a single accessible home link in either form.

The drawer no longer renders its own wordmark or brand home link. The app-bar brand is the single global brand home link in expanded, collapsed, docked, and drawer layouts.

### Space allocation

The bar allocates space in this order:

1. Drawer control.
2. Brand home link, with wordmark-to-mark collapse.
3. Route-owned toolbar space when present.
4. Global tool actions.

This priority means branding compresses before global actions are hidden. Existing route-owned overflow behavior continues to move a route toolbar into its secondary row. The Calendar secondary toolbar, top or bottom borders, device safe areas, and existing sidebar-side mirroring remain supported.

## Active Tool State

Music, Clock, Calendar, and other global tool buttons retain their existing button variants whether or not they are the current page. A shared route-active rule adds a persistent glow to the current tool; it does not neutralize non-current tools.

The route matcher uses each tool's link as its route-family root: Music is active for `/music` and `/music/*`, Clock for `/clock` and `/clock/*`, and Calendar for `/calendar` and `/calendar/*`. `/chimer` is not treated as `/clock`. Query strings and fragments do not change route activation.

The glow must be recognizable in light and dark themes, must not depend on color alone, and must preserve visible hover, pressed, and keyboard-focus states. Each active navigational link receives `aria-current="page"`.

## Quick-Action Overlay

### Presentation and interaction

The `+` button continues to open the existing full-screen dimmed, backdrop-blurred overlay. This track does not convert it into a compact dropdown, popover, or speed-dial anchored beside the button.

The overlay continues to:

- Move keyboard focus into the open surface.
- Close after a route action is chosen.
- Close on Escape or backdrop selection.
- Return focus to the originating `+` button.
- Expose an accessible dialog name and close control.
- Respect reduced-motion preferences.

### Signed-out actions

Signed-out users see exactly these four actions:

1. **Log In** routes to `/login`.
2. **Create Account** routes to `/register`.
3. **Quick Log** routes directly to `/wellness#quick-log`.
4. **Breathing Guide** routes to the existing breathing tool.

The Wellness page must provide the stable Quick Log target used by the launcher. The overlay does not show Music, Chimer, Flashcards, Anatomime, Calendar, customization, or a recording action to signed-out users. Those tools remain discoverable through their normal navigation surfaces.

### Signed-in actions

Signed-in users continue to receive route-backed actions from the existing resolver:

- Explicit user selections take precedence when present.
- Otherwise, primary role and use-case defaults determine relevance.
- Existing onboarding and action-availability rules remain in effect.
- The visible result remains capped at seven unique actions.
- Authentication actions are excluded.
- Quick Log appears when the existing role or use-case resolution includes it.

This track updates the catalog labels and routes required by the approved behavior without replacing the resolver or inferring new role rules.

## Account Menu

The avatar/settings menu adds three entries for both guests and signed-in users:

- **Install MassageLab**, shown only when the install capability resolver reports an available action.
- **Help & FAQ**, linking to `/help`.
- **Send Feedback**, linking to `/support`.

These entries coexist with existing account, settings, security, billing, login, registration, support, and sign-out behavior as applicable. Duplicate support links should be consolidated so the menu presents one clear **Send Feedback** route to `/support` rather than two differently named links to the same destination.

Selecting a navigational entry closes the mobile drawer through the existing sidebar navigation behavior.

## PWA Installation

### Capability model

A small client-side install provider owns browser installation state and exposes a narrow interface to the account menu. Its resolved state is one of:

- `prompt`: a captured native installation prompt can be launched.
- `instructions`: installation is supported through a recognized platform flow, but no callable native prompt is available.
- `installed`: MassageLab is already running as an installed app.
- `unsupported`: the current platform has no supported installation path known to the app.

The account menu renders **Install MassageLab** only for `prompt` or `instructions`.

### Native prompt flow

The provider listens for `beforeinstallprompt`, prevents an automatic browser prompt, and retains the event for an explicit user action. Selecting **Install MassageLab** launches the retained prompt and observes its result.

The prompt is never launched during page load, account-menu opening, route navigation, or service-worker registration. If the prompt is dismissed or fails, MassageLab remains usable. The provider recomputes availability from subsequent browser events rather than assuming installation succeeded.

### Instruction flow

When a native prompt is unavailable but a recognized platform supports manual installation, the menu opens a concise instructions dialog for that platform. The initial instruction fallback covers iOS and iPadOS Safari's manual Share then Add to Home Screen flow. Other browsers require a captured native prompt in this track; without one, they are treated as unsupported instead of receiving guessed directions.

The dialog includes its platform context, ordered steps, a close action, keyboard focus management, and a link to the installation section on `/help` for more context.

### Installed detection

Installed state is detected through the standalone display-mode media query and iOS standalone mode. The provider listens for display-mode changes where the media-query API supports them. When installed state is detected, the account-menu install entry disappears.

The install provider is mounted beside the existing service-worker provider in the root layout. Service-worker registration and install-prompt state remain separate responsibilities.

## Public Help and Feedback

### `/help`

`/help` is public and follows the existing public page and SEO patterns. Its first version is a concise navigation and explanation surface rather than an exhaustive knowledge base.

It contains these topic groups:

- Account creation, verification, login, and access.
- Installing MassageLab.
- Clock and Chimer basics.
- Music and visual backgrounds.
- Background credits, permanent purchases, and subscriptions, written to remain compatible with the later commerce track.
- Local-first privacy boundaries.
- Reporting a problem or sending feedback.

Content must distinguish help from support: `/help` explains common tasks, while `/support` is the contact and privacy-safe diagnostic flow. Relevant topics link to their live product routes, and the page ends with a clear **Send Feedback or Report a Problem** action to `/support`.

Until the premium-background commerce track ships, this topic describes only the currently available premium-background and subscription behavior and states that credits and individual purchases are not currently available. The commerce track must update this help topic when those features become available.

### `/support`

**Send Feedback** reuses `/support` and its existing privacy-scrubbed diagnostic behavior. This track does not add uploads, free-form hosted PHI storage, a ticket database, or a second submission transport. Existing warnings against including clinical notes, intake details, screenshots containing sensitive information, or local-vault contents remain authoritative.

## State and Data Flow

No database migration or server-side data model is required.

1. App settings continue to provide app-bar position and sidebar side.
2. The app bar derives physical control order and responsive branding from those settings.
3. The pathname and shared navigation matcher determine the active tool glow.
4. The quick-action overlay asks `lib/quick-actions.js` for signed-out or role-aware signed-in groups.
5. The install provider derives prompt, instruction, installed, or unsupported state from browser capabilities.
6. The account menu consumes that install state and existing navigation metadata.
7. `/help` links to product routes and `/support`; feedback submission remains entirely within the current support flow.

Each unit has one primary responsibility and can be tested independently.

## Failure and Edge Behavior

- If install-state detection throws or encounters an unknown browser, hide the install entry and leave the rest of the account menu available.
- If the native install prompt rejects, dismisses, or becomes stale, return to a non-installed state supported by current browser signals; do not show a success message without evidence.
- If an instructions platform cannot be reliably identified, hide the install entry rather than display generic or incorrect steps.
- If role-aware quick-action data is missing or malformed, use the resolver's existing safe fallback and seven-action bound.
- If an active route has no global tool mapping, no global tool receives the active glow.
- If available width is tight, use the logo mark and route-toolbar overflow before removing global tool actions.
- If JavaScript is unavailable, server-rendered links to `/help`, `/support`, login, registration, and tool routes remain usable; the installation enhancement is absent.

## Accessibility

- The wordmark and logo mark expose one consistent **MassageLab home** accessible name.
- Icon-only global controls retain clear labels and desktop tooltips.
- The active route uses semantic current-page state in addition to its glow.
- The quick-action overlay and installation instructions dialog trap and restore focus according to the current dialog primitives.
- Escape, backdrop dismissal, and explicit close buttons remain available.
- All controls preserve visible focus styles and safe touch targets.
- Layout and dialogs respect reduced motion, zoom, text scaling, viewport safe areas, and light and dark themes.
- The wordmark collapse must not create duplicate focus stops or duplicate home announcements.

## Testing Strategy

### Unit and component coverage

- Route-active cases for exact, nested, query-bearing, and unrelated paths.
- Signed-out quick actions resolve to exactly Login, Create Account, Quick Log, and Breathing Guide.
- Signed-in explicit choices, role defaults, use-case defaults, deduplication, valid routes, and the seven-action cap remain intact.
- Install capability resolution covers native prompt, manual-instructions platform, installed, unsupported, dismissed, failed, and display-mode-change states.
- Account-menu rendering covers guest, signed-in, prompt, instructions, installed, and unsupported combinations.
- Public Help metadata and required topic links are present.

### Browser behavior

- Full-width bar with top and bottom placement.
- Left and right drawer sides in open, collapsed, docked, and mobile-drawer states.
- Wordmark collapse to the logo mark before global tool actions are removed.
- Stable brand placement while the drawer opens and closes.
- Current-route glow and semantic state for each global tool.
- Quick-action opening, keyboard traversal, action navigation, Escape, backdrop dismissal, and focus return.
- Native install prompt activation only after the menu action.
- Manual installation instructions and installed-app hiding behavior.
- Public `/help` navigation and transition to `/support`.
- Expanded and collapsed global music player alongside top and bottom bars.

### Manual responsive review

- Narrow phone portrait and landscape.
- Tablet portrait and landscape.
- Desktop with both sidebar sides.
- Light, dark, and system themes.
- Browser mode and installed PWA display mode.
- Keyboard-only navigation and text zoom.

## Acceptance Criteria

- The configured app bar spans the full viewport width.
- The drawer button stays in the drawer-side corner, with the home wordmark or logo immediately medial to it.
- Opening the drawer does not move the primary brand out of the app bar.
- Global tool buttons retain their current variants, and only the current tool gains the approved persistent glow.
- Tool actions remain available before the brand's full wordmark when horizontal space is limited.
- The `+` button retains the current full-screen dimmed overlay.
- Signed-out quick actions are exactly Login, Create Account, Quick Log, and Breathing Guide.
- Signed-in quick actions remain role-aware, customizable, route-backed, unique, and limited to seven.
- The account menu conditionally exposes Install MassageLab and always exposes Help & FAQ and Send Feedback.
- Installation is user-initiated, hides when installed or unsupported, and provides recognized platform instructions only when a direct prompt is unavailable.
- `/help` is public, covers the approved starter topics, and directs contact or diagnostic needs to `/support`.
- Feedback reuses the existing privacy-safe support flow.
- Existing app-bar position, sidebar side, music-player stacking, route-owned toolbar, safe-area, theme, and accessibility behavior remain functional.
