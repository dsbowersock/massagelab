# Atmosphere Audio

This page records source, licensing, and runtime findings for the public Atmosphere audio branch series.

## Current Product Boundary

Atmosphere is a public, non-clinical audio workspace. It does not store PHI, therapist professional records, client appointment details, or clinical notes. The public station surface lives under `/music`, the old `/atmosphere` and `/wellness/atmosphere` page URLs are not retained, the breathing pacer lives under `/wellness/breathing`, and `/browse` remains a compatibility grid/workbench for the same station runtime while future experiments are staged.

## Runtime Decision

MassageLab hosts the audio runtime in the app. It does not embed Generative.fm as a remote player UI. `/music` now exposes the local Tone.js proof station plus the full Alex Bainter Generative.fm package catalog through the global music provider, route-persistent playback, grouped station browsing, Atmosphere-only swipe/scroll station rails, deterministic organic-geometric SVG station artwork, and the placement-aware audio toolbar opposite the selected app bar edge. All 57 Generative.fm package stations are currently playable from hosted public-media sample indexes. `/wellness/breathing` carries the first public Calmness-style breathing guide as a separate Wellness tool that does not store account data or clinical records. The hosted Generative.fm runtime prewarms sample-index metadata and browser modules for a small starter set during idle, warms compressed sample payloads only for a tiny starter subset and deliberate hover on healthy connections, and batches provider sample fetch/decode work so large stations do not request every sample in one unbounded burst. Actual Tone start, Transport start, output nodes, and WAV fallback payload loading remain user-gesture gated. The audio toolbar shows loading progress while a station prepares and offers previous/next station controls; supported browsers also receive Media Session metadata and play/pause/stop/previous/next handlers for notification and lock-screen controls. Generative.fm handoffs fade the outgoing station down and fade the incoming station up to soften abrupt first notes. All playable Generative.fm stations have Ogg Opus, AAC/M4A, and MP3 sidecar indexes for broader browser coverage, and keep their original WAV indexes as the final fallback.

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

The 2026-06-19 scan checked the full Alex Bainter package catalog against the local audio root and confirmed the local VSCO, VCSL, and selected Signature Sounds libraries have hostable CC0 evidence:

| Library | Local status | License evidence |
| --- | --- | --- |
| VSCO 2 Community Edition | Present | `VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0/LICENSE` confirms CC0 1.0 Universal. |
| Versilian Community Sample Library | Present | `VCSL-1.2.2-RC/VCSL-1.2.2-RC/README.md` confirms Creative Commons 0/public-domain-style permissions. |
| Signature Sounds Beach Ambience Recordings | Present | `Signature Samples/SS_Beach_Ambience_Recordings_CC0/SS_Beach_Ambience_Recordings_CC0/LICENSE_Beach_Collection_PRO.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds Choirs/Vocals SFX Teaser | Present | `Signature Samples/SS_Choirs_Vocals_SFX_Teaser_CC0/SS_Choirs_Vocals_SFX_Teaser_CC0/LICENSE_Choir_Collection_PRO.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds Serbian Orthodox Choirs | Present | `Signature Samples/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0/LICENSE_Serbian_Choir_PRO_v2.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds site-wide CC0 packs | Present | `https://signaturesounds.org/about-` describes the site as a CC0-licensed sound-pack library. This branch treats that site-wide statement as satisfactory evidence for packs under `Signature Samples`. |

Current catalog matrix:

| Coverage category | Count | Meaning |
| --- | ---: | --- |
| Hosted/playable stations | 57 | Observable Streams plus all 56 Alex Bainter package pieces now have public-media WAV indexes plus Opus, AAC/M4A, and MP3 sidecar indexes with browser-readable CORS. |
| Local CC0 source candidates | 0 | All currently planned package pieces are hosted rather than waiting as local-only candidates. |
| Replacement/source-review pieces | 0 | The remaining-generator rollout mapped the final field, guitar, voice/hum, lofi drum, percussion, pad, and noise groups to VSCO, VCSL, and Signature Sounds replacement sources. |

The configured SSO-role adaptations are `sso-cor-anglais` to CC0 VSCO sustained oboe, `sso-chorus-female` to Signature Sounds children choir ambience, and `sso-chorus-male` to Signature Sounds men-of-choirs WAVs. The `waves` source group maps to Signature Sounds Beach Ambience WAVs. Later rendered uploads should keep the package-facing sample names while serving those replacement sources.

The expanded source-index rollout hosted the previous 25 render/upload candidates: 420hz Gamma Waves for Big Brain, A Viable System, Above the Rain, Agua Ravine, Apoapsis, Beneath Waves, Bhairav, Buttafingers, Documentary Films, Drones, Drones II, Enough, Expand/Collapse, Homage, Nakaii, Oxalis 1, Remembering, Return to Form, Ritual, Soundtrack, Splash, Spring Again, Substrate, Timbral Oscillations, and Yesterday.

The remaining-generator rollout then hosted Animalia Chordata, Awash, Didgeridoobeats, Eyes Closed, Last Transit, Lullaby, Meditation, Moment, Neuroplasticity, Otherness, Peace, Pulse-code Modulation, Skyline, Stratospheric, Stream of Consciousness, Townsend, Western Medicine, and Zed. Their previous missing groups are now covered by package-facing indexes that use VSCO flute/harp/marimba/piano/strings, VCSL ocean drum/didgeridoo, and Signature Sounds underwater, guitar, choir, transit, birds, fireworks, lofi drum, percussion, pad, and white-noise replacements.

Other downloaded Signature Sounds packs are useful future candidates for custom generator tools and for freshening rendered station palettes. The current Generative.fm coverage rules count packs only when they have a direct current sample-group fit or a deliberate replacement mapping.

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
| `Spiritual+Acoustics+CC0+Signaturesounds.org` | Current guitar replacement plus future ambience candidate | Site-wide CC0 evidence accepted; currently maps several guitar-like source groups and remains useful for custom generator layers. |
| `SS_Beach_Ambience_Recordings_CC0` | Current `waves` source candidate | Local license evidence confirmed and mapped to the Generative.fm `waves` source group. |
| `SS_Choirs_Vocals_SFX_Teaser_CC0` | Current SSO chorus adaptation | Local license evidence confirmed and mapped to `sso-chorus-female` and `sso-chorus-male`. |
| `SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0` | Future choir variation candidate | Local license evidence confirmed; held for later variation or custom generator work rather than the first SSO chorus mapping. |
| `Underwater+One+Shots+2` | Current whale-texture replacement plus future texture candidate | Site-wide CC0 evidence accepted; currently maps `whales` for Animalia Chordata. |
| `White+Noise` | Current Zed noise replacement plus future noise-layer candidate | Site-wide CC0 evidence accepted; currently maps `zed__noise`. |

The detailed coverage branch handoff lives at [../superpowers/plans/2026-06-18-atmosphere-generative-fm-sample-coverage.md](../superpowers/plans/2026-06-18-atmosphere-generative-fm-sample-coverage.md). The first-batch hosting handoff lives at [../superpowers/plans/2026-06-18-atmosphere-first-batch-hosting.md](../superpowers/plans/2026-06-18-atmosphere-first-batch-hosting.md), the second-batch hosting handoff lives at [../superpowers/plans/2026-06-18-atmosphere-second-batch-hosting.md](../superpowers/plans/2026-06-18-atmosphere-second-batch-hosting.md), the third-batch listener-copy handoff lives at [../superpowers/plans/2026-06-18-atmosphere-third-batch-listener-copy.md](../superpowers/plans/2026-06-18-atmosphere-third-batch-listener-copy.md), the startup-performance handoff lives at [../superpowers/plans/2026-06-18-atmosphere-startup-performance.md](../superpowers/plans/2026-06-18-atmosphere-startup-performance.md), the web-audio format pilot handoff lives at [../superpowers/plans/2026-06-18-atmosphere-web-audio-format-pilot.md](../superpowers/plans/2026-06-18-atmosphere-web-audio-format-pilot.md), the hosted Opus sidecars handoff lives at [../superpowers/plans/2026-06-18-atmosphere-hosted-opus-sidecars.md](../superpowers/plans/2026-06-18-atmosphere-hosted-opus-sidecars.md), the rendered piano/source-rollout handoff lives at [../superpowers/plans/2026-06-19-atmosphere-rendered-piano-batch.md](../superpowers/plans/2026-06-19-atmosphere-rendered-piano-batch.md), the remaining-generator handoff lives at [../superpowers/plans/2026-06-19-atmosphere-remaining-generators.md](../superpowers/plans/2026-06-19-atmosphere-remaining-generators.md), the AAC/MP3 sidecar handoff lives at [../superpowers/plans/2026-06-19-atmosphere-aac-mp3-sidecars.md](../superpowers/plans/2026-06-19-atmosphere-aac-mp3-sidecars.md), the playback-performance handoff lives at [../superpowers/plans/2026-06-19-atmosphere-playback-performance.md](../superpowers/plans/2026-06-19-atmosphere-playback-performance.md), and the CI build-cache handoff lives at [../superpowers/plans/2026-06-19-ci-build-cache.md](../superpowers/plans/2026-06-19-ci-build-cache.md).

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

Generate and upload compressed sidecars for Observable Streams. Omit `--format` to use the default Opus sidecar, or pass `--format aac` / `--format mp3` for the older-browser fallbacks:

```powershell
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format aac --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format mp3 --public-base-url "https://media.massagelab.app"
```

Generate and upload compressed sidecars for the hosted non-Observable Generative.fm stations. Omit `--piece` to cover all 56 package stations, or pass one or more `--piece <piece-id>` values for a targeted repair:

```powershell
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format aac --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format mp3 --public-base-url "https://media.massagelab.app"
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

Later on 2026-06-18, the web-audio format pilot uploaded Observable Streams Opus sidecar payloads under the existing prefix:

| Format | Object layout | Payload |
| --- | --- | --- |
| Ogg Opus | `atmosphere/observable-streams-vsco-adaptation/web/opus/...` | 54 encoded audio objects plus `sample-index.opus.json` and `manifest.opus.json`. |

The Opus upload published 56 objects, approximately 10.7 MB of encoded audio payload, representing the same 172.1 MB WAV source/rendered plan. Verification confirmed `sample-index.opus.json` returns `200` with JSON content, short metadata caching, and `Access-Control-Allow-Origin: *`; representative rendered Opus range requests return `206`, `Content-Type: audio/ogg; codecs=opus`, a valid `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

Later on 2026-06-18, the hosted Opus sidecars branch uploaded Opus payloads for the ten non-Observable playable stations:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Hosted batch stations | `atmosphere/generative-fm/<piece>/web/opus/...` | 219 encoded audio objects plus 20 `sample-index.opus.json` and `manifest.opus.json` metadata objects. |

The batch Opus upload published 239 objects, approximately 31.3 MB of encoded audio payload, representing the same 743.7 MB WAV source/rendered plans. Verification confirmed all ten hosted batch `sample-index.opus.json` URLs return `200` with JSON content; representative direct-piano, rendered vibraphone, and rendered glock Opus range requests return `206`, `Content-Type: audio/ogg; codecs=opus`, valid `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

On 2026-06-19, the rendered piano batch uploaded package-compatible rendered sample groups for three more Generative.fm stations:

| Piece | Hosted object prefix | WAV payload | Opus sidecar payload |
| --- | --- | --- | --- |
| `no-refrain` | `atmosphere/generative-fm/no-refrain` | 23 VSCO upright piano source WAVs, 12 rendered piano WAVs, `sample-index.json`, and `manifest.json`. | 35 Ogg Opus audio objects, `sample-index.opus.json`, and `manifest.opus.json`. |
| `transmission` | `atmosphere/generative-fm/transmission` | 23 VSCO upright piano source WAVs, 12 rendered piano WAVs, `sample-index.json`, and `manifest.json`. | 35 Ogg Opus audio objects, `sample-index.opus.json`, and `manifest.opus.json`. |
| `trees` | `atmosphere/generative-fm/trees` | 23 VSCO upright piano source WAVs, 13 rendered piano WAVs, `sample-index.json`, and `manifest.json`. | 36 Ogg Opus audio objects, `sample-index.opus.json`, and `manifest.opus.json`. |

The rendered-piano upload published 112 WAV-side objects, representing approximately 360.5 MB of WAV payload, and 112 Opus sidecar objects: 106 encoded audio payloads plus 6 sidecar metadata objects. The encoded Opus payload is approximately 16.9 MB, a 0.0469 compression ratio against the represented WAV payload. Verification confirmed each new `sample-index.json` and `sample-index.opus.json` returns `200` with JSON content, and representative rendered-piano Opus range requests return `206`, `Content-Type: audio/ogg; codecs=opus`, valid `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

Later on 2026-06-19, the expanded source-index rollout uploaded the remaining currently covered local CC0 candidate pieces under `atmosphere/generative-fm/`:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Expanded source-index rollout | `atmosphere/generative-fm/<piece>/samples/...` | 653 source WAV objects plus 50 `sample-index.json` and `manifest.json` metadata objects across 25 pieces. |
| Expanded source-index Opus sidecars | `atmosphere/generative-fm/<piece>/web/opus/...` | 653 encoded audio objects plus 50 `sample-index.opus.json` and `manifest.opus.json` metadata objects across the same 25 pieces. |

The WAV-side upload published 703 objects, representing approximately 2,077.7 MB of WAV payload, and the Opus upload published 703 sidecar objects with approximately 99.9 MB of encoded audio payload, a 0.0481 compression ratio. Verification confirmed all 25 new `sample-index.json`, `manifest.json`, `sample-index.opus.json`, and `manifest.opus.json` URLs return `200` with JSON content and `Access-Control-Allow-Origin: *`; representative beach ambience, darbuka, tenor sax Opus files and a piano WAV fallback returned `206 Partial Content`, correct audio content types, valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

Later on 2026-06-19, the remaining-generator rollout uploaded the final 18 Generative.fm package pieces under `atmosphere/generative-fm/`:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Remaining-generator rollout | `atmosphere/generative-fm/<piece>/samples/...` | 668 source WAV objects plus 36 `sample-index.json` and `manifest.json` metadata objects across 18 pieces. |
| Remaining-generator Opus sidecars | `atmosphere/generative-fm/<piece>/web/opus/...` | 668 encoded audio objects plus 36 `sample-index.opus.json` and `manifest.opus.json` metadata objects across the same 18 pieces. |

The WAV-side upload published 704 objects, representing approximately 1,491.6 MB of WAV payload, and the Opus upload published 704 sidecar objects with approximately 79.5 MB of encoded audio payload. Runtime-validator HTTP checks confirmed all 36 new `sample-index.json` and `sample-index.opus.json` URLs contain the required package groups. Representative Animalia Chordata WAV, Animalia Chordata Opus, Peace Opus, and Zed Opus payloads returned `206 Partial Content`, correct audio content types, valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

Also on 2026-06-19, the AAC/MP3 sidecar rollout expanded compressed fallback coverage to all 57 playable Generative.fm stations:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Observable Streams AAC | `atmosphere/observable-streams-vsco-adaptation/web/aac/...` | 54 AAC/M4A audio objects plus `sample-index.aac.json` and `manifest.aac.json`, representing 172.1 MB WAV as 10.0 MB AAC. |
| Observable Streams MP3 | `atmosphere/observable-streams-vsco-adaptation/web/mp3/...` | 54 MP3 audio objects plus `sample-index.mp3.json` and `manifest.mp3.json`, representing 172.1 MB WAV as 14.0 MB MP3. |
| Package-station AAC | `atmosphere/generative-fm/<piece>/web/aac/...` | 1,646 AAC/M4A audio objects plus 112 `sample-index.aac.json` and `manifest.aac.json` metadata objects across all 56 package stations, representing 4,673.5 MB WAV as 238.0 MB AAC. |
| Package-station MP3 | `atmosphere/generative-fm/<piece>/web/mp3/...` | 1,646 MP3 audio objects plus 112 `sample-index.mp3.json` and `manifest.mp3.json` metadata objects across all 56 package stations, representing 4,673.5 MB WAV as 313.5 MB MP3. |

The combined AAC upload published 1,814 sidecar objects and the combined MP3 upload published 1,814 sidecar objects. HTTP verification confirmed all 57 AAC and all 57 MP3 `sample-index` URLs return JSON with CORS and the required package sample groups. Representative Observable Streams, Peace, and Zed AAC/MP3 payloads returned `206 Partial Content`, `Content-Type: audio/mp4; codecs=mp4a.40.2` or `audio/mpeg`, valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

## Generative.fm Adapter Runtime

- `/music` exposes the full 57-piece Alex Bainter Generative.fm package catalog through MassageLab's global music provider, swipe/scroll category rails, deterministic organic-geometric SVG station artwork, and a persistent placement-aware audio toolbar. `/atmosphere` and `/wellness/atmosphere` are not retained after the navigation move, and `/browse` remains available as a compatibility grid/workbench for the same station runtime.
- The browser-only adapter fetches and validates the hosted sample index for the selected verified station with browser cache-aware semantics, creates the Generative.fm web library/provider pair, loads the requested package through the aggregate package loader, starts Tone transport, and returns cleanup to the existing runtime controller.
- When a station exposes compressed sidecars, the runtime chooses the first browser-supported sample index in this order: Ogg Opus via `audio.canPlayType('audio/ogg; codecs="opus"')`, AAC-LC in M4A/MP4 via `audio.canPlayType('audio/mp4; codecs="mp4a.40.2"')`, MP3 via `audio.canPlayType("audio/mpeg")`, and finally the WAV `hostedSampleIndexUrl`. All currently playable Generative.fm stations now expose Opus, AAC, and MP3 sidecar URLs.
- Startup prewarm validates hosted sample-index metadata and imports shared browser runtime modules for a small starter station set after idle. Station hover/focus and play-button pointer-down remain metadata-only so browsing or tapping the full catalog does not trigger speculative sample-payload fetches that compete with the real playback loader. It intentionally does not start Tone, start Transport, construct output nodes, or download WAV fallback payloads before a user chooses playback.
- Playback dispatches `massagelab:atmosphere-startup-timing` with station, piece, selected sample format, completed metadata-prewarm reuse, retained sample-payload warmup fields, provider request/decode counts, and phase timing details. Runtime progress is also reported to the shared music provider so station cards and the persistent mini-player can show visible preparing feedback. Console logging is opt-in with `localStorage.setItem("massagelab:atmosphere:debug", "1")`.
- Generative.fm output nodes start at silence and ramp to the saved volume over the handoff fade window. Cleanup ramps the outgoing output down before deactivating the package piece; if a newer station claims Tone's shared Transport during that fade, the old cleanup avoids stopping the newer station's Transport.
- The station id for Observable Streams remains `observable-streams-probe` for local favorites and recent-station storage stability while the display copy treats it as a playable station.
- The current hosted public-media indexes enable all 57 Generative.fm pieces: Observable Streams plus all 56 Alex Bainter package pieces through Zed. No Generative.fm catalog entries remain sample-pending.
- Manifest-level source-group matches such as `vsco2-piano-mf` are not enough to enable a station by themselves. Future enablement should add package-compatible rendered sample groups or otherwise verify note coverage before flipping a station to playable. The hosting registry therefore supports piece-scoped indexes without treating shared source names as global hosted coverage.
- The local audio root currently contains VSCO 2 Community Edition, VCSL, and selected Signature Sounds packs. The known covered candidates and deliberate replacement mappings are now hosted. Future work should focus on performance and custom-generator controls rather than basic catalog coverage.
- Next/Turbopack resolves `tone` to `tone/build/esm/index.js` and maps `regenerator-runtime/runtime.js` to a local no-op shim because the older Generative.fm packages otherwise fail the Next 16 production build before runtime.
- Observable Streams, At Sunrise, Little Bells, No Refrain, Transmission, and Trees include package-compatible rendered instrument keys, so those stations should skip browser-time prerendering on first start. The source-index stations use piece-scoped VSCO, VCSL, and Signature Sounds indexes directly. Keep browser smoke coverage around first play because these optimizations depend on each package continuing to request the same source or rendered names.

## CI Build Cache

- GitHub Actions already uses `actions/setup-node` with `cache: npm`, which caches npm package download data but does not persist Next.js build output.
- The CI workflow now restores and saves `${{ github.workspace }}/.next/cache` through a pinned `actions/cache@v4` step so repeated PR runs can reuse Next/Turbopack build artifacts.
- The cache key includes the runner OS, `package-lock.json`, framework config files, Prisma schema files, and app/library source files, with lockfile-scoped restore fallbacks for source-only changes.
- Pull-request CI uses concurrency cancellation so superseded commits do not keep consuming time after a newer commit is pushed to the same PR.
- CI validates and generates Prisma explicitly, then calls `npm run build:next` so the build step does not trigger the local `prebuild` Prisma generation a second time. Local `npm run build` still keeps the normal Prisma prebuild behavior.
- Playwright browser installation remains explicit with `npx playwright install --with-deps chromium`; do not cache browser binaries unless a later timing check proves it is faster than restore plus Linux dependency installation.

## Attribution Draft

Generative.fm pieces by Alex Bainter. Packages used with permission and MIT package licensing. Playable MassageLab stations use hosted public-media sample indexes, including CC0 VSCO, VCSL, and Signature-compatible adaptations plus VSCO sustained oboe under the Observable Streams `sso-cor-anglais` role.
