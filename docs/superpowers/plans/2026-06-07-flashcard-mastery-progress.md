# Flashcard Mastery Progress V1

## Goal

Build the second flashcards branch around signed-in learning progress: users should see useful mastery totals, keep per-prompt correct/attempt counts, and optionally skip prompts they have already mastered.

## Scope

- Keep anonymous study unchanged: public decks and temporary decks still work without persisted progress.
- Store no raw typed answers. Persist only prompt ids, aggregate correctness, prompt/entity metadata, and timing/count summaries.
- Treat a prompt as mastered after 10 correct answers.
- Add a signed-in progress dashboard to `/education/flashcards` that summarizes completed sessions, mastered prompts, active prompts, aggregate accuracy, recent progress, and earned flashcard achievements.
- Add a setup option to skip mastered prompts when starting signed-in study sessions.
- Reuse the existing `LearningProgress` table and `metadata` field unless the current schema cannot represent the branch cleanly.

## Deferred

- Public leaderboards.
- Full speed-run ranking.
- Voice/speech-to-text checking.
- A separate universal anatomy competency transcript.
- 3D runtime or body-map interaction.

## Validation Focus

- Completion remains idempotent.
- Repeated correct answers accumulate without storing raw answers.
- Mastery is reached at 10 correct answers and can be used to filter a new signed-in session.
- Progress APIs are signed-in only and do not expose another user's progress.
- Browser coverage confirms anonymous behavior remains available and signed-in progress UI is gated.
