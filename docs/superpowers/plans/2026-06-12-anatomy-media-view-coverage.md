# Anatomy Media View Coverage Branch

## Recommended Branch

`codex/anatomy-media-view-coverage`

## Goal

Use the anatomy media review tooling from `codex/anatomy-media-review` to improve BodyParts3D view coverage and framing quality without automatically promoting unreviewed images into public flashcards.

## Problem

The current reviewed media set has two separate issues:

- Some anatomy items need additional superior, inferior, and occasional transverse-style review views.
- Some existing anterior, posterior, and lateral images are framed too tightly, with the highlighted item touching or nearly touching the image edge. These should be replaced with wider views that show enough surrounding anatomy to orient the learner.

## Scope

- Generate or import superior and inferior BodyParts3D candidate views where those views add useful anatomy-learning value.
- Identify existing anterior, posterior, left-lateral, and right-lateral BodyParts3D renders whose framing is too tight.
- Replace or supplement tight renders with wider contextual views that keep the target item visible while showing neighboring structures.
- Default new or replacement item-image links to `NEEDS_REVIEW` until manually approved.
- Preserve the current rule that public flashcards only use reviewed reusable media whose item-image link is approved.
- Keep role assignment intentional: use `REFERENCE` by default, and promote to `PRIMARY` or `GAME_PROMPT` only after the image is clearly useful for that task.

## Out Of Scope

- Do not add 3D runtime mesh/spatial tooling.
- Do not bulk-approve generated media.
- Do not force superior/inferior coverage for item types where the view does not add value.
- Do not treat BodyParts3D top orientation as a true transverse cross-section unless a custom source view clearly supports that educational use.

## Acceptance Criteria

- Admins can review a candidate item's existing views and see which views are missing or tightly framed.
- Replacement BodyParts3D imports preserve source provenance, part IDs, tree name, and camera/source metadata.
- New superior/inferior candidates and wider contextual replacements enter the review queue before public use.
- Flashcard image prompts avoid rejected, needs-review, or poor-framing links.
- The branch leaves a documented method for continuing coverage in small batches rather than attempting the full anatomy library in one risky pass.
