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
AUTH_URL=https://<verified-production-auth-host>
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
TOTP_ENCRYPTION_KEY=
ADMIN_EMAILS=
```

The concrete Production `AUTH_URL` host is intentionally not fixed in this repository example. Set it only after the external callback/origin readback below proves the exact canonical Production auth host.

SMTP configuration:

```text
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=MassageLab <no-reply@massagelab.app>
```

## Identity, Membership Schema, And Writer Rollout

Do not print auth, database, OAuth, SMTP, target, or fingerprint configuration values in release evidence. The combined rollout is expand, pause/cut over, drain, unpause, and only then clean up:

1. Run `npm run auth:check-normalized-emails` against the separately selected direct, non-pooler maintenance target. The command is read-only and may report only `normalized_collision_count=<number>`. Stop unless the count is zero; resolve collisions through a separately reviewed account-recovery process before applying or deploying identity code.
2. Apply `20260828120000_identity_method_safety`, then the dedicated one-statement `20260828121000_identity_normalized_email_index`, then `20260828130000_membership_subscription_convergence` before deploying any new runtime. The first expansion creates `AuthRateLimitBucket`, `AuthMethodIntent`, and `AccountSecurityEmailIntent`, adds their supporting enums/indexes, and expands the shared `AuthAttemptPurpose` enum with `GOOGLE_INTENT` for forward/rollback compatibility. The second migration contains only PostgreSQL `CREATE UNIQUE INDEX CONCURRENTLY` for `User_normalized_email_key`, which keeps ordinary User reads/writes available and avoids Prisma 7's multi-statement execution boundary for nontransactional DDL. The zero-collision preflight is mandatory but does not replace migration monitoring. If the concurrent build fails, stop the migration and runtime rollout; do not deploy, mark the migration applied, or assume the index exists. A failed concurrent build can leave an invalid index. Inspect only count/status catalog evidence, then use a separately reviewed recovery to resolve collisions, remove the invalid index, recreate and verify the concurrent index, and reconcile Prisma's failed-migration record only after every expansion object is proven correct. The third migration adds only the membership receipt owner and nullable ordering/authoritative watermarks without rewriting existing membership rows. Verify all three reviewed migrations current with no extras or failure. The `AuthAttempt` table's columns, indexes, and data remain untouched. This work did not apply any of the three migrations to a database.
3. Perform exactly two runtime deployments. First deploy the exact bridge-capable combined runtime with `MASSAGELAB_MEMBERSHIP_WEBHOOK_WRITES_PAUSED` exactly `1`. Prove the Production alias serves its exact SHA, read the current configured maximum invocation lifetime, wait at least that long after alias cutover, and prove no pre-bridge SHA is receiving or executing webhook requests. Every new identity caller uses `AuthRateLimitBucket` with no dual-write/fallback, while signed membership deliveries return private retryable `503` before membership provider/database/cache work. Stripe retries those deliveries and access may remain in processing guidance; do not manually replay or acknowledge them. Old pre-bridge instances may still write raw `AuthAttempt.key` only until the drain proof closes. After that proof, deploy the same bridge-capable runtime again with the flag absent or exactly `0`; verify held deliveries reach `2xx`, their receipts become terminal, and persisted access converges. Rollback after bridge cutover is permitted only to a bridge-capable deployment with exact flag `1`, never to the pre-bridge legacy writer. Keep the additive schema with no destructive migration rollback. Retain the bridge through held-delivery/backlog proof and the rollout window; removing it is a separately reviewed retirement.
4. Keep `AuthAttempt` through the bridge-capable rollback window. Read-only target fingerprinting with `npm run auth:cleanup-legacy-attempts -- --print-fingerprint` and any cleanup are later release actions, not part of deployment. After cutover/drain evidence, separately authorize the exact production fingerprint and bounded mutation scope before each approved invocation of `npm run auth:cleanup-legacy-attempts -- --expected-fingerprint=<64 lowercase hex> --max-rows=<1..100>`. Record only `legacy_auth_attempt_rows_deleted=<number>`; never record target values, row identifiers, raw keys, email addresses, or network identifiers. No cleanup or future table-drop contract migration occurred in Task 7. Dropping `AuthAttempt` requires its own reviewed migration and authorization after rollback is retired.

The active limiter uses one 15-minute window and persists only a domain-separated HMAC-SHA-256 `keyHash`, purpose, scope, counts, times, and block state. Thresholds are `REGISTER` 5/account and 12/network, `PASSWORD_RESET` 5/account and 20/network, `LOGIN` 8/account and 30/network, `TWO_FACTOR` 8/account and 30/network, and `GOOGLE_INTENT` 30/network. Successful credential proof clears only that account's `LOGIN` and `TWO_FACTOR` buckets, not the network buckets. Best-effort stale cleanup is sampled once per 64 limiter operations, selects at most 100 buckets inactive for 24 hours, and repeats the inactive/non-blocked predicates when deleting so a bucket reactivated after selection survives; it never changes the already-committed limiter decision.

Every MassageLab-owned Google entry point must first consume the `GOOGLE_INTENT` network quota, create a 10-minute `AuthMethodIntent`, and bind it to the initiating browser through the `ml-auth-method-binding` HttpOnly, SameSite=Lax cookie (Secure in Production). Only the cookie contains the opaque intent id plus binding token; persistence contains the binding hash. Intent ids, binding tokens, provider ids, provider email hashes, and OAuth tokens must not appear in URLs, local/session storage, client-rendered data, logs, or release evidence. `allowDangerousEmailAccountLinking` must remain absent. A matching Google email may link to an existing password account only after provider proof and an explicit fresh Credentials confirmation; signed-in cross-account proof and provider collisions fail closed, and removing a method must leave another sign-in credential.

Before publishing or changing the Google OAuth application, reconcile one exact Production host across `AUTH_URL`, the canonical Vercel alias/redirect behavior, the Google authorized JavaScript origin, and the corresponding Auth.js `/api/auth/callback/google` redirect URI. Do not assume the apex and `www` hosts are interchangeable. Read back the saved consent-screen publishing status, authorized origin, redirect URI, support/contact fields, required scopes, and intended real-account/test-user access before a separately authorized real Google flow. Provider-setting changes and real-account proof are separate gates; Task 7 performed neither.

Before Production security mail, verify the configured sender identity without exposing its values: SMTP authentication/transport, the visible From domain, SPF authorization for the sending provider, DKIM signing and alignment, DMARC alignment/policy, and the provider's bounce/complaint or suppression handling. Complete a separately authorized production delivery and controlled bounce test, then review only count/status/kind/allowlisted failure-code/age summaries. Account-security notices are durable and at-least-once: a five-minute claim lease can be retried after ambiguous provider acceptance, so duplicate notices are possible and the fixed copy says so. Never mark an ambiguous attempt delivered, expose recipient/copy/provider diagnostics, or retry by creating a second intent.

Operational retry is a separate release action, never an implicit application queue. First authorize the exact direct non-pooler database target and run only `npm run auth:retry-security-notices -- --print-fingerprint`; this read-only mode does not connect and may print only the 64-lowercase-hex target fingerprint. A sending run additionally requires separate database-access and SMTP/send authorization, the exact approved fingerprint, and one bounded `--max-rows=1..100` scope. Only then set the exact `AUTH_SECURITY_NOTICE_RETRY_DATABASE=1` and `AUTH_SECURITY_NOTICE_RETRY_SEND=1` gates and invoke `npm run auth:retry-security-notices -- --expected-fingerprint=<64 lowercase hex> --max-rows=<1..100>`. The command scans only bounded `PENDING`, `FAILED`, and expired `PROCESSING` rows and delegates each to the existing claim/lease/CAS delivery owner. Evidence may contain only its selected/delivered/failed/ambiguous/busy counts; never record URLs, recipients, copy, row or claim ids, or provider diagnostics. Creating this command sent no SMTP or provider mail and authorized no live run.

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
# Public enrollment Price IDs:
STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_1_YEARLY_PRICE_ID=
STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_2_YEARLY_PRICE_ID=
STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_5_YEARLY_PRICE_ID=
# Legacy webhook reconciliation-only Price mappings:
STRIPE_SUPPORTER_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_YEARLY_PRICE_ID=
STRIPE_THERAPIST_MONTHLY_PRICE_ID=
STRIPE_THERAPIST_YEARLY_PRICE_ID=
STRIPE_PRACTICE_MONTHLY_PRICE_ID=
STRIPE_PRACTICE_YEARLY_PRICE_ID=
# Independent one-time-support Automatic Tax gates:
STRIPE_ONE_TIME_SUPPORT_AUTOMATIC_TAX_ENABLED=false
STRIPE_ONE_TIME_SUPPORT_TAX_PRODUCT_CODE=
STRIPE_ONE_TIME_SUPPORT_TAX_PROVIDER_READY=false
STRIPE_ONE_TIME_SUPPORT_TAX_REGISTRATIONS_READY=false
STRIPE_ONE_TIME_SUPPORT_TAX_CLASSIFICATION_CONFIRMED=false
```

Free and Student are internal access states. Do not create a Stripe Free product.
Student is not a Stripe-backed subscription tier. If a Student product or price exists in Stripe, archive or disable it and do not place its Price ID in application configuration.

Legacy runtime Price mappings remain webhook-only compatibility inputs and cannot satisfy public catalog readiness.
Keep them configured until the database and Stripe subscriber inventories prove
no historical subscription remains and signed webhook reconciliation is final.
`stripe:readiness` validates only the six amount-specific Supporter IDs for new
public enrollment.

Before enabling subscription checkout, confirm:

- `MassageLab Supporter Membership` is the only user-facing membership. Stripe
  represents it as three amount-specific Products, each with tax code
  `txcd_10000000`, identical Supporter entitlement metadata, and one monthly
  plus one annual Price.
- The six exclusive USD recurring Prices are exactly $1, $2, or $5 monthly and
  $10, $20, or $50 yearly, with `interval_count=1`, no trial, licensed usage,
  per-unit billing, no quantity transform, and no additional currencies.
- Repeated or concurrent enrollment requests reuse only an exact
  `supporter_membership_v1_checkout_v1` Session whose current configured Price,
  classified Product, Automatic Tax, and billing-address contract verify.
  Recognized incompatible historical open Sessions must be confirmed expired;
  completed historical Sessions with a relevant subscription still block with
  billing-management guidance until webhook persistence catches up.
- The Stripe Customer Portal permits subscription Price changes only among
  those six Prices while preserving cancellation, payment-method updates,
  billing address/name/email updates, and invoice history. Cross-Product amount
  changes keep the billing-cycle anchor unchanged, create no proration, and are
  not scheduled for period end.
- `/api/billing/webhook` is registered with the Stripe webhook signing secret.
- Local and Vercel environments contain the same required Stripe keys and Price IDs for their respective test or live mode.
- Production uses a live `STRIPE_SECRET_KEY`, a live webhook signing secret, and live recurring Price IDs. Test-mode keys or empty production Price IDs are launch blockers.
- Run `npm run stripe:readiness -- --env-file=/secure/path/massagelab-production.env --live --verify-stripe` with production env values before public paid signup.
- Keep one-time support fail-closed until its five independent gates are
  explicit, including exact code `txcd_90000001`. After deployment, complete a
  separately authorized live Checkout and verify its Session/line-item tax
  evidence, `/pricing` return, and absence of any membership or background
  entitlement.

### Supporter catalog migration

The catalog migration is a separately controlled operation. It does not read a
database or print customer, subscriber, secret, or payment details. Supply every
legacy Product, Price, coupon, portal-configuration, and allowed test-subscription
ID through the `MASSAGELAB_STRIPE_MIGRATION_*` variables documented in
`.env.example`. Set `MASSAGELAB_STRIPE_MIGRATION_MODE` to `test` or `live`; the
command refuses a mismatch with both the secret-key prefix and Stripe account
mode. Use the exact existing Supporter Product ID for the $1/$10 amount when it
should be renamed and reused. Configure the $2/$20 and $5/$50 Product slots
separately. `CREATE_NEW` is explicit authorization for that amount slot; a
managed Product is reused only when its amount-choice metadata and complete
Product contract match. Duplicate, unassigned, partially managed, or
misidentified candidates are rejected; normal legacy $1/$10 Product reuse
still requires its exact Product ID instead. Test mode accepts the exact
reviewed test-subscription ID only when it is the sole retained relevant
subscription; `none` is allowed only after a complete inventory proves no
active, trialing, past-due, unpaid, paused, incomplete, or canceling
subscription exists. Live mode rejects every concrete subscription ID and
requires `none` after the same empty-inventory proof.

Run verification first:

```bash
npm run stripe:migrate-supporter-membership -- --mode=verify
```

Verify mode performs Stripe GET/list requests only. It checks the exact
subscriber inventory, live/test mode, legacy and approved Price
ownership/amounts/recurring semantics, every Price listed under the managed
Products, zero-redemption coupon contracts, and portal preservation settings.
Reuse mode accepts only the validated normal legacy `MassageLab Supporter`
Product for the $1/$10 amount before migration even though an older installation may omit the
optional `app` metadata and the Product has not yet received
`txcd_10000000` or target catalog metadata; apply writes both and re-retrieves
the Product. Therapist and Practice retirement also requires the exact legacy
Product names, and any optional app or membership-level metadata must not
contradict the expected MassageLab identity. Completed-state verification
requires the exact classification and metadata. The reviewed pre-migration
Customer Portal may either expose the exact legacy Product topology or have
subscription switching disabled with no Product allowlist; apply enables
Price-only switching among the six new Supporter Prices across three Products.
Approved Prices must have no default trial period. Verify reports
either `PRE_MIGRATION` or `COMPLETED`; mixed states, unrecognized Prices,
incomplete or malformed pagination, and unknown portal subsets are blockers.

Only after reviewing the safe PASS checklist, run:

```bash
npm run stripe:migrate-supporter-membership -- --mode=apply
npm run stripe:migrate-supporter-membership -- --mode=verify
```

Apply first creates or reuses three managed amount-specific Supporter Products
and six Prices. Target Price preparation may transfer a managed lookup key from
a verified retiring Price to its selected replacement before the Portal update;
the source Price remains active, and this narrowly fingerprinted intermediate
state is recoverable on rerun. Apply then updates the Portal to expose only the
selected Prices and successfully rereads the explicitly expanded
`features.subscription_update.products` allowlist as the exact
three-Product/six-Price configuration. That successful expanded reread is the
gate before destructive cleanup begins: a failed reread stops apply without
deactivating a legacy Price, archiving a Therapist or Practice Product, or
deleting a coupon. A managed lookup-key transfer that already succeeded remains
safely resumable.

Only after the Portal gate succeeds does apply perform cleanup in this order:
it retires the legacy $9/$90, $29/$279, and $79/$759 Prices; the older $1/$10,
$2/$20, and $5/$50 Price objects only when they remain on the wrong legacy tier
Products; and any partially created $2/$20 or $5/$50 Prices misplaced on the
$1/$10 Product before Stripe's duplicate-interval Portal constraint was
identified. The valid $1/$10 Prices on the classified support-1 Product remain
active. Retirement candidates are accepted only when their Product ownership
and recurring semantics match the reviewed catalog. After dependency
verification, that Price phase retires the Therapist and Practice Prices before
apply retires their Products and deletes the two verified zero-redemption
coupons. It re-retrieves every mutation.

If apply is interrupted after the Portal gate, a subsequent apply rereads
Stripe and resumes that same ordered Price, Product, then coupon cleanup. Apply
is a read-only no-op only after final cleanup and post-apply verification both
complete. Portal quantity adjustment is
explicitly disabled, while cancellation and billing-management behavior is
preserved through semantic response validation. Amount changes preserve the
current billing-cycle anchor, use no proration, and are not scheduled for
period end. Apply can resume only an ordered, individually verified forward
transition caused by an accepted Stripe mutation;
Product and Price creates use deterministic Stripe idempotency keys so an
ambiguous accepted request can be retried without creating a duplicate.
Arbitrary mixed states still fail closed. Do not run apply until the deployed
Supporter-only application, subscriber decision, recurring-tax classification,
and migration inputs have all been independently reviewed. Remove the
migration-only variables after the operation. Keep the six approved runtime
Price IDs for public enrollment and retain the six legacy runtime Price
mappings under the separate subscriber-inventory/webhook-reconciliation gate.

Portal verification must retrieve
`features.subscription_update.products` with an explicit expansion; Stripe
omits that expandable allowlist from an ordinary configuration response.
Clearing the dormant downgrade schedule also requires Stripe's empty-value
encoding for `schedule_at_period_end.conditions`. A JavaScript empty array is
not sufficient because the Stripe SDK omits it from the form request and leaves
the prior condition unchanged. Cleanup remains blocked until an expanded reread
shows the exact three-Product/six-Price allowlist and canonical empty schedule
conditions.

An interrupted pre-recovery apply may therefore expose the exact target
three-Product/six-Price allowlist while the dormant
`decreasing_item_amount` condition remains. Verify mode continues to reject
that intermediate. Apply mode may resume it only when every target dependency
matches, every cleanup Price and Product is still active, and both verified
zero-redemption coupons are still present. Any partial cleanup remains an
arbitrary mixed state. The resumed apply must update and canonically reread the
Portal before the first destructive cleanup mutation.

## Sentry

Sentry captures anonymous operational errors, traces, and privacy-safe diagnostic
reports only. This is anonymous operational monitoring, not product analytics.
Do not use Sentry to infer background popularity, user journeys, retention, or
conversion.

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

### Anonymous operational boundary

| Keep | Remove or disable |
| --- | --- |
| release and environment | account, user, visitor, and session identifiers |
| sanitized stack traces | request/response bodies, headers, cookies, and query strings |
| coarse route/API families | full URLs and dynamic route values |
| event-scoped trace and diagnostic IDs | automatic click, input, navigation, console, and network breadcrumbs |
| anonymous Web Vitals and bounded spans | Session Replay, User Feedback, attachments, Logs, and product metrics |

No account, user, visitor, or session identifier is sent to Sentry. Automatic
click, input, navigation, console, and network breadcrumbs are disabled.
`sentry.server.config.ts` keeps `includeServerName: false` to disable SDK
server-name capture, and provider advanced scrubbing removes server-name tags
from new events.
Event-scoped trace and diagnostic IDs may correlate one operational failure,
not a person or browser history.

Before enabling or changing the SDK, confirm that:

- server-side data scrubbing is enabled;
- default scrubbers are enabled;
- `Prevent Storing of IP Addresses` is enabled;
- sensitive-field rules are reviewed;
- public issue sharing is disabled;
- Replay, User Feedback, attachments, and Logs are disabled or unused;
- retention is recorded; and
- one enum-only synthetic event is inspected after SDK changes.

`/api/support/problem-report` is the approved user-initiated diagnostic path. It sends only known issue categories, coarse product areas, safe route buckets, browser family, display mode, network state, viewport bucket, and an optional linked Sentry event id. It must not send screenshots, typed support messages, full URLs, query strings, local vault contents, SOAP text, intake answers, journal text, ROM notes, wellness entries, account contact details, or user-provided freeform descriptions.

Replay, standard Sentry User Feedback, screenshots/attachments, and Logs are
prohibited by this current Sentry contract. Any future proposal for Replay,
standard Sentry User Feedback, screenshots/attachments, or Logs requires a separately approved scoped design/privacy contract and disclosure review; it is not authorized by this workstream.

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

The approved Chimer full-catalog preview release uses the same public-media R2
credentials but has a fixed, immutable object prefix:
`chimer/background-preview-catalog/catalog-approved-1`. Its planner derives
the 1,728-object allowlist only from the approved schema-v3 catalog's rendition
and poster URLs; it never scans local directories, so generation checkpoints
and validation artifacts cannot be published. It validates every referenced
local file's byte count and SHA-256 before either a dry run or a live upload.

```bash
npm run chimer:preview:catalog:r2:check
npm run chimer:preview:catalog:r2:upload -- --dry-run --public-base-url https://media.massagelab.app
```

The dry run is credential-free and emits an exact no-upload summary. A live
upload is intentionally separately gated with `--confirm-live-upload`, must be
explicitly authorized, and cannot override the catalog release prefix.

## Production Migrations

Run migrations as a deploy step before serving new code:

```bash
npm run prisma:migrate:deploy
```

Do not run migrations from `next build`.

Every build runs `npm run production:migrations:check` before Prisma client
generation. The command is a no-op unless `VERCEL_ENV=production`. In Vercel
Production it requires `DIRECT_URL` or `DATABASE_URL_UNPOOLED` and runs only
`prisma migrate status`; it never applies or resolves a migration. A missing
direct connection, status failure, or pending migration fails the new build so
the previous healthy Production deployment remains active.

When the gate fails:

1. Review the exact committed pending migrations.
2. Obtain explicit authorization for the Production database write.
3. Confirm that `DIRECT_URL` or `DATABASE_URL_UNPOOLED` contains the direct
   maintenance connection, then run the deploy without allowing Prisma's
   pooled `DATABASE_URL` fallback:

   ```bash
   DIRECT_URL="${DIRECT_URL:-$DATABASE_URL_UNPOOLED}" npm run prisma:migrate:deploy
   ```

   Stop if both direct variables are empty; never substitute the pooled
   runtime `DATABASE_URL` for this recovery procedure.
4. Run `npm run production:migrations:check` with the Vercel Production
   environment and confirm it passes.
5. Redeploy the same reviewed commit and complete authentication plus affected
   feature smoke checks.
