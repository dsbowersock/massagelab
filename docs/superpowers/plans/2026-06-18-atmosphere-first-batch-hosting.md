# Atmosphere First Batch Hosting

**Date:** 2026-06-18
**Branch:** `codex/atmosphere-first-batch-hosting`
**Scope:** Publish and enable the first three non-Observable Streams Generative.fm stations after the rendered-sample planner branch.

## Goal

Upload the already-planned first batch to `massagelab-public-media`, verify browser-readable hosted indexes and WAV payloads, then mark only the verified stations playable in MassageLab.

## Hosted Pieces

| Piece | Hosted prefix | Runtime decision |
| --- | --- | --- |
| `aisatsana` | `atmosphere/generative-fm/aisatsana` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`. |
| `at-sunrise` | `atmosphere/generative-fm/at-sunrise` | Rendered-note station using CC0 VCSL vibraphone source files plus package-compatible rendered WAVs. |
| `little-bells` | `atmosphere/generative-fm/little-bells` | Rendered-note station using CC0 VSCO glockenspiel source files plus package-compatible rendered WAVs. |

The upload command was:

```powershell
npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --public-base-url https://media.massagelab.app
```

The upload produced 64 R2 objects and approximately 140.6 MB of WAV payload without committing raw or rendered audio to Git.

## Implementation Notes

- `lib/atmosphere/generative-fm-catalog.js` now has a piece-scoped hosted registry for Observable Streams, `aisatsana`, `at-sunrise`, and `little-bells`.
- Shared source names are not treated as global hosted coverage. In particular, `vsco2-piano-mf` enables `aisatsana` through its piece-specific hosted index, but does not enable other piano-backed packages such as Day/Dream.
- `lib/atmosphere/generative-fm-sample-coverage.js` treats a piece as hosted when its piece id has a verified hosted registry entry, while preserving local-source-candidate group details for future render planning.
- `/wellness/atmosphere` and `/browse` continue to use the global music provider and persistent mini-player; no PHI, account audio data, or raw sample files are stored by this branch.

## Verification

Completed local checks:

```powershell
npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"
node --test tests/atmosphere-stations.test.mjs tests/atmosphere-generative-fm-sample-coverage.test.mjs tests/atmosphere-generative-fm-sample-index.test.mjs tests/atmosphere-generative-fm-render-plan.test.mjs tests/atmosphere-generative-fm-first-batch-samples.test.mjs
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium
```

Hosted media verification confirmed each first-batch `sample-index.json` returned JSON with `Access-Control-Allow-Origin: *`, and representative WAV range requests returned `206`, `Content-Type: audio/wav`, `Content-Range`, and `Access-Control-Allow-Origin: *`.

## Next Handoff

The next Atmosphere station-enablement branch should choose another small batch from the 35 local-source candidate pieces, generate package-compatible rendered/index coverage, upload to piece-scoped public-media prefixes, and browser-smoke each station before marking it playable.
