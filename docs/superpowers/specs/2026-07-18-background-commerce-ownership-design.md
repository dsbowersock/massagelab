# Background Commerce And Permanent Ownership Design

**Date:** 2026-07-18

**Status:** Reviewed and approved for implementation planning

**Track:** 1 of 6, split into Tracks 1A and 1B

**Primary surfaces:** Background picker, Account/Billing, Stripe Checkout, billing webhooks

## Summary

Give every email-verified MassageLab account two non-expiring premium-background credits exactly once. A credit permanently unlocks one premium background and cannot be swapped. Verified users may also purchase multiple distinct premium backgrounds for a tax-exclusive `$1 USD` each through one persistent, account-backed cart. Purchased and redeemed backgrounds remain owned after a subscription ends.

Active subscribers continue to use every premium background through the existing `premium_backgrounds` feature entitlement. Subscription access and permanent ownership remain separate: subscribers may use an unowned premium background immediately and may optionally choose **Keep permanently** to redeem a credit or add it to their cart.

Track 1 establishes a generic transactional commerce core that can support later product types without implementing those products now. Immutable order snapshots, payment records, itemized refunds, disputes, and append-only commerce events provide auditability. Direct current-state wallet, cart, and ownership records remain the fast transactional authority; this is intentionally not a fully event-sourced system.

Implementation is split into two reviewable deliverables:

1. **Track 1A — Commerce and ownership foundation:** database schema, verified-account grants, permanent ownership, canonical access resolution, generic cart/order/payment infrastructure, Stripe Checkout, tax readiness, fulfillment, refunds, disputes, retirement, reconciliation, and operator controls.
2. **Track 1B — Background purchase surfaces:** locked-card decisions, subscriber acquisition, credits, compact cart, checkout-return states, owned card states, and Account/Billing history.

## Current State

- `User.emailVerified` is the canonical verification marker.
- Email-link verification, verified Google sign-in, and account-security flows can set that marker through different code paths.
- Auth sessions already expose `emailVerified`, role capabilities, and feature-key entitlements.
- `lib/membership.js` grants `premium_backgrounds` and `chimer_custom_colors` to active paid memberships.
- `hasPremiumBackgroundAccess` currently treats `chimer_custom_colors` as a compatibility shortcut for premium-background access.
- `StripeCustomer` and `MembershipSubscription` are the only current Stripe-backed account models.
- Membership Checkout, one-time donation Checkout, signed webhook processing, and the Stripe Customer Portal already exist.
- The webhook currently handles completed membership Checkout Sessions and subscription lifecycle events, but not product orders, delayed one-time payments, refunds, or disputes.
- The background registry is the canonical catalog of background identifiers, labels, availability, source, and premium metadata.
- There are no current wallet, credit, ownership, cart, order, order-item, payment, refund, dispute, or commerce-audit records.
- Account/Billing currently presents membership pricing, subscription status, and Customer Portal access.
- Track 2 defines the future immersive Clock/Visual/Background panel shell.
- Track 3 defines the shared carousel controller and presentation adapters.
- Track 4 depends on a real server-backed permanent-ownership resolver for ownership-based color access.

## Goals

- Grant exactly two unused credits to every verified account, including accounts verified before this feature lands.
- Let credits remain unused indefinitely and redeem any current or future premium background.
- Make redemption permanent, non-transferable, non-swappable, and concurrency-safe.
- Let verified users buy multiple distinct backgrounds in one Checkout at `$1 USD` each.
- Keep one cart account-backed across refreshes, routes, sign-outs, and devices.
- Let subscribers use premium backgrounds without ownership while retaining explicit permanent-acquisition choices.
- Preserve purchased and redeemed ownership after subscription cancellation.
- Revoke or suspend only the permanent ownership affected by refunds or disputes.
- Keep commerce, ownership, and access authority on the server.
- Establish generic cart, order, payment, refund, dispute, and audit contracts reusable by later sellable products.
- Keep the first fulfillment adapter and customer-facing UI limited to premium backgrounds.
- Provide trustworthy wallet, cart, ownership, order, refund, and dispute visibility in the picker and Account/Billing.
- Launch purchasing in the United States first while making country, tax, consent, currency, catalog, and fulfillment contracts extensible.
- Preserve user settings when access changes; lack of access must never delete saved background preferences.

## Non-goals

- Selling, designing, or fulfilling future product types in Track 1.
- Gifting or transferring credits, carts, purchases, or ownership.
- Allowing multiple ownership records for the same account and background.
- Change-of-mind refunds or a customer-facing self-service refund action.
- International purchasing at initial launch.
- Local-currency pricing at initial launch.
- Replacing subscription billing, donation Checkout, the Stripe Customer Portal, or hosted Stripe Checkout.
- Treating displayed plan names as authorization.
- Putting ownership or credit balances in the JWT session.
- Building a fully event-sourced commerce system with projection rebuilding.
- Letting Stripe metadata, the success redirect, browser storage, or card presentation grant access.
- Adding cart controls to the global top or bottom app bar.
- Replacing Track 2's immersive panel shell or Track 3's carousel presentations.
- Adding these implementation items to the public Roadmap.

## Approved Product Policy

### Credits

- Every registered account becomes eligible after email verification, regardless of subscription status.
- Existing verified accounts and future verified accounts receive exactly two credits.
- Credits do not expire.
- Credits can redeem any premium background available at redemption time, including backgrounds added later.
- Redemption permanently consumes one credit and creates non-swappable ownership.
- Subscribers may redeem credits while subscribed.
- Credits and ownership are account-bound and not transferable.

### Permanent purchases

- Each distinct premium background costs a tax-exclusive `$1 USD`.
- Ten backgrounds produce a `$10 USD` subtotal before applicable tax.
- Multiple backgrounds use one Checkout with itemized one-dollar order lines.
- Subscribers may buy backgrounds permanently while subscribed.
- Ownership remains active after subscription cancellation.
- Refunds and lost disputes revoke purchase-sourced ownership.

### Refunds

The default policy is final sale after immediate digital delivery. Refunds are limited to circumstances required by law and approved exceptions such as:

- duplicate charges;
- unauthorized charges;
- non-delivery; or
- unresolved material defects or material mismatch with the product description.

An operator must select the exact order items being refunded. A three-dollar partial refund revokes the three selected one-dollar ownerships; a full refund selects every remaining refundable item. Refund totals include attributable tax and come from order and Stripe data rather than operator-entered cents.

### Disputes

- A newly opened dispute suspends every purchase-sourced ownership from the disputed payment.
- Winning the dispute restores ownerships that were not separately refunded or retired.
- Losing the dispute permanently revokes them.
- Disputing a purchase never disables the user's account or unrelated purchases.
- Subscription access can still make a disputed background usable, but the background is not permanently owned while suspended or revoked.

### Catalog changes

- If an owned premium background becomes free, its ownership history remains and no refund or replacement credit is issued.
- If an owned background must be retired for licensing, security, or severe compatibility reasons, access is disabled with an explanation and exactly one replacement credit is granted.
- A legally required monetary refund takes precedence over the replacement-credit remedy.

## Track Boundary And Dependencies

### Track 1A: commerce and ownership foundation

Track 1A owns:

- generic commerce persistence and domain services;
- verified-account wallet provisioning and backfill;
- background-credit redemption;
- permanent-background ownership lifecycle;
- the canonical background-access resolver;
- persistent cart behavior and Checkout reservations;
- Stripe one-time Checkout, payment fulfillment, refunds, and disputes;
- digital-purchase legal acceptance and U.S. tax readiness;
- operator refund and reconciliation actions; and
- commerce observability and release readiness.

Track 1A must land before Track 4 integrates ownership-based color access.

### Track 1B: background purchase surfaces

Track 1B owns:

- locked-card acquisition decisions;
- subscriber **Keep permanently** behavior;
- credit confirmation and balance display;
- the compact cart inside the Background panel;
- picker card ownership, inclusion, reservation, and unavailable states;
- checkout-return states; and
- Account/Billing wallet, cart, ownership, order, refund, and dispute presentation.

Track 1B consumes the landed Track 2 panel shell and Track 3 carousel controller/presentation adapters. It must not create a second carousel, panel, access resolver, cart, or ownership cache.

### Other tracks

- Track 2 owns Clock, Visual, and Background panel layout and Music visualizer route context.
- Track 3 owns carousel controller behavior and visual presentation.
- Track 4 consumes `hasFeature("chimer_custom_colors") || ownsSelectedPremiumBackground` for color customization.
- Background renderers receive access-safe props and never import commerce, account, Stripe, or subscription modules.

## Architecture Decision

### Rejected: mutable counters with thin history

A simple `creditsRemaining` counter plus ownership rows would be easy to ship, but it would make verification grants, concurrent redemption, retirement replacement, corrections, and audits harder to prove. A counter alone cannot explain why a balance changed.

### Rejected: fully event-sourced commerce

A complete event-sourced system would require event schemas, version migrations, projection rebuilds, consistency handling, and operational tooling for every commerce query. That burden is not justified for the current catalog and team size.

### Selected: transactional current state plus append-only history

Use normalized current-state records for wallets, carts, orders, payments, and ownership. Write matching append-only credit and commerce history inside the same transactions. This design provides:

- strong invariants and direct queries;
- exact audit explanations;
- idempotent external-event handling;
- straightforward Account/Billing reads;
- product-independent cart/order/payment contracts; and
- a clean path for future catalog and fulfillment adapters.

## Data Model

Names may be reconciled with Prisma conventions during implementation, but the responsibilities and invariants are fixed.

### Generic commerce records

| Record | Responsibility | Core invariants |
| --- | --- | --- |
| `CommerceCart` | One persistent active cart per account | At most one active cart per user |
| `CommerceCartItem` | Generic catalog reference | Unique cart/product type/product key; no client price |
| `CommerceOrder` | Immutable checkout snapshot and state | Stable public ID; unique Stripe session; integer money fields |
| `CommerceOrderItem` | Product, name, price, tax allocation, and fulfillment snapshot | Immutable product key and price; one fulfillment result per item |
| `CommercePayment` | Processor payment state | Unique provider/payment identifier; totals reconcile to order |
| `CommerceRefund` | Processor refund state and reason | Unique provider/refund identifier; amount cannot exceed refundable total |
| `CommerceRefundItem` | Exact order items included in a refund | An order item cannot be refunded twice beyond its paid amount |
| `CommerceDispute` | Processor dispute lifecycle | Unique provider/dispute identifier; associated with one payment |
| `CommerceEvent` | Append-only domain audit history | Immutable; structured actor/source/reason; privacy-safe metadata |
| `CommerceWebhookReceipt` | External event deduplication | Unique provider/event ID |

`CommerceOrder` stores currency, subtotal, tax, total, purchase country, reservation expiry, validated internal return target, accepted legal-document IDs and versions, Stripe references, payment state, and fulfillment state. Payment and fulfillment states remain separate so a paid order cannot be mistaken for a fully fulfilled order.

`CommerceOrderItem` snapshots the product type, product key, display name, unit amount, quantity, currency, allocated tax, and fulfillment adapter version. Future catalog changes cannot rewrite historical orders.

### Background records

| Record | Responsibility | Core invariants |
| --- | --- | --- |
| `BackgroundCreditWallet` | Current atomic balance and update version | One per user; non-negative balance |
| `BackgroundCreditEntry` | Grants, redemptions, retirement replacements, and corrections | Append-only; unique idempotency key; signed delta |
| `BackgroundOwnership` | Permanent entitlement lifecycle | Unique user/background; acquisition source points to credit entry or order item |

Ownership records preserve history rather than being deleted. Required lifecycle distinctions include:

- active;
- suspended by dispute;
- suspended by pending refund;
- revoked by successful refund;
- revoked by lost dispute; and
- retired by catalog policy.

The model must allow restoration from a failed refund or won dispute without recreating or duplicating ownership.

### Money and privacy

- Store monetary amounts as integer minor units and currency as a normalized ISO code.
- Store original order and item totals even after refund or dispute transitions.
- Do not store card details, payment credentials, secrets, or unnecessary complete billing addresses.
- Stripe retains payment details and address evidence; MassageLab stores processor identifiers, calculated totals, purchase country, tax outcome, and legal evidence needed for fulfillment and reconciliation.
- Audit metadata uses structured identifiers and reason codes rather than free-form sensitive support content.

## Verified-Account Credit Provisioning

### Shared provisioning service

Create one idempotent server service that accepts a user ID and:

1. reloads the user from the database;
2. refuses provisioning when `emailVerified` is null;
3. creates the wallet, initial `+2` entry, and audit event in one transaction when absent; and
4. returns the existing wallet without another grant when provisioning already occurred.

The initial grant uses a stable unique idempotency key derived from the grant program and user ID.

### Verification paths

The email-link verification page, verified Google state setup, and any other flow that changes `emailVerified` call the shared provisioning service after verification succeeds. Registration itself does not grant credits.

Wallet and background-commerce snapshot reads also call an idempotent repair check. This is a correctness backstop for an interrupted deployment or a verification path introduced later; it is not a substitute for calling the shared service at the verification boundary.

### Existing-account backfill

Track 1A includes a rerunnable backfill that provisions every user whose `emailVerified` is non-null. Tests must prove:

- verified users receive exactly two credits;
- unverified users receive none;
- repeated execution does not change an existing balance; and
- a partial failure can be safely retried.

Credits do not expire. MassageLab does not yet ship account deletion, and durable commerce records follow the same conservative retention posture as `LegalAcceptance`: database relations restrict deleting a `User` while wallet, ledger, ownership, order, payment, refund, dispute, or commerce-audit rows remain. A later account-deletion branch must define lawful retention and transactional anonymization before it can remove that user; Track 1 neither cascades durable commerce history nor adds a transferable email-level benefit outside the account.

## Canonical Background Access Resolver

The resolver accepts registry metadata, feature entitlements, and current ownership state and returns one access-safe result per background.

Required output includes:

- `canUse`;
- `accessSource` (`free`, `subscription`, `ownership`, or `locked`);
- `isPermanentlyOwned`;
- ownership lifecycle status when relevant;
- `canCustomizeColors`;
- credit and purchase eligibility;
- active reservation state; and
- safe disabled reasons.

Premium use is defined as:

```ts
canUsePremiumBackground =
  hasFeature("premium_backgrounds") ||
  hasActivePermanentOwnership(backgroundId);
```

Color customization is defined separately:

```ts
canCustomizeBackgroundColors =
  hasFeature("chimer_custom_colors") ||
  hasActivePermanentOwnership(backgroundId);
```

Once the resolver lands, remove the current compatibility behavior that lets `chimer_custom_colors` stand in for `premium_backgrounds`. Active paid memberships already receive both keys, so subscriber behavior does not change.

Ownership and wallet state must not be placed in the JWT. Picker and Account/Billing loaders request current server state. Every mutation re-checks authority in its transaction. A client-owned card badge, local setting, or stale snapshot never grants access.

If ownership is suspended or revoked while a subscription remains active, `canUse` can still be true through `premium_backgrounds`, but `isPermanentlyOwned` is false and ownership-based benefits do not apply.

## Generic Catalog And Background Fulfillment Adapter

The commerce catalog is a server-only adapter registry keyed by stable product type. Track 1 implements the `background` adapter only.

The background adapter:

- reads active background definitions from the canonical registry;
- exposes only purchasable premium definitions;
- sets the server-authoritative price to 100 USD cents;
- supplies display and receipt snapshots;
- validates permanent-acquisition eligibility;
- grants, suspends, restores, revokes, or retires `BackgroundOwnership`; and
- produces access-cache invalidation targets.

Cart APIs accept only a product type and product key. They never accept a price, product label, ownership state, tax amount, or fulfillment instruction from the browser.

Future product types can provide new catalog and fulfillment adapters without changing the cart, order, payment, refund, dispute, or audit foundation. Track 1 does not add placeholder user interfaces or fulfillment logic for those future products.

## Persistent Cart

### Cart behavior

- One active cart belongs to one account.
- The cart survives refreshes, route changes, sign-outs, and device changes.
- A background appears at most once.
- Subscribers can cart unowned premium backgrounds even though they currently have subscription access.
- Cart reads and writes reconcile against current server catalog, ownership, and reservation state.
- Already-owned, free, retired, and unavailable items are removed with a structured explanation.
- Subscription inclusion does not remove an item because the subscriber may be acquiring permanent ownership.

### Reservation behavior

Checkout creates an immutable order snapshot and reserves its items for 30 minutes. During that reservation:

- reserved items remain visible;
- they cannot be removed, redeemed with a credit, or included in another checkout;
- one account may have only one active Checkout reservation;
- newly added items remain unreserved for a later checkout; and
- cancellation or expiration releases the reserved items without losing them.

This prevents a credit redemption on one device from racing a purchase on another.

## Checkout Lifecycle

### Preconditions

Starting Checkout requires:

- a signed-in account;
- current database-backed email verification;
- a reconciled non-empty cart;
- no active Checkout reservation;
- the current Digital Purchases and Refund Policy acceptance;
- explicit immediate-delivery/final-sale acknowledgment;
- a purchase country in the enabled country allowlist; and
- passing server and Stripe commerce-readiness checks.

Initial purchasing is enabled only for the United States. Currency remains USD. Country is modeled as an allowlist so later expansion does not change order or API contracts.

### Session creation

1. Reconcile and validate the cart.
2. Create an order and immutable order items in a database transaction.
3. Reserve those cart items until the order expiry.
4. Ensure the existing account-linked Stripe Customer is valid.
5. Create a hosted Stripe Checkout Session with a stable order-based idempotency key.
6. Send separate one-dollar line items with order and product reconciliation metadata.
7. Store the Checkout Session reference and advance the order to awaiting payment.
8. Redirect to Stripe.

If Stripe session creation fails, the order records the failure and releases its reservation without clearing the cart. If the process is interrupted after Stripe accepts the request, retrying the same idempotency key must recover the same session rather than creating a second charge opportunity.

Checkout does not allow customer-adjustable quantity or promotion-code input for background items.

### Cancellation and expiration

The cancellation return attempts to expire the Stripe Session before releasing items. Closing the browser leaves the reservation active until `checkout.session.expired` or the 30-minute lazy expiry repair releases it. A still-payable Stripe Session must never coexist with a released reservation for the same order.

### Fulfillment authority

The success redirect is a responsiveness aid, not payment authority. Fulfillment runs through one idempotent server service invoked by signed webhooks and optionally by the server-rendered return page.

The service:

1. retrieves or validates the Checkout Session and line items;
2. requires a paid state before fulfillment;
3. reconciles customer, order, amount, currency, and item snapshots;
4. upserts the payment record;
5. grants each order item through its fulfillment adapter;
6. records fulfillment and audit events;
7. removes fulfilled items from the active cart;
8. releases the reservation; and
9. invalidates account and background-access caches.

Delayed payment methods remain pending until `checkout.session.async_payment_succeeded`. `checkout.session.async_payment_failed` and expiry do not grant ownership. Repeated, concurrent, or out-of-order deliveries converge on one final result.

## Credit Redemption Lifecycle

The locked-card popup initiates redemption only after a second confirmation names the background and explains that one credit is permanently consumed.

The server requires a client idempotency key and, in one transaction:

1. verifies the account and current email verification;
2. resolves the current premium catalog definition;
3. rejects free, unavailable, retired, already-owned, or reserved backgrounds;
4. atomically decrements the wallet only when its balance is positive;
5. writes the matching `-1` credit entry;
6. creates active ownership sourced to that entry; and
7. records the audit event.

A duplicate request returns the original result. Concurrent requests cannot consume two credits for one background or make the wallet negative. Subscribers use the same service through **Keep permanently**.

## Refund Lifecycle

### Customer request

Customers do not receive a self-service refund control. Account/Billing links a purchase issue to the existing support flow with a non-sensitive order reference.

### Operator initiation

An authorized operator loads the order, selects exact refundable order items, chooses a structured exception reason, and confirms the calculated gross refund. The service derives item amounts and attributable tax from stored and Stripe data. It rejects arbitrary amounts, already-refunded items, unrelated orders, and unauthorized actors.

Initiation:

- creates a pending refund and selected refund-item records;
- suspends the affected ownerships;
- records actor, reason, and audit events; and
- calls Stripe with a refund-specific idempotency key and safe reconciliation metadata.

### Processor result

- A successful refund revokes the selected ownerships.
- A failed refund restores ownerships unless another independent state prevents restoration.
- A partial refund leaves unselected order items active.
- A full refund selects every remaining refundable item.
- Webhook and reconciliation handling are idempotent.

## Dispute Lifecycle

On a Stripe dispute-open event, suspend all active purchase-sourced ownerships fulfilled by the disputed payment. Do not suspend credit-sourced ownership, unrelated orders, the account, or subscription entitlements.

On dispute closure:

- restore eligible ownership when MassageLab wins or funds are reinstated;
- permanently revoke ownership when MassageLab loses; and
- preserve refund and retirement decisions that independently prevent restoration.

Out-of-order dispute events use processor timestamps and monotonic domain transitions so an older event cannot overwrite a newer final state.

## Retirement And Free Conversion

Changing an owned premium background to free affects access resolution but does not mutate the historical ownership or issue compensation.

Retirement is an explicit catalog/domain operation, not an incidental missing registry key. For each affected active owner, one transaction:

- marks ownership retired;
- writes one `+1` replacement-credit entry with a stable ownership-specific idempotency key;
- increments the current wallet;
- records the retirement reason and audit event; and
- invalidates access and Account/Billing caches.

Re-enabling and retiring the same definition again cannot repeat the replacement grant. If counsel or applicable law requires a cash refund, the refund lifecycle supersedes the replacement-credit remedy.

## Legal Acceptance And Refund Policy

Add a versioned Digital Purchases and Refund Policy distinct from membership billing terms. Before creating each Checkout Session, present an unchecked control that clearly states:

- the named digital backgrounds are delivered immediately after successful payment;
- individual purchases are final except where law requires otherwise and for the approved exception categories;
- refunded or disputed purchase ownership can be suspended or revoked; and
- the user expressly requests immediate digital delivery.

Record the accepted document IDs, versions, timestamp, and order association through the existing legal-acceptance machinery and immutable order snapshot. A receipt or post-payment page alone is too late to establish the pre-purchase disclosure.

The initial policy targets an Ohio-based seller launching U.S. purchasing. The order and legal contracts remain ready for country-specific consent. Before enabling jurisdictions such as the EU or UK, add the required express acknowledgment that immediate digital delivery ends any applicable change-of-mind withdrawal right and provide durable contract confirmation.

This design is product architecture, not a substitute for final legal review of production policy text.

## Tax And Geography

- The catalog price is 100 USD cents before tax.
- Applicable tax is added at Checkout, so ten items remain a `$10` subtotal.
- Stripe Checkout collects the customer location information required for calculation.
- Stripe Tax is enabled only after the applicable registration, tax settings, and product tax code are configured.
- MassageLab must not collect tax in an unregistered jurisdiction merely because the calculation API exists.
- Initial purchase-country allowlist is `US`.
- Additional countries require explicit review of registration, tax collection/remittance, consumer rights, consent text, supported payment methods, receipt requirements, and operational support.

Commerce readiness fails closed when production purchasing is enabled without the required Stripe, webhook, policy, country, tax, or catalog configuration.

## User Interface

### Background panel header

For verified accounts, the full-screen Background panel header always shows:

- remaining background credits; and
- a compact cart control with item count and subtotal.

The cart stays inside the Background panel and Account/Billing. It does not enter the global top or bottom bar.

Anonymous users may browse the same catalog. Acquisition actions route through sign-in or registration and preserve a validated internal return target to the originating picker.

### Card states

| State | Picker behavior |
| --- | --- |
| Free | **Select** |
| Permanently owned | **Owned** badge and **Select** |
| Subscriber access, unowned | **Included** badge, **Select**, and **Keep permanently** |
| Locked premium | Price and credit eligibility; **Select** opens the decision popup |
| Reserved | **Checkout pending**; acquisition actions disabled |
| Suspended or revoked | Not owned; subscription can still show **Included** |
| Retired | Removed from active picker; retained in Account/Billing history |

### Locked-card decision popup

Selecting a locked premium card opens a popup with the background preview, name, and exactly:

1. **Use free credit** — includes remaining count and remains visible but disabled at zero.
2. **Buy for $1** — adds the item to the persistent cart.
3. **Unlock all** — starts or routes to membership checkout with a safe return target.

The first action requires the permanent-use confirmation. The second updates the cart without forcing immediate Checkout.

### Subscriber acquisition

For an unowned premium background, subscriber **Select** uses the included background immediately. A separate **Keep permanently** action offers:

- **Use free credit**; and
- **Buy for $1**.

The UI never labels subscription inclusion as permanent ownership.

### Compact cart

The compact cart provides:

- preview, name, unit price, and removal per item;
- item count and subtotal;
- “tax calculated at checkout” disclosure;
- stale-removal and reservation explanations;
- purchase-country and legal-acceptance requirements; and
- Checkout, cancellation, pending, and expiry states.

Checkout is disabled for empty, unverified, invalid, or actively reserved carts.

### Account/Billing

Extend the existing membership/billing surface with:

- credits remaining;
- permanently owned count;
- cart count and subtotal;
- full cart management;
- an owned-background portfolio grid;
- acquisition source and date;
- active, suspended, revoked, and retired explanations;
- itemized order, tax, payment, refund, and dispute history; and
- a purchase-issue link to the existing support flow.

The portfolio and order history preserve records that no longer grant access.

### Checkout return

The order stores a validated internal origin. Success, pending, cancellation, and failure return to Clock, active Chimer, Music visualizer, or Account/Billing as appropriate. Successful fulfillment reveals the newly owned background immediately. Pending payment displays a non-blocking state until webhook confirmation.

## API And Module Boundaries

### Shared commerce services

The implementation should establish modules equivalent to:

- catalog resolution;
- cart reconciliation and mutation;
- order creation and state transition;
- fulfillment adapter dispatch;
- refunds and disputes;
- audit events;
- webhook receipts and dispatch; and
- reconciliation/readiness.

Existing Stripe helpers remain a processor adapter. Stripe objects do not become the internal domain model.

### Background commerce services

Background-specific services own:

- verified wallet provisioning;
- credit redemption;
- ownership lifecycle;
- background catalog mapping; and
- canonical access resolution.

They do not own panel layout, carousel input behavior, route-specific settings, or renderer internals.

### User-facing operations

Provide authenticated operations to:

- read one current background-commerce snapshot;
- add, remove, and reconcile cart items;
- redeem a credit;
- begin and cancel Checkout; and
- read an order result after Stripe return.

The snapshot includes only safe wallet, ownership, cart, reservation, and return-state data. Stable error codes include:

- `AUTH_REQUIRED`;
- `EMAIL_VERIFICATION_REQUIRED`;
- `BACKGROUND_UNAVAILABLE`;
- `ALREADY_OWNED`;
- `NO_CREDITS_REMAINING`;
- `ITEM_RESERVED`;
- `CART_RECONCILED`;
- `CHECKOUT_ALREADY_ACTIVE`;
- `PURCHASE_TERMS_REQUIRED`;
- `COMMERCE_NOT_READY`; and
- `PAYMENT_PENDING`.

### Operator operations

Authorized operator services can:

- read complete order/payment/fulfillment history;
- select refundable order items;
- initiate an approved refund;
- retry reconciliation; and
- apply a narrowly scoped audited correction.

Hidden UI is not authorization. Role/capability checks run server-side.

### Stripe webhook dispatch

The current webhook route continues to verify the raw signed body. It explicitly dispatches donation, membership, and commerce events by known purpose and identifiers. One flow cannot be interpreted as another or grant an unrelated entitlement.

Required commerce handling includes:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `checkout.session.expired`;
- current Stripe refund lifecycle events;
- `charge.dispute.created`;
- `charge.dispute.closed`; and
- reinstated-funds events relevant to restoration.

Exact event names must be rechecked against the repository's pinned Stripe API version during implementation.

## Security And Concurrency

- All commerce mutations require a signed-in, database-verified account.
- Every cart and order operation verifies ownership of the parent account record.
- Product eligibility, amount, currency, tax, refundable total, and access are server-derived.
- Wallet decrements use conditional atomic updates and paired ledger entries.
- Ownership uniqueness is database-enforced.
- Checkout creation, redemption, refund, and Stripe calls use stable idempotency keys.
- Webhook receipts and domain uniqueness make repeated deliveries safe.
- Safe-return validation permits only known internal routes and expected query state.
- Rate limits protect cart mutation, redemption, Checkout creation, order-status polling, and operator actions.
- Audit and error reporting follow the existing privacy-safe Sentry posture and never include payment secrets or full customer addresses.
- A mismatch in customer, order, line items, amount, currency, or paid state stops fulfillment and creates an operator-visible reconciliation problem.

## Accessibility And Resource Behavior

- Acquisition and confirmation dialogs trap focus, restore focus to the triggering card, support Escape, and expose descriptive titles.
- Wallet and cart changes use non-disruptive live announcements.
- Disabled actions expose the reason in text and accessible descriptions.
- Owned, included, locked, reserved, suspended, and revoked states do not rely on color alone.
- Keyboard and screen-reader users can inspect and invoke every card and cart action.
- Preview media follows reduced-motion and device-resource behavior established by Tracks 2–4.
- Payment and fulfillment polling backs off and stops on terminal states.

## Cache And Freshness Strategy

Current ownership and wallet state must be queryable without a new JWT. The background-commerce snapshot can use a short-lived server cache only if every grant, redemption, fulfillment, refund, dispute, restoration, retirement, and correction invalidates it.

Account/Billing and picker surfaces consume the same server domain. Client state may optimistically show a pending action, but the server response replaces it. Cross-device changes appear on refetch, focus, route entry, or explicit refresh.

## Error Handling And Recovery

- A stale cart is reconciled and returned with item-specific removal reasons rather than failing the whole read.
- A redemption conflict returns current wallet and ownership state without consuming another credit.
- A Stripe Session creation failure releases the reservation and preserves the cart.
- A paid order that cannot fulfill remains paid/unfulfilled and alerts reconciliation; it is never silently marked complete.
- A failed refund restores only ownership suspended by that refund.
- Out-of-order dispute events cannot reverse a newer terminal decision.
- Expired reservations are repairable through webhook, lazy access, and reconciliation.
- Reconciliation invokes the same idempotent domain services as normal processing. It must not patch tables directly.

## Operations And Observability

Track and alert on:

- paid but unfulfilled orders;
- amount, currency, customer, or item mismatches;
- reservations stuck past expiry;
- failed or pending refunds;
- dispute transitions;
- repeated webhook failures;
- impossible negative wallet balances;
- ownership records with missing acquisition sources; and
- processor records without a matching local order.

Provide a named, idempotent reconciliation command that inspects unresolved local orders against Stripe and reports or repairs them through domain services. Production readiness must verify Stripe secrets, webhook configuration, policy versions, country allowlist, tax configuration, product catalog, return URLs, and reconciliation access before enabling purchasing.

## Migration And Rollout

### Track 1A sequence

1. Add schema, constraints, domain enums, and typed contracts.
2. Add wallet provisioning and rerunnable verified-user backfill.
3. Add background ownership and the canonical resolver.
4. Cut over premium access from the compatibility shortcut to explicit feature/ownership resolution.
5. Add generic catalog, cart, reservation, order, payment, and audit services.
6. Add Stripe Checkout and idempotent fulfillment.
7. Add itemized refund, dispute, retirement, operator, and reconciliation flows.
8. Add legal/tax/readiness configuration.
9. Validate in Stripe test mode with purchasing disabled in production.
10. Land Track 1A before Track 4's ownership integration.

### Track 1B sequence

1. Add the shared background-commerce client/server snapshot boundary.
2. Integrate card states with Track 3's landed controller and adapters.
3. Add locked and subscriber acquisition dialogs.
4. Add credit confirmation and compact Background-panel cart.
5. Add Checkout return and pending-payment behavior.
6. Extend Account/Billing with wallet, cart, portfolio, and order history.
7. Complete accessibility, responsive, cross-device, and failure QA.
8. Run a controlled production purchase/refund smoke before public enablement.

Both subtracks preserve the user-owned `TODO.md` modification and exclude unrelated local changes from commits.

## Testing Strategy

### Domain and migration tests

- Initial grant for existing and newly verified accounts.
- No grant for unverified accounts.
- Rerunnable backfill and repair without duplicate credits.
- Atomic balance updates and append-only entries.
- Ownership uniqueness and source integrity.
- Free, subscription, owned, suspended, revoked, retired, reserved, and unavailable access matrix.
- Removal of the `chimer_custom_colors` premium-use shortcut without subscriber regression.

### Cart and order tests

- Persistence across sessions and devices.
- Duplicate item prevention.
- Reconciliation of owned, free, retired, and unavailable items.
- Subscriber permanent-acquisition items remain valid.
- One active reservation, 30-minute expiry, cancellation, and lazy repair.
- Ten distinct backgrounds produce a 1,000-cent subtotal.
- Manipulated client prices, totals, ownership flags, or return targets are rejected.
- Stripe session idempotency and recovery after interrupted creation.

### Fulfillment and reversal tests

- Paid, delayed-success, delayed-failure, cancelled, and expired Checkout.
- Duplicate and concurrent webhook delivery.
- Paid-but-unfulfilled mismatch handling.
- Partial and full refunds with exact item and tax allocation.
- Failed refund restoration.
- Dispute open, win, loss, and funds reinstatement.
- Out-of-order refund and dispute events.
- Subscription cancellation preserving permanent ownership.
- Subscription access during suspended ownership.
- Retirement replacement granted exactly once.
- Free conversion without compensation.

### Authorization and privacy tests

- Signed-out, unverified, wrong-account, and insufficient-operator-role rejection.
- Rate limits on sensitive operations.
- Raw webhook signature verification and external-event deduplication.
- Audit, logs, errors, and support links exclude secrets and sensitive payment/address data.
- Renderers and client card state cannot bypass server resolution.

### Interface and browser tests

- Locked decision popup has exactly the three approved actions.
- Zero-credit action remains visible with a disabled explanation.
- Subscriber **Select** and **Keep permanently** remain distinct.
- Cart updates, stale-item notices, legal consent, and reservation states are announced.
- Account/Billing reflects wallet, ownership, order, refund, dispute, and retirement state.
- Safe return to Clock, active Chimer, Music visualizer, and Account/Billing.
- Desktop, phone portrait, short landscape, 200% zoom, keyboard, screen reader, reduced motion, and resource-constrained previews.

### Release validation

Run focused tests throughout implementation, then require:

```powershell
npm run lint
npm run test
npm run typecheck
npm run build
npm run prisma:validate
npm run prisma:generate
```

Also run the Track 1 browser suite, Stripe readiness/reconciliation checks, migration/backfill verification, and a documented manual QA matrix.

## Acceptance Criteria

- Every existing and future verified account receives exactly two non-expiring credits.
- Registration without verification grants no credits.
- A confirmed redemption consumes one credit exactly once and creates permanent ownership.
- Credits can redeem future premium backgrounds.
- An account-backed cart survives sign-out and device changes.
- Cart reconciliation removes invalid permanent-acquisition items with explanations.
- One checkout can purchase multiple distinct backgrounds at `$1 USD` each.
- Ten items produce a `$10 USD` subtotal before applicable tax.
- A 30-minute reservation prevents credit/purchase races.
- Stripe payment fulfillment is signed, server-authoritative, and idempotent.
- Purchased and redeemed ownership survives subscription cancellation.
- Subscribers can use unowned premium backgrounds and separately acquire them permanently.
- Partial refunds revoke only selected items; full refunds revoke all selected remaining items.
- Disputes suspend the order's purchase ownership and restore or revoke it according to outcome.
- Retirement grants exactly one replacement credit; free conversion grants none.
- Picker and Account/Billing show accurate credits, cart, ownership, subscription inclusion, order, refund, and dispute state.
- Track 4 receives permanent ownership from the canonical resolver and does not create another store.
- No client, Stripe redirect, stale cache, or duplicate external event can create free or duplicate ownership.
- Production purchasing remains disabled until legal, tax, Stripe, webhook, catalog, reconciliation, and QA readiness pass.
