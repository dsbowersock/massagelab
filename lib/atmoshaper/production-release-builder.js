// @ts-check

import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import moodistConcepts from "../../data/atmoshaper/moodist-concepts.json" with { type: "json" }
import batch02Declaration from "../../data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json" with { type: "json" }
import batch03Declaration from "../../data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json" with { type: "json" }
import batch04Declaration from "../../data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json" with { type: "json" }
import batch05Declaration from "../../data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json" with { type: "json" }
import batchRegistry from "../../data/atmoshaper/signature-sound-derived-audio-batch-registry.json" with { type: "json" }
import manifestAnchors from "../../data/atmoshaper/signature-sound-derived-audio-manifests.json" with { type: "json" }
import batch03Selection from "../../data/atmoshaper/signature-sound-treatment-concept-qa-batch-03-sci-fi-whistles.json" with { type: "json" }
import batch04Selection from "../../data/atmoshaper/signature-sound-edit-concept-qa-batch-04-boiling-water.json" with { type: "json" }
import batch05Selection from "../../data/atmoshaper/signature-sound-dryer-concept-selection.json" with { type: "json" }
import expansionReview from "../../data/atmoshaper/signature-sound-catalog-expansion-review.json" with { type: "json" }
import constructionReview from "../../data/atmoshaper/signature-sound-construction-review.json" with { type: "json" }
import discoveryReview from "../../data/atmoshaper/signature-sound-review.json" with { type: "json" }
import speechDeclaration from "../../data/atmoshaper/signature-sound-speech-reduction-auditions.json" with { type: "json" }
import retainedSpeechDeclaration from "../../data/atmoshaper/signature-sound-speech-reduction-auditions-v1.json" with { type: "json" }
import outcomes from "../../data/atmoshaper/signature-sound-whole-concept-chat-outcomes.json" with { type: "json" }
import amendments from "../../data/atmoshaper/signature-sound-whole-concept-review-amendments.json" with { type: "json" }
import wholeConceptBatches from "../../data/atmoshaper/signature-sound-whole-concept-review-batches.json" with { type: "json" }
import revisions from "../../data/atmoshaper/signature-sound-whole-concept-review-revisions.json" with { type: "json" }
import stageFinalizations from "../../data/atmoshaper/signature-sound-whole-concept-stage-finalizations.json" with { type: "json" }
import { loadDevSignatureDerivedCatalogBatch } from "./dev-derived-audio.js"
import { applyDevSignatureSoundSpeechReductionReview } from "./dev-speech-reduction-review.js"
import { composeDevSignatureSoundReviewCatalog } from "./dev-signature-review-catalog.js"
import { validateSignatureSoundDerivedAudioBatchRegistry } from "./signature-sound-derived-audio-batch-registry.js"
import {
  validateSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedManifest,
} from "./signature-sound-derived-audio.js"
import { validateSignatureSoundDryerConceptSelection } from "./signature-sound-dryer-concept-review.js"
import {
  validateSignatureSoundEditAuditionBatch,
  validateSignatureSoundEditAuditionManifest,
} from "./signature-sound-edit-audition.js"
import { validateAtmoShaperProductionCatalog } from "./production-catalog.js"
import {
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"
import {
  validateSignatureSoundTreatmentAuditionBatch,
  validateSignatureSoundTreatmentAuditionManifest,
} from "./signature-sound-treatment-audition.js"
import { validateSignatureSoundEditConceptQaSelection } from "./signature-sound-edit-concept-review.js"
import { validateSignatureSoundTreatmentConceptQaSelection } from "./signature-sound-treatment-concept-review.js"
import { applySignatureSoundWholeConceptReviewAmendments } from "./signature-sound-whole-concept-amendment.js"
import { validateSignatureSoundWholeConceptReviewCatalog } from "./signature-sound-whole-concept-review.js"
import { applySignatureSoundWholeConceptReviewRevisions } from "./signature-sound-whole-concept-revision.js"

export const ATMOSHAPER_PRODUCTION_CONCEPT_COUNT = 51
export const ATMOSHAPER_PRODUCTION_RELEASE_PREFIX = "atmosphere/atmoshaper/v1"
export const ATMOSHAPER_PRODUCTION_RIGHTS = Object.freeze({
  source: "Signature Sounds",
  license: "CC0",
  evidence: "Creator site-wide CC0 statement plus retained pack-specific evidence where supplied.",
})

const EXTERNAL_DIRECTORY_NAMES = Object.freeze({
  [batch02Declaration.batchId]: "batch-02-air-traffic-control",
  [batch03Declaration.batchId]: "batch-03-sci-fi-whistles-treatment-audition-v2",
  [batch04Declaration.batchId]: "batch-04-boiling-water-edit-audition-v2",
  [batch05Declaration.batchId]: "batch-05-dryer-trim-audition",
})
const SPEECH_ROOT_NAMES = Object.freeze({
  retained: "batch-06-speech-reduction-audition-v1",
  traffic: "batch-06-speech-reduction-audition-v2",
})
const SPEECH_BATCHES = new Set([
  "batch-21-traffic",
  "batch-35-london-ambience",
  "batch-45-stadium-crowd",
])
const PROCESSED_REFS = Object.freeze([
  { batchId: batch02Declaration.batchId, groupId: "signature-extra:air-traffic-control" },
  { batchId: batch03Declaration.batchId, groupId: batch03Declaration.groupId },
  { batchId: batch04Declaration.batchId, groupId: batch04Declaration.groupId },
  { batchId: batch05Declaration.batchId, groupId: "moodist:dryer" },
])

/**
 * Rebuilds the production inputs from the same checksum owners as the prepared
 * page and attaches exact local file identities. Nothing is encoded or written.
 *
 * @param {{sourceRoot:string,derivedRoot:string,repoRoot?:string}} options
 */
export async function loadApprovedAtmoShaperProductionOwners({
  sourceRoot,
  derivedRoot,
  repoRoot = process.cwd(),
}) {
  const resolvedSourceRoot = path.resolve(sourceRoot)
  const resolvedDerivedRoot = path.resolve(derivedRoot)
  await requireDirectory(resolvedSourceRoot, "Signature Sounds root")
  await requireDirectory(resolvedDerivedRoot, "AtmoShaper derived root")
  const speechRoot = path.join(resolvedDerivedRoot, SPEECH_ROOT_NAMES.retained)
  const trafficSpeechRoot = path.join(resolvedDerivedRoot, SPEECH_ROOT_NAMES.traffic)

  let dynamicCatalog = validateSignatureSoundWholeConceptReviewCatalog(
    wholeConceptBatches,
    { constructionReview, discoveryReview },
  )
  dynamicCatalog = applySignatureSoundWholeConceptReviewRevisions(dynamicCatalog, revisions)
  dynamicCatalog = applySignatureSoundWholeConceptReviewAmendments(dynamicCatalog, amendments)
  dynamicCatalog = await applyDevSignatureSoundSpeechReductionReview({
    catalog: dynamicCatalog,
    rawDeclaration: speechDeclaration,
    retainedRawDeclaration: retainedSpeechDeclaration,
    discoveryReview,
    anchorPath: path.join(repoRoot, "data/atmoshaper/signature-sound-speech-reduction-review-anchor.json"),
    trafficAnchorPath: path.join(repoRoot, "data/atmoshaper/signature-sound-speech-reduction-traffic-review-anchor.json"),
    outputRoot: speechRoot,
    trafficOutputRoot: trafficSpeechRoot,
    nodeEnv: "development",
  })
  dynamicCatalog = composeDevSignatureSoundReviewCatalog({
    catalog: dynamicCatalog,
    stageFinalizations,
    outcomes,
    expansionReview,
    discoveryReview,
  })

  const discoveryById = new Map(discoveryReview.sources.map((source) => [source.sourceId, source]))
  const moodistById = new Map(moodistConcepts.map((concept) => [concept.id, concept]))
  const speechManifests = {
    retained: JSON.parse(await readFile(path.join(speechRoot, "speech-reduction-manifest.json"), "utf8")),
    traffic: JSON.parse(await readFile(path.join(trafficSpeechRoot, "speech-reduction-manifest.json"), "utf8")),
  }
  const dynamicConcepts = dynamicCatalog.entries
    .filter((entry) => entry.chatOutcome?.decision === "pass")
    .map((entry) => projectDynamicConcept({
      entry,
      discoveryById,
      moodistById,
      sourceRoot: resolvedSourceRoot,
      speechRoot,
      trafficSpeechRoot,
      speechManifests,
    }))
  const processedConcepts = await loadProcessedConcepts({
    sourceRoot: resolvedSourceRoot,
    derivedRoot: resolvedDerivedRoot,
    discoveryById,
    moodistById,
  })
  const concepts = [...dynamicConcepts, ...processedConcepts]
    .sort((left, right) => left.label.localeCompare(right.label))
  if (concepts.length !== ATMOSHAPER_PRODUCTION_CONCEPT_COUNT) {
    throw new Error(
      `AtmoShaper production release expected ${ATMOSHAPER_PRODUCTION_CONCEPT_COUNT} concepts; found ${concepts.length}`,
    )
  }
  const groupIds = new Set(concepts.map(({ groupId }) => groupId))
  if (groupIds.size !== concepts.length) throw new Error("AtmoShaper production release repeats a group")
  return { concepts, sourceRoot: resolvedSourceRoot, derivedRoot: resolvedDerivedRoot }
}

/** @param {any} input */
function projectDynamicConcept({
  entry,
  discoveryById,
  moodistById,
  sourceRoot,
  speechRoot,
  trafficSpeechRoot,
  speechManifests,
}) {
  const moodistId = entry.groupId.startsWith("moodist:") ? entry.groupId.slice("moodist:".length) : null
  const moodist = moodistId ? moodistById.get(moodistId) : null
  const speechKind = entry.batchId === "batch-21-traffic" ? "traffic" : "retained"
  const speechManifest = speechManifests[speechKind]
  const speechOutputBySourceId = new Map(
    speechManifest.outputs
      .filter((output) => output.batchId === entry.batchId)
      .map((output) => [output.sourceId, output]),
  )
  const sources = entry.sources.map((source) => {
    if (!SPEECH_BATCHES.has(entry.batchId)) {
      return projectRawSource(source, discoveryById, sourceRoot)
    }
    const output = speechOutputBySourceId.get(source.sourceId)
    if (!output) throw new Error(`Speech-reduced source is missing for ${entry.batchId}: ${source.sourceId}`)
    const root = speechKind === "traffic" ? trafficSpeechRoot : speechRoot
    return projectSource({
      source,
      localPath: path.join(root, output.outputRelativePath),
      payloadSha256: output.outputMeasurement.outputSha256,
      payloadByteSize: output.outputMeasurement.byteSize,
      durationSeconds: output.outputMeasurement.durationSeconds,
    })
  })
  const sourceSelection = entry.sourceSelection?.kind === "single-source-loop"
    ? { ...entry.sourceSelection, defaultSourceId: sources[0].sourceId }
    : entry.sourceSelection ?? null
  return {
    id: conceptId(entry.groupId),
    batchId: entry.batchId,
    groupId: entry.groupId,
    label: entry.label,
    description: describeConcept(entry, sources.length),
    category: moodist?.category ?? "signature",
    origin: moodist ? "moodist" : "signature-only",
    reviewFingerprint: entry.reviewFingerprint,
    playbackConfiguration: structuredClone(entry.playbackConfiguration),
    runtimePolicy: entry.runtimePolicy ? structuredClone(entry.runtimePolicy) : null,
    sourceSelection,
    playbackMode: null,
    sources,
  }
}

/** @param {any} input */
async function loadProcessedConcepts({ sourceRoot, derivedRoot, discoveryById, moodistById }) {
  const registry = validateSignatureSoundDerivedAudioBatchRegistry(batchRegistry)
  const constructionByGroup = new Map(constructionReview.groups.map((group) => [group.groupId, group]))
  const derivedDeclarations = new Map([
    [batch02Declaration.batchId, validateSignatureSoundDerivedAudioBatch(
      batch02Declaration,
      { constructionReview, discoveryReview },
    )],
    [batch05Declaration.batchId, validateSignatureSoundDerivedAudioBatch(
      batch05Declaration,
      { constructionReview, discoveryReview },
    )],
  ])
  const treatmentBatch = validateSignatureSoundTreatmentAuditionBatch(
    batch03Declaration,
    { constructionReview, discoveryReview },
  )
  const editBatch = validateSignatureSoundEditAuditionBatch(
    batch04Declaration,
    { constructionReview, discoveryReview },
  )

  return Promise.all(PROCESSED_REFS.map(async ({ batchId, groupId }) => {
    const group = constructionByGroup.get(groupId)
    if (!group) throw new Error(`Processed AtmoShaper group is missing: ${groupId}`)
    const selected = await loadDevSignatureDerivedCatalogBatch({
      batchId,
      catalogRoot: derivedRoot,
      outputRoot: derivedRoot,
      batchRegistry: registry,
      manifestEntries: manifestAnchors.entries,
      externalDirectoryNames: EXTERNAL_DIRECTORY_NAMES,
      nodeEnv: "development",
    })
    const playbackConfiguration = projectPlaybackConfiguration(group)
    const base = {
      id: conceptId(groupId),
      batchId,
      groupId,
      label: group.label,
      description: describeConcept({ playbackConfiguration }, group.includedSourceIds.length),
      category: categoryForGroup(groupId, moodistById),
      origin: groupId.startsWith("moodist:") ? "moodist" : "signature-only",
      reviewFingerprint: selected.manifestEntry.manifestSha256,
      playbackConfiguration,
      runtimePolicy: null,
      sourceSelection: null,
      playbackMode: null,
    }
    const localRoot = selected.outputRoot

    if (batchId === batch03Declaration.batchId) {
      const manifest = validateSignatureSoundTreatmentAuditionManifest(selected.manifest, treatmentBatch)
      const selection = validateSignatureSoundTreatmentConceptQaSelection(batch03Selection, {
        manifest,
        manifestSha256: selected.manifestEntry.manifestSha256,
        playbackConfiguration: {
          strategyId: playbackConfiguration.strategyId,
          previewSettings: playbackConfiguration.previewSettings,
        },
      })
      const outputByIdentity = new Map(manifest.outputs.map((output) => [output.outputIdentity, output]))
      return {
        ...base,
        sources: selection.outputIdentities.map((outputIdentity) => {
          const output = outputByIdentity.get(outputIdentity)
          if (!output) throw new Error(`Selected Sci-Fi Whistles output is missing: ${outputIdentity}`)
          return projectManifestOutputSource(output, discoveryById, localRoot)
        }),
      }
    }

    if (batchId === batch04Declaration.batchId) {
      const manifest = validateSignatureSoundEditAuditionManifest(selected.manifest, editBatch)
      const selection = validateSignatureSoundEditConceptQaSelection(batch04Selection, {
        manifest,
        manifestSha256: selected.manifestEntry.manifestSha256,
        playbackConfiguration: group.playback,
      })
      const output = manifest.outputs.find((candidate) => candidate.outputIdentity === selection.outputIdentity)
      if (!output) throw new Error("Selected Boiling Water output is missing")
      return {
        ...base,
        sources: [projectManifestOutputSource(output, discoveryById, localRoot)],
        playbackMode: {
          kind: "prebaked-intro-loop",
          artifactLoopStartSeconds: output.edit.loopEndSeconds - output.edit.cyclicCrossfadeSeconds,
          firstPassStartSeconds: output.edit.firstPassStartSeconds,
          sourceLoopStartSeconds: output.edit.loopStartSeconds,
          sourceLoopEndSeconds: output.edit.loopEndSeconds,
          crossfadeSeconds: output.edit.cyclicCrossfadeSeconds,
          crossfadeCurve: output.edit.crossfadeCurve,
        },
      }
    }

    const declaration = derivedDeclarations.get(batchId)
    if (!declaration) throw new Error(`Processed declaration is missing: ${batchId}`)
    const manifest = validateSignatureSoundDerivedManifest(selected.manifest, declaration)
    if (batchId === batch05Declaration.batchId) {
      const selection = validateSignatureSoundDryerConceptSelection(batch05Selection, {
        manifest,
        manifestSha256: selected.manifestEntry.manifestSha256,
        playbackConfiguration,
      })
      if (selection.selectedTarget !== "dry") throw new Error("Dryer production selection must remain Dry")
      const discovery = discoveryById.get(selection.sourceId)
      if (!discovery) throw new Error("Dryer source is missing from discovery")
      const output = manifest.outputs.find((candidate) => candidate.sourceId === selection.sourceId)
      if (!output) throw new Error("Dryer measurement owner is missing")
      return {
        ...base,
        sources: [projectSource({
          source: discovery,
          localPath: path.join(sourceRoot, discovery.relativePath),
          payloadSha256: discovery.sha256,
          payloadByteSize: discovery.byteSize,
          durationSeconds: output.inputMeasurement.durationSeconds,
        })],
      }
    }
    return {
      ...base,
      sources: manifest.outputs.map((output) => projectManifestOutputSource(output, discoveryById, localRoot)),
    }
  }))
}

/** @param {any} group */
function projectPlaybackConfiguration(group) {
  const previewSettings = validateSignatureSoundPreviewSettings(
    group.playback.strategyId,
    group.playback.previewSettings,
  )
  const transitionRange = group.playback.constraints.find(
    (constraint) => constraint.type === "transition-duration-range",
  )
  const overlapNextEvent = group.playback.constraints.some(
    (constraint) => constraint.type === "overlap-next-event",
  )
  return {
    strategyId: group.playback.strategyId,
    previewSettings,
    constructionPolicy: validateSignatureSoundConstructionPlaybackPolicy(
      group.playback.strategyId,
      previewSettings,
      {
        minimumSelectionsBeforeRepeat: group.playback.minimumSelectionsBeforeRepeat,
        transitionDurationRange: transitionRange
          ? {
              minimumSeconds: transitionRange.minimumSeconds,
              maximumSeconds: transitionRange.maximumSeconds,
            }
          : null,
        cadenceBoundary: null,
        overlapNextEvent,
      },
    ),
  }
}

/** @param {any} output @param {Map<string,any>} discoveryById @param {string} localRoot */
function projectManifestOutputSource(output, discoveryById, localRoot) {
  const discovery = discoveryById.get(output.sourceId)
  if (!discovery) throw new Error(`Processed source is missing from discovery: ${output.sourceId}`)
  return projectSource({
    source: discovery,
    localPath: path.join(localRoot, output.outputRelativePath),
    payloadSha256: output.outputMeasurement.outputSha256,
    payloadByteSize: output.outputMeasurement.byteSize,
    durationSeconds: output.outputMeasurement.durationSeconds,
  })
}

/** @param {any} source @param {Map<string,any>} discoveryById @param {string} sourceRoot */
function projectRawSource(source, discoveryById, sourceRoot) {
  const discovery = discoveryById.get(source.sourceId)
  if (!discovery) throw new Error(`Approved source is missing from discovery: ${source.sourceId}`)
  return projectSource({
    source: { ...discovery, ...source },
    localPath: path.join(sourceRoot, discovery.relativePath),
    payloadSha256: discovery.sha256,
    payloadByteSize: discovery.byteSize,
    durationSeconds: source.durationSeconds ?? null,
  })
}

/** @param {{source:any,localPath:string,payloadSha256:string,payloadByteSize:number,durationSeconds:number|null}} input */
function projectSource({ source, localPath, payloadSha256, payloadByteSize, durationSeconds }) {
  return {
    sourceId: source.sourceId,
    label: sourceLabel(source.relativePath),
    relativePath: source.relativePath,
    localPath,
    payloadSha256,
    payloadByteSize,
    durationSeconds,
    ...copyOptionalNumber(source, "startSeconds"),
    ...copyOptionalNumber(source, "endSeconds"),
    ...copyOptionalNumber(source, "fadeInSeconds"),
    ...copyOptionalNumber(source, "fadeOutSeconds"),
    ...copyOptionalNumber(source, "gainDb"),
  }
}

/**
 * Creates the committed browser catalog after the staging tool has supplied
 * exact duration and rendition identities for every distinct payload.
 * @param {{concepts:any[],publishedBaseUrl:string,renditionsByPayloadSha256:Map<string,any[]>}} input
 */
export function buildAtmoShaperProductionCatalog({
  concepts,
  publishedBaseUrl,
  renditionsByPayloadSha256,
}) {
  const projectedConcepts = concepts.map((concept) => ({
    ...withoutLocalFields(concept),
    sources: concept.sources.map((source) => {
      const formats = renditionsByPayloadSha256.get(source.payloadSha256)
      if (!formats) throw new Error(`Renditions are missing for ${source.payloadSha256}`)
      const durationSeconds = source.durationSeconds ?? formats[0]?.durationSeconds
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error(`Duration is missing for ${source.payloadSha256}`)
      }
      return {
        ...withoutLocalFields(source),
        durationSeconds,
        formats: formats.map(withoutFormatStageFields),
      }
    }),
  }))
  const sourceReferenceCount = projectedConcepts.reduce((count, concept) => count + concept.sources.length, 0)
  const uniquePayloadCount = new Set(
    projectedConcepts.flatMap((concept) => concept.sources.map((source) => source.payloadSha256)),
  ).size
  const revisionOwner = {
    version: 1,
    rights: ATMOSHAPER_PRODUCTION_RIGHTS,
    concepts: projectedConcepts,
  }
  const catalogRevision = sha256StableJson(revisionOwner)
  const catalog = {
    version: 1,
    catalogKind: "atmoshaper-production-audio",
    catalogRevision,
    publishedBaseUrl,
    rights: ATMOSHAPER_PRODUCTION_RIGHTS,
    summary: {
      conceptCount: projectedConcepts.length,
      sourceReferenceCount,
      uniquePayloadCount,
    },
    concepts: projectedConcepts,
  }
  return validateAtmoShaperProductionCatalog(catalog)
}

/** @param {any[]} concepts */
export function collectUniqueAtmoShaperProductionPayloads(concepts) {
  const payloads = new Map()
  for (const concept of concepts) {
    for (const source of concept.sources) {
      const existing = payloads.get(source.payloadSha256)
      if (existing) {
        // The discovery catalog intentionally records duplicate files as
        // separate source identities. Equal checksums may have different local
        // paths, but their byte length must still agree before deduplication.
        if (existing.payloadByteSize !== source.payloadByteSize) {
          throw new Error(`Conflicting local owners for payload ${source.payloadSha256}`)
        }
        continue
      }
      payloads.set(source.payloadSha256, { ...source })
    }
  }
  return [...payloads.values()].sort((left, right) => left.payloadSha256.localeCompare(right.payloadSha256))
}

/** @param {any[]} concepts */
export async function verifyAtmoShaperProductionPayloads(concepts) {
  const payloads = collectUniqueAtmoShaperProductionPayloads(concepts)
  for (const payload of payloads) {
    const fileStat = await stat(payload.localPath)
    if (!fileStat.isFile() || fileStat.size !== payload.payloadByteSize) {
      throw new Error(`Approved payload size changed: ${payload.localPath}`)
    }
    const digest = createHash("sha256").update(await readFile(payload.localPath)).digest("hex")
    if (digest !== payload.payloadSha256) {
      throw new Error(`Approved payload checksum changed: ${payload.localPath}`)
    }
  }
  return payloads
}

/** @param {string} payloadSha256 @param {string} fileName */
export function atmoShaperProductionAudioObjectKey(payloadSha256, fileName) {
  if (!/^[a-f0-9]{64}$/.test(payloadSha256)) throw new Error("AtmoShaper payload SHA-256 is invalid")
  if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName)) throw new Error("AtmoShaper audio filename is invalid")
  return `${ATMOSHAPER_PRODUCTION_RELEASE_PREFIX}/audio/${payloadSha256}/${fileName}`
}

/** @param {string} catalogRevision */
export function atmoShaperProductionCatalogObjectKey(catalogRevision) {
  if (!/^[a-f0-9]{64}$/.test(catalogRevision)) throw new Error("AtmoShaper catalog revision is invalid")
  return `${ATMOSHAPER_PRODUCTION_RELEASE_PREFIX}/catalogs/${catalogRevision}.json`
}

/** @param {string} groupId */
function conceptId(groupId) {
  return groupId.replace(/:/g, "-")
}

/** @param {string} groupId @param {Map<string,any>} moodistById */
function categoryForGroup(groupId, moodistById) {
  if (!groupId.startsWith("moodist:")) return "signature"
  return moodistById.get(groupId.slice("moodist:".length))?.category ?? "signature"
}

/** @param {any} entry @param {number} sourceCount */
function describeConcept(entry, sourceCount) {
  const strategy = entry.playbackConfiguration?.strategyId
  if (strategy === "walking-cadence-sequence") {
    return `A curated walking cadence built from ${sourceCount} reviewed footstep recordings.`
  }
  if (strategy === "spaced-event-sequence") {
    return `A curated sequence that spaces ${sourceCount} reviewed sound events naturally.`
  }
  if (entry.runtimePolicy?.kind === "layered-sequence" || entry.runtimePolicy?.kind === "multi-lane-sequence") {
    return `A layered ambience assembled from ${sourceCount} reviewed recordings.`
  }
  if (entry.runtimePolicy?.kind === "fixed-region-loop" || entry.runtimePolicy?.kind === "random-region-loop") {
    return "A reviewed recording shaped into a continuously varying ambient loop."
  }
  return sourceCount === 1
    ? "One reviewed recording shaped into a continuous ambient sound."
    : `A curated pool of ${sourceCount} reviewed recordings with smooth variation.`
}

/** @param {string} relativePath */
function sourceLabel(relativePath) {
  const decoded = path.basename(relativePath).replace(/\.[^.]+$/, "").replace(/\+/g, " ")
  return decoded.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

/** @param {any} source @param {string} key */
function copyOptionalNumber(source, key) {
  return typeof source[key] === "number" ? { [key]: source[key] } : {}
}

/** @param {any} value */
function withoutLocalFields(value) {
  return structuredClone(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "localPath" && key !== "payloadByteSize"),
  ))
}

/** Removes local staging metadata from one browser-safe rendition. @param {any} value */
function withoutFormatStageFields(value) {
  return structuredClone(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "durationSeconds" && key !== "objectKey"),
  ))
}

/** @param {unknown} value */
function sha256StableJson(value) {
  return createHash("sha256").update(`${JSON.stringify(sortJson(value))}\n`).digest("hex")
}

/** @param {unknown} value @returns {unknown} */
function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortJson(item)]),
  )
}

/** @param {string} directoryPath @param {string} label */
async function requireDirectory(directoryPath, label) {
  const fileStat = await stat(directoryPath).catch(() => null)
  if (!fileStat?.isDirectory()) throw new Error(`${label} is unavailable: ${directoryPath}`)
}
