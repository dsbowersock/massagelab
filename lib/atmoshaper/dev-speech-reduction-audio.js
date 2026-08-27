// @ts-check

import { createHash } from "node:crypto"
import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

import { validateSignatureSoundSpeechReductionManifest } from "./signature-sound-speech-reduction.js"
import { validateSignatureSoundSpeechReductionReviewAnchor } from "./signature-sound-speech-reduction-review.js"
import { resolveDevSignatureDerivedAudio } from "./dev-derived-audio.js"

const SHA256 = /^[a-f0-9]{64}$/
const BATCH_ID = /^batch-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Loads the optional repository anchor without inventing one. A missing file
 * means the live review remains processing-gated until the render is complete.
 * @param {string} anchorPath
 */
export async function loadOptionalSignatureSoundSpeechReductionReviewAnchor(anchorPath) {
  try {
    return JSON.parse(await readFile(anchorPath, "utf8"))
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null
    throw new Error("Speech-reduction review anchor could not be loaded")
  }
}

/**
 * Reads and validates one complete external manifest through its exact portable
 * anchor. Callers supply the already validated declaration owner.
 * @param {{outputRoot:unknown,anchor:unknown,declaration:unknown,nodeEnv:string|undefined}} input
 */
export async function loadDevSignatureSoundSpeechReductionManifest({
  outputRoot,
  anchor,
  declaration,
  nodeEnv,
}) {
  assertDevelopment(nodeEnv)
  const normalizedAnchor = validateSignatureSoundSpeechReductionReviewAnchor(anchor)
  const normalizedDeclaration = requireRecord(declaration, "Development speech-reduction declaration")
  if (normalizedDeclaration.declarationSha256 !== normalizedAnchor.declarationSha256) {
    throw new Error("Development speech-reduction declaration does not match its anchor")
  }
  const snapshot = await readExactChild(outputRoot, normalizedAnchor.manifestRelativePath)
  if (createHash("sha256").update(snapshot.bytes).digest("hex") !== normalizedAnchor.manifestSha256) {
    throw new Error("Development speech-reduction manifest changed from its anchor")
  }
  let rawManifest
  try {
    rawManifest = JSON.parse(snapshot.bytes.toString("utf8"))
  } catch {
    throw new Error("Development speech-reduction manifest is not JSON")
  }
  const manifest = validateSignatureSoundSpeechReductionManifest(rawManifest, normalizedDeclaration)
  return { manifest, anchor: normalizedAnchor, manifestBytes: snapshot.bytes }
}

/**
 * Resolves one concept-owned processed WAV as the exact byte snapshot whose
 * size and checksum were validated from the complete manifest.
 * @param {{batchId:unknown,outputIdentity:unknown,manifest:unknown,outputRoot:unknown,nodeEnv:string|undefined}} input
 */
export async function resolveDevSignatureSoundSpeechReductionAudio({
  batchId,
  outputIdentity,
  manifest,
  outputRoot,
  nodeEnv,
}) {
  assertDevelopment(nodeEnv)
  const requestedBatchId = requirePattern(batchId, BATCH_ID, "Development speech-reduction batch id")
  const requestedOutputIdentity = requireSha256(outputIdentity, "Development speech-reduction output identity")
  const normalizedManifest = requireRecord(manifest, "Development speech-reduction manifest")
  if (!Array.isArray(normalizedManifest.outputs)) throw new Error("Development speech-reduction outputs must be an array")
  const matches = normalizedManifest.outputs.filter((output) => (
    output && typeof output === "object" && output.outputIdentity === requestedOutputIdentity
  ))
  if (matches.length !== 1) throw new Error(matches.length > 1
    ? "Duplicate development speech-reduction output"
    : "Unknown development speech-reduction output")
  const output = requireRecord(matches[0], "Development speech-reduction output")
  if (output.batchId !== requestedBatchId) throw new Error("Development speech-reduction output belongs to another batch")
  return resolveDevSignatureDerivedAudio({
    outputIdentity: requestedOutputIdentity,
    manifest: normalizedManifest,
    outputRoot,
    nodeEnv,
  })
}

/** @param {unknown} outputRoot @param {unknown} relativePath */
async function readExactChild(outputRoot, relativePath) {
  if (typeof outputRoot !== "string" || outputRoot.trim() !== outputRoot || !isAbsolute(outputRoot)) {
    throw new Error("The server-owned speech-reduction root is not configured")
  }
  const safeRelativePath = requireSafeRelativePath(relativePath, "Development speech-reduction path")
  let canonicalRoot
  let canonicalChild
  try {
    canonicalRoot = await realpath(resolve(outputRoot))
    canonicalChild = await realpath(resolve(canonicalRoot, ...safeRelativePath.split("/")))
  } catch {
    throw new Error("Development speech-reduction path could not be resolved")
  }
  const relation = relative(canonicalRoot, canonicalChild)
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("Development speech-reduction path resolves outside its configured root")
  }
  const childStat = await stat(canonicalChild)
  if (!childStat.isFile()) throw new Error("Development speech-reduction artifact must be a file")
  return { bytes: await readFile(canonicalChild) }
}

/** @param {string|undefined} nodeEnv */
function assertDevelopment(nodeEnv) {
  if (nodeEnv === "production") throw new Error("Development speech-reduction audio is disabled in production")
}

/** @param {unknown} value @param {string} label */
function requireSafeRelativePath(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.includes("\\") ||
      value.startsWith("/") || /^[a-z]:/i.test(value) || value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must remain relative`)
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

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}
