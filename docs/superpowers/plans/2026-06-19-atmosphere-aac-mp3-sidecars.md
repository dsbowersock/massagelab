# Atmosphere AAC/MP3 Sidecars

## Goal

Expand the hosted Generative.fm compressed-audio path from Opus-only sidecars to an ordered `opus -> aac -> mp3 -> wav` fallback pipeline. The goal is faster first playback for browsers that cannot use Ogg Opus, especially older iOS and Android browsers, while preserving the existing WAV indexes as the universal final fallback.

## Scope

- Cover every playable Generative.fm station, not just the final 18 generators from the current branch.
- Keep raw WAV sources outside Git.
- Reuse the existing public-media R2 object prefixes and immutable audio caching.
- Keep Opus as the preferred compressed format, then AAC/M4A, then MP3, then WAV.

## Implementation

- `lib/atmosphere/web-audio-format-pilot.js` defines reusable Opus, AAC, and MP3 sidecar format descriptors with FFmpeg arguments, content types, file extensions, and `canPlayType` strings.
- `scripts/atmosphere-upload-web-audio-format-r2.mjs` and `scripts/atmosphere-upload-generative-web-audio-r2.mjs` accept `--format opus|aac|mp3`. Omitting `--format` keeps the existing Opus default.
- `lib/atmosphere/generative-fm-catalog.js` exposes `sample-index.opus.json`, `sample-index.aac.json`, and `sample-index.mp3.json` URLs for Observable Streams and all hosted package stations.
- `lib/atmosphere/generative-fm-runtime.ts` selects sample indexes in this order:
  1. Ogg Opus: `audio/ogg; codecs="opus"`
  2. AAC-LC in MP4/M4A: `audio/mp4; codecs="mp4a.40.2"`
  3. MP3: `audio/mpeg`
  4. WAV fallback

The selected `sampleFormat` stays in the prepared-runtime cache key and startup timing event so mixed browser support cannot reuse an incompatible preparation.

## Upload Result

Observable Streams:

- AAC: 56 objects, with 54 AAC/M4A audio payloads plus `sample-index.aac.json` and `manifest.aac.json`; 172.1 MB represented WAV became 10.0 MB AAC.
- MP3: 56 objects, with 54 MP3 audio payloads plus `sample-index.mp3.json` and `manifest.mp3.json`; 172.1 MB represented WAV became 14.0 MB MP3.

All 56 Alex Bainter package stations:

- AAC: 1,758 objects, with 1,646 AAC/M4A audio payloads plus 112 sidecar metadata objects; 4,673.5 MB represented WAV became 238.0 MB AAC.
- MP3: 1,758 objects, with 1,646 MP3 audio payloads plus 112 sidecar metadata objects; 4,673.5 MB represented WAV became 313.5 MB MP3.

Combined all-station totals:

- AAC: 1,814 sidecar objects, representing 4,845.6 MB WAV as 248.0 MB AAC.
- MP3: 1,814 sidecar objects, representing 4,845.6 MB WAV as 327.5 MB MP3.

## Commands

Observable Streams:

```powershell
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format aac --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format mp3 --public-base-url "https://media.massagelab.app"
```

All package stations:

```powershell
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format aac --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format mp3 --public-base-url "https://media.massagelab.app"
```

Add `--piece <piece-id>` to the package-station command only for targeted repairs.

## Validation

- `node --test tests/atmosphere-web-audio-format-pilot.test.mjs tests/atmosphere-stations.test.mjs`
- `npm run typecheck`
- `npm run atmosphere:samples:web-audio:r2:check`
- `npm run atmosphere:samples:generative:web-audio:r2:check`
- AAC/MP3 R2 uploads for Observable Streams and all 56 package stations completed.
- HTTP validation checked all 57 `sample-index.aac.json` and all 57 `sample-index.mp3.json` URLs for JSON, CORS, and required package sample groups.
- Representative Observable Streams, Peace, and Zed AAC/MP3 audio payloads returned `206 Partial Content`, expected content types, valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

