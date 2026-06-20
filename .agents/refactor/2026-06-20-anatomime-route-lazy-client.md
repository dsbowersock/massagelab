# Refactor: Anatomime route lazy client

**Date:** 2026-06-20
**Mode:** target
**Files changed:** 5

## Targets

- `app/anatomime/page.tsx` -- replaced the initial route component with a lightweight team/round setup shell.
- `app/anatomime/anatomime-game-client.tsx` -- moved the full sourced anatomy deck and game workspace behind a dynamic client boundary.

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `/anatomime` first-load JS | 2,889,251 bytes | 1,122,077 bytes | -1,767,174 bytes |
| `/anatomime` delta vs `/` | 1,775,639 bytes | 8,016 bytes | -1,767,623 bytes |
| Route-owned chunks vs `/` | 3 | 1 | -2 |

## Transformations Applied

1. Moved the full Anatomime sourced deck/game workspace into a dynamically imported client module.
2. Added a lightweight `/anatomime` setup shell that preserves team names, team count, round count, hardcore mode, the game info panel, and the shared-game link before loading the full game client.
3. Added an online idle warmup so the service worker can cache the lazy game chunks for offline play after visiting the public `/anatomime` route.
4. Added a source-contract test to keep the sourced anatomy and game modules out of the initial route shell.

## Tests

- Baseline: `npm run build` passed; focused Anatomime helper tests passed with 40 tests.
- Focused after change: `node --test tests/anatomime-page-lazy-boundary.test.mjs tests/anatomime-game.test.mjs tests/anatomime-room-rules.test.mjs tests/anatomime-shared.test.mjs` passed with 43 tests.
- Browser after change: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "anatomime" --project=desktop-chromium` passed with 5 tests.
- Build after change: `npm run build` passed and produced the after metrics above.
- Final: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium`, and `git diff --check` passed.

## Learnings

- `/anatomime` was dominated by the sourced anatomy foundation chunk. The shared join/play routes were already small, so splitting the initial page shell from the sourced deck runner gave the largest behavior-preserving win.
