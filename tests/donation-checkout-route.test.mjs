import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import { safeErrorCode } from "../lib/safe-error-code.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const donationRouteSource = await readFile(
  new URL("../app/api/billing/donation/route.ts", import.meta.url),
  "utf8",
)

/**
 * Loads the production route with deterministic amount lookup and billing
 * doubles so both success and rejection paths can assert the Stripe boundary.
 */
function donationPost({
  createCheckoutSession = async () => {
    throw new Error("Stripe Checkout double was not configured.")
  },
  findDonationOption = () => ({ amountCents: 500 }),
  session = {
    user: {
      id: "user_supporter",
      email: "supporter@example.com",
    },
  },
} = {}) {
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
        getCurrentSession: async () => session,
      },
      "@/lib/auth-env": {
        getSiteUrl: () => "https://massagelab.app",
      },
      "@/lib/donations": {
        findDonationOption,
      },
      "@/lib/safe-error-code": {
        safeErrorCode,
      },
      "@/lib/stripe-billing": {
        createStripeDonationCheckoutSession: createCheckoutSession,
      },
    },
  )

  return route.POST
}

function jsonRequest(body = JSON.stringify({ amountCents: 500 })) {
  return new Request("https://massagelab.app/api/billing/donation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

describe("one-time support Checkout route", () => {
  it("allows guest one-time support without attaching account identity", async () => {
    const checkoutInputs = []
    const POST = donationPost({
      session: null,
      createCheckoutSession: async (input) => {
        checkoutInputs.push(input)
        return { url: "https://checkout.stripe.com/c/guest-support" }
      },
    })

    const response = await POST(jsonRequest())

    assert.deepEqual(checkoutInputs, [{
      amountCents: 500,
      customerEmail: "",
      userId: "",
      successUrl: "https://massagelab.app/pricing?donation=thanks&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://massagelab.app/pricing?donation=cancelled",
    }])
    assert.deepEqual(response, {
      body: { url: "https://checkout.stripe.com/c/guest-support" },
      status: 200,
    })
  })

  it("forwards the selected support option and redirects a successful form checkout", async () => {
    const checkoutInputs = []
    const POST = donationPost({
      createCheckoutSession: async (input) => {
        checkoutInputs.push(input)
        return { url: "https://checkout.stripe.com/c/support" }
      },
    })
    const request = new Request("https://massagelab.app/api/billing/donation", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ amountCents: "500" }),
    })

    const response = await POST(request)

    assert.deepEqual(checkoutInputs, [{
      amountCents: 500,
      customerEmail: "supporter@example.com",
      userId: "user_supporter",
      successUrl: "https://massagelab.app/pricing?donation=thanks&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://massagelab.app/pricing?donation=cancelled",
    }])
    assert.deepEqual(response, {
      url: "https://checkout.stripe.com/c/support",
      status: 303,
    })
  })

  it("returns the controlled JSON error for an unsupported amount before Stripe", async () => {
    const lookedUpAmounts = []
    let checkoutCalls = 0
    const POST = donationPost({
      findDonationOption: (amountCents) => {
        lookedUpAmounts.push(amountCents)
        return null
      },
      createCheckoutSession: async () => {
        checkoutCalls += 1
        throw new Error("Stripe must not run")
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

  for (const [label, body] of [
    ["literal null", "null"],
    ["an array", "[]"],
    ["malformed JSON", "{"],
  ]) {
    it(`returns the controlled unsupported-amount response for ${label}`, async () => {
      const lookedUpAmounts = []
      let checkoutCalls = 0
      const POST = donationPost({
        findDonationOption: (amountCents) => {
          lookedUpAmounts.push(amountCents)
          return null
        },
        createCheckoutSession: async () => {
          checkoutCalls += 1
          throw new Error("Stripe must not run")
        },
      })

      const response = await POST(jsonRequest(body))

      assert.deepEqual(response, {
        body: { error: "Unsupported one-time support amount" },
        status: 400,
      })
      assert.deepEqual(lookedUpAmounts, [undefined])
      assert.equal(checkoutCalls, 0)
    })
  }

  it("redirects malformed form data through the existing invalid-amount response", async () => {
    const lookedUpAmounts = []
    let checkoutCalls = 0
    const POST = donationPost({
      findDonationOption: (amountCents) => {
        lookedUpAmounts.push(amountCents)
        return null
      },
      createCheckoutSession: async () => {
        checkoutCalls += 1
        throw new Error("Stripe must not run")
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

      const response = await donationPost({
        createCheckoutSession: async () => {
          throw failure
        },
      })(jsonRequest())

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
