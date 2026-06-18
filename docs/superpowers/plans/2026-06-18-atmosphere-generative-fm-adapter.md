# Atmosphere Generative.fm Adapter

**Status:** Complete on `codex/atmosphere-generative-adapter`.

**Goal:** Turn the hosted Observable Streams adaptation from a disabled catalog probe into a playable MassageLab-hosted Generative.fm station while preserving global route-persistent playback and keeping raw audio out of Git.

**Architecture:** Keep `/browse` and the global music provider as the playback owner. Add a browser-only Generative.fm adapter that fetches the hosted `sample-index.json`, validates the required package sample groups, creates the `@generative-music/web-library` and `@generative-music/web-provider` pair, starts `@generative-music/piece-observable-streams`, and returns a cleanup function to the existing runtime controller. Keep the station id stable as `observable-streams-probe` so existing local favorites/recent-station state does not break while the display copy becomes a playable station.

## Scope

- Use `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.json` as the first hosted sample index.
- Preserve the package's `sso-cor-anglais` role while serving the CC0 VSCO sustained-oboe replacement documented in the sample-hosting branch.
- Register a `generative-fm-piece` adapter in `MusicProvider`.
- Keep YouTube/channel radio, user-authored generator controls, custom ambient mixes, account sync, and entitlement gates out of this branch.
- Do not commit raw WAV files.

## Runtime Notes

- `@generative-music/piece-observable-streams` calls `sampleLibrary.request(Tone.context, sampleNames)` where each sample-name group is `[renderedInstrumentName, sourceInstrumentName]`.
- `@generative-music/web-library` accepts a sample index where each instrument maps to either an array of URLs or a note-to-URL object.
- The current MassageLab-hosted sample index uses source keys: `vsco2-piano-mf`, `vsco2-violin-arcvib`, and `sso-cor-anglais`.
- The adapter validates those source keys before importing browser-only runtime modules so failures are clear and do not leave a partial audio graph.
- Next/Turbopack needs `tone` resolved to `tone/build/esm/index.js` and `regenerator-runtime/runtime.js` mapped to the local shim so the older package output can compile in the Next 16 production build.
- First start currently waits for the package's browser prerender step before the shared player reaches `Playing`; the temporary browser smoke completed in about 1.2 minutes. A later performance branch should host prerendered rendered-instrument samples if this needs to feel immediate for room use.

## Validation

- `node --test tests\atmosphere-generative-fm-sample-index.test.mjs tests\atmosphere-stations.test.mjs tests\atmosphere-runtime-controller.test.mjs tests\atmosphere-storage.test.mjs`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere proof station"`
- Temporary local smoke only, not committed: `npm run test:browser -- tests/browser/__tmp-atmosphere-observable-smoke.spec.ts --project=desktop-chromium` confirmed Observable Streams reached `Playing` and stopped cleanly.
