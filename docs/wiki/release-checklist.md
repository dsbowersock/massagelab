# Release Checklist

Run the automated gate before tagging or deploying an alpha build:

```bash
npm run prisma:validate
npm run lint
npm run typecheck
npm run test
npm run build
```

Then walk [../alpha-qa.md](../alpha-qa.md) with anonymous test data.

## Manual Focus Areas

- Chimer timer, clock-only mode, fullscreen, alert, settings, font-size, and reduced-motion behavior.
- Local-first notes, intake, journals, and ROM import/export.
- Account registration, verification, password reset, 2FA, and preference sync.
- Calendar practice creation, availability, booking request, and conflict prevention.
- Navigation, PWA metadata, support, roadmap, account, security, and settings routes.
- Billing checkout in Stripe test mode, webhook delivery, account membership status, and Chimer custom-color gating.
- Privacy expectations: no clinical content is uploaded during anonymous local-first workflows.
