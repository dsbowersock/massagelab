import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseComputedMatrix } from "./helpers/computed-matrix.ts"

describe("computed matrix parsing", () => {
  it("rejects a computed transform that is not a matrix", () => {
    assert.throws(
      () => parseComputedMatrix("none"),
      /Expected a computed 2D or 3D matrix/,
    )
  })

  it("accepts a finite Chromium matrix3d", () => {
    assert.deepEqual(
      parseComputedMatrix("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, 24, 0, 1)"),
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, 24, 0, 1],
    )
  })

  it("accepts a finite Chromium matrix in authored order", () => {
    assert.deepEqual(
      parseComputedMatrix("matrix(1, 0.25, -0.5, 1, 12, 24)"),
      [1, 0.25, -0.5, 1, 12, 24],
    )
  })

  it("rejects units and other non-finite matrix values", () => {
    assert.throws(
      () => parseComputedMatrix("matrix(1, 0, 0, 1, 6px, 7)"),
      /6 finite computed matrix values/,
    )
    assert.throws(
      () => parseComputedMatrix("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12px, 24, 0, 1)"),
      /16 finite computed matrix values/,
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

  it("rejects matrices with the wrong argument count", () => {
    assert.throws(
      () => parseComputedMatrix("matrix(1, 0, , 1, 12, 24)"),
      /6 finite computed matrix values/,
    )
    assert.throws(
      () => parseComputedMatrix("matrix(1, 0, 0, 1, 12)"),
      /6 finite computed matrix values/,
    )
    assert.throws(
      () => parseComputedMatrix("matrix3d(1, 0, 0, 1)"),
      /16 finite computed matrix values/,
    )
  })
})
