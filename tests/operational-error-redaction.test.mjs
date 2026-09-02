import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatOperationalError } from "../scripts/operational-error-redaction.mjs"

describe("operational error redaction", () => {
  it("bounds work and removes URLs, email-like tokens, and sensitive assignments", () => {
    const oversized = "x".repeat(20_000)
    const formatted = formatOperationalError(new Error(
      `connect person@example.com postgresql://operator:secret@db.example/app password=hunter2 token=abc123 api_key=key123 ${oversized}`,
    ))

    assert.equal(formatted.startsWith("connect [redacted] [redacted] [redacted] [redacted] [redacted]"), true)
    assert.doesNotMatch(formatted, /person@example|postgresql|operator|hunter2|abc123|key123|password|token|api_key/i)
    assert.ok(formatted.length <= 500)
  })

  it("redacts local email-like tokens and complete quoted secret values", () => {
    const formatted = formatOperationalError("notify alias@localhost password=\"two words\" safe context")

    assert.equal(formatted, "notify [redacted] [redacted] safe context")
  })

  it("redacts the complete Authorization credential instead of leaving its value behind", () => {
    for (const input of [
      "request failed authorization: Bearer actual-secret safe context",
      "request failed Authorization=Basic dXNlcjpwYXNzd29yZA== safe context",
    ]) {
      const formatted = formatOperationalError(input)

      assert.equal(formatted, "request failed [redacted] safe context")
      assert.doesNotMatch(formatted, /actual-secret|dXNlcjpwYXNzd29yZA|Bearer|Basic/i)
    }
  })
})
