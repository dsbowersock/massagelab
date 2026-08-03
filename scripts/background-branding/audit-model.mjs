const DECISIONS = new Set(["keep", "rename"])
const MASSAGE_LAB_BRAND_COMPACT = "massagelab"
const RESERVED_MASSAGE_LAB_BACKGROUND_ID = "massage-lab-moving-gradient"
const RESERVED_MASSAGE_LAB_RECOMMENDATION = "Massage Laba Lamp"
const MASSAGE_LAB_RESERVATION_ERROR =
  "Massage Lab-branded recommendations are reserved for the internal massage-lab-moving-gradient background named Massage Laba Lamp"

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Normalizes visible names for exact collision comparisons without merging
 * separate words that may be distinguished only by punctuation or casing.
 *
 * @param {unknown} value Candidate display name.
 * @returns {string} Lowercase, punctuation-free comparison key.
 */
export function normalizeBrandName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Detects MassageLab branding after separator removal so audit authors cannot
 * assign the reserved brand to another ID using spacing, punctuation, or case.
 *
 * @param {unknown} value Candidate display name.
 * @returns {boolean} Whether the name contains the MassageLab brand.
 */
function containsMassageLabBrand(value) {
  return normalizeBrandName(value).replaceAll(" ", "").includes(MASSAGE_LAB_BRAND_COMPACT)
}

/**
 * Validates the audit fields required to make a reviewed naming decision
 * reproducible, including the internal-source constraint for signature work.
 *
 * @param {Record<string, unknown> | undefined} entry Audit entry to validate.
 * @param {{ id: string, sourceUrl: string }} background Registry row for the entry.
 * @returns {string[]} Stable, display-ready validation errors.
 */
export function validateAuditEntry(entry, background) {
  const errors = []
  const prefix = `${background.id}:`
  if (!isNonemptyString(entry?.id)) errors.push(`${prefix} id is required`)
  if (!DECISIONS.has(entry?.decision)) errors.push(`${prefix} decision must be keep or rename`)
  if (!isNonemptyString(entry?.recommendedName)) errors.push(`${prefix} recommendedName is required`)
  const alternatives = Array.isArray(entry?.alternatives) ? entry.alternatives : []
  const alternativesAreStrings = alternatives.every(isNonemptyString)
  const uniqueAlternatives = new Set(
    alternativesAreStrings ? alternatives.map(normalizeBrandName) : [],
  )
  if (
    alternatives.length < 2
    || alternatives.length > 3
    || !alternativesAreStrings
    || uniqueAlternatives.size !== alternatives.length
  ) {
    errors.push(`${prefix} two or three unique alternatives are required`)
  }
  const descriptorWords = isNonemptyString(entry?.visualDescriptor)
    ? entry.visualDescriptor.trim().split(/\s+/)
    : []
  if (!isNonemptyString(entry?.visualDescriptor) || descriptorWords.length < 3 || descriptorWords.length > 8) {
    errors.push(`${prefix} visualDescriptor must contain 3-8 words`)
  }
  if (!isNonemptyString(entry?.rationale)) errors.push(`${prefix} rationale is required`)
  if (!isNonemptyString(entry?.collisionNotes)) errors.push(`${prefix} collisionNotes is required`)
  if (typeof entry?.signatureOriginalEligible !== "boolean") {
    errors.push(`${prefix} signatureOriginalEligible must be boolean`)
  }
  if (entry?.signatureOriginalEligible && background.sourceUrl !== "internal") {
    errors.push(`${prefix} only internally conceived sources may be signature originals`)
  }
  if (isNonemptyString(entry?.recommendedName) && containsMassageLabBrand(entry.recommendedName) && (
    background.id !== RESERVED_MASSAGE_LAB_BACKGROUND_ID
    || background.sourceUrl !== "internal"
    || String(entry.recommendedName).trim() !== RESERVED_MASSAGE_LAB_RECOMMENDATION
  )) {
    errors.push(`${prefix} ${MASSAGE_LAB_RESERVATION_ERROR}`)
  }
  return errors
}

/**
 * Finds recommendation collisions so an audit cannot silently assign one
 * visible name to multiple background IDs.
 *
 * @param {Array<{ id: string, recommendedName: unknown }>} entries Audit entries.
 * @returns {Array<{ normalized: string, ids: string[] }>} Duplicate-name groups.
 */
export function findRecommendedNameCollisions(entries) {
  const idsByName = new Map()
  for (const entry of entries) {
    const normalized = normalizeBrandName(entry.recommendedName)
    if (!normalized) continue
    idsByName.set(normalized, [...(idsByName.get(normalized) ?? []), entry.id])
  }
  return [...idsByName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([normalized, ids]) => ({ normalized, ids }))
}

/**
 * Ensures both audit records and review batches map one-to-one to currently
 * enabled registry IDs, preserving catalog identity rather than rewriting it.
 *
 * @param {{ backgrounds: Array<{ id: string, enabled: boolean }>, entries: Array<{ id: string }>, batches: Array<{ ids: string[] }> }} audit
 * @returns {string[]} Coverage and duplicate-ID errors.
 */
export function validateAuditCoverage({ backgrounds, entries, batches }) {
  const errors = []
  const enabledIds = backgrounds.filter(({ enabled }) => enabled).map(({ id }) => id)
  const entryIds = entries.map(({ id }) => id)
  const batchIds = batches.flatMap(({ ids }) => ids)
  for (const [label, ids] of [["entries", entryIds], ["batches", batchIds]]) {
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    if (duplicates.length) errors.push(`${label}: duplicate ids ${[...new Set(duplicates)].join(", ")}`)
    const missing = enabledIds.filter((id) => !ids.includes(id))
    const extra = ids.filter((id) => !enabledIds.includes(id))
    if (missing.length) errors.push(`${label}: missing ids ${missing.join(", ")}`)
    if (extra.length) errors.push(`${label}: unknown or disabled ids ${extra.join(", ")}`)
  }
  return errors
}
