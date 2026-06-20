# Refactor: Music Provider Lazy Runtime

**Date:** 2026-06-20
**Mode:** target
**Files changed:** 6

## Targets

- `components/providers/music-provider.tsx` -- moved the Atmosphere station catalog, runtime controller, Tone proof runtime, and Generative.fm runtime behind a cached async runtime loader while keeping the provider mounted globally for route-persistent playback.
- `tests/atmosphere-provider-lazy-boundary.test.mjs` -- added a source-contract guard so heavy audio runtime modules do not return to global static imports.
- `docs/superpowers/plans/2026-06-20-codebase-refactor-optimization.md` -- recorded Task 7 measurement, target choice, skipped measured non-targets, and remaining Anatomime follow-up.
- `docs/project-state.md` and `docs/project-log.md` -- recorded the current-state and chronological outcome.

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `/` first-load JS | 1,787,081 bytes | 1,113,612 bytes | -673,469 bytes |
| `/calendar` first-load JS | 2,100,580 bytes | 1,427,111 bytes | -673,469 bytes |
| `/music` first-load JS | about 1.81 MB | 1,598,886 bytes | about -210 KB |
| `/browse` first-load JS | about 1.81 MB | 1,598,886 bytes | about -210 KB |
| Provider line count | 436 | 547 | +111 |

## Transformations Applied

1. Replaced global audio runtime static imports with `loadAtmosphereRuntimeModules()` and a cached `getRuntime()` provider path.
2. Stored active station title/artist in provider state so Media Session and the mini-player do not require synchronous catalog imports.
3. Kept volume changes, next/previous controls, prewarm, stop, and route-persistent playback routed through the lazy runtime handle.
4. Added a source-contract test that rejects static imports of heavy Atmosphere runtime modules from the provider.

## Tests

- Baseline: `node --test tests/atmosphere-stations.test.mjs tests/atmosphere-station-groups.test.mjs tests/atmosphere-runtime-controller.test.mjs tests/atmosphere-generative-fm-provider.test.mjs` passed with 21 tests.
- Final focused: `node --test tests/atmosphere-provider-lazy-boundary.test.mjs tests/atmosphere-stations.test.mjs tests/atmosphere-station-groups.test.mjs tests/atmosphere-runtime-controller.test.mjs tests/atmosphere-generative-fm-provider.test.mjs` passed with 22 tests.
- Browser: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere proof station keeps global player state across client routes|Atmosphere registers mobile media notification controls" --project=desktop-chromium` passed.
- Build: `npm run build` passed before and after the transformation.

## Learnings

- The largest first-load win came from removing globally imported audio runtime dependencies, not from splitting calendar or booking, whose measured route-owned chunks were much smaller.
- `/anatomime` still has a large route-owned client bundle after the shared-shell reduction and should stay as a separate follow-up branch with focused game/session tests.
