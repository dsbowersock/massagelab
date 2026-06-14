# Anatomime Shared Sessions

Date: 2026-06-13

## Goal

Turn Anatomime from a single-screen classroom timer into a shared study game that can use the full sourced anatomy study library, let a host configure the deck for the current lesson, and let players join from their own devices with persistent scoring/progress hooks where authentication allows it.

## Scope

- Add shared-session persistence for sessions, teams, players, and guesses.
- Reuse the sourced anatomy study adapter instead of adding separate Anatomime facts.
- Let hosts select categories, regions, difficulty, term count, and answer mode before creating a game code.
- Support guest players with local browser tokens and signed-in players with user-linked participation.
- Score active-team correct answers immediately and queue validated steal guesses from other teams.
- Link correct signed-in name-recall guesses back into the flashcard prompt-progress model.
- Publish lightweight realtime updates when `ABLY_API_KEY` is configured, with polling as the fallback path.

## Implementation Notes

- Shared game content is derived from `ANATOMY_FOUNDATION_SEED` through the same public study-card adapter used by flashcards.
- Anatomime name-recall progress uses the prompt id `anatomime_name_recall:<cardId>` and the existing flashcard progress tool namespace so mastery and achievements do not fork into a second anatomy progress model.
- Guest player tokens are stored hashed server-side; raw tokens stay in the joining browser.
- API summaries hide active answer details from non-host viewers.
- Realtime is intentionally optional. The feature remains usable on plain polling when Ably is not configured.

## Verification

- `node --test tests/anatomime-game.test.mjs`
- `node --test tests/anatomime-shared.test.mjs`
- `npm run prisma:generate`
- `npm run prisma:validate`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run prisma:migrate:deploy`
- Playwright smoke of `/anatomime`, `/anatomime/join`, `/anatomime/play/[code]`, session creation, player join, and host start against a fresh local Next server.

## Follow-Ups

- Add host moderation controls for pausing, skipping, and ending shared sessions.
- Add a signed-in session history view once classroom data volume and privacy expectations are clearer.
- Improve classroom display polish after real playtesting with phone-sized player screens.
