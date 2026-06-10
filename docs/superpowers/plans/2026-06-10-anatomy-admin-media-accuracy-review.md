# Anatomy Admin Media Accuracy Review Branch

## Recommended Branch

`feature/anatomy-admin-media-review`

## Goal

Add an anatomy-admin workflow for reviewing uploaded anatomy images against the entities they are linked to. This became important after flashcards began relying on reviewed uploaded BodyParts3D media for image-identification prompts.

## Scope

- Add an anatomy admin media review surface that lists images by entity, category, region, source, and current review status.
- Show the image, linked entity name, aliases, category, region, source attribution, source URL, BodyParts3D/FMA mapping details when available, and current product-visibility eligibility.
- Allow anatomy admins to mark media as accurate, needs correction, too broad/context-only, or excluded from public study prompts.
- Preserve source/license provenance and do not treat uploaded media as public flashcard truth until accuracy is explicitly reviewed.
- Add filters for unreviewed media, public-study eligible media, entity type, region, source, and review outcome.
- Add tests proving public flashcards only use media marked reviewed and accurate.

## Notes

- The current repo already stores BodyParts3D media provenance and anatomy-admin access checks.
- This branch should not add 3D runtime tooling; it is an image/provenance/review workflow.
- The review output should be reusable by flashcards, Anatomime, and future education tools.

