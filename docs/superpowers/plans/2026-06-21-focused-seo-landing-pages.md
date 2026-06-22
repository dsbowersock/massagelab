# Focused SEO Landing Pages

Date: 2026-06-21

## Goal

Improve discoverability before the broader student-share window by giving the existing public product routes clearer search-aligned landing copy for:

- massage anatomy flashcards
- Anatomime classroom anatomy practice
- Chimer massage session timer
- local-first massage documentation
- massage wellness tools

## Constraints

- Keep the homepage non-intrusive with the optional shortcut router and available-tools catalog.
- Keep PHI-bearing therapist documentation local-first and do not imply hosted clinical sync, transcription, or SOAP assistance exists.
- Reuse the existing Next app, shared app-surface system, route metadata helper, and public route sitemap contract.
- Do not add new marketing dependencies, motion libraries, or separate splash routes.

## Implementation

1. Add concise product-proof sections to the existing public routes instead of creating detached marketing pages.
2. Keep each route's real tool visible on the same page: flashcard builder, Anatomime setup, Chimer timer setup, notes cards, and Wellness hub.
3. Align `lib/seo.js` titles and descriptions with the new target phrases.
4. Add a source-level SEO copy contract test so the core phrases do not disappear in later refactors.

## Validation

- `node --test tests/seo.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `git diff --check`
