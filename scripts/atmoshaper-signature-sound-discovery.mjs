import { randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  createSignatureSoundDiscoveryReview,
  renderSignatureSoundDiscoveryJson,
  validateSignatureSoundPackReviews,
} from "../lib/atmoshaper/signature-sound-discovery.js"
import { scanSignatureSoundRoot } from "../lib/atmoshaper/signature-sound-scan.js"

const scriptPath = fileURLToPath(import.meta.url)
const defaultRepoRoot = resolve(dirname(scriptPath), "..")
const outputRelativePath = "data/atmoshaper/signature-sound-review.json"

/**
 * Hashes the local Signature library and atomically publishes the exhaustive,
 * path-free review manifest at its single repository-owned destination.
 * @param {{ args?: string[], repoRoot?: string, moodistConcepts?: unknown, signatureDeclaration?: unknown, packReviews?: unknown, stdout?: (value: string) => void }} [options]
 */
export async function runSignatureSoundDiscoveryCli(options = {}) {
  const args = options.args ?? []
  if (args.length !== 1 || typeof args[0] !== "string" || args[0].trim() === "") {
    throw new Error('Usage: npm run atmoshaper:sounds:discover -- "<Signature Sounds root>"')
  }
  const repoRoot = await canonicalDirectory(options.repoRoot ?? defaultRepoRoot, "repository or worktree")
  const rootPath = await canonicalDirectory(args[0], "Signature Sounds root")
  const moodistConcepts = options.moodistConcepts ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/moodist-concepts.json"),
    "Moodist inventory",
  )
  const signatureDeclaration = options.signatureDeclaration ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/signature-sound-candidates.json"),
    "Signature declaration",
  )
  const packReviews = options.packReviews ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/signature-sound-pack-reviews.json"),
    "Signature pack reviews",
  )
  const validatedPackReviews = validateSignatureSoundPackReviews(packReviews, moodistConcepts)
  const filesystemPacks = await listTopLevelPacks(rootPath)
  const reviewedPacks = validatedPackReviews.packs.map(({ packName }) => packName).sort(compareText)
  if (JSON.stringify(filesystemPacks) !== JSON.stringify(reviewedPacks)) {
    const missing = filesystemPacks.filter((packName) => !reviewedPacks.includes(packName))
    const extra = reviewedPacks.filter((packName) => !filesystemPacks.includes(packName))
    throw new Error(`Signature pack filesystem coverage mismatch; missing=${missing.join(",")}; extra=${extra.join(",")}`)
  }

  const scan = await scanSignatureSoundRoot(rootPath)
  const review = createSignatureSoundDiscoveryReview({
    scan,
    moodistConcepts,
    signatureDeclaration,
    packReviews: validatedPackReviews,
  })
  const output = renderSignatureSoundDiscoveryJson(review)
  const outputPath = resolve(repoRoot, outputRelativePath)
  await publishAtomically(repoRoot, outputPath, output)
  const stdout = options.stdout ?? ((value) => process.stdout.write(value))
  stdout(output)
  return 0
}

async function listTopLevelPacks(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase() !== "__macosx")
    .map(({ name }) => name)
    .sort(compareText)
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
      if (parent === current) throw new Error("Discovery manifest parent could not be resolved")
      current = parent
    }
  }
}

function assertInside(repoRoot, destination, allowRoot) {
  const repoRelative = relative(repoRoot, destination)
  if ((!allowRoot && repoRelative === "") || repoRelative.startsWith("..") || isAbsolute(repoRelative)) {
    throw new Error("Discovery manifest must remain inside the current repository or worktree")
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

function compareText(left, right) {
  const foldedLeft = left.toLowerCase()
  const foldedRight = right.toLowerCase()
  if (foldedLeft < foldedRight) return -1
  if (foldedLeft > foldedRight) return 1
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const launchedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath
if (launchedDirectly) {
  try {
    await runSignatureSoundDiscoveryCli({ args: process.argv.slice(2) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature sound discovery failed"
    process.stderr.write(`AtmoShaper Signature sound discovery failed: ${message}\n`)
    process.exitCode = 1
  }
}
