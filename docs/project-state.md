# MassageLab Project State

Verified: 2026-06-11

This is the read-first source of truth for MassageLab's current project state. Use it before `docs/project-log.md`, `docs/roadmap.md`, `TODO.md`, audits, or wiki pages when deciding what is active now.

## Current Snapshot

- Status: private alpha.
- Active branch at last verification: anatomy media review workflow.
- Current focus: public-alpha Education flashcards now use a setup-first deck builder over sourced prompt modes: media identification, name-to-summary, name-to-region, name-to-category, and muscle origin/insertion/action/innervation. Anonymous users can browse public decks, create temporary browser decks, and study; signed-in users can save public/private deck templates, persist progress summaries, earn aggregate achievements, view per-prompt mastery totals, optionally skip prompts mastered after 10 correct answers, and complete repeatable full-library mastery rounds. Reveal-review remains practice-only and typed-check remains the saved progress path. Public image prompts use uploaded BodyParts3D media only when the asset is reviewed, reusable, and the item-image link is approved; rejected or needs-review links are hidden from prompt generation. Anatomy admins can now visually review an item's linked images, approve/reject item-image links, attach existing candidates, import curated still BodyParts3D views into R2, and flag bad flashcard images directly from image prompts. Flashcards and Anatomime still use one reviewed sourced anatomy study adapter over `ANATOMY_FOUNDATION_SEED`; old Anatomime data remains archived reference only. 3D/spatial runtime tooling remains deferred. The local-first professional-record framework remains in place: one encrypted browser vault for SOAP, intake, journal, and ROM records, tablet intake workflow continuity, user-controlled encrypted vault transfer, and tested sidebar/module visibility by auth, role, entitlement, and practice-role context. Voice transcription and SOAP-assist are recorded as member-supported future goals only; no audio capture, transcription engine, LLM processing, or hosted PHI workflow is implemented.
- Product posture: clinical notes, intake forms, journals, ROM sessions, transcripts, and other PHI-bearing workflows remain local-first. Therapist note-taking tools are visible but creating or viewing professional-record content requires the `therapist_documentation_tools` entitlement from an active Therapist or Team/Practice membership. SOAP, intake, journal, and ROM now use one passphrase-unlocked encrypted browser vault before viewing or saving documents. Hosted clinical sync remains gated and unimplemented until compliance requirements are met. The privacy architecture separates account/contact/booking data, future client-owned wellness data, therapist professional records, and a future consent-based sharing bridge.
- Public `/roadmap` route: product-facing copy only. Internal operating state lives here and in `docs/project-log.md`.

## Database State

- Database stack: Prisma with Neon/Postgres.
- Last verified checks: `npm run prisma:validate` passed, `npx prisma migrate deploy` applied `20260604170000_flashcard_decks`, `20260607090000_flashcard_mastery_progress`, and `20260611120000_anatomy_media_review`, and `npx prisma migrate status` reported the configured database schema is up to date.
- Migration count at last verification: 22 migrations.
- Latest migration area: anatomy media entity review status, reason, priority, and reviewer metadata for item-image curation.
- No hosted clinical database work is planned for the next forms branch; intake and note content should remain browser-local unless the documented compliance gates are met. Future client-owned wellness storage must remain separate from therapist professional records and therapist remote access until the consent/sharing bridge is reviewed and intentionally enabled.
- Do not document database rows, secrets, connection strings, or `.env.local` values in project docs.

## Website And Tool Surface

- Public app shell: home, support, pricing, public roadmap, about, login/register, password reset, and email verification.
- Role-aware navigation shell: sidebar groups, account menu entries, admin links, and calendar shortcut actions resolve through tested route metadata using anonymous/signed-in state, verified account roles, feature keys, and practice roles. This is structural IA only; it does not create full role dashboards for workflows that are still undefined.
- Chimer: treatment-room timer and clock mode, with custom colors gated by `chimer_custom_colors`.
- Local-first notes: SOAP notes, intake, journal, and ROM routes are visible from `/notes`, but professional-record viewing/creation is gated by `therapist_documentation_tools`. Once unlocked by membership, these routes require the local professional-record vault passphrase before showing clinical content. The shared encrypted browser vault stores SOAP drafts, intake workspaces, journal drafts, and ROM sessions under `massagelab-professional-record-vault-v1`; legacy plaintext route keys are migration inputs only. Intake now separates full initial forms from existing-client follow-up forms, and selected intake documents can seed a therapist-reviewed SOAP draft through an explicit append/replace action. `/notes` also shows friendly member-supported roadmap signals for future voice notes, intake conversation transcription, SOAP assistance, and managed sync; these are funding goals, not active hosted clinical features. Encrypted `.mlab` full-vault bundles are the normal transfer format, while DOC/PDF output requires an explicit plaintext warning.
- Calendar and booking: operator calendar workspace, appointment/class/personal/reminder creation, service catalog, availability, booking settings, public booking links, guest-capable booking, waitlist, and provider capacity controls.
- Accounts and billing: profile/preferences, security settings, role verification, membership status, Stripe Checkout, Stripe portal, and signed webhook foundation.
- Anatomy and education foundation: public `/education`, setup-first `/education/flashcards`, public deck detail routes under `/education/flashcards/decks/[slug]`, Anatomime, admin anatomy browser, anatomy correction workflow, code-backed seed content, Postgres anatomy tables, anatomy media catalog/provenance, R2 media workflow docs, item-image media review state, and 3D/spatial mapping schema. Flashcards and Anatomime use the sourced study adapter; archived old Anatomime data is not runtime product truth. Public flashcard deck templates store sourced deck configuration only, not custom user-authored anatomy facts. Signed-in flashcard study stores prompt ids, correctness summaries, per-prompt mastery metadata, and session duration only; raw typed answers are not persisted. Anatomy media review decisions are stored on item-image links so one asset can be approved for one item and rejected for another. This baseline is considered enough for the current alpha; 3D runtime tooling and voice-answer capture are later feature additions, not current core priorities.
- PWA/offline: offline support is intentionally limited to anonymous public local tools; account, auth, billing, calendar, booking, clinical sync, client, and `/api/*` surfaces remain online-only.

## Open Priorities

- P1: Keep this file and `docs/project-log.md` current when meaningful project state changes.
- P2: Continue validation for local-first intake-to-SOAP continuity and shared vault UX: full initial intake and shorter existing-client follow-up intake are implemented locally, and either intake response can seed a therapist-reviewed SOAP draft inside the encrypted local vault on the same device.
- P2: Continue functional/visual product work rather than backend or compliance-heavy expansion; richer Anatomime learning surfaces, media review queue filters, flashcard UX hardening, or trust/public identity pages are better fits for the next work session.
- P2: Harden the shared encrypted professional-record vault UX, backup guidance, and manual QA before expanding therapist-generated records beyond the current local-first alpha workflows.
- P2: Keep future module additions wired through the role-aware navigation resolver instead of adding one-off sidebar role checks.
- P2: Scope trust pages and public identity: terms, privacy/legal, About Me, and launch-ready public trust copy.
- P2: Plan external Google/Apple/Outlook calendar sync before implementation.
- P2: Plan Stripe Connect marketplace payments before booking payment collection.
- P2: Plan Payload CMS integration before adding it as a dependency.
- P2: Spike generative music behind a hidden proof-of-concept route before product UI planning.
- P3: Revisit anatomy 3D/spatial runtime tooling after the core local-first practice tools are more useful.
- P3: Revisit voice notes, intake conversation transcription, and SOAP-assist later, after a separate feasibility branch proves local/on-device options and any hosted path passes legal, BAA, security, consent, audit, and retention review.
- P3: Prepare the public SEO launch checklist before changing private-alpha `noindex`.

## Documentation Rules

- Update this file first when the current focus, database state, live surfaces, or priority order changes.
- Update `docs/project-log.md` for chronological change history, completed branches, meaningful decisions, and new plans.
- Keep `docs/roadmap.md` as product-direction evidence, not the current operating tracker.
- Keep `TODO.md` as preserved checklist evidence; mirror meaningful status changes here and in `docs/project-log.md`.
- Keep wiki pages under `docs/wiki/` for stable operational documentation.
- Store detailed implementation plans under `docs/superpowers/plans/`.
- Preserve local-first PHI boundaries, feature-key entitlement checks, conservative Sentry privacy posture, and targeted branch-sized refactors.
