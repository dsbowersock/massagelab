"use client"

import { type ChangeEvent } from "react"
import { AppInset } from "@/components/ui/app-surface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const preciseMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

export function NumberField({
  id,
  label,
  value,
  onChange,
  max,
  step = "1",
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  max?: number
  step?: string
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(numberFromInput(event.currentTarget.value))
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={handleChange}
      />
    </div>
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </div>
  )
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  )
}

export function MetricTile({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <AppInset className="p-3">
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </AppInset>
  )
}

/**
 * Formats planner money metrics while making incomplete inputs obvious.
 * Null and non-finite values return "Add numbers"; small values keep cents so
 * startup/add-on tools do not hide low-cost worksheet assumptions.
 */
export function formatMoney(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Add numbers"

  return Math.abs(value) >= 1_000 ? moneyFormatter.format(value) : preciseMoneyFormatter.format(value)
}

/**
 * Formats compact numeric worksheet metrics for labels and summaries.
 * Null and non-finite values return "0", so only call this where zero is an
 * honest fallback; use explicit null checks for values that need a prompt.
 */
export function formatNumber(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0"

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)
}

/**
 * Parses numeric form-control text from worksheet inputs.
 * Blank or non-finite text becomes 0 so controlled number fields remain stable
 * while users clear and retype values.
 */
export function numberFromInput(value: string) {
  if (value.trim() === "") return 0

  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
