import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  BUSINESS_LAUNCH_CHECKLIST_SECTIONS,
  BUSINESS_PLAN_OUTLINE_SECTIONS,
  BUSINESS_PLAN_TOOL_ROUTES,
  calculateAddOnProfitPlan,
  calculateBreakEvenPlan,
  calculateServiceMenuPlan,
  normalizeBreakEvenInput,
} from "../lib/business-plan-template-tools.js"

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

describe("Business plan template tools", () => {
  it("lists the template-derived public tool routes", () => {
    const routeHrefs = BUSINESS_PLAN_TOOL_ROUTES.map((route) => route.href)

    assert.deepEqual(routeHrefs, [
      "/tools/business-planner/income",
      "/tools/business-planner/break-even",
      "/tools/business-planner/launch-checklist",
      "/tools/business-planner/service-menu",
      "/tools/business-planner/plan-outline",
      "/tools/business-planner/add-on-profit",
    ])
  })

  it("calculates startup funding, monthly break-even, projected gross, and tax set-aside", () => {
    const plan = calculateBreakEvenPlan({
      servicePrice: 100,
      sessionsPerWeek: 10,
      weeksPerYear: 48,
      taxSetAsideRate: 30,
      startupCosts: [
        { label: "Table", amount: 800 },
        { label: "Supplies", amount: 200 },
      ],
      monthlyExpenses: [
        { label: "Rent", amount: 500 },
        { label: "Website", amount: 50 },
      ],
      annualExpenses: [
        { label: "Insurance", amount: 240 },
      ],
      fundingSources: [
        { label: "Savings", amount: 300 },
      ],
    })

    assert.equal(plan.startupCostTotal, 1_000)
    assert.equal(plan.fundingTotal, 300)
    assert.equal(plan.startupFundingGap, 700)
    assert.equal(plan.monthlyOperatingCost, 570)
    assert.equal(plan.monthlyBreakEvenSessions, 6)
    assert.equal(plan.weeklyBreakEvenSessions, 1.38)
    assert.equal(plan.projectedAnnualGross, 48_000)
    assert.equal(plan.taxSetAside, 14_400)
    assert.equal(plan.projectedNetAfterExpensesAndTax, 26_760)
  })

  it("normalizes invalid break-even inputs without allowing negative money values", () => {
    const input = normalizeBreakEvenInput({
      servicePrice: -100,
      taxSetAsideRate: "150%",
      monthlyExpenses: [{ label: "Rent", amount: "-50" }],
    })

    assert.equal(input.servicePrice, 0)
    assert.equal(input.taxSetAsideRate, 0.8)
    assert.equal(input.monthlyExpenses[0].amount, 0)
  })

  it("calculates product and add-on profit", () => {
    const plan = calculateAddOnProfitPlan({
      products: [
        { name: "Lotion", wholesaleCost: 5, retailPrice: 15, estimatedMonthlySales: 10 },
        { name: "Heat add-on", wholesaleCost: 1, retailPrice: 8, estimatedMonthlySales: 20 },
      ],
    })

    assert.equal(plan.rows[0].profitPerSale, 10)
    assert.equal(plan.rows[0].monthlyProfit, 100)
    assert.equal(plan.rows[1].monthlyProfit, 140)
    assert.equal(plan.monthlyProfitTotal, 240)
    assert.equal(plan.yearlyProfitTotal, 2_880)
    assert.equal(plan.averageMarginPercent, 77.09)
  })

  it("summarizes service menu pricing and policy rules", () => {
    const plan = calculateServiceMenuPlan({
      services: [
        { name: "Massage", minutes: 60, price: 100 },
        { name: "Massage", minutes: 90, price: 135 },
      ],
      cancellationNoticeHours: 24,
      lateCancellationFee: 50,
      noShowFee: 75,
      privacySteps: ["Keep records secure."],
    })

    assert.equal(plan.serviceCount, 2)
    assert.equal(plan.averageHourlyRate, 95)
    assert.equal(plan.lowestPrice, 100)
    assert.equal(plan.highestPrice, 135)
    assert.match(plan.policySummary, /24 hours notice/)
    assert.match(plan.policySummary, /Keep records secure/)
  })

  it("uses fallback policy copy when privacy steps are empty", () => {
    const plan = calculateServiceMenuPlan({
      privacySteps: [],
    })

    assert.deepEqual(plan.input.privacySteps, [])
    assert.match(plan.policySummary, /Privacy steps still need to be written/)
  })

  it("covers the template's launch checklist and outline sections", () => {
    assert.deepEqual(BUSINESS_LAUNCH_CHECKLIST_SECTIONS.map((section) => section.id), [
      "structure",
      "licensing",
      "location",
      "management",
      "client-policies",
      "presentation",
    ])
    assert.ok(BUSINESS_LAUNCH_CHECKLIST_SECTIONS.every((section) => section.items.length >= 4))
    assert.deepEqual(BUSINESS_PLAN_OUTLINE_SECTIONS.map((section) => section.id), [
      "mission",
      "purpose",
      "service",
      "operations",
      "marketing",
      "finances",
      "profile",
      "resume",
    ])
  })

  it("keeps the new template worksheet pages browser-local", () => {
    const combinedClientSource = [
      "app/tools/business-planner/break-even/break-even-planner-client.tsx",
      "app/tools/business-planner/launch-checklist/launch-checklist-client.tsx",
      "app/tools/business-planner/service-menu/service-menu-client.tsx",
      "app/tools/business-planner/plan-outline/plan-outline-client.tsx",
      "app/tools/business-planner/add-on-profit/add-on-profit-client.tsx",
    ].map(readProjectFile).join("\n").toLowerCase()
    const schema = readProjectFile("prisma/schema.prisma")

    assert.match(combinedClientSource, /localstorage/)
    assert.doesNotMatch(combinedClientSource, /\/api\/account\/preferences/)
    assert.doesNotMatch(combinedClientSource, /prisma\./)
    assert.doesNotMatch(schema, /model\s+BusinessPlan(?:Tool|Worksheet|Template)?\b/)
  })
})
