import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  elementText,
  findElements,
} from "./helpers/compiled-module.mjs"
import {
  renderMembershipPricingCards,
  supporterMonthlyPrice,
  supporterYearlyPrice,
} from "./helpers/membership-pricing-cards.mjs"

describe("MembershipPricingCards configured price rendering", () => {
  it("advertises only lookup-verified prices in portal and pre-auth modes", async () => {
    const configuredPrice = supporterMonthlyPrice()
    const amountChoices = [
      {
        id: "support-1",
        monthAmountCents: 100,
        yearAmountCents: 1000,
        prices: { month: configuredPrice },
      },
      {
        id: "support-2",
        monthAmountCents: 200,
        yearAmountCents: 2000,
        prices: {
          month: {
            ...configuredPrice,
            priceId: null,
            unitAmount: null,
            displayPrice: "$2",
            isConfigured: false,
            isLookupAvailable: false,
          },
        },
      },
      {
        id: "support-5",
        monthAmountCents: 500,
        yearAmountCents: 5000,
        prices: {
          month: {
            ...configuredPrice,
            priceId: "price_supporter_5_month",
            unitAmount: null,
            displayPrice: "Price unavailable",
            isLookupAvailable: false,
          },
        },
      },
      {
        id: "support-missing",
        monthAmountCents: 900,
        yearAmountCents: 9000,
        prices: {},
      },
    ]
    const [portalCards, checkoutCards, authCards] = await Promise.all([
      renderMembershipPricingCards({ mode: "portal", amountChoices }),
      renderMembershipPricingCards({ mode: "checkout", amountChoices }),
      renderMembershipPricingCards({ mode: "auth", amountChoices }),
    ])

    const portalPriceTiles = findElements(
      portalCards,
      (element) => (
        element.type === "div"
        && element.props["data-membership-portal-amount-choice"] != null
      ),
    )
    assert.deepEqual(
      portalPriceTiles.map((element) => element.props["data-membership-portal-amount-choice"]),
      ["support-1"],
    )
    assert.match(elementText(portalCards), /\$1/)
    assert.doesNotMatch(elementText(portalCards), /Price unavailable/)
    assert.doesNotMatch(elementText(portalCards), /\$2/)
    assert.match(elementText(portalPriceTiles[0]), /\$1.*\/month/)
    assert.match(elementText(portalCards), /Manage or change support amount/)
    assert.match(elementText(portalCards), /Customer Portal/)
    assert.equal(
      findElements(
        portalCards,
        (element) => (
          element.type === "form"
          && element.props.action === "/api/billing/portal"
          && element.props.method === "post"
        ),
      ).length,
      1,
    )
    assert.equal(
      findElements(
        portalCards,
        (element) => elementText(element) === "Current member",
      ).length,
      1,
    )
    assert.equal(
      findElements(
        portalCards,
        (element) => element.type === "form" && element.props.action === "/api/billing/checkout",
      ).length,
      0,
    )

    const checkoutChoiceNodes = findElements(
      checkoutCards,
      (element) => element.props["data-membership-checkout-amount-choice"] != null,
    )
    const checkoutChoices = new Map(
      checkoutChoiceNodes.map((element) => [
        element.props["data-membership-checkout-amount-choice"],
        element,
      ]),
    )
    assert.deepEqual([...checkoutChoices.keys()], ["support-1", "support-2", "support-5"])

    const support1Checkout = checkoutChoices.get("support-1")
    assert.equal(support1Checkout.type, "form")
    const [support1Button] = findElements(
      support1Checkout,
      (element) => element.type === "button" && /Support with/.test(elementText(element)),
    )
    assert.ok(support1Button, "support-1 must render a Support button")
    assert.equal(
      support1Button.props.disabled,
      false,
    )

    const support2Checkout = checkoutChoices.get("support-2")
    assert.equal(support2Checkout.type, "button")
    assert.equal(support2Checkout.props.disabled, true)
    assert.equal(elementText(support2Checkout), "Pricing temporarily unavailable")

    const support5Checkout = checkoutChoices.get("support-5")
    assert.equal(support5Checkout.type, "form")
    const [support5Button] = findElements(
      support5Checkout,
      (element) => element.type === "button" && /Support with/.test(elementText(element)),
    )
    assert.ok(support5Button, "support-5 must render a Support button")
    assert.equal(
      support5Button.props.disabled,
      true,
    )
    assert.equal(checkoutChoices.has("support-missing"), false)
    assert.doesNotMatch(elementText(checkoutCards), /\$2/)

    const authChoices = findElements(
      authCards,
      (element) => (
        element.type === "a"
        && element.props["data-membership-auth-amount-choice"] != null
      ),
    )
    assert.deepEqual(
      authChoices.map((element) => ({
        choiceId: element.props["data-membership-auth-amount-choice"],
        href: element.props.href,
      })),
      [{
        choiceId: "support-1",
        href: "/login?callbackUrl=%2Fpricing%3FsupporterAmountChoiceId%3Dsupport-1%26interval%3Dmonth",
      }],
    )
    assert.deepEqual(
      authChoices.map((element) => elementText(element)),
      ["Choose $1"],
    )
    assert.doesNotMatch(elementText(authCards), /\$2|Price unavailable/)
  })

  for (const amountChoices of [
    [{
      id: "support-1",
      monthAmountCents: 100,
      yearAmountCents: 1000,
      prices: { month: supporterMonthlyPrice() },
    }],
    [],
  ]) {
    it(`keeps blocking membership mode fail closed when no Portal action is available and the catalog is ${amountChoices.length ? "configured" : "empty"}`, async () => {
      const tree = await renderMembershipPricingCards({
        mode: "portal",
        portalActionAvailable: false,
        amountChoices,
      })

      assert.match(elementText(tree), /Billing management is temporarily unavailable/)
      assert.equal(
        findElements(
          tree,
          (element) => (
            element.type === "form"
            && (
              element.props.action === "/api/billing/portal"
              || element.props.action === "/api/billing/checkout"
            )
          ),
        ).length,
        0,
      )
      assert.doesNotMatch(elementText(tree), /Support with|Choose \$1|Manage or change/)
      assert.doesNotMatch(elementText(tree), /Membership pricing is temporarily unavailable/)
    })
  }

  it("omits an empty Portal amount grid while preserving management guidance", async () => {
    const tree = await renderMembershipPricingCards({
      mode: "portal",
      amountChoices: [],
    })

    assert.equal(
      findElements(
        tree,
        (element) => element.props["data-membership-portal-amount-choice"] != null,
      ).length,
      0,
    )
    assert.match(elementText(tree), /Use the Customer Portal to switch among approved Supporter amounts/)
    assert.match(elementText(tree), /Manage or change support amount/)
    assert.equal(
      findElements(
        tree,
        (element) => element.type === "form" && element.props.action === "/api/billing/portal",
      ).length,
      1,
    )
  })

  it("explains when signed-out membership pricing cannot be verified", async () => {
    const tree = await renderMembershipPricingCards({
      mode: "auth",
      amountChoices: [{
        id: "support-1",
        monthAmountCents: 100,
        yearAmountCents: 1000,
        prices: {
          month: supporterMonthlyPrice({
            priceId: null,
            unitAmount: null,
            displayPrice: "Price unavailable",
            isConfigured: false,
            isLookupAvailable: false,
          }),
        },
      }],
    })

    assert.match(elementText(tree), /Membership pricing is temporarily unavailable/)
    assert.equal(
      findElements(
        tree,
        (element) => element.props["data-membership-auth-amount-choice"] != null,
      ).length,
      0,
    )
  })

  it("surfaces annual savings in checkout, pre-auth, and Portal modes", async () => {
    const yearlyPrice = supporterYearlyPrice()
    const amountChoices = [{
      id: "support-1",
      monthAmountCents: 100,
      yearAmountCents: 1000,
      prices: { year: yearlyPrice },
    }]
    const cardsByMode = await Promise.all(
      ["checkout", "auth", "portal"].map((mode) => (
        renderMembershipPricingCards({ mode, interval: "year", amountChoices })
      )),
    )

    for (const cards of cardsByMode) {
      assert.match(elementText(cards), /Save \$2 per year vs monthly/)
    }
  })

  for (const mode of ["checkout", "auth"]) {
    it(`explains an empty ${mode} pricing catalog`, async () => {
      const tree = await renderMembershipPricingCards({
        mode,
        amountChoices: [],
      })

      assert.match(elementText(tree), /Membership pricing is temporarily unavailable/)
      assert.doesNotMatch(
        elementText(tree),
        /Manage or change support amount|Support with|Choose \$/,
      )
    })
  }
})
