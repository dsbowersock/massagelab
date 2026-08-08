import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ADMIN_REASON_CODES,
  validateAdminMetadata,
  validateAdminReason,
  validateAdminSafePayload,
} from "../lib/admin/operation-contract.ts"

describe("admin operation contract", () => {
  it("accepts every approved support reason", () => {
    for (const reasonCode of ADMIN_REASON_CODES) {
      validateAdminReason(reasonCode, reasonCode === "OTHER" ? "Documented exception." : undefined)
    }
  })

  it("rejects invalid support reasons and undocumented other reasons", () => {
    assert.throws(() => validateAdminReason("UNSUPPORTED", undefined), /Select a valid support reason\./)
    assert.throws(() => validateAdminReason("OTHER", "   "), /Other requires an internal note\./)
  })

  it("enforces the internal-note length boundary", () => {
    validateAdminReason("USER_REQUEST", "x".repeat(500))
    assert.throws(() => validateAdminReason("USER_REQUEST", "x".repeat(501)), /Internal notes are limited to 500 characters\./)
  })

  it("rejects restricted metadata keys at every nesting level", () => {
    assert.throws(() => validateAdminSafePayload({ passwordHint: "never store" }), /restricted data/)
    assert.throws(() => validateAdminMetadata({ context: [{ login: { backupCode: "never store" } }] }), /restricted data/)
  })

  it("keeps the approved forbidden-key regex semantics", () => {
    for (const key of ["payment_method", "fromRole", "promotion"]) {
      assert.throws(() => validateAdminSafePayload({ [key]: "never store" }), /restricted data/)
    }

    assert.deepEqual(validateAdminSafePayload({ paymentMethod: "reference-only" }), { paymentMethod: "reference-only" })
  })

  it("enforces payload depth, entry, and string boundaries", () => {
    const nestedPayload = (levels) => {
      let payload = "ok"
      for (let index = 0; index < levels; index += 1) payload = { next: payload }
      return payload
    }

    for (const { payload, valid } of [
      { payload: nestedPayload(5), valid: true },
      { payload: nestedPayload(6), valid: false },
      { payload: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`key${index}`, index])), valid: true },
      { payload: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`key${index}`, index])), valid: false },
      { payload: { note: "x".repeat(500) }, valid: true },
      { payload: { note: "x".repeat(501) }, valid: false },
    ]) {
      if (valid) {
        assert.doesNotThrow(() => validateAdminSafePayload(payload))
      } else {
        assert.throws(() => validateAdminSafePayload(payload), /supported size/)
      }
    }
  })

  it("rejects non-finite, unsupported, cyclic, and accessor-backed values without reading accessors", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, undefined, 1n, new Date(), () => {}]) {
      assert.throws(() => validateAdminSafePayload({ value }), /JSON-compatible/)
    }

    const cyclic = {}
    cyclic.self = cyclic
    assert.throws(() => validateAdminSafePayload(cyclic), /JSON-compatible/)

    for (const descriptor of [
      { get: () => "should not run" },
      { set: () => {} },
    ]) {
      let accessorCalls = 0
      const payload = {}
      Object.defineProperty(payload, "details", {
        ...descriptor,
        enumerable: true,
        get: descriptor.get ? () => {
          accessorCalls += 1
          return "should not run"
        } : undefined,
      })
      assert.throws(() => validateAdminSafePayload(payload), /JSON-compatible/)
      assert.equal(accessorCalls, 0)
    }
  })

  it("returns a detached snapshot of safe operation payload values", () => {
    const payload = {
      accountId: "user_123",
      grantedRole: "ANATOMY_EDITOR",
      change: { previous: "ANATOMY_REVIEWER", next: "ANATOMY_EDITOR" },
      tags: ["delegated-role", "support"],
    }
    const snapshot = validateAdminSafePayload(payload)

    assert.deepEqual(snapshot, payload)
    assert.notStrictEqual(snapshot, payload)
    assert.notStrictEqual(snapshot.change, payload.change)
    assert.notStrictEqual(snapshot.tags, payload.tags)

    payload.change.next = "ADMIN"
    payload.tags[0] = "changed"
    let laterGetterCalls = 0
    Object.defineProperty(payload.change, "later", {
      enumerable: true,
      get: () => {
        laterGetterCalls += 1
        return "should not affect the snapshot"
      },
    })

    assert.deepEqual(snapshot, {
      accountId: "user_123",
      grantedRole: "ANATOMY_EDITOR",
      change: { previous: "ANATOMY_REVIEWER", next: "ANATOMY_EDITOR" },
      tags: ["delegated-role", "support"],
    })
    assert.equal(laterGetterCalls, 0)
  })
})
