# Anonymous Operational Sentry Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MassageLab's existing Sentry integration anonymous and operational by removing persistent identity, automatic behavioral history, and broad payload collection while preserving sanitized errors, coarse performance evidence, and the voluntary diagnostic-report flow.

**Architecture:** Centralize privacy-safe route classification, configure the installed Sentry SDK with an explicit deny-by-default data-collection contract, and reduce events, contexts, spans, tags, and breadcrumbs to bounded operational fields. Add source and fixture contracts before changing provider settings, then require a separately authorized Sentry project-settings audit and synthetic safe-event proof.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript/JavaScript, `@sentry/nextjs` 10.59, Node 24 test runner, Sentry project settings, repository wiki/audit documentation.

## Global Constraints

- This plan implements only Workstream 1 of `docs/superpowers/specs/2026-08-17-trust-first-observability-feedback-optimization-design.md`.
- Do not add product analytics, pageviews, funnels, background impressions, dwell time, retention, heatmaps, automatic surveys, or user/session profiles.
- Do not enable Session Replay, standard Sentry User Feedback, screenshots, attachments, Logs, Application Metrics, or product-behavior Explore queries.
- Do not send account IDs, user IDs, visitor IDs, session IDs, IP addresses, full URLs, query strings, request/response bodies, headers, cookies, local variables, cache keys, database values, or freeform support text.
- Keep clinical notes, intake forms, journals, ROM sessions, wellness entries, professional records, and account preferences out of Sentry.
- Preserve `/api/support/problem-report` as a user-initiated enum-only diagnostic path and preserve its optional linked Sentry event ID.
- Preserve anonymous Web Vitals, release/environment identity, sanitized stack traces, coarse route/API performance, and bounded operational failure codes.
- Do not add or update a dependency unless the installed SDK cannot implement an approved contract; stop for a new design decision before any dependency change.
- Do not mutate Sentry provider settings or emit a hosted test event without direct user authorization for the exact external action.
- Never commit a DSN, auth token, event payload, project identifier, account identifier, IP, or screenshot from Sentry.
- Use strict TDD for source changes and focused JSDoc for new privacy helpers.
- Keep every commit independently reviewable and finish with the complete repository validation gate.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `lib/privacy-route.js` | Shared normalization and coarse route classification for Sentry and voluntary diagnostics. |
| `lib/problem-report.js` | Existing problem-report taxonomy and payload builder; delegates route privacy to `lib/privacy-route.js`. |
| `lib/sentry-options.js` | Pure SDK data-collection policy and default-integration filtering. |
| `sentry.options.ts` | Wires the pure policy into client, server, and edge Sentry initialization. |
| `lib/sentry-privacy.js` | Sanitizes events, transactions, contexts, tags, spans, and breadcrumbs. |
| `tests/privacy-route.test.mjs` | Coarse-route behavior independent of problem reporting. |
| `tests/problem-report.test.mjs` | Existing voluntary diagnostic contract and compatibility aliases. |
| `tests/sentry-options.test.mjs` | Explicit data-collection and prohibited-integration policy. |
| `tests/sentry-privacy.test.mjs` | Event, identity, context, transaction, span, and breadcrumb fixtures. |
| `tests/sentry-operational-boundary.test.mjs` | Repository-wide source guards for prohibited Sentry products and identity APIs. |
| `docs/wiki/deployment.md` | SDK and provider operational settings/runbook. |
| `docs/wiki/privacy-and-phi.md` | Plain-language telemetry boundary, including PHI/wellness exclusions. |
| `docs/audits/2026-08-17-anonymous-sentry-provider-settings.md` | Safe provider-settings and synthetic-event evidence without identifiers or payloads. |
| `docs/project-state.md` | Current proven Sentry posture after hosted verification. |
| `docs/project-log.md` | Chronological implementation and validation evidence. |

---

### Task 1: Extract the shared privacy-safe route classifier

**Files:**
- Create: `lib/privacy-route.js`
- Create: `tests/privacy-route.test.mjs`
- Modify: `lib/problem-report.js`
- Modify: `tests/problem-report.test.mjs`

**Interfaces:**
- Produces: `normalizePrivacySafePath(value: unknown): string`
- Produces: `classifyPrivacySafeRoute(value: unknown): { area: string, safePath: string, privacyLevel: string }`
- Preserves: `normalizeProblemReportPath` and `classifyProblemReportRoute` as compatibility exports from `lib/problem-report.js`.
- Consumed by: `buildProblemReportSentryPayload`, Task 3 event scrubbing, and Task 4 transaction/span scrubbing.

- [ ] **Step 1: Write the failing shared-route tests**

Create `tests/privacy-route.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPrivacySafeRoute,
  normalizePrivacySafePath,
} from "../lib/privacy-route.js"

describe("privacy-safe route classification", () => {
  it("removes hosts, queries, fragments, and repeated separators", () => {
    assert.equal(
      normalizePrivacySafePath("https://massagelab.app/notes/soap?client=Jane#pain-map"),
      "/notes/soap",
    )
    assert.equal(normalizePrivacySafePath("calendar//booking?email=a@example.com"), "/calendar/booking")
  })

  it("coarsens private, code-bearing, and public tool routes", () => {
    assert.deepEqual(classifyPrivacySafeRoute("/notes/soap?client=Jane"), {
      area: "professional-records",
      safePath: "/notes/[local-first]",
      privacyLevel: "local-first-phi-capable",
    })
    assert.deepEqual(classifyPrivacySafeRoute("/anatomime/play/ABC123"), {
      area: "anatomime",
      safePath: "/anatomime/play/[code]",
      privacyLevel: "public-study",
    })
    assert.deepEqual(classifyPrivacySafeRoute("/chimer?background=dna"), {
      area: "timer",
      safePath: "/timer",
      privacyLevel: "public-tool",
    })
  })

  it("returns bounded fallbacks for malformed input", () => {
    assert.deepEqual(classifyPrivacySafeRoute(undefined), {
      area: "unknown",
      safePath: "/[unknown]",
      privacyLevel: "unknown",
    })
    assert.equal(
      classifyPrivacySafeRoute("/person@example.com/private-slug").safePath,
      "/public/[route]",
    )
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/privacy-route.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/privacy-route.js`.

- [ ] **Step 3: Create the shared classifier**

Create `lib/privacy-route.js` by moving, not reinterpreting, the current normalization and route cases from `lib/problem-report.js`. Use this exported shape:

```js
// @ts-check

/**
 * Removes caller-controlled URL details before a route is classified for
 * diagnostics. This helper returns a pathname only and never retains query or
 * fragment content.
 *
 * @param {unknown} value
 */
export function normalizePrivacySafePath(value) {
  if (typeof value !== "string" || !value.trim()) return "/[unknown]"

  const source = value.trim()
  const hashIndex = source.indexOf("#")
  const withoutFragment = hashIndex >= 0 ? source.slice(0, hashIndex) : source
  const queryIndex = withoutFragment.indexOf("?")
  const stripped = queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment

  try {
    if (/^https?:\/\//i.test(stripped)) return new URL(stripped).pathname || "/"
  } catch {
    return "/[unknown]"
  }

  const path = stripped.startsWith("/") ? stripped : `/${stripped}`
  return path.replace(/\/{2,}/g, "/") || "/"
}

/**
 * Maps concrete application routes to the minimum route family needed for
 * operational grouping. Dynamic record, practice, game, and auth details are
 * never returned.
 *
 * @param {unknown} value
 */
export function classifyPrivacySafeRoute(value) {
  const path = normalizePrivacySafePath(value)
  const publicSegments = new Set([
    "about",
    "breathe",
    "legal",
    "pricing",
    "roadmap",
    "support",
    "tools",
  ])

  if (path === "/[unknown]") return { area: "unknown", safePath: path, privacyLevel: "unknown" }
  if (path === "/") return { area: "home", safePath: "/", privacyLevel: "public" }
  if (path.startsWith("/notes")) return { area: "professional-records", safePath: "/notes/[local-first]", privacyLevel: "local-first-phi-capable" }
  if (path.startsWith("/wellness")) return { area: "wellness", safePath: "/wellness/[self-tracking]", privacyLevel: "consumer-health" }
  if (path.startsWith("/book/")) return { area: "booking", safePath: "/book/[practice]", privacyLevel: "scheduling-contact" }
  if (path.startsWith("/calendar")) return { area: "calendar", safePath: "/calendar/[workspace]", privacyLevel: "scheduling-contact" }
  if (/^\/(account|settings|login|register)(\/|$)/.test(path)) return { area: "account-billing", safePath: "/account-or-auth", privacyLevel: "account-private" }
  if (path.startsWith("/api/")) return { area: "api", safePath: "/api/[route]", privacyLevel: "server-route" }
  if (path.startsWith("/admin/anatomy")) return { area: "admin-anatomy", safePath: "/admin/anatomy/[admin]", privacyLevel: "admin-private" }
  if (path.startsWith("/admin")) return { area: "admin", safePath: "/admin/[route]", privacyLevel: "admin-private" }
  if (path.startsWith("/anatomime/play/")) return { area: "anatomime", safePath: "/anatomime/play/[code]", privacyLevel: "public-study" }
  if (path.startsWith("/anatomime")) return { area: "anatomime", safePath: "/anatomime/[game]", privacyLevel: "public-study" }
  if (path.startsWith("/education/flashcards/decks/")) return { area: "education", safePath: "/education/flashcards/decks/[slug]", privacyLevel: "public-study" }
  if (path.startsWith("/education")) return { area: "education", safePath: "/education/[study]", privacyLevel: "public-study" }
  if (path.startsWith("/chimer") || path.startsWith("/clock")) return { area: "timer", safePath: "/timer", privacyLevel: "public-tool" }
  if (path.startsWith("/music") || path.startsWith("/browse")) return { area: "music", safePath: "/music", privacyLevel: "public-tool" }

  const [segment = "unknown"] = path.split("/").filter(Boolean)
  if (!publicSegments.has(segment)) {
    return { area: "public-page", safePath: "/public/[route]", privacyLevel: "public" }
  }
  return {
    area: "public-page",
    safePath: `/${segment}${path === `/${segment}` ? "" : "/[route]"}`,
    privacyLevel: "public",
  }
}
```

- [ ] **Step 4: Delegate problem-report routing without breaking exports**

In `lib/problem-report.js`, import the shared functions, remove the duplicate implementations, re-export the compatibility names, and call the shared classifier:

```js
import {
  classifyPrivacySafeRoute,
  normalizePrivacySafePath,
} from "./privacy-route.js"

export {
  classifyPrivacySafeRoute as classifyProblemReportRoute,
  normalizePrivacySafePath as normalizeProblemReportPath,
} from "./privacy-route.js"
```

Inside `buildProblemReportSentryPayload`, replace the local call with:

```js
const route = selectedArea.id === "not-sure"
  ? classifyPrivacySafeRoute(input.route)
  : {
      area: selectedArea.area,
      safePath: selectedArea.safePath,
      privacyLevel: selectedArea.privacyLevel,
    }
```

Remove the now-unused `stripUrlSensitiveParts` import from `lib/problem-report.js`.

- [ ] **Step 5: Run focused compatibility tests**

Run:

```bash
node --test tests/privacy-route.test.mjs tests/problem-report.test.mjs
```

Expected: PASS with the existing problem-report tests plus the new shared-route tests.

- [ ] **Step 6: Commit the shared route boundary**

```bash
git add lib/privacy-route.js lib/problem-report.js tests/privacy-route.test.mjs tests/problem-report.test.mjs
git commit -m "refactor: share privacy-safe route classification"
```

---

### Task 2: Make Sentry SDK collection deny-by-default

**Files:**
- Create: `lib/sentry-options.js`
- Create: `tests/sentry-options.test.mjs`
- Modify: `sentry.options.ts`

**Interfaces:**
- Produces: `getAnonymousSentryDataCollection(): import("@sentry/core").DataCollection`
- Produces: `filterAnonymousSentryIntegrations(integrations: Integration[]): Integration[]`
- Consumed by: `getSentryOptions()` for client, server, and edge initialization.

- [ ] **Step 1: Write failing policy tests**

Create `tests/sentry-options.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  filterAnonymousSentryIntegrations,
  getAnonymousSentryDataCollection,
} from "../lib/sentry-options.js"

describe("anonymous Sentry options", () => {
  it("explicitly disables every SDK data-collection category that can carry user input", () => {
    assert.deepEqual(getAnonymousSentryDataCollection(), {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      queryParams: false,
      genAI: { inputs: false, outputs: false },
      stackFrameVariables: false,
      frameContextLines: 3,
    })
  })

  it("removes session, replay, and console-capture integrations", () => {
    const integrations = [
      { name: "BrowserSession" },
      { name: "Replay" },
      { name: "ReplayCanvas" },
      { name: "CaptureConsole" },
      { name: "GlobalHandlers" },
    ]

    assert.deepEqual(
      filterAnonymousSentryIntegrations(integrations).map(({ name }) => name),
      ["GlobalHandlers"],
    )
  })
})
```

- [ ] **Step 2: Run the policy test and verify RED**

```bash
node --test tests/sentry-options.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/sentry-options.js`.

- [ ] **Step 3: Implement the pure policy helper**

Create `lib/sentry-options.js`:

```js
// @ts-check

const PROHIBITED_INTEGRATION_NAMES = new Set([
  "BrowserSession",
  "CaptureConsole",
  "Replay",
  "ReplayCanvas",
])

/**
 * Returns a fresh deny-by-default SDK collection policy. Every current
 * `@sentry/nextjs` 10.59 data category is explicit so a permissive SDK default
 * cannot silently widen MassageLab telemetry.
 *
 * @returns {import("@sentry/core").DataCollection}
 */
export function getAnonymousSentryDataCollection() {
  return {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    queryParams: false,
    genAI: { inputs: false, outputs: false },
    stackFrameVariables: false,
    frameContextLines: 3,
  }
}

/**
 * Removes SDK integrations that create session/adoption history, replay data,
 * or console capture. Error handlers and tracing remain available.
 *
 * @param {import("@sentry/core").Integration[]} integrations
 * @returns {import("@sentry/core").Integration[]}
 */
export function filterAnonymousSentryIntegrations(integrations) {
  return integrations.filter((integration) => {
    const name = integration && typeof integration === "object" && "name" in integration
      ? integration.name
      : undefined
    return typeof name !== "string" || !PROHIBITED_INTEGRATION_NAMES.has(name)
  })
}
```

- [ ] **Step 4: Wire the policy into every Sentry runtime**

Modify `sentry.options.ts`:

```ts
import {
  filterAnonymousSentryIntegrations,
  getAnonymousSentryDataCollection,
} from "./lib/sentry-options"
```

Add these exact options beside `sendDefaultPii` and replace the current breadcrumb budget:

```ts
sendDefaultPii: false,
dataCollection: getAnonymousSentryDataCollection(),
enableLogs: false,
enableMetrics: false,
maxBreadcrumbs: 0,
integrations(defaultIntegrations) {
  return filterAnonymousSentryIntegrations(defaultIntegrations)
},
```

Keep `sampleRate`, `tracesSampleRate`, `beforeSend`, `beforeSendTransaction`, `beforeSendSpan`, and `beforeBreadcrumb` wired to the existing central callbacks.

- [ ] **Step 5: Run the policy test and typecheck**

```bash
node --test tests/sentry-options.test.mjs
npm run typecheck
```

Expected: both commands PASS. Typecheck proves the installed SDK accepts the explicit `dataCollection`, `enableLogs`, `enableMetrics`, and integration callback shapes.

- [ ] **Step 6: Commit the SDK policy**

```bash
git add lib/sentry-options.js sentry.options.ts tests/sentry-options.test.mjs
git commit -m "privacy: minimize Sentry SDK collection"
```

---

### Task 3: Remove identity and automatic breadcrumb history

**Files:**
- Modify: `lib/sentry-privacy.js`
- Modify: `tests/sentry-privacy.test.mjs`

**Interfaces:**
- Preserves: `sanitizeSentryEvent(event: unknown): unknown`
- Preserves: `sanitizeSentryBreadcrumb(breadcrumb: unknown): null`
- Produces: allowlisted problem-report tags only; all other event tags are removed.

- [ ] **Step 1: Change fixtures to the approved anonymous contract**

In `tests/sentry-privacy.test.mjs`, change the first event assertion from preserving `{ id: "user_123" }` to:

```js
assert.equal("user" in event, false)
```

Add this test:

```js
test("sanitizeSentryEvent removes identity fields and non-operational tags at every nesting level", () => {
  const event = sanitizeSentryEvent({
    user: { id: "user_123", ip_address: "192.0.2.1" },
    tags: {
      userId: "user_123",
      backgroundViewed: "dna",
      "ml.report": "privacy-safe-problem-report",
      "ml.report.area": "timer",
      "ml.failure_code": "person@example.com",
    },
    contexts: {
      custom: {
        accountId: "account_123",
        visitor_id: "visitor_123",
        deviceId: "device_123",
        safeCount: 2,
      },
    },
    extra: { sessionId: "session_123", safeCount: 2 },
  })

  assert.equal("user" in event, false)
  assert.deepEqual(event.tags, {
    "ml.report": "privacy-safe-problem-report",
    "ml.report.area": "timer",
  })
  assert.doesNotMatch(JSON.stringify(event), /account_123|visitor_123|device_123|person@example.com/)
  assert.equal("extra" in event, false)
})
```

Replace the existing fetch-breadcrumb expectation with:

```js
test("sanitizeSentryBreadcrumb drops automatic behavioral history", () => {
  for (const breadcrumb of [
    { category: "console", message: "license=ABC" },
    { category: "ui.click", message: "button#save" },
    { category: "ui.input", message: "input[name=journal]" },
    { category: "navigation", data: { from: "/notes/1", to: "/notes/2" } },
    { category: "fetch", data: { url: "/api/account/preferences" } },
    { category: "xhr", data: { url: "/api/wellness" } },
  ]) {
    assert.equal(sanitizeSentryBreadcrumb(breadcrumb), null)
  }
})
```

- [ ] **Step 2: Run the sanitizer tests and verify RED**

```bash
node --test tests/sentry-privacy.test.mjs
```

Expected: FAIL because `event.user` is retained, arbitrary tags/extra survive, and non-console breadcrumbs are returned.

- [ ] **Step 3: Add identity and tag allowlists**

In `lib/sentry-privacy.js`, add:

```js
const SENSITIVE_IDENTITY_KEY_PATTERN =
  /^(?:user|userId|user_id|account|accountId|account_id|visitor|visitorId|visitor_id|session|sessionId|session_id|ip|ipAddress|ip_address|deviceId|device_id)$/i
const ALLOWED_EVENT_TAGS = new Set([
  "ml.report",
  "ml.report.area",
  "ml.report.category",
  "ml.report.privacy",
  "ml.component",
  "ml.failure_code",
])
const SAFE_OPERATIONAL_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i
```

In `sanitizeUnknown`, omit identity entries before applying the existing sensitive-value filter:

```js
return Object.fromEntries(
  Object.entries(value).flatMap(([key, entryValue]) => {
    if (SENSITIVE_IDENTITY_KEY_PATTERN.test(key)) return []

    if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_TELEMETRY_KEY_PATTERN.test(key)) {
      return [[key, FILTERED_VALUE]]
    }

    if (URL_KEY_PATTERN.test(key) && typeof entryValue === "string") {
      return [[key, redactInlineSensitiveValues(stripUrlSensitiveParts(entryValue))]]
    }

    return [[key, sanitizeUnknown(entryValue, depth + 1)]]
  }),
)
```

Replace `scrubUser` and add `scrubTags`:

```js
function scrubUser(event) {
  delete event.user
}

function scrubTags(event) {
  if (!isRecord(event.tags)) {
    delete event.tags
    return
  }

  event.tags = Object.fromEntries(
    Object.entries(event.tags).filter(([key, value]) => (
      ALLOWED_EVENT_TAGS.has(key)
      && typeof value === "string"
      && SAFE_OPERATIONAL_CODE_PATTERN.test(value)
    )),
  )
}
```

Delete arbitrary `event.extra` rather than recursively retaining it:

```js
delete event.extra
```

Call `scrubTags(event)` from `sanitizeSentryEvent` immediately after `scrubUser(event)`.

- [ ] **Step 4: Make breadcrumbs defensively empty**

Replace `sanitizeSentryBreadcrumb` with:

```js
/**
 * MassageLab does not retain automatic breadcrumb history. Operational
 * context belongs in bounded event fields instead of a behavioral trail.
 *
 * @param {unknown} _breadcrumb
 * @returns {null}
 */
export function sanitizeSentryBreadcrumb(_breadcrumb) {
  return null
}
```

Keep `scrubBreadcrumbs(event)` so manually attached event breadcrumbs are removed from incoming fixtures as well as SDK-generated events.

- [ ] **Step 5: Run focused tests**

```bash
node --test tests/sentry-privacy.test.mjs tests/problem-report.test.mjs tests/sentry-options.test.mjs
```

Expected: PASS with no retained user object or breadcrumb.

- [ ] **Step 6: Commit identity and breadcrumb hardening**

```bash
git add lib/sentry-privacy.js tests/sentry-privacy.test.mjs
git commit -m "privacy: remove Sentry identity and breadcrumbs"
```

---

### Task 4: Coarsen requests, transactions, contexts, and spans

**Files:**
- Modify: `lib/sentry-privacy.js`
- Modify: `tests/sentry-privacy.test.mjs`
- Modify: `tests/problem-report.test.mjs`

**Interfaces:**
- Consumes: `classifyPrivacySafeRoute()` from Task 1.
- Produces: `sanitizeSentryOperation(value: unknown): string` for request, transaction, and span route names.
- Preserves: trace/event IDs required for Sentry correlation; these are event-scoped operational identifiers, not account/visitor/session identities.
- Preserves: exact enum-only `problemReport` context and allowlisted report tags.

- [ ] **Step 1: Write failing coarse-event tests**

Replace the transaction metadata fixture in `tests/sentry-privacy.test.mjs` with assertions for this contract:

```js
test("sanitizeSentryEvent keeps only coarse request and context data", () => {
  const event = sanitizeSentryEvent({
    transaction: "/account?billing=checkout-error&_rsc=abc123",
    request: {
      method: "GET",
      url: "https://massagelab.app/account?billing=checkout-error&_rsc=abc123",
      headers: { cookie: "authjs.session-token=secret" },
    },
    contexts: {
      trace: {
        trace_id: "a".repeat(32),
        span_id: "b".repeat(16),
        op: "http.server",
        data: {
          "http.target": "/account?billing=checkout-error",
          "http.response.status_code": 200,
          userId: "user_123",
        },
      },
      browser: { name: "Chrome", version: "140.0.1" },
      device: { family: "iPhone 17", model: "A123" },
      arbitrary: { clientName: "Jane", safeCount: 1 },
    },
  })

  assert.equal(event.transaction, "/account-or-auth")
  assert.deepEqual(event.request, { method: "GET", url: "/account-or-auth" })
  assert.deepEqual(event.contexts.browser, { name: "Chrome" })
  assert.equal("device" in event.contexts, false)
  assert.equal("arbitrary" in event.contexts, false)
  assert.equal(event.contexts.trace.trace_id, "a".repeat(32))
  assert.deepEqual(event.contexts.trace.data, {
    "http.target": "/account-or-auth",
    "http.response.status_code": 200,
  })
})
```

Replace the span fixture with:

```js
test("sanitizeSentrySpan keeps route family, status, and method only", () => {
  const span = sanitizeSentrySpan({
    description: "GET /api/account/preferences?email=person@example.com",
    name: "GET /api/account/preferences?email=person@example.com",
    data: {
      "http.url": "https://massagelab.app/api/account/preferences?email=person@example.com",
      "http.request.method": "GET",
      "http.response.status_code": 200,
      "db.query": "select * from User where email = 'person@example.com'",
      clientName: "Jane Doe",
    },
  })

  assert.equal(span.description, "GET /api/[route]")
  assert.equal(span.name, "GET /api/[route]")
  assert.deepEqual(span.data, {
    "http.request.method": "GET",
    "http.response.status_code": 200,
  })
})
```

Add a problem-report composition test in `tests/problem-report.test.mjs`:

```js
it("survives the final Sentry sanitizer without gaining identity or behavior data", () => {
  const payload = buildProblemReportSentryPayload({
    category: "page-error",
    area: "chimer-clock",
    route: "/chimer?background=dna",
    userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
  })
  const event = sanitizeSentryEvent({
    message: payload.message,
    tags: payload.tags,
    contexts: payload.contexts,
    user: { id: "must-not-survive" },
  })

  assert.equal("user" in event, false)
  assert.equal(event.tags["ml.report.area"], "timer")
  assert.equal(event.contexts.problemReport.safePath, "/timer")
})
```

Import `sanitizeSentryEvent` from `../lib/sentry-privacy.js` in that test file.

- [ ] **Step 2: Run the tests and verify RED**

```bash
node --test tests/sentry-privacy.test.mjs tests/problem-report.test.mjs
```

Expected: FAIL because concrete routes, browser versions, device/arbitrary contexts, and span attributes remain.

- [ ] **Step 3: Add coarse operation and attribute helpers**

In `lib/sentry-privacy.js`, import the Task 1 classifier and add bounded allowlists:

```js
import { classifyPrivacySafeRoute } from "./privacy-route.js"

const HTTP_OPERATION_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i
const SAFE_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
const SAFE_CONTEXT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ._-]{0,31}$/
const SAFE_EVENT_ID_PATTERN = /^[a-f0-9]{32}$/i
const ALLOWED_TRACE_DATA_KEYS = new Set([
  "http.request.method",
  "http.response.status_code",
  "http.status_code",
  "http.target",
])
const ALLOWED_SPAN_DATA_KEYS = new Set([
  "http.request.method",
  "http.response.status_code",
  "http.status_code",
  "sentry.op",
  "sentry.origin",
])
const ALLOWED_PROBLEM_REPORT_CONTEXT_KEYS = new Set([
  "area",
  "browser",
  "category",
  "displayMode",
  "network",
  "privacyLevel",
  "selectedArea",
  "viewport",
])

/**
 * @param {unknown} value
 * @param {Set<string>} allowedKeys
 */
function sanitizePrimitiveEntries(value, allowedKeys) {
  if (!isRecord(value)) return undefined
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (!allowedKeys.has(key)) return []
      if (!["string", "number", "boolean"].includes(typeof entryValue)) return []
      if (key === "http.target" && typeof entryValue === "string") {
        return [[key, classifyPrivacySafeRoute(entryValue).safePath]]
      }
      return [[key, entryValue]]
    }),
  )
}

/**
 * @param {unknown} value
 */
function sanitizeProblemReportContext(value) {
  if (!isRecord(value)) return undefined
  const safe = Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (key === "safePath" && typeof entryValue === "string") {
        return [[key, classifyPrivacySafeRoute(entryValue).safePath]]
      }
      if (key === "linkedEventId" && typeof entryValue === "string" && SAFE_EVENT_ID_PATTERN.test(entryValue)) {
        return [[key, entryValue.toLowerCase()]]
      }
      if (ALLOWED_PROBLEM_REPORT_CONTEXT_KEYS.has(key)
        && typeof entryValue === "string"
        && SAFE_OPERATIONAL_CODE_PATTERN.test(entryValue)) {
        return [[key, entryValue]]
      }
      return []
    }),
  )
  return Object.keys(safe).length ? safe : undefined
}

/**
 * @param {unknown} value
 */
export function sanitizeSentryOperation(value) {
  if (typeof value !== "string" || !value.trim()) return "[unknown]"
  const source = value.trim()
  const match = source.match(HTTP_OPERATION_PATTERN)
  if (match) return `${match[1].toUpperCase()} ${classifyPrivacySafeRoute(match[2]).safePath}`
  if (/^(https?:\/\/|\/)/i.test(source)) return classifyPrivacySafeRoute(source).safePath
  return /^[A-Za-z0-9._:-]{1,80}$/.test(source) ? source : "[Filtered]"
}
```

- [ ] **Step 4: Reduce requests and contexts**

Replace `scrubRequest` with an object reconstruction:

```js
function scrubRequest(event) {
  if (!isRecord(event.request)) {
    delete event.request
    return
  }

  const candidateMethod = typeof event.request.method === "string"
    ? event.request.method.toUpperCase()
    : ""
  const method = SAFE_HTTP_METHODS.has(candidateMethod) ? candidateMethod : undefined
  const url = typeof event.request.url === "string"
    ? classifyPrivacySafeRoute(event.request.url).safePath
    : undefined

  event.request = {
    ...(method ? { method } : {}),
    ...(url ? { url } : {}),
  }
}
```

Add `scrubContexts(event)` that retains only `trace`, `browser`, `runtime`, `os`, and `problemReport`:

```js
function scrubContexts(event) {
  if (!isRecord(event.contexts)) {
    delete event.contexts
    return
  }

  const contexts = event.contexts
  /** @type {Record<string, unknown>} */
  const safe = {}

  if (isRecord(contexts.trace)) {
    const traceData = sanitizePrimitiveEntries(contexts.trace.data, ALLOWED_TRACE_DATA_KEYS)
    safe.trace = {
      ...Object.fromEntries(
        ["trace_id", "span_id", "parent_span_id", "op", "status", "origin"]
          .filter((key) => typeof contexts.trace[key] === "string")
          .map((key) => [key, contexts.trace[key]]),
      ),
      ...(traceData && Object.keys(traceData).length ? { data: traceData } : {}),
    }
  }

  if (isRecord(contexts.browser)
    && typeof contexts.browser.name === "string"
    && SAFE_CONTEXT_NAME_PATTERN.test(contexts.browser.name)) {
    safe.browser = { name: contexts.browser.name }
  }

  if (isRecord(contexts.runtime)
    && typeof contexts.runtime.name === "string"
    && SAFE_CONTEXT_NAME_PATTERN.test(contexts.runtime.name)) {
    safe.runtime = { name: contexts.runtime.name }
  }

  if (isRecord(contexts.os)
    && typeof contexts.os.name === "string"
    && SAFE_CONTEXT_NAME_PATTERN.test(contexts.os.name)) {
    safe.os = { name: contexts.os.name }
  }

  const problemReport = sanitizeProblemReportContext(contexts.problemReport)
  if (problemReport) safe.problemReport = problemReport

  event.contexts = safe
}
```

Call `scrubContexts(event)` from `sanitizeSentryEvent` instead of the current generic context assignment. Set `event.transaction = sanitizeSentryOperation(event.transaction)` when present.

- [ ] **Step 5: Reduce span payloads**

Change `sanitizeSentrySpan` to preserve the SDK's top-level trace/timing identity while narrowing names and data:

```js
export function sanitizeSentrySpan(span) {
  if (!isRecord(span)) return span

  if ("description" in span) span.description = sanitizeSentryOperation(span.description)
  if ("name" in span) span.name = sanitizeSentryOperation(span.name)

  const data = sanitizePrimitiveEntries(span.data, ALLOWED_SPAN_DATA_KEYS)
  const attributes = sanitizePrimitiveEntries(span.attributes, ALLOWED_SPAN_DATA_KEYS)

  if (data && Object.keys(data).length) span.data = data
  else delete span.data
  if (attributes && Object.keys(attributes).length) span.attributes = attributes
  else delete span.attributes

  return span
}
```

- [ ] **Step 6: Run focused tests and typecheck**

```bash
node --test tests/privacy-route.test.mjs tests/problem-report.test.mjs tests/sentry-options.test.mjs tests/sentry-privacy.test.mjs
npm run typecheck
```

Expected: PASS. Review the final problem-report fixture to confirm its enum-only context remains useful.

- [ ] **Step 7: Commit coarse operational payloads**

```bash
git add lib/sentry-privacy.js tests/sentry-privacy.test.mjs tests/problem-report.test.mjs
git commit -m "privacy: bound Sentry operational payloads"
```

---

### Task 5: Add repository-wide Sentry source guards

**Files:**
- Create: `tests/sentry-operational-boundary.test.mjs`

**Interfaces:**
- Consumes: repository source and configuration only.
- Produces: a failing test whenever a prohibited Sentry product, identity API, session integration, or new unreviewed capture site is introduced.

- [ ] **Step 1: Write the source-boundary test**

Create `tests/sentry-operational-boundary.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { extname, join, relative } from "node:path"

const ROOT = process.cwd()
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"])

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
  })
}

function source(path) {
  return readFileSync(join(ROOT, path), "utf8")
}

describe("anonymous operational Sentry boundary", () => {
  it("keeps prohibited Sentry products and identity APIs out of application source", () => {
    const files = ["app", "components", "lib"]
      .flatMap((directory) => sourceFiles(join(ROOT, directory)))
    const combined = files.map((path) => `${relative(ROOT, path)}\n${readFileSync(path, "utf8")}`).join("\n")

    assert.doesNotMatch(combined, /Sentry\.(?:setUser|showReportDialog|captureUserFeedback|addAttachment)/)
    assert.doesNotMatch(combined, /(?:replayIntegration|feedbackIntegration|captureConsoleIntegration)\s*\(/)
    assert.doesNotMatch(combined, /@sentry\/replay/)
  })

  it("limits application capture sites to global errors and voluntary diagnostics", () => {
    const files = ["app", "components", "lib"]
      .flatMap((directory) => sourceFiles(join(ROOT, directory)))
    const captureSites = files
      .filter((path) => /Sentry\.(?:captureException|captureMessage)\s*\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"))
      .sort()

    assert.deepEqual(captureSites, [
      "app/api/support/problem-report/route.ts",
      "app/global-error.tsx",
    ])
  })

  it("keeps the SDK policy explicit and session-free", () => {
    const options = source("sentry.options.ts")
    const policy = source("lib/sentry-options.js")

    assert.match(options, /dataCollection:\s*getAnonymousSentryDataCollection\(\)/)
    assert.match(options, /enableLogs:\s*false/)
    assert.match(options, /enableMetrics:\s*false/)
    assert.match(options, /maxBreadcrumbs:\s*0/)
    assert.match(policy, /"BrowserSession"/)
    assert.match(policy, /"Replay"/)
  })
})
```

- [ ] **Step 2: Run the guard and verify it passes only after Tasks 2-4**

```bash
node --test tests/sentry-operational-boundary.test.mjs
```

Expected: PASS. If it fails because a previously unknown Sentry capture site exists on the execution baseline, inspect that exact callsite and stop for privacy review; do not broaden the allowlist automatically.

- [ ] **Step 3: Run adjacent clinical/wellness guards**

```bash
node --test tests/client-wellness-source-guards.test.mjs tests/problem-report.test.mjs tests/sentry-operational-boundary.test.mjs
```

Expected: PASS with wellness and professional-record content still excluded.

- [ ] **Step 4: Commit the executable source boundary**

```bash
git add tests/sentry-operational-boundary.test.mjs
git commit -m "test: guard anonymous Sentry boundary"
```

---

### Task 6: Document the anonymous operational contract

**Files:**
- Modify: `docs/wiki/deployment.md`
- Modify: `docs/wiki/privacy-and-phi.md`
- Modify: `tests/sentry-operational-boundary.test.mjs`

**Interfaces:**
- Produces: operator-facing allowed/forbidden field lists and provider checklist.
- Defers: public legal-document version changes to the later feedback rollout design, where disclosure and reacceptance can be decided together.

- [ ] **Step 1: Add failing documentation guards**

Extend `tests/sentry-operational-boundary.test.mjs`:

```js
it("documents anonymous diagnostics without presenting them as product analytics", () => {
  const deployment = source("docs/wiki/deployment.md")
  const privacy = source("docs/wiki/privacy-and-phi.md")
  const combined = `${deployment}\n${privacy}`

  for (const phrase of [
    "no account, user, visitor, or session identifier",
    "automatic click, input, navigation, console, and network breadcrumbs are disabled",
    "not product analytics",
    "Prevent Storing of IP Addresses",
  ]) {
    assert.match(combined, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
  }
})
```

- [ ] **Step 2: Run the guard and verify RED**

```bash
node --test tests/sentry-operational-boundary.test.mjs
```

Expected: FAIL because the new wording is absent.

- [ ] **Step 3: Update the deployment runbook**

In `docs/wiki/deployment.md`, replace the current short Sentry section with an operational table containing these exact concepts:

```markdown
| Keep | Remove or disable |
| --- | --- |
| release and environment | account, user, visitor, and session identifiers |
| sanitized stack traces | request/response bodies, headers, cookies, and query strings |
| coarse route/API families | full URLs and dynamic route values |
| event-scoped trace and diagnostic IDs | automatic click, input, navigation, console, and network breadcrumbs |
| anonymous Web Vitals and bounded spans | Session Replay, User Feedback, attachments, Logs, and product metrics |
```

State plainly:

```markdown
This is anonymous operational monitoring, not product analytics. Do not use Sentry to infer background popularity, user journeys, retention, or conversion.
```

Add a provider checklist naming:

- server-side data scrubbing enabled;
- default scrubbers enabled;
- `Prevent Storing of IP Addresses` enabled;
- sensitive-field rules reviewed;
- public issue sharing disabled;
- Replay, User Feedback, attachments, and Logs disabled or unused;
- retention recorded; and
- one enum-only synthetic event inspected after SDK changes.

- [ ] **Step 4: Update the privacy/PHI wiki**

In `docs/wiki/privacy-and-phi.md`, retain the existing problem-report description and add:

```markdown
Sentry receives no account, user, visitor, or session identifier. Automatic click, input, navigation, console, and network breadcrumbs are disabled. Event-scoped trace and diagnostic IDs may remain only to correlate an operational failure; they are not used to build a person or browser history.
```

Keep the existing explicit rule that client wellness entries and professional-record content never enter Sentry.

- [ ] **Step 5: Run documentation and privacy tests**

```bash
node --test tests/sentry-operational-boundary.test.mjs tests/client-wellness-source-guards.test.mjs tests/problem-report.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the runbook contract**

```bash
git add docs/wiki/deployment.md docs/wiki/privacy-and-phi.md tests/sentry-operational-boundary.test.mjs
git commit -m "docs: define anonymous Sentry operations"
```

---

### Task 7: Validate locally and open a draft preview

**Files:**
- Verify only; modify files only for supported local findings.

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: a locally clean code/documentation head and a draft PR preview where the safe hosted diagnostic can be exercised.
- Does not produce: provider acceptance or merge authority.

- [ ] **Step 1: Run the focused privacy suite**

```bash
node --test tests/privacy-route.test.mjs tests/problem-report.test.mjs tests/sentry-options.test.mjs tests/sentry-privacy.test.mjs tests/sentry-operational-boundary.test.mjs tests/client-wellness-source-guards.test.mjs
```

Expected: all focused tests PASS with zero failures.

- [ ] **Step 2: Run repository validation**

Run each command separately so a Windows shell startup failure or timeout does not hide another result:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

Expected:

- lint PASS, allowing only an already-documented pre-existing informational notice;
- typecheck PASS;
- Node tests report three intentional skips; on Windows, the current baseline may additionally report the nine documented AtmoShaper construction-review checksum failures caused by CRLF working-tree materialization of two immutable JSON fixtures, while hosted Linux remains green;
- Production build PASS with the complete route count for the execution baseline; and
- diff check PASS.

- [ ] **Step 3: Inspect the exact branch diff**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
```

Expected: clean tracked status and only the files named in this plan. Confirm there is no Prisma schema, migration, lockfile, dependency, product-feedback, analytics, or Chimer behavior change.

- [ ] **Step 4: Push and open a draft pull request**

Push the exact branch and open a draft PR whose preliminary description includes:

- anonymous operational purpose;
- the explicit removed/retained Sentry fields;
- focused and full validation results;
- provider proof marked pending;
- no product analytics or cookie change; and
- rollback boundary.

Do not include Sentry event IDs, org/project identifiers, payload screenshots, or credentials.

- [ ] **Step 5: Verify the preview deployment is exact-head and healthy**

Read back the PR head SHA and Vercel preview commit. They must match. Confirm repository QA, CodeQL, and Vercel are green before using the preview for the provider proof. Do not mark the PR ready for review yet.

---

### Task 8: Prove provider privacy, publish evidence, and complete hosted review

**Files:**
- Create: `docs/audits/2026-08-17-anonymous-sentry-provider-settings.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify after review only: files with verified supported findings.

**Interfaces:**
- Consumes: exact draft-PR preview from Task 7 and authorized Sentry project access.
- Produces: safe setting-name/status evidence, one synthetic enum-only event result, and a clean exact-head PR.
- External effect: may change Sentry organization/project privacy settings only after direct authorization.

- [ ] **Step 1: Complete a read-only provider audit**

Inspect the current Sentry organization/project settings without exporting event payloads. Record locally, outside Git until scrubbed, only these setting names and boolean/status results:

```text
server-side data scrubbing
default scrubbers
Prevent Storing of IP Addresses
additional sensitive fields
public issue sharing
Session Replay
User Feedback
attachments
Logs
retention period
```

Do not record the organization slug, project slug, DSN, auth token, member names, issue titles, event contents, or identifiers.

- [ ] **Step 2: Stop for exact provider-change authorization**

If any required privacy setting is not in the approved state, present the setting names and intended direction to the user. Obtain direct authorization before changing:

```text
Enable server-side data scrubbing and default scrubbers.
Enable Prevent Storing of IP Addresses.
Disable public issue sharing.
Keep Replay, User Feedback, attachments, and Logs disabled.
```

Do not treat approval of this implementation plan as authorization for the external provider mutation.

- [ ] **Step 3: Apply only the authorized provider changes**

Use the Sentry Security & Privacy project/organization controls or a narrowly scoped official API call. Re-read every changed setting after the write. If a setting cannot be verified, record it as unverified and stop before claiming acceptance.

- [ ] **Step 4: Emit one safe synthetic diagnostic from the exact preview**

Submit this enum-only body to the exact-head preview's existing diagnostic route:

```json
{
  "category": "page-error",
  "area": "chimer-clock",
  "route": "/chimer?forbidden_probe=must-not-arrive",
  "clientContext": {
    "displayMode": "browser",
    "online": true,
    "viewportWidth": 800
  }
}
```

Verify in Sentry that the resulting event contains the bounded message/report tags, `/timer`, browser family, display mode, network enum, viewport bucket, release/environment, and event-scoped IDs only. Verify it contains no `forbidden_probe`, query, user/account/session/IP field, breadcrumb, request body, header, cookie, or freeform value.

- [ ] **Step 5: Write the scrubbed provider audit with runtime evidence**

Create `docs/audits/2026-08-17-anonymous-sentry-provider-settings.md`. Write the full SHA returned by `git rev-parse HEAD` and the exact retention duration shown by Sentry at execution time. If neither the connected organization/project settings readback nor the visible account UI exposes a retention duration, record it explicitly as `Unverified`, identify the readback limitation, and do not guess. Do not transcribe either value from memory.

Use four short sections: scope, SDK head, provider controls, and synthetic diagnostic. The SDK section must contain the exact verified SHA plus disabled/deny-by-default states for PII, data collection, browser sessions, breadcrumbs, Logs, and metrics. The provider-controls table must report the verified state of every setting from Step 1 and either the exact retention duration or the explicit `Unverified` readback limitation described above. The synthetic-diagnostic section must report PASS or FAIL for acceptance, coarse `/timer` grouping, release/environment and event-scoped correlation, identity-field absence, and query/body/header/cookie/breadcrumb absence. Never write a sample value first and replace it later.

- [ ] **Step 6: Update canonical project documentation**

Add a concise current-state bullet to `docs/project-state.md` only after every privacy-affecting provider and synthetic-event check passes. An unavailable retention-duration field may be carried only as the explicit verification limitation above; it must not be described as a passing provider readback. Add a chronological entry to the top dated section of `docs/project-log.md` containing:

- the exact preview commit;
- local validation counts;
- provider control names and pass states without identifiers;
- the synthetic event's field-level pass/fail summary without its event ID; and
- the statement that no product analytics, Replay, User Feedback, attachments, Logs, or identity collection was added.

- [ ] **Step 7: Commit and push verified provider evidence**

```bash
git add docs/audits/2026-08-17-anonymous-sentry-provider-settings.md docs/project-state.md docs/project-log.md
git commit -m "docs: record anonymous Sentry proof"
git push
```

- [ ] **Step 8: Rerun the exact-head local gate**

Run the focused privacy suite and all five repository commands from Task 7 again. Verify `git status --short` is empty and the final diff still contains no Prisma schema, migration, lockfile, dependency, product-feedback, analytics, or Chimer behavior change.

- [ ] **Step 9: Obtain substantive hosted CodeRabbit review**

Mark the PR ready only after the final evidence head is pushed. Use the repository's hosted CodeRabbit review flow on that exact head. Verify each finding against current code, implement only supported minimal fixes using strict TDD, reply to and resolve supported threads, rerun the affected focused tests plus the complete gate, and obtain a substantive no-actionable-comment exact-head result.

- [ ] **Step 10: Shepherd all hosted checks without merging**

Verify repository QA, CodeQL, Vercel, and CodeRabbit on the exact head. Record any infrastructure-only failure separately from code failures. Stop with the PR open and unmerged for user approval.

## Completion evidence

The plan is complete only when:

- the installed SDK uses explicit deny-by-default data collection;
- automatic browser sessions, automatic breadcrumbs, Logs, metrics, Replay, and standard feedback integrations are absent;
- event user identity and non-allowlisted tags/contexts/extra data are removed;
- requests, transactions, and spans contain only coarse route families and bounded operational fields;
- the voluntary problem-report flow remains usable and enum-only;
- wellness, professional-record, and freeform sentinels are absent from fixtures and source;
- Sentry provider settings are independently read back in the approved privacy state;
- one authorized synthetic diagnostic passes field-level inspection;
- documentation truthfully distinguishes anonymous operations from product analytics;
- the complete local and hosted validation gates pass; and
- the PR remains unmerged until the user explicitly approves merge.
