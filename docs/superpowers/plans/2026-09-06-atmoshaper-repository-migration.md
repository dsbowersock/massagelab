# AtmoShaper Repository Migration Phase 1-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use Aegis ownership, compatibility, migration, and verification checks throughout. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove an exact MassageLab source baseline and create a fresh-root public `dsbowersock/atmoshaper` repository whose initial runtime, visual behavior, data contracts, and safety boundaries match that source.

**Architecture:** Treat the latest verified MassageLab `main` commit as an immutable source tree. Record source evidence and migration-only characterization tooling on `codex/atmoshaper-migration-preflight`, export the exact source tree without `.git`, overlay only approved migration documents/tests, initialize fresh Git history in a sibling repository, verify parity locally, and then publish `main` plus a review branch without merging it. Historical material stays in `dsbowersock/massagelab`; the new repository carries exact lineage and only evidence-backed omissions.

**Tech Stack:** Git/GitHub CLI, PowerShell, Node.js 24.x, npm, Next.js 16, React 19, Prisma 7, Node test runner, Playwright, Vercel CLI read-only inspection, Markdown, and deterministic JSON audit policy.

**Spec:** `docs/superpowers/specs/2026-09-06-atmoshaper-repository-migration-design.md`

## Global Constraints

- Source repository: `https://github.com/dsbowersock/massagelab`.
- Destination repository: public `https://github.com/dsbowersock/atmoshaper` with fresh Git history.
- Local destination: `C:\Users\derri\code\my_projects\atmoshaper`.
- Refresh the source SHA immediately before baseline work; do not assume the design-time `fa78ca01a42179329cc223df77c76f308e76320b` remains current.
- Do not export from a dirty checkout, detached HEAD, feature branch, or unverified commit.
- Do not copy the old `.git` directory, refs, tags, reflogs, worktrees, or ignored/private files.
- Preserve runtime behavior, visuals, accessibility, routes, account/auth behavior, feature-key entitlements, billing semantics, local-first PHI boundaries, APIs, storage keys, import/export formats, PWA behavior, and provider-call boundaries.
- Do not globally replace `MassageLab` or rename private compatibility identifiers.
- The public audio feature is later called `Atmosphere`; internal `atmoshaper` code, scripts, data, tests, storage, and release identifiers remain unchanged in Phases 1-2.
- Preserve the proprietary license, legal identity, legal versions/text, acceptance history, attribution, and provenance.
- Do not generate or invent logo assets.
- Do not deploy, change DNS, connect production resources, mutate providers, change database schema, write production data, send email, create payments, alter legal documents, merge a PR, or create a release tag.
- Creation of the requested public GitHub repository and pushes needed to open the two migration PRs are in scope only after local gates pass.
- Stop on any design Section 16 condition.

---

## Baseline and authority

### Required read set

Before Task 1, re-read:

- `AGENTS.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/wiki/local-development.md`
- `docs/wiki/ci-pr-checks.md`
- `docs/wiki/deployment.md`
- `docs/wiki/privacy-and-phi.md`
- `docs/wiki/privacy-first-data-architecture.md`
- `docs/wiki/pwa-offline-strategy.md`
- `docs/wiki/billing-memberships.md`
- `docs/wiki/release-checklist.md`
- `docs/wiki/dependency-security.md`
- `docs/wiki/atmosphere-audio.md`
- `LICENSE`
- the approved design spec.

### BaselineUsageDraft

- Required refs: the read set above, the exact selected source Git tree, current CI/browser owners, and read-only hosted GitHub/Vercel observations.
- Acknowledged before plan: all listed current authority categories, current package scripts, CI lane ownership, Playwright configuration, current browser fixture safety, and design commit `14f60fc1bc63e12b65b28c353b83e5f159247645`.
- Missing refs: execution-time source SHA, exact command results, exact file classification, screenshots, route/bundle figures, and destination commit IDs.
- Decision: continue; each missing value is produced by an explicit task and may not be filled from memory.

### Compatibility boundary

The destination runtime tree must be byte-identical to the selected source tree except for an enumerated set of documentation, migration audit tooling, migration tests/snapshots, and evidence-backed omissions. Every non-identical path must appear in the reference inventory with a reason. No difference may alter the compiled application, persistent formats, provider behavior, or user-visible product before a later approved phase.

### TDD Route

- Mode: off.
- Decision: skipped for strict RED/GREEN.
- Strict authority: not applicable; the handoff requires test-backed work but does not require strict TDD.
- Test posture: characterization tests for parity surfaces and post-change regression tests for the two migration audit owners.
- Reason: Phases 1-2 primarily copy and document an existing verified tree. New audit code receives focused fixture tests, while snapshot parity deliberately begins by accepting the source rendering and then falsifies destination drift.
- Verification: focused Node tests, explicit Playwright source-baseline capture/destination comparison, full repository checks, and hosted CI.

## Aegis planning checks

### Aegis Visibility

The plan keeps repository creation from silently absorbing rebrand, cleanup, legal, local-data, provider, or production work and makes every allowed destination-tree difference explainable.

### Requirement Ready Check

- Requirement source: approved design spec at commit `14f60fc1`.
- Scope: Phase 1 preflight and Phase 2 bootstrap only.
- Acceptance: exact source identity, classified snapshot, fresh root, local and hosted verification, parity evidence, and no restricted mutation.
- Open blocker questions: none before execution. Missing source/provider facts are stop-capable evidence tasks, not discretionary design questions.
- Decision: ready.

### Change Necessity

- User-visible need: none in Phases 1-2; behavior must remain unchanged.
- Non-code option: sufficient for inventory and lineage, but insufficient for repeatable screenshot parity and required CI-safe brand/repository audits.
- Minimum code boundary: migration-only Playwright characterization plus scripts under `scripts/repository-audit/`; no runtime import may reference them.
- Decision: documentation/config plus migration-only test/tooling changes.

### Existence Check

- New surfaces: migration parity spec, audit policy, brand audit, repository inventory, and lineage/migration documents.
- Reuse candidates: existing public-route/PWA tests, one-off `rg`/`git ls-files` commands, old historical plans, and a GitHub rename.
- Reuse decision: reuse existing browser helpers and CI commands; add the minimal missing migration-specific surfaces because one-off commands cannot enforce destination drift or record lineage.
- Entropy control: audit code stays outside runtime, migration snapshots have a documented retirement review after Phase 6, and historical documents remain owned by the old repository.
- Decision: add with proof.

### Architecture Integrity Lens

- Source owner: exact selected MassageLab `main` tree.
- Historical owner: `dsbowersock/massagelab`.
- Future-development owner: `dsbowersock/atmoshaper` after bootstrap.
- Overlap: allowed only for migration evidence and compatibility comparison; do not maintain runtime changes independently in both repositories.
- Falsifier: unexplained file or behavior difference, failed source gate, or new runtime import of migration audit code.
- Verdict: proceed with exact export plus enumerated overlay.

### Complexity Budget

- Artifact class: migration program and repository-only audit tools.
- Current pressure: high document/history volume (1,857 tracked files at plan time; 121 historical Superpowers plans and 30 Aegis work records are explicit classification candidates).
- Projected pressure: controlled by a machine-readable policy, two small CLI owners, one browser characterization spec, and phase-specific documents.
- Budget result: at risk if audit logic becomes a general static-analysis framework or if all ten phases are placed in this plan.
- Planned governance: stop at Phase 2, keep runtime untouched, and defer dead-code/asset/env scanners to their later plans.

### Plan Pressure Test

- Owner/contract/retirement: owners and post-Phase-6 review triggers are explicit.
- Higher-level path: exact tree export plus a difference manifest is simpler than reconstructing the app manually.
- Verification: source and destination use the same commands, browsers, fixtures, and snapshots.
- Task executability: commands, paths, commits, and stop checks are specified below.
- Result: proceed.

## File map

### MassageLab preparation branch

Create:

- `docs/rebrand/atmoshaper-migration-charter.md` — phase authority, exact source identity, verification tables, and current phase status.
- `docs/rebrand/atmoshaper-reference-inventory.md` — keep/omit/unresolved classification, destination differences, compatibility map, and source evidence.
- `docs/rebrand/atmoshaper-export-manifest.json` — machine-readable exact source SHA plus ordered omit, replace, and overlay paths consumed by the export.
- `docs/rebrand/atmoshaper-external-account-checklist.md` — read-only external account/provider/domain inventory.
- `docs/rebrand/atmoshaper-domain-cutover-plan.md` — host matrix, prerequisites, recovery window, and later cutover gates.
- `docs/rebrand/atmoshaper-local-data-and-pwa-plan.md` — cookies/storage/cache/export/PWA compatibility inventory and transition design.
- `docs/rebrand/atmoshaper-cleanup-register.md` — evidence-backed cleanup candidates with no automatic deletion.
- `docs/rebrand/atmoshaper-refactor-register.md` — evidence-backed later refactor candidates.
- `docs/rebrand/atmoshaper-rollback-plan.md` — Phase 1-2 rollback and later provider/cutover requirements.
- `tests/browser/atmoshaper-repository-migration-parity.spec.ts` — explicit source/destination visual and functional characterization.
- Playwright snapshots generated beside that spec for desktop and mobile source surfaces.

Modify:

- `package.json` — add only the migration parity command on the preparation branch.
- `docs/project-state.md` — record the preflight branch, source selection, gate result, and next action after evidence exists.
- `docs/project-log.md` — append the dated design/preflight entries without rewriting history.

### New AtmoShaper repository

Carry from the preparation branch:

- the approved design and implementation plan;
- all eight narrative `docs/rebrand/` documents plus the reviewed export manifest;
- the migration parity spec and snapshots; and
- the migration parity `package.json` script.

Create or replace:

- `MIGRATION_LINEAGE.md` — exact source repository/SHA/date and legal/history statement.
- `README.md` — repository identity and explicit note that runtime rebrand is deferred to Phase 6.
- `docs/project-state.md` — fresh AtmoShaper current state beginning at bootstrap.
- `docs/project-log.md` — fresh chronological log beginning with migration and linking to MassageLab history.
- `scripts/repository-audit/core.mjs` — tracked-file and safe-text scanning primitives.
- `scripts/repository-audit/inventory.mjs` — deterministic repository inventory CLI.
- `scripts/repository-audit/brand.mjs` — exact-baseline old-brand reference CLI.
- `scripts/repository-audit/policy.json` — secret exclusions and legacy-reference classifications.
- `scripts/repository-audit/brand-reference-baseline.json` — exact reviewed legacy occurrences.
- `tests/repository-audit.test.mjs` — deterministic, private-file, and unclassified-reference tests.

Modify:

- `package.json` — add `repository:inventory` and `brand:audit`.
- `AGENTS.md` — make the new project state/log read-first and preserve the public-brand/legal/compatibility split.

No application, component, Prisma, runtime library, persistent schema, CI workflow, or asset file is intentionally modified in this plan.

## Execution Readiness View

- Intent Lock: deliver only Phase 1 preflight and Phase 2 bootstrap.
- Scope Fence: no cleanup deletion, behavior refactor, preview rebrand, provider staging, local-data migration, production cutover, merge, tag, or deployment.
- Baseline Lock: execution-time live GitHub `main` must equal local `main` and `origin/main`; the exact SHA is immutable once source verification begins.
- Approved Behavior: every existing source behavior and visual remains the destination behavior.
- Owner Constraints: old repo owns history; source commit owns baseline; new repo owns future work; legal/runtime owners remain unchanged.
- Compatibility Boundary: Section 11 of the design plus the explicit local-data/PWA and legal constraints.
- Retirement Boundary: no internal identifier retires; migration parity assets receive a review trigger after preview rebrand, not automatic deletion.
- Task Batches: Tasks 1-4 are Phase 1; Tasks 5-10 are Phase 2.
- Test Obligations: focused migration tests, full Node suite, production build, Browser QA build, all four ordinary CI lanes, migration parity on desktop/mobile, audits, and hosted CI.
- Review Gates: source baseline before export; destination parity before GitHub creation; hosted PR before any merge decision.
- Drift Rule: if `main` advances before export, discard stale source measurements and restart Task 1 against the new clean head. Do not merge or rebase runtime changes into the locked snapshot.
- Evidence Required: exact SHAs, clean statuses, command exits/counts, snapshot results, route/bundle/migration counts, provider/domain inventory, and difference manifest.
- Advisory Boundary: this plan does not itself authorize completion, merging, deployment, or production/provider mutation.

---

### Task 1: Lock the exact MassageLab source and initialize migration authority documents

**Files:**

- Create: `docs/rebrand/atmoshaper-migration-charter.md`
- Create: `docs/rebrand/atmoshaper-rollback-plan.md`

**Interfaces:**

- Consumes: approved design commit `14f60fc1`, current repository authority docs, local/tracked/live Git refs.
- Produces: one exact `sourceSha`, one migration date, a Phase 1 status record, and rollback rules used by every later task.

**Why:** Every following measurement and exported byte must identify one immutable source commit.

**Impact/Compatibility:** Documentation only. Do not alter `main`, delete stale Git metadata, or change runtime files.

**Verification:** Local/tracked/live SHAs agree; checkout has no active operation or unrelated changes; both documents name the same source SHA.

- [ ] **Step 1: Re-read the complete approved spec and authority set**

Run the Required read set in order. Record contradictions as stop conditions; do not silently choose between current authority files.

- [ ] **Step 2: Capture `TaskStartSnapshot`**

Run:

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse main
git rev-parse origin/main
git status --porcelain=v2 --branch
git diff --name-only
git diff --cached --name-only
git worktree list --porcelain
```

Also check `.git\rebase-merge`, `.git\rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, and `BISECT_LOG`. The repository has an old standalone `.git\REBASE_HEAD` observed from May 2026; treat only an active rebase directory or Git status state as an active rebase, and do not delete that historical metadata as part of this task.

Expected: branch `codex/atmoshaper-migration-preflight`; only this plan/spec commit history; no uncommitted paths; one root worktree; no active Git operation.

- [ ] **Step 3: Verify the live GitHub ref without changing provider state**

Run through the authenticated WSL GitHub CLI:

```powershell
wsl.exe -d Ubuntu -- gh api repos/dsbowersock/massagelab/commits/main --jq .sha
```

Compare the printed 40-character SHA with both `git rev-parse main` and `git rev-parse origin/main`. Stop if any differs. If `main` advanced, recreate the source measurements against that new clean commit before proceeding; do not keep the design-time SHA merely for convenience.

- [ ] **Step 4: Record toolchain identity**

Run:

```powershell
node -v
npm -v
git --version
```

Expected: Node satisfies `24.x`; record exact npm and Git versions without claiming they are project requirements unless current docs say so.

- [ ] **Step 5: Write the migration charter**

Create `docs/rebrand/atmoshaper-migration-charter.md` with these exact sections:

```markdown
# AtmoShaper Migration Charter

## Authority
- Approved design and plan links
- Superseded handoff statement

## Source Lock
- Source repository
- Exact selected `main` SHA
- Selection date
- Local/tracked/live-ref agreement
- Node, npm, and Git versions

## Phase Scope
- Phase 1 and Phase 2 deliverables
- Explicit later-phase deferrals

## Compatibility Invariants
- Runtime and visual parity
- Legal/operator separation
- Local-first PHI boundary
- Stable private identifiers
- Atmosphere public label versus internal `atmoshaper` identifiers

## Verification Ledger
| Gate | Source result | Destination result | Comparison | Evidence date |

## Current Status
- Current phase
- Last passed gate
- Current stop condition, or `none`
- Next exact action
```

Insert the command outputs from Steps 2-4; do not use placeholders or copy a stale SHA.

- [ ] **Step 6: Write the rollback plan**

Create `docs/rebrand/atmoshaper-rollback-plan.md` covering:

- Phase 1 rollback: revert only task-owned documentation/test commits; source `main` and production remain untouched.
- Phase 2 pre-publication rollback: retain the failed local destination for diagnosis or remove only after exact-path approval; never alter old repo history.
- Phase 2 post-publication rollback: stop new-repo work, leave old production serving, preserve the public repo for evidence, and do not delete it without separate authorization.
- Later deployment/domain rollback prerequisites without executing them.
- Old-origin local-data recovery as a non-removable cutover dependency.

- [ ] **Step 7: Verify and commit Task 1**

Run:

```powershell
git diff --check
git status --short
```

Stage only the two Task 1 documents and commit:

```powershell
git add docs/rebrand/atmoshaper-migration-charter.md docs/rebrand/atmoshaper-rollback-plan.md
git commit -m "docs: lock AtmoShaper migration source"
```

Read back the commit paths and confirm repository status is clean.

---

### Task 2: Build the file, compatibility, provider, domain, local-data, cleanup, and refactor inventories

**Files:**

- Create: `docs/rebrand/atmoshaper-reference-inventory.md`
- Create: `docs/rebrand/atmoshaper-export-manifest.json`
- Create: `docs/rebrand/atmoshaper-external-account-checklist.md`
- Create: `docs/rebrand/atmoshaper-domain-cutover-plan.md`
- Create: `docs/rebrand/atmoshaper-local-data-and-pwa-plan.md`
- Create: `docs/rebrand/atmoshaper-cleanup-register.md`
- Create: `docs/rebrand/atmoshaper-refactor-register.md`

**Interfaces:**

- Consumes: locked `sourceSha`, tracked source tree, source code/tests/docs/CI references, current provider documentation.
- Produces: the exact copy/omit/unresolved policy, machine-readable export manifest, and later-phase risk registers used by Task 5.

**Why:** A fresh repository cannot safely omit historical material or rename identifiers based on filenames alone.

**Impact/Compatibility:** Documentation only. No provider queries that mutate state, no secret output, and no source deletion.

**Verification:** Every source top-level path is classified; every omission has reference evidence and rollback; every known compatibility identifier/provider/domain appears once.

- [ ] **Step 1: Inventory the locked source tree**

Run against the exact SHA, not the preparation branch:

```powershell
$sourceSha = git rev-parse main
git ls-tree -r --name-only $sourceSha
git ls-tree -r -l $sourceSha
```

Before using the variable, compare it with the exact 40-character value recorded in the charter and stop on a mismatch. Record total files, bytes where available, top-level counts, and these candidate groups separately:

- `docs/superpowers/plans/`
- `docs/superpowers/reports/`
- `docs/superpowers/qa/`
- `docs/aegis/work/`
- `docs/aegis/plans/`
- `docs/audits/`
- `docs/background-branding-audit/`
- `.superpowers/`
- `.agents/`
- `TODO.md`
- `docs/roadmap.md`

- [ ] **Step 2: Prove references before classifying omissions**

Use `git grep` at the locked SHA to find active code, test, CI, package-script, and current-document references to every candidate path or basename. Use `rg` only on the materialized tree when `git grep` cannot inspect the needed relationship.

Classification rules:

- `keep`: runtime, tests, CI, legal/provenance/security/current operations, active agent instructions, schemas/migrations, fixtures, or current authority.
- `omit from new repository`: proven historical-only material preserved in old Git with no active consumer.
- `replace with concise current document`: old current-state/log/readme material whose AtmoShaper owner is created in Task 5.
- `convert to ADR`: still-binding architecture decision whose long historical plan need not move.
- `retain as compatibility`: old-named runtime/data/provider/storage identifier.
- `retain in old repository only`: historical evidence with no new-repo consumer.
- `unresolved`: incomplete evidence; unresolved items are retained unless omission is safer and the reason is explicitly documented under the design rule.

- [ ] **Step 3: Write the reference inventory and compatibility map**

Use the required cleanup table from the design and add:

```markdown
## Source Tree Summary
## Required Keep Set
## Evidence-Backed Omission Set
## Replacement and ADR Set
## Unresolved Set
## Destination Overlay Set
## Compatibility Map
| Public concept | Current public value | Future public value | Stable private identifiers | Owner | Phase |
## Exact Destination Difference Contract
```

The difference contract lists every path intentionally added, replaced, or omitted relative to `sourceSha`. It is the source of truth for Task 5; prose categories without exact paths or prefix rules are insufficient.

Create `atmoshaper-export-manifest.json` from that reviewed contract using this schema:

```json
{
  "schemaVersion": 1,
  "sourceRepository": "dsbowersock/massagelab",
  "sourceCommit": "fa78ca01a42179329cc223df77c76f308e76320b",
  "omitPaths": [],
  "replacePaths": ["AGENTS.md", "README.md", "docs/project-log.md", "docs/project-state.md"],
  "task5AddPaths": [],
  "task6AddPaths": [],
  "overlayPaths": []
}
```

The SHA shown is the current live-verified `main` value at plan approval. If Task 1 observes a different source SHA, update this value to that newly locked exact SHA before committing the manifest. Populate every empty array with exact normalized repository file paths. `task5AddPaths` and `task6AddPaths` divide source-absent files by their creating task. Expand every omitted directory candidate into exact tracked file paths in `omitPaths`; the execution step never infers descendants. `overlayPaths` contains every migration-owned file copied from the preparation branch, including `package.json`, the design, this plan, all rebrand documents, parity spec, and snapshots. `replacePaths` identifies source-present files whose contents intentionally change. Sort every array by code-point order, reject duplicates within an array, and require an overlay path to appear in either the unchanged source path set or the appropriate add-path array. The JSON and Markdown difference contract must describe the same path set; a mismatch stops execution.

- [ ] **Step 4: Write the external account checklist**

Create one row per GitHub, Vercel, Namecheap/DNS, Neon, Google OAuth, Auth.js origin/callback, Google Calendar, Resend/SMTP, SPF/DKIM/DMARC, support email/forwarding, Stripe business/Checkout/Portal/catalog/webhook/metadata/idempotency, Cloudflare R2/media/CORS/cache, Sentry, search/sitemap, social, and PWA/app-store identity surface.

Use columns:

```markdown
| System | Current evidence owner | Current identity/domain | Read-only check | Domain dependency | Stable identifier | Phase allowed to change | Mutation authorization | Status |
```

Never record credentials, tokens, connection strings, private database rows, or customer identifiers.

- [ ] **Step 5: Write the domain and local-data/PWA plans**

The domain plan must include the final host matrix, legacy recovery routes, prerequisite provider changes, rollback, and recovery-period decision. The local-data/PWA plan must inventory source references for:

- cookies;
- localStorage/sessionStorage;
- IndexedDB;
- Cache Storage/service-worker cache names;
- PWA scope/install metadata;
- local and encrypted export/import formats; and
- known keys listed in the design.

Each local-data row records owner path, reader, writer, origin binding, migration rule, legacy read requirement, data sensitivity, and destructive-cleanup prohibition.

- [ ] **Step 6: Write cleanup and refactor registers**

Populate actual candidates found in Step 1 rather than empty tables. Historical plan/report groups may be grouped only when their reference proof and action are identical. Use allowed statuses from the design. Refactor candidates remain `unresolved` or `evidence gathered`; none is approved for implementation by this plan.

- [ ] **Step 7: Verify and commit Task 2**

Run a path/reference self-review and:

```powershell
git diff --check
git status --short
```

Stage only the six Task 2 narrative documents and export manifest, then commit:

```powershell
git add docs/rebrand/atmoshaper-reference-inventory.md docs/rebrand/atmoshaper-export-manifest.json docs/rebrand/atmoshaper-external-account-checklist.md docs/rebrand/atmoshaper-domain-cutover-plan.md docs/rebrand/atmoshaper-local-data-and-pwa-plan.md docs/rebrand/atmoshaper-cleanup-register.md docs/rebrand/atmoshaper-refactor-register.md
git commit -m "docs: inventory AtmoShaper migration boundaries"
```

---

### Task 3: Add source/destination visual parity characterization

**Files:**

- Create: `tests/browser/atmoshaper-repository-migration-parity.spec.ts`
- Create: Playwright snapshots adjacent to that spec
- Modify: `package.json`

**Interfaces:**

- Consumes: existing Playwright config, `installSignedInSessionCookie`, `identity-method-safety-fixture`, and authorized disposable Browser-QA database gate.
- Produces: `npm run test:browser:migration-parity`, accepted source screenshots, responsive overflow checks, and signed-in/public surface parity.

**Why:** Existing browser tests prove behavior but do not persist the exact source rendering needed to compare a fresh repository.

**Change Necessity:** A manual screenshot folder lacks repeatable viewport, fixture, animation, and comparison behavior. The minimum change is one explicit migration spec and one package command; runtime source remains untouched.

**Impact/Compatibility:** Test-only. Signed-in tests may write only deterministic `.example.test` fixtures to an already approved non-production database and must clean them exactly. Stop if the database fingerprint gate is unavailable; do not substitute production or real accounts.

**Verification:** Source capture passes on desktop/mobile; signed-in tests execute rather than skip; existing CI-lane manifest remains unchanged; no external request or persistent fixture remains.

- [ ] **Step 1: Add the package command**

Add exactly:

```json
"test:browser:migration-parity": "playwright test tests/browser/atmoshaper-repository-migration-parity.spec.ts"
```

Do not add the migration spec to `tests/browser/ci-lanes.mjs`; it is an explicit source/destination gate, not an ordinary permanent lane.

- [ ] **Step 2: Implement the parity spec using existing fixtures**

The spec must:

- run only when `ATMOSHAPER_MIGRATION_PARITY=1`;
- define public surfaces `/`, `/tools`, `/education`, `/music`, `/chimer`, `/clock`, `/wellness`, `/notes`, `/pricing`, and `/support`;
- use stable readiness locators/text already owned by current browser tests;
- test both configured Chromium projects;
- set reduced motion and a deterministic light color scheme;
- wait for fonts and the surface readiness marker;
- disable caret and remaining CSS animation only for screenshot capture;
- assert no horizontal page overflow;
- capture full-page screenshots with stable names;
- install the `BOTH_METHODS` identity fixture for `/account?tab=profile` and `/account?tab=security`;
- assert the exact non-production Browser-QA database authorization before signed-in setup;
- remove the exact project-qualified fixture in `afterEach`; and
- fail on browser console/page errors and any non-GET/HEAD browser request outside the local test origin; record read-only external media/provider requests separately in the inventory.

Use this structure and the exact existing imports; fill each surface's readiness locator from its current test owner rather than introducing test IDs in application code:

```ts
import { expect, test, type Page } from "@playwright/test"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"
import {
  installIdentityMethodSafetyFixture,
  removeIdentityMethodSafetyFixture,
} from "./identity-method-safety-fixture"

const enabled = process.env.ATMOSHAPER_MIGRATION_PARITY === "1"
const publicSurfaces = [
  { name: "home", path: "/", ready: /MassageLab/i },
  { name: "tools", path: "/tools", ready: /MassageLab Tools/i },
  { name: "education", path: "/education", ready: /Education/i },
  { name: "music", path: "/music", ready: /Treatment room starters/i },
  { name: "chimer", path: "/chimer", ready: /Chimer/i },
  { name: "clock", path: "/clock", ready: /Clock|AM|PM/i },
  { name: "wellness", path: "/wellness", ready: /Client-owned self-tracking/i },
  { name: "notes", path: "/notes", ready: /Therapist or Team\/Practice required/i },
  { name: "pricing", path: "/pricing", ready: /Supporter/i },
  { name: "support", path: "/support", ready: /Support/i },
] as const

function observeUnexpectedActivity(page: Page, baseURL: string) {
  const localOrigin = new URL(baseURL).origin
  const browserErrors: string[] = []
  const externalMutations: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin !== localOrigin && !["GET", "HEAD"].includes(request.method())) {
      externalMutations.push(`${request.method()} ${url.origin}${url.pathname}`)
    }
  })
  return () => {
    expect(browserErrors).toEqual([])
    expect(externalMutations).toEqual([])
  }
}

test.describe("AtmoShaper repository migration parity", () => {
  test.skip(!enabled, "Run only for an explicit repository migration comparison")

  for (const surface of publicSurfaces) {
    test(`${surface.name} source rendering`, async ({ page }, testInfo) => {
      const assertNoUnexpectedActivity = observeUnexpectedActivity(
        page,
        String(testInfo.project.use.baseURL),
      )
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
      const response = await page.goto(surface.path, { waitUntil: "domcontentloaded" })
      expect(response?.ok()).toBe(true)
      await expect(page.getByText(surface.ready).first()).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      expect(await page.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
      await expect(page).toHaveScreenshot(`${surface.name}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: true,
      })
      assertNoUnexpectedActivity()
    })
  }

  test("signed-in account profile and security source rendering", async ({ context, page }, testInfo) => {
    expect(isBrowserQaDatabaseTargetAuthorized(process.env)).toBe(true)
    const projectName = testInfo.project.name
    const baseURL = String(testInfo.project.use.baseURL)
    const assertNoUnexpectedActivity = observeUnexpectedActivity(page, baseURL)
    await installIdentityMethodSafetyFixture({
      context,
      baseURL,
      projectName,
      scenario: "BOTH_METHODS",
    })
    try {
      for (const tab of ["profile", "security"] as const) {
        const response = await page.goto(`/account?tab=${tab}`, { waitUntil: "domcontentloaded" })
        expect(response?.ok()).toBe(true)
        await page.evaluate(() => document.fonts.ready)
        expect(await page.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
        await expect(page).toHaveScreenshot(`account-${tab}.png`, {
          animations: "disabled",
          caret: "hide",
          fullPage: true,
        })
      }
      assertNoUnexpectedActivity()
    } finally {
      await removeIdentityMethodSafetyFixture(projectName, "BOTH_METHODS")
    }
  })
})
```

If current rendering includes unstable clock text, generated dates, media canvases, or account timestamps, mask only those exact locators in both source and destination and document each mask in the reference inventory. Do not mask layout, navigation, branding, controls, errors, or content merely to force parity.

- [ ] **Step 3: Verify discovery before capturing**

Run:

```powershell
$env:ATMOSHAPER_MIGRATION_PARITY = "1"
npm run test:browser:migration-parity -- --list
Remove-Item Env:ATMOSHAPER_MIGRATION_PARITY
```

Expected: 22 tests: ten public plus one signed-in test in each of desktop and mobile Chromium. WebKit is outside the screenshot baseline and remains covered by its existing media smoke.

- [ ] **Step 4: Capture accepted source snapshots**

Run this in a fresh child PowerShell so the task-specific environment cannot leak into the operator's shell. The three dedicated QA values must already be present in the parent environment; the command refuses to invent or print them:

```powershell
& pwsh.exe -NoProfile -Command @'
$required = @(
  "MASSAGELAB_BROWSER_QA_DATABASE_URL",
  "MASSAGELAB_BROWSER_QA_DIRECT_URL",
  "MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT"
)
foreach ($name in $required) {
  if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Missing approved QA variable: $name" }
}
$env:MASSAGELAB_BROWSER_QA_DATABASE = "1"
$env:VERCEL_ENV = "preview"
$env:DATABASE_URL = $env:MASSAGELAB_BROWSER_QA_DATABASE_URL
$env:DIRECT_URL = $env:MASSAGELAB_BROWSER_QA_DIRECT_URL
$env:ATMOSHAPER_MIGRATION_PARITY = "1"
npm run browser-qa:db:target -- --expected-fingerprint=$env:MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run test:browser:migration-parity -- --update-snapshots
exit $LASTEXITCODE
'@
```

Expected: 22 passed, zero skipped, zero browser errors, zero external mutation requests, and 24 platform/project-qualified PNG snapshots: ten public plus two account snapshots per project. Stop if private signed-in tests skip or the authorized disposable target is unavailable.

- [ ] **Step 5: Run focused repeat comparison**

Repeat the same fresh-child command, replacing its final npm invocation with:

```powershell
npm run test:browser:migration-parity
```

Expected: all 22 tests compare successfully without changing any PNG.

- [ ] **Step 6: Verify and commit Task 3**

Run with the exact fresh-child QA environment and fingerprint procedure from Task 3 Step 5:

```powershell
node --test tests/browser-qa-database-target.test.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
git diff --check
git status --short
```

Stage only the package script, parity spec, and generated snapshots. Commit:

```powershell
git add package.json tests/browser/atmoshaper-repository-migration-parity.spec.ts tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots
git commit -m "test: capture repository migration parity"
```

Read back the exact files and confirm no fixture rows remain.

---

### Task 4: Execute and record the complete MassageLab source baseline

**Files:**

- Modify: `docs/rebrand/atmoshaper-migration-charter.md`
- Modify: `docs/rebrand/atmoshaper-reference-inventory.md`
- Modify: `docs/rebrand/atmoshaper-external-account-checklist.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**

- Consumes: locked source/runtime tree plus migration-only characterization tooling.
- Produces: a complete source verification ledger and the allowed export manifest.

**Why:** Phase 2 must stop unless the current source passes its own required gates.

**Impact/Compatibility:** Generated `node_modules`, `.next`, and `test-results` are ignored. Read-only hosted inspection only. No production/database/provider mutation beyond exact disposable Browser-QA fixtures already authorized and cleaned by Task 3.

**Verification:** Every required source command exits zero; all four lane discoveries execute; route/size/metadata/PWA/provider inventory is recorded; worktree is clean afterward.

- [ ] **Step 1: Perform the exact dependency and schema setup**

Run:

```powershell
npm ci
npm run prisma:validate
npm run prisma:generate
```

Expected: zero exit status. Record command versions and concise counts; do not paste secrets or full environment output.

- [ ] **Step 2: Run code-quality and unit gates**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
```

Record exact test totals, passes, failures, and intentional skips. Any failure stops Phase 2 even if it is believed unrelated; diagnose or ask before proceeding.

- [ ] **Step 3: Run production and Browser-QA builds**

Run:

```powershell
npm run build
npm run build:browser-qa
```

Record Next.js generated-page count and build warnings separately. A warning is not silently reclassified as success or failure; compare with current documented accepted warnings.

- [ ] **Step 4: Run all four current Browser QA lanes**

For each lane `1`, `2`, `3`, and `4`, set `PLAYWRIGHT_CI_LANE`, run `npm run test:browser`, record discovered/passed/skipped/retried counts, and remove the variable in `finally`-equivalent cleanup.

Example for each lane:

```powershell
$env:PLAYWRIGHT_CI_LANE = "1"
npm run test:browser
Remove-Item Env:PLAYWRIGHT_CI_LANE
```

Do not run database-backed private rows unless the exact non-production fingerprint gate passes. A skip required by the ordinary suite is recorded; the migration parity signed-in rows still must execute in Step 5.

- [ ] **Step 5: Re-run migration parity without updating snapshots**

Run:

```powershell
npm run test:browser:migration-parity
```

Expected: 22 passed, zero skipped.

- [ ] **Step 6: Record route, bundle, migration, and public-output baselines**

Record:

- generated page count from build output;
- key count and sorted paths from `.next\server\app-paths-manifest.json`;
- total bytes under `.next\static`, `.next\server\app`, and the largest route bundles;
- committed directory count under `prisma\migrations`;
- SHA-256 and response status/content type for `/`, `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, and `/sw.js` from a locally started production server;
- service-worker registration/install/offline results from existing `pwa.spec.ts`; and
- browser snapshot filenames and hashes.

Start the built server on port 3010 with the existing safe local Browser-QA environment, query only localhost, then stop the exact owned process. Do not leave a server running or terminate an unrelated process.

- [ ] **Step 7: Record read-only GitHub and Vercel identity**

Use authenticated read-only commands:

```powershell
wsl.exe -d Ubuntu -- gh api repos/dsbowersock/massagelab
npx vercel project inspect massagelab
npx vercel domains ls
```

Record only repository visibility/default branch, Vercel project name, production hostnames, and domain relationships. Redact IDs that are not needed for the migration report. Do not change settings, deployments, aliases, domains, or environment variables.

- [ ] **Step 8: Confirm source cleanliness and record the gate**

Run:

```powershell
git diff --check
git status --short
```

Expected before documentation updates: clean. If setup modified tracked runtime or lock files, stop and investigate.

Update the five Task 4 documents with exact results, allowed source/destination difference rules, and no unsupported success claim.

- [ ] **Step 9: Commit the source baseline receipt**

Stage only the five Task 4 documents and commit:

```powershell
git add docs/rebrand/atmoshaper-migration-charter.md docs/rebrand/atmoshaper-reference-inventory.md docs/rebrand/atmoshaper-external-account-checklist.md docs/project-state.md docs/project-log.md
git commit -m "docs: verify MassageLab migration baseline"
```

- [ ] **Step 10: Publish the preflight branch for review without merging**

After local verification, push `codex/atmoshaper-migration-preflight` and open a MassageLab PR describing the design, inventory, parity harness, and source evidence. Use the authenticated WSL Git/GitHub path because Windows Git does not currently have usable GitHub credentials:

```powershell
wsl.exe -d Ubuntu -- git -c safe.directory=/mnt/c/Users/derri/code/my_projects/massagelab -C /mnt/c/Users/derri/code/my_projects/massagelab push -u origin codex/atmoshaper-migration-preflight
wsl.exe -d Ubuntu -- gh pr create --repo dsbowersock/massagelab --base main --head codex/atmoshaper-migration-preflight --title "Prepare AtmoShaper repository migration" --body-file /mnt/c/Users/derri/code/my_projects/massagelab/docs/rebrand/atmoshaper-migration-charter.md
```

Do not merge it. Hosted CI must run against the exact branch head; record the PR URL and status in the charter.

---

### Task 5: Materialize the classified source snapshot in a fresh sibling repository

**Files:**

- Create destination tree at `C:\Users\derri\code\my_projects\atmoshaper`
- Create: `MIGRATION_LINEAGE.md`
- Replace: `README.md`
- Replace: `docs/project-state.md`
- Replace: `docs/project-log.md`
- Modify: `AGENTS.md`
- Carry approved migration documents/tests/snapshots from the preparation branch

**Interfaces:**

- Consumes: locked `sourceSha` and exact destination difference contract.
- Produces: an uncommitted/staged fresh AtmoShaper tree with no old Git metadata.

**Why:** The new repository must be built from the verified source commit, not the preparation branch or current filesystem state.

**Impact/Compatibility:** File creation occurs only inside the exact sibling target. Old repository content is read-only. The target must not already contain user data.

**Verification:** Destination path safety, source archive identity, no `.git` copy, no ignored/private files, and every tree difference classified.

- [ ] **Step 1: Reconfirm the source lock has not drifted**

Repeat Task 1 live/local/tracked SHA checks. Stop and restart source verification if `main` advanced.

- [ ] **Step 2: Verify the exact destination path**

Resolve `C:\Users\derri\code\my_projects\atmoshaper`. Stop if it exists with any content or resolves outside `C:\Users\derri\code\my_projects`. Do not delete, move, or reuse an ownership-unknown directory.

- [ ] **Step 3: Export the immutable source commit**

Use this guarded export. It reads the source SHA from the reviewed manifest, creates a uniquely named system-temp archive, and refuses an occupied destination. Do not use the current working tree as the source and do not copy `.git`.

```powershell
$sourceRepo = (Resolve-Path -LiteralPath "C:\Users\derri\code\my_projects\massagelab").Path
$allowedParent = [IO.Path]::GetFullPath("C:\Users\derri\code\my_projects")
$destinationPath = [IO.Path]::GetFullPath("C:\Users\derri\code\my_projects\atmoshaper")
if ([IO.Path]::GetDirectoryName($destinationPath) -ne $allowedParent) {
  throw "Destination escaped the approved projects parent."
}
if (Test-Path -LiteralPath $destinationPath) {
  $existing = @(Get-ChildItem -LiteralPath $destinationPath -Force)
  if ($existing.Count -gt 0) { throw "Destination exists and is not empty." }
} else {
  New-Item -ItemType Directory -Path $destinationPath | Out-Null
}
$manifestPath = Join-Path $sourceRepo "docs\rebrand\atmoshaper-export-manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$sourceSha = (& git -C $sourceRepo rev-parse main).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceSha -notmatch '^[a-f0-9]{40}$') { throw "Invalid source SHA." }
if ($manifest.sourceCommit -ne $sourceSha) { throw "Source SHA drifted from the reviewed manifest." }
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("atmoshaper-export-" + [guid]::NewGuid().ToString("N"))
if (-not ([IO.Path]::GetFullPath($tempRoot)).StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Temporary export path escaped system temp."
}
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$sourceArchive = Join-Path $tempRoot "source.zip"
& git -C $sourceRepo archive --format=zip --output=$sourceArchive $sourceSha
if ($LASTEXITCODE -ne 0) { throw "git archive failed." }
Expand-Archive -LiteralPath $sourceArchive -DestinationPath $destinationPath

$expectedPaths = @(& git -C $sourceRepo ls-tree -r --name-only $sourceSha) | Sort-Object
$actualPaths = @(
  Get-ChildItem -LiteralPath $destinationPath -Recurse -Force -File |
    ForEach-Object { $_.FullName.Substring($destinationPath.Length + 1).Replace("\", "/") }
) | Sort-Object
$treeDifference = @(Compare-Object $expectedPaths $actualPaths)
if ($treeDifference.Count -gt 0) { throw "Exported source path set differs from the locked Git tree." }

$representativePaths = @("package-lock.json", "package.json", "prisma/schema.prisma", ".github/workflows/ci.yml", "app/layout.tsx")
foreach ($path in $representativePaths) {
  $expectedBlob = (& git -C $sourceRepo rev-parse "${sourceSha}:$path").Trim()
  $actualBlob = (& git hash-object (Join-Path $destinationPath $path)).Trim()
  if ($LASTEXITCODE -ne 0 -or $actualBlob -ne $expectedBlob) { throw "Blob mismatch: $path" }
}
```

Keep `$tempRoot`, `$manifest`, and the resolved paths in the same PowerShell session through Step 5. Remove only the validated task-specific `$tempRoot` after the overlay archive is extracted.

- [ ] **Step 4: Apply only the evidence-backed omission set**

Remove from the destination only paths in the reviewed manifest. Before every recursive removal, resolve the absolute target and verify it begins with the exact destination prefix:

```powershell
$destinationPrefix = "$destinationPath\"
foreach ($repoPath in $manifest.omitPaths) {
  if (-not $repoPath -or $repoPath -match '(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($repoPath)) {
    throw "Unsafe omit path in manifest: $repoPath"
  }
  $target = [IO.Path]::GetFullPath((Join-Path $destinationPath $repoPath))
  if (-not $target.StartsWith($destinationPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Omit target escaped destination: $repoPath"
  }
  if (-not (Test-Path -LiteralPath $target)) { throw "Reviewed omit target is missing: $repoPath" }
  Remove-Item -LiteralPath $target -Recurse -Force
}
```

Record actual omitted files and counts in the reference inventory; no glob may delete outside an explicitly classified prefix.

- [ ] **Step 5: Overlay migration-owned files**

Archive only the manifest's exact overlay paths from the reviewed preparation branch, then extract them over the destination. The reviewed `package.json` overlay must differ from the locked source manifest only by the migration-parity script.

```powershell
$overlayArchive = Join-Path $tempRoot "overlay.zip"
$overlayArguments = @(
  "-C", $sourceRepo, "archive", "--format=zip", "--output=$overlayArchive",
  "codex/atmoshaper-migration-preflight", "--"
) + @($manifest.overlayPaths)
& git @overlayArguments
if ($LASTEXITCODE -ne 0) { throw "Migration overlay archive failed." }
Expand-Archive -LiteralPath $overlayArchive -DestinationPath $destinationPath -Force
$packageDifference = & git -C $sourceRepo diff $sourceSha codex/atmoshaper-migration-preflight -- package.json
if ($LASTEXITCODE -ne 0 -or ($packageDifference -join "`n") -notmatch 'test:browser:migration-parity') {
  throw "Preparation package manifest lacks the reviewed parity-only change."
}
Remove-Item -LiteralPath $tempRoot -Recurse -Force
```

Read the package diff in full and stop if it contains any change other than that one script.

- [ ] **Step 6: Create exact lineage and fresh current docs**

`MIGRATION_LINEAGE.md` must name the exact source repo/SHA/date, fresh-history intent, old history owner, behavior-preserving boundary, and unchanged legal/license owner.

The new `README.md`, `docs/project-state.md`, and `docs/project-log.md` must state that:

- repository identity is AtmoShaper;
- the runtime still presents the existing MassageLab design/copy until Phase 6;
- Phase 1 passed and Phase 2 is in progress;
- full prior history is linked in `dsbowersock/massagelab`; and
- no production/provider/domain/legal cutover has occurred.

Update `AGENTS.md` only to make the fresh state/log read-first and preserve the approved platform/audio/legal/compatibility terminology. Keep every existing safety rule that still applies.

- [ ] **Step 7: Initialize fresh Git metadata safely**

Initialize the destination with default branch `main`. The design's bootstrap-branch suggestion is intentionally adapted because an empty GitHub repository needs a stable default root before a review branch can target it. Do not add the old repository as a remote.

Run:

```powershell
git init -b main
git status --short
```

Do not commit yet.

- [ ] **Step 8: Verify the staged difference contract**

Stage the destination tree so `git ls-files` can drive audits, then verify the Task 5 path equation exactly:

```powershell
git add -A
$sourcePaths = @(& git -C $sourceRepo ls-tree -r --name-only $sourceSha)
$expectedTask5Paths = @(
  $sourcePaths | Where-Object { $_ -notin @($manifest.omitPaths) }
  @($manifest.task5AddPaths)
) | Sort-Object -Unique
$actualTask5Paths = @(& git -C $destinationPath ls-files) | Sort-Object -Unique
$pathDifference = @(Compare-Object $expectedTask5Paths $actualTask5Paths)
if ($pathDifference.Count -gt 0) { throw "Task 5 destination path set violates the export manifest." }
```

Also verify that every `replacePaths` and `overlayPaths` entry exists, every declared omit path is absent, and all manifest arrays are sorted and duplicate-free. Compare changed content with the Markdown difference contract. Stop on any unexplained path or absent declared Task 5 path. Task 6 add paths remain intentionally absent until Task 6.

---

### Task 6: Add deterministic repository and legacy-brand audits to the new repository

**Files:**

- Create: `scripts/repository-audit/core.mjs`
- Create: `scripts/repository-audit/inventory.mjs`
- Create: `scripts/repository-audit/brand.mjs`
- Create: `scripts/repository-audit/policy.json`
- Create: `scripts/repository-audit/brand-reference-baseline.json`
- Create: `tests/repository-audit.test.mjs`
- Modify: `package.json`

**Interfaces:**

- `listTrackedFiles(root, execFileImpl?) -> string[]`
- `assertPrivatePathsAbsent(paths, forbiddenPatterns) -> void`
- `buildRepositoryInventory(root, policy, execFileImpl?) -> InventoryReport`
- `collectLegacyReferences(root, paths, matcher) -> LegacyReference[]`
- `verifyLegacyReferenceBaseline(actual, baseline) -> { missing: BaselineEntry[]; unclassified: LegacyReference[] }`
- CLIs print stable JSON and set a nonzero exit code on unsafe/private paths or unclassified new legacy references.

**Why:** Bootstrap requires repeatable repository and brand/reference checks that distinguish approved compatibility/history from new unclassified legacy copy.

**Change Necessity:** One-off shell searches cannot be deterministic cross-platform CI gates or recognize reviewed legacy occurrences. Two small CLIs sharing one scanner are the minimum maintained boundary.

**Impact/Compatibility:** Tooling only; no runtime imports, source rewrites, deletions, `.env.local` reads, or automatic fixes.

**Verification:** Focused tests cover determinism, secret exclusion, classification, new-reference failure, removed-reference tolerance, and no runtime wiring.

- [ ] **Step 1: Add package commands**

Add exactly:

```json
"repository:inventory": "node scripts/repository-audit/inventory.mjs",
"brand:audit": "node scripts/repository-audit/brand.mjs"
```

- [ ] **Step 2: Define the policy schema**

Create `policy.json` with:

```json
{
  "schemaVersion": 1,
  "forbiddenTrackedPaths": [
    ".env.local",
    ".vercel/",
    ".next/",
    "node_modules/",
    "output/",
    "graphify-out/",
    "test-results/"
  ],
  "textExtensions": [
    ".cjs", ".css", ".html", ".js", ".json", ".jsx", ".md",
    ".mjs", ".prisma", ".sql", ".toml", ".ts", ".tsx", ".txt",
    ".yaml", ".yml"
  ],
  "legacyPattern": "massagelab|massage lab",
  "allowedCategories": [
    "compatibility",
    "legal",
    "historical",
    "pre-rebrand-public-copy"
  ],
  "candidateRules": [
    {
      "category": "legal",
      "pathPrefixes": ["LICENSE", "app/legal/", "lib/legal-", "tests/legal"]
    },
    {
      "category": "compatibility",
      "pathPrefixes": [
        "prisma/migrations/",
        "lib/atmoshaper/",
        "components/atmoshaper/",
        "data/atmoshaper/",
        "scripts/atmoshaper",
        "tests/fixtures/atmoshaper/"
      ],
      "linePatterns": ["MASSAGELAB_", "massagelab[-_.:]", "x-massagelab", "\\.mlab"]
    },
    {
      "category": "historical",
      "pathPrefixes": ["docs/", "MIGRATION_LINEAGE.md"]
    }
  ]
}
```

Matching is case-insensitive. Directory entries ending in `/` match descendants; exact files match only themselves.

- [ ] **Step 3: Implement the shared scanner**

The scanner must use `git ls-files -z` through `execFile`, normalize paths to `/`, sort with code-point order, and never walk the filesystem looking for untracked files. It may read only tracked files whose lowercased extension is in `textExtensions`. It must reject a tracked forbidden path before opening files.

Each legacy occurrence has:

```js
{
  path,
  line,
  column,
  textSha256,
}
```

`textSha256` is the lowercase SHA-256 of the full source line after trimming trailing whitespace. This makes line movement visible but does not store sensitive line content in the baseline.

Implement `core.mjs` with this complete boundary; keep the optional executor injection only for focused tests:

```js
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lstatSync, readFileSync } from "node:fs"
import { extname, resolve, sep } from "node:path"

const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0
const sha256 = (value) => createHash("sha256").update(value).digest("hex")

export function normalizeRepoPath(value) {
  return String(value).replaceAll("\\\\", "/").replace(/^\.\//, "")
}

export function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, entry]) => [key, stableJson(entry)]),
    )
  }
  return value
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

export function listTrackedFiles(root, execFile = execFileSync) {
  const output = execFile("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  })
  return output
    .split("\0")
    .filter(Boolean)
    .map(normalizeRepoPath)
    .sort(compareText)
}

function pathMatches(path, candidate) {
  const normalizedPath = normalizeRepoPath(path).toLowerCase()
  const normalizedCandidate = normalizeRepoPath(candidate).toLowerCase()
  return normalizedCandidate.endsWith("/")
    ? normalizedPath.startsWith(normalizedCandidate)
    : normalizedPath === normalizedCandidate
}

export function assertPrivatePathsAbsent(paths, forbiddenPatterns) {
  const forbidden = paths.filter((path) => (
    forbiddenPatterns.some((candidate) => pathMatches(path, normalizeRepoPath(candidate)))
  ))
  if (forbidden.length > 0) {
    throw new Error(`Forbidden tracked paths: ${forbidden.join(", ")}`)
  }
}

function resolveTrackedPath(root, path) {
  const absoluteRoot = resolve(root)
  const absolutePath = resolve(absoluteRoot, ...normalizeRepoPath(path).split("/"))
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error(`Tracked path escapes repository root: ${path}`)
  }
  return absolutePath
}

function trackedFileRecord(root, path) {
  const absolutePath = resolveTrackedPath(root, path)
  const stat = lstatSync(absolutePath)
  if (!stat.isFile()) return { path, bytes: stat.size, text: null }
  return { path, bytes: stat.size, text: readFileSync(absolutePath, "utf8") }
}

export function buildRepositoryInventory(root, policy, execFile = execFileSync) {
  const paths = listTrackedFiles(root, execFile)
  assertPrivatePathsAbsent(paths, policy.forbiddenTrackedPaths)
  const byTopLevel = {}
  const byExtension = {}
  let totalTrackedBytes = 0
  const fingerprintRows = []
  for (const path of paths) {
    const absolutePath = resolveTrackedPath(root, path)
    const stat = lstatSync(absolutePath)
    const bytes = stat.size
    totalTrackedBytes += bytes
    const topLevel = path.split("/")[0]
    const extension = extname(path).toLowerCase() || "[none]"
    byTopLevel[topLevel] = (byTopLevel[topLevel] ?? 0) + 1
    byExtension[extension] = (byExtension[extension] ?? 0) + 1
    fingerprintRows.push(`${path}\0${bytes}\n`)
  }
  return stableJson({
    schemaVersion: policy.schemaVersion,
    trackedFileCount: paths.length,
    totalTrackedBytes,
    byTopLevel,
    byExtension,
    forbiddenTrackedPaths: [],
    inventorySha256: sha256(fingerprintRows.join("")),
  })
}

export function collectLegacyReferences(root, paths, policy) {
  const allowedExtensions = new Set(policy.textExtensions.map((value) => value.toLowerCase()))
  const matcher = new RegExp(policy.legacyPattern, "gi")
  const references = []
  for (const path of paths) {
    if (!allowedExtensions.has(extname(path).toLowerCase())) continue
    const record = trackedFileRecord(root, path)
    if (record.text === null) continue
    const lines = record.text.split(/\r?\n/)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const sourceLine = lines[lineIndex]
      matcher.lastIndex = 0
      for (let match = matcher.exec(sourceLine); match; match = matcher.exec(sourceLine)) {
        references.push({
          path,
          line: lineIndex + 1,
          column: match.index + 1,
          textSha256: sha256(sourceLine.trimEnd()),
          sourceLine,
        })
      }
    }
  }
  return references.sort((left, right) => (
    compareText(left.path, right.path) || left.line - right.line || left.column - right.column
  ))
}

export function classifyCandidate(reference, policy) {
  for (const rule of policy.candidateRules) {
    const pathMatch = (rule.pathPrefixes ?? []).some((prefix) => (
      reference.path.toLowerCase().startsWith(prefix.toLowerCase())
    ))
    const lineMatch = (rule.linePatterns ?? []).some((pattern) => (
      new RegExp(pattern, "i").test(reference.sourceLine)
    ))
    if (pathMatch || lineMatch) return rule.category
  }
  return "pre-rebrand-public-copy"
}

function referenceKey(reference) {
  return [reference.path, reference.line, reference.column, reference.textSha256].join(":")
}

export function toBaselineEntry(reference, category) {
  return {
    path: reference.path,
    line: reference.line,
    column: reference.column,
    textSha256: reference.textSha256,
    category,
  }
}

export function validateBaseline(baseline, policy) {
  if (
    baseline?.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/.test(baseline?.sourceCommit ?? "") ||
    !Array.isArray(baseline.entries)
  ) {
    throw new Error("Brand-reference baseline must use schemaVersion 1, an exact sourceCommit, and an entries array")
  }
  const categories = new Set(policy.allowedCategories)
  const seen = new Set()
  for (const entry of baseline.entries) {
    if (!categories.has(entry.category)) throw new Error(`Invalid legacy category: ${entry.category}`)
    if (
      typeof entry.path !== "string" ||
      entry.path.length === 0 ||
      normalizeRepoPath(entry.path) !== entry.path ||
      entry.path.startsWith("/") ||
      /^[a-z]:/i.test(entry.path) ||
      entry.path.split("/").includes("..") ||
      !Number.isInteger(entry.line) || entry.line < 1 ||
      !Number.isInteger(entry.column) || entry.column < 1
    ) {
      throw new Error("Legacy baseline entries require a normalized path and positive line/column")
    }
    if (!/^[a-f0-9]{64}$/.test(entry.textSha256 ?? "")) {
      throw new Error(`Invalid line hash for ${entry.path ?? "unknown path"}`)
    }
    const key = referenceKey(entry)
    if (seen.has(key)) throw new Error(`Duplicate legacy baseline entry: ${key}`)
    seen.add(key)
  }
}

export function verifyLegacyReferenceBaseline(actual, baseline, policy) {
  validateBaseline(baseline, policy)
  const actualByKey = new Map(actual.map((entry) => [referenceKey(entry), entry]))
  const baselineByKey = new Map(baseline.entries.map((entry) => [referenceKey(entry), entry]))
  const unclassified = actual
    .filter((entry) => !baselineByKey.has(referenceKey(entry)))
    .map((entry) => toBaselineEntry(entry, "unclassified"))
  const missing = baseline.entries.filter((entry) => !actualByKey.has(referenceKey(entry)))
  return { missing, unclassified }
}
```

- [ ] **Step 4: Implement deterministic inventory output**

`inventory.mjs` prints one JSON object with sorted keys/arrays containing schema version, tracked file count, total tracked bytes, counts by top-level path and extension, forbidden tracked paths, and the SHA-256 of the ordered `path\0size\n` sequence. It exits nonzero when forbidden paths exist. It never writes a file.

Use this complete CLI shape:

```js
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildRepositoryInventory, loadJson, stableJson } from "./core.mjs"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, "../..")
const policy = loadJson(resolve(scriptDirectory, "policy.json"))

try {
  const report = buildRepositoryInventory(root, policy)
  console.log(`${JSON.stringify(stableJson(report), null, 2)}\n`)
} catch (error) {
  console.error(error instanceof Error ? error.message : "Repository inventory failed")
  process.exitCode = 1
}
```

- [ ] **Step 5: Implement exact legacy-reference auditing**

`brand.mjs` reads `brand-reference-baseline.json`, validates schema/category/path/line/column/hash fields, scans tracked safe text, and compares exact occurrence identities. It reports:

- totals per allowed category;
- baseline entries no longer present (informational removal candidates); and
- actual occurrences missing from the baseline (fatal unclassified references).

The CLI must not auto-classify or update the baseline. Build the initial baseline through a one-time reviewed helper invocation inside the module guarded by `--print-candidate-baseline`; it prints candidate JSON to stdout and never writes. Review every candidate category, then create the baseline with a file edit. The default category for unmatched current public copy is `pre-rebrand-public-copy`; legal, historical, and compatibility categories require explicit reviewed path/token rules in the candidate builder.

Use this complete CLI shape:

```js
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  assertPrivatePathsAbsent,
  classifyCandidate,
  collectLegacyReferences,
  listTrackedFiles,
  loadJson,
  stableJson,
  toBaselineEntry,
  verifyLegacyReferenceBaseline,
} from "./core.mjs"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, "../..")
const policy = loadJson(resolve(scriptDirectory, "policy.json"))
const paths = listTrackedFiles(root)
assertPrivatePathsAbsent(paths, policy.forbiddenTrackedPaths)
const references = collectLegacyReferences(root, paths, policy)
const lineage = readFileSync(resolve(root, "MIGRATION_LINEAGE.md"), "utf8")
const sourceMatch = lineage.match(/^Source commit: `([a-f0-9]{40})`$/m)
if (!sourceMatch) throw new Error("MIGRATION_LINEAGE.md must contain one exact source commit line")

if (process.argv.slice(2).includes("--print-candidate-baseline")) {
  const candidate = {
    schemaVersion: 1,
    sourceCommit: sourceMatch[1],
    entries: references.map((reference) => (
      toBaselineEntry(reference, classifyCandidate(reference, policy))
    )),
  }
  console.log(`${JSON.stringify(stableJson(candidate), null, 2)}\n`)
} else {
  const baseline = loadJson(resolve(scriptDirectory, "brand-reference-baseline.json"))
  if (baseline.sourceCommit !== sourceMatch[1]) {
    throw new Error("Brand-reference baseline sourceCommit differs from MIGRATION_LINEAGE.md")
  }
  const result = verifyLegacyReferenceBaseline(references, baseline, policy)
  const totals = Object.fromEntries(policy.allowedCategories.map((category) => [
    category,
    baseline.entries.filter((entry) => (
      entry.category === category && !result.missing.includes(entry)
    )).length,
  ]))
  const report = stableJson({
    schemaVersion: 1,
    totals,
    missing: result.missing,
    unclassified: result.unclassified,
  })
  console.log(`${JSON.stringify(report, null, 2)}\n`)
  if (result.unclassified.length > 0) process.exitCode = 1
}
```

- [ ] **Step 6: Add focused tests**

Use temporary Git repositories and fixture files to prove:

1. inventory output is byte-identical on consecutive runs;
2. path ordering and aggregate hash are stable;
3. tracked `.env.local` or `.vercel/` fails before content is read or printed;
4. untracked private files are ignored and never appear in output;
5. an occurrence present in the baseline passes;
6. a newly introduced occurrence fails as unclassified;
7. a removed occurrence is informational, not a failure;
8. invalid categories or hashes fail closed; and
9. no file under `app/`, `components/`, `lib/`, `prisma/`, or `public/` imports `scripts/repository-audit`.

Use `mkdtemp`, `execFile`, and fixture-local Git configuration. Tests must never inspect the developer's `.env.local`.

Implement `tests/repository-audit.test.mjs` with this complete test boundary:

```js
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, extname, join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  buildRepositoryInventory,
  collectLegacyReferences,
  listTrackedFiles,
  loadJson,
  stableJson,
  toBaselineEntry,
  validateBaseline,
  verifyLegacyReferenceBaseline,
} from "../scripts/repository-audit/core.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const policy = loadJson(resolve(repositoryRoot, "scripts/repository-audit/policy.json"))

function createFixtureRepository(t) {
  const root = mkdtempSync(join(tmpdir(), "atmoshaper-repository-audit-"))
  execFileSync("git", ["init", "-q"], { cwd: root })
  execFileSync("git", ["config", "user.name", "Repository Audit Test"], { cwd: root })
  execFileSync("git", ["config", "user.email", "repository-audit@example.test"], { cwd: root })
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

function writeFixture(root, path, content, { tracked = true, force = false } = {}) {
  const absolutePath = resolve(root, ...path.split("/"))
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
  if (tracked) {
    execFileSync("git", ["add", ...(force ? ["-f"] : []), "--", path], { cwd: root })
  }
  return absolutePath
}

const baselineFor = (entries) => ({
  schemaVersion: 1,
  sourceCommit: "a".repeat(40),
  entries,
})

test("tracked-file ordering, aggregate hash, and output are deterministic", (t) => {
  const root = createFixtureRepository(t)
  writeFixture(root, "z-last.txt", "zzz")
  writeFixture(root, "a-first.txt", "a")

  assert.deepEqual(
    listTrackedFiles(root, () => "z-last.txt\0a-first.txt\0"),
    ["a-first.txt", "z-last.txt"],
  )
  const first = buildRepositoryInventory(root, policy)
  const second = buildRepositoryInventory(root, policy)
  const expectedFingerprint = createHash("sha256")
    .update("a-first.txt\u00001\nz-last.txt\u00003\n")
    .digest("hex")

  assert.equal(JSON.stringify(stableJson(first)), JSON.stringify(stableJson(second)))
  assert.equal(first.inventorySha256, expectedFingerprint)
  assert.equal(first.trackedFileCount, 2)
})

test("a tracked private path fails before its content can be opened", (t) => {
  const root = createFixtureRepository(t)
  const privatePath = writeFixture(root, ".env.local", "must-not-be-read", { force: true })
  rmSync(privatePath)
  assert.throws(
    () => buildRepositoryInventory(root, policy),
    /Forbidden tracked paths: \.env\.local/,
  )
})

test("an untracked private file is ignored", (t) => {
  const root = createFixtureRepository(t)
  writeFixture(root, "safe.txt", "safe")
  writeFixture(root, ".env.local", "must-not-appear", { tracked: false })
  const report = buildRepositoryInventory(root, policy)
  assert.equal(report.trackedFileCount, 1)
  assert.equal(JSON.stringify(report).includes(".env.local"), false)
  assert.equal(JSON.stringify(report).includes("must-not-appear"), false)
})

test("reviewed references pass, new references fail, and removals are informational", (t) => {
  const root = createFixtureRepository(t)
  writeFixture(root, "copy.md", "MassageLab public copy\n")
  const reviewed = collectLegacyReferences(root, ["copy.md"], policy)
  const baseline = baselineFor([
    toBaselineEntry(reviewed[0], "pre-rebrand-public-copy"),
  ])

  assert.deepEqual(
    verifyLegacyReferenceBaseline(reviewed, baseline, policy),
    { missing: [], unclassified: [] },
  )

  writeFixture(root, "new-copy.md", "A new Massage Lab reference\n")
  const withNewReference = collectLegacyReferences(root, ["copy.md", "new-copy.md"], policy)
  const added = verifyLegacyReferenceBaseline(withNewReference, baseline, policy)
  assert.equal(added.unclassified.length, 1)
  assert.equal(added.unclassified[0].path, "new-copy.md")

  const removed = verifyLegacyReferenceBaseline([], baseline, policy)
  assert.equal(removed.missing.length, 1)
  assert.deepEqual(removed.unclassified, [])
})

test("baseline schema, source commit, locations, categories, and hashes fail closed", () => {
  const validEntry = {
    path: "copy.md",
    line: 1,
    column: 1,
    textSha256: "b".repeat(64),
    category: "historical",
  }
  assert.throws(() => validateBaseline({ ...baselineFor([validEntry]), sourceCommit: "bad" }, policy), /sourceCommit/)
  assert.throws(() => validateBaseline(baselineFor([{ ...validEntry, path: "../copy.md" }]), policy), /normalized path/)
  assert.throws(() => validateBaseline(baselineFor([{ ...validEntry, line: 0 }]), policy), /line\/column/)
  assert.throws(() => validateBaseline(baselineFor([{ ...validEntry, category: "anything" }]), policy), /Invalid legacy category/)
  assert.throws(() => validateBaseline(baselineFor([{ ...validEntry, textSha256: "bad" }]), policy), /Invalid line hash/)
})

test("runtime surfaces never import repository-audit tooling", () => {
  const runtimePrefixes = ["app/", "components/", "lib/", "prisma/", "public/"]
  const textExtensions = new Set(policy.textExtensions)
  const offenders = listTrackedFiles(repositoryRoot)
    .filter((path) => runtimePrefixes.some((prefix) => path.startsWith(prefix)))
    .filter((path) => textExtensions.has(extname(path).toLowerCase()))
    .filter((path) => readFileSync(resolve(repositoryRoot, ...path.split("/")), "utf8")
      .includes("scripts/repository-audit"))
  assert.deepEqual(offenders, [])
})
```

- [ ] **Step 7: Generate and review the initial brand baseline**

Stage the new scanner, CLIs, policy, tests, and package commands first because the scanner intentionally sees only staged/tracked files:

```powershell
git add package.json scripts/repository-audit/core.mjs scripts/repository-audit/inventory.mjs scripts/repository-audit/brand.mjs scripts/repository-audit/policy.json tests/repository-audit.test.mjs
npm run brand:audit -- --print-candidate-baseline
```

Review every printed occurrence/category against the reference inventory, create `brand-reference-baseline.json` with that exact reviewed JSON using a normal file edit, and stage it. Do not redirect unchecked output directly into the repository and do not accept a broad directory rule merely to make failures disappear.

```powershell
git add scripts/repository-audit/brand-reference-baseline.json
npm run brand:audit
```

- [ ] **Step 8: Verify Task 6**

Run:

```powershell
node --test tests/repository-audit.test.mjs
npm run repository:inventory
npm run brand:audit
git diff --check
```

Expected: focused tests pass; no forbidden paths; zero unclassified legacy references; approved old-brand totals are reported by category.

Do not commit Task 6 separately yet; Task 7 creates the fresh initial repository commit after complete local verification.

---

### Task 7: Verify and create the fresh local AtmoShaper initial commit

**Files:**

- All staged destination files classified by Tasks 5-6

**Interfaces:**

- Consumes: complete staged destination tree and source evidence.
- Produces: fresh initial commit on new-repo `main`.

**Why:** The initial root must be verified before publication and must state exact lineage.

**Impact/Compatibility:** Local new repository only. No provider mutation yet.

**Verification:** Full destination gate passes; parity snapshots match; audits pass; commit parent list is empty; worktree is clean.

- [ ] **Step 1: Install and validate dependencies in the new root**

Run from `C:\Users\derri\code\my_projects\atmoshaper`:

```powershell
npm ci
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:browser-qa
```

Record exact results and compare them with Task 4. Stop on any unexplained difference.

- [ ] **Step 2: Run the complete Browser QA and parity gates**

Run all four `PLAYWRIGHT_CI_LANE` values exactly as in Task 4, then run migration parity with `ATMOSHAPER_MIGRATION_PARITY=1` and the exact authorized disposable database fingerprint. Do not update snapshots in the destination.

Expected: lane counts match source and all 22 migration screenshots compare. Any snapshot update in the destination is prohibited.

- [ ] **Step 3: Run audit and tree checks**

Run:

```powershell
git add -A
npm run repository:inventory
npm run brand:audit
git diff --cached --check
git status --short
```

Compare route, bundle, migration, metadata, manifest, robots, sitemap, service-worker, and snapshot hashes with Task 4. Document only explained migration-document/audit-tool differences.

After staging, run the final path equation. The result must equal `git ls-files` exactly before the initial commit:

```powershell
$sourceRepo = "C:\Users\derri\code\my_projects\massagelab"
$manifest = Get-Content -LiteralPath "docs\rebrand\atmoshaper-export-manifest.json" -Raw | ConvertFrom-Json
$lineage = Get-Content -LiteralPath "MIGRATION_LINEAGE.md" -Raw
$sourceMatch = [regex]::Match($lineage, '(?m)^Source commit: `([a-f0-9]{40})`$')
if (-not $sourceMatch.Success -or $manifest.sourceCommit -ne $sourceMatch.Groups[1].Value) {
  throw "Final source SHA does not match lineage and export manifest."
}
$sourcePaths = @(& git -C $sourceRepo ls-tree -r --name-only $manifest.sourceCommit)
$expectedFinalPaths = @(
  $sourcePaths | Where-Object { $_ -notin @($manifest.omitPaths) }
  @($manifest.task5AddPaths)
  @($manifest.task6AddPaths)
) | Sort-Object -Unique
$actualFinalPaths = @(& git ls-files) | Sort-Object -Unique
$finalPathDifference = @(Compare-Object $expectedFinalPaths $actualFinalPaths)
if ($finalPathDifference.Count -gt 0) { throw "Final destination path set violates the export manifest." }
```

- [ ] **Step 4: Create the fresh initial commit**

Commit all and only the classified staged destination files with:

```powershell
$lineage = Get-Content -LiteralPath "MIGRATION_LINEAGE.md" -Raw
$sourceMatch = [regex]::Match($lineage, '(?m)^Source commit: `([a-f0-9]{40})`$')
if (-not $sourceMatch.Success) { throw "MIGRATION_LINEAGE.md must contain one exact source commit line." }
$sourceSha = $sourceMatch.Groups[1].Value
git commit -m "chore: bootstrap AtmoShaper from MassageLab" -m "Source: dsbowersock/massagelab at $sourceSha." -m "Full historical development remains in dsbowersock/massagelab. This fresh-root migration preserves application behavior and design."
```

- [ ] **Step 5: Prove fresh-root identity**

Run:

```powershell
git rev-list --max-parents=0 HEAD
git rev-list --parents -n 1 HEAD
git status --short
git show -1 --format=fuller --stat
```

Expected: the current commit is the only root and has no parent; status is clean. Record the initial commit SHA.

---

### Task 8: Record destination verification on `codex/bootstrap-atmoshaper`

**Files:**

- Modify: `docs/rebrand/atmoshaper-migration-charter.md`
- Modify: `docs/rebrand/atmoshaper-reference-inventory.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**

- Consumes: source/destination results and initial commit SHA.
- Produces: reviewable Phase 2 verification receipt without altering the initial root commit.

**Why:** Verification evidence should be reviewed separately from the immutable initial snapshot.

**Impact/Compatibility:** Documentation only.

**Verification:** Receipt values match raw results; audits still pass after new docs; branch diff contains only four docs.

- [ ] **Step 1: Create the bootstrap review branch**

Run:

```powershell
git switch -c codex/bootstrap-atmoshaper
```

- [ ] **Step 2: Record exact destination comparison**

Update the four files with initial commit SHA, file counts, omission/addition summary, all command results, screenshot parity, route/bundle comparisons, legal/compatibility result, provider/domain inventory, and restricted-mutation confirmation.

No field may say `passing`, `equal`, or `complete` unless its recorded command/output covers that exact claim.

- [ ] **Step 3: Verify documentation-only drift**

Run:

```powershell
npm run repository:inventory
npm run brand:audit
git diff --check
git diff --name-only main...HEAD
```

Before commit, the diff must contain only the four Task 8 documents.

- [ ] **Step 4: Commit the verification receipt**

Stage exactly the four receipt documents and commit:

```powershell
git add docs/rebrand/atmoshaper-migration-charter.md docs/rebrand/atmoshaper-reference-inventory.md docs/project-state.md docs/project-log.md
git commit -m "docs: record AtmoShaper bootstrap verification"
```

Read back commit files and status.

---

### Task 9: Create the public GitHub repository and open the bootstrap PR

**Files:** None locally unless Git adds the destination `origin` remote configuration.

**Interfaces:**

- Consumes: verified local `main`, verified review branch, authenticated GitHub account.
- Produces: public repository URL, pushed branches, and an unmerged bootstrap PR with hosted checks.

**Why:** This is the explicit Phase 2 external deliverable.

**Impact/Compatibility:** Creates a public GitHub repository and publishes the classified source snapshot. No deployment/provider integration is configured.

**Verification:** Repository visibility public, default branch `main`, branch SHAs match local, PR diff is documentation-only relative to initial root, hosted checks correspond to exact head.

- [ ] **Step 1: Recheck nonexistence and authentication**

Run:

```powershell
wsl.exe -d Ubuntu -- gh auth status
wsl.exe -d Ubuntu -- gh api repos/dsbowersock/atmoshaper
```

Expected before creation: authenticated as the authorized owner and repository lookup returns HTTP 404. Stop if it exists; do not overwrite or repurpose it.

- [ ] **Step 2: Create the empty public repository**

Run from the destination using the authenticated GitHub CLI with no README, license, gitignore, template, deployment, or provider integration generated by GitHub. Add it as `origin` only after creation.

Use:

```powershell
wsl.exe -d Ubuntu -- gh repo create dsbowersock/atmoshaper --public
git remote add origin https://github.com/dsbowersock/atmoshaper.git
```

If repository creation is unavailable, stop with the complete verified local repo and exact remaining commands; do not choose a different owner/name or clone history.

- [ ] **Step 3: Push the initial root and review branch**

Push local `main` first, then `codex/bootstrap-atmoshaper`, with no tags and no force:

```powershell
wsl.exe -d Ubuntu -- git -c safe.directory=/mnt/c/Users/derri/code/my_projects/atmoshaper -C /mnt/c/Users/derri/code/my_projects/atmoshaper push -u origin main
wsl.exe -d Ubuntu -- git -c safe.directory=/mnt/c/Users/derri/code/my_projects/atmoshaper -C /mnt/c/Users/derri/code/my_projects/atmoshaper push -u origin codex/bootstrap-atmoshaper
```

- [ ] **Step 4: Verify GitHub identity and exact refs**

Read back visibility, default branch, empty tag list, and both ref SHAs through `gh api`. Confirm remote `main` equals the local initial commit and remote review branch equals local branch head.

If GitHub did not set `main` as default, set only that repository field to `main` and read it back. Do not alter Actions, rulesets, secrets, deployments, Pages, Vercel, or other settings in this task.

- [ ] **Step 5: Open the bootstrap PR**

Open `codex/bootstrap-atmoshaper` into `main`. The PR body must state:

- exact MassageLab source SHA;
- exact new initial commit SHA;
- fresh-root proof;
- source/destination verification summary;
- intentional file omissions/additions;
- no runtime rebrand;
- no production/provider/database/payment/email/legal mutation; and
- that merge is not authorized by this plan.

Create it with the reviewed charter as the body source:

```powershell
wsl.exe -d Ubuntu -- gh pr create --repo dsbowersock/atmoshaper --base main --head codex/bootstrap-atmoshaper --title "Verify AtmoShaper fresh-root bootstrap" --body-file /mnt/c/Users/derri/code/my_projects/atmoshaper/docs/rebrand/atmoshaper-migration-charter.md
```

- [ ] **Step 6: Wait for and verify hosted checks**

Use `gh pr checks`/GitHub API to verify the exact PR head's repository-owned CI. Record CodeQL, Vercel, and CodeRabbit only if they are installed and actually run in the new repository. Missing integrations are findings for later setup, not silently passed checks.

Do not merge the PR.

---

### Task 10: Deliver the Phase 1-2 completion report and stop

**Files:**

- Modify only if evidence correction is required: the four Task 8 receipt documents.

**Interfaces:**

- Consumes: local/remote Git receipts, hosted checks, source/destination ledgers, inventories, and PR URLs.
- Produces: the exact report required by design Section 20 and a recommended Phase 3 branch.

**Why:** Completion is bounded to verified Phase 1-2 outcomes, not the whole ten-phase program.

**Impact/Compatibility:** Reporting only. No merge or next-phase implementation.

**Verification:** Every report claim points to fresh evidence; both repositories and all task-owned worktrees/branches have explicit status.

- [ ] **Step 1: Run final falsifying checks**

In both repositories, read branch, HEAD, status, remotes, root commits, and task diffs. In the new repo, rerun `npm run repository:inventory`, `npm run brand:audit`, and `git diff --check`. Verify hosted PR checks against exact remote head.

- [ ] **Step 2: Produce the required report**

Report:

- old source SHA;
- old preflight branch/commit/PR;
- new repository URL;
- new initial commit and current review-head SHAs;
- fresh-root proof;
- copied/omitted/unresolved counts and links;
- source/destination install, Prisma, typecheck, lint, unit, build, Browser QA, and parity results;
- screenshots, route count, bundle sizes, metadata, PWA, storage/export, legal, and compatibility comparisons;
- external provider/account and domain dependency inventory;
- highest-risk cleanup and highest-value refactor candidates;
- old-history intact confirmation;
- exact list of external actions performed; and
- confirmation that restricted production/DNS/provider/database/email/payment/media/legal actions did not occur.

- [ ] **Step 3: Recommend and stop before Phase 3**

Recommend `codex/atmoshaper-docs-consolidation` only if Phase 1-2 passes. Do not create it, merge either PR, or begin consolidation without the next reviewed plan/authorization.

---

## Risks and stop handling

- **Source advances during work:** invalidate stale source evidence and restart Task 1 against the new clean `main`.
- **Source validation fails:** stop before export; do not create the public repo.
- **Signed-in QA target unavailable:** stop before claiming complete baseline; never use production or real accounts.
- **Snapshot instability:** identify and narrowly mask the nondeterministic owner; do not update destination snapshots or mask layout/content drift.
- **Historical file uncertainty:** retain it or leave it unresolved; never delete it from the old repository.
- **Destination path exists:** stop for ownership review; never recursively remove or overwrite it.
- **GitHub destination already exists:** stop; do not rename, delete, transfer, or reuse it.
- **Audit overreach:** keep audit logic read-only and migration-specific; defer dead-code/asset/env automation to later phases.
- **Provider integration absent in new repo:** report it for later setup; do not configure it during bootstrap.
- **Hosted check failure:** preserve both local repos/branches and diagnose; do not merge or weaken gates.

## Retirement and follow-up

- The old repository never retires under this plan.
- Migration parity snapshots remain through cleanup/refactor/preview rebrand and receive an explicit keep/update/retire decision after Phase 6.
- `pre-rebrand-public-copy` baseline entries shrink during Phase 6; they are not permanent compatibility exemptions.
- Legal, historical, and private compatibility entries can remain indefinitely when their owners still require them.
- Repository/brand audits remain CI candidates; dead-code, asset, and environment audits belong to their later focused plans.
- Phase 3 documentation consolidation is the next plan only after both Phase 1-2 PRs and evidence are reviewed.

## Plan self-review

- Spec coverage: all Phase 1-2 source, snapshot, lineage, inventory, audit, parity, GitHub, verification, rollback, and reporting requirements map to Tasks 1-10.
- Placeholder scan: execution-time facts are produced by named commands and must be inserted exactly; no decision is deferred with `TBD` or `TODO`.
- Interface consistency: `sourceSha`, difference contract, parity command, audit policy, initial commit, and review branch each have one owner and downstream consumer.
- Compatibility: runtime and persistent owners are unchanged; every destination difference is enumerated.
- Change necessity: only migration test/audit code is added, with no runtime import.
- Existence: new surfaces have explicit consumers and retirement review.
- Complexity: Phase 3-10 implementation is excluded.
- Verification: every task has focused checks; final claims require source, destination, and hosted evidence.
- Dual track: fresh future repository plus retained historical/compatibility owners are explicit; no old path is silently retired.
