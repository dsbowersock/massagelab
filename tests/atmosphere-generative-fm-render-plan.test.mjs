import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GENERATIVE_FM_RENDER_PLAN_STATUS,
  createGenerativeFmRenderPlan,
  formatGenerativeFmRenderPlanReport,
} from "../lib/atmosphere/generative-fm-render-plan.js"

const vscoRoot = "VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0"
const vcslRoot = "VCSL-1.2.2-RC/VCSL-1.2.2-RC"
const signatureBeachRoot = "Signature Samples/SS_Beach_Ambience_Recordings_CC0/SS_Beach_Ambience_Recordings_CC0"
const signatureChoirRoot = "Signature Samples/SS_Choirs_Vocals_SFX_Teaser_CC0/SS_Choirs_Vocals_SFX_Teaser_CC0"
const signatureSerbianChoirRoot = "Signature Samples/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0"
const signatureBellRoot = "Signature Samples/SS_Bell_One_Kit_Key_CC0/SS_Bell_One_Kit_Key_CC0"
const signatureBurialPadsRoot = "Signature Samples/SS_Burial_Pads_CC0/SS_Burial_Pads_CC0"
const signatureSpiritualRoot = "Signature Samples/Spiritual+Acoustics+CC0+Signaturesounds.org/Spiritual Acoustics CC0 Signaturesounds.org"
const signatureUnderwaterRoot = "Signature Samples/Underwater+One+Shots+2/Underwater One Shots"
const signatureSpanishGuitarRoot = "Signature Samples/Spanish+Guitar/Spanish Guitar"
const signatureCutleryRoot = "Signature Samples/SS_Cutlery_Percussion_Foley_CC0/SS_Cutlery_Percussion_Foley_CC0"
const signatureVhsDrumRoot = "Signature Samples/VHS-Drumkit+CC0+2/VHS-Drumkit CC0"
const signatureLondonRoot = "Signature Samples/London+Underground+Rcordings/London Underground Rcordings"
const signatureKotorRoot = "Signature Samples/Kotor,+Montenegro+-Signaturesounds.org/Kotor, Montenegro -Signaturesounds.org"
const signatureFireworksRoot = "Signature Samples/Distant+Fireworks/Distant Fireworks"
const signatureLoopsRoot = "Signature Samples/Loops+Of+Ambience/Loops Of Ambience"
const signatureBeachRocksRoot = "Signature Samples/SS_Beach-Rocks_Textures_CC0/SS_Beach-Rocks_Textures_CC0"
const signatureCymbalRoot = "Signature Samples/Cymbal+Crashes+-+SignatureSounds.org/Cymbal Crashes - SignatureSounds.org"
const signatureWhiteNoiseRoot = "Signature Samples/White+Noise/White Noise"

const originalBatchPieceIds = Object.freeze([
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
  "no-refrain",
  "transmission",
  "trees",
])
const sourceRolloutPieceIds = Object.freeze([
  "420hz-gamma-waves-for-big-brain",
  "a-viable-system",
  "above-the-rain",
  "agua-ravine",
  "apoapsis",
  "beneath-waves",
  "bhairav",
  "buttafingers",
  "documentary-films",
  "drones",
  "drones-2",
  "enough",
  "expand-collapse",
  "homage",
  "nakaii",
  "oxalis-1",
  "remembering",
  "return-to-form",
  "ritual",
  "soundtrack",
  "splash",
  "spring-again",
  "substrate",
  "timbral-oscillations",
  "yesterday",
])
const remainingGeneratorPieceIds = Object.freeze([
  "animalia-chordata",
  "awash",
  "didgeridoobeats",
  "eyes-closed",
  "last-transit",
  "lullaby",
  "meditation",
  "moment",
  "neuroplasticity",
  "otherness",
  "peace",
  "pulse-code-modulation",
  "skyline",
  "stratospheric",
  "stream-of-consciousness",
  "townsend",
  "western-medicine",
  "zed",
])

describe("Generative.fm render plan", () => {
  it("plans source-index and rendered-note batches from local CC0 coverage", () => {
    const plan = createPlan()

    assert.equal(plan.batchId, "source-index-rollout-and-rendered-batches")
    assert.deepEqual(plan.requestedPieceIds.slice(0, originalBatchPieceIds.length), [...originalBatchPieceIds])
    assert.deepEqual(
      plan.requestedPieceIds.slice(originalBatchPieceIds.length, originalBatchPieceIds.length + sourceRolloutPieceIds.length),
      [...sourceRolloutPieceIds],
    )
    assert.deepEqual(
      plan.requestedPieceIds.slice(originalBatchPieceIds.length + sourceRolloutPieceIds.length),
      [...remainingGeneratorPieceIds],
    )
    assert.equal(plan.summary.totalPieces, 56)
    assert.equal(plan.summary.readyPieces, 56)
    assert.equal(plan.summary.blockedPieces, 0)
    assert.equal(plan.summary.sourceIndexTargets, 102)
    assert.equal(plan.summary.renderedTargets, 5)
    assert.equal(plan.summary.renderedNotes, 55)

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

    const thirdBatchPianoPieces = plan.pieces.filter((piece) => ["pinwheels", "sevenths", "uun"].includes(piece.id))
    assert.deepEqual(thirdBatchPianoPieces.map((piece) => piece.strategy), [
      "source-index",
      "source-index",
      "source-index",
    ])
    assert.deepEqual(
      thirdBatchPianoPieces.map((piece) => piece.sourceIndexTargets[0].instrumentName),
      ["vsco2-piano-mf", "vsco2-piano-mf", "vsco2-piano-mf"],
    )

    const noRefrain = plan.pieces.find((piece) => piece.id === "no-refrain")
    assert.equal(noRefrain.strategy, "rendered-notes")
    assert.deepEqual(
      noRefrain.renderedTargets[0].notes,
      ["A2", "C3", "G3", "G2", "C4", "E4", "G4", "B4", "C5", "E5", "G5", "B5"],
    )

    const transmission = plan.pieces.find((piece) => piece.id === "transmission")
    assert.equal(transmission.strategy, "rendered-notes")
    assert.deepEqual(
      transmission.renderedTargets[0].notes,
      ["A1", "C#2", "E2", "G#2", "C4", "E4", "G4", "A#4", "D#5", "G5", "A#5", "D6"],
    )

    const trees = plan.pieces.find((piece) => piece.id === "trees")
    assert.equal(trees.strategy, "rendered-notes")
    assert.deepEqual(
      trees.renderedTargets[0].notes,
      ["C3", "E3", "G3", "C4", "E4", "G4", "C5", "E5", "G5", "C6", "E6", "G6", "B6"],
    )

    const gammaWaves = plan.pieces.find((piece) => piece.id === "420hz-gamma-waves-for-big-brain")
    assert.equal(gammaWaves.strategy, "source-index")
    assert.deepEqual(
      gammaWaves.sourceIndexTargets.map((target) => target.instrumentName),
      ["waves", "vsco2-piano-mf", "sso-chorus-male"],
    )

    const ritual = plan.pieces.find((piece) => piece.id === "ritual")
    assert.equal(ritual.strategy, "source-index")
    assert.equal(ritual.sourceIndexTargets.length, 8)
    assert.equal(ritual.sourceIndexTargets.at(-1).instrumentName, "vcsl-darbuka-5-f")

    const yesterday = plan.pieces.find((piece) => piece.id === "yesterday")
    assert.equal(yesterday.strategy, "source-index")
    assert.equal(yesterday.sourceIndexTargets[0].instrumentName, "vcsl-tenor-sax-vib")

    const animalia = plan.pieces.find((piece) => piece.id === "animalia-chordata")
    assert.equal(animalia.strategy, "source-index")
    assert.equal(animalia.sourceIndexTargets[0].instrumentName, "whales")

    const peace = plan.pieces.find((piece) => piece.id === "peace")
    assert.equal(peace.strategy, "source-index")
    assert.equal(peace.sourceIndexTargets[0].instrumentName, "native-american-flute-susvib")

    const zed = plan.pieces.find((piece) => piece.id === "zed")
    assert.equal(zed.strategy, "source-index")
    assert.deepEqual(zed.sourceIndexTargets.map((target) => target.instrumentName), ["zed__pad", "zed__noise"])
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
    assert.match(report, /Pinwheels \(pinwheels\)/)
    assert.match(report, /Sevenths \(sevenths\)/)
    assert.match(report, /Uun \(uun\)/)
    assert.match(report, /No Refrain \(no-refrain\)/)
    assert.match(report, /Transmission \(transmission\)/)
    assert.match(report, /Trees \(trees\)/)
    assert.match(report, /420hz Gamma Waves for Big Brain \(420hz-gamma-waves-for-big-brain\)/)
    assert.match(report, /Ritual \(ritual\)/)
    assert.match(report, /Yesterday \(yesterday\)/)
    assert.match(report, /Animalia Chordata \(animalia-chordata\)/)
    assert.match(report, /Zed \(zed\)/)
  })

  it("rejects pieces that are not in the explicit render-plan registry", () => {
    assert.throws(
      () => createGenerativeFmRenderPlan({
        files: createLocalCandidateFiles(),
        licenseTextByPath: createLicenseTextByPath(),
        pieceIds: ["observable-streams"],
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
    [`${signatureBeachRoot}/LICENSE_Beach_Collection_PRO.txt`]:
      "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
    [`${signatureChoirRoot}/LICENSE_Choir_Collection_PRO.txt`]:
      "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
    [`${signatureSerbianChoirRoot}/LICENSE_Serbian_Choir_PRO_v2.txt`]:
      "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
  }
}

function createLocalCandidateFiles() {
  return [
    `${vscoRoot}/LICENSE`,
    `${vscoRoot}/Keys/Upright Piano/MappingChart.txt`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_008.wav`,
    `${vscoRoot}/Woodwinds/Oboe/Sus/Oboe_Sus_A#3_v1_Main.wav`,
    `${vscoRoot}/Woodwinds/Flute/SusVib/LdFlute_susVib_C3_v1_1.wav`,
    `${vscoRoot}/Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_C1_v1_rr1.wav`,
    `${vscoRoot}/Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_C4_p.wav`,
    `${vscoRoot}/Strings/Harp/KSHarp_C3_mf.wav`,
    `${vscoRoot}/Brass/Trumpet/sus/Sum_SHTrumpet_sus_C3_v1_rr1.wav`,
    `${vscoRoot}/Brass/Trumpet/sus/Sum_SHTrumpet_sus_C3_v3_rr1.wav`,
    `${vscoRoot}/Strings/Violin Section/susVib/VlnEns_susVib_C4_v1.wav`,
    `${vscoRoot}/Strings/Cello Section/susvib/susvib_C3_v1_1.wav`,
    `${vscoRoot}/Strings/Cello Section/susvib/susvib_C3_v3_1.wav`,
    `${vscoRoot}/Brass/Tenor Trombone/sus/tenortbn_sus_C3_v1_1.wav`,
    `${vscoRoot}/Brass/Tuba/sus/Tuba3_sus_F1_v1_rr1_Mid.wav`,
    `${vscoRoot}/Percussion/Glock/Glock_C6_v1_rr1.wav`,
    `${vscoRoot}/Percussion/Marimba/Marimba_hit_Outrigger_C4_loud_01.wav`,
    `${vcslRoot}/README.md`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav`,
    `${vcslRoot}/Membranophones/Other Membranophones/Ocean Drum/OceanDrum_Sus_1_Mid.wav`,
    `${vcslRoot}/Idiophones/Friction Idiophones/Wine Glasses/Sustains/Slow/glass1_D#4_Slow_1_Main.wav`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Claves/Claves1_Hit_v1_rr1_Mid.wav`,
    `${vcslRoot}/Aerophones/Lip Aerophones/Didgeridoo/Didgeridoo1_Sus2_Main.wav`,
    `${vcslRoot}/Membranophones/Struck Membranophones/Bass Drum 2/bassdrum_hit_ff.wav`,
    `${vcslRoot}/Membranophones/Struck Membranophones/Darbuka/Darbuka_1_hit_vl2_rr1.wav`,
    `${vcslRoot}/Membranophones/Struck Membranophones/Darbuka/Darbuka_2_hit_vl2_rr1.wav`,
    `${vcslRoot}/Membranophones/Struck Membranophones/Darbuka/Darbuka_3_hit_vl2_rr1.wav`,
    `${vcslRoot}/Membranophones/Struck Membranophones/Darbuka/Darbuka_4_hit_vl2_rr1.wav`,
    `${vcslRoot}/Membranophones/Struck Membranophones/Darbuka/Darbuka_5_hit_vl2_rr1.wav`,
    `${vcslRoot}/Aerophones/Reed Aerophones/Tenor Saxophone/Vibrato/BrettTenor_Vib_Main_C3_var1.wav`,
    `${signatureBeachRoot}/LICENSE_Beach_Collection_PRO.txt`,
    `${signatureBeachRoot}/Beach_Ambience_4.wav`,
    `${signatureBeachRoot}/Beach_Ambience_10.wav`,
    `${signatureChoirRoot}/LICENSE_Choir_Collection_PRO.txt`,
    `${signatureChoirRoot}/Choirs_Children_Ambience_-01.wav`,
    `${signatureChoirRoot}/Men_Of_Choirs_05_Key_D.wav`,
    `${signatureSerbianChoirRoot}/LICENSE_Serbian_Choir_PRO_v2.txt`,
    `${signatureSerbianChoirRoot}/CHOIR_SerbianOrthodox_Ambience_01.wav`,
    `${signatureBellRoot}/Bell_One_Shot_ C1.wav`,
    `${signatureBurialPadsRoot}/Burial_Pad_Long_1.wav`,
    `${signatureSpiritualRoot}/Spiritual Acoustics Loop 1.wav`,
    `${signatureUnderwaterRoot}/Underwater One Shots.wav`,
    `${signatureSpanishGuitarRoot}/Spanish Guitars (SignatureSounds.Org) 01.wav`,
    `${signatureCutleryRoot}/Cutlery_Percussion_01.wav`,
    `${signatureVhsDrumRoot}/bdr-01.wav`,
    `${signatureVhsDrumRoot}/sdr-01.wav`,
    `${signatureLondonRoot}/Train Engine Revving Up And Track Noises.wav`,
    `${signatureKotorRoot}/Kotor, Montenegro - Birds Singing In The Evening.wav`,
    `${signatureFireworksRoot}/Far Away Fireworks-01.wav`,
    `${signatureLoopsRoot}/Guitars/Ambient Guitars Loop 01 77bpm.wav`,
    `${signatureBeachRocksRoot}/Beach_Rocks_Percussion_One_Shots_Textures_1.wav`,
    `${signatureCymbalRoot}/Cymbal Crash 1.wav`,
    `${signatureWhiteNoiseRoot}/White Noise.wav`,
  ]
}
