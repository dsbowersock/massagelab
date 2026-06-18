# Atmosphere Startup Performance

Date: 2026-06-18
Branch: `codex/atmosphere-startup-performance`
Status: Implemented

## Goal

Reduce the delay between tapping a playable Generative.fm station and hearing the station start, without changing sample hosting, committing audio files, or starting browser audio before a user gesture.

## Scope

- Reuse browser cache behavior for hosted `sample-index.json` reads instead of forcing every runtime fetch to bypass cache.
- Prepare Generative.fm station metadata and runtime modules before playback when the page is idle, hovered, or focused.
- Keep Tone startup and actual sample audio downloads inside the user-initiated playback path.
- Add a low-noise startup timing event so future performance branches can compare first-play behavior without relying on manual observation.
- Keep `/wellness/atmosphere` and `/browse` on the same station workspace and global mini-player behavior.

## Non-Goals

- No WAV-to-MP3, Ogg, or Opus conversion in this branch.
- No R2 re-upload, sample-index schema change, or station enablement change.
- No CI dependency/build cache change in this branch.
- No YouTube, account-synced station settings, or user-authored generator controls.

## Implementation Notes

`fetchGenerativeFmSampleIndex` now defaults to browser cache-aware fetch semantics while still allowing callers to pass a reload mode for operational checks. The browser runtime caches the shared Tone/provider/library module import promise and a per-station prepared runtime promise keyed by piece id, sample-index URL, and required sample groups.

Prewarm calls validate the hosted sample-index metadata and import the browser runtime modules. They intentionally do not call `Tone.start()`, start `Tone.Transport`, construct the station output node, or fetch WAV sample payloads. Playback reuses any existing prepared promise, starts Tone after the click, activates the piece, schedules it, and records timing.

The workspace prewarms enabled Generative.fm stations after browser idle time with a short stagger, and also prewarms a station on hover or focus. Prewarm errors are swallowed because playback remains the authoritative place to report station failures.

Playback dispatches `massagelab:atmosphere-startup-timing` on `window` with `stationId`, `pieceId`, `usedPrewarm`, and startup phase timings. `usedPrewarm` is only true when playback reused a preparation promise that had already completed before the playback request. Debug console logging is opt-in with:

```js
localStorage.setItem("massagelab:atmosphere:debug", "1")
```

## Validation

- `node --test tests/atmosphere-generative-fm-sample-index.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium`

## Follow-Up Candidates

- Pilot web-optimized audio formats for a small hosted station subset and compare first-play time, storage, and browser support against the current WAV payloads.
- Add GitHub Actions cache coverage for npm and Next build artifacts if CI logs continue showing avoidable cold-build cost.
- Continue hosted sample coverage in separate branches, keeping station enablement tied to package-compatible index/upload/browser verification.
