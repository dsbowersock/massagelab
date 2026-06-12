# Anatomy Image Review Queue

## Goal

Build a phone-friendly anatomy image review workflow that lets an anatomy admin move through item-image pairs quickly without using the full anatomy browser for every decision.

## Scope

- Keep `/admin/anatomy` as the full anatomy browser, but add a compact dashboard section with image-review counts and direct entry points.
- Add `/admin/anatomy/media-review` as a dedicated review queue with one large image-first card at a time.
- Reuse `AnatomyMediaEntity.reviewStatus`, `reviewReason`, `reviewNote`, and `displayPriority` for approval state.
- Let "needs better view" create an `AnatomyMediaViewRequest` in the same submit, so the replacement-image workflow feeds the existing BodyParts3D request/import process.
- Preserve the existing full browser media panel for detailed editing, existing-image linking, and BodyParts3D imports.

## Acceptance

- Admins can open a dedicated image review queue from the anatomy admin dashboard and sidebar.
- The queue is usable on mobile: large image, compact item/source metadata, and large approve/reject/request controls.
- Approving or rejecting a needs-review image advances naturally to the next queued item.
- Requesting a better view can specify superior, inferior, transverse, lateral/anterior/posterior, or custom view needs and records an open media view request.
- Existing anatomy media review visibility and flashcard media filtering continue to use the same item-image link review status.
- Validation covers route source, action wiring, navigation exposure, and core repo checks.
