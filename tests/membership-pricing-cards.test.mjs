import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { describe, it } from "node:test"
import ts from "typescript"

const requireFromTest = createRequire(import.meta.url)

/**
 * Compiles the production component only for this render contract so its
 * private price filtering can be exercised without test-only exports.
 */
function loadCompiledModule(source, dependencies) {
  const compiledSource = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "components/membership/pricing-cards.tsx",
  }).outputText
  const compiledModule = { exports: {} }
  const executeModule = new Function("require", "exports", "module", compiledSource)

  executeModule((specifier) => (
    Object.hasOwn(dependencies, specifier)
      ? dependencies[specifier]
      : requireFromTest(specifier)
  ), compiledModule.exports, compiledModule)

  return compiledModule.exports
}

function createElement(type, props, key) {
  return {
    type,
    key: key ?? null,
    props: props ?? {},
  }
}

function findElements(tree, predicate, matches = []) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      findElements(child, predicate, matches)
    }
    return matches
  }
  if (!tree || typeof tree !== "object") {
    return matches
  }

  if (predicate(tree)) {
    matches.push(tree)
  }
  findElements(tree.props?.children, predicate, matches)
  return matches
}

function renderFunctionComponents(tree) {
  if (Array.isArray(tree)) {
    return tree.map(renderFunctionComponents)
  }
  if (!tree || typeof tree !== "object") {
    return tree ?? null
  }
  if (typeof tree.type === "function") {
    return renderFunctionComponents(tree.type(tree.props))
  }

  return {
    ...tree,
    props: {
      ...tree.props,
      children: renderFunctionComponents(tree.props?.children),
    },
  }
}

function elementText(tree) {
  if (Array.isArray(tree)) {
    return tree.map(elementText).join("")
  }
  if (typeof tree === "string" || typeof tree === "number") {
    return String(tree)
  }
  if (!tree || typeof tree !== "object") {
    return ""
  }
  return elementText(tree.props?.children)
}

function passThroughElement(type) {
  return function PassThroughElement(props) {
    return createElement(type, props)
  }
}

function TestComponent() {}

async function renderMembershipPricingCards({ mode, amountChoices }) {
  const pricingCardsSource = await readFile(
    new URL("../components/membership/pricing-cards.tsx", import.meta.url),
    "utf8",
  )
  const Div = passThroughElement("div")
  const Button = passThroughElement("button")
  const Link = passThroughElement("a")
  const pricingCards = loadCompiledModule(pricingCardsSource, {
    "react/jsx-runtime": {
      Fragment: Symbol.for("membership-pricing-cards-test.fragment"),
      jsx: createElement,
      jsxs: createElement,
    },
    "next/link": Link,
    "lucide-react": {
      BadgeDollarSign: TestComponent,
      CheckCircle2: TestComponent,
      Palette: TestComponent,
      ShieldCheck: TestComponent,
    },
    "@/components/ui/app-surface": {
      appCalloutClassName: "test-callout",
      appSurfaceClassName: "test-surface",
    },
    "@/components/ui/badge": {
      Badge: Div,
    },
    "@/components/ui/button": {
      Button,
    },
    "@/components/ui/card": {
      Card: Div,
      CardContent: Div,
      CardDescription: Div,
      CardHeader: Div,
      CardTitle: Div,
    },
    "@/components/ui/metal-attention-button": {
      MetalAttentionButton: Button,
    },
    "@/components/ui/tabs": {
      Tabs: Div,
      TabsContent: Div,
      TabsList: Div,
      TabsTrigger: Div,
    },
    "@/lib/legal-documents": {
      getLegalDocumentByKey: () => ({
        label: "Membership Billing and Refund Terms",
        route: "/legal/membership-billing-refunds",
      }),
      legalDocumentAcceptanceId: () => "membership-billing-refunds:test",
    },
    "@/lib/membership-pricing": {
      resolveMembershipPriceForInterval: (choice, interval) => (
        choice.prices?.[interval] ?? null
      ),
    },
    "@/lib/utils": {
      cn: (...classes) => classes.filter(Boolean).join(" "),
    },
  })
  const catalog = {
    defaultInterval: "month",
    intervals: [{
      id: "month",
      label: "Monthly",
      nudge: "Flexible",
    }],
    plans: [{
      membershipLevel: "SUPPORTER",
      name: "MassageLab Supporter Membership",
      eyebrow: "Alpha support",
      description: "Support current features and careful future development.",
      currentFeatures: ["Access to all backgrounds"],
      roadmapNotes: ["Funds privacy-preserving product work."],
      amountChoices,
    }],
  }

  return renderFunctionComponents(pricingCards.MembershipPricingCards({
    activeMembershipLevel: mode === "portal" ? "SUPPORTER" : null,
    catalog,
    mode,
  }))
}

describe("MembershipPricingCards configured price rendering", () => {
  it("hides unconfigured portal prices while preserving non-portal fallbacks", async () => {
    const configuredPrice = {
      membershipLevel: "SUPPORTER",
      interval: "month",
      priceId: "price_supporter_1_month",
      unitAmount: 100,
      currency: "usd",
      displayPrice: "$1",
      displayInterval: "/month",
      isConfigured: true,
      isLookupAvailable: true,
      yearlySavings: null,
    }
    const amountChoices = [
      {
        id: "support-1",
        month: 100,
        year: 1000,
        prices: { month: configuredPrice },
      },
      {
        id: "support-2",
        month: 200,
        year: 2000,
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
        month: 500,
        year: 5000,
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
        month: 900,
        year: 9000,
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
        && element.props.className === "rounded-md border border-border/80 bg-background/70 p-3 text-center"
      ),
    )
    assert.deepEqual(portalPriceTiles.map((element) => element.key), ["support-1", "support-5"])
    assert.match(elementText(portalCards), /\$1/)
    assert.match(elementText(portalCards), /Price unavailable/)
    assert.doesNotMatch(elementText(portalCards), /\$2/)

    assert.equal(
      findElements(
        checkoutCards,
        (element) => element.type === "form" && element.props.action === "/api/billing/checkout",
      ).length,
      2,
    )
    assert.deepEqual(
      findElements(
        checkoutCards,
        (element) => element.type === "input" && element.props.name === "supporterAmountChoiceId",
      ).map((element) => element.props.value),
      ["support-1", "support-5"],
    )
    assert.deepEqual(
      findElements(
        checkoutCards,
        (element) => element.type === "button" && /Support with/.test(elementText(element)),
      ).map((element) => element.props.disabled),
      [false, true],
    )
    const unavailableCheckoutChoices = findElements(
      checkoutCards,
      (element) => (
        element.type === "button"
        && element.props.disabled === true
        && elementText(element) === "Pricing temporarily unavailable"
      ),
    )
    assert.equal(unavailableCheckoutChoices.length, 1)
    assert.doesNotMatch(elementText(checkoutCards), /\$2/)

    const authChoices = findElements(
      authCards,
      (element) => (
        element.type === "a"
        && element.props.href === "/login?callbackUrl=%2Fpricing"
      ),
    )
    assert.deepEqual(
      authChoices.map((element) => elementText(element)),
      ["Choose $1", "Choose $2", "Choose Price unavailable"],
    )
  })
})
