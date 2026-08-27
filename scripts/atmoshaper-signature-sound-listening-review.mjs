import { randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  createSignatureSoundListeningReview,
  renderSignatureSoundListeningReviewJson,
} from "../lib/atmoshaper/signature-sound-listening-review.js"

const scriptPath = fileURLToPath(import.meta.url)
const defaultRepoRoot = resolve(dirname(scriptPath), "..")
const outputRelativePath = "data/atmoshaper/signature-sound-listening-review.json"

/**
 * Validates a browser-exported listening review and atomically publishes its
 * path-free normalized curation at one fixed repository destination.
 * @param {{ args?: string[], repoRoot?: string, discoveryReview?: unknown, moodistConcepts?: unknown, strategyPolicy?: unknown, stdout?: (value: string) => void }} [options]
 */
export async function runSignatureSoundListeningReviewCli(options = {}) {
  const args = options.args ?? []
  if (args.length !== 1 || typeof args[0] !== "string" || args[0].trim() === "") {
    throw new Error('Usage: npm run atmoshaper:sounds:curate-review -- "<exported review JSON>"')
  }
  const repoRoot = await canonicalDirectory(options.repoRoot ?? defaultRepoRoot, "repository or worktree")
  const exportedReview = await readJson(resolve(args[0]), "exported Signature listening review")
  const discoveryReview = options.discoveryReview ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/signature-sound-review.json"),
    "Signature discovery review",
  )
  const moodistConcepts = options.moodistConcepts ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/moodist-concepts.json"),
    "Moodist inventory",
  )
  const strategyPolicy = options.strategyPolicy ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/signature-sound-playback-strategies.json"),
    "Signature playback strategy policy",
  )
  const curation = createSignatureSoundListeningReview({
    discoveryReview,
    moodistConcepts,
    exportedReview,
    strategyPolicy,
  })
  const output = renderSignatureSoundListeningReviewJson(curation, {
    discoveryReview,
    moodistConcepts,
    exportedReview,
    strategyPolicy,
  })
  await publishAtomically(repoRoot, resolve(repoRoot, outputRelativePath), output)
  const stdout = options.stdout ?? ((value) => process.stdout.write(value))
  stdout(output)
  return 0
}

async function publishAtomically(repoRoot, outputPath, contents) {
  const parent = dirname(outputPath)
  await assertNearestExistingAncestorInside(repoRoot, parent)
  await mkdir(parent, { recursive: true })
  const canonicalParent = await realpath(parent)
  assertInside(repoRoot, canonicalParent, true)
  const canonicalOutput = resolve(canonicalParent, outputPath.slice(parent.length + 1))
  assertInside(repoRoot, canonicalOutput, false)
  const temporaryPath = `${canonicalOutput}.${randomUUID()}.tmp`
  const backupPath = `${canonicalOutput}.${randomUUID()}.backup`
  let backedUp = false
  let published = false
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" })
    try {
      await lstat(canonicalOutput)
      await rename(canonicalOutput, backupPath)
      backedUp = true
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
    await rename(temporaryPath, canonicalOutput)
    published = true
    if (backedUp) await rm(backupPath, { force: true })
  } catch (error) {
    if (!published && backedUp) await rename(backupPath, canonicalOutput).catch(() => {})
    throw new Error(`Could not publish ${outputRelativePath}: ${error?.message ?? error}`)
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {})
    if (published) await rm(backupPath, { force: true }).catch(() => {})
  }
}

async function assertNearestExistingAncestorInside(repoRoot, destination) {
  let current = destination
  while (true) {
    try {
      await lstat(current)
      assertInside(repoRoot, await realpath(current), true)
      return
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
      const parent = dirname(current)
      if (parent === current) throw new Error("Listening-review destination parent could not be resolved")
      current = parent
    }
  }
}

function assertInside(repoRoot, destination, allowRoot) {
  const repoRelative = relative(repoRoot, destination)
  if ((!allowRoot && repoRelative === "") || repoRelative.startsWith("..") || isAbsolute(repoRelative)) {
    throw new Error("Listening review must remain inside the current repository or worktree")
  }
}

async function canonicalDirectory(path, label) {
  try {
    return await realpath(resolve(path))
  } catch {
    throw new Error(`Could not resolve the ${label}`)
  }
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch {
    throw new Error(`Could not load the ${label}`)
  }
}

const launchedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath
if (launchedDirectly) {
  try {
    await runSignatureSoundListeningReviewCli({ args: process.argv.slice(2) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature listening-review import failed"
    process.stderr.write(`AtmoShaper Signature listening-review import failed: ${message}\n`)
    process.exitCode = 1
  }
}
