# Carousel Production Rollout

## Goal

Promote the two approved `/dev/buttons` Carousel Lab winners into their production surfaces without importing development code or changing catalog, entitlement, playback, preference, or local-storage contracts.

## Approved presentations

- Backgrounds: the Existing radial presentation, selected from available-width profiles at 164×312/22 degrees, 200×240/26 degrees, 220×304/29 degrees, 256×360/33 degrees, or 280×388/36 degrees. Every profile uses zero gap, nearby radius two, 420-pixel radial geometry, 0.08 scale falloff, loop on, and motion on.
- Music Stations: the Clock/Chimer Background Picker presentation at 192×224 for the centered card and 193 pixels for surrounding summaries on every screen, with zero gap, nearby radius four, 27-degree spread, 420-pixel radius, 0.05 scale falloff, loop on, and motion on.

## Production scope

1. Extract the approved Embla controller, presentation variables, responsive profile resolver, stage, and stage styles into production-owned shared carousel modules.
2. Keep the Carousel Lab as a review and regression surface by rebinding it to those shared production primitives. No production module may import from `app/dev`.
3. Replace the custom radial Background carousel inside the shared immersive panel used by Clock, Chimer, and Music Visualizer. Preserve real background filtering, feature-key access checks, selected-background state, saved-background local storage, haptics, panel-close behavior, bounded nearby video previews, and reduced-motion cleanup.
4. Replace `/music` station rails with one approved category-aware Station carousel. Preserve real grouped station data, explicit play/stop/favorite actions, audio prewarming, loading feedback, attribution/details dialog, active-station state, and category-relative centered positions.
5. Keep `/browse` on its existing grid layout and keep non-carousel Background selectors unchanged.

## Shared component ownership

- `components/carousels/`: generic carousel geometry, Embla state, responsive presets, and presentation shell.
- `components/backgrounds/`: production Background carousel and card binding.
- `components/atmosphere/`: production Music Station carousel and existing real station card binding.
- `app/chimer/running-timer.tsx`: immersive-panel orchestration only; custom swipe/index/preview bookkeeping is removed once the shared carousel owns it.
- `app/browse/workspace.tsx`: route composition and non-carousel grid ownership only.

## Guardrails

- Do not change Background registry eligibility, `premium_backgrounds` feature-key behavior, Music provider state, audio runtime behavior, account synchronization, or device-storage keys.
- Do not autoplay stations when centering. Centering may prewarm only; play, stop, select, and favorite remain explicit controls.
- Keep slide identity stable through loop wraps, filtering, category changes, and viewport-profile changes.
- Keep only nearby full renderers mounted. Distant items retain carousel semantics through lightweight shells.
- Pause Background preview video when it is not nearby, the panel is closed, the document is hidden, or reduced motion is requested.
- Preserve keyboard, pointer, touch, focus, dialog, and live-status behavior.

## Validation

- Focused model and source-boundary tests for shared production ownership, exact approved presets, mounted-item bounds, loop behavior, and no `app/dev` production imports.
- Existing Carousel Lab desktop/mobile matrix after rebinding to shared primitives.
- Production `/music` desktop/mobile checks for category switching, exact card geometry, looping, play/stop/favorite/details, loading/prewarm safety, and no document overflow.
- Production Clock/Chimer/Music Visualizer desktop/mobile checks for exact responsive Background profiles, filtering, selection, saved state, locked state, navigation, nearby media bounds, panel dismissal, and reduced motion.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `git diff --check`.

## Completion gate

Track 3B is complete only when the production screenshots match the approved Carousel Lab screenshots at representative phone, tablet/compact, and desktop sizes, the real interactions pass, and the project state records the production rollout rather than a pending gate.
