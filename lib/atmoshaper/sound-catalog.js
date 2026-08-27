// @ts-check

/** @typedef {"animals" | "nature" | "noise" | "places" | "rain" | "things" | "transport" | "urban"} MoodistCategory */
/** @typedef {"signature-required" | "native-generated"} SourceStrategy */
/** @typedef {{ id: string, label: string, category: MoodistCategory, upstreamAssetRef: string, sourceStrategy: SourceStrategy }} MoodistConcept */
/** @typedef {"explicit-pack-cc0" | "signature-sitewide-cc0" | "needs-origin-review"} EvidenceTier */
/** @typedef {"pending" | "pass" | "fail"} ReviewState */
/** @typedef {"pending" | "verified" | "failed"} ProcessingState */
/** @typedef {"active" | "rejected"} RejectionState */
/** @typedef {{ id: string, moodistConceptId?: string, proposedExtraConceptId?: string, proposedExtraConceptName?: string, discoveryPath: string, evidenceTier: EvidenceTier, evidenceRef: string, technicalState: ReviewState, listeningState: ReviewState, processingState: ProcessingState, rejectionState: RejectionState, rejectionReason: string | null }} SignatureSoundCandidate */
/** @typedef {{ version: number, candidates: unknown[] }} SignatureSoundDeclaration */

export const SIGNATURE_SOUND_DECLARATION_VERSION = 1

const EXPECTED_CATEGORY_COUNTS = Object.freeze({
  animals: 16,
  nature: 12,
  noise: 3,
  places: 16,
  rain: 8,
  things: 16,
  transport: 6,
  urban: 7,
})
const MOODIST_CATEGORIES = new Set(Object.keys(EXPECTED_CATEGORY_COUNTS))
const SOURCE_STRATEGIES = new Set(["signature-required", "native-generated"])
const NATIVE_NOISE_IDS = new Set(["white-noise", "pink-noise", "brown-noise"])
const EVIDENCE_TIERS = new Set([
  "explicit-pack-cc0",
  "signature-sitewide-cc0",
  "needs-origin-review",
])
const APPROVED_EVIDENCE_TIERS = new Set([
  "explicit-pack-cc0",
  "signature-sitewide-cc0",
])
const REVIEW_STATES = new Set(["pending", "pass", "fail"])
const PROCESSING_STATES = new Set(["pending", "verified", "failed"])
const REJECTION_STATES = new Set(["active", "rejected"])
const SIGNATURE_SITEWIDE_CC0_URL = "https://signaturesounds.org/about-"
const AUDIO_EVIDENCE_EXTENSION_PATTERN = /\.(?:aac|aif|aiff|flac|m4a|mp3|ogg|wav)$/i
const INVENTORY_FIELDS = new Set([
  "id", "label", "category", "upstreamAssetRef", "sourceStrategy",
])
const DECLARATION_FIELDS = new Set(["version", "candidates"])
const CANDIDATE_FIELDS = new Set([
  "id",
  "moodistConceptId",
  "proposedExtraConceptId",
  "proposedExtraConceptName",
  "discoveryPath",
  "evidenceTier",
  "evidenceRef",
  "technicalState",
  "listeningState",
  "processingState",
  "rejectionState",
  "rejectionReason",
])

/** @type {ReadonlyArray<readonly [string, string, MoodistCategory]>} */
const CANONICAL_MOODIST_IDENTITIES = Object.freeze([
  ["birds", "Birds", "animals"],
  ["seagulls", "Seagulls", "animals"],
  ["crickets", "Crickets", "animals"],
  ["wolf", "Wolf", "animals"],
  ["owl", "Owl", "animals"],
  ["frog", "Frog", "animals"],
  ["dog-barking", "Dog Barking", "animals"],
  ["horse-gallop", "Horse Gallop", "animals"],
  ["cat-purring", "Cat Purring", "animals"],
  ["crows", "Crows", "animals"],
  ["whale", "Whale", "animals"],
  ["beehive", "Beehive", "animals"],
  ["woodpecker", "Woodpecker", "animals"],
  ["chickens", "Chickens", "animals"],
  ["cows", "Cows", "animals"],
  ["sheep", "Sheep", "animals"],
  ["river", "River", "nature"],
  ["waves", "Waves", "nature"],
  ["campfire", "Campfire", "nature"],
  ["wind", "Wind", "nature"],
  ["howling-wind", "Howling Wind", "nature"],
  ["wind-in-trees", "Wind in Trees", "nature"],
  ["waterfall", "Waterfall", "nature"],
  ["walk-in-snow", "Walk in Snow", "nature"],
  ["walk-on-leaves", "Walk on Leaves", "nature"],
  ["walk-on-gravel", "Walk on Gravel", "nature"],
  ["droplets", "Droplets", "nature"],
  ["jungle", "Jungle", "nature"],
  ["white-noise", "White Noise", "noise"],
  ["pink-noise", "Pink Noise", "noise"],
  ["brown-noise", "Brown Noise", "noise"],
  ["cafe", "Cafe", "places"],
  ["airport", "Airport", "places"],
  ["church", "Church", "places"],
  ["temple", "Temple", "places"],
  ["construction-site", "Construction Site", "places"],
  ["underwater", "Underwater", "places"],
  ["crowded-bar", "Crowded Bar", "places"],
  ["night-village", "Night Village", "places"],
  ["subway-station", "Subway Station", "places"],
  ["office", "Office", "places"],
  ["supermarket", "Supermarket", "places"],
  ["carousel", "Carousel", "places"],
  ["laboratory", "Laboratory", "places"],
  ["laundry-room", "Laundry Room", "places"],
  ["restaurant", "Restaurant", "places"],
  ["library", "Library", "places"],
  ["light-rain", "Light Rain", "rain"],
  ["heavy-rain", "Heavy Rain", "rain"],
  ["thunder", "Thunder", "rain"],
  ["rain-on-window", "Rain on Window", "rain"],
  ["rain-on-car-roof", "Rain on Car Roof", "rain"],
  ["rain-on-umbrella", "Rain on Umbrella", "rain"],
  ["rain-on-tent", "Rain on Tent", "rain"],
  ["rain-on-leaves", "Rain on Leaves", "rain"],
  ["keyboard", "Keyboard", "things"],
  ["typewriter", "Typewriter", "things"],
  ["paper", "Paper", "things"],
  ["clock", "Clock", "things"],
  ["wind-chimes", "Wind Chimes", "things"],
  ["singing-bowl", "Singing Bowl", "things"],
  ["ceiling-fan", "Ceiling Fan", "things"],
  ["dryer", "Dryer", "things"],
  ["slide-projector", "Slide Projector", "things"],
  ["boiling-water", "Boiling Water", "things"],
  ["bubbles", "Bubbles", "things"],
  ["tuning-radio", "Tuning Radio", "things"],
  ["morse-code", "Morse Code", "things"],
  ["washing-machine", "Washing Machine", "things"],
  ["vinyl-effect", "Vinyl Effect", "things"],
  ["windshield-wipers", "Windshield Wipers", "things"],
  ["train", "Train", "transport"],
  ["inside-a-train", "Inside a Train", "transport"],
  ["airplane", "Airplane", "transport"],
  ["submarine", "Submarine", "transport"],
  ["sailboat", "Sailboat", "transport"],
  ["rowing-boat", "Rowing Boat", "transport"],
  ["highway", "Highway", "urban"],
  ["road", "Road", "urban"],
  ["ambulance-siren", "Ambulance Siren", "urban"],
  ["busy-street", "Busy Street", "urban"],
  ["crowd", "Crowd", "urban"],
  ["traffic", "Traffic", "urban"],
  ["fireworks", "Fireworks", "urban"],
])
const CANONICAL_MOODIST_BY_ID = new Map(CANONICAL_MOODIST_IDENTITIES.map(([
  id,
  label,
  category,
]) => [id, {
  id,
  label,
  category,
  upstreamAssetRef: `/sounds/${category}/${id}.${category === "noise" ? "wav" : "mp3"}`,
  sourceStrategy: NATIVE_NOISE_IDS.has(id) ? "native-generated" : "signature-required",
}]))

/**
 * Returns a copy-safe canonical projection for consumers that must authenticate
 * concept identity without taking ownership of or mutating Task 1's registry.
 * @returns {MoodistConcept[]}
 */
export function getCanonicalMoodistConceptProjection() {
  return [...CANONICAL_MOODIST_BY_ID.values()].map((concept) => (
    /** @type {MoodistConcept} */ ({ ...concept })
  ))
}

/**
 * Validates the complete canonical Moodist concept inventory. The strict total,
 * category totals, and native-noise rule make catalog drift fail closed.
 * @param {unknown} rawConcepts
 * @returns {MoodistConcept[]}
 */
export function validateMoodistConcepts(rawConcepts) {
  if (!Array.isArray(rawConcepts)) {
    throw new TypeError("AtmoShaper Moodist concepts must be an array")
  }
  /** @type {MoodistConcept[]} */
  const concepts = []
  const ids = new Set()
  const upstreamAssetRefs = new Set()
  const categoryCounts = Object.fromEntries(
    Object.keys(EXPECTED_CATEGORY_COUNTS).map((category) => [category, 0]),
  )

  for (const [index, rawConcept] of rawConcepts.entries()) {
    const concept = requirePlainRecord(rawConcept, `Moodist concept at index ${index}`)
    assertOnlyFields(concept, INVENTORY_FIELDS, "inventory")
    const id = requireNonBlankString(concept.id, "Moodist concept id")
    const label = requireNonBlankString(concept.label, `Moodist concept ${id} label`)
    const category = requireEnum(
      concept.category,
      MOODIST_CATEGORIES,
      `Moodist concept ${id} category`,
    )
    const upstreamAssetRef = requireNonBlankString(
      concept.upstreamAssetRef,
      `Moodist concept ${id} upstream asset reference`,
    )
    const sourceStrategy = requireEnum(
      concept.sourceStrategy,
      SOURCE_STRATEGIES,
      `Moodist concept ${id} source strategy`,
    )

    if (ids.has(id)) throw new Error(`Duplicate Moodist concept id: ${id}`)
    if (upstreamAssetRefs.has(upstreamAssetRef)) {
      throw new Error(`Duplicate Moodist upstream asset reference: ${upstreamAssetRef}`)
    }
    if (!upstreamAssetRef.startsWith(`/sounds/${category}/`)) {
      throw new Error(`Moodist concept ${id} upstream asset reference must belong to category ${category}`)
    }

    const canonical = CANONICAL_MOODIST_BY_ID.get(id)
    if (
      canonical === undefined
      || canonical.label !== label
      || canonical.category !== category
      || canonical.upstreamAssetRef !== upstreamAssetRef
      || canonical.sourceStrategy !== sourceStrategy
    ) {
      throw new Error(`Moodist concept ${id} does not match its canonical Moodist tuple`)
    }
    if (sourceStrategy === "native-generated" && category !== "noise") {
      throw new Error(`Moodist concept ${id} native-generated source must be in the noise category`)
    }

    ids.add(id)
    upstreamAssetRefs.add(upstreamAssetRef)
    categoryCounts[category] += 1
    concepts.push(/** @type {MoodistConcept} */ ({
      id,
      label,
      category,
      upstreamAssetRef,
      sourceStrategy,
    }))
  }

  if (concepts.length !== 84) {
    throw new Error(`AtmoShaper Moodist inventory must contain exactly 84 concepts; received ${concepts.length}`)
  }
  for (const [category, expectedCount] of Object.entries(EXPECTED_CATEGORY_COUNTS)) {
    if (categoryCounts[category] !== expectedCount) {
      throw new Error(
        `Moodist category ${category} must contain ${expectedCount} concepts; received ${categoryCounts[category]}`,
      )
    }
  }
  return concepts
}

/**
 * Validates declared local Signature candidates without reading the filesystem.
 * Paths remain pack-relative so declarations cannot smuggle Moodist media or
 * machine-specific absolute locations into later scanner work.
 * @param {unknown} rawDeclaration
 * @param {unknown} rawMoodistConcepts
 * @returns {SignatureSoundCandidate[]}
 */
export function validateSignatureSoundCandidates(rawDeclaration, rawMoodistConcepts) {
  const declaration = requirePlainRecord(rawDeclaration, "Signature sound declaration")
  assertOnlyFields(declaration, DECLARATION_FIELDS, "declaration")
  if (declaration.version !== SIGNATURE_SOUND_DECLARATION_VERSION) {
    throw new Error(`Unsupported Signature sound declaration version: ${String(declaration.version)}`)
  }
  if (!Array.isArray(declaration.candidates)) {
    throw new TypeError("Signature sound declaration candidates must be an array")
  }

  const moodistConcepts = validateMoodistConcepts(rawMoodistConcepts)
  const moodistIds = new Set(moodistConcepts.map(({ id }) => id))
  const moodistIdentityKeys = new Set(moodistConcepts.map(({ id }) => normalizeIdentity(id)))
  const moodistById = new Map(moodistConcepts.map((concept) => [concept.id, concept]))
  const moodistLabels = new Set(moodistConcepts.map(({ label }) => normalizeIdentity(label)))
  const moodistAssetRefs = new Set(
    moodistConcepts.map(({ upstreamAssetRef }) => upstreamAssetRef.slice(1).toLowerCase()),
  )
  const candidateIds = new Set()
  const extraConceptIds = new Set()
  const extraConceptNames = new Set()

  return declaration.candidates.map((rawCandidate, index) => {
    const candidate = requirePlainRecord(rawCandidate, `Signature candidate at index ${index}`)
    assertOnlyFields(candidate, CANDIDATE_FIELDS, "candidate")
    const id = requireCanonicalIdentifier(candidate.id, "Signature candidate id")
    const candidateIdentity = normalizeIdentity(id)
    if (candidateIds.has(candidateIdentity)) throw new Error(`Duplicate Signature candidate id: ${id}`)
    if (!hasOwn(candidate, "rejectionReason")) {
      throw new Error(`Signature candidate ${id} rejectionReason field is required`)
    }

    const hasMoodistConcept = hasOwn(candidate, "moodistConceptId")
    const hasExtraId = hasOwn(candidate, "proposedExtraConceptId")
    const hasExtraName = hasOwn(candidate, "proposedExtraConceptName")
    if (hasMoodistConcept && (hasExtraId || hasExtraName)) {
      throw new Error(
        `Signature candidate ${id} must use either a Moodist candidate shape or an extra concept shape: `
        + "Moodist concept field cannot appear on an extra candidate; "
        + "extra concept field cannot appear on a Moodist candidate",
      )
    }
    if (
      !hasMoodistConcept
      && (
        !hasExtraId
        || !hasExtraName
        || candidate.proposedExtraConceptId === undefined
        || candidate.proposedExtraConceptName === undefined
      )
    ) {
      throw new Error(`Signature candidate ${id} extra concept must include both id and name`)
    }

    const discoveryPath = requirePackRelativeDiscoveryPath(candidate.discoveryPath, id, moodistAssetRefs)
    const evidenceTier = requireEnum(
      candidate.evidenceTier,
      EVIDENCE_TIERS,
      `Signature candidate ${id} evidence tier`,
    )
    const evidenceRef = requireNonBlankString(
      candidate.evidenceRef,
      `Signature candidate ${id} evidence ref`,
    )
    const technicalState = requireEnum(
      candidate.technicalState,
      REVIEW_STATES,
      `Signature candidate ${id} technical state`,
    )
    const listeningState = requireEnum(
      candidate.listeningState,
      REVIEW_STATES,
      `Signature candidate ${id} listening state`,
    )
    const processingState = requireEnum(
      candidate.processingState,
      PROCESSING_STATES,
      `Signature candidate ${id} processing state`,
    )
    const rejectionState = requireEnum(
      candidate.rejectionState,
      REJECTION_STATES,
      `Signature candidate ${id} rejection state`,
    )

    /** @type {string | undefined} */
    let moodistConceptId
    /** @type {string | undefined} */
    let proposedExtraConceptId
    /** @type {string | undefined} */
    let proposedExtraConceptName
    if (hasMoodistConcept) {
      moodistConceptId = requireCanonicalIdentifier(
        candidate.moodistConceptId,
        `Signature candidate ${id} Moodist concept id`,
      )
      if (!moodistIds.has(moodistConceptId)) {
        throw new Error(`Unknown Moodist concept id for Signature candidate ${id}: ${moodistConceptId}`)
      }
      if (moodistById.get(moodistConceptId)?.sourceStrategy === "native-generated") {
        throw new Error(`Signature candidate ${id} cannot map to native-generated concept ${moodistConceptId}`)
      }
    } else {
      proposedExtraConceptId = requireCanonicalIdentifier(
        candidate.proposedExtraConceptId,
        `Signature candidate ${id} extra concept id`,
      )
      proposedExtraConceptName = requireNonBlankString(
        candidate.proposedExtraConceptName,
        `Signature candidate ${id} extra concept name`,
      ).trim()
      const extraIdIdentity = normalizeIdentity(proposedExtraConceptId)
      if (moodistIdentityKeys.has(extraIdIdentity)) {
        throw new Error(`Signature candidate ${id} extra concept id collides with a Moodist concept: ${proposedExtraConceptId}`)
      }
      if (extraConceptIds.has(extraIdIdentity)) {
        throw new Error(`Duplicate Signature extra concept id: ${proposedExtraConceptId}`)
      }
      const normalizedExtraName = normalizeIdentity(proposedExtraConceptName)
      if (moodistLabels.has(normalizedExtraName)) {
        throw new Error(`Signature candidate ${id} extra concept name collides with a Moodist concept: ${proposedExtraConceptName}`)
      }
      if (extraConceptNames.has(normalizedExtraName)) {
        throw new Error(`Duplicate Signature extra concept name: ${proposedExtraConceptName}`)
      }
      extraConceptIds.add(extraIdIdentity)
      extraConceptNames.add(normalizedExtraName)
    }

    if ((listeningState === "pass" || listeningState === "fail") && technicalState !== "pass") {
      throw new Error(`Signature candidate ${id} listening ${listeningState} requires technical pass`)
    }
    if (
      (processingState === "verified" || processingState === "failed")
      && (technicalState !== "pass" || listeningState !== "pass")
    ) {
      throw new Error(
        `Signature candidate ${id} processing ${processingState} requires technical pass and listening pass`,
      )
    }
    if (
      rejectionState === "active"
      && (technicalState === "fail" || listeningState === "fail" || processingState === "failed")
    ) {
      throw new Error(`Signature candidate ${id} with a failed gate must be rejected`)
    }

    /** @type {string | null} */
    let rejectionReason = null
    if (rejectionState === "rejected") {
      rejectionReason = requireNonBlankString(
        candidate.rejectionReason,
        `Signature candidate ${id} rejection reason`,
      )
    } else if (candidate.rejectionReason !== null) {
      throw new Error(`Active candidate ${id} cannot have a rejection reason`)
    }

    candidateIds.add(candidateIdentity)
    const validatedFields = {
      id,
      discoveryPath,
      evidenceTier,
      evidenceRef,
      technicalState,
      listeningState,
      processingState,
      rejectionState,
      rejectionReason,
    }
    if (moodistConceptId !== undefined) {
      const validatedCandidate = /** @type {SignatureSoundCandidate} */ ({
        moodistConceptId,
        ...validatedFields,
      })
      classifySignatureSoundCandidateSemantics(validatedCandidate)
      return validatedCandidate
    }
    const validatedCandidate = /** @type {SignatureSoundCandidate} */ ({
      proposedExtraConceptId,
      proposedExtraConceptName,
      ...validatedFields,
    })
    classifySignatureSoundCandidateSemantics(validatedCandidate)
    return validatedCandidate
  })
}

/**
 * Derives the four audit outcomes without treating a filename as approval.
 * Qualification requires explicit license evidence plus all three review gates;
 * generated noise is deliberately absent from source gaps.
 * @param {unknown} rawMoodistConcepts
 * @param {unknown} rawDeclaration
 */
export function deriveSignatureSoundCatalog(rawMoodistConcepts, rawDeclaration) {
  const moodistConcepts = validateMoodistConcepts(rawMoodistConcepts)
  const candidates = validateSignatureSoundCandidates(rawDeclaration, moodistConcepts)
  const qualifiedMoodistMatches = []
  const needsAuditionOrProcessing = []
  const signatureExtraConcepts = []
  const representedMoodistIds = new Set()

  for (const candidate of candidates) {
    if (candidate.rejectionState === "rejected") continue
    if (candidate.moodistConceptId === undefined) {
      signatureExtraConcepts.push(candidate)
      continue
    }

    representedMoodistIds.add(candidate.moodistConceptId)
    if (isQualified(candidate)) qualifiedMoodistMatches.push(candidate)
    else needsAuditionOrProcessing.push(candidate)
  }

  const recordingOrSourceGaps = moodistConcepts.filter((concept) => (
    concept.sourceStrategy !== "native-generated" && !representedMoodistIds.has(concept.id)
  ))

  return {
    qualifiedMoodistMatches,
    needsAuditionOrProcessing,
    recordingOrSourceGaps,
    signatureExtraConcepts,
  }
}

/**
 * Returns Moodist-mapped candidates whose accepted evidence and completed
 * technical/listening gates make them safe to plan. Processing may still be
 * pending: the processing plan is the input to later processing verification,
 * not evidence that runtime qualification has already happened.
 * @param {unknown} rawMoodistConcepts
 * @param {unknown} rawDeclaration
 */
export function deriveSignatureSoundProcessingPlanCandidates(rawMoodistConcepts, rawDeclaration) {
  const moodistConcepts = validateMoodistConcepts(rawMoodistConcepts)
  return validateSignatureSoundCandidates(rawDeclaration, moodistConcepts)
    .filter(isSignatureSoundProcessingPlanEligible)
}

/** @param {SignatureSoundCandidate} candidate */
export function isSignatureSoundProcessingPlanEligible(candidate) {
  return candidate.moodistConceptId !== undefined
    && candidate.rejectionState === "active"
    && APPROVED_EVIDENCE_TIERS.has(candidate.evidenceTier)
    && candidate.technicalState === "pass"
    && candidate.listeningState === "pass"
    && (candidate.processingState === "pending" || candidate.processingState === "verified")
}

/**
 * Owns pure evidence, gate-order, rejection, and outcome semantics shared by
 * declarations and normalized filesystem audits. It performs no I/O.
 * @param {SignatureSoundCandidate} candidate
 * @returns {"rejected" | "signature-extra" | "qualified-moodist" | "pending-moodist"}
 */
export function classifySignatureSoundCandidateSemantics(candidate) {
  const id = typeof candidate.id === "string" && candidate.id.trim() !== "" ? candidate.id : "unknown"
  validateSignatureSoundEvidenceReference(candidate.evidenceTier, candidate.evidenceRef, id)
  if (
    (candidate.listeningState === "pass" || candidate.listeningState === "fail")
    && candidate.technicalState !== "pass"
  ) {
    throw new Error(`Signature candidate ${id} listening ${candidate.listeningState} requires technical pass`)
  }
  if (
    (candidate.processingState === "verified" || candidate.processingState === "failed")
    && (candidate.technicalState !== "pass" || candidate.listeningState !== "pass")
  ) {
    throw new Error(`Signature candidate ${id} processing ${candidate.processingState} requires technical pass and listening pass`)
  }
  if (
    candidate.rejectionState === "active"
    && (
      candidate.technicalState === "fail"
      || candidate.listeningState === "fail"
      || candidate.processingState === "failed"
    )
  ) {
    throw new Error(`Signature candidate ${id} with a failed gate must be rejected`)
  }
  if (candidate.rejectionState === "rejected") {
    requireNonBlankString(candidate.rejectionReason, `Signature candidate ${id} rejection reason`)
    return "rejected"
  }
  if (candidate.rejectionReason !== null) throw new Error(`Active candidate ${id} cannot have a rejection reason`)
  if (candidate.moodistConceptId === undefined) return "signature-extra"
  return isQualified(candidate) ? "qualified-moodist" : "pending-moodist"
}

/** @param {unknown} evidenceTier @param {unknown} evidenceRef @param {string} candidateId */
function validateSignatureSoundEvidenceReference(evidenceTier, evidenceRef, candidateId) {
  const reference = requireNonBlankString(evidenceRef, `Signature candidate ${candidateId} evidence ref`)
  if (evidenceTier === "signature-sitewide-cc0") {
    if (reference !== SIGNATURE_SITEWIDE_CC0_URL) {
      throw new Error(`Signature candidate ${candidateId} evidence must use the exact Signature Sounds sitewide CC0 URL`)
    }
    return
  }
  if (evidenceTier === "needs-origin-review") return
  if (evidenceTier !== "explicit-pack-cc0") {
    throw new Error(`Signature candidate ${candidateId} evidence tier is unsupported`)
  }
  const segments = reference.split("/")
  if (
    reference !== reference.trim()
    || reference.includes("\\")
    || reference.startsWith("/")
    || /^[A-Za-z][A-Za-z\d+.-]*:/.test(reference)
    || /[\u0000-\u001f\u007f]/.test(reference)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Signature candidate ${candidateId} evidence must be a safe pack-relative path`)
  }
  if (AUDIO_EVIDENCE_EXTENSION_PATTERN.test(reference)) {
    throw new Error(`Signature candidate ${candidateId} evidence must be a non-audio file`)
  }
}

/** @param {SignatureSoundCandidate} candidate */
function isQualified(candidate) {
  return candidate.rejectionState === "active"
    && APPROVED_EVIDENCE_TIERS.has(candidate.evidenceTier)
    && candidate.technicalState === "pass"
    && candidate.listeningState === "pass"
    && candidate.processingState === "verified"
}

/** @param {unknown} value @param {string} candidateId @param {Set<string>} moodistAssetRefs */
function requirePackRelativeDiscoveryPath(value, candidateId, moodistAssetRefs) {
  const path = requireNonBlankString(value, `Signature candidate ${candidateId} pack-relative discovery path`)
  if (path !== path.trim()) {
    throw new Error(`Signature candidate ${candidateId} discovery path cannot contain surrounding whitespace`)
  }
  const normalized = path.replaceAll("\\", "/")
  const isAbsolute = normalized.startsWith("/")
    || /^[A-Za-z][A-Za-z\d+.-]*:/.test(normalized)
  const escapesPack = normalized.split("/").includes("..")
  if (isAbsolute || escapesPack) {
    throw new Error(`Signature candidate ${candidateId} must use a pack-relative discovery path`)
  }
  const lowerPath = normalized.toLowerCase()
  const namespaceSegments = lowerPath.split("/").filter((segment) => segment !== "" && segment !== ".")
  const hasPublicSoundsNamespace = namespaceSegments.some((segment, index) => (
    segment === "public" && namespaceSegments[index + 1] === "sounds"
  ))
  const isKnownMoodistAsset = [...moodistAssetRefs].some((assetRef) => (
    lowerPath === assetRef || lowerPath.endsWith(`/${assetRef}`)
  ))
  if (
    namespaceSegments.includes("moodist")
    || hasPublicSoundsNamespace
    || namespaceSegments[0] === "sounds"
    || isKnownMoodistAsset
  ) {
    throw new Error(`Signature candidate ${candidateId} cannot use Moodist source media`)
  }
  return path
}

/** @param {Record<string, unknown>} record @param {Set<string>} allowed @param {string} recordKind */
function assertOnlyFields(record, allowed, recordKind) {
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) throw new Error(`Unknown AtmoShaper ${recordKind} field: ${field}`)
  }
}

/** @param {Record<string, unknown>} record @param {string} field */
function hasOwn(record, field) {
  return Object.prototype.hasOwnProperty.call(record, field)
}

/** @param {unknown} value @param {string} label */
function requireCanonicalIdentifier(value, label) {
  const identifier = requireNonBlankString(value, label)
  if (identifier !== identifier.trim()) {
    throw new TypeError(`AtmoShaper ${label} cannot contain surrounding whitespace`)
  }
  return identifier
}

/** Identity keys are comparison-only; validated display casing remains intact. @param {string} value */
function normalizeIdentity(value) {
  return value.trim().toLowerCase()
}

/** @param {unknown} value @param {Set<string>} allowed @param {string} label */
function requireEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new TypeError(`Unknown AtmoShaper ${label}: ${String(value)}`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireNonBlankString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`AtmoShaper ${label} must be a non-blank string`)
  }
  return value
}

/** @param {unknown} value @param {string} label @returns {Record<string, unknown>} */
function requirePlainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`AtmoShaper ${label} must be a plain object`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`AtmoShaper ${label} must be a plain object`)
  }
  return /** @type {Record<string, unknown>} */ (value)
}
