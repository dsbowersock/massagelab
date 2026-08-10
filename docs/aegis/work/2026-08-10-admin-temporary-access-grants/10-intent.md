# Admin Temporary Access Grants Intent

## TaskIntentDraft

- Requested outcome: complete Branch 7 of the approved Admin User Operations program so a freshly verified full Admin can grant and append-only revoke bounded temporary access, effective entitlements retain every active source, and Admin/Account surfaces show truthful expiration evidence.
- Parent plan/spec: `docs/superpowers/plans/2026-08-08-admin-user-operations-program.md` on the protected `codex/admin-user-operations-program-design` branch, Branch 7 Tasks 16-18.
- Scope: append-only grant/revocation schema and services; source-aware entitlement integration; Admin grant/revoke controls; Account expiration visibility; directory/dashboard metrics; desktop/mobile browser contracts; current state/log/wiki updates.
- Stop condition: stop as done only after all three tasks pass two-stage review, the whole branch is independently reviewed, terminal gates and the PR loop are clean, and the user controls the merge. Stop as needs-verification when required evidence is unavailable, as blocked for a genuine external dependency, or as scope-exceeded if a new persistence/authority/product contract is required.
- Non-goals: permanent manual grants; full-Admin elevation; high-risk or PHI-bearing capabilities; `chimer_custom_colors`; `practice_management`; `calendar_team_scheduling`; `cloud_storage`; `phi_storage_tools`; grant deletion/update; scheduled expiration jobs; Branch 8 Stripe goodwill credits; live database/email/browser mutations without the exact disposable QA gate.
- Risk hints: fresh database authority, exact allowlist, whole-day bounds, optimistic active-grant snapshots, serializable/idempotent writes, append-only revocation, overlapping sources, expiration boundaries, source provenance, bounded projections, safe target-visible copy, and post-commit email delivery.

## BaselineReadSetHint

- `AGENTS.md`
- refreshed `origin/main` at PR #177 merge `4a275cc6673960b6a8cc2432f98079eb581730ba`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/wiki/admin-user-operations.md`
- parent Branch 7 plan excerpt on `codex/admin-user-operations-program-design`
- `prisma/schema.prisma`
- `lib/admin/access.ts`
- `lib/admin/operation-service.ts`
- `lib/admin/operation-contract.ts`
- `lib/membership.js`
- current account/Admin loaders and their focused tests

## BaselineUsageDraft

- Required refs: all items above.
- Acknowledged: repository instructions, refreshed canonical docs, current Admin operations wiki, exact Branch 7 Tasks 16-18, worktree state, local-development setup, Prisma schema validity, and focused baseline behavior.
- Cited by parent plan: schema, temporary-access service, entitlement resolver/loaders, Admin/Account surfaces, directory/dashboard metrics, browser spec, and canonical docs.
- Missing refs: none. The parent plan remains intentionally on the protected design branch rather than this implementation branch.
- Decision: continue.

## ImpactStatementDraft

Branch 7 adds a new append-only authorization source that can affect runtime capabilities. It must never replace or hide membership/student sources, never grant excluded features, and must fail closed at expiration, revocation, stale-state, replay, and authority boundaries. User-visible and Admin-visible evidence must remain bounded and omit actor IDs, internal notes, and sensitive data.

## Execution Readiness View

- Intent lock: temporary, expiring, append-only access only.
- Scope fence: Branch 7 Tasks 16-18; Branch 8 is excluded.
- Baseline lock: exact PR #177 merged `origin/main` plus the protected parent-plan excerpt.
- Owner constraints: shared Admin access and evidence bundle remain authoritative; membership resolver owns effective features; account/Admin loaders own their projections; existing email-intent owner handles post-commit delivery.
- Compatibility boundary: existing membership, student, ownership, role, credit, and security behavior remains unchanged; overlapping access sources coexist.
- Retirement boundary: `chimer_custom_colors` stays absent from current grant/session/membership contracts.
- Task batches: Task 16 ledger/services; Task 17 resolver/loaders; Task 18 UI/metrics/browser/docs.
- Test obligations: strict task RED/GREEN, spec review, quality review, coordinator verification, whole-branch review, Prisma generate/validate, focused tests, browser gate when authorized, typecheck, lint, full unit, build, diff check, and PR review loop.
- Drift rule: pause if a new grant type, irreversible mutation, scheduler, sensitive field, or authority source is proposed.

## Slice Card — Task 16

- Goal: add the exact temporary-feature allowlist plus append-only grant/revocation persistence and services.
- Parent plan/spec: Branch 7 Task 16.
- Files: Prisma schema/migration, `lib/admin/temporary-access.ts`, `tests/admin-temporary-access.test.mjs`.
- Boundary: no entitlement-loader or UI integration yet; no live database/email mutation.
- Verification: strict RED, Prisma generate/validate, focused service tests, adjacent Admin-operation tests, two-stage review, typecheck/lint/diff check.
- Stop: Task 16 reviewed, verified, and committed, or a schema/authority contract conflict requires escalation.
