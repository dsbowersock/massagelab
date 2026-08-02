import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseComputedMatrix } from "./helpers/computed-matrix.ts"

describe("computed matrix parsing", () => {
  it("accepts a finite Chromium matrix3d", () => {
    assert.equal(
      parseComputedMatrix("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, 24, 0, 1)").length,
      16,
    )
  })

  it("rejects units and other non-finite matrix values", () => {
    assert.throws(
      () => parseComputedMatrix("matrix(1, 0, 0, 1, 6px, 7)"),
      /6 finite computed matrix values/,
    )
  })

  it("rejects JavaScript-only hexadecimal and binary numeric syntax", () => {
    assert.throws(
      () => parseComputedMatrix("matrix(1, 0, 0, 1, 0x1, 0)"),
      /6 finite computed matrix values/,
    )
    assert.throws(
      () => parseComputedMatrix("matrix(1, 0, 0, 1, 0b1, 0)"),
      /6 finite computed matrix values/,
    )
  })
})
