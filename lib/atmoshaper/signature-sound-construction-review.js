// @ts-check

import { createHash } from "node:crypto"

import { validateSignatureSoundDiscoveryReview } from "./signature-sound-discovery.js"
import { createSignatureSoundConstructionReviewFingerprint } from "./signature-sound-review-fingerprints.js"
import {
  validateSignatureSoundListeningReview,
  validateSignatureSoundPlaybackStrategies,
} from "./signature-sound-listening-review.js"
import { validateSignatureSoundPreviewSettings } from "./signature-sound-preview.js"
import {
  createSignatureSoundReviewProjection,
  validateSignatureSoundReviewWorkspace,
} from "./signature-sound-review-workspace.js"

const AUTHORITY_FIELDS = new Set([
  "moodistConcepts", "discoveryReview", "exportedListeningReview", "listeningReview",
  "strategyPolicy", "workspace", "interpretations",
])
const INTERPRETATION_FIELDS = new Set(["version", "fingerprints", "resolutions", "dispositions"])
const INTERPRETATION_FINGERPRINT_FIELDS = new Set([
  "discoveryReviewSha256", "curationSha256", "workspaceSha256",
])
const DISPOSITION_FIELDS = new Set([
  "id", "scope", "groupId", "sourceId", "originalNote", "classification", "resolutionIds", "state",
])
const CLASSIFICATIONS = new Set([
  "audio-processing", "playback", "audio-and-playback", "concept-metadata", "source-availability",
  "preview-diagnostic", "removed-source-observation",
])
const DISPOSITION_STATES = new Set(["structured", "deferred", "needs-user-decision"])
const PROCESSING_KINDS = new Set([
  "trim-segment", "normalize-relative-level", "remove-human-voice", "obscure-speech-intelligibility",
  "suppress-unwanted-element", "emphasize-target-element", "add-time-effect", "repair-loop",
])
const PROCESSING_STATES = new Set(["required", "alternative", "needs-user-decision"])
const SPEECH_KINDS = new Set(["remove-human-voice", "obscure-speech-intelligibility"])
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export { createSignatureSoundConstructionReviewFingerprint } from "./signature-sound-review-fingerprints.js"

/**
 * Validates declared note interpretations against the complete, canonical
 * discovery/listening/workspace authority chain and returns stable ordering.
 * @param {unknown} rawInterpretations
 * @param {unknown} rawAuthority
 */
export function validateSignatureSoundConstructionInterpretations(rawInterpretations, rawAuthority) {
  const authority = normalizeAuthority(rawAuthority)
  return normalizeInterpretations(rawInterpretations, authority)
}

/**
 * Derives inert construction intent without reading, writing, or processing
 * media. The returned state describes review readiness, not audio completion.
 * @param {unknown} rawAuthority
 */
export function createSignatureSoundConstructionReview(rawAuthority) {
  const authority = normalizeAuthority(rawAuthority)
  const interpretations = normalizeInterpretations(authority.rawInterpretations, authority)
  const resolutionById = new Map(interpretations.resolutions.map((resolution) => [resolution.id, resolution]))
  const dispositionsByGroup = groupBy(interpretations.dispositions, ({ groupId }) => groupId)
  const resolutionsByGroup = groupBy(interpretations.resolutions, ({ groupId }) => groupId)
  const groups = authority.projection.groups.map((group) => deriveGroup(
    group,
    resolutionsByGroup.get(group.groupId) ?? [],
    dispositionsByGroup.get(group.groupId) ?? [],
  ))
  const dispositions = interpretations.dispositions.map((disposition) => ({
    ...copy(disposition),
    resolutions: disposition.resolutionIds.map((id) => copy(resolutionById.get(id))),
  }))
  const summary = {
    projectedRecordingCount: authority.projection.recordings.length,
    groupCount: groups.length,
    noteDispositionCount: dispositions.length,
    structuredNoteCount: dispositions.filter(({ state }) => state === "structured").length,
    deferredNoteCount: dispositions.filter(({ state }) => state === "deferred").length,
    needsDecisionNoteCount: dispositions.filter(({ state }) => state === "needs-user-decision").length,
  }
  const review = {
    version: 1,
    fingerprints: {
      discoveryReviewSha256: authority.discoveryReview.fingerprints.reviewSha256,
      curationSha256: authority.listeningReview.fingerprints.curationSha256,
      workspaceSha256: authority.workspaceSha256,
      interpretationSha256: sha256(stableJson(interpretations)),
      constructionReviewSha256: "",
    },
    sourceReview: { version: authority.workspace.version, updatedAt: authority.workspace.updatedAt },
    summary,
    resolutions: copy(interpretations.resolutions),
    noteDispositions: dispositions,
    groups,
  }
  review.fingerprints.constructionReviewSha256 =
    createSignatureSoundConstructionReviewFingerprint(review)
  return copy(review)
}

/**
 * Re-derives serialized construction intent from the complete authority. A
 * shape-only validation path is deliberately not exposed.
 * @param {unknown} rawReview
 * @param {unknown} rawAuthority
 */
export function validateSignatureSoundConstructionReview(rawReview, rawAuthority) {
  const review = requireRecord(rawReview, "Signature construction review")
  const fingerprints = requireRecord(
    review.fingerprints,
    "Signature construction review fingerprints",
  )
  if (requireSha256(
    fingerprints.constructionReviewSha256,
    "Signature construction review SHA-256",
  ) !== createSignatureSoundConstructionReviewFingerprint(review)) {
    throw new Error("Signature construction review fingerprint does not match canonical content")
  }
  const expected = createSignatureSoundConstructionReview(rawAuthority)
  if (stableJson(rawReview) !== stableJson(expected)) {
    throw new Error("Signature construction review does not match its complete authority bundle")
  }
  return copy(expected)
}

/** @param {unknown} rawReview @param {unknown} rawAuthority */
export function renderSignatureSoundConstructionReviewJson(rawReview, rawAuthority) {
  return `${JSON.stringify(validateSignatureSoundConstructionReview(rawReview, rawAuthority), null, 2)}\n`
}

/** @param {unknown} rawReview @param {unknown} rawAuthority */
export function renderSignatureSoundConstructionReviewMarkdown(rawReview, rawAuthority) {
  const review = validateSignatureSoundConstructionReview(rawReview, rawAuthority)
  const { summary } = review
  const lines = [
    "# AtmoShaper Signature construction review",
    "",
    `This inert review reconciles ${summary.noteDispositionCount} note dispositions across ${summary.groupCount} concepts and ${summary.projectedRecordingCount} discovered recordings.`,
    "",
    `- Structured: ${summary.structuredNoteCount}`,
    `- Deferred: ${summary.deferredNoteCount}`,
    `- Needs a user decision: ${summary.needsDecisionNoteCount}`,
    "- Audio processing and rebuilt audible QA remain pending.",
    "",
    "| Concept | Review state | Included sources | Note dispositions |",
    "|---|---:|---:|---:|",
    ...review.groups.map((group) => (
      `| ${escapeTable(group.label)} | ${group.reviewState} | ${group.includedSourceIds.length} | ${group.noteDispositionIds.length} |`
    )),
    "",
  ]
  return `${lines.join("\n")}\n`
}

function normalizeAuthority(rawAuthority) {
  const raw = requireRecord(rawAuthority, "Signature construction-review authority")
  assertOnlyFields(raw, AUTHORITY_FIELDS, "Signature construction-review authority")
  for (const field of AUTHORITY_FIELDS) {
    if (!hasOwn(raw, field)) throw new Error(`Signature construction-review authority is missing ${field}`)
  }
  const strategyPolicy = validateSignatureSoundPlaybackStrategies(raw.strategyPolicy)
  const discoveryReview = validateSignatureSoundDiscoveryReview(raw.discoveryReview, raw.moodistConcepts)
  const listeningReview = validateSignatureSoundListeningReview(raw.listeningReview, {
    discoveryReview,
    moodistConcepts: raw.moodistConcepts,
    exportedReview: raw.exportedListeningReview,
    strategyPolicy,
  })
  const baselines = { discoveryReview, curatedReview: listeningReview }
  const workspace = validateSignatureSoundReviewWorkspace(raw.workspace, baselines)
  return {
    discoveryReview,
    listeningReview,
    strategyPolicy,
    workspace,
    workspaceSha256: sha256(stableJson(workspace)),
    projection: createSignatureSoundReviewProjection(workspace, baselines),
    rawInterpretations: raw.interpretations,
  }
}

function normalizeInterpretations(rawInterpretations, authority) {
  const raw = requireRecord(rawInterpretations, "Signature construction-review interpretations")
  assertOnlyFields(raw, INTERPRETATION_FIELDS, "Signature construction-review interpretations")
  if (raw.version !== 1) throw new Error("Unsupported Signature construction-review interpretation version")
  const rawFingerprints = requireRecord(raw.fingerprints, "Signature construction-review interpretation fingerprints")
  assertOnlyFields(rawFingerprints, INTERPRETATION_FINGERPRINT_FIELDS, "Signature construction-review interpretation fingerprints")
  const fingerprints = {
    discoveryReviewSha256: requireSha256(rawFingerprints.discoveryReviewSha256, "Construction discovery fingerprint"),
    curationSha256: requireSha256(rawFingerprints.curationSha256, "Construction curation fingerprint"),
    workspaceSha256: requireSha256(rawFingerprints.workspaceSha256, "Construction workspace fingerprint"),
  }
  if (fingerprints.discoveryReviewSha256 !== authority.discoveryReview.fingerprints.reviewSha256) {
    throw new Error("Construction discovery fingerprint does not match")
  }
  if (fingerprints.curationSha256 !== authority.listeningReview.fingerprints.curationSha256) {
    throw new Error("Construction curation fingerprint does not match")
  }
  if (fingerprints.workspaceSha256 !== authority.workspaceSha256) {
    throw new Error("Construction workspace fingerprint does not match")
  }
  if (!Array.isArray(raw.resolutions)) throw new Error("Construction resolutions must be an array")
  if (!Array.isArray(raw.dispositions)) throw new Error("Construction dispositions must be an array")
  const groupById = new Map(authority.projection.groups.map((group) => [group.groupId, group]))
  const resolutionIds = new Set()
  const resolutions = raw.resolutions.map((entry, index) => {
    const normalized = normalizeResolution(entry, index, groupById, authority.strategyPolicy)
    if (resolutionIds.has(normalized.id)) throw new Error(`Duplicate construction resolution: ${normalized.id}`)
    resolutionIds.add(normalized.id)
    return normalized
  }).sort((left, right) => compareText(left.id, right.id))
  const resolutionById = new Map(resolutions.map((resolution) => [resolution.id, resolution]))
  assertNoConflictingSpeechTreatments(resolutions)
  const expectedNotes = collectNotes(authority.projection)
  const expectedById = new Map(expectedNotes.map((note) => [note.id, note]))
  const dispositionIds = new Set()
  const referencedResolutionIds = new Set()
  const dispositions = raw.dispositions.map((entry, index) => {
    const normalized = normalizeDisposition(entry, index, expectedById, resolutionById)
    if (dispositionIds.has(normalized.id)) throw new Error(`Duplicate construction disposition: ${normalized.id}`)
    dispositionIds.add(normalized.id)
    for (const resolutionId of normalized.resolutionIds) referencedResolutionIds.add(resolutionId)
    return normalized
  }).sort((left, right) => compareText(left.id, right.id))
  if (dispositions.length !== expectedNotes.length || expectedNotes.some(({ id }) => !dispositionIds.has(id))) {
    throw new Error("Construction disposition coverage does not match the exact review notes")
  }
  if (resolutions.some(({ id }) => !referencedResolutionIds.has(id))) {
    throw new Error("Construction interpretations contain an unreferenced resolution")
  }
  return copy({ version: 1, fingerprints, resolutions, dispositions })
}

function normalizeResolution(rawResolution, index, groupById, strategyPolicy) {
  const raw = requireRecord(rawResolution, `Construction resolution at index ${index}`)
  const type = requireTrimmedString(raw.type, `Construction resolution at index ${index} type`)
  const commonFields = new Set(["id", "type", "groupId", "sourceId"])
  const fieldsByType = {
    "processing-intent": ["intentKind", "desiredOutcome", "state", "choiceSetId", "qa"],
    "playback-override": ["strategyId", "previewSettings"],
    "nonrepeat-window": ["interveningSelections"],
    "transition-duration-range": ["minimumSeconds", "maximumSeconds"],
    "boundary-mode-audition": ["modes"],
    "overlap-next-event": [],
    "rename-concept": ["replacementLabel", "state"],
    "source-requirement": ["requirementKind", "desiredSource", "state", "choiceSetId"],
    "preview-diagnostic": ["diagnosticKind", "reason"],
    "audition-requirement": ["outcome", "reason"],
    "no-assignment": ["reason"],
  }
  const extraFields = fieldsByType[type]
  if (extraFields === undefined) throw new Error(`Unknown construction resolution type: ${type}`)
  assertOnlyFields(raw, new Set([...commonFields, ...extraFields]), `Construction resolution ${type}`)
  const id = requireTrimmedString(raw.id, `Construction resolution ${type} id`)
  const groupId = requireTrimmedString(raw.groupId, `Construction resolution ${id} group`)
  const group = groupById.get(groupId)
  if (!group) throw new Error(`Unknown construction resolution group: ${groupId}`)
  const sourceId = raw.sourceId === null ? null : requireSha256(raw.sourceId, `Construction resolution ${id} source`)
  const ingredient = sourceId === null ? null : group.ingredients.find((entry) => entry.sourceId === sourceId)
  if (sourceId !== null && !ingredient) throw new Error(`Construction resolution source is outside concept ${groupId}`)
  if (type === "processing-intent") {
    if (ingredient?.decision === "remove") throw new Error(`Removed construction source cannot receive processing: ${sourceId}`)
    const state = requireEnum(raw.state, PROCESSING_STATES, `Construction processing ${id} state`)
    const choiceSetId = raw.choiceSetId === null ? null : requireTrimmedString(raw.choiceSetId, `Construction processing ${id} choice`)
    if ((state === "alternative") !== (choiceSetId !== null)) {
      throw new Error(`Construction processing ${id} alternative choice is inconsistent`)
    }
    return {
      id, type, groupId, sourceId,
      intentKind: requireEnum(raw.intentKind, PROCESSING_KINDS, `Construction processing ${id} kind`),
      desiredOutcome: requireTrimmedString(raw.desiredOutcome, `Construction processing ${id} outcome`),
      state, choiceSetId,
      qa: requireAudibleQa(raw.qa, `Construction processing ${id}`),
    }
  }
  if (type === "no-assignment") {
    if (sourceId === null || ingredient?.decision !== "remove") {
      throw new Error("Construction no-assignment is only valid for a removed ingredient")
    }
    if (raw.reason !== "source-removed-from-concept") throw new Error("Unknown construction no-assignment reason")
    return { id, type, groupId, sourceId, reason: raw.reason }
  }
  if (sourceId !== null) throw new Error(`Construction ${type} must be group-scoped`)
  if (type === "playback-override") {
    const strategyId = requireTrimmedString(raw.strategyId, `Construction playback ${id} strategy`)
    if (!strategyPolicy.strategies.some((strategy) => strategy.id === strategyId)) {
      throw new Error(`Unknown construction playback strategy: ${strategyId}`)
    }
    return { id, type, groupId, sourceId, strategyId, previewSettings: validateSignatureSoundPreviewSettings(strategyId, raw.previewSettings) }
  }
  if (type === "nonrepeat-window") {
    return { id, type, groupId, sourceId, interveningSelections: requirePositiveInteger(raw.interveningSelections, `Construction nonrepeat ${id}`) }
  }
  if (type === "transition-duration-range") {
    const minimumSeconds = requirePositiveNumber(raw.minimumSeconds, `Construction transition ${id} minimum`)
    const maximumSeconds = requirePositiveNumber(raw.maximumSeconds, `Construction transition ${id} maximum`)
    if (minimumSeconds > maximumSeconds) throw new Error(`Construction transition ${id} range is reversed`)
    return { id, type, groupId, sourceId, minimumSeconds, maximumSeconds }
  }
  if (type === "boundary-mode-audition") {
    if (!Array.isArray(raw.modes) || raw.modes.length === 0) throw new Error(`Construction boundary ${id} modes are required`)
    const modes = raw.modes.map((mode) => requireEnum(mode, new Set(["crossfade", "overlap"]), `Construction boundary ${id} mode`))
    if (new Set(modes).size !== modes.length) throw new Error(`Construction boundary ${id} modes contain a duplicate`)
    return { id, type, groupId, sourceId, modes: [...modes].sort(compareText) }
  }
  if (type === "overlap-next-event") return { id, type, groupId, sourceId }
  if (type === "rename-concept") {
    const state = requireEnum(raw.state, new Set(["required", "needs-user-decision"]), `Construction rename ${id} state`)
    const replacementLabel = raw.replacementLabel === null ? null : requireTrimmedString(raw.replacementLabel, `Construction rename ${id} label`)
    if ((state === "needs-user-decision") !== (replacementLabel === null)) throw new Error(`Construction rename ${id} state is inconsistent`)
    return { id, type, groupId, sourceId, replacementLabel, state }
  }
  if (type === "source-requirement") {
    if (raw.requirementKind !== "needs-additional-source") throw new Error(`Unknown construction source requirement: ${raw.requirementKind}`)
    const state = requireEnum(raw.state, new Set(["required", "alternative"]), `Construction source requirement ${id} state`)
    const choiceSetId = raw.choiceSetId === null ? null : requireTrimmedString(raw.choiceSetId, `Construction source requirement ${id} choice`)
    if ((state === "alternative") !== (choiceSetId !== null)) throw new Error(`Construction source requirement ${id} alternative choice is inconsistent`)
    return { id, type, groupId, sourceId, requirementKind: raw.requirementKind, desiredSource: requireTrimmedString(raw.desiredSource, `Construction source requirement ${id}`), state, choiceSetId }
  }
  if (type === "preview-diagnostic") {
    if (raw.diagnosticKind !== "investigate-preview-failure") throw new Error(`Unknown construction preview diagnostic: ${raw.diagnosticKind}`)
    return { id, type, groupId, sourceId, diagnosticKind: raw.diagnosticKind, reason: requireTrimmedString(raw.reason, `Construction preview diagnostic ${id}`) }
  }
  if (type === "audition-requirement") {
    if (raw.outcome !== "needs-rebuild-audition") throw new Error(`Unknown construction audition outcome: ${raw.outcome}`)
    return { id, type, groupId, sourceId, outcome: raw.outcome, reason: requireTrimmedString(raw.reason, `Construction audition ${id}`) }
  }
  throw new Error(`Unhandled construction resolution type: ${type}`)
}

function normalizeDisposition(rawDisposition, index, expectedById, resolutionById) {
  const raw = requireRecord(rawDisposition, `Construction disposition at index ${index}`)
  assertOnlyFields(raw, DISPOSITION_FIELDS, `Construction disposition at index ${index}`)
  const id = requireTrimmedString(raw.id, `Construction disposition at index ${index} id`)
  const expected = expectedById.get(id)
  if (!expected) throw new Error(`Construction disposition note is unknown or changed: ${id}`)
  const normalized = {
    id,
    scope: requireEnum(raw.scope, new Set(["group", "ingredient"]), `Construction disposition ${id} scope`),
    groupId: requireTrimmedString(raw.groupId, `Construction disposition ${id} group`),
    sourceId: raw.sourceId === null ? null : requireSha256(raw.sourceId, `Construction disposition ${id} source`),
    originalNote: requireNonemptyString(raw.originalNote, `Construction disposition ${id} note`),
    classification: requireEnum(raw.classification, CLASSIFICATIONS, `Construction disposition ${id} classification`),
    resolutionIds: normalizeUniqueStrings(raw.resolutionIds, `Construction disposition ${id} resolutions`),
    state: requireEnum(raw.state, DISPOSITION_STATES, `Construction disposition ${id} state`),
  }
  for (const field of ["scope", "groupId", "sourceId", "originalNote"]) {
    if (normalized[field] !== expected[field]) throw new Error(`Construction disposition ${id} note identity does not match`)
  }
  if (normalized.resolutionIds.length === 0) throw new Error(`Construction disposition ${id} needs a resolution`)
  for (const resolutionId of normalized.resolutionIds) {
    const resolution = resolutionById.get(resolutionId)
    if (!resolution) throw new Error(`Unknown construction resolution: ${resolutionId}`)
    if (resolution.groupId !== normalized.groupId || (resolution.sourceId !== null && resolution.sourceId !== normalized.sourceId)) {
      throw new Error(`Construction disposition ${id} references an unrelated resolution`)
    }
  }
  validateDispositionSemantics(
    normalized,
    normalized.resolutionIds.map((resolutionId) => resolutionById.get(resolutionId)),
    expected,
  )
  return normalized
}

function validateDispositionSemantics(disposition, resolutions, expected) {
  if (expected.scope === "ingredient" && expected.decision === "remove" && (
    disposition.classification !== "removed-source-observation"
    || resolutions.some(({ type, sourceId }) => type !== "no-assignment" || sourceId !== expected.sourceId)
  )) throw new Error(`Removed construction disposition ${disposition.id} requires its matching no-assignment`)
  const familyForType = (type) => {
    if (type === "processing-intent") return "audio"
    if (["playback-override", "nonrepeat-window", "transition-duration-range", "boundary-mode-audition", "overlap-next-event"].includes(type)) return "playback"
    if (type === "rename-concept") return "metadata"
    if (type === "source-requirement") return "source"
    if (type === "preview-diagnostic") return "diagnostic"
    if (type === "no-assignment") return "removed"
    return "neutral"
  }
  const families = new Set(resolutions.map(({ type }) => familyForType(type)))
  const expectations = {
    "audio-processing": { required: ["audio"], allowed: ["audio", "source", "neutral"] },
    playback: { required: ["playback"], allowed: ["playback", "neutral"] },
    "audio-and-playback": { required: ["audio", "playback"], allowed: ["audio", "playback", "neutral"] },
    "concept-metadata": { required: ["metadata"], allowed: ["metadata", "neutral"] },
    "source-availability": { required: ["source"], allowed: ["audio", "source", "neutral"] },
    "preview-diagnostic": { required: ["diagnostic"], allowed: ["diagnostic", "neutral"] },
    "removed-source-observation": { required: ["removed"], allowed: ["removed"] },
  }
  const expectation = expectations[disposition.classification]
  if (expectation.required.some((family) => !families.has(family))
    || [...families].some((family) => !expectation.allowed.includes(family))) {
    throw new Error(`Construction disposition ${disposition.id} classification does not match its resolutions`)
  }
  const needsDecision = resolutions.some(({ state }) => state === "needs-user-decision")
  if ((disposition.state === "needs-user-decision") !== needsDecision) {
    throw new Error(`Construction disposition ${disposition.id} disposition state does not match its resolutions`)
  }
}

function deriveGroup(group, resolutions, dispositions) {
  const processing = resolutions.filter(({ type }) => type === "processing-intent")
  const groupProcessing = processing.filter(({ sourceId }) => sourceId === null)
  const playbackOverride = requireAtMostOne(resolutions, "playback-override", group.groupId)
  const nonrepeat = requireAtMostOne(resolutions, "nonrepeat-window", group.groupId)
  const rename = requireAtMostOne(resolutions, "rename-concept", group.groupId)
  const constraints = resolutions.filter(({ type }) => [
    "nonrepeat-window", "transition-duration-range", "boundary-mode-audition", "overlap-next-event",
  ].includes(type)).map(toConstraint)
  const sourceOverrides = {}
  for (const sourceId of group.includedSourceIds) {
    const sourceProcessing = processing.filter((resolution) => resolution.sourceId === sourceId)
    if (sourceProcessing.length === 0) continue
    const effective = [...groupProcessing]
    for (const sourceIntent of sourceProcessing) {
      if (SPEECH_KINDS.has(sourceIntent.intentKind)) {
        for (let index = effective.length - 1; index >= 0; index -= 1) {
          if (SPEECH_KINDS.has(effective[index].intentKind)) effective.splice(index, 1)
        }
      }
      effective.push(sourceIntent)
    }
    sourceOverrides[sourceId] = effective.sort(compareResolution)
  }
  const unresolved = group.includedSourceIds.length === 0 || resolutions.some(isUnresolvedResolution)
    || dispositions.some(({ state }) => state === "needs-user-decision" || state === "deferred")
  const changedAudio = processing.length > 0 || resolutions.some(({ type }) => [
    "playback-override", "nonrepeat-window", "transition-duration-range", "boundary-mode-audition",
    "overlap-next-event", "audition-requirement",
  ].includes(type))
  return {
    groupId: group.groupId,
    conceptKind: group.conceptKind,
    conceptId: group.conceptId,
    label: rename?.replacementLabel ?? group.label,
    category: group.category,
    status: group.status,
    includedSourceIds: [...group.includedSourceIds],
    playback: {
      strategyId: playbackOverride?.strategyId ?? group.strategyId,
      previewSettings: copy(playbackOverride?.previewSettings ?? group.previewSettings),
      minimumSelectionsBeforeRepeat: nonrepeat?.interveningSelections ?? null,
      constraints,
    },
    processingIntents: copy(groupProcessing.sort(compareResolution)),
    sourceOverrides: copy(sourceOverrides),
    reviewState: unresolved
      ? "unresolved"
      : changedAudio || group.decision !== "approve"
        ? "needs-rebuild-audition"
        : "accepted",
    noteDispositionIds: dispositions.map(({ id }) => id).sort(compareText),
  }
}

function collectNotes(projection) {
  const notes = []
  for (const group of projection.groups) {
    if (group.note.trim() !== "") notes.push(createNote("group", group.groupId, null, group.note, group.decision ?? null))
    for (const ingredient of group.ingredients) {
      if (ingredient.note.trim() !== "") notes.push(createNote("ingredient", group.groupId, ingredient.sourceId, ingredient.note, ingredient.decision))
    }
  }
  return notes.sort((left, right) => compareText(left.id, right.id))
}

function createNote(scope, groupId, sourceId, originalNote, decision) {
  const identity = { scope, groupId, sourceId, originalNote }
  return { id: `note-${sha256(stableJson(identity))}`, ...identity, decision }
}

function assertNoConflictingSpeechTreatments(resolutions) {
  const counts = new Map()
  for (const resolution of resolutions) {
    if (resolution.type !== "processing-intent" || !SPEECH_KINDS.has(resolution.intentKind)) continue
    const key = `${resolution.groupId}:${resolution.sourceId ?? "group"}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
    if (counts.get(key) > 1) throw new Error(`Construction speech treatment is ambiguous at ${key}`)
  }
}

function toConstraint(resolution) {
  if (resolution.type === "nonrepeat-window") return { type: resolution.type, interveningSelections: resolution.interveningSelections }
  if (resolution.type === "transition-duration-range") return { type: resolution.type, minimumSeconds: resolution.minimumSeconds, maximumSeconds: resolution.maximumSeconds }
  if (resolution.type === "boundary-mode-audition") return { type: resolution.type, modes: [...resolution.modes] }
  return { type: resolution.type }
}

function isUnresolvedResolution(resolution) {
  if (resolution.state === "needs-user-decision" || resolution.state === "alternative") return true
  return resolution.type === "source-requirement" || resolution.type === "preview-diagnostic"
}

function requireAtMostOne(resolutions, type, groupId) {
  const matches = resolutions.filter((resolution) => resolution.type === type)
  if (matches.length > 1) throw new Error(`Construction group ${groupId} has duplicate ${type} resolutions`)
  return matches[0]
}

function normalizeUniqueStrings(rawValues, label) {
  if (!Array.isArray(rawValues)) throw new Error(`${label} must be an array`)
  const values = rawValues.map((value) => requireTrimmedString(value, label))
  if (new Set(values).size !== values.length) throw new Error(`${label} contains a duplicate`)
  return values.sort(compareText)
}

function groupBy(values, keyFor) {
  const grouped = new Map()
  for (const value of values) {
    const key = keyFor(value)
    grouped.set(key, [...(grouped.get(key) ?? []), value])
  }
  return grouped
}

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function assertOnlyFields(value, allowed, label) {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} has unknown field: ${field}`)
  }
}

function requireTrimmedString(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) throw new Error(`${label} must be a trimmed string`)
  return value
}

function requireNonemptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`)
  return value
}

function requireSha256(value, label) {
  const normalized = requireTrimmedString(value, label)
  if (!SHA256_PATTERN.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256`)
  return normalized
}

function requireEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) throw new Error(`${label} is not supported`)
  return value
}

function requireAudibleQa(value, label) {
  if (value !== "audible-qa-required") throw new Error(`${label} requires audible QA`)
  return value
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`)
  return value
}

function requirePositiveNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive`)
  return value
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function compareResolution(left, right) {
  return compareText(`${left.intentKind ?? left.type}:${left.id}`, `${right.intentKind ?? right.type}:${right.id}`)
}

function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en") || left.localeCompare(right, "en")
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field)
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ")
}
