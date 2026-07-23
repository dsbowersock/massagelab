import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import { backgroundCardCommerceState } from "../lib/background-commerce-client.js"

const cardPath = new URL("../components/backgrounds/background-carousel-card.tsx", import.meta.url)
const carouselPath = new URL("../components/backgrounds/background-carousel.tsx", import.meta.url)
const selectorPath = new URL("../components/backgrounds/BackgroundSelector.tsx", import.meta.url)
const setTimerPath = new URL("../app/chimer/set-timer.tsx", import.meta.url)
const setTimerStylesPath = new URL("../app/chimer/set-timer.module.css", import.meta.url)

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

  it("presents locked backgrounds as actionable Unlock controls", async () => {
    const source = await readFile(cardPath, "utf8")
    assert.match(source, /commerceState\.canSelect/)
    assert.match(source, /onLockedSelect\?\.\(\)/)
    assert.match(source, /onSelect\(\)/)
    assert.match(source, /onKeepPermanently\?\.\(\)/)
    assert.match(source, /type="button"/)
    assert.match(source, /locked \? "Unlock"/)
    assert.match(source, /variant=\{locked \? "default" : "glow"\}/)
    assert.match(source, /Add now; sign in or create an account at checkout\./)
  })

  it("feeds the same provider snapshot through the shared carousel adapter", async () => {
    const carousel = await readFile(carouselPath, "utf8")
    const selector = await readFile(selectorPath, "utf8")
    assert.match(carousel, /useBackgroundCommerce\(\)/)
    assert.match(carousel, /backgroundCardCommerceState/)
    assert.match(selector, /useBackgroundCreditStatus/)
    assert.match(selector, /setAcquisition/)
    assert.match(selector, /<BackgroundAcquisitionDialog/)
    assert.match(selector, /onAcquired/)
    assert.match(selector, /const selectedControls =/)
    assert.match(selector, /\{selectedControls \? \(/)
  })

  it("removes the redundant Chimer background step shell and empty controls card", async () => {
    const setup = await readFile(setTimerPath, "utf8")
    const styles = await readFile(setTimerStylesPath, "utf8")
    const selector = await readFile(selectorPath, "utf8")
    assert.match(setup, /activeStep === CHIMER_BACKGROUND_SETUP_STEP_INDEX \? styles\.backgroundStepContent/)
    assert.match(styles, /\.backgroundStepContent\s*\{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;/)
    assert.doesNotMatch(selector, /\{renderSelectedControls\(selectedOption\)\}/)
  })
})

describe("background acquisition and shared account cart", () => {
  const acquisitionPath = new URL("../components/backgrounds/BackgroundAcquisitionDialog.tsx", import.meta.url)
  const confirmationPath = new URL("../components/backgrounds/BackgroundCreditConfirmationDialog.tsx", import.meta.url)
  const cartPath = new URL("../components/backgrounds/BackgroundCommerceCart.tsx", import.meta.url)
  const triggerPath = new URL("../components/commerce/CommerceCartTrigger.tsx", import.meta.url)
  const layoutPath = new URL("../components/layout-wrapper.tsx", import.meta.url)

  it("offers exactly the approved locked-card actions and subscriber distinction", async () => {
    const source = await readFile(acquisitionPath, "utf8")
    for (const label of ["Use free credit", "Buy for $1", "Unlock all"]) {
      assert.equal(source.split(label).length - 1, 1)
    }
    assert.match(source, /mode === "keep-permanently"/)
    assert.match(source, /creditBalance === 0/)
    assert.match(source, /\/account\?tab=membership/)
    assert.match(source, /if \(open\) setErrorMessage\(""\)/)
    assert.match(source, /\[background, open\]/)
  })

  it("requires explicit permanent and non-swappable credit confirmation", async () => {
    const source = await readFile(confirmationPath, "utf8")
    assert.match(source, /permanently owned/i)
    assert.match(source, /cannot be swapped/i)
    assert.match(source, /type="checkbox"/)
    assert.match(source, /disabled=\{!confirmed/)
    assert.match(source, /idempotencyKey/)
  })

  it("renders persistent cart lines, notices, reservation controls, and tax wording", async () => {
    const source = await readFile(cartPath, "utf8")
    for (const label of [
      "Review checkout",
      "Estimated tax",
      "Permanent access after membership ends",
      "Remove",
      "Return to checkout",
      "Cancel reservation",
    ]) {
      assert.match(source, new RegExp(label))
    }
    assert.match(source, /cart\.notices/)
    assert.match(source, /reservedOrder/)
    assert.match(source, /state\.status === "mutating" \|\| state\.status === "redirecting"/)
    assert.match(source, /await removeFromCart\(backgroundId\)/)
    assert.match(source, /The item could not be removed\./)
  })

  it("shows one shared conditional trigger outside Calendar provider-sales surfaces", async () => {
    const trigger = await readFile(triggerPath, "utf8")
    const layout = await readFile(layoutPath, "utf8")
    const running = await readFile(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    assert.match(trigger, /pathname === "\/calendar"/)
    assert.match(trigger, /pathname === "\/book"/)
    assert.match(trigger, /cart\?\.items\.length/)
    assert.match(trigger, /cart\?\.reservedOrder/)
    assert.match(trigger, /aria-label/)
    assert.match(layout, /<BackgroundCommerceCart variant="dialog"/)
    assert.equal((layout.match(/<BackgroundCommerceCart variant="dialog"/g) ?? []).length, 1)
    assert.match(running, /onLockedSelect=/)
    assert.match(running, /onKeepPermanently=/)
    assert.match(running, /<BackgroundAcquisitionDialog/)
    assert.match(running, /ownedBackgroundIds:\s*commerceState\.snapshot\?\.ownedBackgroundIds/)
  })
})
