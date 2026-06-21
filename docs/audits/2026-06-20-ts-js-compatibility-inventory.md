# TS/JS Compatibility Inventory

Date: 2026-06-20
Scope: duplicate `lib/*.ts` and `lib/*.js` helper pairs listed in the codebase refactor optimization plan.

## Verdict

The TypeScript files are the canonical implementations. The matching JavaScript files are compatibility wrappers that re-export the TypeScript source, not separate implementations. Keep that shape until each import path is migrated deliberately.

Do not delete these wrappers opportunistically. Several Node tests and a few compatibility imports still reference `.js` paths directly, while app code generally imports the same helpers through extensionless `@/lib/...` paths or explicit `.ts` paths. Removing wrappers without first migrating those consumers would create runtime import failures without reducing meaningful browser payload or Neon transfer.

## Current Policy

- Treat each listed `.ts` file as the only implementation.
- Keep matching `.js` files as one-line ESM wrappers: `export * from "./name.ts"`.
- Keep `tsconfig.json` unchanged for this pass; the repo uses `allowImportingTsExtensions` with `noEmit`, and scripts/tests already run against source files.
- Migrate or remove at most one wrapper pair per later branch, after mapping current consumers with `rg`.
- Prefer extensionless `@/lib/...` imports in Next app code and explicit `.ts` imports in source-side Node scripts where that pattern already exists.
- Preserve direct `.js` wrappers for Node tests until the test import strategy is intentionally changed.

## Inventory

| Pair | Current implementation role | Known `.js` compatibility consumers |
| --- | --- | --- |
| `anatomime-session-server` | Legacy/session-server helpers used by Anatomime server modules. | No direct `.js` consumer found in the current inventory; candidate for a later narrow removal branch. |
| `anatomime-shared` | Shared Anatomime rules, config normalization, and prompt helpers. | `tests/anatomime-shared.test.mjs`. |
| `anatomy-admin-source-input` | Admin source parsing helpers. | `tests/anatomy-admin-source-input.test.mjs`. |
| `anatomy-foundation` | Large sourced anatomy seed/data contract. | Anatomy tests, MBLEx tests, and source helpers that import runtime values through the wrapper. |
| `anatomy-media-review` | Anatomy media review enums, normalization, and helper keys. | `tests/anatomy-media-review.test.mjs` and runtime wrapper imports from anatomy study helpers. |
| `anatomy-queries` | Anatomy entity selection, href, and query metadata helpers. | `tests/anatomy-query-helpers.test.mjs`. |
| `anatomy-study` | Sourced study card, prompt, and deck generation helpers. | `tests/anatomy-study.test.mjs`, `lib/anatomy.js`, and runtime wrapper imports from flashcard helpers. |
| `flashcard-community` | Flashcard deck configuration and community-deck normalization helpers. | `tests/flashcard-community.test.mjs`. |
| `flashcard-progress` | Flashcard progress update and summary helpers. | `tests/flashcard-progress.test.mjs`. |
| `mblex-content-outline` | MBLEx content outline mapping over the anatomy foundation. | `tests/mblex-coverage.test.mjs`. |

## Later Migration Order

1. Start with `anatomime-session-server.js` because the current inventory found no direct `.js` consumer. Verify with `rg "anatomime-session-server\.js|anatomime-session-server"` before editing.
2. Move low-risk test-only wrappers next, one pair at a time, by updating the focused test import and running that focused test plus `npm run test`.
3. Leave high-fanout anatomy helpers such as `anatomy-foundation`, `anatomy-study`, and `anatomy-media-review` until app, script, and test consumers are mapped in the same branch.
4. Do not change sourced anatomy facts, flashcard prompt behavior, Anatomime rules, or media review filtering as part of wrapper migration.
