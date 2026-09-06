# AtmoShaper Repository Migration and Modernization Design

Date: 2026-09-06

Status: Proposed design for Derrick's review

Design authority: Derrick's 2026-09-06 AtmoShaper migration handoff, which supersedes the earlier Stage 1 handoff that kept the work inside `dsbowersock/massagelab`

Design-time source observation: local `main`, `origin/main`, and the live GitHub `main` ref were all `fa78ca01a42179329cc223df77c76f308e76320b` when this document was prepared. Phase 1 must refresh this observation and may select a different source commit only when it is the latest clean, fully verified `main`.

## 1. Purpose

Move the existing MassageLab application into a new public repository named `dsbowersock/atmoshaper` without importing MassageLab's Git history and without changing the application's current design, functionality, data contracts, legal posture, production service, or rollback capability.

The old repository remains the complete historical archive and rollback source. The new repository starts from an exact verified source snapshot, records its lineage, proves initial behavioral parity, and then receives cleanup, refactoring, rebranding, provider preparation, and domain cutover through separately reviewed phases.

This is a repository migration and product-identity transition. It is not a rewrite or redesign.

## 2. Task intent and success boundary

### 2.1 TaskIntentDraft

- Outcome: a fresh-root `dsbowersock/atmoshaper` repository that initially behaves exactly like the selected MassageLab source and can be modernized without losing history, compatibility, provenance, legal evidence, or rollback capability.
- First delivery boundary: complete Phase 1 migration preflight and Phase 2 new-repository bootstrap.
- Program boundary: retain the ten-phase sequence in this design, but give later phases their own plans, branches, verification, and approval gates.
- Success evidence: exact source and destination commits; clean verification results; route, metadata, bundle, screenshot, PWA, storage, API, and provider-boundary comparisons; a classified file inventory; lineage and rollback documentation; and confirmation that restricted external systems were not mutated.
- Stop condition: stop at any failure or ambiguity listed in Section 16 instead of weakening compatibility or silently expanding authority.
- Non-goals: redesigning the product, changing current functionality, changing production infrastructure during Phases 1-6, rewriting stable internal identifiers, or modifying accepted legal documents.

### 2.2 BaselineReadSetHint

Phase 1 must read and cite the current versions of:

1. `AGENTS.md`
2. `docs/project-state.md`
3. `docs/project-log.md`
4. `docs/wiki/index.md`
5. `docs/wiki/local-development.md`
6. `docs/wiki/deployment.md`
7. `docs/wiki/privacy-and-phi.md`
8. `docs/wiki/privacy-first-data-architecture.md`
9. `docs/wiki/pwa-offline-strategy.md`
10. `docs/wiki/billing-memberships.md`
11. `docs/wiki/release-checklist.md`
12. `docs/wiki/dependency-security.md`
13. `docs/wiki/atmosphere-audio.md`
14. `LICENSE`
15. Current legal-document, acceptance, auth, billing, media, provenance, PWA, deployment, and AtmoShaper runtime owners referenced by the inventory.

Historical plans, reports, audits, and TODO files are evidence, not current authority, unless their decisions are reflected in the current state, project log, active code, or this approved design.

### 2.3 BaselineUsageDraft

- Required baseline refs: the sources in Section 2.2 plus the exact selected Git tree and hosted read-only repository/provider observations.
- Acknowledged before design: `AGENTS.md`, current project state and log, wiki index, local development, deployment, privacy/PHI, release, PWA, billing, dependency-security, Atmosphere audio, proprietary licensing, existing AtmoShaper design, and relevant recent history.
- Missing before Phase 1 execution: the complete generated file classification, exact runtime/provider inventory, exact baseline command results, and current screenshots and size measurements.
- Decision: continue with design; those missing facts are Phase 1 deliverables and may not be guessed in the implementation plan.

### 2.4 Requirement Ready Check

- Requirement source: Derrick's 2026-09-06 migration handoff.
- Goals and scope: explicit.
- Primary scenarios: source verification, fresh-root bootstrap, controlled modernization, preview rebrand, local-data/PWA transition, provider staging, and production cutover.
- Acceptance criteria: Sections 14, 15, and 17.
- Open blocker questions: none for preparing the Phase 1-2 implementation plan. Provider, legal, logo, and production choices remain intentionally gated for later phases.
- Decision: ready for design approval.

## 3. Selected architecture and alternatives

### 3.1 Selected: fresh-root repository with lineage by reference

The migration will:

1. Select the latest clean, fully verified `main` commit from `dsbowersock/massagelab`.
2. Record the exact source commit and migration date.
3. Create a new working tree snapshot from that commit without copying the old `.git` directory.
4. Initialize fresh Git history for `dsbowersock/atmoshaper`.
5. Keep `dsbowersock/massagelab` unchanged and accessible for history, pull requests, plans, reports, audits, blame, evidence, and rollback.
6. Add `MIGRATION_LINEAGE.md` to connect the new root to the old source commit.
7. Prove source/destination parity before intentional runtime changes.

This architecture gives AtmoShaper a genuinely clean repository root while retaining historical evidence at its original authoritative location.

### 3.2 Rejected: rename `dsbowersock/massagelab`

A GitHub rename would keep the full historical repository as the active product repository, would not create the requested fresh root, and would weaken the requirement that MassageLab remain an unchanged archive and rollback source.

### 3.3 Rejected: clone or mirror the full Git history

A full-history clone would preserve history inside the new repository but would also import the accumulated historical artifact set and contradict the explicit fresh-history requirement. History is preserved by exact lineage reference instead.

### 3.4 Rejected: one combined migration/rebrand/cutover change

A single combined change would make parity impossible to prove, mix reversible repository work with provider and production mutations, and make rollback and review unreliable. Repository creation, documentation consolidation, cleanup, refactoring, preview rebrand, provider staging, local-data migration, and production cutover remain separate.

## 4. Repository roles and Git boundaries

### 4.1 Existing repository

- Repository: `dsbowersock/massagelab`
- Role: current application source until cutover; permanent historical archive and evidence source afterward unless Derrick separately changes that role.
- Preparation branch: `codex/atmoshaper-migration-preflight`.
- Allowed Phase 1 content: migration inventory, verified baseline evidence, compatibility map, risk register, and the approved migration design/plan.
- Forbidden: deployment, production changes, archive, rename, deletion, read-only conversion, history rewriting, or removal of historical material.

### 4.2 New repository

- Repository: `dsbowersock/atmoshaper`
- Visibility: public.
- Creation mode: empty repository with no template files.
- Git history: fresh root; do not copy `.git`, refs, worktrees, reflogs, tags, or old commits.
- Bootstrap branch: `codex/bootstrap-atmoshaper` unless the Phase 2 plan identifies a GitHub default-branch requirement that needs a narrower bootstrap sequence.
- First tag: prohibited until the imported snapshot passes required verification.

### 4.3 Source selection

The source must be the actual latest clean and fully verified MassageLab `main`, not a handoff-era SHA, dirty worktree, preparation branch, feature branch, or partially verified commit. Local, tracked upstream, and live GitHub refs must agree before verification begins. A newer `main` discovered during Phase 1 restarts the source-baseline selection and invalidates stale evidence.

## 5. Product and terminology model

### 5.1 Public product identity

- New SaaS/platform name: `AtmoShaper`.
- Intended primary domain: `AtmoShaper.com`.
- Protective short domain: `AtmoSha.com`; it is not the product name.
- Working tagline for Preview review: `Shape the way you work, learn, and care.`
- Working description for Preview review: `AtmoShaper is a local-first toolkit for learning, independent practice, and client-centered work. Its first tools support massage therapy, anatomy education, scheduling, session timing, and small-practice workflows.`
- The tagline and description are centralized public copy and must not be inserted into legal documents without separate legal review.

Derrick's local massage therapy, tutoring, and body-oil work remain outside the SaaS brand unless separately changed.

### 5.2 Audio-feature collision

The current public audio feature named AtmoShaper will be relabeled `Atmosphere` or `Atmosphere mixer` during the preview-only rebrand phase.

The following remain stable until a dedicated later migration proves a safe reason to change them:

- `atmoshaper` source modules and component directories;
- internal types and scripts;
- tests and browser fixtures;
- storage and release identifiers;
- development and production audio paths;
- production catalog and release tooling; and
- compatibility records that already recognize those identifiers.

The platform/public product and the internal audio subsystem are separate concepts. A global text replacement is prohibited.

### 5.3 Established feature and domain language

Chimer, Anatomime, Calendar, Notes, Wellness, and other established feature names remain unchanged. Accurate massage, anatomy, education, treatment-room, clinical, and practice terminology is product-domain language and must not be removed as alleged legacy branding.

### 5.4 Brand boundary

A central product-brand owner must eventually separate:

- public product name and legacy product name;
- public description and working tagline;
- canonical and legacy hosts;
- support display name and support email;
- legal operator and copyright owner;
- current logo references and accessible text-logo fallback;
- public feature labels and the mixer label;
- compatibility identifiers;
- repository identity; and
- deployment-project identity.

The brand owner may be designed and implemented only in a focused later phase. It must not turn legally required identity or stable technical identifiers into ordinary public copy.

## 6. Visual and functional invariants

Until Derrick separately approves a specific product change, the migration must preserve:

- visible layout and visual design;
- responsive behavior and breakpoints;
- feature behavior and route meaning;
- account and authentication behavior;
- entitlement behavior and feature-key checks such as `premium_backgrounds`;
- billing semantics and Stripe reconciliation identifiers;
- accessibility, keyboard, focus, animation, and reduced-motion behavior;
- privacy and local-first boundaries;
- data ownership;
- API contracts;
- import/export and encrypted-vault compatibility;
- PWA behavior and old-origin recovery capability;
- provider-call boundaries; and
- existing working icons and visual assets.

Derrick is creating the new AtmoShaper logo separately. No phase may generate, redesign, or invent it. Before an approved asset exists, use an accessible text fallback where new identity is required. Logo, favicon, PWA icon, Open Graph, social-preview, and email variants must not be inferred.

## 7. Legal, licensing, privacy, and ownership invariants

Changing the product name does not change the legal operator or historical agreements.

Until Derrick explicitly approves a separately reviewed legal transition:

- preserve the proprietary `LICENSE`;
- preserve the current copyright owner and legal business identity;
- preserve legal document versions, effective dates, text, and acceptance logic;
- preserve historical acceptance and audit records;
- do not silently replace `Massage Lab` inside accepted legal documents;
- do not claim a trademark registration or use a registration symbol;
- do not claim AtmoShaper is registered; and
- keep product identity and legal-operator identity as separate values.

A future legal-document change requires a new version, new effective date, preserved prior text and acceptances, accurate transition language, audit continuity, and Derrick's explicit approval.

Clinical notes, intake, journals, ROM sessions, and other PHI-bearing professional-record workflows remain local-first. No migration phase may automatically transmit PHI or encrypted vault contents between origins. Hosted clinical storage remains prohibited until the documented compliance gates pass.

## 8. Snapshot inclusion and classification model

### 8.1 Material that must remain in the initial snapshot

The initial new-repository snapshot retains all runtime and compatibility-critical material, including:

- application source, tests, browser fixtures, and required assets;
- Prisma schema and every migration;
- package manifests, lockfiles, patches, and build configuration;
- current CI workflows and security controls;
- secret-free environment examples;
- proprietary license, current legal documents, acceptance/version logic, attribution, and provenance;
- active media manifests and release controls;
- current deployment, privacy, billing, security, dependency, PWA, and release instructions;
- active agent instructions;
- code-generation and maintenance scripts required by current workflows;
- data/import/export schemas and compatibility identifiers; and
- current decisions still governing runtime or operations.

A `MassageLab` name is not evidence that an item is obsolete.

### 8.2 Material requiring classification before copying

Inventory these as `keep`, `omit from new repository`, `replace with concise current document`, `convert to ADR`, `remove after proof`, `retain as compatibility`, `retain in old repository only`, or `unresolved`:

- completed Superpowers and Aegis plans;
- `.superpowers/sdd` implementation and review reports;
- stale handoffs and branch reconciliation records;
- completed migration receipts not needed for current operations;
- obsolete screenshots and old browser recordings;
- duplicate audits and documentation;
- generated preview media and recreatable catalogs;
- temporary analysis JSON;
- abandoned experiments and dead scripts;
- outdated TODO and roadmap material; and
- artifacts already preserved in the old repository that have no runtime, operational, legal, provenance, compatibility, or explanatory role in the new repository.

### 8.3 Proof required before omission

Never omit or delete an item without direct evidence when it carries:

- legal, license, attribution, or asset-provenance evidence;
- a current security/privacy decision;
- migration or irreversible-production history;
- a provider contract, data-format definition, runbook, or rollback instruction;
- a compatibility fixture or browser fixture;
- a reference from active code, tests, CI, generated output, or documentation; or
- evidence needed to explain a durable external change.

Uncertain items remain in the old repository. Omission from the new tree requires a recorded reason and does not delete the old copy.

### 8.4 Cleanup register schema

The new repository will maintain `docs/rebrand/atmoshaper-cleanup-register.md` with:

| Item | Current path | Type | Why it may be obsolete | Runtime references | Test references | Historical value | Proposed action | Proof required | Rollback | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

No audit automatically deletes an item.

## 9. Documentation architecture

The new repository begins with a smaller current-document set while the old repository retains complete history.

Required current surfaces are:

- `README.md`
- `AGENTS.md`
- `MIGRATION_LINEAGE.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/architecture.md`
- `docs/decisions/`
- `docs/wiki/index.md`
- `docs/wiki/local-development.md`
- `docs/wiki/deployment.md`
- `docs/wiki/privacy-and-phi.md`
- `docs/wiki/billing-memberships.md`
- `docs/wiki/release-checklist.md`
- `docs/wiki/dependency-security.md`
- `docs/rebrand/`
- required legal, licensing, attribution, provenance, and media documents.

Still-binding decisions buried in old plans are extracted into concise ADRs. Each ADR states the decision, rationale, compatibility boundary, revisiting trigger, and old source document or commit. Historical events must not be rewritten as if they occurred under AtmoShaper.

The new project log starts with the migration entry and links to the old log. Completed historical plans are not copied merely to make the new repository self-contained.

`MIGRATION_LINEAGE.md` must state:

- AtmoShaper continues the MassageLab software project;
- the exact source repository, source commit, and migration date;
- the old repository preserves development history and historical evidence;
- the new repository intentionally uses fresh Git history; and
- licensing and legal ownership remain governed by the current license and legal identity until separately revised.

## 10. Automated inventory and audit design

The new repository must add stable commands, using existing naming conventions where appropriate, for:

- brand/reference classification;
- repository inventory;
- likely dead-code inventory;
- asset-reference inventory; and
- environment-variable read inventory.

Candidate command names are:

- `npm run brand:audit`
- `npm run repository:inventory`
- `npm run dead-code:audit`
- `npm run asset:audit`
- `npm run env:audit`

Each command must be deterministic, testable, safe for CI, and incapable of reading `.env.local` or printing secrets. The reports must distinguish:

- current files from historical references;
- public brand copy from legal identity and private compatibility identifiers;
- classified legacy values from newly introduced unclassified values;
- proven unused items from dynamic-import/framework uncertainty; and
- audit findings from deletion authority.

Approved compatibility identifiers containing `massagelab` do not fail the brand audit. Orphaned assets, unread environment variables, and likely dead code are findings, not automatic removal instructions.

The cleanup inventory must examine at least:

- dead routes and stale API routes;
- unreachable components and abandoned experiments;
- duplicate utilities, validation logic, configuration constants, and provider configuration;
- old feature flags and unread environment variables;
- obsolete compatibility shims;
- unused CSS and design tokens;
- orphaned public assets and stale generated catalogs;
- dead scripts and unused dependencies;
- oversized mixed-responsibility files;
- ad hoc workarounds that may now have a stable shared owner;
- unnecessary client-side work;
- test-only code leaking into production bundles; and
- duplicated or contradictory current documentation.

Before any deletion or consolidation, the owning branch must establish the behavior contract, corroborate the finding through references/build/runtime/tests, make one bounded change, run focused and broad checks, compare affected UI and behavior, commit separately, and preserve a clear rollback. Static scanners are evidence sources, not deletion authority.

## 11. Compatibility identifiers that remain stable initially

The following are retained unless a later dedicated migration supplies proof, compatibility handling, and rollback:

- Prisma migration names and database object names;
- `MASSAGELAB_` environment variables;
- Stripe metadata beginning with `massagelab_`;
- Stripe idempotency namespaces;
- auth cookies and internal security headers;
- localStorage, sessionStorage, IndexedDB, Cache Storage, and encrypted-vault identifiers;
- R2 buckets, object prefixes, and hosted-media identities;
- internal audio-feature `atmoshaper` identifiers;
- export schema identifiers; and
- durable audit and operation identifiers.

These may remain permanently as private compatibility identifiers. Public naming and private compatibility naming are separate layers.

## 12. Phase design

### Phase 1: MassageLab migration preflight

Branch: `codex/atmoshaper-migration-preflight`

Deliver:

- exact source commit and source-state receipt;
- repository and provider inventory;
- keep/omit/uncertain classification;
- compatibility map;
- migration risk register;
- baseline screenshots and behavior evidence;
- the approved design and Phase 1-2 plan; and
- no production or provider mutation.

### Phase 2: new-repository bootstrap

Branch: `codex/bootstrap-atmoshaper`

Deliver:

- public `dsbowersock/atmoshaper` repository with fresh Git root;
- verified source snapshot and exact lineage;
- initially equivalent application;
- passing source/destination comparison;
- no visible runtime rebrand beyond non-runtime repository identity where necessary; and
- no production mutation or release tag.

If authenticated GitHub creation is unavailable, prepare and verify the complete new local repository and report the exact remaining operator commands. Do not substitute a history-bearing clone.

### Phase 3: documentation and artifact consolidation

Deliver concise current documentation, fresh state/log, active ADRs, required migration documents, and evidence-backed omission of historical clutter. Runtime behavior does not change.

### Phase 4: dead-code, dependency, and asset cleanup

Use separate branches when the evidence or rollback boundary differs. Remove only proven unused code, assets, scripts, flags, and dependencies. Record size/complexity comparisons and complete verification.

Suggested branches:

- `codex/atmoshaper-dead-code-audit`
- `codex/atmoshaper-dependency-cleanup`
- `codex/atmoshaper-asset-cleanup`

### Phase 5: targeted behavior-preserving refactors

One subsystem per branch. Candidates must come from measured duplication, coupling, testability, provider work, bundle weight, inconsistent error handling, accessibility risk, or workaround ownership. Each refactor defines its observable behavior contract, old-path retirement status, focused tests, broad checks, performance claim if any, and rollback.

The refactor register at `docs/rebrand/atmoshaper-refactor-register.md` uses:

| Subsystem | Current problem | Evidence | Behavior contract | Proposed boundary | Risk | Tests required | Performance measure | Rollback | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Candidate areas may include brand/product configuration, provider URL/origin configuration, repeated error handling, auth or billing projections, oversized UI modules, media-hosting configuration, environment parsing, support/legal identity copy, and compatibility adapters. Inclusion in this list is not proof that a refactor is needed.

### Phase 6: preview-only AtmoShaper rebrand

Change preview-visible product naming to AtmoShaper and relabel the audio feature Atmosphere. Retain massage-domain terminology, icons, layout, behavior, canonical production domain, providers, and production configuration. Route brand assets through the central boundary and use the approved text fallback until Derrick supplies final logo assets.

After Derrick supplies approved logo files, introduce them in their own small branch. Include only the variants actually supplied and cover primary placement, light/dark presentation when supplied, responsive sizing, accessible text alternatives, favicon/PWA/Open Graph/social/email variants when supplied and appropriate, optimization, fallback behavior, and visual regression checks. Do not infer missing variants.

### Phase 7: new Vercel project and parallel environment

Create a separate Vercel project, preferably `atmoshaper`, linked to the new repository. Begin with isolated Preview/staging resources:

- approved non-production Neon branch;
- Stripe test mode;
- non-production OAuth or authorized Preview callbacks;
- non-sending or approved test email;
- safe media reads;
- separated Sentry environment;
- host-aware origin tests;
- PWA tests; and
- local-record import/export tests.

Do not connect the new project to production database, live payments, or live email until its environment and traffic behavior are reviewed and separately authorized.

### Phase 8: local-first data and PWA transition

Inventory every cookie, localStorage key, sessionStorage key, IndexedDB database, Cache Storage name, service-worker cache, PWA scope, export format, encrypted-vault format, and device-only preference.

Known examples include:

- `massagelab-professional-record-vault-v1`
- `massagelab-professional-record-vault`
- `massagelab-donation-checkout-attempt-v1`
- `massagelab-background-preview-autoplay-v1`
- the `massagelab-shell-` service-worker-cache family.

Preserve all valid legacy imports. Emit new AtmoShaper-facing filenames only after backward-compatible import is proven. Use user-controlled encrypted export/import for professional records; never automatically move PHI or vault data across origins. Keep the old domain able to load a recovery/export experience. Plan for sign-in again, PWA replacement/reinstallation, installed-old-PWA upgrade tests, and non-destructive service-worker cleanup.

### Phase 9: provider and account cutover preparation

Inventory and stage, without guessing:

- GitHub repository settings, Actions, and badges;
- Vercel project identity, environment roles, deployments, and domains;
- Namecheap DNS;
- Neon project/integration and non-production branch strategy;
- Google OAuth consent identity, authorized JavaScript origins, and callback URLs;
- Auth.js callback/origin behavior;
- Google Calendar application identity and generated calendar names;
- Resend/SMTP sender name and domain;
- SPF, DKIM, DMARC, support email, and forwarding;
- Stripe public business details, Checkout and Portal branding, products, prices, receipts, support details, webhook endpoints, metadata compatibility, and idempotency namespaces;
- Cloudflare R2 buckets, object prefixes, media custom domains, CORS, and cache headers;
- Sentry project, environment, and release naming;
- search-engine and sitemap tools;
- social accounts; and
- PWA and possible future app-store identity.

Do not rename technical identifiers that recognize historical objects. Every write to a provider requires separate authorization and readback verification.

### Phase 10: production-domain cutover

Proceed only after the new repository, preview rebrand, new Vercel project, production environment, auth, email, Stripe, media, local-data recovery, PWA behavior, legal/business gates, and rollback rehearsal are approved and verified.

Preferred final host behavior:

- `www.atmoshaper.com` is canonical;
- `atmoshaper.com` redirects to canonical;
- `atmosha.com` redirects to canonical;
- `massagelab.app` and `www.massagelab.app` continue serving the new codebase where necessary for old-origin data recovery; and
- ordinary old-domain pages redirect only after the recovery path is available.

Do not globally redirect `massagelab.app` at the start of cutover. Host-aware handling must explain the transition, permit old-origin local-data recovery/export, link to matching AtmoShaper routes, explain PWA reinstallation, support safe sign-in, and expose support. Broad redirects require a separate decision after the recovery period.

## 13. Required Phase 1 source evidence

Before Phase 2 repository creation:

1. Confirm the source checkout is clean and has no active Git operation.
2. Confirm local `main`, tracked upstream, and live GitHub `main` match.
3. Record the exact source SHA, migration date, Git version, Node version, and npm version.
4. Run the repository-prescribed dependency installation without exposing secrets.
5. Run Prisma validation and generation.
6. Run TypeScript checks.
7. Run lint.
8. Run the full unit test suite.
9. Run the production build.
10. Run the Browser QA build and current high-value browser suites.
11. Run `git diff --check` and confirm dependency/setup commands did not alter the source tree.
12. Record the generated route count and major route-size/bundle baselines where current tooling permits.
13. Capture desktop and mobile screenshots of the main public and signed-in regression surfaces.
14. Record public metadata, manifest, robots, sitemap, service-worker registration, installability, and old/local-first behavior.
15. Record responsive breakpoints, keyboard/focus/screen-reader behavior, relevant animations, and main user paths.
16. Record the committed Prisma migration count without querying or printing private rows.
17. Record the Vercel project identity and production domains read-only.
18. Inventory external accounts, provider dependencies, and known domain-bound credentials without printing secrets.

The Phase 1 evidence must be strong enough to falsify a false parity claim. A failed baseline stops Phase 2.

## 14. Phase 2 bootstrap and parity requirements

The new repository snapshot is created from the exact selected source tree after excluding only items classified with evidence. The initial migration commit message identifies:

- `dsbowersock/massagelab`;
- the exact source commit;
- the migration date;
- the fact that full history remains in the old repository; and
- the behavior-preserving intent.

The destination then repeats, at minimum:

- clean dependency installation;
- Prisma validation and generation;
- typecheck;
- lint;
- full unit suite;
- production build;
- Browser QA build and high-value browser tests;
- repository and brand audit tests available at bootstrap;
- route, metadata, manifest, robots, sitemap, PWA, screenshot, API, storage, and bundle comparisons; and
- `git diff --check`.

No parity claim is allowed when the destination result is narrower, stale, or different from the source result. Any difference must be either corrected back to source behavior or approved as a separately intentional change outside bootstrap.

## 15. External mutation boundary

Phases 1-6 do not authorize:

- production deployment;
- DNS or production-domain changes;
- OAuth-provider changes;
- live email or sender-domain changes;
- Stripe live-mode changes, Checkout, payment, refund, cancellation, or webhook changes;
- R2 object moves, uploads, or domain changes;
- database schema changes or production database writes;
- legal-document or acceptance-version changes;
- old-repository archive, rename, deletion, visibility change, or history rewrite;
- support-email retirement; or
- release tags.

Creation of the explicitly requested public GitHub repository is authorized for Phase 2 after Phase 1 passes. All other provider or production mutations need separate explicit authorization with exact targets, expected effect, rollback, and readback plan.

## 16. Stop conditions

Stop and report instead of improvising when:

- the source checkout is dirty, detached, conflicted, or in an active Git operation;
- source refs disagree or the source baseline fails;
- the destination differs before an intentional change;
- a proposed omission or deletion lacks corroborating proof;
- a refactor changes visible design, functionality, accessibility, API behavior, privacy, or provider ownership;
- a legacy import or export format would stop working;
- encrypted local records might become unreadable;
- a domain-bound credential, passkey, WebAuthn, encryption, or old-origin dependency appears;
- Stripe reconciliation depends on an identifier proposed for renaming;
- OAuth or another provider cannot safely support parallel domains;
- legal operator and product identity cannot be separated safely;
- a required historical or operational document cannot be omitted safely;
- a branch becomes too broad for meaningful review; or
- the next action crosses the external mutation boundary without specific authorization.

## 17. Required migration documents

The new repository must contain:

1. `MIGRATION_LINEAGE.md`
2. `docs/rebrand/atmoshaper-migration-charter.md`
3. `docs/rebrand/atmoshaper-reference-inventory.md`
4. `docs/rebrand/atmoshaper-external-account-checklist.md`
5. `docs/rebrand/atmoshaper-domain-cutover-plan.md`
6. `docs/rebrand/atmoshaper-local-data-and-pwa-plan.md`
7. `docs/rebrand/atmoshaper-cleanup-register.md`
8. `docs/rebrand/atmoshaper-refactor-register.md`
9. `docs/rebrand/atmoshaper-rollback-plan.md`
10. `docs/superpowers/specs/2026-09-06-atmoshaper-repository-migration-design.md`
11. `docs/superpowers/plans/2026-09-06-atmoshaper-repository-migration.md`

The design and plan are created first on the MassageLab preparation branch to govern the work, then carried into the new repository with accurate lineage. Phase 3 may consolidate surrounding historical documentation but must not change the approved migration contract silently.

## 18. Verification and comparison model

Before visible rebrand or refactoring, record:

- desktop/mobile screenshots;
- responsive geometry and breakpoints;
- primary public and signed-in user journeys;
- keyboard, focus, screen-reader, reduced-motion, and animation behavior;
- main route loading and error behavior;
- PWA installation/offline behavior;
- local-record and encrypted-vault workflows;
- auth, account, booking, billing, entitlement, and support boundaries;
- storage and export formats;
- API contracts and provider calls; and
- route and bundle measurements.

After every cleanup or refactor, compare the affected subset and run broader regression checks. Size or performance improvements require before/after measurements. A scanner finding alone is never proof of safe deletion.

## 19. Rollback architecture

- The old repository and its exact source commit remain unchanged and accessible.
- Every cleanup/refactor is a bounded commit or PR with focused evidence.
- The initial new-repository commit provides a parity baseline before rebrand or modernization.
- Provider and domain changes use parallel environments and explicit readback before traffic moves.
- The old origin continues to serve local-data recovery during the defined transition window.
- Production cutover includes a rehearsed reversal to the prior verified deployment and host configuration.
- No phase destroys old-origin browser data or historical evidence as part of rollback preparation.

## 20. First completion report contract

The combined Phase 1-2 report must provide:

- selected MassageLab source SHA;
- new repository URL and initial commit SHA;
- proof that the new repository has a fresh root;
- file counts and lists/summaries for copied, omitted, and unresolved items;
- source and destination install, Prisma, typecheck, lint, test, build, and Browser QA results;
- screenshot/UI parity result;
- route-count and bundle-size comparison;
- metadata, PWA, storage, export, legal, and compatibility result;
- every discovered external account/provider and known domain dependency;
- highest-risk cleanup and highest-value refactor candidates;
- confirmation that old history remains intact; and
- confirmation that no production, DNS, provider, database, email, payment, media, or legal mutation occurred.

The report ends with the recommended next branch. It does not claim later phases complete.

## 21. Aegis design review

### 21.1 Aegis Visibility

Design-first handling prevents a repository bootstrap from accidentally becoming a rebrand, cleanup, provider migration, legal transition, or compatibility rewrite.

### 21.2 ImpactStatementDraft

- Affected layers: Git repository identity, documentation authority, CI, build/test evidence, brand copy, legal/product identity separation, deployment configuration, provider inventory, local-browser persistence, PWA origin, and domain routing.
- Canonical owners: old repository for historical evidence; exact selected source commit for bootstrap content; new repository for future AtmoShaper development; current runtime owners for behavior and compatibility; separate later brand owner for public identity.
- Preserved invariants: Sections 5-7 and 11.
- Non-goals: broad cleanup, runtime rebrand, provider mutation, production cutover, or legal change during bootstrap.
- Risk: a fresh tree can appear correct while silently losing historical, legal, provenance, dynamic-import, local-storage, or provider-contract dependencies.

### 21.3 Existence Check

- Proposed new surface: a fresh repository, lineage document, migration document set, deterministic inventory/audit commands, and a later central brand boundary.
- Existing reuse candidates: GitHub rename, old repository documentation, existing one-off scans, and global string replacement.
- Why insufficient: they do not provide a fresh root, durable lineage, classified cleanup authority, CI-safe drift detection, or separation of public product identity from legal and compatibility identities.
- Creation proof: each new surface is directly required by the migration handoff and has an explicit consumer and verification role.
- Entropy control: phase-specific documents are consolidated in Phase 3; audit outputs do not become competing authority; the old repository retains historical detail.
- Decision: add with proof, in the phases that own each surface.

### 21.4 Product Risk Lens

- Value: a clear AtmoShaper identity and maintainable repository without losing the working product or its evidence.
- Non-goals: novelty, redesign, mass renaming, or cleanup for its own sake.
- Main trade-off: fresh history improves clarity but requires rigorous lineage and omission evidence.
- Decision: select fresh-root migration with old-repository preservation and parity-first sequencing.

### 21.5 Architecture Integrity Lens

- Invariant: one exact source tree must explain the initial destination tree.
- Canonical source owner: selected verified MassageLab `main` commit.
- Historical owner: old repository.
- Future-development owner: new repository after parity bootstrap.
- Responsibility overlap: allowed only during the parallel validation/cutover window; runtime changes are not maintained independently in both repositories.
- Higher-level simplification: centralize public brand configuration later while retaining private compatibility values at their current owners.
- Retirement/falsifier: any unexplained tree or behavior difference falsifies bootstrap parity; any proposed old-identifier retirement requires dedicated evidence.
- Verdict: aligned when phase boundaries and exact lineage are preserved.

### 21.6 Baseline Role Alignment

- Product/requirement baseline: this approved design plus current project state for existing behavior.
- Architecture/runtime boundary baseline: exact selected source tree, current runtime owners, legal/PHI constraints, and compatibility map.
- Result: aligned.
- Scope: requirements and architecture.
- Next action after approval: prepare the detailed Phase 1-2 implementation plan; do not execute it until its review boundary is satisfied.

### 21.7 Plan-time complexity signal

The migration program is intentionally too broad for one executable plan. The safe unit is one plan for Phases 1-2, followed by separate phase/subsystem plans. Audit tooling and the brand boundary are new maintained owners and require focused task boundaries and tests rather than being folded into repository copying.

### 21.8 ADR signals

Later ADRs must record at least:

- fresh-root history with lineage by reference;
- old-repository historical/rollback ownership;
- public brand identity separated from legal operator and compatibility identifiers;
- old-origin local-data/PWA recovery during domain transition; and
- parallel provider/environment staging before production cutover.

The alternatives in Section 3 are the decision alternatives for those ADRs. ADR acceptance occurs when the corresponding architecture is implemented and verified, not merely because this design proposes it.

## 22. Design approval boundary

Approval of this document authorizes preparation of the detailed Phase 1-2 implementation plan. It does not by itself authorize executing the plan, creating the public repository, pushing branches, opening pull requests, deploying, changing providers, changing production, changing legal documents, or performing the domain cutover beyond authority already stated explicitly in Derrick's handoff.

The implementation plan must translate this design into exact file paths, commands, expected results, independently reviewable commits, rollback points, and stop checks without broadening the phase scope.
