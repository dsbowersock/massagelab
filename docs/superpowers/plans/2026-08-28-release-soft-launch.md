# Exact-Head Release and Soft-Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the exact combined readiness candidate, establish production-safe operations, and guide three to five trusted people through a monitored live family-and-friends launch.

**Architecture:** Treat local/CI validation, production configuration, migration/deployment, and real-user rollout as separate gates with separate evidence and authorization. Maintain one sanitized exact-head receipt and one operator runbook; open forwarding only after the initial cohort completes a 48-to-72-hour technical safety window without a pause condition.

**Tech Stack:** Git/GitHub CI, Node.js 24, Prisma 7/Neon, Next.js 16/Playwright 1.60, Vercel, Auth.js/Google OAuth, SMTP delivery, Stripe, Cloudflare R2, Sentry, and repository canonical documentation.

**Spec:** `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`

## Global Constraints

- Execute only after the reviewed identity, subscription, feedback, and server/cost heads are stacked into one exact candidate.
- The first audience is three to five known adults. Ask them not to forward the site during the first 48 to 72 hours.
- Supported tester scope is general-user accounts, free features, Clock/Chimer, Music/Atmosphere, Education, Wellness, account settings, and Supporter membership.
- Do not ask testers to use administration, provider setup, booking payments, hosted clinical sync, real client records, or PHI-bearing workflows.
- Early engagement, delayed return, free-only use, and low subscription conversion are not technical failures.
- Test-mode Stripe owns destructive/failure-path coverage. Existing successful live subscription evidence is accepted and must not be repeated merely for ceremony.
- A push/PR, main update, migration application, deployment, provider-setting change, synthetic provider event, Portal-session smoke, live charge, refund, or cancellation requires exact authorization at its gate. If read-only Vercel evidence proves that updating `main` automatically deploys Production, the plan treats that physical action as one explicitly named coupled repository/deploy mutation rather than pretending it can be split.
- Read-only production checks may inspect status/configuration but never print or record secrets, provider payloads, database rows, account/customer IDs, email addresses, payment details, or tester journeys.
- Production migration application precedes deployment of code that requires the additive identity/membership schema. Vercel's read-only production migration gate must then pass.
- Existing login, recovery, subscription access, purchases, and Portal availability remain protected during registration or Checkout pause.
- Monitoring is aggregate and operational. Do not add analytics, session replay, screenshots, individual page histories, IP identity, or PHI.
- A launch receipt describes only the exact commit and evidence actually observed; historical proof is labeled historical.
- Use anonymous labels `Tester A` through `Tester E`; never record their email, Google identity, payment/customer identifiers, or private content.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `docs/wiki/family-friends-operations.md` | Account/payment incident runbook, pause controls, first-cohort checklist, monitoring cadence, and sharing gate. |
| `docs/audits/2026-08-28-family-friends-release-readiness.md` | Sanitized exact-head validation, production-readiness, and rollout receipt. |
| `docs/wiki/release-checklist.md` | Links the exact receipt/runbook and reconciles the current launch gate. |
| `docs/wiki/deployment.md` | Confirms migration/deployment order and provider read-only verification boundary. |
| `docs/alpha-qa.md` | Adds the small general-user guided matrix without broadening PHI/admin scope. |
| `docs/project-state.md` | Canonical current readiness/deployment/rollout state after evidence exists. |
| `docs/project-log.md` | Chronological exact-commit, gate, authorization, and rollout history. |

## Evidence states

Every receipt row uses one of these exact states:

- `PASS` — executed against the named exact commit/environment and passed.
- `FAIL` — executed and did not meet the gate.
- `NOT RUN — authorization required` — would cause an external mutation or live-provider action.
- `NOT RUN — access unavailable` — read-only evidence could not be obtained with available operator access.
- `HISTORICAL` — useful prior evidence that does not prove this exact candidate.
- `NOT APPLICABLE` — outside the approved first-cohort scope, with a written reason.

Only PASS satisfies a current gate. Historical evidence can reduce unnecessary repetition but cannot be relabeled PASS for changed code.

---

### Task 1: Create the runbook and exact-head receipt structure

**Files:**
- Create: `docs/wiki/family-friends-operations.md`
- Create: `docs/audits/2026-08-28-family-friends-release-readiness.md`
- Modify: `docs/wiki/index.md`

**Interfaces:**
- Runbook owns symptom-first diagnosis and pause actions.
- Receipt owns exact commit/environment/results and uses only the evidence states above.
- Neither file contains credentials, raw provider output, database rows, identifiers, or tester personal data.

- [ ] **Step 1: Write the operator runbook**

Create sections with exact symptom/first-check/escalation boundaries for:

1. cannot register;
2. verification or reset message absent;
3. cannot sign in with password or Google;
4. matching Google account cannot connect;
5. paid but feature remains locked;
6. subscription status is stale/contradictory;
7. pause new registration;
8. pause new Supporter Checkout;
9. resume either path after verification; and
10. privacy/security incident or widespread outage.

For each, begin with read-only checks, use coarse error/time counts, avoid account rows/addresses, and state when an exact production/provider mutation requires authorization. Include the exact pause flags:

```text
MASSAGELAB_PUBLIC_REGISTRATION_PAUSED=true
MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED=true
```

State that changing either Vercel value and redeploying is an external mutation requiring authorization; setting a flag does not itself revoke existing access.

- [ ] **Step 2: Add the guided tester checklist and monitoring cadence**

The runbook includes a 10-to-15-minute checklist and anonymous matrix:

```text
Tester A: email/password registration, verification, logout/login, one free feature
Tester B: first-time Google registration, logout/login, Music or Atmosphere
Tester C: password reset, Clock/Chimer, account setting save
Tester D: matching-email link flow if naturally applicable; otherwise another device/browser
Tester E: voluntary Supporter subscription only if desired; otherwise free/Portal-status observation
```

No one is asked to create a redundant charge. During the first 48 to 72 hours, check auth/mail failures, webhook/entitlement mismatch, 5xx errors, Neon/Vercel/R2 usage, Sentry issues, and support messages at least morning and evening. Record aggregate counts only.

- [ ] **Step 3: Create the exact-head receipt**

Include tables for:

- repository branch/commit/clean status;
- Prisma validate/generate, typecheck, lint, complete Node tests, production build, diff check, focused browser specs, and full browser lanes;
- migration list/status;
- deployed commit and canonical alias;
- Google, SMTP, Stripe, Neon, Vercel/WAF/spend, R2, and Sentry read-only checks;
- registration/Checkout pause proof;
- desktop/mobile/slow-network/accessibility matrix;
- historical live subscription evidence clearly labeled HISTORICAL;
- external actions and their exact authorization state;
- Tester A–E technical results without identities; and
- go/pause decision and 48-to-72-hour window timestamps.

Initialize each row truthfully from current execution. Do not insert unresolved placeholder markers, fake PASS, invented provider settings, or empty success claims. Before a check runs, use the appropriate NOT RUN state.

- [ ] **Step 4: Link the runbook from the wiki index**

Add one concise operations entry to `docs/wiki/index.md` and preserve the canonical state/log routing instructions.

- [ ] **Step 5: Verify and commit the operational skeleton**

```bash
rg -n "PASS|FAIL|NOT RUN|HISTORICAL|MASSAGELAB_PUBLIC_REGISTRATION_PAUSED|MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED|Tester [A-E]" docs/wiki/family-friends-operations.md docs/audits/2026-08-28-family-friends-release-readiness.md
rg -n "replace-me|pending-marker|example-only|customer_|cus_|sub_|price_|@" docs/wiki/family-friends-operations.md docs/audits/2026-08-28-family-friends-release-readiness.md
git diff --check
git add docs/wiki/family-friends-operations.md docs/audits/2026-08-28-family-friends-release-readiness.md docs/wiki/index.md
git commit -m "docs: add family launch operations and receipt"
```

Expected: first search finds required states/controls; second finds no placeholders or provider/email-like identifiers; diff check passes.

---

### Task 2: Prove the exact candidate locally

**Files:**
- Modify: `docs/audits/2026-08-28-family-friends-release-readiness.md`

**Interfaces:**
- Consumes: exact stacked candidate.
- Produces: local validation rows tied to one full commit hash.

- [ ] **Step 1: Verify candidate identity and cleanliness**

```bash
git branch --show-current
git rev-parse HEAD
git status --short --branch
git diff --check
```

Expected: branch `codex/family-friends-release-proof`, a full commit hash, no uncommitted paths, and no diff-check output. Record branch and full hash; if dirty, stop and determine ownership rather than cleaning unrelated work.

- [ ] **Step 2: Run schema and generated-client gates**

```bash
npm run prisma:validate
npm run prisma:generate
```

Expected: PASS. Record command, result, and candidate hash, not generated file contents or connection information.

- [ ] **Step 3: Run static and complete Node gates**

```bash
npm run typecheck
npm run lint
npm run test
```

Expected: PASS. Record exact test totals and intentional skips from output; do not suppress or reclassify failures.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: PASS and the production route manifest includes launch-critical routes without a diagnostic-only production route. Record page count/build result without environment values.

- [ ] **Step 5: Run focused readiness browser specs**

```bash
npm run build:browser-qa
npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/membership-return-status.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/membership-return-status.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=mobile-chromium
```

Expected: PASS for identity, persisted membership return, throttled feedback, desktop, and mobile.

- [ ] **Step 6: Run all browser lanes**

```bash
npm run build:browser-qa
npm run test:browser
```

Expected: PASS across every ordinary project/spec pair, including desktop/mobile public, app shell, music, Chimer-related, local-first, background commerce, identity, membership, and interaction coverage. The focused identity/membership database-backed rows also require the documented disposable local QA database opt-in and exact fixture cleanup; never point that fixture at Production.

- [ ] **Step 7: Record workload and pause evidence**

Run the same production build/server shape for both sets:

```bash
npm run readiness:timings -- --base-url=http://127.0.0.1:3010 --samples=3
node --test tests/background-credit-service.test.mjs tests/auth-session-feature-keys.test.mjs tests/public-launch-controls.test.mjs tests/membership-checkout-route.test.mjs tests/auth-registration.test.mjs
```

Expected: sanitized first/warm route lines and PASS proving no auth-refresh credit repair, session feature-key reuse, and independent pauses. Record results without individual requests.

- [ ] **Step 8: Update and commit the local receipt**

Change only observed local rows from NOT RUN to PASS/FAIL, include the exact candidate hash, and label prior live billing proof HISTORICAL. Then:

```bash
git add docs/audits/2026-08-28-family-friends-release-readiness.md
git commit -m "docs: record exact-head local readiness proof"
```

The receipt commit changes HEAD. Record both the tested code parent and the docs-only receipt commit, and rerun `git diff --check`; no application artifact changed between them.

---

### Task 3: Obtain hosted CI review without authorizing merge or deploy

**Files:**
- Modify: `docs/audits/2026-08-28-family-friends-release-readiness.md`

**Interfaces:**
- Produces: hosted check URLs/results tied to the pushed exact commit.
- Does not authorize merge, migration, deployment, or provider changes.

- [ ] **Step 1: Stop for push/PR authorization**

Present the exact branch, commit, local validation receipt, and intended remote branch. Request authorization for only the Git push and PR creation/update. If not authorized, retain `NOT RUN — authorization required` and stop this task without calling the release ready.

- [ ] **Step 2: Push/create PR only after approval**

Use non-force push and a PR description that names the five workstreams, migrations, exact gates, production mutations still excluded, and rollback compatibility. Do not merge.

- [ ] **Step 3: Wait for and inspect hosted checks**

Use GitHub's check view for the exact commit. Require Code quality, Browser build, all four Browser QA lanes, and aggregate `qa` to succeed. Inspect any failure at its failing step; do not rerun until its cause is understood.

- [ ] **Step 4: Perform code review against the approved spec**

Verify review comments against current code. Resolve supported findings with focused tests and new commits, then rerun the exact local/hosted affected gates. Rejected findings receive evidence. All actionable review threads must be resolved before the candidate can advance.

- [ ] **Step 5: Update the hosted receipt**

Record exact commit, run IDs/URLs, check conclusions, review status, and any newer commit invalidating earlier local evidence. If code changed, rerun Task 2 for the new exact head.

---

### Task 4: Complete read-only production prerequisites

**Files:**
- Modify: `docs/audits/2026-08-28-family-friends-release-readiness.md`

**Interfaces:**
- Produces: presence/status evidence only, never secret values or provider/customer rows.
- Identifies exact pending mutations for the next gate.

- [ ] **Step 1: Verify normalized-email and migration posture read-only**

With the direct production maintenance URL supplied only through `$env:MASSAGELAB_PRODUCTION_DIRECT_URL` outside the repository, run this exact PowerShell read-only gate:

```powershell
$collisionExit = 0
$migrationStatusExit = 0
try {
  $env:AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL = $env:MASSAGELAB_PRODUCTION_DIRECT_URL
  $env:DIRECT_URL = $env:MASSAGELAB_PRODUCTION_DIRECT_URL
  $env:VERCEL_ENV = "production"
  npm run auth:check-normalized-emails
  $collisionExit = $LASTEXITCODE
  if ($collisionExit -eq 0) {
    npm run production:migrations:check
    $migrationStatusExit = $LASTEXITCODE
  }
} finally {
  Remove-Item Env:AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
  Remove-Item Env:VERCEL_ENV -ErrorAction SilentlyContinue
}
if ($collisionExit -ne 0) { exit $collisionExit }
Write-Output "migration_status_exit=$migrationStatusExit"
```

Record only `normalized_collision_count=0`, `migration_status_exit`, and applied/pending migration names/counts. A nonzero migration status is expected only when the output names exactly the two reviewed pending additive migrations; an unknown status failure or an additional migration is a stop. Never echo the source environment variable.

Do not run `prisma migrate deploy` in this task.

- [ ] **Step 2: Verify Google OAuth configuration read-only**

Confirm the production app is externally usable, branding/publishing state is appropriate, scopes are minimal, authorized domains are correct, and the exact production callback URI matches Auth.js. Record booleans/status only—no client ID/secret. A setting change is a later authorized action.

- [ ] **Step 3: Verify email delivery posture read-only**

Confirm sender/domain presence, SPF, DKIM, DMARC posture, recent aggregate delivery/bounce/complaint health, provider quota/rate posture, and the production sender identity shown to users. Do not send a synthetic message or record recipient/provider message IDs in this task.

- [ ] **Step 4: Verify Stripe live configuration read-only**

Use the existing GET-only readiness command with a secret file path supplied through `MASSAGELAB_PRODUCTION_ENV_FILE` outside the repository:

```powershell
npm run stripe:readiness -- --env-file="$env:MASSAGELAB_PRODUCTION_ENV_FILE" --live --verify-stripe
```

Expected: recurring Supporter, one-time support, background commerce, exact price/tax/webhook contract, and provider mode pass without printing secrets. Confirm the webhook subscribes only to required event types and points at the canonical route. Do not create a Checkout Session or Portal Session.

- [ ] **Step 5: Verify database/runtime and cost controls read-only**

Confirm production runtime uses the Neon pooled host, direct URL is restricted to migration/maintenance, current connection/compute/storage/transfer graphs are healthy, autoscaling ceiling is deliberate, and spend/usage alerts exist. Record status and threshold presence without connection strings or account data.

For Vercel, confirm current deployment health, spend notifications/hard-limit posture, error/usage alerts, and WAF auth/checkout observations in Log mode. Also record aggregate function latency split by platform-reported cold-start versus warm invocations for the launch-route group and exact deployed commit. If Vercel does not expose a trustworthy split, record `NOT RUN — access unavailable`; do not relabel the local first timing sample as cold. Do not enable/enforce/change a rule.

Read the Vercel Git integration without changing it and record the exact Production branch and trigger. Expected repository path is `main` with automatic Production deployment. This result selects the exact repository-update/deploy gate in Task 5; no deployment mechanism remains implicit.

- [ ] **Step 6: Verify R2 and Sentry read-only**

Confirm public immutable media uses the custom domain with expected cache/range/CORS headers and review aggregate R2 storage/Class A/Class B trends. Confirm Sentry error delivery, quota/spike posture, disabled Replay/screenshots/attachments/logs, and anonymous privacy boundary. Do not emit a synthetic event.

- [ ] **Step 7: Verify pause-control readiness**

Confirm both exact flags can be set independently in Production and currently have the intended open/paused values. Do not change them. The runbook must identify who can authorize a pause and the redeployment effect.

- [ ] **Step 8: Update the production-prerequisite receipt**

Mark each read-only row PASS/FAIL/NOT RUN with date, environment, and coarse evidence. List exact required mutations separately: additive migration deployment, application deployment, any configuration correction, and any optional live smoke. No production mutation occurs in this task.

---

### Task 5: Apply migrations and deploy only through separate gates

**Files:**
- Modify: `docs/audits/2026-08-28-family-friends-release-readiness.md`
- Modify after evidence: `docs/project-state.md`
- Modify after evidence: `docs/project-log.md`

**Interfaces:**
- Migration authorization is separate from deployment authorization.
- Deployment authorization names one exact commit and target environment.
- Old application remains schema-compatible with additive tables/nullable columns.

- [ ] **Step 1: Request exact migration authorization**

Present the zero-collision result, current production migration status, exact migration names:

```text
20260828120000_identity_method_safety
20260828130000_membership_subscription_convergence
```

Include additive/limiter-row-deletion behavior, rollback compatibility, database target, and verification command. Request authorization only for applying these reviewed migrations.

- [ ] **Step 2: Apply and verify only after approval**

Use the documented direct Neon maintenance path to run `npm run prisma:migrate:deploy`, then read migration status again. Expected: both exact migrations applied and all committed migrations current. Stop on any unexpected migration or failure; do not resolve/baseline/repair automatically.

- [ ] **Step 3: Construct and request authorization for one exact atomic main update/Production deploy**

Proceed only if Task 4 proved the current Vercel mechanism is automatic Production deployment from `main`. Fetch without modifying external state, then identify the exact release PR number, reviewed branch head, current `origin/main` hash, green PR checks, current migrations, provider receipt, and rollback deployment. Require the release branch to already contain that exact `origin/main`.

Create a local candidate merge commit without pushing: its tree is exactly the reviewed release head, first parent is the current approved `origin/main`, and second parent is the reviewed release head. Retain it on local branch `codex/family-friends-release-merge-candidate`, verify both parents/tree, and record its exact SHA. This local object creation does not merge GitHub or deploy Vercel.

```powershell
$candidatePr = gh pr view codex/family-friends-release-proof --json number,headRefOid,baseRefOid,mergeStateStatus,statusCheckRollup | ConvertFrom-Json
git fetch origin main
$candidateBase = git rev-parse origin/main
$candidateHead = $candidatePr.headRefOid
if ($candidatePr.baseRefOid -ne $candidateBase -or $candidatePr.mergeStateStatus -ne 'CLEAN') {
  throw 'Release PR base or merge readiness is not current.'
}
git merge-base --is-ancestor $candidateBase $candidateHead
if ($LASTEXITCODE -ne 0) { throw 'Release head does not contain the exact current main base.' }
$candidateTree = git rev-parse "$candidateHead^{tree}"
$mergeMessage = "Merge family-and-friends release PR #$($candidatePr.number)"
$candidateMerge = $mergeMessage | git commit-tree $candidateTree -p $candidateBase -p $candidateHead
if ($LASTEXITCODE -ne 0 -or $candidateMerge -notmatch '^[0-9a-f]{40}$') { throw 'Could not construct candidate merge commit.' }
git branch -f codex/family-friends-release-merge-candidate $candidateMerge
if ((git rev-parse "$candidateMerge^1") -ne $candidateBase) { throw 'Candidate first parent mismatch.' }
if ((git rev-parse "$candidateMerge^2") -ne $candidateHead) { throw 'Candidate second parent mismatch.' }
if ((git rev-parse "$candidateMerge^{tree}") -ne $candidateTree) { throw 'Candidate tree mismatch.' }
$repoName = gh repo view --json nameWithOwner --jq .nameWithOwner
gh api "repos/$repoName/rules/branches/main"
if ($LASTEXITCODE -ne 0) { throw 'Could not read effective main branch rules.' }
$candidateBase
$candidateHead
$candidateMerge
```

Read current branch rules. If an exact-OID leased fast-forward push of that preconstructed commit is not permitted, stop and amend the plan; do not fall back to an unpinned `gh pr merge`, queue, plain force push, admin bypass, or temporary rule change. Otherwise request one explicit authorization naming three coupled effects: atomically fast-forward `main` from the exact approved base to the exact preconstructed merge SHA under an exact ref lease, allow that update to incorporate the exact reviewed PR head, and allow Vercel to deploy that exact merge SHA. If the user authorizes the repository update but not Production deployment, do not push. If either head/base changes, reconstruct, re-prove, and reauthorize.

- [ ] **Step 4: Atomically fast-forward only the approved preconstructed merge commit**

After authorization, place the three approved 40-character hashes in `MASSAGELAB_APPROVED_RELEASE_HEAD`, `MASSAGELAB_APPROVED_MAIN_BASE`, and `MASSAGELAB_APPROVED_MERGE_COMMIT` for this shell only. Recheck the PR, candidate parents/tree, and remote base, then push that one already-reviewed object as an ordinary fast-forward:

```powershell
$approvedHead = $env:MASSAGELAB_APPROVED_RELEASE_HEAD
$approvedBase = $env:MASSAGELAB_APPROVED_MAIN_BASE
$approvedMerge = $env:MASSAGELAB_APPROVED_MERGE_COMMIT
if ($approvedHead -notmatch '^[0-9a-f]{40}$' -or $approvedBase -notmatch '^[0-9a-f]{40}$' -or $approvedMerge -notmatch '^[0-9a-f]{40}$') {
  throw 'Approved release/base/merge hashes are missing or invalid.'
}
$releasePr = gh pr view codex/family-friends-release-proof --json number,headRefOid,baseRefOid,mergeStateStatus,statusCheckRollup | ConvertFrom-Json
git fetch origin main
$currentBase = git rev-parse origin/main
if ($releasePr.headRefOid -ne $approvedHead -or $releasePr.baseRefOid -ne $approvedBase -or $currentBase -ne $approvedBase) {
  throw 'The approved PR head or main base changed.'
}
if ($releasePr.mergeStateStatus -ne 'CLEAN') { throw 'The approved PR is not merge-ready.' }
$candidateFirstParent = git rev-parse "$approvedMerge^1"
$candidateSecondParent = git rev-parse "$approvedMerge^2"
$candidateTree = git rev-parse "$approvedMerge^{tree}"
$approvedTree = git rev-parse "$approvedHead^{tree}"
if ($candidateFirstParent -ne $approvedBase -or $candidateSecondParent -ne $approvedHead -or $candidateTree -ne $approvedTree) {
  throw 'The approved merge object does not match its authorized parents/tree.'
}
git push --force-with-lease="refs/heads/main:$approvedBase" origin "$approvedMerge`:refs/heads/main"
if ($LASTEXITCODE -ne 0) { throw 'Atomic main update was rejected; no fallback is authorized.' }
git fetch origin main
$mergedMain = git rev-parse origin/main
if ($mergedMain -ne $approvedMerge) { throw 'Remote main does not equal the approved merge commit.' }
$mergedMain
```

The fully specified `--force-with-lease="refs/heads/main:$approvedBase"` is the compare-and-swap guard: Git updates `main` only when its remote old OID is exactly the authorized base. The parent checks separately prove the proposed update is a fast-forward from that base. Never use plain `--force`, an implicit/stale lease, an admin bypass, or an unpinned PR merge as a fallback. If the exact lease or branch policy rejects the update, stop with no deployment and amend/reauthorize a policy-compatible exact-base mechanism. After success, record `origin/main`; a tree/parent mismatch pauses rollout before any invitation.

- [ ] **Step 5: Re-prove and read back the automatically deployed merge SHA**

Wait for hosted CI on the resulting `main` SHA and rerun Task 2 Steps 1–7—the read-only commands, not its receipt edit/commit—in a clean worktree checked out at that SHA. Read Vercel back until it is READY or failed; require the full deployed Git SHA to equal `origin/main`, the Production migration gate to pass, canonical `massagelab.app`/`www` alias behavior to be healthy, and public launch-route HTTP health to pass. Do not run a second manual deployment, change provider settings, or create a payment/Portal session.

- [ ] **Step 6: Exercise each pause only through its own exact reversible gate**

Production pause proof is optional and is not bundled into merge/deploy authorization. A Vercel environment edit affects only a new deployment, so no pause or restoration is claimed active until its own explicit Production redeploy is READY and read back. For registration, separately present and request approval for four named mutations: set the exact flag from its recorded current value to temporary `true`; explicitly redeploy the exact current Production commit with that new environment snapshot; restore the flag to its recorded original value; and explicitly redeploy the same commit with the restored snapshot. The gate also names the Production target, expected deployment IDs/aliases, read-only login/recovery checks after the pause deployment, and final value/behavior readback after restoration. Do not begin unless all four actions and restoration are authorized, but execute and verify them one at a time, stopping on any mismatch. Repeat as a separate gate for the Checkout flag, checking existing account/entitlements/Portal instead. Never set both simultaneously for proof.

If either sequence is not authorized, keep only that row `NOT RUN — authorization required`; source/browser proof remains valid but Production pause behavior is not claimed.

- [ ] **Step 7: Record migration/deployment evidence**

The reviewed release head is now incorporated into the exact deployed merge commit, so do not add post-deploy commits to the release-proof branch. Using `superpowers:using-git-worktrees`, create `codex/family-friends-launch-receipt` from the exact deployed `origin/main` SHA in a separate worktree. Perform Tasks 6 and 7 there. Update receipt/state/log with exact commits, deployment ID/URL, migration names/status, alias health, authorized scope, and no-adjacent-action statement. Never include connection strings, env values, provider payloads, or rows. This documentation-only branch is not pushed or merged without a later exact authorization.

---

### Task 6: Run the production-safe account and access matrix

**Files:**
- Modify: `docs/audits/2026-08-28-family-friends-release-readiness.md`
- Modify: `docs/alpha-qa.md`

**Interfaces:**
- Uses willing operator/tester accounts and non-sensitive content.
- Real Google/email actions are normal user actions; synthetic provider events and payment mutations remain excluded.
- Runs from `codex/family-friends-launch-receipt`, whose base is the exact deployed `origin/main` SHA.

- [ ] **Step 1: Complete email/password checks**

With a willing account owner, verify registration, message arrival, verification, login, logout/login, wrong password recovery, single-use reset, and return to intended local destination. Record only PASS/FAIL, broad mailbox class if useful, device/browser class, and elapsed category (`immediate`, `under 5 minutes`, `over 5 minutes`); no address/token/message ID.

- [ ] **Step 2: Complete Google checks**

Verify first-time Google registration, logout/re-login, and account-security display. If a willing owner naturally has a matching password account, verify the notice, explicit same-account confirmation, password and applicable 2FA proof, two methods afterward, and no duplicate User. Do not manufacture or merge production identities solely for test coverage.

- [ ] **Step 3: Complete recovery and last-method checks**

Verify password addition after recent Google reauth or verified recovery, safe unlink only with another method, and last-method refusal. A destructive unlink on a live account requires the owner's explicit intent and immediate re-login proof; otherwise rely on exact-head automated coverage and mark the live destructive row NOT RUN.

- [ ] **Step 4: Complete free and entitled feature checks**

Verify representative free Clock/Chimer, Music/Atmosphere, Education, Wellness, and account settings. For an existing paid account, read that persisted `premium_backgrounds` access remains available after login without a Stripe page-render call.

- [ ] **Step 5: Verify subscription path without redundant charge**

Record the prior successful live subscription as HISTORICAL and confirm current Stripe configuration plus existing persisted membership/Portal availability read-only. Use the exact-head injected automated fixtures for Checkout -> signed webhook -> persisted feature -> Portal return, duplicate/delayed events, failure, recovery, cancel/reactivate, and amount/interval changes. These fixtures construct no Stripe client and mutate no provider state.

Do not create another live charge for ceremony. A new real Stripe test-mode Checkout, synthetic event, cancellation/reactivation, amount change, or Portal Session is also an external provider mutation and remains `NOT RUN — authorization required` unless the user separately approves the exact disposable test identity, actions, expected amounts, and cleanup. It is optional because the injected failure matrix plus historical live success and read-only live configuration can satisfy this launch gate. A willing tester may voluntarily subscribe during normal use after the launch gate; that real experience becomes first-cohort evidence. Any operator-created live Portal Session or controlled live payment before that requires its own exact authorization.

- [ ] **Step 6: Verify feedback under delay**

On desktop and phone, use network throttling to observe route bar, link-local state, auth action copy, Checkout/Portal copy without submitting a real live payment, membership return state, thrown-request recovery, keyboard focus, enlarged text, landscape, screen-reader status, and reduced motion. Confirm music/timer continuity.

- [ ] **Step 7: Update alpha QA and receipt**

Add the scoped general-user matrix to `docs/alpha-qa.md` while retaining local-first/PHI boundaries. Record only observed results; unresolved serious failure sets the release decision to PAUSE.

---

### Task 7: Operate the three-to-five-person soft launch

**Files:**
- Modify: `docs/audits/2026-08-28-family-friends-release-readiness.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**
- Produces: go/pause decision, anonymous guided-check matrix, safety-window evidence, and broader-sharing decision.

- [ ] **Step 1: Make the initial go/pause decision**

GO requires exact-head local/hosted gates PASS, required production migrations current, deployed SHA correct, critical provider prerequisites PASS, account/access matrix safe, pause mechanism ready, and no unresolved serious finding. Any credible security/privacy issue, widespread login failure, paid-but-locked mismatch, destructive data behavior, or uncontrolled cost produces PAUSE.

- [ ] **Step 2: Invite only three to five known adults**

Share alpha expectations, support contact, no-PHI boundary, and the request not to forward for 48 to 72 hours. Offer—not require—the guided checklist. Do not pressure subscription; live Checkout is available for anyone who independently chooses it.

- [ ] **Step 3: Monitor the safety window**

At least morning and evening, review aggregate auth/reset/mail results, webhook failures, paid-vs-entitlement mismatches, 5xx/Sentry errors, Neon/Vercel/R2 usage, and support reports. Record zero/nonzero counts and action taken, not identities or journeys.

Pause registration for duplicate/linking/security/delivery-abuse risk. Pause Checkout for duplicate-charge risk, webhook convergence failure, or paid-but-locked access. Pause the whole launch for privacy/security, widespread login, destructive data, or loss of confidence in existing paid access.

- [ ] **Step 4: Decide whether forwarding opens**

After 48 to 72 hours, open forwarding only if technical gates remain healthy. If a tester simply did not use the app, register, or subscribe, record no technical failure. If forwarding remains closed, state the exact issue and recovery owner.

- [ ] **Step 5: Observe natural use for two to four weeks**

Continue aggregate incident, delivery, payment/access convergence, and cost-per-traffic observation. Do not introduce marketing tracking. Delayed return, free-only use, or low conversion is expected and does not fail readiness.

- [ ] **Step 6: Finalize canonical documentation**

Reconcile project state, project log, release checklist, alpha QA, runbook, and receipt with the actual deployment/cohort state. Historical open-PR or old test-count claims must not remain as current truth. Run:

```bash
rg -n "remains open|unmerged|replace-me|pending-marker|example-only" docs/project-state.md docs/project-log.md docs/wiki/release-checklist.md docs/alpha-qa.md docs/wiki/family-friends-operations.md docs/audits/2026-08-28-family-friends-release-readiness.md
git diff --check
```

Review every match; historical chronology may remain in project log, while current-state drift and placeholders must be corrected.

- [ ] **Step 7: Commit the final truthful receipt**

```bash
git add docs/audits/2026-08-28-family-friends-release-readiness.md docs/alpha-qa.md docs/wiki/release-checklist.md docs/wiki/deployment.md docs/project-state.md docs/project-log.md
git commit -m "docs: record family and friends launch readiness"
git status --short --branch
git log -1 --oneline --decorate
```

Expected: clean `codex/family-friends-launch-receipt` branch and a final documentation commit describing the actual go/pause/sharing state. Pushing its PR and merging the documentation-only result are later explicit decisions; because `main` auto-deploys, that merge authorization must also acknowledge the resulting documentation-only Production build.
