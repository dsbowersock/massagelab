# MassageLab Project Log

This is the canonical chronological planning and progress log for MassageLab. Use [project-state.md](project-state.md) first for the current snapshot, then use this file for decisions, completed work, and change history.

Existing plans, audits, roadmaps, and checklists remain source evidence. Keep them for context, but mirror meaningful progress, plan changes, and priority changes in [project-state.md](project-state.md) and here.

## Current Snapshot

- Status: private alpha.
- Current focus: anatomy data is sufficient for the alpha baseline; 3D/spatial runtime tooling is deferred. Next focus is local-first client-facing forms, starting with a tablet-friendly intake workflow that can hand off into therapist notes on the same device.
- Current-state source of truth: [project-state.md](project-state.md).
- Database status: Prisma schema validates; the configured Neon/Postgres database is up to date with 19 migrations as of 2026-05-27.
- Product posture: clinical notes, intake forms, journals, ROM sessions, and other PHI-bearing workflows remain local-first unless hosted clinical storage passes the documented compliance gates.
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
| Active | P2 | Build local-first client intake and tablet handoff workflow | [Project state](project-state.md), [Local-first forms plan](superpowers/plans/2026-05-27-local-first-client-intake-forms.md), [Privacy wiki](wiki/privacy-and-phi.md) | Client-facing intake works comfortably on a tablet, saves only in browser-local storage, exports user-controlled files, clears safely between clients, and gives the therapist a clean review path before SOAP notes. |
| Active | P2 | Maintain project state and log | [Project state](project-state.md) | Future meaningful changes update the current state first and append completed plans, branch outcomes, and priority changes to this change history. |

## Next

| Status | Priority | Work | Source | Acceptance |
| --- | --- | --- | --- | --- |
| Open | P3 | Prepare public SEO launch checklist | [May 17 audit](audits/2026-05-17-project-review.md), [Roadmap](roadmap.md) | Intentional private-alpha `noindex` remains until launch readiness; metadata, trust pages, and public copy are ready before indexing changes. |
| Completed | P2 | Sitewide visual system and account-page polish pass | Account page visual refresh | Shared page shell, surface, inset, action, notice, and status styles now come from `components/ui/app-surface.tsx`; public, account, auth, documentation, booking, calendar-management, admin, and local-first documentation surfaces use the shared treatment, with Chimer, Anatomime, and the dense calendar workspace kept as intentional route-owned exceptions. |
| Open | P2 | Generative music spike | [Roadmap](roadmap.md), [TODO](../TODO.md) | Hidden proof of concept confirms package viability, sample hosting, licensing, bundle size, autoplay behavior, and audio cleanup before product UI planning. |
| Open | P2 | Trust pages and public identity | [Roadmap](roadmap.md), [TODO](../TODO.md) | Terms, privacy/legal, About Me, and clearer public trust copy are scoped before wider release. |
| Deferred | P3 | Anatomy 3D/spatial runtime tooling | [Project state](project-state.md), [Anatomy media storage](anatomy-media-storage.md) | 3D/spatial rows may remain review-only until runtime mesh/node mapping, source attribution, and product value justify the feature work. |
| Open | P2 | Education and flashcards design | [Roadmap](roadmap.md), [TODO](../TODO.md) | Shared anatomy data requirements are defined before adding visible Education routes or flashcard workflows. |
| Open | P2 | Payload CMS integration plan | [TODO](../TODO.md) | Blog-first Payload plan resolves database/schema ownership, auth boundaries, packages, env vars, deployment behavior, uploads, previews, and role/paid-content leakage risks. |
| Open | P2 | External calendar sync integration plan | [Calendar wiki](wiki/calendar-creation-flows.md), [Privacy wiki](wiki/privacy-and-phi.md) | Google, Apple, and Outlook sync rules define OAuth scopes, import/export direction, conflict behavior, PHI boundaries, and membership treatment before implementation. |
| Completed | P2 | Online booking settings, public access, waitlist, and provider capacity controls | Square-inspired calendar settings review, follow-up review branch | Booking policies now cover manual vs auto-confirm approval, provider visibility/rest gaps, min/max scheduling windows, daily appointment limits, pressure-level massage-hour capacity, sequential service/add-on booking, team sequencing, waitlist conversion, staff visibility, opt-in distance notices without client location storage, tabbed provider settings, public share links, state-prefixed branded URLs, anonymous guest booking unless account-required, and a wizard-style public booking flow with weekly availability slots. |
| Open | P2 | Stripe Connect marketplace payments plan | [Billing wiki](wiki/billing-memberships.md), [Calendar wiki](wiki/calendar-creation-flows.md) | Provider onboarding, payout accounts, booking deposits, cancellation fees, taxes, packages, refunds, and platform fee rules are scoped before booking payment collection. |

## Later

- Access and memberships: define visible tools, sync capabilities, education access, practice features, support expectations, and role-specific portals before broad paywall work.
- Shared anatomy knowledge platform: make anatomy content reusable across Anatomime, flashcards, SOAP/body diagrams, intake workflows, demonstrations, and future games.
- Education and games: revisit Anatomime, add shared-session game concepts, support saved progress and achievements, and build education demonstrations after the shared data model stabilizes.
- Practice and therapist SaaS: design practice owner, therapist, student, client, and solo-practitioner experiences before expanding hosted clinical workflows.
- News and school module: add reputable content/news feeds and decide Moodle vs custom learning infrastructure only after source, licensing, editorial, and maintenance rules are clear.
- Hosted clinical storage: remains future-only until HIPAA, BAA, audit, access-control, encryption, backup, legal, incident response, and operating-policy requirements are satisfied.

## Decision Log

| Date | Decision | Notes |
| --- | --- | --- |
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
- [Release checklist](wiki/release-checklist.md): alpha release gate and manual focus areas.
- [Privacy and PHI posture](wiki/privacy-and-phi.md): local-first and hosted clinical sync boundaries.
- [PWA offline strategy](wiki/pwa-offline-strategy.md): install/offline behavior, public-tool route allowlist, and online-only exclusions.
- [Billing and memberships](wiki/billing-memberships.md): feature-based access and Stripe membership setup.
- [Deployment and environment](wiki/deployment.md): environment variables, Sentry limits, Stripe setup, and migration rules.
- [Dependency security notes](wiki/dependency-security.md): accepted residual dependency risk and audit commands.
