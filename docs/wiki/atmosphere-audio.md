# Atmosphere Audio

This page records source, licensing, and runtime findings for the public Atmosphere audio branch series.

## Current Product Boundary

Atmosphere is a public, non-clinical audio workspace. It does not store PHI, therapist professional records, client appointment details, or clinical notes. The public product surface lives under `/wellness/atmosphere`; `/browse` remains a compatibility workbench for the same station UI while future experiments are staged.

## Runtime Decision

MassageLab hosts the audio runtime in the app. It does not embed Generative.fm as a remote player UI. `/wellness/atmosphere` now exposes the local Tone.js proof station plus the Observable Streams Generative.fm adapter through the global music provider, route-persistent playback, and the bottom mini-player. The route also includes a first public Calmness-style breathing guide that does not store account data or clinical records.

## Package Findings

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `tone` | `14.9.17` | MIT | https://github.com/Tonejs/Tone.js |
| `@generative-music/web-provider` | `3.0.0` | MIT | https://github.com/generative-music/web-provider |
| `@generative-music/web-library` | `0.2.2` | MIT | https://github.com/generative-music/web-library |
| `@generative-music/piece-observable-streams` | `5.2.0` | MIT | https://github.com/generative-music/piece-observable-streams |

## Generative.fm Observable Streams Adapter

`@generative-music/piece-observable-streams` exports a default piece that activates through a Generative.fm-style sample library. Its package manifest lists these sample names:

- `observable-streams__vsco2-piano-mf`
- `observable-streams__vsco2-violin-arcvib`
- `observable-streams__sso-cor-anglais`

The selected package does not include the actual sample-index data needed to resolve those names to hosted audio files. MassageLab supplies a first-party hosted sample index from `massagelab-public-media` and validates the package sample-name groups before importing browser-only Generative.fm runtime modules.

The original package expects `sso-cor-anglais` from Sonatina Symphonic Orchestra. MassageLab will not use SSO raw samples for the hosted public feature because SSO uses the retired Creative Commons Sampling Plus 1.0 license, which is not a clean fit for browser-hosted raw sample redistribution in a public product that may become subscription-supported. The first MassageLab adaptation maps that role to a CC0 VSCO sustained oboe source instead.

## Local Sample Asset Intake

The local sample folder supplied for this branch is `C:\Users\derri\code\audio`. The raw audio files stay outside the repo; MassageLab only commits repeatable scanner logic and documentation.

Run the bounded scan with:

```powershell
npm run atmosphere:samples:scan -- "C:\Users\derri\code\audio"
```

The 2026-06-17 scan found 7,740 files and 7,429 audio files. It confirmed these local libraries and license evidence:

| Library | Local status | License evidence |
| --- | --- | --- |
| VSCO 2 Community Edition | Present | `VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0/LICENSE` uses CC0 1.0 Universal. |
| Versilian Community Sample Library | Present | `VCSL-1.2.2-RC/VCSL-1.2.2-RC/README.md` describes the collection as CC0/public-domain-style. |

Observable Streams local coverage:

| Source sample | Local status | Evidence |
| --- | --- | --- |
| `vsco2-piano-mf` | Candidate present | 69 VSCO upright piano WAVs matched, with `MappingChart.txt` mapping A0 to C8 across 45 sample numbers. The first staged adaptation uses dynamic layer `2` as the medium piano source. |
| `vsco2-violin-arcvib` | Candidate present | 30 VSCO solo violin arco vibrato WAVs matched across `f` and `p` dynamics. |
| `vsco2-oboe-sus` | Replacement present | 18 VSCO sustained oboe WAVs matched across dynamics `1` and `3`. This intentionally replaces the package's `sso-cor-anglais` role. |

Stage the first curated Observable Streams adaptation with:

```powershell
npm run atmosphere:samples:stage -- "C:\Users\derri\code\audio" --dry-run
```

The dry run selects 24 WAV files: 12 VSCO piano dynamic-2 notes, 6 VSCO violin `p` notes, and 6 VSCO sustained-oboe dynamic-1 notes. Running the same command without `--dry-run` copies those WAVs into `public/audio/atmosphere/observable-streams-vsco-adaptation/samples/` and writes `sample-index.json` plus `manifest.json` beside them. The generated `samples/` folder is gitignored so the branch cannot accidentally commit raw audio.

The generated sample index intentionally exposes the oboe replacement under `sso-cor-anglais`. That lets the existing Observable Streams package request its original musical role while MassageLab serves a CC0 VSCO sustained-oboe source instead of SSO raw samples.

Excluded package source:

| Source sample | Decision | Reason |
| --- | --- | --- |
| `sso-cor-anglais` | Excluded | SSO's Sampling Plus license is not a clean fit for hosting raw browser samples in a public MassageLab product feature. |

Decision: build the first Observable Streams path as a MassageLab-hosted VSCO adaptation. Observable Streams is playable after the generated sample index was hosted with the right cache/CORS behavior and wired to the Generative.fm adapter.

## Public R2 Sample Hosting

Atmosphere samples are public, non-PHI media and should be hosted from `massagelab-public-media`. Do not use `massagelab-anatomy-media` for these audio files, and do not use `massagelab-private-media` for public browser-playable samples.

Configured bucket roles:

| Bucket | Atmosphere use |
| --- | --- |
| `massagelab-public-media` | Public non-PHI audio samples, sample indexes, and manifests. |
| `massagelab-anatomy-media` | Anatomy media workflow only. |
| `massagelab-private-media` | Reserved for private media workflows; not used for public Atmosphere samples. |

Check local R2 readiness without printing secrets:

```powershell
npm run atmosphere:samples:r2:check
```

Plan the hosted Observable Streams object layout without uploading:

```powershell
npm run atmosphere:samples:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"
```

Include package-compatible rendered samples in the plan or upload:

```powershell
npm run atmosphere:samples:r2:upload -- "C:\Users\derri\code\audio" --dry-run --include-rendered --public-base-url "https://media.massagelab.app"
```

The dry run reuses the same curated 24-WAV asset selection as local staging. With `--include-rendered`, it also generates 30 rendered WAV payloads in memory from those curated sources, then maps everything to these public-media R2 objects:

- `atmosphere/observable-streams-vsco-adaptation/samples/*.wav`
- `atmosphere/observable-streams-vsco-adaptation/rendered/<rendered-instrument>/*.wav`
- `atmosphere/observable-streams-vsco-adaptation/sample-index.json`
- `atmosphere/observable-streams-vsco-adaptation/manifest.json`

Actual upload requires `MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL`, R2 credentials, and either `CLOUDFLARE_ACCOUNT_ID` or an explicit R2 endpoint. The command uploads WAVs directly from the local audio root, generates optional rendered WAVs locally, and writes generated JSON metadata to R2; the raw and rendered audio stay outside Git.

The uploader applies long-lived immutable cache headers to WAV sample payloads and short revalidating cache headers to generated JSON metadata (`sample-index.json` and `manifest.json`). That keeps stable sample URLs cacheable while allowing metadata corrections to propagate quickly.

The public bucket is connected to `https://media.massagelab.app` with the checked-in CORS policy at [../cloudflare/massagelab-public-media-cors.json](../cloudflare/massagelab-public-media-cors.json). The policy allows public browser `GET` and `HEAD` reads with the `Range` request header and exposes the media/cache headers needed by audio fetches.

On 2026-06-18 the first Observable Streams VSCO adaptation was uploaded to `massagelab-public-media`: 24 WAV files, `sample-index.json`, and `manifest.json`. Verification confirmed:

- `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.json` returns `200` with `Content-Type: application/json; charset=utf-8`.
- `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/samples/piano-c-sharp2.wav` returns `200` with `Content-Type: audio/wav`.
- Both verified URLs return `Access-Control-Allow-Origin: *` when requested with an Origin header.

The hosted sample index is now wired into the Observable Streams station on `/browse`.

Later on 2026-06-18, the prerendered sample branch uploaded 30 rendered Observable Streams WAVs beside the source samples and refreshed `sample-index.json` plus `manifest.json`. The hosted index now includes these rendered instrument keys, which the runtime requests before source-key fallbacks:

- `observable-streams__vsco2-piano-mf`: 16 rendered notes.
- `observable-streams__vsco2-violin-arcvib`: 8 rendered notes.
- `observable-streams__sso-cor-anglais`: 6 rendered notes, still generated from the CC0 VSCO sustained-oboe replacement source.

Verification confirmed the refreshed sample index returns `200` with `Content-Type: application/json; charset=utf-8` and `Access-Control-Allow-Origin: *`. A rendered piano sample at `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c4.wav` returned `206` for a range request with `Content-Type: audio/wav`, `Content-Range`, and `Access-Control-Allow-Origin: *`.

## Generative.fm Adapter Runtime

- `/wellness/atmosphere` exposes Observable Streams as a playable station through MassageLab's global music provider and persistent mini-player. `/browse` remains available as a compatibility workbench for the same UI.
- The browser-only adapter fetches and validates the hosted sample index, creates the Generative.fm web library/provider pair, activates `@generative-music/piece-observable-streams`, starts Tone transport, and returns cleanup to the existing runtime controller.
- The station id remains `observable-streams-probe` for local favorites and recent-station storage stability while the display copy treats it as a playable station.
- Next/Turbopack resolves `tone` to `tone/build/esm/index.js` and maps `regenerator-runtime/runtime.js` to a local no-op shim because the older Generative.fm packages otherwise fail the Next 16 production build before runtime.
- The hosted sample index now includes the package's rendered instrument keys, so Observable Streams should skip the browser-time prerender step that previously delayed first start. Keep browser smoke coverage around first play because this optimization depends on the package continuing to request rendered names before source fallbacks.

## Attribution Draft

Observable Streams by Alex Bainter. Package used with permission and MIT package licensing. The playable MassageLab adaptation uses CC0 VSCO-hosted sample sources, including VSCO sustained oboe under the package's `sso-cor-anglais` role.
