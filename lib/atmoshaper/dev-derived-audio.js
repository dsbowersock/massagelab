// @ts-check

import { createHash } from "node:crypto"
import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

const SHA256 = /^[a-f0-9]{64}$/
const BATCH_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Loads one closed, checksum-anchored batch from either a server-owned catalog
 * child or the retained single-batch root. Browser input selects only batchId;
 * portable external directory names remain server-owned configuration.
 * @param {{batchId:unknown,catalogRoot:unknown,outputRoot:unknown,batchRegistry:unknown,manifestEntries:unknown,externalDirectoryNames?:unknown,nodeEnv:string|undefined}} input
 */
export async function loadDevSignatureDerivedCatalogBatch({
  batchId,
  catalogRoot,
  outputRoot,
  batchRegistry,
  manifestEntries,
  externalDirectoryNames = {},
  nodeEnv,
}) {
  assertDevelopment(nodeEnv)
  const requestedBatchId = requirePattern(batchId, BATCH_ID, "Development derived-audio batch id")
  const registry = requireRecord(batchRegistry, "Development derived-audio batch registry")
  if (!Array.isArray(registry.entries)) throw new Error("Development derived-audio batch registry entries must be an array")
  if (!Array.isArray(manifestEntries)) throw new Error("Development derived-audio manifest anchors must be an array")
  const registryEntry = selectExactBatchEntry(
    registry.entries,
    requestedBatchId,
    "Development derived-audio batch registry",
  )
  const manifestEntry = selectExactBatchEntry(
    manifestEntries,
    requestedBatchId,
    "Development derived-audio manifest anchors",
  )

  const hasCatalogRoot = catalogRoot !== undefined && catalogRoot !== null && catalogRoot !== ""
  let selectedRoot = outputRoot
  let externalDirectoryName = null
  if (hasCatalogRoot) {
    if (typeof catalogRoot !== "string" || catalogRoot.trim() !== catalogRoot || !isAbsolute(catalogRoot)) {
      throw new Error("The server-owned Signature derived-audio catalog root must be an absolute path")
    }
    const directoryNames = requireRecord(externalDirectoryNames, "Development derived-audio external directory names")
    externalDirectoryName = requirePortableDirectoryName(
      Object.hasOwn(directoryNames, requestedBatchId) ? directoryNames[requestedBatchId] : requestedBatchId,
    )
    selectedRoot = await resolveExactChildDirectory(catalogRoot, externalDirectoryName)
  }

  const snapshot = await loadDevSignatureDerivedManifestSnapshot({
    outputRoot: selectedRoot,
    manifestEntries: [manifestEntry],
    nodeEnv,
  })
  const manifest = requireRecord(snapshot.manifest, "Development derived-audio manifest")
  if (manifest.batchId !== requestedBatchId) {
    throw new Error("Development derived-audio manifest batch does not match the selected batch")
  }
  return {
    batchId: requestedBatchId,
    externalDirectoryName,
    outputRoot: selectedRoot,
    manifest,
    manifestEntry: snapshot.manifestEntry,
    registryEntry,
  }
}

/**
 * Loads one exact external manifest snapshot against its committed portable checksum anchor.
 * @param {{outputRoot:unknown,manifestEntry:unknown,nodeEnv:string|undefined}} input
 */
export async function loadDevSignatureDerivedManifest({ outputRoot, manifestEntry, nodeEnv }) {
  const snapshot = await loadDevSignatureDerivedManifestSnapshot({
    outputRoot,
    manifestEntries: [manifestEntry],
    nodeEnv,
  })
  return snapshot.manifest
}

/**
 * Selects the one manifest whose bytes match a committed anchor beneath the configured batch root.
 * @param {{outputRoot:unknown,manifestEntries:unknown,nodeEnv:string|undefined}} input
 */
export async function loadDevSignatureDerivedManifestSnapshot({ outputRoot, manifestEntries, nodeEnv }) {
  assertDevelopment(nodeEnv)
  if (typeof outputRoot !== "string" || outputRoot.trim() === "") {
    throw new Error("The server-owned Signature derived-audio root is not configured")
  }
  if (!Array.isArray(manifestEntries) || manifestEntries.length === 0) {
    throw new Error("Development derived-audio manifest anchors are missing")
  }
  const matches = []
  for (const rawEntry of manifestEntries) {
    const entry = requireRecord(rawEntry, "Development derived-audio manifest entry")
    const relativePath = requireSafeRelativePath(entry.manifestRelativePath)
    const expectedSha256 = requireSha256(entry.manifestSha256, "Development derived-audio manifest checksum")
    const { bytes } = await readExactChild(outputRoot, relativePath)
    if (createHash("sha256").update(bytes).digest("hex") === expectedSha256) {
      matches.push({ manifest: JSON.parse(bytes.toString("utf8")), manifestEntry: entry })
    }
  }
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? "Development derived-audio manifest content changed from every committed anchor"
      : "Development derived-audio manifest matches duplicate anchors")
  }
  return matches[0]
}

/**
 * Resolves one manifest-listed derived WAV as the same byte snapshot that passed checksum verification.
 * @param {{outputIdentity:unknown,manifest:unknown,outputRoot:unknown,nodeEnv:string|undefined}} input
 */
export async function resolveDevSignatureDerivedAudio({ outputIdentity, manifest, outputRoot, nodeEnv }) {
  assertDevelopment(nodeEnv)
  const identity = requireSha256(outputIdentity, "Development derived-audio output identity")
  if (typeof outputRoot !== "string" || outputRoot.trim() === "") {
    throw new Error("The server-owned Signature derived-audio root is not configured")
  }
  const normalizedManifest = requireRecord(manifest, "Development derived-audio manifest")
  if (!Array.isArray(normalizedManifest.outputs)) throw new Error("Development derived-audio manifest outputs must be an array")
  const matches = normalizedManifest.outputs.filter((/** @type {any} */ output) => (
    output && typeof output === "object" && output.outputIdentity === identity
  ))
  if (matches.length !== 1) throw new Error(matches.length > 1 ? "Duplicate development derived-audio output" : "Unknown development derived-audio output")
  const output = requireRecord(matches[0], "Development derived-audio output")
  const relativePath = requireSafeRelativePath(output.outputRelativePath)
  if (!relativePath.toLowerCase().endsWith(".wav")) throw new Error("Development derived-audio output must be WAV")
  const measurement = requireRecord(output.outputMeasurement, "Development derived-audio output measurement")
  const expectedSha256 = requireSha256(measurement.outputSha256, "Development derived-audio output checksum")
  if (!Number.isSafeInteger(measurement.byteSize) || measurement.byteSize <= 0) {
    throw new Error("Development derived-audio output byte size is invalid")
  }
  const snapshot = await readExactChild(outputRoot, relativePath)
  if (snapshot.bytes.byteLength !== measurement.byteSize) throw new Error("Development derived-audio output size changed")
  if (createHash("sha256").update(snapshot.bytes).digest("hex") !== expectedSha256) {
    throw new Error("Development derived-audio output content changed from its manifest checksum")
  }
  return { bytes: snapshot.bytes, byteSize: measurement.byteSize, mimeType: "audio/wav" }
}

/** @param {string} rootPath @param {string} relativePath */
async function readExactChild(rootPath, relativePath) {
  let canonicalRoot
  let canonicalChild
  try {
    canonicalRoot = await realpath(resolve(rootPath))
    canonicalChild = await realpath(resolve(canonicalRoot, ...relativePath.split("/")))
  } catch {
    throw new Error("Development derived-audio path could not be resolved")
  }
  const relation = relative(canonicalRoot, canonicalChild)
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("Development derived-audio path resolves outside its configured root")
  }
  const childStat = await stat(canonicalChild)
  if (!childStat.isFile()) throw new Error("Development derived-audio artifact must be a file")
  const bytes = await readFile(canonicalChild)
  return { bytes }
}

/**
 * Resolves one real directory immediately beneath a configured catalog root.
 * @param {string} catalogRoot
 * @param {string} externalDirectoryName
 */
async function resolveExactChildDirectory(catalogRoot, externalDirectoryName) {
  let canonicalRoot
  let canonicalChild
  try {
    canonicalRoot = await realpath(resolve(catalogRoot))
    canonicalChild = await realpath(resolve(canonicalRoot, externalDirectoryName))
  } catch {
    throw new Error("Development derived-audio catalog batch could not be resolved")
  }
  const relation = relative(canonicalRoot, canonicalChild)
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("Development derived-audio catalog batch resolves outside its configured root")
  }
  const childStat = await stat(canonicalChild)
  if (!childStat.isDirectory()) throw new Error("Development derived-audio catalog batch must be a directory")
  return canonicalChild
}

/**
 * Selects exactly one server-committed entry without accepting a path from the request.
 * @param {unknown[]} entries
 * @param {string} batchId
 * @param {string} label
 * @returns {Record<string, any>}
 */
function selectExactBatchEntry(entries, batchId, label) {
  const matches = entries.filter((rawEntry) => {
    const entry = requireRecord(rawEntry, `${label} entry`)
    return entry.batchId === batchId
  })
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? `${label} does not contain the requested batch`
      : `${label} contains a duplicate batch id`)
  }
  return requireRecord(matches[0], `${label} entry`)
}

/**
 * Accepts one portable directory segment, never a relative or absolute path.
 * @param {unknown} value
 */
function requirePortableDirectoryName(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]*$/i.test(value) || value === "." || value === "..") {
    throw new Error("Development derived-audio external directory name must be one portable path segment")
  }
  return value
}

/** @param {string|undefined} nodeEnv */
function assertDevelopment(nodeEnv) {
  if (nodeEnv === "production") throw new Error("Development derived audio is disabled in production")
}

/** @param {unknown} value */
function requireSafeRelativePath(value) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error("Development derived-audio path must be a relative path")
  }
  const parts = value.split("/")
  if (value.includes("\\") || value.startsWith("/") || /^[a-z]:/i.test(value) || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Development derived-audio path must remain relative")
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {RegExp} pattern @param {string} label */
function requirePattern(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {string} label @returns {Record<string, any>} */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}
