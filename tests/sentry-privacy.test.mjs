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
  assert.deepEqual(event.user, { id: "user_123" })
  assert.equal(event.transaction, "/notes/soap")
  assert.equal(event.extra.licenseNumber, "[Filtered]")
  assert.equal(event.extra.message, "Email [Filtered] token=[Filtered]")
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
  assert.equal(event.extra.next_router_state_tree, "[Filtered]")
  assert.equal(event.extra["http.request.header.rsc"], "[Filtered]")
  assert.equal(event.extra["http.target"], "/notes/soap")
})

test("sanitizeSentryBreadcrumb drops console breadcrumbs and scrubs fetch data", () => {
  assert.equal(sanitizeSentryBreadcrumb({ category: "console", message: "license=ABC" }), null)

  const breadcrumb = sanitizeSentryBreadcrumb({
    category: "fetch",
    message: "GET https://massagelab.app/account?email=person@example.com",
    data: {
      url: "https://massagelab.app/account?email=person@example.com",
      authorization: "Bearer secret",
    },
  })

  assert.equal(breadcrumb.message, "GET https://massagelab.app/account")
  assert.deepEqual(breadcrumb.data, {
    url: "https://massagelab.app/account",
    authorization: "[Filtered]",
  })
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
