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

Task 3 also replaces the source-present `tests/browser-qa-harness.test.mjs` with one explicit migration-only spec exclusion and an independent assertion that the excluded file exists. Its previous directory scan treated every non-development spec as an ordinary CI-lane member, contradicting the approved migration-only gate. The exact 17 ordinary specs, 34 project/spec assignments, and `tests/browser/ci-lanes.mjs` remain unchanged; this is a test-harness compatibility correction with no runtime effect.

Task 3 replaces source-present `playwright.config.ts` to recognize the exact migration-spec invocation, disable existing-server reuse, and require/apply the explicit telemetry-disabled environment for enabled migration execution. Its focused matcher accepts normalized exact paths and line selectors; broad substrings, ordinary specs, and option values retain ordinary behavior. Discovery does not require capture credentials. Source and destination parity commands build the current checkout with `npm run build:browser-qa` before Playwright starts its server. An occupied port must fail instead of consuming a stale server's rendering.

Task 3 also replaces source-present `next.config.mjs` narrowly for `ATMOSHAPER_MIGRATION_PARITY=1`: require explicitly empty `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, and `SENTRY_AUTH_TOKEN`, plus `NEXT_TELEMETRY_DISABLED=1`, before compilation/provider hooks, then pass `telemetry: false` to the Sentry build plugin. The same preflight runs before the fresh build and enabled exact-spec capture; its owned server receives the same values. Empty values prevent dotenv fallback, and the public DSN must be blank at build time because it is inlined. `sentry.options.ts` enables runtime Sentry solely from the public DSN; the installed `@sentry/bundler-plugin-core` separately defaults plugin telemetry on with its own DSN. Blanking the upload token prevents release/source-map upload. Ordinary builds and runtime behavior outside explicit migration mode are unchanged; no production Sentry configuration or provider resource is modified.

Phase 3 ADR candidates are fresh-root lineage, permanent old-history/rollback ownership, product/legal/private-identifier separation, old-origin recovery, and parallel provider staging. Their current owner is design sections 3, 7, 19 and 21.8. ADRs are **unresolved**, not accepted or source omissions. `docs/architecture.md` and `docs/decisions/` belong to Phase 3 consolidation and are deliberately not undeclared Task 5 additions.

## Unresolved Set

All eight retained `.agents/refactor/` records, all five source `.superpowers/` records, all 30 `docs/aegis/work/` records, and plans not independently proven historical-only stay in the destination. The two inspected lazy-runtime reports contain architectural/performance explanations; zero filename hits alone does not justify their removal. Source/current-document links may omit basenames, and generic names such as `index.md`, `10-intent.md` and `90-evidence.md` create false positive basename hits. Positive matches are conservative retention evidence; negative matches are only one part of omission proof.

The scan covered all 191 candidate files individually with both exact path and basename: 63 had at least one non-self match in runtime/test/script/CI/current-authority/wiki scopes, 128 had none in those scopes, and 69 had no non-self textual match anywhere scanned. Those counts are lexical candidates, not unused-file or deletion counts. Only the single fully inspected historical wrapper receipt clears omission.

Provider console state, domain ownership/DNS, the installed baseline's complete framework cookie set, actual Task 3 snapshot filenames/hashes, and legacy-origin behavior on installed PWAs remain verification items. Missing evidence stops the dependent phase; it does not authorize new omissions or source changes.

## Destination Overlay Set

The manifest contains 85 exact preparation-branch overlay paths: the 42 previously reviewed migration artifacts and corrections plus 43 Task 4A baseline-unblock and hardening paths discovered by full source QA. Task 5 separately creates `MIGRATION_LINEAGE.md` and the four replacement authority documents.

Overlay is a **copy mechanism**, while add/replace describes the **difference from the source**. Thus all 46 source-absent overlays also appear in `task5AddPaths`, and all 39 source-present overlays also appear in `replacePaths`. This overlap is intentional. No overlay may be omitted, and every overlay must belong to the source set or a task-specific add set. Membership in the source set means the path existed, not that its bytes are exempt from the replacement contract.

The 24 PNG names below are the exact intended Windows Task 3 capture contract: twelve names for each existing `desktop-chromium` and `mobile-chromium` project. They have **not been captured or verified in Task 2**. Task 3 must compare real generated paths with this list and update both JSON and Markdown under review if the actual platform/name differs. It may not silently add extra files or infer descendants at export. Task 5 refuses missing/uncommitted overlays. Task-local briefs/reports under the current `.superpowers/sdd/2026-09-06-atmoshaper-repository-migration/` directory are not source files or destination overlays.

## Visual Parity Determinism and Activity Inventory

The following subsections retain chronological capture/debugging evidence. Their earlier pending/reopening statements are superseded by **Final accepted Task 3 source parity — 2026-09-07** below, which owns the current accepted source-image/repeat status.

No masks are declared. Both Chromium projects use the same `UTC` timezone and `en-US` locale. For Clock only, before navigation the spec seeds the existing `massage-lab-settings` preference with `ambientMotionMode: "reduced"`, using the established `tests/browser/public-routes.spec.ts` pattern. This is a real user-visible app setting, not a DOM/style override, hidden image, substituted background, or weakened comparison. `SettingsProvider` normalizes the partial preference while retaining all other defaults. The selected background stays `massage-lab-moving-gradient`; `BackgroundHost` renders that registry entry's canonical visible static fallback when the app preference suppresses its animated effect.

Before `/clock` navigation, the spec also installs Playwright's clock at `2026-09-06T09:55:00.000Z`, allowing loading timers to run. After load it asserts the `chimer-running` body state, visible `chimer-premium-background` host with the exact selected ID, `data-background-effect-mounted=false`, `data-background-fallback-only=false`, `data-background-underlay=visible`, no canvas, and one visible radial-gradient child with no animation. The mounted/pending pair distinguishes settled static presentation from an initial lazy-load fallback. It then pauses at `2026-09-06T10:00:00.000Z`, clicks the existing `Reveal clock controls` button, advances exactly 1,000ms, and remains paused at `2026-09-06T10:00:01.000Z`. The `Immersive display controls` group must be visible, `[data-immersive-shell]` opacity `1`, and current-time display `10:00 AM`. Every glyph, shadow, glow, separator, control, and background/layout area remains compared. New Clock receipts additionally declare `ambientMotionMode: "reduced"`, `backgroundId: "massage-lab-moving-gradient"`, and `backgroundPresentation: "static-fallback"`.

The source timing owners are `app/chimer/page.tsx` (one-second time updates), `lib/chimer-timer.js` (default 12-hour display), `app/chimer/running-timer.tsx` (reveal, three-second fade, six-second hide), and `app/chimer/immersive-panel-shell.module.css` (900ms opacity transition). The 1,000ms settling advance completes that transition before either hide timer; controls remain visible while screenshot capture runs. The installed official `Clock.install`, `Clock.pauseAt`, and `Clock.runFor` API documentation in `node_modules/playwright-core/types/types.d.ts` owns clock emulation semantics.

Render-only parity permits no browser writes. Every non-GET/HEAD request is recorded and aborted at its first hop, including local requests, so a local 307/308 cannot forward a write externally. Observers stay active through explicit closure of the owned browser context; exact fixture cleanup then runs even if closure fails, and the inventory/error assertions follow cleanup. Read-only external request method/origin/path/resource type is recorded separately, without URL queries or credentials.

The coordinator's first authorized 2026-09-06 capture used a separate empty disposable QA target after all 46 source migrations and a current-checkout build. It returned **18 passed / 4 failed** and generated 22 of the 24 intended PNGs. Neither Education baseline exists: both readiness assertions selected hidden navigation/screen-reader labels. The corrected readiness owner is the exact visible `Open flashcards` link in `app/education/page.tsx`. Both signed-in tests reached profile/security screenshots but then failed the unchanged zero-mutation assertion on a Sentry envelope POST. Their separate contexts visit only account routes, so Education's test-runner assertion does not explain the signed-in telemetry attempt. The exact envelope kind cannot be established without a payload/trace; none was retained.

All 22 generated baseline PNGs and all four failure screenshots were visually inspected. All 22 `*-actual.png` files in `test-results` are byte-identical to those inspected baselines. Home, Tools, Music, Chimer, Clock, Wellness, Notes, Pricing, Support, and account profile/security render their current desktop/mobile surfaces; Clock shows `10:00 AM`, visible controls, and unmasked glow/shadows in both projects. The app renders its existing dark theme despite light media emulation. These full-page captures cover the initial viewport of the app's internal scroll containers, not unseen lower content; Pricing shows the empty-QA-target unavailable-price state. These are source-state observations, not permission for application/UI changes or accepted parity evidence.

The initial run above is historical failed-run evidence. Its console-only reporter did not preserve body inventory attachments; no external-read cleanliness was inferred from that run. The corrected spec persists `migration-parity-inventory.json` inside each owned test output directory before attaching it. The subsequent clean recapture receipt below supersedes the missing-PNG/inventory status, but repeat comparison and the stated visual qualifications still gate final acceptance.

### Historical post-Chimer-wait capture and failed repeat — 2026-09-06

**Historical acceptance withdrawn:** the subsequent no-update repeat passed 21/22 tests but failed desktop Clock with 12,875 differing pixels. The images in this historical section are not accepted repeatable baselines. That failure led to the explicit app-reduced Clock contract and coherent recapture recorded in the later Accepted Reduced-motion source capture section; its final no-update repeat remains pending. Neither PNGs nor application code were changed by the implementer.

The preceding clean run passed 22 tests but its entire 24-PNG set was rejected because Chimer's temporary guest notice covered the stepper. The coordinator then ran a fresh full capture after the source-owned lifecycle wait: **22/22 passing tests and 24 fresh PNGs**. This final set was individually inspected again and is accepted as source-image evidence for the documented initial-viewport scope; full Task 3 acceptance still requires the no-update repeat. No further recapture or deletion is indicated by this inspection.

Local readback confirms `test-results/.last-run.json` is `passed` with no failed tests and no retained failure screenshot/error-context files. All **24 PNGs** match the manifest's exact name set: twelve per project (`account-profile`, `account-security`, `chimer`, `clock`, `education`, `home`, `music`, `notes`, `pricing`, `support`, `tools`, `wellness`), with no missing/extra names. Desktop PNGs are 1280×900 and mobile PNGs are 412×839. Every corresponding `*-actual.png` is byte-identical to its baseline. No blank, error-page, loading-placeholder, missing-glyph, or stale clock-digit state was observed. Education clearly shows both content cards and Source Boundary in each viewport.

All **22 persisted activity inventories** were read and validated: eleven unique tests per project, all mask lists empty, all mutation-attempt lists empty, and only the two Clock tests carry clock receipts. All 22 attached JSON copies equal their persisted owners. Both Clock receipts exactly match `UTC`, `en-US`, install `2026-09-06T09:55:00.000Z`, pause `2026-09-06T10:00:00.000Z`, and `controlsSettleMs=1000`. Both images show `10:00 AM`, revealed controls, complete warm-brown/blue gradient backgrounds, and unmasked glyph glow/shadows. Exact final virtual time, control visibility/opacity, horizontal document overflow, and console/page-error absence are enforced by the unchanged passing spec; those assertions are not separate JSON fields, so their evidence is the passing run, not an invented inventory value.

Final external-read receipts contain **38 entries / 27 distinct sanitized request descriptions**, all GETs, with no query, fragment, username, password, Sentry endpoint, or unexpected origin. The earlier 44/33 receipt belongs only to the rejected pre-wait capture:

| Tests | Observed read-only requests | Source owner |
| --- | --- | --- |
| Chimer and Clock, both projects | One font GET each to `https://db.onlinewebfonts.com/t/8e22783d707ad140bffe18b2a3812529.woff2` (four entries total) | `app/globals.css` Digital font |
| Music desktop | Eight `media.massagelab.app/atmosphere/` sample-index JSON GETs | Existing station-carousel/provider prewarm and Generative.fm catalog/runtime |
| Music mobile | The same eight indexes plus 18 Opus sample GETs: aisatsana 9, day-dream 6, Observable Streams adaptation 3 (26 entries total) | Same opportunistic prewarm owners; payload progress can differ before context closure |
| Other sixteen tests | Empty external-read arrays | Observed empty, not assumed |

The eight indexes are `generative-fm/{aisatsana,at-sunrise,day-dream,eno-machine,lemniscate,peace,trees}/sample-index.opus.json` and `observable-streams-vsco-adaptation/sample-index.opus.json`, all beneath that existing media origin's `/atmosphere/` prefix. These are expected read-only font/media dependencies, not permission for provider mutation or proof of individual response contents.

Both final Chimer PNGs show the settled initial `00:00` setup with the guest notice absent. The desktop `1 Time` step and all five step tabs are unobscured; mobile `STEP 1 OF 5` / `Enter time` is fully visible. The spec observes the exact resolved guest notice inside the `Chimer setup` region, then polls for its DOM count to reach zero with a 12,000ms deadline. `app/chimer/set-timer.tsx` owns the normal 7,500ms visible interval and subsequent 420ms exit/unmount; reduced-motion CSS does not remove that final JavaScript unmount delay. Observing the resolved guest text first prevents an absent pre-hydration notice from being mistaken for completed dismissal. Waiting for unmount, rather than opacity alone, proves the normal lifecycle ended. No DOM hiding/removal, mask, settings mutation, arbitrary sleep, or Chimer clock emulation is introduced.

After unmount, the spec asserts the responsive source marker (`1 Time` desktop button or `Step 1 of 5` mobile text) is visible, inside the viewport, and contains the center-point hit-test result. These assertions passed in both projects, matching direct image inspection. The 12,000ms value is a bounded polling deadline with headroom beyond the source's 7,920ms lifecycle, not a fixed delay or a replacement lifecycle. Clock's separate pinned-time/control sequence, telemetry preflight, and first-hop zero-write contract are unchanged. Prior local focused checks passed 49/49. This inspection changed only documentation, not the spec or any snapshot.

Music intentionally clips neighboring carousel cards/category items inside horizontal scrollers. Longer shell pages show only their initial internal-scroll viewport (including partially visible lower account/Notes/Pricing/Support/Wellness content); no blanket full-content/no-clipping claim is made. No unexpected overlay, clipping artifact, or document-wide horizontal overflow is apparent within that scope, and all overflow assertions passed in the final capture. Pricing retains the empty-QA-target unavailable-price state.

Both inspected Clock PNG hashes differed from the earlier pre-wait capture while pinned digits/control state remained correct. The required repeat subsequently falsified background determinism: desktop Clock failed (21/22 tests passed), while mobile Clock and all other tests passed and all 24 baseline hashes were unchanged. The exact threshold-highlighted region is x=75–251, y=734–854 inclusive in the lower-left lamp field; the pure-white glyph/control pixel membership is identical between expected and actual. The field also visibly shifts outside this threshold-highlighted region. Its Clock inventory still has no masks/mutations, exact original time/control receipt, and only the expected font GET; no activity-related error is indicated.

The source mechanism is `lib/motion-preferences.js`: active `chimer-running` route ownership intentionally overrides the OS reduced-motion signal unless the explicit app preference is reduced. `components/moving-background.tsx` initializes eight canvas orbs using unseeded `Math.random()` and renders them through requestAnimationFrame. Pinning Date/timers does not seed those positions/colors' spatial distribution, and Playwright's CSS-animation suppression does not normalize canvas pixels. `app/globals.css` likewise exempts active Chimer from its generic OS-reduced fallback-drift rule. The explicit app preference is the existing owner that wins over both paths; no production repair or random-number override is needed. Local focused coverage is now 50 checks; corrected static-presentation capture evidence follows below, with repeat comparison still pending.

The coordinator was instructed to archive/remove the exact prior 24 PNGs and recapture all 24 coherently under the new Clock contract, rather than changing only desktop or loosening thresholds. The completed recapture below supersedes that pending instruction. All other surface readiness, source scope, telemetry, zero-write, and exact fixture-cleanup contracts remain unchanged.

### Accepted Reduced-motion source capture — 2026-09-06

The coordinator reports **22/22 passing tests and 24 fresh PNGs** under the explicit app Reduced-motion contract. Every PNG was individually viewed and all 22 persisted inventories plus their attached copies were validated again. The exact manifest names are present, twelve per project; desktop images are 1280×900 and mobile images 412×839. All 24 actual PNGs were byte-identical to their baselines. At that capture, the last-run receipt was `passed` with no failed tests or retained failure screenshot/error-context artifacts. This set is accepted as source-capture evidence within the documented initial internal-scroll viewport scope, not yet final Task 3 acceptance; the subsequent repeat/readiness correction is recorded below.

Both Clock images visibly show the source-owned static lamp: warm upper-left and blue upper-right radial light over a dark base, with no random orb field, exactly `10:00 AM`, complete digit glow/shadows, top controls/close button, and bottom minus/plus controls. The passing spec additionally proves the selected default ID, zero canvases, no mounted/pending effect, visible static underlay/gradient, and no gradient animation. Those DOM measurements are assertions, not separate inventory fields. Both Chimer images show `00:00`, clear desktop/mobile initial step markers, and no guest notice. All other surfaces render their expected source content. No blank/error/loading state or unexpected overlay/clipping/overflow artifact was observed; intentional Music scrollers and below-fold internal-scroll limitations remain as documented.

All mask and mutation-attempt arrays are empty. Only the two Clock inventories declare the exact new receipt: `UTC`, `en-US`, `ambientMotionMode: "reduced"`, `backgroundId: "massage-lab-moving-gradient"`, `backgroundPresentation: "static-fallback"`, install `2026-09-06T09:55:00.000Z`, pause `2026-09-06T10:00:00.000Z`, and `controlsSettleMs: 1000`. The passing run also enforces final virtual time `10:00:01`, control opacity/visibility, no browser console/page errors through closure, and horizontal document fit. Error arrays are not invented as persisted fields.

This capture has **44 external GET entries / 33 distinct sanitized descriptions**: four font reads (Chimer/Clock once per project), Music desktop eight indexes, and Music mobile 32 reads (the same eight indexes plus aisatsana nine, day-dream twelve, Observable Streams adaptation three Opus samples). The other sixteen tests have empty external-read arrays. Only the known `db.onlinewebfonts.com` font and `media.massagelab.app/atmosphere/` media paths occur; no query, fragment, credentials, Sentry endpoint, or unexpected origin. These counts are specific to this new capture, not the earlier coincidentally equal 44/33 receipt with a different sample mix. The exact descriptions and all 24 SHA-256 values are recorded in the Task 3 report.

Preserve this current 24-PNG set and run the existing fresh-child QA/telemetry-inert build/owned-server **22-test no-update comparison**. Do not delete or refresh these images unless new evidence requires a reviewed correction. This inspection ran no Git, browser, database, provider, fixture, or snapshot mutation.

### Route-owned readiness after strict-locator repeat failure — 2026-09-06

The next fresh-build no-update repeat passed **20/22 tests**. Desktop Clock failed before pause/capture because the document-wide `chimer-premium-background` locator matched two nodes; its error log identifies the active match inside the `Chimer clock` region. Mobile Pricing failed before capture because the document-wide donation-form locator matched two nodes, with a hidden match reported while waiting. Both error contexts and failure screenshots were inspected. Clock shows the expected static lamp at the pre-pause `09:55 AM`; Pricing shows normal mobile membership content. These are readiness failures, not pixel mismatches. The artifacts do not establish what created the extra nodes, and no producer cause is assumed.

The parity owner now requires one accessible exact `Chimer clock` region, one background host within it, and one current-time display within it; the reveal action is scoped to that region too. `app/chimer/running-timer.tsx` owns all these descendants. Its separate `ImmersivePanelShell` portal remains outside the region: require one visible exact `Immersive display controls` group and one visible `[data-immersive-shell]` root containing it, retaining opacity `1`. Pricing readiness uses the one visible `#one-time-support` AppSurface from `app/pricing/page.tsx`, then requires exactly one visible native donation form within it. `AppSurface` forwards that ID to its card, and `DonationCheckoutForm` owns the form. Multiple visible owners still fail; no `.first()`/`.nth()` or arbitrary delay is introduced.

This test-only targeting correction does not change selected settings, Clock time/glow/background/control state, Chimer lifecycle, screenshot options, masks, or thresholds. All 24 inspected Reduced-motion baseline SHA-256 hashes remain unchanged. **Retain all 24; no recapture is required for this locator-only correction.** Run the full 22-test no-update comparison again under the existing fresh-build/QA/telemetry/owned-server gate. Task 3 remains needs-verification until it passes; do not update snapshots to dismiss a mismatch.

All 22 failed-repeat inventories have empty masks/mutation arrays. Only mobile Clock has the exact complete Clock receipt; desktop correctly has none because it failed before the receipt boundary. External activity is **105 GET entries / 79 distinct sanitized descriptions**: four known font reads, Music desktop 78 media reads and mobile 23, other sixteen tests zero. Only known font/media paths occur, without query/fragment/credentials/Sentry. This is a distinct failed-repeat receipt, not a replacement for the accepted capture's 44/33 external-read receipt. A new focused source-owner/uniqueness contract test raises local coverage to **51 checks**; browser correction remains pending the coordinator's repeat.

### Home first-frame determinism after pixel repeat failure — 2026-09-06

The next full repeat passes the corrected Clock/Pricing and every other non-Home test (**20/22 total**). Only Home fails: four desktop/five mobile counted pixels. Original-resolution expected/actual/diff images place every counted pixel on the left edge of the hero `Create a free account` CTA's MetalFx ring, not text or wordmark. Zero-based PNG coordinates: desktop `(84,788)`, `(84,796)`, `(84,797)`, `(84,798)`; mobile `(16,684)`, `(16,692)`, `(16,693)`, `(16,694)`, `(20,714)`. Maximum raw channel changes are 68/69; the exact RGBA receipt is in the Task 3 report. This is not assumed to be generic anti-aliasing. Desktop has 544 >1-level changed ring pixels plus eight isolated 2-level pixels elsewhere; mobile has 538 >1-level ring changes. Remaining raw changes are one channel level, below the unchanged comparator threshold. The default comparator already excludes antialiased pixels, marking 39/35 ring-edge pixels yellow separately from the 4/5 red failures.

The source owner is `MetalAttentionRing`: it starts playing, then its reduced-motion effect changes to paused. Installed `metal-fx` freezes the last copied 2D canvas frame and explicitly gives already-paused instances one initial copy; its shared shader phase uses elapsed `performance.now()`. Thus a stable paused image can retain a different shader frame across loads. CSS-animation suppression, font readiness, or a longer wait cannot reset that copied frame. Fonts/content/wordmark geometry are stable in the artifacts; Home uses the local Next Inter font and priority local PNG, FlipWords' reduced-motion branch retains `therapists`, and ambient reduced-motion CSS stops the background animation. No safe tolerance ceiling was established, so none is requested or added.

The attempted single pre-navigation `pauseAt` / zero-performance / 80ms-first-frame setup is **disproved by the actual browser run**. Desktop reports `performance.now() === 101`, not zero; mobile passes the zero check but its upstream inline first-copy visibility stays `hidden` after the 80ms advance for the full 7,500ms assertion timeout. No Home screenshot or complete Home receipt was written. The passing 53-check local suite included a GPU-stubbed controller/selection model that omitted injected clock resume, native observer delivery, and actual React/renderer mounting; it is not proof of this browser contract. No replacement Home timing contract is accepted yet.

After the coordinator's ownership-checked removal of those two old Home files, the missing-only attempt passed the other **20/22 tests** and retained all **22 non-Home hashes unchanged**; both Home PNGs remain absent. Read-only inspection confirms 22 persisted inventories and their matching attachments, empty masks/mutations, both exact Clock receipts, no Home receipts, and **23 expected sanitized GET entries / 12 distinct descriptions**: four font reads, eight Music desktop indexes, and eight Music mobile indexes plus three aisatsana samples (`a0`, `c-sharp1`, `f1`). Every other journey, including Home, has zero external reads. No URL query, fragment, credentials, Sentry, or unexpected origin is recorded. The older 26/15 receipt belongs to the preceding pixel-comparison run.

Playwright 1.60's installed implementation injects a resumed real-time driver before navigation log replay; the replay `pauseAt` branch changes wall time but does not reset monotonic ticks. A driver wake before first replay can therefore preserve 101 ticks. Merely adding `install` before the pre-navigation pause also preserves the real gap between those separate log entries. MetalFx 1.0.4 separately gates copies on its native IntersectionObserver and queues resizing through rAF; computed wrapper visibility is not its first-copy signal because app CSS forces the wrapper visible. The current artifacts do not identify which observer/frame ordering prevented the mobile copy, so that cause remains unproven.

The coordinator authorized ignored diagnostics under `.superpowers/sdd/2026-09-06-atmoshaper-repository-migration/` before selecting another tracked contract. C stopped at an outdated Tools heading role. D's frozen first client transition committed URL/same Document but failed to mount Home in four desktop observations. E passed ten observations only by allowing conditional pre-mount progress, yielding two shader phases: mount/copy at 300000/300016 or 300300/300304. F's warm Home visits and actual teardown were valid, but the Back readiness locator crossed route-title and body-level announcement ownership; all ten stopped before a frozen remount. The correction scopes Tools to LayoutWrapper's unique `main .ml-app-content`, without first/nth or text-exception rules. Next's source establishes a body-level shadow announcer that also publishes document.title; F did not persist matching runtime node identities, so that particular node attribution remains an inference. These rounds are diagnostic history, not accepted screenshots.

### G-proven warm-cache/remount Home contract — 2026-09-06

Terminal diagnostic G passed the coordinator's target verification, fresh build and **10/10 tests in 28.8s**. Every primary receipt matches its attachment. All five repetitions per viewport record complete retirement of both warmed MetalFx roots, zero roots on restored Tools, exact pause at performance **300000** / **2026-09-06T10:00:00.000Z**, zero pre-mount clock advances, both new roots mounted at that same frozen time, delivered native owner intersection, and hidden/transparent pre-copy state. First actual paint is at **300016** and remains byte-identical through every sampled 16ms boundary to **300512**:

| Viewport | Actual canvas | Nontransparent pixels | First-copy and retained RGBA SHA-256 |
| --- | --- | --- | --- |
| Desktop | 215x46 | 670 | `3240c273e2e44528f31c23a42dc7dd0268aa61fccc52efbab8d0aec78a8855ab` |
| Mobile | 564x121 | 4,898 | `1794ab023393a430d0ac88adb47fbadde69a16ed9bed4f2192d3e1dbd6df215b` |

These hashes match D's successful and E's early cohorts, not E's delayed phase. Warm-up timings vary, but the post-teardown origin/first-copy phase does not. All ten G observations have **zero browser mutation attempts, external reads, console/page errors, dropped events, screenshots and fixture operations**. No source PNG was created by G. Preserved C–G evidence and the 22 non-Home baseline hashes remain unchanged.

The tracked Home test now uses this observed sequence: official clock installed at 09:55; actual Tools -> Home link while running; decoded assets/fonts, unique hero/ring, reduced-motion therapists/paused state and visible actual warm paint; real Back to structurally scoped Tools in the same document; zero DOM roots plus both native observer cleanups for every warm instance; pause at 10:00; cached same-document Home remount with all new native observer registrations at frozen 300000 and no pre-mount clock progression. It waits for MetalFx's own 64px intersection callback, asserts upstream hidden/transparent state, and samples all 32 official 16ms steps, requiring first paint immediately at 300016 and one identical canvas hash through 300512 before the unmodified screenshot comparison. Only native observer state needed for readiness/cleanup is retained; the diagnostic event/rAF/timeout logger is not promoted. No production app behavior, reduced-motion preference, image, mask or pixel threshold is changed.

Home inventories now carry install/pause times, pausedPerformanceMs=300000, frameStepMs=16, frameSteps=32, paused motion state, actual warm/retired/remount counts, and first/final paint receipts (clock, dimensions, expected dimensions, real nontransparent count, SHA-256, inline visibility, native opacity and paused state). Full diagnostic logs and image bytes are not persisted in parity. The obsolete 0/80ms assumption and misleading local-model claim are removed; focused regression coverage is **54 checks**. Helpers remain in the existing spec/harness, so this correction required no additional path owner; the later Task 4A contract below supersedes the interim manifest counts.

The first full tracked adoption used two workers and passed 20/22; both Home tests completed warm-up and teardown but stalled at the second frozen remount (prepareHomeCapture line 279). The coordinator then ran the **unchanged tracked Home tests with one worker** into a protected ignored output directory with snapshot updates disabled. Both reached captureSurface and failed only for the intentionally absent expected PNGs. Their complete Home receipts match G exactly: warm/retired/remount counts 2/2/2, first paint 300016, final paint 300512, the same desktop/mobile hashes above, real pixels/geometry, visible/paused state and opacity 0.72. Both inventories have zero external reads, mutation attempts and masks. No baseline was created. This isolates the migration execution contract rather than requiring another clock or observer change.

The canonical `playwright.config.ts` now uses **one worker for exact migration parity invocations**, retaining the existing worker default for ordinary runs and one worker for CI. The same exact-path matcher owns migration serialization and fresh-server selection; source capture, missing-only capture, repeat and destination comparison inherit it without an ad hoc CLI flag. Focused coverage remains 54 checks, expanded to exercise the actual worker expression with exact/non-exact invocation variants and CI values. Manifest paths/counts remain unchanged because this config already belongs to replacePaths/overlayPaths. No wait, clock progression, pixel assertion, app behavior or snapshot was changed by this repair.

**Historical Home reopening gate, now completed:** serialized missing-only capture created the two Home PNGs while preserving the other 22. Their full-image and Home-receipt review is followed by the final accepted full repeat below. No H was required or authorized; a future timing recurrence returns to coordinator review rather than adding a fallback.

### Profile form metadata spacing: proven defect and reviewed repair

After the serialized source capture created both Home images, the next fresh-build repeat exposed a mobile account-profile difference of 3,834 pixels: visible fields were exactly 20px higher while page/Card headers and navigation aligned. All 24 baseline hashes remained unchanged. The five ignored profile-layout-1 mobile receipts and matching attachments prove the spacing source: every HTML-arrival sample includes a direct type=hidden/display:none child without [hidden], so space-y-5 gives the following first grid margin-top:20px. Repetitions 0/2/4 remove it before visible nonzero geometry and settle at grid y341/label y345 with margin0; repetitions 1/3 retain it through all 180 observed frames and settle at y361/y365 with margin20. CardContent padding-top remains 0px. Early streamed samples have zero bounds and are not represented as visible geometry. All five receipts report cleanup=true and zero mutations/external reads/browser errors/screenshots/drops; coordinator SQL independently confirms zero synthetic fixture users.

The coordinator-approved product correction changes only ProfileTab's server-action form from space-y-5 to grid gap-5, with justify-self-start preserving the existing Save profile button's content width. Layout gaps ignore display:none metadata naturally, retain 20px between visible children and remove the accidental leading gap without depending on framework-private names or hydration timing. The canonical account-page-tabs test checks this exact owner and preserves the button sizing contract. Shared form/Card behavior, actions, fixture safety, inner field layouts and parity thresholds remain unchanged. These two source-present files remain declared replacements and overlays within the current omit1/replace43/task5Add47/task6Add6/overlay85 contract; totals are source1856/Task51902/final1908. Current local verification requires 63 migration-harness plus 34 account/form checks.

**Source baseline choice accepted after visual review:** both old Profile images recorded the extra leading gap. The post-fix no-update comparison failed only those two (desktop 11,348 pixels; mobile 3,834), and coordinator review confirmed precisely the 20px correction, preserved Save button content width and unchanged card/header/navigation. A fresh-build, exact signed-in-test refresh passed 2/2 using changed-only updates: exactly the two Profile PNGs changed, while both Security and all other 20 images retained their hashes. The no-leading-gap state is canonical; no pt-5 compensation, DOM mask, sleep or tolerance is introduced.

### Final accepted Task 3 source parity — 2026-09-07

The final fresh-build full no-update comparison **passed 22/22**. All **24 accepted PNG hashes remained unchanged during that repeat**, and test-results contains no failure screenshot/diff/error-context artifact; its last-run status is passed with no failed tests. The coordinator visually inspected both refreshed Profile images and accepts the corrected layout. Accepted Profile files:

| PNG | Bytes | SHA-256 |
| --- | ---: | --- |
| account-profile-desktop-chromium-win32.png | 130305 | D13936F708A17851088B2C5A20A281FF5C64E17DA67A8BB3C33F8C2F699E4A08 |
| account-profile-mobile-chromium-win32.png | 58169 | D93DFE8F511AAC63EB21EA127AA9ACBD5F5B871CFCE3FA14FE4AA43FBD9D425B |

All 22 canonical inventories equal their attachments: 11 tests per project, zero mutation attempts/masks, two complete static-fallback Clock receipts and two complete G-matching Home receipts. External reads are **68 GET entries / 57 distinct sanitized descriptions**: four font reads, Music desktop eight indexes, Music mobile eight indexes plus 48 Opus samples (aisatsana18/day-dream18/Observable Streams12). The other sixteen tests have empty read arrays. Only db.onlinewebfonts.com and the existing media.massagelab.app/atmosphere paths occur, without query/fragment/credentials. These counts supersede earlier run-specific read summaries, not the underlying read-only dependency contract. Coordinator SQL confirms synthetic fixture count0 after the failed compare, targeted refresh and final repeat.

Task 3 implementation/source-capture/repeat evidence and its coordinator-owned commit are accepted. Its no-further-refresh instruction is superseded only by the Task 4A Pricing amendment below. Broader source-baseline and destination gates remain Tasks 4/7. The machine manifest remains the exact path-only contract, with no acceptance metadata added: omit1/replace43/task5Add47/task6Add6/overlay85; totals source1856/Task51902/final1908.

**Task 4A Pricing-only parity acceptance — 2026-09-08:** the shared fail-closed Browser-QA environment forces `MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED=true`, while Pricing application source remains unchanged. The controlled changed-only refresh passed **2/2** and changed exactly `pricing-desktop-chromium-win32.png` and `pricing-mobile-chromium-win32.png`; the other 22 PNGs stayed byte-identical. Accepted Pricing evidence is desktop **167815 bytes**, SHA-256 `6cadc650bc1e88608e822ad9dc1daf56fca9d995ce48484c088efc8dae54f437`, and mobile **102456 bytes**, SHA-256 `6cee3ef80384efad6d63dccaf42597cc14c401de9620218b9f6b81fe903c05ba`. Visual review confirmed only the neutral paused-checkout banner/state and the resulting downstream content shift, without clipping or unrelated visual change.

The fresh-build no-update parity confirmation passed **22/22 in 1.3m**, with post-run hashes stable **24/24**. The last-run receipt is passed and has no failed tests or failure artifacts. Its 22 inventories divide 11 per project and contain read-only external activity of **29 GET entries / 18 distinct sanitized descriptions**, zero mutation attempts, zero masks, two Clock receipts, and two Home receipts. Disposable database fixture counts were zero before deletion. The temporary empty QA project was deleted and verified absent; the production project remains present and untouched, with no project identifiers, URLs, credentials, or secrets recorded here. The two Pricing PNGs remain source-absent `task5AddPaths` and `overlayPaths`, so omit1/replace43/task5Add47/task6Add6/overlay85 and source1856/Task51902/final1908 remain unchanged. This receipt accepts only Task 4A source Pricing parity and makes no destination or Phase 2 acceptance claim.

Task 4A's full source QA exposed baseline blockers in the ordinary Browser-QA environment, authenticated fixture isolation, connected Admin-action rendering, carousel synchronization, homepage measurement readiness, and affected acceptance contracts. The reviewed preparation branch therefore carries 33 additional source-present replacements and ten source-absent helpers/tests as exact overlays. The locked source SHA remains `fa78ca01a42179329cc223df77c76f308e76320b`; Task 5 must overlay these 43 paths rather than silently exporting their old source versions. This hardening changes no provider configuration, schema, migration, or rebrand behavior.

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

The following JSON is the same ordered path contract as [the machine-readable manifest](atmoshaper-export-manifest.json). Paths are normalized files, not globs. Arrays are code-point sorted and duplicate-free. Source present: one omitted, 43 replaced. Source absent: 47 Task 5 additions and six Task 6 additions. Source-present replacements add no destination paths; the ten new Task 4A helpers/tests account for the path-total increase.

`Task5Paths = (SourcePaths - omitPaths) union task5AddPaths` gives **1,902** paths.
`FinalPaths = Task5Paths union task6AddPaths` gives **1,908** paths.
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
    ".github/workflows/ci.yml",
    "AGENTS.md",
    "README.md",
    "app/account/page.tsx",
    "app/admin/users/[userId]/credit-action-form.tsx",
    "app/admin/users/[userId]/role-change-form.tsx",
    "app/admin/users/[userId]/security-action-forms.tsx",
    "app/admin/users/[userId]/temporary-access-form.tsx",
    "components/carousels/adaptive-carousel-model.js",
    "components/carousels/use-adaptive-carousel-controller.ts",
    "docs/project-log.md",
    "docs/project-state.md",
    "lib/admin/browser-qa-authorization.ts",
    "lib/auth/browser-fixture-records.ts",
    "next.config.mjs",
    "package.json",
    "playwright.config.ts",
    "scripts/build-browser-qa.mjs",
    "tests/account-page-tabs.test.mjs",
    "tests/admin-background-credit-ui.test.mjs",
    "tests/admin-billing-goodwill-ui.test.mjs",
    "tests/admin-role-ui.test.mjs",
    "tests/admin-security-ui.test.mjs",
    "tests/admin-temporary-access.test.mjs",
    "tests/admin-user-operations-fixture.test.mjs",
    "tests/browser-qa-database-target.test.mjs",
    "tests/browser-qa-harness.test.mjs",
    "tests/browser/admin-user-operations-fixture.ts",
    "tests/browser/admin-user-operations.spec.ts",
    "tests/browser/background-carousel-preview.spec.ts",
    "tests/browser/background-commerce.spec.ts",
    "tests/browser/identity-method-safety-fixture.ts",
    "tests/browser/identity-method-safety.spec.ts",
    "tests/browser/interaction-feedback.spec.ts",
    "tests/browser/membership-return-status-fixture.ts",
    "tests/browser/membership-return-status.spec.ts",
    "tests/browser/music-visualizer.spec.ts",
    "tests/browser/native-submission-snapshot.ts",
    "tests/browser/public-routes.spec.ts",
    "tests/browser/signed-in-session-cookie.ts",
    "tests/carousel-lab-source.test.mjs",
    "tests/home-flip-words.test.mjs",
    "tests/rsc-session.test.mjs"
  ],
  "task5AddPaths": [
    "MIGRATION_LINEAGE.md",
    "app/admin/users/[userId]/use-pending-action-render-nudge.ts",
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
    "lib/auth/browser-user-fixture.ts",
    "scripts/browser-qa-environment.mjs",
    "scripts/run-migration-parity-browser-qa.mjs",
    "tests/admin-action-render-nudge.test.mjs",
    "tests/admin-temporary-access-browser-guard.test.mjs",
    "tests/browser-qa-environment.test.mjs",
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
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/wellness-mobile-chromium-win32.png",
    "tests/browser/signed-in-user-fixture.ts",
    "tests/migration-parity-browser-runner.test.mjs",
    "tests/task-4a-browser-harness-contract.test.mjs"
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
    ".github/workflows/ci.yml",
    "app/account/page.tsx",
    "app/admin/users/[userId]/credit-action-form.tsx",
    "app/admin/users/[userId]/role-change-form.tsx",
    "app/admin/users/[userId]/security-action-forms.tsx",
    "app/admin/users/[userId]/temporary-access-form.tsx",
    "app/admin/users/[userId]/use-pending-action-render-nudge.ts",
    "components/carousels/adaptive-carousel-model.js",
    "components/carousels/use-adaptive-carousel-controller.ts",
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
    "lib/admin/browser-qa-authorization.ts",
    "lib/auth/browser-fixture-records.ts",
    "lib/auth/browser-user-fixture.ts",
    "next.config.mjs",
    "package.json",
    "playwright.config.ts",
    "scripts/browser-qa-environment.mjs",
    "scripts/build-browser-qa.mjs",
    "scripts/run-migration-parity-browser-qa.mjs",
    "tests/account-page-tabs.test.mjs",
    "tests/admin-action-render-nudge.test.mjs",
    "tests/admin-background-credit-ui.test.mjs",
    "tests/admin-billing-goodwill-ui.test.mjs",
    "tests/admin-role-ui.test.mjs",
    "tests/admin-security-ui.test.mjs",
    "tests/admin-temporary-access-browser-guard.test.mjs",
    "tests/admin-temporary-access.test.mjs",
    "tests/admin-user-operations-fixture.test.mjs",
    "tests/browser-qa-database-target.test.mjs",
    "tests/browser-qa-environment.test.mjs",
    "tests/browser-qa-harness.test.mjs",
    "tests/browser/admin-user-operations-fixture.ts",
    "tests/browser/admin-user-operations.spec.ts",
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
    "tests/browser/atmoshaper-repository-migration-parity.spec.ts-snapshots/wellness-mobile-chromium-win32.png",
    "tests/browser/background-carousel-preview.spec.ts",
    "tests/browser/background-commerce.spec.ts",
    "tests/browser/identity-method-safety-fixture.ts",
    "tests/browser/identity-method-safety.spec.ts",
    "tests/browser/interaction-feedback.spec.ts",
    "tests/browser/membership-return-status-fixture.ts",
    "tests/browser/membership-return-status.spec.ts",
    "tests/browser/music-visualizer.spec.ts",
    "tests/browser/native-submission-snapshot.ts",
    "tests/browser/public-routes.spec.ts",
    "tests/browser/signed-in-session-cookie.ts",
    "tests/browser/signed-in-user-fixture.ts",
    "tests/carousel-lab-source.test.mjs",
    "tests/home-flip-words.test.mjs",
    "tests/migration-parity-browser-runner.test.mjs",
    "tests/rsc-session.test.mjs",
    "tests/task-4a-browser-harness-contract.test.mjs"
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
