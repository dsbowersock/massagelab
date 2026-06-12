# Anatomy Media View Coverage Branch

## Branch

`codex/anatomy-media-view-coverage`

## Goal

Improve BodyParts3D image coverage and framing review without automatically promoting unreviewed images into public flashcards.

## Scope

- Add an idempotent superior/inferior coverage import path for all eligible anatomy items that already have stable BodyParts3D part IDs.
- Add a structured desired-view request queue so transverse/custom views and too-tight anterior/posterior/lateral images can be described in plain language and processed manually or by later automation.
- Default new generated or custom-imported item-image links to `NEEDS_REVIEW`; public flashcards continue to require reviewed reusable media with an approved item-image link.
- Add a `too_tight` review reason for images that need more context around the target item.
- Add docstrings/comments to new non-obvious helper, action, and script code, and update `AGENTS.md` so future branches keep doing this without a reminder.

## Out Of Scope

- Do not add 3D runtime mesh/spatial tooling.
- Do not bulk-approve generated media.
- Do not force superior/inferior coverage for rows that do not have usable BodyParts3D part IDs.
- Do not treat BodyParts3D top orientation as a true transverse cross-section unless a custom source view clearly supports that educational use.
- Do not perform the repo-wide docstring pass in this branch.

## Acceptance Criteria

- Admins can review an item's existing views and see approved, needs-review, rejected, and missing view coverage.
- Admins can create desired-view requests with requested view, reason, note, and optional BodyParts3D URL.
- Pasted BodyParts3D URLs can import as needs-review candidates while preserving provenance, part IDs, tree name, camera/source metadata, and R2 upload metadata.
- A report command lists open desired-view requests for later daily/hourly automation.
- The coverage import command can audit missing superior/inferior candidates, and the import mode has created the eligible candidate links as needs-review.
- Flashcard image prompts avoid rejected, needs-review, and poor-framing links.

## Implementation Notes

- `npm run prisma:migrate:deploy` applied `20260612110000_anatomy_media_view_requests` to the configured database after `prisma migrate dev` correctly refused to proceed because older migration drift would require a destructive reset.
- `npm run anatomy:media:coverage:import` completed the eligible superior/inferior BodyParts3D import, and `npm run anatomy:media:coverage` reports no missing eligible superior/inferior candidate links.
