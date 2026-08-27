# Media Notifications and Audio Interruptions Design

Date: 2026-08-14
Status: Approved for implementation.

## Summary

MassageLab will give its generative Atmosphere player reliable browser media ownership, notification and lock-screen controls, explicit interruption behavior, and faster start/stop response without replacing the existing Tone/Web Audio generator runtime. One reusable HTML media carrier will establish the browser/operating-system media session while `MusicProvider` remains the single product-level playback owner.

The work is cross-platform rather than Android-only. It targets Chromium and WebKit through standard media primitives and capability detection, with physical Android acceptance required in this branch. Apple-compatible behavior and a focused WebKit automation project are included, but iPhone/iPad notification and interruption behavior will remain explicitly unverified until Apple hardware or an authorized remote-device service is available.

Users will choose whether a station resumes after observable calls or other external audio interruptions. Automatic resume is the device-local default. A 30-second non-modal session notice lets the user override that behavior for the current session, while an expanded-player three-dot menu changes both the active session and the saved default.

Startup responsiveness will improve through immediate audio-context/media-carrier activation, per-piece dynamic imports, and latest-request-wins cancellation. MassageLab will retain its hosted compressed samples, persistent cache behavior, cleanup guarantees, and startup telemetry.

## Context and Evidence

The current global owner is `MusicProvider`. It exposes stopped, loading, playing, and failed presentation states, registers Media Session metadata and actions, and delegates sound generation to the Tone/Web Audio runtimes. The audible output is not owned by an `HTMLMediaElement`, so Android Chrome can play the generator without acquiring the full media focus needed for a persistent notification card. Existing Media Session handlers alone do not solve that ownership gap.

The current Generative.fm runtime also imports the aggregate Alex Bainter piece package for most stations and serializes runtime operations behind one promise. That preserves cleanup, but it can parse more piece code than the selected station needs and makes a new Play, Stop, or station selection wait behind stale asynchronous work.

The upstream Generative.fm player uses three relevant patterns:

- A reusable looping HTML audio element to establish media-session ownership.
- Media Session actions that map Pause to generator teardown and Play to a fresh activation rather than attempting deterministic pause/resume inside a generative composition.
- Per-piece dynamic module loading instead of importing the complete piece collection before every first start.

MassageLab will adopt hardened versions of those patterns. It will not copy upstream's weaker stale-activation cleanup or unbounded sample loading.

Platform evidence establishes the boundary:

- Android 12 and later can system-mute active media during incoming calls and return audio focus after the interruption ends.
- Safari has supported Media Session since Safari 15.
- Current WebKit work sends a Media Session Pause action when a system interruption pauses a media element.
- The evolving W3C Audio Session model exposes active, interrupted, and inactive states, but remains a draft and does not reveal whether a call was ignored, declined, or answered.
- Web applications cannot require Zoom, Meet, telephony, or another application to expose interruption identity. Some environments may only duck audio without emitting an actionable event.

Therefore the product controls behavior after an observable interruption. It does not claim to identify the calling application, the caller, or whether a call was answered.

## Goals

1. Produce a persistent media notification and lock-screen media surface when the browser and operating system support it.
2. Make notification, headset, and lock-screen Play/Pause controls operate the generative station predictably.
3. Give users a device-local default and a current-session override for automatic resumption after observable interruptions.
4. Preserve hands-free playback after temporary interruptions when automatic resume is selected.
5. Never automatically resume after a known explicit user Pause or Stop.
6. Improve perceived and measured Play, Stop, and station-switch responsiveness without weakening cleanup.
7. Use portable browser APIs and include WebKit compatibility coverage while stating the physical-device validation boundary honestly.
8. Preserve the existing station catalog, sample hosting, attribution, licensing, visualizer, carousel, volume, and route-continuity behavior.

## Non-goals

- Detecting caller identity, application identity, or whether a call was ignored, declined, or answered.
- Preventing an operating system from muting or ducking MassageLab during a call or higher-priority audio session.
- Guaranteeing behavior when another application does not expose an interruption to the browser.
- Building a native Android, iOS, macOS, or Windows wrapper.
- Adding custom service-worker notifications or requesting notification permission for media playback.
- Implementing deterministic pause/resume at the same musical position inside a generative composition.
- Adding Cast, AirPlay selection UI, Google Cast sender/receiver behavior, or presentation-screen behavior.
- Changing fullscreen controls or browser-owned fullscreen guidance.
- Replacing MassageLab's hosted sample pipeline with upstream sample hosting.
- Expanding the whole Playwright suite to WebKit.
- Changing entitlements, commerce, accounts, clinical data, backend schemas, or admin operations.

## Chosen Architecture

### Central playback ownership

`MusicProvider` remains the only product-level playback owner. Routes, station cards, the mini-player, Media Session handlers, and interruption adapters communicate through its public actions and state. No component creates a parallel long-lived audio session or independently decides whether a stale generator may start.

The provider will coordinate four focused units:

1. **Generator runtime controller** — prepares, starts, stops, and disposes the selected Tone generator.
2. **HTML media carrier** — owns one reusable media element, begins playback within a user gesture, and acquires browser media ownership without becoming a second audible station.
3. **Media Session adapter** — owns metadata, playback-state reporting, action handlers, and deterministic handler cleanup.
4. **Interruption policy** — combines the saved device default, current-session override, explicit user intent, and observable platform signals.

These units expose small lifecycle interfaces so tests can replace browser media objects without starting real audio.

### HTML media carrier

The carrier will use one portable bundled audio asset with a duration sufficient for full media ownership. It will be created lazily, reused across station changes, and started synchronously from the initiating Play gesture before expensive generator preparation begins.

The carrier does not replace the Tone output graph and does not add a second audible program. Its responsibilities are limited to browser media ownership, focus participation, and observable media lifecycle events. The implementation must use a format supported by the targeted Chromium and WebKit versions.

Carrier lifecycle:

- First Play creates or reuses the carrier and calls `play()` inside the user gesture.
- Loading remains active and cancellable; notification Pause can cancel it.
- Notification Pause pauses the carrier but retains its source and Media Session metadata.
- Notification Play reacquires the carrier and starts a fresh generator session.
- In-app Stop or Media Session Stop clears the carrier sufficiently to dismiss the operating-system media card.
- Provider unmount or terminal cleanup removes listeners, action handlers, sources, and pending work.

Carrier failure must not prevent ordinary in-app generator playback. When media ownership cannot be established, the UI must not claim that external-interruption control is active.

### Media Session semantics

Media Session metadata uses the current station title, `MassageLab` as the source, suitable existing station artwork, and app artwork as fallback.

Actions have these meanings:

- **Play:** begin a fresh generative session for the retained station.
- **Pause:** stop and dispose the generator while retaining the station, metadata, and resumable operating-system media card.
- **Stop:** fully stop the session and dismiss the operating-system media card.
- **Previous/Next:** replace the station while retaining the active session's interruption preference.

Loading is active playback intent so Pause can cancel slow startup. The app will not publish fake seek actions, position state, or a fabricated duration for an unbounded generator.

Media Session Pause can represent a hardware/user action or, on some WebKit versions, a system interruption. The interruption adapter will classify it as an interruption only when an accompanying platform signal supports that conclusion. An ambiguous Pause is treated as explicit user intent and will not auto-resume.

## Playback State and Transitions

The presentation model will distinguish these states:

- **Stopped:** station remains selected in MassageLab, no generator is active, and the operating-system media card is dismissed.
- **Loading:** carrier owns media focus while cancellable generator preparation is in progress.
- **Playing:** carrier, generator, provider, and Media Session agree that playback is active.
- **Interrupted:** playback intent remains active but browser or operating-system focus is temporarily unavailable.
- **Paused:** generator is stopped, station remains selected, and Play may start a fresh session.
- **Failed:** startup failed and the retained station offers a recoverable Play action.

Cause-specific transitions are authoritative:

- In-app Stop -> Stopped and dismiss the media card.
- Media Session Stop -> Stopped and dismiss the media card.
- Notification/headset Pause -> Paused and retain the media card.
- Observable interruption with automatic resume enabled -> Interrupted, then Playing when focus returns.
- Observable interruption with automatic resume disabled -> Paused until explicit Play.
- In-app Play from Stopped or Paused -> new session and show the session notice.
- Notification/headset Play -> new session using the saved default without opening an inaccessible background notice.
- Previous/Next during an active session -> replace the station and preserve that session's interruption policy.

Explicit user intent always wins. A later focus-gain, `play`, visibility, or AudioContext event cannot restart playback after a known Pause or Stop.

## Interruption Detection and Policy

The policy is about calls and other external audio interruptions on modern devices, not telephony alone. It will consume the browser signals available on each platform, in descending order of specificity:

1. A supported audio-session interruption state.
2. An AudioContext `interrupted`/recovery state where the browser exposes it.
3. Carrier media pause/play events combined with current context and explicit-action state.
4. Visibility changes only as a recovery opportunity after an already-observed interruption, never as proof that a call occurred.

The app will not use interruption duration to guess whether a call was answered. It will not infer a call from page visibility alone.

If the signals are contradictory or reveal only an undifferentiated Pause, the conservative rule applies: remain paused until explicit Play. This may sacrifice automatic recovery on a particular browser, but it prevents a known user Pause from being overridden.

The supported preference is:

**Resume automatically when the interruption ends**

- Default: enabled.
- Storage: device-local and versioned; no account synchronization.
- Enabled: preserve active playback intent and resume or rebuild the generator after observable focus recovery.
- Disabled: stop the generator when an interruption is observed and remain Paused.
- If the runtime was destroyed while interrupted, automatic recovery starts a fresh generative session rather than pretending to resume the same musical position.

Storage access is guarded. A blocked read or write uses the enabled in-memory default for the current browser lifetime without disrupting playback.

## Session Notice and Player Settings

### Temporary session notice

Every visible in-app transition from Stopped or Paused into a new playback session opens a non-modal notice. This includes Play from the mini-player and Play from a station card. Previous/Next station changes while already active do not reopen it.

The notice says:

> Calls and other audio may temporarily pause or mute this station.

It contains one checkbox:

> Resume automatically when the interruption ends

The checkbox begins with the saved device default and changes only the current session. Ignoring or closing the notice preserves the current value without changing the saved default.

Notice behavior:

- Remains for 30 seconds unless manually closed.
- Pauses its dismissal timer while hovered or while keyboard focus is inside it.
- Does not move focus, trap focus, or block playback controls.
- Uses a polite accessible announcement and a labeled Close action.
- Appears above a bottom-positioned player and below a top-positioned player.
- Stays within viewport and safe-area bounds and never covers the player controls.
- Removes entrance/exit movement under reduced motion.
- Does not open for a notification/headset Play performed while the document is backgrounded.
- Appears only after the media-interruption integration is available; unsupported browsers continue normal playback without a misleading promise.

Changing the notice checkbox does not immediately dismiss it. The updated current-session state remains visible until Close or timeout.

### Expanded-player settings

The expanded toolbar gains a sixth leaf-green icon button between Background and Collapse. It uses a horizontal three-dot icon, the accessible name `Player settings`, and an explanatory tooltip. The collapsed player remains unchanged.

When media-interruption integration is available, the settings surface contains the saved `Resume after interruptions` checkbox. Changing it updates both the active session and the versioned device-local default. This gives users a way to change the current session after the temporary notice disappears and establishes a home for later optional player settings without adding them now. The three-dot button may remain available on unsupported browsers, but it must omit or clearly mark unavailable interruption behavior rather than presenting a nonfunctional checkbox.

The narrow expanded action row uses six equal columns and must not scroll horizontally at the supported minimum viewport. The settings surface must remain reachable in portrait, short landscape, top-player, and bottom-player layouts.

## Responsiveness Design

### User-gesture activation

The initiating Play action will start the media carrier and request Tone/AudioContext activation immediately, before station-module and sample preparation. The UI enters Loading synchronously and exposes an immediate Stop action.

### Per-piece module loading

Each enabled Generative.fm station will resolve through a dedicated dynamic import function for its piece module rather than importing the aggregate Alex Bainter collection. The implementation plan must verify the supported package/export path and record any direct dependency changes. It must preserve the current station IDs, attribution, licensing, and runtime adapter contract.

Centered-station prewarming continues to load only safe metadata/module/sample-index prerequisites. It must not begin audible playback or create duplicate active generators.

### Latest request wins

The runtime controller will replace the global serialized-operation queue with generation-scoped cancellation:

- Every Play or station replacement receives a monotonically increasing request token.
- Stop invalidates pending preparation immediately and updates UI state without waiting for network or decode work to settle.
- Async boundaries verify that their request is still current before activating or publishing state.
- Stale activations are explicitly stopped and disposed even if their underlying promise cannot be physically aborted.
- A late stale completion can never start sound, overwrite metadata, or replace current loading progress.

This design preserves cleanup while removing unnecessary waiting behind obsolete work.

### Sample fetching and measurement

MassageLab retains its hosted compressed sample indexes, Cache API/IndexedDB behavior, and bounded provider requests. The current batch size is not increased merely because upstream fetches more aggressively. Existing startup telemetry will compare preparation, Tone activation, piece activation, scheduling, total startup, cache, and request-batch timings before and after the change. Concurrency changes require measured evidence and a separate explicit decision inside the implementation plan.

Telemetry remains technical and local to playback diagnostics. It records no caller, external application, meeting, or interruption identity.

## Error Handling and Recovery

- A rejected carrier `play()` records integration unavailability for that attempt while ordinary in-app generator playback remains usable.
- A rejected Tone activation produces the existing recoverable playback failure rather than a stuck Loading state.
- Stop during loading invalidates the request immediately; late preparation must dispose without publishing Playing.
- A failed station replacement cannot revive or overwrite the previous station after its request becomes stale.
- Focus recovery may rebuild a destroyed runtime only while automatic-resume intent remains current.
- Explicit Pause or Stop clears auto-resume eligibility before asynchronous cleanup begins.
- Storage failures fall back to the enabled in-memory preference.
- Unsupported Media Session, audio-session, or interruption APIs degrade without throwing and without showing unsupported controls or promises.
- Event listeners, Media Session handlers, carrier sources, Tone nodes, transport events, loops, and subscriptions are cleaned up idempotently.

## Accessibility

- All notification-equivalent actions have matching accessible names in the app.
- The Player settings trigger has a tooltip and programmatic name.
- The settings and notice checkboxes expose checked state and descriptive labels without relying on color.
- The temporary notice is a labeled non-modal region with a polite announcement; it does not steal focus.
- Timeout pauses during hover and keyboard interaction.
- Close is keyboard operable and returns no forced focus destination.
- Six-button responsive layout preserves logical DOM and focus order.
- Paused, interrupted, loading, playing, stopped, and failed status text is perceivable to assistive technology without excessive repeated announcements.
- Reduced-motion preferences remove decorative notice movement without suppressing its content.

## Testing and Validation

### Pure and component coverage

Tests will cover:

- Preference default, versioning, read/write persistence, session override, and throwing storage access.
- Every state and cause-specific transition, including explicit-intent precedence.
- One reusable carrier, user-gesture start, pause retention, full-stop dismissal, and idempotent cleanup.
- Media Session metadata/action registration, replacement, and removal.
- Interruption-signal aggregation, conservative ambiguity handling, automatic recovery, and remain-paused behavior.
- Notice trigger rules, 30-second timer, hover/focus pause, Close, and current-session-only changes.
- Settings-menu persistence and simultaneous active-session update.
- Per-piece loader selection and absence of the aggregate runtime import from the normal station-start path.
- Latest-request-wins cancellation, stale disposal, and Stop during every startup phase.

### Browser coverage

Focused Chromium desktop and mobile tests will verify:

- Expanded six-button layout has no horizontal overflow.
- Collapsed player remains unchanged.
- Menu and notice are reachable in top, bottom, portrait, and short-landscape layouts.
- The notice never overlaps toolbar controls or violates safe-area bounds.
- Timer and accessibility behavior work with fake time and keyboard interaction.
- Media Session mocks reflect Loading, Playing, Paused, Interrupted, Stopped, and station replacement.
- Route changes preserve the current session and do not duplicate carriers or handlers.

A narrowly scoped Playwright WebKit media project will exercise the portable UI, carrier, Media Session capability fallback, and lifecycle logic. It is an engine-compatibility smoke, not proof of iOS notification, lock-screen, background, or phone-call behavior.

### Physical-device acceptance

Android hardware acceptance is required before this branch claims completion. It will cover at least:

- Browser tab and installed-PWA playback where installation is supported.
- Notification drawer and lock-screen station metadata.
- Notification and Bluetooth/headset Play/Pause.
- Previous/Next when the operating system exposes them.
- In-app Stop and Media Session Stop dismissal.
- Screen lock, backgrounding, and return to the app.
- Incoming call ignored or declined with automatic resume enabled and disabled.
- Incoming call answered and ended with automatic resume enabled and disabled.
- Another media or meeting application that generates an observable interruption.
- Carrier/start failure and generator recovery.

The test report must distinguish system muting, app Paused state, generator teardown, and actual audible recovery. Desktop mocks cannot waive a failed physical-device behavior.

Apple support will be implemented through the same portable contracts and tested in Playwright WebKit. Physical iPhone/iPad acceptance remains pending until hardware or an authorized remote-device service is available; project documentation must state that boundary rather than presenting it as certified.

### Branch validation

Implementation validation will run focused tests first, then typecheck, lint, the full Node test suite, the production build, relevant Chromium browser matrices, the focused WebKit project, and `git diff --check`. Performance evidence will compare current and new startup telemetry under documented cold and warm conditions.

## Repository and Coordination Boundaries

The work is isolated at `C:\tmp\massagelab-android-media-notifications` on `codex/media-notifications-audio-interruptions`, based on refreshed merged main commit `903e6def564d21427f72517a7e818de2e2b6a32a`.

The concurrent admin-interface worktree currently changes only:

- `docs/aegis/work/2026-08-11-admin-operations-production-activation/*`
- `lib/admin/admin-operations-qa-lifecycle-proofs.ts`
- `tests/admin-operations-activation.test.mjs`
- New admin-operations activation scripts
- New admin-operations attestation fixtures

There is no current overlap with this specification or the expected media/player runtime owners. The admin changed-file set must be rechecked immediately before implementation edits. Any newly overlapping file requires a warning to the user before editing.

Likely implementation ownership remains within the global music provider, mini-player, Generative.fm runtime/loader, focused media preference/carrier helpers, one portable carrier asset, global responsive player styles, Playwright configuration for the scoped WebKit project, and focused Node/browser tests. Canonical project state/log updates should occur only after implementation truth exists and after another overlap check.

## Out of Scope and Follow-up Order

This branch is the first follow-up from the mobile media/carousel work. The remaining order stays:

1. Complete cross-platform media notifications, interruptions, and responsiveness here.
2. Design and implement casting in a separate isolated branch.
3. Revisit fullscreen control safety in a later isolated branch without moving the existing size controls until a satisfactory design is approved.

## Acceptance Criteria

The design is fulfilled when:

- A supported browser owns playback through one reusable HTML media carrier while Tone remains the audible generator runtime.
- Android physical testing confirms an active notification/media card with accurate station metadata and Play/Pause behavior.
- Notification Pause stops the generator but retains a resumable card; Play starts a fresh session; Stop dismisses the card.
- In-app Stop ends the session, dismisses the operating-system card, and the next in-app Play shows a new session notice.
- Automatic resume defaults on locally, survives reload, and can be changed through the expanded-player menu.
- The 30-second notice gives a current-session-only checkbox without blocking controls or overwriting the saved default.
- Menu changes update both the active session and saved default.
- Observable interruptions follow the selected policy, while explicit user Pause/Stop is never overridden.
- Unsupported or ambiguous platforms degrade conservatively without false claims.
- Per-piece dynamic loading and latest-request-wins cancellation improve responsiveness without stale playback or leaked nodes.
- The expanded toolbar fits six actions without horizontal scrolling and the collapsed toolbar remains unchanged.
- Focused WebKit automation passes, with physical Apple verification clearly recorded as pending rather than certified.
- Casting, fullscreen-control changes, backend/admin behavior, and notification-permission workflows remain outside the branch.

## References

- Generative.fm silent carrier: https://github.com/generativefm/play/blob/main/src/playback/silent-html5-audio-middleware.js
- Generative.fm Media Session middleware: https://github.com/generativefm/play/blob/main/src/playback/media-session-middleware.js
- Generative.fm player controls: https://github.com/generativefm/play/blob/main/src/playback/playback-with-controls.jsx
- Generative.fm piece loader: https://github.com/generativefm/play/blob/main/webpack/piece-loader.js
- Chrome Media Session guidance: https://developer.chrome.com/blog/media-session
- Chrome media notifications: https://developer.chrome.com/blog/media-notifications
- Android audio focus: https://developer.android.com/media/optimize/audio-focus
- W3C Audio Session Working Draft: https://www.w3.org/TR/audio-session/
- Safari 15 Media Session support: https://webkit.org/blog/11989/new-webkit-features-in-safari-15/
- WebKit system-interruption Pause behavior: https://results.webkit.org/commit?id=305995%40main&repository_id=webkit
