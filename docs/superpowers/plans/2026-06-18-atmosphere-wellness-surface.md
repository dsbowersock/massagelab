# Atmosphere Wellness Surface

## Goal

Expose the proven Atmosphere runtime as a public Wellness tool without changing the audio engine, sample hosting, subscription gates, custom mixes, or YouTube scope.

## Scope

- Add `/wellness/atmosphere` as the public route for hosted audio stations.
- Keep `/browse` as a compatibility workbench while routing product discovery to the Wellness path.
- Add a Wellness page entry point, sidebar navigation metadata, and homepage/onboarding tool catalog entry.
- Preserve route-persistent playback through the existing global `MusicProvider` and mini-player.
- Add a first public Calmness-style breathing guide beside the station controls.
- Update focused navigation and browser smoke coverage.

## Non-Goals

- No user-authored generators, station editing, account sync, subscription gating, or YouTube channel/radio support.
- No hosted clinical storage or therapist-facing wellness sharing.
- No new audio samples or Cloudflare bucket changes.
