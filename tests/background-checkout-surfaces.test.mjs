import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const reviewPath = new URL("../components/backgrounds/BackgroundCheckoutReview.tsx", import.meta.url)
const cartPath = new URL("../components/backgrounds/BackgroundCommerceCart.tsx", import.meta.url)
const returnPath = new URL("../components/backgrounds/BackgroundCheckoutReturnStatus.tsx", import.meta.url)
const chimerPagePath = new URL("../app/chimer/page.tsx", import.meta.url)
const setTimerPath = new URL("../app/chimer/set-timer.tsx", import.meta.url)

describe("background checkout review", () => {
  it("shows itemized $1 lines, U.S. and tax posture, and the current legal documents", async () => {
    const source = await readFile(reviewPath, "utf8")
    for (const copy of [
      "Review checkout",
      "U.S. only",
      "Applicable tax is added at Checkout",
      "Digital Purchases & Refund Policy",
      "immediate digital delivery",
      "final-sale",
    ]) {
      assert.match(source.toLowerCase(), new RegExp(copy.toLowerCase().replaceAll("$", "\\$")))
    }
    assert.match(source, /requiredLegalDocumentsForEvent\("digital-purchase"\)/)
    assert.match(source, /legalDocumentAcceptanceId/)
  })

  it("requires one unchecked combined consent and locks duplicate submission", async () => {
    const source = await readFile(reviewPath, "utf8")
    assert.match(source, /useState\(false\)/)
    assert.match(source, /type="checkbox"/)
    assert.match(source, /combinedConsentAccepted:\s*consentAccepted/)
    assert.match(source, /disabled=\{!consentAccepted \|\| submitting/)
    assert.match(source, /if \(submitting\) return/)
  })

  it("keeps lawful exceptions and account cart recovery visible", async () => {
    const source = await readFile(reviewPath, "utf8")
    for (const copy of [
      "duplicate charges",
      "unauthorized purchases",
      "non-delivery",
      "material defects",
    ]) {
      assert.match(source.replace(/\s+/g, " "), new RegExp(copy, "i"))
    }
    const cart = await readFile(cartPath, "utf8")
    assert.match(cart, /<BackgroundCheckoutReview/)
    assert.match(cart, /setReviewOpen\(true\)/)
  })
})

describe("checkout return recovery", () => {
  it("polls server snapshots and never grants ownership from URL state", async () => {
    const source = await readFile(returnPath, "utf8")
    assert.match(source, /Confirming purchase/)
    assert.match(source, /await refresh\(\)/)
    assert.match(source, /ownedBackgroundIds/)
    assert.match(source, /Check again/)
    assert.doesNotMatch(source, /session_id|ownedBackgroundIds\.push|grantOwnership/)
  })

  it("restores safe Clock, Chimer, and Music Background origins", async () => {
    const source = await readFile(returnPath, "utf8")
    assert.match(source, /backgroundPurchase=cancelled/)
    assert.match(source, /panel.*background/)
    assert.match(source, /if \(orderId\) url\.searchParams\.set\("orderId", orderId\)/)
    assert.match(source, /returnUrl\(resolvedReturnPath, "success", orderId\)/)
    assert.match(source, /\[fulfilled, orderId, pathname/)
    assert.match(source, /\/clock/)
    assert.match(source, /\/chimer/)
    const review = await readFile(reviewPath, "utf8")
    assert.match(review, /music/)
    const page = await readFile(chimerPagePath, "utf8")
    const setup = await readFile(setTimerPath, "utf8")
    assert.match(page, /searchParams\.get\("panel"\) === "background"/)
    assert.match(page, /initialStep=/)
    assert.match(setup, /initialStep/)
    assert.match(setup, /Number\.isFinite\(initialStep\) \? Math\.trunc\(initialStep\) : 0/)
  })

  it("distinguishes delayed review and access exception states without processor ids", async () => {
    const source = await readFile(returnPath, "utf8")
    for (const copy of [
      "still processing",
      "manual review",
      "refund pending",
      "dispute suspended",
      "retired",
      "support",
    ]) {
      assert.match(source, new RegExp(copy, "i"))
    }
    assert.doesNotMatch(source, /stripe|paymentIntent|checkoutSession|chargeId/)
  })
})
