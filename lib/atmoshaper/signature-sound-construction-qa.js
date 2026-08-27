import {
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"

const AUDITION_FIELDS = new Set(["version", "algorithmVersion", "constructionReviewSha256", "groups"])
const GROUP_FIELDS = new Set([
  "groupId", "label", "strategyId", "includedSourceIds", "previewSettings", "policy",
  "processingIntentIds", "noteDispositionIds", "reviewState", "status", "blockers", "allowedQaScopes",
])
const POLICY_FIELDS = new Set([
  "minimumSelectionsBeforeRepeat", "transitionDurationRange", "boundaryModeCandidates", "overlapNextEvent",
])
const QA_FIELDS = new Set([
  "version", "constructionReviewSha256", "algorithmVersion", "updatedAt", "groups",
])
const QA_ENTRY_FIELDS = new Set([
  "note", "auditionedAt", "auditionKey", "configuration", "decision", "scope",
])
const CONFIGURATION_FIELDS = new Set([
  "includedSourceIds", "previewSettings", "constructionPolicy",
])
const STATUSES = new Set(["ready", "processing-pending", "blocked"])
const QA_SCOPES = new Set(["playback-only", "complete-construction"])
const DECISIONS = new Set(["pass", "needs-rework", "reject"])
const BOUNDARY_MODES = new Set(["crossfade", "overlap"])
const SHA256_PATTERN = /^[a-f0-9]{64}$/

/** Creates the empty, independent construction-QA record for one exact projection. */
export function createSignatureSoundConstructionQa(rawAudition, updatedAt) {
  const audition = normalizeAudition(rawAudition)
  return {
    version: 1,
    constructionReviewSha256: audition.constructionReviewSha256,
    algorithmVersion: audition.algorithmVersion,
    updatedAt: requireIsoTimestamp(updatedAt, "Signature construction QA update time"),
    groups: {},
  }
}

/** Keeps construction evidence isolated from every earlier review workspace key. */
export function createSignatureSoundConstructionQaStorageKey(rawAudition) {
  const audition = normalizeAudition(rawAudition)
  return `atmoshaper-signature-construction-qa-v1:${audition.constructionReviewSha256}:${audition.algorithmVersion}`
}

/**
 * Produces the exact scheduler configuration heard for a projected group. A
 * boundary selection is required only where the construction authority asks
 * the reviewer to compare cadence crossfade with overlap.
 */
export function createSignatureSoundConstructionAuditionConfiguration(rawGroup, rawBoundary) {
  const group = normalizeGroup(rawGroup, "Signature construction audition group")
  let cadenceBoundary = null
  if (group.policy.boundaryModeCandidates.length > 0) {
    const boundary = requireRecord(rawBoundary, `Signature construction boundary for ${group.groupId}`)
    assertOnlyFields(boundary, new Set(["mode", "crossfadeSeconds"]), `Signature construction boundary for ${group.groupId}`)
    const mode = requireEnum(
      boundary.mode,
      BOUNDARY_MODES,
      `Signature construction boundary mode for ${group.groupId}`,
    )
    if (!group.policy.boundaryModeCandidates.includes(mode)) {
      throw new Error(`Signature construction boundary mode is not allowed for ${group.groupId}`)
    }
    const crossfadeSeconds = requireNumber(
      boundary.crossfadeSeconds,
      `Signature construction boundary crossfade for ${group.groupId}`,
    )
    cadenceBoundary = { mode, crossfadeSeconds }
  } else if (rawBoundary !== undefined && rawBoundary !== null) {
    throw new Error(`Signature construction boundary is not supported for ${group.groupId}`)
  }
  const constructionPolicy = validateSignatureSoundConstructionPlaybackPolicy(
    group.strategyId,
    group.previewSettings,
    {
      minimumSelectionsBeforeRepeat: group.policy.minimumSelectionsBeforeRepeat,
      transitionDurationRange: group.policy.transitionDurationRange,
      cadenceBoundary,
      overlapNextEvent: group.policy.overlapNextEvent,
    },
  )
  return copy({
    includedSourceIds: group.includedSourceIds,
    previewSettings: group.previewSettings,
    constructionPolicy,
  })
}

/** Produces the exact identity used by both playback evidence and decisions. */
export function createSignatureSoundConstructionAuditionKey(rawAudition, groupId, rawConfiguration) {
  const audition = normalizeAudition(rawAudition)
  const group = requireGroup(audition, groupId)
  const configuration = normalizeConfiguration(group, rawConfiguration)
  return [
    "construction-v1",
    audition.constructionReviewSha256,
    audition.algorithmVersion,
    group.groupId,
    group.strategyId,
    JSON.stringify(configuration.previewSettings),
    JSON.stringify(configuration.constructionPolicy),
    configuration.includedSourceIds.join(","),
  ].join("|")
}

/** Validates browser-local construction QA against the exact current projection. */
export function validateSignatureSoundConstructionQa(rawQa, rawAudition) {
  const audition = normalizeAudition(rawAudition)
  const qa = requireRecord(rawQa, "Signature construction QA")
  assertOnlyFields(qa, QA_FIELDS, "Signature construction QA")
  if (qa.version !== 1) throw new Error("Unsupported Signature construction QA version")
  const constructionReviewSha256 = requireSha256(
    qa.constructionReviewSha256,
    "Signature construction QA fingerprint",
  )
  if (constructionReviewSha256 !== audition.constructionReviewSha256) {
    throw new Error("Signature construction QA fingerprint does not match the audition")
  }
  const algorithmVersion = requireTrimmedString(
    qa.algorithmVersion,
    "Signature construction QA algorithm",
  )
  if (algorithmVersion !== audition.algorithmVersion) {
    throw new Error("Signature construction QA algorithm does not match the audition")
  }
  const groups = {}
  const rawGroups = requireRecord(qa.groups, "Signature construction QA groups")
  for (const groupId of Object.keys(rawGroups).sort(compareText)) {
    const group = requireGroup(audition, groupId)
    groups[groupId] = normalizeQaEntry(rawGroups[groupId], audition, group)
  }
  return copy({
    version: 1,
    constructionReviewSha256,
    algorithmVersion,
    updatedAt: requireIsoTimestamp(qa.updatedAt, "Signature construction QA update time"),
    groups,
  })
}

/** Persists a note without fabricating audible evidence. */
export function updateSignatureSoundConstructionQaNote(rawQa, rawAudition, rawUpdate) {
  const audition = normalizeAudition(rawAudition)
  const qa = validateSignatureSoundConstructionQa(rawQa, audition)
  const update = requireRecord(rawUpdate, "Signature construction QA note update")
  assertOnlyFields(update, new Set(["groupId", "note", "updatedAt"]), "Signature construction QA note update")
  const group = requireGroup(audition, update.groupId)
  qa.groups[group.groupId] = {
    ...(qa.groups[group.groupId] ?? {}),
    note: requireString(update.note, `Signature construction QA note for ${group.groupId}`),
  }
  qa.updatedAt = requireIsoTimestamp(update.updatedAt, "Signature construction QA update time")
  return validateSignatureSoundConstructionQa(qa, audition)
}

/**
 * Records successful playback of an exact configuration and clears an older
 * decision so a changed A/B setup can never inherit approval.
 */
export function recordSignatureSoundConstructionQaAudition(rawQa, rawAudition, rawUpdate) {
  const audition = normalizeAudition(rawAudition)
  const qa = validateSignatureSoundConstructionQa(rawQa, audition)
  const update = requireRecord(rawUpdate, "Signature construction QA audition update")
  assertOnlyFields(
    update,
    new Set(["groupId", "configuration", "auditionedAt"]),
    "Signature construction QA audition update",
  )
  const group = requireGroup(audition, update.groupId)
  if (group.status === "blocked") throw new Error(`Signature construction group ${group.groupId} is blocked`)
  const configuration = normalizeConfiguration(group, update.configuration)
  const auditionedAt = requireIsoTimestamp(
    update.auditionedAt,
    `Signature construction QA audition time for ${group.groupId}`,
  )
  qa.groups[group.groupId] = {
    note: qa.groups[group.groupId]?.note ?? "",
    auditionedAt,
    auditionKey: createSignatureSoundConstructionAuditionKey(audition, group.groupId, configuration),
    configuration,
  }
  qa.updatedAt = auditionedAt
  return validateSignatureSoundConstructionQa(qa, audition)
}

/** Clears stale heard evidence and judgment after a configuration control changes. */
export function clearSignatureSoundConstructionQaAudition(rawQa, rawAudition, rawUpdate) {
  const audition = normalizeAudition(rawAudition)
  const qa = validateSignatureSoundConstructionQa(rawQa, audition)
  const update = requireRecord(rawUpdate, "Signature construction QA clear update")
  assertOnlyFields(update, new Set(["groupId", "updatedAt"]), "Signature construction QA clear update")
  const group = requireGroup(audition, update.groupId)
  const existing = qa.groups[group.groupId]
  if (existing) qa.groups[group.groupId] = { note: existing.note }
  qa.updatedAt = requireIsoTimestamp(update.updatedAt, "Signature construction QA update time")
  return validateSignatureSoundConstructionQa(qa, audition)
}

/**
 * Adds an exact-heard approval or a note-backed negative triage decision.
 * Negative triage deliberately carries no QA scope because it does not certify an audition.
 */
export function updateSignatureSoundConstructionQaDecision(rawQa, rawAudition, rawUpdate) {
  const audition = normalizeAudition(rawAudition)
  const qa = validateSignatureSoundConstructionQa(rawQa, audition)
  const update = requireRecord(rawUpdate, "Signature construction QA decision update")
  assertOnlyFields(
    update,
    new Set(["groupId", "decision", "scope", "updatedAt"]),
    "Signature construction QA decision update",
  )
  const group = requireGroup(audition, update.groupId)
  const entry = qa.groups[group.groupId]
  const decision = requireEnum(update.decision, DECISIONS, `Signature construction QA decision for ${group.groupId}`)
  if (!entry?.auditionKey) {
    if (decision === "pass") throw new Error(`Signature construction QA approval for ${group.groupId} requires an audition`)
    if (!entry?.note.trim()) throw new Error(`Signature construction QA negative decision for ${group.groupId} requires a note`)
    if (hasOwn(update, "scope")) {
      throw new Error(`Signature construction QA scope for ${group.groupId} requires an audition`)
    }
    qa.groups[group.groupId] = { ...entry, decision }
  } else {
    const scope = requireEnum(update.scope, QA_SCOPES, `Signature construction QA scope for ${group.groupId}`)
    if (!group.allowedQaScopes.includes(scope)) {
      throw new Error(`Signature construction QA scope for ${group.groupId} must remain playback-only while processing is pending`)
    }
    qa.groups[group.groupId] = { ...entry, decision, scope }
  }
  qa.updatedAt = requireIsoTimestamp(update.updatedAt, "Signature construction QA update time")
  return validateSignatureSoundConstructionQa(qa, audition)
}

/** Renders stable, complete handoff JSON without changing browser storage. */
export function renderSignatureSoundConstructionQaJson(rawQa, rawAudition) {
  return `${JSON.stringify(validateSignatureSoundConstructionQa(rawQa, rawAudition), null, 2)}\n`
}

function normalizeAudition(rawAudition) {
  const audition = requireRecord(rawAudition, "Signature construction audition")
  assertOnlyFields(audition, AUDITION_FIELDS, "Signature construction audition")
  if (audition.version !== 1) throw new Error("Unsupported Signature construction audition version")
  if (!Array.isArray(audition.groups)) throw new Error("Signature construction audition groups must be an array")
  const groups = audition.groups.map((group, index) => normalizeGroup(
    group,
    `Signature construction audition group at index ${index}`,
  ))
  if (new Set(groups.map(({ groupId }) => groupId)).size !== groups.length) {
    throw new Error("Signature construction audition contains a duplicate group")
  }
  return {
    version: 1,
    algorithmVersion: requireTrimmedString(audition.algorithmVersion, "Signature construction audition algorithm"),
    constructionReviewSha256: requireSha256(
      audition.constructionReviewSha256,
      "Signature construction audition fingerprint",
    ),
    groups,
  }
}

function normalizeGroup(rawGroup, label) {
  const group = requireRecord(rawGroup, label)
  assertOnlyFields(group, GROUP_FIELDS, label)
  const groupId = requireTrimmedString(group.groupId, `${label} id`)
  const strategyId = requireTrimmedString(group.strategyId, `${label} strategy`)
  const includedSourceIds = normalizeSha256Array(group.includedSourceIds, `${label} included sources`)
  const previewSettings = validateSignatureSoundPreviewSettings(strategyId, group.previewSettings)
  const policy = requireRecord(group.policy, `${label} policy`)
  assertOnlyFields(policy, POLICY_FIELDS, `${label} policy`)
  const boundaryModeCandidates = normalizeEnumArray(
    policy.boundaryModeCandidates,
    BOUNDARY_MODES,
    `${label} boundary modes`,
  )
  if (boundaryModeCandidates.length > 0 && strategyId !== "walking-cadence-sequence") {
    throw new Error(`${label} boundary modes require walking cadence`)
  }
  const status = requireEnum(group.status, STATUSES, `${label} status`)
  const allowedQaScopes = normalizeEnumArray(group.allowedQaScopes, QA_SCOPES, `${label} QA scopes`)
  const expectedScopes = status === "blocked"
    ? []
    : status === "processing-pending"
      ? ["playback-only"]
      : ["playback-only", "complete-construction"]
  if (!sameArray(allowedQaScopes, expectedScopes)) throw new Error(`${label} QA scopes do not match its status`)
  return {
    groupId,
    label: requireTrimmedString(group.label, `${label} label`),
    strategyId,
    includedSourceIds,
    previewSettings,
    policy: {
      minimumSelectionsBeforeRepeat: normalizeNullableInteger(
        policy.minimumSelectionsBeforeRepeat,
        `${label} repeat window`,
      ),
      transitionDurationRange: normalizeTransitionRange(policy.transitionDurationRange, `${label} transition range`),
      boundaryModeCandidates,
      overlapNextEvent: requireBoolean(policy.overlapNextEvent, `${label} overlap-next-event`),
    },
    processingIntentIds: normalizeStringArray(group.processingIntentIds, `${label} processing intents`),
    noteDispositionIds: normalizeStringArray(group.noteDispositionIds, `${label} note dispositions`),
    reviewState: requireTrimmedString(group.reviewState, `${label} review state`),
    status,
    blockers: normalizeStringArray(group.blockers, `${label} blockers`),
    allowedQaScopes,
  }
}

function normalizeQaEntry(rawEntry, audition, group) {
  const entry = requireRecord(rawEntry, `Signature construction QA group ${group.groupId}`)
  assertOnlyFields(entry, QA_ENTRY_FIELDS, `Signature construction QA group ${group.groupId}`)
  const normalized = { note: requireString(entry.note, `Signature construction QA note for ${group.groupId}`) }
  const evidenceFields = ["auditionedAt", "auditionKey", "configuration"]
  const evidenceCount = evidenceFields.filter((field) => hasOwn(entry, field)).length
  if (evidenceCount !== 0 && evidenceCount !== evidenceFields.length) {
    throw new Error(`Signature construction QA audition for ${group.groupId} is incomplete`)
  }
  if (evidenceCount === evidenceFields.length) {
    if (group.status === "blocked") throw new Error(`Signature construction group ${group.groupId} is blocked`)
    normalized.auditionedAt = requireIsoTimestamp(
      entry.auditionedAt,
      `Signature construction QA audition time for ${group.groupId}`,
    )
    normalized.configuration = normalizeConfiguration(group, entry.configuration)
    normalized.auditionKey = requireTrimmedString(
      entry.auditionKey,
      `Signature construction QA audition key for ${group.groupId}`,
    )
    if (normalized.auditionKey !== createSignatureSoundConstructionAuditionKey(
      audition,
      group.groupId,
      normalized.configuration,
    )) {
      throw new Error(`Signature construction QA audition for ${group.groupId} is stale`)
    }
  }
  const hasDecision = hasOwn(entry, "decision")
  const hasScope = hasOwn(entry, "scope")
  if (hasScope && !hasDecision) throw new Error(`Signature construction QA scope for ${group.groupId} requires a decision`)
  if (hasDecision) {
    normalized.decision = requireEnum(entry.decision, DECISIONS, `Signature construction QA decision for ${group.groupId}`)
    if (!normalized.auditionKey) {
      if (normalized.decision === "pass") {
        throw new Error(`Signature construction QA approval for ${group.groupId} requires an audition`)
      }
      if (!normalized.note.trim()) {
        throw new Error(`Signature construction QA negative decision for ${group.groupId} requires a note`)
      }
      if (hasScope) throw new Error(`Signature construction QA scope for ${group.groupId} requires an audition`)
      return normalized
    }
    if (!hasScope) throw new Error(`Signature construction QA decision for ${group.groupId} requires a scope`)
    normalized.scope = requireEnum(entry.scope, QA_SCOPES, `Signature construction QA scope for ${group.groupId}`)
    if (!group.allowedQaScopes.includes(normalized.scope)) {
      throw new Error(`Signature construction QA scope for ${group.groupId} is not allowed while processing is pending`)
    }
  }
  return normalized
}

function normalizeConfiguration(group, rawConfiguration) {
  const configuration = requireRecord(rawConfiguration, `Signature construction configuration for ${group.groupId}`)
  assertOnlyFields(configuration, CONFIGURATION_FIELDS, `Signature construction configuration for ${group.groupId}`)
  const includedSourceIds = normalizeSha256Array(
    configuration.includedSourceIds,
    `Signature construction configuration sources for ${group.groupId}`,
  )
  if (!sameArray(includedSourceIds, group.includedSourceIds)) {
    throw new Error(`Signature construction configuration sources for ${group.groupId} do not match`)
  }
  const previewSettings = validateSignatureSoundPreviewSettings(group.strategyId, configuration.previewSettings)
  if (JSON.stringify(previewSettings) !== JSON.stringify(group.previewSettings)) {
    throw new Error(`Signature construction configuration settings for ${group.groupId} do not match`)
  }
  const constructionPolicy = validateSignatureSoundConstructionPlaybackPolicy(
    group.strategyId,
    previewSettings,
    configuration.constructionPolicy,
  )
  const expectedStaticPolicy = {
    minimumSelectionsBeforeRepeat: group.policy.minimumSelectionsBeforeRepeat,
    transitionDurationRange: group.policy.transitionDurationRange,
    overlapNextEvent: group.policy.overlapNextEvent,
  }
  for (const [field, expected] of Object.entries(expectedStaticPolicy)) {
    if (JSON.stringify(constructionPolicy[field]) !== JSON.stringify(expected)) {
      throw new Error(`Signature construction configuration policy ${field} for ${group.groupId} does not match`)
    }
  }
  const boundary = constructionPolicy.cadenceBoundary
  if (group.policy.boundaryModeCandidates.length === 0 && boundary !== null) {
    throw new Error(`Signature construction boundary is not supported for ${group.groupId}`)
  }
  if (group.policy.boundaryModeCandidates.length > 0) {
    if (!boundary || !group.policy.boundaryModeCandidates.includes(boundary.mode)) {
      throw new Error(`Signature construction boundary mode for ${group.groupId} does not match`)
    }
  }
  return copy({ includedSourceIds, previewSettings, constructionPolicy })
}

function requireGroup(audition, rawGroupId) {
  const groupId = requireTrimmedString(rawGroupId, "Signature construction QA group id")
  const group = audition.groups.find((candidate) => candidate.groupId === groupId)
  if (!group) throw new Error(`Unknown Signature construction QA group: ${groupId}`)
  return group
}

function normalizeSha256Array(rawValues, label) {
  if (!Array.isArray(rawValues) || rawValues.length === 0) throw new Error(`${label} must be a non-empty array`)
  const values = rawValues.map((value, index) => requireSha256(value, `${label} at index ${index}`)).sort(compareText)
  if (new Set(values).size !== values.length) throw new Error(`${label} contains a duplicate`)
  return values
}

function normalizeStringArray(rawValues, label) {
  if (!Array.isArray(rawValues)) throw new Error(`${label} must be an array`)
  const values = rawValues.map((value, index) => requireTrimmedString(value, `${label} at index ${index}`))
  if (new Set(values).size !== values.length) throw new Error(`${label} contains a duplicate`)
  return values
}

function normalizeEnumArray(rawValues, allowed, label) {
  if (!Array.isArray(rawValues)) throw new Error(`${label} must be an array`)
  const values = rawValues.map((value, index) => requireEnum(value, allowed, `${label} at index ${index}`))
  if (new Set(values).size !== values.length) throw new Error(`${label} contains a duplicate`)
  return values
}

function normalizeTransitionRange(rawRange, label) {
  if (rawRange === null) return null
  const range = requireRecord(rawRange, label)
  assertOnlyFields(range, new Set(["minimumSeconds", "maximumSeconds"]), label)
  return {
    minimumSeconds: requireNumber(range.minimumSeconds, `${label} minimum`),
    maximumSeconds: requireNumber(range.maximumSeconds, `${label} maximum`),
  }
}

function normalizeNullableInteger(value, label) {
  if (value === null) return null
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer or null`)
  return value
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

function requireNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`)
  return value
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`)
  return value
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field)
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en") || left.localeCompare(right, "en")
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
