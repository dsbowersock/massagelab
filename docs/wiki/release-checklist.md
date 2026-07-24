# Release Checklist

Use this checklist before inviting real users or tagging/deploying an alpha build. Keep SOAP notes, intake forms, journals, ROM sessions, and other professional-record workflows local-first in all testing.

## Automated Gate

```bash
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Run focused browser smoke coverage for the invite-critical public and auth routes:

```bash
npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium
```

Then walk [../alpha-qa.md](../alpha-qa.md) with anonymous test data where it still applies.

## Production Billing Gate

Before changing the live catalog or running any live paid smoke:

1. complete the database and Stripe subscriber inventory without exposing
   customer identifiers;
2. record a subscriber-specific grandfathering/tax decision for every active,
   trialing, past-due, unpaid, paused, or canceling subscription;
3. confirm the exact Therapist and Practice Product names and that any present
   app or membership-level metadata matches the expected MassageLab retirement
   identity;
4. run `npm run stripe:migrate-supporter-membership -- --mode=verify` and stop
   unless every safe check passes;
5. deploy the supporter-only application, environment, and recurring-tax
   contract together;
6. run migration apply only after the explicit operator gate, then rerun verify
   against the completed catalog; and
7. run the production Stripe readiness check from an explicit production env
   file:

The GET-only migration verify is the pre-apply safety authority. Do not require
the completed-catalog readiness command to pass before apply: in `CREATE_NEW`
mode, the classified Product and six Prices do not exist until the gated apply
creates them. After apply, both migration verify and production readiness must
pass before any live paid smoke or public enrollment.

```bash
npm run stripe:readiness -- --env-file=/secure/path/massagelab-production.env --live --verify-stripe
```

The migration verification and readiness command must pass without printing
secret values. Only then complete the live Supporter and one-time-support smoke
tests and confirm:

- The only public membership is MassageLab Supporter Membership, at exactly
  $1/$2/$5 monthly or $10/$20/$50 annually.
- The recurring-tax enablement, `txcd_10000000` classification, provider,
  registrations, and final professional-confirmation gates are all explicit.
- Stripe retrieval confirms every Supporter Price is exclusive, uses exact
  interval count one with no trial, licensed per-unit usage, no quantity
  transform or additional currencies, and belongs to the classified Supporter
  Product.
- Concurrent or repeated enrollment returns one exact current
  contract-versioned Checkout Session; purpose-less or contradictory
  historical open membership Sessions are confirmed expired, while a completed
  historical Session with a relevant subscription blocks another Checkout
  during signed-webhook persistence.
- The Checkout session uses Automatic Tax, requires a billing address, updates
  the Stripe Customer address, completes, and returns to MassageLab.
- Membership status updates from the signed webhook.
- The Stripe Customer Portal opens, permits switching only among the six
  Supporter Prices, and preserves cancellation, payment-method updates,
  billing-detail updates, invoice history, and return to MassageLab.
- The $1 monthly enrollment, $2/$5 portal switch, payment/address update,
  invoice, period-end cancellation, and webhook-backed entitlement paths pass.
- The subscription is canceled or refunded as appropriate after the smoke test.
- The one-time support path starts Stripe Checkout, returns to `/pricing`,
  states that it is not charitable or tax-deductible, and does not create a
  membership entitlement.

Retain the six legacy runtime Price mappings until subscriber inventory proves none remain and webhook reconciliation is final.
Those mappings are historical normalization inputs only; they cannot replace
any of the six amount-specific Supporter Price IDs in readiness.

Latest status, 2026-07-24: the deployable Supporter-only application,
fail-closed migration command, and recurring Automatic Tax application/readiness
contracts are implemented locally. Live database/Stripe inventory, final
professional classification confirmation, deployment, migration apply,
Customer Portal mutation, and the new live smoke remain pending. The earlier
June 24 legacy Supporter smoke remains historical evidence only. The one-time
support Checkout smoke also remains pending.

## Manual Focus Areas

- Account registration, Google sign-in, Terms/Privacy acceptance, onboarding, verification, password reset, 2FA, and preference sync.
- Pricing, one-time project support, live membership checkout, signed webhook delivery, customer portal, membership status, and feature entitlement checks such as `chimer_custom_colors` and `therapist_documentation_tools`.
- Homepage, `/tools`, business planner tools, Education flashcards, Anatomime shared sessions, Chimer, `/clock`, `/music`, `/wellness`, `/notes`, support, roadmap, legal/trust pages, account, security, and settings routes.
- Calendar practice creation, availability, public booking, waitlist, booking request, and conflict prevention.
- Local-first notes, intake, journals, ROM import/export, encrypted vault unlock, and plaintext export warnings.
- PWA metadata, offline fallback behavior, and the public-tool offline allowlist.
- Privacy expectations: no clinical content is uploaded during anonymous local-first or therapist professional-record workflows.

## Production Operating Checks

- Production runtime `DATABASE_URL` uses the Neon pooled host. Direct Neon URLs stay limited to migrations and maintenance paths.
- Production `robots.txt`, `sitemap.xml`, and metadata index only approved public pages. Preview/local deployments stay noindex.
- Auth flows, account/admin surfaces, APIs, public booking links, shared room-code URLs, and local professional-record subroutes stay out of the sitemap and crawler allowlist.
- Sentry remains limited to sanitized errors/traces and the approved user-initiated diagnostic report. Do not enable Session Replay, screenshots, attachments, logs, or standard feedback widgets before route-by-route privacy review.
- Monitor Neon transfer, Sentry issues, Stripe events, Vercel deployment health, and support email during the first invite window.
- Keep the retired Early Access and Student-to-Therapist discount paths absent
  from application Checkout. Delete their live coupons only through the
  controlled migration after zero-redemption verification.

## External Confirmations

- Have the legal/trust documents reviewed by an attorney before broader public reliance.
- Keep invite messaging clear that MassageLab is an alpha, hosted PHI sync is unavailable, and therapist professional records remain in the local encrypted browser vault.
