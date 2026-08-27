# AtmoShaper second whole-concept review plan

## Goal

Apply the reviewer’s second Batch 09–51 handoff against stable dropdown batch identities, repair the page’s misleading filtered-queue numbering, preserve passes as exact fingerprint-bound chat outcomes, and prepare honest speech-reduced auditions for Traffic, London Ambience, and Stadium Crowd without treating raw audio or ordinary filtering as completed speech removal.

## Architecture

- Keep the immutable construction review and the existing morning-review revisions unchanged.
- Amend only `signature-sound-whole-concept-review-amendments.json` for exact pool membership, fades, transition limits, source trims, readiness, and processing requirements.
- Keep direct Pass decisions in `signature-sound-whole-concept-chat-outcomes.json`, bound to the final amended review fingerprint.
- Treat the stable `batchId` and amended label shown by the review-queue dropdown as authoritative. Show filtered queue position separately as review progress.
- Define volume leveling as a constant per-recording gain chosen from measured integrated loudness and true-peak headroom. It must not imply EQ, compression, denoising, or stem separation. Do not force every pool down to an anomalously quiet single source.
- Keep the original Signature files immutable. Any speech-separated audition must live under a new immutable external derived-audio leaf, bind exact source bytes and the exact HTDemucs model/toolchain, and be served only after a closed manifest verifies the output identities.

## Tech stack

- Next.js 16 / React / TypeScript development review UI
- Node.js closed-schema catalog validation and fingerprinting
- Web Audio or an equivalent transparent gain stage for measured constant-gain audition leveling
- RipX-bundled Demucs 4.0.0 CPU backend with the local HTDemucs model for exploratory two-stem speech reduction
- Exact FFmpeg 9.0 build when recovered for canonical format conversion and EBU R128/true-peak measurements; do not substitute the older RipX-private FFmpeg as if it were the recorded toolchain
- Node test runner, repository typecheck, lint, and build

## Baseline references

- Current state: `docs/project-state.md`
- Chronology: `docs/project-log.md`
- Stable audio policy: `docs/wiki/atmosphere-audio.md`
- Prior amendment plan: `docs/superpowers/plans/2026-08-26-atmoshaper-batch-09-51-review-amendments.md`
- Amendment owner: `data/atmoshaper/signature-sound-whole-concept-review-amendments.json`
- Outcome owner: `data/atmoshaper/signature-sound-whole-concept-chat-outcomes.json`
- Amendment validator: `lib/atmoshaper/signature-sound-whole-concept-amendment.js`
- Audition player: `lib/atmoshaper/signature-sound-preview-player.js`
- Processing page: `app/dev/candidates/processing/`

## Compatibility and safety boundaries

- Preserve all earlier user review data and existing accepted artifact directories.
- Do not renumber stable batch identities when merged concepts disappear from the active queue.
- Do not modify raw Signature recordings.
- Do not call an EQ, gate, compressor, or noise suppressor “speech reduction.”
- Do not mark Traffic, London Ambience, or Stadium Crowd ready until exact derived artifacts exist and the page plays those artifacts rather than the raw sources.
- Do not publish, upload, deploy, push, merge, or production-qualify any sound in this work.
- Keep all external processing no-overwrite and checksum-bound; partial output must not become reviewable.

## TDD route

- Mode: off.
- Decision: skipped because the user requested implementation but did not request strict TDD.
- Authority: not applicable.
- Verification: add focused regression coverage after the catalog, player, and pipeline changes, then run the complete adjacent AtmoShaper test set and repository validation.

## Tasks

### 1. Repair identity presentation and apply exact pool/policy changes

- Show `Batch NN` from `entry.batchId`; label filtered position as `Review X of Y`.
- Record the direct Passes for Washing Machine, Fireplace, Keys Jingling, Lunar Wind, Space Tension Bed, Vintage Radio Broadcast, and Waterfront Cafe.
- Heavy Rain: remove exact Thunder 10, 02, 04, and 07 sources. Reclassify the resulting one-source concept honestly if the pool is no longer production-sufficient.
- Bus Station Announcements: use a 1-second fade in and 5-second fade out.
- Children’s Choir Ambience: add the three additional exact `Choirs_Children_Ambience` recordings, producing five unique sources.
- Orthodox Choir: remove exact `_4.wav` and `_-18.wav` and cap simultaneous audible sources at two.
- School Playground: use a 3-second regional-loop crossfade.
- Spaceship Interior: remove Track 2 and its ten sources; retain Track 1 as one nine-source 3-second-crossfade sequence.
- Subway Interior: increase the crossfade to 20 seconds.
- Transit Announcements: remove the two Waverly Automated Announcement sources and restore `The next station is - Announcement. 2.wav` to its full untrimmed 13.418520833-second source for review.

### 2. Correct volume-leveling semantics

- Preserve constant-gain-only behavior; do not apply spectral or dynamics processing when the request is merely pool consistency.
- Replace the `quietest-input` assumption with a measured reference policy that can use safe positive or negative gain while respecting true-peak headroom.
- Rework Church Bells so w-02 and w-03 are not passed through any character-changing treatment and all four sources are auditioned at a stable perceived level.
- Measure and level every Waves source using the same policy.
- Re-check existing level-matched pools affected by the clarified semantics so the page accurately describes what is and is not applied.

### 3. Add a closed speech-separation audition owner

- Add a new declaration/runner/manifest owner for Traffic, London Ambience, and Stadium Crowd rather than overloading the Sci-Fi Whistles FFmpeg treatment schema.
- Verify all 30 source assignments by SHA-256 and byte size before processing.
- Invoke the installed HTDemucs model through the verified CPU backend and retain model/version/backend provenance.
- Produce matched-level comparison variants appropriate to each concept: stronger removal for Traffic, controlled voice reduction for London, and conservative variants for Stadium because cheers and shouts are part of the wanted ambience.
- Keep output external, immutable, no-overwrite, and hidden from the page until the complete manifest and hashes validate.
- If a safe headless producer cannot be proven, keep these three batches processing-gated and report that limitation explicitly rather than creating misleading audio.

### 4. Bind decisions and verify

- Recompute final review fingerprints after every amendment and bind the seven new chat Passes to those exact identities.
- Add focused tests for stable batch numbering, source counts and exact exclusions, fades, concurrency, Track 2 removal, untrimmed Batch 49 playback, leveling bounds, and processing gates.
- Run focused whole-concept/player/UI tests, the adjacent AtmoShaper suite, typecheck, lint, build, page HTTP checks, and representative audio-range checks.
- Update project state, project log, atmosphere-audio wiki, and the AtmoShaper checkpoint/evidence with measured current truth only.

## Requirement check

The handoff was executable without another product decision. The technical branch is now resolved: the installed CPU separator produced a closed, verifiable 30-output audition manifest. Traffic and London are ready for matched-level listening; Stadium remains visibly blocked only on its separately requested dynamics control and pool leveling.

Follow-up correction: after the reviewer removed three Traffic recordings and explicitly requested reprocessing, a no-overwrite v2 bundle genuinely rebuilt the nine-source Traffic pool. Because all 12 regenerated London hashes differ from the already passed v1 bytes, active review now selects immutable bundles by stable batch: Traffic from v2, London and Stadium from v1. This preserves exact heard evidence instead of transferring a Pass across different media bytes.

## Execution readiness

Executed through the review-ready boundary. Exact batch identities and requested source IDs were audited against the current catalog and physical source files; the presentation mismatch is repaired; the exact FFmpeg 9 binary was recovered; both independent producer reviews approved the hardened implementation; all 30 speech outputs and the complete manifest validate; and the development page streams only concept-scoped, manifest-bound artifacts. Audible review, Stadium dynamics/pool leveling, and production qualification remain separate.
