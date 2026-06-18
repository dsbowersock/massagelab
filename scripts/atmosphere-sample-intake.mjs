#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import {
  createObservableStreamsSampleIntake,
  formatObservableStreamsSampleIntakeReport,
} from "../lib/atmosphere/sample-intake.js"

const audioRoot = process.argv[2] ?? process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT

if (!audioRoot) {
  console.error("Usage: npm run atmosphere:samples:scan -- <audio-sample-root>")
  process.exitCode = 1
} else {
  const resolvedRoot = path.resolve(audioRoot)
  const files = await collectFiles(resolvedRoot)
  const preliminarySummary = createObservableStreamsSampleIntake({
    rootPath: resolvedRoot,
    files,
  })
  const pianoRequirement = preliminarySummary.requirements.find(
    (requirement) => requirement.sourceName === "vsco2-piano-mf",
  )
  const vscoPianoMappingChartText = await readOptionalTextFile(resolvedRoot, pianoRequirement?.mappingChartPath)
  const summary = createObservableStreamsSampleIntake({
    rootPath: resolvedRoot,
    files,
    vscoPianoMappingChartText,
  })

  process.stdout.write(formatObservableStreamsSampleIntakeReport(summary))
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
 * @param {string} rootPath
 * @param {string | null | undefined} relativePath
 */
async function readOptionalTextFile(rootPath, relativePath) {
  if (!relativePath) {
    return ""
  }

  try {
    return await fs.readFile(path.join(rootPath, relativePath), "utf8")
  } catch {
    return ""
  }
}

/**
 * @param {string} filePath
 */
function normalizePortablePath(filePath) {
  return filePath.replace(/\\/g, "/")
}
