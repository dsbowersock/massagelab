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

Production startup validates that a Neon runtime `DATABASE_URL` uses the pooled `-pooler` host. If the app needs a direct Neon URL for migrations, `pg_dump`, Prisma Studio, or bounded maintenance scripts, keep that URL in `DIRECT_URL` or another script-only variable and do not use it as the runtime `DATABASE_URL`.

For public-alpha sharing windows:

- Monitor Neon transfer, compute, and connection graphs before and after the share.
- Avoid running Prisma Studio, seed scripts, full-table exports, or anatomy/media maintenance scripts against production unless there is a specific need.
- Keep runtime traffic on the pooled connection string. Neon documents pooled connections as the fit for serverless/web clients, and direct connections as the fit for migrations, exports, logical replication, and other session-level/admin work.
- Treat a temporary plan upgrade as quota headroom, not a reason to browse or export large production tables.

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

## SEO And Indexing

The app generates public SEO metadata, `robots.txt`, and `sitemap.xml` from `lib/seo.js`.

- Production deployments are allowed to index public marketing, education, tool, wellness, legal, and trust pages.
- Vercel preview deployments and local development return noindex metadata and disallow all crawling in `robots.txt`.
- APIs, auth flows, account/admin surfaces, public booking links, shared Anatomime game-code URLs, and local professional-record subroutes stay out of the sitemap and are disallowed by `robots.txt`.
- The canonical SEO host is `https://www.massagelab.app`, matching the production redirect target recorded in the launch audit.

## Stripe

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_DONATION_URL=
STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_1_YEARLY_PRICE_ID=
STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_2_YEARLY_PRICE_ID=
STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_5_YEARLY_PRICE_ID=
STRIPE_SUPPORTER_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_YEARLY_PRICE_ID=
STRIPE_THERAPIST_MONTHLY_PRICE_ID=
STRIPE_THERAPIST_YEARLY_PRICE_ID=
STRIPE_PRACTICE_MONTHLY_PRICE_ID=
STRIPE_PRACTICE_YEARLY_PRICE_ID=
```

Free and Student are internal access states. Do not create a Stripe Free product.
Student is not a Stripe-backed subscription tier. If a Student product or price exists in Stripe, archive or disable it and do not place its Price ID in application configuration.

Legacy runtime Price mappings remain webhook-only compatibility inputs and cannot satisfy public catalog readiness.
Keep them configured until the database and Stripe subscriber inventories prove
no historical subscription remains and signed webhook reconciliation is final.
`stripe:readiness` validates only the six amount-specific Supporter IDs for new
public enrollment.

Before enabling subscription checkout, confirm:

- `MassageLab Supporter Membership` is the only public membership Product and has tax code `txcd_10000000`.
- Its six exclusive USD recurring Prices are exactly $1, $2, or $5 monthly and
  $10, $20, or $50 yearly, with `interval_count=1`, no trial, licensed usage,
  per-unit billing, no quantity transform, and no additional currencies.
- Repeated or concurrent enrollment requests reuse only an exact
  `supporter_membership_v1_checkout_v1` Session whose current configured Price,
  classified Product, Automatic Tax, and billing-address contract verify.
  Recognized incompatible historical open Sessions must be confirmed expired;
  completed historical Sessions with a relevant subscription still block with
  billing-management guidance until webhook persistence catches up.
- The Stripe Customer Portal permits subscription Price changes only among those six Prices while preserving cancellation, payment-method updates, billing address/name/email updates, and invoice history.
- `/api/billing/webhook` is registered with the Stripe webhook signing secret.
- Local and Vercel environments contain the same required Stripe keys and Price IDs for their respective test or live mode.
- Production uses a live `STRIPE_SECRET_KEY`, a live webhook signing secret, and live recurring Price IDs. Test-mode keys or empty production Price IDs are launch blockers.
- Run `npm run stripe:readiness -- --env-file=/secure/path/massagelab-production.env --live --verify-stripe` with production env values before public paid signup.

### Supporter catalog migration

The catalog migration is a separately controlled operation. It does not read a
database or print customer, subscriber, secret, or payment details. Supply every
legacy Product, Price, coupon, portal-configuration, and allowed test-subscription
ID through the `MASSAGELAB_STRIPE_MIGRATION_*` variables documented in
`.env.example`. Set `MASSAGELAB_STRIPE_MIGRATION_MODE` to `test` or `live`; the
command refuses a mismatch with both the secret-key prefix and Stripe account
mode. Use the exact existing Supporter Product ID when it should be renamed and
reused. `CREATE_NEW` is an explicit exceptional authorization and is rejected if
a managed target Product already exists. Use `none` for the allowed subscription
only after a complete inventory proves no active, trialing, past-due, unpaid,
paused, or canceling subscription exists.

Run verification first:

```bash
npm run stripe:migrate-supporter-membership -- --mode=verify
```

Verify mode performs Stripe GET/list requests only. It checks the exact
subscriber inventory, live/test mode, legacy and approved Price
ownership/amounts/recurring semantics, every Price listed under the managed
Products, zero-redemption coupon contracts, and portal preservation settings.
Reuse mode accepts only the validated normal legacy `MassageLab Supporter`
Product before migration even though it has not yet received
`txcd_10000000` or target catalog metadata; apply writes both and re-retrieves
the Product. Therapist and Practice retirement also requires the exact legacy
Product names, and any optional app or membership-level metadata must not
contradict the expected MassageLab identity. Completed-state verification
requires the exact classification and metadata. Approved Prices must have no default trial period. Verify reports
either `PRE_MIGRATION` or `COMPLETED`; mixed states, unrecognized Prices,
incomplete or malformed pagination, and unknown portal subsets are blockers.

Only after reviewing the safe PASS checklist, run:

```bash
npm run stripe:migrate-supporter-membership -- --mode=apply
npm run stripe:migrate-supporter-membership -- --mode=verify
```

Apply creates or reuses the one managed Supporter Product and six Prices,
restricts the portal to those Prices, retires the legacy $9/$90, $29/$279, and
$79/$759 Prices, retires the Therapist and Practice Products, and deletes the
two verified zero-redemption coupons. It re-retrieves every mutation and a
second apply is a read-only no-op. Portal quantity adjustment is explicitly
disabled, while cancellation and billing-management behavior is preserved
through semantic response validation. Apply can resume only an ordered,
individually verified forward transition caused by an accepted Stripe mutation;
Product and Price creates use deterministic Stripe idempotency keys so an
ambiguous accepted request can be retried without creating a duplicate.
Arbitrary mixed states still fail closed. Do not run apply until the deployed
Supporter-only application, subscriber decision, recurring-tax classification,
and migration inputs have all been independently reviewed. Remove the
migration-only variables after the operation. Keep the six approved runtime
Price IDs for public enrollment and retain the six legacy runtime Price
mappings under the separate subscriber-inventory/webhook-reconciliation gate.

## Sentry

Sentry captures sanitized errors, traces, and privacy-safe diagnostic reports only.

```text
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
MASSAGELAB_ENABLE_SENTRY_TEST_ROUTE=false
```

Production Sentry setup should keep alerting focused on:

- New production issues.
- Production regressions.
- Error or failure-rate spikes on important product routes.
- Release/deploy issues once source-map uploads and releases are configured.

`/api/support/problem-report` is the approved user-initiated diagnostic path. It sends only known issue categories, coarse product areas, safe route buckets, browser family, display mode, network state, viewport bucket, and an optional linked Sentry event id. It must not send screenshots, typed support messages, full URLs, query strings, local vault contents, SOAP text, intake answers, journal text, ROM notes, wellness entries, account contact details, or user-provided freeform descriptions.

Do not enable Session Replay, the standard Sentry User Feedback widget, screenshots, attachment uploads, or Logs until MassageLab has route-by-route privacy review, Sentry project scrubbing rules, and a written policy for clinical/local-first pages.

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
