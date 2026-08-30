# Server Path and Cost Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove avoidable work from the signed-in request path, make launch-path work measurable, and add independent server-enforced pause controls for registration and new Supporter Checkout.

**Architecture:** Keep verified-account provisioning at account lifecycle boundaries and use the existing idempotent backfill as repair instead of repairing on every JWT refresh. Carry already-computed feature keys through the Auth.js token/session so the sidebar does not query entitlements again, add a read-only anonymous timing harness, and centralize two fail-safe pause flags that leave existing login, recovery, entitlements, and Portal access untouched.

**Tech Stack:** Next.js 16 App Router, React 19, Auth.js 5 beta JWT sessions, Prisma 7 with pooled Neon runtime access, Node.js 24 tests, Playwright 1.60, Stripe 22, Vercel environment configuration, and Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`

## Global Constraints

- Execute this plan after the identity, subscription, and feedback plans; rebase its paths against those reviewed heads before editing, while preserving the interfaces named below.
- Preserve existing users, subscriptions, purchases, background-credit wallets, feature-key entitlements, login/recovery, and the billing Portal.
- Do not run credit backfill, migration deployment, provider mutation, load test, or live Checkout while implementing this plan.
- Runtime Prisma traffic must continue to use the pooled Neon connection. Direct connections remain limited to migrations and bounded maintenance scripts.
- Do not cache or reuse account, authentication, subscription, or entitlement state across users.
- Do not add product analytics, session replay, individual request histories, emails, account IDs, cookies, or PHI to measurement output.
- The first timing sample is labeled `first`, not guaranteed to be a provider cold start; later samples are labeled `warm`. Do not claim more than the harness proves.
- Registration and Checkout pause decisions are server-enforced. Client rendering is explanatory defense in depth, not the security boundary.
- A registration pause must not disable login, Google login for existing accounts, verification, password reset, or account recovery.
- A Checkout pause must not revoke existing access or disable the customer billing Portal.
- Use strict TDD and focused JSDoc for new shared helpers; each task ends in an independently reviewable commit.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `scripts/family-friends-route-timings.mjs` | Read-only, allowlisted route timing harness with bounded samples and no response-body logging. |
| `tests/family-friends-route-timings.test.mjs` | Argument, allowlist, request-count, and sanitized-output contract. |
| `tests/family-friends-server-workload.test.mjs` | Repeatable before/after database/provider call-count receipt for auth, sidebar, membership status, Checkout, and Portal boundaries. |
| `package.json` | Adds the named measurement and self-contained production-build receipt commands. |
| `lib/auth-users.ts` | Keeps verified role/email refresh separate from initial credit provisioning and returns computed feature keys without session-refresh repair. |
| `lib/auth-method-intents.ts` | Identity-plan service that provisions only a newly created verified Google user. |
| `app/api/account/security/password/route.ts` | Stops using later password addition/change as a credit-repair path. |
| `auth.ts` | Carries feature keys through JWT and Session with a fail-closed empty fallback. |
| `types/next-auth.d.ts` | Declares the feature-key token/session contract. |
| `components/sidebar/sidebar.tsx` | Uses session feature keys instead of reloading persisted entitlements. |
| `tests/auth-session-feature-keys.test.mjs` | Guards provisioning placement and the single entitlement-load/session contract. |
| `lib/public-launch-controls.js` | Pure environment parser and public pause-copy contract. |
| `tests/public-launch-controls.test.mjs` | Proves defaults, exact flags, independent pausing, and source adoption. |
| `app/api/account/register/route.ts` | Enforces the registration pause before email, hashing, or database mutation. |
| `app/register/page.tsx` | Passes the server-derived registration-open state to the form. |
| `app/register/register-form.tsx` | Explains a pause and disables account-creation controls while leaving login links available. |
| `lib/membership-checkout.js` | Enforces the Checkout pause after authentication and before membership, legal, customer, or Stripe work. |
| `app/api/billing/checkout/route.ts` | Injects the centralized launch-control reader. |
| `components/membership/pricing-cards.tsx` | Explains a Checkout pause and suppresses only new subscription submission. |
| `app/pricing/page.tsx` | Supplies server-derived Checkout-open state. |
| `app/account/page.tsx` | Supplies Checkout-open state while preserving Portal rendering. |
| `tests/membership-checkout-route.test.mjs` | Proves a pause performs no membership/customer/Stripe work and preserves Portal mode. |
| `tests/auth-registration.test.mjs` | Proves registration pause copy and enforcement stay wired. |
| `tests/browser/public-routes.spec.ts` | Opt-in local browser proof for the two paused public surfaces. |
| `docs/wiki/deployment.md` | Documents flags, pooling, measurement, cache, alert, and read-only verification contracts. |
| `docs/wiki/release-checklist.md` | Adds the two pause controls and before/after workload receipt to the launch gate. |

---

### Task 1: Add the read-only route timing harness

**Files:**
- Create: `scripts/family-friends-route-timings.mjs`
- Create: `scripts/family-friends-timing-receipt.mjs`
- Create: `tests/family-friends-route-timings.test.mjs`
- Create: `tests/family-friends-timing-receipt.test.mjs`
- Create: `tests/family-friends-server-workload.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `READINESS_TIMING_ROUTES: readonly string[]`
- Produces: `parseReadinessTimingArgs(args: string[]): { baseUrl: string, hostname: string, port: number, samples: number }`
- Produces: `measureReadinessRoutes({ baseUrl, samples, requestTimeoutMs, fetchImpl, clock }): Promise<Array<RouteTimingResult>>`
- Produces: `formatReadinessTimingSummary(results): string`
- Produces: `runFamilyFriendsTimingReceipt(...)`, which builds the current head, refuses an occupied port, starts that build, waits for readiness, measures it, and always tears the owned process down.
- Output fields: `route`, `sampleKind`, `sample`, `status`, and integer `durationMs`; no URL query, headers, cookies, or response body.
- Baseline workload rows: ordinary verified auth refresh background-credit calls; signed-in sidebar entitlement loads; membership-return summary/Stripe calls; valid Checkout provider calls; Portal provider calls; ordinary render provider calls.

- [ ] **Step 1: Write the failing timing-harness tests**

Create `tests/family-friends-route-timings.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  READINESS_TIMING_ROUTES,
  formatReadinessTimingSummary,
  measureReadinessRoutes,
  parseReadinessTimingArgs,
} from "../scripts/family-friends-route-timings.mjs"

describe("family-and-friends route timings", () => {
  it("uses a fixed anonymous launch-route allowlist and bounded samples", () => {
    assert.deepEqual(READINESS_TIMING_ROUTES, [
      "/", "/login", "/register", "/pricing", "/clock", "/music", "/account",
    ])
    assert.deepEqual(parseReadinessTimingArgs(["--base-url=http://127.0.0.1:3010", "--samples=3"]), {
      baseUrl: "http://127.0.0.1:3010",
      hostname: "127.0.0.1",
      port: 3010,
      samples: 3,
    })
    assert.throws(() => parseReadinessTimingArgs(["--samples=0"]), /between 1 and 10/)
    assert.throws(() => parseReadinessTimingArgs(["--base-url=https://example.com"]), /loopback/)
  })

  it("labels the first and warm samples without logging bodies or caller URLs", async () => {
    const calls = []
    let tick = 0
    const results = await measureReadinessRoutes({
      baseUrl: "http://127.0.0.1:3010",
      samples: 2,
      clock: () => { tick += 7; return tick },
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        return { status: 200, arrayBuffer: async () => new ArrayBuffer(0) }
      },
    })

    assert.equal(calls.length, READINESS_TIMING_ROUTES.length * 2)
    assert.deepEqual(results.slice(0, 2).map(({ sampleKind }) => sampleKind), ["first", "warm"])
    assert.equal(calls.every(({ init }) => init.method === "GET" && init.redirect === "follow"), true)
    assert.doesNotMatch(formatReadinessTimingSummary(results), /cookie|authorization|response body/i)
  })

  it("aborts a route sample while its response body is still pending", async () => {
    await assert.rejects(measureReadinessRoutes({
      baseUrl: "http://127.0.0.1:3010",
      samples: 1,
      requestTimeoutMs: 5,
      fetchImpl: async (_url, { signal }) => ({
        status: 200,
        arrayBuffer: () => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true })
        }),
      }),
    }), /timeout|abort/i)
  })
})
```

Create `tests/family-friends-timing-receipt.test.mjs` with injected build/server/readiness/measure dependencies. Prove exact order `port check -> build -> start -> ready -> measure -> stop`, timeout/failure still stops only the owned child, an already-occupied port aborts before build/measurement, and the wrapper never reuses a stale `.next` build or labels a sample cold.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/family-friends-route-timings.test.mjs tests/family-friends-timing-receipt.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/family-friends-route-timings.mjs`.

- [ ] **Step 3: Lock the existing server-work baseline**

Create `tests/family-friends-server-workload.test.mjs` as a repeatable source/dependency-call receipt. On the already-reviewed stacked baseline it records and asserts:

```text
verified auth refresh: background-credit provisioner calls = 1
signed-in sidebar: separate membership entitlement loads = 1
membership status read: persisted summary loads = 1; Stripe calls = 0
valid explicit Checkout: Checkout-session creates = 1; ordinary render = 0
valid explicit Portal action: Portal-session creates = 1; ordinary render = 0
```

Use named function slices rather than whole-file counts, and reuse the injected call counters from membership status, Checkout, and Portal tests. No production request or provider is contacted. Later tasks first change the relevant expected count to the approved target, observe RED, then change code.

- [ ] **Step 4: Implement the bounded harness**

Create `scripts/family-friends-route-timings.mjs` with these exported contracts:

```js
#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"

export const READINESS_TIMING_ROUTES = Object.freeze([
  "/", "/login", "/register", "/pricing", "/clock", "/music", "/account",
])
export const READINESS_REQUEST_TIMEOUT_MS = 15_000

export function parseReadinessTimingArgs(args) {
  const values = Object.fromEntries(args.map((argument) => {
    const [key, value = ""] = argument.split("=", 2)
    return [key, value]
  }))
  const baseUrl = values["--base-url"] || "http://127.0.0.1:3010"
  const parsedUrl = new URL(baseUrl)
  if (parsedUrl.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
    throw new Error("Route timing is restricted to a loopback base URL.")
  }
  const samples = Number(values["--samples"] || 3)
  if (!Number.isInteger(samples) || samples < 1 || samples > 10) {
    throw new Error("--samples must be between 1 and 10.")
  }
  return { baseUrl: parsedUrl.origin, hostname: parsedUrl.hostname, port: Number(parsedUrl.port || 80), samples }
}

export async function measureReadinessRoutes({
  baseUrl,
  samples,
  requestTimeoutMs = READINESS_REQUEST_TIMEOUT_MS,
  fetchImpl = fetch,
  clock = () => performance.now(),
}) {
  const results = []
  for (const route of READINESS_TIMING_ROUTES) {
    for (let sample = 1; sample <= samples; sample += 1) {
      const startedAt = clock()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(new Error("Route timing request timeout.")), requestTimeoutMs)
      try {
        const response = await fetchImpl(new URL(route, baseUrl), {
          method: "GET",
          redirect: "follow",
          headers: { accept: "text/html" },
          signal: controller.signal,
        })
        await response.arrayBuffer()
        results.push({
          route,
          sampleKind: sample === 1 ? "first" : "warm",
          sample,
          status: response.status,
          durationMs: Math.max(0, Math.round(clock() - startedAt)),
        })
      } finally {
        clearTimeout(timeout)
      }
    }
  }
  return results
}

export function formatReadinessTimingSummary(results) {
  return results.map((result) => [
    result.route,
    result.sampleKind,
    `sample=${result.sample}`,
    `status=${result.status}`,
    `durationMs=${result.durationMs}`,
  ].join(" ")).join("\n")
}

async function main() {
  const options = parseReadinessTimingArgs(process.argv.slice(2))
  console.log(formatReadinessTimingSummary(await measureReadinessRoutes(options)))
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Route timing failed.")
    process.exitCode = 1
  })
}
```

Create `scripts/family-friends-timing-receipt.mjs`. It accepts the same loopback base URL/sample bounds, first verifies the parsed port is unused, runs `npm run build` to completion, starts the known Next CLI entry for that fresh production build on the exact parsed `hostname` and `port`, polls that same `baseUrl` for at most 60 seconds, invokes `measureReadinessRoutes`, and prints only its sanitized summary. Buffer build/server output and emit only fixed failure text. In `finally`, terminate and await only the child it created, escalating from SIGTERM to SIGKILL after five seconds. Export the orchestration with injectable dependencies so the unit test never builds or starts Next. The receipt test must use a non-default port and assert that unused-port proof, server startup, and readiness polling all receive that exact parsed port.

- [ ] **Step 5: Add the named package command**

Add to `package.json` scripts:

```json
"readiness:timings": "node scripts/family-friends-route-timings.mjs",
"readiness:timing-receipt": "node scripts/family-friends-timing-receipt.mjs"
```

- [ ] **Step 6: Run tests and capture the before measurement**

From the unchanged baseline head on the same machine and environment shape that will be used for the final receipt, run the self-contained production-build wrapper:

```bash
node --test tests/family-friends-route-timings.test.mjs tests/family-friends-timing-receipt.test.mjs tests/family-friends-server-workload.test.mjs
git rev-parse HEAD
npm run readiness:timing-receipt -- --base-url=http://127.0.0.1:3010 --samples=3
```

Expected: all tests pass; the wrapper freshly builds, serves, emits exactly 21 sanitized lines, and tears its server down; the workload test proves the exact baseline counts above. Copy the baseline head and both result sets into the implementation task receipt before changing auth/session work. Do not call the first request a provider cold start.

- [ ] **Step 7: Commit the timing harness**

```bash
git add package.json scripts/family-friends-route-timings.mjs scripts/family-friends-timing-receipt.mjs tests/family-friends-route-timings.test.mjs tests/family-friends-timing-receipt.test.mjs tests/family-friends-server-workload.test.mjs
git commit -m "test: measure family launch route timings"
```

---

### Task 2: Confine credit provisioning to verified account creation

**Files:**
- Modify: `lib/auth-users.ts`
- Modify: `lib/auth-method-intents.ts`
- Modify: `app/api/account/security/password/route.ts`
- Modify: `tests/background-credit-service.test.mjs`
- Modify: `tests/family-friends-server-workload.test.mjs`

**Interfaces:**
- Preserves: initial provisioning for the `created: true` Google-user path in `prepareGoogleAuthentication`.
- Preserves: email-verification provisioning in `app/verify-email/page.tsx`.
- Preserves: `npm run commerce:backfill-credits` as the bounded repair path.
- Changes: `getUserAuthState(userId)`, repeat Google sign-in, and later password addition/change become read-only with respect to background-credit state.

- [ ] **Step 1: Reverse the hot-path source contract to RED**

In the existing test named `routes all verification transitions and verified-state loading through the shared service`, rename it to `provisions only at verification transitions and not during verified-state loading`. Replace the auth-state assertion with:

```js
const authStateLoader = authUsers.slice(authUsers.indexOf("export async function getUserAuthState"))
assert.doesNotMatch(authStateLoader, /ensureVerifiedUserBackgroundCredits/)
assert.doesNotMatch(authUsers.match(/export async function ensureGoogleUserState[\s\S]*?\n\}/)?.[0] ?? "", /ensureVerifiedUserBackgroundCredits/)
assert.match(authMethodIntents, /created[\s\S]*ensureVerifiedUserBackgroundCredits\(prismaClient, userId\)/)
assert.doesNotMatch(passwordRoute, /ensureVerifiedUserBackgroundCredits/)
```

Read `lib/auth-method-intents.ts` and `app/api/account/security/password/route.ts` in the test setup. Keep the existing email-verification assertion; replace the password-enablement assertion with the absence check above.

First change the workload receipt's verified-auth row from one background-credit call to zero while leaving every other baseline row unchanged. Run it before code changes to prove RED.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test tests/background-credit-service.test.mjs tests/family-friends-server-workload.test.mjs
```

Expected: FAIL because request-time auth and later password changes still contain provisioning, while the identity-plan Google creation service does not yet own it explicitly.

- [ ] **Step 3: Move provisioning to the new-account boundary**

In `lib/auth-users.ts`, delete this block from `getUserAuthState`:

```ts
if (user?.emailVerified) {
  await ensureVerifiedUserBackgroundCredits(prisma, userId)
}
```

Remove `ensureVerifiedUserBackgroundCredits` from `ensureGoogleUserState`; that helper may continue marking the verified email and ensuring roles, but repeat Google sign-in must not open a credit transaction. Update the surrounding JSDoc to state that request-time loaders and repeat sign-ins are read-only with respect to background credits.

In the identity plan's `prepareGoogleAuthentication` service, after the transaction has durably created a new verified Google user and returned `created: true`, invoke `ensureVerifiedUserBackgroundCredits(prismaClient, userId)`. A provisioning failure must not roll back the valid identity: log only a fixed safe message and leave `npm run commerce:backfill-credits` as the repair path.

Remove the post-commit credit provisioner from `app/api/account/security/password/route.ts`. Adding or changing a password is not account creation.

- [ ] **Step 4: Run focused credit and auth tests**

```bash
node --test tests/background-credit-service.test.mjs tests/background-credit-backfill.test.mjs tests/auth-session-version.test.mjs tests/family-friends-server-workload.test.mjs
```

Expected: PASS, including idempotent lifecycle and backfill coverage.

- [ ] **Step 5: Commit the hot-path removal**

```bash
git add lib/auth-users.ts lib/auth-method-intents.ts app/api/account/security/password/route.ts tests/background-credit-service.test.mjs tests/family-friends-server-workload.test.mjs
git commit -m "perf: confine initial credit provisioning"
```

---

### Task 3: Reuse session feature keys in the sidebar

**Files:**
- Modify: `lib/auth-users.ts`
- Modify: `auth.ts`
- Modify: `types/next-auth.d.ts`
- Modify: `components/sidebar/sidebar.tsx`
- Create: `tests/auth-session-feature-keys.test.mjs`
- Modify: `tests/family-friends-server-workload.test.mjs`

**Interfaces:**
- Produces: `getUserAuthState(userId).featureKeys: string[]`
- Produces: `JWT.featureKeys?: string[]`
- Produces: `Session.user.featureKeys: string[]`
- Consumes: `buildEntitlements(...).features`
- Removes: the sidebar's separate `getUserEntitlementState(prisma, userId)` call.
- Preserves: `featureKeysFromCapabilities` as a fail-closed compatibility fallback only when an older token has no array.
- Workload target: ordinary auth snapshot performs one user-graph read plus one temporary-grant read and zero credit writes; sidebar navigation performs zero entitlement reads while retaining its separately justified preference/practice-role reads.

- [ ] **Step 1: Write the failing session contract test**

Create `tests/auth-session-feature-keys.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

describe("auth session feature-key reuse", () => {
  it("computes feature keys once in auth state and carries them through JWT and Session", async () => {
    const [authUsers, auth, authTypes] = await Promise.all([
      read("lib/auth-users.ts"), read("auth.ts"), read("types/next-auth.d.ts"),
    ])
    assert.match(authUsers, /const entitlements = buildEntitlements\(/)
    assert.match(authUsers, /featureKeys: entitlements\.features/)
    assert.match(auth, /token\.featureKeys = state\.featureKeys/)
    assert.match(auth, /sessionUser\.featureKeys = Array\.isArray\(token\.featureKeys\)/)
    assert.match(authTypes, /featureKeys: string\[\]/)
    assert.match(authTypes, /featureKeys\?: string\[\]/)
  })

  it("does not reload membership entitlements for sidebar navigation", async () => {
    const sidebar = await read("components/sidebar/sidebar.tsx")
    assert.doesNotMatch(sidebar, /getUserEntitlementState/)
    assert.match(sidebar, /sessionUser\.featureKeys/)
    assert.match(sidebar, /featureKeysFromCapabilities/)
  })
})
```

Also change the workload receipt's signed-in-sidebar entitlement count from one to zero and keep the auth-refresh credit count at zero. Refactor `getUserAuthState` and `getSidebarNavigationContext` with defaulted database/loader dependencies only where needed for a functional fake; assert the exact target counts above rather than relying solely on whole-file regexes.

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test tests/auth-session-feature-keys.test.mjs tests/family-friends-server-workload.test.mjs
```

Expected: FAIL because the session and sidebar do not yet carry `featureKeys`.

- [ ] **Step 3: Compute entitlements once in `getUserAuthState`**

In `lib/auth-users.ts`, assign the existing entitlement build before the return:

```ts
const entitlements = buildEntitlements({
  adminAccess,
  subscriptions: user?.membershipSubscriptions ?? [],
  studentAccess: user?.studentAccess ?? null,
  temporaryGrants,
  now,
})
```

Return `featureKeys: entitlements.features`, and pass `entitlements.features` to `buildAccountCapabilities` instead of calling `buildEntitlements` again inline.

- [ ] **Step 4: Carry a fail-closed array through Auth.js**

In `auth.ts`:

```ts
token.featureKeys = state.featureKeys
```

In the restricted database-error fallback:

```ts
token.featureKeys = []
```

Extend the local `sessionUser` type and assignment:

```ts
featureKeys: string[]
// ...
sessionUser.featureKeys = Array.isArray(token.featureKeys)
  ? token.featureKeys.filter((value): value is string => typeof value === "string")
  : []
```

Add the corresponding required Session and optional JWT fields to `types/next-auth.d.ts`.

- [ ] **Step 5: Remove the sidebar entitlement reload**

In `components/sidebar/sidebar.tsx`, remove `getUserEntitlementState` from the membership import. Add `featureKeys?: string[] | null` to the local session-user shapes. Replace `loadSidebarFeatureKeys` with:

```ts
function sidebarFeatureKeys(sessionUser: {
  featureKeys?: string[] | null
  capabilities?: Record<string, boolean> | null
}) {
  return Array.isArray(sessionUser.featureKeys)
    ? sessionUser.featureKeys
    : featureKeysFromCapabilities(sessionUser.capabilities)
}
```

Use `sidebarFeatureKeys(sessionUser)` directly in `getSidebarNavigationContext`; keep practice-role loading asynchronous. Delete the old Prisma-backed `loadSidebarFeatureKeys` function.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
node --test tests/auth-session-feature-keys.test.mjs tests/auth-session-version.test.mjs tests/navigation-model.test.mjs tests/family-friends-server-workload.test.mjs
npm run typecheck
```

Expected: all commands pass, and the source contract confirms the duplicate entitlement query is absent.

- [ ] **Step 7: Commit session feature reuse**

```bash
git add auth.ts lib/auth-users.ts types/next-auth.d.ts components/sidebar/sidebar.tsx tests/auth-session-feature-keys.test.mjs tests/family-friends-server-workload.test.mjs
git commit -m "perf: reuse session feature keys in sidebar"
```

---

### Task 4: Add independent registration and Checkout pause controls

**Files:**
- Create: `lib/public-launch-controls.js`
- Create: `tests/public-launch-controls.test.mjs`
- Modify: `app/api/account/register/route.ts`
- Modify: `app/register/page.tsx`
- Modify: `app/register/register-form.tsx`
- Modify: `lib/membership-checkout.js`
- Modify: `app/api/billing/checkout/route.ts`
- Modify: `components/membership/pricing-cards.tsx`
- Modify: `app/pricing/page.tsx`
- Modify: `app/account/page.tsx`
- Modify: `tests/auth-registration.test.mjs`
- Modify: `tests/membership-checkout-route.test.mjs`
- Modify: `tests/membership-pricing-cards.test.mjs`
- Modify: `tests/browser/public-routes.spec.ts`

**Interfaces:**
- Produces: `getPublicLaunchControls(env = process.env): { registrationOpen: boolean, supporterCheckoutOpen: boolean }`
- Produces: `REGISTRATION_PAUSED_MESSAGE`
- Produces: `SUPPORTER_CHECKOUT_PAUSED_MESSAGE`
- Environment: exact string `true` in `MASSAGELAB_PUBLIC_REGISTRATION_PAUSED` pauses registration.
- Environment: exact string `true` in `MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED` pauses new membership Checkout.
- Consumed by: registration route/page and membership Checkout route/pricing render.

- [ ] **Step 1: Write failing pure control tests**

Create `tests/public-launch-controls.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getPublicLaunchControls,
  REGISTRATION_PAUSED_MESSAGE,
  SUPPORTER_CHECKOUT_PAUSED_MESSAGE,
} from "../lib/public-launch-controls.js"

describe("public launch controls", () => {
  it("defaults both public paths open and pauses them independently", () => {
    assert.deepEqual(getPublicLaunchControls({}), {
      registrationOpen: true,
      supporterCheckoutOpen: true,
    })
    assert.deepEqual(getPublicLaunchControls({ MASSAGELAB_PUBLIC_REGISTRATION_PAUSED: "true" }), {
      registrationOpen: false,
      supporterCheckoutOpen: true,
    })
    assert.deepEqual(getPublicLaunchControls({ MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED: "true" }), {
      registrationOpen: true,
      supporterCheckoutOpen: false,
    })
    assert.equal(getPublicLaunchControls({ MASSAGELAB_PUBLIC_REGISTRATION_PAUSED: "TRUE" }).registrationOpen, true)
  })

  it("uses neutral copy that preserves existing-account paths", () => {
    assert.match(REGISTRATION_PAUSED_MESSAGE, /temporarily paused/i)
    assert.match(REGISTRATION_PAUSED_MESSAGE, /sign in|existing account/i)
    assert.match(SUPPORTER_CHECKOUT_PAUSED_MESSAGE, /temporarily paused/i)
    assert.match(SUPPORTER_CHECKOUT_PAUSED_MESSAGE, /billing portal|existing membership/i)
  })
})
```

- [ ] **Step 2: Add RED route and pricing cases**

In `tests/membership-checkout-route.test.mjs`, add a dependency option `supporterCheckoutOpen` and this case:

```js
it("returns a paused response before membership, legal, customer, or Stripe work", async () => {
  const calls = checkoutCallCounts()
  const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
    supporterCheckoutOpen: false,
  }))(jsonRequest({ membershipLevel: "SUPPORTER", supporterAmountChoiceId: "support-1" }))

  assert.deepEqual(response, {
    body: { error: "New Supporter checkout is temporarily paused. Existing memberships and the billing portal remain available." },
    status: 503,
  })
  assert.deepEqual(calls, { ensureCustomer: 0, createCheckout: 0, membershipLookup: 0 })
})
```

Add source assertions to `tests/auth-registration.test.mjs` for `getPublicLaunchControls`, HTTP `503`, `REGISTRATION_PAUSED_MESSAGE`, and disabled register controls. Add a pricing rendering case to `tests/membership-pricing-cards.test.mjs` that passes `supporterCheckoutOpen: false`, finds the pause copy, finds no Checkout form, and still finds the Portal form when `mode: "portal"`.

Add one `public launch pauses` browser case to `tests/browser/public-routes.spec.ts`. It runs only when `MASSAGELAB_BROWSER_QA_PUBLIC_PAUSES=1` and asserts `/register` keeps login/recovery links while account-creation controls are disabled, `/pricing` shows Checkout-pause copy and no membership POST, and no Stripe/mail request occurs. Ordinary browser lanes skip only this opt-in state case; route/render tests remain the Portal-preservation authority.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
node --test tests/public-launch-controls.test.mjs tests/auth-registration.test.mjs tests/membership-checkout-route.test.mjs tests/membership-pricing-cards.test.mjs
```

Expected: FAIL because the shared controls and props do not exist.

- [ ] **Step 4: Implement the pure environment contract**

Create `lib/public-launch-controls.js`:

```js
// @ts-check

export const REGISTRATION_PAUSED_MESSAGE =
  "New account registration is temporarily paused. Existing users can still sign in or recover an account."
export const SUPPORTER_CHECKOUT_PAUSED_MESSAGE =
  "New Supporter checkout is temporarily paused. Existing memberships and the billing portal remain available."

/**
 * Reads only explicit emergency pause flags. Missing or non-exact values keep
 * the existing public paths open, while each switch remains independent.
 * @param {Record<string, string | undefined>} [env]
 */
export function getPublicLaunchControls(env = process.env) {
  return {
    registrationOpen: env.MASSAGELAB_PUBLIC_REGISTRATION_PAUSED !== "true",
    supporterCheckoutOpen: env.MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED !== "true",
  }
}
```

- [ ] **Step 5: Enforce and present the registration pause**

At the start of the registration `POST`, before `request.json()`, return:

```ts
if (!getPublicLaunchControls().registrationOpen) {
  return NextResponse.json({ message: REGISTRATION_PAUSED_MESSAGE }, { status: 503 })
}
```

In `app/register/page.tsx`, pass `registrationOpen={getPublicLaunchControls().registrationOpen}`. In `RegisterForm`, add the boolean prop, render the shared pause message with `role="status"`, disable email account creation and the register-page Google button while paused, and leave the sign-in and password-recovery links enabled. Existing users continue using Google from `/login`.

- [ ] **Step 6: Enforce the Checkout pause before billing work**

Add `getPublicLaunchControls` to the Checkout-handler dependencies. After session authentication and before public selection, subscription lookup, legal acceptance, customer creation, or Stripe work, add:

```js
if (!getPublicLaunchControls().supporterCheckoutOpen) {
  return input.isForm
    ? accountRedirect("checkout-paused")
    : NextResponse.json({ error: SUPPORTER_CHECKOUT_PAUSED_MESSAGE }, { status: 503 })
}
```

Pass the imported helper from `app/api/billing/checkout/route.ts`. Update the test dependency factory so its default returns both controls open and the focused case returns Checkout closed.

- [ ] **Step 7: Present Checkout pause without hiding Portal**

Add `supporterCheckoutOpen?: boolean` with default `true` to `MembershipPricingCards`. When false, render `SUPPORTER_CHECKOUT_PAUSED_MESSAGE` and omit only new-Checkout forms. Preserve Portal forms and active-membership details. Pass the server-derived boolean from both `app/pricing/page.tsx` and the membership tab in `app/account/page.tsx`. Add `checkout-paused` to the existing account-notice copy map.

- [ ] **Step 8: Run focused tests and browser smoke**

```powershell
node --test tests/public-launch-controls.test.mjs tests/auth-registration.test.mjs tests/membership-checkout-route.test.mjs tests/membership-pricing-cards.test.mjs
npm run typecheck
npm run build:browser-qa
$browserExit = 0
try {
  $env:MASSAGELAB_BROWSER_QA_PUBLIC_PAUSES = "1"
  $env:MASSAGELAB_PUBLIC_REGISTRATION_PAUSED = "true"
  $env:MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED = "true"
  npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium --grep "public launch pauses"
  $browserExit = $LASTEXITCODE
} finally {
  Remove-Item Env:MASSAGELAB_BROWSER_QA_PUBLIC_PAUSES -ErrorAction SilentlyContinue
  Remove-Item Env:MASSAGELAB_PUBLIC_REGISTRATION_PAUSED -ErrorAction SilentlyContinue
  Remove-Item Env:MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED -ErrorAction SilentlyContinue
}
if ($browserExit -ne 0) { exit $browserExit }
```

Expected: all pass; paused registration shows recovery/sign-in, paused Checkout makes zero provider calls, and Portal mode remains visible in rendering coverage. The three environment values are removed even if the browser command fails; use a PowerShell `try/finally` wrapper during execution so the shell cannot leak the paused state into later checks.

- [ ] **Step 9: Commit pause controls**

```bash
git add lib/public-launch-controls.js tests/public-launch-controls.test.mjs app/api/account/register/route.ts app/register/page.tsx app/register/register-form.tsx lib/membership-checkout.js app/api/billing/checkout/route.ts components/membership/pricing-cards.tsx app/pricing/page.tsx app/account/page.tsx tests/auth-registration.test.mjs tests/membership-checkout-route.test.mjs tests/membership-pricing-cards.test.mjs tests/browser/public-routes.spec.ts
git commit -m "feat: add public registration and checkout pauses"
```

---

### Task 5: Document operational cost boundaries

**Files:**
- Modify: `docs/wiki/deployment.md`
- Modify: `docs/wiki/release-checklist.md`

**Interfaces:**
- Documents: exact pause flags and preserved paths.
- Documents: first/warm local timing command, exact dependency-call workload rows, and the separate platform cold/warm release gate.
- Documents: read-only checks for Neon, Vercel, email, Stripe, R2, and Sentry.
- Preserves: explicit authorization gates for provider settings and live payment actions.

- [ ] **Step 1: Add a family-and-friends cost-control section to deployment docs**

Add these exact environment names and semantics to `docs/wiki/deployment.md`:

```text
MASSAGELAB_PUBLIC_REGISTRATION_PAUSED=false
MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED=false
```

Document that only lowercase `true` pauses a path, flag absence preserves current behavior, both flags are server-enforced, a registration pause preserves existing login/recovery, and a Checkout pause preserves existing entitlements and Portal access.

- [ ] **Step 2: Document the measured workload and provider boundaries**

In the same section, add:

```bash
npm run readiness:timing-receipt -- --base-url=http://127.0.0.1:3010 --samples=3
```

State that the first sample is merely the first harness request and not proof of provider cold start. Record the before/after workload rows for auth refresh, sidebar entitlement loading, membership status, explicit Checkout, explicit Portal, and ordinary render. Record that ordinary auth refresh performs no credit-provisioning transaction, sidebar navigation reuses session feature keys, calendar context remains deferred behind its authenticated endpoint, and normal page rendering must not call Stripe or email providers. Require the release plan's read-only Vercel aggregate to distinguish observed cold-start and warm invocation latency for the deployed exact commit; if the platform cannot expose that distinction, the cold row remains NOT RUN rather than being inferred from this harness.

Add a read-only checklist for Neon pooled-host/connection/compute graphs, Vercel usage/error/WAF Log mode, SMTP volume/bounce/complaint health, Stripe webhook failures, R2 custom-domain cache headers and Class A/B operations, and Sentry quota/privacy. Any configuration change remains separately authorized.

- [ ] **Step 3: Add release-checklist receipts**

In `docs/wiki/release-checklist.md`, require:

- separate baseline-head and final-head `readiness:timing-receipt` runs, each from its own fresh production build, using the same machine, loopback port, sample count, and environment shape;
- the exact before/after database/provider workload-count matrix from `tests/family-friends-server-workload.test.mjs`;
- a separate deployed-platform aggregate cold-versus-warm receipt or an honest NOT RUN state;
- focused proof that session refresh performs zero background-credit provisioning;
- source/test proof that sidebar entitlement reload is absent;
- registration-pause and Checkout-pause browser proof; and
- read-only provider dashboard checks without identifiers or secret values.

- [ ] **Step 4: Verify documentation terms**

Run:

```bash
rg -n "MASSAGELAB_PUBLIC_REGISTRATION_PAUSED|MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED|readiness:timing-receipt|billing Portal|pooled" docs/wiki/deployment.md docs/wiki/release-checklist.md
git diff --check
```

Expected: both files contain the exact flag names and boundaries; `git diff --check` emits no output.

- [ ] **Step 5: Commit operational documentation**

```bash
git add docs/wiki/deployment.md docs/wiki/release-checklist.md
git commit -m "docs: define family launch cost controls"
```

---

### Task 6: Capture after evidence and run the complete workstream gate

**Files:**
- Verify only; do not change unrelated files to make validation green.

**Interfaces:**
- Consumes: all commits in this plan.
- Produces: exact-head validation and before/after timing receipt for the release plan.

- [ ] **Step 1: Capture the after timing from a fresh final-head build with the same server shape**

On the same machine, loopback port, sample count, and environment shape used in Task 1, run the same self-contained wrapper. It builds the final workstream head independently; baseline and final results intentionally come from different application builds.

```bash
git rev-parse HEAD
npm run readiness:timing-receipt -- --base-url=http://127.0.0.1:3010 --samples=3
```

Expected: the wrapper freshly builds, serves, emits 21 sanitized lines, and tears its owned server down. Compare route-by-route with the separately recorded Task 1 baseline build. Record regressions honestly; do not invent a percentage target or call first-sample variance a cold-start result.

- [ ] **Step 2: Run focused server/cost tests**

```bash
node --test tests/family-friends-route-timings.test.mjs tests/family-friends-timing-receipt.test.mjs tests/family-friends-server-workload.test.mjs tests/background-credit-service.test.mjs tests/background-credit-backfill.test.mjs tests/auth-session-feature-keys.test.mjs tests/public-launch-controls.test.mjs tests/auth-registration.test.mjs tests/membership-checkout-route.test.mjs tests/membership-pricing-cards.test.mjs tests/navigation-model.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run repository validation**

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
npm run build:browser-qa
```

Expected: every command passes. If the Windows sandbox fails before a command starts with error 1312, rerun the same command through the approved outside-sandbox path and do not classify it as an application failure.

- [ ] **Step 4: Run focused browser verification**

```bash
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/public-routes.spec.ts --project=mobile-chromium
```

Expected: PASS for the ordinary browser matrix, with the opt-in paused-state proof from Task 4 also tied to this unchanged application head. Existing login/recovery/Portal and signed-in shell behavior remain intact.

- [ ] **Step 5: Review workstream boundaries**

Inspect the final diff and confirm:

- no provider setting or secret file changed;
- no user-specific response became publicly cacheable;
- no background-credit grant path was removed from email verification, new Google-user creation, or the bounded backfill;
- no new Stripe/email call appears during ordinary render;
- the two pause switches are independent; and
- no unrelated shell or media refactor entered the branch.

- [ ] **Step 6: Record the workstream head**

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected: clean status and the five committing tasks at the reviewed workstream head; Task 6 is verification-only. Pass that exact commit plus the sanitized timing and workload receipts to `2026-08-28-release-soft-launch.md`.
