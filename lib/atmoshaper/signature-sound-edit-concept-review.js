const SHA256 = /^[a-f0-9]{64}$/
const BATCH_ID = "batch-04-boiling-water-edit-audition"
const GROUP_ID = "moodist:boiling-water"
const VARIANT_IDS = ["short-seam", "medium-seam", "long-seam"]
const DECISIONS = new Set(["undecided", "pass", "change", "reject"])
const QA_FIELDS = new Set([
  "version", "reviewKind", "batchId", "batchDeclarationSha256", "manifestSha256",
  "groupId", "playbackConfiguration", "directSelection", "dryAuditionedAt", "updatedAt", "variants",
])
const SELECTION_FIELDS = new Set([
  "version", "reviewKind", "batchId", "batchDeclarationSha256", "manifestSha256",
  "groupId", "selectedVariantId", "selectedVariantLabel", "outputIdentity",
  "decision", "note", "reviewedAt",
])
const PLAYBACK_FIELDS = new Set([
  "strategyId", "previewSettings", "minimumSelectionsBeforeRepeat", "constraints",
])
const SETTINGS_FIELDS = new Set(["transitionMode", "transitionSeconds"])
const VARIANT_FIELDS = new Set([
  "variantId", "variantLabel", "outputIdentity", "auditionedAt",
  "endToStartSeamCrossings", "decision", "note",
])
const AUDITION_FIELDS = new Set(["targetId", "auditionedAt"])
const CROSSING_FIELDS = new Set(["variantId", "crossedAt"])
const UPDATE_FIELDS = new Set(["variantId", "decision", "note", "updatedAt"])

/**
 * Creates decision-empty Batch 04 QA from an immutable external manifest.
 * No checked-in draft is needed because every identity is reproduced here.
 */
export function createSignatureSoundEditConceptQaDraft({
  manifest,
  manifestSha256,
  playbackConfiguration,
  updatedAt,
}) {
  const context = normalizeContext({ manifest, manifestSha256, playbackConfiguration })
  return {
    version: 1,
    reviewKind: "edit-concept-qa",
    batchId: context.batchId,
    batchDeclarationSha256: context.batchDeclarationSha256,
    manifestSha256: context.manifestSha256,
    groupId: context.groupId,
    playbackConfiguration: clonePlayback(context.playbackConfiguration),
    directSelection: null,
    dryAuditionedAt: null,
    updatedAt: requireTimestamp(updatedAt, "Edit concept QA updatedAt"),
    variants: Object.fromEntries(context.variants.map((variant) => [variant.variantId, {
      variantId: variant.variantId,
      variantLabel: variant.variantLabel,
      outputIdentity: variant.outputIdentity,
      auditionedAt: null,
      endToStartSeamCrossings: [],
      decision: "undecided",
      note: "",
    }])),
  }
}

/**
 * Validates QA against the exact batch, output identities, and construction
 * playback setup. A Pass proves both comparison hearing and repeated seams.
 */
export function validateSignatureSoundEditConceptQa(rawQa, rawContext) {
  const context = normalizeContext(rawContext)
  const qa = requireRecord(rawQa, "Edit concept QA")
  assertOnlyFields(qa, QA_FIELDS, "Edit concept QA")
  if (qa.version !== 1 || qa.reviewKind !== "edit-concept-qa" ||
      qa.batchId !== context.batchId ||
      qa.batchDeclarationSha256 !== context.batchDeclarationSha256 ||
      qa.manifestSha256 !== context.manifestSha256 || qa.groupId !== context.groupId) {
    throw new Error("Edit concept QA identity is stale")
  }
  const playbackConfiguration = normalizePlayback(qa.playbackConfiguration)
  if (JSON.stringify(playbackConfiguration) !== JSON.stringify(context.playbackConfiguration)) {
    throw new Error("Edit concept QA playback configuration drifted")
  }
  const directSelection = qa.directSelection == null
    ? null
    : normalizeQaSelection(qa.directSelection, context)
  const dryAuditionedAt = requireNullableTimestamp(qa.dryAuditionedAt, "Edit concept QA dry audition")
  const updatedAt = requireTimestamp(qa.updatedAt, "Edit concept QA updatedAt")
  const rawVariants = requireRecord(qa.variants, "Edit concept QA variants")
  if (JSON.stringify(Object.keys(rawVariants)) !== JSON.stringify(VARIANT_IDS)) {
    throw new Error("Edit concept QA variant identities drifted")
  }

  const variants = {}
  for (const expected of context.variants) {
    const label = `Edit concept QA variant ${expected.variantId}`
    const entry = requireRecord(rawVariants[expected.variantId], label)
    assertOnlyFields(entry, VARIANT_FIELDS, label)
    if (entry.variantId !== expected.variantId || entry.variantLabel !== expected.variantLabel ||
        entry.outputIdentity !== expected.outputIdentity) {
      throw new Error(`${label} identity drifted`)
    }
    const auditionedAt = requireNullableTimestamp(entry.auditionedAt, `${label} audition`)
    const endToStartSeamCrossings = normalizeCrossings(entry.endToStartSeamCrossings, label)
    const decision = requireString(entry.decision, `${label} decision`)
    if (!DECISIONS.has(decision)) throw new Error(`${label} decision is invalid`)
    const note = requireString(entry.note, `${label} note`)
    const directlySelected = directSelection?.selectedVariantId === expected.variantId
    if (directlySelected && decision !== directSelection.decision) {
      throw new Error(`${label} decision drifted from the direct reviewer selection`)
    }
    const fullyHeard = Boolean(dryAuditionedAt && auditionedAt && endToStartSeamCrossings.length >= 2)
    if (decision === "pass" && !directlySelected) {
      if (!dryAuditionedAt) throw new Error(`${label} Pass requires dry audition evidence`)
      if (!auditionedAt) throw new Error(`${label} Pass requires candidate audition evidence`)
      if (endToStartSeamCrossings.length < 2) {
        throw new Error(`${label} Pass requires at least two end-to-start seam crossings`)
      }
    }
    if ((decision === "change" || decision === "reject") && !fullyHeard && !note.trim()) {
      throw new Error(`${label} note is required when negative review evidence is incomplete`)
    }
    variants[expected.variantId] = {
      variantId: expected.variantId,
      variantLabel: expected.variantLabel,
      outputIdentity: expected.outputIdentity,
      auditionedAt,
      endToStartSeamCrossings,
      decision,
      note,
    }
  }
  return {
    version: 1,
    reviewKind: "edit-concept-qa",
    batchId: context.batchId,
    batchDeclarationSha256: context.batchDeclarationSha256,
    manifestSha256: context.manifestSha256,
    groupId: context.groupId,
    playbackConfiguration: clonePlayback(context.playbackConfiguration),
    directSelection,
    dryAuditionedAt,
    updatedAt,
    variants,
  }
}

/**
 * Validates one direct reviewer choice against the exact rendered output.
 * This records reviewer authority without fabricating browser playback events.
 */
export function validateSignatureSoundEditConceptQaSelection(rawSelection, rawContext) {
  const context = normalizeContext(rawContext)
  return normalizeQaSelection(rawSelection, context)
}

function normalizeQaSelection(rawSelection, context) {
  const selection = requireRecord(rawSelection, "Edit concept QA selection")
  assertOnlyFields(selection, SELECTION_FIELDS, "Edit concept QA selection")
  if (selection.version !== 1 || selection.reviewKind !== "edit-concept-selection-qa" ||
      selection.batchId !== context.batchId ||
      selection.batchDeclarationSha256 !== context.batchDeclarationSha256 ||
      selection.manifestSha256 !== context.manifestSha256 || selection.groupId !== context.groupId) {
    throw new Error("Edit concept QA selection identity is stale")
  }
  const selectedVariantId = requireString(
    selection.selectedVariantId,
    "Edit concept QA selected variant",
  )
  const expected = context.variants.find((variant) => variant.variantId === selectedVariantId)
  if (!expected || selection.selectedVariantLabel !== expected.variantLabel ||
      selection.outputIdentity !== expected.outputIdentity) {
    throw new Error("Edit concept QA selection output identity drifted")
  }
  if (selection.decision !== "pass") {
    throw new Error("Edit concept QA selection must record Pass")
  }
  const note = requireString(selection.note, "Edit concept QA selection note")
  if (!note.trim()) throw new Error("Edit concept QA selection note is required")
  return {
    version: 1,
    reviewKind: "edit-concept-selection-qa",
    batchId: context.batchId,
    batchDeclarationSha256: context.batchDeclarationSha256,
    manifestSha256: context.manifestSha256,
    groupId: context.groupId,
    selectedVariantId,
    selectedVariantLabel: expected.variantLabel,
    outputIdentity: expected.outputIdentity,
    decision: "pass",
    note,
    reviewedAt: requireTimestamp(selection.reviewedAt, "Edit concept QA selection reviewedAt"),
  }
}

/** Applies a validated direct choice while leaving browser audition telemetry untouched. */
export function applySignatureSoundEditConceptQaSelection(rawQa, rawSelection, context) {
  const qa = validateSignatureSoundEditConceptQa(rawQa, context)
  const selection = validateSignatureSoundEditConceptQaSelection(rawSelection, context)
  return validateSignatureSoundEditConceptQa({
    ...qa,
    directSelection: selection,
    updatedAt: Date.parse(qa.updatedAt) > Date.parse(selection.reviewedAt)
      ? qa.updatedAt
      : selection.reviewedAt,
    variants: {
      ...qa.variants,
      [selection.selectedVariantId]: {
        ...qa.variants[selection.selectedVariantId],
        decision: selection.decision,
        note: qa.variants[selection.selectedVariantId].note.trim()
          ? qa.variants[selection.selectedVariantId].note
          : selection.note,
      },
    },
  }, context)
}

/** Records explicit completion of the dry comparison or one candidate audition. */
export function recordSignatureSoundEditConceptQaAudition(rawQa, context, rawEvidence) {
  const qa = validateSignatureSoundEditConceptQa(rawQa, context)
  const evidence = requireRecord(rawEvidence, "Edit concept audition evidence")
  assertOnlyFields(evidence, AUDITION_FIELDS, "Edit concept audition evidence")
  const targetId = requireString(evidence.targetId, "Edit concept audition target")
  const auditionedAt = requireTimestamp(evidence.auditionedAt, "Edit concept audition timestamp")
  if (targetId === "dry") {
    return validateSignatureSoundEditConceptQa({
      ...qa,
      dryAuditionedAt: auditionedAt,
      updatedAt: auditionedAt,
    }, context)
  }
  if (!qa.variants[targetId]) throw new Error("Edit concept audition variant is unknown")
  return validateSignatureSoundEditConceptQa({
    ...qa,
    updatedAt: auditionedAt,
    variants: {
      ...qa.variants,
      [targetId]: { ...qa.variants[targetId], auditionedAt },
    },
  }, context)
}

/**
 * Records one boundary crossing for the exact manifest-bound candidate.
 * Duplicate timestamps are rejected so a single event cannot satisfy Pass twice.
 */
export function recordSignatureSoundEditConceptQaSeamCrossing(rawQa, context, rawEvidence) {
  const qa = validateSignatureSoundEditConceptQa(rawQa, context)
  const evidence = requireRecord(rawEvidence, "Edit concept seam-crossing evidence")
  assertOnlyFields(evidence, CROSSING_FIELDS, "Edit concept seam-crossing evidence")
  const variantId = requireString(evidence.variantId, "Edit concept seam-crossing variant")
  const current = qa.variants[variantId]
  if (!current) throw new Error("Edit concept seam-crossing variant is unknown")
  if (!current.auditionedAt) throw new Error("Edit concept seam crossing requires candidate audition evidence")
  const crossedAt = requireTimestamp(evidence.crossedAt, "Edit concept seam-crossing timestamp")
  if (current.endToStartSeamCrossings.includes(crossedAt)) {
    throw new Error("Edit concept seam-crossing timestamp is duplicated")
  }
  return validateSignatureSoundEditConceptQa({
    ...qa,
    updatedAt: crossedAt,
    variants: {
      ...qa.variants,
      [variantId]: {
        ...current,
        endToStartSeamCrossings: [...current.endToStartSeamCrossings, crossedAt],
      },
    },
  }, context)
}

/** Updates one candidate judgment without clearing any other candidate's evidence. */
export function updateSignatureSoundEditConceptQaVariant(rawQa, context, rawChange) {
  const qa = validateSignatureSoundEditConceptQa(rawQa, context)
  const change = requireRecord(rawChange, "Edit concept QA variant update")
  assertOnlyFields(change, UPDATE_FIELDS, "Edit concept QA variant update")
  const variantId = requireString(change.variantId, "Edit concept QA variant id")
  const current = qa.variants[variantId]
  if (!current) throw new Error("Edit concept QA variant is unknown")
  const updatedAt = requireTimestamp(change.updatedAt, "Edit concept QA update timestamp")
  return validateSignatureSoundEditConceptQa({
    ...qa,
    updatedAt,
    variants: {
      ...qa.variants,
      [variantId]: {
        ...current,
        ...(Object.hasOwn(change, "decision") ? {
          decision: requireString(change.decision, "Edit concept QA decision"),
        } : {}),
        ...(Object.hasOwn(change, "note") ? {
          note: requireString(change.note, "Edit concept QA note"),
        } : {}),
      },
    },
  }, context)
}

/** Serializes validated QA with stable field and variant ordering. */
export function exportSignatureSoundEditConceptQa(rawQa, context) {
  return `${JSON.stringify(validateSignatureSoundEditConceptQa(rawQa, context), null, 2)}\n`
}

/** Parses an imported document and applies the same closed current-context validation. */
export function parseSignatureSoundEditConceptQaJson(rawJson, context) {
  if (typeof rawJson !== "string") throw new Error("Edit concept QA JSON must be a string")
  let parsed
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error("Edit concept QA JSON could not be parsed")
  }
  return validateSignatureSoundEditConceptQa(parsed, context)
}

function normalizeContext({ manifest, manifestSha256, playbackConfiguration }) {
  const structure = normalizeManifestStructure(manifest)
  return {
    ...structure,
    manifestSha256: requireSha256(manifestSha256, "Edit concept manifest SHA-256"),
    playbackConfiguration: normalizePlayback(playbackConfiguration),
  }
}

function normalizeManifestStructure(rawManifest) {
  const manifest = requireRecord(rawManifest, "Edit concept manifest")
  if (manifest.reviewKind !== "edit-audition" || manifest.batchId !== BATCH_ID ||
      manifest.groupId !== GROUP_ID) {
    throw new Error("Edit concept manifest identity is invalid")
  }
  const batchDeclarationSha256 = requireSha256(
    manifest.batchDeclarationSha256,
    "Edit concept declaration SHA-256",
  )
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length !== VARIANT_IDS.length) {
    throw new Error("Edit concept manifest must contain the exact three variants")
  }
  const variants = manifest.outputs.map((rawOutput, index) => {
    const output = requireRecord(rawOutput, `Edit concept manifest output ${index}`)
    const variantId = requireString(output.variantId, `Edit concept manifest output ${index} variant`)
    if (variantId !== VARIANT_IDS[index]) throw new Error("Edit concept manifest variant identities drifted")
    return {
      variantId,
      variantLabel: requireString(output.variantLabel, `Edit concept manifest ${variantId} label`),
      outputIdentity: requireSha256(output.outputIdentity, `Edit concept manifest ${variantId} output identity`),
    }
  })
  if (new Set(variants.map(({ outputIdentity }) => outputIdentity)).size !== variants.length) {
    throw new Error("Edit concept manifest output identity is duplicated")
  }
  return {
    batchId: BATCH_ID,
    batchDeclarationSha256,
    groupId: GROUP_ID,
    variants,
  }
}

function normalizePlayback(rawPlayback) {
  const playback = requireRecord(rawPlayback, "Edit concept playback configuration")
  assertOnlyFields(playback, PLAYBACK_FIELDS, "Edit concept playback configuration")
  const settings = requireRecord(playback.previewSettings, "Edit concept playback settings")
  assertOnlyFields(settings, SETTINGS_FIELDS, "Edit concept playback settings")
  if (playback.strategyId !== "adaptive-whole-source-sequence" ||
      settings.transitionMode !== "crossfade" || settings.transitionSeconds !== 2 ||
      playback.minimumSelectionsBeforeRepeat !== null ||
      !Array.isArray(playback.constraints) || playback.constraints.length !== 0) {
    throw new Error("Edit concept playback configuration does not match Boiling Water construction")
  }
  return {
    strategyId: "adaptive-whole-source-sequence",
    previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
    minimumSelectionsBeforeRepeat: null,
    constraints: [],
  }
}

function clonePlayback(playback) {
  return {
    strategyId: playback.strategyId,
    previewSettings: { ...playback.previewSettings },
    minimumSelectionsBeforeRepeat: playback.minimumSelectionsBeforeRepeat,
    constraints: [],
  }
}

function normalizeCrossings(rawCrossings, label) {
  if (!Array.isArray(rawCrossings)) throw new Error(`${label} seam crossings must be an array`)
  const crossings = rawCrossings.map((value, index) => requireTimestamp(value, `${label} seam crossing ${index}`))
  if (new Set(crossings).size !== crossings.length) throw new Error(`${label} seam crossing is duplicated`)
  return crossings
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
