# Deployment And Environment

## Core Environment

Use Neon's pooled connection string for runtime Prisma Client connections:

```text
DATABASE_URL=
```

Use Neon's direct connection string for migrations:

```text
DIRECT_URL=
```

`DATABASE_URL_UNPOOLED` can be used as the direct-url fallback when Vercel's Neon integration provides it.

Auth configuration:

```text
AUTH_SECRET=
AUTH_URL=https://massagelab.app
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
TOTP_ENCRYPTION_KEY=
ADMIN_EMAILS=
```

SMTP configuration:

```text
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=MassageLab <no-reply@massagelab.app>
```

## Stripe

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_DONATION_URL=
MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED=true
STRIPE_SUPPORTER_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_YEARLY_PRICE_ID=
STRIPE_THERAPIST_MONTHLY_PRICE_ID=
STRIPE_THERAPIST_YEARLY_PRICE_ID=
STRIPE_PRACTICE_MONTHLY_PRICE_ID=
STRIPE_PRACTICE_YEARLY_PRICE_ID=
```

Free and Student are internal access states. Do not create a Stripe Free product.
Student is not a Stripe-backed subscription tier. If a Student product or price exists in Stripe, archive or disable it and do not place its Price ID in application configuration.

Before enabling subscription checkout, confirm:

- Supporter, Therapist, and Practice each have the intended monthly and yearly recurring Price IDs.
- The Stripe Customer Portal is enabled and configured for subscription management.
- `/api/billing/webhook` is registered with the Stripe webhook signing secret.
- Local and Vercel environments contain the same required Stripe keys and Price IDs for their respective test or live mode.

## Sentry

Sentry captures sanitized errors and traces only.

```text
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
MASSAGELAB_ENABLE_SENTRY_TEST_ROUTE=false
```

Do not enable Session Replay, User Feedback, or Logs until MassageLab has route-by-route privacy review, Sentry project scrubbing rules, and a written policy for clinical/local-first pages.

## Public Media R2

Use separate Cloudflare R2 buckets for media classes:

- `massagelab-anatomy-media`: anatomy image/media workflow.
- `massagelab-private-media`: reserved for private media workflows.
- `massagelab-public-media`: public non-PHI files such as Atmosphere audio samples.

Atmosphere audio samples should target `massagelab-public-media` with an explicit public delivery base URL. The uploader can share R2 access keys and account/endpoint settings with the anatomy uploader, but it uses separate public-media variables so public samples are not accidentally written to the anatomy bucket.

```text
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
MASSAGELAB_PUBLIC_MEDIA_BUCKET=massagelab-public-media
MASSAGELAB_PUBLIC_MEDIA_R2_ENDPOINT=
MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL=https://media.massagelab.app
MASSAGELAB_PUBLIC_MEDIA_OBJECT_PREFIX=atmosphere/observable-streams-vsco-adaptation
MASSAGELAB_PUBLIC_MEDIA_CACHE_CONTROL=public, max-age=31536000, immutable
MASSAGELAB_PUBLIC_MEDIA_METADATA_CACHE_CONTROL=public, max-age=300, must-revalidate
```

The public media bucket is connected to `media.massagelab.app` with minimum TLS 1.2. Its CORS policy is tracked in [../cloudflare/massagelab-public-media-cors.json](../cloudflare/massagelab-public-media-cors.json) and can be applied with:

```bash
wrangler r2 bucket domain add massagelab-public-media --domain media.massagelab.app --zone-id "<massagelab-zone-id>" --min-tls 1.2 --force
wrangler r2 bucket cors set massagelab-public-media --file docs/cloudflare/massagelab-public-media-cors.json --force
```

Readiness and dry-run commands:

```bash
npm run atmosphere:samples:r2:check
npm run atmosphere:samples:r2:upload -- "<audio-sample-root>" --dry-run --public-base-url "<public-media-base-url>"
```

## Production Migrations

Run migrations as a deploy step before serving new code:

```bash
npm run prisma:migrate:deploy
```

Do not run migrations from `next build`.
