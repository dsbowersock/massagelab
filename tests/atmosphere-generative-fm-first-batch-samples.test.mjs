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

describe("Generative.fm sample upload planning", () => {
  it("selects package-compatible source assets from the local CC0 libraries", () => {
    const plans = createGenerativeFmFirstBatchAssetPlans(createFixtureParams())

    const planPieceIds = plans.map((plan) => plan.pieceId)

    assert.equal(plans.length, 56)
    assert.deepEqual(planPieceIds.slice(0, originalBatchPieceIds.length), [...originalBatchPieceIds])
    assert.deepEqual(
      planPieceIds.slice(originalBatchPieceIds.length, originalBatchPieceIds.length + sourceRolloutPieceIds.length),
      [...sourceRolloutPieceIds],
    )
    assert.deepEqual(
      planPieceIds.slice(originalBatchPieceIds.length + sourceRolloutPieceIds.length),
      [...remainingGeneratorPieceIds],
    )

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

    const gammaWaves = plans.find((plan) => plan.pieceId === "420hz-gamma-waves-for-big-brain")
    assert.deepEqual(unique(gammaWaves.selectedAssets.map((asset) => asset.instrumentName)).sort(), [
      "sso-chorus-male",
      "vsco2-piano-mf",
      "waves",
    ])
    assert.equal(gammaWaves.selectedAssets.find((asset) => asset.instrumentName === "waves").collectionType, "array")
    assert.equal(gammaWaves.selectedAssets.find((asset) => asset.instrumentName === "sso-chorus-male").noteName, "D3")

    const buttafingers = plans.find((plan) => plan.pieceId === "buttafingers")
    assert.equal(buttafingers.selectedAssets.find((asset) => asset.instrumentName === "vcsl-claves").collectionType, "array")
    assert.equal(buttafingers.selectedAssets.find((asset) => asset.instrumentName === "vcsl-wine-glasses-slow").noteName, "D#4")

    const ritual = plans.find((plan) => plan.pieceId === "ritual")
    assert.deepEqual(unique(ritual.selectedAssets.map((asset) => asset.instrumentName)).sort(), [
      "vcsl-bassdrum-hit-ff",
      "vcsl-darbuka-1-f",
      "vcsl-darbuka-2-f",
      "vcsl-darbuka-3-f",
      "vcsl-darbuka-4-f",
      "vcsl-darbuka-5-f",
      "vcsl-didgeridoo-sus",
      "vsco2-violins-susvib",
    ])
    assert.equal(ritual.selectedAssets.find((asset) => asset.instrumentName === "vcsl-didgeridoo-sus").collectionType, "array")

    const animalia = plans.find((plan) => plan.pieceId === "animalia-chordata")
    assert.equal(animalia.selectedAssets[0].instrumentName, "whales")
    assert.equal(animalia.selectedAssets[0].collectionType, "array")

    const awash = plans.find((plan) => plan.pieceId === "awash")
    assert.deepEqual(unique(awash.selectedAssets.map((asset) => asset.instrumentName)).sort(), [
      "dry-guitar-vib",
      "vcsl-ocean-drum",
    ])

    const peace = plans.find((plan) => plan.pieceId === "peace")
    assert.deepEqual(unique(peace.selectedAssets.map((asset) => asset.instrumentName)), ["native-american-flute-susvib"])

    const zed = plans.find((plan) => plan.pieceId === "zed")
    assert.deepEqual(unique(zed.selectedAssets.map((asset) => asset.instrumentName)).sort(), ["zed__noise", "zed__pad"])
    assert.equal(zed.selectedAssets.find((asset) => asset.instrumentName === "zed__noise").collectionType, "array")
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

      const gammaWaves = uploadPlans.find((plan) => plan.pieceId === "420hz-gamma-waves-for-big-brain")
      assert.equal(gammaWaves.renderedSampleObjects.length, 0)
      assert.deepEqual(gammaWaves.sampleIndex.waves, [
        "https://media.massagelab.app/atmosphere/generative-fm/420hz-gamma-waves-for-big-brain/samples/waves-beach-ambience-4.wav",
        "https://media.massagelab.app/atmosphere/generative-fm/420hz-gamma-waves-for-big-brain/samples/waves-beach-ambience-10.wav",
      ])
      assert.ok(gammaWaves.sampleIndex["sso-chorus-male"].D3.endsWith("/sso-chorus-male-d3.wav"))

      const buttafingers = uploadPlans.find((plan) => plan.pieceId === "buttafingers")
      assert.equal(Array.isArray(buttafingers.sampleIndex["vcsl-claves"]), true)
      assert.ok(buttafingers.sampleIndex["vcsl-wine-glasses-slow"]["D#4"].endsWith("/vcsl-wine-glasses-slow-d-sharp4.wav"))

      const ritual = uploadPlans.find((plan) => plan.pieceId === "ritual")
      assert.equal(Array.isArray(ritual.sampleIndex["vcsl-didgeridoo-sus"]), true)
      assert.equal(Array.isArray(ritual.sampleIndex["vcsl-darbuka-5-f"]), true)
      assert.ok(ritual.sampleIndex["vsco2-violins-susvib"].C4.endsWith("/vsco2-violins-susvib-c4.wav"))

      const animalia = uploadPlans.find((plan) => plan.pieceId === "animalia-chordata")
      assert.equal(Array.isArray(animalia.sampleIndex.whales), true)
      assert.ok(animalia.sampleIndex.whales[0].endsWith("/whales-underwater-one-shots.wav"))

      const peace = uploadPlans.find((plan) => plan.pieceId === "peace")
      assert.ok(peace.sampleIndex["native-american-flute-susvib"].C3.endsWith("/native-american-flute-susvib-c3.wav"))

      const zed = uploadPlans.find((plan) => plan.pieceId === "zed")
      assert.ok(zed.sampleIndex["zed__pad"].C3.endsWith("/zed__pad-c3.wav"))
      assert.equal(Array.isArray(zed.sampleIndex["zed__noise"]), true)
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
    [`${signatureBeachRoot}/LICENSE_Beach_Collection_PRO.txt`]:
      "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
    [`${signatureChoirRoot}/LICENSE_Choir_Collection_PRO.txt`]:
      "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
    [`${signatureSerbianChoirRoot}/LICENSE_Serbian_Choir_PRO_v2.txt`]:
      "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
  }
}

function createFixtureFiles() {
  return [
    `${vscoRoot}/LICENSE`,
    `${vscoRoot}/Keys/Upright Piano/MappingChart.txt`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_000.wav`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn2_rr1_002.wav`,
    `${vscoRoot}/Keys/Upright Piano/Player_dyn1_rr1_000.wav`,
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
    `${vscoRoot}/Percussion/Glock/glock_medium_C5.wav`,
    `${vscoRoot}/Percussion/Glock/glock_medium_G5.wav`,
    `${vscoRoot}/Percussion/Glock/Glock_C6_v1_rr1.wav`,
    `${vscoRoot}/Percussion/Marimba/Marimba_hit_Outrigger_C4_loud_01.wav`,
    `${vcslRoot}/README.md`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v2_rr1_Main.wav`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_E5_v1_rr1_Main.wav`,
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
