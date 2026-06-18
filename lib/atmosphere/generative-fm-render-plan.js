// @ts-check

import { GENERATIVE_FM_PIECES } from "./generative-fm-catalog.js"
import {
  GENERATIVE_FM_SAMPLE_COVERAGE_STATUS,
  createGenerativeFmSampleCoverage,
} from "./generative-fm-sample-coverage.js"

export const GENERATIVE_FM_RENDER_PLAN_STATUS = Object.freeze({
  READY_FOR_UPLOAD_PLANNING: "ready-for-upload-planning",
  BLOCKED: "blocked",
})

export const DEFAULT_GENERATIVE_FM_RENDER_PLAN_PIECE_IDS = Object.freeze([
  "aisatsana",
  "at-sunrise",
  "day-dream",
  "eno-machine",
  "impact",
  "lemniscate",
  "little-bells",
  "pinwheels",
  "sevenths",
  "uun",
])

const GENERATIVE_FM_RENDER_PLAN_BATCH = Object.freeze([
  Object.freeze({
    pieceId: "aisatsana",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package uses createSampler(vsco2-piano-mf) directly, so this first pass needs a verified source index and browser smoke rather than package-specific rendered notes.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-aisatsana v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createSampler(samples['vsco2-piano-mf']).",
  }),
  Object.freeze({
    pieceId: "day-dream",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package loads buffers from samples['vsco2-piano-mf'] and uses the package sampleNote helper against the available source-index keys.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-day-dream v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createBuffers(samples['vsco2-piano-mf']).",
  }),
  Object.freeze({
    pieceId: "eno-machine",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package uses createSampler(vsco2-piano-mf) directly, so this station can use a piece-scoped hosted source index.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-eno-machine v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createSampler(samples['vsco2-piano-mf']).",
  }),
  Object.freeze({
    pieceId: "impact",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package builds regular and reverse samplers from the same source index, so the upload must keep enough piano source keys for both paths.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-impact v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createSampler/createReverseSampler(samples['vsco2-piano-mf']).",
  }),
  Object.freeze({
    pieceId: "lemniscate",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package creates two samplers from the same vsco2-piano-mf source index for its left/right panned layers.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-lemniscate v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createSampler(pianoSamples) twice.",
  }),
  Object.freeze({
    pieceId: "pinwheels",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package uses createSampler(vsco2-piano-mf) directly, so this station can use the existing piece-scoped piano source-index path.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-pinwheels v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createSampler(samples['vsco2-piano-mf']).",
  }),
  Object.freeze({
    pieceId: "sevenths",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package uses createSampler(vsco2-piano-mf) directly for seventh-chord patterns, so no package-specific rendered notes are needed.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-sevenths v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createSampler(samples['vsco2-piano-mf']).",
  }),
  Object.freeze({
    pieceId: "uun",
    strategy: "source-index",
    sourceIndexTargets: Object.freeze([
      Object.freeze({
        instrumentName: "vsco2-piano-mf",
        sourceInstrumentName: "vsco2-piano-mf",
        note:
          "The installed package uses createSampler(vsco2-piano-mf) directly, so this station can share the current piano source-index upload workflow.",
      }),
    ]),
    renderedTargets: Object.freeze([]),
    packageEvidence:
      "@generative-music/piece-uun v5.2.2 requests sampleNames = ['vsco2-piano-mf'] and calls createSampler(samples['vsco2-piano-mf']).",
  }),
  Object.freeze({
    pieceId: "at-sunrise",
    strategy: "rendered-notes",
    sourceIndexTargets: Object.freeze([]),
    renderedTargets: Object.freeze([
      Object.freeze({
        renderedInstrumentName: "at-sunrise__vcsl-vibraphone-soft-mallets-mp",
        sourceInstrumentName: "vcsl-vibraphone-soft-mallets-mp",
        outputFilePrefix: "rendered-vibraphone-soft-mallets",
        notes: Object.freeze(["C3", "F3", "C4", "F4", "C5", "E5", "G5", "C6"]),
        pitchShiftSemitones: -12,
        additionalRenderLengthSeconds: 0,
        renderEffect: "Tone Reverb(5)",
        reverb: Object.freeze({ roomSize: 0.7, wet: 1 }),
        note:
          "The package plays ten note names but only prerenders this eight-note subset; G3 and G4 are intentionally left to closest-source pitch shifting.",
      }),
    ]),
    packageEvidence:
      "@generative-music/piece-at-sunrise v5.2.2 calls createPrerenderableSampler with NOTES excluding G3 and G4.",
  }),
  Object.freeze({
    pieceId: "little-bells",
    strategy: "rendered-notes",
    sourceIndexTargets: Object.freeze([]),
    renderedTargets: Object.freeze([
      Object.freeze({
        renderedInstrumentName: "little-bells__vsco2-glock",
        sourceInstrumentName: "vsco2-glock",
        outputFilePrefix: "rendered-glock",
        notes: Object.freeze(["F4", "A4", "C5", "D#5", "F#5", "A5", "C6", "D#6", "F#6", "A6"]),
        pitchShiftSemitones: 0,
        additionalRenderLengthSeconds: 1,
        renderEffect: "Tone Freeverb({ roomSize: 0.9, dampening: 2000 })",
        reverb: Object.freeze({ roomSize: 0.9, wet: 1 }),
        note:
          "These targets are the package's deterministic toss(PITCH_CLASSES, [4, 5]) -> minor7th -> MIDI de-dupe -> every-third-note set.",
      }),
    ]),
    packageEvidence:
      "@generative-music/piece-little-bells v5.2.2 computes rendered glock notes from PITCH_CLASSES F through B over octaves 4 and 5.",
  }),
])

/**
 * Builds the next small Generative.fm sample-hosting plan from package evidence
 * plus local sample coverage. This keeps source-only stations separate from
 * rendered-note stations so later upload code can stay package-compatible.
 *
 * @param {{
 *   rootPath?: string,
 *   files?: Array<string | { relativePath?: string, path?: string, sizeBytes?: number }>,
 *   licenseTextByPath?: Record<string, string>,
 *   pieceIds?: string[],
 * }} params
 */
export function createGenerativeFmRenderPlan(params = {}) {
  const coverage = createGenerativeFmSampleCoverage({
    ...params,
    includeHostedSampleGroups: false,
  })
  const pieceIds = normalizeRequestedPieceIds(params.pieceIds)
  const coverageByPieceId = new Map(coverage.pieces.map((piece) => [piece.id, piece]))
  const catalogByPieceId = new Map(GENERATIVE_FM_PIECES.map((piece) => [piece.id, piece]))
  const registryByPieceId = new Map(GENERATIVE_FM_RENDER_PLAN_BATCH.map((entry) => [entry.pieceId, entry]))

  const pieces = pieceIds.map((pieceId) => {
    const registryEntry = registryByPieceId.get(pieceId)
    if (!registryEntry) {
      throw new Error(`No Generative.fm render plan entry exists for piece: ${pieceId}`)
    }

    const coveragePiece = coverageByPieceId.get(pieceId)
    const catalogPiece = catalogByPieceId.get(pieceId)
    if (!coveragePiece || !catalogPiece) {
      throw new Error(`Unknown Generative.fm piece: ${pieceId}`)
    }

    const sampleGroups = coveragePiece.sampleGroups.map(summarizeCoverageGroup)
    const blockedSampleGroups = sampleGroups.filter((group) => !isReadyCoverageStatus(group.status))
    const status = blockedSampleGroups.length === 0
      ? GENERATIVE_FM_RENDER_PLAN_STATUS.READY_FOR_UPLOAD_PLANNING
      : GENERATIVE_FM_RENDER_PLAN_STATUS.BLOCKED
    const proposedObjectPrefix = `atmosphere/generative-fm/${pieceId}`

    return {
      id: pieceId,
      title: catalogPiece.title,
      status,
      strategy: registryEntry.strategy,
      packageEvidence: registryEntry.packageEvidence,
      sampleGroups,
      blockedSampleGroups,
      sourceIndexTargets: registryEntry.sourceIndexTargets.map(cloneObject),
      renderedTargets: registryEntry.renderedTargets.map(cloneRenderedTarget),
      proposedObjectPrefix,
      proposedSampleIndexObjectKey: `${proposedObjectPrefix}/sample-index.json`,
      proposedManifestObjectKey: `${proposedObjectPrefix}/manifest.json`,
      nextAction: status === GENERATIVE_FM_RENDER_PLAN_STATUS.READY_FOR_UPLOAD_PLANNING
        ? nextReadyAction(registryEntry)
        : `Resolve source/license coverage for ${blockedSampleGroups.map((group) => group.displayName).join(", ")} before upload work.`,
    }
  })

  return {
    rootPath: coverage.rootPath,
    batchId: "piano-source-and-first-rendered-batches",
    requestedPieceIds: pieceIds,
    pieces,
    coverageSummary: coverage.summary,
    summary: summarizeRenderPlanPieces(pieces),
  }
}

/**
 * @param {ReturnType<typeof createGenerativeFmRenderPlan>} plan
 */
export function formatGenerativeFmRenderPlanReport(plan) {
  const lines = [
    "# Generative.fm Render Plan",
    "",
    `Audio root: ${plan.rootPath ?? "(not provided)"}`,
    `Batch: ${plan.batchId}`,
    "",
    "## Summary",
    "",
    `- Pieces planned: ${plan.summary.totalPieces}`,
    `- Ready for upload planning: ${plan.summary.readyPieces}`,
    `- Blocked by source/license coverage: ${plan.summary.blockedPieces}`,
    `- Source-index targets: ${plan.summary.sourceIndexTargets}`,
    `- Rendered instruments: ${plan.summary.renderedTargets}`,
    `- Rendered note files: ${plan.summary.renderedNotes}`,
    "",
    "## Pieces",
    "",
  ]

  for (const piece of plan.pieces) {
    lines.push(`### ${piece.title} (${piece.id})`)
    lines.push("")
    lines.push(`- Status: ${piece.status}`)
    lines.push(`- Strategy: ${piece.strategy}`)
    lines.push(`- Object prefix: ${piece.proposedObjectPrefix}`)
    lines.push(`- Sample index: ${piece.proposedSampleIndexObjectKey}`)
    lines.push(`- Package evidence: ${piece.packageEvidence}`)

    if (piece.sourceIndexTargets.length > 0) {
      lines.push("- Source index targets:")
      for (const target of piece.sourceIndexTargets) {
        lines.push(`  - ${target.instrumentName}: ${target.note}`)
      }
    }

    if (piece.renderedTargets.length > 0) {
      lines.push("- Rendered targets:")
      for (const target of piece.renderedTargets) {
        lines.push(`  - ${target.renderedInstrumentName} from ${target.sourceInstrumentName}`)
        lines.push(`    - Rendered notes: ${target.notes.join(", ")}`)
        lines.push(`    - Effect: ${target.renderEffect}; tail: ${target.additionalRenderLengthSeconds}s`)
        lines.push(`    - Note: ${target.note}`)
      }
    }

    lines.push("- Sample coverage:")
    for (const group of piece.sampleGroups) {
      lines.push(`  - ${group.displayName}: ${group.status}; source: ${group.sourceName}; library: ${group.library ?? "none"}`)
    }
    lines.push(`- Next: ${piece.nextAction}`)
    lines.push("")
  }

  return `${lines.join("\n")}\n`
}

/**
 * @param {string[] | undefined} pieceIds
 */
function normalizeRequestedPieceIds(pieceIds) {
  const requested = pieceIds?.length ? pieceIds : DEFAULT_GENERATIVE_FM_RENDER_PLAN_PIECE_IDS
  return [...new Set(requested.map((pieceId) => pieceId.trim()).filter(Boolean))]
}

/**
 * @param {ReturnType<typeof createGenerativeFmSampleCoverage>["pieces"][number]["sampleGroups"][number]} group
 */
function summarizeCoverageGroup(group) {
  return {
    displayName: group.displayName,
    names: [...group.names],
    status: group.status,
    sourceName: group.sourceName,
    library: group.library,
    license: group.license,
    sampleFileCount: group.sampleFileCount,
    evidencePaths: [...group.evidencePaths],
    note: group.note,
  }
}

/**
 * @param {string} status
 */
function isReadyCoverageStatus(status) {
  return status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED ||
    status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE
}

/**
 * @param {typeof GENERATIVE_FM_RENDER_PLAN_BATCH[number]} registryEntry
 */
function nextReadyAction(registryEntry) {
  if (registryEntry.strategy === "source-index") {
    return "Build or reuse a hosted source sample index for the target group, run browser smoke, then mark the package group hosted only after playback is confirmed."
  }

  return "Render the listed package-compatible note files, publish a sample index and manifest under the proposed prefix, run browser smoke, then mark the rendered group hosted."
}

/**
 * @param {ReturnType<typeof createGenerativeFmRenderPlan>["pieces"]} pieces
 */
function summarizeRenderPlanPieces(pieces) {
  return {
    totalPieces: pieces.length,
    readyPieces: pieces.filter((piece) => piece.status === GENERATIVE_FM_RENDER_PLAN_STATUS.READY_FOR_UPLOAD_PLANNING).length,
    blockedPieces: pieces.filter((piece) => piece.status === GENERATIVE_FM_RENDER_PLAN_STATUS.BLOCKED).length,
    sourceIndexTargets: pieces.reduce((total, piece) => total + piece.sourceIndexTargets.length, 0),
    renderedTargets: pieces.reduce((total, piece) => total + piece.renderedTargets.length, 0),
    renderedNotes: pieces.reduce(
      (total, piece) => total + piece.renderedTargets.reduce((targetTotal, target) => targetTotal + target.notes.length, 0),
      0,
    ),
  }
}

/**
 * @template {Record<string, unknown>} T
 * @param {T} value
 * @returns {T}
 */
function cloneObject(value) {
  return /** @type {T} */ ({ ...value })
}

/**
 * @param {typeof GENERATIVE_FM_RENDER_PLAN_BATCH[number]["renderedTargets"][number]} target
 */
function cloneRenderedTarget(target) {
  return {
    ...target,
    notes: [...target.notes],
  }
}
