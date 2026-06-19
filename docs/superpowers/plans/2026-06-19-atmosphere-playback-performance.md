# Atmosphere Playback Performance

## Goal

Reduce perceived first-play delay for hosted Generative.fm stations without autoplaying, starting Tone, starting Transport, constructing output nodes, or downloading broad catalog payloads before user intent.

## Scope

- Keep automatic route idle work metadata-only: hosted sample-index validation, shared browser runtime imports, and package piece imports.
- Add a bounded sample payload warmup path for stronger user intent: station hover, station focus, and play-button pointer-down/focus.
- Warm only the selected compressed format (`opus`, `aac`, or `mp3`) and skip WAV payload prefetch so large fallback audio remains user-playback gated.
- Keep sample payload warmup opportunistic and non-blocking; playback still surfaces real runtime errors.
- Extend startup timing detail so browser smoke can see selected sample format, completed metadata prewarm reuse, completed payload warmup reuse, and payload warmup count.

## Implementation Notes

- `selectGenerativeFmSampleWarmupUrls` chooses deterministic URLs from the validated sample index using the first usable candidate in each package sample group.
- Runtime payload warmup is capped at 24 URLs per station with three concurrent fetches and uses browser cache-aware fetches so the later Generative.fm web library can reuse cached payloads when available.
- `/wellness/atmosphere` still prewarms all playable Generative.fm stations metadata-only after idle, then escalates to sample payload warmup only on specific station intent.
- The mini-player loading status now says `Preparing audio...`, which better matches startup work during package activation and sample loading.

## Validation

- Focused node tests for sample-index URL selection, station catalog, and runtime controller.
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- Browser smoke for `/wellness/atmosphere` startup timing and route-persistent playback.
