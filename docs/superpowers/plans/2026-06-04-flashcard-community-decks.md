# Flashcards Setup Prompt Modes And Community Decks V1

## Goal

Turn `/education/flashcards` into a setup-first study surface where anonymous users can browse public decks and study temporary decks, while signed-in users can save deck templates, track progress, and earn achievements.

## Completed Scope

- Replaced the immediate-card flashcard interface with a setup screen for category, region, depth, deck size, prompt modes, and answer mode.
- Added sourced prompt generation over the reviewed anatomy foundation for image identification, name-to-summary, name-to-region, name-to-category, and muscle origin/insertion/action/innervation.
- Added strict typed checking that normalizes case, whitespace, punctuation, and hyphen differences without fuzzy typo correction.
- Added public starter deck templates and public deck detail routes under `/education/flashcards/decks/[slug]`.
- Added `FlashcardDeck` and `FlashcardStudySession` storage for signed-in saved deck templates and study summaries.
- Added API routes for public deck listing/detail, signed-in deck save/update, signed-in session start, and signed-in session completion.
- Added achievement/progress writes for signed-in users only; anonymous study remains temporary and browser-local.

## Runtime Rules

- Public flashcard prompts and deck templates store sourced configuration only; user-created decks do not publish custom anatomy facts.
- Anonymous users can browse decks, configure decks, and study. Saving decks, progress, and achievements requires sign-in.
- Saved decks default to public, with a private option for signed-in users.
- Study-session completion stores prompt ids, scores, counts, and aggregate correctness only; raw typed answers are not persisted.
- Voice support remains deferred. The pure typed-answer checker is the future seam for speech-to-text transcripts.

## Validation Focus

- Prompt generation should keep excluding review-only/internal-reference facts and unsupported media.
- Public deck APIs should never expose emails, raw typed answers, private decks for non-owners, or detailed attempt logs.
- Browser smoke should include `/education/flashcards` and at least one public deck detail route.
