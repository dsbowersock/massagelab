# MassageLab Project State

Verified: 2026-05-30

This is the read-first source of truth for MassageLab's current project state. Use it before `docs/project-log.md`, `docs/roadmap.md`, `TODO.md`, audits, or wiki pages when deciding what is active now.

## Current Snapshot

- Status: private alpha.
- Active branch at last verification: `role-aware-module-surfaces`.
- Current focus: anatomy data is sufficient for the alpha baseline; 3D/spatial runtime tooling is deferred. Current build focus is the local-first professional-record framework plus role-aware shell structure: one encrypted browser vault for SOAP, intake, journal, and ROM records, tablet intake workflow continuity, user-controlled encrypted vault transfer, and tested sidebar/module visibility by auth, role, entitlement, and practice-role context.
- Product posture: clinical notes, intake forms, journals, ROM sessions, and other PHI-bearing workflows remain local-first. Therapist note-taking tools are visible but creating or viewing professional-record content requires the `therapist_documentation_tools` entitlement from an active Therapist or Team/Practice membership. SOAP, intake, journal, and ROM now use one passphrase-unlocked encrypted browser vault before viewing or saving documents. Hosted clinical sync remains gated and unimplemented until compliance requirements are met. The privacy architecture separates account/contact/booking data, future client-owned wellness data, therapist professional records, and a future consent-based sharing bridge.
- Public `/roadmap` route: product-facing copy only. Internal operating state lives here and in `docs/project-log.md`.

## Database State

- Database stack: Prisma with Neon/Postgres.
- Last verified checks: `npm run prisma:validate` passed and `npx prisma migrate status` reported the configured database schema is up to date.
- Migration count at last verification: 19 migrations.
- Latest migration area: anatomy 3D/spatial body-map foundation and movement-visualization integrity.
- No hosted clinical database work is planned for the next forms branch; intake and note content should remain browser-local unless the documented compliance gates are met. Future client-owned wellness storage must remain separate from therapist professional records and therapist remote access until the consent/sharing bridge is reviewed and intentionally enabled.
- Do not document database rows, secrets, connection strings, or `.env.local` values in project docs.

## Website And Tool Surface

- Public app shell: home, support, pricing, public roadmap, about, login/register, password reset, and email verification.
- Role-aware navigation shell: sidebar groups, account menu entries, admin links, and calendar shortcut actions resolve through tested route metadata using anonymous/signed-in state, verified account roles, feature keys, and practice roles. This is structural IA only; it does not create full role dashboards for workflows that are still undefined.
- Chimer: treatment-room timer and clock mode, with custom colors gated by `chimer_custom_colors`.
- Local-first notes: SOAP notes, intake, journal, and ROM routes are visible from `/notes`, but professional-record viewing/creation is gated by `therapist_documentation_tools`. Once unlocked by membership, these routes require the local professional-record vault passphrase before showing clinical content. The shared encrypted browser vault stores SOAP drafts, intake workspaces, journal drafts, and ROM sessions under `massagelab-professional-record-vault-v1`; legacy plaintext route keys are migration inputs only. Encrypted `.mlab` full-vault bundles are the normal transfer format, while DOC/PDF output requires an explicit plaintext warning.
- Calendar and booking: operator calendar workspace, appointment/class/personal/reminder creation, service catalog, availability, booking settings, public booking links, guest-capable booking, waitlist, and provider capacity controls.
- Accounts and billing: profile/preferences, security settings, role verification, membership status, Stripe Checkout, Stripe portal, and signed webhook foundation.
- Anatomy and education foundation: Anatomime, admin anatomy browser, anatomy correction workflow, code-backed seed content, Postgres anatomy tables, anatomy media catalog/provenance, R2 media workflow docs, and 3D/spatial mapping schema. This baseline is considered enough for the current alpha; 3D runtime tooling is a later feature addition, not a current core priority.
- PWA/offline: offline support is intentionally limited to anonymous public local tools; account, auth, billing, calendar, booking, clinical sync, client, and `/api/*` surfaces remain online-only.

## Open Priorities

- P1: Keep this file and `docs/project-log.md` current when meaningful project state changes.
- P2: Build local-first client-facing forms and tablet handoff workflows, starting with intake and therapist review/notes continuity on the same device.
- P2: Harden the shared encrypted professional-record vault UX, backup guidance, and manual QA before expanding therapist-generated records beyond the current local-first alpha workflows.
- P2: Keep future module additions wired through the role-aware navigation resolver instead of adding one-off sidebar role checks.
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
