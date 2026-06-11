# MassageLab Project Log

This is the canonical chronological planning and progress log for MassageLab. Use [project-state.md](project-state.md) first for the current snapshot, then use this file for decisions, completed work, and change history.

Existing plans, audits, roadmaps, and checklists remain source evidence. Keep them for context, but mirror meaningful progress, plan changes, and priority changes in [project-state.md](project-state.md) and here.

## Current Snapshot

- Status: private alpha.
- Current focus: anatomy data is sufficient for the alpha baseline; 3D/spatial runtime tooling is deferred. Current focus includes the setup-first flashcards/community-deck layer, where anonymous users can browse public decks and study temporary decks while signed-in users can save deck templates, persist progress summaries, earn aggregate achievements, and complete repeatable full-library mastery rounds. Anatomy admins can now visually review the images linked to an item, approve or reject item-image links, attach existing candidates, import curated still BodyParts3D views into R2, and flag bad flashcard images from image prompts. Public flashcards only use reviewed reusable media whose item-image link is approved. Reveal-review remains practice-only, and typed-check remains the saved progress path. The local-first professional-record framework remains in place with one encrypted browser vault for SOAP, intake, journal, and ROM records, tablet intake workflow continuity, user-controlled encrypted vault transfer, and role-aware shell/navigation structure before broader portal expansion. Voice transcription and SOAP-assist are recorded as future member-supported goals only; no audio capture, transcription engine, LLM processing, or hosted PHI workflow is implemented.
- Current-state source of truth: [project-state.md](project-state.md).
- Database status: Prisma schema validates; the repo has 24 migrations, and `npx prisma migrate deploy` applied `20260604170000_flashcard_decks`, `20260607090000_flashcard_mastery_progress`, `20260611120000_anatomy_media_review`, `20260611143000_anatomy_media_review_default_needs_review`, and `20260611153000_anatomy_media_review_backfill_needs_review` to the configured Neon/Postgres database.
- Product posture: clinical notes, intake forms, journals, ROM sessions, transcripts, and other PHI-bearing workflows remain local-first unless hosted clinical storage passes the documented compliance gates. Therapist note-taking tools are visible but creating or viewing professional-record content requires the `therapist_documentation_tools` entitlement from an active Therapist or Team/Practice membership. SOAP, intake, journal, and ROM now use one encrypted browser vault that requires therapist passphrase unlock before viewing or saving documents. Privacy architecture separates account/contact/booking data, future client-owned wellness data, therapist professional records, and a future consent-based sharing bridge.
- Public `/roadmap` route: product-facing app copy only. Internal operating state lives in [project-state.md](project-state.md) and this log.

## Now

| Status | Priority | Work | Source | Acceptance |
| --- | --- | --- | --- | --- |
| Completed | P1 | Finish alpha release verification | [TODO](../TODO.md), [Alpha QA](alpha-qa.md), [Roadmap](roadmap.md) | `docs/alpha-qa.md` was walked with anonymous data; Chimer, Notes, Calendar, Anatomime, Support, Roadmap, Account, Security, Settings, PWA metadata, and billing gates were verified. |
| Completed | P1 | Manually verify Chimer clock-only mode | [TODO](../TODO.md) | Clock-only mode was checked on desktop and phone landscape without layout overlap, unsafe motion, or unreadable controls. |
| Completed | P1 | Manually verify Stripe checkout and webhook flow | [TODO](../TODO.md), [Billing wiki](wiki/billing-memberships.md) | Stripe test checkout, signed local webhook delivery, account membership status, and Chimer custom-color entitlement were confirmed with test-mode values. |
| Completed | P1 | Optimize signed-in account data shell | [May 17 audit](audits/2026-05-17-project-review.md) | Signed-in `/account` now streams only the active tab's data, account tab data uses short-lived per-surface caches with mutation invalidation, and sidebar calendar readiness moved off unrelated page views into route-gated calendar hydration. |
| Completed | P2 | Add browser QA harness | [May 17 audit](audits/2026-05-17-project-review.md) | Playwright browser QA now runs public desktop/mobile smoke routes, console/page-error checks, anonymous account sync guards, PWA manifest/icon checks, and local-first clinical document network guards. |
| Completed | P2 | Decide PWA offline strategy | [May 17 audit](audits/2026-05-17-project-review.md), [Privacy wiki](wiki/privacy-and-phi.md), [PWA wiki](wiki/pwa-offline-strategy.md) | MassageLab is offline-capable for anonymous public local tools only; service worker caching avoids auth, billing, calendar, booking, clinical sync, client, and `/api/*` surfaces. |
| Completed | P2 | Build calendar creation flows | [Roadmap](roadmap.md), [TODO](../TODO.md), [Calendar wiki](wiki/calendar-creation-flows.md) | Appointment, client request, personal event, class, and reminder flows use a shared event index with conservative role permissions, audit rows, and internal notification intent records. |
| Completed | P2 | Add calendar service catalog and availability readiness | [Calendar wiki](wiki/calendar-creation-flows.md) | Calendar migrations are applied; services have variants, resources, operational policy fields, scheduling snapshots, and resource conflict checks for appointments, classes, and public booking. |
| Completed | P2 | Build operator calendar workspace | [Calendar wiki](wiki/calendar-creation-flows.md) | `/calendar` uses a draggable FullCalendar workspace with provider view preferences, server-validated rescheduling, advanced provider availability, multi-service appointment composition, and clinical-rich service template references that avoid client-specific PHI. |
| Completed | P1 | Consolidate project source of truth | [Project state](project-state.md), [Superpowers plan](superpowers/plans/2026-05-27-project-source-of-truth-consolidation.md) | `docs/project-state.md` is the read-first current-state file; `docs/project-log.md` remains chronological history; README, wiki, roadmap, TODO, and agent instructions point to the same convention. |
| Active | P2 | Build local-first client intake and SOAP handoff workflow | [Project state](project-state.md), [Intake-to-SOAP plan](superpowers/plans/2026-06-03-intake-to-soap-continuity.md), [Local-first forms plan](superpowers/plans/2026-05-27-local-first-client-intake-forms.md), [Intake form-builder plan](superpowers/plans/2026-05-28-intake-form-builder-local-documents-v1.md), [Privacy-first records plan](superpowers/plans/2026-05-30-privacy-first-records-framework.md), [Privacy wiki](wiki/privacy-and-phi.md) | Initial intake remains a fuller first-visit form; follow-up intake starts from an existing local client and asks only appointment-relevant changes, current symptoms, safety updates, and today's goals. Either response can be reviewed and used to seed a SOAP draft inside the encrypted local vault without uploading clinical content. Branch validation is in progress. |
| Active | P2 | Maintain project state and log | [Project state](project-state.md) | Future meaningful changes update the current state first and append completed plans, branch outcomes, and priority changes to this change history. |

## Next

| Status | Priority | Work | Source | Acceptance |
| --- | --- | --- | --- | --- |
| Open | P3 | Prepare public SEO launch checklist | [May 17 audit](audits/2026-05-17-project-review.md), [Roadmap](roadmap.md) | Intentional private-alpha `noindex` remains until launch readiness; metadata, trust pages, and public copy are ready before indexing changes. |
| Completed | P2 | Sitewide visual system and account-page polish pass | Account page visual refresh | Shared page shell, surface, inset, action, notice, and status styles now come from `components/ui/app-surface.tsx`; public, account, auth, documentation, booking, calendar-management, admin, and local-first documentation surfaces use the shared treatment, with Chimer, Anatomime, and the dense calendar workspace kept as intentional route-owned exceptions. |
| Open | P2 | Generative music spike | [Roadmap](roadmap.md), [TODO](../TODO.md) | Hidden proof of concept confirms package viability, sample hosting, licensing, bundle size, autoplay behavior, and audio cleanup before product UI planning. |
| Open | P2 | Trust pages and public identity | [Roadmap](roadmap.md), [TODO](../TODO.md) | Terms, privacy/legal, About Me, and clearer public trust copy are scoped before wider release. |
| Open | P2 | Functional/visual product surface work | [Project state](project-state.md), [Roadmap](roadmap.md) | Prefer the next branch to improve a visible, usable part of the product instead of returning immediately to transcription feasibility, hosted PHI, or backend compliance work. Anatomy flashcards/study UI, richer Anatomime learning surfaces, or trust/public identity pages are good branch-sized candidates. |
| Deferred | P3 | Anatomy 3D/spatial runtime tooling | [Project state](project-state.md), [Anatomy media storage](anatomy-media-storage.md) | 3D/spatial rows may remain review-only until runtime mesh/node mapping, source attribution, and product value justify the feature work. |
| Completed | P2 | Education and flashcards design | [Roadmap](roadmap.md), [TODO](../TODO.md) | Flashcards now use sourced prompt modes, setup-first deck building, public deck browsing, signed-in saved deck templates, and signed-in progress/achievement persistence. |
| Open | P2 | Payload CMS integration plan | [TODO](../TODO.md) | Blog-first Payload plan resolves database/schema ownership, auth boundaries, packages, env vars, deployment behavior, uploads, previews, and role/paid-content leakage risks. |
| Open | P2 | External calendar sync integration plan | [Calendar wiki](wiki/calendar-creation-flows.md), [Privacy wiki](wiki/privacy-and-phi.md) | Google, Apple, and Outlook sync rules define OAuth scopes, import/export direction, conflict behavior, PHI boundaries, and membership treatment before implementation. |
| Completed | P2 | Online booking settings, public access, waitlist, and provider capacity controls | Square-inspired calendar settings review, follow-up review branch | Booking policies now cover manual vs auto-confirm approval, provider visibility/rest gaps, min/max scheduling windows, daily appointment limits, pressure-level massage-hour capacity, sequential service/add-on booking, team sequencing, waitlist conversion, staff visibility, opt-in distance notices without client location storage, tabbed provider settings, public share links, state-prefixed branded URLs, anonymous guest booking unless account-required, and a wizard-style public booking flow with weekly availability slots. |
| Completed | P2 | Role-aware module surfaces and sidebar IA | [Role-aware surfaces plan](superpowers/plans/2026-06-01-role-aware-module-surfaces.md) | Anonymous, signed-in base, student, client, therapist, Team/Practice, practice owner/staff/therapist, anatomy admin, and admin contexts resolve through a tested feature/role navigation model without inventing full dashboards before workflows are defined. |
| Open | P2 | Stripe Connect marketplace payments plan | [Billing wiki](wiki/billing-memberships.md), [Calendar wiki](wiki/calendar-creation-flows.md) | Provider onboarding, payout accounts, booking deposits, cancellation fees, taxes, packages, refunds, and platform fee rules are scoped before booking payment collection. |

## Later

- Access and memberships: define visible tools, sync capabilities, education access, practice features, support expectations, and role-specific portals before broad paywall work; use the [role-aware module surfaces plan](superpowers/plans/2026-06-01-role-aware-module-surfaces.md) as the next-branch handoff.
- Shared anatomy knowledge platform: make anatomy content reusable across Anatomime, flashcards, SOAP/body diagrams, intake workflows, demonstrations, and future games.
- Education and games: revisit Anatomime, add shared-session game concepts, support saved progress and achievements, and build education demonstrations after the shared data model stabilizes.
- Practice and therapist SaaS: design practice owner, therapist, student, client, and solo-practitioner experiences before expanding hosted clinical workflows.
- News and school module: add reputable content/news feeds and decide Moodle vs custom learning infrastructure only after source, licensing, editorial, and maintenance rules are clear.
- Voice transcription and SOAP-assist feasibility: defer until a later branch; keep it documented as a goal, but do not route the next branch there.
- Hosted clinical storage: remains future-only until HIPAA, BAA, audit, access-control, encryption, backup, legal, incident response, and operating-policy requirements are satisfied.

## Decision Log

| Date | Decision | Notes |
| --- | --- | --- |
| 2026-06-11 | Store anatomy media accuracy on the item-image link. | `AnatomyMediaEntity` carries approval/rejection state so an image can be valid for one anatomy item and rejected for another without deleting the media asset or its provenance. |
| 2026-06-03 | Split initial intake and follow-up intake before SOAP handoff. | Initial intake should remain a fuller first-visit form. Follow-up intake should start from an existing local client, avoid re-asking stable profile basics, focus on medical changes/current symptoms/today's goals, and roll into therapist-reviewed SOAP drafting inside the encrypted local vault. |
| 2026-06-03 | Treat voice transcription and SOAP-assist as member-supported roadmap goals. | Membership copy may explain that paid support helps fund local transcription experiments, legal/security work, BAAs where required, audit controls, and future managed sync planning, but it must not imply that hosted transcription, cloud SOAP drafting, or HIPAA-ready sync is available now. |
| 2026-06-03 | Defer transcription feasibility in favor of more visible product work next. | The next branch should not be voice transcription, server transcription, or hosted PHI work. Prefer a more functional/visual site or tool surface, with anatomy flashcards/study UI as the strongest current candidate if the user wants a concrete next build. |
| 2026-06-01 | Make role-aware module surfaces a dedicated follow-up branch. | The current branch ships the privacy-first records framework. Sidebar/module personalization should be implemented next through a tested role/capability navigation resolver for anonymous, signed-in, student, client, therapist, Team/Practice, practice-role, and admin contexts. |
| 2026-06-01 | Keep role-aware surfaces structural until workflows are defined. | The implemented resolver filters sidebar groups, account menu routes, admin links, and calendar shortcuts by non-PHI auth, role, entitlement, and practice-role context while avoiding invented full dashboards. |
| 2026-05-30 | Use one encrypted local professional-record vault for therapist documentation. | SOAP, intake, journal, and ROM share `massagelab-professional-record-vault-v1`; legacy route-specific plaintext keys are one-time migration inputs only, encrypted `.mlab` full-vault bundles are the normal transfer format, and DOC/PDF output requires an explicit plaintext warning. |
| 2026-05-29 | Separate wellness data, professional records, and sharing consent. | Client-owned wellness data may become cloud-backed under a privacy-controlled consumer-health domain, therapist professional records stay local-first until hosted PHI gates pass, local records should move toward an offline passphrase-unlocked vault, and live therapist viewing of cloud wellness data is deferred. |
| 2026-05-29 | Gate therapist note-taking behind a feature entitlement. | SOAP, intake, journal, ROM, and related therapist professional-record tools remain visible, but viewing or creating records requires `therapist_documentation_tools`, currently granted by active Therapist and Team/Practice memberships only. |
| 2026-05-27 | `docs/project-state.md` is the read-first current-state tracker. | `docs/project-log.md` remains chronological history; `TODO.md`, `docs/roadmap.md`, `docs/alpha-qa.md`, audits, and wiki pages remain source evidence unless mirrored into current state. |
| 2026-05-27 | Detailed implementation plans live under `docs/superpowers/plans/`. | Use these plans for multi-step implementation handoffs while keeping current state concise. |
| 2026-05-27 | Anatomy data is sufficient for the current alpha baseline. | Further 3D/spatial runtime tooling is deferred as a later feature addition; the next core product focus is local-first client-facing forms and tablet handoff into therapist notes. |
| 2026-05-17 | `docs/project-log.md` became the active internal tracker. | Superseded on 2026-05-27 for current snapshot duties; this file remains the chronological progress and decision log. |
| 2026-05-17 | Update this log for meaningful progress. | Add change-history entries when a plan is created, priority changes, branch work completes, or a significant implementation lands. |
| 2026-05-17 | Keep PHI-bearing workflows local-first during alpha. | Account sync must not include SOAP, intake, journal, ROM, client, treatment, or other clinical content. Hosted clinical sync stays gated and unimplemented until compliance requirements are met. |
| 2026-05-17 | Use feature-based entitlements. | Code should check feature keys such as `chimer_custom_colors`, not named plans. Free and Student are internal access states; Student is not Stripe-backed. |
| 2026-05-17 | Keep Sentry privacy controls conservative. | Session Replay, User Feedback, and Logs stay disabled until route-by-route privacy review, Sentry scrubbing rules, and clinical/local-first policy are written. |
| 2026-05-17 | Refactor only for a focused branch outcome. | Avoid broad cleanup branches; use targeted refactors only when they make the next feature safer, clearer, or easier to test. |
| 2026-05-17 | Calendar creation remains roadmap-only until product rules are defined. | Role permissions, audit expectations, and notification behavior must be planned before adding creation UI. |
| 2026-05-17 | Payload CMS needs a dedicated integration plan. | Default evaluation path is a separate Payload database or schema until ownership, migrations, backups, and auth boundaries are clear. The existing Next.js App Router site remains the public head. |
| 2026-05-17 | Anatomy data remains code-first until reviewed. | Prisma persistence should wait until the seed model, sources, import/update workflow, and clinical/public education citation requirements are clear. |
| 2026-05-17 | Private-alpha `noindex` is intentional. | Public indexing becomes a launch task only after SEO, trust pages, metadata, and public messaging are ready. |
| 2026-05-18 | PWA offline support is scoped to anonymous public tools. | Offline-capable routes are home, Chimer, Anatomime, and local-first documentation pages. Account, auth, billing, calendar, booking, admin, hosted clinical sync, client, and `/api/*` surfaces stay online-only and fall back to `/offline.html` when offline. |
| 2026-05-18 | Calendar creation uses a hybrid event model. | `CalendarEvent` is the scheduling index and conflict source of truth, while appointments, personal blocks, classes, and reminders keep specialized detail records. Notification delivery is deferred; calendar flows write internal intent records only. |
| 2026-05-18 | Calendar services use variants and resources. | Provider services are templates; selected variants drive duration, buffers, displayed pricing, snapshots, and resource requirements. Payment collection, Stripe Connect payouts, taxes, package redemption, and external calendar sync are deferred. |
| 2026-05-18 | Use Team/Practice in frontend copy. | Keep the internal `PRACTICE` membership enum stable, but use `Team/Practice` where users need context for the team membership tier. |
| 2026-05-18 | Operator calendar uses FullCalendar OSS. | The open-source React/daygrid/timegrid/interaction plugins cover day, week, 5-day, month, click-to-create, drag/drop, and resize. Premium resource-lane scheduling is deferred. |
| 2026-05-20 | Elasticsearch/OpenSearch is not used for booking v1. | Public slot generation stays deterministic over Prisma-backed scheduling, service, provider, policy, capacity, and availability data. Search infrastructure can be reconsidered only after v1 behavior and scale demand it. |
| 2026-05-20 | Arbitrary custom public booking fields remain deferred. | Pressure level is the only new required public booking field in v1; broader custom intake fields wait for a dedicated requirements and PHI-boundary plan. |
| 2026-05-20 | Public booking is guest-capable by default. | Practice-wide and provider-specific policies can require a client account, but otherwise guests can request appointments with required contact details while optional sign-in/register prompts explain account benefits. |
| 2026-05-20 | Legal-name public booking URLs stay permanent. | Optional branded public booking URLs use full state slugs plus normalized custom slugs, e.g. `/book/ohio/massagewithderrick`, while `/book/[practiceSlug]` remains available. |

## Change History

### 2026-06-11

- Started `codex/anatomy-media-review` from `main` to turn the anatomy admin item detail view into a practical visual review surface for flashcard image accuracy.
- Added link-level media review state to `AnatomyMediaEntity`: approved/needs-review/rejected status, reason, note, display priority, and reviewer metadata.
- Updated sourced flashcard media loading so rejected or needs-review item-image links are hidden from public prompts, while approved replacement views can produce additional media-identification prompts.
- Added an anatomy admin media review panel with image previews, linked-image review controls, existing candidate approval, and BodyParts3D still-image import to R2 with source/license citation rows.
- Added an admin-only flashcard image flag flow so bad match or bad view flags reject the current item-image link and remove that prompt from the active study run.
- Applied the pending flashcard and anatomy media review migrations to the configured Neon/Postgres database, then applied the follow-up `20260611143000_anatomy_media_review_default_needs_review` migration so new item-image links default to needs review; `npx prisma migrate status` reports the schema is up to date.
- Addressed PR review findings for BodyParts3D URL override sanitization, tree-aware asset identity, transactional import writes, role-specific media review rows, optional R2 public delivery URLs, flashcard flag inventory cleanup, and media override rebuild behavior.
- Added and applied the follow-up `20260611153000_anatomy_media_review_backfill_needs_review` migration so item-image links populated by the earlier approved default are moved into the review queue.
- Updated focused tests for BodyParts3D URL normalization, link-level prompt filtering, admin media review UI, study media overrides, and flashcard image flagging.

### 2026-06-10

- Started `codex/flashcard-mastery-rounds` from refreshed `main` to make signed-in flashcard mastery repeatable across the full sourced prompt library.
- Planned Flashcard Mastery Rounds V1: completion requires mastering every sourced prompt in the current round, awards a repeatable round snapshot badge, resets current-round prompt counts, and preserves lifetime attempt/correct/incorrect totals for long-term progress.
- Implemented the mastery-round V1 mechanics with lifetime progress metadata, a signed-in next-round API action, round-aware progress dashboard copy, and focused progress/browser fixture coverage.

### 2026-06-08

- Started `codex/flashcard-runner-polish` with a focused handoff plan for making the active study runner feel like a physical flashcard workflow without changing flashcard persistence, sourced anatomy facts, achievements, voice support, or 3D runtime scope.
- Polished the flashcard runner card surface with clearer front/back treatment, review-mode card-click/keyboard reveal affordance, practice-only status labeling, tighter progress badges, and nearby controls for previous/next/check/finish actions.
- Updated browser route coverage so review-mode fallback study verifies the card-surface flip interaction, sourced answer reveal, and Correct/Missed marking path on desktop and mobile.
- Addressed flashcard annotation feedback by loading public deck views into setup before study, compacting the runner header, adding a two-card sortable community deck carousel, allowing review cards to flip back to the prompt side, scrolling started sessions to the card, and restricting flashcard image prompts to reviewed uploaded BodyParts3D media without answer-revealing front captions.

### 2026-06-07

- Added Flashcard Mastery Progress V1: signed-in flashcard sessions now accumulate per-prompt attempt/correct/incorrect counts in `LearningProgress` metadata, treat 10 correct answers as mastery, and expose a signed-in progress dashboard with mastered/active prompt totals, aggregate accuracy, sessions, badges, best time, and recent prompt progress.
- Added a signed-in setup option to skip mastered prompts when starting a deck. The server filters mastered prompt ids before creating the study session and returns a clear exhausted-deck response if every selected prompt is already mastered.
- Added flashcard session duration storage on `FlashcardStudySession`, kept completion idempotent, and continued storing only prompt ids and result summaries rather than raw typed answers.

### 2026-06-04

- Reworked `/education/flashcards` into a setup-first deck builder: users select category, region, depth, deck size, answer mode, and prompt modes before any card appears.
- Added sourced flashcard prompt generation over the anatomy foundation for media identification, name-to-summary, name-to-region, name-to-category, and muscle origin/insertion/action/innervation; strict typed checking normalizes case, whitespace, punctuation, and hyphens without fuzzy typo matching.
- Added public deck browsing and starter deck templates. Anonymous users can browse public decks, build temporary decks, and study without saved progress; signed-in users can save public/private deck templates, start persisted study sessions, store aggregate prompt progress, and earn flashcard achievements.
- Added the `FlashcardDeck` and `FlashcardStudySession` Prisma models plus API routes for public deck listing/detail, signed-in deck save/update, signed-in session start, and signed-in session completion without storing raw typed answers.
- Implemented the sourced anatomy flashcards and Education V1 pass: public `/education` and `/education/flashcards` now expose self-study flashcards with category, region, depth, deck size, shuffle/reset, previous/next, answer reveal, aliases, reviewed media when available, and source attribution.
- Added a sourced study adapter over `ANATOMY_FOUNDATION_SEED` for flashcards, Anatomime, and future education tools. Public study cards are restricted to reviewed facts backed by open-reuse or commercial-safe sources, and public attribution is limited to reviewed answer/media sources.
- Completed the legacy Anatomime coverage pass for all 333 archived `lib/anatomy-legacy.js` rows. The audit reports every old row as sourced or mapped; broad groups such as skull, cuneiforms, vertebral column, rib groups, trapezius, quadriceps femoris, erector spinae, and multifidus are represented as sourced group entities, while `interfoveolar` is intentionally preserved as a ligament/structure rather than a muscle.
- Archived the old hand-entered Anatomy/Anatomime data as reference-only `lib/anatomy-legacy.js`, restored `lib/anatomy.js` as a compatibility wrapper over the sourced adapter, and removed the old generic `AnatomyTerm` seeding path from `prisma/seed.ts`.
- Made the Education sidebar group visible with Flashcards and updated tests for legacy coverage, sourced card generation, Anatomime compatibility, foundation section assembly, navigation, and public route smoke coverage.

### 2026-06-03

- Added the next-branch handoff plan at [Intake to SOAP continuity](superpowers/plans/2026-06-03-intake-to-soap-continuity.md), clarifying that initial intake and follow-up intake are separate local-first workflows before either rolls into SOAP.
- Recorded that follow-up intake should start from an existing local client, avoid re-asking stable basic information, collect appointment-relevant changes and safety updates, and seed SOAP only through a therapist-reviewed local action inside the encrypted professional-record vault.
- Implemented the intake-to-SOAP continuity branch: added a built-in follow-up intake template, normalized intake workflow types on local templates/responses/documents, added a pure intake-to-SOAP seed helper with explicit append/replace behavior, and wired the intake dashboard to preview saved local documents and seed SOAP drafts without URLs, APIs, Prisma, account preferences, or hosted clinical sync.
- Added the member-supported voice notes roadmap signal plan at [Member-supported voice notes signals](superpowers/plans/2026-06-03-member-supported-voice-notes-signals.md), capturing voice transcription, intake conversation support, and therapist-reviewed SOAP assistance as future goals rather than active hosted PHI features.
- Updated `/notes`, pricing, roadmap, billing, and privacy docs so membership support is framed as funding legal, security, BAA, audit, consent, and managed-sync groundwork without promising that transcription or cloud SOAP drafting is available today.
- Recorded that voice transcription feasibility should wait for a later task and that the next branch should be more functional/visual product work, with anatomy flashcards/study UI, richer Anatomime learning surfaces, or trust/public identity pages as better near-term candidates.

### 2026-06-01

- Added the next-branch handoff plan for role-aware module surfaces and sidebar IA, capturing anonymous, signed-in, student, client, therapist, Team/Practice, practice-role, and admin navigation expectations without inventing full role dashboards yet.
- Implemented the structural role-aware navigation resolver: sidebar groups, account menu entries, anatomy admin links, and calendar shortcuts now resolve from route metadata using auth state, verified account roles, feature keys, and practice roles. Direct professional-record routes remain absent from sidebar navigation, and `/notes` keeps its preview/gated local-first behavior.

### 2026-05-30

- Implemented the shared privacy-first professional-record framework: SOAP, intake, journal, and ROM now use one passphrase-unlocked encrypted browser vault under `massagelab-professional-record-vault-v1`.
- Added encrypted full-vault `.mlab` bundle export/import, one-time migration from legacy plaintext localStorage draft keys, non-destructive handling for malformed legacy drafts and older encrypted intake vaults, and source guards that block clinical upload paths.
- Removed plaintext JSON/TXT/research transfer controls from therapist documentation routes; DOC/PDF output remains available only after an explicit plaintext-output warning.
- Added the implementation plan at [Privacy-first records framework](superpowers/plans/2026-05-30-privacy-first-records-framework.md).

### 2026-05-29

- Added the privacy-first data architecture wiki to separate account/contact/booking data, future client-owned wellness records, therapist professional-record vault data, sharing consent, and intentional professional-record references.
- Recorded that cloud wellness storage is a future privacy-controlled domain, while therapist professional records remain local-first and should move toward an offline passphrase-unlocked encrypted vault before broader local documentation expansion.
- Documented that encryption alone does not remove BAA obligations for cloud providers maintaining ePHI on behalf of a covered entity or business associate, and added current HHS, FTC, Vercel, and Cloudflare source links for future compliance planning.
- Implemented the encrypted in-browser intake vault: therapists must create or unlock a local passphrase vault before using `/notes/intake`, saved intake workspaces are stored as AES-GCM ciphertext, existing plaintext workspaces can be migrated in place, and browser QA verifies the clinical sentinel is not stored in plaintext.
- Added the `therapist_documentation_tools` entitlement gate for therapist note-taking surfaces: `/notes` still shows SOAP, intake, journal, and ROM tools, while direct tool access renders a membership-required gate unless the session has the feature-backed local clinical tools capability.

### 2026-05-28

- Implemented the local-first intake form-builder workspace direction: built-in full-intake and pain/discomfort-map templates, therapist-created local templates, tablet fill mode, local client/document dashboards, native JSON/DOC/print-PDF exports, and optional encrypted `.mlab` workspace bundles.
- Documented that pre-arrival remote/client account behavior remains limited to contact/profile and booking status until hosted PHI storage passes the compliance gates; clinical intake responses, signatures, and pain maps stay local-first.

### 2026-05-27

- Added `docs/project-state.md` as the read-first current-state source of truth and clarified that `docs/project-log.md` is the chronological progress and decision log.
- Added `AGENTS.md` so future agents read project state first, preserve local-first PHI boundaries, avoid secrets/row-level database details in docs, and use feature-key entitlement checks.
- Added `docs/superpowers/plans/2026-05-27-project-source-of-truth-consolidation.md` for implementation tracking and updated README, wiki index, TODO, and roadmap references to the same documentation convention.
- Added `docs/superpowers/plans/2026-05-27-local-first-client-intake-forms.md` and moved the active product direction from anatomy expansion to tablet-friendly, local-first client forms.
- Marked anatomy 3D/spatial runtime tooling as deferred because it is a later feature layer, while the current alpha needs more useful client and therapist form workflows.
- Verified the Prisma schema and configured database state during consolidation: 19 migrations are present and the configured Neon/Postgres schema was reported up to date.
- Recorded the latest anatomy database direction: 3D/spatial body-map tables, entity maps, movement visualization records, and joint/movement/ROM integrity constraints are now part of the anatomy foundation.
- Reconciled dependency notes with the May 27 security review: no high or critical advisories are documented, with remaining Next/PostCSS, Nodemailer, and dependency-level findings tracked as accepted residual risk.

### 2026-05-21

- Completed `codex/sitewide-visual-system-polish`: added shared app surface primitives, wired account settings to the shared source of truth, migrated public/auth/account/documentation/booking/calendar-management/admin/local-first documentation route surfaces, and removed stale global page/card utility classes while preserving route-owned Chimer, Anatomime, and dense calendar workspace visuals.
- Extended the visual-system pass with Intent-inspired sitewide sidebar/topbar polish: the sidebar now uses a tighter docked rail with icon tooltips, calendar action menus, footer account controls, and request/waitlist badges; the mini calendar moved into a global topbar popover that respects sidebar side preferences and hides during Chimer immersive states.

### 2026-05-20

- Completed `codex/calendar-booking-settings-plan`: added booking policy storage, provider booking policy/capacity rules, service primary/add-on roles, public booking pressure selection, deterministic sequential service/add-on slot solving, team sequencing, waitlist entries and conversion, public location distance notices, and `/calendar/booking`.
- Replaced the planned fake-it/scarcity idea with provider capacity protection: total daily/weekly massage minutes, pressure-level budgets from 1-5, provider rest gaps, and server-side revalidation before booking writes.
- Completed the CR review hardening pass for booking v1: transactional provider policy/capacity rechecks, atomic waitlist conversion, practice-timezone waitlist conversion, practice-local booking horizons, public-provider empty-state handling, add-on cap consistency, and multi-service migration backfill are now recorded as landed constraints.
- Closed the public sequence-generation follow-up: `/book/[practiceSlug]` no longer precomputes every public service/add-on/pressure/provider combination server-side, and selected descriptors load options on demand through the deterministic solver with short-TTL caching while submit actions still revalidate before writes.
- Completed `codex/calendar-booking-followups`: `/calendar/booking` is tabbed, providers can see/copy/share public booking links, optional state-prefixed branded booking URLs route to the same renderer, and anonymous clients can book or waitlist unless practice/provider policy requires an account.
- Reworked the public booking UI into a single-route wizard with Services, Details, and Time steps; single-provider preference selectors are hidden, sign-in/register prompts are optional for guests, and time selection uses a responsive weekly availability grid with directly clickable start slots.
- Hardened follow-up review findings: sequence-option API failures return a generic client message while logging server-side, public booking load errors are logged, account-required fallback only appears for provider-eligibility shortfalls, share/copy failures are handled, login callback URLs reject backslashes, staff email is not used as public provider-label fallback, toggle controls expose `aria-pressed`, and brittle resource-booking test slicing now asserts markers first.

### 2026-05-18

- Completed `codex/calendar-creation-flows-plan`: added the hybrid calendar event model, dedicated creation routes for appointments, personal events, classes, and reminders, request review, calendar audit rows, internal notification intent records, and the calendar creation flow wiki.
- Added the calendar service catalog: service templates, variants, resources, resource bookings, appointment/class snapshots, public booking variant selection, service management routes, and free/basic vs Therapist/Team scheduling entitlement keys.
- Added the operator calendar workspace: FullCalendar grid views, provider view preferences, server-validated drag/resize rescheduling, advanced availability schedules/overrides, multi-service appointment composition, provider eligibility, and generic local-first clinical template references on services.
- Added the sitewide visual system/account-page polish pass to the P2 backlog so shared surface, inset, page shell, action, and status styles can become one cohesive source of truth.
- Completed alpha release readiness verification on `codex/alpha-release-readiness`: automated gate, browser route pass, Chimer timer and clock-only checks, PWA manifest, diagnostic route gates, local-first documentation network checks, account membership display, Stripe test checkout creation, signed local webhook processing, and Chimer custom-color entitlement.
- Fixed an anonymous Chimer preference-sync regression found during browser QA. Chimer now checks the client session before calling `/api/account/preferences`, preventing unsigned users from generating account preference 401 console errors.
- Confirmed `/debug-hydration` is absent, `/api/debug/sentry` stays disabled with `MASSAGELAB_ENABLE_SENTRY_TEST_ROUTE=false`, and the PWA manifest serves standalone metadata with 192/512 icons.
- Completed `codex/optimize-account-data-shell`: `/account` keeps its shell/navigation immediate while loading only the active tab's server data, account panel data is cached briefly and invalidated after relevant mutations, and sidebar calendar context now hydrates only on calendar/booking routes instead of running readiness checks from the global layout.
- Completed `codex/add-browser-qa-harness`: added Playwright browser QA, desktop/mobile public route smoke coverage, anonymous account sync request guards, PWA manifest/icon checks, local-first clinical document upload guards, and GitHub Actions CI wiring.
- Completed `codex/pwa-offline-strategy`: documented the alpha PWA boundary, refreshed install icons, and constrained service worker offline route caching to anonymous public tools while excluding account, auth, billing, calendar, booking, clinical sync, client, and `/api/*` surfaces.

### 2026-05-17

- Added this consolidated project log as the active planning and progress tracker.
- Consolidated open work from `TODO.md`, `docs/roadmap.md`, and the May 17 project review into Now / Next / Later sections.
- Preserved existing roadmap, audit, QA, TODO, and wiki files as source evidence instead of merging their full contents here.
- Recorded standing decisions for local-first PHI boundaries, feature-based entitlements, Sentry privacy limits, targeted refactors, Payload planning, anatomy data, calendar planning, and public SEO readiness.
- Noted the May 17 audit status: anonymous sync gating, Sentry scrubbing, brand asset caching, and mobile background reductions were completed after the audit; remaining audit backlog includes account data splitting, browser QA, PWA strategy, and public SEO launch work.

### 2026-05-15

- Billing and membership foundation work established feature-based entitlements, Stripe subscription records, student access rules, and `chimer_custom_colors` as the first paid feature gate.
- Dependency security notes documented no high or critical advisories, with remaining Next/PostCSS and Nodemailer/Auth.js findings tracked as dependency-watch items.

### 2026-05-08 to 2026-05-13

- Alpha refresh shipped Chimer display polish, sidebar/navigation IA, brand and PWA assets, Sentry monitoring with privacy scrubbing, and runtime/dependency hygiene.

## Source Evidence Index

- [Project state](project-state.md): read-first current state, database status, live surfaces, open priorities, and update rules.
- [TODO](../TODO.md): preserved checkbox list and source evidence for active and recently completed work.
- [Roadmap](roadmap.md): branch-ready and phased product direction.
- [Alpha QA](alpha-qa.md): private-alpha verification checklist.
- [May 17 project review](audits/2026-05-17-project-review.md): performance, Sentry, privacy, PWA, architecture, dependency, and remediation backlog review.
- [Wiki index](wiki/index.md): repo-backed operational documentation entrypoint.
- [Privacy-first data architecture](wiki/privacy-first-data-architecture.md): account/contact/booking, client wellness, therapist professional-record vault, sharing consent, and hosted PHI gate boundaries.
- [Release checklist](wiki/release-checklist.md): alpha release gate and manual focus areas.
- [Privacy and PHI posture](wiki/privacy-and-phi.md): local-first and hosted clinical sync boundaries.
- [PWA offline strategy](wiki/pwa-offline-strategy.md): install/offline behavior, public-tool route allowlist, and online-only exclusions.
- [Billing and memberships](wiki/billing-memberships.md): feature-based access and Stripe membership setup.
- [Deployment and environment](wiki/deployment.md): environment variables, Sentry limits, Stripe setup, and migration rules.
- [Dependency security notes](wiki/dependency-security.md): accepted residual dependency risk and audit commands.
