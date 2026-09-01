import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { authRequestNetworkIdentifier } from "../lib/auth-request.ts"
import { buildProblemReportSentryPayload } from "../lib/problem-report.js"
import { isTrustedCheckoutFormOrigin } from "../lib/trusted-form-origin.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeSource = await readFile(new URL(
  "../app/api/support/problem-report/route.ts",
  import.meta.url,
), "utf8")

const VALID_REPORT = {
  category: "page-error",
  area: "chimer-clock",
  route: "/chimer?forbidden_probe=must-not-arrive",
  clientContext: {
    displayMode: "browser",
    online: true,
    viewportWidth: 800,
  },
}

function diagnosticRequest({
  body = JSON.stringify(VALID_REPORT),
  contentType = "application/json",
  origin = "https://massagelab.app",
  url = "https://massagelab.app/api/support/problem-report",
} = {}) {
  const headers = new Headers()
  if (contentType !== null) headers.set("content-type", contentType)
  if (origin !== null) headers.set("origin", origin)
  return new Request(url, {
    method: "POST",
    headers,
    ...(body === null ? {} : { body }),
  })
}

function responseJson(body, init = {}) {
  return {
    body,
    status: init.status ?? 200,
    headers: Object.fromEntries(new Headers(init.headers)),
  }
}

function loadRoute({
  buildPayload = buildProblemReportSentryPayload,
  consumeRateLimit = async () => ({ allowed: true }),
  networkIdentifier = authRequestNetworkIdentifier,
  requestHeaders = new Headers({
    "user-agent": "Mozilla/5.0 Chrome/140.0",
    "x-vercel-forwarded-for": "198.51.100.7",
  }),
  sentry = {
    isEnabled: () => true,
    captureMessage: () => "event-id",
    flush: async () => true,
  },
  siteUrl = "https://massagelab.app",
} = {}) {
  return loadCompiledModule(
    routeSource,
    "app/api/support/problem-report/route.ts",
    {
      "@sentry/nextjs": sentry,
      "next/headers": { headers: async () => requestHeaders },
      "next/server": { NextResponse: { json: responseJson } },
      "@/lib/auth-env": { getSiteUrl: () => siteUrl },
      "@/lib/auth-request": { authRequestNetworkIdentifier: networkIdentifier },
      "@/lib/operational-rate-limit": { consumeOperationalRateLimit: consumeRateLimit },
      "@/lib/problem-report": { buildProblemReportSentryPayload: buildPayload },
      "@/lib/trusted-form-origin": { isTrustedCheckoutFormOrigin },
    },
  )
}

function providerMustStayIdle() {
  return {
    isEnabled: () => assert.fail("Sentry readiness must not be checked"),
    captureMessage: () => assert.fail("captureMessage must not be called"),
    flush: () => assert.fail("flush must not be called"),
  }
}

describe("privacy-safe problem report route", () => {
  it("requires an explicit trusted Origin before inspecting MIME or body", async () => {
    for (const origin of [null, "https://attacker.example"]) {
      const request = {
        headers: new Headers({
          ...(origin ? { origin } : {}),
          "content-type": "text/plain",
        }),
        url: "https://massagelab.app/api/support/problem-report",
        get body() {
          assert.fail("body must not be inspected before origin")
        },
      }
      const response = await loadRoute({
        consumeRateLimit: () => assert.fail("invalid origin must not consume quota"),
        networkIdentifier: () => assert.fail("invalid origin must not derive a network key"),
        sentry: providerMustStayIdle(),
      }).POST(request)

      assert.equal(response.status, 403)
      assert.deepEqual(response.body, { error: "Invalid request origin" })
    }
  })

  it("accepts the configured MassageLab alias only when Fetch Metadata agrees", async () => {
    const accepted = diagnosticRequest({ origin: "https://www.massagelab.app" })
    const rejected = diagnosticRequest()
    rejected.headers.set("sec-fetch-site", "cross-site")

    assert.equal((await loadRoute().POST(accepted)).status, 200)
    assert.equal((await loadRoute().POST(rejected)).status, 403)
  })

  it("requires the exact application/json media type before reading the body", async () => {
    for (const contentType of [null, "text/plain", "application/problem+json", "application/jsonp"]) {
      const headers = new Headers({ origin: "https://massagelab.app" })
      if (contentType) headers.set("content-type", contentType)
      const request = {
        headers,
        url: "https://massagelab.app/api/support/problem-report",
        get body() {
          assert.fail("body must not be inspected before MIME validation")
        },
      }
      const response = await loadRoute({
        consumeRateLimit: () => assert.fail("invalid MIME must not consume quota"),
        networkIdentifier: () => assert.fail("invalid MIME must not derive a network key"),
        sentry: providerMustStayIdle(),
      }).POST(request)

      assert.equal(response.status, 415)
      assert.deepEqual(response.body, { error: "Problem report requires application/json." })
    }
  })

  it("allows application/json parameters while keeping the media type exact", async () => {
    const response = await loadRoute().POST(diagnosticRequest({
      contentType: "Application/JSON; Charset=UTF-8",
    }))

    assert.equal(response.status, 200)
  })

  it("rejects oversized, malformed, absent, array, and null bodies before Sentry or quota", async () => {
    const cases = [
      diagnosticRequest({ body: JSON.stringify({ category: "x".repeat(4096) }) }),
      diagnosticRequest({ body: "{" }),
      diagnosticRequest({ body: null }),
      diagnosticRequest({ body: "[]" }),
      diagnosticRequest({ body: "null" }),
    ]

    for (const request of cases) {
      const response = await loadRoute({
        consumeRateLimit: () => assert.fail("invalid input must not consume quota"),
        networkIdentifier: () => assert.fail("invalid input must not derive a network key"),
        sentry: providerMustStayIdle(),
      }).POST(request)

      assert.equal(response.status, 400)
      assert.deepEqual(response.body, { error: "Problem report could not be accepted." })
    }
  })

  it("rejects a declared body over 2048 bytes", async () => {
    const request = diagnosticRequest()
    request.headers.set("content-length", "2049")

    assert.equal((await loadRoute({ sentry: providerMustStayIdle() }).POST(request)).status, 400)
  })

  it("checks disabled Sentry before trusted network identification and quota", async () => {
    const calls = []
    const route = loadRoute({
      buildPayload(input) {
        calls.push("sanitize")
        return buildProblemReportSentryPayload(input)
      },
      consumeRateLimit: () => assert.fail("disabled Sentry must not consume quota"),
      networkIdentifier: () => assert.fail("disabled Sentry must not derive a network key"),
      sentry: {
        isEnabled() {
          calls.push("enabled")
          return false
        },
        captureMessage: () => assert.fail("captureMessage must not be called"),
        flush: () => assert.fail("flush must not be called"),
      },
    })

    const response = await route.POST(diagnosticRequest())

    assert.equal(response.status, 503)
    assert.deepEqual(response.body, {
      error: "Diagnostic report could not be delivered. Please try again later.",
    })
    assert.deepEqual(calls, ["sanitize", "enabled"])
  })

  it("uses trusted headers and durable quota before one Sentry capture and flush", async () => {
    const calls = []
    const trustedHeaders = new Headers({
      "user-agent": "Mozilla/5.0 Chrome/140.0",
      "x-vercel-forwarded-for": "198.51.100.40",
    })
    const route = loadRoute({
      requestHeaders: trustedHeaders,
      networkIdentifier(request) {
        calls.push("network")
        assert.equal(request.headers, trustedHeaders)
        return "network_household"
      },
      buildPayload(input) {
        calls.push("sanitize")
        assert.equal(input.userAgent, "Mozilla/5.0 Chrome/140.0")
        return buildProblemReportSentryPayload(input)
      },
      async consumeRateLimit(input) {
        calls.push("quota")
        assert.deepEqual(input, {
          operation: "PROBLEM_REPORT",
          networkIdentifier: "network_household",
        })
        return { allowed: true }
      },
      sentry: {
        isEnabled() {
          calls.push("enabled")
          return true
        },
        captureMessage(message, options) {
          calls.push("capture")
          assert.equal(message, "MassageLab privacy-safe problem report")
          assert.equal(options.contexts.problemReport.safePath, "/timer")
          assert.doesNotMatch(JSON.stringify(options), /forbidden_probe/)
          return "event-id"
        },
        async flush(timeout) {
          calls.push("flush")
          assert.equal(timeout, 2000)
          return true
        },
      },
    })

    const response = await route.POST(diagnosticRequest())

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, {
      eventId: "event-id",
      category: "page-error",
      area: "timer",
      safePath: "/timer",
      privacyLevel: "public-tool",
    })
    assert.deepEqual(calls, ["sanitize", "enabled", "network", "quota", "capture", "flush"])
  })

  it("waits for exactly one bounded flush before confirming delivery", async () => {
    let finishDelivery
    const delivery = new Promise((resolve) => {
      finishDelivery = resolve
    })
    const calls = []
    const route = loadRoute({
      sentry: {
        isEnabled: () => true,
        captureMessage() {
          calls.push("capture")
          return "event-id"
        },
        flush(timeout) {
          calls.push(`flush:${timeout}`)
          return delivery
        },
      },
    })

    let settled = false
    const responsePromise = route.POST(diagnosticRequest()).then((response) => {
      settled = true
      return response
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(settled, false)
    finishDelivery(true)
    assert.equal((await responsePromise).status, 200)
    assert.deepEqual(calls, ["capture", "flush:2000"])
  })

  it("returns Retry-After for a durable denial without Sentry delivery", async () => {
    let quotaCalls = 0
    const route = loadRoute({
      consumeRateLimit: async () => {
        quotaCalls += 1
        return { allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 37 }
      },
      sentry: {
        isEnabled: () => true,
        captureMessage: () => assert.fail("denied reports must not be captured"),
        flush: () => assert.fail("denied reports must not be flushed"),
      },
    })

    const response = await route.POST(diagnosticRequest())

    assert.equal(response.status, 429)
    assert.deepEqual(response.body, { error: "Too many diagnostic reports. Please try again later." })
    assert.equal(response.headers["retry-after"], "37")
    assert.equal(quotaCalls, 1)
  })

  it("fails closed on unavailable, thrown, or malformed limiter decisions", async () => {
    const decisions = [
      async () => ({ allowed: false, reason: "UNAVAILABLE" }),
      async () => {
        throw new Error("persistence unavailable")
      },
      async () => ({ allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 0 }),
      async () => ({ allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 1.5 }),
    ]

    for (const consumeRateLimit of decisions) {
      const response = await loadRoute({
        consumeRateLimit,
        sentry: {
          isEnabled: () => true,
          captureMessage: () => assert.fail("unavailable quota must not capture"),
          flush: () => assert.fail("unavailable quota must not flush"),
        },
      }).POST(diagnosticRequest())

      assert.equal(response.status, 503)
      assert.deepEqual(response.body, {
        error: "Diagnostic report could not be delivered. Please try again later.",
      })
    }
  })

  it("shares one injected durable quota owner across fresh route instances", async () => {
    let consumed = 0
    let captured = 0
    const consumeRateLimit = async () => {
      consumed += 1
      return consumed === 1
        ? { allowed: true }
        : { allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 60 }
    }
    const sentry = {
      isEnabled: () => true,
      captureMessage() {
        captured += 1
        return "event-id"
      },
      flush: async () => true,
    }
    const firstInstance = loadRoute({ consumeRateLimit, sentry })
    const secondInstance = loadRoute({ consumeRateLimit, sentry })

    assert.equal((await firstInstance.POST(diagnosticRequest())).status, 200)
    assert.equal((await secondInstance.POST(diagnosticRequest())).status, 429)
    assert.equal(consumed, 2)
    assert.equal(captured, 1)
  })

  it("keeps accepted capture and flush failures charged with generic 503", async () => {
    const failures = [
      {
        captureMessage: () => {
          throw new Error("capture failed")
        },
        flush: () => assert.fail("flush must not follow a failed capture"),
      },
      {
        captureMessage: () => "event-id",
        flush: async () => {
          throw new Error("flush failed")
        },
      },
      {
        captureMessage: () => "event-id",
        flush: async () => false,
      },
    ]

    for (const failure of failures) {
      let quotaCalls = 0
      const response = await loadRoute({
        consumeRateLimit: async () => {
          quotaCalls += 1
          return { allowed: true }
        },
        sentry: { isEnabled: () => true, ...failure },
      }).POST(diagnosticRequest())

      assert.equal(response.status, 503)
      assert.deepEqual(response.body, {
        error: "Diagnostic report could not be delivered. Please try again later.",
      })
      assert.equal(quotaCalls, 1)
    }
  })
})
