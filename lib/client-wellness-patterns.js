// @ts-check

export const CLIENT_WELLNESS_REPORT_WINDOWS = Object.freeze([
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
])

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Builds a browser-safe report from already-loaded client wellness entries.
 *
 * The report intentionally uses aggregate counts and reflection prompts only;
 * it does not infer medical meaning or prepare data for another actor.
 *
 * @param {unknown} entries
 * @param {Date} [now]
 */
export function buildClientWellnessPatternReport(entries, now = new Date()) {
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date()
  const normalizedEntries = normalizeEntries(entries)
  const recentEntries = normalizedEntries.filter((entry) => (
    entry.occurredAt <= safeNow && safeNow.getTime() - entry.occurredAt.getTime() <= 30 * DAY_MS
  ))
  const windows = CLIENT_WELLNESS_REPORT_WINDOWS.map((window) => {
    const cutoff = safeNow.getTime() - window.days * DAY_MS
    const windowEntries = normalizedEntries.filter((entry) => (
      entry.occurredAt <= safeNow && entry.occurredAt.getTime() >= cutoff
    ))

    return {
      id: window.id,
      label: window.label,
      entryCount: windowEntries.length,
      categoryCounts: countBy(windowEntries.map((entry) => entry.category)),
    }
  })

  return {
    generatedAt: safeNow.toISOString(),
    entryCount: normalizedEntries.length,
    windows,
    categoryBreakdown: countBy(normalizedEntries.map((entry) => entry.category)),
    topRegions: countBy(recentEntries.flatMap((entry) => entry.regions)).slice(0, 5),
    topSensations: countBy(recentEntries.flatMap((entry) => entry.sensations)).slice(0, 5),
    topContexts: countBy(recentEntries.flatMap((entry) => entry.contexts)).slice(0, 5),
    averageIntensity: averageIntensity(recentEntries),
    romMovements: summarizeRomMovements(recentEntries),
    patternPrompts: buildPatternPrompts(recentEntries),
  }
}

/**
 * @param {Date} [date]
 */
export function clientWellnessReportFilename(date = new Date()) {
  const stamp = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  return `massagelab-wellness-report-${stamp}.json`
}

/**
 * @param {unknown} entries
 */
function normalizeEntries(entries) {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries
    .map(normalizeEntry)
    .filter((entry) => entry !== null)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}

/**
 * @param {unknown} value
 */
function normalizeEntry(value) {
  const payload = objectOrEmpty(value)
  const occurredAt = new Date(typeof payload.occurredAt === "string" ? payload.occurredAt : "")

  if (!Number.isFinite(occurredAt.getTime())) {
    return null
  }

  return {
    category: stringValue(payload.category) || "body_sensation",
    occurredAt,
    intensity: numberOrNull(payload.intensity),
    regions: stringList(payload.regions),
    sensations: stringList(payload.sensations),
    contexts: stringList(payload.contexts),
    metadata: objectOrEmpty(payload.metadata),
  }
}

/**
 * @param {unknown} value
 */
function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {}
}

/**
 * @param {unknown} value
 */
function stringValue(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

/**
 * @param {unknown} value
 */
function stringList(value) {
  const values = Array.isArray(value) ? value : []
  const seen = new Set()
  const normalized = []

  for (const item of values) {
    const label = stringValue(item).toLowerCase()

    if (!label || seen.has(label)) {
      continue
    }

    seen.add(label)
    normalized.push(label)
  }

  return normalized
}

/**
 * @param {unknown} value
 */
function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * @param {string[]} labels
 */
function countBy(labels) {
  const counts = new Map()

  for (const label of labels) {
    const normalized = stringValue(label).toLowerCase()

    if (!normalized) {
      continue
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/**
 * @param {Array<{ intensity: number | null }>} entries
 */
function averageIntensity(entries) {
  /** @type {number[]} */
  const values = []

  for (const entry of entries) {
    if (typeof entry.intensity === "number" && Number.isFinite(entry.intensity)) {
      values.push(entry.intensity)
    }
  }

  if (values.length === 0) {
    return null
  }

  return roundTenth(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/**
 * @param {Array<{ category: string, occurredAt: Date, metadata: Record<string, unknown> }>} entries
 */
function summarizeRomMovements(entries) {
  /** @type {Map<string, Array<{ occurredAt: Date, changeDegrees: number }>>} */
  const groups = new Map()

  for (const entry of entries) {
    if (entry.category !== "rom") {
      continue
    }

    const movement = stringValue(entry.metadata.movement).toLowerCase()
    const changeDegrees = numberOrNull(entry.metadata.changeDegrees)

    if (!movement || changeDegrees === null) {
      continue
    }

    const movementEntries = groups.get(movement) ?? []
    movementEntries.push({ occurredAt: entry.occurredAt, changeDegrees: roundTenth(changeDegrees) })
    groups.set(movement, movementEntries)
  }

  return [...groups.entries()]
    .map(([movement, movementEntries]) => {
      const sortedEntries = movementEntries.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      const latest = sortedEntries.at(-1)
      const previous = sortedEntries.at(-2)

      if (!latest || !previous) {
        return null
      }

      return {
        movement,
        entryCount: sortedEntries.length,
        latestDegrees: latest.changeDegrees,
        previousDegrees: previous.changeDegrees,
        changeSincePrevious: roundTenth(latest.changeDegrees - previous.changeDegrees),
      }
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.entryCount - a.entryCount || a.movement.localeCompare(b.movement))
}

/**
 * @param {Array<{ regions: string[], sensations: string[], contexts: string[] }>} entries
 */
function buildPatternPrompts(entries) {
  const candidates = [
    ...pairCounts(entries, "region-context", (entry) => entry.regions, (entry) => entry.contexts),
    ...pairCounts(entries, "region-sensation", (entry) => entry.regions, (entry) => entry.sensations),
  ]

  return candidates
    .filter((candidate) => candidate.count >= 2)
    .sort((a, b) => b.count - a.count || a.primary.localeCompare(b.primary) || a.secondary.localeCompare(b.secondary))
    .slice(0, 4)
    .map((candidate) => ({
      id: `${candidate.kind}-${candidate.primary}-${candidate.secondary}`.replace(/[^a-z0-9_-]+/g, "-"),
      title: `${titleCase(candidate.primary)} appears with ${candidate.secondary}`,
      detail: `${candidate.count} entries include ${candidate.primary} and ${candidate.secondary} in the last 30 days. Use this as a reflection prompt and compare future entries before drawing conclusions.`,
      confidence: confidenceForCount(candidate.count),
      supportingEntryCount: candidate.count,
    }))
}

/**
 * @param {Array<Record<string, unknown>>} entries
 * @param {string} kind
 * @param {(entry: any) => string[]} primaryValues
 * @param {(entry: any) => string[]} secondaryValues
 */
function pairCounts(entries, kind, primaryValues, secondaryValues) {
  const counts = new Map()

  for (const entry of entries) {
    for (const primary of primaryValues(entry)) {
      for (const secondary of secondaryValues(entry)) {
        const key = `${primary}\u0000${secondary}`
        const value = counts.get(key) ?? { kind, primary, secondary, count: 0 }
        value.count += 1
        counts.set(key, value)
      }
    }
  }

  return [...counts.values()]
}

/**
 * @param {number} count
 */
function confidenceForCount(count) {
  if (count >= 5) {
    return "stronger"
  }

  if (count >= 3) {
    return "moderate"
  }

  return "early"
}

/**
 * @param {string} value
 */
function titleCase(value) {
  return value
    .split(" ")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ")
}

/**
 * @param {number} value
 */
function roundTenth(value) {
  return Math.round(value * 10) / 10
}
