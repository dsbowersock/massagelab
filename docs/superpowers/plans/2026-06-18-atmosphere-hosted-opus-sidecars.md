# Atmosphere Hosted Opus Sidecars

Date: 2026-06-18
Branch: `codex/atmosphere-hosted-opus-sidecars`
Status: Implemented

## Goal

Extend the Observable Streams Opus pilot to the other currently hosted Generative.fm stations so Opus-capable browsers load smaller public-media payloads while WAV sample indexes remain the fallback.

## Scope

- Generate Ogg Opus variants for the ten non-Observable hosted Generative.fm station plans.
- Publish sidecar objects under each existing piece prefix at `web/opus/`.
- Publish `sample-index.opus.json` and `manifest.opus.json` beside each existing WAV-backed `sample-index.json` and `manifest.json`.
- Wire hosted station metadata so the browser runtime can choose Opus for all currently playable Generative.fm stations when supported.
- Keep raw and rendered audio outside Git.

## Non-Goals

- No new station enablement for the remaining 46 sample-pending catalog entries.
- No deletion or replacement of WAV objects.
- No CI build-cache changes.
- No MP3 fallback work.

## Implementation Notes

The `atmosphere:samples:generative:web-audio:r2:upload` command reuses the existing hosted Generative.fm WAV upload plans, reads source WAVs from the local audio root, regenerates rendered WAV buffers in memory for At Sunrise and Little Bells, transcodes all WAV bodies to Ogg Opus with FFmpeg, and uploads only the encoded sidecar objects plus sidecar metadata.

Sidecar objects are written under each piece prefix:

```text
atmosphere/generative-fm/<piece>/web/opus/samples/*.opus.ogg
atmosphere/generative-fm/<piece>/web/opus/rendered/<instrument>/*.opus.ogg
atmosphere/generative-fm/<piece>/sample-index.opus.json
atmosphere/generative-fm/<piece>/manifest.opus.json
```

The station catalog now exposes `hostedSampleIndexFormatUrls.opus` and `hostedManifestFormatUrls.opus` for every currently hosted batch station. The runtime selection remains browser capability based and keeps the selected `sampleFormat` in the prepared-runtime cache key.

## Upload Result

The 2026-06-18 upload published 239 R2 objects for ten hosted Generative.fm batch stations: 219 Ogg Opus audio payloads plus 20 sidecar metadata objects.

- WAV source payload represented by the existing hosted plans: 743.7 MB.
- Encoded Opus payload: 31.3 MB.
- Compression ratio: 0.0421.
- Pieces covered: `aisatsana`, `at-sunrise`, `day-dream`, `eno-machine`, `impact`, `lemniscate`, `little-bells`, `pinwheels`, `sevenths`, and `uun`.

Header verification confirmed all ten `sample-index.opus.json` URLs return `200` with JSON content. Representative direct-piano, rendered vibraphone, and rendered glock Opus files returned `206 Partial Content`, `Content-Type: audio/ogg; codecs=opus`, `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

## Validation

- `node --test tests/atmosphere-stations.test.mjs tests/atmosphere-web-audio-format-pilot.test.mjs`
- `node --test tests/atmosphere-stations.test.mjs tests/atmosphere-web-audio-format-pilot.test.mjs tests/atmosphere-generative-fm-sample-index.test.mjs`
- `npm run atmosphere:samples:generative:web-audio:r2:check`
- `npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --public-base-url "https://media.massagelab.app"`
- Hosted batch `sample-index.opus.json` HTTP checks.
- Representative source/rendered Opus range/CORS header checks.
- `npm run typecheck`
- `npm run lint`
- `npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium`
- `npm run test`
- `npm run build`
- `git diff --check`

## Follow-Up Candidates

- Compare first-play timing across direct-piano and rendered hosted stations now that all current stations have Opus sidecars.
- Continue the station-enablement sequence for the 28 local-source candidate pieces.
- Add MP3 sidecars only if a target browser requires a smaller-than-WAV fallback without Ogg Opus support.
