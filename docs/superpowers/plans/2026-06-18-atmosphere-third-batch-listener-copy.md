# Atmosphere Third Batch Listener Copy

**Date:** 2026-06-18
**Branch:** `codex/atmosphere-third-batch-listener-copy`
**Scope:** Publish and enable three more direct-piano Generative.fm stations, then replace station-card implementation copy with listener-facing sound descriptions.

## Goal

Enable `pinwheels`, `sevenths`, and `uun` using the verified piece-scoped VSCO upright piano source-index path, and keep public station cards focused on what each station sounds like instead of package, sample-index, bucket, or implementation details.

## Hosted Pieces

| Piece | Hosted prefix | Runtime decision |
| --- | --- | --- |
| `pinwheels` | `atmosphere/generative-fm/pinwheels` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`; the package calls `createSampler(samples['vsco2-piano-mf'])`. |
| `sevenths` | `atmosphere/generative-fm/sevenths` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`; the package calls `createSampler(samples['vsco2-piano-mf'])`. |
| `uun` | `atmosphere/generative-fm/uun` | Source-index station using hosted CC0 VSCO upright piano files under `vsco2-piano-mf`; the package calls `createSampler(samples['vsco2-piano-mf'])`. |

The upload command was:

```powershell
npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --public-base-url https://media.massagelab.app --piece pinwheels --piece sevenths --piece uun
```

The upload produced 75 R2 objects and approximately 258.5 MB of WAV payload without committing raw audio to Git.

## Implementation Notes

- `lib/atmosphere/generative-fm-render-plan.js` now includes package evidence for the three direct-piano source-index pieces.
- `lib/atmosphere/generative-fm-first-batch-samples.js` selects the existing VSCO piano source assets for the three new piece ids.
- `lib/atmosphere/generative-fm-catalog.js` marks only the three verified pieces hosted through piece-scoped metadata. The shared `vsco2-piano-mf` source group is still not globally hosted for every remaining piano-backed package.
- The station catalog now stores listener-facing sound descriptions for the full Generative.fm catalog. Public card descriptions and pending-state notices no longer expose package/sample-index/bucket mechanics, while `runtime.missingSampleGroups` preserves exact operator metadata for planning and tests.
- `/wellness/atmosphere` and `/browse` continue to use the global music provider and persistent mini-player; no PHI, account audio data, or raw sample files are stored by this branch.

## Verification

Completed checks:

```powershell
npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url https://media.massagelab.app --piece pinwheels --piece sevenths --piece uun
npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --public-base-url https://media.massagelab.app --piece pinwheels --piece sevenths --piece uun
npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"
node --test tests/atmosphere-stations.test.mjs tests/atmosphere-generative-fm-sample-coverage.test.mjs tests/atmosphere-generative-fm-sample-index.test.mjs tests/atmosphere-generative-fm-render-plan.test.mjs tests/atmosphere-generative-fm-first-batch-samples.test.mjs
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere lists" --project=desktop-chromium
```

Hosted media verification confirmed each third-batch `sample-index.json` and `manifest.json` returned `200`, and representative `vsco2-piano-mf-c-sharp4.wav` range requests returned `206`, `Content-Type: audio/wav`, `Content-Range`, and `Access-Control-Allow-Origin: *` when requested with an Origin header.

## Next Handoff

The next station-enablement branch should move to a small rendered-note batch from the remaining 28 local-source candidate pieces. Good candidates remain package-derived rendered piano groups such as `no-refrain`, `transmission`, and `trees`, because they map to verified local CC0 piano sources but require package-compatible rendered indexes before playback is enabled.
