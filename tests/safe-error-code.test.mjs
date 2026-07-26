import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { safeErrorCode } from "../lib/safe-error-code.js"

describe("safe operational error codes", () => {
  it("preserves only explicitly supported operational and provider codes", () => {
    for (const code of [
      "P1001",
      "P1002",
      "P2002",
      "P2024",
      "P2037",
      "api_connection_error",
      "idempotency_key_in_use",
      "lock_timeout",
      "rate_limit",
      "resource_missing",
    ]) {
      assert.equal(safeErrorCode({ code }), code)
    }
  })

  it("falls back without exposing unsupported, malformed, or non-string error fields", () => {
    for (const error of [
      undefined,
      null,
      "thrown string",
      503,
      new Error("private processor message"),
      { code: 42 },
      { code: "" },
      { code: "contains a space" },
      { code: "unsafe\ncustomer@example.com" },
      { code: "x".repeat(81) },
      { code: "provider_timeout" },
      { code: "Stripe.API-ERROR" },
      { code: `x${"a".repeat(79)}` },
    ]) {
      assert.equal(safeErrorCode(error), "unexpected_error")
    }
  })

  it("falls back when proxies or accessors throw during code inspection", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("proxy getter failed")
      },
      has() {
        throw new Error("proxy has trap failed")
      },
    })
    const accessor = Object.defineProperty({}, "code", {
      get() {
        throw new Error("accessor failed")
      },
    })

    assert.equal(safeErrorCode(proxy), "unexpected_error")
    assert.equal(safeErrorCode(accessor), "unexpected_error")
  })
})
