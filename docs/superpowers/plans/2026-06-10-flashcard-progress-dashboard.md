# Flashcard Progress Dashboard Branch

## Branch

`feature/flashcard-progress-dashboard`

## Goal

Make signed-in flashcard progress easier to understand and act on without changing the flashcard data model. The dashboard should show the current mastery round, remaining prompts, strict accuracy, lifetime correct answers, best completion time, prompt-type coverage, region coverage, and recent prompt-level progress.

## Scope

- Extend the signed-in progress API response with current prompt-set breakdowns.
- Keep typed-check as the only mode that counts toward saved progress.
- Keep reveal-review practice-only.
- Keep progress summaries aggregate-only; do not store or expose raw typed answers.
- Avoid schema changes unless the existing progress metadata cannot represent the dashboard.

## Follow-Up

After this branch, start an anatomy-admin media review branch so anatomy admins can verify whether uploaded BodyParts3D images accurately match their linked anatomy entities before those images are trusted by flashcards and other education tools.

