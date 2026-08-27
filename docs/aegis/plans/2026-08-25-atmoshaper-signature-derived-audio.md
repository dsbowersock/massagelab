# AtmoShaper Signature Derived-Audio Batch Plan

## Goal

Create reproducible, checksum-bound derived audio outside Git for the Signature concepts whose processing intent is already clear. Ship the usable concepts incrementally, retain explicit rebuild states for concepts that are not ready, and keep every generated artifact audibly reviewable before publication qualification.

## Active Batch

- Batch id: `batch-01-campfire-boiling-water`
- Read-only source root: the absolute server-owned `ATMOSHAPER_SIGNATURE_SOUNDS_ROOT`.
- External output root: the absolute server-owned `ATMOSHAPER_SIGNATURE_DERIVED_ROOT`, whose leaf is `batch-01-campfire-boiling-water`. The action-time receipt records the exact local path without committing it.
- Ready slice: Campfire `campfire-normalize`, using the four exact sources in the construction review.
- Parameter-gated slice: Boiling Water `boiling-trim-clicks` plus `boiling-repair-loop`. It remains unrendered until start/end and loop-seam boundaries are measured and reviewed; the runner must reject missing values rather than infer them.
- Explicitly deferred from this batch: voice removal, speech obscuring, rain/thunder separation, and walking ingredient repair. Their current concepts remain active and revisitable.

The output root must remain disjoint from the source root, every Git repository/worktree root and common directory, and every filesystem root after canonical path resolution. Existing output files are immutable and never overwritten.

## Baseline / Authority Refs

- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/wiki/atmosphere-audio.md`
- `docs/aegis/plans/2026-08-25-atmoshaper-signature-review-reconciliation.md`
- `docs/aegis/plans/2026-08-25-atmoshaper-signature-construction-audition.md`
- `data/atmoshaper/signature-sound-review.json`
- `data/atmoshaper/signature-sound-construction-review.json`
- `data/atmoshaper/signature-sound-construction-audition.json`
- `data/atmoshaper/signature-sound-construction-qa-decisions.json`

## Compatibility Boundary

- Source files are read-only; verify exact byte size and SHA-256 before measurement or rendering.
- Derived media and run manifests live only beneath the named external output root. No audio is added to Git.
- Preserve all prior listening, complete-review, construction-review, audition, and QA fingerprints. A derived artifact is a new identity, never a replacement under an existing source id.
- Do not upload, publish, deploy, stage, commit, push, merge, or modify production providers.
- A successful FFmpeg exit and technical measurement do not constitute audible approval or publication qualification.
- Campfire processing changes level and technical format only. It does not trim, denoise, alter playback strategy, or reinterpret the user’s source decisions.

## Toolchain and Recipe

- Tool: `ffmpeg version 9.0-full_build-www.gyan.dev` and matching `ffprobe`.
- Output: lossless stereo PCM WAV, `pcm_s24le`, 48 kHz.
- Measurement: EBU R128 integrated loudness and true peak for every exact input.
- Target: the quietest finite input integrated loudness in the four-source Campfire set, rounded to 0.01 LUFS. This requires attenuation only, preserves source dynamics, and avoids level-matching through gain-induced clipping or limiting.
- Transform: apply the exact per-source dB delta, resample to 48 kHz, preserve stereo, and write with FFmpeg no-overwrite behavior.
- Verification: hash and probe every output; remeasure loudness; require duration drift no greater than one output sample, two channels, 48 kHz, 24-bit PCM, and integrated loudness within 0.2 LU of the batch target.
- Identity: SHA-256 of the canonical batch declaration, source SHA-256, algorithm version, processing-intent id, output version, and output format. The external manifest records these inputs, the inert FFmpeg argv, measurements, and output SHA-256.

## TDD Route

- Mode: auto
- Decision: strict
- Strict authority: the parent construction plan records strict TDD, and this slice adds checksum, containment, no-overwrite, process-execution, and artifact-identity contracts.
- Test posture: establish RED for declaration validation, source mismatch, path containment, parameter gating, deterministic recipes, process failure, verification failure, and no-overwrite behavior before implementation.
- Verification: focused RED/GREEN, adjacent Signature tests, typecheck, lint, full test, external dry-run, authorized exact render, independent readback, live development-route readback, and diff/scope checks.

## Change Necessity

- User-visible need: finish working concepts and retain an auditable structure for later repairs.
- No-change option: manual FFmpeg commands could create files but would not bind source identity, recipes, measurements, output identity, or audible QA.
- Why code change is necessary: the existing sound-processing planner is intentionally inert and publication-candidate based; it neither executes construction intents nor owns this external derived batch.
- Minimum change boundary: one batch declaration, one pure planning/validation owner, one narrow runner CLI, and one development-only artifact review surface reusing the existing audio player/route conventions.
- Decision: code-change.

## Architecture and Complexity

- Canonical intent owner: construction review.
- Batch membership/parameters owner: derived-audio batch declaration.
- Planning/validation owner: a new pure library below 500 lines.
- Process and atomic-publication owner: a new CLI below 400 lines; it delegates calculations to the library and uses injectable process/filesystem seams in tests.
- Development review: add a small page/route and reuse the existing player. Do not add scheduling behavior to the processing runner.
- Each new test owner should stay below 600 lines. If pressure exceeds these limits, split by pure plan versus process adapter before adding responsibility.

## Tasks

### Task 1: Preserve negative construction triage

1. Add RED coverage proving note-backed `needs-rework` and `reject` do not require fabricated heard evidence, while `pass` still does.
2. Correct the canonical QA validator/updater and page controls.
3. Commit the two user decisions for Walk on Gravel and Walk on Leaves as validated sparse construction QA input.
4. Run focused QA/page GREEN.

### Task 2: Declare and plan Batch 01

1. Add the closed batch declaration with exact source ids, source hashes, byte sizes, relative paths, processing intents, output version, format, and Boiling Water’s parameter-gated state.
2. Add RED tests for unknown fields, mismatched construction intent/source, duplicate identity, source/hash drift, unsafe roots, missing Boiling parameters, and deterministic Campfire target/deltas/argv.
3. Implement the pure validator/planner and keep machine-absolute roots out of committed data and generated public-facing summaries.
4. Run focused GREEN and complexity checks.

### Task 3: Execute and verify Campfire atomically

1. Add RED process-adapter tests using fake probe/measurement/render seams. Cover FFmpeg failure, bad output measurements, partial-output cleanup, existing-output refusal, and atomic external-manifest publication.
2. Implement explicit `--measure` and `--render` CLI modes. Render only after all inputs and planned destinations pass preflight.
3. Perform a read-only real measurement and store only portable measurements/recipe identities in the external run manifest.
4. With the already authorized exact output root, render four Campfire outputs. Never overwrite; on failure remove only task-owned temporary files from the exact batch root.
5. Independently hash, probe, and loudness-check the completed outputs and compare the emitted manifest to a fresh plan.

### Task 4: Review derived artifacts in development

1. Add RED coverage for a development-only derived-artifact route that serves only manifest-listed bytes beneath the server-owned external root.
2. Add a lightweight `/dev/candidates/processing` review page showing source versus derived measurements and allowing before/after playback plus note-backed Pass/Needs rebuild/Reject evidence.
3. Do not merge this QA into construction acceptance; the artifact decision must bind exact output SHA-256 and recipe identity.
4. Run focused browser-contract, route, and live HTTP checks.

### Task 5: Close the slice without overstating completion

1. Update `docs/project-state.md`, `docs/project-log.md`, and `docs/wiki/atmosphere-audio.md` with exact counts, output location policy, commands, and residual gates.
2. Run focused/adjacent/full validation, typecheck, lint, build if source changes affect Next.js, `git diff --check`, scope review, and external-manifest comparison.
3. Record Campfire as technically rendered but not final until the user completes artifact QA. Keep Boiling Water parameter-gated and the walking groups `needs-rework`.

## Risks and Stops

- Stop if any source checksum/size differs, FFmpeg is not the recorded build, the output root resolves into a protected tree, any destination exists, or technical verification fails.
- Stop rather than guess Boiling Water trim/seam timestamps.
- Do not describe ordinary filters as successful voice removal or source separation.
- If a source is mono or malformed despite the declaration, return to plan review instead of silently changing channel semantics.
- If output artifacts cannot be previewed through a manifest-closed development route, report the technical render separately from audible acceptance.

## Retirement

The development processing page and external batch runner are retained for future concepts. Batch declarations are immutable inputs; corrections create a new output version or batch revision. Temporary files are retired after successful atomic publication or bounded failed-run cleanup. Source audio, historical reviews, and prior output versions are never retired by this plan.

## Execution Route

- Decision: inline.
- Reason: the user asked to continue, current tasks share one dirty catalog worktree, and current session instructions do not authorize new subagents.
- Stop condition: done, needs-verification, blocked on a measured parameter/user audition, or scope-exceeded.

## Outcome

Campfire reached the plan's exact artifact stop condition: four technically verified outputs and four manifest-bound user Pass decisions. This closes Batch 01's Campfire slice as `audible-qa-passed`; it does not authorize publication, production runtime wiring, upload, deployment, push, or merge. Boiling Water remains parameter-gated, while walking repair remains active future work.

## Batch 02 Continuation: Air Traffic Control

- Batch id: `batch-02-air-traffic-control`.
- Exact concept: `signature-extra:air-traffic-control`, using the 12 construction-owned source ids already auditioned with 1-7 second event spacing and four intervening selections.
- Processing boundary: `air-traffic-normalize` only. Preserve all speech and timing; apply the same attenuation-only quietest-input EBU R128 policy used by Batch 01. Real measurement confirmed all 12 exact inputs are mono 44.1 kHz/16-bit PCM, so Batch 02 preserves mono while converting to 48 kHz/24-bit PCM instead of silently duplicating channels.
- Reuse boundary: keep Batch 01's declaration, manifest, output identities, and four Pass decisions immutable. Batch selection and the development review loader may become batch-aware, but publication and production runtime remain out of scope.
- Strict TDD boundary: establish RED for exact Batch 02 validation, a non-Campfire output directory, safe CLI batch selection, manifest-anchor selection, and an empty exact QA draft before implementation.
- Stop: technically verified external outputs plus checksum-anchored development review, then wait for artifact QA. Stop earlier on source/tool/root/measurement drift.

### Batch 02 Outcome

The reviewer directly confirmed all 12 exact Air Traffic source/processed comparisons Pass. A separate manifest-bound QA record preserves those decisions without replacing Batch 01's four passes, and both manifest anchors are `audible-qa-passed`. This closes Batch 02's technical and audible-artifact slice only; publication, production runtime wiring, and remaining concept work stay outside this outcome.

## Batch 03 Continuation: Sci-Fi Whistles Treatment Audition

- Batch id: `batch-03-sci-fi-whistles-treatment-audition`.
- Exact concept: `signature-extra:sci-fi-whistles`, using all 18 construction-owned source ids whose raw `0–8` second spaced-event scheduler has a `playback-only` Pass.
- Intent boundary: `whistles-time-effect` asks for echo or delay that supports the whistle events but does not prescribe final effect parameters. Batch 03 is therefore an exploratory audition matrix, not final processing authority.
- Variants:
  - `short-delay`: one `120 ms` repeat at `0.30` decay, FFmpeg input/output gains `0.92 / 0.82`, and `-1.5 dB` safety attenuation.
  - `medium-echo`: `180 / 360 ms` taps at `0.30 / 0.15` decay, input/output gains `0.90 / 0.72`, and `-1.5 dB` safety attenuation.
  - `wide-dual-echo`: `260 / 520 ms` taps at `0.34 / 0.17` decay, input/output gains `0.88 / 0.68`, and `-1.5 dB` safety attenuation.
- Output boundary: expand 18 exact sources into 54 variant-bound lossless PCM WAVs at 48 kHz/24-bit while preserving each source's channel count. Each output identity binds its variant parameters, source bytes, declaration fingerprint, and output version.
- Verification: require exact source checksum/size, the recorded FFmpeg 9.0 build, declared effect-tail duration, preserved channels, no overwrite, unique output identity/path, true peak at or below `-0.1 dBTP`, output hash/size, atomic manifest publication, and manifest-closed development byte serving.
- Review UI: the primary comparison is the complete concept, not isolated recordings. One shared scheduler plays the 18 dry sources or the 18 exact outputs for one treatment through the already approved `0–8` second spaced-event behavior. Dry, short-delay, medium-echo, and wide-dual-echo auditions stop one another; each exposes Start, Stop, Next event, and explicit heard confirmation. Concept QA binds each treatment to its exact 18 output identities and records one note/decision per complete variant. The prior per-recording artifact review remains collapsed as optional diagnostics and does not substitute for concept-level evidence. No committed audible decision is created before the reviewer listens.
- Compatibility: Batch 01/02 declarations, manifests, artifacts, and QA remain byte-identical. Effect-specific planning and rendering live in new owners because the normalization planner and runner are already at their recorded complexity limits.
- Deferred concepts: deterministic trim candidates may be measured read-only, but Boiling Water, Dryer, speech work, separation, Light Rain, and Wind Chimes receive no rendered artifact until their own parameter or choice gates are resolved.
- Strict TDD boundary: establish RED for the exact 18-source declaration, closed variant schema, deterministic 54-output expansion, FFmpeg arguments, duration/peak/channel verification, atomic rollback, manifest drift, processing-page labels, empty exact QA, and range serving before implementation.
- Stop: technically verified 54-artifact external batch plus checksum-anchored development review, then wait for variant QA. Stop earlier on source/tool/root/measurement/peak drift.

### Batch 03 Technical Outcome

The exact external render produced 54 stereo 48 kHz/24-bit PCM review artifacts—18 per declared treatment—with zero partial, missing, size-mismatched, or checksum-mismatched files. The 53,034,894-byte set validates against declaration `d37531e47076d5eb10f3dcb6ea708df34d593a444c81fc36d675e2b44acbab7c` and external manifest `70a172f0e32437f1b795e14e26b0dc3a36ebcfa1b7d627d1c5d3ddd9b5ce0de3`; output true peaks span `-23.3` to `-6.2` dBTP. The manifest-closed processing page starts from decision-empty complete-concept QA, with artifact-level diagnostics retained separately. Batch 03 is technically review-ready and still awaits audible QA; it does not approve an effect or authorize production/publication.

### Batch 03 Review-Correction Slice

- Goal: make the treatment comparison match the intended dynamic concept by auditioning all 18 sources as one spaced-event sequence per effect variant.
- Change necessity: code-change. Static copy or individual players cannot produce the complete scheduler behavior or honest concept-level heard evidence.
- Owner boundary: reuse the existing scheduler with an injected manifest-closed URL resolver; add a focused treatment-concept QA owner and a focused concept-review component; retain the individual artifact UI only as optional diagnostics.
- Compatibility: do not change the 54 rendered bytes, declaration/manifest identities, source audio, construction scheduler approval, Batch 01/02 QA, or production runtime.
- Strict TDD: RED must prove exact 18-source dry/variant preview sets, derived URL resolution through the shared scheduler, complete-concept controls, exact variant-bound QA, and collapsed artifact diagnostics before implementation.
- Stop: live page can start each whole-concept variant with `0–8` second spacing and export concept-level decisions, then wait for reviewer acceptance.

### Batch 03 v2 Stronger-Wide Slice

- Reviewer input: wide dual echo sounds best; add a doubled-effect comparison without discarding the known-good version.
- Recipe: retain the exact `260/520 ms` taps and `0.88/0.68` input/output gains, double decay from `0.34/0.17` to `0.68/0.34`, and increase whole-output safety attenuation from `-1.5` to `-3 dB`.
- Immutability: increment `outputVersion` to 2 and render all four effects into a new external root. The v1 declaration evidence and 54-file external directory remain untouched.
- Acceptance: 72 exact manifest-bound outputs, 18 per effect, with every physical size/hash/format/duration/peak verified. The three retained effects must be byte-identical to v1, while the complete-concept page adds one separate ×2 QA entry.
- Boundary: no production runtime, publication, upload, source modification, prior-batch QA change, or inferred audible decision.
- Stop: technically ready five-way complete-concept comparison—dry plus four effects—then wait for the reviewer to decide between wide and ×2.

### Batch 03 v2 Audible QA Outcome

The reviewer directly passed wide dual echo ×2 as the complete Sci-Fi Whistles concept. The durable selection binds that one Pass to all 18 exact ×2 output identities under declaration `e05aadb04e87f56e9df4f69cba180ce37ca0f4481fbfc0fa2c981bdd4fb4163a` and manifest `8ff6856b1342a8d88366eeae48e1307b7cbc0921ef0ef7755fce8ac4f7faa6c6`. Short delay, medium echo, and the original wide dual echo remain undecided comparison variants; no rejection is inferred. Batch 03 is `audible-qa-passed`, while publication, production runtime wiring, and broader concept completion remain outside this outcome.

## Batch 04 Continuation: Boiling Water Trim/Loop Audition

- Exact concept: `moodist:boiling-water`, source `d4d3d8e79de008a42450e8835383fd2255a801cd29a15f10386fe6cbdab1349c`, and required intents `boiling-trim-clicks` plus `boiling-repair-loop`.
- Measured edit window: begin at `4.0s`, after the detected ignition/click activity; end at `111.4s`, before detected shutdown activity. These are review-candidate measurements, not prior user approval.
- Candidate matrix: preserve the same measured window and compare cyclic equal-power crossfades of `2s`, `4s`, and `8s`. Each output is lossless stereo 48 kHz/24-bit PCM and starts at the constructed seam so file-end-to-file-start remains continuous.
- Review behavior: dry source remains available for diagnosis. Each processed candidate uses a dedicated repeated boundary audition that alternates the exact tail and head windows so the reviewer hears at least two end-to-start crossings before Pass is enabled. Ordinary construction crossfade playback must not mask the seam.
- Identity: declaration, source bytes, exact trims, crossfade curve/duration, output format/version, physical manifest, and each output checksum remain bound. Corrections require a new output version and external root.
- Boundary: Batch 01–03 roots and QA stay immutable. No selected Boiling candidate is inferred before audible QA, and no production/publication authority follows from rendering.

### Batch 04 v2 Reviewer Correction

- Reviewer recipe: begin at source `0:00`, play through `1:30` once, then repeat source `0:15–1:30`; crossfade each return from `1:30` to `0:15`.
- Candidate matrix: retain the `2s`, `4s`, and `8s` equal-power comparisons. Each complete artifact contains the one-time opening followed by one baked loop region, and records the exact offset where a sample-accurate player must begin repeating. The `0:00–0:15` opening is outside that repeat region.
- Immutable correction: increment to output version 2 and render to `batch-04-boiling-water-edit-audition-v2`; retain the v1 external directory and historical technical evidence untouched.
- Review behavior: the dedicated player decodes only the selected artifact, plays it from zero, then loops the declared in-file region. Two actual loop transitions plus dry/candidate audition evidence are required before Pass.
- Verification: source checksum, exact FFmpeg 9.0, deterministic filter graph/identities, durations, loop offsets, output hash/size/format/peak, manifest portability, browser contract, and live HTTP `200/206`.
- Stop: technically verified decision-empty v2 comparison, then wait for audible selection. No production or publication authority is inferred.

## Batch 05 Continuation: Dryer Boundary Trim Audition

- Exact concept: `moodist:dryer`, source `a2cdc5b801058999b253de905dcdc45e612c5e944ef6e4202a0d815b91bf8d4f`, and required intent `dryer-trim-boundaries`.
- Candidate recipe: trim the startup to `1.8s`, end at `17.7s`, and apply `0.15s` boundary fades. The source waveform shows the startup transient before the steady bed and an otherwise abrupt file ending; the exact edit remains a candidate until audible QA.
- Review behavior: compare dry and processed audio, then audition the processed result through the separately approved per-boundary `3.75–10s` transition policy. Pass binds the processed output plus that complete playback setup.
- Boundary: one candidate output; a Needs Rebuild decision keeps Dryer active and does not reject its source or its already-approved playback timing.
- Outcome: rendered one checksum-bound 15.9-second candidate and exposed a button-free whole-concept comparison. Direct chat feedback selected `Dry concept`; the exact source, comparison output, and playback setup are bound in a committed record, the trimmed candidate remains unselected, and the terminal anchor state is `audible-qa-complete-dry-selected`.

## Multi-Batch Development Review Catalog

- Preserve one immutable external directory and one manifest per batch. A server-only catalog root resolves a closed batch id to a portable directory name; the browser never submits a filesystem path.
- `/dev/candidates/processing?batch=<closed-id>` renders a selector and loads only the chosen checksum-anchored batch. The current `ATMOSHAPER_SIGNATURE_DERIVED_ROOT` remains a compatible single-root fallback.
- Batch-qualified derived URLs include the closed batch id and exact output identity. Canonical containment, manifest checksum, output checksum, and cross-root rejection remain fail-closed.
- Strict TDD covers catalog-root escape/drift, declaration/plan/argv determinism, no-overwrite rollback, seam verification metadata, exact QA, selector behavior, and Batch 01–03 regression before any external render.

## Batches 06–15 Continuation: Accepted Raw Whole-Concept Queue

- Requested outcome: leave ten additional concepts ready for sequential listening without requiring page decision buttons or one-at-a-time implementation between reviews.
- Exact queue, ranked to start with smaller pools, avoid same-source aliases, and exercise one already-parameterized cadence concept after ordinary continuous playback: Batch 06 Droplets, Batch 07 Electrical Interference, Batch 08 Washing Dishes, Batch 09 Washing Machine, Batch 10 Cave Room Tone, Batch 11 Room Tone, Batch 12 Light Waves, Batch 13 Dark Ambient Pad, Batch 14 Walk in Snow, and Batch 15 Experimental Atmosphere.
- Eligibility boundary: every selected group is active, has at least one included source, has no group- or source-level processing intent, and has an exact accepted playback strategy. Strict `unresolved`, `needs-rebuild-audition`, source-empty, and processing-gated groups are excluded rather than guessed.
- Review behavior: each batch plays its entire concept dynamically through the construction-owned strategy and exact settings. Continuous groups retain their crossfade settings; Walk in Snow retains its exact `62` steps-per-minute cadence with `30%` jitter. Start, Stop, and Next transition/event are the only controls; the reviewer replies in chat with Pass or requested changes.
- Identity: one committed raw-concept review registry binds the ten closed batch ids to construction review fingerprint `a3e782b6c1c2d808bd7e8214cb655163f1bdfbc473318ae0ac9c916ccb84954d`. The projection validates each group and source against the canonical construction and discovery reviews before the browser receives source ids, labels, paths, or playback settings.
- Architecture: add one pure registry/projection owner and one focused client component. Keep the existing processing page to wiring and selector dispatch; extract navigation if required to stay within the recorded page budget. Reuse the checksum-verifying raw source route and the single preview scheduler.
- Compatibility: Batches 01–05, all external audio roots, manifests, QA, and direct selections remain immutable. No derived bytes are generated, no source is changed, and no production/publication/upload/deployment/Git-lifecycle action is authorized.
- Strict TDD: RED must prove the absent ten-entry registry/projection, stale fingerprint and ineligible-group rejection, exact queue order/source counts/playback settings, page dispatch, whole-concept controls, chat-only workflow, and retained Batch 01–05 selector behavior before GREEN implementation.
- Stop: all ten batch URLs render, every one of the 48 checksum-bound sources is resolvable through the development route, focused/full validation passes, and the retained local server is ready at Batch 06 for reviewer listening.
