# AtmoShaper production catalog and R2 rollout plan

## Goal

Move the 51 exact concepts approved through the AtmoShaper development review
workflow into the production AtmoShaper sound library. Publish their audio as
immutable, checksum-addressed objects in the existing public non-PHI R2 media
bucket, preserve every reviewed playback policy, and verify the resulting
browser runtime before production deployment.

## Approval and catalog boundary

- The reviewer approved every concept currently represented by the prepared
  handoff on 2026-08-27. This closes the two revised concepts that were still
  awaiting a new decision: Batch 56 at fingerprint
  `d8aca0fa338435811fb7f8aff453307552deb583a892efff57986672506da05d`
  and Batch 61 at fingerprint
  `51f255a2bd993831479c0b8e65caa984ab9b711e22b534a3b4b22a6a0bf3f081`.
- Production input is the resulting 51-concept prepared projection: four
  checksum-bound processed concepts plus 47 passed dynamic concepts.
- Retired batches, rejected variants, Batch 47's source-insufficient hold, and
  the Moodist recording backlog are excluded. The existing native generated
  white, pink, and brown noise remain separate AtmoShaper sources.
- Signature Sounds' site-wide CC0 statement and retained pack-specific evidence
  remain the rights basis recorded in project state and history. Publication
  does not weaken the exact-file checksum, listening, or processing gates.

## Production artifact contract

1. A server-side release builder recomposes and validates the same review
   owners used by the prepared page. It fails closed on stale chat outcomes,
   missing processed manifests, changed local bytes, duplicate group IDs,
   missing source selections, or an unexpected prepared count.
2. Each distinct playable audio payload has one content identity. Source files
   reused by multiple concepts are uploaded once.
3. Browser renditions use the established Atmosphere preference order:
   Ogg Opus, AAC/M4A, MP3, then the original reviewed file as a compatibility
   fallback. Every rendition records its byte length, media type, and SHA-256.
4. Audio object keys are immutable and content-addressed under
   `atmosphere/atmoshaper/v1/audio/<reviewed-payload-sha256>/`. Catalog metadata
   is also checksum-addressed. No audio binary is committed to Git.
5. Audio objects use long-lived immutable cache headers. Catalog metadata is
   checksum-bound as well, so the app may safely commit the validated runtime
   manifest without depending on a mutable remote pointer.
6. The release manifest preserves concept identity, listener-facing label and
   category, exact review fingerprint, playback configuration, runtime policy,
   optional source-selection policy, optional processed playback mode, and
   format alternatives for every source.

## AtmoShaper integration

1. Add a production ambient-catalog validator and a generated committed runtime
   manifest. Invalid or incomplete manifests fail the build instead of silently
   producing unplayable cards.
2. Replace the Ambient sounds placeholder with a searchable, category-grouped
   catalog of the 51 approved concepts. Preview/Add behavior continues through
   the existing AtmoShaper promotion transaction so failed previews never
   become active recipe layers.
3. A concept that requires one source choice, currently recorded White Noise,
   exposes that choice before preview or add and stores the selected source ID
   in the layer settings.
4. Add a production ambient adapter to the shared AtmoShaper master output. It
   reuses the reviewed scheduling semantics for continuous sequences, cadence,
   spaced events, pause-separated sequences, layered concepts, multi-lane
   concepts, fixed/random regions, source trims, gains, and crossfades.
5. Ambient adapters implement the same fade-in, update, pause, resume, retry,
   preview-promotion, and disposal contract as generated and station layers.
   Media elements connect to the private layer gain, not directly to the page
   output, so master and per-layer controls remain authoritative.
6. Current Mix resolves ambient source names from the production catalog and
   keeps the exact source-selection settings stable across recipe edits.

## R2 publication workflow

1. Run the builder in `plan` mode against the exact Signature Samples and
   derived-audio roots. Report concept count, unique payload count, source
   bytes, encoded estimates/results, object keys, and release fingerprint.
2. Render all required browser variants into a task-owned external staging
   directory. Never alter the reviewed source or derived bundles.
3. Re-run validation against staged bytes, then upload only the immutable keys
   in the exact plan to `massagelab-public-media` using the existing R2
   credentials and `https://media.massagelab.app` public base URL.
4. Verify every public object with status, content type, content length, CORS,
   range-read behavior, and a representative decoded browser audition. Publish
   the release metadata only after all audio objects verify.
5. Re-running the same release is idempotent: identical bytes map to identical
   keys, and any conflicting remote length or checksum fails closed.

## Validation and release gates

- Unit tests cover catalog projection, stale approval rejection, source
  deduplication, format selection, R2 plan stability, ambient scheduler output
  routing, source selection, pause/resume/disposal, and library rendering.
- Run `npm run prisma:validate`, `npm run typecheck`, `npm run lint`,
  `npm run test`, `npm run build`, and `git diff --check`.
- Browser QA covers desktop and phone layouts, keyboard operation, visible
  preview/add controls, source selection, multiple ambient layers, master and
  layer volume, pause/resume, failed-media recovery, and a processed loop.
- Inspect the exact branch diff and exclude local audio, credentials, temporary
  renditions, and unrelated worktree changes before commit.
- Push the branch and use the repository's normal review/CI workflow. Production
  is complete only after the R2 release, merged application release, deployed
  runtime, and public playback smoke test all verify.
