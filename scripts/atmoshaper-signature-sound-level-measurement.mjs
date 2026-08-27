import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

import { applySignatureSoundWholeConceptReviewAmendments } from "../lib/atmoshaper/signature-sound-whole-concept-amendment.js"
import { validateSignatureSoundCatalogExpansionReview } from "../lib/atmoshaper/signature-sound-catalog-expansion-review.js"
import { validateSignatureSoundWholeConceptReviewCatalog } from "../lib/atmoshaper/signature-sound-whole-concept-review.js"
import { applySignatureSoundWholeConceptReviewRevisions } from "../lib/atmoshaper/signature-sound-whole-concept-revision.js"

const argv = parseArgs(process.argv.slice(2))
const sourceRoot = requireAbsoluteDirectory(argv["source-root"], "--source-root")
const ffmpegPath = path.resolve(requireString(argv.ffmpeg, "--ffmpeg"))
const batchId = requireString(argv["batch-id"], "--batch-id")
const catalog = loadCatalog()
const entry = catalog.entries.find((candidate) => candidate.batchId === batchId)
if (!entry) throw new Error(`Unknown whole-concept batch: ${batchId}`)

const version = run(ffmpegPath, ["-version"]).stdout.split(/\r?\n/, 1)[0]
const measurements = entry.sources.map((source) => {
  const absolutePath = resolveContainedSource(sourceRoot, source.relativePath)
  const output = run(ffmpegPath, [
    "-hide_banner", "-nostats", "-i", absolutePath,
    "-filter_complex", "ebur128=peak=true", "-f", "null", "NUL",
  ]).stderr
  const finalSummary = output.slice(output.lastIndexOf("Summary:"))
  const integrated = finalSummary.match(/Integrated loudness:\s*I:\s*(-?\d+(?:\.\d+)?) LUFS/)
  const peak = finalSummary.match(/True peak:\s*Peak:\s*(-?\d+(?:\.\d+)?) dBFS/)
  const duration = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!integrated || !peak || !duration) throw new Error(`Could not parse EBU R128 result for ${source.relativePath}`)
  return {
    sourceId: source.sourceId,
    relativePath: source.relativePath,
    durationSeconds: round(Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]), 3),
    integratedLoudnessLufs: Number(integrated[1]),
    truePeakDbtp: Number(peak[1]),
  }
})

process.stdout.write(`${JSON.stringify({ batchId, toolVersion: version, measurements }, null, 2)}\n`)

/** Loads the same revision/amendment projection used by the development page. */
function loadCatalog() {
  const read = (relativePath) => JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8"))
  const discoveryReview = read("data/atmoshaper/signature-sound-review.json")
  const base = validateSignatureSoundWholeConceptReviewCatalog(
    read("data/atmoshaper/signature-sound-whole-concept-review-batches.json"),
    {
      constructionReview: read("data/atmoshaper/signature-sound-construction-review.json"),
      discoveryReview,
    },
  )
  const revised = applySignatureSoundWholeConceptReviewRevisions(
    base,
    read("data/atmoshaper/signature-sound-whole-concept-review-revisions.json"),
  )
  const amended = applySignatureSoundWholeConceptReviewAmendments(
    revised,
    read("data/atmoshaper/signature-sound-whole-concept-review-amendments.json"),
  )
  const expansion = validateSignatureSoundCatalogExpansionReview(
    read("data/atmoshaper/signature-sound-catalog-expansion-review.json"),
    { discoveryReview },
  )
  return { entries: [...amended.entries, ...expansion.entries] }
}

/** Runs a read-only analyzer and fails with its bounded diagnostic output. */
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Analyzer failed (${result.status}): ${(result.stderr || result.stdout).slice(-4000)}`)
  }
  return result
}

/** Resolves a catalog path under the server-owned Signature root. */
function resolveContainedSource(root, relativePath) {
  if (relativePath.includes("\\") || relativePath.startsWith("/") || relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe Signature source path: ${relativePath}`)
  }
  const absolutePath = path.resolve(root, ...relativePath.split("/"))
  const relative = path.relative(root, absolutePath)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Source escapes Signature root: ${relativePath}`)
  return absolutePath
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]
    if (!key?.startsWith("--") || values[index + 1] === undefined) throw new Error(`Invalid argument: ${key ?? "<missing>"}`)
    result[key.slice(2)] = values[index + 1]
  }
  return result
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`)
  return value
}

function requireAbsoluteDirectory(value, label) {
  const directory = requireString(value, label)
  if (!path.isAbsolute(directory)) throw new Error(`${label} must be absolute`)
  return path.resolve(directory)
}

function round(value, digits) {
  return Number(value.toFixed(digits))
}
