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

  assert.deepEqual(event.request, { url: "https://massagelab.app/notes/soap" })
  assert.equal("user" in event, false)
  assert.equal(event.transaction, "/notes/soap")
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

  assert.equal("user" in event, false)
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

test("sanitizeSentryEvent strips transaction request metadata and router state", () => {
  const event = sanitizeSentryEvent({
    transaction: "/account?billing=checkout-error&_rsc=abc123",
    contexts: {
      trace: {
        data: {
          "http.target": "/account?billing=checkout-error&_rsc=abc123",
          "http.request.header.next_router_state_tree": "['',{'children':['account']}]",
          "http.request.header.cookie": "authjs.session-token=secret",
          "http.response.status_code": 200,
        },
      },
    },
    extra: {
      "next_router_state_tree": "['',{'children':['notes','soap']}]",
      "http.request.header.rsc": "1",
      "http.target": "/notes/soap?client=Jane",
    },
  })

  assert.equal(event.transaction, "/account")
  assert.equal(event.contexts.trace.data["http.target"], "/account")
  assert.equal(event.contexts.trace.data["http.request.header.next_router_state_tree"], "[Filtered]")
  assert.equal(event.contexts.trace.data["http.request.header.cookie"], "[Filtered]")
  assert.equal(event.contexts.trace.data["http.response.status_code"], 200)
  assert.equal("extra" in event, false)
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

test("sanitizeSentrySpan scrubs urls and sensitive span attributes", () => {
  const span = sanitizeSentrySpan({
    description: "GET /api/account/preferences?email=person@example.com",
    data: {
      "http.url": "https://massagelab.app/api/account/preferences?email=person@example.com",
      clientName: "Jane Doe",
      status_code: 200,
    },
  })

  assert.equal(span.description, "GET /api/account/preferences")
  assert.deepEqual(span.data, {
    "http.url": "https://massagelab.app/api/account/preferences",
    clientName: "[Filtered]",
    status_code: 200,
  })
})
