import { readFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  createSoundProcessingPlan,
  renderSoundProcessingPlanJson,
} from "../lib/atmoshaper/sound-processing-plan.js"
import { createSignatureSoundAudit } from "../lib/atmoshaper/signature-sound-scan.js"

const scriptPath = fileURLToPath(import.meta.url)
const defaultRepoRoot = resolve(dirname(scriptPath), "..")
const USAGE = "Usage: npm run atmoshaper:sounds:process-plan -- \"<Signature root>\" --output-root \"<absolute external path>\""

/**
 * Runs a fresh Task 2 audit and prints a processing plan without creating the
 * output root, invoking ffmpeg, or mutating any catalog or source data.
 * Optional inputs exist solely to keep fixture tests local and deterministic.
 * @param {{ args?: string[], repoRoot?: string, moodistConcepts?: unknown, signatureDeclaration?: unknown, processingDeclaration?: unknown, publicationBaseline?: unknown, stdout?: (value: string) => void }} [options]
 */
export async function runSoundProcessingPlanCli(options = {}) {
  const parsed = parseArguments(options.args ?? [])
  const repoRoot = resolve(options.repoRoot ?? defaultRepoRoot)
  const moodistConcepts = options.moodistConcepts ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/moodist-concepts.json"),
    "Moodist inventory",
  )
  const signatureDeclaration = options.signatureDeclaration ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/signature-sound-candidates.json"),
    "Signature declaration",
  )
  const processingDeclaration = options.processingDeclaration ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/sound-processing-recipes.json"),
    "sound processing declaration",
  )
  const publicationBaseline = options.publicationBaseline ?? await readJson(
    resolve(repoRoot, "data/atmoshaper/sound-publication-ledger-baseline.json"),
    "sound publication ledger baseline",
  )
  const audit = await createSignatureSoundAudit({
    rootPath: parsed.signatureRoot,
    moodistConcepts,
    signatureDeclaration,
  })
  const plan = await createSoundProcessingPlan({
    audit,
    processingDeclaration,
    publicationBaseline,
    repoRoot,
    outputRoot: parsed.outputRoot,
  })
  const writeStdout = options.stdout ?? ((value) => process.stdout.write(value))
  writeStdout(renderSoundProcessingPlanJson(plan))
  return 0
}

/** Accepts exactly one root plus one explicit absolute output-root option. @param {string[]} args */
function parseArguments(args) {
  let signatureRoot
  let outputRoot
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--output-root") {
      const value = args[index + 1]
      if (outputRoot !== undefined || typeof value !== "string" || value.trim() === "" || value.startsWith("--")) {
        throw new Error(`--output-root requires exactly one path. ${USAGE}`)
      }
      outputRoot = value
      index += 1
      continue
    }
    if (argument.startsWith("--")) throw new Error(`Unknown processing-plan option: ${argument}. ${USAGE}`)
    if (signatureRoot !== undefined) throw new Error(`The processing plan accepts exactly one Signature root. ${USAGE}`)
    signatureRoot = argument
  }
  if (signatureRoot === undefined || signatureRoot.trim() === "" || outputRoot === undefined) {
    throw new Error(USAGE)
  }
  if (!isAbsolute(outputRoot)) throw new Error(`--output-root must be absolute. ${USAGE}`)
  return { signatureRoot, outputRoot }
}

/** @param {string} path @param {string} label */
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
    await runSoundProcessingPlanCli({ args: process.argv.slice(2) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Planning failed"
    process.stderr.write(`AtmoShaper sound processing plan failed: ${message}\n`)
    process.exitCode = 1
  }
}
