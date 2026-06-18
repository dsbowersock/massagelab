# Atmosphere Audio

This page records source, licensing, and runtime findings for the public Atmosphere audio branch series.

## Current Product Boundary

Atmosphere is a public, non-clinical audio workspace. It does not store PHI, therapist professional records, client appointment details, or clinical notes. The public product surface lives under `/wellness/atmosphere`; `/browse` remains a compatibility workbench for the same station UI while future experiments are staged.

## Runtime Decision

MassageLab hosts the audio runtime in the app. It does not embed Generative.fm as a remote player UI. `/wellness/atmosphere` now exposes the local Tone.js proof station plus the full Alex Bainter Generative.fm package catalog through the global music provider, route-persistent playback, and the bottom mini-player. Eleven Generative.fm stations are currently playable from hosted public-media sample indexes. The route also includes a first public Calmness-style breathing guide that does not store account data or clinical records.

## Package Findings

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `tone` | `14.9.17` | MIT | https://github.com/Tonejs/Tone.js |
| `@generative-music/web-provider` | `3.0.0` | MIT | https://github.com/generative-music/web-provider |
| `@generative-music/web-library` | `0.2.2` | MIT | https://github.com/generative-music/web-library |
| `@generative-music/piece-observable-streams` | `5.2.0` | MIT | https://github.com/generative-music/piece-observable-streams |
| `@generative-music/pieces-alex-bainter` | `5.2.2` | MIT | https://github.com/generative-music/pieces-alex-bainter |

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

Excluded package source and adaptations:

| Source sample | Decision | Reason |
| --- | --- | --- |
| Raw SSO samples | Excluded | SSO's Sampling Plus license is not a clean fit for hosting raw browser samples in a public MassageLab product feature. |
| `sso-cor-anglais` package role | Adapted | Served from CC0 VSCO sustained oboe while preserving the package-facing sample name. |

Decision: build the first Observable Streams path as a MassageLab-hosted VSCO adaptation. Observable Streams is playable after the generated sample index was hosted with the right cache/CORS behavior and wired to the Generative.fm adapter.

## Catalog-Wide Generative.fm Sample Coverage

Run the full catalog coverage scan without copying or committing raw audio:

```powershell
npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"
```

The 2026-06-18 scan checked the full Alex Bainter package catalog against the local audio root and confirmed the local VSCO, VCSL, and selected Signature Sounds libraries have hostable CC0 evidence:

| Library | Local status | License evidence |
| --- | --- | --- |
| VSCO 2 Community Edition | Present | `VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0/LICENSE` confirms CC0 1.0 Universal. |
| Versilian Community Sample Library | Present | `VCSL-1.2.2-RC/VCSL-1.2.2-RC/README.md` confirms Creative Commons 0/public-domain-style permissions. |
| Signature Sounds Beach Ambience Recordings | Present | `Signature Samples/SS_Beach_Ambience_Recordings_CC0/SS_Beach_Ambience_Recordings_CC0/LICENSE_Beach_Collection_PRO.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds Choirs/Vocals SFX Teaser | Present | `Signature Samples/SS_Choirs_Vocals_SFX_Teaser_CC0/SS_Choirs_Vocals_SFX_Teaser_CC0/LICENSE_Choir_Collection_PRO.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds Serbian Orthodox Choirs | Present | `Signature Samples/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0/LICENSE_Serbian_Choir_PRO_v2.txt` confirms CC0 1.0 Universal permissions. |

Current catalog matrix:

| Coverage category | Count | Meaning |
| --- | ---: | --- |
| Hosted/playable stations | 11 | `observable-streams-probe`, `aisatsana`, `at-sunrise`, `day-dream`, `eno-machine`, `impact`, `lemniscate`, `little-bells`, `pinwheels`, `sevenths`, and `uun` have hosted public-media sample indexes and browser-verified playback. |
| Local CC0 source candidates | 28 | Every pending group for the piece maps to local VSCO, VCSL, or Signature Sounds source samples or a documented CC0 SSO-role adaptation, but package-compatible rendered keys still need to be generated, uploaded, indexed, and browser-smoked. |
| Replacement/source-review pieces | 18 | At least one required group is an uncovered field recording, guitar, voice/hum, lofi drum, pad/noise, or another source that is not covered by the current local CC0 libraries. |

The configured SSO-role adaptations are `sso-cor-anglais` to CC0 VSCO sustained oboe, `sso-chorus-female` to Signature Sounds children choir ambience, and `sso-chorus-male` to Signature Sounds men-of-choirs WAVs. The `waves` source group maps to Signature Sounds Beach Ambience WAVs. Later rendered uploads should keep the package-facing sample names while serving those replacement sources.

The current render/upload candidate pieces are 420hz Gamma Waves for Big Brain, A Viable System, Above the Rain, Agua Ravine, Apoapsis, Beneath Waves, Bhairav, Buttafingers, Documentary Films, Drones, Drones II, Enough, Expand/Collapse, Homage, Nakaii, No Refrain, Oxalis 1, Remembering, Return to Form, Ritual, Soundtrack, Splash, Spring Again, Substrate, Timbral Oscillations, Transmission, Trees, and Yesterday.

Pieces still needing replacement or source review are Animalia Chordata, Awash, Didgeridoobeats, Eyes Closed, Last Transit, Lullaby, Meditation, Moment, Neuroplasticity, Otherness, Peace, Pulse-code Modulation, Skyline, Stratospheric, Stream of Consciousness, Townsend, Western Medicine, and Zed. Their missing groups are field/animal recordings (`whales`, `idling-truck`, `birds`, `explosion`), guitar sources, vocal/hum sources, lofi drum sources, percussion brush sources, and Zed pad/noise sources. Do not enable these pieces until replacement files have clear hosted-browser rights and package-compatible rendered coverage.

Other downloaded Signature Sounds packs are useful future candidates for custom generator tools and for freshening rendered station palettes. The current Generative.fm coverage rules only count packs that have a direct current sample-group fit, so this pass wires the choir teaser to the SSO chorus roles and the beach ambience WAVs to `waves` while leaving unrelated packs out of the station-ready count.

Downloaded Signature Sounds future candidate packs:

| Pack | Current use label | Notes |
| --- | --- | --- |
| `Angellic+Vocal+Kit` | Future vocal/pad candidate | Useful for custom generator vocal textures after loop/key review. |
| `Beach+amb-recordings+3` | Future ambience candidate | Overlaps with the confirmed beach ambience source family; not wired because `SS_Beach_Ambience_Recordings_CC0` has clearer local license evidence. |
| `Cave+Atmosphere+SFX+2` | Future ambience candidate | Useful for dark room-tone, cave, and low movement atmosphere generators. |
| `Fire+place+foley+CC0+SignatureSounds.org` | Future ambience/foley candidate | Folder name and site copy support CC0-style use; useful for warm-room and hearth atmosphere tools. |
| `Light+Rain` | Future ambience candidate | Useful for rain layers and calmness/noise-mix tools. |
| `Moroccan+Countryside+` | Future field-recording candidate | Useful for outdoor/place-based atmosphere experiments after content review. |
| `Risers+And+Whooshes` | Future transition/texture candidate | Useful for subtle generator transitions only if kept gentle enough for treatment-room use. |
| `SignatureSamples.Co.Uk+Light+Waves+Crashing` | Future wave candidate | Site listing marks Waves Crashing on Shore as CC0, but the current `waves` rule uses the WAV-only `SS_Beach_Ambience_Recordings_CC0` pack with local license evidence. |
| `SignatureSamples.Co.Uk+Mallets` | Future melodic/percussive candidate | Useful for custom generator instruments after key/range review. |
| `Spiritual+Acoustics+CC0+Signaturesounds.org` | Future ambience candidate | Folder name supports CC0-style use; useful for spacious acoustic layers after content review. |
| `SS_Beach_Ambience_Recordings_CC0` | Current `waves` source candidate | Local license evidence confirmed and mapped to the Generative.fm `waves` source group. |
| `SS_Choirs_Vocals_SFX_Teaser_CC0` | Current SSO chorus adaptation | Local license evidence confirmed and mapped to `sso-chorus-female` and `sso-chorus-male`. |
| `SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0` | Future choir variation candidate | Local license evidence confirmed; held for later variation or custom generator work rather than the first SSO chorus mapping. |
| `Underwater+One+Shots+2` | Future texture/percussion candidate | Useful for aquatic one-shot layers after source and content review. |
| `White+Noise` | Future noise-layer candidate | Useful for custom noise beds and mixable ambience controls. |

The detailed coverage branch handoff lives at [../superpowers/plans/2026-06-18-atmosphere-generative-fm-sample-coverage.md](../superpowers/plans/2026-06-18-atmosphere-generative-fm-sample-coverage.md). The first-batch hosting handoff lives at [../superpowers/plans/2026-06-18-atmosphere-first-batch-hosting.md](../superpowers/plans/2026-06-18-atmosphere-first-batch-hosting.md), the second-batch hosting handoff lives at [../superpowers/plans/2026-06-18-atmosphere-second-batch-hosting.md](../superpowers/plans/2026-06-18-atmosphere-second-batch-hosting.md), and the third-batch listener-copy handoff lives at [../superpowers/plans/2026-06-18-atmosphere-third-batch-listener-copy.md](../superpowers/plans/2026-06-18-atmosphere-third-batch-listener-copy.md).

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

Also on 2026-06-18, the first non-Observable Streams batch was uploaded under `atmosphere/generative-fm/`:

| Piece | Hosted object prefix | Payload |
| --- | --- | --- |
| `aisatsana` | `atmosphere/generative-fm/aisatsana` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `at-sunrise` | `atmosphere/generative-fm/at-sunrise` | 11 VCSL vibraphone source WAVs, 8 rendered vibraphone WAVs, `sample-index.json`, and `manifest.json`. |
| `little-bells` | `atmosphere/generative-fm/little-bells` | 6 VSCO glockenspiel source WAVs, 10 rendered glockenspiel WAVs, `sample-index.json`, and `manifest.json`. |

The upload published 64 objects, approximately 140.6 MB of WAV payload, with no raw audio committed to Git. Verification confirmed each hosted `sample-index.json` returns `200` with JSON content and `Access-Control-Allow-Origin: *`; representative WAV range requests return `206`, `Content-Type: audio/wav`, a valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

These first-batch indexes are intentionally piece-specific. `aisatsana` can use a hosted `vsco2-piano-mf` source index, but that shared source name is not marked globally hosted for every piano-backed package because other packages may request different exact rendered note names.

Later on 2026-06-18, the second piano-source batch was uploaded under `atmosphere/generative-fm/`:

| Piece | Hosted object prefix | Payload |
| --- | --- | --- |
| `day-dream` | `atmosphere/generative-fm/day-dream` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `eno-machine` | `atmosphere/generative-fm/eno-machine` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `impact` | `atmosphere/generative-fm/impact` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `lemniscate` | `atmosphere/generative-fm/lemniscate` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |

The second-batch upload published 100 objects, approximately 344.6 MB of WAV payload, with no raw audio committed to Git. Verification confirmed each hosted `sample-index.json` and `manifest.json` returns `200` with JSON content; representative `vsco2-piano-mf-c-sharp4.wav` range requests return `206`, `Content-Type: audio/wav`, a valid `Content-Range`, and `Access-Control-Allow-Origin: *` when requested with an Origin header.

Later on 2026-06-18, the third piano-source batch was uploaded under `atmosphere/generative-fm/`:

| Piece | Hosted object prefix | Payload |
| --- | --- | --- |
| `pinwheels` | `atmosphere/generative-fm/pinwheels` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `sevenths` | `atmosphere/generative-fm/sevenths` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `uun` | `atmosphere/generative-fm/uun` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |

The third-batch upload published 75 objects, approximately 258.5 MB of WAV payload, with no raw audio committed to Git. Verification confirmed each hosted `sample-index.json` and `manifest.json` returns `200` with JSON content; representative `vsco2-piano-mf-c-sharp4.wav` range requests return `206`, `Content-Type: audio/wav`, a valid `Content-Range`, and `Access-Control-Allow-Origin: *` when requested with an Origin header.

## Generative.fm Adapter Runtime

- `/wellness/atmosphere` exposes the full 57-piece Alex Bainter Generative.fm package catalog through MassageLab's global music provider and persistent mini-player. `/browse` remains available as a compatibility workbench for the same UI.
- The browser-only adapter fetches and validates the hosted sample index for the selected verified station, creates the Generative.fm web library/provider pair, loads the requested package through the aggregate package loader, starts Tone transport, and returns cleanup to the existing runtime controller.
- The station id for Observable Streams remains `observable-streams-probe` for local favorites and recent-station storage stability while the display copy treats it as a playable station.
- The current hosted public-media indexes enable Observable Streams, `aisatsana`, `at-sunrise`, `day-dream`, `eno-machine`, `impact`, `lemniscate`, `little-bells`, `pinwheels`, `sevenths`, and `uun`. The other 46 catalog entries are visible but disabled with listener-facing pending copy while `runtime.missingSampleGroups` keeps exact package-compatible sample-group reasons for operator planning.
- Manifest-level source-group matches such as `vsco2-piano-mf` are not enough to enable a station by themselves. Future enablement should add package-compatible rendered sample groups or otherwise verify note coverage before flipping a station to playable. The hosting registry therefore supports piece-scoped indexes without treating shared source names as global hosted coverage.
- The local audio root currently contains VSCO 2 Community Edition, VCSL, and selected Signature Sounds packs, so later sample-hosting passes can likely unlock more VSCO/VCSL/Signature-backed pieces, but field recordings, guitar, voice, lofi drum, and other third-party sample groups still need separate source and licensing review before hosting.
- Next/Turbopack resolves `tone` to `tone/build/esm/index.js` and maps `regenerator-runtime/runtime.js` to a local no-op shim because the older Generative.fm packages otherwise fail the Next 16 production build before runtime.
- The Observable Streams, At Sunrise, and Little Bells hosted sample indexes include package-compatible rendered instrument keys, so those stations should skip browser-time prerendering on first start. Day/Dream, Eno Machine, Impact, Lemniscate, Pinwheels, Sevenths, and Uun use piece-scoped `vsco2-piano-mf` source indexes directly. Keep browser smoke coverage around first play because these optimizations depend on each package continuing to request the same source or rendered names.

## Attribution Draft

Generative.fm pieces by Alex Bainter. Packages used with permission and MIT package licensing. Playable MassageLab stations use hosted public-media sample indexes, including CC0 VSCO, VCSL, and Signature-compatible adaptations plus VSCO sustained oboe under the Observable Streams `sso-cor-anglais` role.
