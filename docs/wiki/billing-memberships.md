# Billing And Memberships

MassageLab uses feature-based access. Code should ask whether a user has a feature, not whether the user has a named plan.

Do not write access checks like this:

```ts
if (user.plan === "Therapist") {
  // ...
}
```

Use feature checks instead:

```ts
if (features.includes("chimer_custom_colors")) {
  // ...
}
```

## Current Access Model

- Free access is the default when a user has no active paid subscription.
- Free is not a Stripe product.
- Student access is internal to MassageLab and is not a Stripe subscription.
- Supporter, Therapist, and Practice are paid Stripe-backed membership levels.
- The first paid feature key is `chimer_custom_colors`.
- Therapist note-taking tools use the `therapist_documentation_tools` feature key and are unlocked only by active Therapist or Practice memberships.
- External provider calendar sync uses the `external_calendar_sync` feature key and is unlocked only by active Therapist or Practice memberships.
- Stripe subscription records grant membership only when their Price ID matches one of the configured Supporter, Therapist, or Practice price environment variables.
- Student, donation, unknown, archived, or otherwise unmapped Stripe products and prices must not grant a paid membership.

## One-Time Support

The `/pricing` page offers fixed one-time support amounts through `/api/billing/donation`.

- Donations use Stripe Checkout `mode=payment`, not subscription mode.
- Donations do not create a membership, unlock paid features, or change entitlements.
- Donation Checkout metadata uses `massagelab_project_support` so webhook reconciliation can ignore it for membership grants.
- Donation copy should explain that one-time support funds development, secure infrastructure, compliance review, BAA/vendor work, audit controls, and operating costs for future privacy-preserving storage.

## Student Access

Student access lasts 18 months from the student's first day of class.

Do not wire Student into Stripe Checkout. If a Student product or price exists in a Stripe test or live account, archive it or leave it disabled so it cannot be selected by the app.

MassageLab stores:

- `studentStartDate`
- `studentAccessExpiresAt`
- `studentStatus`
- `eligibleForTherapistDiscount`

Students can upgrade to Therapist during or after the student window with the Student to Therapist coupon.

## Coupons

- `kfRFWYmC`: Student to Therapist 20% Discount, forever.
- `E6lYinBx`: Early Access 10% Discount, forever.

The early access discount is controlled by `MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED`. When the site is production-ready, turn this flag off so new subscribers no longer receive the early access discount. Existing subscribers who used it keep it until they cancel.

Current invite-window decision: keep the early access discount enabled for now.

## Feature Keys

Current:

- `chimer_custom_colors`
- `calendar_basic_scheduling`
- `calendar_full_scheduling`
- `calendar_team_scheduling`
- `external_calendar_sync`
- `therapist_documentation_tools`

Reserved for later:

- `documentation_customization`
- `anatomy_saved_progress`
- `education_premium_content`
- `practice_management`
- `cloud_storage`
- `phi_storage_tools`

Cloud storage and PHI-related tools must remain behind the separate compliance gates documented in [privacy-and-phi.md](privacy-and-phi.md).

Frontend copy may call the `PRACTICE` membership tier `Team/Practice` for clarity. Keep code checks feature-based instead of branching on the displayed plan label.

Therapist documentation surfaces should remain visible in the app so users can see what is available, but creating or viewing SOAP, intake, journal, ROM, and similar therapist note-taking records requires the `therapist_documentation_tools` entitlement. Supporter and Student access do not unlock these tools.

Membership messaging can explain that paid support helps fund future compliance-heavy documentation work, including voice notes, local transcription experiments, therapist-reviewed SOAP assistance, managed sync planning, BAAs, audit controls, and secure operating infrastructure. Keep that language separate from current benefits: memberships do not currently unlock hosted transcription, cloud SOAP drafting, HIPAA-ready sync, or any server-side PHI processing.

Pricing and legal copy should also say that MassageLab does not sell user data and does not use advertising to fund the project. The current funding posture is memberships, optional one-time support, and product revenue.

## Stripe Setup Checklist

- Create active Stripe recurring Products and Prices only for Supporter, Therapist, and Practice.
- Configure monthly and yearly Price IDs in the matching `STRIPE_*_PRICE_ID` environment variables.
- Enable Stripe Customer Portal for subscription management, payment method updates, invoices, and cancellation.
- Configure the pinned `/api/billing/webhook` endpoint as enabled on the
  app's `2026-02-25.clover` Stripe API version with exactly the combined
  membership and background-commerce event contract below.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the configured price IDs in local development and Vercel.
- Use the Stripe CLI in test mode to forward webhooks during local checkout testing.
- Before public paid signup, run `npm run stripe:readiness -- --env-file=/secure/path/massagelab-production.env --live --verify-stripe` against the production Stripe environment. The check must pass without printing secret values.

Current local workspace note from May 15, 2026: `.env.local` did not contain Stripe keys or price IDs during implementation planning, so local Checkout and webhook testing will fail until those values are added.

## Permanent Background Commerce

Track 1A provides the server-owned commerce foundation for one-time permanent
background access. It is separate from memberships and donations:

- every verified account receives exactly two background credits once, through
  one idempotent wallet/ledger grant;
- a credit redemption or paid order creates permanent database ownership;
- an active subscription can grant subscription access and does not block a
  separate permanent purchase;
- `chimer_custom_colors` remains a color-customization feature and is not proof
  of permanent premium-background ownership; and
- browser state, JWT claims, Checkout return URLs, and selected UI cards never
  grant ownership. Signed-in surfaces read the no-store commerce snapshot, and
  purchase returns wait for webhook-backed database ownership before showing
  an acquisition as complete.

### Purchase Surfaces And Guest Checkout

Track 1B presents the same commerce state in the Clock, active Chimer, and Music
visualizer Background picker. Locked cards offer `Use free credit`, `Buy for
$1`, and `Unlock all`; subscribers select included backgrounds normally and
can use `Keep permanently` as a separate action. The picker contains a compact
cart, while Account/Billing contains the wallet, permanent portfolio, orders,
reversals, and a privacy-safe support entry.

A signed-out user may add current purchasable backgrounds to a guest intent
cart. That cart stores only validated background product IDs in the current
browser. It stores no account data, price authority, credit balance,
reservation, payment, or ownership. The cart offers sign-in and account
creation at checkout. After authentication, each remaining ID is revalidated
and merged through the authenticated Track 1A cart API before purchase consent
or Stripe Checkout can begin. Account carts persist across devices; a guest
cart remains limited to its originating browser until that merge occurs.

The conditional global site-purchase cart trigger appears only while a guest
or account cart has items, or while an account Checkout reservation is active.
It opens the shared cart, stays absent from `/calendar` and nested Calendar
routes, and remains semantically separate from provider services and sales.
Only server-confirmed credit redemption or webhook fulfillment grants access.

### Deployment And Backfill Order

Keep purchasing disabled while deploying Track 1A:

1. point `DATABASE_URL`, `DIRECT_URL`, and `DATABASE_URL_UNPOOLED` at the exact
   intended database, with a direct non-pooler URL for migrations;
2. run `npm run prisma:migrate:deploy`;
3. set `BACKGROUND_CREDIT_BACKFILL_DATABASE_URL` to the same direct Neon branch
   and run `npm run commerce:backfill-credits`;
4. run the backfill again; the second pass must grant zero additional wallets;
5. run `npm run commerce:reconcile` in its default read-only mode; and
6. configure and pass Stripe readiness before setting
   `BACKGROUND_COMMERCE_PURCHASING_ENABLED=true`.

The migration never grants credits. Normal email-verification and account-state
loading use the same provisioner for accounts verified after the backfill.

### Fail-Closed Readiness Contract

`npm run stripe:readiness` preserves the membership checks and additionally
requires these explicit background-commerce values without printing secrets:

- `BACKGROUND_COMMERCE_PRICE_CENTS=100` and
  `BACKGROUND_COMMERCE_CURRENCY=usd`;
- `BACKGROUND_COMMERCE_PURCHASE_COUNTRIES=US`;
- `BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION=2026-07-digital-purchases-v1`;
- `BACKGROUND_COMMERCE_WEBHOOK_READY=true` and
  `BACKGROUND_COMMERCE_RECONCILIATION_READY=true`;
- `BACKGROUND_COMMERCE_WEBHOOK_EVENTS` covering exactly the implementation's
  Checkout, refund, and dispute contract below; and
- `BACKGROUND_COMMERCE_TAX_MODE=stripe`;
- `BACKGROUND_COMMERCE_TAX_PRODUCT_CODE` set to the reviewed Stripe Tax code
  for permanent digital backgrounds;
- `BACKGROUND_COMMERCE_TAX_PROVIDER_READY=true` only after Stripe Tax has the
  business origin/head-office configuration required for calculation; and
- `BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY=true` only after the applicable
  tax registrations, beginning with Ohio, are active in Stripe.

Current checkout is U.S.-only and fixed at one U.S. dollar per background.
Paid readiness fails closed when tax is disabled, the product tax code is
missing, or provider/registration readiness has not been explicitly confirmed.
Checkout uses exclusive automatic tax, requires a billing address, and saves
the entered address to the existing Stripe Customer. A completed paid Session
must report automatic-tax status `complete`, zero discounts and shipping, the
configured tax code and exclusive behavior on every line, and internally
consistent subtotal/tax/total amounts. The webhook transaction freezes
processor tax into `CommerceOrder.taxCents`, `CommerceOrder.totalCents`,
`CommerceOrderItem.allocatedTaxCents`, and each item total before payment and
ownership fulfillment. Any mismatch moves the order to operator review without
granting ownership.

The readiness booleans are operator attestations, not proof of registration or
taxability. Keep `BACKGROUND_COMMERCE_PURCHASING_ENABLED=false` until the
business origin, Ohio registration, and reviewed product tax code are complete
in Stripe and have passed a test-mode taxed Checkout/fulfillment smoke.

The pinned `/api/billing/webhook` endpoint must subscribe to:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

The same endpoint must also subscribe to the membership contract:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`

Verify mode checks the pinned production URL rather than trusting the local
readiness signal alone. It requires `status=enabled`, the exact app API version
`2026-02-25.clover`, and equality with this combined 15-event set. Missing
events, extra events, duplicates, and Stripe's `*` wildcard all fail readiness.
`BACKGROUND_COMMERCE_WEBHOOK_EVENTS` remains the exact ten-event
background-commerce subset because membership events are not deployment values
for that commerce-only signal.

### Refunds, Disputes, Retirement, And Reconciliation

Permanent digital-background sales are final by default, subject to applicable
law and a narrow operator exception for duplicate charges, non-delivery, or
another documented correction. Full account admins may initiate only an exact
selected order-item refund. Anatomy-only administration is not commerce
authority. Refunds never rewrite credit ownership or silently issue a credit;
the final-sale exception retains the order, payment, refund, ownership, and
identifier-only audit history.

Pending refunds suspend only the selected purchase ownership. Successful
refunds revoke those exact items; failed refunds restore only otherwise-eligible
items. An open dispute suspends purchase ownership from its payment, a won
dispute restores eligible access, and a lost dispute revokes remaining purchase
access. Retiring an actively owned paid background preserves ownership history
and issues one idempotent replacement credit; unowned, free-conversion, and
legal-refund cases receive no duplicate replacement.

Run `npm run commerce:reconcile` without `--repair` for identifier-only,
read-only drift reporting. Repair mode is limited to resuming the stable
idempotency boundary for an unresolved pending refund; ownership and aggregate
drift remain operator-review findings rather than heuristic repairs. Audit JSON
must never contain raw Stripe objects, secrets, email addresses, IP addresses,
user-agent strings, or card/payment-method data.
