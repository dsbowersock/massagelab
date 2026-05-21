import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { describe, it } from "node:test"

const helperUrl = new URL("../lib/public-booking-url.js", import.meta.url)
const routeUrl = new URL("../app/book/[practiceSlug]/[bookingSlug]/page.tsx", import.meta.url)

describe("public booking branded urls", () => {
  it("ships a helper for state-prefixed branded booking urls", async () => {
    assert.equal(existsSync(helperUrl), true)
    const helper = readFileSync(helperUrl, "utf8")
    const {
      brandedPublicBookingPath,
      normalizePublicBookingSlug,
      normalizePublicBookingStateSlug,
      publicBookingPathForPractice,
    } = await import("../lib/public-booking-url.js")

    assert.match(helper, /export const US_STATE_SLUGS/)
    assert.match(helper, /ohio/)
    assert.match(helper, /district-of-columbia/)
    assert.match(helper, /export function normalizePublicBookingSlug/)
    assert.match(helper, /export function publicBookingPathForPractice/)
    assert.equal(normalizePublicBookingSlug(" Massage With Derrick! "), "massage-with-derrick")
    assert.equal(normalizePublicBookingStateSlug("Ohio"), "ohio")
    assert.equal(brandedPublicBookingPath("ohio", "Massage With Derrick"), "/book/ohio/massage-with-derrick")
    assert.equal(publicBookingPathForPractice({
      slug: "derrick-bowersock-lmt",
      publicBookingStateSlug: "ohio",
      publicBookingSlug: "massagewithderrick",
    }), "/book/ohio/massagewithderrick")
  })

  it("adds a branded state and slug route that reuses the public booking renderer", () => {
    assert.equal(existsSync(routeUrl), true)
    const route = readFileSync(routeUrl, "utf8")

    assert.match(route, /stateSlug/)
    assert.match(route, /bookingSlug/)
    assert.match(route, /renderPublicBookingPage/)
  })
})
