# Atmosphere Rendered Piano And Source Rollout Batch

Date: 2026-06-19
Branch: `codex/atmosphere-rendered-piano-batch`
Status: Implemented

## Goal

Enable the next rendered-note Generative.fm batch by hosting package-compatible piano sample indexes for `no-refrain`, `transmission`, and `trees`, then broaden the same branch to host the remaining 25 currently covered source-index stations while preserving the established public-media, Opus-sidecar, and raw-audio-outside-Git boundaries.

## Scope

- Inspect each package's runtime sample requests and render the exact piano note groups that the package expects.
- Use local CC0 VSCO, VCSL, and Signature Sounds source samples from `C:\Users\derri\code\audio`.
- Publish WAV-backed `sample-index.json` and `manifest.json` files plus Ogg Opus `sample-index.opus.json` and `manifest.opus.json` sidecars under each piece prefix.
- Mark only verified stations playable in MassageLab: first the three rendered-piano stations, then the 25 expanded source-index rollout stations after their WAV and Opus metadata are uploaded and HTTP-verified.
- Keep all raw and rendered audio payloads outside Git.

## Non-Goals

- No YouTube station support.
- No user-authored generator controls.
- No new sample-library intake beyond already verified VSCO, VCSL, and Signature Sounds source files.
- No CI build-cache changes.
- No changes to the public Wellness data or therapist professional-record boundaries.

## Hosted Pieces

### Rendered Piano Pieces

| Piece | Rendered group | Rendered notes |
| --- | --- | --- |
| `no-refrain` | `no-refrain__vsco2-piano-mf` | A2, C3, G3, G2, C4, E4, G4, B4, C5, E5, G5, B5 |
| `transmission` | `transmission__vsco2-piano-mf` | A1, C#2, E2, G#2, C4, E4, G4, A#4, D#5, G5, A#5, D6 |
| `trees` | `trees__vsco2-piano-mf` | C3, E3, G3, C4, E4, G4, C5, E5, G5, C6, E6, G6, B6 |

Each piece also publishes the piece-scoped `vsco2-piano-mf` source index so the manifest is auditable, but playability is tied to the package-compatible rendered group.

### Expanded Source-Index Rollout

The user chose to finish the remaining currently covered local-source stations on this branch instead of continuing in small batches. The rollout hosts: `420hz-gamma-waves-for-big-brain`, `a-viable-system`, `above-the-rain`, `agua-ravine`, `apoapsis`, `beneath-waves`, `bhairav`, `buttafingers`, `documentary-films`, `drones`, `drones-2`, `enough`, `expand-collapse`, `homage`, `nakaii`, `oxalis-1`, `remembering`, `return-to-form`, `ritual`, `soundtrack`, `splash`, `spring-again`, `substrate`, `timbral-oscillations`, and `yesterday`.

These pieces use piece-scoped source indexes from confirmed CC0 VSCO, VCSL, and Signature Sounds sources, including the documented SSO-role adaptations for choir and cor anglais roles. They remain piece-scoped so a shared source name such as `vsco2-piano-mf` does not globally enable unrelated packages.

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

The expanded source-index rollout then published 703 WAV-side R2 objects across the 25 additional pieces: 653 source WAV payloads plus 50 metadata objects.

- WAV payload represented by the 25 hosted plans: 2,077.7 MB.
- All 25 `sample-index.json` and `manifest.json` URLs return `200` with JSON content and `Access-Control-Allow-Origin: *`.

The 2026-06-19 expanded Opus upload published 703 sidecar objects: 653 Ogg Opus audio payloads plus 50 sidecar metadata objects.

- Encoded Opus payload: 99.9 MB.
- Compression ratio: 0.0481.
- All 25 `sample-index.opus.json` and `manifest.opus.json` URLs return `200` with JSON content and `Access-Control-Allow-Origin: *`.
- Representative beach ambience, darbuka, tenor sax Opus files and a piano WAV fallback returned `206 Partial Content`, correct audio content types, `Content-Range`, and `Access-Control-Allow-Origin: *`.

## Runtime Notes

`no-refrain`, `transmission`, and `trees` use `createPrerenderableSampler` in their Generative.fm packages. Unlike direct source-index pieces, these stations need rendered instrument keys to avoid browser-time prerendering and to match the package-facing sample names.

The catalog keeps shared source groups piece-scoped instead of treating them as globally hosted coverage. That prevents other packages from becoming playable before their own package-compatible requests are inspected and hosted.

## Validation

- `node --test tests/atmosphere-generative-fm-render-plan.test.mjs tests/atmosphere-generative-fm-first-batch-samples.test.mjs tests/atmosphere-generative-fm-sample-coverage.test.mjs tests/atmosphere-stations.test.mjs tests/atmosphere-web-audio-format-pilot.test.mjs tests/atmosphere-generative-fm-sample-index.test.mjs`
- `npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"`
- `npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --dry-run --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --dry-run --public-base-url "https://media.massagelab.app"`
- `npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --piece no-refrain --piece transmission --piece trees --public-base-url "https://media.massagelab.app"`
- New WAV and Opus sample-index HTTP checks.
- Representative rendered-piano Opus range/CORS header checks.
- Expanded source-index rollout WAV and Opus dry runs/uploads for the 25 additional pieces.
- Expanded source-index rollout metadata HTTP checks for all 25 pieces plus representative WAV/Opus range/CORS checks.
- `npm run typecheck`
- `npm run lint`
- `npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium`
- `npm run test`
- `npm run build`
- `git diff --check`

## Follow-Up Candidates

- Continue station enablement only after replacement/source-review work for the remaining 18 pieces.
- Keep replacement pieces separate so licensing, source fit, and package-compatible sample naming stay auditable.
- Compare first-play timing for direct piano, rendered piano, rendered vibraphone, and rendered glock stations now that all playable stations expose Opus sidecars.
