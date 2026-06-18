# Atmosphere Wellness Surface

## Goal

Expose the proven Atmosphere runtime as a public Wellness tool, add the first breathing guide companion, and surface the full Generative.fm station catalog without changing sample hosting, subscription gates, custom mixes, or YouTube scope.

## Scope

- Add `/wellness/atmosphere` as the public route for hosted audio stations.
- Keep `/browse` as a compatibility workbench while routing product discovery to the Wellness path.
- Add a Wellness page entry point, sidebar navigation metadata, and homepage/onboarding tool catalog entry.
- Preserve route-persistent playback through the existing global `MusicProvider` and mini-player.
- Add a first public Calmness-style breathing guide beside the station controls.
- Add the `@generative-music/pieces-alex-bainter` catalog dependency, render all 57 Generative.fm pieces as station rows, and enable only pieces with package-compatible hosted rendered sample coverage.
- Update focused navigation and browser smoke coverage.

## Non-Goals

- No user-authored generators, station editing, account sync, subscription gating, or YouTube channel/radio support.
- No hosted clinical storage or therapist-facing wellness sharing.
- No new audio samples, Cloudflare bucket changes, or additional sample uploads in this branch.
