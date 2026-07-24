# Supporter Membership Final Fixes Report

## Status

`DONE_WITH_CONCERNS`

All six final-review findings are fixed, covered by focused regressions, validated
by the full repository gates, and committed. The remaining concerns are
operational gates that were intentionally outside this review: no external
network calls, live Stripe/database inventory, migration apply, deployment,
catalog mutation, or live smoke was performed.

## Git State

- Starting branch: `codex/supporter-membership-restructure`
- Starting HEAD: `1fd95314a6ffc80f49de2ec8b0053021a10ca206`
- Fix commit: `80bb9df2ada85dabb11d26edcdd969ca813ff6e0`
- Worktree: `C:\tmp\massagelab-supporter-membership-restructure`

## Findings Closed

1. Parallel subscription prevention: persisted active, trialing, past-due,
   unpaid, paused, or period-end-canceling subscriptions now block Checkout
   before Stripe Customer or Checkout Session creation. Pricing and Account use
   the same decision helper and send existing Supporter or legacy
   Therapist/Practice subscribers to Customer Portal.
2. Obsolete live setup removal: the old command and script that could recreate
   retired $9/$90, Therapist/Practice, and coupon catalog objects are deleted.
   The fail-closed Supporter migration command is the sole catalog operation.
3. Real legacy Product reuse: reuse mode accepts only the exact normal legacy
   Supporter Product pre-state, applies the target tax classification and
   metadata, re-retrieves it, and requires the strict completed state.
4. Exact recurring Price semantics: readiness and migration share one helper
   that requires exact amount, USD currency, per-unit billing, interval,
   interval count one, no default trial, licensed usage, no quantity transform,
   no additional currencies, and target tax behavior where applicable.
   Readiness retrieval expands both Product and currency options.
5. Legacy runtime mapping retention: all six historical Price mappings remain
   documented reconciliation-only inputs until subscriber inventory proves none
   remain and webhook reconciliation is final. They cannot satisfy new public
   catalog readiness.
6. Public Current benefits: Supporter pricing now explicitly lists access to all
   backgrounds.

## RED Evidence

Initial focused command:

```text
node --test tests/membership.test.mjs tests/membership-checkout-route.test.mjs tests/membership-pricing.test.mjs tests/stripe-readiness.test.mjs tests/stripe-supporter-membership-migration.test.mjs tests/supporter-membership-final-review.test.mjs
```

Initial result: 64 tests, 40 passed, 24 failed. Failures covered all six
findings, including duplicate Checkout creation for relevant subscription
states, missing Portal routing, retained obsolete setup command, rejected
legacy Product pre-state, incomplete recurring Price checks, absent legacy
mapping retention, and missing all-background benefit copy.

Final retrieval-expansion regression:

```text
node --test tests/supporter-membership-final-review.test.mjs
```

RED result: 3 tests, 2 passed, 1 failed because readiness retrieved only the
expanded Product. After expanding `currency_options`, the same command passed
3/3.

## Implementation Files

- Runtime and UI: `lib/membership.js`, `lib/membership-checkout.js`,
  `app/api/billing/checkout/route.ts`, `app/pricing/page.tsx`,
  `app/account/page.tsx`, `components/membership/pricing-cards.tsx`,
  `lib/membership-pricing.js`
- Stripe contracts and operations: `lib/stripe-price-contract.js`,
  `lib/stripe-readiness.js`, `scripts/stripe-readiness-check.mjs`,
  `scripts/stripe-supporter-membership-migration.mjs`, `package.json`,
  deleted `scripts/stripe-live-membership-setup.mjs`
- Configuration and documentation: `.env.example`, `docs/project-state.md`,
  `docs/project-log.md`, `docs/wiki/billing-memberships.md`,
  `docs/wiki/deployment.md`, `docs/wiki/release-checklist.md`
- Regressions: `tests/membership.test.mjs`,
  `tests/membership-checkout-route.test.mjs`,
  `tests/membership-pricing.test.mjs`, `tests/stripe-readiness.test.mjs`,
  `tests/stripe-supporter-membership-migration.test.mjs`,
  `tests/supporter-membership-final-review.test.mjs`

## Validation

- Initial focused membership/Stripe command shown above: 40/64 passed as RED
  evidence; the retrieval-expansion regression later passed 3/3.
- `npm run test`: 1,445/1,445 passed across 157 suites at the final PR head.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Prisma generation, production compilation,
  TypeScript, and 101/101 static pages completed.
- `git diff --check`: passed, with only Git line-ending conversion warnings.
- `git diff --cached --check`: passed with no output before the fix commit.

## Remaining Operational Gates

Before rollout, independently complete the documented live database and Stripe
subscriber inventories, professional recurring-tax confirmation, GET-only
migration verification, reviewed migration apply, environment/deployment
configuration, webhook reconciliation, Portal configuration verification, and
the controlled live subscription smoke. Preserve the legacy runtime Price
mappings until their explicit inventory-and-reconciliation removal gate passes.

## Whole-Branch Follow-Up

Status: `DONE_WITH_CONCERNS`

Starting HEAD: `fd50f08fbc9143aff2e1f89b4d08cc7d93403c39`

The follow-up review closed two additional findings:

1. Membership enrollment now uses a user-and-terminal-attempt-scoped Stripe
   idempotency key, reuses a bounded and fully paginated open Session, blocks
   when any completed owned Session still has a relevant subscription, rotates
   only after terminal non-blocking state, and safely relists after an ambiguous
   or parameter-conflicting create. Completed relevant subscriptions take
   precedence over stale open or expired Sessions left by the pre-fix flow.
2. Therapist and Practice retirement dependencies now require their exact
   expected Product names. Optional application and membership-level metadata
   may be absent for legacy Products, but contradictory metadata fails
   preflight before any mutation.

Initial focused RED command:

```text
node --test tests/stripe-billing.test.mjs tests/membership-checkout-route.test.mjs tests/stripe-supporter-membership-migration.test.mjs
```

Initial RED result: 56 tests, 50 passed, 6 failed. The failures proved
unserialized competing creates, missing open/completed Session reuse, missing
terminal-attempt key rotation, generic route handling before webhook
persistence, and missing legacy Product identity checks.

Two audit regressions were then added:

- Explicit `purpose=membership` metadata initially classified as unknown:
  21 tests, 20 passed, 1 failed before the classifier fix.
- A stale open Session initially outranked an older completed active
  subscription: 22 tests, 21 passed, 1 failed before the precedence fix.

Final validation:

- Focused billing, route, and migration command: 57/57 passed.
- `npm run test`: 1,429/1,429 passed across 157 suites.
- `npm run typecheck`: passed.
- `npm run lint`: passed, with only the existing large-file Babel
  deoptimization notes.
- `npm run build`: passed; Prisma generation, production compilation,
  TypeScript, and 101/101 static pages completed.
- `git diff --check`: passed, with only Git line-ending conversion warnings.

No schema migration, external network call, live Stripe/database inventory,
catalog mutation, deployment, or live smoke was performed. The operational
gates listed above remain required.

## Legacy Open Session Compatibility Follow-Up

Status: `DONE_WITH_CONCERNS`

Starting HEAD: `11eb2569433c208e5b7ab1a71c7a18a0d72b3a5a`

The compatibility review proved that purpose-less open legacy $9 Supporter,
Therapist, and Practice Sessions could be reused by the current Supporter
route. New Sessions now carry the non-secret
`supporter_membership_v1_checkout_v1` marker. Reuse requires exact customer and
user ownership, that marker, one of the six current configured Price IDs, the
expanded `supporter_membership_v1` Product and tax classification, Automatic
Tax, and required billing-address collection.

Every recognized incompatible open membership Session is expired with a
deterministic idempotency key and then re-retrieved. An ambiguous expiry POST is
accepted only when retrieval confirms `expired`; otherwise Checkout fails
closed. Purpose-less completed Sessions remain eligible for relevant active
subscription blocking before webhook persistence.

Focused RED:

```text
node --test tests/stripe-billing.test.mjs
```

Result: 27 tests, 22 passed, 5 failed for the missing version marker, legacy or
contradictory open Session reuse, missing ambiguous-expiry recovery, and missing
unconfirmed-expiry rejection. The completed historical blocking regression
passed as the compatibility behavior to preserve.

Focused GREEN:

```text
node --test tests/stripe-billing.test.mjs tests/membership-checkout-route.test.mjs tests/stripe-supporter-membership-migration.test.mjs
```

Result: 62/62 passed. Full validation is recorded below after the final gates.

Final validation:

- `npm run test`: 1,434/1,434 passed across 157 suites.
- `npm run typecheck`: passed.
- `npm run lint`: passed, with only the existing large-file Babel
  deoptimization notes.
- `npm run build`: passed; Prisma generation, production compilation,
  TypeScript, and 101/101 static pages completed.
- `git diff --check`: passed, with only Git line-ending conversion warnings.

No schema migration, external network call, live Stripe/database inventory,
catalog mutation, deployment, or live smoke was performed. The existing
operational rollout gates remain required.
