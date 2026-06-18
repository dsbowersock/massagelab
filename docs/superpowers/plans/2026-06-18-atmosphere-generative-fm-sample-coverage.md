# Atmosphere Generative.fm Sample Coverage Plan

> **For agentic workers:** Use inline execution by default. Subagents are optional only for isolated review or source-replacement research after the local coverage tooling is stable.

**Goal:** Turn the full Generative.fm catalog from visible metadata into verified MassageLab-hosted stations without committing raw audio. Use the local `C:\Users\derri\code\audio` VSCO, VCSL, and evidence-confirmed Signature Sounds libraries where licensing is clean, keep raw SSO and unknown third-party groups disabled, and only enable stations after rendered package-compatible samples are hosted in `massagelab-public-media` and browser playback passes.

**Current source truth:** The local audio root contains VSCO 2 Community Edition, Versilian Community Sample Library, and `Signature Samples` packs with local CC0 license files. The scan confirms VSCO `LICENSE` as CC0 1.0 Universal, VCSL `README.md` as Creative Commons 0/public-domain-style evidence, and Signature Sounds beach ambience, choir/vocal teaser, and Serbian Orthodox choir license files as CC0 1.0 Universal evidence. Raw Sonatina Symphonic Orchestra samples remain excluded because Sampling Plus is not a clean public browser-hosting fit, but package-facing SSO roles can use documented CC0 adaptations.

**Configured SSO adaptations:** `sso-cor-anglais` maps to VSCO sustained oboe. `sso-chorus-female` maps to Signature Sounds children choir ambience, and `sso-chorus-male` maps to Signature Sounds men-of-choirs WAVs. Later rendered uploads should keep the package-facing SSO sample names while serving these replacement sources.

**Signature Sounds candidate pool:** The downloaded `Signature Samples` folders should stay in the future source pool for custom generators and palette refreshes. This branch only counts the Signature packs that map to current Generative.fm sample groups (`waves`, `sso-chorus-female`, and `sso-chorus-male`) as coverage candidates; other packs remain useful future candidates until a station or custom-generator role needs them.

## Current Coverage Snapshot

Run:

```powershell
npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"
```

The 2026-06-18 scan found:

- 57 Generative.fm pieces in the MassageLab catalog.
- 1 hosted/playable Generative.fm piece now: Observable Streams.
- 38 pieces whose pending groups have local CC0 source candidates but still need package-compatible rendered sample uploads.
- 18 pieces that need replacement samples or separate source/licensing review.
- 96 unique sample groups, including 63 local CC0 source candidate groups and 30 blocked or replacement-needed groups.

## Render/Upload Candidate Pieces

These pieces can move into rendered-sample planning from the current local audio root, but must remain disabled until exact rendered sample keys are hosted and browser-smoked:

- 420hz Gamma Waves for Big Brain
- A Viable System
- Above the Rain
- Agua Ravine
- aisatsana (generative remix)
- Apoapsis
- At Sunrise
- Beneath Waves
- Bhairav
- Buttafingers
- Day/Dream
- Documentary Films
- Drones
- Drones II
- Eno Machine
- Enough
- Expand/Collapse
- Homage
- Impact
- Lemniscate
- Little Bells
- Nakaii
- No Refrain
- Oxalis 1
- Pinwheels
- Remembering
- Return to Form
- Ritual
- Sevenths
- Soundtrack
- Splash
- Spring Again
- Substrate
- Timbral Oscillations
- Transmission
- Trees
- Uun
- Yesterday

## Replacement Or Licensing Queue

These pieces cannot be enabled from the current local audio root alone:

- Animalia Chordata: needs `whales`.
- Awash: needs `dry-guitar-vib`.
- Didgeridoobeats: needs `itslucid-lofi-hats`, `itslucid-lofi-kick`, and `itslucid-lofi-snare`.
- Eyes Closed: needs `dan-tranh-gliss-ps`.
- Last Transit: needs `idling-truck`.
- Lullaby: needs `birds` and `explosion`.
- Meditation: needs `kasper-singing-bowls`.
- Moment: needs `acoustic-guitar`, `alex-hum-1`, and `alex-hum-2`.
- Neuroplasticity: needs `guitar-namaste`.
- Otherness: needs `otherness`.
- Peace: needs `native-american-flute-susvib`.
- Pulse-code Modulation: needs `acoustic-guitar`.
- Skyline: needs `itslucid-lofi-hats`, `itslucid-lofi-kick`, and `itslucid-lofi-snare`.
- Stratospheric: needs `guitar-coil-spank` and `guitar-dusty`.
- Stream of Consciousness: needs `snare-brush-stir`, `snare-brush-hit-p`, and `ride-brush-p`.
- Townsend: needs `acoustic-guitar-chords-cmaj`.
- Western Medicine: needs `guitar-harmonics`.
- Zed: needs `zed__pad` and `zed__noise`.

## Implementation Sequence

- [ ] Keep this branch as the coverage and planning layer: reusable scanner, CLI, docs, and tests.
- [ ] Next branch: build a rendered-sample planner that reads package manifests and source code for a small station batch, starting with piano/VCSL-only pieces.
- [ ] Generate package-compatible rendered WAVs from local CC0 source candidates into memory or temp files, then upload to `massagelab-public-media` with immutable WAV cache headers and short metadata cache headers.
- [ ] Refresh the hosted sample index/manifest so station-specific rendered keys are present before source fallbacks.
- [ ] Enable only stations whose rendered sample groups validate through `assertGenerativeFmSampleIndex` and pass a browser first-play smoke test.
- [ ] For replacement-queue stations, find or create replacement samples with public hosted-browser rights before adding them to the render/upload planner.

## Guardrails

- Do not commit raw or rendered audio to Git.
- Do not use `massagelab-anatomy-media` or `massagelab-private-media` for public Atmosphere stations.
- Do not treat source-group matches such as `vsco2-piano-mf` as enough for playback. The package may request rendered piece-specific keys and exact note coverage.
- Do not host raw SSO samples. Use the documented CC0 VSCO/Signature Sounds adaptations for configured SSO roles and keep any unconfigured SSO role blocked until it has a clear replacement.
- Keep all Atmosphere audio public and non-PHI.
