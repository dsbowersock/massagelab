#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import {
  createObservableStreamsVscoAssetPlan,
  OBSERVABLE_STREAMS_VSCO_ADAPTATION,
} from "../lib/atmosphere/sample-intake.js"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const audioRoot = args.find((arg) => arg !== "--dry-run") ?? process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT
const publicRoot = path.resolve("public")
const outputRoot = path.join(publicRoot, "audio", "atmosphere", OBSERVABLE_STREAMS_VSCO_ADAPTATION.id)
const outputSampleRoot = path.join(outputRoot, "samples")

if (!audioRoot) {
  console.error("Usage: npm run atmosphere:samples:stage -- <audio-sample-root> [--dry-run]")
  process.exitCode = 1
} else {
  const resolvedAudioRoot = path.resolve(audioRoot)
  const files = await collectFiles(resolvedAudioRoot)
  const mappingChartText = await fs.readFile(
    path.join(resolvedAudioRoot, "VSCO-2-CE-1.1.0", "VSCO-2-CE-1.1.0", "Keys", "Upright Piano", "MappingChart.txt"),
    "utf8",
  )
  const plan = createObservableStreamsVscoAssetPlan({
    rootPath: resolvedAudioRoot,
    files,
    vscoPianoMappingChartText: mappingChartText,
  })

  if (plan.missingNotes.length > 0) {
    console.error("Missing curated Observable Streams source notes:")
    for (const missing of plan.missingNotes) {
      console.error(`- ${missing.instrumentName} ${missing.noteName} dynamic ${missing.dynamicLayer}`)
    }
    process.exitCode = 1
  } else if (dryRun) {
    printPlan(plan)
  } else {
    await stageAssets({ resolvedAudioRoot, plan })
    printPlan(plan)
  }
}

/**
 * @param {{ resolvedAudioRoot: string, plan: ReturnType<typeof createObservableStreamsVscoAssetPlan> }} params
 */
async function stageAssets({ resolvedAudioRoot, plan }) {
  await fs.mkdir(outputSampleRoot, { recursive: true })

  for (const asset of plan.selectedAssets) {
    await fs.copyFile(
      path.join(resolvedAudioRoot, asset.sourceRelativePath),
      path.join(outputSampleRoot, asset.outputFileName),
    )
  }

  await fs.writeFile(
    path.join(outputRoot, "sample-index.json"),
    `${JSON.stringify(plan.sampleIndex, null, 2)}\n`,
    "utf8",
  )
  await fs.writeFile(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify({
      adaptationId: plan.adaptationId,
      sampleIndexPath: plan.publicSampleIndexPath,
      selectedAssets: plan.selectedAssets.map((asset) => ({
        instrumentName: asset.instrumentName,
        noteName: asset.noteName,
        dynamicLayer: asset.dynamicLayer,
        sourceRelativePath: asset.sourceRelativePath,
        publicUrl: asset.publicUrl,
        sizeBytes: asset.sizeBytes,
      })),
      excludedSources: plan.excludedSources,
    }, null, 2)}\n`,
    "utf8",
  )
}

/**
 * @param {ReturnType<typeof createObservableStreamsVscoAssetPlan>} plan
 */
function printPlan(plan) {
  const totalBytes = plan.selectedAssets.reduce((total, asset) => total + (asset.sizeBytes ?? 0), 0)
  console.log(`Observable Streams VSCO adaptation: ${plan.selectedAssets.length} files`)
  console.log(`Approximate WAV payload: ${formatBytes(totalBytes)}`)
  console.log(`Sample index: ${plan.publicSampleIndexPath}`)
  for (const asset of plan.selectedAssets) {
    console.log(`- ${asset.instrumentName} ${asset.noteName}: ${asset.sourceRelativePath} -> ${asset.publicUrl}`)
  }
}

/**
 * @param {number} bytes
 */
function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
      relativePath: path.relative(rootPath, absolutePath).replace(/\\/g, "/"),
      sizeBytes: stats.size,
    })
  }
}
