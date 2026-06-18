# Atmosphere Rendered Sample Planner

## Goal

Continue the Atmosphere branch series by turning the catalog-wide sample coverage report into a small, auditable first batch for additional Generative.fm stations. This branch should not mark more stations playable yet. It should identify exactly which package-compatible sample groups are ready, build a dry-runnable R2 upload plan, and keep upload/browser-smoke enablement as a separate verified step.

## First Batch

- `aisatsana`: source-index path for `vsco2-piano-mf`; the installed package uses `createSampler` directly and does not request a package-specific rendered instrument.
- `at-sunrise`: rendered-note path for `at-sunrise__vcsl-vibraphone-soft-mallets-mp`; source is `vcsl-vibraphone-soft-mallets-mp`; rendered notes are `C3`, `F3`, `C4`, `F4`, `C5`, `E5`, `G5`, and `C6`.
- `little-bells`: rendered-note path for `little-bells__vsco2-glock`; source is `vsco2-glock`; rendered notes are `F4`, `A4`, `C5`, `D#5`, `F#5`, `A5`, `C6`, `D#6`, `F#6`, and `A6`.

## Boundaries

- Keep raw sample files outside Git.
- Treat local CC0 source coverage as necessary but not sufficient for station playability.
- Do not mark additional station sample groups hosted until the rendered/source sample index is published and browser playback is verified.
- Keep the planner explicit for the first batch rather than auto-inferring rendered notes from minified package output.
- Dry-run upload planning may render WAV buffers in memory, but it must not write samples to Git or upload to R2 unless the operator intentionally runs the non-dry-run command.

## Implementation Notes

- Add a reusable render-plan helper that combines package-derived note targets with `createGenerativeFmSampleCoverage`.
- Add `npm run atmosphere:samples:render-plan -- <audio-root> [--json] [--piece <piece-id>]`.
- Add a first-batch upload-plan helper and `npm run atmosphere:samples:generative:r2:upload -- <audio-root> --dry-run --public-base-url <url>`.
- The default commands should plan only the first batch above.
- The next branch can use the dry-run output to intentionally upload the source/rendered sample indexes, then enable stations one verified group at a time after browser smoke.

## Validation

- Focused Node tests cover source-index versus rendered-note planning, blocked license evidence, report formatting, and explicit first-batch scoping.
- Focused Node tests cover first-batch source selection, generated R2 sample-index/manifest shape, rendered WAV object generation, pitch-shift semitone rendering, and audio-root path containment.
- Run the planner against `C:\Users\derri\code\audio` to confirm the first batch is ready for upload planning with the currently downloaded libraries.
- Run `npm run atmosphere:samples:generative:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url https://media.massagelab.app` to confirm the real local source set would produce 64 R2 objects across `aisatsana`, `at-sunrise`, and `little-bells` without uploading.
- External audio-tool validation: a temporary rendered `at-sunrise` C3 WAV at `C:\tmp\massagelab-at-sunrise-c3.wav` was recognized by FFprobe and SOX as 16-bit signed PCM WAV, 44.1 kHz stereo, 20.58 seconds.
