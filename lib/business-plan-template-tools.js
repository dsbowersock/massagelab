// @ts-check

export const BUSINESS_PLAN_TOOL_ROUTES = Object.freeze([
  Object.freeze({
    href: "/tools/business-planner/income",
    title: "Business Income Planner",
    description: "Estimate take-home goals, time off, workload capacity, and massage session prices.",
    status: "Live",
    icon: "Calculator",
  }),
  Object.freeze({
    href: "/tools/business-planner/break-even",
    title: "Startup Costs and Break-Even",
    description: "Add startup costs, monthly expenses, annual expenses, funding, and service price to see break-even sessions.",
    status: "Live",
    icon: "BadgeDollarSign",
  }),
  Object.freeze({
    href: "/tools/business-planner/launch-checklist",
    title: "Practice Launch Checklist",
    description: "Track template tasks for structure, licensing, location, management, client policies, and professional presentation.",
    status: "Live",
    icon: "ListChecks",
  }),
  Object.freeze({
    href: "/tools/business-planner/service-menu",
    title: "Service Menu and Policies",
    description: "Draft massage services, session prices, cancellation rules, no-show rules, and documentation privacy steps.",
    status: "Live",
    icon: "ClipboardList",
  }),
  Object.freeze({
    href: "/tools/business-planner/plan-outline",
    title: "Business Plan Outline",
    description: "Write visitor-ready notes for mission, purpose, operations, marketing, finances, profile, and resume sections.",
    status: "Live",
    icon: "NotebookPen",
  }),
  Object.freeze({
    href: "/tools/business-planner/add-on-profit",
    title: "Add-On Profit Calculator",
    description: "Compare wholesale cost, retail price, sales volume, and annual profit for products or service add-ons.",
    status: "Live",
    icon: "PackagePlus",
  }),
])

export const DEFAULT_BREAK_EVEN_INPUT = Object.freeze({
  servicePrice: 85,
  sessionsPerWeek: 15,
  weeksPerYear: 48,
  taxSetAsideRate: 0.3,
  startupCosts: Object.freeze([
    Object.freeze({ label: "Massage table", amount: 900 }),
    Object.freeze({ label: "Linens and bolsters", amount: 350 }),
    Object.freeze({ label: "Initial supplies", amount: 250 }),
  ]),
  monthlyExpenses: Object.freeze([
    Object.freeze({ label: "Rent or room fee", amount: 650 }),
    Object.freeze({ label: "Supplies", amount: 120 }),
    Object.freeze({ label: "Phone and website", amount: 80 }),
  ]),
  annualExpenses: Object.freeze([
    Object.freeze({ label: "Professional liability insurance", amount: 200 }),
    Object.freeze({ label: "License renewal yearly portion", amount: 50 }),
  ]),
  fundingSources: Object.freeze([
    Object.freeze({ label: "Savings", amount: 1_000 }),
  ]),
})

export const DEFAULT_ADD_ON_PROFIT_INPUT = Object.freeze({
  products: Object.freeze([
    Object.freeze({ name: "Self-care product", wholesaleCost: 8, retailPrice: 18, estimatedMonthlySales: 8 }),
    Object.freeze({ name: "Aromatherapy add-on", wholesaleCost: 2, retailPrice: 10, estimatedMonthlySales: 12 }),
  ]),
})

export const DEFAULT_SERVICE_MENU_INPUT = Object.freeze({
  services: Object.freeze([
    Object.freeze({ name: "Therapeutic massage", minutes: 60, price: 95 }),
    Object.freeze({ name: "Therapeutic massage", minutes: 90, price: 135 }),
    Object.freeze({ name: "Focused massage", minutes: 30, price: 55 }),
  ]),
  cancellationNoticeHours: 24,
  lateCancellationFee: 45,
  noShowFee: 65,
  privacySteps: Object.freeze([
    "Store client documentation in a secure system.",
    "Limit access to client records to authorized staff only.",
    "Use private conversations for health history and treatment goals.",
  ]),
})

export const BUSINESS_LAUNCH_CHECKLIST_SECTIONS = Object.freeze([
  Object.freeze({
    id: "structure",
    title: "Legal structure",
    items: Object.freeze([
      "Choose sole proprietor, partnership, LLC, or corporation.",
      "Write why that structure fits the planned practice.",
      "Clarify independent contractor, rent, pay-for-service, partner, or employee relationships.",
      "List agreements or professional advice needed before signing.",
    ]),
  }),
  Object.freeze({
    id: "licensing",
    title: "Licensing and operating requirements",
    items: Object.freeze([
      "Confirm occupational license requirements.",
      "Confirm state or local business registration requirements.",
      "Check vendor license needs for retail products.",
      "Record renewal dates and yearly budget amounts.",
    ]),
  }),
  Object.freeze({
    id: "location",
    title: "Location and agreements",
    items: Object.freeze([
      "Choose home, private office, rented room, mobile, or shared-business location.",
      "Confirm zoning or local permission for massage therapy at the chosen location.",
      "Review rent, lease, room-use, or mobile-service agreements.",
      "List privacy, parking, accessibility, and client-arrival considerations.",
    ]),
  }),
  Object.freeze({
    id: "management",
    title: "Management and responsibilities",
    items: Object.freeze([
      "List each owner and their responsibilities.",
      "List hired, contracted, or supporting people and their responsibilities.",
      "Identify documentation needed for contractors, employees, or partners.",
      "Assign who handles scheduling, money, records, supplies, and marketing.",
    ]),
  }),
  Object.freeze({
    id: "client-policies",
    title: "Client policies",
    items: Object.freeze([
      "Set service charges and session lengths.",
      "Write scheduling availability.",
      "Write cancellation notice rules.",
      "Write no-show and late-cancellation fees.",
      "Write steps for client documentation privacy.",
    ]),
  }),
  Object.freeze({
    id: "presentation",
    title: "Professional presentation",
    items: Object.freeze([
      "Prepare a professional profile.",
      "Update the resume section.",
      "Add business name, contact information, and logo if available.",
      "Review the finished business plan for clear formatting and professional language.",
    ]),
  }),
])

export const BUSINESS_PLAN_OUTLINE_SECTIONS = Object.freeze([
  Object.freeze({
    id: "mission",
    title: "Mission Statement",
    prompt: "State the purpose and values of the practice in one concise paragraph.",
  }),
  Object.freeze({
    id: "purpose",
    title: "Statement of Purpose",
    prompt: "Explain who the business serves, what problem it solves, and why it should exist.",
  }),
  Object.freeze({
    id: "service",
    title: "Clarification of Service",
    prompt: "Describe the massage services, what makes them unique, and how clients will access them.",
  }),
  Object.freeze({
    id: "operations",
    title: "Business Operations",
    prompt: "Summarize structure, location, management responsibilities, licensing, agreements, and policies.",
  }),
  Object.freeze({
    id: "marketing",
    title: "Marketing Plan",
    prompt: "Describe target clients, outreach channels, referral habits, retention plans, and follow-up rhythm.",
  }),
  Object.freeze({
    id: "finances",
    title: "Financial Analysis",
    prompt: "Summarize startup funding, gross income, other income, expenses, tax savings, and break-even findings.",
  }),
  Object.freeze({
    id: "profile",
    title: "Professional Profile",
    prompt: "Describe training, strengths, professional interests, and the client experience the therapist intends to create.",
  }),
  Object.freeze({
    id: "resume",
    title: "Resume Notes",
    prompt: "Collect education, work history, license details, continuing education, and related experience.",
  }),
])

/**
 * Calculates startup, operating, break-even, and tax set-aside estimates from
 * student business-plan assumptions. This is planning math only; it does not
 * attempt accounting, legal, or tax advice.
 *
 * @param {unknown} value
 */
export function calculateBreakEvenPlan(value) {
  const input = normalizeBreakEvenInput(value)
  const startupCostTotal = roundCurrency(sumMoneyItems(input.startupCosts))
  const monthlyExpenseTotal = roundCurrency(sumMoneyItems(input.monthlyExpenses))
  const annualExpenseTotal = roundCurrency(sumMoneyItems(input.annualExpenses))
  const fundingTotal = roundCurrency(sumMoneyItems(input.fundingSources))
  const monthlyOperatingCost = roundCurrency(monthlyExpenseTotal + annualExpenseTotal / 12)
  const annualOperatingCost = roundCurrency(monthlyExpenseTotal * 12 + annualExpenseTotal)
  const startupFundingGap = roundCurrency(Math.max(0, startupCostTotal - fundingTotal))
  const projectedAnnualGross = roundCurrency(input.servicePrice * input.sessionsPerWeek * input.weeksPerYear)
  const projectedMonthlyGross = roundCurrency(projectedAnnualGross / 12)
  const taxSetAside = roundCurrency(projectedAnnualGross * input.taxSetAsideRate)
  const projectedNetAfterExpensesAndTax = roundCurrency(projectedAnnualGross - annualOperatingCost - taxSetAside)
  const monthlyBreakEvenSessions = input.servicePrice > 0
    ? Math.ceil(monthlyOperatingCost / input.servicePrice)
    : null
  const weeklyBreakEvenSessions = monthlyBreakEvenSessions === null
    ? null
    : roundCurrency(monthlyBreakEvenSessions / AVERAGE_WEEKS_PER_MONTH)

  return {
    input,
    startupCostTotal,
    monthlyExpenseTotal,
    annualExpenseTotal,
    fundingTotal,
    monthlyOperatingCost,
    annualOperatingCost,
    startupFundingGap,
    projectedAnnualGross,
    projectedMonthlyGross,
    taxSetAside,
    projectedNetAfterExpensesAndTax,
    monthlyBreakEvenSessions,
    weeklyBreakEvenSessions,
    warnings: buildBreakEvenWarnings(input),
  }
}

/**
 * @param {unknown} value
 */
export function normalizeBreakEvenInput(value) {
  const source = isRecord(value) ? value : {}

  return {
    servicePrice: nonNegativeNumber(source.servicePrice, DEFAULT_BREAK_EVEN_INPUT.servicePrice),
    sessionsPerWeek: nonNegativeNumber(source.sessionsPerWeek, DEFAULT_BREAK_EVEN_INPUT.sessionsPerWeek),
    weeksPerYear: nonNegativeNumber(source.weeksPerYear, DEFAULT_BREAK_EVEN_INPUT.weeksPerYear),
    taxSetAsideRate: clampRate(source.taxSetAsideRate, DEFAULT_BREAK_EVEN_INPUT.taxSetAsideRate),
    startupCosts: normalizeMoneyItems(source.startupCosts, DEFAULT_BREAK_EVEN_INPUT.startupCosts),
    monthlyExpenses: normalizeMoneyItems(source.monthlyExpenses, DEFAULT_BREAK_EVEN_INPUT.monthlyExpenses),
    annualExpenses: normalizeMoneyItems(source.annualExpenses, DEFAULT_BREAK_EVEN_INPUT.annualExpenses),
    fundingSources: normalizeMoneyItems(source.fundingSources, DEFAULT_BREAK_EVEN_INPUT.fundingSources),
  }
}

/**
 * @param {unknown} value
 */
export function calculateAddOnProfitPlan(value) {
  const input = normalizeAddOnProfitInput(value)
  const rows = input.products.map((product) => {
    const profitPerSale = roundCurrency(product.retailPrice - product.wholesaleCost)
    const monthlyProfit = roundCurrency(profitPerSale * product.estimatedMonthlySales)
    const yearlyProfit = roundCurrency(monthlyProfit * 12)
    const marginPercent = product.retailPrice > 0
      ? roundCurrency((profitPerSale / product.retailPrice) * 100)
      : null

    return {
      ...product,
      profitPerSale,
      monthlyProfit,
      yearlyProfit,
      marginPercent,
    }
  })

  return {
    input,
    rows,
    monthlyProfitTotal: roundCurrency(rows.reduce((total, row) => total + row.monthlyProfit, 0)),
    yearlyProfitTotal: roundCurrency(rows.reduce((total, row) => total + row.yearlyProfit, 0)),
    averageMarginPercent: averageNumbers(rows.map((row) => row.marginPercent)),
  }
}

/**
 * @param {unknown} value
 */
export function normalizeAddOnProfitInput(value) {
  const source = isRecord(value) ? value : {}

  return {
    products: normalizeProductItems(source.products, DEFAULT_ADD_ON_PROFIT_INPUT.products),
  }
}

/**
 * @param {unknown} value
 */
export function calculateServiceMenuPlan(value) {
  const input = normalizeServiceMenuInput(value)
  const rows = input.services.map((service) => ({
    ...service,
    hourlyRate: service.minutes > 0 ? roundCurrency(service.price / (service.minutes / 60)) : null,
  }))
  const prices = rows.map((row) => row.price).filter((price) => price > 0)

  return {
    input,
    rows,
    serviceCount: rows.length,
    averageHourlyRate: averageNumbers(rows.map((row) => row.hourlyRate)),
    lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
    highestPrice: prices.length > 0 ? Math.max(...prices) : null,
    policySummary: buildPolicySummary(input),
  }
}

/**
 * @param {unknown} value
 */
export function normalizeServiceMenuInput(value) {
  const source = isRecord(value) ? value : {}

  return {
    services: normalizeServiceItems(source.services, DEFAULT_SERVICE_MENU_INPUT.services),
    cancellationNoticeHours: nonNegativeNumber(source.cancellationNoticeHours, DEFAULT_SERVICE_MENU_INPUT.cancellationNoticeHours),
    lateCancellationFee: nonNegativeNumber(source.lateCancellationFee, DEFAULT_SERVICE_MENU_INPUT.lateCancellationFee),
    noShowFee: nonNegativeNumber(source.noShowFee, DEFAULT_SERVICE_MENU_INPUT.noShowFee),
    privacySteps: normalizeStringList(source.privacySteps, DEFAULT_SERVICE_MENU_INPUT.privacySteps),
  }
}

const AVERAGE_WEEKS_PER_MONTH = 52 / 12
const MAX_ITEM_COUNT = 24

/**
 * @param {ReturnType<typeof normalizeBreakEvenInput>} input
 */
function buildBreakEvenWarnings(input) {
  const warnings = []

  if (input.servicePrice <= 0) {
    warnings.push("Add a service price to calculate break-even sessions.")
  }

  if (input.sessionsPerWeek <= 0) {
    warnings.push("Add expected weekly sessions to estimate yearly gross income.")
  }

  return warnings
}

/**
 * @param {ReturnType<typeof normalizeServiceMenuInput>} input
 */
function buildPolicySummary(input) {
  return [
    `${input.cancellationNoticeHours} hours notice requested for cancellations.`,
    `Late-cancellation fee: ${formatCurrency(input.lateCancellationFee)}.`,
    `No-show fee: ${formatCurrency(input.noShowFee)}.`,
    input.privacySteps.length > 0
      ? `Privacy steps: ${input.privacySteps.join(" ")}`
      : "Privacy steps still need to be written.",
  ].join(" ")
}

/**
 * @param {unknown} value
 * @param {readonly { label: string, amount: number }[]} fallback
 */
function normalizeMoneyItems(value, fallback) {
  const source = Array.isArray(value) ? value : fallback
  const rows = source
    .slice(0, MAX_ITEM_COUNT)
    .map((item) => isRecord(item) ? item : {})
    .map((item) => ({
      label: stringValue(item.label, "Item"),
      amount: nonNegativeNumber(item.amount, 0),
    }))
    .filter((item) => item.label || item.amount > 0)

  return rows.length > 0 ? rows : [{ label: "Item", amount: 0 }]
}

/**
 * @param {unknown} value
 * @param {readonly { name: string, wholesaleCost: number, retailPrice: number, estimatedMonthlySales: number }[]} fallback
 */
function normalizeProductItems(value, fallback) {
  const source = Array.isArray(value) ? value : fallback
  const rows = source
    .slice(0, MAX_ITEM_COUNT)
    .map((item) => isRecord(item) ? item : {})
    .map((item) => ({
      name: stringValue(item.name, "Product or add-on"),
      wholesaleCost: nonNegativeNumber(item.wholesaleCost, 0),
      retailPrice: nonNegativeNumber(item.retailPrice, 0),
      estimatedMonthlySales: nonNegativeNumber(item.estimatedMonthlySales, 0),
    }))
    .filter((item) => item.name || item.wholesaleCost > 0 || item.retailPrice > 0 || item.estimatedMonthlySales > 0)

  return rows.length > 0 ? rows : [{ name: "Product or add-on", wholesaleCost: 0, retailPrice: 0, estimatedMonthlySales: 0 }]
}

/**
 * @param {unknown} value
 * @param {readonly { name: string, minutes: number, price: number }[]} fallback
 */
function normalizeServiceItems(value, fallback) {
  const source = Array.isArray(value) ? value : fallback
  const rows = source
    .slice(0, MAX_ITEM_COUNT)
    .map((item) => isRecord(item) ? item : {})
    .map((item) => ({
      name: stringValue(item.name, "Massage service"),
      minutes: nonNegativeNumber(item.minutes, 60),
      price: nonNegativeNumber(item.price, 0),
    }))
    .filter((item) => item.name || item.minutes > 0 || item.price > 0)

  return rows.length > 0 ? rows : [{ name: "Massage service", minutes: 60, price: 0 }]
}

/**
 * @param {unknown} value
 * @param {readonly string[]} fallback
 */
function normalizeStringList(value, fallback) {
  const source = Array.isArray(value) ? value : fallback
  const rows = source
    .slice(0, MAX_ITEM_COUNT)
    .map((item) => stringValue(item, ""))
    .filter(Boolean)

  return rows.length > 0 ? rows : [""]
}

/**
 * @param {readonly { amount: number }[]} items
 */
function sumMoneyItems(items) {
  return items.reduce((total, item) => total + item.amount, 0)
}

/**
 * @param {(number | null)[]} values
 */
function averageNumbers(values) {
  /** @type {number[]} */
  const finite = []
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      finite.push(value)
    }
  }
  if (finite.length === 0) return null

  return roundCurrency(finite.reduce((total, value) => total + value, 0) / finite.length)
}

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function nonNegativeNumber(value, fallback) {
  const number = parsePlannerNumber(value)
  if (number === null) return Math.max(0, fallback)

  return Math.max(0, number)
}

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function clampRate(value, fallback) {
  const parsed = parsePlannerNumber(value)
  const number = parsed === null ? fallback : parsed
  const decimal = number > 1 ? number / 100 : number

  return Math.min(0.8, Math.max(0, decimal))
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parsePlannerNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null

  const cleaned = value.replace(/[$,%\s,]/g, "")
  if (!cleaned) return null

  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

/**
 * @param {number} value
 */
function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * @param {number} value
 */
function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function stringValue(value, fallback) {
  return typeof value === "string" ? value.trim() : fallback
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
