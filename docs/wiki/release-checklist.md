# Release Checklist

Use this checklist before inviting real users or tagging/deploying an alpha build. Keep SOAP notes, intake forms, journals, ROM sessions, and other professional-record workflows local-first in all testing.

## Automated Gate

See [CI and PR checks](ci-pr-checks.md) for the repository-owned workflow,
browser-lane diagnosis, and external-status boundaries. Its stable `qa` result
aggregates Code quality, Browser build, and all four Browser QA lanes.

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

## Password-reset integrity gate

- Confirm one successful reset-link consumption changes the password credential, consumes every outstanding reset link for the account, increments `User.authSessionVersion` exactly once, and deletes Prisma `Session` rows for compatibility in one transaction. Rollback evidence must leave all four effects unchanged, and same-link or different-link races must permit only one successful password change.
- Apply the same consumption contract to self-service and Admin-requested links. Link consumption must not create an Admin action, target Activity entry, or account-change email intent; an Admin-requested reset retains the immutable request-time evidence and creates no second Admin evidence bundle.
- Confirm an old JWT is rejected when it next reaches a successful database-backed refresh. Report Prisma `Session` deletion only as adapter-compatibility cleanup; its row count is not an active-JWT count or an exact signed-out-user count.
- Run the focused password-reset confirmation, route, auth-security, auth-session-version, Admin security-service, and Admin security-UI tests before the comprehensive gate. Do not expose reset links, credentials, hashes, tokens, email addresses, database rows, or session artifacts in release evidence.
- Completed 2026-08-11: Prisma client generation, all 69 focused and adjacent tests, typecheck, lint with only the existing Babel large-file note, the full 2,447-test suite with 2,446 passes and one intentional skip, the 104-page Production build, and `git diff --check` passed.

## Production Billing Gate

Before changing the live catalog or running any live paid smoke:

1. complete the database and Stripe subscriber inventory without exposing
   customer identifiers;
2. record a subscriber-specific grandfathering/tax decision for every active,
   trialing, past-due, unpaid, paused, incomplete, or canceling subscription;
3. confirm the exact Therapist and Practice Product names and that any present
   app or membership-level metadata matches the expected MassageLab retirement
   identity;
4. confirm the older $1/$10, $2/$20, and $5/$50 Price objects remain attached
   to their expected legacy tier Products so the migration can retire them
   before creating the same amounts under one Supporter Product;
5. confirm the pre-migration Portal either has switching disabled with no
   Product allowlist or exposes only the exact legacy topology;
6. run `npm run stripe:migrate-supporter-membership -- --mode=verify` and stop
   unless every safe check passes;
7. deploy the supporter-only application, environment, and recurring-tax
   contract together;
8. run migration apply only after the explicit operator gate, then rerun verify
   against the completed catalog; and
9. run the production Stripe readiness check from an explicit production env
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
- The independent one-time-support enablement, exact `txcd_90000001`
  classification, provider, registrations, and final-confirmation gates are
  all explicit.
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
- The Track 1 controlled smoke covers a taxed low-dollar monthly enrollment,
  signed-webhook entitlement persistence, one focused amount or billing-period
  change with the documented anchor/no-proration contract, and return to
  MassageLab.
- The remaining expanded billing matrix -- a $5 change, payment/address update,
  period-end cancellation, and a public annual Checkout plus cancellation or
  interval switch -- is first-cohort Production monitoring or a separately
  authorized follow-up smoke. Those observations are explicit external
  invite-readiness work, not Track 1 implementation or rollout blockers.
- Cancel or refund a smoke subscription only when the controlled-account owner
  requests it or the separately authorized smoke requires cleanup.
- The one-time support path starts Stripe Checkout, returns to `/pricing`,
  uses exclusive Automatic Tax with required billing-address collection,
  retrieves the completed Session and line items, and verifies the applied tax
  evidence before the smoke is treated as passed;
  states that it does not purchase goods or services, create a membership, or
  unlock features, states that it is not charitable or tax-deductible, and
  grants no membership, credit, or background ownership after the signed
  completion webhook.

Retain the six legacy runtime Price mappings until subscriber inventory proves none remain and webhook reconciliation is final.
Those mappings are historical normalization inputs only; they cannot replace
any of the six amount-specific Supporter Price IDs in readiness.

Latest status, 2026-07-28: the Supporter catalog migration, recurring Automatic
Tax readiness, controlled taxed $1 monthly Checkout, and focused membership
change deployment are complete. The controlled user has changed the membership
to $2 monthly and supplied screenshots showing the Account return, continuing
Supporter status, and membership-included backgrounds. Bounded read-only
verification confirms an active $2 monthly Supporter Price with exclusive tax
behavior and Automatic Tax enabled, the original billing anchor, and no
immediate proration invoice or charge. The latest paid invoice remains the
non-prorated initial $1 subtotal plus $0.07 Ohio tax; the first $2 renewal has
not occurred, so no completed $2 tax invoice is claimed. Read-only Production
persistence verification confirms continued Supporter access through the
`premium_backgrounds` feature key. The independent
`txcd_90000001` one-time-support Automatic Tax contract is implemented. The
user reverified live Stripe Tax readiness and the collecting Ohio registration,
all five Production gates are configured, and the exact PR #153 merge commit
was redeployed READY on the canonical aliases. No Checkout Session or payment
was created during configuration. PR #155 then merged as
`6e5d65106d8a16f1c2723311dc41c884f7c522c2`, and Vercel built that exact commit
READY in Production. Its temporary Production-only hook ran the GET-only
`stripe:readiness --live --verify-stripe --no-dotenv` command before the
application build: live Stripe retrieval was performed, all five independent
one-time-support tax gates were true, and recurring Supporter, one-time-support,
and background-commerce readiness all passed without printing secret values.
The hook was removed after this single intended verification. PR #156 merged as
`4b9bb291820edd67f184e51f0ad9d7cbe9bea881`, and that exact commit is READY in
Production. The explicitly authorized $5 one-time-support smoke then completed
and returned to Pricing. Sanitized GET-only Stripe retrieval confirms a live,
paid/completed payment-mode Session with required billing-address collection,
Stripe-powered Automatic Tax enabled and complete, and one exclusive line using
exact `txcd_90000001`. Stripe calculated $0.00 tax on the $5.00 subtotal and the
succeeded PaymentIntent received exactly $5.00. Stripe names that code `Cash
Donation`; the zero-tax amount is the applied result for the reviewed
nothing-in-return classification, not evidence that Automatic Tax was disabled.
The Session attached no Customer, client reference, Subscription, or Invoice,
and the existing purpose/webhook contract remains non-entitling. Track 1
implementation and rollout readiness is complete. Attorney review and
first-cohort Production monitoring remain external invite-readiness gates.

## Admin billing-goodwill gates

- Automated and browser QA must use injected/test fixtures only; no test may call Stripe balance-transaction creation. The browser acceptance path is presentation-only, instruments zero form submissions and matching POST requests, and its gated preview client's mutation methods must fail closed. Both server actions must also reject the exact opted-in disposable QA identity before entering the service or constructing a real Stripe client; the guard must remain inactive for ordinary tests, non-fixture identities, and Vercel Production.
- Completed 2026-08-11: the explicitly authorized `$0.01` test-mode proof used a disposable Customer with one active USD Supporter subscription plus a disposable clone of the selected subscribed account. The returned transaction was negative USD and, in that one historical proof, its ending balance matched the separately refreshed Customer balance. The local operation was `VERIFIED`, Account Activity was present, and the `example.test` intent remained `PENDING` with zero attempts. The current contract does not require that general equality: persisted transaction `ending_balance` is credit immediately after that exact credit, while a later Customer balance is a separate optional observation. The disposable Stripe Customer/subscription and database branch were deleted and verified absent; live Stripe and production data were untouched. Repeat this gate for any future rewrite of the mutation boundary.
- Treat every `PREPARED`, `APPLIED`, or `RECONCILIATION_REQUIRED` operation as unresolved and possibly committed. Confirm directory/dashboard counts and the bounded newest-25 detail view with truthful truncation warning. Use its single Admin Reconcile action, freshly confirming the exact normalized target email and stored two-decimal amount. A known-ID row must read back without another create and verify the exact transaction ID, expected Customer, live/test mode, `usd`, exact negative amount, originating local operation/idempotency evidence, and safe non-positive `ending_balance`. Malformed, wrong-ID, deleted, wrong-mode, or otherwise unsafe returned Customer evidence must fail closed. Later invoice, refund, or balance activity must not strand an exact verified transaction or produce a replacement operation/key.
- For no-ID work, require the same operation and idempotency key, remain before the conservative 23-hour-55-minute margin, and recheck the clock immediately before create. A reconciliation-only caller must durably move an existing no-ID `PREPARED` operation to `RECONCILIATION_REQUIRED` before provider I/O. Never create a replacement operation or notify the user before `VERIFIED`; if retry timing or identity evidence is ambiguous, retain the unresolved same-key claim for manual provider/local evidence review.
- Confirm the final fresh full-Admin database check occurs after provider eligibility reads and the final replay-clock check, immediately before every possible new provider create. Only typed database-confirmed denial while the same creating invocation still exclusively owns a never-attempted no-ID `PREPARED` operation may record `FAILED_BEFORE_MUTATION` / `ADMIN_AUTHORITY_REVOKED`. Infrastructure or unknown failures, pre-existing/lost ownership, and post-check races must remain unresolved, retryable, and provider-ambiguous, without persisted raw errors.
- Confirm result presentation labels persisted transaction-time evidence as `Credit immediately after this credit` and labels a safe freshly read present value separately as `Current Stripe credit`. An unavailable current read or legitimate current debit makes no current-credit claim and does not block exact historical verification; local replay without a fresh read must make no current claim. Pre-mutation `Resulting credit` remains a projection.
- Confirm mutation-time Stripe subscription currency is exactly `usd`; direct or stale non-USD submissions must fail before balance-transaction creation.
- Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false during ordinary validation and test-mode proof. A live credit requires `NODE_ENV=production`, exact `VERCEL_ENV=production`, the explicit flag, and separate user authorization that names the controlled account and exact amount. Preview and missing Vercel identity must fail closed. A mistaken live credit has no ordinary debit/reversal control and requires a separately reviewed recovery procedure. Eligibility, `$0.01`-`$100.00`, USD, confirmation, mutation-entry, and QA zero-mutation gates remain unchanged. Do not begin Admin Operations Closure Branch 3 Production activation, migration deployment, or browser acceptance before Admin Operations Closure Branch 2 merges.
- Completed 2026-08-27: after Branch 2 and the four originating Admin PRs had merged, the separately gated Production migration step was found still pending during a Google sign-in incident. All four committed migrations were explicitly authorized, applied, and verified current; no Admin live Stripe mutation was enabled or exercised.

## Manual Focus Areas

- Account registration, Google sign-in, Terms/Privacy acceptance, onboarding, verification, password reset, 2FA, and preference sync.
- Pricing, one-time project support, live membership checkout, signed webhook delivery, customer portal, membership status, premium-background access, accessible-background color controls, and feature entitlement checks such as `therapist_documentation_tools`.
- Homepage, `/tools`, business planner tools, Education flashcards, Anatomime shared sessions, Chimer, `/clock`, `/music`, `/wellness`, `/notes`, support, roadmap, legal/trust pages, account, security, and settings routes.
- Calendar practice creation, availability, public booking, waitlist, booking request, and conflict prevention.
- Local-first notes, intake, journals, ROM import/export, encrypted vault unlock, and plaintext export warnings.
- PWA metadata, offline fallback behavior, and the public-tool offline allowlist.
- Privacy expectations: no clinical content is uploaded during anonymous local-first or therapist professional-record workflows.

## Production Operating Checks

- Production runtime `DATABASE_URL` uses the Neon pooled host. Direct Neon URLs stay limited to migrations and maintenance paths.
- Vercel Production `prebuild` runs the read-only migration gate before Prisma generation. Do not promote when the direct maintenance URL is absent, status cannot be verified, or committed migrations are pending. Apply reviewed migrations only through a separately authorized maintenance action, verify status, then redeploy the same reviewed commit.
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
