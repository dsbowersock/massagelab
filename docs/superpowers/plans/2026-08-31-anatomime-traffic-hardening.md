# Anatomime Traffic Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound Anatomime room, token, and fallback-poll traffic while preserving anonymous rooms and making every delay or terminal condition visible to the player.

**Architecture:** Put durable quotas before low-frequency room writes and realtime-provider token work. Prove joined-player identity before using an exposed player ID: realtime-token issuance uses one narrow query, while fallback polling classifies the one loaded room snapshot that it will also summarize. Keep normal joined polling off the durable limiter by using a non-consuming instance-local ingress peek followed by one atomic joined HMAC consume, reduce every post-peek poll to one room read, coalesce presence writes, and replace fixed client intervals with a status-aware scheduler.

**Tech Stack:** Next.js route handlers, React 19, Prisma 7, Ably boundary, Node.js 24 tests, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-08-31-family-friends-abuse-cost-hardening-design.md`

## Global constraints

- Branch: `codex/family-friends-06-anatomime-traffic`, based on the exact reviewed PR A head.
- Import only PR A's `consumeOperationalRateLimit` public boundary; do not choose policy keys or thresholds here.
- Do not add or change schema/migrations.
- Player IDs and room codes remain public selectors, never credentials. Authenticated user mapping wins; guest proof requires the stored player selector plus matching opaque token.
- Do not write raw network, room, or player identifiers into the local shedder; use HMAC-reduced keys only.
- Normalize every public room selector by trim, uppercase, non-alphanumeric removal, and a final six-character cap so all consumers share the canonical room-code namespace.
- Valid joined polls use local shedding, not durable quota rows. Unjoined/bogus lookup traffic uses the durable limiter.
- Tests must stub Ably and intercept browser traffic; no real provider call.
- Do not push, merge, deploy, apply migrations, or change provider settings.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `lib/anatomime-traffic-server.ts` | Narrow realtime-token preflight, loaded-room poll classification, PR A decision mapping, local poll shedding, presence coalescing. |
| `lib/anatomime-api.ts` | Generic `429`/`503` mapping and integer `Retry-After`. |
| `lib/anatomime-room-server.ts` | Pre-persist guards, one-hydration load, coalesced in-memory presence update. |
| `app/api/anatomime/sessions/route.ts` | Room-create quota after validation and before persistence. |
| `app/api/anatomime/sessions/[code]/join/route.ts` | Room-join quota before persistence. |
| `app/api/anatomime/sessions/[code]/realtime-token/route.ts` | Joined-player proof and two-stage token quota. |
| `app/api/anatomime/sessions/[code]/route.ts` | Local shedding, same-snapshot proof, durable bogus/unjoined protection, one room read. |
| `app/anatomime/anatomime-polling.ts` | Fetch result classification and pure next-poll scheduling. |
| `app/anatomime/shared-session-client.tsx` | Credential-bound token request, player polling, terminal/retry UI. |
| `app/anatomime/host-room-client.tsx` | Host scheduler adoption. |
| `app/anatomime/anatomime-game-client.tsx` | Create retry lockout and visible guidance. |
| `tests/anatomime-traffic-server.test.mjs` | Server primitive privacy, proof, quota, cap, and presence contracts. |
| `tests/anatomime-traffic-routes.test.mjs` | Create/join/token/poll order and zero-work denial. |
| `tests/anatomime-polling.test.mjs` | Cadence, jitter, `Retry-After`, and terminal scheduling. |
| `tests/browser/anatomime-traffic.spec.ts` | Desktop/mobile intercepted browser recovery proof. |

## Interfaces

Create `lib/anatomime-traffic-server.ts`:

```ts
export type AnatomimeViewerPreflight =
  | { kind: "ROOM_NOT_FOUND" }
  | { kind: "JOINED"; roomId: string; roomIdentifier: string; playerId: string }
  | { kind: "UNJOINED"; roomId: string; roomIdentifier: string }
  | { kind: "INVALID"; roomId: string; roomIdentifier: string }

export function normalizeAnatomimeRoomIdentifier(value: string): string

export async function preflightAnatomimeViewer(
  code: string,
  viewer: ViewerContext,
  options?: { prismaClient?: AnatomimeTrafficPrismaClient },
): Promise<AnatomimeViewerPreflight>

export function preflightLoadedAnatomimeViewer(
  room: AnatomimeRoomWithRelations,
  viewer: ViewerContext,
): Exclude<AnatomimeViewerPreflight, { kind: "ROOM_NOT_FOUND" }>

export class AnatomimeTrafficLimitError extends Error {
  status: 429 | 503
  retryAfterSeconds?: number
}

export async function requireAnatomimeOperationalAllowance(
  input: OperationalRateLimitRequest,
  consume?: typeof consumeOperationalRateLimit,
): Promise<void>

export type AnatomimePollShedDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export function createAnatomimePollShedder(options: {
  secret: string
  maxEntries?: number
}): {
  peekIngress(input: { networkIdentifier: string; roomIdentifier: string; now?: Date }): AnatomimePollShedDecision
  consumeJoined(input: { networkIdentifier: string; roomIdentifier: string; playerId: string; now?: Date }): AnatomimePollShedDecision
  readonly size: number
}

export async function coalesceAnatomimePlayerPresence(input: {
  prismaClient?: Pick<PrismaClient, "anatomimeRoomPlayer">
  roomId: string
  playerId: string
  lastSeenAt: Date
  now?: Date
}): Promise<Date | null>
```

The database-backed realtime-token preflight selects only room `id`/normalized `code` and candidate player `id`, `roomId`, `userId`, and `guestTokenHash`. It never selects teams, runs, guesses, scores, elections, metadata, or room projections. Polling instead calls the pure loaded-room classifier from `loadAnatomimeRoom`'s pre-resolution guard, so validation and quota decisions reuse the sole snapshot later passed to the summarizer rather than issuing a second query.

Create `app/anatomime/anatomime-polling.ts`:

```ts
export type AnatomimeRoomFetchResult =
  | { kind: "SUCCESS"; session: AnatomimeRoomSummary }
  | { kind: "RATE_LIMITED"; retryAfterSeconds: number }
  | { kind: "ROOM_ENDED" }
  | { kind: "REJOIN_REQUIRED" }
  | { kind: "FAILED" }

export async function fetchAnatomimeRoomSnapshot(input: {
  code: string
  credentials?: { playerId: string; token: string }
  fetcher?: typeof fetch
  signal?: AbortSignal
}): Promise<AnatomimeRoomFetchResult>

export function nextAnatomimePollSchedule(input: {
  result: AnatomimeRoomFetchResult
  roomStatus?: string
  roomPhase?: string
  documentHidden: boolean
  consecutiveFailures: number
  random?: () => number
}):
  | { action: "SCHEDULE"; delayMs: number; consecutiveFailures: number }
  | { action: "STOP"; reason: "ROOM_ENDED" | "REJOIN_REQUIRED" }
```

Scheduling is exactly 2 seconds for `PLAYING`/`ACTIVE_TERM`, 5 seconds for lobby/review/other idle states, 15 seconds for a hidden successful page, and 2/4/8/16/30 seconds plus bounded positive jitter for failures with a 30-second cap. The terminal failure step retains jitter by shifting its jitter range below that cap instead of clamping every random result to the same value. A `429` waits at least its nonnegative integer `Retry-After`, capped at 30 seconds; `404` and credentialed `401/403` stop.

---

### Task 1: Add bounded traffic primitives

**Files:**
- Create: `tests/anatomime-traffic-server.test.mjs`
- Create: `lib/anatomime-traffic-server.ts`
- Modify: `lib/anatomime-api.ts`

- [ ] **Step 1: Write RED coverage**

Prove authenticated mapping precedence, matching guest selector/token proof, `INVALID` mismatches, `UNJOINED` absence, one exact narrow query, PR A denial/unavailability mapping, six-character room-selector normalization and long-input collisions, non-consuming ingress peeks, atomic joined local rule checks, final-slot behavior, integer retries, HMAC-only map keys, expiry pruning, 4,096-entry cap, and 15-second presence coalescing. Specifically prove `consumeJoined` receives network, room, and player identifiers; atomically checks the network+room, room, and player rules; and increments none when any rule denies.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/anatomime-traffic-server.test.mjs
```

Expected: missing module/exports.

- [ ] **Step 3: Implement the minimum primitives**

Local fixed-window limits are 150 per network+room/10s, 300 per room/10s, and 20 per joined player/10s. `peekIngress` checks the ingress-facing network+room and room rules without incrementing them. `consumeJoined` synchronously checks all applicable network+room, room, and player rules before incrementing any, increments none on denial, and increments all applicable rules only on allowance. Keep this check-and-mutate path synchronous with no `await` so one shedder instance applies the joined decision atomically. Prune expired entries before insertion; when the 4,096 active-entry cap is full, fail closed without evicting an active quota. Map operational `RATE_LIMITED` to 429 and `UNAVAILABLE` to 503 with generic copy.

Presence uses one conditional `updateMany` at or after 15 seconds and no write inside the window.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/anatomime-traffic-server.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(anatomime): add bounded traffic protection primitives`

### Task 2: Limit room creation and joining before persistence

**Files:**
- Create: `tests/anatomime-traffic-routes.test.mjs`
- Modify: `lib/anatomime-room-server.ts`
- Modify: `app/api/anatomime/sessions/route.ts`
- Modify: `app/api/anatomime/sessions/[code]/join/route.ts`

```ts
type AnatomimePersistGuard = () => Promise<void>

export async function createAnatomimeRoom(
  input: unknown,
  hostUserId?: string | null,
  options?: { beforePersist?: AnatomimePersistGuard },
)

export async function joinAnatomimeRoom(
  code: string,
  input: unknown,
  userId?: string | null,
  options?: { beforePersist?: AnatomimePersistGuard },
)
```

- [ ] **Step 1: Write route RED coverage**

Assert invalid create/join consumes no quota; allowed quota precedes code lookup/transaction; 429/503 creates no room/player work; authenticated create supplies account plus shared network rules; join uses only network plus normalized room selector before membership proof.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/anatomime-traffic-routes.test.mjs
```

Expected: no operational calls, pre-persist guard, or retry mapping.

- [ ] **Step 3: Add the guards at the validated mutation boundary**

For create, run existing setup/deck validation, then `beforePersist`, then uniqueness lookup/transaction. For join, run existing room/input/status/team/re-entry validation, then `beforePersist`, then transaction revalidation and write. Resolve credential ownership, `canJoinRoom`, and team availability through one pure snapshot-and-clock helper in both phases so the predicates cannot drift, while the transaction's fresh snapshot and clock remain authoritative.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/anatomime-traffic-routes.test.mjs tests/anatomime-room-rules.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(anatomime): limit room creation and joining`

### Task 3: Bind realtime tokens to proven joined players

**Files:**
- Modify: `tests/anatomime-traffic-routes.test.mjs`
- Modify: `app/api/anatomime/sessions/[code]/realtime-token/route.ts`
- Modify: `app/anatomime/shared-session-client.tsx`

- [ ] **Step 1: Add realtime-token RED cases**

Prove arbitrary body `clientId` cannot mint; signed-in mapping and matching guest proof succeed; signed Ably identity equals the database player ID; start denial stops before preflight; invalid proof stops before issue quota/Ably; issue denial stops before Ably; 429 includes exact `Retry-After`.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/anatomime-traffic-routes.test.mjs --test-name-pattern="realtime token"
```

Expected: current route trusts caller `clientId` and performs no proof or quota.

- [ ] **Step 3: Implement the proof order**

Normalize code and consume `ANATOMIME_REALTIME_TOKEN_START`; build the viewer; run narrow preflight; require `JOINED`; consume `ANATOMIME_REALTIME_TOKEN_ISSUE` with proven database `playerId`/`roomId`; then call the stubbed token boundary. The browser sends `x-anatomime-player-id` and `x-anatomime-player-token` and no body `clientId`.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/anatomime-traffic-routes.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `fix(anatomime): bind realtime tokens to joined players`

### Task 4: Protect polling and remove duplicate hydration

**Files:**
- Modify: `tests/anatomime-traffic-routes.test.mjs`
- Modify: `tests/anatomime-traffic-server.test.mjs`
- Modify: `app/api/anatomime/sessions/[code]/route.ts`
- Modify: `lib/anatomime-room-server.ts`

```ts
export async function loadAnatomimeRoom(
  code: string,
  viewer?: ViewerContext,
  options?: {
    now?: Date
    beforeResolve?: (room: AnatomimeRoomWithRelations) => Promise<void> | void
  },
)
```

- [ ] **Step 1: Write poll/presence RED coverage**

Prove the non-consuming `peekIngress` denial makes no credential or room lookup and changes no local counter. After an allowed peek, prove exactly one room read supplies the same loaded snapshot for both authoritative viewer classification and the final summary. The pre-resolution guard must call one `consumeJoined` for a `JOINED` viewer with `networkIdentifier`, `roomIdentifier`, and `playerId`; it atomically checks network+room, room, and player rules and increments none when any rule denies. Denied joined, unjoined, or invalid requests may have completed that sole read, but must stop before expiration/presence resolution and summary. Prove an allowed joined consume increments every applicable counter and accepted credentialed polls perform no durable quota write. Bogus candidates use the same loaded-snapshot classification plus durable quota; invalid proof still returns generic rejoin guidance; presence writes at most once per player/15s.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/anatomime-traffic-routes.test.mjs --test-name-pattern="poll"
node --test tests/anatomime-traffic-server.test.mjs --test-name-pattern="presence"
```

Expected: direct hydration, invalid proof hydration, unconditional presence write, and second full reload.

- [ ] **Step 3: Implement the ordered poll pipeline**

Run the non-consuming `peekIngress({ networkIdentifier, roomIdentifier, now })` first; denial makes no credential or room lookup. Build the viewer, then call `loadAnatomimeRoom` once with a `beforeResolve` guard. The guard classifies the viewer against that already-loaded snapshot before expiration or presence writes. For `JOINED`, it calls exactly one `consumeJoined({ networkIdentifier, roomIdentifier, playerId, now })`; that synchronous operation atomically checks all network+room, room, and player rules, increments none if any rule denies, and increments all of them only when all allow. For `UNJOINED` or `INVALID`, durable quota semantics remain unchanged: the guard consumes `ANATOMIME_UNJOINED_LOOKUP`; invalid then returns generic 403, while missing credentials may receive the public projection after allowance. Neither path calls `consumeJoined`. After an allowed guard, resolve/coalesce presence and summarize that same loaded snapshot, with no second room query. Replace unconditional presence update/reload with conditional coalescing and update only that player's in-memory `lastSeenAt` after a successful write.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/anatomime-traffic-server.test.mjs tests/anatomime-traffic-routes.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `perf(anatomime): shed polls and coalesce presence`

### Task 5: Add bounded polling recovery

**Files:**
- Create: `tests/anatomime-polling.test.mjs`
- Create: `app/anatomime/anatomime-polling.ts`
- Modify: `app/anatomime/shared-session-client.tsx`
- Modify: `app/anatomime/host-room-client.tsx`
- Modify: `app/anatomime/anatomime-game-client.tsx`
- Create: `tests/browser/anatomime-traffic.spec.ts`

- [ ] **Step 1: Write scheduler RED coverage**

Assert active/idle/hidden cadence, deterministic failure sequence with injected randomness, positive jitter at the terminal failure step, 30-second cap, a `Retry-After` floor bounded by that cap, and terminal 404/rejoin stop.

- [ ] **Step 2: Run unit RED**

```powershell
node --test tests/anatomime-polling.test.mjs
```

Expected: no scheduler and fixed 1.5-second loops.

- [ ] **Step 3: Implement scheduler and client adoption**

Use self-scheduling timeouts with abortable fetches; reset failures on success; never automatically replay create/join/token after a terminal or ambiguous result. Keep status messages in an accessible live region and disable controls only through the accepted retry window. While the first lookup has no snapshot, announce `Loading shared game…`; if it fails, retain accessible failure feedback and restore the room-code entry panel as an escape path. Scheduled background polls stay quiet.

- [ ] **Step 4: Run unit GREEN and browser RED/GREEN**

```powershell
node --test tests/anatomime-polling.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/anatomime-traffic.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Use `page.clock.install()`/`fastForward()` and intercepted routes. Prove token credential headers/no `clientId`, 2s/5s/15s cadence, 2/4/8/16/30 failure recovery, `Retry-After`, terminal guidance, create/join retry lockout, and zero Ably/provider traffic.

- [ ] **Step 5: Run existing journeys**

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium --project=mobile-chromium
```

- [ ] **Step 6: Review and commit**

Commit: `feat(anatomime): add bounded polling recovery`

### Task 6: Record evidence and exact-head proof

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Record receipts**

Record the exact PR A base, focused totals, browser projects, one-hydration/presence-write receipts, provider-stub boundary, and no schema/provider/live action.

- [ ] **Step 2: Run the PR gate**

```powershell
node --test tests/anatomime-traffic-server.test.mjs tests/anatomime-traffic-routes.test.mjs tests/anatomime-polling.test.mjs tests/anatomime-shared.test.mjs tests/anatomime-room-rules.test.mjs tests/anatomime-page-lazy-boundary.test.mjs tests/anatomime-invite-qr.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/anatomime-traffic.spec.ts tests/browser/public-routes.spec.ts --project=desktop-chromium --project=mobile-chromium
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

- [ ] **Step 3: Review and commit**

Commit: `docs: record Anatomime traffic hardening evidence`

## Completion receipts

- Exposed player IDs cannot mint tokens without joined-player proof.
- Low-frequency writes/provider tokens are quota-protected before protected work.
- Valid joined polls use a non-consuming ingress peek followed by one atomic network+room, room, and player consume that increments no counter on denial, one full hydration, and at most one presence write per 15 seconds.
- Clients visibly honor cadence, backoff, `Retry-After`, room-ended, and rejoin states.
- No schema change or real Ably/provider action occurred.
