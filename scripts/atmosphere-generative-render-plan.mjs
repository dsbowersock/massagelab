#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import {
  createGenerativeFmRenderPlan,
  formatGenerativeFmRenderPlanReport,
} from "../lib/atmosphere/generative-fm-render-plan.js"

const args = process.argv.slice(2)
const options = parseArgs(args)

try {
  if (!options.audioRoot) {
    printUsage()
    process.exitCode = 1
  } else {
    const resolvedRoot = path.resolve(options.audioRoot)
    const files = await collectFiles(resolvedRoot)
    const licenseTextByPath = await readLicenseEvidenceTextByPath(resolvedRoot, files)
    const plan = createGenerativeFmRenderPlan({
      rootPath: resolvedRoot,
      files,
      licenseTextByPath,
      pieceIds: options.pieceIds,
    })

    if (options.json) {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
    } else {
      process.stdout.write(formatGenerativeFmRenderPlanReport(plan))
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

/**
 * @param {string[]} rawArgs
 */
function parseArgs(rawArgs) {
  const options = {
    audioRoot: process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT,
    json: false,
    pieceIds: [],
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]

    if (arg === "--json") {
      options.json = true
      continue
    }

    if (arg === "--piece") {
      index += 1
      const pieceId = rawArgs[index]
      if (!pieceId) throw new Error("--piece requires a Generative.fm piece id.")
      options.pieceIds.push(pieceId)
      continue
    }

    if (arg.startsWith("--piece=")) {
      options.pieceIds.push(arg.slice("--piece=".length))
      continue
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (!options.audioRoot || options.audioRoot === process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT) {
      options.audioRoot = arg
      continue
    }

    throw new Error(`Unexpected positional argument: ${arg}`)
  }

  return options
}

/**
 * @param {string} rootPath
 * @returns {Promise<Array<{ relativePath: string, sizeBytes: number }>>}
 */
async function collectFiles(rootPath) {
  const files = []
  await walkDirectory(rootPath, rootPath, files)
  return files
}

/**
 * @param {string} rootPath
 * @param {string} currentPath
 * @param {Array<{ relativePath: string, sizeBytes: number }>} files
 */
async function walkDirectory(rootPath, currentPath, files) {
  const directoryEntries = await fs.readdir(currentPath, { withFileTypes: true })

  for (const entry of directoryEntries) {
    const absolutePath = path.join(currentPath, entry.name)

    if (entry.isDirectory()) {
      await walkDirectory(rootPath, absolutePath, files)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const stats = await fs.stat(absolutePath)
    files.push({
      relativePath: normalizePortablePath(path.relative(rootPath, absolutePath)),
      sizeBytes: stats.size,
    })
  }
}

/**
 * Reads only small license/readme evidence files used by the coverage helper.
 * Raw license text is passed to in-memory validation and is not printed.
 *
 * @param {string} rootPath
 * @param {Array<{ relativePath: string }>} files
 */
async function readLicenseEvidenceTextByPath(rootPath, files) {
  const licenseTextByPath = {}
  const evidenceFiles = files.filter((file) => {
    const normalized = file.relativePath.toLowerCase()
    const fileName = path.basename(normalized)
    return normalized.endsWith("/license") ||
      normalized.endsWith("/readme.md") ||
      (fileName.startsWith("license") && fileName.endsWith(".txt")) ||
      (fileName.startsWith("readme") && fileName.endsWith(".txt"))
  })

  for (const file of evidenceFiles) {
    try {
      licenseTextByPath[file.relativePath] = await fs.readFile(path.join(rootPath, file.relativePath), "utf8")
    } catch {
      // Coverage status reports absent or unreadable evidence.
    }
  }

  return licenseTextByPath
}

/**
 * @param {string} filePath
 */
function normalizePortablePath(filePath) {
  return filePath.replace(/\\/g, "/")
}

function printUsage() {
  console.error("Usage:")
  console.error("  npm run atmosphere:samples:render-plan -- <audio-sample-root> [--json] [--piece <piece-id>]")
}
