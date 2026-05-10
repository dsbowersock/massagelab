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
