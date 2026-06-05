# Sourced Anatomy Flashcards And Education V1

## Goal

Launch public-alpha Education flashcards only after the old Anatomime runtime data is reconciled into the reviewed sourced anatomy foundation.

## Completed Scope

- Added `lib/anatomy-seed/legacy-anatomime-coverage.ts` and merged it last in the anatomy seed index.
- Added sourced coverage for legacy broad groups and edge entities, including skull, vertebral column, spinous process, cuneiform bones, true/false/floating ribs, trapezius, pectoralis major, quadriceps femoris, erector spinae, multifidus, splenius, semispinalis, auricular muscles, eye/perineal/thoracic edge muscles, and the corrected interfoveolar ligament structure.
- Added legacy aliases as `entityTerms` where old labels mapped to existing sourced entities, including grouped interossei, sex-specific pelvic floor labels, old comma phrasing, spelling variants, and historical labels.
- Archived the old hand-entered set as `lib/anatomy-legacy.js`; it is reference-only and no longer imported by runtime product surfaces.
- Restored `lib/anatomy.js` as a compatibility wrapper over `lib/anatomy-study.ts` for Anatomime and SOAP/body-diagram consumers.
- Removed the old generic `AnatomyTerm` seeding path from `prisma/seed.ts`; the foundation seed is the anatomy source of truth.
- Added public `/education` and `/education/flashcards` routes and made the Education sidebar group visible.
- Added tests for the all-333 legacy coverage audit, source filtering, card generation, deterministic decks, reviewed media, foundation seed assembly, navigation, and browser route smoke coverage.

## Source And Runtime Rules

- Public study cards are generated only from reviewed reusable summaries and media linked to `open_reuse` or commercial-safe sources.
- Review-only, internal-reference, deferred energetic-anatomy, and unsupported source-reference bookkeeping rows are excluded from public card answers.
- Alias metadata can preserve legacy labels, but flashcard attribution shows reviewed answer/media sources.
- `muscle-interfoveolar` remains archived as an old muscle row but maps to `anatomy_structure-interfoveolar-ligament` in the coverage audit.
- `muscle-sphenomeniscus` maps to lateral pterygoid as a historical legacy alias; no separate public muscle entity was created.

## Validation Focus

- `getLegacyAnatomyCoverageAudit(legacyAnatomyTerms)` should keep returning 333 rows with no `missing` statuses.
- `validateAnatomyFoundation()` and `validateAnatomyStudyContent()` should remain empty.
- Anatomime should continue using `createAnatomimeDeck()` from `lib/anatomy.js`, which now delegates to sourced study cards.
- Browser smoke coverage should include `/education` and `/education/flashcards`.
