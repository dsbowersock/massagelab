# Atmosphere Sample Asset Intake Implementation Plan

**Date:** 2026-06-17

**Branch:** `codex/atmosphere-sample-asset-intake`

**Goal:** Turn the local sample folder at `C:\Users\derri\code\audio` into repeatable evidence for the first Generative.fm station without committing raw audio files. The branch verifies local library/license evidence, identifies which Observable Streams sample sets are present, excludes SSO raw samples from the hosted app path, and selects a CC0 VSCO sustained oboe replacement for the package's cor anglais role.

**Architecture:** Keep raw samples outside the repo. Add a small pure helper under `lib/atmosphere` that matches expected sample-library paths, parses VSCO piano mapping charts, and builds a deterministic local staging plan. Add local CLI scripts that scan a supplied audio root, print a bounded report, and optionally stage a curated public sample-index payload. Document the result in the Atmosphere wiki so the next branch can wire the Generative.fm adapter from verified assets only.

## Scope

- Add `lib/atmosphere/sample-intake.js` for Observable Streams sample requirements, local file matching, VSCO piano mapping parsing, and markdown report formatting.
- Add `scripts/atmosphere-sample-intake.mjs` and `npm run atmosphere:samples:scan -- <audio-root>` for repeatable local scans.
- Add `scripts/atmosphere-stage-observable-streams.mjs` and `npm run atmosphere:samples:stage -- <audio-root> [--dry-run]` for deterministic local staging without committing raw WAV files.
- Add focused tests for candidate matching, SSO exclusion, VSCO oboe replacement handling, VSCO piano MIDI mapping, and the curated sample-index plan.
- Update Atmosphere docs with the local scan evidence and current blocker.

## Local Findings

The local audio root contains VSCO 2 Community Edition and Versilian Community Sample Library assets with CC0 license evidence. Observable Streams needs three musical roles:

| Source sample | Local status | Notes |
| --- | --- | --- |
| `vsco2-piano-mf` | Candidate present | VSCO upright piano WAVs are present with `MappingChart.txt`; the first staged adaptation selects 12 medium piano notes from dynamic layer `2`. |
| `vsco2-violin-arcvib` | Candidate present | VSCO solo violin arco vibrato WAVs are present; the first staged adaptation selects 6 `p` dynamic notes. |
| `vsco2-oboe-sus` | Replacement present | VSCO sustained oboe WAVs are present; the first staged adaptation selects 6 dynamic-1 notes and exposes them under the package's `sso-cor-anglais` role. |

SSO remains excluded from the hosted app path because its Creative Commons Sampling Plus 1.0 license is not a clean fit for raw browser sample redistribution in a public product feature.

## Acceptance

- `npm run atmosphere:samples:scan -- "C:\Users\derri\code\audio"` reports the same local evidence without writing sample files into the repo, including `vsco2-oboe-sus: replacement-present`.
- `npm run atmosphere:samples:stage -- "C:\Users\derri\code\audio" --dry-run` reports the 24-file curated VSCO staging plan and generated sample-index path without copying files.
- `node --test tests/atmosphere-sample-intake.test.mjs` passes.
- Observable Streams remains disabled until the adapted VSCO sample index is intentionally hosted and wired to the Generative.fm adapter.
