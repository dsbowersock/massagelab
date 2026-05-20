# MassageLab Roadmap

This file captures the branch-ready roadmap after the May 8-13, 2026 alpha refresh work.

Active planning and progress tracking now lives in [project-log.md](project-log.md). Keep this roadmap as product-direction source evidence and mirror meaningful status changes in the project log.

## Recently Completed

- Sentry error monitoring and performance traces are wired with privacy scrubbing for diagnostic messages. Keep Session Replay, User Feedback, and Logs disabled until MassageLab has route-by-route privacy review, Sentry project scrubbing rules, and a written policy for clinical/local-first pages.
- Chimer gained responsive active-timer controls, full-viewport Clock Mode centering, position-stable timer/current-time switch animation, display color/glow controls, hidden-seconds display behavior, safer mobile layout behavior, and preference sync conflict handling.
- Navigation IA shipped with shadcn sidebar composition, grouped alpha routes, secondary support/roadmap links, account menu routes, mini-calendar placement, and Chimer sidebar hiding states.
- Sidebar styling polish shipped with collapsed section icons, rail expansion behavior, wordmark reveal, sidebar open controls, and click-away collapse.
- Branding and PWA assets shipped with updated favicon, app icons, brand mark, wordmark, and sidebar logo placement.
- Runtime/dependency hygiene shipped with Node.js `24.x` pinning and recent dependency security updates.

## Branch Order

1. `codex/alpha-release-readiness`
2. `codex/calendar-creation-flows-plan`
3. `codex/generative-music-spike`
4. `codex/refactor-*` only when a targeted cleanup directly supports a feature branch

## Phased Product Roadmap

This section keeps the broader product ideas visible without moving them ahead of alpha stabilization.

### Phase 1: Alpha Release Readiness

Stabilize the current alpha before adding new surfaces.

- Complete the automated and manual alpha release checks.
- Keep Chimer, Notes, Calendar, Anatomime, Support, Roadmap, Account, Security, and Settings aligned with the README and public roadmap.
- Keep PHI-bearing and health-sensitive workflows local-first.

### Phase 2: Access, Trust, And Discoverability

Define how different users enter MassageLab and what they can see.

- Map subscription and membership levels to visible tools, sync capabilities, education access, practice features, and support expectations.
- Define access rules before building paywalls or pricing UI.
- Add Terms of Service, privacy/legal pages, and other trust information needed before wider release.
- Add an About Me section that explains the creator, purpose, and clinical/education context for MassageLab.
- Improve SEO and discoverability with page metadata, structured public copy, and clear route-level descriptions.

### Phase 3: Shared Anatomy Knowledge Platform

Make anatomy content a reusable foundation instead of a one-game data set.

- Expand and complete the anatomy structure database as much as practical, with sources, aliases, regions, systems, difficulty, and review status.
- Keep anatomy terms reusable across Anatomime, flashcards, SOAP body diagrams, intake/body-diagram workflows, interactive demonstrations, and future games.
- Improve anatomy admin and correction workflows so content can be reviewed, sourced, corrected, and published safely.
- Incorporate the intake form and body diagram work currently represented in Google Sheets and Google Forms into MassageLab-owned local-first workflows.

### Phase 4: Education And Games

Turn the hidden Education placeholder and existing game foundation into durable learning tools.

- Revisit Anatomime for game flow, classroom usability, anatomy coverage, progress tracking, and engagement.
- Add a flashcard tool under Education that uses the same anatomy database as Anatomime and body-diagram tools.
- Add an Education section for interactive demonstrations that teach anatomy, assessment, documentation, and massage-related concepts.
- Plan shared game sessions that let users join from phones, participate in group play, save progress, earn achievements, and support community discussion.

### Phase 5: Practice And Therapist SaaS

Design MassageLab as a practice and therapist platform before expanding hosted clinical workflows.

- Build the Practice/Therapist SaaS track around scheduling, documentation, client relationships, education, account management, and membership entitlements.
- Define portals and access restrictions for practice owners, therapists working inside a practice, solo practice therapists, therapists whose workplace does not use MassageLab, students, clients, and future related audiences.
- Keep hosted clinical sync behind HIPAA, BAA, audit, access-control, encryption, backup, legal, and operating-policy gates.

### Phase 6: News And School Module

Add education/content infrastructure only after source, maintenance, and product boundaries are clear.

- Create a News section that can surface reputable massage, bodywork, anatomy, education, and research content.
- Favor reputable sources such as the International Journal of Therapeutic Massage & Bodywork and other reviewed professional or academic sources.
- Define whether the education/school module should use Moodle, a custom MassageLab module, or another learning platform before building it.
- Keep source attribution, update cadence, licensing, and editorial review requirements explicit before publishing feeds.

## Alpha Release Readiness

Goal: make the current alpha boring to verify before larger product bets.

- Run the automated alpha gate: `npm run prisma:validate`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Walk `docs/alpha-qa.md` on desktop and mobile with anonymous test data only.
- Confirm Chimer, Notes, Calendar, Anatomime, Support, Roadmap, Account, Security, and Settings entry points match the README and public roadmap.
- Verify navigation states: expanded, icon-collapsed, rail open controls, click-away collapse, mobile sheet, left/right placement, keyboard focus, active route, mini-calendar visibility, and Chimer running/alerting sidebar hide behavior.
- Verify PWA install metadata, favicon/app icons, wordmark visibility, and common viewport layouts.
- Keep all PHI-bearing and health-sensitive clinical tools local-first during alpha testing.

## Navigation IA

Status: shipped. Future navigation work should build on the existing route/audience metadata and grouped sidebar model instead of replacing it.

- Primary navigation is grouped into Home, Tools, Documentation, and Games.
- Education and News remain model-only placeholders until they have visible routes.
- User Support and Roadmap remain secondary sidebar links.
- Account, Security, Settings, and sign-in/sign-out actions remain in the account menu.
- Sidebar placement remains left/right only.
- Do not build a Therapist/Practice/Client switcher until role-specific product modes are explicitly scoped.

## Calendar Creation Flows

Status: initial build shipped on `codex/calendar-creation-flows-plan`. Calendar work now uses a shared `CalendarEvent` index with specialized appointment, personal block, class, and reminder records, plus service variants and resources as catalog entities:

- Appointment flow: therapists and practice staff create or confirm service appointments with client, therapist, selected service variant, location/timezone, start/end, status, resource requirements, and service snapshots.
- Client request flow: clients request available appointment slots from path-first `/book/[practiceSlug]` pages without seeing staff-only practice calendar details.
- Personal event flow: therapists block non-clinical time that affects availability without creating clinical appointment records.
- Class flow: practice users create group classes from class-eligible service variants with capacity, enrollment status, instructor, room/resource, and client-facing visibility.
- Reminder flow: practice users create operational reminders tied to appointments, clients, classes, or personal tasks without storing clinical note content in reminder payloads.
- Service catalog: providers manage service templates, variants, duration, buffers, pricing display, resources, operational policy text, and client/class visibility.

The first build uses conservative role permissions, calendar audit rows, internal notification intent records, and resource conflict checks. External notification delivery, Google/Apple/Outlook calendar sync, and Stripe Connect marketplace payments remain deferred.

## Chimer Animation Polish

Status: shipped. Keep this section as regression guidance for future Chimer display work.

- Keep the shipped CSS/keyframe swap animation in Chimer grounded in each display state's horizontal base transform.
- Keep `prefers-reduced-motion` support.
- Preserve state changes that already exist: timer/current-time swap, full-viewport Clock Mode centering, controls fade, settings panel open/close, completion/alert state, and moving background transitions.
- Add `motion` only if future state-driven layout animation becomes too awkward for CSS.
- Do not add GSAP, Theatre.js, Anime.js, Animate.css, or Animista output unless a later interaction needs timeline-level control.
- Verify desktop and mobile screenshots, reduced-motion behavior, and no text overlap at large font sizes whenever Chimer display behavior changes.

## Generative Music Spike

Goal: prove whether Alex Bainter's Generative.fm pieces can run reliably inside MassageLab before exposing a real music product.

- Keep the first implementation hidden from main navigation.
- Use `/browse`, `components/providers/music-provider.tsx`, `lib/generators.ts`, and `types/music.ts` as the likely spike surface.
- Verify package viability for `@generative-music/*`, `@generative-music/web-library`, `@generative-music/web-provider`, Tone.js, and sample access.
- Confirm sample hosting and origin constraints before relying on `samples.generative.fm`.
- Confirm MIT licensing, bundle size, browser autoplay restrictions, start/stop cleanup, and audio context lifecycle.
- Build only a minimal proof of concept before planning library, favorites, recently played, or persistent player-bar UI.

## Captured Ideas

These are cleaned-up founder notes from May 12, 2026. They should remain visible until each item is either implemented, split into a branch plan, or deliberately removed.

- Add subscription and membership levels, including what each level gives a user access to and what they can view.
- Incorporate the intake form and body diagram currently modeled with Google Sheets and Google Forms.
- Revisit the Anatomime game.
- Expand and complete the database of anatomical structures as much as possible.
- Add a flashcard tool under Education that uses the same anatomy database as Anatomime.
- Make the anatomy database useful for multiple tools and games, including Anatomime, flashcards, body diagrams, intake workflows, and future tools.
- Plan games that support shared sessions users can join from their phones to increase engagement, encourage community and discussion, save progress, and show achievements.
- Build a News section that pulls information from reputable sources such as the International Journal of Therapeutic Massage & Bodywork and other appropriate journals or professional publications.
- Build an education/school module after deciding whether to use Moodle, another LMS, or a custom MassageLab education module.
- Build the Practice/Therapist SaaS track.
- Develop different portals and access restrictions for practice owners, therapists working at a practice, solo practice therapists, therapists whose workplace does not use MassageLab, massage students, therapist clients, and future related audiences.
- Add an Education section for interactive demonstrations.
- Add Terms of Service and other legal information.
- Add an About Me section.
- Optimize SEO and discoverability.

## Refactoring Rule

Refactor only when it preserves current behavior and makes the next branch safer, clearer, or easier to test.

Good refactor branches:

- `codex/refactor-nav-model` before navigation work if route definitions are duplicated.
- `codex/refactor-chimer-display` if future Chimer display work needs smaller component boundaries.
- `codex/refactor-music-types` if the spike reveals unclear generator/player interfaces.

Avoid broad branches like `codex/refactor-app` or `codex/cleanup`. They are hard to review and likely to mix unrelated behavior changes.
