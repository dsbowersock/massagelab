import { randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  createSignatureSoundConstructionReview,
  renderSignatureSoundConstructionReviewJson,
  renderSignatureSoundConstructionReviewMarkdown,
  validateSignatureSoundConstructionReview,
} from "../lib/atmoshaper/signature-sound-construction-review.js"
const scriptPath = fileURLToPath(import.meta.url)
const defaultRepoRoot = resolve(dirname(scriptPath), "..")
const outputRelativePath = "data/atmoshaper/signature-sound-construction-review.json"

/**
 * Reconciles two explicit human exports against repository-owned authorities.
 * It writes nothing unless the exact generated-owner destination is requested.
 * @param {{ args?: string[], repoRoot?: string, canonicalInputs?: Record<string, unknown>, stdout?: (value: string) => void, renameFile?: typeof rename, readPublishedFile?: typeof readFile }} [options]
 */
export async function runSignatureSoundConstructionReviewCli(options = {}) {
  const parsed = parseArguments(options.args ?? [])
  const repoRoot = await canonicalDirectory(options.repoRoot ?? defaultRepoRoot)
  const [exportedListeningReview, workspace] = await Promise.all([
    readJson(resolve(parsed.exportedListeningPath), "exported listening review"),
    readJson(resolve(parsed.workspacePath), "complete review workspace"),
  ])
  const canonical = options.canonicalInputs ?? await loadCanonicalInputs(repoRoot)
  const authority = { ...canonical, exportedListeningReview, workspace }
  const review = createSignatureSoundConstructionReview(authority)
  const json = renderSignatureSoundConstructionReviewJson(review, authority)
  const output = parsed.format === "markdown"
    ? renderSignatureSoundConstructionReviewMarkdown(review, authority)
    : json
  if (parsed.output !== undefined) {
    await publishReview(repoRoot, json, authority, {
      renameFile: options.renameFile ?? rename,
      readPublishedFile: options.readPublishedFile ?? readFile,
    })
  }
  const stdout = options.stdout ?? ((value) => process.stdout.write(value))
  stdout(output)
  return 0
}
function parseArguments(args) {
  const positional = []
  let format = "json"
  let output
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--format" || argument === "--output") {
      const value = args[index + 1]
      if (typeof value !== "string" || value.trim() === "" || value.startsWith("--")) {
        throw new Error(`${argument} requires a value`)
      }
      if (argument === "--format") {
        if (value !== "json" && value !== "markdown") throw new Error("--format must be json or markdown")
        format = value
      } else {
        if (value !== outputRelativePath) throw new Error(`--output must be ${outputRelativePath}`)
        output = value
      }
      index += 1
      continue
    }
    if (argument.startsWith("--")) throw new Error("Unknown construction-review option")
    positional.push(argument)
  }
  if (positional.length !== 2 || positional.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new Error('Usage: npm run atmoshaper:sounds:reconcile-review -- "<listening-v1.json>" "<complete-v3.json>" [--format markdown] [--output data/atmoshaper/signature-sound-construction-review.json]')
  }
  return { exportedListeningPath: positional[0], workspacePath: positional[1], format, output }
}
async function loadCanonicalInputs(repoRoot) {
  const paths = [
    ["moodistConcepts", "data/atmoshaper/moodist-concepts.json", "Moodist inventory"],
    ["discoveryReview", "data/atmoshaper/signature-sound-review.json", "discovery review"],
    ["strategyPolicy", "data/atmoshaper/signature-sound-playback-strategies.json", "playback policy"],
    ["listeningReview", "data/atmoshaper/signature-sound-listening-review.json", "listening review"],
    ["interpretations", "data/atmoshaper/signature-sound-construction-interpretations.json", "construction interpretations"],
  ]
  const entries = await Promise.all(paths.map(async ([key, path, label]) => [
    key,
    await readJson(resolve(repoRoot, path), label),
  ]))
  return Object.fromEntries(entries)
}
async function publishReview(repoRoot, contents, authority, io) {
  const destination = resolve(repoRoot, outputRelativePath)
  await assertDestinationInside(repoRoot, destination)
  await mkdir(dirname(destination), { recursive: true })
  await assertDestinationInside(repoRoot, destination)
  const temporary = `${destination}.${randomUUID()}.tmp`
  const backup = `${destination}.${randomUUID()}.backup`
  let backedUp = false
  let published = false
  try {
    await writeFile(temporary, contents, { encoding: "utf8", flag: "wx" })
    if (await exists(destination)) {
      await io.renameFile(destination, backup)
      backedUp = true
    }
    await io.renameFile(temporary, destination)
    published = true
    const reread = JSON.parse(await io.readPublishedFile(destination, "utf8"))
    validateSignatureSoundConstructionReview(reread, authority)
    if (backedUp) await rm(backup, { force: true })
    backedUp = false
  } catch {
    if (published) await rm(destination, { force: true }).catch(() => {})
    if (backedUp) await io.renameFile(backup, destination).catch(() => {})
    throw new Error(`Could not publish ${outputRelativePath}`)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
    if (!backedUp) await rm(backup, { force: true }).catch(() => {})
  }
}
async function assertDestinationInside(repoRoot, destination) {
  assertInside(repoRoot, destination)
  let current = destination
  const suffix = []
  while (true) {
    try {
      const info = await lstat(current)
      if (current === destination && info.isDirectory()) throw new Error("Construction-review destination must be a file")
      const canonical = resolve(await realpath(current), ...suffix)
      assertInside(repoRoot, canonical)
      return
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
      const parent = dirname(current)
      if (parent === current) throw new Error("Construction-review destination could not be resolved")
      suffix.unshift(current.slice(parent.length + 1))
      current = parent
    }
  }
}
function assertInside(repoRoot, destination) {
  const repoRelative = relative(repoRoot, destination)
  if (repoRelative === "" || repoRelative.startsWith("..") || isAbsolute(repoRelative)) {
    throw new Error("Construction review must remain inside the current repository or worktree")
  }
}
async function canonicalDirectory(path) {
  try {
    return await realpath(resolve(path))
  } catch {
    throw new Error("Could not resolve the current repository or worktree")
  }
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch {
    throw new Error(`Could not load the ${label}`)
  }
}

async function exists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error?.code === "ENOENT") return false
    throw error
  }
}

const launchedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath
if (launchedDirectly) {
  try {
    await runSignatureSoundConstructionReviewCli({ args: process.argv.slice(2) })
  } catch (error) {
    process.stderr.write(`AtmoShaper Signature construction-review reconciliation failed: ${error instanceof Error ? error.message : "unknown error"}\n`)
    process.exitCode = 1
  }
}
