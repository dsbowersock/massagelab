# Atmosphere Remaining Generators

## Scope

Finish enabling the remaining 18 Alex Bainter Generative.fm package pieces in MassageLab without committing raw audio. This branch treats those generators as MassageLab-hosted Wellness audio stations under `/wellness/atmosphere`, using public R2 sample indexes and Opus sidecars.

## Licensing And Source Decisions

- VSCO 2 Community Edition and VCSL remain the preferred CC0 sources where they directly cover package roles.
- Signature Sounds packs under `C:\Users\derri\code\audio\Signature Samples` are treated as usable CC0 source packs based on the site-wide About page statement at `https://signaturesounds.org/about-` plus local pack naming and, where present, local license files.
- Raw SSO samples remain excluded.
- `native-american-flute-susvib` is adapted to VSCO sustained flute.
- `alex-hum-1` uses Signature Sounds choir teaser ambience; `alex-hum-2` uses the Serbian Orthodox choir pack.
- The downloaded Zither pack has AIF files rather than the WAV files needed by the current upload workflow, so `dan-tranh-gliss-ps` uses Signature Sounds Spanish Guitar WAVs.
- `zed__pad` and `zed__noise` use Signature Sounds Burial Pads and White Noise as the current package-facing replacements.

## Implementation

- `lib/atmosphere/generative-fm-catalog.js` marks the remaining 18 package pieces as hosted and exposes their package-compatible source groups.
- `lib/atmosphere/generative-fm-sample-coverage.js` adds Signature Sounds site-wide CC0 evidence handling, ignores macOS archive sidecars, and maps the remaining source groups to VSCO, VCSL, and Signature Sounds replacements.
- `lib/atmosphere/generative-fm-first-batch-samples.js` adds source selection rules for the new VCSL, VSCO, and Signature Sounds groups.
- `lib/atmosphere/generative-fm-render-plan.js` includes the remaining-generator batch in the default planning set.
- Focused tests now expect 57 playable Generative.fm stations and cover representative remaining-generator source/index behavior.

## Upload Result

The remaining-generator WAV upload published 704 R2 objects across 18 stations, representing approximately 1,491.6 MB of WAV payload. The matching Opus sidecar upload published 704 R2 objects, representing approximately 79.5 MB of encoded payload.

The 18 enabled pieces are Animalia Chordata, Awash, Didgeridoobeats, Eyes Closed, Last Transit, Lullaby, Meditation, Moment, Neuroplasticity, Otherness, Peace, Pulse-code Modulation, Skyline, Stratospheric, Stream of Consciousness, Townsend, Western Medicine, and Zed.

## Validation

- `node --test tests/atmosphere-generative-fm-render-plan.test.mjs tests/atmosphere-generative-fm-first-batch-samples.test.mjs tests/atmosphere-generative-fm-sample-coverage.test.mjs tests/atmosphere-stations.test.mjs tests/atmosphere-generative-fm-sample-index.test.mjs`
- `npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"`
- `npm run atmosphere:samples:render-plan -- "C:\Users\derri\code\audio"`
- Runtime-validator HTTP checks passed for all 36 new `sample-index.json` and `sample-index.opus.json` URLs.
- Representative new WAV and Opus payload URLs returned range-readable CORS responses.

## Follow-Up

The remaining pieces are enabled through source-index coverage. A later performance branch can prerender the heaviest first-start paths where package behavior shows a meaningful delay.
