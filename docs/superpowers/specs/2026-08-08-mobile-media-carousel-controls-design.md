# Mobile Media Carousel Controls Design

Date: 2026-08-08
Status: Implemented and locally validated; PR review in progress.

## Summary

MassageLab will make targeted responsive changes to the Background and Music experiences without rewriting the shared carousel system. Background metadata and actions will move off the preview artwork into a permanently visible control tray. The tray will sit below the carousel in ordinary layouts and move to the right in short landscape, where the carousel may reduce to three visible cards. Animated background previews will default to enabled, remember the device preference, and yield temporarily to reduced-motion settings.

The station carousel will allow a horizontal swipe to begin anywhere on the center card except its dedicated Play/Stop and Favorite controls. A short tap on the same surface will continue opening station information. The persistent music toolbar will never require horizontal scrolling: it will use icon-only leaf-green controls, two rows when necessary, and a compact single-row collapsed state.

Casting, Android media-notification integration, and repositioning the browser-owned fullscreen notice or the existing fullscreen size controls are separate follow-up projects.

## Goals

1. Maximize the visible background preview by removing metadata and controls from the artwork.
2. Keep background navigation, information, and actions visible without requiring page scrolling.
3. Adapt cleanly to short phone landscape layouts without device-specific detection.
4. Make animated background previews automatic by default while preserving user choice and reduced-motion safety.
5. Let station-carousel swipes begin on the center card without sacrificing its tap-for-details behavior.
6. Prevent the persistent music toolbar from scrolling horizontally at supported phone widths.
7. Simplify music controls around one Play/Stop action and clear icon-only secondary actions.
8. Preserve the existing carousel, playback, access, favorites, and background-selection behavior outside these targeted presentation changes.

## Non-goals

- Adding a Cast button or implementing Google Cast, Presentation API, or receiver behavior.
- Changing the Web Audio runtime to obtain Android audio focus or a notification-drawer media card.
- Repositioning browser-owned fullscreen guidance.
- Moving the existing fullscreen timer size controls; they remain unchanged while a better solution is considered.
- Rewriting the adaptive carousel or introducing separate mobile carousel implementations.
- Changing station catalogs, background catalogs, entitlements, commerce, account state, or backend data.
- Editing the admin experience or its authorization work.

## Chosen Approach

The implementation will use targeted responsive adaptation within existing component boundaries.

- `BackgroundCarousel` owns the external tray, the centered-background presentation data, the preview preference, and responsive tray placement.
- `BackgroundCarouselCard` concentrates on the preview artwork. Metadata and action controls leave the card; a subtle selected-state treatment may remain.
- `AdaptiveCarouselStage` and its controller retain responsibility for layout, navigation, and drag behavior. They gain only a narrow opt-in mechanism that allows an explicitly marked interactive surface to initiate a drag.
- `StationCarouselCard` opts its details surface into that drag behavior while keeping Play/Stop and Favorite protected.
- `MusicMiniPlayer` owns its responsive, non-scrolling presentation without moving playback state out of the existing provider.

This approach avoids a generalized carousel-control framework and avoids duplicated mobile render trees. It keeps the change branch-sized and limits shared-system risk.

## Background Carousel

### Clean preview cards

Background cards will no longer overlay the following content on the artwork:

- Name and description
- Background type and access state
- Select, Selected, or Unlock action
- Favorite action

The active selection may continue using a subtle border or similarly non-obscuring treatment. The card remains the visual preview; the tray becomes the unambiguous place to understand and act on the centered item.

### Permanently visible control tray

The tray is present for the entire time the Background panel is open. It always describes and controls the centered carousel item.

In normal portrait, tablet, and desktop layouts, it sits directly below the carousel and contains:

- Background name
- Description
- Type and access state
- Previous and next navigation
- Select, Selected, or Unlock action as appropriate
- Favorite action
- Animated-previews toggle

The exact grouping may adapt across widths, but the controls must remain visible without horizontal scrolling and must retain clear association with the centered background.

### Short-landscape layout

The existing short-landscape adaptive profile will switch the Background presentation to a carousel-and-side-tray arrangement:

- The tray pins to the right of the stage in the same general pattern used by the phone-landscape Visual panel.
- The carousel uses a one-card neighbor radius, showing no more than the previous, centered, and next cards.
- The tray exposes the background name and access state directly.
- Description and supplementary attributes move behind an accessible Info control.
- Previous, next, selection/access, favorite, and preview controls remain reachable without page scrolling.

The layout decision uses the existing adaptive profile and available viewport shape. It must not inspect phone models or user-agent strings. CSS owns physical placement, while the carousel profile owns the visible-card radius so the stage and tray change coherently.

### Centered-item data flow

The adaptive stage reports the current centered item to `BackgroundCarousel`. The tray derives its copy, access action, favorite state, and selection state from that stable background ID. Filtering or category changes must establish a valid centered item before actions become enabled, preventing a stale tray from acting on an item that is no longer present.

## Animated Preview Preference

Animated previews default to enabled on first use. The user controls them through a semantic toggle rather than a Play Preview/Pause Previews button.

The preference is stored locally on the device. Runtime playback uses two separate values:

1. The user's saved preference.
2. The effective permission to animate after applying reduced motion.

Conceptually, previews play only when the saved preference is enabled and motion is currently allowed. A reduced-motion setting therefore pauses previews without overwriting the saved preference. The tray communicates that previews are paused by the device motion setting so the visible state is not misleading.

If local storage is unavailable, the carousel uses the enabled first-use default for the current session and remains fully operable. Storage failure must not blank previews, block navigation, or surface a disruptive error.

## Station Carousel Interaction

### Combined details and drag surface

The center station card's artwork, title, and description form one combined interaction surface:

- A short tap opens the existing station-information dialog.
- A horizontal drag advances the carousel even when it begins on that surface.
- Once the carousel recognizes a drag, it suppresses the following click so the information dialog does not open accidentally.
- Vertical movement remains available for normal page scrolling.

The dedicated Play/Stop and Favorite controls remain excluded from carousel drag initiation. Activating either control performs only its labeled action.

### Shared gesture boundary

Interactive elements continue blocking carousel drag by default. The shared controller receives a narrow opt-in marker for the station-details surface rather than broadly allowing drags from all buttons or dialog triggers. This prevents regressions in links, form controls, actions, and other carousel content.

The existing carousel engine remains responsible for movement thresholds, click suppression after a recognized drag, and pointer cancellation. The implementation must not create a second competing gesture state machine.

### Keyboard and assistive behavior

The details surface remains keyboard operable: Enter or Space opens station information. Play/Stop and Favorite retain independent focus targets, accessible names, and state announcements. The drag enhancement must not remove ordinary focus styling or require a gesture to reach any station action.

## Persistent Music Toolbar

### Expanded layout

The expanded toolbar never uses horizontal scrolling. At narrow phone widths it becomes two rows:

1. Station name and playback status.
2. Previous station, Play/Stop, next station, Background, and Collapse controls.

At wider widths the same content may fit on one row. The responsive layout may change grouping, but it must not silently remove an expanded-state action.

Restart and the separate Stop control are replaced by one primary Play/Stop control. When stopped, Play resumes or starts the current station; while playing, Stop ends its playback through the existing provider behavior.

Background and the remaining toolbar actions use icons without persistent text. Every icon-only control has an accessible name and tooltip. Toolbar action buttons use the established leaf-green/success treatment rather than introducing a new green implementation.

### Collapsed layout

The collapsed toolbar remains one compact row containing:

- Truncated station name and status
- Primary Play/Stop control
- Expand control

Expanding restores the complete action set. Fixed control regions and text truncation prevent station copy from pushing buttons outside the viewport. The toolbar also respects existing safe-area insets.

## Error Handling and Resilience

- A temporarily invalid centered background disables tray actions until the stage reports a valid item.
- Failure to read or write the preview preference falls back to session behavior and does not interrupt carousel use.
- Reduced motion is an effective runtime override, not destructive preference migration.
- Short-landscape Info content uses an accessible disclosure or dialog so long descriptions do not resize the stage unexpectedly.
- Gesture handling delegates drag thresholds and post-drag click suppression to the existing carousel engine.
- Existing playback-provider errors and station availability behavior remain authoritative; the toolbar does not create a parallel playback state.
- No new network request, server action, schema, or account mutation is introduced.

## Accessibility Requirements

- The animated-preview control is a semantic switch with a programmatic label and state.
- Reduced-motion override messaging is associated with the preview control.
- The side-tray Info control is keyboard accessible, labeled for the centered background, and returns focus predictably when dismissed.
- Previous and next controls retain descriptive accessible names.
- Selection/access and Favorite state remain perceivable without relying on color alone.
- Station details, Play/Stop, and Favorite remain distinct keyboard targets.
- Icon-only toolbar controls expose accessible names, pressed or playback state where applicable, and visible tooltips.
- Responsive rearrangement preserves logical reading and focus order.

## Testing Strategy

### Component and controller coverage

Tests will verify:

- An explicitly opted-in station-details surface may initiate carousel drag.
- Nested Play/Stop and Favorite controls still reject drag initiation.
- A recognized drag does not trigger the station-information action.
- Preview preference defaults to enabled, persists when storage is available, and survives a temporary reduced-motion override.
- Toolbar controls expose correct accessible names and Play/Stop state.

### Browser coverage

Representative phone portrait, short landscape, and desktop viewports will verify:

- Background artwork is no longer covered by metadata or actions.
- The tray and previous/next controls are reachable without page scrolling.
- Short landscape places the tray on the right and shows no more than three cards.
- The side-tray Info interaction exposes the centered background's additional metadata.
- A swipe beginning on the center station card moves the carousel.
- A short tap on the same surface opens station information.
- Play/Stop and Favorite work without dragging the carousel.
- The expanded toolbar has no horizontal overflow and uses two rows when necessary.
- The collapsed toolbar remains one compact row.
- Filtering, selection, favorites, playback, and keyboard interactions remain functional.

### Branch validation

Implementation validation will run focused tests first, followed by lint, typecheck, the broader test suite, build, and `git diff --check`. Casting, Android media notifications, and the unchanged fullscreen controls are not acceptance criteria for this branch.

## Repository and Coordination Boundaries

The work is isolated on `codex/mobile-media-carousel-controls`, based on refreshed `origin/main` at `1f856a6be166eb5562e81449e271289776ccca16`.

The concurrent admin-interface effort is actively modifying `docs/project-state.md`, `docs/project-log.md`, and `docs/wiki/index.md`, in addition to admin-specific source and tests. Those canonical documentation files are protected overlap points. This design specification uses a distinct file, and implementation planning must recheck the admin worktree before proposing or editing any overlap. Source changes should remain in carousel, background, station, player-toolbar, and focused test owners unless an approved plan establishes a necessary exception.

## Follow-up Projects

The following work requires its own design, plan, and implementation branch:

1. Android media integration: establish browser audio focus and reliable notification-drawer media controls for the Web Audio station runtime.
2. Casting: choose and implement a sender/receiver architecture capable of showing the MassageLab clock/background while playing station audio.
3. Fullscreen control safety: reconsider the browser-message conflict without moving the current size controls until a satisfactory design is approved.

## Acceptance Criteria

The design is fulfilled when:

- Background cards devote their artwork area to the preview rather than metadata and actions.
- A permanently visible tray controls the centered background below the stage normally and to its right in short landscape.
- Short landscape requires no page scroll to reach background navigation or actions and shows no more than three cards.
- Animated previews default on, remember the device preference, and pause non-destructively for reduced motion.
- Swiping from the center station details surface moves the carousel while a short tap still opens details.
- Station Play/Stop and Favorite remain protected, independently accessible controls.
- The expanded music toolbar never scrolls horizontally, uses the complete icon-only green control set, and adapts to two rows on narrow phones.
- The collapsed player remains one compact row with status, Play/Stop, and Expand.
- Casting, Android media notifications, and fullscreen-control placement remain unchanged and outside the branch.
