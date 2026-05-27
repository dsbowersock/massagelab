# MassageLab Project State

Verified: 2026-05-27

This is the read-first source of truth for MassageLab's current project state. Use it before `docs/project-log.md`, `docs/roadmap.md`, `TODO.md`, audits, or wiki pages when deciding what is active now.

## Current Snapshot

- Status: private alpha.
- Active branch at last verification: `codex/anatomy-review`.
- Current focus: anatomy data is sufficient for the alpha baseline; 3D/spatial runtime tooling is deferred. Next build focus is local-first client-facing forms, starting with a tablet-friendly intake workflow that hands off cleanly into therapist notes.
- Product posture: clinical notes, intake forms, journals, ROM sessions, and other PHI-bearing workflows remain local-first. Hosted clinical sync remains gated and unimplemented until compliance requirements are met.
- Public `/roadmap` route: product-facing copy only. Internal operating state lives here and in `docs/project-log.md`.

## Database State

- Database stack: Prisma with Neon/Postgres.
- Last verified checks: `npm run prisma:validate` passed and `npx prisma migrate status` reported the configured database schema is up to date.
- Migration count at last verification: 19 migrations.
- Latest migration area: anatomy 3D/spatial body-map foundation and movement-visualization integrity.
- No hosted clinical database work is planned for the next forms branch; intake and note content should remain browser-local unless the documented compliance gates are met.
- Do not document database rows, secrets, connection strings, or `.env.local` values in project docs.

## Website And Tool Surface

- Public app shell: home, support, pricing, public roadmap, about, login/register, password reset, and email verification.
- Chimer: treatment-room timer and clock mode, with custom colors gated by `chimer_custom_colors`.
- Local-first notes: SOAP notes, intake, journal, and ROM routes save locally unless a user explicitly exports. The existing intake route is the next priority for a tablet handoff workflow where a client completes intake locally and the therapist reviews or continues notes on the same device.
- Calendar and booking: operator calendar workspace, appointment/class/personal/reminder creation, service catalog, availability, booking settings, public booking links, guest-capable booking, waitlist, and provider capacity controls.
- Accounts and billing: profile/preferences, security settings, role verification, membership status, Stripe Checkout, Stripe portal, and signed webhook foundation.
- Anatomy and education foundation: Anatomime, admin anatomy browser, anatomy correction workflow, code-backed seed content, Postgres anatomy tables, anatomy media catalog/provenance, R2 media workflow docs, and 3D/spatial mapping schema. This baseline is considered enough for the current alpha; 3D runtime tooling is a later feature addition, not a current core priority.
- PWA/offline: offline support is intentionally limited to anonymous public local tools; account, auth, billing, calendar, booking, clinical sync, client, and `/api/*` surfaces remain online-only.

## Open Priorities

- P1: Keep this file and `docs/project-log.md` current when meaningful project state changes.
- P2: Build local-first client-facing forms and tablet handoff workflows, starting with intake and therapist review/notes continuity on the same device.
- P2: Scope trust pages and public identity: terms, privacy/legal, About Me, and launch-ready public trust copy.
- P2: Plan external Google/Apple/Outlook calendar sync before implementation.
- P2: Plan Stripe Connect marketplace payments before booking payment collection.
- P2: Plan Payload CMS integration before adding it as a dependency.
- P2: Spike generative music behind a hidden proof-of-concept route before product UI planning.
- P3: Revisit anatomy 3D/spatial runtime tooling after the core local-first practice tools are more useful.
- P3: Prepare the public SEO launch checklist before changing private-alpha `noindex`.

## Documentation Rules

- Update this file first when the current focus, database state, live surfaces, or priority order changes.
- Update `docs/project-log.md` for chronological change history, completed branches, meaningful decisions, and new plans.
- Keep `docs/roadmap.md` as product-direction evidence, not the current operating tracker.
- Keep `TODO.md` as preserved checklist evidence; mirror meaningful status changes here and in `docs/project-log.md`.
- Keep wiki pages under `docs/wiki/` for stable operational documentation.
- Store detailed implementation plans under `docs/superpowers/plans/`.
- Preserve local-first PHI boundaries, feature-key entitlement checks, conservative Sentry privacy posture, and targeted branch-sized refactors.
