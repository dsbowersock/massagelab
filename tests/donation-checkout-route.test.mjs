import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import { safeErrorCode } from "../lib/safe-error-code.js"
import {
  isBrowserFormRequest,
  isTrustedCheckoutFormOrigin,
} from "../lib/trusted-form-origin.js"

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
  siteUrl = "https://massagelab.app",
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
        getSiteUrl: () => siteUrl,
      },
      "@/lib/donations": {
        findDonationOption,
      },
      "@/lib/safe-error-code": {
        safeErrorCode,
      },
      "@/lib/trusted-form-origin": {
        isBrowserFormRequest,
        isTrustedCheckoutFormOrigin,
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
  it("recognizes mixed-case browser form content types", () => {
    for (const contentType of [
      "Application/X-WWW-Form-Urlencoded; Charset=UTF-8",
      "Multipart/Form-Data; Boundary=Example",
    ]) {
      assert.equal(
        isBrowserFormRequest({
          headers: new Headers({ "content-type": contentType }),
        }),
        true,
      )
    }
  })

  for (const [label, siteUrl] of [
    ["omitted", ""],
    ["invalid", "not a URL"],
  ]) {
    it(`fails closed at the route when the canonical checkout origin is ${label}`, async () => {
      let checkoutCalls = 0
      const POST = donationPost({
        siteUrl,
        createCheckoutSession: async () => {
          checkoutCalls += 1
          throw new Error("Stripe must not run")
        },
      })
      const response = await POST(jsonRequest())

      assert.deepEqual(response, {
        body: { error: "Invalid request origin" },
        status: 403,
      })
      assert.equal(checkoutCalls, 0)
    })
  }

  it("fails closed without a canonical origin for same-origin metadata alone", async () => {
    let checkoutCalls = 0
    const POST = donationPost({
      siteUrl: "",
      createCheckoutSession: async () => {
        checkoutCalls += 1
        throw new Error("Stripe must not run")
      },
    })
    const request = new Request("https://massagelab.app/api/billing/donation", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "sec-fetch-site": "same-origin",
      },
      body: new URLSearchParams({ amountCents: "500" }),
    })

    const response = await POST(request)

    assert.deepEqual(response, {
      url: "/pricing?donation=invalid-request",
      status: 303,
    })
    assert.equal(checkoutCalls, 0)
  })

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

  it("charges the catalog amount rather than the submitted form amount", async () => {
    const checkoutInputs = []
    const lookedUpAmounts = []
    const POST = donationPost({
      findDonationOption: (amountCents) => {
        lookedUpAmounts.push(amountCents)
        return { amountCents: 500 }
      },
      createCheckoutSession: async (input) => {
        checkoutInputs.push(input)
        return { url: "https://checkout.stripe.com/c/support" }
      },
    })
    const request = new Request("https://massagelab.app/api/billing/donation", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://massagelab.app",
      },
      body: new URLSearchParams({ amountCents: "999" }),
    })

    const response = await POST(request)

    assert.deepEqual(lookedUpAmounts, ["999"])
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

  it("accepts the configured public origin when a proxy supplies an internal request URL", async () => {
    let checkoutCalls = 0
    const POST = donationPost({
      createCheckoutSession: async () => {
        checkoutCalls += 1
        return { url: "https://checkout.stripe.com/c/proxied-support" }
      },
    })
    const request = new Request("http://internal-proxy:3000/api/billing/donation", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://massagelab.app",
      },
      body: new URLSearchParams({ amountCents: "500" }),
    })

    const response = await POST(request)

    assert.deepEqual(response, {
      url: "https://checkout.stripe.com/c/proxied-support",
      status: 303,
    })
    assert.equal(checkoutCalls, 1)
  })

  it("rejects a cross-origin form before parsing, selection, or Stripe work", async () => {
    let formDataCalls = 0
    let selectionCalls = 0
    let checkoutCalls = 0
    const POST = donationPost({
      findDonationOption: () => {
        selectionCalls += 1
        return { amountCents: 500 }
      },
      createCheckoutSession: async () => {
        checkoutCalls += 1
        return { url: "https://checkout.stripe.com/c/should-not-run" }
      },
    })
    const request = {
      url: "https://massagelab.app/api/billing/donation",
      headers: new Headers({
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://attacker.example",
      }),
      formData: async () => {
        formDataCalls += 1
        return new FormData()
      },
    }

    const response = await POST(request)

    assert.deepEqual(response, {
      url: "https://massagelab.app/pricing?donation=invalid-request",
      status: 303,
    })
    assert.equal(formDataCalls, 0)
    assert.equal(selectionCalls, 0)
    assert.equal(checkoutCalls, 0)
  })

  for (const fetchSite of ["cross-site", "same-site"]) {
    it(`rejects ${fetchSite} browser JSON before parsing, selection, or Stripe work`, async () => {
      let jsonCalls = 0
      let selectionCalls = 0
      let checkoutCalls = 0
      const POST = donationPost({
        findDonationOption: () => {
          selectionCalls += 1
          return { amountCents: 500 }
        },
        createCheckoutSession: async () => {
          checkoutCalls += 1
          return { url: "https://checkout.stripe.com/c/should-not-run" }
        },
      })
      const request = {
        url: "https://massagelab.app/api/billing/donation",
        headers: new Headers({
          "content-type": "application/json",
          "sec-fetch-site": fetchSite,
        }),
        json: async () => {
          jsonCalls += 1
          return { amountCents: 500 }
        },
      }

      const response = await POST(request)

      assert.deepEqual(response, {
        body: { error: "Invalid request origin" },
        status: 403,
      })
      assert.equal(jsonCalls, 0)
      assert.equal(selectionCalls, 0)
      assert.equal(checkoutCalls, 0)
    })
  }

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
        "sec-fetch-site": "same-origin",
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

  it("redirects form selection failures through the sanitized checkout error", async (context) => {
    const failure = new Error("catalog lookup failed")
    const logged = []
    context.mock.method(console, "error", (...args) => logged.push(args))
    const POST = donationPost({
      findDonationOption: () => {
        throw failure
      },
    })
    const request = new Request("https://massagelab.app/api/billing/donation", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://massagelab.app",
      },
      body: new URLSearchParams({ amountCents: "500" }),
    })

    const response = await POST(request)

    assert.deepEqual(response, {
      url: "https://massagelab.app/pricing?donation=checkout-error",
      status: 303,
    })
    assert.deepEqual(logged, [[
      "Unable to start one-time support checkout",
      { code: "unexpected_error" },
    ]])
  })

  it("returns the standard sanitized error when Stripe succeeds without a usable URL", async (context) => {
    const logged = []
    context.mock.method(console, "error", (...args) => logged.push(args))
    const POST = donationPost({
      createCheckoutSession: async () => ({
        id: "cs_support_without_url",
        url: null,
      }),
    })

    const response = await POST(jsonRequest())

    assert.deepEqual(response, {
      body: { error: "Unable to start one-time support checkout." },
      status: 500,
    })
    assert.deepEqual(logged, [[
      "Unable to start one-time support checkout",
      { code: "unexpected_error" },
    ]])
    assert.equal(Object.hasOwn(response, "url"), false)
  })

  for (const [label, code, expectedCode] of [
    ["allowlisted provider code", "resource_missing", "resource_missing"],
    ["identifier-like provider code", "provider_timeout", "unexpected_error"],
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
