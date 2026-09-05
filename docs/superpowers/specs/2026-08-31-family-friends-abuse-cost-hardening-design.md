# Family-and-Friends Abuse and Cost Hardening Design

Date: 2026-08-31

Status: Approved for implementation on 2026-08-31

Implementation baseline: `codex/family-friends-feedback` at `6af8a7f4b2bbb9bf30af48b25b1f78bd3c2ee379`

## Purpose

Protect the public MassageLab experiences most likely to create avoidable database, provider, or email cost before the family-and-friends release. The safeguards must preserve the intended anonymous experiences, avoid collecting new identifying data, and give a real person useful retry guidance instead of making the site appear broken.

This design covers:

- Anatomime room creation, joining, realtime-token issuance, and fallback polling;
- public booking availability, guest booking, and guest waitlist writes;
- anonymous donation Checkout creation;
- privacy-safe problem-report ingestion into Sentry; and
- a deployment-wide outbound email ceiling behind the existing per-account and per-network auth limits.

The work is additive to the approved family-and-friends readiness program. It does not replace the identity, membership, navigation-feedback, or server-path work already reviewed in the five-PR stack.

## Release position

The hardening stack belongs after the existing family-and-friends PR stack and before exact-candidate release proof. No intermediate hardening commit is deployed.

The sequence is:

1. review and merge the four hardening PRs described here in dependency order;
2. apply the one new additive operational-limiter migration to the exact Production direct target under separate authorization;
3. prove the combined exact candidate;
4. perform an ordinary separately authorized deploy of that exact candidate while preserving current membership writer authority; and
5. run separately authorized real login and soft-launch checks.

The five identity and membership migrations and their bridge ceremony are complete in Production, with membership webhook writes enabled. At design time, the then-current Production baseline had all 45 baseline migrations current. This design adds one separately gated Layer A migration as the pending 46th migration; it does not modify or replay the five applied migrations or repeat the completed pause/drain/unpause ceremony.

## Goals

- A small household or trusted test group can use every in-scope public feature normally.
- Low-frequency writes and provider calls have a finite, deployment-wide ceiling; high-frequency fallback polling has bounded local shedding and fewer database operations.
- Duplicate booking and donation submissions do not create duplicate durable work.
- Quota records contain no raw email, account ID, IP address, room code, player ID, or practice ID. Random UUID request IDs may be stored only as non-identifying idempotency owners in existing domain rows.
- A limiter outage cannot silently permit unbounded provider or write traffic.
- Route-handler rate limits include `Retry-After`; Server Actions return the same delay as structured data, and every client visibly backs off.
- The implementation uses Neon and existing application infrastructure; it does not add Redis, Upstash, a new paid provider, or a provider-side mutation.

## Non-goals

This work does not:

- change account-linking, login, membership, price, tax, entitlement, or subscription rules;
- add booking payments or place clinical or PHI-bearing content in hosted storage;
- pause donations or other public functionality by default;
- add marketing analytics, user tracking, CAPTCHA, device fingerprinting, or raw-address logs;
- configure Vercel WAF, Stripe, Sentry, Resend, Neon, R2, or another provider;
- send an email, create a Stripe Checkout Session, make a payment, or emit a provider event during tests;
- merge, push, deploy, or apply a migration without the separately required authorization; or
- claim that application limits replace provider spend controls. Provider alerts and hard spending controls remain an operator task.

## Shared operational limiter

### Data model

One additive migration creates a separate operational limiter instead of widening `AuthRateLimitBucket`. Auth credential limits and operational-cost limits have different policy owners and must remain independently reviewable.

```prisma
enum OperationalRateLimitScope {
  GLOBAL
  NETWORK
  ACCOUNT
  RESOURCE
}

model OperationalRateLimitBucket {
  id           String                    @id @default(cuid())
  policy       String
  scope        OperationalRateLimitScope
  keyHash      String
  count        Int                       @default(0)
  windowStart  DateTime                  @default(now())
  blockedUntil DateTime?
  updatedAt    DateTime                  @updatedAt

  @@unique([policy, scope, keyHash])
  @@index([updatedAt])
  @@index([blockedUntil])
}
```

The migration is expansion-only. It creates the limiter enum, bucket table, unique key, and cleanup indexes. It also adds three nullable `AdminEmailIntent` delivery-claim columns, creates the unique `deliveryClaimOperationKeyHash` index, creates the append-only `AdminEmailRetryOperationKey` table and its indexes, and attaches its `RESTRICT` foreign key to `AdminEmailIntent`. It does not change or backfill existing row values.

A count-only Production `AdminEmailIntent` row-count preflight is mandatory immediately before applying `20260831120000_operational_rate_limit_bucket`. Proceed only when the refreshed exact count is `0`; any nonzero result is a hard stop requiring re-review before migration or runtime deployment. To close a writer race after that separate read, the migration takes an access-exclusive table lock and atomically validates a temporary false constraint while the lock is held. Any intervening row aborts and rolls back the migration; the temporary constraint is dropped before the successful transaction commits. PostgreSQL permits multiple `NULL` values in the unique claim-operation-key index, so nullable expansion values do not collide. The exact-zero gate is deliberately stronger than that uniqueness prerequisite: it verifies the expected pre-claim-aware rollout state and forces non-concurrent index lock/application-plan re-review if any row exists.

### Privacy boundary

The only subject identifier stored by the limiter is:

`HMAC-SHA256(AUTH_SECRET, "operational-rate-limit:v1" + policy + scope + normalizedSubject)`

Each field is length-delimited before hashing so different tuples cannot collide through concatenation. The policy registry owns subject normalization. Account emails use the canonical email normalizer; account IDs, network identifiers, room/player identifiers, practice IDs, and global literals use bounded trimmed values. Composite resource subjects are built from labeled, length-delimited components before the HMAC.

`AUTH_SECRET` owns limiter pseudonyms only. Rotating it intentionally starts a fresh quota namespace and leaves old rows inert until bounded cleanup. That controlled reset is documented in the deployment change. Durable booking, waitlist, Anatomime, and Stripe idempotency never depend on `AUTH_SECRET`, so a normal secret rotation cannot create a new operation identity.

The service reuses the existing server-owned network-identity boundary in `lib/auth-request.ts`. Production trusts the platform-owned forwarding header contract; the limiter never writes that address to the database or logs it.

No request body, email, address, room code, player ID, practice ID, Checkout Session ID, or Sentry payload is stored in a limiter row. Expected limiter denials are intentionally silent at the shared mail boundary so attacker-triggered requests cannot amplify into unbounded logging or Sentry cost. Any future aggregate or sampled caller telemetry may include only the allowlisted mail class/policy and reason, never recipient, subject, or decision details; it must also exclude subject keys and hashes.

### Policy registry and transactions

Callers request an allowlisted operation, not an arbitrary policy name or limit. Each operation expands to one or more fixed rules. A rule defines its policy key, scope, limit, window, and normalized subject source.

Every distinct scope/window has its own versioned key, such as `donation.network.15m.v1` and `donation.network.24h.v1`. Two windows never share a database identity. A reviewed threshold or window change uses a new policy version so old counts cannot be misinterpreted; old versions become cleanup-only rows.

All rules for one request are checked and consumed in one Serializable transaction with the repository's bounded retry behavior. The transaction:

1. reads every required bucket;
2. returns the latest applicable block without changing any bucket if one rule is already exhausted;
3. resets expired windows;
4. increments every permitted bucket atomically; and
5. sets `blockedUntil` to the end of the fixed window when the accepted request consumes the last permitted slot.

A denied decision returns at least one second of `Retry-After`. Serialization retries are bounded. If the limiter or its database transaction is unavailable after bounded retries, in-scope provider calls and durable writes fail closed with a generic `503` before the expensive action.

Definition/normalization failures and persistence/retry failures return the same public `UNAVAILABLE` decision. A privacy-safe diagnostic is emitted at most once per runtime for each finite key comprising a known allowlisted operation (or the fixed `UNKNOWN` label) and failure class `DEFINITION` or `PERSISTENCE`. The diagnostic includes only that operation label and failure class; it never includes a subject, hash, request, error, or decision data.

Stale buckets older than their active window receive randomized, bounded cleanup of at most 100 rows. Cleanup is best effort and cannot reverse an already committed allow or deny decision. No request-derived value is logged when cleanup fails.

### Exact policy table

Every limit below is inclusive: the listed number of requests may proceed within the fixed window, and the next request is denied until that window expires.

| Operation | Authenticated subject rules | Anonymous or shared rules |
| --- | --- | --- |
| Anatomime room create | 6/account/15m; 20/account/24h | 15/network/15m; 40/network/24h; anonymous callers also 5/network/15m and 15/network/24h |
| Anatomime room join | same limits as anonymous because a participant is not trusted before joining | ingress 30/network/15m and 100/network/24h before auth/body/room work; verified room resource 20/network+room/10m after validation and before transaction/write |
| Anatomime realtime token | 6/player/10m | ingress 120/network/10m before auth/preflight; verified room start 60/network+room/10m after a narrow lookup proves the room exists; 40/room/10m after joined proof |
| Anatomime unjoined lookup | none | 60/network+room/10m |
| Booking availability | 40/account+practice/5m | 60/network+practice/5m; authenticated callers use a 120/network+practice/5m household ceiling instead |
| Booking create | 3/account-or-guest+practice/30m; 8/account-or-guest+practice/24h | 12/network+practice/30m; 30/network+practice/24h |
| Waitlist join | 2/account-or-guest+practice/30m; 4/account-or-guest+practice/24h | 12/network+practice/30m; 30/network+practice/24h |
| Donation Checkout | 6/account/15m; 20/account/24h | anonymous 5/network/15m and 15/network/24h; all callers 15/network/15m, 40/network/24h, and 100/global/24h |
| Problem report | none | 5/network/10m; 50/global/10m; 250/global/24h |
| Public-auth email attempt | existing account/network auth limits remain | 70/global/24h plus the total email ceiling |
| Any email attempt | none | 90/global/24h |

For room creation, an authenticated caller consumes the account rules plus the broader shared network rules; an anonymous caller consumes the stricter anonymous network rules plus the shared rules. This permits a normal household while bounding one account and one network independently.

The public-auth email cap of 70 and total email cap of 90 leave at least 20 daily attempts available for security and account-change messages when public-auth traffic reaches its cap. Security mail may use unused capacity above 20, but no category can exceed the total ceiling.

The limits are code-owned launch defaults. Each `24h` rule is one fixed 24-hour limiter window rather than a claim about an arbitrary rolling interval. Changing a limit or window requires tests, a new policy version, and review; no environment variable silently widens it.

## Anatomime traffic hardening

### Participant proof and token issuance

Room creation validation remains unchanged, then consumes the applicable quota before room creation. Join ingress consumes only the network policies before session/auth lookup, JSON body parsing, or room service work. Missing, malformed, and admission-denied join attempts therefore charge only network ingress and never allocate an attacker-selected room bucket. After room validation and admission, the pre-persist hook consumes the verified network+room resource policy immediately before transaction/write; that ingress charge remains if a later stage fails, and the two stages are independently atomic. Public room selectors normalize into the existing canonical six-character uppercase alphanumeric code namespace; longer formatted inputs cannot create a second selector after the sixth canonical character. Both the read-only join preflight and the transactional revalidation call one pure snapshot-and-clock resolver for credential ownership, `canJoinRoom`, and team availability, while the transaction remains authoritative. Guest players keep the existing opaque `x-anatomime-player-token` credential in the current browser storage boundary. Signed-in players prove ownership through their authenticated user-to-player mapping. Player IDs are selectors, not credentials, because room summaries expose them.

Realtime-token issuance no longer trusts a caller-supplied Ably `clientId`. It consumes the network ingress quota before session/auth work, builds the viewer, and runs one narrow preflight before any room-scoped accounting or provider work. A missing room returns `404` after only the network ingress charge, so rotating misses cannot create unbounded room keys. Once the narrow preflight proves the room is found, it consumes the network+room token-start quota before rejecting `UNJOINED` or `INVALID`; only `JOINED` proof consumes player and room issue quotas and reaches Ably. The proof uses `anatomimeViewerFromRequest` and existing room authority to require either the authenticated user mapping or the matching guest player ID plus `x-anatomime-player-token`, and derives the Ably client ID from that database row. A caller cannot mint a token for an exposed player ID or a room they have not joined.

Room and player lookup failures use the existing generic public errors. Limiter failures do not disclose whether a room or player exists.

### Fallback polling

Ably remains the primary update path. Polling remains a recovery path and is made less expensive and more predictable:

- active play polls every 2 seconds;
- lobby, review, and other idle shared-room states poll every 5 seconds;
- a hidden document polls every 15 seconds;
- failures back off through 2, 4, 8, 16, and 30 seconds with bounded positive jitter that remains present at the terminal step while the final delay stays capped at 30 seconds;
- `429` honors a nonnegative `Retry-After` floor capped separately at 10 minutes before another request, allowing the durable 10-minute unjoined-lookup quota to impose meaningful backpressure;
- `404` stops polling and returns the existing room-ended/not-found guidance; and
- an invalid authenticated mapping or guest player token stops automatic retry and offers the existing rejoin path.

A poll first calls `consumeIngress` with `{ networkIdentifier, roomIdentifier, now }`. In one synchronous decision it evaluates a 300/network/10s network-ingress candidate plus any existing 150/network+room/10s and 300/room/10s entries as peek-only rules without incrementing the tuple or room. If any candidate blocks, or if adding the network key would exceed the 4,096-entry capacity, it mutates nothing; otherwise it creates or increments only the HMAC-reduced network ingress key. This is best-effort protection per warm runtime, not deployment-wide enforcement. An ingress denial makes no credential or room lookup. After an allowed consume, one room query loads the snapshot needed for both authoritative viewer classification and any eventual public summary. A pre-resolution guard classifies that same snapshot before expiration or presence writes; polling does not issue a separate narrow preflight query.

When that loaded-snapshot classification proves `JOINED`, exactly one `consumeJoined` call receives `networkIdentifier`, `roomIdentifier`, `playerId`, and `now`, then synchronously and atomically checks every applicable network+room, room, and player rule before mutating its instance-local map. If any rule denies, it increments none; only when all rules allow does it increment every applicable counter and permit expiration/presence resolution and summary of the same snapshot. The synchronous check-then-mutate operation contains no `await`, so a single shedder instance cannot expose a partial charge between rules.

A missing or failed credential classification consumes/checks the durable network+room unjoined quota inside the same pre-resolution guard. Missing credentials may then receive the allowed public room projection; failed credentials receive generic rejoin guidance. Once that durable bucket denies, repeated bogus player/token candidates stop after the sole room read but before expiration/presence resolution or summary.

`UNJOINED` and `INVALID` durable quota semantics remain unchanged: both consume/check `ANATOMIME_UNJOINED_LOOKUP` after classification of the sole loaded snapshot and before any public projection, presence work, or rejoin result. They do not call `consumeJoined`.

Valid high-frequency polls do not write durable limiter rows. The bounded instance-local fast bucket consumes 300/network-ingress/10s before lookup and, for joined polls, atomically consumes 20/player/10s, 150/network+room/10s, and 300/room/10s. It stores only HMAC-reduced keys and drops expired keys under a fixed retention cap. Together with the slower client cadence and existing high-entropy guest credential, this sheds accidental loops and single-instance floods without replacing the current presence write with two contended Neon limiter writes on every poll. The local map remains best-effort per warm runtime rather than a deployment-wide ceiling. Shedder initialization uses the canonical configured auth-secret resolver, including its `NEXTAUTH_SECRET` fallback. If that shedder cannot initialize, the route stays fail closed and emits one fixed structured privacy-safe error diagnostic per runtime without the caught error, name, message, stack, secret, request, or any identifier. Deployment-wide durable limits remain on room creation, joining, token starts/issuance, and unjoined lookups. Provider-side edge controls remain defense in depth, not a prerequisite for local implementation.

On the ordinary accepted poll path, validation, resolution, and summary use the same loaded snapshot with no second room read. A post-rollback idle-expiry zero-row conflict is the only exception: it performs exactly one authoritative winner reread and accepts that graph only when it exists and is already `EXPIRED`, or when its `expiresAt` is strictly later than the attempt's captured `now`. A future-extended winner supplies the current access and presence decision, so credentials proven only by the stale graph grant neither player/host access nor a presence write. A missing reread or a non-`EXPIRED` graph whose deadline is still overdue returns generic `503`; the reread does not repeat the pre-resolution guard or its quota charge. The route never preflights one room snapshot and then reads another after presence work. A first lookup with no snapshot exposes an accessible loading status. If that lookup fails, the failure remains visible and the room-code entry panel returns as an escape path; ordinary background polls do not announce loading.

Presence remains useful without writing on every poll. `lastSeenAt` is updated at most once per player per 15 seconds through a conditional update. Polls inside that interval can return current room state without another presence write. The implementation must not turn a valid fallback poll into more database operations than the current double-hydration path.

### Anatomime responses

Accepted reads retain the existing response shape. Route-level quota denials return `429`, `Retry-After`, and generic busy guidance. Durable limiter unavailability returns `503` before the protected work; the in-memory valid-poll shedder has no external dependency. No response includes quota keys, counts for other users, or internal provider state.

## Public booking hardening

### Availability reads

The booking picker keeps a 350ms client debounce and cancels superseded availability requests. The server validates the public practice and bounded selector shape, then consumes the availability quota before calling the sequence solver or loading provider, policy, resource, and calendar data.

The rate-limit subject combines the account and practice for authenticated callers, or the platform network identity and practice for anonymous callers. Limiter failure returns a generic temporary-unavailable result and performs no expensive availability query. An already cached complete public availability result may be served for up to 60 seconds during a limiter outage; a miss or incomplete result fails closed. The cache contains only the existing public projection and never client contact data.

### Booking and waitlist idempotency

The browser creates a cryptographically random UUID for each booking or waitlist submission and includes it as `requestId`. The server accepts only canonical UUIDv4. Because the UUID is random and carries no identity, a versioned operation prefix plus the UUID becomes the request owner: `public-booking-v1:<uuid>:` or `public-waitlist-v1:<uuid>:`. The concrete existing-row ID appends a SHA-256 digest of the length-delimited, non-identifying immutable booking selection. The digest excludes email, account ID, practice-client ID, names, notes, and all other identifying or free-text data. Authoritative row ownership is compared separately. This makes same-request/same-selection replay distinct from same-request/changed-selection conflict without depending on a rotating secret.

Existing `BookingGroup.id` and `BookingWaitlistEntry.id` fields therefore own idempotency without a second receipt table, another migration, or a rotation-sensitive HMAC. The stored domain row remains authoritative for the account/practice-client owner and immutable payload; a different caller who somehow reuses an operation ID receives generic conflict guidance and no existing result data. The server compares rows by the versioned UUID prefix and never exposes the stored digest.

After bounded form validation, the action performs one narrow first request-prefix lookup. The same request ID, owner, practice, and immutable payload returns the existing successful result without consuming a new quota or creating more calendar events, appointments, notifications, route revalidations, or Google Calendar pushes. The same operation ID with a different owner or immutable payload fails with generic conflict guidance.

On a first-lookup miss, the action enters the outer bounded Serializable transaction, acquires a transaction-scoped PostgreSQL prefix advisory lock derived from the request prefix, and performs the authoritative second prefix lookup. A match or conflict returns from that locked recheck without quota or downstream work. Only the still-true remaining miss may call `consumeOperationalRateLimitInTransaction` on the same `Prisma.TransactionClient` to consume `BOOKING_CREATE` or `WAITLIST_JOIN` before heavy availability, contact, calendar, event, or notification work. This transaction-scoped limiter entry point reuses the operational limiter's rule/key/decision core but does not open a nested transaction; limiter persistence errors propagate through the outer bounded Serializable transaction so limiter updates and domain writes roll back and retry together. The allowed path completes all database-only work in that transaction. Google Calendar pushes and route revalidation remain post-commit work for a newly created row only.

This serializes simultaneous submissions that reuse one UUID even when their payload digests differ; same-payload requests converge on one result, while changed-payload requests conflict. A concurrent same-request contender waits for the lock and returns from the authoritative second prefix lookup without consuming new quota. A failed transaction creates neither an idempotency owner nor committed quota and may be retried with the same request ID.

The immutable comparison includes selected services, add-ons, pressure, requested start or preferred window, provider preference, and the canonical booking client owner. It excludes mutable server-generated timestamps and delivery outcomes. A replay intentionally does not repeat the current best-effort Google Calendar push after a post-commit crash; existing calendar sync/reconciliation remains the repair owner. Tests lock down that suppression so a retry cannot duplicate provider work.

Booking and waitlist submissions remain Next.js Server Actions. They return a typed result union to `useActionState`: success navigation, validation error, conflict, rate limited with `retryAfterSeconds`, or temporarily unavailable. They do not pretend to expose an HTTP status/header through the Server Action transport. The client keeps the same request ID across rate-limit, unavailable, and ambiguous outcomes and rotates it only after definitive success or a deliberate new submission.

Only a still-true miss after the locked authoritative recheck consumes booking or waitlist quota, in the same transaction, before availability recomputation, contact-owner creation, calendar locks, event writes, or notifications. Route revalidation and Google Calendar work occur only after that new transaction commits. A denied or unavailable limiter creates no booking, waitlist, calendar, notification, or sync work.

## Donation Checkout hardening

The pricing client creates a cryptographically random UUIDv4 `checkoutAttemptId`, stores it in session storage, and injects it into the existing form. The same ID survives rate-limit, limiter-unavailable, timeout, generic provider-error, and Checkout redirect round trips for less than 23 hours 55 minutes. It rotates at or beyond 23 hours 55 minutes, after a confirmed success/cancel return, a definitive invalid/conflicting request, or deliberate “start a new attempt.” JSON clients have the same reuse contract. The five-minute margin below Stripe's documented 24-hour pruning floor prevents MassageLab from promising reuse at the provider boundary and matches the repository's established replay convention.

The Stripe idempotency key is `massagelab-donation-v1:<checkoutAttemptId>`. The random UUID is non-identifying, stable across network changes, independent of secret rotation, and short enough for the provider boundary. Repeating the same attempt and parameters returns Stripe's idempotent result; reusing the attempt with changed parameters is mapped to generic conflict guidance and does not create another Session. MassageLab's replay guarantee is bounded to the 23-hour-55-minute application attempt window and remains below the provider's confirmed idempotency retention floor.

Quota is consumed before constructing the Stripe client or making a provider call. JSON denial returns `429` with `Retry-After`, and JSON limiter unavailability returns `503`. The native form preserves its transport by redirecting with `303` to fixed pricing notices for rate-limited, unavailable, or conflicting outcomes; it never navigates the browser to a raw error body. Neither denial path calls Stripe. Existing origin validation, amount allowlist, tax behavior, success/cancel destinations, and support-only donation semantics remain unchanged.

Tests use a stubbed Stripe boundary and assert both the idempotency key contract and zero provider calls on denied, invalid, or unavailable-limiter paths. No live or test Checkout Session is created by this work.

## Durable problem-report limit

The current process-local `Map` is removed as the authoritative problem-report limiter. Existing payload-size, category, area, route-normalization, and privacy-scrubbing checks remain ahead of capture. Trusted same-origin validation and exact JSON content-type validation are new explicit requirements: an untrusted origin returns `403`, an unsupported content type returns `415`, and neither consumes quota or calls Sentry.

After cheap validation, the route consumes 5/network/10m, 50/global/10m, and 250/global/24h atomically. A denied request returns `429` with `Retry-After`; limiter unavailability returns `503`. Neither path initializes Sentry capture or flush work.

An accepted attempt consumes quota before Sentry capture. A provider capture or flush failure does not refund the quota, because automatic retries could otherwise amplify provider traffic. Sentry receives only the already approved privacy-safe payload. No message, route parameter, contact field, raw network address, or diagnostic body enters the limiter.

## Global email backstop

### Classification

All outbound SMTP attempts pass through the existing narrow `sendMail` boundary. After validating the mail class and SMTP configuration, it consumes the total email ceiling before constructing the transporter or calling `transporter.sendMail`; denied or unavailable decisions return `{ delivered: false }` without constructing a transporter. Its internal input requires an allowlisted `PUBLIC_AUTH` or `SECURITY` class and has no default. An unknown runtime value fails closed with `{ delivered: false }`.

Admin email intents cannot hold their existing interactive transaction open while
the mail boundary consumes the deployment-wide quota: that would nest a second
database transaction before SMTP and can exhaust a constrained connection pool.
The same pending additive migration therefore adds nullable
`deliveryClaimTokenHash`, `deliveryClaimExpiresAt`, and unique
`deliveryClaimOperationKeyHash` fields to `AdminEmailIntent`, and adds an
append-only `AdminEmailRetryOperationKey` owner in that same migration. Each
owner stores only the domain-separated retry operation-key hash, binds it to one
intent, and is never deleted, including after finalization. Admin delivery uses
a short transaction to claim one eligible `PENDING` or `FAILED` intent, commits,
calls the ordinary classified mail boundary, and then uses a second short
transaction to finalize the exact claim. The stored status remains `PENDING` or
`FAILED` while claimed so existing Activity meaning and retry eligibility do not
acquire a fourth transient status. Claims use a separate domain-separated
SHA-256 hash of 32 random bytes and a five-minute lease; raw claim tokens are
never stored or logged, and raw retry operation keys never enter active claim
state or the append-only owner. Exact finalization stores the raw retry key only in
the existing `AdminAction.idempotencyKey` audit owner. Claim transactions make no
SMTP call; provider delivery begins only after the claim transaction commits, while
a competing invocation that observes the live claim remains non-sending. After expiry, the same retry key may recover its claim, or a fresh key
from a regenerated Activity form may create another permanent owner for the
same intent and replace the active claim. Every reserved key remains forbidden
from claiming a different intent. The independent random claim token prevents
stale-finalizer ABA, so a stale finalizer after provider contact is reported as
ambiguous without overwriting a replacement claim. Exact finalization clears
only the active claim fields and atomically writes the retry audit; all hashed
key-owner history remains.

Verification, verification resend, password reset, password setup, and a dedicated existing-account registration-notice wrapper always pass `PUBLIC_AUTH` and also consume the 70/day ceiling. Account-method changes, password-change/recovery notices, two-factor notices, and durable admin security notifications always pass `SECURITY` and consume only the 90/day total ceiling. `sendAccountChangeEmail` remains security-only; registration no longer reuses it.

Existing registration, reset, Google-intent, login, and two-factor account/network limits remain unchanged. The global backstop supplements them; it does not weaken or replace them.

### Delivery semantics

Quota is charged for an actual transport attempt, not for an account-enumeration-safe request that finds no eligible recipient. SMTP-not-configured development behavior makes no provider attempt and consumes no production quota.

If the limiter is exhausted or unavailable, the mail boundary returns `{ delivered: false }` without constructing a transporter or contacting SMTP. Existing public flows retain their enumeration-safe response. Already committed account or security mutations remain committed; durable security-email intents retain their failed/retryable outcome instead of rolling back the account change.

The request path does not automatically retry SMTP. A later explicit or durable retry is a new attempt and must consume quota again. Provider errors remain reduced to the existing generic delivery failure and cannot leak recipient or transport details.

## User experience contract

Every in-scope route-handler `429` response includes an integer `Retry-After` header. Booking and waitlist Server Actions return the same integer as `retryAfterSeconds` in their typed result. Native donation forms use fixed `303` pricing notices, while JSON donation clients receive the header. Anatomime create and join clients preserve a usable positive integer delay and use one shared 10-second manual-action fallback for missing or unusable headers. A delayed create-countdown effect immediately synchronizes its display clock and allocates an interval only while the deadline remains active. Their transport and response-body parsing share a 20-second deadline while caller-owned cancellation propagates unchanged; a stalled transport or successful JSON body clears pending state into fixed ambiguous-outcome guidance and that same cooldown. Expiry unlocks create/join without replaying the request. Because create/join writes are not idempotent, the guidance truthfully warns that an explicit retry may create another room or guest if the first request committed without a confirmed response. Realtime setup uses a separate 10-second overall deadline for token transport, successful token JSON, and shared Ably-script readiness. Timeout or failure leaves polling active without replaying the token request, and a cancelled caller removes only its own listeners without removing or marking the shared script failed. Controls do not spin indefinitely or silently resubmit.

`503` or the corresponding structured/redirect outcome means the protective boundary could not make a safe decision. The user sees a temporary-unavailable message and a manual retry action. Durable or provider-creating actions do not retry automatically when their result could be ambiguous.

No error tells an anonymous caller whether an email, account, room participant, practice client, subscription, or provider object exists.

## Four-PR implementation topology

The implementation is kept below CodeRabbit's 100-file review limit and split by dependency and risk.

### PR A: operational limiter and email ceiling

Branch: `codex/family-friends-05-abuse-cost-foundation`

Base: `codex/family-friends-feedback` at `6af8a7f4`

Owns:

- the additive Prisma enum, model, and migration;
- the allowlisted privacy-safe operational limiter service;
- transaction, retry, cleanup, and `Retry-After` contracts;
- the total and public-auth email ceilings; and
- focused schema, service, concurrency, privacy, and mail tests.

### PR B: Anatomime traffic

Branch: `codex/family-friends-06-anatomime-traffic`

Base: reviewed PR A head

Owns room-create/join limits, existing-credential-bound realtime tokens, durable unjoined limits, instance-local valid-poll shedding, single hydration, coalesced presence, client cadence/backoff, and focused route/browser tests.

### PR C: booking traffic

Branch: `codex/family-friends-07-booking-traffic`

Base: reviewed PR B head

Owns availability quotas and debounce, guest/account booking and waitlist quotas, deterministic idempotency owners, duplicate convergence, and focused action/browser tests.

### PR D: public provider ingress

Branch: `codex/family-friends-08-public-ingress`

Base: reviewed PR C head

Owns donation quotas and Stripe idempotency, durable problem-report limits, and provider-stubbed route/browser tests.

Each PR receives its own task review and CodeRabbit review. Findings are fixed on the owning branch before the next dependency is finalized. The final combined head receives a whole-stack review and exact-candidate validation. No intermediate PR is deployed.

## Test strategy

Implementation follows strict test-driven development: each behavior starts with a focused failing test, the minimum production change makes it pass, and refactoring follows under green focused tests.

### PR A proof

- migration and Prisma schema exactness;
- HMAC domain separation and absence of raw subjects;
- window reset, final-slot, `Retry-After`, and multi-bucket atomicity;
- concurrent same-bucket consumption and bounded Serializable retry;
- fail-closed database errors and bounded stale cleanup;
- mandatory mail classification, exhaustive fixed-wrapper coverage, public-auth reserve, and total email ceiling;
- no SMTP construction or call when denied or unavailable; and
- unchanged existing auth-rate-limit behavior.

### PR B proof

- room creation and join limits run before durable room/player work;
- arbitrary exposed player IDs without the authenticated mapping or matching guest player token cannot receive realtime tokens or joined-poll treatment;
- token client identity is derived from the joined player;
- realtime-token issuance uses the narrow preflight and stops invalid proof before issue quota or provider work;
- token, unjoined-poll, and instance-local valid-poll limits return exact retry guidance;
- bogus player/token poll candidates classify against the sole fully loaded room snapshot; durable unjoined denial stops before expiration, presence, or summary;
- one accepted poll performs one room hydration;
- presence writes occur no more than once per 15 seconds;
- client cadence, hidden-document behavior, jittered backoff, `404`, `429`, and invalid-proof behavior; and
- intercepted browser tests make no real Ably call.

### PR C proof

- availability limits run before the sequence solver and expensive reads;
- authenticated household and anonymous practice scopes stay independent;
- a concurrent same-request booking or waitlist contender returns from the authoritative second prefix lookup without consuming new quota or replaying provider work;
- changed payload under the same operation ID conflicts;
- concurrent duplicates recover their unique race and create one group/entry and one set of downstream rows;
- denied or unavailable limits create no contact, calendar, notification, sync, or revalidation work; and
- intercepted browser tests cover pending, retry, and conflict guidance.

### PR D proof

- invalid origin/body/amount/attempt IDs make no limiter or Stripe call;
- denied or unavailable limits make no Stripe call;
- same donation attempt uses the same Stripe key and changed parameters do not create another Session;
- problem-report origin/content-type checks run before quota, and limits survive fresh route instances;
- denied or unavailable reports make no Sentry capture/flush call;
- accepted failed capture remains charged; and
- existing problem-report privacy payload tests stay green.

### Combined gate

The final exact head must pass:

- `npm run prisma:validate`;
- `npm run prisma:generate`;
- focused hardening tests;
- `npm run typecheck`;
- `npm run lint`;
- `npm run test` with the documented Windows-only AtmoShaper fingerprint baseline distinguished from new failures;
- `npm run build`;
- the relevant intercepted Browser QA lanes;
- `git diff --check`; and
- hosted Linux CI and CodeRabbit review on each PR and the combined stack.

No test uses a Production database, private row, real email, real Sentry event, or live/test Stripe Session.

## Rollout and rollback

After all four PRs merge, the new migration is applied once to the configured Production direct Neon target under an exact-target, migration-only authorization. Migration status must report all migrations current before any runtime deployment.

The five identity and membership migrations and their bridge ceremony are already complete, and membership webhook writes are enabled. Layer A does not repeat the pause/drain/unpause ceremony. After its migration is current and the exact candidate is proven, the exact combined SHA receives an ordinary separately authorized deployment that preserves current membership writer authority. No limiter row or provider event is manually fabricated in Production.

Operational verification uses aggregate status only: expected `429`/`503` handling, absence of unexpected provider calls, migration current, and ordinary low-volume success. It does not expose limiter keys, IP addresses, account data, database rows, or provider secrets.

Rollback returns only to a migration-compatible, bridge-capable runtime. The additive limiter table remains in place. If a launch-default limit proves too tight, the reviewed code constant is adjusted in a new change; operators do not disable the limiter or widen it through an unreviewed environment value.

## Operator-owned prerequisites outside this branch

Before sharing beyond the controlled release, the operator still needs to confirm provider-side cost controls that application code cannot set safely without separate authorization:

- Vercel plan and Spend Management alerts/hard limit;
- Neon compute/storage budget visibility and alerts;
- Resend quota, verified sending domain, SPF/DKIM/DMARC, and bounce/complaint health;
- Sentry quota, retention, and alert posture;
- R2 usage visibility; and
- the exact Google OAuth Production callback.

These are release-checklist inputs, not blockers to writing and locally testing the hardening code. Any provider setting change remains a separately described and authorized action.

## Acceptance criteria

The design is complete when:

- low-frequency writes and provider calls use deployment-wide, privacy-safe protection before expensive work, while valid Anatomime polls use bounded local shedding plus structural database-work reduction;
- normal family-and-friends use remains within the documented thresholds;
- Anatomime tokens require joined-player proof and fallback polling has bounded cadence, cost, and recovery;
- booking and waitlist retries converge on one durable result;
- donation retries use one opaque Stripe idempotency key and denied paths never call Stripe;
- problem-report limits survive serverless instance changes and denied paths never call Sentry;
- outbound mail cannot exceed 90 provider attempts in one fixed 24-hour email-ceiling window, mandatory classification prevents public auth from consuming the final 20 attempts, and unknown classes fail closed;
- all rate-limit and outage paths provide visible, accessible recovery guidance;
- the four PRs remain independently reviewable and under CodeRabbit's file limit;
- the exact final head passes the local, hosted, browser, migration, and review gates; and
- no push, merge, migration, deployment, provider mutation, email, or payment action occurs without its required authorization.
