# Chimer background preview media generation workflow

## Goal
Create lightweight visual preview media for each background entry so Backgrounds cards can show animated previews without running every heavy background renderer in the Chimer setup screens.

## Desired output
- Prefer short loop media (GIF/MP4/WEBM) for each background entry.
- Keep files small enough to support treatment-room displays:
  - target: ≤1.6 MB each for default assets
  - target: ≤0.8s seek latency on mobile LTE
- Keep source behavior unchanged; preview media is display-only and non-interactive.

## Tooling priority
1. Remotion (preferred)
   - Best for React-based backgrounds and deterministic scene rendering.
2. Puppeteer/Playwright screenshots (fallback)
   - Works for non-Remotion backgrounds and third-party canvases.

## Implemented workflow
- `npm run chimer:preview:render` renders enabled Chimer backgrounds through the internal `/chimer/background-preview/[backgroundId]` route.
- The current implementation uses Playwright video capture plus FFmpeg compression, without adding Remotion.
- Generated assets are written locally to `public/chimer/background-previews/*.webm` and ignored by Git.
- `public/chimer/background-previews/index.json` stores generated metadata, hashes, and byte sizes for upload verification.
- `components/backgrounds/backgroundPreviewManifest.ts` wires generated preview URLs into the background registry and resolves production media to `https://media.massagelab.app/chimer/background-previews` unless `NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL` overrides it.
- `npm run chimer:preview:r2:upload -- --dry-run --public-base-url https://media.massagelab.app` previews the public-media R2 upload layout.
- The generated batch covers 81 enabled Chimer backgrounds with three WebM variants per background:
  - landscape: 384x216
  - square: 384x384
  - vertical: 216x384
- Each preview is a 6 second loop at 12 fps. The full generated set is 243 WebM files and roughly 6.7 MB total.
- The preview route enters `chimer-preview-capture` mode to hide app navigation, audio toolbar chrome, and the Next dev indicator before recording.

## Recommended repository structure
- `scripts/chimer-preview-generation/` (CLI runner entrypoint)
- local generated files under `public/chimer/background-previews/` for review and upload staging
- public bucket objects under `chimer/background-previews/<background-id>.webm` for landscape runtime use
- public bucket objects under `chimer/background-previews/<background-id>-square.webm` for square cards
- public bucket objects under `chimer/background-previews/<background-id>-vertical.webm` for vertical cards or phone-oriented previews
- `chimer/background-previews/index.json` optional public registry for generated checksums

## Prescribed workflow
1. Discover active background IDs from existing background registry.
2. For each eligible background ID, render deterministic clip segments for the needed aspect ratios:
   - duration: 6 seconds
   - loop-safe start/end
   - fixed viewports matching Backgrounds card ratios
3. Convert and export media in `webm` (or `mp4` fallback for older clients).
4. Post-process:
   - trim to loop edge
   - reduce resolution to card size
   - cap bitrate at a treatment-friendly target
5. Emit a manifest row per background with:
   - id
   - source type
   - default preview path
   - aspect-ratio variants
   - generated hash/date
6. In UI:
   - lazy-load preview when card becomes visible
   - pause offscreen playback
   - swap to live renderer only after user selects background

## Remotion path
- Add a small scene wrapper that mounts the existing background component with shared props:
  - `movingBackgroundEnabled = true`
  - palette + timing props from a fixture/fixture slice
- Render with strict fps and timeout boundaries to avoid runaway sessions.
- Export via `npx remotion render` (or equivalent repo script) in batch mode.

## Puppeteer fallback path
- Spin up the app at a preview route that only hosts one target background.
- Force animation deterministic inputs and fixed container size.
- Capture a short animated media segment:
  - video capture for `webm`
  - image sequence + ffmpeg stitch where needed

## Minimal CLI task set
- `npm run chimer:preview:render` (Playwright + FFmpeg fallback path currently implemented)
- `npm run chimer:preview:manifest` (writes manifest + file hashes)
- `npm run chimer:preview:r2:check` (validates local preview media and R2 configuration)
- `npm run chimer:preview:r2:upload -- --dry-run --public-base-url https://media.massagelab.app` (reviews upload plan)
- `npm run chimer:preview:r2:upload -- --public-base-url https://media.massagelab.app` (uploads generated local files to the public media bucket)

## Safety and maintainability notes
- Skip generation for backgrounds with unresolved entitlement or disabled source imports.
- Never run generation during normal app startup.
- Keep fallback path to avoid blocking preview UX if one source fails.
- Keep generated asset metadata in git only if stable; keep binary preview media out of Git and publish it to the public non-PHI media bucket.
