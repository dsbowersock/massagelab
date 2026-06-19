# Atmosphere Rendered Piano Batch

Date: 2026-06-19
Branch: `codex/atmosphere-rendered-piano-batch`
Status: Implemented

## Goal

Enable the next small rendered-note Generative.fm batch by hosting package-compatible piano sample indexes for `no-refrain`, `transmission`, and `trees` while preserving the established public-media, Opus-sidecar, and raw-audio-outside-Git boundaries.

## Scope

- Inspect each package's runtime sample requests and render the exact piano note groups that the package expects.
- Use local CC0 VSCO upright piano source samples from `C:\Users\derri\code\audio`.
- Publish WAV-backed `sample-index.json` and `manifest.json` files plus Ogg Opus `sample-index.opus.json` and `manifest.opus.json` sidecars under each piece prefix.
- Mark only the three verified stations playable in MassageLab.
- Keep all raw and rendered audio payloads outside Git.

## Non-Goals

- No YouTube station support.
- No user-authored generator controls.
- No new sample-library intake beyond already verified VSCO piano source files.
- No CI build-cache changes.
- No changes to the public Wellness data or therapist professional-record boundaries.

## Hosted Pieces

| Piece | Rendered group | Rendered notes |
| --- | --- | --- |
| `no-refrain` | `no-refrain__vsco2-piano-mf` | A2, C3, G3, G2, C4, E4, G4, B4, C5, E5, G5, B5 |
| `transmission` | `transmission__vsco2-piano-mf` | A1, C#2, E2, G#2, C4, E4, G4, A#4, D#5, G5, A#5, D6 |
| `trees` | `trees__vsco2-piano-mf` | C3, E3, G3, C4, E4, G4, C5, E5, G5, C6, E6, G6, B6 |

Each piece also publishes the piece-scoped `vsco2-piano-mf` source index so the manifest is auditable, but playability is tied to the package-compatible rendered group.

## Upload Result

The 2026-06-19 WAV upload published 112 R2 objects for the three pieces:

- `no-refrain`: 23 source WAVs, 12 rendered WAVs, `sample-index.json`, and `manifest.json`.
- `transmission`: 23 source WAVs, 12 rendered WAVs, `sample-index.json`, and `manifest.json`.
- `trees`: 23 source WAVs, 13 rendered WAVs, `sample-index.json`, and `manifest.json`.

The 2026-06-19 Opus upload published 112 sidecar objects: 106 Ogg Opus audio payloads plus 6 sidecar metadata objects.

- WAV payload represented by the three hosted plans: 360.5 MB.
- Encoded Opus payload: 16.9 MB.
- Compression ratio: 0.0469.

Header verification confirmed all six new `sample-index.json` and `sample-index.opus.json` URLs return `200` with JSON content. Representative rendered-piano Opus files returned `206 Partial Content`, `Content-Type: audio/ogg; codecs=opus`, `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

## Runtime Notes

`no-refrain`, `transmission`, and `trees` use `createPrerenderableSampler` in their Generative.fm packages. Unlike direct `vsco2-piano-mf` source-index pieces, these stations need rendered instrument keys to avoid browser-time prerendering and to match the package-facing sample names.

The catalog keeps `vsco2-piano-mf` piece-scoped instead of treating it as globally hosted coverage. That prevents other piano-backed packages from becoming playable before their own package-compatible requests are inspected and hosted.

## Validation

- `node --test tests/atmosphere-generative-fm-render-plan.test.mjs tests/atmosphere-generative-fm-first-batch-samples.test.mjs tests/atmosphere-generative-fm-sample-coverage.test.mjs tests/atmosphere-stations.test.mjs tests/atmosphere-web-audio-format-pilot.test.mjs`
- `npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"`
- `npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --dry-run --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --dry-run --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --public-base-url "https://media.massagelab.app"`
- New WAV and Opus sample-index HTTP checks.
- Representative rendered-piano Opus range/CORS header checks.
- `npm run typecheck`
- `npm run lint`
- `npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium`
- `npm run test`
- `npm run build`
- `git diff --check`

## Follow-Up Candidates

- Continue station enablement from the remaining 25 local-source candidate pieces.
- Prioritize another small rendered-note batch over replacement/source-review pieces so licensing stays low-risk.
- Compare first-play timing for direct piano, rendered piano, rendered vibraphone, and rendered glock stations now that all playable stations expose Opus sidecars.
