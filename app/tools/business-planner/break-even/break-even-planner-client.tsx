"use client"

import { useEffect, useMemo, useState } from "react"
import { BadgeDollarSign, BriefcaseBusiness, Plus, RotateCcw, Trash2 } from "lucide-react"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  calculateBreakEvenPlan,
  normalizeBreakEvenInput,
} from "@/lib/business-plan-template-tools"
import {
  MetricTile,
  NumberField,
  TextField,
  formatMoney,
  formatNumber,
} from "../_components/business-tool-fields"

type BreakEvenInput = ReturnType<typeof normalizeBreakEvenInput>
type MoneyItem = BreakEvenInput["startupCosts"][number]
type MoneySectionKey = "startupCosts" | "monthlyExpenses" | "annualExpenses" | "fundingSources"

const STORAGE_KEY = "massagelab-business-planner-break-even-v1"

const moneySectionLabels: Record<MoneySectionKey, { title: string; description: string; emptyLabel: string }> = {
  startupCosts: {
    title: "Startup costs",
    description: "One-time setup purchases and opening costs from the template.",
    emptyLabel: "Startup item",
  },
  monthlyExpenses: {
    title: "Monthly expenses",
    description: "Recurring costs such as rent, supplies, phone, website, utilities, and maintenance.",
    emptyLabel: "Monthly item",
  },
  annualExpenses: {
    title: "Annual expenses",
    description: "Yearly or annualized costs such as insurance, renewals, and professional fees.",
    emptyLabel: "Annual item",
  },
  fundingSources: {
    title: "Initial capital",
    description: "Savings, loans, or other starting money available before opening.",
    emptyLabel: "Funding source",
  },
}

export function BreakEvenPlannerClient() {
  const [input, setInput] = useState<BreakEvenInput>(() => normalizeBreakEvenInput({}))
  const [storageReady, setStorageReady] = useState(false)
  const plan = useMemo(() => calculateBreakEvenPlan(input), [input])
  const breakEvenSessionLabel = plan.monthlyBreakEvenSessions === null
    ? "Set service price"
    : `${formatNumber(plan.monthlyBreakEvenSessions)} / month`
  const breakEvenSessionDescription = plan.weeklyBreakEvenSessions === null
    ? undefined
    : `${formatNumber(plan.weeklyBreakEvenSessions)} each week`

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setInput(normalizeBreakEvenInput(JSON.parse(stored)))
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  }, [input, storageReady])

  function updateTopLevel(field: keyof Pick<BreakEvenInput, "servicePrice" | "sessionsPerWeek" | "weeksPerYear" | "taxSetAsideRate">, value: number) {
    setInput((current) => normalizeBreakEvenInput({
      ...current,
      [field]: field === "taxSetAsideRate" ? value / 100 : value,
    }))
  }

  function updateMoneyItem(section: MoneySectionKey, index: number, field: keyof MoneyItem, value: string | number) {
    setInput((current) => normalizeBreakEvenInput({
      ...current,
      [section]: current[section].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }))
  }

  function addMoneyItem(section: MoneySectionKey) {
    setInput((current) => normalizeBreakEvenInput({
      ...current,
      [section]: [
        ...current[section],
        { label: moneySectionLabels[section].emptyLabel, amount: 0 },
      ],
    }))
  }

  function removeMoneyItem(section: MoneySectionKey, index: number) {
    setInput((current) => normalizeBreakEvenInput({
      ...current,
      [section]: current[section].filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function resetWorksheet() {
    setInput(normalizeBreakEvenInput({}))
  }

  return (
    <AppPageShell width="full" contentClassName="gap-6">
      <AppSurface
        title="Startup Costs and Break-Even"
        description="Use the business plan template's finance questions to estimate startup funding, monthly operating costs, break-even sessions, tax set-aside, and projected income."
        icon={<BadgeDollarSign className="h-5 w-5" aria-hidden="true" />}
        badge="Browser worksheet"
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Startup funding gap" value={formatMoney(plan.startupFundingGap)} />
          <MetricTile label="Monthly operating cost" value={formatMoney(plan.monthlyOperatingCost)} />
          <MetricTile label="Break-even sessions" value={breakEvenSessionLabel} description={breakEvenSessionDescription} />
          <MetricTile label="Projected yearly gross" value={formatMoney(plan.projectedAnnualGross)} />
        </div>
      </AppSurface>

      <div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.95fr)_minmax(0,1.25fr)]">
        <div className="space-y-6">
          <AppSurface
            title="Service and schedule"
            description="These values connect the template's projected gross income and break-even questions."
            icon={<BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="break-even-service-price"
                label="Main service price"
                value={input.servicePrice}
                onChange={(value) => updateTopLevel("servicePrice", value)}
              />
              <NumberField
                id="break-even-sessions-week"
                label="Sessions per week"
                value={input.sessionsPerWeek}
                step="0.5"
                onChange={(value) => updateTopLevel("sessionsPerWeek", value)}
              />
              <NumberField
                id="break-even-weeks-year"
                label="Working weeks per year"
                value={input.weeksPerYear}
                onChange={(value) => updateTopLevel("weeksPerYear", value)}
              />
              <NumberField
                id="break-even-tax-rate"
                label="Tax set-aside percent"
                value={Number((input.taxSetAsideRate * 100).toFixed(1))}
                max={80}
                step="0.5"
                onChange={(value) => updateTopLevel("taxSetAsideRate", value)}
              />
            </div>
            <Button type="button" variant="outline" className="w-fit" onClick={resetWorksheet}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reset worksheet
            </Button>
          </AppSurface>

          {moneySectionOrder.map((section) => (
            <MoneySection
              key={section}
              section={section}
              items={input[section]}
              onUpdate={updateMoneyItem}
              onAdd={addMoneyItem}
              onRemove={removeMoneyItem}
            />
          ))}
        </div>

        <div className="space-y-6">
          <AppSurface
            title="Financial analysis"
            description="Use these numbers to write the finance section of a student business plan."
          >
            {plan.warnings.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {plan.warnings.join(" ")}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Startup costs" value={formatMoney(plan.startupCostTotal)} />
              <MetricTile label="Initial capital" value={formatMoney(plan.fundingTotal)} />
              <MetricTile label="Monthly expenses" value={formatMoney(plan.monthlyExpenseTotal)} />
              <MetricTile label="Annual expenses" value={formatMoney(plan.annualExpenseTotal)} />
              <MetricTile label="Projected monthly gross" value={formatMoney(plan.projectedMonthlyGross)} />
              <MetricTile label="Projected yearly gross" value={formatMoney(plan.projectedAnnualGross)} />
              <MetricTile label="Tax set-aside" value={formatMoney(plan.taxSetAside)} description={`${Math.round(input.taxSetAsideRate * 100)}% of projected gross`} />
              <MetricTile label="After expenses and tax" value={formatMoney(plan.projectedNetAfterExpensesAndTax)} />
            </div>
          </AppSurface>

          <AppSurface
            title="Business plan wording"
            description="A concise sentence students can adapt into the Financial Analysis section."
          >
            <p className="text-sm leading-6 text-muted-foreground">
              Based on a {formatMoney(input.servicePrice)} service price and {formatNumber(input.sessionsPerWeek)} sessions per week for {formatNumber(input.weeksPerYear)} weeks, this plan projects {formatMoney(plan.projectedAnnualGross)} in yearly gross income. Estimated operating costs are {formatMoney(plan.annualOperatingCost)} per year, with {formatMoney(plan.taxSetAside)} set aside for taxes.{" "}
              {plan.monthlyBreakEvenSessions === null
                ? "Set a non-zero service price to estimate break-even sessions."
                : `The practice needs about ${formatNumber(plan.monthlyBreakEvenSessions)} sessions per month to cover monthly operating costs before owner income.`}
            </p>
          </AppSurface>
        </div>
      </div>
    </AppPageShell>
  )
}

const moneySectionOrder: MoneySectionKey[] = ["startupCosts", "fundingSources", "monthlyExpenses", "annualExpenses"]

function MoneySection({
  section,
  items,
  onUpdate,
  onAdd,
  onRemove,
}: {
  section: MoneySectionKey
  items: MoneyItem[]
  onUpdate: (section: MoneySectionKey, index: number, field: keyof MoneyItem, value: string | number) => void
  onAdd: (section: MoneySectionKey) => void
  onRemove: (section: MoneySectionKey, index: number) => void
}) {
  const labels = moneySectionLabels[section]

  return (
    <AppSurface title={labels.title} description={labels.description}>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${section}-${index}`} className="grid gap-3 rounded-md border border-border/80 bg-background/70 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
            <TextField
              id={`${section}-${index}-label`}
              label="Name"
              value={item.label}
              onChange={(value) => onUpdate(section, index, "label", value)}
            />
            <NumberField
              id={`${section}-${index}-amount`}
              label="Amount"
              value={item.amount}
              onChange={(value) => onUpdate(section, index, "amount", value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label={`Remove ${item.label || labels.emptyLabel}`}
              onClick={() => onRemove(section, index)}
              disabled={items.length <= 1}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" className="w-fit" onClick={() => onAdd(section)}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Add row
      </Button>
    </AppSurface>
  )
}
