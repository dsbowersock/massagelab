# MassageLab Project State

Verified: 2026-05-27

This is the read-first source of truth for MassageLab's current project state. Use it before `docs/project-log.md`, `docs/roadmap.md`, `TODO.md`, audits, or wiki pages when deciding what is active now.

## Current Snapshot

- Status: private alpha.
- Active branch at last verification: `codex/plan_update`.
- Current focus: consolidate planning and progress tracking, then continue anatomy content review and expansion.
- Product posture: clinical notes, intake forms, journals, ROM sessions, and other PHI-bearing workflows remain local-first. Hosted clinical sync remains gated and unimplemented until compliance requirements are met.
- Public `/roadmap` route: product-facing copy only. Internal operating state lives here and in `docs/project-log.md`.

## Database State

- Database stack: Prisma with Neon/Postgres.
- Last verified checks: `npm run prisma:validate` passed and `npx prisma migrate status` reported the configured database schema is up to date.
- Migration count at last verification: 19 migrations.
- Latest migration area: anatomy 3D/spatial body-map foundation and movement-visualization integrity.
- Do not document database rows, secrets, connection strings, or `.env.local` values in project docs.

## Website And Tool Surface

- Public app shell: home, support, pricing, public roadmap, about, login/register, password reset, and email verification.
- Chimer: treatment-room timer and clock mode, with custom colors gated by `chimer_custom_colors`.
- Local-first notes: SOAP notes, intake, journal, and ROM routes save locally unless a user explicitly exports.
- Calendar and booking: operator calendar workspace, appointment/class/personal/reminder creation, service catalog, availability, booking settings, public booking links, guest-capable booking, waitlist, and provider capacity controls.
- Accounts and billing: profile/preferences, security settings, role verification, membership status, Stripe Checkout, Stripe portal, and signed webhook foundation.
- Anatomy and education foundation: Anatomime, admin anatomy browser, anatomy correction workflow, code-backed seed content, Postgres anatomy tables, anatomy media catalog/provenance, R2 media workflow docs, and 3D/spatial mapping schema.
- PWA/offline: offline support is intentionally limited to anonymous public local tools; account, auth, billing, calendar, booking, clinical sync, client, and `/api/*` surfaces remain online-only.

## Open Priorities

- P1: Keep this file and `docs/project-log.md` current when meaningful project state changes.
- P2: Review and expand anatomy content, sources, citations, media coverage, 3D/spatial mappings, and admin review workflows.
- P2: Scope trust pages and public identity: terms, privacy/legal, About Me, and launch-ready public trust copy.
- P2: Plan external Google/Apple/Outlook calendar sync before implementation.
- P2: Plan Stripe Connect marketplace payments before booking payment collection.
- P2: Plan Payload CMS integration before adding it as a dependency.
- P2: Spike generative music behind a hidden proof-of-concept route before product UI planning.
- P3: Prepare the public SEO launch checklist before changing private-alpha `noindex`.

## Documentation Rules

- Update this file first when the current focus, database state, live surfaces, or priority order changes.
- Update `docs/project-log.md` for chronological change history, completed branches, meaningful decisions, and new plans.
- Keep `docs/roadmap.md` as product-direction evidence, not the current operating tracker.
- Keep `TODO.md` as preserved checklist evidence; mirror meaningful status changes here and in `docs/project-log.md`.
- Keep wiki pages under `docs/wiki/` for stable operational documentation.
- Store detailed implementation plans under `docs/superpowers/plans/`.
- Preserve local-first PHI boundaries, feature-key entitlement checks, conservative Sentry privacy posture, and targeted branch-sized refactors.
