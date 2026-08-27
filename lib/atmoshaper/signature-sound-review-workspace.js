import { validateSignatureSoundGroupReview } from "./signature-sound-group-review.js"
import {
  createSignatureSoundExactPreviewAuditionKey,
  defaultSignatureSoundPreviewSettings,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"

const WORKSPACE_FIELDS = new Set([
  "version", "fingerprints", "updatedAt", "customConcepts", "recordings", "groups",
])
const FINGERPRINT_FIELDS = new Set(["discoveryReviewSha256", "curationSha256"])
const CUSTOM_CONCEPT_FIELDS = new Set(["label"])
const RECORDING_FIELDS = new Set(["decision", "note", "concepts"])
const CONCEPT_ENTRY_FIELDS = new Set(["decision", "note"])
const GROUP_FIELDS = new Set([
  "decision", "strategyId", "previewSettings", "auditionedAt", "auditionKey", "note",
])
const RECORDING_DECISIONS = new Set(["keep", "maybe", "reject"])
const CONCEPT_DECISIONS = new Set(["include", "remove"])
const GROUP_DECISIONS = new Set(["approve", "change"])
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const CUSTOM_CONCEPT_PATTERN = /^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Migrates the two legacy browser drafts into one sparse v3 workspace without
 * mutating or retiring either legacy payload.
 */
export function migrateSignatureSoundReviewWorkspace(rawInput) {
  const input = requireRecord(rawInput, "Signature review workspace migration input")
  const baseline = buildBaseline(input)
  const workspace = {
    version: 3,
    fingerprints: {
      discoveryReviewSha256: baseline.discoveryFingerprint,
      curationSha256: baseline.curationFingerprint,
    },
    updatedAt: requireIsoTimestamp(input.updatedAt, "Signature review workspace migration time"),
    customConcepts: {},
    recordings: {},
    groups: {},
  }

  if (input.legacyRecordingReview !== undefined) {
    migrateLegacyRecordingReview(workspace, input.legacyRecordingReview, baseline)
  }
  if (input.legacyGroupReview !== undefined) {
    migrateLegacyGroupReview(workspace, input.legacyGroupReview, baseline)
  }
  return normalizeWorkspace(workspace, baseline)
}

/**
 * Migrates each legacy payload independently so one corrupt draft cannot hide
 * the other valid draft. Returned warning codes contain no user content.
 */
export function migrateSignatureSoundReviewWorkspaceSafely(rawInput) {
  const input = requireRecord(rawInput, "Safe Signature review workspace migration input")
  const common = {
    discoveryReview: input.discoveryReview,
    curatedReview: input.curatedReview,
    updatedAt: input.updatedAt,
  }
  const baseline = buildBaseline(common)
  let workspace = migrateSignatureSoundReviewWorkspace(common)
  const warnings = []
  if (input.legacyRecordingReview !== undefined) {
    try {
      workspace = mergeMigratedWorkspace(workspace, migrateSignatureSoundReviewWorkspace({
        ...common,
        legacyRecordingReview: input.legacyRecordingReview,
      }), baseline)
    } catch {
      warnings.push("legacy-recording-review")
    }
  }
  if (input.legacyGroupReview !== undefined) {
    try {
      workspace = mergeMigratedWorkspace(workspace, migrateSignatureSoundReviewWorkspace({
        ...common,
        legacyGroupReview: input.legacyGroupReview,
      }), baseline)
    } catch {
      warnings.push("legacy-group-review")
    }
  }
  return copy({ workspace: normalizeWorkspace(workspace, baseline), warnings })
}

/** Returns the sole v3 browser key for the two immutable baseline identities. */
export function createSignatureSoundReviewWorkspaceStorageKey(rawBaselines) {
  const baseline = buildBaseline(rawBaselines)
  return `atmoshaper-signature-review-workspace-v3:${baseline.discoveryFingerprint}:${baseline.curationFingerprint}`
}

/** Validates and normalizes one v3 workspace against immutable review inputs. */
export function validateSignatureSoundReviewWorkspace(rawWorkspace, rawBaselines) {
  return normalizeWorkspace(rawWorkspace, buildBaseline(rawBaselines))
}

/** Returns deterministic, closed JSON for the complete local review handoff. */
export function renderSignatureSoundReviewWorkspaceJson(rawWorkspace, rawBaselines) {
  return `${JSON.stringify(validateSignatureSoundReviewWorkspace(rawWorkspace, rawBaselines), null, 2)}\n`
}

/** Projects sparse v3 edits into complete recording and concept review views. */
export function createSignatureSoundReviewProjection(rawWorkspace, rawBaselines) {
  const baseline = buildBaseline(rawBaselines)
  const workspace = normalizeWorkspace(rawWorkspace, baseline)
  const concepts = createConcepts(workspace, baseline)
  const groups = concepts.map((concept) => projectGroup(concept, workspace, baseline))
  const groupById = new Map(groups.map((group) => [group.groupId, group]))
  const recordings = [...baseline.sourceById.values()].map((source) => {
    const override = workspace.recordings[source.sourceId]
    const conceptIds = new Set(source.groupIds)
    for (const groupId of Object.keys(override?.concepts ?? {})) conceptIds.add(groupId)
    return {
      ...copy(source.raw),
      overallDecision: override?.decision ?? baseline.decisionBySourceId.get(source.sourceId)?.decision ?? null,
      overallNote: hasOwn(override ?? {}, "note")
        ? override.note
        : baseline.decisionBySourceId.get(source.sourceId)?.note ?? "",
      concepts: [...conceptIds].sort(compareText).map((groupId) => {
        const ingredient = groupById.get(groupId)?.ingredients.find(({ sourceId }) => sourceId === source.sourceId)
        return ingredient ? { groupId, decision: ingredient.decision, note: ingredient.note } : null
      }).filter(Boolean),
    }
  })
  return copy({ concepts, recordings, groups })
}

/** Updates the overall observation for one known recording without changing concept membership. */
export function updateSignatureSoundRecording(rawWorkspace, rawBaselines, rawUpdate) {
  const baseline = buildBaseline(rawBaselines)
  const workspace = normalizeWorkspace(rawWorkspace, baseline)
  const update = requireRecord(rawUpdate, "Signature recording workspace update")
  assertOnlyFields(update, new Set(["sourceId", "decision", "note", "updatedAt"]), "Signature recording workspace update")
  const sourceId = requireSha256(update.sourceId, "Signature recording workspace update source")
  if (!baseline.sourceById.has(sourceId)) throw new Error(`Unknown Signature recording workspace source: ${sourceId}`)
  const current = workspace.recordings[sourceId] ?? { concepts: {} }
  workspace.recordings[sourceId] = {
    ...current,
    concepts: { ...current.concepts },
  }
  if (hasOwn(update, "decision")) {
    workspace.recordings[sourceId].decision = requireEnum(
      update.decision,
      RECORDING_DECISIONS,
      `Signature recording ${sourceId} decision`,
    )
  }
  if (hasOwn(update, "note")) {
    workspace.recordings[sourceId].note = requireString(update.note, `Signature recording ${sourceId} note`)
  }
  if (!hasOwn(update, "decision") && !hasOwn(update, "note")) {
    throw new Error("Signature recording workspace update needs a decision or note")
  }
  workspace.updatedAt = requireIsoTimestamp(update.updatedAt, "Signature recording workspace update time")
  return normalizeWorkspace(workspace, baseline)
}

/** Updates one recording only inside one concept and invalidates audio-changing review evidence. */
export function updateSignatureSoundConceptAssignment(rawWorkspace, rawBaselines, rawUpdate) {
  const baseline = buildBaseline(rawBaselines)
  const workspace = normalizeWorkspace(rawWorkspace, baseline)
  const update = requireRecord(rawUpdate, "Signature concept assignment update")
  assertOnlyFields(
    update,
    new Set(["sourceId", "groupId", "decision", "note", "updatedAt"]),
    "Signature concept assignment update",
  )
  const sourceId = requireSha256(update.sourceId, "Signature concept assignment source")
  if (!baseline.sourceById.has(sourceId)) throw new Error(`Unknown Signature concept assignment source: ${sourceId}`)
  const groupId = requireTrimmedString(update.groupId, "Signature concept assignment group")
  if (!baseline.groupById.has(groupId) && !hasOwn(workspace.customConcepts, groupId)) {
    throw new Error(`Unknown Signature concept assignment group: ${groupId}`)
  }
  const decision = requireEnum(update.decision, CONCEPT_DECISIONS, "Signature concept assignment decision")
  const currentDecision = getIngredients(groupId, workspace, baseline)
    .find((ingredient) => ingredient.sourceId === sourceId)?.decision
  const recording = workspace.recordings[sourceId] ?? { concepts: {} }
  recording.concepts = {
    ...recording.concepts,
    [groupId]: {
      decision,
      note: requireString(update.note, "Signature concept assignment note"),
    },
  }
  workspace.recordings[sourceId] = recording
  if (currentDecision !== decision && workspace.groups[groupId]) {
    delete workspace.groups[groupId].decision
    delete workspace.groups[groupId].auditionedAt
    delete workspace.groups[groupId].auditionKey
  }
  workspace.updatedAt = requireIsoTimestamp(update.updatedAt, "Signature concept assignment update time")
  return normalizeWorkspace(workspace, baseline)
}

/** Creates one local concept and includes the current recording immediately. */
export function addSignatureSoundCustomConcept(rawWorkspace, rawBaselines, rawUpdate) {
  const baseline = buildBaseline(rawBaselines)
  const workspace = normalizeWorkspace(rawWorkspace, baseline)
  const update = requireRecord(rawUpdate, "Custom Signature concept update")
  assertOnlyFields(update, new Set(["sourceId", "label", "updatedAt"]), "Custom Signature concept update")
  const sourceId = requireSha256(update.sourceId, "Custom Signature concept source")
  if (!baseline.sourceById.has(sourceId)) throw new Error(`Unknown custom Signature concept source: ${sourceId}`)
  const label = requireTrimmedString(update.label, "Custom Signature concept label")
  const existingLabels = new Set([
    ...[...baseline.groupById.values()].map((group) => group.label.toLowerCase()),
    ...Object.values(workspace.customConcepts).map((concept) => concept.label.toLowerCase()),
  ])
  if (existingLabels.has(label.toLowerCase())) throw new Error(`Duplicate Signature concept label: ${label}`)
  const baseId = `custom:${slugifyConceptLabel(label)}`
  const knownIds = new Set([...baseline.groupById.keys(), ...Object.keys(workspace.customConcepts)])
  let groupId = baseId
  let suffix = 2
  while (knownIds.has(groupId)) {
    groupId = `${baseId}-${suffix}`
    suffix += 1
  }
  workspace.customConcepts[groupId] = { label }
  workspace.groups[groupId] = {
    strategyId: "adaptive-whole-source-sequence",
    previewSettings: defaultSignatureSoundPreviewSettings("adaptive-whole-source-sequence"),
    note: "",
  }
  const recording = workspace.recordings[sourceId] ?? { concepts: {} }
  recording.concepts = {
    ...recording.concepts,
    [groupId]: { decision: "include", note: "" },
  }
  workspace.recordings[sourceId] = recording
  workspace.updatedAt = requireIsoTimestamp(update.updatedAt, "Custom Signature concept update time")
  return { groupId, workspace: normalizeWorkspace(workspace, baseline) }
}

/** Updates concept-level strategy, listening evidence, decision, or notes in the shared workspace. */
export function updateSignatureSoundGroup(rawWorkspace, rawBaselines, rawUpdate) {
  const baseline = buildBaseline(rawBaselines)
  const workspace = normalizeWorkspace(rawWorkspace, baseline)
  const update = requireRecord(rawUpdate, "Signature group workspace update")
  assertOnlyFields(
    update,
    new Set([
      "groupId", "decision", "strategyId", "previewSettings", "auditionedAt", "auditionKey", "note", "updatedAt",
    ]),
    "Signature group workspace update",
  )
  const groupId = requireTrimmedString(update.groupId, "Signature group workspace update group")
  if (!baseline.groupById.has(groupId) && !hasOwn(workspace.customConcepts, groupId)) {
    throw new Error(`Unknown Signature group workspace group: ${groupId}`)
  }
  const baselineGroup = baseline.groupById.get(groupId)
  const current = workspace.groups[groupId] ?? {
    strategyId: baselineGroup?.strategyId ?? "adaptive-whole-source-sequence",
    previewSettings: defaultSignatureSoundPreviewSettings(
      baselineGroup?.strategyId ?? "adaptive-whole-source-sequence",
    ),
    note: "",
  }
  const next = copy(current)
  const nextStrategyId = hasOwn(update, "strategyId")
    ? requireTrimmedString(update.strategyId, "Signature group workspace strategy")
    : current.strategyId
  if (!baseline.strategyIds.has(nextStrategyId)) throw new Error(`Unknown Signature review workspace strategy: ${nextStrategyId}`)
  const nextPreviewSettings = hasOwn(update, "previewSettings")
    ? validateSignatureSoundPreviewSettings(nextStrategyId, update.previewSettings)
    : nextStrategyId === current.strategyId
      ? copy(current.previewSettings)
      : defaultSignatureSoundPreviewSettings(nextStrategyId)
  const configurationChanged = nextStrategyId !== current.strategyId
    || JSON.stringify(nextPreviewSettings) !== JSON.stringify(current.previewSettings)
  next.strategyId = nextStrategyId
  next.previewSettings = nextPreviewSettings
  if (hasOwn(update, "note")) next.note = requireString(update.note, `Signature review group ${groupId} note`)
  if (configurationChanged) {
    delete next.decision
    delete next.auditionedAt
    delete next.auditionKey
  }
  const hasAuditionedAt = hasOwn(update, "auditionedAt")
  const hasAuditionKey = hasOwn(update, "auditionKey")
  if (hasAuditionedAt !== hasAuditionKey) throw new Error(`Signature review group ${groupId} audition evidence is incomplete`)
  if (hasAuditionedAt) {
    next.auditionedAt = requireIsoTimestamp(update.auditionedAt, `Signature review group ${groupId} audition time`)
    next.auditionKey = requireTrimmedString(update.auditionKey, `Signature review group ${groupId} audition key`)
  }
  if (hasOwn(update, "decision")) {
    next.decision = requireEnum(update.decision, GROUP_DECISIONS, `Signature review group ${groupId} decision`)
  }
  workspace.groups[groupId] = next
  workspace.updatedAt = requireIsoTimestamp(update.updatedAt, "Signature group workspace update time")
  return normalizeWorkspace(workspace, baseline)
}

function migrateLegacyRecordingReview(workspace, rawReview, baseline) {
  const review = requireRecord(rawReview, "Legacy Signature recording review")
  assertOnlyFields(
    review,
    new Set(["version", "reviewFingerprint", "updatedAt", "decisions"]),
    "Legacy Signature recording review",
  )
  if (review.version !== 1) throw new Error("Unsupported legacy Signature recording review version")
  if (requireSha256(review.reviewFingerprint, "Legacy Signature recording review fingerprint") !== baseline.discoveryFingerprint) {
    throw new Error("Legacy Signature recording review fingerprint does not match discovery")
  }
  requireIsoTimestamp(review.updatedAt, "Legacy Signature recording review update time")
  const decisions = requireRecord(review.decisions, "Legacy Signature recording review decisions")
  for (const sourceId of Object.keys(decisions).sort(compareText)) {
    if (!baseline.sourceById.has(sourceId)) throw new Error(`Unknown legacy Signature recording source: ${sourceId}`)
    const rawEntry = requireRecord(decisions[sourceId], `Legacy Signature recording ${sourceId}`)
    assertOnlyFields(rawEntry, new Set(["decision", "note"]), `Legacy Signature recording ${sourceId}`)
    const entry = {
      note: requireString(rawEntry.note, `Legacy Signature recording ${sourceId} note`),
      concepts: {},
    }
    if (hasOwn(rawEntry, "decision")) {
      entry.decision = requireEnum(
        rawEntry.decision,
        RECORDING_DECISIONS,
        `Legacy Signature recording ${sourceId} decision`,
      )
    }
    workspace.recordings[sourceId] = entry
  }
}

function migrateLegacyGroupReview(workspace, rawReview, baseline) {
  const review = validateSignatureSoundGroupReview(rawReview, baseline.curatedReview)
  for (const groupId of Object.keys(review.groups).sort(compareText)) {
    const legacyEntry = review.groups[groupId]
    if (legacyEntry.sourcePool === "keep-only") {
      for (const sourceId of baseline.sourceIdsByGroup.get(groupId) ?? []) {
        if (baseline.decisionBySourceId.get(sourceId)?.decision !== "maybe") continue
        const recording = workspace.recordings[sourceId] ?? { concepts: {} }
        recording.concepts = {
          ...recording.concepts,
          [groupId]: { decision: "remove", note: "" },
        }
        workspace.recordings[sourceId] = recording
      }
    }
    const groupEntry = {
      strategyId: legacyEntry.strategyId,
      previewSettings: copy(legacyEntry.previewSettings),
      note: legacyEntry.note,
    }
    if (legacyEntry.auditionedAt) {
      const includedSourceIds = getIncludedSourceIds(groupId, workspace, baseline)
      groupEntry.auditionedAt = legacyEntry.auditionedAt
      groupEntry.auditionKey = createSignatureSoundExactPreviewAuditionKey({
        strategyId: groupEntry.strategyId,
        previewSettings: groupEntry.previewSettings,
        includedSourceIds,
      })
    }
    if (legacyEntry.decision) groupEntry.decision = legacyEntry.decision
    workspace.groups[groupId] = groupEntry
  }
}

function mergeMigratedWorkspace(current, incoming, baseline) {
  const merged = copy(current)
  for (const [sourceId, incomingEntry] of Object.entries(incoming.recordings)) {
    const currentEntry = merged.recordings[sourceId] ?? { concepts: {} }
    const entry = {
      ...currentEntry,
      concepts: { ...currentEntry.concepts, ...incomingEntry.concepts },
    }
    if (hasOwn(incomingEntry, "decision")) entry.decision = incomingEntry.decision
    if (hasOwn(incomingEntry, "note")) entry.note = incomingEntry.note
    merged.recordings[sourceId] = entry
  }
  merged.groups = { ...merged.groups, ...copy(incoming.groups) }
  return normalizeWorkspace(merged, baseline)
}

function normalizeWorkspace(rawWorkspace, baseline) {
  const workspace = requireRecord(rawWorkspace, "Signature review workspace")
  assertOnlyFields(workspace, WORKSPACE_FIELDS, "Signature review workspace")
  if (workspace.version !== 3) throw new Error("Unsupported Signature review workspace version")
  const fingerprints = requireRecord(workspace.fingerprints, "Signature review workspace fingerprints")
  assertOnlyFields(fingerprints, FINGERPRINT_FIELDS, "Signature review workspace fingerprints")
  const discoveryReviewSha256 = requireSha256(
    fingerprints.discoveryReviewSha256,
    "Signature review workspace discovery fingerprint",
  )
  const curationSha256 = requireSha256(fingerprints.curationSha256, "Signature review workspace curation fingerprint")
  if (discoveryReviewSha256 !== baseline.discoveryFingerprint) {
    throw new Error("Signature review workspace discovery fingerprint does not match")
  }
  if (curationSha256 !== baseline.curationFingerprint) {
    throw new Error("Signature review workspace curation fingerprint does not match")
  }

  const normalized = {
    version: 3,
    fingerprints: { discoveryReviewSha256, curationSha256 },
    updatedAt: requireIsoTimestamp(workspace.updatedAt, "Signature review workspace update time"),
    customConcepts: normalizeCustomConcepts(workspace.customConcepts, baseline),
    recordings: {},
    groups: {},
  }
  const knownGroupIds = new Set([...baseline.groupById.keys(), ...Object.keys(normalized.customConcepts)])
  normalizeRecordings(workspace.recordings, normalized, knownGroupIds, baseline)
  normalizeGroups(workspace.groups, normalized, knownGroupIds, baseline)
  return copy(normalized)
}

function normalizeCustomConcepts(rawConcepts, baseline) {
  const concepts = requireRecord(rawConcepts, "Signature review workspace custom concepts")
  const normalized = {}
  const labels = new Set([...baseline.groupById.values()].map(({ label }) => label.trim().toLowerCase()))
  for (const groupId of Object.keys(concepts).sort(compareText)) {
    if (!CUSTOM_CONCEPT_PATTERN.test(groupId)) throw new Error(`Invalid custom Signature concept id: ${groupId}`)
    const rawConcept = requireRecord(concepts[groupId], `Custom Signature concept ${groupId}`)
    assertOnlyFields(rawConcept, CUSTOM_CONCEPT_FIELDS, `Custom Signature concept ${groupId}`)
    const label = requireTrimmedString(rawConcept.label, `Custom Signature concept ${groupId} label`)
    const folded = label.toLowerCase()
    if (labels.has(folded)) throw new Error(`Duplicate Signature concept label: ${label}`)
    labels.add(folded)
    normalized[groupId] = { label }
  }
  return normalized
}

function normalizeRecordings(rawRecordings, normalized, knownGroupIds, baseline) {
  const recordings = requireRecord(rawRecordings, "Signature review workspace recordings")
  for (const sourceId of Object.keys(recordings).sort(compareText)) {
    if (!baseline.sourceById.has(sourceId)) throw new Error(`Unknown Signature review workspace source: ${sourceId}`)
    const rawEntry = requireRecord(recordings[sourceId], `Signature review workspace recording ${sourceId}`)
    assertOnlyFields(rawEntry, RECORDING_FIELDS, `Signature review workspace recording ${sourceId}`)
    const entry = { concepts: {} }
    if (hasOwn(rawEntry, "decision")) {
      entry.decision = requireEnum(rawEntry.decision, RECORDING_DECISIONS, `Signature recording ${sourceId} decision`)
    }
    if (hasOwn(rawEntry, "note")) entry.note = requireString(rawEntry.note, `Signature recording ${sourceId} note`)
    const concepts = requireRecord(rawEntry.concepts, `Signature recording ${sourceId} concepts`)
    for (const groupId of Object.keys(concepts).sort(compareText)) {
      if (!knownGroupIds.has(groupId)) throw new Error(`Unknown Signature concept or group: ${groupId}`)
      const rawConcept = requireRecord(concepts[groupId], `Signature recording ${sourceId} concept ${groupId}`)
      assertOnlyFields(rawConcept, CONCEPT_ENTRY_FIELDS, `Signature recording ${sourceId} concept ${groupId}`)
      entry.concepts[groupId] = {
        decision: requireEnum(rawConcept.decision, CONCEPT_DECISIONS, `Signature recording ${sourceId} concept decision`),
        note: requireString(rawConcept.note, `Signature recording ${sourceId} concept note`),
      }
    }
    normalized.recordings[sourceId] = entry
  }
}

function normalizeGroups(rawGroups, normalized, knownGroupIds, baseline) {
  const groups = requireRecord(rawGroups, "Signature review workspace groups")
  for (const customGroupId of Object.keys(normalized.customConcepts)) {
    if (!hasOwn(groups, customGroupId)) throw new Error(`Custom Signature concept needs group settings: ${customGroupId}`)
  }
  for (const groupId of Object.keys(groups).sort(compareText)) {
    if (!knownGroupIds.has(groupId)) throw new Error(`Unknown Signature review workspace group: ${groupId}`)
    const rawEntry = requireRecord(groups[groupId], `Signature review workspace group ${groupId}`)
    assertOnlyFields(rawEntry, GROUP_FIELDS, `Signature review workspace group ${groupId}`)
    const strategyId = requireTrimmedString(rawEntry.strategyId, `Signature review workspace group ${groupId} strategy`)
    if (!baseline.strategyIds.has(strategyId)) throw new Error(`Unknown Signature review workspace strategy: ${strategyId}`)
    const previewSettings = validateSignatureSoundPreviewSettings(strategyId, rawEntry.previewSettings)
    const entry = {
      strategyId,
      previewSettings,
      note: requireString(rawEntry.note, `Signature review workspace group ${groupId} note`),
    }
    const hasAuditionedAt = hasOwn(rawEntry, "auditionedAt")
    const hasAuditionKey = hasOwn(rawEntry, "auditionKey")
    if (hasAuditionedAt !== hasAuditionKey) {
      throw new Error(`Signature review workspace group ${groupId} audition evidence is incomplete`)
    }
    if (hasAuditionedAt) {
      entry.auditionedAt = requireIsoTimestamp(rawEntry.auditionedAt, `Signature review group ${groupId} audition time`)
      entry.auditionKey = requireTrimmedString(rawEntry.auditionKey, `Signature review group ${groupId} audition key`)
      const expectedKey = createSignatureSoundExactPreviewAuditionKey({
        strategyId,
        previewSettings,
        includedSourceIds: getIncludedSourceIds(groupId, normalized, baseline),
      })
      if (entry.auditionKey !== expectedKey) throw new Error(`Signature review group ${groupId} audition is stale`)
    }
    if (hasOwn(rawEntry, "decision")) {
      entry.decision = requireEnum(rawEntry.decision, GROUP_DECISIONS, `Signature review group ${groupId} decision`)
      if (entry.decision === "approve" && !hasAuditionedAt) {
        throw new Error(`Signature review group ${groupId} approval requires an audition`)
      }
    }
    normalized.groups[groupId] = entry
  }
}

function buildBaseline(rawBaselines) {
  const baselines = requireRecord(rawBaselines, "Signature review workspace baselines")
  const discoveryReview = requireRecord(baselines.discoveryReview, "Signature discovery review")
  const discoveryFingerprints = requireRecord(discoveryReview.fingerprints, "Signature discovery fingerprints")
  const discoveryFingerprint = requireSha256(
    discoveryFingerprints.reviewSha256,
    "Signature discovery review fingerprint",
  )
  if (!Array.isArray(discoveryReview.sources)) throw new Error("Signature discovery sources must be an array")
  const curatedReview = requireRecord(baselines.curatedReview, "Signature curated review")
  const curatedFingerprints = requireRecord(curatedReview.fingerprints, "Signature curated fingerprints")
  const curationFingerprint = requireSha256(curatedFingerprints.curationSha256, "Signature curation fingerprint")
  if (!Array.isArray(curatedReview.decisions)) throw new Error("Signature curated decisions must be an array")
  if (!Array.isArray(curatedReview.groups)) throw new Error("Signature curated groups must be an array")
  if (!Array.isArray(curatedReview.strategies)) throw new Error("Signature curated strategies must be an array")

  const strategyIds = new Set()
  for (const rawStrategy of curatedReview.strategies) {
    const strategy = requireRecord(rawStrategy, "Signature curated strategy")
    const strategyId = requireTrimmedString(strategy.id, "Signature curated strategy id")
    if (strategyIds.has(strategyId)) throw new Error(`Duplicate Signature curated strategy: ${strategyId}`)
    strategyIds.add(strategyId)
  }
  const groupById = new Map()
  for (const rawGroup of curatedReview.groups) {
    const group = requireRecord(rawGroup, "Signature curated group")
    const groupId = requireTrimmedString(group.groupId, "Signature curated group id")
    if (groupById.has(groupId)) throw new Error(`Duplicate Signature curated group: ${groupId}`)
    groupById.set(groupId, {
      groupId,
      conceptKind: requireTrimmedString(group.conceptKind, `Signature curated group ${groupId} kind`),
      conceptId: requireTrimmedString(group.conceptId, `Signature curated group ${groupId} concept`),
      label: requireTrimmedString(group.label, `Signature curated group ${groupId} label`),
      category: group.category === null ? null : requireTrimmedString(group.category, `Signature curated group ${groupId} category`),
      status: requireTrimmedString(group.status, `Signature curated group ${groupId} status`),
      strategyId: requireTrimmedString(group.strategyId, `Signature curated group ${groupId} strategy`),
    })
  }
  const decisionBySourceId = new Map()
  for (const rawDecision of curatedReview.decisions) {
    const decision = requireRecord(rawDecision, "Signature curated decision")
    const sourceId = requireSha256(decision.sourceId, "Signature curated decision source")
    if (decisionBySourceId.has(sourceId)) throw new Error(`Duplicate Signature curated decision: ${sourceId}`)
    decisionBySourceId.set(sourceId, {
      decision: requireEnum(decision.decision, RECORDING_DECISIONS, `Signature curated decision ${sourceId}`),
      note: requireString(decision.note, `Signature curated decision ${sourceId} note`),
    })
  }
  const sourceById = new Map()
  const sourceIdsByGroup = new Map([...groupById.keys()].map((groupId) => [groupId, []]))
  for (const rawSource of discoveryReview.sources) {
    const source = requireRecord(rawSource, "Signature discovery source")
    const sourceId = requireSha256(source.sourceId, "Signature discovery source id")
    if (sourceById.has(sourceId)) throw new Error(`Duplicate Signature discovery source: ${sourceId}`)
    if (!Array.isArray(source.moodistConcepts) || !Array.isArray(source.signatureExtraConcepts)) {
      throw new Error(`Signature discovery source ${sourceId} concepts must be arrays`)
    }
    const groupIds = [
      ...source.moodistConcepts.map((concept) => `moodist:${requireConceptId(concept, sourceId)}`),
      ...source.signatureExtraConcepts.map((concept) => `signature-extra:${requireConceptId(concept, sourceId)}`),
    ]
    for (const groupId of groupIds) {
      if (!groupById.has(groupId)) throw new Error(`Unknown Signature discovery concept group: ${groupId}`)
      sourceIdsByGroup.get(groupId).push(sourceId)
    }
    sourceById.set(sourceId, { sourceId, groupIds, raw: copy(source) })
  }
  for (const sourceId of decisionBySourceId.keys()) {
    if (!sourceById.has(sourceId)) throw new Error(`Unknown Signature curated decision source: ${sourceId}`)
  }
  for (const sourceIds of sourceIdsByGroup.values()) sourceIds.sort(compareText)
  return {
    discoveryFingerprint,
    curationFingerprint,
    discoveryReview,
    curatedReview,
    strategyIds,
    groupById,
    decisionBySourceId,
    sourceById,
    sourceIdsByGroup,
  }
}

function createConcepts(workspace, baseline) {
  const concepts = [...baseline.groupById.values()].map((group) => ({ ...group }))
  for (const [groupId, concept] of Object.entries(workspace.customConcepts)) {
    concepts.push({
      groupId,
      conceptKind: "custom",
      conceptId: groupId.slice("custom:".length),
      label: concept.label,
      category: null,
      status: "active",
      strategyId: workspace.groups[groupId].strategyId,
    })
  }
  return concepts.sort((left, right) => compareText(left.groupId, right.groupId))
}

function projectGroup(concept, workspace, baseline) {
  const ingredients = getIngredients(concept.groupId, workspace, baseline)
  const stored = workspace.groups[concept.groupId]
  const strategyId = stored?.strategyId ?? concept.strategyId
  const previewSettings = stored?.previewSettings ?? defaultSignatureSoundPreviewSettings(strategyId)
  const group = {
    ...concept,
    strategyId,
    previewSettings,
    note: stored?.note ?? "",
    ingredients,
    includedSourceIds: ingredients.filter(({ decision }) => decision === "include").map(({ sourceId }) => sourceId),
    sourceCounts: {
      total: ingredients.length,
      include: ingredients.filter(({ decision }) => decision === "include").length,
      remove: ingredients.filter(({ decision }) => decision === "remove").length,
    },
  }
  if (stored?.decision) group.decision = stored.decision
  if (stored?.auditionedAt) {
    group.auditionedAt = stored.auditionedAt
    group.auditionKey = stored.auditionKey
  }
  return group
}

function getIngredients(groupId, workspace, baseline) {
  const sourceIds = new Set(baseline.sourceIdsByGroup.get(groupId) ?? [])
  for (const [sourceId, recording] of Object.entries(workspace.recordings)) {
    if (hasOwn(recording.concepts, groupId)) sourceIds.add(sourceId)
  }
  return [...sourceIds].sort(compareText).map((sourceId) => {
    const source = baseline.sourceById.get(sourceId)
    const curated = baseline.decisionBySourceId.get(sourceId)
    const recording = workspace.recordings[sourceId]
    const override = recording?.concepts[groupId]
    return {
      sourceId,
      relativePath: source.raw.relativePath,
      overallDecision: recording?.decision ?? curated?.decision ?? null,
      overallNote: hasOwn(recording ?? {}, "note") ? recording.note : curated?.note ?? "",
      decision: override?.decision ?? (curated?.decision === "keep" || curated?.decision === "maybe" ? "include" : "remove"),
      note: override?.note ?? "",
    }
  })
}

function getIncludedSourceIds(groupId, workspace, baseline) {
  return getIngredients(groupId, workspace, baseline)
    .filter(({ decision }) => decision === "include")
    .map(({ sourceId }) => sourceId)
}

function requireConceptId(rawConcept, sourceId) {
  const concept = requireRecord(rawConcept, `Signature discovery source ${sourceId} concept`)
  return requireTrimmedString(concept.id, `Signature discovery source ${sourceId} concept id`)
}

function slugifyConceptLabel(label) {
  const slug = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "concept"
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

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field)
}

function compareText(left, right) {
  const folded = left.toLowerCase().localeCompare(right.toLowerCase(), "en")
  return folded || left.localeCompare(right, "en")
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
