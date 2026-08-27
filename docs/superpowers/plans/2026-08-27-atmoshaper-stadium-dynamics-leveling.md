# AtmoShaper Stadium Crowd final-processing plan

## Goal

Finish Batch 45 without changing its accepted speech-reduction bytes: control
major cheer/shout spikes inside each of the six exact recordings, match the
treated pool to a consistent perceived level, and expose the new result for a
fresh whole-concept review.

## Exact input boundary

- Input bundle: retained speech-reduction v1 manifest
  `a4e86fd41de6a295b8bb7628822b35330d676b5c1cb6d4b20c94976bd44e7a9d`.
- Input review identity: the six-source Stadium Crowd speech-stage fingerprint
  `581844bfabfe92024656ea7686c8aff4e729bc0bd575da5316634571e4254ea1`.
- The six speech-stage WAVs remain immutable. The new producer reads them and
  writes a separate external bundle.

## Treatment

1. Apply one downward RMS compressor with a `-20 dBFS` threshold, `3:1` ratio,
   `20 ms` attack, `750 ms` release, knee `4`, no makeup gain, full wet mix,
   and average stereo linking. This is intentionally gentle enough to retain
   crowd movement while reducing prominent cheer and shout peaks.
2. Measure the compressed signal with FFmpeg EBU R128.
3. Apply one static gain toward `-23 LUFS`, reduced as needed to retain a
   `-1 dBTP` ceiling. Do not use automatic gain riding, EQ, noise reduction,
   or a limiter.
4. Render stereo `48 kHz`/`24-bit` PCM WAV files.

## Acceptance

- Exact FFmpeg and FFprobe 9.0 executable hashes must match the retained audio
  toolchain.
- Every upstream byte size and SHA-256 digest must match before processing.
- Output duration must remain within `0.02 s` of the corresponding input.
- Every output must measure within `0.3 LU` of `-23 LUFS`; the six-output
  integrated-loudness spread must not exceed `0.3 LU`; true peak must not
  exceed `-0.9 dBTP` at the measurement precision.
- Partial bundles, linked paths, overwrites, changed manifests, or stale review
  fingerprints fail closed.
- The prior speech-stage Pass remains historical evidence and does not transfer
  to the unheard final dynamics/leveling result.

## Integration

- Add a closed declaration, pure planner/validators, CLI producer, manifest
  anchor, development loader, and exact range-serving path.
- Bind the new URLs after the existing speech-reduction review layer. Clear
  only `dynamic-range-control` and `level-match` after all six exact artifacts
  validate.
- Move the prior Batch 45 stage outcome to a dedicated stage-outcome owner and
  leave the final concept awaiting the reviewer’s fresh decision.
- Keep Batch 45's approved 15-second concept crossfade unchanged.
