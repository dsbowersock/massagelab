import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createObservableStreamsVscoAssetPlan,
  createObservableStreamsSampleIntake,
  midiToScientificPitch,
  OBSERVABLE_STREAMS_VSCO_ADAPTATION,
  parseVscoPianoMappingChart,
} from "../lib/atmosphere/sample-intake.js"

const vscoRoot = "VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0"
const vcslRoot = "VCSL-1.2.2-RC/VCSL-1.2.2-RC"
const curatedPianoMappings = Object.freeze([
  ["008", 37],
  ["010", 41],
  ["012", 45],
  ["014", 49],
  ["016", 53],
  ["018", 57],
  ["020", 61],
  ["022", 65],
  ["024", 69],
  ["026", 73],
  ["028", 77],
  ["030", 81],
])
const curatedViolinNotes = Object.freeze(["C4", "E4", "G4", "C5", "E5", "G5"])
const curatedOboeNotes = Object.freeze(["A#3", "D4", "F4", "A#4", "D5", "F5"])

describe("Atmosphere sample intake", () => {
  it("finds local candidate files for the VSCO Observable Streams requirements", () => {
    const summary = createObservableStreamsSampleIntake({
      rootPath: "C:/samples",
      files: [
        `${vscoRoot}/LICENSE`,
        `${vscoRoot}/Keys/Upright Piano/MappingChart.txt`,
        `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_000.wav`,
        `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr2_000.wav`,
        `${vscoRoot}/Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_A3_f.wav`,
        `${vscoRoot}/Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_A3_p.wav`,
        `${vscoRoot}/Woodwinds/Oboe/Sus/Oboe_Sus_A#3_v1_Main.wav`,
        `${vscoRoot}/Woodwinds/Oboe/Sus/Oboe_Sus_A#3_v3_Main.wav`,
        `${vcslRoot}/README.md`,
      ],
      vscoPianoMappingChartText: "Notation=KeyNumber\n000=21\n044=108\n",
    })

    assert.equal(summary.inventory.totalFiles, 9)
    assert.equal(summary.inventory.audioFiles, 6)
    assert.equal(summary.libraries.find((library) => library.id === "vsco-2-ce").detected, true)
    assert.equal(summary.libraries.find((library) => library.id === "vcsl").detected, true)

    const piano = summary.requirements.find((requirement) => requirement.sourceName === "vsco2-piano-mf")
    assert.equal(piano.status, "candidate-present")
    assert.equal(piano.sampleFileCount, 2)
    assert.equal(piano.mappingChartPath, `${vscoRoot}/Keys/Upright Piano/MappingChart.txt`)
    assert.deepEqual(piano.dynamicLayers, ["2"])
    assert.deepEqual(piano.roundRobins, ["1", "2"])
    assert.deepEqual(piano.pianoMapping, {
      sampleCount: 2,
      firstSampleNumber: "000",
      firstNote: "A0",
      lastSampleNumber: "044",
      lastNote: "C8",
    })

    const violin = summary.requirements.find((requirement) => requirement.sourceName === "vsco2-violin-arcvib")
    assert.equal(violin.status, "candidate-present")
    assert.equal(violin.sampleFileCount, 2)
    assert.deepEqual(violin.dynamicLayers, ["f", "p"])

    const oboe = summary.requirements.find((requirement) => requirement.sourceName === "vsco2-oboe-sus")
    assert.equal(oboe.status, "replacement-present")
    assert.equal(oboe.replacesSourceName, "sso-cor-anglais")
    assert.equal(oboe.sampleFileCount, 2)
    assert.deepEqual(oboe.dynamicLayers, ["1", "3"])
  })

  it("excludes SSO cor anglais and does not treat nearby woodwinds as that source", () => {
    const summary = createObservableStreamsSampleIntake({
      files: [
        `${vscoRoot}/Woodwinds/Oboe/Vib/Oboe_Vib_A3_v1_Main.wav`,
        `${vscoRoot}/Woodwinds/Bassoon/Sus/Bassoon_Sus_A3.wav`,
      ],
    })

    const oboe = summary.requirements.find((requirement) => requirement.sourceName === "vsco2-oboe-sus")
    const ssoCorAnglais = summary.excludedSources.find((source) => source.sourceName === "sso-cor-anglais")

    assert.equal(oboe.status, "missing")
    assert.equal(oboe.sampleFileCount, 0)
    assert.equal(ssoCorAnglais.decision, "excluded")
  })

  it("requires the intended VSCO sustained oboe replacement files", () => {
    const summary = createObservableStreamsSampleIntake({
      files: [
        `${vscoRoot}/Woodwinds/Oboe/Sus/Oboe_Sus_F5_v3_Main.wav`,
        `${vscoRoot}/Woodwinds/Oboe/Stacc/Oboe_Stacc_F5_v3_rr2_Main.wav`,
      ],
    })

    const oboe = summary.requirements.find((requirement) => requirement.sourceName === "vsco2-oboe-sus")

    assert.equal(oboe.status, "replacement-present")
    assert.equal(oboe.sampleFileCount, 1)
    assert.deepEqual(oboe.evidencePaths, [`${vscoRoot}/Woodwinds/Oboe/Sus/Oboe_Sus_F5_v3_Main.wav`])
  })

  it("builds a curated VSCO sample index for the disabled Observable Streams adaptation", () => {
    const plan = createObservableStreamsVscoAssetPlan({
      rootPath: "C:/samples",
      files: createCuratedObservableStreamsFiles(),
      vscoPianoMappingChartText: createCuratedPianoMappingChart(),
    })

    assert.equal(plan.adaptationId, OBSERVABLE_STREAMS_VSCO_ADAPTATION.id)
    assert.equal(plan.publicSampleIndexPath, OBSERVABLE_STREAMS_VSCO_ADAPTATION.sampleIndexPath)
    assert.equal(plan.missingNotes.length, 0)
    assert.equal(plan.selectedAssets.length, 24)
    assert.deepEqual(Object.keys(plan.sampleIndex).sort(), [
      "sso-cor-anglais",
      "vsco2-piano-mf",
      "vsco2-violin-arcvib",
    ])
    assert.equal(
      plan.sampleIndex["vsco2-piano-mf"]["C#2"],
      `${OBSERVABLE_STREAMS_VSCO_ADAPTATION.sampleBasePath}/piano-c-sharp2.wav`,
    )
    assert.equal(
      plan.sampleIndex["vsco2-violin-arcvib"].C4,
      `${OBSERVABLE_STREAMS_VSCO_ADAPTATION.sampleBasePath}/violin-arcvib-c4.wav`,
    )
    assert.equal(
      plan.sampleIndex["sso-cor-anglais"]["A#3"],
      `${OBSERVABLE_STREAMS_VSCO_ADAPTATION.sampleBasePath}/oboe-sus-a-sharp3.wav`,
    )
    assert.equal(plan.sampleIndex["vsco2-oboe-sus"], undefined)

    const oboeAsset = plan.selectedAssets.find(
      (asset) => asset.instrumentName === "sso-cor-anglais" && asset.noteName === "A#3",
    )
    assert.equal(
      oboeAsset.sourceRelativePath,
      `${vscoRoot}/Woodwinds/Oboe/Sus/Oboe_Sus_A#3_v1_Main.wav`,
    )
  })

  it("parses VSCO piano mapping charts into note names", () => {
    assert.deepEqual(parseVscoPianoMappingChart("Notation=KeyNumber\n000=21\n001=23\n"), [
      { sampleNumber: "000", midi: 21, noteName: "A0" },
      { sampleNumber: "001", midi: 23, noteName: "B0" },
    ])

    assert.equal(midiToScientificPitch(60), "C4")
    assert.throws(() => midiToScientificPitch(128), /Invalid MIDI note number/)
  })
})

function createCuratedPianoMappingChart() {
  return [
    "Notation=KeyNumber",
    ...curatedPianoMappings.map(([sampleNumber, midi]) => `${sampleNumber}=${midi}`),
    "",
  ].join("\n")
}

function createCuratedObservableStreamsFiles() {
  return [
    ...curatedPianoMappings.map(([sampleNumber]) => (
      `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_${sampleNumber}.wav`
    )),
    ...curatedViolinNotes.map((noteName) => (
      `${vscoRoot}/Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_${noteName}_p.wav`
    )),
    ...curatedOboeNotes.map((noteName) => (
      `${vscoRoot}/Woodwinds/Oboe/Sus/Oboe_Sus_${noteName}_v1_Main.wav`
    )),
  ]
}
