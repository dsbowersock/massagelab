import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import { backgroundCardCommerceState } from "../lib/background-commerce-client.js"

const cardPath = new URL("../components/backgrounds/background-carousel-card.tsx", import.meta.url)
const carouselPath = new URL("../components/backgrounds/background-carousel.tsx", import.meta.url)
const selectorPath = new URL("../components/backgrounds/BackgroundSelector.tsx", import.meta.url)

function snapshot(overrides = {}) {
  return {
    creditBalance: 0,
    ownedBackgroundIds: [],
    ownerships: [],
    cart: { items: [], reservedOrder: null, subtotalAmount: 0, currency: "usd", notices: [] },
    recentOrders: [],
    ...overrides,
  }
}

describe("production background commerce states", () => {
  it("uses an enabled premium registry card for authoritative ownership states", () => {
    const background = backgroundRegistry.find((entry) => entry.enabled && entry.requiresSubscription)
    assert.ok(background, "expected an enabled premium background")
    const owned = backgroundCardCommerceState({
      background,
      access: { canUse: true, accessSource: "ownership" },
      snapshot: snapshot({
        ownedBackgroundIds: [background.id],
        ownerships: [{
          backgroundId: background.id,
          source: "purchase",
          status: "active",
          acquiredAt: "2026-07-20T10:00:00.000Z",
        }],
      }),
    })
    assert.equal(owned.state, "owned-purchase")
    assert.equal(owned.canSelect, true)
  })

  it("renders ownership, inclusion, cart, reservation, and inactive-status labels", async () => {
    const source = await readFile(cardPath, "utf8")
    for (const label of [
      "Owned",
      "Purchased",
      "Credit",
      "Included",
      "In cart",
      "Reserved",
      "Refund pending",
      "Dispute suspended",
      "Retired",
      "Unavailable",
      "Keep permanently",
    ]) {
      assert.match(source, new RegExp(label))
    }
  })

  it("opens acquisition for locked Select and preserves normal owned selection", async () => {
    const source = await readFile(cardPath, "utf8")
    assert.match(source, /commerceState\.canSelect/)
    assert.match(source, /onLockedSelect\?\.\(\)/)
    assert.match(source, /onSelect\(\)/)
    assert.match(source, /onKeepPermanently\?\.\(\)/)
  })

  it("feeds the same provider snapshot through the shared carousel adapter", async () => {
    const carousel = await readFile(carouselPath, "utf8")
    const selector = await readFile(selectorPath, "utf8")
    assert.match(carousel, /useBackgroundCommerce\(\)/)
    assert.match(carousel, /backgroundCardCommerceState/)
    assert.match(selector, /creditBalance/)
    assert.match(selector, /Loading credits/)
  })
})
