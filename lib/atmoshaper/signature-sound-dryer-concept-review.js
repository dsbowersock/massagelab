// @ts-check

const SHA256 = /^[a-f0-9]{64}$/
const SELECTION_FIELDS = new Set([
  "version", "reviewKind", "batchId", "batchDeclarationSha256", "manifestSha256",
  "groupId", "selectedTarget", "selectedLabel", "sourceId", "comparisonOutputIdentity",
  "playbackConfiguration", "decision", "note", "reviewedAt",
])

/**
 * Validates one direct Dryer concept choice against the exact source,
 * comparison artifact, and construction-owned playback configuration.
 * @param {unknown} rawSelection
 * @param {unknown} rawContext
 */
export function validateSignatureSoundDryerConceptSelection(rawSelection, rawContext) {
  const context = normalizeContext(rawContext)
  const selection = requireRecord(rawSelection, "Dryer concept selection")
  assertOnlyFields(selection, SELECTION_FIELDS, "Dryer concept selection")
  if (selection.version !== 1 || selection.reviewKind !== "dryer-concept-selection-qa" ||
      selection.batchId !== context.batchId ||
      selection.batchDeclarationSha256 !== context.batchDeclarationSha256 ||
      selection.manifestSha256 !== context.manifestSha256 || selection.groupId !== context.groupId) {
    throw new Error("Dryer concept selection identity is stale")
  }
  const selectedTarget = selection.selectedTarget === "dry" || selection.selectedTarget === "trimmed"
    ? selection.selectedTarget
    : null
  const selectedLabel = selectedTarget === "dry" ? "Dry concept" : "Trimmed candidate"
  if (!selectedTarget || selection.selectedLabel !== selectedLabel) {
    throw new Error("Dryer concept selection target or label drifted")
  }
  if (selection.sourceId !== context.sourceId ||
      selection.comparisonOutputIdentity !== context.comparisonOutputIdentity) {
    throw new Error("Dryer concept selection source or comparison identity drifted")
  }
  if (JSON.stringify(selection.playbackConfiguration) !== JSON.stringify(context.playbackConfiguration)) {
    throw new Error("Dryer concept selection playback configuration drifted")
  }
  if (selection.decision !== "pass") throw new Error("Dryer concept selection must record Pass")
  const note = requireString(selection.note, "Dryer concept selection note")
  if (!note.trim()) throw new Error("Dryer concept selection note is required")
  return {
    version: 1,
    reviewKind: "dryer-concept-selection-qa",
    batchId: context.batchId,
    batchDeclarationSha256: context.batchDeclarationSha256,
    manifestSha256: context.manifestSha256,
    groupId: context.groupId,
    selectedTarget,
    selectedLabel,
    sourceId: context.sourceId,
    comparisonOutputIdentity: context.comparisonOutputIdentity,
    playbackConfiguration: structuredClone(context.playbackConfiguration),
    decision: "pass",
    note,
    reviewedAt: requireTimestamp(selection.reviewedAt, "Dryer concept selection reviewedAt"),
  }
}

/** @param {unknown} rawContext */
function normalizeContext(rawContext) {
  const context = requireRecord(rawContext, "Dryer concept selection context")
  const manifest = requireRecord(context.manifest, "Dryer concept manifest")
  if (manifest.version !== 1 || manifest.batchId !== "batch-05-dryer-trim-audition" ||
      manifest.groupId !== "moodist:dryer" || !Array.isArray(manifest.outputs) || manifest.outputs.length !== 1) {
    throw new Error("Dryer concept manifest identity is invalid")
  }
  const output = requireRecord(manifest.outputs[0], "Dryer concept output")
  const playbackConfiguration = requireRecord(context.playbackConfiguration, "Dryer playback configuration")
  return {
    batchId: manifest.batchId,
    batchDeclarationSha256: requireSha256(manifest.batchDeclarationSha256, "Dryer batch declaration SHA-256"),
    manifestSha256: requireSha256(context.manifestSha256, "Dryer manifest SHA-256"),
    groupId: manifest.groupId,
    sourceId: requireSha256(output.sourceId, "Dryer source id"),
    comparisonOutputIdentity: requireSha256(output.outputIdentity, "Dryer output identity"),
    playbackConfiguration: structuredClone(playbackConfiguration),
  }
}

/** @param {Record<string, any>} record @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(record, allowed, label) {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unknown field ${key}`)
  }
}

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}

/** @param {unknown} value @param {string} label */
function requireString(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid`)
  return value
}
