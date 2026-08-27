// @ts-check

import { createHash } from "node:crypto"

import { validateSignatureSoundDiscoveryReview } from "./signature-sound-discovery.js"

const POLICY_FIELDS = new Set(["version", "defaultStrategyId", "strategies", "conceptOverrides"])
const STRATEGY_FIELDS = new Set([
  "id", "label", "sourceUnit", "ordering", "timing", "transitions", "dynamic",
])
const OVERRIDE_FIELDS = new Set(["conceptKind", "conceptId", "strategyId", "reason"])
const EXPORT_FIELDS = new Set(["version", "reviewFingerprint", "updatedAt", "decisions"])
const EXPORT_ENTRY_FIELDS = new Set(["decision", "note"])
const CURATION_FIELDS = new Set([
  "version", "reviewedAt", "fingerprints", "policy", "summary", "strategies", "decisions", "groups",
])
const CURATION_FINGERPRINT_FIELDS = new Set([
  "discoveryReviewSha256", "exportedReviewSha256", "strategyPolicySha256", "curationSha256",
])
const DECISIONS = new Set(["keep", "maybe", "reject"])
const CONCEPT_KINDS = new Set(["moodist", "signature-extra"])
const SOURCE_UNITS = new Set(["whole-source", "one-shot"])
const ORDERINGS = new Set(["shuffle-no-immediate-repeat"])
const TIMINGS = new Set(["continuous", "walking-cadence", "spaced-events"])
const TRANSITIONS = new Set(["end-to-end", "crossfade", "overlap"])
const KEBAB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

/**
 * Validates the human-owned dynamic playback strategy policy independently of
 * any one discovery manifest. Concept membership is checked during curation.
 * @param {unknown} rawPolicy
 */
export function validateSignatureSoundPlaybackStrategies(rawPolicy) {
  const policy = requireRecord(rawPolicy, "Signature playback strategy policy")
  assertOnlyFields(policy, POLICY_FIELDS, "Signature playback strategy policy")
  if (policy.version !== 1) throw new Error("Unsupported Signature playback strategy policy version")
  const defaultStrategyId = requireKebabId(policy.defaultStrategyId, "Default Signature playback strategy id")
  if (!Array.isArray(policy.strategies) || policy.strategies.length === 0) {
    throw new Error("Signature playback strategies must be a non-empty array")
  }
  const strategyIds = new Set()
  const strategies = policy.strategies.map((rawStrategy, index) => {
    const strategy = requireRecord(rawStrategy, `Signature playback strategy at index ${index}`)
    assertOnlyFields(strategy, STRATEGY_FIELDS, `Signature playback strategy at index ${index}`)
    const id = requireKebabId(strategy.id, `Signature playback strategy at index ${index} id`)
    if (strategyIds.has(id)) throw new Error(`Duplicate Signature playback strategy id: ${id}`)
    strategyIds.add(id)
    const label = requireTrimmedString(strategy.label, `Signature playback strategy ${id} label`)
    const sourceUnit = requireEnum(strategy.sourceUnit, SOURCE_UNITS, `Signature playback strategy ${id} source unit`)
    const ordering = requireEnum(strategy.ordering, ORDERINGS, `Signature playback strategy ${id} ordering`)
    const timing = requireEnum(strategy.timing, TIMINGS, `Signature playback strategy ${id} timing`)
    if (!Array.isArray(strategy.transitions) || strategy.transitions.length === 0) {
      throw new Error(`Signature playback strategy ${id} transitions must be a non-empty array`)
    }
    const transitions = strategy.transitions.map((transition, transitionIndex) => requireEnum(
      transition,
      TRANSITIONS,
      `Signature playback strategy ${id} transition at index ${transitionIndex}`,
    ))
    if (new Set(transitions).size !== transitions.length) {
      throw new Error(`Signature playback strategy ${id} transitions contain a duplicate`)
    }
    if (strategy.dynamic !== true) {
      throw new Error(`Signature playback strategy ${id} must be dynamic`)
    }
    return { id, label, sourceUnit, ordering, timing, transitions, dynamic: true }
  })
  if (!strategyIds.has(defaultStrategyId)) {
    throw new Error(`Unknown default Signature playback strategy: ${defaultStrategyId}`)
  }
  if (!Array.isArray(policy.conceptOverrides)) {
    throw new Error("Signature playback concept overrides must be an array")
  }
  const overrideIds = new Set()
  const conceptOverrides = policy.conceptOverrides.map((rawOverride, index) => {
    const override = requireRecord(rawOverride, `Signature playback concept override at index ${index}`)
    assertOnlyFields(override, OVERRIDE_FIELDS, `Signature playback concept override at index ${index}`)
    const conceptKind = requireEnum(
      override.conceptKind,
      CONCEPT_KINDS,
      `Signature playback concept override at index ${index} kind`,
    )
    const conceptId = requireKebabId(override.conceptId, `Signature playback concept override at index ${index} concept id`)
    const groupId = `${conceptKind}:${conceptId}`
    if (overrideIds.has(groupId)) throw new Error(`Duplicate Signature playback concept override: ${groupId}`)
    overrideIds.add(groupId)
    const strategyId = requireKebabId(
      override.strategyId,
      `Signature playback concept override ${groupId} strategy id`,
    )
    if (!strategyIds.has(strategyId)) {
      throw new Error(`Unknown Signature playback strategy for override ${groupId}: ${strategyId}`)
    }
    const reason = requireTrimmedString(override.reason, `Signature playback concept override ${groupId} reason`)
    return { conceptKind, conceptId, strategyId, reason }
  })
  return copy({ version: 1, defaultStrategyId, strategies, conceptOverrides })
}

/**
 * Applies the confirmed source-level decision precedence and derives active
 * concept groups with dynamic playback strategies.
 * @param {{ discoveryReview: unknown, moodistConcepts: unknown, exportedReview: unknown, strategyPolicy: unknown }} input
 */
export function createSignatureSoundListeningReview(input) {
  const normalized = normalizeInputs(input)
  return copy(deriveCuration(normalized))
}

/**
 * Recomputes the expected curation from its authoritative inputs and rejects
 * serialized drift at the consumer boundary.
 * @param {unknown} rawReview
 * @param {{ discoveryReview: unknown, moodistConcepts: unknown, exportedReview: unknown, strategyPolicy: unknown }} input
 */
export function validateSignatureSoundListeningReview(rawReview, input) {
  const review = requireRecord(rawReview, "Signature listening review")
  assertOnlyFields(review, CURATION_FIELDS, "Signature listening review")
  const fingerprints = requireRecord(review.fingerprints, "Signature listening review fingerprints")
  assertOnlyFields(fingerprints, CURATION_FINGERPRINT_FIELDS, "Signature listening review fingerprints")
  const expected = deriveCuration(normalizeInputs(input))
  if (stableJson(review) !== stableJson(expected)) {
    throw new Error("Signature listening review does not match its manifest, export, or strategy policy")
  }
  return copy(expected)
}

/** @param {unknown} rawReview @param {{ discoveryReview: unknown, moodistConcepts: unknown, exportedReview: unknown, strategyPolicy: unknown }} input */
export function renderSignatureSoundListeningReviewJson(rawReview, input) {
  return `${JSON.stringify(validateSignatureSoundListeningReview(rawReview, input), null, 2)}\n`
}

function normalizeInputs(input) {
  const discoveryReview = validateSignatureSoundDiscoveryReview(input.discoveryReview, input.moodistConcepts)
  const strategyPolicy = validateSignatureSoundPlaybackStrategies(input.strategyPolicy)
  const exportedReview = validateExportedReview(input.exportedReview, discoveryReview)
  return { discoveryReview, exportedReview, strategyPolicy }
}

function validateExportedReview(rawExport, discoveryReview) {
  const exported = requireRecord(rawExport, "Exported Signature listening review")
  assertOnlyFields(exported, EXPORT_FIELDS, "Exported Signature listening review")
  if (exported.version !== 1) throw new Error("Unsupported exported Signature listening review version")
  const reviewFingerprint = requireSha256(exported.reviewFingerprint, "Exported Signature listening review fingerprint")
  if (reviewFingerprint !== discoveryReview.fingerprints.reviewSha256) {
    throw new Error("Exported Signature listening review fingerprint does not match the discovery manifest")
  }
  const updatedAt = requireIsoTimestamp(exported.updatedAt, "Exported Signature listening review update time")
  const rawDecisions = requireRecord(exported.decisions, "Exported Signature listening decisions")
  const sourceById = new Map(discoveryReview.sources.map((source) => [source.sourceId, source]))
  const decisions = {}
  for (const sourceId of Object.keys(rawDecisions).sort(compareText)) {
    requireSha256(sourceId, "Exported Signature listening decision source id")
    const source = sourceById.get(sourceId)
    if (source === undefined) throw new Error(`Unknown exported Signature listening source: ${sourceId}`)
    if (source.reviewState !== "candidate") {
      throw new Error(`Exported Signature listening source is not a proposed candidate: ${sourceId}`)
    }
    const rawEntry = requireRecord(rawDecisions[sourceId], `Exported Signature listening decision ${sourceId}`)
    assertOnlyFields(rawEntry, EXPORT_ENTRY_FIELDS, `Exported Signature listening decision ${sourceId}`)
    const entry = { note: requireString(rawEntry.note, `Exported Signature listening decision ${sourceId} note`) }
    if (hasOwn(rawEntry, "decision")) {
      entry.decision = requireEnum(rawEntry.decision, DECISIONS, `Exported Signature listening decision ${sourceId}`)
    }
    decisions[sourceId] = entry
  }
  return { version: 1, reviewFingerprint, updatedAt, decisions }
}

function deriveCuration({ discoveryReview, exportedReview, strategyPolicy }) {
  const decisions = []
  const decisionBySourceId = new Map()
  for (const source of discoveryReview.sources) {
    if (source.reviewState !== "candidate") continue
    const exported = exportedReview.decisions[source.sourceId]
    const explicit = exported?.decision
    const decision = explicit ?? "maybe"
    const normalized = {
      sourceId: source.sourceId,
      decision,
      origin: explicit === undefined ? "contextual-unmarked" : "explicit",
      note: exported?.note ?? "",
    }
    decisions.push(normalized)
    decisionBySourceId.set(source.sourceId, normalized)
  }

  const groupsById = new Map()
  for (const source of discoveryReview.sources) {
    if (source.reviewState !== "candidate") continue
    for (const concept of source.moodistConcepts) {
      addGroupSource(groupsById, {
        groupId: `moodist:${concept.id}`,
        conceptKind: "moodist",
        conceptId: concept.id,
        label: concept.label,
        category: concept.category,
      }, source.sourceId)
    }
    for (const concept of source.signatureExtraConcepts) {
      addGroupSource(groupsById, {
        groupId: `signature-extra:${concept.id}`,
        conceptKind: "signature-extra",
        conceptId: concept.id,
        label: concept.label,
        category: null,
      }, source.sourceId)
    }
  }
  const overrideByGroupId = new Map(strategyPolicy.conceptOverrides.map((override) => [
    `${override.conceptKind}:${override.conceptId}`,
    override,
  ]))
  for (const groupId of overrideByGroupId.keys()) {
    if (!groupsById.has(groupId)) throw new Error(`Unknown Signature playback concept override: ${groupId}`)
  }
  const groups = [...groupsById.values()].sort((left, right) => compareText(left.groupId, right.groupId)).map((group) => {
    const sourceCounts = { total: group.sourceIds.length, keep: 0, maybe: 0, reject: 0 }
    for (const sourceId of group.sourceIds) sourceCounts[decisionBySourceId.get(sourceId).decision] += 1
    return {
      groupId: group.groupId,
      conceptKind: group.conceptKind,
      conceptId: group.conceptId,
      label: group.label,
      category: group.category,
      status: "active",
      strategyId: overrideByGroupId.get(group.groupId)?.strategyId ?? strategyPolicy.defaultStrategyId,
      sourceCounts,
    }
  })

  const summary = {
    candidateSourceCount: decisions.length,
    explicitKeepCount: decisions.filter(({ decision, origin }) => decision === "keep" && origin === "explicit").length,
    explicitMaybeCount: decisions.filter(({ decision, origin }) => decision === "maybe" && origin === "explicit").length,
    explicitRejectCount: decisions.filter(({ decision, origin }) => decision === "reject" && origin === "explicit").length,
    contextualMaybeCount: decisions.filter(({ origin }) => origin === "contextual-unmarked").length,
    activeSourceCount: decisions.filter(({ decision }) => decision !== "reject").length,
    sourceDecisionCount: decisions.length,
    activeGroupCount: groups.length,
    zeroIngredientGroupCount: groups.filter(({ sourceCounts }) => sourceCounts.keep + sourceCounts.maybe === 0).length,
  }
  const policy = {
    explicitRejectScope: "source-only",
    unmarkedCandidateDecision: "maybe",
    excludedAndUnclassifiedPolicy: "discovery-only",
    groupStatus: "active",
    playbackMode: "dynamic",
    defaultStrategyId: strategyPolicy.defaultStrategyId,
  }
  const fingerprints = {
    discoveryReviewSha256: discoveryReview.fingerprints.reviewSha256,
    exportedReviewSha256: sha256(stableJson(exportedReview)),
    strategyPolicySha256: sha256(stableJson(strategyPolicy)),
    curationSha256: "",
  }
  const result = {
    version: 1,
    reviewedAt: exportedReview.updatedAt,
    fingerprints,
    policy,
    strategies: strategyPolicy.strategies,
    summary,
    decisions,
    groups,
  }
  fingerprints.curationSha256 = sha256(stableJson(result))
  return result
}

function addGroupSource(groupsById, identity, sourceId) {
  const existing = groupsById.get(identity.groupId)
  if (existing === undefined) groupsById.set(identity.groupId, { ...identity, sourceIds: [sourceId] })
  else existing.sourceIds.push(sourceId)
}

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function assertOnlyFields(value, allowed, label) {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} contains unknown field: ${field}`)
  }
}

function requireString(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`)
  return value
}

function requireTrimmedString(value, label) {
  const string = requireString(value, label)
  if (string === "" || string !== string.trim()) throw new Error(`${label} must be a non-blank trimmed string`)
  return string
}

function requireKebabId(value, label) {
  const id = requireTrimmedString(value, label)
  if (!KEBAB_ID_PATTERN.test(id)) throw new Error(`${label} must be a kebab-case id`)
  return id
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw new Error(`${label} must be a SHA-256 value`)
  return value
}

function requireIsoTimestamp(value, label) {
  const timestamp = requireTrimmedString(value, label)
  if (Number.isNaN(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) {
    throw new Error(`${label} must be a canonical ISO timestamp`)
  }
  return timestamp
}

function requireEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) throw new Error(`${label} is not supported`)
  return value
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field)
}

function compareText(left, right) {
  const folded = left.toLowerCase().localeCompare(right.toLowerCase(), "en")
  return folded || left.localeCompare(right, "en")
}
