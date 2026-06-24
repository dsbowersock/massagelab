import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("user-facing copy", () => {
  it("keeps account and billing notices focused on user actions instead of implementation details", async () => {
    const [
      accountPage,
      pricingCards,
      pricingPage,
      loginForm,
      registerForm,
    ] = await Promise.all([
      readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/membership/pricing-cards.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/register/register-form.tsx", import.meta.url), "utf8"),
    ])

    assert.match(accountPage, /Your membership is being updated/)
    assert.match(accountPage, /billing management right now/)
    assert.doesNotMatch(accountPage, /webhook (finishes|syncs)/)
    assert.doesNotMatch(accountPage, /secret key configuration/)
    assert.doesNotMatch(accountPage, /Stripe customer/)

    assert.match(pricingCards, /Pricing temporarily unavailable/)
    assert.doesNotMatch(pricingCards, /Stripe Price ID/)
    assert.doesNotMatch(pricingCards, /Price not configured/)

    assert.match(pricingPage, /one-time support checkout right now/)
    assert.doesNotMatch(pricingPage, /Stripe could not start/)

    assert.match(loginForm, /Google sign-in is not available right now/)
    assert.match(registerForm, /Google registration is not available right now/)
    assert.doesNotMatch(loginForm, /environment variables in Vercel/)
    assert.doesNotMatch(registerForm, /environment variables in Vercel/)
  })
})
