import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("user-facing copy", () => {
  it("keeps account and billing notices focused on user actions instead of implementation details", async () => {
    const [
      accountPage,
      pricingCards,
      pricingPage,
      roadmapPage,
      homePage,
      donationRoute,
      billingGuide,
      loginForm,
      registerForm,
    ] = await Promise.all([
      readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/membership/pricing-cards.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/roadmap/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/billing/donation/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../docs/wiki/billing-memberships.md", import.meta.url), "utf8"),
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
    assert.match(pricingPage, /One-time support does not create a membership or unlock features\. It is not a charitable donation and is not tax-deductible\./)
    assert.match(pricingPage, /title="Memberships and one-time support fund the alpha without ads"/)
    assert.doesNotMatch(pricingPage, /Donations are one-time Stripe payments/)
    assert.doesNotMatch(pricingPage, /\bdonations?\s+(?:checkout|payment|amount)\b/i)
    assert.doesNotMatch(pricingPage, /Stripe could not start/)

    assert.match(roadmapPage, /One-time support/)
    assert.doesNotMatch(roadmapPage, /\bDonate\b/i)
    assert.doesNotMatch(roadmapPage, /Memberships and donations/i)
    assert.match(homePage, /Memberships and one-time support help build/i)

    assert.match(donationRoute, /Unsupported one-time support amount/)
    assert.match(donationRoute, /Unable to start one-time support checkout/)
    assert.doesNotMatch(donationRoute, /Unsupported donation amount/)
    assert.doesNotMatch(donationRoute, /Unable to start donation checkout/)

    assert.match(
      billingGuide,
      /Automatic Tax remains disabled for one-time support until a tax professional\s+confirms its classification\. That decision is separate from `txcd_10000000`,\s+which applies to permanent digital backgrounds\./,
    )

    assert.match(loginForm, /Google sign-in is not available right now/)
    assert.match(registerForm, /Google registration is not available right now/)
    assert.doesNotMatch(loginForm, /environment variables in Vercel/)
    assert.doesNotMatch(registerForm, /environment variables in Vercel/)
  })
})
