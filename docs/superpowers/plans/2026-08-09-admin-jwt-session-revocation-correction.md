# Admin JWT Session Revocation Correction Plan

**Goal:** Make the approved Admin role and security operations actually invalidate MassageLab's Auth.js JWT sessions instead of deleting only unused database-session rows.

**Architecture:** Add one monotonic `User.authSessionVersion` field. Auth.js stores the current value in each JWT and returns `null` when a later request presents an older version. Admin services increment the target version inside the same transaction as their account mutation and evidence bundle. Existing database `Session` rows remain deleted for adapter compatibility, but the version is the canonical JWT revocation owner.

**Tech Stack:** Next.js/Auth.js JWT sessions, Prisma/PostgreSQL, TypeScript, Node test runner.

**Baseline/Authority Refs:** Approved Admin User Operations design Role Management and Security Support; Branch 4 Tasks 10-11; `auth.ts`; `lib/auth-users.ts`; `lib/admin/role-service.ts`; `types/next-auth.d.ts`.

**Compatibility Boundary:** Existing JWTs without a version remain valid only while the account version is `0`. After the first revocation increment, missing or stale versions fail closed. New sign-ins receive the current version. Database outages retain the existing restricted-identity fallback; protected Admin operations independently require fresh database authority.

**TDD Route:**
- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Test posture: post-change regression
- Reason: the user approved the architecture correction, not a strict TDD ceremony.
- Verification: focused auth/version/role tests, Prisma generation/validation, typecheck, lint, full branch gate.

## Aegis Visibility

The approved plan assumed database sessions, while the deployed authentication owner uses JWTs. The correction must establish one durable invalidation owner before role UI or security-support actions claim forced sign-out.

## Requirement Ready Check

- Requirement source refs: user approval on 2026-08-09; approved plan's forced-sign-out and session-revocation requirements.
- Goals and scope refs: invalidate all older JWTs for one target account after an Admin security-sensitive action.
- Acceptance refs: old/missing versions reject after an increment; current version remains signed in; role mutation and version increment roll back together; exact replay does not increment twice.
- Open blocker questions: none.
- Decision: ready.

## Change Necessity

- User-visible need: role changes and future security support must genuinely sign the target out.
- No-change option: current per-request role refresh protects authorization but does not end the account session.
- Why code is necessary: Prisma `Session` rows are not consulted under `session.strategy: "jwt"`.
- Minimum boundary: one additive User column/migration, one auth-version decision helper, auth state/JWT wiring, and Task 10's atomic increment.
- Decision: code-change.

## Existence Check

- Proposed new surface: JWT session-version owner.
- Existing reuse candidate: Prisma `Session` deletion.
- Why insufficient: JWT cookies do not read those rows.
- Creation proof: a per-user monotonic version is the smallest local invalidation contract and is reusable by Branch 5.
- Entropy/retirement: database-session deletion remains compatibility-only; the version is canonical while JWT strategy is active.
- Decision: add-with-proof.

## Architecture Integrity Lens

- Invariant: any JWT issued before a successful target revocation becomes invalid on its next successful database-backed session refresh.
- Canonical owner: `User.authSessionVersion`, interpreted by one pure auth helper and the Auth.js JWT callback.
- Responsibility overlap: services only increment; they do not parse tokens. Auth only compares; it does not perform Admin mutations.
- Higher-level simplification: switching to database sessions is not viable for the current credentials/JWT setup and would be a broader authentication migration.
- Retirement: remove version logic only if MassageLab deliberately replaces JWT sessions with a revocable server-side session owner.
- Verdict: proceed.

## Complexity Budget

- Artifact class: additive schema field, small shared auth helper, existing callback/service integration.
- Target files: `prisma/schema.prisma`, one migration, `lib/auth-session-version.ts`, `lib/auth-users.ts`, `auth.ts`, `types/next-auth.d.ts`, `lib/admin/role-service.ts`, focused tests/docs.
- Current pressure: `auth.ts` and the role service are established owners; comparison logic should remain extracted and small.
- Projected pressure: within budget.
- Recommendation: add helper; edit existing owners in place.

## Task 10A: Establish versioned JWT invalidation

**Files:**
- Modify `prisma/schema.prisma`.
- Create `prisma/migrations/20260808093000_admin_jwt_session_version/migration.sql`.
- Create `lib/auth-session-version.ts`.
- Modify `lib/auth-users.ts`, `auth.ts`, and `types/next-auth.d.ts`.
- Modify `lib/admin/role-service.ts` and `tests/admin-role-service.test.mjs`.
- Create `tests/auth-session-version.test.mjs`.
- Update current Admin operations documentation.

**Implementation:**

1. Add `authSessionVersion Int @default(0)` to `User` and the matching non-null PostgreSQL column/default migration.
2. Return the version from `getUserAuthState()` and declare it on the Auth.js JWT type.
3. Add a pure, documented decision helper with this contract:
   - a sign-in token always adopts the current non-negative database version;
   - a subsequent token with the exact current version continues;
   - a legacy token with no version continues only when the database version is `0` and is upgraded to `0`;
   - missing, malformed, negative, non-integer, or stale values fail closed once they cannot prove equality.
4. In the JWT callback, compare after loading current account state and return `null` for a rejected session before exposing refreshed role/capability state.
5. In `changeAnatomyRole()`, increment the target version inside the existing serializable transaction before recording the evidence bundle. Include before/after version evidence; exact replay returns persisted versions and never increments again. Continue deleting adapter `Session` rows and reporting that row count for compatibility.
6. Document that role/security actions invalidate JWTs through the version owner; database-session deletion is not the JWT mechanism.

## Verification

```powershell
node --test tests/auth-session-version.test.mjs tests/admin-role-service.test.mjs tests/admin-access.test.mjs tests/admin-operation-service.test.mjs
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
git diff --check
```

Task 11 then adds the role action/UI and proves a target JWT is rejected after the role mutation. Full unit, build, and desktop/mobile browser QA remain the Branch 4 terminal gate.

## ADR and baseline closure

The repository has no established ADR directory. The decision is recorded in this correction plan and will be synchronized into `docs/project-state.md`, `docs/project-log.md`, and `docs/wiki/admin-user-operations.md` once executed. No separate ADR file is created.
