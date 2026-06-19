# Atmosphere Performance And Audio QA

Branch: `codex/atmosphere-performance-audio-qa`

## Goal

Make the hosted Generative.fm stations more reliable and easier to diagnose when startup is slow, without autoplaying audio, broad-fetching the full catalog, or changing the public station catalog shape.

## Current Findings

- The Generative.fm web provider fetches and decodes every requested sample URL in an unbounded `Promise.all` burst.
- Stations with larger or more varied sample sets can therefore compete heavily for network, decode, and renderer memory during first playback.
- MassageLab already emits `massagelab:atmosphere-startup-timing`, but it did not report how many sample URLs a station requested or whether decoded buffers were reused in the current page session.
- The page had a payload-warmup path available in the provider, but the current Atmosphere workspace only called metadata/module prewarm.
- A local post-change timing pass showed `Little Bells`, `Beneath Waves`, and `Neuroplasticity` starting quickly enough for the current branch, while `Awash` and `Moment` still spend roughly 11-18 seconds in package activation. Forcing AAC or MP3 did not materially improve those two stations, so their remaining delay is likely sample/source-level work rather than generic format preference.

## Scope

- Wrap the Generative.fm provider with a MassageLab helper that batches sample request/decode work and reuses decoded buffers within one audio context.
- Keep request batching conservative so stability improves before aggressive performance tuning.
- Extend startup telemetry with sample request counts, unique URL counts, memory-hit counts, batch counts, and max batch size.
- Warm compressed sample payloads only for a tiny idle starter set and deliberate station hover intent.
- Respect low-bandwidth browser signals such as save-data and `2g`/`slow-2g`.
- Keep WAV fallback payloads lazy; the existing runtime payload warmup already skips WAV.
- Move the public station route to `/atmosphere`, keep `/wellness/atmosphere` as a redirect, and wire supported-browser Media Session notification controls from the global provider.
- Keep the Generative.fm-inspired browsing polish scoped to `/atmosphere`: category rails, swipe/scroll behavior, rail buttons, and deterministic organic-geometric SVG station artwork. `/browse` stays a compatibility grid/workbench for the same station runtime.

## Validation

- Focused provider-helper tests for batching, order preservation, same-context decoded-buffer reuse, progress reporting, and failure propagation.
- Existing sample-index and runtime-controller tests.
- `npm run typecheck`
- `npm run lint`
- Browser smoke for `/atmosphere` startup timing, station playback after the provider wrapper, legacy route redirect behavior, and Media Session control registration.
- Browser smoke for the `/atmosphere` rail/artwork surface while `/browse` still renders the compatibility grid.

## Follow-Up

- Use the richer startup timing event to identify the slowest stations by actual sample request/decode shape.
- Tune flagged station source substitutions separately, especially voice-like, wave-like, and sparse bell stations.
- Investigate in-station pops/clicks after the startup path is stable; those are likely package scheduling or sample-boundary artifacts rather than the initial loading bottleneck.
