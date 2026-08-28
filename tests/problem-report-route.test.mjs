import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { buildProblemReportSentryPayload } from "../lib/problem-report.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeSource = await readFile(
  new URL("../app/api/support/problem-report/route.ts", import.meta.url),
  "utf8",
)

function diagnosticRequest() {
  return new Request("https://example.test/api/support/problem-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "page-error",
      area: "chimer-clock",
      route: "/chimer?forbidden_probe=must-not-arrive",
      clientContext: {
        displayMode: "browser",
        online: true,
        viewportWidth: 800,
      },
    }),
  })
}

function loadRoute(sentry, requestHeaders = new Headers({ "user-agent": "Mozilla/5.0 Chrome/140.0" })) {
  return loadCompiledModule(
    routeSource,
    "app/api/support/problem-report/route.ts",
    {
      "@sentry/nextjs": sentry,
      "next/headers": {
        headers: async () => requestHeaders,
      },
      "next/server": {
        NextResponse: {
          json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
        },
      },
      "@/lib/problem-report": { buildProblemReportSentryPayload },
    },
  )
}

describe("privacy-safe problem report route", () => {
  it("waits for Sentry delivery before confirming the diagnostic report", async () => {
    let finishDelivery
    const delivery = new Promise((resolve) => {
      finishDelivery = resolve
    })
    const calls = []
    const route = loadRoute({
      isEnabled: () => true,
      captureMessage(message, options) {
        calls.push({ operation: "capture", message, options })
        return "event-id"
      },
      flush(timeout) {
        calls.push({ operation: "flush", timeout })
        return delivery
      },
    })

    let settled = false
    const responsePromise = route.POST(diagnosticRequest()).then((response) => {
      settled = true
      return response
    })
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(settled, false)
    finishDelivery(true)

    const response = await responsePromise
    assert.equal(response.status, 200)
    assert.equal(response.body.eventId, "event-id")
    assert.deepEqual(calls.map(({ operation }) => operation), ["capture", "flush"])
    assert.equal(calls[1].timeout, 2000)
  })

  it("does not report success when Sentry delivery cannot be confirmed", async () => {
    const route = loadRoute({
      isEnabled: () => true,
      captureMessage: () => "event-id",
      flush: async () => false,
    })

    const response = await route.POST(diagnosticRequest())

    assert.equal(response.status, 503)
    assert.deepEqual(response.body, {
      error: "Diagnostic report could not be delivered. Please try again later.",
    })
  })

  it("does not report success when the Sentry transport is unavailable", async () => {
    const route = loadRoute({
      isEnabled: () => false,
      captureMessage: () => assert.fail("captureMessage must not be called"),
      flush: () => assert.fail("flush must not be called"),
    })

    const response = await route.POST(diagnosticRequest())

    assert.equal(response.status, 503)
    assert.deepEqual(response.body, {
      error: "Diagnostic report could not be delivered. Please try again later.",
    })
  })

  it("rejects an oversized body even without a Content-Length header", async () => {
    const request = new Request("https://example.test/api/support/problem-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "x".repeat(4096) }),
    })
    const route = loadRoute({
      isEnabled: () => assert.fail("Sentry readiness must not be checked"),
      captureMessage: () => assert.fail("captureMessage must not be called"),
      flush: () => assert.fail("flush must not be called"),
    })

    const response = await route.POST(request)

    assert.equal(response.status, 400)
    assert.deepEqual(response.body, {
      error: "Problem report could not be accepted.",
    })
  })

  it("rejects an absent body without calling Sentry", async () => {
    const route = loadRoute({
      isEnabled: () => assert.fail("Sentry readiness must not be checked"),
      captureMessage: () => assert.fail("captureMessage must not be called"),
      flush: () => assert.fail("flush must not be called"),
    })
    const request = new Request("https://example.test/api/support/problem-report", {
      method: "POST",
    })

    const response = await route.POST(request)

    assert.equal(response.status, 400)
    assert.deepEqual(response.body, {
      error: "Problem report could not be accepted.",
    })
  })

  it("does not let a rate-limited client consume the global allowance", async () => {
    const requestHeaders = new Headers({
      "user-agent": "Mozilla/5.0 Chrome/140.0",
      "x-forwarded-for": "192.0.2.1",
    })
    const route = loadRoute({
      isEnabled: () => true,
      captureMessage: () => "event-id",
      flush: async () => true,
    }, requestHeaders)

    for (let index = 0; index < 5; index += 1) {
      assert.equal((await route.POST(diagnosticRequest())).status, 200)
    }
    for (let index = 0; index < 100; index += 1) {
      assert.equal((await route.POST(diagnosticRequest())).status, 429)
    }

    requestHeaders.set("x-forwarded-for", "192.0.2.2")
    assert.equal((await route.POST(diagnosticRequest())).status, 200)
  })
})
