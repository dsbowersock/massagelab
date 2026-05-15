# Deployment And Environment

## Core Environment

Use Neon's pooled connection string for runtime Prisma Client connections:

```text
DATABASE_URL=
```

Use Neon's direct connection string for migrations:

```text
DIRECT_URL=
```

`DATABASE_URL_UNPOOLED` can be used as the direct-url fallback when Vercel's Neon integration provides it.

Auth configuration:

```text
AUTH_SECRET=
AUTH_URL=https://massagelab.app
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
TOTP_ENCRYPTION_KEY=
ADMIN_EMAILS=
```

SMTP configuration:

```text
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=MassageLab <no-reply@massagelab.app>
```

## Stripe

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_DONATION_URL=
MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED=true
STRIPE_SUPPORTER_MONTHLY_PRICE_ID=
STRIPE_SUPPORTER_YEARLY_PRICE_ID=
STRIPE_THERAPIST_MONTHLY_PRICE_ID=
STRIPE_THERAPIST_YEARLY_PRICE_ID=
STRIPE_PRACTICE_MONTHLY_PRICE_ID=
STRIPE_PRACTICE_YEARLY_PRICE_ID=
```

Free and Student are internal access states. Do not create a Stripe Free product.
Student is not a Stripe-backed subscription tier. If a Student product or price exists in Stripe, archive or disable it and do not place its Price ID in application configuration.

Before enabling subscription checkout, confirm:

- Supporter, Therapist, and Practice each have the intended monthly and yearly recurring Price IDs.
- The Stripe Customer Portal is enabled and configured for subscription management.
- `/api/billing/webhook` is registered with the Stripe webhook signing secret.
- Local and Vercel environments contain the same required Stripe keys and Price IDs for their respective test or live mode.

## Sentry

Sentry captures sanitized errors and traces only.

```text
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
MASSAGELAB_ENABLE_SENTRY_TEST_ROUTE=false
```

Do not enable Session Replay, User Feedback, or Logs until MassageLab has route-by-route privacy review, Sentry project scrubbing rules, and a written policy for clinical/local-first pages.

## Production Migrations

Run migrations as a deploy step before serving new code:

```bash
npm run prisma:migrate:deploy
```

Do not run migrations from `next build`.
