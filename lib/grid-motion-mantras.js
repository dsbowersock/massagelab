export const GRID_MOTION_MANTRA_LIMIT = 10
export const GRID_MOTION_MANTRA_WORD_LIMIT = 3
export const GRID_MOTION_MANTRA_CHARACTER_LIMIT = 28

export const DEFAULT_GRID_MOTION_MANTRAS = Object.freeze([
  "I am grounded",
  "I choose ease",
  "I can soften",
  "Breathe and release",
  "Rest is productive",
  "I trust myself",
  "I am enough",
  "Peace begins within",
  "My body knows",
  "I welcome calm",
])

/**
 * Normalizes one user-authored Grid Motion phrase at the local preference boundary.
 * Non-strings are rejected; accepted phrases keep at most three whitespace-delimited
 * words and 28 Unicode code points so renderer tiles remain compact on phones.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeGridMotionMantra(value) {
  if (typeof value !== "string") {
    return ""
  }

  const characterLimitedValue = Array.from(String(value))
    .slice(0, GRID_MOTION_MANTRA_CHARACTER_LIMIT)
    .join("")

  return characterLimitedValue
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, GRID_MOTION_MANTRA_WORD_LIMIT)
    .join(" ")
    .trim()
}

/**
 * Normalizes the complete local Grid Motion phrase list. Valid order is stable,
 * duplicates compare case-insensitively, and callers always receive a fresh array.
 * The optional fallback is expected to be normalized already and is defensively copied.
 *
 * @param {unknown} value
 * @param {readonly string[]} [fallback=DEFAULT_GRID_MOTION_MANTRAS]
 * @returns {string[]}
 */
export function normalizeGridMotionMantras(
  value,
  fallback = DEFAULT_GRID_MOTION_MANTRAS,
) {
  if (Array.isArray(value)) {
    const normalized = []
    const seen = new Set()

    for (const candidate of value) {
      const mantra = normalizeGridMotionMantra(candidate)
      const dedupeKey = mantra.toLowerCase()

      if (!mantra || seen.has(dedupeKey)) {
        continue
      }

      seen.add(dedupeKey)
      normalized.push(mantra)

      if (normalized.length === GRID_MOTION_MANTRA_LIMIT) {
        return normalized
      }
    }

    if (normalized.length > 0) {
      return normalized
    }
  }

  const resolvedFallback = Array.isArray(fallback) && fallback.length > 0
    ? fallback
    : DEFAULT_GRID_MOTION_MANTRAS
  return resolvedFallback.slice(0, GRID_MOTION_MANTRA_LIMIT)
}

/**
 * Chooses a valid seed that can grow the current normalized editor list without
 * introducing a case-insensitive duplicate. Add is enabled only below ten
 * entries, while this ordered pool contains eleven unique valid phrases.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function getGridMotionMantraAddSeed(value) {
  const current = normalizeGridMotionMantras(value)
  if (current.length >= GRID_MOTION_MANTRA_LIMIT) {
    return ""
  }

  const used = new Set(current.map((mantra) => mantra.toLowerCase()))
  const candidates = ["I am calm", ...DEFAULT_GRID_MOTION_MANTRAS]

  for (const candidate of candidates) {
    const normalized = normalizeGridMotionMantra(candidate)
    if (normalized && !used.has(normalized.toLowerCase())) {
      return normalized
    }
  }

  return "I am calm"
}
