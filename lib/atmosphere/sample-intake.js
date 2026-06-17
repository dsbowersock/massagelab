// @ts-check

const VSCO_ROOT_MARKER = "vsco-2-ce-1.1.0/vsco-2-ce-1.1.0"
const VCSL_ROOT_MARKER = "vcsl-1.2.2-rc/vcsl-1.2.2-rc"
const OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH =
  "/audio/atmosphere/observable-streams-vsco-adaptation/samples"
const OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH =
  "/audio/atmosphere/observable-streams-vsco-adaptation/sample-index.json"

const CURATED_SOURCE_NOTES = Object.freeze({
  "vsco2-piano-mf": Object.freeze([
    "C#2",
    "F2",
    "A2",
    "C#3",
    "F3",
    "A3",
    "C#4",
    "F4",
    "A4",
    "C#5",
    "F5",
    "A5",
  ]),
  "vsco2-violin-arcvib": Object.freeze(["C4", "E4", "G4", "C5", "E5", "G5"]),
  "sso-cor-anglais": Object.freeze(["A#3", "D4", "F4", "A#4", "D5", "F5"]),
})

export const OBSERVABLE_STREAMS_SAMPLE_REQUIREMENTS = Object.freeze([
  {
    sourceName: "vsco2-piano-mf",
    renderedName: "observable-streams__vsco2-piano-mf",
    expectedLibrary: "VSCO 2 Community Edition",
    expectedPathHint: "Keys/Upright Piano",
    notes:
      "Candidate VSCO piano files are present when the upright piano WAVs and MappingChart.txt are available. The first staged adaptation uses dynamic layer 2 as the medium piano source.",
  },
  {
    sourceName: "vsco2-violin-arcvib",
    renderedName: "observable-streams__vsco2-violin-arcvib",
    expectedLibrary: "VSCO 2 Community Edition",
    expectedPathHint: "Strings/Solo Violin/Arco Vib",
    notes:
      "Candidate VSCO solo violin arco vibrato files are present when LLVln_ArcoVib note WAVs are available.",
  },
  {
    sourceName: "vsco2-oboe-sus",
    renderedName: "observable-streams__vsco2-oboe-sus",
    replacesSourceName: "sso-cor-anglais",
    replacesRenderedName: "observable-streams__sso-cor-anglais",
    expectedLibrary: "VSCO 2 Community Edition",
    expectedPathHint: "Woodwinds/Oboe/Sus",
    notes:
      "MassageLab intentionally substitutes a CC0 VSCO sustained oboe source for the package's SSO cor anglais line. This keeps the first hosted adaptation clear of SSO Sampling Plus redistribution risk.",
  },
])

export const OBSERVABLE_STREAMS_EXCLUDED_SAMPLE_SOURCES = Object.freeze([
  {
    sourceName: "sso-cor-anglais",
    renderedName: "observable-streams__sso-cor-anglais",
    expectedLibrary: "Sonatina Symphonic Orchestra",
    decision: "excluded",
    notes:
      "SSO's Creative Commons Sampling Plus 1.0 license is not a clean fit for hosting raw browser samples in a public MassageLab product feature.",
  },
])

export const OBSERVABLE_STREAMS_VSCO_ADAPTATION = Object.freeze({
  id: "observable-streams-vsco-adaptation",
  sampleIndexPath: OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
  sampleBasePath: OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH,
  sourceNotes: CURATED_SOURCE_NOTES,
})

const NOTE_NAMES = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])

/**
 * Builds a bounded, repeatable report for the first Generative.fm sample target
 * without copying or committing raw audio files.
 *
 * @param {{ rootPath?: string, files?: Array<string | { relativePath?: string, path?: string, sizeBytes?: number }>, vscoPianoMappingChartText?: string }} params
 */
export function createObservableStreamsSampleIntake(params = {}) {
  const files = Array.isArray(params.files) ? params.files : []
  const entries = files.map(normalizeEntry).filter((entry) => entry.normalizedPath)
  const pianoMatches = entries.map(matchVscoPianoFile).filter(Boolean)
  const violinMatches = entries.map(matchVscoViolinArcoVibFile).filter(Boolean)
  const oboeSustainMatches = entries.map(matchVscoOboeSustainFile).filter(Boolean)
  const mappingChartEntry = entries.find((entry) => isVscoPianoMappingChart(entry.normalizedPath))
  const libraries = summarizeLibraries(entries)
  const inventory = summarizeInventory(entries)
  const pianoMapping = params.vscoPianoMappingChartText
    ? summarizeVscoPianoMapping(parseVscoPianoMappingChart(params.vscoPianoMappingChartText))
    : null

  return {
    rootPath: params.rootPath ?? null,
    inventory,
    libraries,
    requirements: OBSERVABLE_STREAMS_SAMPLE_REQUIREMENTS.map((requirement) => {
      if (requirement.sourceName === "vsco2-piano-mf") {
        return {
          ...requirement,
          status: pianoMatches.length > 0 ? "candidate-present" : "missing",
          sampleFileCount: pianoMatches.length,
          evidencePaths: firstEvidencePaths(pianoMatches),
          mappingChartPath: mappingChartEntry?.displayPath ?? null,
          dynamicLayers: uniqueSorted(pianoMatches.map((match) => match.dynamicLayer)),
          roundRobins: uniqueSorted(pianoMatches.map((match) => match.roundRobin)),
          pianoMapping,
        }
      }

      if (requirement.sourceName === "vsco2-violin-arcvib") {
        return {
          ...requirement,
          status: violinMatches.length > 0 ? "candidate-present" : "missing",
          sampleFileCount: violinMatches.length,
          evidencePaths: firstEvidencePaths(violinMatches),
          dynamicLayers: uniqueSorted(violinMatches.map((match) => match.dynamicLayer)),
        }
      }

      if (requirement.sourceName === "vsco2-oboe-sus") {
        return {
          ...requirement,
          status: oboeSustainMatches.length > 0 ? "replacement-present" : "missing",
          sampleFileCount: oboeSustainMatches.length,
          evidencePaths: firstEvidencePaths(oboeSustainMatches),
          dynamicLayers: uniqueSorted(oboeSustainMatches.map((match) => match.dynamicLayer)),
        }
      }

      return {
        ...requirement,
        status: "missing",
        sampleFileCount: 0,
        evidencePaths: [],
      }
    }),
    excludedSources: OBSERVABLE_STREAMS_EXCLUDED_SAMPLE_SOURCES.map((source) => ({ ...source })),
  }
}

/**
 * Builds a deterministic copy plan plus a Generative.fm-compatible sample index
 * for the first CC0 Observable Streams adaptation.
 *
 * @param {{ rootPath: string, files?: Array<string | { relativePath?: string, path?: string, sizeBytes?: number }>, vscoPianoMappingChartText?: string, publicSampleBasePath?: string }} params
 */
export function createObservableStreamsVscoAssetPlan(params) {
  const files = Array.isArray(params.files) ? params.files : []
  const entries = files.map(normalizeEntry).filter((entry) => entry.normalizedPath)
  const mappingBySampleNumber = new Map(
    parseVscoPianoMappingChart(params.vscoPianoMappingChartText ?? "")
      .map((row) => [row.sampleNumber, row.noteName]),
  )
  const publicSampleBasePath = params.publicSampleBasePath ?? OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH

  const pianoAssets = selectAssetsByNote({
    matches: entries.map(matchVscoPianoFile).filter(Boolean).map((match) => ({
      ...match,
      noteName: mappingBySampleNumber.get(match.sampleNumber) ?? null,
    })),
    instrumentName: "vsco2-piano-mf",
    noteNames: CURATED_SOURCE_NOTES["vsco2-piano-mf"],
    dynamicLayer: "2",
    filePrefix: "piano",
    publicSampleBasePath,
  })
  const violinAssets = selectAssetsByNote({
    matches: entries.map(matchVscoViolinArcoVibFile).filter(Boolean),
    instrumentName: "vsco2-violin-arcvib",
    noteNames: CURATED_SOURCE_NOTES["vsco2-violin-arcvib"],
    dynamicLayer: "p",
    filePrefix: "violin-arcvib",
    publicSampleBasePath,
  })
  const oboeAssets = selectAssetsByNote({
    matches: entries.map(matchVscoOboeSustainFile).filter(Boolean),
    instrumentName: "sso-cor-anglais",
    noteNames: CURATED_SOURCE_NOTES["sso-cor-anglais"],
    dynamicLayer: "1",
    filePrefix: "oboe-sus",
    publicSampleBasePath,
  })
  const assets = [...pianoAssets.selectedAssets, ...violinAssets.selectedAssets, ...oboeAssets.selectedAssets]
  const missing = [...pianoAssets.missingNotes, ...violinAssets.missingNotes, ...oboeAssets.missingNotes]

  return {
    adaptationId: OBSERVABLE_STREAMS_VSCO_ADAPTATION.id,
    rootPath: params.rootPath,
    publicSampleBasePath,
    publicSampleIndexPath: OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
    selectedAssets: assets,
    missingNotes: missing,
    sampleIndex: buildSampleIndex(assets),
    excludedSources: OBSERVABLE_STREAMS_EXCLUDED_SAMPLE_SOURCES.map((source) => ({ ...source })),
  }
}

/**
 * @param {ReturnType<typeof createObservableStreamsSampleIntake>} summary
 * @returns {string}
 */
export function formatObservableStreamsSampleIntakeReport(summary) {
  const lines = [
    "# Atmosphere Sample Intake Report",
    "",
    `Audio root: ${summary.rootPath ?? "(not provided)"}`,
    `Files scanned: ${summary.inventory.totalFiles}`,
    `Audio files: ${summary.inventory.audioFiles}`,
    "",
    "## Library Evidence",
    "",
  ]

  for (const library of summary.libraries) {
    lines.push(
      `- ${library.title}: ${library.detected ? "present" : "missing"}; license evidence: ${library.licenseEvidencePath ?? "not found"}`,
    )
  }

  lines.push("", "## Observable Streams Requirements", "")

  for (const requirement of summary.requirements) {
    lines.push(`- ${requirement.sourceName}: ${requirement.status}`)
    lines.push(`  - Expected library: ${requirement.expectedLibrary}`)
    if (requirement.replacesSourceName) {
      lines.push(`  - Replaces package source: ${requirement.replacesSourceName}`)
    }
    lines.push(`  - Sample files matched: ${requirement.sampleFileCount}`)

    if (requirement.mappingChartPath) {
      lines.push(`  - Mapping chart: ${requirement.mappingChartPath}`)
    }

    if (requirement.pianoMapping) {
      lines.push(
        `  - Piano mapping range: ${requirement.pianoMapping.firstNote} to ${requirement.pianoMapping.lastNote} (${requirement.pianoMapping.sampleCount} mapped samples)`,
      )
    }

    if (requirement.dynamicLayers?.length) {
      lines.push(`  - Dynamic layers: ${requirement.dynamicLayers.join(", ")}`)
    }

    if (requirement.roundRobins?.length) {
      lines.push(`  - Round robins: ${requirement.roundRobins.join(", ")}`)
    }

    if (requirement.evidencePaths.length > 0) {
      lines.push(`  - Evidence: ${requirement.evidencePaths.join("; ")}`)
    }

    lines.push(`  - Note: ${requirement.notes}`)
  }

  if (summary.excludedSources.length > 0) {
    lines.push("", "## Excluded Package Sources", "")

    for (const source of summary.excludedSources) {
      lines.push(`- ${source.sourceName}: ${source.decision}`)
      lines.push(`  - Expected library: ${source.expectedLibrary}`)
      lines.push(`  - Note: ${source.notes}`)
    }
  }

  return `${lines.join("\n")}\n`
}

/**
 * @param {string} rawText
 */
export function parseVscoPianoMappingChart(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("Notation="))
    .map((line) => {
      const [sampleNumber, midiNumber] = line.split("=")

      if (!/^\d{3}$/.test(sampleNumber ?? "") || !/^\d+$/.test(midiNumber ?? "")) {
        return null
      }

      const midi = Number.parseInt(midiNumber, 10)
      return {
        sampleNumber,
        midi,
        noteName: midiToScientificPitch(midi),
      }
    })
    .filter(Boolean)
}

/**
 * @param {number} midi
 */
export function midiToScientificPitch(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new Error(`Invalid MIDI note number: ${midi}`)
  }

  const pitchClass = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[pitchClass]}${octave}`
}

/**
 * @param {Array<{ sampleNumber: string, midi: number, noteName: string }>} mapping
 */
function summarizeVscoPianoMapping(mapping) {
  if (mapping.length === 0) {
    return null
  }

  return {
    sampleCount: mapping.length,
    firstSampleNumber: mapping[0].sampleNumber,
    firstNote: mapping[0].noteName,
    lastSampleNumber: mapping[mapping.length - 1].sampleNumber,
    lastNote: mapping[mapping.length - 1].noteName,
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
 * @param {string} filePath
 */
function normalizePortablePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/\/+/g, "/")
}

/**
 * @param {{ displayPath: string, normalizedPath: string, sizeBytes: number | null }} entry
 */
function matchVscoPianoFile(entry) {
  if (
    !entry.normalizedPath.includes(`${VSCO_ROOT_MARKER}/keys/upright piano/`) ||
    !entry.normalizedPath.endsWith(".wav")
  ) {
    return null
  }

  const fileName = basename(entry.normalizedPath)
  const match = /^player_dyn(?<dynamicLayer>\d+)_rr(?<roundRobin>\d+)_(?<sampleNumber>\d{3})\.wav$/.exec(fileName)
  if (!match?.groups) {
    return null
  }

  return {
    ...entry,
    dynamicLayer: match.groups.dynamicLayer,
    roundRobin: match.groups.roundRobin,
    sampleNumber: match.groups.sampleNumber,
  }
}

/**
 * @param {{ displayPath: string, normalizedPath: string, sizeBytes: number | null }} entry
 */
function matchVscoViolinArcoVibFile(entry) {
  if (
    !entry.normalizedPath.includes(`${VSCO_ROOT_MARKER}/strings/solo violin/arco vib/`) ||
    !entry.normalizedPath.endsWith(".wav")
  ) {
    return null
  }

  const fileName = basename(entry.normalizedPath)
  const match = /^llvln_arcovib_(?<note>[a-g]#?\d)_(?<dynamicLayer>f|p)\.wav$/.exec(fileName)
  if (!match?.groups) {
    return null
  }

  return {
    ...entry,
    noteName: match.groups.note.toUpperCase(),
    dynamicLayer: match.groups.dynamicLayer,
  }
}

/**
 * @param {{ displayPath: string, normalizedPath: string, sizeBytes: number | null }} entry
 */
function matchVscoOboeSustainFile(entry) {
  if (
    !entry.normalizedPath.includes(`${VSCO_ROOT_MARKER}/woodwinds/oboe/sus/`) ||
    !entry.normalizedPath.endsWith(".wav")
  ) {
    return null
  }

  const fileName = basename(entry.normalizedPath)
  const match = /^oboe_sus_(?<note>[a-g]#?\d)_v(?<dynamicLayer>\d+)_main\.wav$/.exec(fileName)
  if (!match?.groups) {
    return null
  }

  return {
    ...entry,
    noteName: match.groups.note.toUpperCase(),
    dynamicLayer: match.groups.dynamicLayer,
  }
}

/**
 * @param {{ matches: Array<{ displayPath: string, normalizedPath: string, sizeBytes: number | null, noteName?: string | null, dynamicLayer?: string }>, instrumentName: string, noteNames: readonly string[], dynamicLayer: string, filePrefix: string, publicSampleBasePath: string }} params
 */
function selectAssetsByNote({ matches, instrumentName, noteNames, dynamicLayer, filePrefix, publicSampleBasePath }) {
  const selectedAssets = []
  const missingNotes = []

  for (const noteName of noteNames) {
    const match = matches.find((candidate) => candidate.noteName === noteName && candidate.dynamicLayer === dynamicLayer)

    if (!match) {
      missingNotes.push({ instrumentName, noteName, dynamicLayer })
      continue
    }

    const outputFileName = `${filePrefix}-${noteNameToSlug(noteName)}.wav`
    selectedAssets.push({
      instrumentName,
      noteName,
      dynamicLayer,
      sourceRelativePath: match.displayPath,
      outputFileName,
      publicUrl: `${publicSampleBasePath}/${outputFileName}`,
      sizeBytes: match.sizeBytes,
    })
  }

  return { selectedAssets, missingNotes }
}

/**
 * @param {Array<{ instrumentName: string, noteName: string, publicUrl: string }>} assets
 */
function buildSampleIndex(assets) {
  return assets.reduce((sampleIndex, asset) => {
    sampleIndex[asset.instrumentName] = sampleIndex[asset.instrumentName] ?? {}
    sampleIndex[asset.instrumentName][asset.noteName] = asset.publicUrl
    return sampleIndex
  }, {})
}

/**
 * @param {string} noteName
 */
function noteNameToSlug(noteName) {
  return noteName.toLowerCase().replace("#", "-sharp")
}

/**
 * @param {string} normalizedPath
 */
function isVscoPianoMappingChart(normalizedPath) {
  return normalizedPath === `${VSCO_ROOT_MARKER}/keys/upright piano/mappingchart.txt` ||
    normalizedPath.endsWith(`/${VSCO_ROOT_MARKER}/keys/upright piano/mappingchart.txt`)
}

/**
 * @param {Array<{ displayPath: string, normalizedPath: string }>} entries
 */
function summarizeLibraries(entries) {
  return [
    {
      id: "vsco-2-ce",
      title: "VSCO 2 Community Edition",
      detected: entries.some((entry) => entry.normalizedPath.includes(VSCO_ROOT_MARKER)),
      license: "CC0 1.0 Universal",
      licenseEvidencePath: entries.find((entry) => entry.normalizedPath.endsWith(`${VSCO_ROOT_MARKER}/license`))
        ?.displayPath ?? null,
    },
    {
      id: "vcsl",
      title: "Versilian Community Sample Library",
      detected: entries.some((entry) => entry.normalizedPath.includes(VCSL_ROOT_MARKER)),
      license: "CC0",
      licenseEvidencePath: entries.find((entry) => entry.normalizedPath.endsWith(`${VCSL_ROOT_MARKER}/readme.md`))
        ?.displayPath ?? null,
    },
  ]
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
 * @param {Array<{ displayPath: string }>} matches
 */
function firstEvidencePaths(matches) {
  return matches.slice(0, 5).map((match) => match.displayPath)
}

/**
 * @param {Array<string>} values
 */
function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
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
