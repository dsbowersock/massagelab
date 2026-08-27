# Atmosphere Artwork, Live Media State, and Vinyl Player Design

**Date:** 2026-08-15

**Status:** User-approved design pending written-spec review

**Branch:** `codex/media-notifications-audio-interruptions`
**Physical reference device:** Samsung Galaxy S24 Ultra (SM-S928U1), One UI 8.5, Android 16, Chrome 151.0.7922.137

## Purpose

Finish the Atmosphere media experience after physical Android acceptance exposed four connected gaps:

1. Notification and lock-screen artwork changes by station but does not match the artwork shown in the station carousel.
2. The finite silent media carrier causes Chrome and One UI to show a misleading ten-second timeline for an indefinite generator.
3. The centered station card's Play action requires two presses in the observed phone flow.
4. The global player bar needs a stronger control hierarchy and a decorative, state-driven vinyl presentation using the active station artwork.

The implementation must preserve the already-approved Media Session interruption behavior, Previous/Next station switching, notification ownership, safe-area geometry, and single-generator ownership.

## Confirmed user decisions

- Use the canonical-artwork and visual-only vinyl approach.
- Treat the vinyl as decorative; it must not become another Play/Stop target.
- Place the vinyl on the left.
- Show the complete vinyl in expanded mode.
- In minimized mode, keep the vinyl at the same breakpoint-specific size, translate it downward, and expose only its upper arc behind the station identity.
- Keep minimized controls limited to station identity/status, Play/Stop, and Expand.
- Keep the desktop volume slider visible immediately before Minimize.
- Use a shorter horizontal expanded composition in short phone landscape, with a smaller but complete vinyl.
- Represent the generator as Live rather than displaying a finite duration.
- Retain Previous/Next because physical acceptance proved that they switch stations.

## Scope

### In scope

- One canonical station-art image source shared by carousel cards, the global player bar, Media Session metadata, notification surfaces, and lock-screen surfaces.
- An exact PNG representation of the current carousel artwork, not a separate visual approximation.
- A visual-only adaptation of Componentry's Music Player vinyl.
- Expanded and minimized player-bar layouts, button ordering, semantic button variants, favorite behavior, responsive geometry, safe areas, and reduced motion.
- A first-activation fix for carousel Play, based on a reproducing touch/pointer regression.
- Publishing an indefinite Media Session position state with a guarded fallback.
- Automated desktop, phone portrait, short-landscape, Media Session, artwork, and regression validation.
- Follow-up physical acceptance on the named Samsung device and Chrome version.

### Out of scope

- A second audible player, `<audio>` owner, YouTube iframe, or independent playback state inside the vinyl component.
- Componentry's tonearm.
- Making the vinyl clickable.
- Replacing the finite carrier with a MediaStream carrier during this first implementation.
- Forcing One UI to expose a visible Stop action; MassageLab retains the registered handler, while the platform chooses visible actions.
- Casting.
- Apple physical-device certification. Automated WebKit remains compatibility smoke only.
- Changes to the admin-interface worktrees.

## Existing-state findings

- The carousel renders `AtmosphereStationArtwork` as an inline deterministic SVG.
- The notification endpoint independently recreates the motif with ImageResponse-safe CSS shapes. It shares seed, palette, and motif selection but not the carousel renderer, which explains the physical mismatch.
- The player bar currently exposes only the station title/status and controls; it has no artwork surface.
- The silent ownership carrier loops a ten-second MP3. Clearing Media Session position state does not stop Chrome or One UI from inferring that finite duration from the active media element.
- The Componentry registry item contains a separate audio/YouTube player, tonearm, and `framer-motion` import. MassageLab will retain only the licensed vinyl visual language and will not introduce that second playback path.
- The current admin worktrees change admin-specific documents, `lib/admin/**`, admin scripts, fixtures, and admin tests. None overlaps the player, carousel, artwork, Media Session, carrier, or shared player CSS files anticipated by this design.

## Architecture

### Canonical station artwork

The station-art route becomes the sole image identity for every user-visible playback surface. It returns a cacheable 512 by 512 PNG generated from the same deterministic geometry, palette, seed, and motif that define the approved carousel artwork.

The carousel and player bar consume that route rather than maintaining their own rendered copies. Media Session metadata uses the same station URL. Therefore, one station ID resolves to one exact image across the page, notification, and lock screen.

The renderer remains deterministic:

- repeated requests for one station return byte-stable artwork;
- every known station remains visually distinct, including stations that share a motif and palette;
- unknown station IDs return a bounded 404;
- responses use the correct PNG content type and explicit cache headers.

If an artwork request fails in the page, the affected surface shows a neutral MassageLab-colored fallback with accessible station text. Artwork failure never blocks generator playback.

### Visual-only vinyl component

Run the user-requested registry command during implementation:

```text
npx shadcn@latest add @componentry/music-player
```

Then reduce the generated component to a decorative `StationVinyl` boundary with inputs equivalent to:

- canonical artwork URL;
- station title for accessible labeling where needed;
- playing state;
- reduced-motion state or CSS media-query behavior;
- responsive presentation class names.

The adapted component contains no `<audio>`, iframe, local playback state, tonearm, click handler, or Motion dependency. It uses CSS for the record, grooves, glare, label/pin treatment, and rotation. It is pointer-inert and cannot intercept player controls.

The source file and the project documentation preserve Componentry's MIT attribution and describe the adaptation boundary.

### Playback ownership

The existing Music provider remains the sole owner of:

- the generative runtime;
- the silent Media Session carrier;
- active station identity;
- Loading, Playing, Paused, Interrupted, Stopped, and Failed state;
- Media Session metadata and handlers;
- Previous/Next;
- favorites;
- volume;
- interruption preferences.

The vinyl derives its presentation from provider state. It must not issue playback commands or infer its own state.

## Player-bar presentation

### Expanded mode

The expanded bar is taller in ordinary portrait and desktop layouts. A fully visible, left-aligned vinyl sits behind the foreground content. A restrained dark translucent treatment provides text and button contrast while preserving recognition of the artwork.

The five-button primary group is ordered exactly as follows:

1. Favorite
2. Previous
3. Play/Stop
4. Next
5. Background

Play/Stop is therefore the true center of the group.

Button contracts:

- Favorite uses the same heart component, purple styling, and selected state as the carousel.
- Previous and Next use the glow variant.
- Play uses the existing green success variant.
- Stop uses the red destructive variant during Loading or Playing.
- Background uses the attention variant.
- Settings uses the glow variant and sits in the far-left utility position.
- The desktop volume slider remains visible in the right utility area.
- Minimize uses the glow variant and sits at the far right.

The station title, status, error copy, and loading progress remain readable above the visual background. All controls retain tooltips and accessible names.

### Minimized mode

Minimized mode retains only:

- station title/status;
- Play/Stop;
- Expand.

At each responsive breakpoint, the vinyl retains its expanded size but translates downward so only its upper arc appears behind the station identity. It remains pointer-inert and does not create horizontal or vertical scrolling.

### Short phone landscape

Short phone landscape uses a bounded horizontal composition with a smaller but complete vinyl. It retains the full expanded control set and preserves as much carousel/workspace height as possible. It must not make the player toolbar scroll.

### Safe areas and placement

The redesign preserves both top and bottom player placement, safe-area insets, the interruption notice's edge relationship, app-shell content reservation, Chimer control offsets, increased-text behavior, and expanded/minimized transitions. The root toolbar remains the source of shell reservation truth.

## Behavior

### Vinyl motion

- Playing: rotate continuously.
- Loading, Paused, Interrupted, Stopped, or Failed: freeze at the current rotation rather than reset.
- `prefers-reduced-motion: reduce`: never rotate.
- Station changes update the image without creating a second audio or animation owner.

### Carousel Play

The first touch, pointer, mouse, or keyboard activation of the centered station Play button must immediately enter Loading and begin the selected playback request. The accepted Play intent must not be consumed by prewarming, carousel drag handling, component replacement, or press-feedback guards.

As soon as the request is accepted, the button changes to destructive Stop. Stop during Loading invalidates the request, dismisses the carrier as appropriate, and prevents all late runtime, decode, graph, or scheduling completions from transitioning to Playing.

Repeated Play requests cannot create duplicate generators.

### Adjacent stations and favorites

Previous/Next continue the current media session while switching the generator. Title and canonical artwork update together for the page and Media Session publication. Favorite toggles the active station through the existing persisted favorites collection and matches the carousel's selected presentation.

### Live Media Session position

Each relevant Media Session publication attempts:

```js
{ duration: Infinity, position: 0, playbackRate: 1 }
```

This truthfully describes an indefinite generator and allows supporting platforms to present Live rather than a seekable finite track. The call is optional and guarded. If the browser rejects it, the controller clears position state and preserves playback, metadata, and all five action handlers.

If the named Samsung/Chrome acceptance build still exposes the carrier's finite timeline, that result is recorded without claiming success. A MediaStream-backed carrier becomes a separately designed fallback rather than an implicit expansion of this implementation.

## Accessibility

- The decorative vinyl is hidden from the accessibility tree or otherwise avoids duplicate artwork announcements.
- Station identity remains available as text.
- Every icon-only action retains an accessible name and tooltip.
- Favorite exposes pressed state.
- Loading progress preserves its accessible progress semantics.
- Player settings and interruption preference remain keyboard accessible.
- Focus order follows the visual control order without entering the decorative vinyl.
- Reduced motion prevents record rotation without changing playback behavior.
- Increased text must not overlap the vinyl, controls, notice, or safe-area regions.

## Failure containment

- Artwork generation or loading failure does not affect audio playback.
- Optional Media Session position failure does not affect metadata, action handlers, or playback.
- A carrier Play rejection continues to allow generator playback while disabling unsupported interruption controls as already designed.
- A failed or superseded generator start cannot overwrite a newer station, Pause, or Stop state.
- The player layout must remain bounded if station copy is long, loading is slow, or safe-area insets are nonzero.

## Validation

### Focused automated validation

- Media Session unit tests for Live position publication, rejected-call fallback, metadata, and five handlers.
- Artwork route/model tests for content type, cache policy, 404s, byte stability, and uniqueness across every known station.
- Browser assertions that carousel cards, expanded vinyl, minimized vinyl, Media Session metadata, and Previous/Next changes use the same canonical artwork URL.
- Touch, pointer, mouse, and keyboard first-activation tests proving one Play action reaches Loading/Playing.
- Loading cancellation tests proving no transient or late Playing state.
- Player control order, semantic variant, tooltip, pressed-state, and settings-menu tests.
- Expanded/minimized geometry at desktop, phone portrait, short phone landscape, top placement, bottom placement, safe-area insets, increased text, loading, and interruption-notice states.
- Normal-motion tests proving only Playing rotates and reduced-motion tests proving the vinyl is always stationary.

### Regression validation

- Media Session and carrier unit suites.
- Atmosphere runtime and latest-request controller suites.
- Station carousel and adaptive-carousel suites.
- App-shell, public-route, visualizer, and background/toolbar integration browser suites.
- Desktop Chromium, mobile Chromium, and scoped WebKit media-smoke matrices.
- `npm run lint`.
- `npm run typecheck`.
- `npm run test`.
- `npm run build`.
- `git diff --check` and exact status review.

### Physical Android acceptance

On the named Samsung device and Chrome version, verify:

1. Carousel, expanded player, minimized player, notification, and lock screen show matching artwork for the same station.
2. Previous and Next update title and artwork together.
3. The notification presents Live rather than a ten-second seekable timeline.
4. One station-card activation starts playback.
5. Notification Pause, Play, Previous, Next, interruption handling, and dismissal behavior remain correct.
6. The OS-visible action set is recorded exactly; a visible Stop button is not claimed when One UI omits it.

## Source and license record

- Component reference: `https://componentry.dev/docs/components/music-player`
- Source repository: `https://github.com/harshjdhv/componentry`
- Registry item: `https://componentry.fun/r/music-player.json`
- Upstream license: MIT, copyright 2026 Harsh Jadhav
- MassageLab adaptation: decorative vinyl only; no tonearm, embedded player, iframe, or Motion dependency

## Completion boundary

This work is complete only when the automated gate passes, the physical Android observations are recorded truthfully, canonical project documentation reflects the final result, the draft PR is updated, and the hosted review loop completes on the exact pushed head. The PR must not be merged by Codex.
