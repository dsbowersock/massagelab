# Flashcard Runner Polish

## Goal

Make the active flashcard study view feel like a physical flashcard workflow while keeping the existing sourced-data, community-deck, and mastery-progress foundations intact.

## Scope

- Improve the runner card surface so it reads as a tangible front/back card, not a generic app panel.
- Keep reveal-review mode as practice-only, with card click/keyboard reveal and explicit Correct/Missed marking after reveal.
- Keep typed-check mode as the progress and achievement path.
- Tighten runner controls for mobile and desktop: progress, previous/next, answer checking, and finish state should stay close to the card.
- Preserve current deck setup, saved deck, session, and mastery APIs.

## Non-Goals

- No Prisma schema changes.
- No new achievement rules or leaderboards.
- No voice, microphone, speech-to-text, or audio capture.
- No 3D anatomy runtime.
- No custom anatomy facts in user decks.

## Validation

- Browser smoke for `/education/flashcards` review reveal and typed start paths.
- TypeScript and lint validation.
- Production build if runner changes touch shared behavior beyond styling.
