import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GENERATIVE_FM_SAMPLE_COVERAGE_STATUS,
  createGenerativeFmSampleCoverage,
  formatGenerativeFmSampleCoverageReport,
  listKnownLocalCc0GenerativeFmSampleGroups,
} from "../lib/atmosphere/generative-fm-sample-coverage.js"

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

describe("Generative.fm sample coverage", () => {
  it("separates hosted stations from local CC0 source candidates", () => {
    const coverage = createCoverage()

    assert.equal(coverage.summary.totalPieces, 57)
    assert.equal(coverage.summary.hostedPieces, 57)
    assert.equal(coverage.summary.localSourceCandidatePieces, 0)
    assert.equal(coverage.summary.replacementNeededPieces, 0)
    assert.equal(coverage.libraries.find((library) => library.id === "vsco-2-ce").licenseStatus, "license-confirmed")
    assert.equal(coverage.libraries.find((library) => library.id === "vcsl").licenseStatus, "license-confirmed")
    assert.equal(coverage.libraries.find((library) => library.id === "signature-sounds-beach").licenseStatus, "license-confirmed")
    assert.equal(coverage.libraries.find((library) => library.id === "signature-sounds-choir-teaser").licenseStatus, "license-confirmed")
    assert.equal(coverage.libraries.find((library) => library.id === "signature-sounds-site-cc0").licenseStatus, "license-confirmed")
    assert.equal(
      coverage.libraries.find((library) => library.id === "signature-sounds-site-cc0").licenseEvidencePath,
      "https://signaturesounds.org/about-",
    )

    const observableStreams = coverage.pieces.find((piece) => piece.id === "observable-streams")
    assert.equal(observableStreams.status, "hosted")
    assert.equal(
      observableStreams.sampleGroups.every((group) => group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED),
      true,
    )

    const atSunrise = coverage.pieces.find((piece) => piece.id === "at-sunrise")
    assert.equal(atSunrise.status, "hosted")
    assert.equal(atSunrise.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED)
    assert.equal(atSunrise.sampleGroups[0].sourceName, "at-sunrise__vcsl-vibraphone-soft-mallets-mp")
    assert.equal(atSunrise.sampleGroups[0].library, "massagelab-public-media")

    const dayDream = coverage.pieces.find((piece) => piece.id === "day-dream")
    assert.equal(dayDream.status, "hosted")
    assert.equal(dayDream.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
    assert.equal(dayDream.sampleGroups[0].sourceName, "vsco2-piano-mf")
    assert.equal(dayDream.sampleGroups[0].library, "VSCO 2 Community Edition")

    const noRefrain = coverage.pieces.find((piece) => piece.id === "no-refrain")
    assert.equal(noRefrain.status, "hosted")
    assert.equal(noRefrain.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED)
    assert.equal(noRefrain.sampleGroups[0].sourceName, "no-refrain__vsco2-piano-mf")
    assert.equal(noRefrain.sampleGroups[0].library, "massagelab-public-media")
  })

  it("keeps shared source names piece-scoped when selected piano stations have hosted indexes", () => {
    const coverage = createCoverage()

    const aisatsana = coverage.pieces.find((piece) => piece.id === "aisatsana")
    assert.equal(aisatsana.status, "hosted")
    assert.equal(aisatsana.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
    assert.equal(aisatsana.sampleGroups[0].sourceName, "vsco2-piano-mf")

    const dayDream = coverage.pieces.find((piece) => piece.id === "day-dream")
    assert.equal(dayDream.status, "hosted")
    assert.equal(dayDream.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
    assert.equal(dayDream.sampleGroups[0].sourceName, "vsco2-piano-mf")

    const pinwheels = coverage.pieces.find((piece) => piece.id === "pinwheels")
    assert.equal(pinwheels.status, "hosted")
    assert.equal(pinwheels.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
    assert.equal(pinwheels.sampleGroups[0].sourceName, "vsco2-piano-mf")

    const splash = coverage.pieces.find((piece) => piece.id === "splash")
    assert.equal(splash.status, "hosted")
    assert.equal(splash.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
    assert.equal(splash.sampleGroups[0].sourceName, "vsco2-piano-mf")

    const pulseCodeModulation = coverage.pieces.find((piece) => piece.id === "pulse-code-modulation")
    assert.equal(pulseCodeModulation.status, "hosted")
    assert.equal(
      pulseCodeModulation.sampleGroups.find((group) => group.sourceName === "vsco2-piano-mf").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )
    assert.equal(
      pulseCodeModulation.sampleGroups.find((group) => group.sourceName === "acoustic-guitar").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )
  })

  it("requires confirmed local license evidence before reporting non-hosted CC0 candidates", () => {
    const coverage = createGenerativeFmSampleCoverage({
      files: createLocalCandidateFiles(),
    })
    const pulseCodeModulation = coverage.pieces.find((piece) => piece.id === "pulse-code-modulation")

    assert.equal(pulseCodeModulation.status, "hosted")
    assert.equal(
      pulseCodeModulation.sampleGroups.find((group) => group.sourceName === "vsco2-piano-mf").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LICENSE_EVIDENCE_MISSING,
    )
  })

  it("keeps hosted stations available even when local files are absent", () => {
    const coverage = createGenerativeFmSampleCoverage()
    const atSunrise = coverage.pieces.find((piece) => piece.id === "at-sunrise")
    const dayDream = coverage.pieces.find((piece) => piece.id === "day-dream")

    assert.equal(atSunrise.status, "hosted")
    assert.equal(atSunrise.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED)
    assert.equal(atSunrise.sampleGroups[0].sourceName, "at-sunrise__vcsl-vibraphone-soft-mallets-mp")
    assert.equal(dayDream.status, "hosted")
  })

  it("maps configured SSO roles to local CC0 replacement candidates while unknown groups stay blocked", () => {
    const coverage = createCoverage()

    const aboveTheRain = coverage.pieces.find((piece) => piece.id === "above-the-rain")
    assert.equal(aboveTheRain.status, "hosted")
    assert.equal(
      aboveTheRain.sampleGroups.find((group) => group.sourceName === "sso-chorus-female").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )
    assert.equal(
      aboveTheRain.sampleGroups.find((group) => group.sourceName === "sso-chorus-female").library,
      "Signature Sounds Choirs/Vocals SFX Teaser",
    )

    const enough = coverage.pieces.find((piece) => piece.id === "enough")
    assert.equal(enough.status, "hosted")
    assert.equal(enough.sampleGroups[0].sourceName, "sso-cor-anglais")
    assert.equal(enough.sampleGroups[0].library, "VSCO 2 Community Edition")

    const gammaWaves = coverage.pieces.find((piece) => piece.id === "420hz-gamma-waves-for-big-brain")
    assert.equal(gammaWaves.status, "hosted")
    assert.equal(
      gammaWaves.sampleGroups.find((group) => group.sourceName === "waves").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )
    assert.equal(
      gammaWaves.sampleGroups.find((group) => group.sourceName === "sso-chorus-male").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )

    const animalia = coverage.pieces.find((piece) => piece.id === "animalia-chordata")
    assert.equal(animalia.status, "hosted")
    assert.equal(animalia.sampleGroups[0].sourceName, "whales")
    assert.equal(animalia.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
  })

  it("lists known local CC0 source rules for future rendered-sample planning", () => {
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("vsco2-piano-mf"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("vcsl-darbuka-5-f"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("waves"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("sso-cor-anglais"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("sso-chorus-female"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("whales"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("zed__pad"), true)
  })

  it("formats a human-readable report", () => {
    const report = formatGenerativeFmSampleCoverageReport(createCoverage())

    assert.match(report, /Generative\.fm Sample Coverage Report/)
    assert.match(report, /Hosted\/playable/)
    assert.match(report, /Signature Sounds site-wide CC0 packs/)
    assert.match(report, /Day\/Dream \(day-dream\)/)
    assert.match(report, /Animalia Chordata \(animalia-chordata\)/)
  })
})

function createCoverage() {
  return createGenerativeFmSampleCoverage({
    rootPath: "C:/samples",
    files: createLocalCandidateFiles(),
    licenseTextByPath: {
      [`${vscoRoot}/LICENSE`]: "CC0 1.0 Universal",
      [`${vcslRoot}/README.md`]: "Creative Commons 0 Public Domain",
      [`${signatureBeachRoot}/LICENSE_Beach_Collection_PRO.txt`]:
        "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
      [`${signatureChoirRoot}/LICENSE_Choir_Collection_PRO.txt`]:
        "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
      [`${signatureSerbianChoirRoot}/LICENSE_Serbian_Choir_PRO_v2.txt`]:
        "Creative Commons CC0 1.0 Universal Public Domain. Use these sounds for any purpose, including commercial. No attribution is required.",
    },
  })
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
    `${vcslRoot}/README.md`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav`,
    `${vcslRoot}/Membranophones/Other Membranophones/Ocean Drum/OceanDrum_Sus_1_Mid.wav`,
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
