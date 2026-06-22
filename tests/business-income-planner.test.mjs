import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BUSINESS_INCOME_PRESETS,
  calculateBusinessIncomePlan,
  normalizeBusinessIncomePlannerInput,
  sanitizeBusinessIncomePlannerPreference,
} from "../lib/business-income-planner.js"

const basePlannerInput = Object.freeze({
  desiredTakeHomeIncome: 60_000,
  monthlyFixedExpenses: 1_000,
  perSessionVariableCost: 6,
  taxSetAsideRate: 0.25,
  vacationDays: 10,
  holidayDays: 6,
  personalDays: 5,
  weeklyAdminHours: 4,
  averageSessionMinutes: 60,
  weekdayClientHours: {
    monday: 4,
    tuesday: 4,
    wednesday: 4,
    thursday: 4,
    friday: 4,
    saturday: 0,
    sunday: 0,
  },
})

describe("Business income planner", () => {
  it("ships the expected scenario presets", () => {
    assert.ok(BUSINESS_INCOME_PRESETS.starting_part_time)
    assert.ok(BUSINESS_INCOME_PRESETS.growing_solo_practice)
    assert.ok(BUSINESS_INCOME_PRESETS.full_schedule)
    assert.ok(BUSINESS_INCOME_PRESETS.custom)
  })

  it("normalizes negative numeric input to zero", () => {
    const normalized = normalizeBusinessIncomePlannerInput({
      desiredTakeHomeIncome: -1,
      monthlyFixedExpenses: -20,
      perSessionVariableCost: -5,
      taxSetAsideRate: -0.2,
      vacationDays: -3,
      holidayDays: -4,
      personalDays: -5,
      weeklyAdminHours: -2,
      averageSessionMinutes: -60,
      employeeHourlyWage: -35,
      weekdayClientHours: {
        monday: -1,
        tuesday: -2,
      },
    })

    assert.equal(normalized.desiredTakeHomeIncome, 0)
    assert.equal(normalized.monthlyFixedExpenses, 0)
    assert.equal(normalized.perSessionVariableCost, 0)
    assert.equal(normalized.taxSetAsideRate, 0)
    assert.equal(normalized.vacationDays, 0)
    assert.equal(normalized.holidayDays, 0)
    assert.equal(normalized.personalDays, 0)
    assert.equal(normalized.weeklyAdminHours, 0)
    assert.equal(normalized.averageSessionMinutes, 0)
    assert.equal(normalized.employeeHourlyWage, 0)
    assert.equal(normalized.weekdayClientHours.monday, 0)
    assert.equal(normalized.weekdayClientHours.tuesday, 0)
  })

  it("calculates income targets and session pricing from worksheet-style assumptions", () => {
    const plan = calculateBusinessIncomePlan(basePlannerInput)

    assert.deepEqual(plan.warnings, [])
    assert.equal(plan.totalDaysOff, 21)
    assert.equal(plan.availableWeeks, 49)
    assert.equal(plan.weeklyClientHours, 20)
    assert.equal(plan.weeklyTotalWorkHours, 24)
    assert.equal(plan.annualClientHours, 980)
    assert.equal(plan.sessionsPerWeek, 20)
    assert.equal(plan.annualSessions, 980)
    assert.equal(plan.targetBeforeTax, 80_000)
    assert.equal(plan.annualFixedExpenses, 12_000)
    assert.equal(plan.annualVariableSessionCosts, 5_880)
    assert.equal(plan.requiredGrossRevenue, 97_880)
    assert.equal(Math.round(plan.hourlyRevenueTarget), 94)
    assert.equal(Math.round(plan.sessionPrices[30]), 53)
    assert.equal(Math.round(plan.sessionPrices[60]), 100)
    assert.equal(Math.round(plan.sessionPrices[90]), 147)
    assert.equal(Math.round(plan.sessionPrices[120]), 194)
  })

  it("returns warnings and no finite hourly target when client hours are missing", () => {
    const plan = calculateBusinessIncomePlan({
      ...basePlannerInput,
      weekdayClientHours: {},
    })

    assert.ok(plan.warnings.some((warning) => /client hours/i.test(warning)))
    assert.equal(plan.weeklyClientHours, 0)
    assert.equal(plan.annualClientHours, 0)
    assert.equal(plan.hourlyRevenueTarget, null)
    assert.equal(Number.isFinite(plan.sessionPrices[60]), false)
  })

  it("builds workload scenarios for common schedule capacities", () => {
    const plan = calculateBusinessIncomePlan(basePlannerInput)
    const capacities = plan.workloadScenarios.map((scenario) => scenario.capacityPercent)

    assert.deepEqual(capacities, [50, 70, 90, 100])
    assert.ok(plan.workloadScenarios.every((scenario) => scenario.annualClientHours > 0))
    assert.ok(plan.workloadScenarios[0].hourlyRevenueTarget > plan.workloadScenarios[3].hourlyRevenueTarget)
  })

  it("adds an employee wage comparison only when wage data is present", () => {
    assert.equal(calculateBusinessIncomePlan(basePlannerInput).employeeComparison, null)

    const plan = calculateBusinessIncomePlan({
      ...basePlannerInput,
      employeeHourlyWage: 35,
    })

    assert.deepEqual(plan.employeeComparison, {
      annualGross: 34_300,
      estimatedTakeHome: 25_725,
    })
  })

  it("sanitizes persisted planner payloads down to safe business assumptions", () => {
    const sanitized = sanitizeBusinessIncomePlannerPreference({
      ...basePlannerInput,
      clientName: "Jane Example",
      soapDraft: "session notes",
      wellnessEntries: [{ symptom: "neck pain" }],
      weekdayClientHours: {
        monday: 4,
        clientName: "Nested client",
      },
    })
    const serialized = JSON.stringify(sanitized)

    assert.equal(serialized.includes("clientName"), false)
    assert.equal(serialized.includes("soapDraft"), false)
    assert.equal(serialized.includes("wellnessEntries"), false)
    assert.equal(sanitized.weekdayClientHours.monday, 4)
    assert.equal("tuesday" in sanitized.weekdayClientHours, true)
  })
})
