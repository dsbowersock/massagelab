import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import {
  createGenerativeFmFirstBatchAssetPlans,
  createGenerativeFmFirstBatchR2UploadPlans,
  createGenerativeFmFirstBatchRenderedSampleObjects,
} from "../lib/atmosphere/generative-fm-first-batch-samples.js"
import { decodeWav, encodePcm16Wav } from "../lib/atmosphere/prerendered-samples.js"

const vscoRoot = "VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0"
const vcslRoot = "VCSL-1.2.2-RC/VCSL-1.2.2-RC"

describe("Generative.fm sample upload planning", () => {
  it("selects package-compatible source assets from the local CC0 libraries", () => {
    const plans = createGenerativeFmFirstBatchAssetPlans(createFixtureParams())

    assert.deepEqual(plans.map((plan) => plan.pieceId), [
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

    const aisatsana = plans.find((plan) => plan.pieceId === "aisatsana")
    assert.equal(aisatsana.objectPrefix, "atmosphere/generative-fm/aisatsana")
    assert.deepEqual(aisatsana.selectedAssets.map((asset) => asset.noteName), ["C4", "E4"])
    assert.deepEqual(unique(aisatsana.selectedAssets.map((asset) => asset.instrumentName)), ["vsco2-piano-mf"])

    const secondBatchPianoPieces = ["day-dream", "eno-machine", "impact", "lemniscate"].map((pieceId) =>
      plans.find((plan) => plan.pieceId === pieceId)
    )
    assert.deepEqual(
      secondBatchPianoPieces.map((plan) => plan.selectedAssets.map((asset) => asset.noteName)),
      [
        ["C4", "E4"],
        ["C4", "E4"],
        ["C4", "E4"],
        ["C4", "E4"],
      ],
    )

    const thirdBatchPianoPieces = ["pinwheels", "sevenths", "uun"].map((pieceId) =>
      plans.find((plan) => plan.pieceId === pieceId)
    )
    assert.deepEqual(
      thirdBatchPianoPieces.map((plan) => plan.selectedAssets.map((asset) => asset.noteName)),
      [
        ["C4", "E4"],
        ["C4", "E4"],
        ["C4", "E4"],
      ],
    )

    const atSunrise = plans.find((plan) => plan.pieceId === "at-sunrise")
    assert.deepEqual(atSunrise.selectedAssets.map((asset) => asset.noteName), ["C3", "E5"])
    assert.equal(
      atSunrise.selectedAssets.find((asset) => asset.noteName === "C3").sourceRelativePath,
      `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav`,
    )

    const littleBells = plans.find((plan) => plan.pieceId === "little-bells")
    assert.deepEqual(littleBells.selectedAssets.map((asset) => asset.noteName), ["C5", "G5", "C6"])
    assert.equal(littleBells.renderedTargets[0].renderedInstrumentName, "little-bells__vsco2-glock")

    const renderedPianoPieces = ["no-refrain", "transmission", "trees"].map((pieceId) =>
      plans.find((plan) => plan.pieceId === pieceId)
    )
    assert.deepEqual(
      renderedPianoPieces.map((plan) => plan.selectedAssets.map((asset) => asset.noteName)),
      [
        ["C4", "E4"],
        ["C4", "E4"],
        ["C4", "E4"],
      ],
    )
    assert.deepEqual(
      renderedPianoPieces.map((plan) => plan.renderedTargets[0].renderedInstrumentName),
      ["no-refrain__vsco2-piano-mf", "transmission__vsco2-piano-mf", "trees__vsco2-piano-mf"],
    )
  })

  it("creates source, rendered, index, and manifest objects without committing audio", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "massagelab-generative-fm-"))
    try {
      await writeFixtureAudioFiles(tempDir)
      const uploadPlans = await createGenerativeFmFirstBatchR2UploadPlans({
        ...createFixtureParams(),
        rootPath: tempDir,
        publicBaseUrl: "https://media.massagelab.app",
      })

      const aisatsana = uploadPlans.find((plan) => plan.pieceId === "aisatsana")
      assert.equal(aisatsana.sampleObjects.length, 2)
      assert.equal(aisatsana.renderedSampleObjects.length, 0)
      assert.equal(aisatsana.sampleIndex["vsco2-piano-mf"].C4, "https://media.massagelab.app/atmosphere/generative-fm/aisatsana/samples/vsco2-piano-mf-c4.wav")
      assert.equal(aisatsana.metadataObjects.length, 2)

      const impact = uploadPlans.find((plan) => plan.pieceId === "impact")
      assert.equal(impact.sampleObjects.length, 2)
      assert.equal(impact.renderedSampleObjects.length, 0)
      assert.equal(impact.sampleIndex["vsco2-piano-mf"].E4, "https://media.massagelab.app/atmosphere/generative-fm/impact/samples/vsco2-piano-mf-e4.wav")

      const pinwheels = uploadPlans.find((plan) => plan.pieceId === "pinwheels")
      assert.equal(pinwheels.sampleObjects.length, 2)
      assert.equal(pinwheels.renderedSampleObjects.length, 0)
      assert.equal(pinwheels.sampleIndex["vsco2-piano-mf"].C4, "https://media.massagelab.app/atmosphere/generative-fm/pinwheels/samples/vsco2-piano-mf-c4.wav")

      const atSunrise = uploadPlans.find((plan) => plan.pieceId === "at-sunrise")
      assert.equal(atSunrise.renderedSampleObjects.length, 8)
      assert.equal(atSunrise.sampleIndex["at-sunrise__vcsl-vibraphone-soft-mallets-mp"].C3, "https://media.massagelab.app/atmosphere/generative-fm/at-sunrise/rendered/at-sunrise__vcsl-vibraphone-soft-mallets-mp/rendered-vibraphone-soft-mallets-c3.wav")
      assert.equal(atSunrise.manifest.renderedAssets[0].render.pitchShiftSemitones, -12)
      assert.equal(decodeWav(atSunrise.renderedSampleObjects[0].body).channels.length, 1)

      const littleBells = uploadPlans.find((plan) => plan.pieceId === "little-bells")
      assert.equal(littleBells.renderedSampleObjects.length, 10)
      assert.equal(littleBells.objectCount, littleBells.sampleObjects.length + littleBells.renderedSampleObjects.length + 2)
      assert.ok(littleBells.sampleIndex["little-bells__vsco2-glock"]["D#5"].endsWith("/rendered-glock-d-sharp5.wav"))

      const noRefrain = uploadPlans.find((plan) => plan.pieceId === "no-refrain")
      assert.equal(noRefrain.renderedSampleObjects.length, 12)
      assert.ok(noRefrain.sampleIndex["no-refrain__vsco2-piano-mf"].A2.endsWith("/rendered-piano-a2.wav"))

      const transmission = uploadPlans.find((plan) => plan.pieceId === "transmission")
      assert.equal(transmission.renderedSampleObjects.length, 12)
      assert.ok(transmission.sampleIndex["transmission__vsco2-piano-mf"]["C#2"].endsWith("/rendered-piano-c-sharp2.wav"))

      const trees = uploadPlans.find((plan) => plan.pieceId === "trees")
      assert.equal(trees.renderedSampleObjects.length, 13)
      assert.ok(trees.sampleIndex["trees__vsco2-piano-mf"].B6.endsWith("/rendered-piano-b6.wav"))
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it("rejects source paths outside the supplied audio root", async () => {
    const [assetPlan] = createGenerativeFmFirstBatchAssetPlans({
      ...createFixtureParams(),
      pieceIds: ["at-sunrise"],
    })
    assetPlan.selectedAssets = [
      {
        ...assetPlan.selectedAssets[0],
        sourceRelativePath: "../outside.wav",
      },
    ]

    await assert.rejects(
      () => createGenerativeFmFirstBatchRenderedSampleObjects({
        assetPlan,
        audioRoot: os.tmpdir(),
        publicBaseUrl: "https://media.massagelab.app",
      }),
      /outside audioRoot/,
    )
  })
})

function createFixtureParams() {
  return {
    files: createFixtureFiles(),
    licenseTextByPath: createLicenseTextByPath(),
    vscoPianoMappingChartText: "000=60\n002=64\n",
  }
}

function createLicenseTextByPath() {
  return {
    [`${vscoRoot}/LICENSE`]: "CC0 1.0 Universal",
    [`${vcslRoot}/README.md`]: "Creative Commons 0 Public Domain",
  }
}

function createFixtureFiles() {
  return [
    `${vscoRoot}/LICENSE`,
    `${vscoRoot}/Keys/Upright Piano/MappingChart.txt`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_000.wav`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_002.wav`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn1_rr1_000.wav`,
    `${vscoRoot}/Percussion/Glock/glock_medium_C5.wav`,
    `${vscoRoot}/Percussion/Glock/glock_medium_G5.wav`,
    `${vscoRoot}/Percussion/Glock/Glock_C6_v1_rr1.wav`,
    `${vcslRoot}/README.md`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v2_rr1_Main.wav`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_E5_v1_rr1_Main.wav`,
  ]
}

async function writeFixtureAudioFiles(rootPath) {
  const body = encodePcm16Wav({
    sampleRate: 8000,
    channels: [Float32Array.from(Array(800).fill(0.25))],
  })

  await Promise.all(createFixtureFiles()
    .filter((filePath) => filePath.endsWith(".wav"))
    .map(async (filePath) => {
      const absolutePath = path.join(rootPath, filePath)
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, body)
    }))
}

function unique(values) {
  return [...new Set(values)]
}
