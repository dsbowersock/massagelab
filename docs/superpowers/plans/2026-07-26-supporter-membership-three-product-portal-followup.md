# Supporter Membership Three-Product Portal Follow-up

## Goal

Preserve one user-facing MassageLab Supporter Membership with identical
entitlements while representing the three approved support amounts as three
Stripe Products:

- $1 monthly or $10 annually
- $2 monthly or $20 annually
- $5 monthly or $50 annually

This topology allows Stripe Customer Portal to offer all six choices without
placing duplicate recurring intervals on one Product.

## Executive behavior

- Amount changes stay self-service in Customer Portal.
- Cross-Product changes use `billing_cycle_anchor=unchanged`.
- Amount changes use `proration_behavior=none`.
- No amount change is scheduled for the end of the billing period.
- All three Products retain the same Supporter entitlement, tax code, and
  user-facing Product name. Product metadata identifies the support amount for
  operations and reporting.
- Therapist and Practice Products remain unavailable and are not repurposed.
- One-time support remains separate and grants no membership benefit.

## Recovery constraint

The previous live apply stopped after classifying the reusable Supporter
Product and creating all six approved Prices on it. It did not enable Portal
switching, retire legacy catalog objects, remove coupons, or change any
subscriber. Because Stripe Prices cannot move between Products, recovery must:

1. Reuse the classified Product and its $1 monthly/$10 annual Prices.
2. Create dedicated Products for the $2/$20 and $5/$50 choices.
3. Create replacement Prices under those Products while transferring their
   managed lookup keys.
4. Configure Portal with three Product entries, each containing one monthly
   and one annual Price.
5. Only after the Portal reread succeeds, retire the four wrong-owner Prices,
   the reviewed legacy Prices and Products, and the unused coupons.

Every write is reread before the next phase. A rerun must discover the managed
objects by metadata and idempotency contract and converge without duplicates.

## Implementation tasks

1. Extend migration configuration with explicit Product slots for the $2/$20
   and $5/$50 choices. Each accepts a concrete Stripe Product ID or the exact
   `CREATE_NEW` sentinel.
2. Assign each approved Price specification to one support-amount Product.
3. Validate exact Product metadata, exact Price ownership, and a three-entry
   Portal allowlist.
4. Treat managed Prices on the wrong support-amount Product as reviewed
   retirement candidates, never as reusable target Prices.
5. Accept the exact partially applied live state as forward-recoverable while
   continuing to reject unknown mixed states.
6. Update deployment and billing documentation to describe the three-Product
   Stripe representation without presenting three feature tiers to users.
7. Run focused migration tests, full repository validation, and PR review.

## Stop boundary

Open and shepherd the follow-up PR, but do not merge it. Do not resume live
Stripe apply or production environment changes until the user merges the PR
and explicitly continues the rollout.

## Live recovery checkpoint

After PR #146 merged, the official live verify passed and apply safely reached
the Portal reread gate. Stripe now contains the three classified amount
Products and the six correct active Prices, and the Portal's expanded
subscription-update Product list contains exactly those six Prices. No legacy
cleanup or runtime environment change occurred.

The ordinary Portal retrieve response omits
`features.subscription_update.products` because that field is expandable.
Migration inventory and post-write verification must request
`features.subscription_update.products` explicitly. Stripe's form encoder also
omits a nested JavaScript `conditions: []`, which leaves the dormant
`decreasing_item_amount` period-end rule unchanged. Use Stripe's empty-value
encoding for that condition list, then require Stripe's canonical reread to
report an empty list before cleanup resumes.

The next stop boundary is the recovery PR: validate and review this API-shape
fix, open the PR, and do not merge it. After the user merges and continues,
rerun apply with the same reviewed live dependencies, verify `COMPLETED`,
configure the six production Price IDs, run live readiness, and perform the
controlled Supporter smoke.
