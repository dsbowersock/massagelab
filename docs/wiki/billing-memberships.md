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

## Student Access

Student access lasts 18 months from the student's first day of class.

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

Reserved for later:

- `documentation_customization`
- `anatomy_saved_progress`
- `education_premium_content`
- `practice_management`
- `cloud_storage`
- `phi_storage_tools`

Cloud storage and PHI-related tools must remain behind the separate compliance gates documented in [privacy-and-phi.md](privacy-and-phi.md).
