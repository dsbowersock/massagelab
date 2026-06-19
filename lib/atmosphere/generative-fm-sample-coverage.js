// @ts-check

import {
  GENERATIVE_FM_PIECES,
  isHostedGenerativeFmPiece,
  listHostedGenerativeFmSampleGroups,
} from "./generative-fm-catalog.js"

const VSCO_ROOT_MARKER = "vsco-2-ce-1.1.0/vsco-2-ce-1.1.0"
const VCSL_ROOT_MARKER = "vcsl-1.2.2-rc/vcsl-1.2.2-rc"
const SIGNATURE_SAMPLES_ROOT_MARKER = "signature samples"
const SIGNATURE_SOUNDS_BEACH_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_beach_ambience_recordings_cc0/ss_beach_ambience_recordings_cc0`
const SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_choirs_vocals_sfx_teaser_cc0/ss_choirs_vocals_sfx_teaser_cc0`
const SIGNATURE_SOUNDS_SERBIAN_CHOIR_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_serbian_orthodox_choirs_original_recordings_cc0/ss_serbian_orthodox_choirs_original_recordings_cc0`
const SIGNATURE_SOUNDS_BELL_ONE_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_bell_one_kit_key_cc0/ss_bell_one_kit_key_cc0`
const SIGNATURE_SOUNDS_BURIAL_PADS_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_burial_pads_cc0/ss_burial_pads_cc0`
const SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/spiritual+acoustics+cc0+signaturesounds.org/spiritual acoustics cc0 signaturesounds.org`
const SIGNATURE_SOUNDS_UNDERWATER_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/underwater+one+shots+2/underwater one shots`
const SIGNATURE_SOUNDS_SPANISH_GUITAR_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/spanish+guitar/spanish guitar`
const SIGNATURE_SOUNDS_CUTLERY_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_cutlery_percussion_foley_cc0/ss_cutlery_percussion_foley_cc0`
const SIGNATURE_SOUNDS_VHS_DRUM_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/vhs-drumkit+cc0+2/vhs-drumkit cc0`
const SIGNATURE_SOUNDS_LONDON_UNDERGROUND_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/london+underground+rcordings/london underground rcordings`
const SIGNATURE_SOUNDS_KOTOR_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/kotor,+montenegro+-signaturesounds.org/kotor, montenegro -signaturesounds.org`
const SIGNATURE_SOUNDS_FIREWORKS_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/distant+fireworks/distant fireworks`
const SIGNATURE_SOUNDS_LOOPS_AMBIENCE_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/loops+of+ambience/loops of ambience`
const SIGNATURE_SOUNDS_BEACH_ROCKS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_beach-rocks_textures_cc0/ss_beach-rocks_textures_cc0`
const SIGNATURE_SOUNDS_CYMBAL_CRASHES_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/cymbal+crashes+-+signaturesounds.org/cymbal crashes - signaturesounds.org`
const SIGNATURE_SOUNDS_WHITE_NOISE_ROOT_MARKER = `${SIGNATURE_SAMPLES_ROOT_MARKER}/white+noise/white noise`

export const GENERATIVE_FM_SAMPLE_COVERAGE_STATUS = Object.freeze({
  HOSTED: "hosted",
  LOCAL_CC0_CANDIDATE: "local-cc0-candidate",
  LICENSE_EVIDENCE_MISSING: "license-evidence-missing",
  SOURCE_FILES_MISSING: "source-files-missing",
  EXCLUDED_LICENSE: "excluded-license",
  REPLACEMENT_NEEDED: "replacement-needed",
})

const LIBRARIES = Object.freeze({
  "vsco-2-ce": Object.freeze({
    id: "vsco-2-ce",
    title: "VSCO 2 Community Edition",
    rootMarker: VSCO_ROOT_MARKER,
    license: "CC0 1.0 Universal",
    licenseEvidencePathSuffix: `${VSCO_ROOT_MARKER}/license`,
    licenseTextNeedles: Object.freeze(["cc0 1.0 universal"]),
  }),
  vcsl: Object.freeze({
    id: "vcsl",
    title: "Versilian Community Sample Library",
    rootMarker: VCSL_ROOT_MARKER,
    license: "CC0",
    licenseEvidencePathSuffix: `${VCSL_ROOT_MARKER}/readme.md`,
    licenseTextNeedles: Object.freeze(["creative commons 0", "public domain"]),
  }),
  "signature-sounds-beach": Object.freeze({
    id: "signature-sounds-beach",
    title: "Signature Sounds Beach Ambience Recordings",
    rootMarker: SIGNATURE_SOUNDS_BEACH_ROOT_MARKER,
    license: "CC0 1.0 Universal",
    licenseEvidencePathSuffix: `${SIGNATURE_SOUNDS_BEACH_ROOT_MARKER}/license_beach_collection_pro.txt`,
    licenseTextNeedles: Object.freeze(["cc0 1.0 universal", "commercial", "no attribution"]),
  }),
  "signature-sounds-choir-teaser": Object.freeze({
    id: "signature-sounds-choir-teaser",
    title: "Signature Sounds Choirs/Vocals SFX Teaser",
    rootMarker: SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER,
    license: "CC0 1.0 Universal",
    licenseEvidencePathSuffix: `${SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER}/license_choir_collection_pro.txt`,
    licenseTextNeedles: Object.freeze(["cc0 1.0 universal", "commercial", "no attribution"]),
  }),
  "signature-sounds-serbian-choir": Object.freeze({
    id: "signature-sounds-serbian-choir",
    title: "Signature Sounds Serbian Orthodox Choirs",
    rootMarker: SIGNATURE_SOUNDS_SERBIAN_CHOIR_ROOT_MARKER,
    license: "CC0 1.0 Universal",
    licenseEvidencePathSuffix: `${SIGNATURE_SOUNDS_SERBIAN_CHOIR_ROOT_MARKER}/license_serbian_choir_pro_v2.txt`,
    licenseTextNeedles: Object.freeze(["cc0 1.0 universal", "commercial", "no attribution"]),
  }),
  "signature-sounds-site-cc0": Object.freeze({
    id: "signature-sounds-site-cc0",
    title: "Signature Sounds site-wide CC0 packs",
    rootMarker: SIGNATURE_SAMPLES_ROOT_MARKER,
    license: "CC0 1.0 Universal",
    licenseEvidencePathSuffix: null,
    licenseTextNeedles: Object.freeze([]),
    siteEvidenceUrl: "https://signaturesounds.org/about-",
  }),
})

const LOCAL_CC0_SAMPLE_SOURCE_RULES = Object.freeze({
  waves: signatureBeachRule({
    label: "Signature Sounds beach ambience wave recordings",
    pathContains: [SIGNATURE_SOUNDS_BEACH_ROOT_MARKER],
    fileNameIncludes: ["beach_ambience"],
    note:
      "Uses CC0 Signature Sounds beach ambience WAVs for Generative.fm packages that expect a waves source group. Package-compatible rendered uploads still need to preserve the requested sample names before playback is enabled.",
  }),
  "sso-cor-anglais": vscoRule({
    label: "VSCO sustained oboe replacement for SSO cor anglais",
    pathContains: ["woodwinds/oboe/sus/"],
    note:
      "Intentionally substitutes CC0 VSCO sustained oboe for the original SSO cor anglais role. Rendered uploads should keep the package-facing SSO sample name while serving this replacement source.",
  }),
  "sso-chorus-female": signatureChoirTeaserRule({
    label: "Signature Sounds children choir ambience replacement for SSO female chorus",
    pathContains: [SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER],
    fileNameIncludes: ["choirs_children_ambience"],
    note:
      "Intentionally substitutes CC0 Signature Sounds children choir ambience for the original SSO female chorus role. Rendered uploads should keep the package-facing SSO sample name while serving this replacement source.",
  }),
  "sso-chorus-male": signatureChoirTeaserRule({
    label: "Signature Sounds men-of-choirs replacement for SSO male chorus",
    pathContains: [SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER],
    fileNameIncludes: ["men_of"],
    note:
      "Intentionally substitutes CC0 Signature Sounds men-of-choirs WAVs for the original SSO male chorus role. Rendered uploads should keep the package-facing SSO sample name while serving this replacement source.",
  }),
  "vsco2-piano-mf": vscoRule({
    label: "VSCO upright piano medium dynamic",
    pathContains: ["keys/upright piano/"],
    extraRequiredPathSuffixes: [`${VSCO_ROOT_MARKER}/keys/upright piano/mappingchart.txt`],
    note:
      "Uses the VSCO upright piano source plus MappingChart.txt. Each package still needs a rendered-note plan before playback is enabled.",
  }),
  "vsco2-contrabass-susvib": vscoRule({
    label: "VSCO solo contrabass sustain vibrato",
    pathContains: ["strings/solo contrabass/susvib/"],
  }),
  "vsco2-violin-arcvib": vscoRule({
    label: "VSCO solo violin arco vibrato",
    pathContains: ["strings/solo violin/arco vib/"],
  }),
  "vsco2-trumpet-sus-mf": vscoRule({
    label: "VSCO trumpet sustain medium dynamic",
    pathContains: ["brass/trumpet/sus/"],
  }),
  "vsco2-trumpet-sus-f": vscoRule({
    label: "VSCO trumpet sustain forte dynamic",
    pathContains: ["brass/trumpet/sus/"],
  }),
  "vsco2-violins-susvib": vscoRule({
    label: "VSCO violin section sustain vibrato",
    pathContains: ["strings/violin section/susvib/"],
  }),
  "vsco2-cellos-susvib-mp": vscoRule({
    label: "VSCO cello section sustain vibrato medium piano",
    pathContains: ["strings/cello section/susvib/"],
  }),
  "vsco2-cello-susvib-f": vscoRule({
    label: "VSCO cello section sustain vibrato forte",
    pathContains: ["strings/cello section/susvib/"],
  }),
  "vsco2-trombone-sus-mf": vscoRule({
    label: "VSCO tenor trombone sustain medium dynamic",
    pathContains: ["brass/tenor trombone/sus/"],
  }),
  "vsco2-tuba-sus-mf": vscoRule({
    label: "VSCO tuba sustain medium dynamic",
    pathContains: ["brass/tuba/sus/"],
  }),
  "vsco2-glock": vscoRule({
    label: "VSCO glockenspiel",
    pathContains: ["percussion/glock/"],
  }),
  "vsco2-marimba": vscoRule({
    label: "VSCO marimba",
    pathContains: ["percussion/marimba/"],
  }),
  "vsco2-flute-susvib": vscoRule({
    label: "VSCO flute sustain vibrato",
    pathContains: ["woodwinds/flute/susvib/"],
  }),
  "vsco2-harp": vscoRule({
    label: "VSCO harp",
    pathContains: ["strings/harp/"],
  }),
  "vcsl-vibraphone-soft-mallets-mp": vcslRule({
    label: "VCSL vibraphone soft mallets",
    pathContains: ["idiophones/struck idiophones/vibraphone/soft mallets/"],
  }),
  "vcsl-ocean-drum": vcslRule({
    label: "VCSL ocean drum",
    pathContains: ["membranophones/other membranophones/ocean drum/"],
  }),
  "vcsl-wine-glasses-slow": vcslRule({
    label: "VCSL wine glasses slow sustains",
    pathContains: ["idiophones/friction idiophones/wine glasses/sustains/slow/"],
  }),
  "vcsl-claves": vcslRule({
    label: "VCSL claves",
    pathContains: ["idiophones/struck idiophones/claves/"],
  }),
  "vcsl-didgeridoo-sus": vcslRule({
    label: "VCSL didgeridoo sustain",
    pathContains: ["aerophones/lip aerophones/didgeridoo/"],
    fileNameIncludes: ["sus"],
  }),
  "vcsl-bassdrum-hit-ff": vcslRule({
    label: "VCSL bass drum hit fortissimo",
    pathContains: ["membranophones/struck membranophones/bass drum 2/"],
    fileNameIncludes: ["hit_ff"],
  }),
  "vcsl-darbuka-1-f": vcslRule({
    label: "VCSL darbuka hit 1",
    pathContains: ["membranophones/struck membranophones/darbuka/"],
    fileNameIncludes: ["darbuka_1_hit"],
  }),
  "vcsl-darbuka-2-f": vcslRule({
    label: "VCSL darbuka hit 2",
    pathContains: ["membranophones/struck membranophones/darbuka/"],
    fileNameIncludes: ["darbuka_2_hit"],
  }),
  "vcsl-darbuka-3-f": vcslRule({
    label: "VCSL darbuka hit 3",
    pathContains: ["membranophones/struck membranophones/darbuka/"],
    fileNameIncludes: ["darbuka_3_hit"],
  }),
  "vcsl-darbuka-4-f": vcslRule({
    label: "VCSL darbuka hit 4",
    pathContains: ["membranophones/struck membranophones/darbuka/"],
    fileNameIncludes: ["darbuka_4_hit"],
  }),
  "vcsl-darbuka-5-f": vcslRule({
    label: "VCSL darbuka hit 5",
    pathContains: ["membranophones/struck membranophones/darbuka/"],
    fileNameIncludes: ["darbuka_5_hit"],
  }),
  "vcsl-tenor-sax-vib": vcslRule({
    label: "VCSL tenor saxophone vibrato",
    pathContains: ["aerophones/reed aerophones/tenor saxophone/vibrato/"],
  }),
  whales: signatureSiteRule({
    label: "Signature Sounds underwater one-shots whale-texture replacement",
    pathContains: [SIGNATURE_SOUNDS_UNDERWATER_ROOT_MARKER],
    fileNameIncludes: ["underwater one shots"],
    note:
      "Uses Signature Sounds underwater one-shots as a CC0 replacement for the original whale source. Animalia Chordata can still let the package create its dryer/wetter rendered layers in the browser.",
  }),
  "dry-guitar-vib": signatureSiteRule({
    label: "Signature Sounds Spiritual Acoustics guitar replacement",
    pathContains: [SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER],
    fileNameIncludes: ["spiritual acoustics loop"],
    note:
      "Uses Signature Sounds Spiritual Acoustics WAVs as a CC0 replacement for dry-guitar-vib, preserving the package-facing source name in the hosted index.",
  }),
  "dan-tranh-gliss-ps": signatureSiteRule({
    label: "Signature Sounds Spanish guitar gliss replacement",
    pathContains: [SIGNATURE_SOUNDS_SPANISH_GUITAR_ROOT_MARKER],
    fileNameIncludes: ["spanish guitars"],
    note:
      "The downloaded Zither pack contains AIF files, so this branch uses Signature Sounds Spanish Guitar WAVs as the CC0 plucked/gliss replacement.",
  }),
  "itslucid-lofi-hats": signatureSiteRule({
    label: "Signature Sounds cutlery percussion hat replacement",
    pathContains: [SIGNATURE_SOUNDS_CUTLERY_ROOT_MARKER],
    fileNameIncludes: ["cutlery_percussion"],
    note:
      "Uses a roomy CC0 Signature Sounds metallic percussion set with enough entries for pieces that index several lofi hat takes.",
  }),
  "itslucid-lofi-kick": signatureSiteRule({
    label: "Signature Sounds VHS drum kick replacement",
    pathContains: [SIGNATURE_SOUNDS_VHS_DRUM_ROOT_MARKER],
    fileNameIncludes: ["bdr-"],
    note: "Uses Signature Sounds VHS drum kick WAVs as a CC0 replacement for the lofi kick source group.",
  }),
  "itslucid-lofi-snare": signatureSiteRule({
    label: "Signature Sounds VHS drum snare replacement",
    pathContains: [SIGNATURE_SOUNDS_VHS_DRUM_ROOT_MARKER],
    fileNameIncludes: ["sdr-"],
    note:
      "Uses Signature Sounds VHS drum snare WAVs as a CC0 replacement and keeps enough ordered takes for Skyline's indexed snare selection.",
  }),
  "kasper-singing-bowls": signatureSiteRule({
    label: "Signature Sounds keyed bell one-shot singing-bowl replacement",
    pathContains: [SIGNATURE_SOUNDS_BELL_ONE_ROOT_MARKER],
    fileNameIncludes: ["bell_one_shot"],
    note:
      "Uses keyed Signature Sounds bell one-shots as a CC0 resonant replacement for the singing-bowls sampler.",
  }),
  "idling-truck": signatureSiteRule({
    label: "Signature Sounds London Underground engine ambience replacement",
    pathContains: [SIGNATURE_SOUNDS_LONDON_UNDERGROUND_ROOT_MARKER],
    fileNameIncludes: ["train engine"],
    note:
      "Uses Signature Sounds transit-engine ambience as a CC0 replacement for the original idling-truck bed.",
  }),
  birds: signatureSiteRule({
    label: "Signature Sounds Montenegro birds ambience",
    pathContains: [SIGNATURE_SOUNDS_KOTOR_ROOT_MARKER],
    fileNameIncludes: ["birds singing"],
  }),
  explosion: signatureSiteRule({
    label: "Signature Sounds distant fireworks replacement",
    pathContains: [SIGNATURE_SOUNDS_FIREWORKS_ROOT_MARKER],
    fileNameIncludes: ["far away fireworks"],
    note:
      "Uses distant fireworks as a gentler CC0 replacement for the explosion source in Lullaby.",
  }),
  "acoustic-guitar": signatureSiteRule({
    label: "Signature Sounds Spiritual Acoustics guitar replacement",
    pathContains: [SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER],
    fileNameIncludes: ["spiritual acoustics loop"],
  }),
  "alex-hum-1": signatureChoirTeaserRule({
    label: "Signature Sounds choir ambience replacement for Alex hum 1",
    pathContains: [SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER],
    fileNameIncludes: ["choirs_children_ambience"],
  }),
  "alex-hum-2": signatureSerbianChoirRule({
    label: "Signature Sounds Serbian choir ambience replacement for Alex hum 2",
    pathContains: [SIGNATURE_SOUNDS_SERBIAN_CHOIR_ROOT_MARKER],
    fileNameIncludes: ["choir_serbianorthodox_ambience"],
  }),
  "guitar-namaste": signatureSiteRule({
    label: "Signature Sounds Spiritual Acoustics namaste-guitar replacement",
    pathContains: [SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER],
    fileNameIncludes: ["spiritual acoustics loop"],
  }),
  otherness: signatureSiteRule({
    label: "Signature Sounds Burial pads replacement",
    pathContains: [SIGNATURE_SOUNDS_BURIAL_PADS_ROOT_MARKER],
    fileNameIncludes: ["burial_pad_long"],
  }),
  "native-american-flute-susvib": vscoRule({
    label: "VSCO flute sustain vibrato replacement for native flute",
    pathContains: ["woodwinds/flute/susvib/"],
    note:
      "Intentionally substitutes CC0 VSCO sustained flute for the original native-american-flute-susvib role while keeping the package-facing source name.",
  }),
  "guitar-coil-spank": signatureSiteRule({
    label: "Signature Sounds ambient guitar-loop replacement",
    pathContains: [`${SIGNATURE_SOUNDS_LOOPS_AMBIENCE_ROOT_MARKER}/guitars/`],
    fileNameIncludes: ["guitars loop"],
  }),
  "guitar-dusty": signatureSiteRule({
    label: "Signature Sounds ambient guitar-loop replacement",
    pathContains: [`${SIGNATURE_SOUNDS_LOOPS_AMBIENCE_ROOT_MARKER}/guitars/`],
    fileNameIncludes: ["guitars loop"],
  }),
  "snare-brush-stir": signatureSiteRule({
    label: "Signature Sounds beach-rock brush-stir replacement",
    pathContains: [SIGNATURE_SOUNDS_BEACH_ROCKS_ROOT_MARKER],
    fileNameIncludes: ["beach_rocks_percussion"],
  }),
  "snare-brush-hit-p": signatureSiteRule({
    label: "Signature Sounds beach-rock brush-hit replacement",
    pathContains: [SIGNATURE_SOUNDS_BEACH_ROCKS_ROOT_MARKER],
    fileNameIncludes: ["beach_rocks_percussion"],
  }),
  "ride-brush-p": signatureSiteRule({
    label: "Signature Sounds cymbal crash ride-brush replacement",
    pathContains: [SIGNATURE_SOUNDS_CYMBAL_CRASHES_ROOT_MARKER],
    fileNameIncludes: ["cymbal crash"],
  }),
  "acoustic-guitar-chords-cmaj": signatureSiteRule({
    label: "Signature Sounds Spanish guitar chord replacement",
    pathContains: [SIGNATURE_SOUNDS_SPANISH_GUITAR_ROOT_MARKER],
    fileNameIncludes: ["spanish guitars"],
  }),
  "guitar-harmonics": signatureSiteRule({
    label: "Signature Sounds Spiritual Acoustics harmonic-guitar replacement",
    pathContains: [SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER],
    fileNameIncludes: ["spiritual acoustics loop"],
  }),
  "zed__pad": signatureSiteRule({
    label: "Signature Sounds Burial pads replacement for Zed pad",
    pathContains: [SIGNATURE_SOUNDS_BURIAL_PADS_ROOT_MARKER],
    fileNameIncludes: ["burial_pad_long"],
  }),
  "zed__noise": signatureSiteRule({
    label: "Signature Sounds white-noise replacement for Zed noise",
    pathContains: [SIGNATURE_SOUNDS_WHITE_NOISE_ROOT_MARKER],
    fileNameIncludes: ["white noise"],
  }),
})

/**
 * Creates a catalog-wide sample coverage report without copying raw audio. The
 * output intentionally separates locally licensed source candidates from hosted,
 * package-compatible rendered sample groups because only the latter should make
 * a Generative.fm station playable.
 *
 * @param {{
 *   rootPath?: string,
 *   files?: Array<string | { relativePath?: string, path?: string, sizeBytes?: number }>,
 *   licenseTextByPath?: Record<string, string>,
 *   includeHostedSampleGroups?: boolean,
 * }} params
 */
export function createGenerativeFmSampleCoverage(params = {}) {
  const entries = Array.isArray(params.files)
    ? params.files.map(normalizeEntry).filter((entry) => entry.normalizedPath && !isIgnoredSampleInventoryPath(entry.normalizedPath))
    : []
  const licenseTextByPath = normalizeLicenseTextByPath(params.licenseTextByPath)
  const libraries = summarizeLibraries(entries, licenseTextByPath)
  const librariesById = new Map(libraries.map((library) => [library.id, library]))
  const hostedSampleGroupSet = params.includeHostedSampleGroups === false
    ? new Set()
    : new Set(listHostedGenerativeFmSampleGroups())
  const sampleGroupsByName = new Map()
  const pieces = GENERATIVE_FM_PIECES.map((piece) => summarizePieceCoverage({
    piece,
    entries,
    librariesById,
    hostedSampleGroupSet,
    sampleGroupsByName,
  }))
  const groups = [...sampleGroupsByName.values()].sort((left, right) => left.displayName.localeCompare(right.displayName))

  return {
    rootPath: params.rootPath ?? null,
    inventory: summarizeInventory(entries),
    libraries,
    pieces,
    groups,
    summary: summarizePieceStatuses(pieces, groups),
  }
}

/**
 * @param {ReturnType<typeof createGenerativeFmSampleCoverage>} coverage
 */
export function formatGenerativeFmSampleCoverageReport(coverage) {
  const localReadyPieces = coverage.pieces.filter((piece) => piece.status === "local-source-candidate")
  const blockedPieces = coverage.pieces.filter((piece) => piece.status === "replacement-needed")
  const hostedPieces = coverage.pieces.filter((piece) => piece.status === "hosted")
  const localGroups = coverage.groups.filter((group) => group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE)
  const blockedGroups = coverage.groups.filter((group) => (
    group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.EXCLUDED_LICENSE ||
    group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.REPLACEMENT_NEEDED ||
    group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.SOURCE_FILES_MISSING ||
    group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LICENSE_EVIDENCE_MISSING
  ))

  const lines = [
    "# Generative.fm Sample Coverage Report",
    "",
    `Audio root: ${coverage.rootPath ?? "(not provided)"}`,
    `Files scanned: ${coverage.inventory.totalFiles}`,
    `Audio files: ${coverage.inventory.audioFiles}`,
    "",
    "## License Evidence",
    "",
  ]

  for (const library of coverage.libraries) {
    lines.push(
      `- ${library.title}: ${library.detected ? "present" : "missing"}; ${library.licenseStatus}; evidence: ${library.licenseEvidencePath ?? "not found"}`,
    )
  }

  lines.push(
    "",
    "## Catalog Summary",
    "",
    `- Pieces in catalog: ${coverage.summary.totalPieces}`,
    `- Hosted/playable Generative.fm pieces now: ${coverage.summary.hostedPieces}`,
    `- Pieces with only local CC0 source candidates still needing rendered upload: ${coverage.summary.localSourceCandidatePieces}`,
    `- Pieces needing replacement/source/licensing work: ${coverage.summary.replacementNeededPieces}`,
    `- Unique sample groups: ${coverage.summary.uniqueSampleGroups}`,
    `- Local CC0 source candidate groups: ${coverage.summary.localCandidateGroups}`,
    `- Blocked or replacement-needed groups: ${coverage.summary.blockedGroups}`,
    "",
    "## Hosted Now",
    "",
  )

  appendPieceList(lines, hostedPieces)
  lines.push("", "## Ready For Render/Upload Planning", "")
  appendPieceList(lines, localReadyPieces)
  lines.push("", "## Needs Replacement Or Separate Source Review", "")
  appendPieceList(lines, blockedPieces)

  lines.push("", "## Local CC0 Source Candidate Groups", "")
  appendGroupList(lines, localGroups)
  lines.push("", "## Blocked Or Replacement-Needed Groups", "")
  appendGroupList(lines, blockedGroups)

  return `${lines.join("\n")}\n`
}

/**
 * @returns {string[]}
 */
export function listKnownLocalCc0GenerativeFmSampleGroups() {
  return Object.keys(LOCAL_CC0_SAMPLE_SOURCE_RULES).sort()
}

/**
 * @param {{ label: string, pathContains: string[], fileNameIncludes?: string[], extraRequiredPathSuffixes?: string[], note?: string }} params
 */
function vscoRule(params) {
  return sampleSourceRule({ ...params, libraryId: "vsco-2-ce" })
}

/**
 * @param {{ label: string, pathContains: string[], fileNameIncludes?: string[], extraRequiredPathSuffixes?: string[], note?: string }} params
 */
function vcslRule(params) {
  return sampleSourceRule({ ...params, libraryId: "vcsl" })
}

/**
 * @param {{ label: string, pathContains: string[], fileNameIncludes?: string[], extraRequiredPathSuffixes?: string[], note?: string }} params
 */
function signatureBeachRule(params) {
  return sampleSourceRule({ ...params, libraryId: "signature-sounds-beach" })
}

/**
 * @param {{ label: string, pathContains: string[], fileNameIncludes?: string[], extraRequiredPathSuffixes?: string[], note?: string }} params
 */
function signatureChoirTeaserRule(params) {
  return sampleSourceRule({ ...params, libraryId: "signature-sounds-choir-teaser" })
}

/**
 * @param {{ label: string, pathContains: string[], fileNameIncludes?: string[], extraRequiredPathSuffixes?: string[], note?: string }} params
 */
function signatureSerbianChoirRule(params) {
  return sampleSourceRule({ ...params, libraryId: "signature-sounds-serbian-choir" })
}

/**
 * @param {{ label: string, pathContains: string[], fileNameIncludes?: string[], extraRequiredPathSuffixes?: string[], note?: string }} params
 */
function signatureSiteRule(params) {
  return sampleSourceRule({ ...params, libraryId: "signature-sounds-site-cc0" })
}

/**
 * @param {{ libraryId: "vsco-2-ce" | "vcsl" | "signature-sounds-beach" | "signature-sounds-choir-teaser" | "signature-sounds-serbian-choir" | "signature-sounds-site-cc0", label: string, pathContains: string[], fileNameIncludes?: string[], extraRequiredPathSuffixes?: string[], note?: string }} params
 */
function sampleSourceRule({ libraryId, label, pathContains, fileNameIncludes = [], extraRequiredPathSuffixes = [], note }) {
  return Object.freeze({
    libraryId,
    label,
    pathContains: pathContains.map((part) => part.toLowerCase()),
    fileNameIncludes: fileNameIncludes.map((part) => part.toLowerCase()),
    extraRequiredPathSuffixes: extraRequiredPathSuffixes.map((part) => part.toLowerCase()),
    note: note ?? "Local source files are present, but package-compatible rendered sample coverage is not yet hosted.",
  })
}

/**
 * @param {{
 *   piece: typeof GENERATIVE_FM_PIECES[number],
 *   entries: ReturnType<typeof normalizeEntry>[],
 *   librariesById: Map<string, ReturnType<typeof summarizeLibraries>[number]>,
 *   hostedSampleGroupSet: Set<string>,
 *   sampleGroupsByName: Map<string, ReturnType<typeof summarizeGroupCoverage>>,
 * }} params
 */
function summarizePieceCoverage({
  piece,
  entries,
  librariesById,
  hostedSampleGroupSet,
  sampleGroupsByName,
}) {
  const groups = normalizeSampleGroups(piece.sampleNameGroups).map((names) => {
    const group = summarizeGroupCoverage({ names, entries, librariesById, hostedSampleGroupSet })
    const key = group.displayName
    const existing = sampleGroupsByName.get(key)
    if (existing) {
      existing.pieceIds.push(piece.id)
      existing.pieceTitles.push(piece.title)
    } else {
      sampleGroupsByName.set(key, { ...group, pieceIds: [piece.id], pieceTitles: [piece.title] })
    }
    return group
  })
  // Piece-level hosted registry is authoritative for playback rollout status.
  // Group-level coverage can still stay local-only for source/license planning.
  const status = isHostedGenerativeFmPiece(piece.id) ? "hosted" : statusForPiece(groups)
  return {
    id: piece.id,
    title: piece.title,
    status,
    sampleGroups: groups,
    blockedSampleGroups: groups.filter((group) => group.status !== GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED &&
      group.status !== GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE),
  }
}

/**
 * @param {ReturnType<typeof summarizeGroupCoverage>[]} groups
 */
function statusForPiece(groups) {
  if (groups.every((group) => group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED)) {
    return "hosted"
  }

  if (groups.every((group) => (
    group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED ||
    group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE
  ))) {
    return "local-source-candidate"
  }

  return "replacement-needed"
}

/**
 * @param {{
 *   names: string[],
 *   entries: ReturnType<typeof normalizeEntry>[],
 *   librariesById: Map<string, ReturnType<typeof summarizeLibraries>[number]>,
 *   hostedSampleGroupSet: Set<string>,
 * }} params
 */
function summarizeGroupCoverage({ names, entries, librariesById, hostedSampleGroupSet }) {
  const hostedName = names.find((name) => hostedSampleGroupSet.has(name))
  if (hostedName) {
    return {
      displayName: names.join(" or "),
      names,
      status: GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED,
      sourceName: hostedName,
      library: "massagelab-public-media",
      license: "Verified hosted adaptation",
      sampleFileCount: 0,
      evidencePaths: [],
      note: "Already present in the current hosted public-media sample index.",
    }
  }

  const evaluations = names.map((name) => evaluateSampleName({
    name,
    entries,
    librariesById,
  })).filter(Boolean)
  const localCandidate = evaluations.find((evaluation) => (
    evaluation.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE
  ))
  if (localCandidate) {
    return {
      displayName: names.join(" or "),
      names,
      ...localCandidate,
    }
  }

  const missingKnownSource = evaluations.find((evaluation) => (
    evaluation.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LICENSE_EVIDENCE_MISSING ||
    evaluation.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.SOURCE_FILES_MISSING
  ))
  if (missingKnownSource) {
    return {
      displayName: names.join(" or "),
      names,
      ...missingKnownSource,
    }
  }

  const excluded = evaluations.find((evaluation) => (
    evaluation.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.EXCLUDED_LICENSE
  ))
  if (excluded) {
    return {
      displayName: names.join(" or "),
      names,
      ...excluded,
    }
  }

  return {
    displayName: names.join(" or "),
    names,
    status: GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.REPLACEMENT_NEEDED,
    sourceName: preferredReplacementSourceName(names),
    library: null,
    license: null,
    sampleFileCount: 0,
    evidencePaths: [],
    note: "No package-compatible source group from the supplied local audio root is known yet; find or create a replacement with clear hosting rights.",
  }
}

/**
 * @param {{
 *   name: string,
 *   entries: ReturnType<typeof normalizeEntry>[],
 *   librariesById: Map<string, ReturnType<typeof summarizeLibraries>[number]>,
 * }} params
 */
function evaluateSampleName({ name, entries, librariesById }) {
  const sourceName = normalizeSourceSampleName(name)
  if (!sourceName) return null

  const rule = LOCAL_CC0_SAMPLE_SOURCE_RULES[sourceName]

  if (sourceName.startsWith("sso-") && !rule) {
    return {
      status: GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.EXCLUDED_LICENSE,
      sourceName,
      library: "Sonatina Symphonic Orchestra",
      license: "Creative Commons Sampling Plus 1.0",
      sampleFileCount: 0,
      evidencePaths: [],
      note:
        "SSO raw samples remain excluded because Sampling Plus is not a clean fit for public browser-hosted MassageLab audio, especially before subscription gating decisions settle.",
    }
  }

  if (!rule) return null

  const library = librariesById.get(rule.libraryId)
  const sampleMatches = findRuleSampleMatches(entries, rule)
  const missingRequiredPaths = rule.extraRequiredPathSuffixes.filter((suffix) => (
    !entries.some((entry) => entry.normalizedPath === suffix || entry.normalizedPath.endsWith(`/${suffix}`))
  ))

  if (!library?.detected || sampleMatches.length === 0 || missingRequiredPaths.length > 0) {
    return {
      status: GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.SOURCE_FILES_MISSING,
      sourceName,
      library: LIBRARIES[rule.libraryId].title,
      license: LIBRARIES[rule.libraryId].license,
      sampleFileCount: sampleMatches.length,
      evidencePaths: firstEvidencePaths(sampleMatches),
      note: missingRequiredPaths.length > 0
        ? `Known source requires these missing support files: ${missingRequiredPaths.join(", ")}.`
        : "Known source rule exists, but the supplied local audio root did not contain matching source WAV files.",
    }
  }

  if (library.licenseStatus !== "license-confirmed") {
    return {
      status: GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LICENSE_EVIDENCE_MISSING,
      sourceName,
      library: library.title,
      license: library.license,
      sampleFileCount: sampleMatches.length,
      evidencePaths: firstEvidencePaths(sampleMatches),
      note: `Local source files matched, but ${library.title} license evidence was not confirmed from the scan.`,
    }
  }

  return {
    status: GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE,
    sourceName,
    library: library.title,
    license: library.license,
    sampleFileCount: sampleMatches.length,
    evidencePaths: firstEvidencePaths(sampleMatches),
    note: rule.note,
  }
}

/**
 * @param {ReturnType<typeof normalizeEntry>[]} entries
 * @param {ReturnType<typeof sampleSourceRule>} rule
 */
function findRuleSampleMatches(entries, rule) {
  return entries.filter((entry) => {
    if (!entry.normalizedPath.endsWith(".wav")) return false
    if (!rule.pathContains.every((part) => entry.normalizedPath.includes(part))) return false
    const fileName = basename(entry.normalizedPath)
    return rule.fileNameIncludes.every((part) => fileName.includes(part))
  })
}

/**
 * @param {Array<string | string[]>} sampleNameGroups
 * @returns {string[][]}
 */
function normalizeSampleGroups(sampleNameGroups) {
  return sampleNameGroups.map((group) => {
    const names = Array.isArray(group) ? group : [group]
    return names.map((name) => name.trim()).filter(Boolean)
  }).filter((group) => group.length > 0)
}

/**
 * @param {string} name
 */
function normalizeSourceSampleName(name) {
  const cleaned = name.trim()
  if (!cleaned) return null
  if (LOCAL_CC0_SAMPLE_SOURCE_RULES[cleaned] || cleaned.startsWith("sso-")) return cleaned

  const doubleUnderscoreIndex = cleaned.indexOf("__")
  if (doubleUnderscoreIndex === -1) return cleaned

  const suffix = cleaned.slice(doubleUnderscoreIndex + 2)
  return suffix || cleaned
}

/**
 * @param {string[]} names
 */
function preferredReplacementSourceName(names) {
  if (names.length > 1) {
    return normalizeSourceSampleName(names[names.length - 1]) ?? names[names.length - 1]
  }

  return names[0] ?? "(empty)"
}

/**
 * @param {ReturnType<typeof normalizeEntry>[]} entries
 * @param {Record<string, string>} licenseTextByPath
 */
function summarizeLibraries(entries, licenseTextByPath) {
  return Object.values(LIBRARIES).map((library) => {
    const detected = entries.some((entry) => entry.normalizedPath.includes(library.rootMarker))
    const licenseEvidencePath = library.licenseEvidencePathSuffix
      ? entries.find((entry) => (
        entry.normalizedPath === library.licenseEvidencePathSuffix ||
        entry.normalizedPath.endsWith(`/${library.licenseEvidencePathSuffix}`)
      ))?.displayPath ?? null
      : null
    const licenseText = licenseEvidencePath ? licenseTextByPath[normalizePortablePath(licenseEvidencePath).toLowerCase()] : undefined
    const textMatches = Boolean(
      licenseText &&
      library.licenseTextNeedles.every((needle) => licenseText.toLowerCase().includes(needle)),
    )
    const siteEvidenceConfirmed = Boolean(detected && library.siteEvidenceUrl)
    const licenseStatus = siteEvidenceConfirmed
      ? "license-confirmed"
      : textMatches
      ? "license-confirmed"
      : licenseEvidencePath
        ? "license-file-present"
        : "license-file-missing"

    return {
      id: library.id,
      title: library.title,
      detected,
      license: library.license,
      licenseEvidencePath: licenseEvidencePath ?? (siteEvidenceConfirmed ? library.siteEvidenceUrl : null),
      licenseStatus,
    }
  })
}

/**
 * @param {Array<{ displayPath: string, normalizedPath: string, sizeBytes: number | null }>} entries
 */
function summarizeInventory(entries) {
  const extensionCounts = {}
  let audioFiles = 0

  for (const entry of entries) {
    const extension = getExtension(entry.normalizedPath)
    extensionCounts[extension] = (extensionCounts[extension] ?? 0) + 1

    if ([".mp3", ".ogg", ".wav"].includes(extension)) {
      audioFiles += 1
    }
  }

  return {
    totalFiles: entries.length,
    audioFiles,
    extensionCounts,
  }
}

/**
 * @param {ReturnType<typeof summarizePieceCoverage>[]} pieces
 * @param {Array<ReturnType<typeof summarizeGroupCoverage> & { pieceIds?: string[] }>} groups
 */
function summarizePieceStatuses(pieces, groups) {
  return {
    totalPieces: pieces.length,
    hostedPieces: pieces.filter((piece) => piece.status === "hosted").length,
    localSourceCandidatePieces: pieces.filter((piece) => piece.status === "local-source-candidate").length,
    replacementNeededPieces: pieces.filter((piece) => piece.status === "replacement-needed").length,
    uniqueSampleGroups: groups.length,
    localCandidateGroups: groups.filter((group) => group.status === GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE).length,
    blockedGroups: groups.filter((group) => group.status !== GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.HOSTED &&
      group.status !== GENERATIVE_FM_SAMPLE_COVERAGE_STATUS.LOCAL_CC0_CANDIDATE).length,
  }
}

/**
 * @param {string | { relativePath?: string, path?: string, sizeBytes?: number }} file
 */
function normalizeEntry(file) {
  const displayPath = typeof file === "string" ? file : file.relativePath ?? file.path ?? ""
  const normalizedPath = normalizePortablePath(displayPath)

  return {
    displayPath: normalizedPath,
    normalizedPath: normalizedPath.toLowerCase(),
    sizeBytes: typeof file === "string" ? null : file.sizeBytes ?? null,
  }
}

/**
 * Excludes macOS archive sidecars from source coverage so downloaded pack
 * metadata cannot be mistaken for package-ready audio samples.
 *
 * @param {string} normalizedPath
 */
function isIgnoredSampleInventoryPath(normalizedPath) {
  return normalizedPath.includes("/__macosx/") || basename(normalizedPath).startsWith("._")
}

/**
 * @param {Record<string, string> | undefined} licenseTextByPath
 */
function normalizeLicenseTextByPath(licenseTextByPath) {
  return Object.entries(licenseTextByPath ?? {}).reduce((normalized, [filePath, text]) => {
    normalized[normalizePortablePath(filePath).toLowerCase()] = text
    return normalized
  }, {})
}

/**
 * @param {Array<{ displayPath: string }>} matches
 */
function firstEvidencePaths(matches) {
  return matches.slice(0, 5).map((match) => match.displayPath)
}

/**
 * @param {string[]} lines
 * @param {Array<{ id: string, title: string }>} pieces
 */
function appendPieceList(lines, pieces) {
  if (pieces.length === 0) {
    lines.push("- None")
    return
  }

  for (const piece of pieces) {
    lines.push(`- ${piece.title} (${piece.id})`)
  }
}

/**
 * @param {string[]} lines
 * @param {Array<{ displayName: string, status: string, sourceName: string, library: string | null, sampleFileCount: number, evidencePaths: string[], note: string, pieceTitles?: string[] }>} groups
 */
function appendGroupList(lines, groups) {
  if (groups.length === 0) {
    lines.push("- None")
    return
  }

  for (const group of groups) {
    lines.push(`- ${group.displayName}: ${group.status}`)
    lines.push(`  - Source: ${group.sourceName}`)
    lines.push(`  - Library: ${group.library ?? "none"}`)
    lines.push(`  - Matched files: ${group.sampleFileCount}`)
    if (group.evidencePaths.length > 0) {
      lines.push(`  - Evidence: ${group.evidencePaths.join("; ")}`)
    }
    if (group.pieceTitles?.length) {
      lines.push(`  - Used by: ${group.pieceTitles.slice(0, 8).join(", ")}${group.pieceTitles.length > 8 ? ", ..." : ""}`)
    }
    lines.push(`  - Note: ${group.note}`)
  }
}

/**
 * @param {string} filePath
 */
function normalizePortablePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/\/+/g, "/")
}

/**
 * @param {string} filePath
 */
function basename(filePath) {
  const slashIndex = filePath.lastIndexOf("/")
  return slashIndex === -1 ? filePath : filePath.slice(slashIndex + 1)
}

/**
 * @param {string} filePath
 */
function getExtension(filePath) {
  const fileName = basename(filePath)
  const dotIndex = fileName.lastIndexOf(".")
  return dotIndex === -1 ? "(none)" : fileName.slice(dotIndex)
}
