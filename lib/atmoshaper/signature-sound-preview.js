const CONTINUOUS_STRATEGIES = new Set([
  "adaptive-whole-source-sequence",
  "adaptive-one-shot-sequence",
])
const STRATEGY_IDS = new Set([
  ...CONTINUOUS_STRATEGIES,
  "walking-cadence-sequence",
  "spaced-event-sequence",
])
const SOURCE_POOLS = new Set(["keep-only", "keep-and-maybe"])
const SOURCE_DECISIONS = new Set(["keep", "maybe", "reject"])
const TRANSITION_MODES = new Set(["end-to-end", "crossfade", "overlap"])
const CADENCE_BOUNDARY_MODES = new Set(["crossfade", "overlap"])
const CONSTRUCTION_POLICY_FIELDS = new Set([
  "minimumSelectionsBeforeRepeat",
  "transitionDurationRange",
  "cadenceBoundary",
  "overlapNextEvent",
  "preserveFullLengthOverlaps",
])
const SHA256_PATTERN = /^[a-f0-9]{64}$/

/** Returns a fresh, strategy-specific starting point for browser audition. */
export function defaultSignatureSoundPreviewSettings(strategyId) {
  requireStrategyId(strategyId)
  if (CONTINUOUS_STRATEGIES.has(strategyId)) {
    return { transitionMode: "crossfade", transitionSeconds: 2 }
  }
  if (strategyId === "walking-cadence-sequence") {
    return { stepsPerMinute: 105, jitterPercent: 8 }
  }
  return { minimumGapSeconds: 3, maximumGapSeconds: 9 }
}

/**
 * Closes the calibration fields for each strategy so an exported approval
 * describes the exact behavior that was auditioned rather than loose UI state.
 */
export function validateSignatureSoundPreviewSettings(strategyId, rawSettings) {
  requireStrategyId(strategyId)
  const settings = requireRecord(rawSettings, `Signature preview settings for ${strategyId}`)
  if (CONTINUOUS_STRATEGIES.has(strategyId)) {
    assertOnlyFields(settings, new Set(["transitionMode", "transitionSeconds"]), `Signature preview settings for ${strategyId}`)
    const transitionMode = requireEnum(
      settings.transitionMode,
      TRANSITION_MODES,
      `Signature preview transition for ${strategyId}`,
    )
    const transitionSeconds = requireNumber(
      settings.transitionSeconds,
      `Signature preview transition seconds for ${strategyId}`,
    )
    if (transitionMode === "end-to-end" && transitionSeconds !== 0) {
      throw new Error("End-to-end Signature preview transition seconds must be zero")
    }
    if (transitionMode !== "end-to-end" && (transitionSeconds < 0.25 || transitionSeconds > 30)) {
      throw new Error("Signature preview transition seconds must be in the 0.25 to 30 second range")
    }
    return { transitionMode, transitionSeconds }
  }
  if (strategyId === "walking-cadence-sequence") {
    assertOnlyFields(settings, new Set(["stepsPerMinute", "jitterPercent"]), `Signature preview settings for ${strategyId}`)
    const stepsPerMinute = requireNumber(settings.stepsPerMinute, "Signature preview steps per minute")
    const jitterPercent = requireNumber(settings.jitterPercent, "Signature preview cadence jitter percent")
    if (stepsPerMinute < 40 || stepsPerMinute > 180) {
      throw new Error("Signature preview steps per minute must be in the 40 to 180 range")
    }
    if (jitterPercent < 0 || jitterPercent > 30) {
      throw new Error("Signature preview cadence jitter must be in the 0 to 30 percent range")
    }
    return { stepsPerMinute, jitterPercent }
  }
  assertOnlyFields(settings, new Set(["minimumGapSeconds", "maximumGapSeconds"]), `Signature preview settings for ${strategyId}`)
  const minimumGapSeconds = requireNumber(settings.minimumGapSeconds, "Signature preview minimum gap seconds")
  const maximumGapSeconds = requireNumber(settings.maximumGapSeconds, "Signature preview maximum gap seconds")
  if (minimumGapSeconds < 0 || minimumGapSeconds > 30) {
    throw new Error("Signature preview minimum gap must be in the 0 to 30 second range")
  }
  if (maximumGapSeconds < minimumGapSeconds || maximumGapSeconds > 60) {
    throw new Error("Signature preview maximum gap must be at least the minimum and no more than 60 seconds")
  }
  return { minimumGapSeconds, maximumGapSeconds }
}

/** Produces the legacy v2 identity for the strategy, source pool, and exact tuning heard. */
export function createSignatureSoundPreviewAuditionKey(rawConfiguration) {
  const configuration = requireRecord(rawConfiguration, "Signature preview audition configuration")
  assertOnlyFields(
    configuration,
    new Set(["strategyId", "sourcePool", "previewSettings"]),
    "Signature preview audition configuration",
  )
  const strategyId = requireStrategyId(configuration.strategyId)
  const sourcePool = requireEnum(configuration.sourcePool, SOURCE_POOLS, "Signature preview source pool")
  const previewSettings = validateSignatureSoundPreviewSettings(strategyId, configuration.previewSettings)
  return `${strategyId}|${sourcePool}|${JSON.stringify(previewSettings)}`
}

/** Produces the v3 identity for exact included sources, strategy, and tuning. */
export function createSignatureSoundExactPreviewAuditionKey(rawConfiguration) {
  const configuration = requireRecord(rawConfiguration, "Exact Signature preview audition configuration")
  assertOnlyFields(
    configuration,
    new Set(["strategyId", "previewSettings", "includedSourceIds"]),
    "Exact Signature preview audition configuration",
  )
  const strategyId = requireStrategyId(configuration.strategyId)
  const previewSettings = validateSignatureSoundPreviewSettings(strategyId, configuration.previewSettings)
  if (!Array.isArray(configuration.includedSourceIds) || configuration.includedSourceIds.length === 0) {
    throw new Error("Exact Signature preview audition needs at least one included source")
  }
  const includedSourceIds = configuration.includedSourceIds
    .map((sourceId, index) => requireSha256(sourceId, `Exact Signature preview source at index ${index}`))
    .sort(compareText)
  if (new Set(includedSourceIds).size !== includedSourceIds.length) {
    throw new Error("Exact Signature preview audition contains a duplicate source")
  }
  return `v3|${strategyId}|${JSON.stringify(previewSettings)}|${includedSourceIds.join(",")}`
}

/**
 * Joins the committed discovery identities to the committed human decisions.
 * Rejected recordings are counted for drift detection but never returned to a
 * playable pool. The browser receives only source IDs and relative labels.
 */
export function createSignatureSoundPreviewGroups(input) {
  const value = requireRecord(input, "Signature preview input")
  const curatedReview = requireRecord(value.curatedReview, "Signature preview curation")
  const discoveryReview = requireRecord(value.discoveryReview, "Signature preview discovery review")
  if (!Array.isArray(curatedReview.decisions)) throw new Error("Signature preview curation decisions must be an array")
  if (!Array.isArray(curatedReview.groups)) throw new Error("Signature preview curation groups must be an array")
  if (!Array.isArray(discoveryReview.sources)) throw new Error("Signature preview discovery sources must be an array")

  const candidateById = new Map()
  for (const [index, rawSource] of discoveryReview.sources.entries()) {
    const source = requireRecord(rawSource, `Signature preview discovery source at index ${index}`)
    if (source.reviewState !== "candidate") continue
    const sourceId = requireSha256(source.sourceId, `Signature preview discovery source at index ${index} id`)
    if (candidateById.has(sourceId)) throw new Error(`Duplicate Signature preview candidate source: ${sourceId}`)
    if (!Array.isArray(source.moodistConcepts) || !Array.isArray(source.signatureExtraConcepts)) {
      throw new Error(`Signature preview candidate ${sourceId} concepts must be arrays`)
    }
    candidateById.set(sourceId, {
      sourceId,
      relativePath: requireTrimmedString(source.relativePath, `Signature preview candidate ${sourceId} path`),
      groupIds: [
        ...source.moodistConcepts.map((concept) => `moodist:${requireConceptId(concept, sourceId)}`),
        ...source.signatureExtraConcepts.map((concept) => `signature-extra:${requireConceptId(concept, sourceId)}`),
      ],
    })
  }

  const decisionBySourceId = new Map()
  for (const [index, rawDecision] of curatedReview.decisions.entries()) {
    const decision = requireRecord(rawDecision, `Signature preview curation decision at index ${index}`)
    const sourceId = requireSha256(decision.sourceId, `Signature preview curation decision at index ${index} source id`)
    if (!candidateById.has(sourceId)) throw new Error(`Unknown Signature preview candidate decision source: ${sourceId}`)
    if (decisionBySourceId.has(sourceId)) throw new Error(`Duplicate Signature preview candidate decision: ${sourceId}`)
    decisionBySourceId.set(sourceId, requireEnum(decision.decision, SOURCE_DECISIONS, `Signature preview decision for ${sourceId}`))
  }
  for (const sourceId of candidateById.keys()) {
    if (!decisionBySourceId.has(sourceId)) throw new Error(`Missing Signature preview decision for candidate source: ${sourceId}`)
  }

  const groups = []
  const knownGroupIds = new Set()
  for (const [index, rawGroup] of curatedReview.groups.entries()) {
    const group = requireRecord(rawGroup, `Signature preview group at index ${index}`)
    const groupId = requireTrimmedString(group.groupId, `Signature preview group at index ${index} id`)
    if (knownGroupIds.has(groupId)) throw new Error(`Duplicate Signature preview group: ${groupId}`)
    knownGroupIds.add(groupId)
    const sourceCounts = requireRecord(group.sourceCounts, `Signature preview group ${groupId} source counts`)
    const counts = { total: 0, keep: 0, maybe: 0, reject: 0 }
    const sources = []
    for (const source of candidateById.values()) {
      if (!source.groupIds.includes(groupId)) continue
      const decision = decisionBySourceId.get(source.sourceId)
      counts.total += 1
      counts[decision] += 1
      if (decision !== "reject") {
        sources.push({ sourceId: source.sourceId, relativePath: source.relativePath, decision })
      }
    }
    for (const field of Object.keys(counts)) {
      if (sourceCounts[field] !== counts[field]) {
        throw new Error(`Signature preview ${groupId} ${field} source count drift`)
      }
    }
    groups.push({ groupId, sources })
  }
  for (const source of candidateById.values()) {
    for (const groupId of source.groupIds) {
      if (!knownGroupIds.has(groupId)) throw new Error(`Unknown Signature preview mapped group: ${groupId}`)
    }
  }
  return copy(groups)
}

/** Chooses a shuffled source without repeating the previous source when alternatives exist. */
export function chooseSignatureSoundPreviewSource(sourceIds, lastSourceId, random = Math.random) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) throw new Error("Signature preview needs at least one source")
  if (typeof random !== "function") throw new Error("Signature preview random source must be a function")
  const available = sourceIds.length === 1 ? sourceIds : sourceIds.filter((sourceId) => sourceId !== lastSourceId)
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) throw new Error("Signature preview random sample is invalid")
  return available[Math.min(available.length - 1, Math.floor(sample * available.length))]
}

/**
 * Chooses against a rolling recent-history window. When the requested window
 * is larger than the pool, the least-recently available source remains
 * selectable instead of deadlocking the audition.
 */
export function chooseSignatureSoundPreviewSourceWithHistory(
  sourceIds,
  recentSourceIds,
  minimumSelectionsBeforeRepeat,
  random = Math.random,
) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new Error("Signature construction preview needs at least one source")
  }
  if (!Array.isArray(recentSourceIds)) {
    throw new Error("Signature construction preview source history must be an array")
  }
  const window = requireInteger(
    minimumSelectionsBeforeRepeat,
    1,
    100,
    "Signature construction preview history window",
  )
  const maximumForbidden = Math.min(window, sourceIds.length - 1)
  const forbidden = new Set()
  for (let index = recentSourceIds.length - 1; index >= 0 && forbidden.size < maximumForbidden; index -= 1) {
    const sourceId = recentSourceIds[index]
    if (sourceIds.includes(sourceId)) forbidden.add(sourceId)
  }
  const available = sourceIds.filter((sourceId) => !forbidden.has(sourceId))
  return chooseFromAvailableSources(available, random)
}

/** Closes the additional scheduler policy used only by rebuilt construction auditions. */
export function validateSignatureSoundConstructionPlaybackPolicy(strategyId, rawSettings, rawPolicy) {
  requireStrategyId(strategyId)
  const settings = validateSignatureSoundPreviewSettings(strategyId, rawSettings)
  const policy = requireRecord(rawPolicy, `Signature construction playback policy for ${strategyId}`)
  assertOnlyFields(policy, CONSTRUCTION_POLICY_FIELDS, `Signature construction playback policy for ${strategyId}`)

  const minimumSelectionsBeforeRepeat = policy.minimumSelectionsBeforeRepeat === null
    ? null
    : requireInteger(
        policy.minimumSelectionsBeforeRepeat,
        1,
        100,
        "Signature construction minimum selections before repeat",
      )
  const transitionDurationRange = normalizeTransitionDurationRange(
    strategyId,
    settings,
    policy.transitionDurationRange,
  )
  const cadenceBoundary = normalizeCadenceBoundary(strategyId, policy.cadenceBoundary)
  if (typeof policy.overlapNextEvent !== "boolean") {
    throw new Error("Signature construction overlap-next-event policy must be boolean")
  }
  if (policy.overlapNextEvent && strategyId !== "walking-cadence-sequence") {
    throw new Error("Signature construction overlap-next-event policy requires a walking cadence strategy")
  }
  const preserveFullLengthOverlaps = policy.preserveFullLengthOverlaps
  if (preserveFullLengthOverlaps !== undefined) {
    if (typeof preserveFullLengthOverlaps !== "boolean") {
      throw new Error("Signature construction preserve-full-length-overlaps policy must be boolean")
    }
    if (preserveFullLengthOverlaps && (
      !CONTINUOUS_STRATEGIES.has(strategyId) || settings.transitionMode !== "overlap"
    )) {
      throw new Error("Signature construction preserve-full-length-overlaps requires continuous overlap")
    }
  }

  const normalized = {
    minimumSelectionsBeforeRepeat,
    transitionDurationRange,
    cadenceBoundary,
    overlapNextEvent: policy.overlapNextEvent,
  }
  return preserveFullLengthOverlaps === undefined
    ? normalized
    : { ...normalized, preserveFullLengthOverlaps }
}

/** Samples one continuous transition duration from a validated construction range. */
export function getSignatureSoundConstructionTransitionSeconds(rawPolicy, fallbackSeconds, random = Math.random) {
  const policy = requireRecord(rawPolicy, "Signature construction transition policy")
  const fallback = requireNumber(fallbackSeconds, "Signature construction fallback transition seconds")
  if (policy.transitionDurationRange === null) return fallback
  const range = normalizeTransitionRangeRecord(policy.transitionDurationRange)
  const sample = requireRandomSample(random)
  return range.minimumSeconds + sample * (range.maximumSeconds - range.minimumSeconds)
}

/** Computes the next cadence or spaced-event delay from validated preview settings. */
export function getSignatureSoundPreviewDelayMs(strategyId, rawSettings, random = Math.random) {
  const settings = validateSignatureSoundPreviewSettings(strategyId, rawSettings)
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) throw new Error("Signature preview random sample is invalid")
  if (strategyId === "walking-cadence-sequence") {
    const baseDelay = 60_000 / settings.stepsPerMinute
    const jitter = settings.jitterPercent / 100
    return Math.round(baseDelay * (1 - jitter + sample * jitter * 2))
  }
  if (strategyId === "spaced-event-sequence") {
    return Math.round((settings.minimumGapSeconds + sample * (
      settings.maximumGapSeconds - settings.minimumGapSeconds
    )) * 1000)
  }
  return 0
}

function requireConceptId(rawConcept, sourceId) {
  const concept = requireRecord(rawConcept, `Signature preview candidate ${sourceId} concept`)
  return requireTrimmedString(concept.id, `Signature preview candidate ${sourceId} concept id`)
}

function normalizeTransitionDurationRange(strategyId, settings, rawRange) {
  if (rawRange === null) return null
  if (!CONTINUOUS_STRATEGIES.has(strategyId)) {
    throw new Error("Signature construction transition duration range requires a continuous strategy")
  }
  if (settings.transitionMode === "end-to-end") {
    throw new Error("Signature construction transition duration range cannot use end-to-end mode")
  }
  return normalizeTransitionRangeRecord(rawRange)
}

function normalizeTransitionRangeRecord(rawRange) {
  const range = requireRecord(rawRange, "Signature construction transition duration range")
  assertOnlyFields(
    range,
    new Set(["minimumSeconds", "maximumSeconds"]),
    "Signature construction transition duration range",
  )
  const minimumSeconds = requireNumber(range.minimumSeconds, "Signature construction minimum transition seconds")
  const maximumSeconds = requireNumber(range.maximumSeconds, "Signature construction maximum transition seconds")
  if (minimumSeconds < 0.25 || maximumSeconds > 30 || maximumSeconds < minimumSeconds) {
    throw new Error("Signature construction transition duration range must stay between 0.25 and 30 seconds")
  }
  return { minimumSeconds, maximumSeconds }
}

function normalizeCadenceBoundary(strategyId, rawBoundary) {
  if (rawBoundary === null) return null
  if (strategyId !== "walking-cadence-sequence") {
    throw new Error("Signature construction cadence boundary requires a walking cadence strategy")
  }
  const boundary = requireRecord(rawBoundary, "Signature construction cadence boundary")
  assertOnlyFields(
    boundary,
    new Set(["mode", "crossfadeSeconds"]),
    "Signature construction cadence boundary",
  )
  const mode = requireEnum(boundary.mode, CADENCE_BOUNDARY_MODES, "Signature construction cadence boundary mode")
  const crossfadeSeconds = requireNumber(
    boundary.crossfadeSeconds,
    "Signature construction cadence boundary crossfade seconds",
  )
  if (mode === "crossfade" && (crossfadeSeconds < 0.01 || crossfadeSeconds > 2)) {
    throw new Error("Signature construction cadence crossfade must be in the 0.01 to 2 second range")
  }
  if (mode === "overlap" && crossfadeSeconds !== 0) {
    throw new Error("Signature construction cadence overlap must use zero crossfade seconds")
  }
  return { mode, crossfadeSeconds }
}

function chooseFromAvailableSources(available, random) {
  const sample = requireRandomSample(random)
  return available[Math.min(available.length - 1, Math.floor(sample * available.length))]
}

function requireRandomSample(random) {
  if (typeof random !== "function") throw new Error("Signature preview random source must be a function")
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) {
    throw new Error("Signature preview random sample is invalid")
  }
  return sample
}

function requireStrategyId(value) {
  return requireEnum(value, STRATEGY_IDS, "Signature preview strategy")
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

function requireTrimmedString(value, label) {
  if (typeof value !== "string" || value === "" || value !== value.trim()) {
    throw new Error(`${label} must be a non-blank trimmed string`)
  }
  return value
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw new Error(`${label} must be a SHA-256 value`)
  return value
}

function requireEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) throw new Error(`${label} is not supported`)
  return value
}

function requireNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`)
  return value
}

function requireInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a whole number in the ${minimum} to ${maximum} range`)
  }
  return value
}

function compareText(left, right) {
  return left.localeCompare(right, "en")
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
