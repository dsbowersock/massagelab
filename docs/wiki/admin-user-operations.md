# Admin User Operations

This page defines the authorization and evidence boundary for MassageLab account support. The current branch supplies roles, guards, audit records, target-visible activity, durable account-change email intents, a capability-aware Admin dashboard, and the full-Admin user directory/read-only account detail.

## Roles and capabilities

- `ADMIN` is the only full administrator. It can access account/user operations, commerce operations, anatomy editing, and anatomy review.
- `ANATOMY_EDITOR` can edit anatomy content and perform anatomy review. It cannot access account/user or commerce operations.
- `ANATOMY_REVIEWER` can perform anatomy review only. It cannot edit general anatomy content or access account/user or commerce operations.
- The retired `ANATOMY_ADMIN` value is migrated and normalized to `ANATOMY_EDITOR`; it is not a separate displayed role.

Dashboard visibility helps operators find permitted work, but it is not an authorization boundary. The review queue, full anatomy browser, commerce page, and future user-operation destinations each enforce their own database-backed guard.

## Fresh database authority

Authentication sessions identify the current user; their role claims do not authorize administrative work. Every administrative page or operation must call the shared Admin access layer, reload the account's verified email and current role assignments from the database, ignore pending or revoked assignments, and then require the specific capability. A role change therefore takes effect on the next guarded request without waiting for a session refresh.

Do not replace this rule with displayed plan names, stale navigation state, dashboard visibility, or client-provided roles.

## JWT session invalidation

`User.authSessionVersion` is the canonical JWT invalidation owner. Auth.js copies the current database value into a newly issued JWT and requires later requests to present that exact version. A role or security action increments the value in the same transaction as its account mutation and evidence bundle, so every older JWT fails on its next successful database-backed refresh. Legacy JWTs without a version remain valid only while the account value is zero.

Prisma `Session` rows are still deleted for adapter compatibility, but that deletion does not revoke JWT cookies and its row count is not an active JWT-session count. MassageLab's stateless JWT strategy cannot report an exact number of active browser sessions, so current and future Admin copy must not present deleted `Session` rows as users or JWT sessions signed out.

## Delegated anatomy role controls

The target account's Access section lets a freshly verified full Admin assign or revoke only Anatomy Reviewer and Anatomy Editor. It shows the stored current state and exact planned state, requires an allowlisted support reason and explicit confirmation that existing sign-in tokens will be invalidated, and submits one server-generated UUID unchanged. Pending or otherwise unsupported assignment evidence renders read-only and must be refreshed or resolved before mutation. Full `ADMIN`, retired `ANATOMY_ADMIN`, and generic `EDITOR` are never grantable from this surface.

The role record, `authSessionVersion` increment, adapter-session deletion, immutable Admin action, target-visible activity, and durable email intent share one transaction. Transport begins only after commit. Delivery failure therefore reports that the role changed and sign-in tokens were invalidated; it never reports a rollback that did not happen. Admin Activity offers retry only when a transport attempt produced a retry-eligible failed intent. An unavailable recipient, another non-attempted result, or an unconfirmed transport exception directs Admin to inspect Activity without promising that a retry control exists.

## Audit, activity, and email boundaries

An account mutation and its evidence bundle belong in one caller-owned database transaction:

1. `AdminAction` is the immutable operator record. It stores actor, target, action kind, support reason, bounded before/after snapshots, outcome, and one idempotency key.
2. `UserAccountActivity` is the target account's durable, user-visible explanation of what changed. It must reference the same target and action.
3. `AdminEmailIntent` is the durable account-change notification intent. It must reference the same target and action. Email transport occurs only after the mutation transaction succeeds.

The database relations reject cross-target bundles. Exact idempotent replays return the existing record; a reused key with different immutable input fails closed. Delivery and explicit retries serialize per intent, and retry requires a freshly verified full Admin. Password-reset mail uses its separate security flow and cannot be delivered or retried through account-change intents.

Email delivery is at-least-once. A process can stop after the provider accepts a message but before the database transaction records delivery, so an authorized retry can send a duplicate. Do not describe this contract as exactly-once.

## Activity surfaces and retry boundary

The signed-in Account Activity tab queries only its own newest fifty `UserAccountActivity` entries. Its payload contains only the entry ID, title, explanation, effective value, and occurrence time. It never includes the operator, internal note, snapshots, email recipient/content, delivery failure details, or other Admin-only fields.

The full-Admin detail Activity section may show the linked email intent's safe kind, delivery state, failure code, attempt count, and last-attempt/delivery times. Retry is an explicit server action only for a `FAILED` non-password intent; it begins with `requireFullAdminUser()` and delegates to `retryAdminEmailIntent()`, which records its own immutable retry audit action without creating target activity or another email intent. This is the only Branch 3 write path from the read-only target detail. Failed password-reset rows display future-action copy only; a fresh-token reset resend is deferred to the separately designed Branch 5 operation.

## Safe metadata

Before/after snapshots and other admin metadata must be plain JSON-compatible data. The shared validator snapshots caller-owned data, rejects cycles, accessors, non-finite numbers, deep or oversized payloads, strings over 500 characters, more than 50 aggregate entries, and restricted field names matching password, token, secret, backup, payment method, or clinical-record concepts such as SOAP, intake, journal, and ROM.

Store only the minimum operational facts needed to explain the change. Do not store credentials, authentication artifacts, payment-method details, clinical notes, intake responses, journals, ROM sessions, or other PHI. Internal notes are not a substitute for a clinical or billing-data store.

## Serial rollout

Branch 2 is the foundation owner for authorization, audit, activity, email intents, and capability-aware dashboard access. Branch 3 consumes those owners and completed Tasks 7-9: the full-Admin directory, bounded account detail, signed-in Account Activity, safe aggregate dashboard metrics, and the existing audited failed-email retry seam. Branch 4 owns the completed delegated-role mutation/UI and shared JWT invalidation seam that Branch 5 security actions will reuse. Do not develop serial branches concurrently or copy foundation files into a stale worktree.
