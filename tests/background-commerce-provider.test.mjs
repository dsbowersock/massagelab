import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const providerPath = new URL("../components/backgrounds/BackgroundCommerceProvider.tsx", import.meta.url)
const layoutPath = new URL("../components/layout-wrapper.tsx", import.meta.url)

async function source(path) {
  return readFile(path, "utf8")
}

describe("BackgroundCommerceProvider contract", () => {
  it("owns one no-store authenticated state fetch and cancels it on cleanup", async () => {
    const value = await source(providerPath)
    assert.match(value, /\/api\/background-commerce\/state/)
    assert.match(value, /credentials:\s*"same-origin"/)
    assert.match(value, /cache:\s*"no-store"/)
    assert.match(value, /new AbortController\(\)/)
    assert.match(value, /controller\.abort\(\)/)
  })

  it("refreshes account state on focus and reconnect while signed-out state stays local", async () => {
    const value = await source(providerPath)
    assert.match(value, /if \(!enabled\) \{[\s\S]*readGuestBackgroundCartIds/)
    assert.match(value, /createGuestBackgroundCommerceSnapshot/)
    assert.match(value, /addEventListener\("focus"/)
    assert.match(value, /addEventListener\("online"/)
  })

  it("merges guest intent through the authenticated cart API and keeps failed IDs local", async () => {
    const value = await source(providerPath)
    assert.match(value, /pendingIds = readGuestBackgroundCartIds/)
    assert.match(value, /for \(const backgroundId of pendingIds\)/)
    assert.match(value, /"\/api\/background-commerce\/cart"/)
    assert.match(value, /enqueueMutation\("merge-guest-cart"/)
    assert.match(value, /void refresh\(\)/)
    assert.match(value, /remainingIds\.push\(backgroundId\)/)
    assert.match(value, /writeGuestBackgroundCartIds\(window\.localStorage, remainingIds\)/)
    assert.match(value, /ITEM_RESERVED/)
  })

  it("serializes mutations and refreshes the full authoritative snapshot", async () => {
    const value = await source(providerPath)
    assert.match(value, /mutationQueueRef/)
    assert.match(value, /enqueueSerializedOperation/)
    assert.match(value, /mutationQueueRef\.current\.then\(operation, operation\)/)
    assert.match(value, /await enqueueSerializedOperation\(async \(\) => \{[\s\S]*checkout-redirect-begin/)
    assert.match(value, /normalizeBackgroundCommerceSnapshot/)
    assert.match(value, /if \(controller\.signal\.aborted\) return[\s\S]*dispatch\(\{ type: "mutation-begin"/)
    assert.match(value, /type: "mutation-refresh-failure"/)
    assert.doesNotMatch(value, /creditBalance\s*[+\-]=|ownedBackgroundIds\.push/)
  })

  it("keeps guest cart identities unique and removes one matching line", async () => {
    const value = await source(providerPath)
    assert.match(value, /current\.includes\(item\.productKey\) \? current/)
    assert.match(value, /const matchIndex = current\.indexOf\(backgroundId\)/)
    assert.match(value, /index !== matchIndex/)
  })

  it("uses stable public auth errors and validates Stripe redirects", async () => {
    const value = await source(providerPath)
    assert.match(value, /AUTH_REQUIRED/)
    assert.match(value, /EMAIL_VERIFICATION_REQUIRED/)
    assert.match(value, /checkout\.stripe\.com/)
    assert.match(value, /window\.location\.assign/)
    assert.match(value, /const cancelReservation[\s\S]*if \(!enabled\)[\s\S]*AUTH_REQUIRED/)
  })

  it("exposes the shared API and retains caller-provided redemption idempotency keys", async () => {
    const value = await source(providerPath)
    for (const member of ["refresh", "addToCart", "removeFromCart", "redeemCredit", "startCheckout"]) {
      assert.match(value, new RegExp(`\\b${member}\\b`))
    }
    assert.match(value, /idempotencyKey/)
    assert.match(value, /confirmationAccepted:\s*true/)
  })

  it("mounts exactly once at the shared layout boundary", async () => {
    const value = await source(layoutPath)
    assert.equal((value.match(/<BackgroundCommerceProvider\b/g) ?? []).length, 1)
    assert.match(value, /enabled=\{Boolean\(user\)\}/)
  })
})
