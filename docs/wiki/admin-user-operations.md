# Admin User Operations

This page defines the authorization and evidence boundary for MassageLab account support. The current branch supplies roles, guards, audit records, target-visible activity, durable account-change email intents, a capability-aware Admin dashboard, the full-Admin user directory, bounded account detail, and explicit confirmed Access/Security controls.

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

`User.authSessionVersion` is the canonical JWT invalidation owner. Auth.js copies the current database value into a newly issued JWT and requires later requests to present that exact version. A role or security action increments the value in the same transaction as its account mutation and evidence bundle, immediately invalidating every existing non-matching token; Auth.js signs the user out when that token next reaches a successful database-backed refresh. Legacy JWTs without a version remain valid only while the account value is zero.

Prisma `Session` rows are still deleted for adapter compatibility, but that deletion does not revoke JWT cookies and its row count is not an active JWT-session count. MassageLab's stateless JWT strategy cannot report an exact number of active browser sessions, so current and future Admin copy must not present deleted `Session` rows as users or JWT sessions signed out.

## Delegated anatomy role controls

The target account's Access section lets a freshly verified full Admin assign or revoke only Anatomy Reviewer and Anatomy Editor. It shows the stored current state and exact planned state, requires an allowlisted support reason and explicit confirmation that existing sign-in tokens will be invalidated, and submits one server-generated UUID unchanged. Pending or otherwise unsupported assignment evidence renders read-only and must be refreshed or resolved before mutation. Full `ADMIN`, retired `ANATOMY_ADMIN`, and generic `EDITOR` are never grantable from this surface.

The role record, `authSessionVersion` increment, adapter-session deletion, immutable Admin action, target-visible activity, and durable email intent share one transaction. Transport begins only after commit. An exact role replay enters the same intent lock and attempts initial delivery only while the intent remains `PENDING`, which recovers a process stop between commit and transport. A `FAILED` intent is never resent by initial delivery and remains exclusive to the audited Activity retry; a `DELIVERED` intent never resends. Delivery failure therefore reports that the role changed, existing sign-in tokens were invalidated immediately, and the user will be signed out on the next successful database-backed session refresh; it never reports a rollback that did not happen. Replay-specific copy reports the notification outcome without claiming another mutation or sign-out. An unavailable recipient, another non-attempted result, or an unconfirmed transport exception directs Admin to inspect Activity without promising that a retry control exists.

## Audit, activity, and email boundaries

An account mutation and its evidence bundle belong in one caller-owned database transaction:

1. `AdminAction` is the immutable operator record. It stores actor, target, action kind, support reason, bounded before/after snapshots, outcome, and one idempotency key.
2. `UserAccountActivity` is the target account's durable, user-visible explanation of what changed. It must reference the same target and action.
3. `AdminEmailIntent` is the durable account-change notification intent. It must reference the same target and action. Email transport occurs only after the mutation transaction succeeds.

The database relations reject cross-target bundles. Exact idempotent replays return the existing record; a reused key with different immutable input fails closed. Delivery and explicit retries serialize per intent, and retry requires a freshly verified full Admin. Password-reset mail uses its separate security flow and cannot be delivered or retried through account-change intents.

Email delivery is at-least-once. A process can stop after the provider accepts a message but before the database transaction records delivery, so an authorized retry can send a duplicate. Do not describe this contract as exactly-once.

## Background-credit goodwill controls

The target account's Access section offers a full Admin only positive goodwill grant when the target has a verified email and the bounded wallet projection is usable. Self-target grants are allowed because this operation cannot lock out the operator. The form offers `1`, `2`, `5`, and `10` presets and a custom whole-number amount from `1` through `25`; it never offers subtraction, a negative adjustment, or replacement of the exact balance.

Before confirmation, the form shows the target, prepared balance, Admin delta, and resulting balance. An existing wallet previews `current + amount`. If the verified target has no wallet, the persistence comparison remains `0`, while the form explicitly shows the canonical automatic verified-account allocation of `+2` before the Admin delta and previews `2 + amount`. The hidden prepared balance therefore remains `0`; the service provisions the initial grant and returns the actual previous balance of `2`. Missing, malformed, or unverified evidence fails closed instead of becoming an inferred zero.

The route-bound action starts with `requireFullAdminUser()`, then validates the hidden target, stable server-rendered UUID, strict integer amount, nonnegative prepared balance, shared allowlisted reason, optional note of at most 500 characters, required `OTHER` note, and explicit confirmation. It delegates exactly one mutation to `grantAdminBackgroundCredits()`; wallet, immutable credit entry, commerce event, Admin action, target Activity, and email intent stay in the service's serializable transaction.

After commit, the route action invokes `deliverAdminEmailIntent()` and revalidates the target Access and Activity views plus `/admin/users`. A replay may recover one initial attempt only while the intent is still `PENDING`; `FAILED` is not automatically retried, and `DELIVERED` never resends. Mutation and notification outcomes use separate copy. The controlled fields remount on fresh operation/balance evidence so a consumed amount, reason, note, or confirmation cannot authorize another grant, while the outer live-result owner remains stable across revalidation.

## Security remediation controls

The target account's Security section is available only after a fresh full-Admin database guard. Self-target detail is read-only. The page shows only provider types, bounded connection-row evidence, verified-email/password/2FA booleans, the canonical JWT invalidation explanation, and an explicitly compatibility-only count of unexpired Prisma `Session` rows. It never renders password values or hashes, reset tokens or links, encrypted 2FA material, backup/recovery codes, session tokens, provider account identifiers, or impersonation controls.

Three bounded operations reuse the shared reason allowlist, optional 500-character note, stable server-rendered UUID, pending disablement, accessible live result, and route-target binding:

1. **Revoke sign-in tokens and sessions** requires explicit confirmation plus the prepared `authSessionVersion` and compatibility Session-row count. The service increments the version atomically and deletes adapter rows, but UI copy never calls the deleted count active JWT sessions or users signed out.
2. **Send password reset** requires explicit confirmation and a verified target email. The security service creates a fresh standard reset token, stores only its hash, writes the immutable action/activity/`PASSWORD_RESET` marker, and performs standard reset-mail delivery after commit. The server action result reports delivered, failed, pending, and replay truth without calling account-change intent delivery; the immutable `AdminAction` remains `SUCCEEDED`. If delivery is attempted but its separate status update fails, the durable intent remains `PENDING` and the revalidated action warns Admin to inspect Activity before creating another request.
3. **Reset two-factor authentication** is available only when 2FA is enabled and requires the Admin to type the exact normalized target email. The service deletes enabled 2FA and recovery material, increments the JWT version, removes compatibility sessions, and writes the evidence bundle atomically.

Revoke and 2FA reset call the locked initial `deliverAdminEmailIntent()` owner only after their transaction commits. An exact replay may recover a still-`PENDING` initial delivery. `FAILED` is not auto-retried, and `DELIVERED` never resends. Mutation/token-invalidation results remain distinct from notification outcomes.

## Activity surfaces and retry boundary

The signed-in Account Activity tab queries only its own newest fifty `UserAccountActivity` entries. Its payload contains only the entry ID, title, explanation, effective value, and occurrence time. It never includes the operator, internal note, snapshots, email recipient/content, delivery failure details, or other Admin-only fields.

The full-Admin detail Activity section may show the linked email intent's safe kind, delivery state, failure code, attempt count, and last-attempt/delivery times. Retry is an explicit server action only for a `FAILED` non-password intent; it begins with `requireFullAdminUser()` and delegates to `retryAdminEmailIntent()`, which records its own immutable retry audit action without creating target activity or another email intent. A failed password-reset row instead offers `Send a new reset link`; that form receives a fresh server-rendered operation key and calls `sendAdminPasswordReset()` to create a new reset token, action, activity, and intent. It never calls `retryAdminEmailIntent()` and never retries old token material.

## Safe metadata

Before/after snapshots and other admin metadata must be plain JSON-compatible data. The shared validator snapshots caller-owned data, rejects cycles, accessors, non-finite numbers, deep or oversized payloads, strings over 500 characters, more than 50 aggregate entries, and restricted field names matching password, token, secret, backup, payment method, or clinical-record concepts such as SOAP, intake, journal, and ROM.

Store only the minimum operational facts needed to explain the change. Do not store credentials, authentication artifacts, payment-method details, clinical notes, intake responses, journals, ROM sessions, or other PHI. Internal notes are not a substitute for a clinical or billing-data store.

## Serial rollout

Branch 2 is the foundation owner for authorization, audit, activity, email intents, and capability-aware dashboard access. Branch 3 consumes those owners and completed Tasks 7-9: the full-Admin directory, bounded account detail, signed-in Account Activity, safe aggregate dashboard metrics, and the audited failed-email retry seam. Branch 4 owns the completed delegated-role mutation/UI and shared JWT invalidation seam. Branch 5 Tasks 12-13 own the bounded security services and confirmed Security/Activity controls. Branch 6 owns the canonical positive-only background-credit service and the confirmed Access/Activity flow described above. Do not develop serial branches concurrently or copy foundation files into a stale worktree.
