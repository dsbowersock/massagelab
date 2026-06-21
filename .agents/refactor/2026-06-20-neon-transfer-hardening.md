# Refactor: Neon transfer hardening

**Date:** 2026-06-20
**Mode:** target

## Targets

- `lib/anatomy-study-media.ts` -- replaced repeated full media/source/link loads with reviewed BodyParts3D image/diagram projections, approved link filtering, and a 60-second process-local cache.
- `app/admin/anatomy/media-review/page.tsx` -- projected queue rows to only rendered link, asset, source, URL, and metadata fields.
- `app/admin/anatomy/browser-data.ts` and `lib/anatomy-queries.ts` -- kept admin media candidates and selected-entity media detail links narrower.
- `scripts/anatomy-media-view-coverage.ts` and `scripts/anatomy-media-view-requests.ts` -- projected maintenance-script reads.

## Transfer Risks Addressed

- Repeated flashcard API calls no longer fetch the whole anatomy media catalog with full source and entity-link records.
- Media-review pages keep pagination and avoid loading full asset/source records for each queue card.
- BodyParts3D maintenance scripts avoid full media/link/request records when compact metadata is sufficient.

## Validation

- Focused: `node --test tests/neon-transfer-hardening.test.mjs tests/anatomy-admin-browser-ui.test.mjs tests/anatomy-media-review-queue.test.mjs tests/flashcard-community.test.mjs`
- TypeScript: `npm run typecheck`
