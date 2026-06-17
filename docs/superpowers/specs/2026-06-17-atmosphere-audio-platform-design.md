# Atmosphere Audio Platform Design

Date: 2026-06-17

## Context

MassageLab is in private alpha with public tools, education surfaces, Chimer treatment-room timing, client-owned wellness self-tracking, and local-first therapist professional-record workflows. The project already tracks a generative music spike as an open P2 item, with the first implementation expected to stay hidden until playback, sample hosting, licensing, bundle size, autoplay behavior, and cleanup are proven.

The product direction is larger than a single embedded music page. The goal is to build a public Atmosphere workspace that lets visitors play MassageLab-hosted generative audio stations, favorite useful stations, create custom ambient mixes, and later customize generator variables. Generative.fm is the reference model and an initial code/source inspiration, not the final user-facing product or remote player UI.

The first implementation should be public and playful enough for visitors to try without an account. Later, once the feature set is useful and polished, some capabilities can move behind subscription levels or add-ons through feature-key entitlement checks.

## Goals

- Build a public Atmosphere product area in branch-sized slices.
- Host generator runtime behavior inside MassageLab instead of embedding Generative.fm as an external UI.
- Start with local browser persistence for favorites, recent stations, and custom ambient presets.
- Keep audio playback site-global so stations continue while users move through Chimer, flashcards, Wellness, and other MassageLab routes.
- Add a persistent bottom mini-player for global audio control.
- Support a custom ambient station builder with curated sound layers plus simple noise and tone generators.
- Place Calmness-style breathing under Wellness and link to it from Atmosphere.
- Leave room for future MassageLab-authored generators and user-customized generator variables.
- Defer YouTube station support until ad, branding, Premium, and policy concerns have a cleaner product answer.

## Non-Goals

- Do not expose Atmosphere in the main sidebar in the first branch.
- Do not build YouTube channel, playlist, or video stations in the first branch series.
- Do not extract YouTube audio, hide YouTube playback, or imply ad-free YouTube behavior.
- Do not build account-synced favorites or presets in the first branch.
- Do not add subscription gates or add-on purchases in the first branch series.
- Do not build uploads, recording, advanced effect chains, or full user-authored DSP.
- Do not add hosted clinical, PHI, or therapist-record behavior to any audio or breathing feature.
- Do not depend on `generative.fm` as the player surface for MassageLab users.

## Product Shape

### Atmosphere Workspace

Route: `/browse`

The existing placeholder `/browse` route should become the hidden public Atmosphere workbench. It is public so visitors can experiment, but it remains out of the sidebar while the branch series proves runtime safety and product value.

Atmosphere provides:

- A station catalog for MassageLab-hosted generator stations.
- Station cards with title, description, source/attribution, mood or use-case tags, and play controls.
- Local favorites and recent stations.
- A custom ambient station builder with curated layers and generator controls.
- Links to related tools, especially Wellness breathing.

The route chooses, configures, or edits audio. It does not own the audio lifecycle. Playback belongs to the global music provider so audio continues across route changes.

### MassageLab-Hosted Generators

Generative.fm should be treated as a reference model and initial generator source, not as an iframe or remote player. Where Alex Bainter's work is used, MassageLab should import or adapt generator code with explicit permission, source attribution, license notes, and sample-source documentation.

Station catalog entries should point to generator modules that run inside the MassageLab client runtime. Early adapters can wrap imported Generative.fm-derived generator pieces. Later adapters can run MassageLab-authored generator templates.

The station model should anticipate generator controls even when the first branch exposes few or none:

- Instrument set.
- Density or activity.
- Texture.
- Tonal center or scale family.
- Tempo or pulse feel.
- Randomization seed or variation mode.
- Layer balance.
- Session mood or massage-use context.

Future user-curated generators should start from safe generator templates. Users adjust exposed variables and save a customized station locally before cloud sync or paid gates are considered.

### Custom Ambient Stations

Moodist, Noisedash, and Atmoify inspire the custom station builder, but MassageLab should implement its own focused version:

- Curated sample or loop layers such as rain, soft room tone, fan, bowls, chimes, water, and gentle texture beds.
- Simple generated white, pink, and brown noise.
- Simple tone or drone generators where musically appropriate.
- Per-layer volume controls.
- Local preset save/load.
- Clear stop and reset behavior.

The first custom builder should avoid advanced filters, LFOs, user uploads, recording, and complex effect routing. Those belong in later branches once the basic audio engine is stable.

### Wellness Breathing

Calmness-style breathing should be a Wellness tool, not a sub-feature trapped inside Atmosphere.

Recommended route: `/wellness/breathing`

Atmosphere should link to it as a companion tool. The breathing route should work with or without active audio, and it should coexist with the global mini-player. The breathing feature should remain public, non-clinical, and framed as a self-guided wellness exercise rather than treatment, diagnosis, monitoring, or therapy.

### YouTube Deferral

Next Beats inspires the idea of user-added stations, but YouTube support is deferred. Current concerns:

- YouTube playback must use a visible YouTube player and follow YouTube policies.
- MassageLab should not extract audio or separate audio from video.
- YouTube ads could be confused with MassageLab content.
- There is no reliable first-party design assumption that MassageLab can expose a "Premium-only" station feature.

The station source model may reserve a disabled future source type for YouTube, but no UI should expose it during this branch series.

## Architecture

### Global Audio Ownership

`MusicProvider` should live high enough in the app tree that audio state survives route changes. It owns:

- Audio context lifecycle.
- Active station or mix.
- Transport state: loading, waiting for user gesture, playing, paused, failed, stopped.
- Master volume.
- Station replacement.
- Cleanup and disposal.
- Local persistence coordination for favorites, recents, and presets.

Routes call provider actions such as `playStation`, `playMix`, `pause`, `resume`, `stop`, and `setVolume`. Routes should not create independent audio contexts or long-lived timers.

### Runtime Layer

`GeneratorRuntime` should isolate generator-module details from UI. It should expose a small contract:

- Load required samples or instruments.
- Start the generator with a destination and options.
- Report loading or failure states.
- Stop and dispose all nodes, timers, loops, and subscriptions.

The runtime should support at least two adapter families:

- Hosted generator adapters for Generative.fm-derived and MassageLab-authored generators.
- Ambient mix adapters for curated layers and simple noise/tone generators.

Adapters should return explicit cleanup handles so station replacement and route transitions cannot leave duplicate playback running.

### Station Catalog

The catalog should be typed and versioned. A station definition should include:

- Stable id.
- Title.
- Description.
- Source type, initially `hosted-generator` or `ambient-mix`.
- Tags for mood, session context, texture, energy, and duration suitability.
- Attribution and license metadata.
- Optional cover or visual treatment.
- Optional exposed controls schema.
- Runtime adapter id and default runtime options.

The catalog can start as code-backed definitions. It should not require database work until account sync or public user-generated publishing is intentionally designed.

### Bottom Mini-Player

The bottom mini-player is persistent across most routes and should show:

- Active station or mix title.
- Source/type label.
- Play/pause.
- Stop.
- Master volume.
- Loading/error state.
- Collapse/expand control.

Chimer immersive and clock states should receive a compact version so treatment-room display remains uncluttered. The compact player still needs visible stop or pause access.

## Persistence

The first persistence implementation should use local browser storage only.

Local persisted objects:

- Favorite station ids.
- Recent station ids.
- Custom ambient mix presets.
- Future customized generator presets.
- Mini-player collapsed preference.
- Master volume preference.

The local schema should include a version field. Signed-in sync can later copy the same saved station objects into account-owned storage without changing the product model.

No audio preferences, favorites, or custom mixes should contain PHI, client appointment details, clinical notes, or therapist professional records.

## Data Flow

Primary station flow:

1. User opens `/browse`.
2. User selects a station card.
3. `AtmosphereWorkspace` calls `MusicProvider.playStation(stationId)`.
4. `MusicProvider` looks up the station definition.
5. `GeneratorRuntime` loads samples or generator resources.
6. Runtime starts audio after an allowed user gesture.
7. Mini-player reflects loading and playback state.
8. User navigates to Chimer, flashcards, Wellness, or another route.
9. Audio continues because the provider remains mounted.
10. User pauses, stops, or replaces the station from the mini-player or another route.
11. Provider disposes the old runtime before starting any replacement.

Custom mix flow:

1. User opens the ambient builder.
2. User toggles curated layers or simple generators.
3. User adjusts volumes and simple controls.
4. User previews the mix through `MusicProvider`.
5. User saves the mix as a local preset.
6. The preset appears as a custom station in local browser state.

## Branch Plan

### 1. `codex/atmosphere-audio-runtime-spike`

Prove the MassageLab-hosted generator runtime behind `/browse`.

Scope:

- Confirm package viability for the selected Generative.fm/Tone.js approach.
- Import or adapt one or two permitted generator modules.
- Prove sample loading and hosting strategy.
- Add attribution and licensing notes.
- Implement basic global `MusicProvider` lifecycle.
- Add minimal player controls.
- Confirm autoplay behavior and user-gesture handling.
- Confirm explicit stop/cleanup across route changes.
- Keep route hidden from sidebar.

### 2. `codex/atmosphere-public-workspace`

Turn `/browse` into a usable public Atmosphere workspace.

Scope:

- Station catalog UI.
- Station cards and detail affordances.
- Local favorites.
- Recent stations.
- Loading and error states.
- Real bottom mini-player.
- Compact player treatment for Chimer immersive and clock states.

### 3. `codex/atmosphere-ambient-mix-builder`

Add custom ambient stations.

Scope:

- Curated sound layers.
- White, pink, and brown noise generators.
- Simple tone or drone generator if it fits the sound direction.
- Per-layer volume sliders.
- Local preset save/load.
- Reset and stop behavior.
- Optional lightweight import/export if the schema is stable enough.

### 4. `codex/wellness-breathing-tool`

Add Calmness-style Wellness breathing.

Scope:

- Public `/wellness/breathing` route.
- Guided breathing patterns.
- Calm visual timing.
- Link from Atmosphere.
- Coexistence with global mini-player.
- Non-clinical wellness copy.

### 5. `codex/atmosphere-generator-controls-foundation`

Prove editable generator variables.

Scope:

- Controls schema for selected hosted generators.
- UI for safe generator variables.
- Local customized station save/load.
- Clear distinction between generator templates and user-customized stations.
- No full user-authored DSP or public publishing yet.

### Later Work

- Signed-in cloud sync for favorites, presets, and customized stations.
- Sidebar exposure once stable.
- Subscription or add-on gates by feature key.
- MassageLab-authored generator authoring workflow.
- Advanced effects and automation.
- Uploads if licensing and storage rules are designed.
- Recording only after legal and product review.
- YouTube support only if policy, ads, attribution, and product confusion risks have a clean answer.

## Error Handling

Audio states should be explicit:

- Idle.
- Loading.
- Waiting for user gesture.
- Playing.
- Paused.
- Failed.
- Stopped.

Failure messages should explain the action a user can take:

- Try again after interacting with the page.
- Stop and restart the station.
- Choose a different station if samples fail.
- Report the issue if a hosted generator fails consistently.

Runtime cleanup must be defensive:

- Starting a station stops and disposes the previous station first.
- Stopping a station disposes nodes, timers, Tone transports, loops, and subscriptions.
- Route navigation does not create duplicate audio contexts.
- Failed loading does not leave partial loops running.
- Page visibility changes should not break playback state or create stacked resumes.

## Policy And Attribution

Branch one must document source and permission details for every imported or adapted generator:

- Upstream source.
- Permission basis.
- License.
- Attribution text.
- Sample source.
- Sample license or permission.
- Hosting location.
- Origin or CORS constraints.

YouTube policy constraints should remain in the design notes so future work does not accidentally implement audio extraction or hidden playback.

External references for future planning:

- Generative.fm: https://generative.fm/
- YouTube API Services Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- YouTube IFrame Player API Reference: https://developers.google.com/youtube/iframe_api_reference

## Testing

Unit or Node tests should cover:

- Station catalog shape.
- Local persisted schema versioning.
- Preset migration helpers.
- Runtime cleanup helpers where they can be tested without a browser audio engine.
- Feature-key gating helpers when paid/add-on gates are added later.

Browser tests should cover:

- `/browse` renders publicly while hidden from sidebar if that remains the current branch expectation.
- Starting a station updates player state.
- Pausing, resuming, and stopping update state.
- Replacing one station with another disposes the previous station.
- Player state remains visible after navigating to another route.
- Favorites and presets persist in local browser storage.
- Chimer immersive or clock state uses compact player behavior.
- No console or page errors on supported browser smoke routes.

Actual audible output may be hard to assert in Playwright. Tests should focus on UI state, lifecycle calls, cleanup behavior, and browser errors.

## Acceptance Criteria

- `/browse` is the public Atmosphere workbench and remains hidden from sidebar until intentionally promoted.
- Atmosphere uses MassageLab-hosted generator runtime behavior rather than embedding Generative.fm as a remote player UI.
- Imported or adapted generator sources include permission, license, attribution, and sample-hosting notes.
- Audio playback is owned by a top-level provider and survives route changes.
- A bottom mini-player exposes active station state, play/pause, stop, volume, and collapse controls.
- Chimer immersive or clock mode has a compact player treatment.
- Local favorites and presets are versioned browser-stored data.
- Custom ambient stations use curated layers plus simple noise/tone generators before advanced effects.
- Breathing is specified as a Wellness route linked from Atmosphere.
- YouTube station support is explicitly deferred and not exposed in first branches.
- Future generator controls are supported by the station model but not required in branch one.
- No PHI-bearing or therapist professional-record data is stored in audio preferences or presets.

## Validation Plan

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run test`.
- Run `npm run build`.
- Add browser tests when the player and route UI are implemented.
- Manually test start, pause, stop, replace, route navigation, Chimer compact mode, reload, and local persistence behavior.
