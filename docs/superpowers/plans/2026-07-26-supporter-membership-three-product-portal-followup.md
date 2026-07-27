# Supporter Membership Three-Product Portal Follow-up

> **Status: completed; historical record.** The migration and both recovery
> checkpoints below are complete and superseded as operator instructions.
> Current Production catalog operations are verify-only: require
> `npm run stripe:migrate-supporter-membership -- --mode=verify` to report
> `COMPLETED`, and do not run `apply`. Any other result must stop and receive a
> separately reviewed, incident-specific recovery plan before mutation.

## Completed topology

Preserve one user-facing MassageLab Supporter Membership with identical
entitlements while representing the three approved support amounts as three
Stripe Products:

- $1 monthly or $10 annually
- $2 monthly or $20 annually
- $5 monthly or $50 annually

This topology allows Stripe Customer Portal to offer all six choices without
placing duplicate recurring intervals on one Product.

## Current topology contract

- Amount changes stay self-service in Customer Portal.
- Cross-Product changes use `billing_cycle_anchor=unchanged`.
- Amount changes use `proration_behavior=none`.
- No amount change is scheduled for the end of the billing period.
- All three Products retain the same Supporter entitlement, tax code, and
  user-facing Product name. Product metadata identifies the support amount for
  operations and reporting.
- Therapist and Practice Products remain unavailable and are not repurposed.
- One-time support remains separate and grants no membership benefit.

## Historical recovery constraint (completed)

The previous live apply stopped after classifying the reusable Supporter
Product and creating all six approved Prices on it. It did not enable Portal
switching, retire legacy catalog objects, remove coupons, or change any
subscriber. Because Stripe Prices cannot move between Products, the completed
recovery required:

1. Reuse the classified Product and its $1 monthly/$10 annual Prices.
2. Create dedicated Products for the $2/$20 and $5/$50 choices.
3. Create replacement Prices under those Products while transferring their
   managed lookup keys.
4. Configure Portal with three Product entries, each containing one monthly
   and one annual Price.
5. Only after the Portal reread succeeds, retire the four wrong-owner Prices,
   the reviewed legacy Prices and Products, and the unused coupons.

The completed recovery reread every write before the next phase and discovered
managed objects by metadata and idempotency contract so interrupted runs could
converge without duplicates.

## Historical implementation tasks (completed)

The completed follow-up performed these tasks; this list is not an active
operator checklist:

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

## Historical stop boundary (superseded)

This was the pre-migration review boundary. The follow-up PRs were merged and
the migration completed. It no longer authorizes `apply` or any Production
catalog mutation.

## Historical first live recovery checkpoint (superseded)

After PR #146 merged, the official live verify passed and apply safely reached
the Portal reread gate. Stripe now contains the three classified amount
Products and the six correct active Prices, and the Portal's expanded
subscription-update Product list contains exactly those three Products with
their six nested Prices. No legacy cleanup or runtime environment change
occurred.

The ordinary Portal retrieve response omits
`features.subscription_update.products` because that field is expandable.
Migration inventory and post-write verification requested
`features.subscription_update.products` explicitly. The JavaScript SDK's form
serialization also omits a nested `conditions: []` before the request is sent,
which leaves the dormant `decreasing_item_amount` period-end rule unchanged.
The completed recovery sent
`features.subscription_update.schedule_at_period_end.conditions` as the empty
string (`conditions: ""`), matching the migration payload and its request-shape
test, and required Stripe's canonical reread to report an empty list before
cleanup resumed.

This was the historical stop boundary before the second recovery merged. It is
superseded by the completed state below and does not authorize a new apply.

## Historical second live recovery checkpoint (superseded)

PR #147 merged and its production deployment became ready. Identifier-safe
live inventory still showed the exact target three-Product/six-Price Portal
topology with the dormant `decreasing_item_amount` schedule condition, while
all legacy cleanup candidates and both coupons remained untouched.

The post-merge apply stopped before mutation because preflight classified that
exact new-topology plus old-schedule state as an arbitrary mixed state. The
reviewed second recovery was apply-only and accepted no broader subset: all
target Products and Prices had to match, every cleanup Price and Product had to
remain active, and both verified zero-redemption coupons had to exist. It
updated and canonically reread the Portal before retiring a Price, Product, or
coupon. Verify rejected the intermediate until the entire migration reached
`COMPLETED`.

## Current completed state and remaining smoke

The second recovery merged and the guarded live apply/verify reached
`COMPLETED`. Production now uses the exact three-Product/six-Price Supporter
catalog, immediate no-proration Portal switching, recurring Automatic Tax, and
the pinned webhook contract.

The first controlled Supporter smoke on July 27 did not reach Stripe. A form
submitted from the valid `www.massagelab.app` alias was rejected because the
origin guard compared it only with the configured apex origin. Identifier-safe
database, Vercel, and Stripe checks confirmed that the attempt created no legal
acceptance, Stripe Customer, Checkout Session, subscription, or charge.

Current catalog operation is verify-only: run the migration command in verify
mode, require `COMPLETED`, and do not run `apply` or mutate catalog or Portal
state. If verification returns any other state, stop and create a separately
reviewed, incident-specific conditional recovery plan before mutation. After
the checkout-origin repair merges and deploys, retry only the controlled
Supporter smoke and verify taxed Checkout, webhook persistence, Supporter
entitlements, and Portal switching and cancellation. This validation does not
authorize catalog or Portal-configuration cleanup. Any such mutation requires
a separately reviewed, incident-specific recovery plan and explicit approval.
