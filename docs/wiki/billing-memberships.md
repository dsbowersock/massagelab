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
- Stripe subscription records grant membership only when their Price ID matches one of the configured Supporter, Therapist, or Practice price environment variables.
- Student, donation, unknown, archived, or otherwise unmapped Stripe products and prices must not grant a paid membership.

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

## Feature Keys

Current:

- `chimer_custom_colors`
- `calendar_basic_scheduling`
- `calendar_full_scheduling`
- `calendar_team_scheduling`

Reserved for later:

- `documentation_customization`
- `anatomy_saved_progress`
- `education_premium_content`
- `practice_management`
- `external_calendar_sync`
- `cloud_storage`
- `phi_storage_tools`

Cloud storage and PHI-related tools must remain behind the separate compliance gates documented in [privacy-and-phi.md](privacy-and-phi.md).

Frontend copy may call the `PRACTICE` membership tier `Team/Practice` for clarity. Keep code checks feature-based instead of branching on the displayed plan label.

## Stripe Setup Checklist

- Create active Stripe recurring Products and Prices only for Supporter, Therapist, and Practice.
- Configure monthly and yearly Price IDs in the matching `STRIPE_*_PRICE_ID` environment variables.
- Enable Stripe Customer Portal for subscription management, payment method updates, invoices, and cancellation.
- Configure the webhook endpoint at `/api/billing/webhook` and subscribe it to Checkout Session and customer subscription lifecycle events.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the configured price IDs in local development and Vercel.
- Use the Stripe CLI in test mode to forward webhooks during local checkout testing.

Current local workspace note from May 15, 2026: `.env.local` did not contain Stripe keys or price IDs during implementation planning, so local Checkout and webhook testing will fail until those values are added.
