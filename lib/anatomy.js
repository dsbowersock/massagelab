// @ts-check

import {
  ANATOMY_STUDY_DIFFICULTIES,
  ANATOMY_STUDY_REGION_LABELS,
  ANATOMY_STUDY_REGION_ORDER,
  createAnatomyStudyDeck,
  getAnatomyStudyCards,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
  validateAnatomyStudyContent,
} from "./anatomy-study.js"

/**
 * @typedef {"bone" | "muscle"} AnatomyKind
 * @typedef {"easy" | "medium" | "hard"} AnatomyDifficulty
 * @typedef {{ type: string, targetId: string }} AnatomyRelationship
 * @typedef {{
 *   id: string
 *   name: string
 *   kind: AnatomyKind
 *   regions: string[]
 *   difficulty: AnatomyDifficulty
 *   aliases: string[]
 *   definition?: string
 *   relationships?: AnatomyRelationship[]
 *   sourceRefs: string[]
 * }} AnatomyTerm
 */

export const ANATOMY_KINDS = /** @type {const} */ (["bone", "muscle"])
export const ANATOMY_DIFFICULTIES = ANATOMY_STUDY_DIFFICULTIES
export const REGION_ORDER = ANATOMY_STUDY_REGION_ORDER
export const REGION_LABELS = ANATOMY_STUDY_REGION_LABELS

const LEGACY_CATEGORIES = /** @type {const} */ (["bone", "muscle"])

/**
 * @param {import("./anatomy-study.js").AnatomyStudyCard} card
 * @returns {AnatomyTerm}
 */
function toAnatomyTerm(card) {
  return {
    id: card.id,
    name: card.name,
    kind: /** @type {AnatomyKind} */ (card.category),
    regions: card.regions,
    difficulty: card.difficulty,
    aliases: card.aliases,
    definition: card.summary,
    relationships: [],
    sourceRefs: card.sourceRefs,
  }
}

/**
 * @param {{
 *   kinds?: AnatomyKind[]
 *   regions?: string[]
 *   difficulty?: AnatomyDifficulty
 * }} [options]
 */
export function getAnatomyTerms(options = {}) {
  return getAnatomyStudyCards({
    categories: options.kinds ?? [...LEGACY_CATEGORIES],
    regions: options.regions,
    difficulty: options.difficulty,
  }).map(toAnatomyTerm)
}

export const anatomyTerms = getAnatomyTerms()

/**
 * @param {{
 *   kinds?: AnatomyKind[]
 *   regions?: string[]
 *   difficulty?: AnatomyDifficulty
 *   count?: number
 *   rng?: () => number
 *   seed?: string
 * }} [options]
 */
export function createAnatomimeDeck(options = {}) {
  return createAnatomyStudyDeck({
    categories: options.kinds ?? [...LEGACY_CATEGORIES],
    regions: options.regions,
    difficulty: options.difficulty,
    count: options.count,
    rng: options.rng,
    seed: options.seed,
  }).map(toAnatomyTerm)
}

export function getAnatomyRegions() {
  return getAnatomyStudyRegions(getAnatomyStudyCards({ categories: [...LEGACY_CATEGORIES] }))
}

export function getAnatomySources() {
  return getAnatomyStudySources(getAnatomyStudyCards({ categories: [...LEGACY_CATEGORIES] }))
}

/**
 * @param {AnatomyTerm[]} [terms]
 */
export function validateAnatomyContent(terms = anatomyTerms) {
  const issues = []
  const ids = new Set()

  for (const term of terms) {
    if (ids.has(term.id)) issues.push(`Duplicate anatomy term id: ${term.id}`)
    ids.add(term.id)
    if (!term.name.trim()) issues.push(`Empty anatomy term name: ${term.id}`)
    if (!ANATOMY_KINDS.includes(term.kind)) issues.push(`Invalid anatomy term kind: ${term.id}`)
    if (!ANATOMY_DIFFICULTIES.includes(term.difficulty)) issues.push(`Invalid anatomy term difficulty: ${term.id}`)
    if (!Array.isArray(term.regions) || term.regions.length === 0) issues.push(`Missing anatomy term region: ${term.id}`)

    for (const relationship of term.relationships ?? []) {
      if (!ids.has(relationship.targetId) && !terms.some((candidate) => candidate.id === relationship.targetId)) {
        issues.push(`Invalid anatomy relationship target for ${term.id}: ${relationship.targetId}`)
      }
    }
  }

  return terms === anatomyTerms ? [...validateAnatomyStudyContent(), ...issues] : issues
}

export const musclesByArea = Object.freeze(Object.fromEntries(
  REGION_ORDER.map((region) => [
    region,
    getAnatomyTerms({ kinds: ["muscle"], regions: [region], difficulty: "hard" }).map((term) => term.name.toLowerCase()),
  ]),
))
