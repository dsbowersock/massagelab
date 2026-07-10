export type RangeValueFormatter = (value: number) => string

export function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function formatRangeValue(value: number, unit?: string, formatter?: RangeValueFormatter) {
  if (formatter) {
    return formatter(value)
  }

  return unit ? `${value}${unit}` : String(value)
}
