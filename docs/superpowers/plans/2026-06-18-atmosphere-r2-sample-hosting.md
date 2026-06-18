# Atmosphere R2 Sample Hosting

**Status:** Complete on `codex/atmosphere-r2-sample-hosting`.

**Goal:** Prepare the first Observable Streams VSCO adaptation for public Cloudflare R2 hosting without committing raw audio to Git or enabling the Generative.fm station before hosted sample verification.

**Architecture:** Keep the existing local scanner and staging plan as the source of truth for sample selection. Add a public-media R2 planning helper that maps the 24 selected CC0 VSCO WAV files to stable R2 object keys, generated sample-index JSON, and a manifest under `massagelab-public-media`. Add a CLI that can check env readiness, dry-run the hosted object layout, and upload only when credentials plus a public base URL are configured.

## Scope

- Use `massagelab-public-media` for public non-PHI Atmosphere audio samples.
- Keep `massagelab-anatomy-media` reserved for anatomy media and `massagelab-private-media` reserved for private media workflows.
- Add explicit `MASSAGELAB_PUBLIC_MEDIA_*` env vars so public audio cannot silently reuse the anatomy bucket or public URL.
- Generate hosted sample URLs for `@generative-music/piece-observable-streams` while preserving the CC0 VSCO oboe replacement under the package's `sso-cor-anglais` role.
- Keep Observable Streams disabled until a later branch uploads/verifies the public sample index and wires the Generative.fm adapter.

## Commands

```powershell
npm run atmosphere:samples:r2:check
npm run atmosphere:samples:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"
```

Actual upload should only run after confirming `MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL` points at the public delivery domain for `massagelab-public-media`.

## Cloudflare Result

- `massagelab-public-media` is connected to `https://media.massagelab.app` with minimum TLS 1.2.
- The public-media CORS policy is tracked at [../../cloudflare/massagelab-public-media-cors.json](../../cloudflare/massagelab-public-media-cors.json).
- On 2026-06-18 the first Observable Streams VSCO adaptation was uploaded: 24 WAV sample objects, `sample-index.json`, and `manifest.json`.
- Public verification returned HTTP 200 for the sample index and a WAV sample with `Access-Control-Allow-Origin: *`; WAV samples use long-lived immutable caching, while generated JSON metadata uses short revalidating cache headers on subsequent uploads.
- Observable Streams remains disabled until the Generative.fm adapter is wired to the hosted index and browser playback is verified.

## Validation

- Focused node tests cover R2 object planning, URL encoding, env readiness, and station catalog metadata.
- Dry-run upload should report 26 total objects: 24 WAV samples, `sample-index.json`, and `manifest.json`.
- No raw WAV files should be committed to the repo.
