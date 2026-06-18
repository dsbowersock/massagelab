# Atmosphere Prerendered Samples Plan

## Goal

Reduce first-start latency for the Observable Streams station by hosting rendered
instrument samples in R2 so the Generative.fm package can skip browser-time
prerendering.

## Current Contract

- Source samples are uploaded under
  `atmosphere/observable-streams-vsco-adaptation/samples/`.
- `sample-index.json` currently exposes the source instrument keys expected by
  the package:
  - `vsco2-piano-mf`
  - `vsco2-violin-arcvib`
  - `sso-cor-anglais`
- The Observable Streams package first looks for rendered instrument keys. When
  those keys are absent, it renders the buffers in the browser and saves them
  for future use.

## Target Contract

Add rendered instrument keys to the hosted sample index:

- `observable-streams__vsco2-piano-mf`
- `observable-streams__vsco2-violin-arcvib`
- `observable-streams__sso-cor-anglais`

The existing source sample keys remain in the index for compatibility and future
diagnostics.

## Implementation Shape

1. Add a small Node renderer for PCM WAV files that can:
   - decode the curated source WAV files,
   - select the closest source note for each rendered target note,
   - resample to the target pitch,
   - apply the package-compatible violin fade-out,
   - add deterministic reverb tails for the package's wet rendered buffers,
   - encode browser-loadable PCM WAV output.
2. Extend the R2 upload plan so it can optionally include rendered sample
   objects and publish an expanded `sample-index.json`.
3. Keep generated audio artifacts out of git. The repository should contain the
   reproducible script and metadata logic, not the rendered WAV payloads.
4. Validate with a dry-run against `<audio-sample-root>` (for example
   `~/code/audio`), then upload to `massagelab-public-media` if the local
   environment has the existing R2 credentials.

## Non-Goals

- Do not add YouTube-backed stations on this branch.
- Do not introduce user-customizable generators yet.
- Do not move source audio into git.
