import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GENERATIVE_FM_RENDER_PLAN_STATUS,
  createGenerativeFmRenderPlan,
  formatGenerativeFmRenderPlanReport,
} from "../lib/atmosphere/generative-fm-render-plan.js"

const vscoRoot = "VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0"
const vcslRoot = "VCSL-1.2.2-RC/VCSL-1.2.2-RC"

describe("Generative.fm render plan", () => {
  it("plans source-index and rendered-note batches from local CC0 coverage", () => {
    const plan = createPlan()

    assert.equal(plan.batchId, "piano-source-and-first-rendered-batches")
    assert.deepEqual(plan.requestedPieceIds, [
      "aisatsana",
      "at-sunrise",
      "day-dream",
      "eno-machine",
      "impact",
      "lemniscate",
      "little-bells",
    ])
    assert.equal(plan.summary.totalPieces, 7)
    assert.equal(plan.summary.readyPieces, 7)
    assert.equal(plan.summary.blockedPieces, 0)
    assert.equal(plan.summary.sourceIndexTargets, 5)
    assert.equal(plan.summary.renderedTargets, 2)
    assert.equal(plan.summary.renderedNotes, 18)

    const aisatsana = plan.pieces.find((piece) => piece.id === "aisatsana")
    assert.equal(aisatsana.status, GENERATIVE_FM_RENDER_PLAN_STATUS.READY_FOR_UPLOAD_PLANNING)
    assert.equal(aisatsana.strategy, "source-index")
    assert.equal(aisatsana.sourceIndexTargets[0].instrumentName, "vsco2-piano-mf")

    const atSunrise = plan.pieces.find((piece) => piece.id === "at-sunrise")
    assert.equal(atSunrise.strategy, "rendered-notes")
    assert.deepEqual(
      atSunrise.renderedTargets[0].notes,
      ["C3", "F3", "C4", "F4", "C5", "E5", "G5", "C6"],
    )
    assert.equal(atSunrise.renderedTargets[0].sourceInstrumentName, "vcsl-vibraphone-soft-mallets-mp")

    const littleBells = plan.pieces.find((piece) => piece.id === "little-bells")
    assert.deepEqual(
      littleBells.renderedTargets[0].notes,
      ["F4", "A4", "C5", "D#5", "F#5", "A5", "C6", "D#6", "F#6", "A6"],
    )
    assert.equal(littleBells.renderedTargets[0].sourceInstrumentName, "vsco2-glock")

    const secondBatchPianoPieces = plan.pieces.filter((piece) => ["day-dream", "eno-machine", "impact", "lemniscate"].includes(piece.id))
    assert.deepEqual(secondBatchPianoPieces.map((piece) => piece.strategy), [
      "source-index",
      "source-index",
      "source-index",
      "source-index",
    ])
    assert.deepEqual(
      secondBatchPianoPieces.map((piece) => piece.sourceIndexTargets[0].instrumentName),
      ["vsco2-piano-mf", "vsco2-piano-mf", "vsco2-piano-mf", "vsco2-piano-mf"],
    )
  })

  it("keeps a batch piece blocked when local license evidence is missing", () => {
    const plan = createGenerativeFmRenderPlan({
      files: createLocalCandidateFiles(),
      pieceIds: ["aisatsana"],
    })

    assert.equal(plan.summary.readyPieces, 0)
    assert.equal(plan.summary.blockedPieces, 1)
    assert.equal(plan.pieces[0].status, GENERATIVE_FM_RENDER_PLAN_STATUS.BLOCKED)
    assert.equal(plan.pieces[0].blockedSampleGroups[0].displayName, "vsco2-piano-mf")
    assert.match(plan.pieces[0].nextAction, /Resolve source\/license coverage/)
  })

  it("does not let hosted playback indexes bypass source-license checks for re-uploads", () => {
    const plan = createGenerativeFmRenderPlan({
      files: createLocalCandidateFiles(),
      pieceIds: ["at-sunrise"],
    })

    assert.equal(plan.summary.readyPieces, 0)
    assert.equal(plan.summary.blockedPieces, 1)
    assert.equal(plan.pieces[0].status, GENERATIVE_FM_RENDER_PLAN_STATUS.BLOCKED)
    assert.equal(plan.pieces[0].blockedSampleGroups[0].displayName, "at-sunrise__vcsl-vibraphone-soft-mallets-mp or vcsl-vibraphone-soft-mallets-mp")
    assert.equal(plan.pieces[0].blockedSampleGroups[0].status, "license-evidence-missing")
  })

  it("formats a concise operator report for planned batches", () => {
    const report = formatGenerativeFmRenderPlanReport(createPlan())

    assert.match(report, /Generative\.fm Render Plan/)
    assert.match(report, /aisatsana \(generative remix\) \(aisatsana\)/)
    assert.match(report, /Strategy: source-index/)
    assert.match(report, /At Sunrise \(at-sunrise\)/)
    assert.match(report, /Rendered notes: C3, F3, C4, F4, C5, E5, G5, C6/)
    assert.match(report, /Little Bells \(little-bells\)/)
    assert.match(report, /Rendered notes: F4, A4, C5, D#5, F#5, A5, C6, D#6, F#6, A6/)
    assert.match(report, /Day\/Dream \(day-dream\)/)
    assert.match(report, /Impact \(impact\)/)
  })

  it("rejects pieces that are not in the explicit render-plan registry", () => {
    assert.throws(
      () => createGenerativeFmRenderPlan({
        files: createLocalCandidateFiles(),
        licenseTextByPath: createLicenseTextByPath(),
        pieceIds: ["zed"],
      }),
      /No Generative\.fm render plan entry/,
    )
  })
})

function createPlan() {
  return createGenerativeFmRenderPlan({
    rootPath: "C:/samples",
    files: createLocalCandidateFiles(),
    licenseTextByPath: createLicenseTextByPath(),
  })
}

function createLicenseTextByPath() {
  return {
    [`${vscoRoot}/LICENSE`]: "CC0 1.0 Universal",
    [`${vcslRoot}/README.md`]: "Creative Commons 0 Public Domain",
  }
}

function createLocalCandidateFiles() {
  return [
    `${vscoRoot}/LICENSE`,
    `${vscoRoot}/Keys/Upright Piano/MappingChart.txt`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_008.wav`,
    `${vscoRoot}/Percussion/Glock/Glock_C6_v1_rr1.wav`,
    `${vcslRoot}/README.md`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav`,
  ]
}
