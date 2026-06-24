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
- `therapist_documentation_tools`

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

Therapist documentation surfaces should remain visible in the app so users can see what is available, but creating or viewing SOAP, intake, journal, ROM, and similar therapist note-taking records requires the `therapist_documentation_tools` entitlement. Supporter and Student access do not unlock these tools.

Membership messaging can explain that paid support helps fund future compliance-heavy documentation work, including voice notes, local transcription experiments, therapist-reviewed SOAP assistance, managed sync planning, BAAs, audit controls, and secure operating infrastructure. Keep that language separate from current benefits: memberships do not currently unlock hosted transcription, cloud SOAP drafting, HIPAA-ready sync, or any server-side PHI processing.

Pricing and legal copy should also say that MassageLab does not sell user data and does not use advertising to fund the project. The current funding posture is memberships, optional one-time support, and product revenue.

## Stripe Setup Checklist

- Create active Stripe recurring Products and Prices only for Supporter, Therapist, and Practice.
- Configure monthly and yearly Price IDs in the matching `STRIPE_*_PRICE_ID` environment variables.
- Enable Stripe Customer Portal for subscription management, payment method updates, invoices, and cancellation.
- Configure the webhook endpoint at `/api/billing/webhook` and subscribe it to Checkout Session and customer subscription lifecycle events.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the configured price IDs in local development and Vercel.
- Use the Stripe CLI in test mode to forward webhooks during local checkout testing.
- Before public paid signup, run `npm run stripe:readiness -- --env-file=/secure/path/massagelab-production.env --live --verify-stripe` against the production Stripe environment. The check must pass without printing secret values.

Current local workspace note from May 15, 2026: `.env.local` did not contain Stripe keys or price IDs during implementation planning, so local Checkout and webhook testing will fail until those values are added.
