# Anatomy Image Review Queue

## Goal

Build a phone-friendly anatomy image review workflow that lets an anatomy admin move through item-image pairs quickly without using the full anatomy browser for every decision.

## Scope

- Keep `/admin/anatomy` as the full anatomy browser, and add a separate `/admin` dashboard with image-review counts and direct entry points.
- Add `/admin/anatomy/media-review` as a dedicated review queue with one large image-first card at a time.
- Reuse `AnatomyMediaEntity.reviewStatus`, `reviewReason`, `reviewNote`, and `displayPriority` for approval state.
- Let "needs better view" create an `AnatomyMediaViewRequest` in the same submit, so the replacement-image workflow feeds the existing BodyParts3D request/import process.
- Preserve the existing full browser media panel for detailed editing, existing-image linking, and BodyParts3D imports.
- Keep `/admin/anatomy` organized like a textbook by exposing separate entity tabs, 11 organ-system tabs, and tissue-type tabs backed by `AnatomyRelationship` membership rows, not just label filtering.

## Acceptance

- Admins can open a dedicated image review queue from the `/admin` dashboard and sidebar.
- The queue is usable on mobile: large image, compact item/source metadata, and large approve/reject/request controls.
- Approving or rejecting a needs-review image advances naturally to the next queued item.
- Requesting a better view can specify superior, inferior, transverse, lateral/anterior/posterior, or custom view needs and records an open media view request.
- Existing anatomy media review visibility and flashcard media filtering continue to use the same item-image link review status.
- Body-system tabs are backed by explicit `belongs_to_system` relationships to 11 organ-system concept rows, with skeletal and muscular systems modeled separately from the practical musculoskeletal concept and sensory content routed under the nervous system.
- Tissue-type tabs are backed by explicit `belongs_to_tissue_type` relationships to epithelial, connective, muscle, and nervous tissue concepts.
- Textbook-level taxonomy coverage includes major organ-system structures, cross-system memberships for shared anatomy such as pancreas, gonads, pharynx, hypothalamus, and respiratory muscles, and core tissue subtype/tissue membrane concepts without adding new taxonomy tables.
- Validation covers route source, action wiring, navigation exposure, and core repo checks.
