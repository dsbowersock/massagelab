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

## Family-And-Friends Cost And Pause Gate

- Record the exact candidate and evidence head, then run
  `npm run readiness:timing-receipt -- --base-url=http://127.0.0.1:3010 --samples=3`
  from a fresh Production build on the same machine, loopback port, sample count,
  and environment shape. Require 21/21 HTTP `200` samples. Treat local timing
  `first` as the first measured sample after readiness, not platform cold
  evidence or a provider cold start.
- Attach the exact `tests/family-friends-server-workload.test.mjs` receipt for
  the ordinary non-practice shell: one auth snapshot, one user-graph read, one
  temporary-grant read, one entitlement build, one preference read, one
  practice-role read, four logical ORM operations, zero client bootstrap
  endpoints, and zero ordinary commerce snapshots. Confirm zero-practice users
  skip the calendar endpoint while practice members retain it. Confirm Settings
  and Music reuse the sanitized server projection and that owner changes abort
  and reset stale fallback, cloud-hydration, commerce, and mutation work.
- Require the fresh built-network proof to show zero session, preferences,
  profile, and calendar discovery GETs after a successful server bootstrap;
  exactly one shared preferences fallback GET after a server preference-read
  failure; zero Music session GETs; calendar suppression for zero-practice
  users with retention for practice members; zero no-intent commerce snapshot
  GETs with hydration for actual consumers; old-owner request/PUT/Checkout
  results unable to commit after an owner switch; and exactly one underlying
  RSC auth snapshot. These are public or synthetic/inert proofs only, not
  private-account, database, provider, or payment evidence.
- Prove the public display catalog only is process-local and single-flight:
  concurrent cold callers share six logical Price reads, a warm call makes zero,
  stable configured or exactly unconfigured results have a five-minute TTL,
  configured lookup/malformed projection failures have a fifteen-second retry
  TTL, and each Price read uses a 2.5-second
  timeout with one SDK network retry. Checkout, Portal, entitlements, customers,
  and webhooks remain uncached. Verify explicit Checkout still validates the
  configured server Price, every required slot is configured before release,
  and display fallback never grants access or supplies payment authority.
- Require the fresh combined one-worker Browser-QA gate to record its current
  exact totals with zero failures and no skips except the documented
  authorization-gated private rows; skips are never passes. Require the current
  focused Node matrix to record its exact total with zero failures, plus Prisma
  validate/generate, typecheck, lint, both fresh builds, and diff checks. The
  2026-08-29 historical receipt was 127 Browser-QA passes with 37 documented
  authorization-gated skips and 178/178 focused Node tests; those counts are
  evidence for that candidate, not fixed totals for a future candidate. The
  2026-08-29 complete Windows Node receipt is not green: 3,613
  passed, 10 established fixture/line-ending checks failed, and 3 intentionally
  skipped across 3,626 tests. Obtain hosted Linux evidence rather than changing
  those unrelated fixtures in this gate.
- Capture a separate read-only aggregate for the exact deployed commit that
  distinguishes observed Vercel cold-start latency from warm invocation
  latency. If the platform does not expose that distinction, write
  `deployed platform cold/warm aggregate: NOT RUN`; do not relabel the local
  timing harness.
- Prove the two server-enforced switches independently with their exact names:
  `MASSAGELAB_PUBLIC_REGISTRATION_PAUSED` and
  `MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED`. Only lowercase `true` pauses a path;
  absence defaults open. Browser proof must show that a registration pause
  preserves existing email/password and Google login plus recovery, and that a
  Checkout pause preserves existing entitlements and billing Portal access.
- Keep live Stripe payment/catalog/webhook/Portal behavior, private database rows, provider settings, OAuth/mail delivery, deployment, push, merge, and Production actions recorded as `NOT RUN` until each receives its separate
  authorization. Historical live payment evidence is context only, not
  exact-candidate proof.
- Complete read-only Neon pooled-host/connection/compute/transfer, Vercel
  usage/error/WAF Log mode, SMTP volume/bounce/complaint, Stripe webhook-failure,
  R2 custom-domain cache-header/Class A/Class B, and Sentry quota/privacy
  checks. Evidence must contain no identifiers or secret values. Provider,
  environment, WAF, cache, alert, quota, billing, and privacy-setting changes
  each require separate authorization.
- Run the complete exact-candidate automated and Browser-QA gates and obtain
  hosted line-ending-independent evidence before release. Private
  database-backed browser rows remain hard-skipped unless the separately
  authorized disposable non-Production target, exact fingerprint, reviewed
  migrations, fresh-process wrapper, and cleanup contract are all in force;
  public pause and route rows must still run.

## Operational Abuse And Email-Ceiling Gate

- Before any runtime containing the operational limiter, apply the additive
  `20260831120000_operational_rate_limit_bucket` migration as the only new
  pending migration through the separately authorized direct
  maintenance target and verify all 46 committed migrations current with no
  extras or failure. The migration adds the bucket owner, three nullable Admin
  email claim fields, and append-only hashed retry operation-key ownership; do
  not deploy this runtime while it is pending.
- Immediately before applying `20260831120000_operational_rate_limit_bucket`,
  run a count-only Production `AdminEmailIntent` row-count preflight against
  that exact authorized direct target. The current read-only aggregate evidence
  is `0`, but it must be refreshed. Proceed only when the exact count is `0`;
  any nonzero count must stop migration and trigger re-review. Do not connect or
  query Production without separate authorization. PostgreSQL permits multiple
  `NULL` values in the unique claim-operation-key index, so nullable expansion
  values do not collide. The exact-zero gate is deliberately stronger than that
  uniqueness prerequisite: it verifies the expected pre-claim-aware rollout
  state and forces non-concurrent index lock/application-plan re-review if any
  row exists.
- Prove outbound mail classification at the exact candidate: public-auth mail
  consumes both 70/global/fixed-24h and 90-total/global/fixed-24h, security mail
  consumes only the total 90, unknown classification and limiter unavailability
  fail closed before transporter construction, and accepted provider failures
  remain charged. Confirm Admin SMTP runs outside interactive transactions,
  live claims do not send, expired claims recover, stale finalizers remain
  ambiguous, every retry-key hash stays bound to one intent, and disposable QA
  cleanup removes only its own restrictive children. Provider delivery/bounce
  proof, migration application, and Production SMTP remain separate actions.

## Navigation And Action Feedback Gate

- Keep `interaction-feedback.spec.ts` registered exactly once in each ordinary Chromium project. The lane contract is 14 ordinary browser specs, 28 desktop/mobile project-spec assignments, and four nonempty lanes; `tests/browser/ci-lanes.test.mjs` plus `tests/browser-qa-harness.test.mjs` must prove that topology before browser execution.
- Run the focused Node interaction/auth/membership/loader/lane matrix, create a fresh Browser-QA build, and run the complete interaction-feedback spec in both `desktop-chromium` and `mobile-chromium`. Do not reuse stale browser output. The final release candidate must also pass the unfiltered `npm run test:browser` gate.
- Exercise a throttled successful route, a throttled successful action, and a thrown request. Pending feedback must appear promptly, disable only the owned action, settle after success or failure, produce one useful live announcement, never take focus, never intercept pointer input, and never replay an uncertain request.
- Cover desktop 1280×900, mobile portrait 390×844, compact landscape 844×390, 200% root text, real keyboard Tab/Enter activation, and reduced motion. Require no horizontal overflow, visible focus before activation, reduced-motion feedback whose real Loader contributes composited pixels and remains rendered identically across two samples at least 400ms apart, and app-bar/player control centers that remain uncovered.
- Prove that ordinary route changes preserve the mounted music toolbar/player identity and Clock/Chimer timer behavior. Keep private identity, account, and billing rows authorization-gated; a public browser pass is not evidence for a private-account flow.
- The 2026-08-29 local Task 4 receipt passed the exact-lane checks 21/21, the current focused Node matrix 50/50, and the complete built-app interaction spec in both projects at 14 public passes plus 3 explicit private authorization-gated skips per project. The complete Browser-QA release gate did not pass: a one-worker run reached 711/721 with 39 failure artifacts in other spec families and then stalled during worker teardown without final totals. Treat this as a red/incomplete release gate, not as launch approval; obtain a clean exact-candidate full Browser-QA exit before release.

## Identity And Account-Method Gate

- The count-only normalized-email preflight and the five ordered identity/membership migrations were completed under separate authorization. Exact-current-main Production deployment `06a730fcc6b7ed54f91e7d6330c023f9e06262c8` verified all 45 baseline migrations current with no extras or failure. Preserve that evidence and do not rerun the preflight or reapply the five as though they remain pending.
- The completed order was `20260828120000_identity_method_safety`, `20260828121000_identity_normalized_email_index`, `20260828130000_membership_subscription_convergence`, `20260901100000_auth_method_intent_two_factor_purposes`, then `20260901101000_auth_method_intent_registration_callback`. The normalized-email index monitoring and invalid-index recovery boundary remain applicable incident guidance. Only `20260831120000_operational_rate_limit_bucket` is pending for Layer A, even though its repository timestamp sorts before the two already-current 2026-09-01 migrations.
- Current Production serves the identity/membership runtime with membership webhook writes enabled and `MASSAGELAB_MEMBERSHIP_WEBHOOK_WRITES_PAUSED=0`. Preserve the separately authorized cutover evidence; Layer A must not alter identity or membership writer authority, routing, or rollback semantics.
- Verify the 15-minute limiter matrix exactly: `REGISTER` 5/account + 12/network; `PASSWORD_RESET` 5/account + 20/network; `LOGIN` 8/account + 30/network; `TWO_FACTOR` 8/account + 30/network; `GOOGLE_INTENT` 30/network. Persistence must contain only the domain-separated hashed identifier and bucket metadata. Confirm the best-effort stale pass samples once in 64 operations, removes at most 100 inactive, non-blocked buckets older than 24 hours, and rechecks those predicates in the delete so a concurrently reactivated or blocked bucket survives.
- Keep dangerous automatic email linking absent. Prove each Google start uses the private `ml-auth-method-binding` cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=600` (10 minutes), and `Secure` in Production. No intent, binding, provider proof, or OAuth token may reach URLs, `localStorage`, `sessionStorage`, rendered data, logs, or evidence. Matching-email linking requires the same browser's provider proof plus explicit fresh Credentials confirmation, provider/cross-account conflicts fail closed, and method removal cannot leave zero credentials.
- Before changing or publishing Google OAuth settings, read back one exact Production origin and its matching `/api/auth/callback/google` URI, reconciled with `AUTH_URL`, the canonical Vercel alias, and apex/`www` redirects. Read back consent publishing status, support/contact details, required scopes, and intended real-account/test-user access. Provider changes and real Google account testing require separate authorization.
- Before Production mail, read back the sender/SMTP setup without printing values; verify SPF, DKIM, DMARC alignment/policy, and bounce/complaint or suppression handling. Run separately authorized delivery and controlled-bounce tests. Review security notices only through aggregate kind/status/allowlisted failure-code/attempt-count/age evidence. Delivery is at-least-once: an expired five-minute claim may retry after ambiguous provider acceptance and can produce a duplicate notice. Do not expose recipient, fixed copy, intent/claim ids, provider diagnostics, or manually promote an ambiguous result to delivered. Durable retry is separately gated: authorize the exact direct database target before read-only fingerprinting, then separately authorize both database access and SMTP/send plus the exact 64-lowercase-hex fingerprint and `--max-rows=1..100` scope before setting `AUTH_SECURITY_NOTICE_RETRY_DATABASE=1` and `AUTH_SECURITY_NOTICE_RETRY_SEND=1`. Run `npm run auth:retry-security-notices -- --expected-fingerprint=<fingerprint> --max-rows=<1..100>` only within that approval and retain only selected/delivered/failed/ambiguous/busy counts.
- After exact cutover and old-instance drain evidence, the read-only `npm run auth:cleanup-legacy-attempts -- --print-fingerprint` action and every cleanup batch remain separately gated. Obtain authorization naming the exact 64-lowercase-hex production fingerprint and total invocation/batch scope before running `npm run auth:cleanup-legacy-attempts -- --expected-fingerprint=<64 lowercase hex> --max-rows=<1..100>`. Record only deleted counts. Cleanup, a zero-count verification outside the approved scope, and a future `AuthAttempt` table-drop migration each require their own authorization; none occurred in Task 7.
- For browser acceptance, private identity rows may run only after the fingerprint guard proves the exact opted-in, non-Production disposable runtime/direct pair and those URLs equal the process `DATABASE_URL`/`DIRECT_URL`. Apply and verify every migration required by the exact candidate, including `20260831120000_operational_rate_limit_bucket` for Layer A, use the exact fingerprint-checked wrapper, and verify all private fixtures are removed afterward. Ordinary public rows run without a database and private rows must hard-skip when this authorization is absent.
- Keep provider-setting changes, migration application, cleanup, private fixtures, real OAuth, Production SMTP, deployment, push, merge, and any future contract migration outside an ordinary local verification run. Record each as pending until its own exact evidence exists.

## Subscription Entitlement Convergence Gate

- `20260828130000_membership_subscription_convergence` and the other four baseline identity/membership migrations are current in Production at exact current main. The membership migration created `MembershipWebhookReceipt`, its unique `(provider, providerEventId)` owner, bounded status/attempt/failure/timing metadata, and nullable ordering/authoritative watermarks without backfilling or rewriting existing rows.
- Membership webhook writes are enabled with the pause flag at `0`. Preserve the completed bridge rollout evidence and the rule that any later rollback uses only a bridge-capable deployment with exact flag `1`, never a pre-bridge writer. The pending operational migration and Layer A deployment do not authorize or require another membership pause cycle.
- Preserve the signed ordering contract. A terminal receipt or same-event duplicate is a no-op; an event already proven stale is ignored without provider retrieval or overwriting the stored snapshot; a newer unambiguous Stripe event may apply; equal provider timestamps, legacy rows with null watermarks, membership Checkout completion, and every different event not already proven stale after a successful authoritative read must retrieve current Stripe state outside the transaction. After retrieval, use only a short compare-and-commit transaction. Compare Stripe event time only with the stored Stripe event watermark and the local authoritative marker only with the captured local marker; never compare the two clocks.
- Keep receipt creation race recovery exact. At the receipt insert site, recognize only `P2002` on the `MembershipWebhookReceipt` model with exact ordered target `provider, providerEventId` or connector-safe index `MembershipWebhookReceipt_provider_providerEventId_key`, or installed PrismaNeon metadata that additionally proves `DriverAdapterError`, `UniqueConstraintViolation`, and PostgreSQL `23505` with the same exact ordered fields/index. Convert that exact race once into the shared `P2034` retry signal so the bounded transaction runner abandons the failed snapshot and starts a fresh `Serializable` transaction. Never retry the raw unique error inside its failed transaction. Wrong codes, models, field order, indexes, mixed constraint metadata, malformed shapes, or a second insert race are not duplicate-delivery proof.
- Once an envelope can identify or create a receipt, a failure before terminal completion leaves that receipt `RECEIVED` with only an allowlisted failure code. A malformed envelope may reject before any receipt is identified or created, but it still returns non-2xx/retry and grants nothing. There is no durable membership background worker, so a retryable membership failure makes the signed route return private HTTP `503` and let Stripe retry. Do not convert provider, price, ownership, malformed-event, or concurrent uncertainty into a successful acknowledgement. Cache invalidation is permitted only after the convergence owner commits `changed: true`.
- Keep the bypass retirement complete: `recordCheckoutSessionCompleted` and `upsertMembershipSubscriptionFromStripe` must have no runtime caller, import, or export. `normalizeStripeSubscription` remains the shared normalizer. Membership-purpose Checkout completion and the five `customer.subscription.*` events are the only membership routes into the convergence service; donation/unknown Checkout remains non-entitling and background Checkout, refund, and dispute routing remains under its existing receipt/services.
- Preserve billing non-regression boundaries. The six current Supporter Price allowlist, recurring Automatic Tax gates, billing-address contract, Checkout serialization/reuse/idempotency, combined 15-event webhook contract, and background-commerce receipt/fulfillment/reversal behavior do not change in this workstream. Portal creation remains customer-owned: load the signed-in user's persisted Stripe Customer and, for focused changes, select only a persisted active or trialing subscription before requesting the Portal session. Persist only allowlisted normalized membership metadata; never store a raw Stripe payload, address, payment detail, secret, token, or provider diagnostic.
- Checkout and Portal returns must use only `/account?tab=membership&checkout=success`, `/account?tab=membership&checkout=cancelled`, and `/account?tab=membership&portal=returned`; do not restore `{CHECKOUT_SESSION_ID}` or accept a Session, event, customer, or subscription query/body value as authority. The status endpoint stays authenticated, `private, no-store`, database-only, and provider-ID-free. It may expose only persisted state, paid level, feature keys, safe subscription status/period fields, database revision, and Portal availability.
- Checkout return performs up to five persisted reads/attempts at incremental waits `[0,1000,2000,4000,8000]`, with all five used on exhaustion for the preserved 15-second wait schedule; each read's fetch plus JSON consumption has a 1.5-second deadline. Active access may settle immediately. Billing-attention or no-active status may settle only after that polling run observes a revision different from its baseline; otherwise it must exhaust to still-processing guidance and offer only a safe status retry. Portal may display current persisted state on its first read while watching the same bounded revision window. Access actions use persisted feature keys such as `premium_backgrounds`, never displayed plan names, redirect state, or browser storage. The membership Account-return render and membership-status endpoint do not retrieve Stripe; duplicate and already-proven-stale events short-circuit, while current-subscription retrieval is limited to Checkout completion, ambiguous or legacy events, and every different event not already proven stale after an authoritative read.
- Before release, rerun the exact clean candidate gate: Prisma validate/generate, TypeScript, lint, complete tests, ordinary Production build, `git diff --check`, fresh Browser-QA build, and focused desktop/mobile `membership-return-status.spec.ts`. Do not run the browser specs from stale output. Database-backed browser rows require the separately approved non-Production disposable runtime/direct target, exact SHA-256 fingerprint, every exact-candidate migration including the operational migration for Layer A, fresh-process wrappers, and exact cleanup; otherwise those rows must hard-skip while public rows still run.
- The next predecessor-head receipt is historical local evidence. Its migration/deployment status is superseded by the exact-current-main Production status above; retain its test totals only as predecessor evidence.
- Current runtime head `6838ff574695b23d206d2272da241d30bed91507` is not yet a Production release pass. A fresh exact-runtime-head focused rerun of the Fix A bridge, Fix B Account-return normalization, background-routing non-regression, and focused Portal contracts passes 62/62. The last complete Task 5 Prisma/type/lint gate, 379/379 focused subscription/Stripe/background matrix, 3,342-test Windows suite, ordinary 114-page Production build, and restricted-Google-Fonts Browser-QA attempt remain predecessor-head evidence at `04881a884d6e5cce656e1ff939bd3b998c67bc18`; none was rerun after Fix A/B. That predecessor Windows suite recorded 3,329 pass, 10 known host-line-ending failures, and 3 intentional skips: nine established Atmoshaper CRLF fixture failures with committed blobs matching their pinned hashes and one Windows CRLF exact-newline failure in `auth-schema-migration.test.mjs`. No final full-suite or exact-runtime-head release pass is claimed. Obtain fresh hosted Linux, complete exact-candidate, and Browser-QA evidence before Production release.
- Layer A Production remains separately gated on exact-target authorization/application of `20260831120000_operational_rate_limit_bucket`, verification that all 46 committed migrations are current, exact-candidate validation and deployment, outbound delivery/bounce proof, provider callback/origin and delivery health, and pool/capacity/alert posture. The five baseline identity/membership migrations and enabled membership writer are current at exact main and are not pending Layer A actions. Any test or live Stripe payment, Checkout, event emission or replay, refund, cancellation, provider/Portal setting or environment mutation, database connection or private-row fixture, deployment, push, or merge needs its own authority. Historical billing smoke is useful context only and must not be reported as exact-head proof.

## Password-reset integrity gate

- Confirm one successful reset-link consumption changes the password credential, consumes every outstanding reset link for the account, increments `User.authSessionVersion` exactly once, and deletes Prisma `Session` rows for compatibility in one transaction. Rollback evidence must leave all four effects unchanged, and same-link or different-link races must permit only one successful password change.
- Apply the same consumption contract to self-service and Admin-requested links. Link consumption must not create a second Admin evidence/action bundle: an Admin-requested reset retains its immutable request-time Admin action and target Activity evidence. Successful consumption must transactionally queue exactly one `PASSWORD_RECOVERED` security notice with the password mutation, token consumption, and session invalidation. Delivery and bounded retry belong to the account-security claim/lease/CAS owner, not the Admin evidence owner.
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

- Before releasing Anatomime hardening, verify the closed operational policy registry contains exactly 37 rules: the existing join network IDs remain unchanged but belong to `ANATOMIME_ROOM_JOIN_INGRESS`, verified join keeps only 20/network+room/10m, and realtime adds 120/network/10m ingress before found-room 60/network+room/10m start and joined 6/player plus 40/room issue. Prove missing join/realtime rooms consume no room-scoped key; poll rotation across 301 distinct selectors permits 300 then denies one network, retains only one HMAC ingress key, and treats tuple/room checks atomically as peek-only. This poll control is best-effort per warm runtime, not a deployment-wide ceiling; retain provider/edge monitoring and do not describe it as global enforcement.
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
