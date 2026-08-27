# AtmoShaper Batch 09–51 reviewer-amendment plan

## Goal

Turn the reviewer’s Batch 09–51 chat handoff into a restart-safe, fingerprint-bound audition queue without rewriting the immutable construction review or pretending that requested speech, siren, or dynamics processing is already complete.

## Ownership model

- Keep `signature-sound-construction-review.json` and the exhaustive discovery review as immutable evidence owners.
- Keep the existing three morning-review revisions as historical inputs.
- Add one closed reviewer-amendment catalog above the revised morning queue. Each active amendment binds to the exact incoming review fingerprint and may change only the concept label, exact source pool, audition playback policy, review readiness, or measurement-backed attenuation values.
- Preserve original batch numbers as stable references. Merged or retired batch queries resolve to the surviving batch instead of silently renumbering later concepts.
- Bind direct chat Passes to the exact amended fingerprint. Never invent a heard timestamp.

## Work sequence

1. [x] Add RED tests for closed amendment validation, fingerprint drift, exact source-pool changes, merge redirects, regional loops, gaps, cadence, layered lanes, and outcome binding.
2. [x] Record the complete Batch 09–51 handoff as exact data, including direct passes, names, source exclusions, merges/splits, processing gates, and production-insufficient status.
3. [x] Apply deterministic playback amendments and show their concrete settings on the processing page.
4. [x] Extend the development audition player only for policies required by this handoff: fixed regional loop, randomized regional windows, pause-separated/faded sequences, and independently scheduled layered lanes.
5. [x] Measure attenuation-only pool matching with the accepted FFmpeg 9.0 toolchain. Preserve raw files and store the exact measurements that drive preview gain.
6. [x] Treat siren removal, speech removal/ducking, and within-recording crowd dynamics as processing experiments. Either provide checksum-bound audition artifacts or keep the concept visibly processing-gated; do not play the unchanged raw pool as if the requested treatment were active.
7. [x] Update the current-state, project log, catalog checkpoint, and evidence receipts. Run focused tests, the adjacent AtmoShaper set, typecheck, lint, build, page checks, and representative audio-range checks.

## Review defaults for underspecified mechanics

- Boundary fades for pause-separated announcements: 0.25 seconds in and out, short enough to preserve speech onsets while removing hard edges.
- “Up to N recordings” auditions: independent randomized lanes capped at N, with no duplicate source active across lanes when the pool permits.
- A merged concept keeps the earlier surviving batch number and gains the unique sources from the later batch.
- Batch 49 discards `0:00–0:05` non-destructively and retains the exact source remainder from `0:05–13.418520833`; the original source file is unchanged.

These defaults are reviewable development behavior, not production qualification.
