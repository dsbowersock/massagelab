import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const donationRouteSource = await readFile(
  new URL("../app/api/billing/donation/route.ts", import.meta.url),
  "utf8",
)

/**
 * Loads the production route with deterministic amount lookup and billing
 * doubles so invalid inputs can prove they stop before Stripe.
 */
function donationPostForFailure(
  failure,
  {
    findDonationOption = () => ({ amountCents: 500 }),
    onCheckout = () => {},
  } = {},
) {
  const route = loadCompiledModule(
    donationRouteSource,
    "app/api/billing/donation/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
          redirect: (url, status) => ({ url, status }),
        },
      },
      "@/auth": {
        getCurrentSession: async () => ({
          user: {
            id: "user_supporter",
            email: "supporter@example.com",
          },
        }),
      },
      "@/lib/auth-env": {
        getSiteUrl: () => "https://massagelab.app",
      },
      "@/lib/donations": {
        findDonationOption,
      },
      "@/lib/stripe-billing": {
        createStripeDonationCheckoutSession: async () => {
          onCheckout()
          throw failure
        },
      },
    },
  )

  return route.POST
}

function jsonRequest() {
  return new Request("https://massagelab.app/api/billing/donation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amountCents: 500 }),
  })
}

describe("one-time support Checkout route", () => {
  it("returns the controlled JSON error for an unsupported amount before Stripe", async () => {
    const lookedUpAmounts = []
    let checkoutCalls = 0
    const POST = donationPostForFailure(new Error("Stripe must not run"), {
      findDonationOption: (amountCents) => {
        lookedUpAmounts.push(amountCents)
        return null
      },
      onCheckout: () => {
        checkoutCalls += 1
      },
    })

    const response = await POST(jsonRequest())

    assert.deepEqual(response, {
      body: { error: "Unsupported one-time support amount" },
      status: 400,
    })
    assert.deepEqual(lookedUpAmounts, [500])
    assert.equal(checkoutCalls, 0)
  })

  it("redirects malformed form data through the existing invalid-amount response", async () => {
    const lookedUpAmounts = []
    let checkoutCalls = 0
    const POST = donationPostForFailure(new Error("Stripe must not run"), {
      findDonationOption: (amountCents) => {
        lookedUpAmounts.push(amountCents)
        return null
      },
      onCheckout: () => {
        checkoutCalls += 1
      },
    })
    const request = {
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=broken",
      }),
      formData: async () => {
        throw new TypeError("Malformed multipart body")
      },
    }

    const response = await POST(request)

    assert.deepEqual(response, {
      url: "https://massagelab.app/pricing?donation=invalid-amount",
      status: 303,
    })
    assert.deepEqual(lookedUpAmounts, [null])
    assert.equal(checkoutCalls, 0)
  })

  for (const [label, code, expectedCode] of [
    ["allowlisted provider code", "provider_timeout", "provider_timeout"],
    ["unsafe provider code", "secret\ncustomer@example.com", "unexpected_error"],
  ]) {
    it(`logs only a safe code for an ${label}`, async (context) => {
      const failure = new Error("processor message with customer@example.com")
      failure.code = code
      const logged = []
      context.mock.method(console, "error", (...args) => logged.push(args))

      const response = await donationPostForFailure(failure)(jsonRequest())

      assert.deepEqual(response, {
        body: { error: "Unable to start one-time support checkout." },
        status: 500,
      })
      assert.deepEqual(logged, [[
        "Unable to start one-time support checkout",
        { code: expectedCode },
      ]])
      assert.doesNotMatch(JSON.stringify(logged), /customer@example\.com|processor message/)
    })
  }
})
