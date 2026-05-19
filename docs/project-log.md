# MassageLab Project Log

This is the canonical repo-backed planning and progress log for MassageLab. Use it first when deciding what is active, what is next, and what changed recently.

Existing plans, audits, roadmaps, and checklists remain source evidence. Keep them for context, but mirror meaningful progress, plan changes, and priority changes here.

## Current Snapshot

- Status: private alpha.
- Current focus: local-first privacy boundaries, account performance, browser QA automation, and organizing the next branch sequence after alpha readiness verification.
- Product posture: clinical notes, intake forms, journals, ROM sessions, and other PHI-bearing workflows remain local-first unless hosted clinical storage passes the documented compliance gates.
- Public `/roadmap` route: product-facing app copy only. This file is the internal operating tracker.

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
| Active | P2 | Maintain this project log | This consolidation plan | Future meaningful changes, completed plans, branch outcomes, and priority changes are appended to the change history. |

## Next

| Status | Priority | Work | Source | Acceptance |
| --- | --- | --- | --- | --- |
| Open | P3 | Prepare public SEO launch checklist | [May 17 audit](audits/2026-05-17-project-review.md), [Roadmap](roadmap.md) | Intentional private-alpha `noindex` remains until launch readiness; metadata, trust pages, and public copy are ready before indexing changes. |
| Open | P2 | Sitewide visual system and account-page polish pass | Account page visual refresh | The rest of the site is updated with the account page's visual polish, and shared page shell, surface, inset, action, and status styles come from one source of truth unless a route documents an intentional exception. |
| Open | P2 | Generative music spike | [Roadmap](roadmap.md), [TODO](../TODO.md) | Hidden proof of concept confirms package viability, sample hosting, licensing, bundle size, autoplay behavior, and audio cleanup before product UI planning. |
| Open | P2 | Trust pages and public identity | [Roadmap](roadmap.md), [TODO](../TODO.md) | Terms, privacy/legal, About Me, and clearer public trust copy are scoped before wider release. |
| Open | P2 | Anatomy content review and expansion | [TODO](../TODO.md), [Roadmap](roadmap.md) | First seed scope is reviewed; citation sources are chosen; expansion only proceeds after the code-first seed shape is accepted. |
| Open | P2 | Education and flashcards design | [Roadmap](roadmap.md), [TODO](../TODO.md) | Shared anatomy data requirements are defined before adding visible Education routes or flashcard workflows. |
| Open | P2 | Payload CMS integration plan | [TODO](../TODO.md) | Blog-first Payload plan resolves database/schema ownership, auth boundaries, packages, env vars, deployment behavior, uploads, previews, and role/paid-content leakage risks. |
| Open | P2 | External calendar sync integration plan | [Calendar wiki](wiki/calendar-creation-flows.md), [Privacy wiki](wiki/privacy-and-phi.md) | Google, Apple, and Outlook sync rules define OAuth scopes, import/export direction, conflict behavior, PHI boundaries, and membership treatment before implementation. |
| Open | P2 | Online booking settings, waitlist, and fake-it filter plan | Square-inspired calendar settings review | Booking policies cover waitlist, reservation approval mode, customer timezone behavior, custom booking fields, min/max scheduling windows, daily appointment limits, any-available-provider behavior, multi-service/team-member booking rules, staff visibility, and fake-it filter behavior before implementation. |
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
| 2026-05-17 | `docs/project-log.md` is the active internal tracker. | `TODO.md`, `docs/roadmap.md`, `docs/alpha-qa.md`, audits, and wiki pages remain source evidence. |
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

## Change History

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
