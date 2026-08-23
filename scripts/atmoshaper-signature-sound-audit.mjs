import { randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises"
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  createSignatureSoundAudit,
  renderSignatureSoundAuditJson,
  renderSignatureSoundAuditMarkdown,
} from "../lib/atmoshaper/signature-sound-scan.js"

const scriptPath = fileURLToPath(import.meta.url)
const defaultRepoRoot = resolve(dirname(scriptPath), "..")

/**
 * Runs the audit CLI with injectable catalog data and stdout for fixture tests.
 * Report directories are created only after an explicit, confined destination
 * and a completely successful audit have both been established.
 * @param {{ args?: string[], repoRoot?: string, moodistConcepts?: unknown, signatureDeclaration?: unknown, stdout?: (value: string) => void, reportFileRename?: (source: string, destination: string) => Promise<void> }} [options]
 */
export async function runSignatureSoundAuditCli(options = {}) {
  const repoRoot = await canonicalizeRepositoryRoot(options.repoRoot ?? defaultRepoRoot)
  const parsed = parseArguments(options.args ?? [])
  const reportMarkdown = parsed.reportMarkdown === undefined
    ? undefined
    : resolveReportDestination(repoRoot, parsed.reportMarkdown)
  const reportJson = parsed.reportJson === undefined
    ? undefined
    : resolveReportDestination(repoRoot, parsed.reportJson)
  const requestedDestinations = [reportMarkdown, reportJson].filter((value) => value !== undefined)
  await preflightReportDestinations(repoRoot, requestedDestinations)

  const moodistConcepts = options.moodistConcepts ?? await readCatalogJson(
    resolve(repoRoot, "data/atmoshaper/moodist-concepts.json"),
    "Moodist inventory",
  )
  const signatureDeclaration = options.signatureDeclaration ?? await readCatalogJson(
    resolve(repoRoot, "data/atmoshaper/signature-sound-candidates.json"),
    "Signature declaration",
  )
  const audit = await createSignatureSoundAudit({
    rootPath: parsed.rootPath,
    moodistConcepts,
    signatureDeclaration,
  })
  const markdown = renderSignatureSoundAuditMarkdown(audit)
  const json = renderSignatureSoundAuditJson(audit)

  const reports = []
  if (reportMarkdown !== undefined) reports.push({ destination: reportMarkdown, contents: markdown })
  if (reportJson !== undefined) reports.push({ destination: reportJson, contents: json })
  await publishReportsAtomically(repoRoot, reports, options.reportFileRename ?? rename)
  const writeStdout = options.stdout ?? ((value) => process.stdout.write(value))
  writeStdout(parsed.format === "json" ? json : markdown)
  return 0
}

/** @param {string[]} args */
function parseArguments(args) {
  let rootPath
  let format = "markdown"
  let reportMarkdown
  let reportJson

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--format") {
      const value = args[index + 1]
      if (value !== "markdown" && value !== "json") {
        throw new Error("--format must be markdown or json")
      }
      format = value
      index += 1
      continue
    }
    if (argument === "--report-markdown" || argument === "--report-json") {
      const value = args[index + 1]
      if (typeof value !== "string" || value.trim() === "" || value.startsWith("--")) {
        throw new Error(`${argument} requires a destination`)
      }
      if (argument === "--report-markdown") reportMarkdown = value
      else reportJson = value
      index += 1
      continue
    }
    if (argument.startsWith("--")) throw new Error(`Unknown audit option: ${argument}`)
    if (rootPath !== undefined) throw new Error("The audit accepts exactly one scan root")
    rootPath = argument
  }

  if (rootPath === undefined || rootPath.trim() === "") {
    throw new Error("Usage: npm run atmoshaper:sounds:audit -- \"<root>\" [--format json] [--report-markdown <destination>] [--report-json <destination>]")
  }
  return { rootPath, format, reportMarkdown, reportJson }
}

/** Resolves the repository's canonical filesystem identity before containment checks. @param {string} repoRoot */
async function canonicalizeRepositoryRoot(repoRoot) {
  try {
    return await realpath(resolve(repoRoot))
  } catch {
    throw new Error("The current repository or worktree could not be resolved")
  }
}

/**
 * Confines an explicit report target lexically and through the nearest existing
 * filesystem ancestor, preventing an in-repo link from escaping the worktree.
 * @param {string} repoRoot @param {string} destination
 */
function resolveReportDestination(repoRoot, destination) {
  const resolvedDestination = resolve(repoRoot, destination)
  assertInsideRepository(repoRoot, resolvedDestination)
  return resolvedDestination
}

/**
 * Publishes complete sibling temp files as one rollback-capable transaction.
 * Existing finals move to same-directory backups before the host-atomic rename.
 * @param {string} repoRoot
 * @param {{ destination: string, contents: string }[]} reports
 * @param {(source: string, destination: string) => Promise<void>} renameFile
 */
async function publishReportsAtomically(repoRoot, reports, renameFile) {
  if (reports.length === 0) return
  await preflightReportDestinations(repoRoot, reports.map(({ destination }) => destination))
  const parents = [...new Set(reports.map(({ destination }) => dirname(destination)))]
  const states = reports.map((report) => ({
    ...report,
    temporaryPath: undefined,
    backupPath: undefined,
    published: false,
  }))
  let publicationComplete = false

  try {
    for (const parent of parents) await mkdir(parent, { recursive: true })
    await preflightReportDestinations(repoRoot, reports.map(({ destination }) => destination))

    for (const state of states) {
      state.temporaryPath = uniqueSiblingPath(state.destination, "tmp")
      await writeFile(state.temporaryPath, state.contents, { encoding: "utf8", flag: "wx" })
    }

    await preflightReportDestinations(repoRoot, reports.map(({ destination }) => destination))
    for (const state of states) {
      if (await pathExists(state.destination)) {
        state.backupPath = uniqueSiblingPath(state.destination, "backup")
        await renameFile(state.destination, state.backupPath)
      }
      await renameFile(state.temporaryPath, state.destination)
      state.temporaryPath = undefined
      state.published = true
    }
    publicationComplete = true

    for (const state of states) {
      if (state.backupPath !== undefined) await rm(state.backupPath, { force: true })
      state.backupPath = undefined
    }
  } catch (error) {
    if (!publicationComplete) await rollbackReportPublication(states, renameFile)
    if (error instanceof Error && (
      /inside the current repository/i.test(error.message)
      || /same physical report destination/i.test(error.message)
      || /report destination must be a file/i.test(error.message)
    )) throw error
    throw new Error("Could not write the explicitly requested audit report")
  } finally {
    await cleanupTransactionArtifacts(states)
  }
}

/** @param {string} repoRoot @param {string} destination @param {{ allowRoot?: boolean }} [options] */
function assertInsideRepository(repoRoot, destination, options = {}) {
  const repoRelative = relative(repoRoot, destination)
  if ((!options.allowRoot && repoRelative === "") || repoRelative.startsWith("..") || isAbsolute(repoRelative)) {
    throw new Error("Report destinations must be inside the current repository or worktree")
  }
}

/**
 * Resolves canonical physical identities before any report write. Unresolved
 * suffixes are retained, with Windows identities case-folded; existing files
 * additionally carry device/inode identities for hardlink detection.
 * @param {string} repoRoot @param {string[]} destinations
 */
async function preflightReportDestinations(repoRoot, destinations) {
  const identities = []
  for (const destination of destinations) {
    identities.push(await resolveReportIdentity(repoRoot, destination))
  }
  for (let left = 0; left < identities.length; left += 1) {
    for (let right = left + 1; right < identities.length; right += 1) {
      const sameCanonicalPath = identities[left].canonicalPath === identities[right].canonicalPath
      const sameExistingFile = identities[left].deviceInode !== undefined
        && identities[left].deviceInode === identities[right].deviceInode
      if (sameCanonicalPath || sameExistingFile) {
        throw new Error("Markdown and JSON reports must not use the same physical report destination")
      }
    }
  }
  return identities
}

/** @param {string} repoRoot @param {string} destination */
async function resolveReportIdentity(repoRoot, destination) {
  assertInsideRepository(repoRoot, destination)
  let currentPath = destination
  const unresolvedSegments = []
  while (true) {
    try {
      await lstat(currentPath)
      let canonicalAncestor
      try {
        canonicalAncestor = await realpath(currentPath)
      } catch {
        throw new Error("Report destinations must be inside the current repository or worktree")
      }
      const canonicalDestination = resolve(canonicalAncestor, ...unresolvedSegments)
      assertInsideRepository(repoRoot, canonicalDestination)
      let deviceInode
      if (unresolvedSegments.length === 0) {
        const destinationStats = await stat(destination)
        if (!destinationStats.isFile()) throw new Error("Report destination must be a file")
        deviceInode = `${destinationStats.dev}:${destinationStats.ino}`
      }
      return {
        canonicalPath: process.platform === "win32"
          ? canonicalDestination.toLowerCase()
          : canonicalDestination,
        deviceInode,
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error
      const parentPath = dirname(currentPath)
      if (parentPath === currentPath) {
        throw new Error("Report destinations must be inside the current repository or worktree")
      }
      unresolvedSegments.unshift(basename(currentPath))
      currentPath = parentPath
    }
  }
}

/** @param {string} destination @param {string} kind */
function uniqueSiblingPath(destination, kind) {
  return join(dirname(destination), `.${basename(destination)}.atmoshaper-audit-${kind}-${randomUUID()}`)
}

/** @param {string} path */
async function pathExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false
    throw error
  }
}

/**
 * Restores pre-transaction finals in reverse publication order.
 * @param {any[]} states
 * @param {(source: string, destination: string) => Promise<void>} renameFile
 */
async function rollbackReportPublication(states, renameFile) {
  for (const state of [...states].reverse()) {
    try {
      if (state.published) await rm(state.destination, { force: true })
      if (state.backupPath !== undefined) {
        await renameFile(state.backupPath, state.destination)
        state.backupPath = undefined
      }
      state.published = false
    } catch {
      // Keep an unrestored backup rather than deleting the only original copy.
    }
  }
}

/** Removes staged files and backups that are no longer needed. @param {any[]} states */
async function cleanupTransactionArtifacts(states) {
  for (const state of states) {
    if (state.temporaryPath !== undefined) await rm(state.temporaryPath, { force: true }).catch(() => {})
  }
}

/** @param {string} path @param {string} label */
async function readCatalogJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch {
    throw new Error(`Could not load the ${label}`)
  }
}

const launchedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath
if (launchedDirectly) {
  try {
    await runSignatureSoundAuditCli({ args: process.argv.slice(2) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature sound audit failed"
    process.stderr.write(`AtmoShaper Signature sound audit failed: ${message}\n`)
    process.exitCode = 1
  }
}
