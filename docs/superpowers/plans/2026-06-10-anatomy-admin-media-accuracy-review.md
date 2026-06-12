# Anatomy Admin Media Accuracy Review Branch

## Recommended Branch

`codex/anatomy-media-review`

## Goal

Add an anatomy-admin workflow for reviewing uploaded anatomy images against the entities they are linked to. This became important after flashcards began relying on reviewed uploaded BodyParts3D media for image-identification prompts.

## Implementation Status

Implemented on 2026-06-11.

- Added link-level media curation fields to `AnatomyMediaEntity`: approved/needs-review/rejected status, reason, review note, display priority, and reviewer metadata.
- Updated flashcard media loading so rejected and needs-review links are hidden from public study prompts, while approved replacement views can be promoted without deleting the underlying asset.
- Replaced the anatomy admin detail media list with a visual media review panel that previews linked images, saves review outcomes, approves existing candidates, and imports still BodyParts3D views into R2.
- Added an admin-only flashcard flag control for image prompts. Bad match or bad view flags reject the item-image link and remove the prompt from the current study run.
- Kept this branch to still images and provenance review. 3D runtime tooling remains deferred.
- Addressed PR review findings on 2026-06-11: BodyParts3D URL overrides are strictly parsed before preview/import, imported asset identity includes tree name and canonical part IDs, post-upload database writes are transactional, linked media renders per item-role link, R2 public delivery URL configuration is optional, new media links default to needs review, and flashcard flagging removes rejected prompts from the setup inventory.
- Added a follow-up migration backfill so existing item-image links created under the earlier approved default enter needs-review status instead of bypassing the review queue.
- Addressed mobile anatomy-browser annotations by removing redundant mobile page framing, compacting the sticky search controls, moving citations/external IDs to collapsed bottom evidence sections, and clarifying the reject-or-replace BodyParts3D import flow.

## Scope

- Shipped in V1: entity-detail media preview, link review status, candidate approval, BodyParts3D still import, flashcard image flagging, and prompt filtering by link status.
- Deferred: broader view-coverage work, including superior/inferior candidate views and wider replacements for anterior/posterior/lateral renders that are too tightly framed. See [Anatomy Media View Coverage Branch](2026-06-12-anatomy-media-view-coverage.md).
- Deferred: a global media review queue with filter tabs, bulk triage, and broader BodyParts3D search/discovery.
- Deferred: 3D/spatial runtime tooling.

## Notes

- The current repo already stores BodyParts3D media provenance and anatomy-admin access checks.
- This branch does not add 3D runtime tooling; it is an image/provenance/review workflow.
- The review output should be reusable by flashcards, Anatomime, and future education tools.

