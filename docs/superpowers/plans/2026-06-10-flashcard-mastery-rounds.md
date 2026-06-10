# Flashcard Mastery Rounds V1

## Goal

Turn the existing per-prompt flashcard mastery counts into a repeatable learning loop. A signed-in learner completes one round by mastering every sourced flashcard prompt, earns a round-completion snapshot badge, then starts a fresh round while lifetime totals remain intact.

## Scope

- Keep the current 10-correct threshold for prompt mastery.
- Treat the full sourced public flashcard prompt library as the round target.
- Preserve lifetime attempts, correct answers, incorrect answers, best streaks, and best session duration.
- Reset only current-round prompt counts when a learner starts the next round.
- Store round completion snapshots as repeatable `Achievement` rows keyed by round number.
- Expose round number, mastered/target prompts, percent complete, completed round badges, and a signed-in “claim round and start next” action in the flashcard setup progress panel.

## Out Of Scope

- Public leaderboards, competitive ranking, and social sharing.
- Voice answer capture or transcript checking.
- Schema changes; this pass uses existing `LearningProgress.metadata` and `Achievement.metadata`.
- Universal anatomy coverage beyond the sourced flashcard prompt library.

## Validation

- Unit coverage for lifetime/current-round progress metadata and repeatable round badge keys.
- Browser fixture coverage remains focused on signed-in progress dashboard behavior.
- Validate with targeted progress tests plus the standard typecheck, lint, and build gates.
