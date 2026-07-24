import { readFile } from "node:fs/promises"

import {
  createCompiledModuleLoader,
  createElement,
  passThroughElement,
  renderFunctionComponents,
} from "./compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const pricingCardsSource = await readFile(
  new URL("../../components/membership/pricing-cards.tsx", import.meta.url),
  "utf8",
)

function TestComponent() {}

/** Builds a complete lookup-verified Supporter monthly price test value. */
export function supporterMonthlyPrice(overrides = {}) {
  return {
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
    ...overrides,
  }
}

function defaultAmountChoices() {
  return [{
    id: "support-1",
    monthAmountCents: 100,
    yearAmountCents: 1000,
    prices: {
      month: supporterMonthlyPrice(),
    },
  }]
}

/**
 * Renders the production membership pricing cards against a compact one-plan
 * catalog. Callers control the action mode, active level, amount choices, and
 * whether a blocking member has a usable Customer Portal action.
 */
export function renderMembershipPricingCards({
  mode,
  activeMembershipLevel = mode === "portal" ? "SUPPORTER" : null,
  amountChoices = defaultAmountChoices(),
  portalActionAvailable = true,
}) {
  const Div = passThroughElement("div")
  const Button = passThroughElement("button")
  const Link = passThroughElement("a")
  const pricingCards = loadCompiledModule(
    pricingCardsSource,
    "components/membership/pricing-cards.tsx",
    {
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
    },
  )
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
    activeMembershipLevel,
    catalog,
    mode,
    portalActionAvailable,
  }))
}
