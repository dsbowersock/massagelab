# Homepage And Onboarding Design

Date: 2026-06-15

## Context

MassageLab is in private alpha with public tools, education surfaces, calendar/booking workflows, account sync for safe preferences, feature-key memberships, and local-first clinical documentation boundaries. The current homepage lets visitors jump into tools, but it reads more like a tool grid than a compelling public entry point.

The new direction keeps the first public visit non-intrusive. Visitors should not be forced into role questions or onboarding before they can inspect or use the site. The homepage should make MassageLab feel broadly useful across roles, show concrete available value, and make account creation feel like a natural next step. Role and onboarding questions happen after account creation.

## Goals

- Make the public homepage feel like a polished product gateway instead of only a tool launcher.
- Convey that MassageLab can help therapists, students, educators, clients, and curious public users.
- Use an optional, action-oriented tool router on the homepage without collecting onboarding data before signup.
- Move role-specific onboarding to the first signed-in activation experience.
- Make the post-account onboarding feel engaging and game-like while preserving trust, consent, and practical utility.
- Keep available tools visible at the bottom of the homepage after the persuasion and routing sections.

## Non-Goals

- Do not require first-time public visitors to answer questions.
- Do not block public tool access behind onboarding.
- Do not collect PHI or client-identifying clinical information during account onboarding.
- Do not imply hosted clinical sync, hosted SOAP assistance, or cloud PHI storage is available.
- Do not branch entitlement behavior on displayed plan names; continue using feature keys.
- Do not build a full role dashboard before the role-specific workflows are defined.

## UX Decision Brief

- Job: help a first-time visitor understand why MassageLab matters, find a useful tool, and feel enough trust/value to create an account.
- User mode: first-time anonymous visitor, returning anonymous visitor, and newly registered signed-in user.
- Frequency/risk: homepage is low-risk browse; onboarding touches account profile and role preferences, so it must be explicit, skippable, and resumable.
- Pattern: product proof homepage with optional tool router; post-account guided setup with skip/resume.
- Primary action: create a free account.
- Secondary actions: explore tools, start a public education tool, view pricing, read roadmap/trust context.
- Core path: land on homepage -> see role-spanning value -> optionally choose an action path -> inspect tools/results -> create account -> complete role-aware lab setup.
- Recovery path: visitors can skip the router, use tools directly, sign in later, skip onboarding steps, or resume setup from the signed-in home/account area.
- Required states: anonymous, signed-in without onboarding, signed-in with partial onboarding, signed-in with complete onboarding, loading, reduced motion, unavailable verification state, membership-required feature state.
- Handoff constraints: keep public homepage optional and low-friction; keep PHI-bearing workflows local-first; use current visual system, brand colors, and fonts.

## UI Decision Brief

- Surface type: product proof landing page plus app entry point.
- Visual direction: branded product-led with restrained motion, current dark/orange MassageLab palette, existing wordmark treatment, and sleek utility.
- Hierarchy: hero promise first, proof/use cases second, optional tool router third, account value fourth, available tools catalog last.
- Density: more polished than a dashboard, but not a generic marketing page. The page must still expose practical tools quickly.
- Motion budget: one signature text animation in the hero using Flip Words; subtle hover/focus states elsewhere. Respect `prefers-reduced-motion`.
- Component grammar: use existing `AppPageShell`, `AppSurface`, buttons, and lucide icons where possible. Avoid nested card-heavy sections.
- Responsive behavior: first viewport must show brand/value plus at least a hint of the next section on desktop and mobile. Tool router and catalog collapse into scan-friendly single-column groups on small screens.

## Public Homepage Design

### Hero

The hero should center the public promise around MassageLab's usefulness across roles.

Proposed headline pattern:

> MassageLab helps [therapists / students / educators / clients / curious people] make anatomy, care, and practice tools more useful.

The bracketed word uses the Aceternity Flip Words component or a locally equivalent component with the same behavior: a supplied `words` array, a visible duration around 3000ms, and class-based styling. The animation should be used only for the role word, not for the whole headline. If reduced motion is enabled, render one stable word or an inline comma-separated role phrase.

Primary CTA:

- Create a free account

Secondary CTA:

- Explore tools

Supporting copy should emphasize practical independence: study, teach, document locally, run sessions, organize care, and support future compliant sync without implying hosted clinical features exist today.

### Product Proof Section

Below the hero, show role-spanning outcomes rather than generic feature cards.

Suggested proof lanes:

- Learn anatomy with sourced flashcards and visual prompts.
- Teach or play Anatomime with shared classroom sessions.
- Pace treatment-room work with Chimer.
- Keep therapist documentation local-first and under user control.
- Organize scheduling, availability, booking, and waitlist workflows.
- Support future compliance and education work through memberships.

Each lane should connect to a real route and current capability. Future benefits can be mentioned only when clearly labeled as funded/future roadmap work.

### Optional Tool Router

The homepage can ask:

> What are you here for today?

This is not onboarding and does not save a role. It should behave as a direct action router.

Router options:

- Study anatomy -> `/education/flashcards`
- Teach or play -> `/anatomime`
- Run a session -> `/chimer`
- Organize a practice -> signed-in users go to `/calendar`; anonymous users go to `/register?callbackUrl=/calendar`
- Document locally -> `/notes`
- Just exploring -> scroll to available tools or route to `/browse`

The router should be clearly optional. If a visitor ignores it, the page still works.

### Account Value Section

After the router, explain why creating an account improves the experience:

- Save safe preferences.
- Save flashcard progress and deck templates.
- Keep account/profile defaults portable.
- Review membership options.
- Start role-aware setup after signup.
- Support the roadmap for education, practice workflows, and compliant sync groundwork.

This section should not overpromise. Clinical note contents, intake forms, journals, ROM sessions, and similar PHI-bearing workflows remain local-first unless future compliance gates pass.

### Available Tools Catalog

At the bottom of the homepage, add a clear catalog of available tools after the hero, proof, router, and account-value sections.

The catalog should be practical and scannable:

- Chimer: treatment-room timer and clock mode.
- Education flashcards: sourced anatomy study with public decks and signed-in progress.
- Anatomime: anatomy game with solo and shared classroom play.
- Local-first notes: SOAP, intake, journal, and ROM tools behind the local encrypted vault and membership capability where required.
- Calendar and booking: scheduling, availability, booking settings, public booking links, waitlist, and provider capacity controls.
- Account and memberships: profile, preferences, role verification, pricing, Stripe checkout, and billing portal.
- Roadmap/support: public roadmap and support paths for future work.

Each tool item should include:

- Name.
- One concrete benefit.
- Availability/status label such as Public, Signed-in, Membership, Local-first, or Alpha.
- Primary route link.

The catalog should be the final homepage section before footer-level content so visitors who scroll for specifics can find everything without the page feeling like only a marketing funnel.

## Post-Account Onboarding Design

### Entry Point

After account creation and email/session completion, the first signed-in destination should be a guided setup surface rather than dropping everyone into a generic account page.

Working concept:

> Set up your lab

This should feel lightly game-like: clear steps, progress, optional quests, and visible rewards in usefulness. Avoid gimmicks that reduce trust around health, billing, or clinical boundaries.

### Step 1: Role

Ask what best describes the user:

- Massage therapist
- Student
- Educator
- Client
- Public wellness/anatomy learner
- Practice owner or staff
- Just exploring

This choice should be changeable later. It should tailor defaults and suggested widgets, not permanently constrain the account.

### Step 2: Role-Specific Setup

Therapist/practice path:

- Basic professional profile defaults.
- State/jurisdiction.
- License number and issuing authority when relevant.
- Ohio automatic verification when available.
- Other jurisdictions enter a pending/manual or "verification not available yet" state.
- Practice/business details only where they support account, booking, calendar, or local note defaults.
- Local-first notes setup guidance and vault boundary reminder.

Student path:

- Current program or study context.
- Exam/learning goals.
- Preferred anatomy study depth.
- Suggested flashcard decks and Anatomime use.
- Student access/verification if applicable.

Educator path:

- Class size/context.
- Teaching focus.
- Anatomime/shared-session setup.
- Starter public decks or classroom study flows.

Client/public learner path:

- Main interest such as pain-location literacy, movement, anatomy curiosity, wellness education, or preparing for appointments.
- Suggested safe education routes.
- No diagnosis or treatment claims.

Just exploring:

- Skip setup and land on a general signed-in home with suggested tools.

### Step 3: Personalized Signed-In Home

After onboarding, the signed-in home should become a configurable command surface:

- Suggested tools based on role and intent.
- Shortcuts/widgets that can be reordered later.
- Progress widgets for flashcards and Anatomime where relevant.
- Calendar/booking setup widgets for practice users.
- Therapist local-default and vault setup widgets when entitled.
- Membership/upcoming capability prompts that are contextual, not noisy.

Widget movement can come after the first version. The first implementation only needs the data model and layout boundaries to support reordering later.

## Data And Privacy Notes

- Homepage router choices should not create account records before signup.
- Account onboarding data should be limited to role, preferences, professional verification fields, and non-PHI defaults.
- Therapist documentation contents remain in the encrypted local browser vault and are not uploaded.
- Verification payloads should continue using existing credential verification boundaries.
- State/jurisdiction verification must gracefully handle unsupported states with a clear "not available yet" state.
- Any membership copy should describe feature keys and funded future work, not unavailable hosted clinical capabilities.

## Implementation Shape

The implementation should be split into branch-sized work:

1. Public homepage refresh: hero with Flip Words, proof lanes, optional action router, account value section, and bottom available tools catalog.
2. Post-account onboarding foundation: role selection, skip/resume, role-specific question framework, and first personalized signed-in home defaults.
3. Personalization persistence and editable widgets: reorderable shortcuts, saved widget preferences, and deeper role-specific modules.

The first branch can ship without the full onboarding data model if needed. It should not pretend onboarding is complete; it can route new signups to the existing account area until the onboarding branch lands.

## Acceptance Criteria

- Anonymous visitors can land on the homepage and use or inspect tools without answering questions.
- The hero communicates multi-role usefulness with a single restrained Flip Words motion element.
- Reduced-motion users are not forced through animated text.
- The optional "What are you here for today?" section routes users to helpful tools without saving onboarding data.
- The primary CTA clearly points to account creation.
- Account value copy explains saved progress/preferences and membership support without overpromising hosted clinical sync.
- The bottom of the page includes a clear available-tools catalog with concrete current routes.
- Post-account onboarding is specified as a skippable, resumable signed-in flow.
- Role-specific onboarding supports therapist verification, including unsupported-jurisdiction states.
- PHI-bearing workflows remain local-first in copy, data flow, and implementation notes.
- The design fits the current MassageLab dark/orange visual system and remains responsive on mobile.
