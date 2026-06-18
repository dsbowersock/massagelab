# Atmosphere Web Audio Format Pilot

Date: 2026-06-18
Branch: `codex/atmosphere-audio-format-pilot`
Status: Implemented

## Goal

Reduce first-play sample payload for the hosted Observable Streams station by adding a browser-optimized Ogg Opus sidecar index while keeping the existing WAV sample index as the compatibility fallback.

## Scope

- Generate Opus variants for the existing Observable Streams source and rendered WAV objects.
- Publish encoded objects under the existing public-media R2 prefix without deleting or replacing WAV objects.
- Publish `sample-index.opus.json` and `manifest.opus.json` beside the current `sample-index.json` and `manifest.json`.
- Teach the browser runtime to choose the Opus index only when `audio.canPlayType('audio/ogg; codecs="opus"')` reports support.
- Keep all raw and rendered audio outside Git.

## Non-Goals

- No conversion for every currently playable station in this branch.
- No removal of WAV payloads or WAV fallback behavior.
- No CI cache work.
- No station enablement for the remaining sample-pending Generative.fm catalog.

## Implementation Notes

The `atmosphere:samples:web-audio:r2:upload` command rebuilds the same Observable Streams WAV upload plan, generates rendered WAV buffers in memory, transcodes source/rendered WAV bodies to Ogg Opus with FFmpeg, and uploads only the encoded sidecar objects plus sidecar metadata.

The sidecar object layout mirrors the current source and rendered layout under `web/opus/`:

```text
atmosphere/observable-streams-vsco-adaptation/web/opus/samples/*.opus.ogg
atmosphere/observable-streams-vsco-adaptation/web/opus/rendered/<instrument>/*.opus.ogg
atmosphere/observable-streams-vsco-adaptation/sample-index.opus.json
atmosphere/observable-streams-vsco-adaptation/manifest.opus.json
```

The runtime keeps the selected sample-index URL in the prepared-runtime cache key. Browser startup timing events now include `sampleFormat`, so browser smoke and future measurements can distinguish `opus` from `wav`.

## Upload Result

The 2026-06-18 upload published 56 R2 objects for Observable Streams: 54 Ogg Opus audio payloads plus `sample-index.opus.json` and `manifest.opus.json`.

- WAV source payload represented by the existing plan: 172.1 MB.
- Encoded Opus payload: 10.7 MB.
- Compression ratio: 0.0623.
- Hosted sample index: `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.opus.json`.
- Hosted manifest: `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/manifest.opus.json`.

Header verification confirmed the sidecar sample index returns JSON with `Access-Control-Allow-Origin: *` and short metadata caching. A representative rendered Opus sample returned `206 Partial Content`, `Content-Type: audio/ogg; codecs=opus`, `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

## Validation

- `node --test tests/atmosphere-web-audio-format-pilot.test.mjs tests/atmosphere-stations.test.mjs tests/atmosphere-generative-fm-sample-index.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium`
- `git diff --check`
- `npm run atmosphere:samples:web-audio:r2:check`
- `npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --public-base-url "https://media.massagelab.app"`
- Hosted `sample-index.opus.json` header check.
- Hosted rendered Opus range/CORS header check.

## Follow-Up Candidates

- Compare measured first-play timing between Observable Streams Opus and WAV fallback browsers.
- Extend the Opus sidecar workflow to the other hosted Generative.fm stations once the pilot browser smoke remains stable.
- Add optional MP3 sidecars only if Safari or other target environments need a fallback beyond WAV.
