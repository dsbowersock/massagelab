# Release Checklist

Use this checklist before inviting real users or tagging/deploying an alpha build. Keep SOAP notes, intake forms, journals, ROM sessions, and other professional-record workflows local-first in all testing.

## Automated Gate

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

## Production Billing Gate

Before public paid signup, run the production Stripe readiness check from an explicit production env file:

```bash
npm run stripe:readiness -- --env-file=/secure/path/massagelab-production.env --live --verify-stripe
```

The command must pass without printing secret values. Then complete one real low-dollar live checkout and confirm:

- The Checkout session completes and returns to MassageLab.
- Membership status updates from the signed webhook.
- The Stripe Customer Portal opens for the customer and returns to MassageLab.
- The subscription is canceled or refunded as appropriate after the smoke test.
- The one-time donation path starts Stripe Checkout, returns to `/pricing`, and does not create a membership entitlement.

Latest status, 2026-06-24: the live Supporter subscription smoke passed with a new email/password account, Chimer custom-color entitlement access, Stripe Customer Portal access, and subscription cancellation. The one-time donation checkout smoke remains pending.

## Manual Focus Areas

- Account registration, Google sign-in, Terms/Privacy acceptance, onboarding, verification, password reset, 2FA, and preference sync.
- Pricing, one-time project support, live membership checkout, signed webhook delivery, customer portal, membership status, and feature entitlement checks such as `chimer_custom_colors` and `therapist_documentation_tools`.
- Homepage, `/tools`, business planner tools, Education flashcards, Anatomime shared sessions, Chimer, `/clock`, `/music`, `/wellness`, `/notes`, support, roadmap, legal/trust pages, account, security, and settings routes.
- Calendar practice creation, availability, public booking, waitlist, booking request, and conflict prevention.
- Local-first notes, intake, journals, ROM import/export, encrypted vault unlock, and plaintext export warnings.
- PWA metadata, offline fallback behavior, and the public-tool offline allowlist.
- Privacy expectations: no clinical content is uploaded during anonymous local-first or therapist professional-record workflows.

## Production Operating Checks

- Production runtime `DATABASE_URL` uses the Neon pooled host. Direct Neon URLs stay limited to migrations and maintenance paths.
- Production `robots.txt`, `sitemap.xml`, and metadata index only approved public pages. Preview/local deployments stay noindex.
- Auth flows, account/admin surfaces, APIs, public booking links, shared room-code URLs, and local professional-record subroutes stay out of the sitemap and crawler allowlist.
- Sentry remains limited to sanitized errors/traces and the approved user-initiated diagnostic report. Do not enable Session Replay, screenshots, attachments, logs, or standard feedback widgets before route-by-route privacy review.
- Monitor Neon transfer, Sentry issues, Stripe events, Vercel deployment health, and support email during the first invite window.
- Keep early-access discount enabled for the current invite window, and confirm it remains intentional before each broader share.

## External Confirmations

- Have the legal/trust documents reviewed by an attorney before broader public reliance.
- Keep invite messaging clear that MassageLab is an alpha, hosted PHI sync is unavailable, and therapist professional records remain in the local encrypted browser vault.
