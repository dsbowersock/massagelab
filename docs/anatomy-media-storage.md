# Anatomy Media Storage

MassageLab stores anatomy media files in Cloudflare R2 and stores the media catalog, provenance, license review, entity links, and R2 object keys in Postgres.

## Why R2

- R2 gives us S3-compatible object storage without putting binary media in Git or Neon.
- Buckets are private by default, which lets us review files before making them available.
- Production public access should use a Cloudflare custom domain. The temporary `r2.dev` domain is useful for preview/testing, but it is not the production plan.

## Environment

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
MASSAGELAB_R2_BUCKET=massagelab-anatomy-media
MASSAGELAB_R2_ENDPOINT=
MASSAGELAB_R2_PUBLIC_BASE_URL=
MASSAGELAB_R2_CACHE_CONTROL="public, max-age=31536000, immutable"
```

Use `CLOUDFLARE_API_TOKEN` for bucket setup. Use `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` for object uploads.

`MASSAGELAB_R2_PUBLIC_BASE_URL` should be a custom domain such as `https://anatomy-media.massagelab.app` once that domain is configured. If it is blank, uploads still store `storagePath` in the database, but `remoteUrl` remains unset.

## Commands

```bash
npm run anatomy:media:check
npm run anatomy:media:setup-bucket
npm run anatomy:seed
npm run anatomy:media:upload
```

Run `anatomy:seed` before `anatomy:media:upload` so the media asset rows exist in Postgres.

## Starter Assets

The first reviewed upload set is intentionally small:

- `bodyparts3d-brain-anatomogram`
- `bodyparts3d-heart-anatomogram`
- `bodyparts3d-eye-anatomogram`

These are BodyParts3D/Anatomography image API outputs with CC BY 4.0 license metadata, attribution, source URLs, and media-license citations stored in the seed.

## Policy

- Do not store anatomy binaries in Git.
- Do not store anatomy binaries in Neon/Postgres.
- Only upload media with explicit license, license URL, attribution, source URL, review status, and entity links.
- Wikimedia remains per-file only. CC0, public domain, and CC BY can be reviewed for product use. NC, ND, SA, and unclear-license media stay review-only unless explicitly approved.
