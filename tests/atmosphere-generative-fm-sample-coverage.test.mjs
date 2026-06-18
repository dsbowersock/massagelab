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

describe("Generative.fm sample coverage", () => {
  it("separates hosted stations from local CC0 source candidates", () => {
    const coverage = createCoverage()

    assert.equal(coverage.summary.totalPieces, 57)
    assert.equal(coverage.summary.hostedPieces, 8)
    assert.equal(coverage.summary.localSourceCandidatePieces, 18)
    assert.equal(coverage.summary.replacementNeededPieces, 31)
    assert.equal(coverage.libraries.find((library) => library.id === "vsco-2-ce").licenseStatus, "license-confirmed")
    assert.equal(coverage.libraries.find((library) => library.id === "vcsl").licenseStatus, "license-confirmed")
    assert.equal(coverage.libraries.find((library) => library.id === "signature-sounds-beach").licenseStatus, "license-confirmed")
    assert.equal(coverage.libraries.find((library) => library.id === "signature-sounds-choir-teaser").licenseStatus, "license-confirmed")

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
    assert.equal(pinwheels.status, "local-source-candidate")
    assert.equal(pinwheels.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
    assert.equal(pinwheels.sampleGroups[0].sourceName, "vsco2-piano-mf")
  })

  it("requires confirmed local license evidence before reporting non-hosted CC0 candidates", () => {
    const coverage = createGenerativeFmSampleCoverage({
      files: createLocalCandidateFiles(),
    })
    const pinwheels = coverage.pieces.find((piece) => piece.id === "pinwheels")

    assert.equal(pinwheels.status, "replacement-needed")
    assert.equal(pinwheels.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LICENSE_EVIDENCE_MISSING)
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
    assert.equal(aboveTheRain.status, "local-source-candidate")
    assert.equal(
      aboveTheRain.sampleGroups.find((group) => group.sourceName === "sso-chorus-female").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )
    assert.equal(
      aboveTheRain.sampleGroups.find((group) => group.sourceName === "sso-chorus-female").library,
      "Signature Sounds Choirs/Vocals SFX Teaser",
    )

    const enough = coverage.pieces.find((piece) => piece.id === "enough")
    assert.equal(enough.status, "local-source-candidate")
    assert.equal(enough.sampleGroups[0].sourceName, "sso-cor-anglais")
    assert.equal(enough.sampleGroups[0].library, "VSCO 2 Community Edition")

    const gammaWaves = coverage.pieces.find((piece) => piece.id === "420hz-gamma-waves-for-big-brain")
    assert.equal(gammaWaves.status, "local-source-candidate")
    assert.equal(
      gammaWaves.sampleGroups.find((group) => group.sourceName === "waves").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )
    assert.equal(
      gammaWaves.sampleGroups.find((group) => group.sourceName === "sso-chorus-male").status,
      GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    )

    const animalia = coverage.pieces.find((piece) => piece.id === "animalia-chordata")
    assert.equal(animalia.status, "replacement-needed")
    assert.equal(animalia.sampleGroups[0].sourceName, "whales")
    assert.equal(animalia.sampleGroups[0].status, GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.REPLACEMENT_NEEDED)
  })

  it("lists known local CC0 source rules for future rendered-sample planning", () => {
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("vsco2-piano-mf"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("vcsl-darbuka-5-f"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("waves"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("sso-cor-anglais"), true)
    assert.equal(listKnownLocalCc0GenerativeFmSampleGroups().includes("sso-chorus-female"), true)
  })

  it("formats a human-readable report", () => {
    const report = formatGenerativeFmSampleCoverageReport(createCoverage())

    assert.match(report, /Generative\.fm Sample Coverage Report/)
    assert.match(report, /Ready For Render\/Upload Planning/)
    assert.match(report, /Needs Replacement Or Separate Source Review/)
    assert.match(report, /Day\/Dream \(day-dream\)/)
    assert.match(report, /sso-chorus-female: local-cc0-candidate/)
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
    `${vscoRoot}/Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_C1_v1_rr1.wav`,
    `${vscoRoot}/Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_C4_p.wav`,
    `${vscoRoot}/Brass/Trumpet/sus/Sum_SHTrumpet_sus_C3_v1_rr1.wav`,
    `${vcslRoot}/README.md`,
    `${vcslRoot}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav`,
    `${signatureBeachRoot}/LICENSE_Beach_Collection_PRO.txt`,
    `${signatureBeachRoot}/Beach_Ambience_4.wav`,
    `${signatureBeachRoot}/Beach_Ambience_10.wav`,
    `${signatureChoirRoot}/LICENSE_Choir_Collection_PRO.txt`,
    `${signatureChoirRoot}/Choirs_Children_Ambience_-01.wav`,
    `${signatureChoirRoot}/Men_Of_Choirs_05_Key_D.wav`,
    `${signatureSerbianChoirRoot}/LICENSE_Serbian_Choir_PRO_v2.txt`,
    `${signatureSerbianChoirRoot}/CHOIR_SerbianOrthodox_Ambience_01.wav`,
  ]
}
