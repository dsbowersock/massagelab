const SHA256 = /^[a-f0-9]{64}$/
const VARIANT_IDS = ["short-delay", "medium-echo", "wide-dual-echo", "wide-dual-echo-x2"]
const DECISIONS = new Set([null, "pass", "needs-rework", "reject"])
const QA_FIELDS = new Set([
  "version", "reviewKind", "batchId", "batchDeclarationSha256", "manifestSha256",
  "groupId", "playbackConfiguration", "dryAuditionedAt", "updatedAt", "variants",
])
const PLAYBACK_FIELDS = new Set(["strategyId", "previewSettings"])
const SETTINGS_FIELDS = new Set(["minimumGapSeconds", "maximumGapSeconds"])
const VARIANT_FIELDS = new Set([
  "variantId", "variantLabel", "outputIdentities", "auditionedAt", "decision", "note",
])
const VARIANT_UPDATE_FIELDS = new Set(["variantId", "auditionedAt", "decision", "note", "updatedAt"])
const SELECTION_FIELDS = new Set([
  "version", "reviewKind", "batchId", "batchDeclarationSha256", "manifestSha256", "groupId",
  "selectedVariantId", "selectedVariantLabel", "outputIdentities", "dryAuditionedAt",
  "variantAuditionedAt", "decision", "note", "updatedAt",
])

/**
 * Builds the exact scheduler inputs for the dry concept or one processed
 * treatment while preserving source ids as the repeat-selection identity.
 */
export function buildSignatureSoundTreatmentConceptSources(rawManifest, { variantId, sourcePaths = {} }) {
  const structure = normalizeManifestStructure(rawManifest)
  const sources = variantId === "dry"
    ? structure.sourceIds.map((sourceId) => ({
        sourceId,
        relativePath: sourcePaths[sourceId] ?? sourceId,
        audioUrl: `/api/dev/atmoshaper-candidates/audio/${encodeURIComponent(sourceId)}`,
      }))
    : requireVariant(structure, variantId).outputs.map((output) => ({
        sourceId: output.sourceId,
        relativePath: sourcePaths[output.sourceId] ?? output.sourceId,
        audioUrl: `/api/dev/atmoshaper-candidates/derived/${encodeURIComponent(structure.batchId)}/${encodeURIComponent(output.outputIdentity)}`,
      }))
  if (sources.length !== structure.sourceIds.length) {
    throw new Error("Treatment concept variant does not cover the exact source set")
  }
  return sources
}

/** Creates decision-empty QA for one dry concept and every closed treatment variant. */
export function createSignatureSoundTreatmentConceptQaDraft({
  manifest,
  manifestSha256,
  playbackConfiguration,
  updatedAt,
}) {
  const context = normalizeContext({ manifest, manifestSha256, playbackConfiguration })
  const timestamp = requireTimestamp(updatedAt, "Treatment concept QA updatedAt")
  return {
    version: 1,
    reviewKind: "treatment-concept-qa",
    batchId: context.batchId,
    batchDeclarationSha256: context.batchDeclarationSha256,
    manifestSha256: context.manifestSha256,
    groupId: context.groupId,
    playbackConfiguration: clonePlayback(context.playbackConfiguration),
    dryAuditionedAt: null,
    updatedAt: timestamp,
    variants: Object.fromEntries(context.variants.map((variant) => [variant.variantId, {
      variantId: variant.variantId,
      variantLabel: variant.variantLabel,
      outputIdentities: [...variant.outputIdentities],
      auditionedAt: null,
      decision: null,
      note: "",
    }])),
  }
}

/** Validates browser-local QA against the exact manifest and scheduler setup. */
export function validateSignatureSoundTreatmentConceptQa(rawQa, rawContext) {
  const context = normalizeContext(rawContext)
  const qa = requireRecord(rawQa, "Treatment concept QA")
  assertOnlyFields(qa, QA_FIELDS, "Treatment concept QA")
  if (qa.version !== 1 || qa.reviewKind !== "treatment-concept-qa" ||
      qa.batchId !== context.batchId || qa.batchDeclarationSha256 !== context.batchDeclarationSha256 ||
      qa.manifestSha256 !== context.manifestSha256 || qa.groupId !== context.groupId) {
    throw new Error("Treatment concept QA identity is stale")
  }
  if (JSON.stringify(normalizePlayback(qa.playbackConfiguration)) !== JSON.stringify(context.playbackConfiguration)) {
    throw new Error("Treatment concept QA playback configuration drifted")
  }
  const dryAuditionedAt = requireNullableTimestamp(qa.dryAuditionedAt, "Treatment concept QA dry audition")
  const updatedAt = requireTimestamp(qa.updatedAt, "Treatment concept QA updatedAt")
  const rawVariants = requireRecord(qa.variants, "Treatment concept QA variants")
  if (JSON.stringify(Object.keys(rawVariants)) !== JSON.stringify(VARIANT_IDS)) {
    throw new Error("Treatment concept QA variant identities drifted")
  }
  const variants = {}
  for (const expected of context.variants) {
    const label = `Treatment concept QA variant ${expected.variantId}`
    const entry = requireRecord(rawVariants[expected.variantId], label)
    assertOnlyFields(entry, VARIANT_FIELDS, label)
    if (entry.variantId !== expected.variantId || entry.variantLabel !== expected.variantLabel ||
        JSON.stringify(entry.outputIdentities) !== JSON.stringify(expected.outputIdentities)) {
      throw new Error(`${label} identity drifted`)
    }
    const auditionedAt = requireNullableTimestamp(entry.auditionedAt, `${label} audition`)
    const decision = entry.decision
    const note = requireString(entry.note, `${label} note`)
    if (!DECISIONS.has(decision)) throw new Error(`${label} decision is invalid`)
    const bothHeard = Boolean(dryAuditionedAt && auditionedAt)
    if (decision === "pass" && !bothHeard) throw new Error(`${label} Pass requires dry and treatment audition evidence`)
    if ((decision === "needs-rework" || decision === "reject") && !bothHeard && !note.trim()) {
      throw new Error(`${label} negative decision needs audition evidence or a note`)
    }
    variants[expected.variantId] = {
      variantId: expected.variantId,
      variantLabel: expected.variantLabel,
      outputIdentities: [...expected.outputIdentities],
      auditionedAt,
      decision,
      note,
    }
  }
  if (rawContext?.requireComplete && Object.values(variants).some(({ decision }) => decision === null)) {
    throw new Error("Treatment concept QA is incomplete because a variant decision is missing")
  }
  return {
    version: 1,
    reviewKind: "treatment-concept-qa",
    batchId: context.batchId,
    batchDeclarationSha256: context.batchDeclarationSha256,
    manifestSha256: context.manifestSha256,
    groupId: context.groupId,
    playbackConfiguration: clonePlayback(context.playbackConfiguration),
    dryAuditionedAt,
    updatedAt,
    variants,
  }
}

/** Records explicit heard confirmation for the dry concept or one complete variant. */
export function recordSignatureSoundTreatmentConceptQaAudition(rawQa, context, { targetId, auditionedAt }) {
  const qa = validateSignatureSoundTreatmentConceptQa(rawQa, context)
  const timestamp = requireTimestamp(auditionedAt, "Treatment concept audition timestamp")
  if (targetId === "dry") {
    return validateSignatureSoundTreatmentConceptQa({
      ...qa,
      dryAuditionedAt: timestamp,
      updatedAt: timestamp,
    }, context)
  }
  if (!qa.variants[targetId]) throw new Error("Treatment concept audition variant is unknown")
  return validateSignatureSoundTreatmentConceptQa({
    ...qa,
    updatedAt: timestamp,
    variants: {
      ...qa.variants,
      [targetId]: { ...qa.variants[targetId], auditionedAt: timestamp },
    },
  }, context)
}

/** Updates one complete treatment note or decision without touching another variant. */
export function updateSignatureSoundTreatmentConceptQaVariant(rawQa, context, rawChange) {
  const qa = validateSignatureSoundTreatmentConceptQa(rawQa, context)
  const change = requireRecord(rawChange, "Treatment concept QA variant update")
  assertOnlyFields(change, VARIANT_UPDATE_FIELDS, "Treatment concept QA variant update")
  const variantId = requireString(change.variantId, "Treatment concept QA variant id")
  const current = qa.variants[variantId]
  if (!current) throw new Error("Treatment concept QA variant is unknown")
  const updatedAt = requireTimestamp(change.updatedAt, "Treatment concept QA update timestamp")
  const next = {
    ...current,
    ...(Object.hasOwn(change, "auditionedAt") ? {
      auditionedAt: requireNullableTimestamp(change.auditionedAt, "Treatment concept QA variant audition"),
    } : {}),
    ...(Object.hasOwn(change, "decision") ? { decision: change.decision } : {}),
    ...(Object.hasOwn(change, "note") ? { note: requireString(change.note, "Treatment concept QA variant note") } : {}),
  }
  return validateSignatureSoundTreatmentConceptQa({
    ...qa,
    updatedAt,
    variants: { ...qa.variants, [variantId]: next },
  }, context)
}

/**
 * Validates one directly selected concept treatment against the immutable
 * declaration, manifest, and exact processed outputs heard by the reviewer.
 */
export function validateSignatureSoundTreatmentConceptQaSelection(rawSelection, rawContext) {
  const context = normalizeContext(rawContext)
  const selection = requireRecord(rawSelection, "Treatment concept QA selection")
  assertOnlyFields(selection, SELECTION_FIELDS, "Treatment concept QA selection")
  if (selection.version !== 1 || selection.reviewKind !== "treatment-concept-selection-qa" ||
      selection.batchId !== context.batchId ||
      selection.batchDeclarationSha256 !== context.batchDeclarationSha256 ||
      selection.manifestSha256 !== context.manifestSha256 || selection.groupId !== context.groupId) {
    throw new Error("Treatment concept QA selection identity is stale")
  }
  const selectedVariantId = requireString(selection.selectedVariantId, "Treatment concept QA selected variant id")
  const selectedVariant = context.variants.find(({ variantId }) => variantId === selectedVariantId)
  if (!selectedVariant || selection.selectedVariantLabel !== selectedVariant.variantLabel ||
      JSON.stringify(selection.outputIdentities) !== JSON.stringify(selectedVariant.outputIdentities)) {
    throw new Error("Treatment concept QA selected variant identity drifted")
  }
  if (selection.decision !== "pass") {
    throw new Error("Treatment concept QA selection must record the direct Pass decision")
  }
  const note = requireString(selection.note, "Treatment concept QA selection note")
  if (!note.trim()) throw new Error("Treatment concept QA selection note is required")
  return {
    version: 1,
    reviewKind: "treatment-concept-selection-qa",
    batchId: context.batchId,
    batchDeclarationSha256: context.batchDeclarationSha256,
    manifestSha256: context.manifestSha256,
    groupId: context.groupId,
    selectedVariantId,
    selectedVariantLabel: selectedVariant.variantLabel,
    outputIdentities: [...selectedVariant.outputIdentities],
    dryAuditionedAt: requireTimestamp(selection.dryAuditionedAt, "Treatment concept QA dry audition"),
    variantAuditionedAt: requireTimestamp(selection.variantAuditionedAt, "Treatment concept QA variant audition"),
    decision: "pass",
    note,
    updatedAt: requireTimestamp(selection.updatedAt, "Treatment concept QA selection updatedAt"),
  }
}

/** Applies one exact committed Pass without inventing decisions for comparison variants. */
export function applySignatureSoundTreatmentConceptQaSelection(rawQa, rawSelection, context) {
  const qa = validateSignatureSoundTreatmentConceptQa(rawQa, context)
  const selection = validateSignatureSoundTreatmentConceptQaSelection(rawSelection, context)
  return validateSignatureSoundTreatmentConceptQa({
    ...qa,
    dryAuditionedAt: selection.dryAuditionedAt,
    updatedAt: selection.updatedAt,
    variants: {
      ...qa.variants,
      [selection.selectedVariantId]: {
        ...qa.variants[selection.selectedVariantId],
        auditionedAt: selection.variantAuditionedAt,
        decision: selection.decision,
        note: selection.note,
      },
    },
  }, context)
}

function normalizeContext({ manifest, manifestSha256, playbackConfiguration }) {
  const structure = normalizeManifestStructure(manifest)
  return {
    ...structure,
    manifestSha256: requireSha256(manifestSha256, "Treatment concept manifest SHA-256"),
    playbackConfiguration: normalizePlayback(playbackConfiguration),
  }
}

function normalizeManifestStructure(rawManifest) {
  const manifest = requireRecord(rawManifest, "Treatment concept manifest")
  if (manifest.reviewKind !== "treatment-audition") throw new Error("Treatment concept manifest kind is invalid")
  const batchId = requireString(manifest.batchId, "Treatment concept batch id")
  const batchDeclarationSha256 = requireSha256(manifest.batchDeclarationSha256, "Treatment concept declaration SHA-256")
  const groupId = requireString(manifest.groupId, "Treatment concept group id")
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length === 0) {
    throw new Error("Treatment concept manifest outputs are missing")
  }
  const sourceIds = []
  const seenSources = new Set()
  const variantMaps = new Map(VARIANT_IDS.map((variantId) => [variantId, []]))
  const variantLabels = new Map()
  const allOutputs = new Set()
  for (const rawOutput of manifest.outputs) {
    const output = requireRecord(rawOutput, "Treatment concept manifest output")
    const sourceId = requireSha256(output.sourceId, "Treatment concept source id")
    const outputIdentity = requireSha256(output.outputIdentity, "Treatment concept output identity")
    const variantId = requireString(output.variantId, "Treatment concept variant id")
    const variantLabel = requireString(output.variantLabel, "Treatment concept variant label")
    if (!variantMaps.has(variantId)) throw new Error("Treatment concept manifest has an unknown variant")
    if (allOutputs.has(outputIdentity)) throw new Error("Treatment concept manifest output identity is duplicated")
    allOutputs.add(outputIdentity)
    if (!seenSources.has(sourceId)) {
      seenSources.add(sourceId)
      sourceIds.push(sourceId)
    }
    const priorLabel = variantLabels.get(variantId)
    if (priorLabel && priorLabel !== variantLabel) throw new Error("Treatment concept variant label drifted")
    variantLabels.set(variantId, variantLabel)
    variantMaps.get(variantId).push({ sourceId, outputIdentity })
  }
  const variants = VARIANT_IDS.map((variantId) => {
    const outputs = variantMaps.get(variantId)
    if (JSON.stringify(outputs.map(({ sourceId }) => sourceId)) !== JSON.stringify(sourceIds)) {
      throw new Error(`Treatment concept variant ${variantId} source identity drifted`)
    }
    return {
      variantId,
      variantLabel: variantLabels.get(variantId),
      outputs,
      outputIdentities: outputs.map(({ outputIdentity }) => outputIdentity),
    }
  })
  return { batchId, batchDeclarationSha256, groupId, sourceIds, variants }
}

function normalizePlayback(rawPlayback) {
  const playback = requireRecord(rawPlayback, "Treatment concept playback")
  assertOnlyFields(playback, PLAYBACK_FIELDS, "Treatment concept playback")
  if (playback.strategyId !== "spaced-event-sequence") throw new Error("Treatment concept playback strategy is invalid")
  const settings = requireRecord(playback.previewSettings, "Treatment concept playback settings")
  assertOnlyFields(settings, SETTINGS_FIELDS, "Treatment concept playback settings")
  if (settings.minimumGapSeconds !== 0 || settings.maximumGapSeconds !== 8) {
    throw new Error("Treatment concept playback settings do not match the approved 0-8 second sequence")
  }
  return {
    strategyId: "spaced-event-sequence",
    previewSettings: { minimumGapSeconds: 0, maximumGapSeconds: 8 },
  }
}

function requireVariant(structure, variantId) {
  const variant = structure.variants.find((candidate) => candidate.variantId === variantId)
  if (!variant) throw new Error("Treatment concept variant is unknown")
  return variant
}

function clonePlayback(playback) {
  return { strategyId: playback.strategyId, previewSettings: { ...playback.previewSettings } }
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function requireString(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`)
  return value
}

function requireSha256(value, label) {
  if (!SHA256.test(value)) throw new Error(`${label} must be a SHA-256`)
  return value
}

function requireTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid`)
  return value
}

function requireNullableTimestamp(value, label) {
  return value === null ? null : requireTimestamp(value, label)
}

function assertOnlyFields(value, allowed, label) {
  const unknown = Object.keys(value).filter((field) => !allowed.has(field))
  if (unknown.length > 0) throw new Error(`${label} has unknown field ${unknown[0]}`)
}
