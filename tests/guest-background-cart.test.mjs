import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GUEST_BACKGROUND_CART_STORAGE_KEY,
  createGuestBackgroundCommerceSnapshot,
  normalizeGuestBackgroundCartIds,
  readGuestBackgroundCartIds,
  writeGuestBackgroundCartIds,
} from "../lib/guest-background-cart.ts"

function storage(initial = null) {
  const values = new Map(initial ? [[GUEST_BACKGROUND_CART_STORAGE_KEY, initial]] : [])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  }
}

describe("guest background intent cart", () => {
  it("keeps only unique current purchasable product IDs", () => {
    assert.deepEqual(normalizeGuestBackgroundCartIds([
      "massage-lab-aurora",
      "static-gradient",
      "unknown-background",
      "massage-lab-aurora",
      "massage-lab-dotted-glow",
    ]), ["massage-lab-aurora", "massage-lab-dotted-glow"])
  })

  it("stores only IDs and reconstructs public catalog details", () => {
    const local = storage()
    const ids = writeGuestBackgroundCartIds(local, ["massage-lab-aurora"])
    assert.deepEqual(ids, ["massage-lab-aurora"])
    assert.equal(local.values.get(GUEST_BACKGROUND_CART_STORAGE_KEY), '["massage-lab-aurora"]')
    assert.deepEqual(readGuestBackgroundCartIds(local), ids)

    const snapshot = createGuestBackgroundCommerceSnapshot(ids)
    assert.equal(snapshot.creditBalance, 0)
    assert.equal(snapshot.ownedBackgroundIds.length, 0)
    assert.equal(snapshot.cart.items[0].displayName, "Aurora field")
    assert.equal(snapshot.cart.subtotalAmount, 100)
    assert.equal("userId" in snapshot, false)
  })

  it("fails closed for malformed storage and removes an empty cart", () => {
    const local = storage("not-json")
    assert.deepEqual(readGuestBackgroundCartIds(local), [])
    writeGuestBackgroundCartIds(local, [])
    assert.equal(local.values.has(GUEST_BACKGROUND_CART_STORAGE_KEY), false)
  })
  it("keeps sanitized in-memory IDs when browser storage rejects writes", () => {
    const blocked = {
      setItem: () => { throw new Error("storage blocked") },
      removeItem: () => { throw new Error("storage blocked") },
    }
    assert.deepEqual(writeGuestBackgroundCartIds(blocked, ["massage-lab-aurora"]), ["massage-lab-aurora"])
    assert.deepEqual(writeGuestBackgroundCartIds(blocked, []), [])
  })

})
