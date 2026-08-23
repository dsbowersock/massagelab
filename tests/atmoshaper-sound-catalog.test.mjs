import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as soundCatalogModule from "../lib/atmoshaper/sound-catalog.js"

const {
  deriveSignatureSoundCatalog,
  validateMoodistConcepts,
  validateSignatureSoundCandidates,
} = soundCatalogModule

const moodistConcepts = readJson("../data/atmoshaper/moodist-concepts.json")
const signatureDeclaration = readJson("../data/atmoshaper/signature-sound-candidates.json")

const EXPECTED_IDS_BY_CATEGORY = {
  animals: [
    "birds", "seagulls", "crickets", "wolf", "owl", "frog", "dog-barking",
    "horse-gallop", "cat-purring", "crows", "whale", "beehive", "woodpecker",
    "chickens", "cows", "sheep",
  ],
  nature: [
    "river", "waves", "campfire", "wind", "howling-wind", "wind-in-trees",
    "waterfall", "walk-in-snow", "walk-on-leaves", "walk-on-gravel", "droplets",
    "jungle",
  ],
  noise: ["white-noise", "pink-noise", "brown-noise"],
  places: [
    "cafe", "airport", "church", "temple", "construction-site", "underwater",
    "crowded-bar", "night-village", "subway-station", "office", "supermarket",
    "carousel", "laboratory", "laundry-room", "restaurant", "library",
  ],
  rain: [
    "light-rain", "heavy-rain", "thunder", "rain-on-window", "rain-on-car-roof",
    "rain-on-umbrella", "rain-on-tent", "rain-on-leaves",
  ],
  things: [
    "keyboard", "typewriter", "paper", "clock", "wind-chimes", "singing-bowl",
    "ceiling-fan", "dryer", "slide-projector", "boiling-water", "bubbles",
    "tuning-radio", "morse-code", "washing-machine", "vinyl-effect",
    "windshield-wipers",
  ],
  transport: ["train", "inside-a-train", "airplane", "submarine", "sailboat", "rowing-boat"],
  urban: ["highway", "road", "ambulance-siren", "busy-street", "crowd", "traffic", "fireworks"],
}

test("the canonical inventory contains the exact 84 non-binaural Moodist concepts", () => {
  const validated = validateMoodistConcepts(moodistConcepts)

  assert.equal(validated.length, 84)
  assert.equal(new Set(validated.map(({ id }) => id)).size, 84)
  assert.deepEqual(
    Object.fromEntries(Object.keys(EXPECTED_IDS_BY_CATEGORY).map((category) => [
      category,
      validated.filter((concept) => concept.category === category).map(({ id }) => id),
    ])),
    EXPECTED_IDS_BY_CATEGORY,
  )

  const expectedLabels = {
    birds: "Birds",
    "wind-in-trees": "Wind in Trees",
    "brown-noise": "Brown Noise",
    laboratory: "Laboratory",
    "rain-on-car-roof": "Rain on Car Roof",
    "singing-bowl": "Singing Bowl",
    "inside-a-train": "Inside a Train",
    "ambulance-siren": "Ambulance Siren",
  }
  for (const [id, label] of Object.entries(expectedLabels)) {
    assert.equal(validated.find((concept) => concept.id === id)?.label, label)
  }

  for (const concept of validated) {
    const extension = concept.category === "noise" ? "wav" : "mp3"
    assert.equal(concept.upstreamAssetRef, `/sounds/${concept.category}/${concept.id}.${extension}`)
    assert.notEqual(concept.category, "binaural")
  }
})

test("only white, pink, and brown noise are native-generated", () => {
  const nativeGenerated = moodistConcepts
    .filter(({ sourceStrategy }) => sourceStrategy === "native-generated")
    .map(({ id }) => id)

  assert.deepEqual(nativeGenerated, ["white-noise", "pink-noise", "brown-noise"])
  assert.equal(
    moodistConcepts.filter(({ sourceStrategy }) => sourceStrategy === "signature-required").length,
    81,
  )
})

test("inventory validation rejects drift in every canonical Moodist tuple field", () => {
  for (const driftedInventory of [
    replaceConcept("birds", {
      id: "songbirds",
      upstreamAssetRef: "/sounds/animals/songbirds.mp3",
    }),
    replaceConcept("birds", { label: "Song Birds" }),
    replaceConcept("birds", {
      category: "nature",
      upstreamAssetRef: "/sounds/nature/birds.mp3",
    }),
    replaceConcept("birds", { upstreamAssetRef: "/sounds/animals/songbirds.mp3" }),
    replaceConcept("birds", { sourceStrategy: "native-generated" }),
  ]) {
    assert.throws(
      () => validateMoodistConcepts(driftedInventory),
      /canonical Moodist/i,
    )
  }
})

test("inventory records reject unknown fields", () => {
  assert.throws(
    () => validateMoodistConcepts(replaceConcept("birds", { notes: "looks plausible" })),
    /unknown.*inventory field.*notes/i,
  )
})

test("inventory validation rejects malformed fields, unknown enums, duplicates, and drift", () => {
  assert.throws(
    () => validateMoodistConcepts(replaceConcept("birds", { label: " " })),
    /label/i,
  )
  assert.throws(
    () => validateMoodistConcepts(replaceConcept("birds", { category: "weather" })),
    /category/i,
  )
  assert.throws(
    () => validateMoodistConcepts(replaceConcept("birds", { sourceStrategy: "filename-approved" })),
    /source strategy/i,
  )
  assert.throws(
    () => validateMoodistConcepts([...moodistConcepts, moodistConcepts[0]]),
    /duplicate.*concept id/i,
  )
  assert.throws(
    () => validateMoodistConcepts(moodistConcepts.slice(1)),
    /exactly 84/i,
  )
})

test("the Signature declaration is versioned and keeps every discovered candidate unqualified", () => {
  assert.equal(signatureDeclaration.version, 1)
  assert.equal(signatureDeclaration.candidates.length, 16)
  const validatedCandidates = validateSignatureSoundCandidates(
    signatureDeclaration,
    moodistConcepts,
  )
  assert.equal(validatedCandidates.length, signatureDeclaration.candidates.length)
  assert.equal(validatedCandidates.filter(({ moodistConceptId }) => moodistConceptId !== undefined).length, 7)
  assert.equal(validatedCandidates.filter(({ proposedExtraConceptId }) => proposedExtraConceptId !== undefined).length, 9)
  assert.equal(validatedCandidates.filter(({ evidenceTier }) => evidenceTier === "needs-origin-review").length, 0)
  for (const candidate of validatedCandidates) {
    assert.ok(
      candidate.evidenceTier === "explicit-pack-cc0"
        || candidate.evidenceTier === "signature-sitewide-cc0",
      `candidate ${candidate.id} must use accepted CC0 evidence`,
    )
    if (candidate.evidenceTier === "signature-sitewide-cc0") {
      assert.equal(candidate.evidenceRef, "https://signaturesounds.org/about-")
    }
    assert.equal(candidate.technicalState, "pending")
    assert.equal(candidate.listeningState, "pending")
    assert.equal(candidate.processingState, "pending")
    assert.equal(candidate.rejectionState, "active")
    assert.equal(candidate.rejectionReason, null)
  }
  assert.deepEqual(
    deriveSignatureSoundCatalog(moodistConcepts, signatureDeclaration).qualifiedMoodistMatches,
    [],
  )
})

test("the top-level Signature declaration rejects unknown fields", () => {
  assert.throws(
    () => validateSignatureSoundCandidates({
      version: 1,
      candidates: [],
      generatedAt: "2026-08-23",
    }, moodistConcepts),
    /unknown.*declaration field.*generatedAt/i,
  )
})

test("candidate records reject unknown fields and hidden fields from the opposite shape", () => {
  assert.throws(
    () => validateCandidates([moodistCandidate({ shippingPath: "processed/rain.opus" })]),
    /unknown.*candidate field.*shippingPath/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ proposedExtraConceptId: undefined })]),
    /extra concept field.*Moodist candidate/i,
  )

  const hiddenMoodistField = extraCandidate()
  hiddenMoodistField.moodistConceptId = undefined
  assert.throws(
    () => validateCandidates([hiddenMoodistField]),
    /Moodist concept field.*extra candidate/i,
  )
})

test("candidate validation rejects unsupported versions, malformed fields, and unknown enums", () => {
  assert.throws(
    () => validateSignatureSoundCandidates({ version: 2, candidates: [] }, moodistConcepts),
    /unsupported.*version/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ id: " " })]),
    /candidate id/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ moodistConceptId: "not-a-concept" })]),
    /unknown Moodist concept id/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ evidenceTier: "filename-seems-cc0" })]),
    /evidence tier/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ technicalState: "probably-pass" })]),
    /technical state/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ listeningState: "probably-pass" })]),
    /listening state/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ processingState: "probably-verified" })]),
    /processing state/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ rejectionState: "maybe" })]),
    /rejection state/i,
  )
})

test("candidate validation rejects absolute, escaping, and Moodist-media discovery paths", () => {
  for (const discoveryPath of [
    "C:\\audio\\Signature Samples\\rain.wav",
    "C:audio\\Signature Samples\\rain.wav",
    "/Signature Samples/rain.wav",
    "\\\\server\\share\\rain.wav",
    "file:C:/audio/Signature Samples/rain.wav",
    "../outside-the-pack/rain.wav",
  ]) {
    assert.throws(
      () => validateCandidates([moodistCandidate({ discoveryPath })]),
      /pack-relative discovery path/i,
    )
  }
  for (const discoveryPath of [
    "moodist/public/sounds/rain/light-rain.mp3",
    "public/sounds/rain/light-rain.mp3",
    "sounds/rain/light-rain.mp3",
    "public/sounds/unlisted/mystery.mp3",
    "repo/PUBLIC/SOUNDS/BINAURAL/alpha.mp3",
    "SOUNDS/binaural/alpha.mp3",
    "mirror/SOUNDS/rain/light-rain.mp3",
  ]) {
    assert.throws(
      () => validateCandidates([moodistCandidate({ discoveryPath })]),
      /Moodist.*media/i,
    )
  }

  assert.doesNotThrow(() => validateCandidates([moodistCandidate({
    discoveryPath: "Signature Sounds/Field moodist-public-sounds-rain.wav",
  })]))
})

test("discovery paths reject surrounding whitespace before URI analysis", () => {
  assert.throws(
    () => validateCandidates([moodistCandidate({
      discoveryPath: "  https://example.com/rain.wav",
    })]),
    /discovery path.*surrounding whitespace/i,
  )
})

test("legitimate nested Sounds pack folders are not treated as Moodist media", () => {
  assert.doesNotThrow(() => validateCandidates([moodistCandidate({
    discoveryPath: "Signature Rain Pack/Sounds/rain.wav",
  })]))
  assert.doesNotThrow(() => validateCandidates([moodistCandidate({
    discoveryPath: "Archive/SOUNDS/custom/unknown.mp3",
  })]))
})

test("candidate validation rejects duplicates, ambiguous extras, and extra-id collisions", () => {
  const candidate = moodistCandidate()
  assert.throws(
    () => validateCandidates([candidate, candidate]),
    /duplicate.*candidate id/i,
  )
  assert.throws(
    () => validateCandidates([extraCandidate({ proposedExtraConceptName: undefined })]),
    /extra concept.*id and name/i,
  )
  assert.throws(
    () => validateCandidates([extraCandidate({ moodistConceptId: "light-rain" })]),
    /either.*Moodist.*or.*extra concept/i,
  )
  assert.throws(
    () => validateCandidates([extraCandidate({ proposedExtraConceptId: "light-rain" })]),
    /extra concept id.*Moodist/i,
  )
  assert.throws(
    () => validateCandidates([extraCandidate({ proposedExtraConceptName: "Light Rain" })]),
    /extra concept name.*Moodist/i,
  )
  assert.throws(
    () => validateCandidates([
      extraCandidate(),
      extraCandidate({ id: "signature-extra-2", discoveryPath: "Extra Pack/two.wav" }),
    ]),
    /duplicate.*extra concept id/i,
  )
  assert.throws(
    () => validateCandidates([
      extraCandidate(),
      extraCandidate({
        id: "signature-extra-2",
        proposedExtraConceptId: "another-room-tone",
        discoveryPath: "Extra Pack/two.wav",
      }),
    ]),
    /duplicate.*extra concept name/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ moodistConceptId: "white-noise" })]),
    /native-generated/i,
  )
})

test("candidate and extra identities cannot bypass collisions with case or outer whitespace", () => {
  assert.throws(
    () => validateCandidates([
      moodistCandidate(),
      moodistCandidate({
        id: "SIGNATURE-LIGHT-RAIN",
        moodistConceptId: "heavy-rain",
        discoveryPath: "Weather Pack/heavy-rain.wav",
      }),
    ]),
    /duplicate.*candidate id/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ id: " signature-light-rain " })]),
    /candidate id.*surrounding whitespace/i,
  )
  assert.throws(
    () => validateCandidates([extraCandidate({ proposedExtraConceptId: "LIGHT-RAIN" })]),
    /extra concept id.*Moodist/i,
  )
  assert.throws(
    () => validateCandidates([extraCandidate({ proposedExtraConceptName: "  LIGHT RAIN  " })]),
    /extra concept name.*Moodist/i,
  )
  assert.throws(
    () => validateCandidates([
      extraCandidate(),
      extraCandidate({
        id: "signature-extra-2",
        proposedExtraConceptId: "SOFT-ROOM-TONE",
        proposedExtraConceptName: "Different Name",
        discoveryPath: "Extra Pack/two.wav",
      }),
    ]),
    /duplicate.*extra concept id/i,
  )
  assert.throws(
    () => validateCandidates([
      extraCandidate(),
      extraCandidate({
        id: "signature-extra-2",
        proposedExtraConceptId: "another-room-tone",
        proposedExtraConceptName: "  SOFT ROOM TONE  ",
        discoveryPath: "Extra Pack/two.wav",
      }),
    ]),
    /duplicate.*extra concept name/i,
  )
})

test("candidate validation enforces gate ordering and explicit rejection reasons", () => {
  assert.throws(
    () => validateCandidates([moodistCandidate({ technicalState: "pending" })]),
    /listening pass.*technical pass/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ listeningState: "pending" })]),
    /processing verified.*listening pass/i,
  )
  assert.throws(
    () => validateCandidates([pendingCandidate({ technicalState: "fail" })]),
    /failed gate.*rejected/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({
      rejectionState: "rejected",
      rejectionReason: null,
    })]),
    /rejection reason/i,
  )
  assert.throws(
    () => validateCandidates([moodistCandidate({ rejectionReason: "not clean" })]),
    /active candidate.*rejection reason/i,
  )
  const missingActiveReason = moodistCandidate()
  delete missingActiveReason.rejectionReason
  assert.throws(
    () => validateCandidates([missingActiveReason]),
    /rejectionReason.*required/i,
  )
})

test("terminal failed gates remain rejected and cannot skip prerequisite reviews", () => {
  assert.throws(
    () => validateCandidates([rejectedCandidate({
      technicalState: "pending",
      listeningState: "fail",
      processingState: "pending",
    })]),
    /listening fail.*technical pass/i,
  )
  assert.throws(
    () => validateCandidates([rejectedCandidate({
      technicalState: "pass",
      listeningState: "pending",
      processingState: "failed",
    })]),
    /processing failed.*listening pass/i,
  )
  assert.throws(
    () => validateCandidates([rejectedCandidate({
      technicalState: "pending",
      listeningState: "pending",
      processingState: "failed",
    })]),
    /processing failed.*technical pass.*listening pass/i,
  )

  assert.doesNotThrow(() => validateCandidates([rejectedCandidate({
    technicalState: "pass",
    listeningState: "fail",
    processingState: "pending",
  })]))
  assert.doesNotThrow(() => validateCandidates([rejectedCandidate({
    technicalState: "pass",
    listeningState: "pass",
    processingState: "failed",
  })]))
})

test("derivation qualifies only licensed candidates with every required gate complete", () => {
  const explicitPack = moodistCandidate()
  const siteWide = moodistCandidate({
    id: "signature-sitewide",
    moodistConceptId: "heavy-rain",
    discoveryPath: "Weather Pack/heavy-rain.wav",
    evidenceTier: "signature-sitewide-cc0",
    evidenceRef: "https://signaturesounds.org/about-",
  })
  const originReview = moodistCandidate({
    id: "signature-origin-review",
    moodistConceptId: "thunder",
    discoveryPath: "Weather Pack/thunder.wav",
    evidenceTier: "needs-origin-review",
  })
  const pending = pendingCandidate({
    id: "signature-pending",
    moodistConceptId: "rain-on-window",
    discoveryPath: "Weather Pack/rain-on-window.wav",
  })

  const result = deriveSignatureSoundCatalog(
    moodistConcepts,
    declaration([explicitPack, siteWide, originReview, pending]),
  )

  assert.deepEqual(result.qualifiedMoodistMatches.map(({ id }) => id), [
    "signature-light-rain",
    "signature-sitewide",
  ])
  assert.deepEqual(result.needsAuditionOrProcessing.map(({ id }) => id), [
    "signature-origin-review",
    "signature-pending",
  ])
})

test("processing-plan eligibility precedes processing verification without changing runtime outcomes", () => {
  const deriveProcessingCandidates = soundCatalogModule.deriveSignatureSoundProcessingPlanCandidates
  assert.equal(typeof deriveProcessingCandidates, "function", "Task 1 must own processing-plan eligibility")
  const processingPending = moodistCandidate({ processingState: "pending" })
  const extra = extraCandidate({
    technicalState: "pass",
    listeningState: "pass",
    processingState: "verified",
  })
  const ineligible = [
    pendingCandidate({ id: "technical-pending", technicalState: "pending" }),
    moodistCandidate({ id: "listening-pending", moodistConceptId: "heavy-rain", listeningState: "pending", processingState: "pending" }),
    moodistCandidate({ id: "origin-review", moodistConceptId: "thunder", evidenceTier: "needs-origin-review" }),
    moodistCandidate({
      id: "rejected-processing",
      moodistConceptId: "rain-on-window",
      processingState: "failed",
      rejectionState: "rejected",
      rejectionReason: "Processing failed.",
    }),
  ]
  const candidates = [processingPending, extra, ...ineligible]

  const runtime = deriveSignatureSoundCatalog(moodistConcepts, declaration(candidates))
  const plannable = deriveProcessingCandidates(moodistConcepts, declaration(candidates))

  assert.deepEqual(runtime.qualifiedMoodistMatches, [])
  assert.deepEqual(plannable.map(({ id }) => id), [processingPending.id])
  assert.deepEqual(runtime.signatureExtraConcepts, [extra])
})

test("Task 1 owns pure candidate evidence, gate, and outcome classification semantics", () => {
  const classify = soundCatalogModule.classifySignatureSoundCandidateSemantics
  assert.equal(typeof classify, "function", "Task 1 must export candidate semantic classification")
  assert.equal(classify(moodistCandidate()), "qualified-moodist")
  assert.equal(classify(pendingCandidate()), "pending-moodist")
  assert.equal(classify(extraCandidate()), "signature-extra")
  assert.equal(classify(rejectedCandidate()), "rejected")
  assert.throws(
    () => classify(pendingCandidate({ listeningState: "pass" })),
    /listening.*technical pass/i,
  )
  assert.throws(
    () => classify(pendingCandidate({ evidenceTier: "signature-sitewide-cc0", evidenceRef: "C:\\proof.txt" })),
    /sitewide|evidence/i,
  )
})

test("canonical Moodist identity projection returns fresh copies owned by Task 1", () => {
  const getCanonicalProjection = soundCatalogModule.getCanonicalMoodistConceptProjection
  assert.equal(typeof getCanonicalProjection, "function", "Task 1 must export canonical identity safely")

  const first = getCanonicalProjection()
  const second = getCanonicalProjection()
  assert.equal(first.length, 84)
  assert.notStrictEqual(first, second)
  assert.notStrictEqual(first[0], second[0])
  const waves = first.find(({ id }) => id === "waves")
  assert.deepEqual(waves, {
    id: "waves",
    label: "Waves",
    category: "nature",
    upstreamAssetRef: "/sounds/nature/waves.mp3",
    sourceStrategy: "signature-required",
  })
  waves.label = "Fabricated Waves"
  assert.equal(getCanonicalProjection().find(({ id }) => id === "waves").label, "Waves")
})

test("derivation keeps extras as candidates and never automatically production-qualifies them", () => {
  const extra = extraCandidate()
  const result = deriveSignatureSoundCatalog(moodistConcepts, declaration([extra]))

  assert.deepEqual(result.signatureExtraConcepts, [extra])
  assert.deepEqual(result.qualifiedMoodistMatches, [])
  assert.deepEqual(result.needsAuditionOrProcessing, [])
})

test("derivation excludes rejected Signature-only extras from every candidate bucket", () => {
  const rejectedExtra = extraCandidate({
    technicalState: "fail",
    listeningState: "pending",
    processingState: "pending",
    rejectionState: "rejected",
    rejectionReason: "The candidate failed the technical gate.",
  })
  const result = deriveSignatureSoundCatalog(moodistConcepts, declaration([rejectedExtra]))

  assert.deepEqual(result.qualifiedMoodistMatches, [])
  assert.deepEqual(result.needsAuditionOrProcessing, [])
  assert.deepEqual(result.signatureExtraConcepts, [])
  assert.equal(result.recordingOrSourceGaps.length, 81)
  assert.ok(result.recordingOrSourceGaps.every(({ id }) => (
    id !== "white-noise" && id !== "pink-noise" && id !== "brown-noise"
  )))
})

test("derivation treats rejected-only matches as gaps and excludes native noise from gaps", () => {
  const rejected = moodistCandidate({
    id: "signature-rejected-birds",
    moodistConceptId: "birds",
    discoveryPath: "Bird Pack/birds.wav",
    technicalState: "fail",
    listeningState: "pending",
    processingState: "pending",
    rejectionState: "rejected",
    rejectionReason: "The file failed the technical gate.",
  })
  const result = deriveSignatureSoundCatalog(moodistConcepts, declaration([rejected]))
  const gapIds = result.recordingOrSourceGaps.map(({ id }) => id)

  assert.equal(result.recordingOrSourceGaps.length, 81)
  assert.ok(gapIds.includes("birds"))
  assert.ok(!gapIds.includes("white-noise"))
  assert.ok(!gapIds.includes("pink-noise"))
  assert.ok(!gapIds.includes("brown-noise"))
})

test("the four derived outcome buckets are mutually exclusive", () => {
  const qualified = moodistCandidate()
  const pending = pendingCandidate({
    id: "signature-campfire",
    moodistConceptId: "campfire",
    discoveryPath: "Fire Pack/campfire.wav",
  })
  const extra = extraCandidate()
  const result = deriveSignatureSoundCatalog(
    moodistConcepts,
    declaration([qualified, pending, extra]),
  )

  assert.deepEqual(Object.keys(result), [
    "qualifiedMoodistMatches",
    "needsAuditionOrProcessing",
    "recordingOrSourceGaps",
    "signatureExtraConcepts",
  ])
  assert.equal(result.recordingOrSourceGaps.length, 79)

  const candidateIds = [
    ...result.qualifiedMoodistMatches,
    ...result.needsAuditionOrProcessing,
    ...result.signatureExtraConcepts,
  ].map(({ id }) => id)
  assert.equal(new Set(candidateIds).size, candidateIds.length)

  const representedMoodistIds = new Set([
    ...result.qualifiedMoodistMatches,
    ...result.needsAuditionOrProcessing,
  ].map(({ moodistConceptId }) => moodistConceptId))
  assert.ok(result.recordingOrSourceGaps.every(({ id }) => !representedMoodistIds.has(id)))
})

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"))
}

function declaration(candidates) {
  return { version: 1, candidates }
}

function validateCandidates(candidates) {
  return validateSignatureSoundCandidates(declaration(candidates), moodistConcepts)
}

function moodistCandidate(overrides = {}) {
  return {
    id: "signature-light-rain",
    moodistConceptId: "light-rain",
    discoveryPath: "Weather Pack/light-rain.wav",
    evidenceTier: "explicit-pack-cc0",
    evidenceRef: "Weather Pack/LICENSE.txt",
    technicalState: "pass",
    listeningState: "pass",
    processingState: "verified",
    rejectionState: "active",
    rejectionReason: null,
    ...overrides,
  }
}

function pendingCandidate(overrides = {}) {
  return moodistCandidate({
    technicalState: "pending",
    listeningState: "pending",
    processingState: "pending",
    ...overrides,
  })
}

function rejectedCandidate(overrides = {}) {
  return moodistCandidate({
    technicalState: "pending",
    listeningState: "pending",
    processingState: "pending",
    rejectionState: "rejected",
    rejectionReason: "A review gate failed.",
    ...overrides,
  })
}

function extraCandidate(overrides = {}) {
  const candidate = moodistCandidate({
    id: "signature-extra",
    moodistConceptId: undefined,
    proposedExtraConceptId: "soft-room-tone",
    proposedExtraConceptName: "Soft Room Tone",
    discoveryPath: "Interior Pack/soft-room-tone.wav",
    ...overrides,
  })
  delete candidate.moodistConceptId
  if (overrides.moodistConceptId !== undefined) candidate.moodistConceptId = overrides.moodistConceptId
  return candidate
}

function replaceConcept(id, patch) {
  return moodistConcepts.map((concept) => concept.id === id ? { ...concept, ...patch } : concept)
}
