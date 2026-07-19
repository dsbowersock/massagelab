# Clock, Chimer, and Music Visualizer Design

**Date:** 2026-07-18
**Status:** Approved for implementation planning
**Track:** 2 of 6
**Surfaces:** Active Chimer, `/clock`, persistent Music player, and Music visualizer

## Summary

Replace the active Clock/Chimer display's single tabbed Settings button with three separate controls: **Clock**, **Visual**, and **Background**. Clock and Visual open bottom-first docked panels that preserve a protected view of the centered display. Background opens a full-screen modal picker and is the only panel allowed to cover the display.

Extend the existing shared `/clock` and active-Chimer renderer with a Music visualizer context. Whenever a station has been selected, the persistent Music player exposes a Background control in expanded and collapsed layouts. The control opens the full-screen visualizer picker until a background has been explicitly selected and then opens `/clock?source=music` as the visualizer. Minimizing returns to the originating route, unmounts the animation to save resources, and leaves playback and the saved visualizer choice intact.

The design also adds two independent, off-by-default display effects inspired by the referenced Neon Clock: slow display rotation and a forward-projected glow. Both apply to whichever timer or clock display is centered.

## Current State

- `/clock` delegates to `ChimerPage`, which starts the shared `RunningTimer` in Clock status.
- Active Chimer and Clock already share display rendering, background hosting, Clock settings, Visual settings, and the background picker.
- One Settings button opens one nonmodal overlay with Clock, Visual, and Background tabs.
- The overlay auto-closes after inactivity and also closes through outside interaction or `Escape`.
- The current panel overlays a fixed edge and does not reserve a measured safe stage around the digits.
- Screen Wake Lock is always requested in standalone Clock mode, while active Chimer follows `keepTimerScreenAwake`.
- The Music player is global and route-persistent, but has no visualizer action.
- `/music` currently owns a separate `BackgroundHost`, visible picker, and `massagelab.music.background` preference.
- Atmosphere audio preferences are local, versioned, non-PHI settings. Account app preferences already support merged non-sensitive nested values.

## Goals

- Replace the single Settings button completely with Clock, Visual, and Background controls.
- Use one mode-aware immersive display for active Chimer, ordinary Clock, and Music visualizer.
- Keep Clock and Visual panels open until the user closes them, switches panels, presses `Escape`, or clicks outside.
- Guarantee that docked panels do not cover the protected centered display.
- Allow only Background to intentionally cover the display.
- Keep timer-only controls in Clock and expose them only for active Chimer.
- Put Keep screen awake at the top of Visual only for active Chimer; ordinary Clock and Music visualizer request wake lock automatically while active and expose no toggle.
- Give ordinary Clock and Music visualizer separate remembered Show clock preferences.
- Keep active Chimer timer information visible at all times.
- Make the Music visualizer available from the persistent player after a station is selected, including loading, playing, stopped, and recoverable failure states.
- Preserve playback while opening, changing, or minimizing the visualizer.
- Let signed-in users explicitly save a cross-device Music visualizer default and sync the visualizer Show clock preference.
- Unmount minimized visualizer animation to reduce GPU and battery use.
- Add off-by-default Display rotation and Forward glow options for the centered display.
- Preserve current background eligibility and future compatibility with account ownership work in Track 1.

## Non-goals

- Selecting a new carousel implementation; Track 3 owns that review and choice.
- Implementing background credits, purchasing, ownership, refunds, or chargebacks; Track 1 owns commerce.
- Adding DNA or Twisted Cubes; Track 4 owns those backgrounds.
- Adding shuffle-colors behavior.
- Creating a separate user-selected `/music` page background.
- Replacing the current Clock font renderer with the Neon Clock's seven-segment renderer.
- Moving every effect-specific background control out of `running-timer.tsx` solely for this redesign.
- Adding a Prisma migration or storing sensitive data in preferences.
- Changing station playback, generation, catalog, or media-session behavior beyond the visualizer action.

## Immersive Contexts

The shared display has three explicit contexts.

| Context | Entry | Center display | Background preference | Close behavior |
| --- | --- | --- | --- | --- |
| `chimer` | Active timer from `/chimer` | Timer or user-swapped current time | Chimer settings, category `chimer` | End timer through existing confirmation/behavior |
| `clock` | Direct `/clock` | Current time when Show clock is on | Chimer settings, category `clock` | Preserve existing ordinary Clock exit behavior |
| `musicVisualizer` | `/clock?source=music` | Optional current time; off by default | Music visualizer preference, category `music` | Minimize to sanitized originating route |

`ChimerPage` remains the shared state owner and resolves an immutable mode object for `RunningTimer`. The mode object defines:

- context name;
- whether Show clock is available;
- current Show clock value and setter;
- background category, selected ID, and setter;
- whether an explicit usable visualizer selection exists;
- close/minimize semantics;
- whether Music default actions are available; and
- whether active-timer tools are available.

## Music Visualizer Routing

The Music player constructs an internal route with these approved query values:

- `source=music` selects `musicVisualizer` context.
- `panel=background` requests that the full-screen Background picker open on entry.
- `returnTo=<encoded internal path>` records the originating pathname and search string.

The Background control follows this state machine:

1. No station selected: the player is not shown solely for visualizer access.
2. Station selected and no usable explicit/default background: open `/clock?source=music&panel=background&returnTo=…`.
3. Station selected with a usable background: open `/clock?source=music&returnTo=…`.
4. Already in Music visualizer: the control becomes **Minimize visualizer** and returns to `returnTo`.

The route helper accepts only same-origin app paths beginning with one `/`, rejects protocol-relative values, rejects recursive Music visualizer targets, and falls back to `/music`. Browser Back naturally returns through route history. The visible Minimize control uses `router.replace(safeReturnTo)` so it returns deterministically without leaving a visualizer loop directly behind the restored route.

The Music player remains rendered above the normal visualizer. Only the full-screen Background panel covers the player.

## Music Visualizer Preferences

### Local device state

The versioned Atmosphere storage grows these fields:

```ts
interface MusicVisualizerDevicePreferences {
  backgroundId: BackgroundId | null
  showClock: boolean
}
```

Defaults:

- `backgroundId: null`, which means no explicit device selection;
- `showClock: false`.

The storage migration must preserve favorites, recent stations, volume, and collapsed-player state from v1. If the legacy `massagelab.music.background` key exists, its value becomes the device visualizer background only during the first migration when v2 has no explicit visualizer field. V2 persists a `legacyMusicBackground` consumed marker; any explicit v2 value, including `backgroundId: null`, is authoritative. Restore or clearing writes the explicit null plus marker, so retaining the legacy key for rollback cannot resurrect stale state. A future unknown storage version is preserved untouched and reported as unsupported rather than normalized or overwritten by v2 code. The migration does not assume a stored background is currently eligible.

Device background choices persist for anonymous and signed-in users. For a signed-in user, choosing a non-default background remembers that override on the current device without changing the account default.

### Account state

Account app preferences gain a namespaced non-sensitive value:

```ts
interface MusicVisualizerAccountPreferences {
  defaultBackgroundId: BackgroundId | null
  showClock: boolean
}
```

The object lives under the existing merged app-settings JSON contract, so no database migration is required. Server merge behavior must preserve it when unrelated theme, app-bar, sidebar, or quick-action preferences change.

Resolution order for a signed-in user:

1. usable device `backgroundId`;
2. usable account `defaultBackgroundId`;
3. no visualizer selection, which opens the picker.

Selecting a background updates the device value and immediately closes the picker to reveal the visualizer. It does not update the account default.

The Visual panel exposes:

- **Set as visualizer default** when signed in and the current device choice differs from the account default;
- current/default status;
- **Restore account default**, which clears the device override so the account default resolves again; and
- a retryable status if saving fails.

Anonymous users retain the device choice and see no account-save action. For a signed-in user, the account Show clock value becomes authoritative after account hydration and is mirrored locally for offline use. Later changes update local state immediately and sync the account value; a failed sync leaves the local value active with retry feedback.

An unavailable account default is retained rather than deleted. The resolver refuses to render it and opens the picker with an explanation, allowing access to resume if entitlement or ownership changes later.

## Ordinary Clock Visibility

Ordinary `/clock` adds a separate sanitized Chimer preference:

```ts
showClockDisplay: boolean // default true
```

Music visualizer uses its own `showClock`, default false. Changing either value never changes the other.

Show clock appears only in `clock` and `musicVisualizer` contexts. Active Chimer never exposes it and never allows the centered timer information to be hidden. When Show clock is off, the display effects remain saved but their controls are disabled with a short explanation.

## Context-Aware Keep Screen Awake Behavior

The existing `keepTimerScreenAwake` setting remains the default-on persisted Chimer opt-out. It moves to the top of Visual only for active Chimer. Turning it off allows the device to dim or sleep during an active Chimer.

Ordinary `/clock` and Music visualizer expose no Keep screen awake toggle. While active, both request Screen Wake Lock automatically regardless of the Chimer preference; the Music visualizer does so while its background is active even when Show clock is off. Idle Chimer setup never requests Screen Wake Lock.

A supported visible document requests Screen Wake Lock according to that context policy. Hidden documents release it, and visible documents reacquire it when still requested. Unsupported or denied wake locks do not crash the display; Visual reports the unavailable state in every context while preserving the Chimer preference.

## Immersive Control Group

The old Settings button and internal tab list are removed completely. A grouped immersive toolbar contains three separate toggles:

- Clock;
- Visual;
- Background.

Wide layouts show icon plus label. Narrow layouts prioritize the controls by using icon-only buttons with accessible names and tooltips. Existing Close, fullscreen, pause/play, font-size, display-swap, and timer controls remain separate.

Only one panel may be active:

- selecting another control switches directly;
- selecting the active control closes it;
- `Escape` closes the active panel and restores focus to its control;
- Clock and Visual close on an outside pointer interaction;
- Background always closes through its own always-visible Close control or `Escape`, closes immediately after an available selection, and closes on outside interaction when content leaves visible overlay. A true full-viewport panel naturally has no outside target. The underlying toolbar is covered and inert while the modal is open.

Clock and Visual are nonmodal. Background is modal. Interaction inside the panel or an approved portaled child such as the shared color picker does not count as an outside click.

All settings auto-close timers and activity rescheduling are removed. While any panel is open, the necessary immersive chrome does not fade or hide.

## Bottom-first Safe Stage

Clock and Visual use a measured bottom-first dock:

1. Measure the centered display's protected bounds and the open panel's height with `ResizeObserver`.
2. Reserve a bottom inset and re-center the display in the remaining stage when the panel fits safely below it.
3. If the bottom placement cannot preserve the protected display and safe-area spacing, reserve the top instead.
4. Constrain the panel before the protected display and scroll its contents internally.
5. Recalculate after font changes, display swaps, panel changes, orientation changes, viewport resizing, and player/app-bar placement changes.

The safe-stage contract applies at desktop, phone portrait, zoomed layouts, and short landscape viewports. The dock may reduce available display space but may not cover the protected digits.

Background is exempt from the safe-stage contract. It opens as a fixed full-screen modal above the clock, app navigation, Music player, and all other chrome. It has its own always-visible Close control, traps focus, makes the rest of the app inert, and restores focus to Background when dismissed.

## Panel Contents

### Clock

- Show clock in Clock contexts only.
- Show timer seconds in Chimer context.
- Show clock seconds.
- Font size and font family.
- Clock, timer, and secondary-display colors as currently entitled.
- 12/24-hour time format.
- Clock stroke and its controls.
- Clock drop shadow and its controls.
- Existing Clock outer glow and its controls.
- New Display rotation toggle.
- New Forward glow toggle.
- Active Chimer remaining-time adjustment.
- Active Chimer chime-interval adjustment.
- Existing completed/inactive messaging where adjustment is unavailable.

### Visual

- Keep screen awake at the top only for active Chimer; omit the toggle from ordinary Clock and Music visualizer while still showing unsupported/denied wake-lock status.
- Visual background on/off.
- Selected-background customization.
- Global color mode, colors, and harmony controls.
- Saved palette management.
- In Music visualizer context, current/default background status, Set as visualizer default, Restore account default, and sync feedback.

### Background

- Background category filters.
- Existing background picker and card behavior.
- Eligibility/locked messaging through the current entitlement contract until Track 1 extends it.
- Selection only; effect customization remains in Visual.

Selecting an available background immediately updates the appropriate context, closes Background, and reveals the result. If Visual has not been opened on the device, selection briefly highlights its toolbar control with the accessible hint `Customize this background in Visual.` The hint never opens Visual, traps focus, covers the toolbar, or account-syncs. Opening Visual writes a narrowly named, non-sensitive local visit flag and suppresses future hints; denied storage falls back safely to in-memory visit state. The visual pulse is reduced-motion safe, and the persistent seen state changes only when Visual is actually opened. Track 3 may replace the picker implementation without changing panel, routing, or preference interfaces.

## Display Rotation and Forward Glow

Both toggles are added to sanitized Chimer settings and default off:

```ts
clockRotationEnabled: boolean
clockForwardGlowEnabled: boolean
```

They apply to whichever display is centered: active timer, user-swapped current time, ordinary Clock, or visible Music visualizer Clock.

### Display rotation

- Wrap the existing centered display in a transform layer.
- Use a slow approximately 40-second ease-in-out yaw from roughly `-10deg` to `10deg` and back.
- Keep the measured layout box stable so safe-stage calculations do not oscillate.
- Suppress continuous rotation under `prefers-reduced-motion`, even if the preference remains enabled.

### Forward glow

- Render an `aria-hidden`, pointer-free duplicate projection of the centered display.
- Derive its color from the active display color.
- Use a shallow 3D floor transform, blur, opacity falloff, and gradient mask.
- Update automatically after display swaps, timer changes, time changes, or color changes.
- Keep the projection inside the visual stage and out of control hit areas.

The referenced [Neon Clock Pen](https://codepen.io/wheatup/pen/JjzdMbK) uses a slow `rotateY(-10deg)` to `rotateY(10deg)` camera animation and duplicated digit layers transformed onto a blurred, masked floor plane. MassageLab adapts those approved behaviors to its existing display rather than copying the Pen's digit renderer. Implementation must verify reusable terms before copying source-specific declarations; if terms remain unclear, reproduce the behavior independently and record inspiration rather than copied code.

## Music Page and Player

`AtmosphereWorkspace` no longer owns a selectable page background. Remove its `BackgroundHost`, visible `BackgroundSelector`, visualizer-specific effect activation, and direct `massagelab.music.background` writes after migration support exists.

`MusicMiniPlayer` adds one action that is always present when a station is selected:

- expanded player: icon and Background/Minimize label;
- collapsed player: icon-first button with accessible label and tooltip;
- loading: enabled;
- playing: enabled;
- stopped: enabled while the station remains selected;
- recoverable failure: enabled while the station remains selected.

The action does not restart, stop, or otherwise mutate audio. The visualizer route continues using the global Music provider, so navigation does not interrupt playback.

When minimized, the visualizer `BackgroundHost` unmounts completely. The selected device value, account default, Show clock preference, station, and player remain available for reopening.

## Component Boundaries

### Pure visualizer module

Owns defaults, sanitization, storage migration, account/device resolution, internal URL construction, and safe return-path validation. These functions are DOM-independent and unit-testable.

### Music provider

Owns hydrated device and account visualizer state, selection/default actions, sync status, and visualizer navigation actions alongside existing playback state.

### Chimer page

Resolves `chimer`, `clock`, or `musicVisualizer`, joins the correct settings source to `RunningTimer`, and keeps timer/wake-lock state authoritative.

### Immersive panel shell

Owns the grouped controls, one-active-panel state, dismissal/focus behavior, modal/nonmodal frames, safe-stage measurement, and shared CSS variables. It consumes Clock, Visual, and Background content slots without knowing effect-specific controls.

### Running timer

Continues to own display rendering and existing setting controls. It consumes the compact mode object and panel shell rather than creating a second Music-specific renderer.

### Atmosphere workspace and mini player

Workspace returns to station discovery only. Mini player exposes and labels the route-aware visualizer action.

## Error Handling

- Local hydration and visualizer use remain available if account preference fetches fail.
- Failed account-default saves leave the previous default unchanged and current device choice active, with retry feedback.
- Storage-denied browsers retain in-memory state for the visit and show a nonblocking notice.
- Invalid `returnTo` values fall back to `/music`.
- Unavailable saved backgrounds are retained but not rendered; the picker explains the fallback.
- Existing BackgroundHost fallback and cleanup behavior remains authoritative for effect-load failures.
- Wake-lock errors are reported in Visual without breaking Clock, Chimer, or playback.
- Preference hydration must not briefly render a premium or stale background before eligibility is known.
- Color-picker portals are excluded from outside-click dismissal.

## Accessibility

- Use one accessible name per toolbar control and tooltip support when labels collapse.
- Preserve visible focus, haptics integration, and keyboard activation through shared control primitives.
- Clock and Visual use labeled nonmodal dialog semantics.
- Background uses labeled modal dialog semantics, focus trap, inert background content, and deterministic focus restoration.
- Do not communicate active panel state only through color; use `aria-expanded` and `aria-controls`.
- Show clock cannot hide active Chimer timer information.
- Forward-glow duplicates are `aria-hidden` and pointer-free.
- Reduced-motion behavior is enforced at render time rather than relying only on animation duration.
- Panel scrolling, Close, and essential controls remain reachable at 200% zoom, phone portrait, and short landscape sizes.

## Validation Contract

### Unit and source tests

- Atmosphere v1-to-v2 migration preserves existing audio preferences.
- Legacy Music background becomes an explicit device visualizer choice when present.
- Visualizer defaults are `backgroundId: null` and `showClock: false`.
- Return-path validation accepts internal routes and rejects external, protocol-relative, and recursive targets.
- URL building encodes source, optional panel, and origin correctly.
- Device choice overrides account default only on that device.
- Restore clears the device override and resolves the account default.
- Unavailable selections fall back without deleting account state.
- Account app-settings merge preserves Music visualizer data and unrelated settings.
- Ordinary Show clock defaults on and remains separate from Music Show clock.
- Display rotation and Forward glow default off and sanitize non-boolean input.
- Active Chimer requires literal `keepScreenAwake === true`; active ordinary Clock and Music visualizer request wake lock regardless of that value, including when Music Show clock is off; idle and invalid contexts never request it.
- Settings auto-close timer code is removed.
- `/music` no longer contains a BackgroundHost, BackgroundSelector, or separate background state.

### Browser tests

- Player Background action appears in expanded and collapsed states after station selection.
- The action remains available while loading, playing, stopped, and recoverably failed.
- First use opens Background full-screen and covers clock, app bar, and Music player.
- Selecting a background immediately closes the picker and reveals the visualizer.
- Music visualizer starts with Show clock off and remembers its own preference.
- Ordinary `/clock` starts visible and retains a separate preference.
- Signed-in default save, device override, and Restore default behave as specified.
- Minimize and browser Back return to the originating route without stopping playback.
- Clock, Visual, and Background enforce a single active panel.
- Active control, Close, outside click, and `Escape` dismiss as specified and restore focus.
- Panels do not auto-close after inactivity.
- Clock/Visual bounds do not intersect protected digit bounds at desktop, phone portrait, zoomed, and short-landscape viewports.
- Background covers every global chrome layer.
- Active Chimer does not expose Show clock and retains timer-only controls in Clock.
- Display rotation and Forward glow target the centered display after swaps.
- Reduced motion suppresses continuous rotation.
- Minimizing unmounts the visualizer background while leaving the player and selection available.

### Repository validation

- Focused Node tests.
- Focused desktop and mobile Playwright tests.
- `npm run lint`.
- `npm run typecheck`.
- `npm run test`.
- `npm run build`.
- `git diff --check`.
- Manual visual review at desktop, phone portrait, and short landscape widths before broad follow-up work.

## Approved Decisions

- Use a mode-aware shared immersive display rather than a global overlay or separate visualizer implementation.
- Keep Music visualizer preferences separate from normal Clock/Chimer background settings.
- Music visualizer Show clock defaults off and is remembered; ordinary Clock defaults on and remembers separately.
- Sync account visualizer default and Show clock across devices.
- Keep signed-in non-default choices remembered on the current device until restored or changed.
- Do not create a separate selectable Music page background.
- Unmount the animation when minimized for resource efficiency.
- Use one single-active adaptive control group.
- Close docked panels by active toggle, Close, `Escape`, or outside click; close Background by selection, Close, `Escape`, or a pointer interaction on any visible outside overlay.
- Use bottom-first safe-stage docking.
- Keep background customization in Visual and selection in Background.
- After the first qualifying selection on a device that has never opened Visual, briefly point to Visual without opening it; record seen only when Visual opens and fall back to in-memory state if local storage is denied.
- Put Keep screen awake at the top of Visual only for active Chimer; ordinary Clock and Music visualizer expose no toggle and request wake lock automatically while active.
- Expose Show clock only in Clock contexts, never active Chimer.
- Use only two new effect toggles, with no speed or intensity controls.
- Cover all global chrome when Background is open.
- Selecting a background reveals it immediately.
- Put Set as visualizer default and Restore default in Visual.
- Minimize returns to the originating route.
