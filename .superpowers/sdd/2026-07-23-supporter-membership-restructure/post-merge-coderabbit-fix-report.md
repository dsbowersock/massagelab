# Post-merge CodeRabbit fix report

## Status

`DONE`

## Commit SHA(s)

- Implementation: `c07af7c0e2295f77258777c718bb127f3b2b952e`
- This report is committed separately immediately after the implementation so it can record the exact implementation SHA; its commit is the repository HEAD that contains this file.

## Scope and safety

- Worktree: `C:\tmp\massagelab-supporter-membership-rollout`
- Branch: `codex/supporter-membership-rollout`
- Task base: `684018ebe4c42c8faaf503f0015b091033f02788`
- No production, Stripe, Vercel environment, database, deployment, push, PR, merge, or main-checkout operation was performed.
- `TODO.md` remained unchanged and unstaged.

## Files changed and why

- `lib/stripe-price-contract.js`: added the canonical Supporter product-name constant and extracted early-return currency-options validation while preserving mismatch ordering and strict semantics.
- `lib/stripe-readiness.js`: consumes the canonical Supporter product name.
- `lib/membership-pricing.js`: uses the canonical name in `MEMBERSHIP_PLAN_DETAILS`.
- `components/membership/pricing-cards.tsx`: separates Portal actions and narrows public child action mode to `"checkout" | "auth"`.
- `lib/safe-error-code.js`: allowlists four expected operational Stripe error codes without changing the finite no-secret reduction boundary.
- `lib/stripe-billing.js`: safely blocks completed Sessions without a subscription ID and adds a three-worker completed-subscription authority pool with stable indexed precedence, a 25-read cap, and wall-clock checks.
- `lib/trusted-form-origin.js`: normalizes content type casing before browser-form classification.
- `scripts/stripe-supporter-membership-migration.mjs`: exports `TARGET_PRICE_SPECS` for behavioral contract testing.
- `tests/fixtures/stripe-readiness-stripe-stub.mjs`: captures Stripe client configuration and derives webhook `api_version` from the pinned client option.
- `tests/stripe-billing.test.mjs`: covers missing-subscription blocking, the full 25-read edge, bounded concurrency, and deterministic lookup order.
- `tests/safe-error-code.test.mjs`: covers the four added safe operational codes.
- `tests/donation-checkout-route.test.mjs`: covers mixed-case form content types and reuses `jsonRequest()`.
- `tests/membership-pricing.test.mjs`: replaces migration source-shape matching with behavioral `TARGET_PRICE_SPECS` validation.
- `tests/account-page-tabs.test.mjs`: ends `MembershipTab` extraction at the next top-level async or regular function.
- `tests/supporter-membership-final-review.test.mjs`: tightens `$1` boundaries, asserts one CLI entrypoint, neutralizes all occurrences, and supplies the shared name to the compiled readiness double.

## CodeRabbit issue dispositions

1. **DONE — shared Supporter product name.** Exported `SUPPORTER_MEMBERSHIP_PRODUCT_NAME` from the price contract and consumed it in readiness and membership plan details.
2. **DONE — narrowed pricing action mode.** Portal rendering exits through its own branch; non-Portal filtering and `SupporterAmountChoice` rendering use a local `"checkout" | "auth"` mode.
3. **DONE — currency-options helper.** Extracted an early-return helper that preserves null, empty, missing, malformed, multi-currency, amount, tax, and base-currency behavior and the existing `currency_options` mismatch code.
4. **DONE — CLI entrypoint neutralization.** The final-review test asserts exactly one `await main()` call and uses global `replaceAll`.
5. **DONE — `$1` copy boundary.** All affected copy assertions use a negative digit lookahead so `$1` cannot match `$10` or another longer amount.
6. **DONE — readiness API-version pinning.** The stub retains constructor config and reports `config.apiVersion`; the real readiness CLI test passes only while its Stripe client stays pinned.
7. **DONE — safe Stripe operational failures.** Added `rate_limit`, `idempotency_key_in_use`, `lock_timeout`, and `api_connection_error` to the finite allowlist with regression coverage.
8. **DONE — completed Session without subscription ID.** Such a Session now returns a sanitized completed blocking projection with `subscription: null`; it no longer throws or allows duplicate Checkout.
9. **DONE — bounded authority concurrency.** Added three workers, indexed outcomes, deduplication, ordered error/block resolution, per-claim budget checks, a maximum of 25 Stripe subscription reads, and no unbounded `Promise.all`.
10. **DONE — behavioral target-price validation.** Exported `TARGET_PRICE_SPECS` and tests its values against the runtime Supporter amount contract instead of matching source shape.
11. **DONE — normalized content type.** Browser-form detection lowercases the header and tests mixed-case URL-encoded and multipart values.
12. **DONE — resilient MembershipTab extraction.** The test now finds the next column-zero async or regular function declaration rather than naming `BackgroundCommerceTab`.
13. **DONE — shared JSON request helper.** The duplicate JSON `Request` construction now calls `jsonRequest()` with unchanged semantics.

## Tests added or changed

- Added deterministic billing tests proving concurrency is exactly bounded at three, input-order authority is retained, missing-subscription Sessions block without a Stripe read, and a missing-subscription block remains observable immediately after all 25 allowed reads.
- Added mixed-case browser form content-type coverage.
- Extended safe error-code coverage.
- Converted migration price-spec coverage from source shape to exported behavior.
- Hardened final-review regex and CLI-neutralization assertions.
- Updated readiness compiled-module doubles and the Stripe readiness fixture for the shared name and pinned API-version boundary.
- Generalized Account `MembershipTab` source extraction.

## Validation

- `git diff --check` — PASS before implementation commit; only expected Windows LF/CRLF notices.
- Initial expanded focused run (required files plus `tests/safe-error-code.test.mjs`) — 187 PASS, 2 FAIL. Both failures were test-fixture assumptions: the compiled readiness double lacked the new shared constant, and equal-timestamp Session expectations ignored the existing descending-ID tie-breaker. Both were corrected.
- `node --test tests/stripe-billing.test.mjs tests/supporter-membership-final-review.test.mjs` — PASS, 79/79 after correcting those test assumptions.
- Required focused command before final self-review hardening — PASS, 186/186.
- `npm run test` before final self-review hardening — PASS, 1,615/1,615.
- `npm run lint` before final self-review hardening — PASS; only Babel large-file deoptimization notices for existing Chimer files.
- `npm run typecheck` before final self-review hardening — PASS.
- `node --test tests/stripe-billing.test.mjs` after the 25-read self-review edge fix — PASS, 72/72.
- Final required focused command — PASS, 187/187.
- Final `npm run test` — PASS, 1,616/1,616.
- Final `npm run typecheck` — PASS.
- Final `npm run lint` — PASS; only the same existing Babel large-file notices.
- Final pre-commit `git diff --check` — PASS; only expected Windows LF/CRLF notices.

## Self-review and remaining concerns

- Reviewed the full implementation diff for all 13 dispositions, request-count behavior, blocking precedence, wall-clock checks, deduplication, test determinism, safe logging, and unchanged product/tax semantics.
- Self-review found and fixed one additional edge: a missing-subscription completed Session immediately after 25 terminal subscription authorities must still block because observing it requires no 26th Stripe read.
- No remaining code or test concerns. The report is intentionally a separate follow-up commit so it can cite the immutable implementation SHA.
