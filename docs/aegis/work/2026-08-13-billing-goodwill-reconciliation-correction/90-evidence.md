# Billing Goodwill Reconciliation Correction Evidence

## Baseline

- Refreshed `origin/main`; `HEAD`, `origin/main`, and `FETCH_HEAD` all equaled `132b59cdaf8a6b83601c565515cb03640e40b926`.
- The worktree was clean and detached before creating `codex/admin-billing-goodwill-reconciliation-correction`.
- Read the canonical project state/log/wiki, approved closure design, complete Branch 2 plan, and current service/test owners.
- Installed 1,148 locked packages in the fresh worktree. npm reported 31 aggregate audit findings (1 low, 3 moderate, 27 high); no audit-fix mutation was run.
- `npm run prisma:generate`: passed.
- Unchanged focused baseline: `node --test tests/admin-billing-goodwill.test.mjs` passed 64/64.
- No Stripe network call, Stripe mutation, live database mutation, email, browser action, Branch 3 activation, or source-checkout change occurred.

## Pending evidence

- Ready PR #181 remains open and unmerged. Exact pushed head `182ed627` passed all non-CodeRabbit hosted checks, including Browser QA; the earlier focused billing validation passed 78/78, typecheck and diff check passed, and independent spec/quality reviews were clean.
- A substantive hosted CodeRabbit review completed at `2026-08-13T19:54:03Z` as review `4931055672` / run `c4c9b211-a7ff-4ada-9155-379caaa0197f`. It verified the four earlier corrections, whose threads are resolved, and raised two valid minor follow-ups. The required follow-up head must contain both corrections: a fixture comment documenting per-actor initial versus final-authority loads and canonical/lifecycle evidence recording the exact hosted state. Fresh substantive review of that exact head and resolution of the two current threads remain required before the user merge gate.
- No live Stripe/payment action, Production activation, migration deployment, or Admin Operations Closure Branch 3 work is authorized or claimed; all corresponding gates remain closed.

## Final local review

- A fresh independent whole-branch review of `132b59cd..954b9f68` returned clean with no Critical, Important, or Minor findings. Its independent focused and adjacent run passed 232/232, and the exact committed-range diff check passed.
- Authenticated CodeRabbit CLI `0.7.2` completed a substantive exact-head review of all 14 changed files after two recoverable WebSocket failures on the Windows-mounted worktree; the successful review used a disposable WSL-native clone of exact commit `954b9f68` and base `132b59cd`.
- CodeRabbit raised one major identity-error transition concern at `lib/admin/billing-goodwill.ts`. The two ID-only writes are real, but the claimed stale production overwrite is invalid: the initial operation read and writes occur in one PostgreSQL `SERIALIZABLE` transaction, the shared owner retries serialization conflicts through bounded `P2034`, and same-key preparation plus VERIFIED finalization use the transaction advisory lock. Intermediate `APPLIED` persistence relies on the serializable row-update conflict rather than that advisory lock. A settlement visible before the snapshot is read directly; a settlement committed after the snapshot aborts and retries the stale writer; a prior identity write is superseded by later `APPLIED` or `VERIFIED` settlement.
- This differs from the corrected creator/reconciler defect, which carried a stale operation object across separate transactions and therefore required the exact creator-owned compare-and-set. Converting the identity-error writes to predicate updates would be defense-in-depth consistency, not a fix for a confirmed correctness failure, so no application change was made.
- No provider, database, email, browser, Production activation, or Branch 3 action occurred during review.

## Task 1 - historical and current credit evidence

- Strict RED series: initial semantic contract failed 4 of 64 tests; local-failure current evidence failed 1 of 64; concurrent-verifier settlement failed 1 of 65; optional current-observation behavior failed 2 of 68.
- GREEN: exact transaction evidence now owns historical verification; fresh non-positive Customer credit is separate, while unavailable or safe debit observations return `null`; malformed returned Customer evidence still fails closed.
- The exact transaction mismatch table covers ID, Customer, positive/unsafe ending, currency, amount, and mode without a replacement create.
- Independent spec review found and verified the concurrent-winner correction; final verdict: spec compliant.
- Independent quality review found and verified optional current-observation handling; final verdict: no findings, ready to proceed.
- Fresh coordinator verification: `node --test tests/admin-billing-goodwill.test.mjs` passed 68/68; `npm run typecheck` passed; `git diff --check` passed.
- Commit/readback: `46de4bf2367da36cebb835b65fcbf08fd90d316f`, exactly `lib/admin/billing-goodwill.ts` and `tests/admin-billing-goodwill.test.mjs`.
- No Stripe network call, Stripe mutation, live database mutation, email, browser action, or Branch 3 activation occurred.

## Task 2 - final provider-boundary Admin authority

- Strict RED covered the missing typed denial/final check, explicit null identity classification, and the creator-versus-reconciler overlap that could falsely claim definite no-mutation.
- GREEN reserves `AdminAuthorityDeniedError` for an identified actor denied after successful database read, propagates infrastructure errors unchanged, and preserves no-input redirects.
- A fresh full-Admin check runs after the final retry-window clock read and directly before Stripe create. Only the still-owning creator's exact `PREPARED`/null-ID row can become `FAILED_BEFORE_MUTATION` with `ADMIN_AUTHORITY_REVOKED`.
- A different authorized reconciler transactionally claims a no-ID `PREPARED` row as `RECONCILIATION_REQUIRED` before provider I/O, preventing a later creator denial from overclassifying a possibly committed attempt.
- Independent spec and quality re-reviews returned clean verdicts after the classification and overlap fixes.
- Fresh coordinator verification: access and billing-goodwill tests passed 82/82; typecheck and diff check passed.
- Commit/readback: `45691cd797669d8f81c6fe2705c3941ba6c15ba3`, exactly the four planned Task 2 files.
- No provider network call, payment mutation, live database action, UI/doc/schema change, or Branch 3 activation occurred.

## Task 2 final-review correction - reconciliation ownership

- The first whole-branch review found a critical stale-owner race: generic creator-side pre-provider failures could overwrite a reconciler's durable claim and falsely record `FAILED_BEFORE_MUTATION` after reconciliation had entered provider work.
- Strict RED proved the overwrite for both no-ID `RECONCILIATION_REQUIRED` and transaction-bearing `APPLIED` winners across the live gate, Customer read, subscription validation, and stale-credit routes. Follow-up RED also proved that a preserved `APPLIED` winner surfaced a non-returnable-state exception.
- GREEN centralizes all five definite pre-provider routes, including typed authority denial, behind one exact creator-only compare-and-set matching operation ID, originating actor, target, idempotency key, `PREPARED`, and null transaction ID. CAS loss rereads and preserves canonical state; stored `APPLIED` evidence returns conservatively as `RECONCILIATION_REQUIRED` without changing the transaction ID.
- Regression coverage asserts the complete predicate, both claim shapes, typed authority-denial propagation, and zero replacement Stripe creates. Independent spec and quality re-reviews returned clean verdicts.
- Fresh coordinator verification: billing-goodwill tests passed 77/77; typecheck and diff check passed.
- Commit/readback: `6bda6746` (`fix: preserve reconciliation ownership`), exactly `lib/admin/billing-goodwill.ts` and `tests/admin-billing-goodwill.test.mjs`.
- No provider network call, payment mutation, live database action, email, browser action, or Branch 3 activation occurred.

## Task 3 - truthful historical/current presentation

- Strict RED: the UI suites had 28 passes and 3 expected failures for missing projection qualification and stale post-verification resulting-credit wording.
- GREEN: route-local copy renders transaction-time historical credit first and optional current Customer credit second; null current evidence makes no current claim. Delivered and warning outcomes share this helper.
- The pre-provider form retains `Current Stripe credit` and `Resulting credit` labels/math with an explicit projection comment. Activity/email bundle copy remains historical-only.
- Independent spec and quality reviews found no remaining issues.
- Fresh coordinator verification: billing-goodwill/security UI tests passed 31/31; typecheck and diff check passed.
- Commit/readback: `4ba4c8b64279ea3c3ef252f4e448067d498c1a85`, exactly the three necessary Task 3 files; the faithful security compiled double was unchanged.
- No provider/service/authority/schema/doc/live action occurred.

## Task 4 - canonical documentation and comprehensive validation

- Updated canonical project state/log, Admin runbook, and release checklist with exact historical/current evidence, final Admin authority/ownership classification, reconciliation claim, truthful presentation, unchanged gates, Branch 3 sequencing, and official Stripe transaction/idempotency links.
- Independent documentation spec/quality reviews corrected ambiguous original-rollout versus closure branch numbering and surfaced local validation readiness explicitly; final re-reviews returned clean verdicts.
- Corrected-head focused and adjacent Admin/billing/Stripe validation passed 232/232.
- `npm run typecheck` passed.
- `npm run lint` passed with only the existing Babel large-file note for `app/chimer/running-timer.tsx`.
- `npm run prisma:validate` passed; no schema change exists.
- Corrected-head full `npm run test` passed 2,479 tests with one intentional skip and zero failures (2,480 total).
- `npm run build` passed; prebuild Prisma generation succeeded and Next generated 104/104 pages.
- The earlier committed Task 4 documentation rechecks were spec compliant and quality-clean before the later whole-branch race correction.
- Task 4 canonical documentation commit/readback: `8fa4e0931d5cbe7c5857caa37a03f3092689703b`, exactly the four planned docs.
- No live Stripe/provider call, payment mutation, database write, email, local browser action, Production activation, or Admin Operations Closure Branch 3 action occurred. Hosted CI Browser QA is tracked separately in the PR status above. The live gate remains closed.
