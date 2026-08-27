const BATCH_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const REGISTRY_FIELDS = new Set(["version", "entries"])
const ENTRY_FIELDS = new Set(["batchId", "declarationRelativePath"])
const CLI_KEYS = new Set(["batch-id", "source-root", "output-root", "ffmpeg", "ffprobe"])

/** Validates the closed portable list of immutable derived-audio declarations. */
export function validateSignatureSoundDerivedAudioBatchRegistry(rawRegistry) {
  const registry = requireRecord(rawRegistry, "Signature derived-audio batch registry")
  assertOnlyFields(registry, REGISTRY_FIELDS, "Signature derived-audio batch registry")
  if (registry.version !== 1 || !Array.isArray(registry.entries) || registry.entries.length === 0) {
    throw new Error("Signature derived-audio batch registry must be non-empty version 1")
  }
  const entries = registry.entries.map((rawEntry, index) => {
    const label = `Signature derived-audio batch registry entry ${index}`
    const entry = requireRecord(rawEntry, label)
    assertOnlyFields(entry, ENTRY_FIELDS, label)
    const batchId = requirePattern(entry.batchId, BATCH_ID, `${label} id`)
    const declarationRelativePath = requireDeclarationPath(entry.declarationRelativePath, label)
    return { batchId, declarationRelativePath }
  })
  if (new Set(entries.map(({ batchId }) => batchId)).size !== entries.length) {
    throw new Error("Signature derived-audio batch registry contains a duplicate batch id")
  }
  if (new Set(entries.map(({ declarationRelativePath }) => declarationRelativePath)).size !== entries.length) {
    throw new Error("Signature derived-audio batch registry contains a duplicate declaration path")
  }
  return { version: 1, entries }
}

/** Selects one exact declaration, defaulting only to the registry's first retained batch. */
export function selectSignatureSoundDerivedAudioBatchEntry(normalizedRegistry, requestedBatchId) {
  const registry = validateSignatureSoundDerivedAudioBatchRegistry(normalizedRegistry)
  const batchId = requestedBatchId === undefined
    ? registry.entries[0].batchId
    : requirePattern(requestedBatchId, BATCH_ID, "Signature derived-audio requested batch id")
  const entry = registry.entries.find((candidate) => candidate.batchId === batchId)
  if (!entry) throw new Error(`Unknown Signature derived-audio batch: ${batchId}`)
  return { ...entry }
}

/** Parses the narrow no-overwrite measurement/render CLI without accepting undeclared options. */
export function parseSignatureSoundDerivedAudioCliArguments(argv) {
  const mode = argv[0]
  if (!new Set(["measure", "render"]).has(mode)) throw new Error("Expected measure or render mode")
  const values = {}
  for (let index = 1; index < argv.length; index += 2) {
    const rawKey = argv[index]
    const value = argv[index + 1]
    const key = typeof rawKey === "string" && rawKey.startsWith("--") ? rawKey.slice(2) : ""
    if (!CLI_KEYS.has(key)) throw new Error(`Unknown Signature derived-audio CLI option: ${rawKey}`)
    if (typeof value !== "string" || value.length === 0 || values[key] !== undefined) {
      throw new Error("Signature derived-audio CLI options require one non-empty value")
    }
    values[key] = value
  }
  for (const key of ["source-root", "output-root", "ffmpeg", "ffprobe"]) {
    if (!values[key]) throw new Error(`Signature derived-audio CLI requires --${key}`)
  }
  return {
    mode,
    batchId: values["batch-id"],
    sourceRoot: values["source-root"],
    outputRoot: values["output-root"],
    ffmpeg: values.ffmpeg,
    ffprobe: values.ffprobe,
  }
}

function requireDeclarationPath(value, label) {
  if (typeof value !== "string" || value.includes("\\") || value.startsWith("/") || /^[a-z]:/i.test(value)) {
    throw new Error(`${label} declaration path must be portable and relative`)
  }
  const parts = value.split("/")
  if (parts.some((part) => !part || part === "." || part === "..") ||
      parts[0] !== "data" || parts[1] !== "atmoshaper" || !value.endsWith(".json")) {
    throw new Error(`${label} declaration path must stay beneath data/atmoshaper`)
  }
  return value
}

function requirePattern(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function assertOnlyFields(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${label} contains unknown field ${unknown[0]}`)
}
