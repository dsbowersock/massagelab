import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { safeErrorCode } from "../lib/safe-error-code.js"

describe("safe operational error codes", () => {
  it("preserves only allowlisted processor-safe codes", () => {
    for (const code of [
      "provider_timeout",
      "Stripe.API-ERROR",
      `x${"a".repeat(79)}`,
    ]) {
      assert.equal(safeErrorCode({ code }), code)
    }
  })

  it("falls back without exposing malformed or non-string error fields", () => {
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
    ]) {
      assert.equal(safeErrorCode(error), "unexpected_error")
    }
  })
})
