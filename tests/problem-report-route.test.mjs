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

function loadRoute(sentry) {
  return loadCompiledModule(
    routeSource,
    "app/api/support/problem-report/route.ts",
    {
      "@sentry/nextjs": sentry,
      "next/headers": {
        headers: async () => new Headers({ "user-agent": "Mozilla/5.0 Chrome/140.0" }),
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
      captureMessage: () => "event-id",
      flush: async () => false,
    })

    const response = await route.POST(diagnosticRequest())

    assert.equal(response.status, 503)
    assert.deepEqual(response.body, {
      error: "Diagnostic report could not be delivered. Please try again later.",
    })
  })
})
