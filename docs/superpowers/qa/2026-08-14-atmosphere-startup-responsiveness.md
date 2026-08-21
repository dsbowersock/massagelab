# Atmosphere startup responsiveness evidence

Date: 2026-08-14

Branch base measured: `3c653622f54633ee2f08bb31a70a0146cd58cdaf`

Scope: local Chromium automation and deterministic lifecycle regression coverage; no physical-device certification

## Outcome

The accepted Play event calls the silent media carrier in the same initiating event turn, before held runtime or sample preparation resolves. Stop remained authoritative during runtime-module loading, sample-index loading, provider decode, post-decode piece activation, and scheduling. Releasing each controlled late phase did not publish Playing, and any created generator sources were disposed.

No stale publication, delayed carrier claim, or duplicated current-session preparation was reproduced, so this task makes no production runtime or concurrency change. The `moment` station remains dominated by its piece-activation phase even with a fully warm same-context decoded-buffer cache; changing sample concurrency would not address the measured warm path and is not justified by this evidence.

## Local environment

- Windows (`Windows_NT`), Intel64 Family 6 Model 170 Stepping 4.
- Node `v24.15.0`, npm `11.12.1`.
- Next.js `16.2.12`, Tone `14.9.17`.
- Playwright `1.60.0`, bundled Chromium revision `1223`.
- Playwright `desktop-chromium` against the repository browser-QA server at `http://localhost:3010`.
- Station modules, hosted Opus sample indexes, hosted Opus sample payloads, bounded provider behavior, Tone graph construction, station activation, and scheduling were the real application paths. No artificial delay was used for the timing runs.
- Media Session, Audio Session, and the silent carrier element were deterministic browser fakes. Native Chromium Web Audio remained in use and was instrumented only for lifecycle/source counts.

## Method

Each of the three stations ran three times with one Playwright worker. Every repetition used a fresh browser context for the first measurement, then stopped the station and replayed it in that same context for the warm measurement. The production carousel's normal preparation behavior was retained; consequently all measured Play calls reported completed metadata prewarm reuse. Observable Streams also reported its production 24-payload prewarm.

The table reports medians, with the observed minimum-maximum range in brackets. Durations are milliseconds from the existing `massagelab:atmosphere-startup-timing` event. `Tone` is the emitted `toneStartMs` phase value; it resolved at the event's timer precision in these runs. Provider columns are `requestCount / batchCount / memoryHitUrlCount`. Browser request columns are station-scoped request events observed for `sample-index*.json / sample payloads`; they are browser request events, not a claim about physical wire transfers after browser caching or redirects.

| Station | Context | Carrier | Prepare | Tone | Piece activation | Schedule | Total | Format | Provider requests/batches/hits | Browser index/sample requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Observable Streams | Fresh-context cold | 0.8 [0.7-1.5] | 5.4 [5.4-6.4] | 0.0 [0.0-0.0] | 1086.7 [1068.0-1150.0] | 14.2 [13.1-14.9] | 1106.3 [1086.5-1171.3] | Opus | 1 / 3 / 0 | 1 / 54 |
| Observable Streams | Same-context warm | 0.2 [0.1-0.3] | 4.5 [3.9-4.9] | 0.0 [0.0-0.0] | 7.8 [7.1-8.0] | 7.3 [7.1-8.2] | 19.6 [18.3-20.9] | Opus | 1 / 0 / 30 | 0 / 0 |
| Little Bells | Fresh-context cold | 0.8 [0.7-0.9] | 4.0 [4.0-5.6] | 0.0 [0.0-0.0] | 286.2 [232.1-320.1] | 5.4 [4.9-6.4] | 295.6 [244.1-329.0] | Opus | 1 / 1 / 0 | 1 / 13 |
| Little Bells | Same-context warm | 0.1 [0.1-0.2] | 3.6 [2.3-6.3] | 0.0 [0.0-0.0] | 5.1 [3.4-7.9] | 4.5 [2.4-5.7] | 14.4 [8.1-18.7] | Opus | 1 / 0 / 10 | 0 / 0 |
| Moment | Fresh-context cold | 0.6 [0.6-0.9] | 5.1 [3.6-6.8] | 0.0 [0.0-0.0] | 14416.4 [13861.4-15758.7] | 1.6 [1.0-1.9] | 14424.2 [13868.4-15763.9] | Opus | 1 / 2 / 0 | 1 / 26 |
| Moment | Same-context warm | 0.2 [0.1-0.3] | 2.5 [2.3-4.7] | 0.0 [0.0-0.0] | 15383.6 [15097.4-15401.1] | 0.4 [0.4-0.6] | 15386.3 [15100.5-15406.2] | Opus | 1 / 0 / 23 | 0 / 0 |

## Causal lifecycle controls

The timing cases above used real local and hosted inputs. The cancellation matrix was separate and deterministic so it could prove ordering rather than depend on network speed:

- Runtime-module loading: the browser harness delayed the first dynamically inserted Next.js chunk script, then released it after Media Session Stop.
- Sample-index loading: the Observable Streams hosted sample-index route was held while the test proved Loading and the same-turn carrier call, then released after Stop.
- Provider decode: native Chromium `decodeAudioData()` completed its real decode but the returned promise was held until after Stop.
- Piece activation: after provider decode completed, the next real graph-activation boundary synchronously invoked Media Session Stop while activation continued toward a stale result.
- Scheduling: the production startup-timing dispatch synchronously invoked Media Session Stop after scheduling completed but before the adapter result could publish active state.

For every case, a MutationObserver-backed playback-state history excluded a transient late `playing` publication. Source instrumentation verified zero live generator sources after late settlement and verified teardown when a source had been created.

## Interpretation and limits

- Carrier latency is the interval from the captured in-app Play click to the provider's `HTMLAudioElement.play()` boundary. It proves initiating-turn ownership ordering, not Android notification-drawer latency or hardware audio-focus acquisition.
- Fresh browser context means fresh app storage and decoded-memory state for each repetition. It does not prove an uncached public internet route outside this local runner.
- The request event counts include production prewarm and browser request semantics. Provider telemetry is authoritative for batching and decoded-memory hits.
- Warm Observable Streams and Little Bells eliminate provider batches and move every requested URL to decoded-memory hits. Moment does the same but remains roughly 14-15 seconds in piece activation. The evidence supports a station-specific follow-up investigation, not a broad sample-concurrency change.
- These measurements do not certify Android notifications, lock-screen controls, calls/meeting interruptions, Safari, iPhone, iPad, or background playback. Physical Android acceptance remains required by the branch plan, and Apple hardware acceptance remains pending.

## Reproduction

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "immediate carrier|latest request|startup timing"
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "startup timing" --repeat-each=3 --workers=1
node --test tests/atmosphere-runtime-controller.test.mjs tests/atmosphere-generative-fm-piece-loader.test.mjs
```

Measurement records are emitted as one `ATMOSPHERE_STARTUP_MEASUREMENT` JSON line per station/repetition so future runs can compare the same fields without scraping UI text.
