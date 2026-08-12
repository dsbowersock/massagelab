# Admin User Operations

This page defines the authorization and evidence boundary for MassageLab account support. The current branch supplies roles, guards, audit records, target-visible activity, durable account-change email intents, a capability-aware Admin dashboard, the full-Admin user directory, bounded account detail, and explicit confirmed Access, Security, credit, and temporary-access controls.

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

The route-bound action starts with `requireFullAdminUser()`, then validates the hidden target, stable server-rendered UUID, strict integer amount, nonnegative prepared balance, shared allowlisted reason, optional note of at most 500 characters, required `OTHER` note, and explicit confirmation. It delegates exactly one production mutation to `grantAdminBackgroundCredits()`; wallet, immutable credit entry, commerce event, Admin action, target Activity, and email intent stay in the service's serializable transaction. Tests, documentation checks, and source-contract QA do not themselves perform live database or email mutations.

After commit, the route action invokes `deliverAdminEmailIntent()` and revalidates the target Access and Activity views plus `/admin/users`. A replay may recover one initial attempt only while the intent is still `PENDING`; `FAILED` is not automatically retried, and `DELIVERED` never resends. Mutation and notification outcomes use separate copy. The controlled fields remount on fresh operation/balance evidence so a consumed amount, reason, note, or confirmation cannot authorize another grant, while the outer live-result owner remains stable across revalidation.

## Temporary feature access

Temporary access is a full-Admin-only, append-only support source for exactly five low-risk feature keys:

- `premium_backgrounds` — Premium backgrounds
- `therapist_documentation_tools` — Therapist documentation tools
- `calendar_basic_scheduling` — Basic calendar scheduling
- `calendar_full_scheduling` — Full calendar scheduling
- `external_calendar_sync` — External calendar sync

The grant surface never offers `chimer_custom_colors`, `practice_management`, `calendar_team_scheduling`, `cloud_storage`, `phi_storage_tools`, or any other feature. A target must have a freshly verified usable email and a safe complete active-grant snapshot. Self-target grants are allowed. The form offers `7`, `30`, and `90` day presets plus a custom whole-number duration from `1` through `365`; it derives start and expiration preview from one server request time, uses the shared support reason and optional 500-character note, retains one server-rendered UUID, and requires explicit confirmation. Changing feature or duration clears that confirmation.

Each route action starts with `requireFullAdminUser()` before parsing, binds the submitted target to the route, validates the stable UUID, exact feature or grant, duration, sorted per-feature active-grant IDs, reason/note, and confirmation, then calls exactly one canonical grant or revoke service. The service compares the optimistic snapshot and preserves exact replay evidence. A revocation always appends a `TemporaryFeatureGrantRevocation`; it never updates or deletes the original grant. Overlapping grants stay independently visible and revocable, while membership and other temporary sources continue to contribute to effective access. Operator copy therefore describes one temporary source and never promises global feature removal.

Expiration uses the half-open request-time predicate `startsAt <= now`, `expiresAt > now`, and `revocation: null`. Account and authorization loaders evaluate it on each request, so access disappears automatically at expiration without a scheduler. Account Membership lists every active temporary feature label and expiration without grant IDs, actor IDs, internal notes, or idempotency keys. Admin detail shows only bounded feature/start/expiration evidence, reports the displayed and total counts truthfully, and withholds mutation controls when the bounded rows are truncated or otherwise cannot prove a complete snapshot.

The user directory accepts only `temporaryAccess=active`, `temporaryAccess=none`, or no filter and applies the same active predicate to both forward and previous cursor queries. Full-Admin directory and dashboard metrics count active temporary grants—not users—and separately count grants expiring before the exclusive end of the named 30-day operator window. One captured request time owns both count predicates.

After a committed grant or revocation, the action calls the locked initial `deliverAdminEmailIntent()` owner and revalidates target detail, `/admin/users`, `/admin`, and `/account` even when delivery cannot be confirmed. An exact replay may recover only a still-`PENDING` initial delivery; `FAILED` does not auto-resend and `DELIVERED` never resends. Mutation, replay, and notification copy remain distinct. Self-target delivery messages direct Admin to inspect Activity without promising the retry control that self detail does not render.

## Security remediation controls

The target account's Security section is available only after a fresh full-Admin database guard. Self-target detail is read-only. The page shows only provider types, bounded connection-row evidence, verified-email/password/2FA booleans, the canonical JWT invalidation explanation, and an explicitly compatibility-only count of unexpired Prisma `Session` rows. It never renders password values or hashes, reset tokens or links, encrypted 2FA material, backup/recovery codes, session tokens, provider account identifiers, or impersonation controls.

Three bounded operations reuse the shared reason allowlist, optional 500-character note, stable server-rendered UUID, pending disablement, accessible live result, and route-target binding:

1. **Revoke sign-in tokens and sessions** requires explicit confirmation plus the prepared `authSessionVersion` and compatibility Session-row count. The service increments the version atomically and deletes adapter rows, but UI copy never calls the deleted count active JWT sessions or users signed out.
2. **Send password reset** requires explicit confirmation and a verified target email. The security service creates a fresh standard reset token, stores only its hash, writes the immutable action/activity/`PASSWORD_RESET` marker, and performs standard reset-mail delivery after commit. The server action result reports delivered, failed, pending, and replay truth without calling account-change intent delivery; the immutable `AdminAction` remains `SUCCEEDED`. If delivery is attempted but its separate status update fails, the durable intent remains `PENDING` and the revalidated action warns Admin to inspect Activity before creating another request.
3. **Reset two-factor authentication** is available only when 2FA is enabled and requires the Admin to type the exact normalized target email. The service deletes enabled 2FA and recovery material, increments the JWT version, removes compatibility sessions, and writes the evidence bundle atomically.

Revoke and 2FA reset call the locked initial `deliverAdminEmailIntent()` owner only after their transaction commits. An exact replay may recover a still-`PENDING` initial delivery. `FAILED` is not auto-retried, and `DELIVERED` never resends. Mutation/token-invalidation results remain distinct from notification outcomes.

Successful use of either an ordinary self-service or Admin-requested reset link has one separate atomic consumption boundary. It changes the account's password credential, consumes the submitted link and every other outstanding reset link for that account, increments `User.authSessionVersion` exactly once, and deletes Prisma `Session` rows for adapter compatibility in the same transaction. A rollback leaves the previous credential, token states, version, and compatibility sessions unchanged. Concurrent use permits only one successful password change; another submitted link cannot win after the first transaction consumes all outstanding links.

Reset-link consumption does not create an Admin action, target Activity entry, or account-change email intent. For an Admin-requested reset, the immutable request-time evidence remains the sole Admin evidence bundle; consumption creates no second bundle. The version increment invalidates existing JWTs immediately in version terms, and Auth.js observes it when an old token next reaches a successful database-backed refresh. The Prisma `Session` delete count remains adapter-compatibility evidence only and must never be described as active JWTs or users signed out.

## Stripe invoice-credit goodwill

Billing detail offers a freshly verified full Admin one positive USD invoice-credit operation only when local and provider reads prove exactly one Stripe Customer and one active or trialing Supporter subscription. The read-only preview verifies customer/subscription identity, mode, USD currency, non-debit customer balance, and next-invoice projection. The page shows the target, safe local subscription amount and interval when configured, subscription status, current Stripe credit, projected next invoice, requested credit, and resulting credit. It never displays provider IDs, payment instruments, raw payloads, coupons, trial controls, renewal-date controls, debit, or reversal actions.

The form permits `$1`, `$2`, `$5`, `$10`, `$20`, and `$50` presets plus a custom `$0.01`-`$100.00` amount. The projected-invoice shortcut appears only for `1` through `10,000` cents. Confirmation requires a shared support reason and bounded note, the exact normalized target email, the exact two-decimal dollar amount, the expected current credit, and one server-rendered UUID that remains the Stripe idempotency key. Every action begins by reloading full-Admin authority and binding the submitted target to the route.

The local operation exists before provider mutation. `FAILED_BEFORE_MUTATION` means the provider create call did not begin. `PREPARED`, `APPLIED`, and `RECONCILIATION_REQUIRED` form one canonical unresolved set because a process can stop after durable preparation, after recording a known provider transaction, or while authoritative settlement remains incomplete. Exact apply replays of any unresolved state stay visible and actionable. Every unresolved row sends no user notification and presents exactly one Reconcile action. That action requires the Admin to freshly type the exact normalized target email and exact stored two-decimal dollar amount; a fresh server-rendered confirmation nonce resets both fields on revalidation. The server independently reloads and validates the route-owned operation, target email, stored amount, and original idempotency key before calling reconciliation. A known transaction ID is read back without creating again and is validated against its immutable historical ending balance rather than the Customer's possibly changed current balance. Any current full Admin may reconcile an orphaned operation, while the shared evidence bundle remains attributed to the originating Admin and immutable request. A no-ID replay can create only before the conservative 23-hour-55-minute margin and rereads the clock immediately before creation; crossing the margin leaves safe manual reconciliation and makes zero create calls. It never invents a second key or blindly creates another credit.

Directory filters and dashboard totals count the full unresolved set, while directory rows show only aggregate counts. Billing detail reads at most 26 local recovery rows, renders the newest 25 with their local recovery state, and warns when older unresolved evidence is omitted. It never exposes Stripe Customer, subscription, or balance-transaction identifiers.

Only `VERIFIED` creates or recovers the shared Admin action, target Activity, and email intent. Initial delivery runs after that local bundle commits and retains the existing `PENDING`/`FAILED`/`DELIVERED` lock semantics. Apply and reconciliation feedback remains mounted outside the conditionally revalidated preview and unresolved rows, so the returned outcome stays visible even when a successful refresh removes its source card; freshly keyed confirmation fields still reset. Correcting a mistaken live credit is not an ordinary UI operation and requires a separate documented recovery action.

Automated tests inject Stripe stubs. Browser QA requires the disposable database sentinel and uses a deterministic read-only preview fixture whose balance-transaction methods throw; both actions also return a safe operator-visible failure for that exact disposable identity before service invocation or real Stripe-client construction. The acceptance spec checks presentation and exact confirmation, instruments form submissions and matching POST requests, and asserts zero. This guard remains inactive for ordinary tests, non-fixture identities, and Vercel Production. Before any mutation, the service reloads the authoritative subscription and requires its actual Stripe currency to be `usd`; a stale form pointing at a non-USD subscription fails before provider creation. The required test-mode integration proof completed on 2026-08-11: the selected subscribed account was cloned into a disposable database branch and linked only there to a disposable non-live Customer/active USD subscription; the real service applied `$0.01`, authoritative readback proved the negative USD balance transaction and matching Customer balance, local state reached `VERIFIED`, Activity was present, and the `example.test` email intent remained unattempted. The disposable Stripe and database resources were deleted after evidence capture. Live keys additionally require `NODE_ENV=production`, exact `VERCEL_ENV=production`, and `ADMIN_BILLING_GOODWILL_LIVE_ENABLED=true`; preview or missing Vercel identity fails closed. Enabling that flag or issuing a live credit requires separate user authorization naming the account and amount.

## Activity surfaces and retry boundary

The signed-in Account Activity tab queries only its own newest fifty `UserAccountActivity` entries. Its payload contains only the entry ID, title, explanation, effective value, and occurrence time. It never includes the operator, internal note, snapshots, email recipient/content, delivery failure details, or other Admin-only fields.

The full-Admin detail Activity section may show the linked email intent's safe kind, delivery state, failure code, attempt count, and last-attempt/delivery times. Retry is an explicit server action only for a `FAILED` non-password intent; it begins with `requireFullAdminUser()` and delegates to `retryAdminEmailIntent()`, which records its own immutable retry audit action without creating target activity or another email intent. A failed password-reset row instead offers `Send a new reset link`; that form receives a fresh server-rendered operation key and calls `sendAdminPasswordReset()` to create a new reset token, action, activity, and intent. It never calls `retryAdminEmailIntent()` and never retries old token material.

## Safe metadata

Before/after snapshots and other admin metadata must be plain JSON-compatible data. The shared validator snapshots caller-owned data, rejects cycles, accessors, non-finite numbers, deep or oversized payloads, strings over 500 characters, more than 50 aggregate entries, and restricted field names matching password, token, secret, backup, payment method, or clinical-record concepts such as SOAP, intake, journal, and ROM.

Store only the minimum operational facts needed to explain the change. Do not store credentials, authentication artifacts, payment-method details, clinical notes, intake responses, journals, ROM sessions, or other PHI. Internal notes are not a substitute for a clinical or billing-data store.

## Serial rollout

Branch 2 is the foundation owner for authorization, audit, activity, email intents, and capability-aware dashboard access. Branch 3 owns the full-Admin directory/detail, Account Activity, metrics, and audited retry seam. Branch 4 owns delegated-role mutation and JWT invalidation. Branch 5 owns security services and Security/Activity controls. Branch 6 owns positive-only background-credit grants. Branch 7 owns temporary feature access. Branch 8 owns Stripe invoice-credit preview, apply, reconciliation, UI, test-mode proof, and the separate live gate. Do not copy foundation files into a stale worktree or treat non-live automated evidence as the required test-Customer proof.
