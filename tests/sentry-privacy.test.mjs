import test from "node:test"
import assert from "node:assert/strict"
import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeSentrySpan,
  stripUrlSensitiveParts,
} from "../lib/sentry-privacy.js"

test("stripUrlSensitiveParts removes query strings and fragments", () => {
  assert.equal(stripUrlSensitiveParts("/notes/soap?client=Jane#pain-map"), "/notes/soap")
  assert.equal(stripUrlSensitiveParts("https://massagelab.app/chimer?token=abc#clock"), "https://massagelab.app/chimer")
})

test("sanitizeSentryEvent removes request body, headers, query strings, and default PII", () => {
  const event = sanitizeSentryEvent({
    request: {
      url: "https://massagelab.app/notes/soap?client=Jane",
      headers: { cookie: "session=secret" },
      data: { soapNote: "client reported pain" },
      query_string: "client=Jane",
      fragment: "pain-map",
    },
    user: {
      id: "user_123",
      email: "person@example.com",
      ip_address: "192.0.2.1",
    },
    transaction: "/notes/soap?client=Jane",
    extra: {
      licenseNumber: "ABC123",
      message: "Email person@example.com token=secret",
    },
  })

  assert.deepEqual(event.request, { url: "/notes/[local-first]" })
  assert.deepEqual(event.user, { ip_address: null })
  assert.equal(event.transaction, "/notes/[local-first]")
  assert.equal("extra" in event, false)
})

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

  assert.deepEqual(event.user, { ip_address: null })
  assert.deepEqual(event.tags, {
    "ml.report": "privacy-safe-problem-report",
    "ml.report.area": "timer",
  })
  assert.doesNotMatch(JSON.stringify(event), /account_123|visitor_123|device_123|person@example.com/)
  assert.equal("extra" in event, false)
})

test("sanitizeSentryEvent scrubs diagnostic messages and exception values", () => {
  const event = sanitizeSentryEvent({
    message: "SOAP note: person@example.com reports neck pain token=secret",
    exception: {
      values: [
        {
          type: "Error",
          value: "Client intake says shoulder pain and email person@example.com token=secret",
          stacktrace: {
            frames: [
              {
                filename: "app/notes/soap/page.tsx",
                vars: {
                  soapNote: "client reports pain",
                  safeCount: 1,
                },
              },
            ],
          },
        },
      ],
    },
    logentry: {
      message: "Journal entry included person@example.com and token=secret",
      formatted: "Journal entry included person@example.com and token=secret",
    },
  })

  assert.equal(event.message, "[Filtered]")
  assert.equal(event.exception.values[0].type, "Error")
  assert.equal(event.exception.values[0].value, "[Filtered]")
  assert.equal(event.exception.values[0].stacktrace.frames[0].vars, "[Filtered]")
  assert.equal(event.logentry.message, "[Filtered]")
  assert.equal(event.logentry.formatted, "[Filtered]")
})

test("sanitizeSentryEvent preserves safe runtime diagnostics without clinical content", () => {
  const event = sanitizeSentryEvent({
    message: "ReferenceError: missingWidgetState is not defined Authorization: Bearer msg-secret",
    exception: {
      values: [
        {
          type: "ReferenceError",
          value: "missingWidgetState is not defined token: exception-secret",
          stacktrace: {
            frames: [
              {
                filename: "app/account/page.tsx",
                function: "AccountPage Authorization: Bearer frame-secret",
                abs_path: "C:/Users/derri/code/my_projects/massagelab/app/account/page.tsx",
              },
            ],
          },
        },
      ],
    },
    logentry: {
      message: "TypeError: Cannot read properties of undefined (reading 'profile') Authorization: Bearer log-secret",
      formatted: "TypeError: Cannot read properties of undefined (reading 'profile') token: formatted-secret",
    },
  })

  assert.equal(event.message, "ReferenceError: missingWidgetState is not defined Authorization: [Filtered]")
  assert.equal(event.exception.values[0].type, "ReferenceError")
  assert.equal(event.exception.values[0].value, "missingWidgetState is not defined token: [Filtered]")
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename, "app/account/page.tsx")
  assert.equal(event.exception.values[0].stacktrace.frames[0].function, "AccountPage Authorization: [Filtered]")
  assert.equal(event.logentry.message, "TypeError: Cannot read properties of undefined (reading 'profile') Authorization: [Filtered]")
  assert.equal(event.logentry.formatted, "TypeError: Cannot read properties of undefined (reading 'profile') token: [Filtered]")
})

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
        parent_span_id: "c".repeat(16),
        op: "http.server",
        status: "ok",
        origin: "auto.http.nextjs",
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
  assert.deepEqual(event.contexts.trace, {
    trace_id: "a".repeat(32),
    span_id: "b".repeat(16),
    parent_span_id: "c".repeat(16),
    op: "http.server",
    status: "ok",
    origin: "auto.http.nextjs",
    data: {
      "http.target": "/account-or-auth",
      "http.response.status_code": 200,
    },
  })
})

test("sanitizeSentryEvent rejects malicious values placed in allowed trace fields", () => {
  const event = sanitizeSentryEvent({
    contexts: {
      trace: {
        trace_id: "person@example.com",
        span_id: "b".repeat(16),
        parent_span_id: "session_123",
        op: "patientJane",
        status: "ok?account=person@example.com",
        origin: "unreviewed-operation",
        data: {
          "http.request.method": "GET /account?user=user_123",
          "http.response.status_code": 999,
          "http.status_code": "200",
          "http.target": "select * from User where email = 'person@example.com'",
        },
      },
    },
  })

  assert.deepEqual(event.contexts.trace, {
    span_id: "b".repeat(16),
  })
  assert.doesNotMatch(JSON.stringify(event), /person@example\.com|patientJane|unreviewed-operation|session_123|select \*/i)
})

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

test("sanitizeSentrySpan keeps route family, status, and method only", () => {
  const span = sanitizeSentrySpan({
    description: "GET /api/account/preferences?email=person@example.com",
    name: "GET /api/account/preferences?email=person@example.com",
    trace_id: "d".repeat(32),
    span_id: "e".repeat(16),
    parent_span_id: "f".repeat(16),
    op: "http.client",
    status: "ok",
    origin: "auto.http.nextjs",
    data: {
      "http.url": "https://massagelab.app/api/account/preferences?email=person@example.com",
      "http.request.method": "GET",
      "http.response.status_code": 200,
      "sentry.op": "http.client",
      "sentry.origin": "auto.http.nextjs",
      "db.query": "select * from User where email = 'person@example.com'",
      clientName: "Jane Doe",
    },
    attributes: {
      "http.request.method": "POST /api/account?user=user_123",
      "http.response.status_code": 700,
      "http.status_code": "200",
      "sentry.op": "patientJane",
      "sentry.origin": "unreviewed-operation",
    },
  })

  assert.equal(span.description, "GET /api/[route]")
  assert.equal(span.name, "GET /api/[route]")
  assert.equal(span.trace_id, "d".repeat(32))
  assert.equal(span.span_id, "e".repeat(16))
  assert.equal(span.parent_span_id, "f".repeat(16))
  assert.equal(span.op, "http.client")
  assert.equal(span.status, "ok")
  assert.equal(span.origin, "auto.http.nextjs")
  assert.deepEqual(span.data, {
    "http.request.method": "GET",
    "http.response.status_code": 200,
    "sentry.op": "http.client",
    "sentry.origin": "auto.http.nextjs",
  })
  assert.equal("attributes" in span, false)
  assert.doesNotMatch(JSON.stringify(span), /person@example\.com|patientJane|unreviewed-operation|user_123/i)
})

test("sanitizeSentrySpan rejects malicious top-level trace identity and operation values", () => {
  const span = sanitizeSentrySpan({
    trace_id: "person@example.com",
    span_id: "a".repeat(16),
    parent_span_id: "session_123",
    op: "patientJane",
    status: "ok?account=user_123",
    origin: "unreviewed-operation",
  })

  assert.deepEqual(span, { span_id: "a".repeat(16) })
  assert.doesNotMatch(JSON.stringify(span), /person@example\.com|patientJane|unreviewed-operation|user_123|session_123/i)
})

test("sanitizeSentryEvent and span retain only exact current operation and origin domains", () => {
  const operations = [
    "db",
    "function.server_action",
    "http.client",
    "http.client.stream",
    "http.server",
    "http.server.middleware",
    "navigation",
    "navigation.redirect",
    "pageload",
  ]
  const origins = [
    "auto.db.otel.prisma",
    "auto.function.nextjs.server_action",
    "auto.function.nextjs.wrap_api_handler",
    "auto.function.nextjs.wrap_middleware",
    "auto.http.browser",
    "auto.http.browser.stream",
    "auto.http.nextjs",
    "auto.http.otel.http",
    "auto.http.otel.node_fetch",
    "auto.navigation.browser",
    "auto.navigation.nextjs.app_router_instrumentation",
    "auto.navigation.nextjs.pages_router_instrumentation",
    "auto.pageload.browser",
    "auto.pageload.nextjs.app_router_instrumentation",
    "auto.pageload.nextjs.pages_router_instrumentation",
    "manual",
  ]

  for (const op of operations) {
    const event = sanitizeSentryEvent({ contexts: { trace: { op } } })
    const span = sanitizeSentrySpan({ op, data: { "sentry.op": op } })

    assert.equal(event.contexts.trace.op, op)
    assert.equal(span.op, op)
    assert.equal(span.data["sentry.op"], op)
  }

  for (const origin of origins) {
    const event = sanitizeSentryEvent({ contexts: { trace: { origin } } })
    const span = sanitizeSentrySpan({ origin, data: { "sentry.origin": origin } })

    assert.equal(event.contexts.trace.origin, origin)
    assert.equal(span.origin, origin)
    assert.equal(span.data["sentry.origin"], origin)
  }
})
