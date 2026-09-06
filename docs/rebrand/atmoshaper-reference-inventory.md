# AtmoShaper Reference Inventory

Source repository: `dsbowersock/massagelab`. Locked source: `fa78ca01a42179329cc223df77c76f308e76320b`. Inventory date: 2026-09-06. Preparation base: `f5967be698218aff49e625a09dbd5835fc89ac08`.

Authority: [charter](atmoshaper-migration-charter.md), [approved design](../superpowers/specs/2026-09-06-atmoshaper-repository-migration-design.md), [implementation plan](../superpowers/plans/2026-09-06-atmoshaper-repository-migration.md), and [rollback plan](atmoshaper-rollback-plan.md). This is the Task 2 classification contract, not a source-baseline or destination-parity receipt. Task 3/4 must record real snapshots, measurements and provider readbacks before Task 5 executes.

## Source Tree Summary

`git rev-parse main` matched the charter before inspection. `git ls-tree -r --name-only` and `git ls-tree -r -l` at that exact SHA report **1,856 tracked files, 37,102,557 blob bytes, 41 top-level entries**. Bytes are summed uncompressed Git blob sizes, not working-tree allocation, Git history size or bundle size. No untracked/ignored workstation file is an export input.

The table partitions every source path by its first path component. More specific rules below override the parent classification; otherwise all descendants are retained unchanged. These are classification prefixes, never recursive deletion instructions.

| Top-level entry | Files | Blob bytes | Classification |
| --- | ---: | ---: | --- |
| `.agents` | 10 | 27158 | Keep active skill; historical refactor records unresolved/retained except the exact omission below. |
| `.env.example` | 1 | 7320 | Keep secret-free example; values are examples, not provider readback. |
| `.gitattributes` | 1 | 233 | Keep byte/line-ending contracts. |
| `.github` | 1 | 7239 | Keep CI. |
| `.gitignore` | 1 | 2021 | Keep private/generated-file exclusions. |
| `.nvmrc` | 1 | 3 | Keep toolchain. |
| `.superpowers` | 5 | 64171 | Unresolved; retain commerce/background receipts. |
| `AGENTS.md` | 1 | 2678 | Replace only destination project authority/terminology; retain safety rules. |
| `app` | 351 | 3973336 | Keep all runtime/routes. |
| `auth.ts` | 1 | 10947 | Retain as compatibility. |
| `components` | 257 | 2941205 | Keep all UI/runtime/assets. |
| `components.json` | 1 | 443 | Keep configuration. |
| `data` | 40 | 4756674 | Keep catalogs, provenance and release evidence. |
| `docs` | 224 | 5064065 | Keep except exact current-document replacements; candidate subgroups below remain retained. |
| `eslint.config.mjs` | 1 | 607 | Keep configuration. |
| `hooks` | 3 | 9766 | Keep runtime. |
| `instrumentation-client.ts` | 1 | 202 | Keep telemetry boundary. |
| `instrumentation.ts` | 1 | 322 | Keep telemetry boundary. |
| `lib` | 351 | 5328482 | Keep runtime/domain/adapters/compatibility. |
| `LICENSE` | 1 | 1691 | Keep proprietary ownership/license verbatim. |
| `next.config.mjs` | 1 | 2903 | Keep build/provider/cache policy. |
| `package-lock.json` | 1 | 657252 | Keep dependency bytes. |
| `package.json` | 1 | 14350 | Replace only approved parity/audit scripts. |
| `patches` | 2 | 59137 | Keep installed-dependency patches. |
| `playwright.config.ts` | 1 | 12522 | Keep browser projects/fixtures/gates. |
| `postcss.config.mjs` | 1 | 135 | Keep configuration. |
| `prisma` | 49 | 375411 | Keep schema, seed, lock and all 46 migrations. |
| `prisma.config.ts` | 1 | 462 | Keep database configuration boundary. |
| `public` | 72 | 5606288 | Keep icons/media/offline assets. |
| `README.md` | 1 | 3510 | Replace destination current introduction; retain legal/history links. |
| `scripts` | 71 | 604707 | Keep all maintenance, generation and release owners. |
| `sentry.edge.config.ts` | 1 | 126 | Keep telemetry. |
| `sentry.options.ts` | 1 | 1400 | Keep privacy/environment policy. |
| `sentry.server.config.ts` | 1 | 164 | Keep telemetry. |
| `skills-lock.json` | 1 | 283 | Keep active skill lock. |
| `styles` | 1 | 2428 | Keep visual behavior. |
| `tailwind.config.ts` | 1 | 2797 | Keep visual configuration. |
| `tests` | 390 | 7548917 | Keep all contracts/fixtures/CI lanes. |
| `TODO.md` | 1 | 6846 | Keep referenced source evidence; not current authority. |
| `tsconfig.json` | 1 | 735 | Keep compiler aliases/options. |
| `types` | 4 | 3621 | Keep contracts. |

Candidate groups were counted separately; these rows are subsets of the source summary, not additional files.

| Candidate group | Files | Blob bytes | Bootstrap disposition and evidence |
| --- | ---: | ---: | --- |
| `docs/superpowers/plans/` | 121 | 2598126 | Referenced plans and protected security/legal/provider decisions stay; all other plans are unresolved and retained until semantic review. Direct test owners are listed below. |
| `docs/superpowers/reports/` | 2 | 84656 | Keep both: current audio provenance reference and direct workload-test input. |
| `docs/superpowers/qa/` | 2 | 39028 | Keep audio interruption/startup device evidence pending equivalent current proof. |
| `docs/aegis/work/` | 30 | 296178 | Unresolved/retained; security, durable billing and audio decision evidence requires semantic review. |
| `docs/aegis/plans/` | 4 | 96212 | Keep audio review/provenance decisions; no whole-group omission. |
| `docs/audits/` | 7 | 67757 | Keep operational/security/compatibility/control evidence pending consolidation. |
| `docs/background-branding-audit/` | 8 | 48847 | Keep generated audit and all seven batches: generator owns this directory and its tests require the exact output filenames. |
| `.superpowers/` | 5 | 64171 | Unresolved/retained: commerce and background history, including a current-log reference. |
| `.agents/` | 10 | 27158 | Keep active Neon skill; eight historical refactor records retained pending semantic review; one exact receipt omitted below. |
| `TODO.md` | 1 | 6846 | Keep: referenced by current authority and wiki. |
| `docs/roadmap.md` | 1 | 13973 | Keep: authority/wiki plus direct calendar test read. |

## Required Keep Set

Every source file outside `omitPaths` is retained; only `replacePaths` may change bytes. This includes all runtime, tests, CI, legal/acceptance code, entitlement keys, schema/migrations, fixtures, media, source attribution, secret-free examples, deployment/privacy/PWA/billing/security/release instructions and active agent instructions. No filename containing MassageLab is obsolete on that basis.

In particular retain `LICENSE`, `lib/legal-documents.js`, `lib/legal-acceptance.js`, `lib/legal-acceptance-gate.js`, `docs/background-sources.md`, `docs/carousel-sources.md`, `docs/licenses/componentry-mit.txt`, `docs/wiki/atmosphere-audio.md`, all `data/atmoshaper/` material and its `lib/atmoshaper/` validators/release tooling. Source-visible proprietary ownership and `UNLICENSED` package metadata stay unchanged. Public repository visibility does not grant reuse rights.

The source audio wiki distinguishes the shipped **51-concept** release (four processed, 47 dynamic) from historical **84-concept** taxonomy/research. Moodist media is retired and prohibited as runtime fallback. Neither research rows, MIT code licensing nor a general library description replaces exact-file provenance, license, source mapping and audio QA.

Reference proof at the locked SHA:

| Retained exact path or bounded family | Direct consumer / corroboration |
| --- | --- |
| `docs/superpowers/plans/2026-08-28-release-soft-launch.md`; `2026-08-28-identity-account-method-safety.md`; `2026-08-28-subscription-entitlement-convergence.md` in that same directory | `tests/auth-schema-migration.test.mjs:43-45` reads all three. Also protect irreversible rollout history. |
| `docs/superpowers/plans/2026-08-29-bootstrap-pricing-cost-hardening.md`; `docs/superpowers/reports/2026-08-29-bootstrap-pricing-cost-hardening.md` | `tests/family-friends-server-workload.test.mjs` reads both. |
| `docs/superpowers/plans/2026-07-18-clock-chimer-music-visualizer.md` | `tests/immersive-panel-shell.test.mjs:19` reads the plan. |
| `docs/superpowers/plans/2026-08-31-operational-limiter-email-ceiling.md`; `2026-08-31-public-booking-traffic-hardening.md`; `2026-08-31-anatomime-traffic-hardening.md` in that same directory | `tests/operational-rate-limit-schema.test.mjs` reads all three. |
| `docs/superpowers/plans/2026-07-15-sitewide-control-system-rollout-actions.md` | `tests/sitewide-control-rollout.test.mjs:92` reads the plan. |
| `docs/roadmap.md` | `tests/calendar-creation-routes.test.mjs` plus AGENTS, README, state, log, wiki. |
| `docs/background-branding-audit/` | `scripts/background-branding/render-audit.mjs:13` resolves the output directory; `tests/background-branding-audit.test.mjs` verifies the generated filename set through an injected writer, without reading these Markdown outputs. |
| `docs/superpowers/reports/2026-08-23-atmoshaper-signature-sound-catalog-audit.md` | Current source state, log and audio wiki link this research/provenance evidence. |
| `.superpowers/sdd/final-fixes-report.md` | Source `docs/project-log.md` references the completed fix receipt. |
| `docs/wiki/` current operational set | `docs/wiki/index.md`, source state/log and AGENTS form the read-first graph; preserve linked current operations and privacy boundaries. |

## Evidence-Backed Omission Set

Only the following source file is omitted from the new repository. It remains in the old repository at the locked commit. No omission executes during Task 2.

| Item | Current path | Type | Why it may be obsolete | Runtime references | Test references | Historical value | Proposed action | Proof required | Rollback | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Completed one-line wrapper retirement receipt | `.agents/refactor/2026-06-21-refactor-anatomime-session-wrapper.md` | Historical refactor report; 1369 bytes | Describes removal of an already-absent one-line JS wrapper and old 663-test results; defines no current operational contract. | Zero path/basename matches outside the report; source has the TS implementation and no JS wrapper. | Zero report consumers; `tests/ts-js-compatibility.test.mjs` owns the current dynamic compatibility check. | Preserved as old measurement/retirement evidence at exact old SHA. | Omit this exact file from the new tree only. | Full report read plus whole tracked-text path/basename grep, folder-consumer scan and source-tree absence of removed wrapper; all satisfied. | Restore exact blob `6f811591f79b24c75181a82db1b30fcada896e8f` from old source without changing runtime. | omit from new repository |

Historical source: [completed wrapper receipt](https://github.com/dsbowersock/massagelab/blob/fa78ca01a42179329cc223df77c76f308e76320b/.agents/refactor/2026-06-21-refactor-anatomime-session-wrapper.md). New documents refer to that historical location, not a broken destination-relative link.

## Replacement and ADR Set

Task 5 replaces `README.md`, `AGENTS.md`, `docs/project-state.md` and `docs/project-log.md` with concise destination authority. The new log begins at migration and links old history; it must not recast MassageLab events as AtmoShaper events. Existing licensing and operational safety rules survive. `package.json` changes only by the Task 3 parity script and Task 6 repository/brand audit scripts; no package identity, dependency or runtime change is authorized.

Phase 3 ADR candidates are fresh-root lineage, permanent old-history/rollback ownership, product/legal/private-identifier separation, old-origin recovery, and parallel provider staging. Their current owner is design sections 3, 7, 19 and 21.8. ADRs are **unresolved**, not accepted or source omissions. `docs/architecture.md` and `docs/decisions/` belong to Phase 3 consolidation and are deliberately not undeclared Task 5 additions.

## Unresolved Set

All eight retained `.agents/refactor/` records, all five source `.superpowers/` records, all 30 `docs/aegis/work/` records, and plans not independently proven historical-only stay in the destination. The two inspected lazy-runtime reports contain architectural/performance explanations; zero filename hits alone does not justify their removal. Source/current-document links may omit basenames, and generic names such as `index.md`, `10-intent.md` and `90-evidence.md` create false positive basename hits. Positive matches are conservative retention evidence; negative matches are only one part of omission proof.

The scan covered all 191 candidate files individually with both exact path and basename: 63 had at least one non-self match in runtime/test/script/CI/current-authority/wiki scopes, 128 had none in those scopes, and 69 had no non-self textual match anywhere scanned. Those counts are lexical candidates, not unused-file or deletion counts. Only the single fully inspected historical wrapper receipt clears omission.

Provider console state, domain ownership/DNS, the installed baseline's complete framework cookie set, actual Task 3 snapshot filenames/hashes, and legacy-origin behavior on installed PWAs remain verification items. Missing evidence stops the dependent phase; it does not authorize new omissions or source changes.

## Destination Overlay Set

The manifest contains 37 exact preparation-branch overlay paths: nine rebrand artifacts, the approved design and plan, one parity spec, 24 expected PNGs and `package.json`. Task 5 separately creates `MIGRATION_LINEAGE.md` and the four replacement authority documents.

Overlay is a **copy mechanism**, while add/replace describes the **difference from the source**. Thus all 36 source-absent overlays also appear in `task5AddPaths`, and the source-present `package.json` overlay also appears in `replacePaths`. This overlap is intentional. No overlay may be omitted, and every overlay must belong to the source set or a task-specific add set. Membership in the source set means the path existed, not that its bytes are exempt from the replacement contract.

The 24 PNG names below are the exact intended Windows Task 3 capture contract: twelve names for each existing `desktop-chromium` and `mobile-chromium` project. They have **not been captured or verified in Task 2**. Task 3 must compare real generated paths with this list and update both JSON and Markdown under review if the actual platform/name differs. It may not silently add extra files or infer descendants at export. Task 5 refuses missing/uncommitted overlays. Task-local briefs/reports under the current `.superpowers/sdd/2026-09-06-atmoshaper-repository-migration/` directory are not source files or destination overlays.

## Compatibility Map

This map owns one row per identity surface; detailed browser keys appear once in the [local-data register](atmoshaper-local-data-and-pwa-plan.md), provider sub-surfaces once in the [account checklist](atmoshaper-external-account-checklist.md), and hosts once in the [host matrix](atmoshaper-domain-cutover-plan.md).

| Public concept | Current public value | Future public value | Stable private identifiers | Owner | Phase |
| --- | --- | --- | --- | --- | --- |
| Platform | MassageLab | AtmoShaper | Current route names, API shapes, CSS `ml-` classes and internal module names | `lib/seo.js`, `app/layout.tsx`, `components/sidebar/app-sidebar-client.tsx` | Public copy Phase 6; canonical host Phase 10 |
| Audio mixer | AtmoShaper | Atmosphere / Atmosphere mixer | `atmoshaper` paths/types/scripts/catalogs/source IDs/releases; `lib/atmosphere/` runtime; existing storage schemas | `components/atmoshaper/`, `lib/atmoshaper/`, `data/atmoshaper/` | Label only Phase 6; internal identifiers retained |
| Established features | Chimer, Anatomime, Calendar, Notes, Wellness | Same | Routes, feature keys, fixture/test names | `app/`, `lib/membership.js` | Retain |
| Repository | dsbowersock/massagelab | dsbowersock/atmoshaper | Locked old SHA/history and provenance links | Charter, lineage, CI | Phase 2 after baseline |
| Legal/operator | Derrick Bowersock, doing business as Massage Lab | Unchanged until separate legal approval | `LICENSE`, `UNLICENSED`, document keys/versions/effective dates/acceptances/audit records | `LICENSE`, `lib/legal-documents.js`, `lib/legal-acceptance.js` | Separately approved legal transition only |
| Access and data | Existing accounts and memberships | Same behavior | `premium_backgrounds`, other feature keys, Prisma tables/enums/migrations, durable audit/operation IDs | `lib/membership.js`, `prisma/schema.prisma`, `prisma/migrations/` | Dedicated future migration only |
| Environment/deployment | MassageLab service | Separate AtmoShaper staging later | `MASSAGELAB_` variables, auth/security keys, source deployment rollback identity | `.env.example`, `next.config.mjs`, deployment wiki | Isolated Phase 7; authorized provider work Phase 9/10 |
| Authentication | Current Auth.js / Google sign-in | Same methods on approved new origin | Cookie/binding namespaces, account/provider mappings, TOTP encryption and recovery contracts | `auth.ts`, auth/security owners; local-data register | Phase 8/9 domain proof; no token transport |
| Google Calendar | MassageLab calendar | Display change undecided | `GOOGLE`, `MASSAGELAB_GOOGLE_CALENDAR_SUMMARY`, provider calendar/event mappings | `lib/calendar-sync-constants.ts`, `lib/google-calendar-adapter.ts` | Phase 9 explicit compatibility plan |
| Payments | MassageLab Supporter / One-time support / backgrounds | Display copy undecided | Stripe catalog/metadata/idempotency families and legacy Price mappings in account checklist | `lib/stripe-billing.js`, `lib/stripe-price-contract.js`, `lib/stripe-webhook-contract.js` | Separate Phase 9/10 authorization |
| Media | Existing public media/artwork | Same content initially | R2 buckets, immutable object prefixes/hashes/catalog IDs, `massage-lab-*` background IDs | Media manifests, `lib/background-options.js`, audio wiki | Retain; separate media migration only |
| Support/mail | Existing public support address and SMTP display identity | Undecided | Current support delivery and sender/authentication contracts | `lib/support-contact.js`, deployment wiki | Phase 9 approval; do not retire old support |
| Local records, preferences and PWA | Existing origin-bound browser data/install | New installation with user-controlled recovery | All keys/formats/cache names in local-data register | Vault/storage/SW/manifest owners | Phase 8 proof, Phase 10 recovery gate |

## Exact Destination Difference Contract

The following JSON is the same ordered path contract as [the machine-readable manifest](atmoshaper-export-manifest.json). Paths are normalized files, not globs. Arrays are code-point sorted and duplicate-free. Source present: one omitted, five replaced. Source absent: 37 Task 5 additions and six Task 6 additions.

`Task5Paths = (SourcePaths - omitPaths) union task5AddPaths` gives **1,892** paths.
`FinalPaths = Task5Paths union task6AddPaths` gives **1,898** paths.
The retained source set contains **1,855** files / **37,101,188** original blob bytes before replacements/additions. Task 6 additions must remain absent until Task 6. All other source blobs must match exactly; a declared replacement is not permission to change arbitrary contents.

```json
{
  "schemaVersion": 1,
  "sourceRepository": "dsbowersock/massagelab",
  "sourceCommit": "fa78ca01a42179329cc223df77c76f308e76320b",
  "omitPaths": [
    ".agents/refactor/2026-06-21-refactor-anatomime-session-wrapper.md"
  ],
  "replacePaths": [
    "AGENTS.md",
    "README.md",
    "docs/project-log.md",
    "docs/project-state.md",
    "package.json"
  ],
  "task5AddPaths": [
    "MIGRATION_LINEAGE.md",
    "docs/rebrand/atmoshaper-cleanup-register.md",
    "docs/rebrand/atmoshaper-domain-cutover-plan.md",
    "docs/rebrand/atmoshaper-export-manifest.json",
    "docs/rebrand/atmoshaper-external-account-checklist.md",
    "docs/rebrand/atmoshaper-local-data-and-pwa-plan.md",
    "docs/rebrand/atmoshaper-migration-charter.md",
    "docs/rebrand/atmoshaper-refactor-register.md",
    "docs/rebrand/atmoshaper-reference-inventory.md",
    "docs/rebrand/atmoshaper-rollback-plan.md",
    "docs/superpowers/plans/2026-09-06-atmoshaper-repository-migration.md",
    "docs/superpowers/specs/2026-09-06-atmoshaper-repository-migration-design.md",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-profile-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-profile-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-security-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-security-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/chimer-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/chimer-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/clock-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/clock-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/education-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/education-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/home-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/home-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/music-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/music-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/notes-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/notes-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/pricing-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/pricing-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/support-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/support-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/tools-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/tools-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/wellness-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/wellness-mobile-chromium-win32.png"
  ],
  "task6AddPaths": [
    "scripts/repository-audit/brand-reference-baseline.json",
    "scripts/repository-audit/brand.mjs",
    "scripts/repository-audit/core.mjs",
    "scripts/repository-audit/inventory.mjs",
    "scripts/repository-audit/policy.json",
    "tests/repository-audit.test.mjs"
  ],
  "overlayPaths": [
    "docs/rebrand/atmoshaper-cleanup-register.md",
    "docs/rebrand/atmoshaper-domain-cutover-plan.md",
    "docs/rebrand/atmoshaper-export-manifest.json",
    "docs/rebrand/atmoshaper-external-account-checklist.md",
    "docs/rebrand/atmoshaper-local-data-and-pwa-plan.md",
    "docs/rebrand/atmoshaper-migration-charter.md",
    "docs/rebrand/atmoshaper-refactor-register.md",
    "docs/rebrand/atmoshaper-reference-inventory.md",
    "docs/rebrand/atmoshaper-rollback-plan.md",
    "docs/superpowers/plans/2026-09-06-atmoshaper-repository-migration.md",
    "docs/superpowers/specs/2026-09-06-atmoshaper-repository-migration-design.md",
    "package.json",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-profile-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-profile-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-security-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/account-security-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/chimer-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/chimer-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/clock-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/clock-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/education-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/education-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/home-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/home-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/music-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/music-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/notes-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/notes-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/pricing-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/pricing-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/support-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/support-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/tools-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/tools-mobile-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/wellness-desktop-chromium-win32.png",
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/wellness-mobile-chromium-win32.png"
  ]
}
```

## Reproduction and Verification

Run from the old repository using the charter lock, never the current overlay tree:

```powershell
$sourceSha = (git rev-parse main).Trim()
if ($sourceSha -cne 'fa78ca01a42179329cc223df77c76f308e76320b') { throw 'Source lock drift' }
git ls-tree -r --name-only $sourceSha
git ls-tree -r -l $sourceSha
# For each candidate path from the eleven candidate groups:
# $candidate is the exact source path; $basename is its final path component.
git grep -l -I -F -e $candidate -e $basename $sourceSha -- . ':(exclude).env*'
# Inspect content and folder/dynamic consumers before any omission.
git show "${sourceSha}:.agents/refactor/2026-06-21-refactor-anatomime-session-wrapper.md"
git grep -n -I -F '.agents/refactor' $sourceSha -- app components lib hooks tests scripts .github package.json
```

Exclude the candidate's own path from reference counts; classify the remaining owner paths, not captured line contents. `git grep` exit 1 means no match and is not a tool failure. Do not read or print private environment files. Source tree inspection found 46 `prisma/migrations/*/migration.sql` files; this is a committed-file count, not a new database query.

Task 2 checks JSON/Markdown equality, normalized sorted unique arrays, source-present omit/replace sets, source-absent/disjoint task add sets, overlay coverage, exact count equations, all 41 top-level partitions, direct retained dependencies and the omission proof. Source/destination install/build/browser/provider receipts remain Task 3/4/7 obligations.
