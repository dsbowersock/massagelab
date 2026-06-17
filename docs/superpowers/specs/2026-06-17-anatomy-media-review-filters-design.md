# Anatomy Media Review Filters Design

Date: 2026-06-17
Branch: `codex/anatomy-media-review-filters`

## Context

MassageLab's anatomy media workflow now has a dedicated admin queue at `/admin/anatomy/media-review`. The queue is intentionally mobile-first: it reviews one linked image at a time, shows sibling image context for the same anatomy item, and submits fast approve, reject, or "needs better view" decisions against `AnatomyMediaEntity` link-level review state.

The current queue supports status tabs and offset navigation only. The next branch should make the queue easier to clear by anatomy area while preserving the one-card review rhythm. This supports public flashcard quality because public image prompts only use reviewed reusable media whose item-image link is approved.

## Goal

Add URL-driven filters and built-in presets to the anatomy image review queue so an anatomy admin can work through useful review batches, especially anatomy-area batches, without using the full anatomy browser for every decision.

The primary workflow is: choose an anatomy-area or cleanup preset, review one image card, take a decision, and stay inside the active filtered batch until it is cleared.

## Non-Goals

- No database schema migration.
- No user-created saved filters or account preference storage.
- No full anatomy browser redesign.
- No change to flashcard prompt persistence or progress logic.
- No hosted clinical, PHI, transcription, or compliance-heavy work.
- No fuzzy search, analytics, or new indexing work in this branch. If validation shows the current query shape is inadequate, record a separate performance follow-up instead of widening this branch.
- No broad anatomy taxonomy rewrite.

## Chosen Approach

Use a batch-first queue filter design.

The page remains server-rendered and URL-driven. Status tabs remain the broadest filter. Built-in preset links provide common review batches. A compact advanced filter form lets admins refine the batch when the built-in presets are not specific enough. The review card stays the main surface.

This approach is more useful than preset-only links because it supports combinations such as "upper limb + bad view" or "muscles + open requests". It is safer than a full admin-table filtering redesign because it does not duplicate `/admin/anatomy` or weaken the phone-friendly one-image-at-a-time workflow.

## User Experience

The top of `/admin/anatomy/media-review` should have these layers:

1. Existing status tabs: Needs Review, Rejected, Approved, All.
2. Built-in anatomy-area presets, visually primary.
3. Built-in cleanup/problem presets, visually secondary.
4. A compact advanced `GET` filter form.
5. Active filter chips and a single Clear filters link.

The review card remains the same basic shape:

- Large image preview with fallback handling.
- Entity, role, source, review status, reason, and BodyParts3D view metadata.
- Linked-image context for the same anatomy item.
- Skip, Open item, BodyParts3D, generated image, and stored image links.
- Large Approve image, Needs better view, and Reject image controls.
- Next-in-queue links.

On mobile and desktop, the advanced filter form should live under a compact `<details>` panel below the preset rows. Presets and active chips should stay scannable and should not push the review image too far down the page.

## Built-In Presets

Anatomy-area presets are primary:

- Upper limb.
- Lower limb.
- Trunk.
- Head/neck.
- Muscles.
- Bones/joints.
- Body systems.

Cleanup/problem presets are secondary:

- Open requests.
- Bad match.
- Bad view.
- Too tight.
- Rejected.
- Duplicates are deferred from the first filter branch because the current queue does not have an explicit duplicate marker.

Presets are named combinations of filter params. They must produce shareable URLs and should be refinable by the advanced controls.

## Filter Model

Queue state should be parsed into a small internal filter model rather than scattered string checks.

First-branch URL params:

- `status`: `needs-review`, `rejected`, `approved`, or `all`.
- `preset`: built-in preset key.
- `entityType`: anatomy entity type such as `MUSCLE`, `BONE`, `JOINT`, or `ANATOMY_STRUCTURE`.
- `system`: body-system preset key when relationship-backed filtering is needed.
- `reason`: review reason such as `bad_match`, `bad_view`, or `too_tight`.
- `view`: BodyParts3D stored view such as `anterior`, `posterior`, `left-lateral`, `right-lateral`, `superior`, `inferior`, `transverse`, or `custom`.
- `request`: request state, initially focused on `open`.
- `sort`: stable sort key.
- `q`: modest text query.
- `offset`: current queue offset.

The first branch should not add a `tissue` filter. Tissue-type filtering can be added later if the queue needs it after anatomy-area and problem-batch filters are in use.

## Query Behavior

The branch should use existing persisted data:

- `AnatomyMediaEntity`: review status, review reason, entity type, entity slug, role, display priority, and timestamps.
- `AnatomyMediaAsset`: media type, source, title, slug, source URL, remote URL, thumbnail URL, usage scope, fact review status, and metadata.
- `AnatomyMediaViewRequest`: open replacement requests by entity type and entity slug.
- `AnatomyRelationship`: body-system and tissue-type membership for broader anatomy-area batches.

Free-text search should stay simple: match entity slug, asset title, asset slug, source label, and source slug. It should not become fuzzy search.

Sorting should preserve the current default intent: work the highest-priority queue first. The first branch sort set should be default priority, newest, oldest, and entity name.

Counts should remain useful. The existing status counts can continue to describe all image review rows. The page should also show the active filtered batch total so admins know how much work remains in the selected batch.

## Queue State Preservation

Filters only matter if decisions keep the admin inside the current batch.

Approve, reject, needs-better-view, skip, and next-in-queue links must preserve the active queue state. Decision forms should include hidden fields for the active filter params, not just status and offset. After a decision:

- If the reviewed row no longer matches the active filtered batch, the next matching row should shift into the current offset.
- If the reviewed row still matches the active filtered batch, the queue should advance to the next offset.
- If the offset is beyond the filtered total, redirect back to the first page of the same filtered batch.

This should extend the current `queueOffsetAfterDecision` and `mediaReviewQueueRedirectPath` behavior rather than replacing the queue action flow.

## Code Shape

Keep the implementation small and local to the existing queue where possible:

- Add a queue filter parser/helper near the media-review page or in a focused helper if tests need direct imports.
- Add a URL builder that preserves the filter model and can reset `offset` when filters change.
- Add preset definitions in one place.
- Use the filter model to build the Prisma `where`, `orderBy`, and optional relationship/request joins.
- Keep `linkedImageSummariesForRows` focused on sibling context for the displayed rows.
- Extend queue decision hidden fields to carry filter params through server actions.
- Keep comments/docstrings focused on non-obvious behavior, especially filter parsing and post-decision offset rules.

## Testing

Use focused validation:

- Unit/helper tests for filter parsing, preset mapping, URL building, and queue-state preservation.
- Source-style admin UI test coverage asserting status tabs, preset links, advanced filter controls, active chips, and hidden queue-state fields.
- Existing anatomy media review tests should continue to verify link-level review state and flashcard media filtering.
- Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` after implementation.
- Add browser QA only if the final UI behavior needs mobile visual verification beyond source tests.

## Acceptance Criteria

- Admins can start from status tabs or built-in presets.
- Anatomy-area presets are visually primary and cleanup/problem presets are secondary.
- Advanced filters can refine the current batch without client-only state.
- Active filters are visible as chips and can be cleared with one link.
- Approve, reject, needs-better-view, skip, and upcoming links preserve the active filtered batch.
- The queue advances through the next matching row after a decision.
- The page remains usable on mobile and does not become a duplicate of the full anatomy browser.
- No migration or new persistence is required.
