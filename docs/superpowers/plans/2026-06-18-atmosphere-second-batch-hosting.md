# Atmosphere Second Batch Hosting

**Date:** 2026-06-18
**Branch:** `codex/atmosphere-second-batch-hosting`
**Scope:** Publish and enable the next four package-compatible Generative.fm stations that can use a piece-scoped VSCO piano source index.

## Goal

Upload and verify hosted sample indexes for `day-dream`, `eno-machine`, `impact`, and `lemniscate`, then mark only those verified stations playable in MassageLab while keeping other piano-backed packages disabled until their own package behavior is reviewed.

## Hosted Pieces

| Piece | Hosted prefix | Runtime decision |
| --- | --- | --- |
| `day-dream` | `atmosphere/generative-fm/day-dream` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`; the package builds buffers directly from the source index. |
| `eno-machine` | `atmosphere/generative-fm/eno-machine` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`; the package calls `createSampler(samples['vsco2-piano-mf'])`. |
| `impact` | `atmosphere/generative-fm/impact` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`; the package creates regular and reverse samplers from the same index. |
| `lemniscate` | `atmosphere/generative-fm/lemniscate` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`; the package creates two panned piano samplers from the same index. |

The upload command was:

```powershell
npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --public-base-url https://media.massagelab.app --piece day-dream --piece eno-machine --piece impact --piece lemniscate
```

The upload produced 100 R2 objects and approximately 344.6 MB of WAV payload without committing raw audio to Git.

## Implementation Notes

- `lib/atmosphere/generative-fm-render-plan.js` now includes package evidence for the four second-batch source-index pieces.
- `lib/atmosphere/generative-fm-first-batch-samples.js` still exports the existing helper names for compatibility, but its selection logic now supports planned Generative.fm batches beyond the original three pieces.
- `lib/atmosphere/generative-fm-catalog.js` marks the four new pieces hosted through piece-scoped metadata. The shared `vsco2-piano-mf` source group still is not globally hosted for every piano-backed package.
- `/wellness/atmosphere` and `/browse` continue to use the global music provider and persistent mini-player; no PHI, account audio data, or raw sample files are stored by this branch.

## Verification

Completed checks:

```powershell
npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url https://media.massagelab.app --piece day-dream --piece eno-machine --piece impact --piece lemniscate
npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --public-base-url https://media.massagelab.app --piece day-dream --piece eno-machine --piece impact --piece lemniscate
npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"
node --test tests/atmosphere-stations.test.mjs tests/atmosphere-generative-fm-sample-coverage.test.mjs tests/atmosphere-generative-fm-sample-index.test.mjs tests/atmosphere-generative-fm-render-plan.test.mjs tests/atmosphere-generative-fm-first-batch-samples.test.mjs
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium
```

Hosted media verification confirmed each second-batch `sample-index.json` and `manifest.json` returned `200`, and representative `vsco2-piano-mf-c-sharp4.wav` range requests returned `206`, `Content-Type: audio/wav`, `Content-Range`, and `Access-Control-Allow-Origin: *` when requested with an Origin header.

## Next Handoff

Superseded by the third-batch listener-copy branch. After `pinwheels`, `sevenths`, and `uun`, the next station-enablement branch should pick a small rendered-note batch from the remaining 28 local-source candidate pieces. Good candidates are pieces with package-derived rendered sample groups such as `no-refrain`, `transmission`, and `trees`, because they still map to verified local CC0 piano sources but need package-compatible rendered indexes before playback is enabled.
