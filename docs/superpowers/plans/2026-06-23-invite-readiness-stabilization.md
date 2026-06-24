# Invite Readiness Stabilization

Date: 2026-06-23

## Goal

Get MassageLab to a stable, explicit checkpoint for inviting a small first cohort of real users while preserving the current private-alpha safety boundaries. This is a stabilization gate, not a feature-expansion branch.

## Target Invite Window

- Audience: a small invited cohort, roughly the same 30 to 80 user scale assumed by the launch hardening work.
- Product posture: public tools, education, wellness practice tools, booking, account, and membership flows may be exercised by real users.
- Clinical posture: SOAP, intake, journal, ROM, transcripts, and therapist professional-record workflows stay local-first. Hosted clinical sync and server-side PHI processing remain unavailable.

## Readiness Tracks

1. Repo and release gate
   - Refresh the release checklist so it reflects the current live-billing, legal-acceptance, SEO, support, PWA, and local-first boundaries.
   - Pass the normal automated gate: `npm run prisma:validate`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `git diff --check`.
   - Run focused browser smoke coverage for invite-critical anonymous, registration, onboarding, pricing, legal, tools, education, wellness, music, notes, and support routes.

2. Signup, onboarding, and billing
   - Confirm email/password registration records current Terms and Privacy acceptance.
   - Confirm Google sign-in routes through the registration legal gate before onboarding or the preserved callback when current acceptance is missing.
   - Run `npm run stripe:readiness -- --env-file=/secure/path/massagelab-production.env --live --verify-stripe` against production values without printing secret values.
   - Keep the one-time support path separate from subscriptions so donations do not grant membership entitlements.
   - Complete one low-dollar live checkout, verify membership status, open the Customer Portal, return to the app, then cancel or refund as appropriate.

3. Production operating guardrails
   - Confirm production runtime `DATABASE_URL` uses the Neon pooled host and migrations use a direct URL only from the deploy/maintenance path.
   - Avoid Prisma Studio, seed scripts, full-table exports, and broad anatomy/media maintenance scripts against production during the invite window.
   - Keep Sentry limited to sanitized errors and the approved `/api/support/problem-report` diagnostic path. Do not enable replay, screenshots, attachment upload, logs, or standard user feedback widgets.
   - Monitor Neon transfer, Sentry issues, Stripe events, Vercel deploy health, and support email during the first invite window.

4. Public discovery and trust
   - Keep production public metadata, `robots.txt`, and `sitemap.xml` limited to the approved public SEO route contract.
   - Keep preview/local deployments noindex.
   - Confirm auth, account, admin, API, public booking links, shared room-code URLs, and local professional-record subroutes remain out of the sitemap and crawler allowlist.
   - Have the legal/trust pages reviewed by an attorney before relying on them for broader public distribution.

5. Invite cohort operations
   - Invite users with clear alpha expectations: things may change, paid support funds future work, and hosted PHI/clinical sync is not available.
   - Tell therapist users that professional records stay in their browser vault and require their local passphrase.
   - Keep the first invite wave small enough to watch support, Stripe, Neon, Sentry, and onboarding behavior manually.

## Non-Goals

- Avoid adding Stripe Connect, external calendar sync, Payload CMS, hosted clinical storage, voice transcription, SOAP AI, or 3D/spatial runtime tooling in this stabilization pass.
- Do not document or commit secrets, database rows, connection strings, Stripe keys, webhook secrets, or production env files.
- Keep local-first therapist records out of account-synced data.

## Acceptance

- The release checklist is current for invited-user readiness.
- The repo-owned automated checks pass on the stabilization branch.
- Production Stripe readiness is verified from a user-provided production env file.
- The final low-dollar live checkout and portal smoke is completed and recorded without storing card or secret details.
- Remaining blockers are explicit external confirmations, such as attorney review or user-run payment smoke steps, not hidden repo gaps.

## Branch Progress

- 2026-06-23: Created the invite-readiness stabilization branch and refreshed the release checklist, project state, and project log around the current invited-user gate.
- 2026-06-23: Passed repo-owned local validation with `npm run prisma:validate`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium`, and `git diff --check`.
- 2026-06-23: With user approval, pulled Vercel Production env names into a local env file, but Vercel CLI exposed zero-length values for all checked Production variables. `vercel env run -e production` from a temporary linked directory showed the same local CLI behavior. Vercel Production variables may be sensitive/non-viewable while still being available to Vercel build/runtime, so local Stripe readiness remained blocked until live values were supplied in a usable local env file or verified from inside the deployment environment.
- 2026-06-23: After live values were supplied in a local env file, the production Stripe readiness check passed against Stripe. The only readiness warning was that the early-access discount is enabled in live mode and should be intentional before public signups.
- 2026-06-23: Confirmed the early-access discount should remain enabled for now, added an app-owned one-time donation Checkout path on `/pricing`, and strengthened membership/legal copy so current benefits are separated from roadmap funding goals, no advertising, and no data-sale funding.
- Pending: one real low-dollar checkout plus Customer Portal return smoke, one live donation checkout smoke, attorney review of legal/trust documents, and first-cohort production monitoring.
