import { chromium } from "@playwright/test"
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { buildPosterArgs, buildRenditionEncodeArgs } from "./ffmpeg-plan.mjs"
import {
  calculateFrameVariation,
  parseMediaProbe,
  validateAnimatedFrameVariation,
  validateLoopSeam,
  validatePilotManifest,
  validateRenditionMetadata,
} from "./media-validation.mjs"
import {
  PILOT_BACKGROUND_IDS,
  PREVIEW_ASPECTS,
  PREVIEW_RENDITION_LADDER,
  getBackgroundPreviewRecipe,
} from "./preview-recipes.mjs"
import {
  buildBackgroundRenditionPlan,
  buildPilotManifestEntry,
  buildPreviewPosterRelativePath,
} from "./rendition-plan.mjs"
import {
  renderRenditionManifestModule,
  serializeRenditionManifest,
} from "./rendition-manifest-module.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const productionPreviewDir = path.join(repoRoot, "public/chimer/background-previews")
const sidecarModulePath = path.join(repoRoot, "components/backgrounds/backgroundPreviewRenditionManifest.ts")
const defaultPreviewId = "massage-lab-moving-gradient"

function parseArgs(argv) {
  const options = {
    baseUrl: "",
    force: false,
    ids: [],
    outputDir: "",
    port: 3020,
    skipServer: false,
    validateOnly: false,
    writeModule: "",
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    switch (arg) {
      case "--base-url": options.baseUrl = next ?? ""; index += 1; break
      case "--force": options.force = true; break
      case "--ids": options.ids = (next ?? "").split(",").map((value) => value.trim()).filter(Boolean); index += 1; break
      case "--output-dir": options.outputDir = next ? path.resolve(repoRoot, next) : ""; index += 1; break
      case "--port": options.port = Number(next); index += 1; break
      case "--skip-server": options.skipServer = true; break
      case "--validate-only": options.validateOnly = true; break
      case "--write-module": options.writeModule = next ? path.resolve(repoRoot, next) : ""; index += 1; break
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`)
    }
  }
  if (!options.outputDir) throw new Error("Pilot output directory is required; pass --output-dir <path>.")
  const relativeToProduction = path.relative(productionPreviewDir, options.outputDir)
  if (relativeToProduction === "" || (!relativeToProduction.startsWith("..") && !path.isAbsolute(relativeToProduction))) {
    throw new Error("Refusing production preview directory public/chimer/background-previews; use the pilot directory.")
  }
  const unknownIds = options.ids.filter((id) => !PILOT_BACKGROUND_IDS.includes(id))
  if (unknownIds.length) throw new Error(`Unknown pilot background IDs: ${unknownIds.join(", ")}`)
  options.ids = options.ids.length ? [...new Set(options.ids)] : [...PILOT_BACKGROUND_IDS]
  if (!options.ids.length) throw new Error("At least one pilot background ID is required.")
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error("Pilot port is invalid.")
  if (options.writeModule && options.writeModule !== sidecarModulePath) {
    throw new Error("--write-module may target only components/backgrounds/backgroundPreviewRenditionManifest.ts")
  }
  options.baseUrl ||= `http://127.0.0.1:${options.port}`
  return options
}

function ensureFfmpeg() {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  if (result.status !== 0) throw new Error("FFmpeg is required to render the preview pilot.")
  for (const encoder of ["libvpx-vp9", "libx264", "libwebp"]) {
    if (!new RegExp(`\\b${encoder}\\b`).test(output)) throw new Error(`FFmpeg must include ${encoder}.`)
  }
  const probe = spawnSync("ffprobe", ["-version"], { encoding: "utf8" })
  if (probe.status !== 0) throw new Error("FFprobe is required to validate the preview pilot.")
}

async function waitForServer(baseUrl, timeoutMs = 120_000) {
  const startedAt = Date.now()
  const url = new URL(`/chimer/background-preview/${defaultPreviewId}`, baseUrl)
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) })
      if (response.ok) return
    } catch {
      // The bounded outer loop owns startup retry behavior.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Timed out waiting for preview server at ${baseUrl}`)
}

async function disableNextDevIndicator(baseUrl) {
  try {
    await fetch(new URL("/__nextjs_disable_dev_indicator", baseUrl), {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Production-style servers do not expose this development-only endpoint.
  }
}

async function startServer(options) {
  if (options.skipServer) {
    await waitForServer(options.baseUrl, 20_000)
    await disableNextDevIndicator(options.baseUrl)
    return null
  }
  try {
    await waitForServer(options.baseUrl, 2500)
    await disableNextDevIndicator(options.baseUrl)
    console.log(`Using existing preview server at ${options.baseUrl}`)
    return null
  } catch {
    // Start one isolated Next development server below.
  }
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
  const server = spawn(npmCommand, ["run", "dev", "--", "-p", String(options.port)], {
    cwd: repoRoot,
    env: { ...process.env, BROWSER: "none", NEXT_TELEMETRY_DISABLED: "1" },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  })
  server.stdout.on("data", (chunk) => process.stdout.write(`[preview-server] ${chunk}`))
  server.stderr.on("data", (chunk) => process.stderr.write(`[preview-server] ${chunk}`))
  try {
    await waitForServer(options.baseUrl)
    await disableNextDevIndicator(options.baseUrl)
  } catch (error) {
    server.kill()
    throw error
  }
  return server
}

function runProcess(command, args, { captureStdout = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", captureStdout ? "pipe" : "ignore", "pipe"] })
    const stdout = []
    const stderr = []
    child.stdout?.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.on("error", reject)
    child.on("close", (code) => code === 0
      ? resolve(Buffer.concat(stdout))
      : reject(new Error(`${command} failed (${code}): ${Buffer.concat(stderr).toString("utf8").trim()}`)))
  })
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

function probeMedia(filePath) {
  const result = spawnSync("ffprobe", [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", filePath,
  ], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${filePath}: ${result.stderr?.trim() || "FFprobe failed"}`)
  return parseMediaProbe(result, filePath)
}

function rawCaptureDurationMs(filePath) {
  return probeMedia(filePath).durationMs
}

function decodeRgbSample(filePath, timeMs) {
  const result = spawnSync("ffmpeg", [
    "-v", "error", "-ss", (timeMs / 1000).toFixed(3), "-i", filePath,
    "-frames:v", "1", "-vf", "scale=64:64:flags=area,format=rgb24",
    "-f", "rawvideo", "pipe:1",
  ], { encoding: null, maxBuffer: 1024 * 1024 })
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length !== 64 * 64 * 3) {
    throw new Error(`${filePath}: unable to decode RGB evidence at ${timeMs}ms`)
  }
  return result.stdout
}

function normalizedPixelDifference(left, right) {
  if (left.length !== right.length || left.length === 0) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let index = 0; index < left.length; index += 1) sum += Math.abs(left[index] - right[index])
  return sum / (left.length * 255)
}

async function writeFrameStrip(filePath, outputPath, durationMs) {
  const interval = (durationMs / 5000).toFixed(6)
  await runProcess("ffmpeg", [
    "-y", "-v", "error", "-i", filePath,
    "-vf", `fps=1/${interval},scale=160:-1:flags=lanczos,tile=5x1`,
    "-frames:v", "1", outputPath,
  ])
}

async function captureMaster(browser, recipe, aspect, options, tempVideoDir) {
  const dimensions = PREVIEW_RENDITION_LADDER[aspect].high
  const aspectDir = path.join(options.outputDir, recipe.backgroundId, recipe.recipeRevision, aspect)
  mkdirSync(aspectDir, { recursive: true })
  const masterPath = path.join(aspectDir, "high.master.webm")
  if (existsSync(masterPath) && statSync(masterPath).size > 0 && !options.force) return masterPath
  const context = await browser.newContext({
    colorScheme: "dark",
    deviceScaleFactor: 1,
    recordVideo: { dir: tempVideoDir, size: dimensions },
    reducedMotion: "no-preference",
    viewport: dimensions,
  })
  const page = await context.newPage()
  try {
    const previewUrl = new URL(`/chimer/background-preview/${recipe.backgroundId}`, options.baseUrl)
    await page.goto(previewUrl.href, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await page.waitForSelector(
      `[data-testid="chimer-preview-background"][data-background-id="${recipe.backgroundId}"]`,
      { timeout: 45_000 },
    )
    await page.waitForFunction(() => document.body.classList.contains("chimer-preview-capture"), undefined, { timeout: 10_000 })
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
    await page.waitForTimeout(recipe.warmupMs)
    const captureDurationMs = recipe.durationMs + recipe.crossfadeMs
    await page.waitForTimeout(captureDurationMs + 300)
    const video = page.video()
    await context.close()
    if (!video) throw new Error("Playwright did not produce a pilot master recording.")
    const rawPath = await video.path()
    const rawDurationMs = rawCaptureDurationMs(rawPath)
    const trimStartMs = Math.max(0, rawDurationMs - captureDurationMs - 150)
    await runProcess("ffmpeg", [
      "-y", "-ss", (trimStartMs / 1000).toFixed(3), "-i", rawPath,
      "-t", (captureDurationMs / 1000).toFixed(3), "-an",
      "-vf", `fps=${recipe.fps},scale=${dimensions.width}:${dimensions.height}:flags=lanczos,format=yuv420p`,
      "-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "1", "-crf", "12", "-b:v", "0",
      masterPath,
    ])
    return masterPath
  } catch (error) {
    await context.close().catch(() => undefined)
    throw error
  }
}

async function encodeAndValidateRendition(item, recipe, masterPath, options) {
  const outputPath = path.join(options.outputDir, item.relativePath)
  mkdirSync(path.dirname(outputPath), { recursive: true })
  if (options.force || !existsSync(outputPath) || statSync(outputPath).size <= 0) {
    await runProcess("ffmpeg", buildRenditionEncodeArgs({
      inputPath: masterPath,
      outputPath,
      codec: item.codec,
      width: item.width,
      height: item.height,
      fps: item.fps,
      durationMs: recipe.durationMs,
      loopStrategy: recipe.loopStrategy,
      crossfadeMs: recipe.crossfadeMs,
    }))
  }
  const expectedDurationMs = recipe.durationMs
  const actual = probeMedia(outputPath)
  const metadataErrors = validateRenditionMetadata(actual, {
    codec: item.codec === "h264" ? "h264" : "vp9",
    pixelFormat: "yuv420p",
    width: item.width,
    height: item.height,
    fps: item.fps,
    durationMs: expectedDurationMs,
    streamCount: 1,
  })
  const frameStep = Math.max(100, Math.ceil(1000 / item.fps) * 2)
  const sampleTimes = [0, 0.25, 0.5, 0.75, 1].map((portion) =>
    Math.min(expectedDurationMs - frameStep, Math.round((expectedDurationMs - frameStep) * portion)))
  const samples = sampleTimes.map((timeMs) => decodeRgbSample(outputPath, timeMs))
  const frameHashes = samples.map((sample) => createHash("sha256").update(sample).digest("hex"))
  const variationErrors = validateAnimatedFrameVariation({
    backgroundId: recipe.backgroundId,
    motionIntensity: "medium",
    frameHashes,
  })
  const seamDifference = normalizedPixelDifference(samples[0], samples.at(-1))
  const seamErrors = validateLoopSeam({ strategy: recipe.loopStrategy, normalizedDifference: seamDifference })
  const errors = [...metadataErrors, ...variationErrors, ...seamErrors]
  const frameStripPath = outputPath.replace(/\.(webm|mp4)$/i, ".frames.png")
  await writeFrameStrip(outputPath, frameStripPath, expectedDurationMs)
  if (errors.length) throw new Error(errors.join("\n"))
  return {
    ...item,
    url: item.relativePath.replaceAll("\\", "/"),
    durationMs: expectedDurationMs,
    bytes: statSync(outputPath).size,
    sha256: sha256File(outputPath),
    evidence: {
      frameHashes,
      frameVariation: calculateFrameVariation(frameHashes),
      frameStripUrl: path.relative(options.outputDir, frameStripPath).replaceAll("\\", "/"),
      seamDifference,
    },
  }
}

async function renderAspect(browser, recipe, aspect, options, tempVideoDir) {
  const masterPath = await captureMaster(browser, recipe, aspect, options, tempVideoDir)
  const high = PREVIEW_RENDITION_LADDER[aspect].high
  const posterRelativePath = buildPreviewPosterRelativePath({ ...recipe, aspect })
  const posterPath = path.join(options.outputDir, posterRelativePath)
  if (options.force || !existsSync(posterPath) || statSync(posterPath).size <= 0) {
    await runProcess("ffmpeg", buildPosterArgs({
      inputPath: masterPath,
      outputPath: posterPath,
      width: high.width,
      height: high.height,
      posterTimeMs: recipe.posterTimeMs,
      durationMs: recipe.durationMs,
    }))
  }
  const items = buildBackgroundRenditionPlan(recipe).filter((item) => item.aspect === aspect)
  const renditions = []
  for (const item of items) renditions.push(await encodeAndValidateRendition(item, recipe, masterPath, options))
  const poster = {
    url: posterRelativePath,
    width: high.width,
    height: high.height,
    bytes: statSync(posterPath).size,
    sha256: sha256File(posterPath),
  }
  const evidence = {
    backgroundId: recipe.backgroundId,
    aspect,
    recipeRevision: recipe.recipeRevision,
    renditions: renditions.map(({ aspect: _aspect, quality, codec, evidence: itemEvidence }) => ({ quality, codec, ...itemEvidence })),
  }
  writeFileSync(path.join(path.dirname(posterPath), "validation.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  return { renditions, poster }
}

function readManifest(outputDir) {
  const manifestPath = path.join(outputDir, "index.json")
  if (!existsSync(manifestPath)) return { schemaVersion: 2, entries: [] }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (manifest?.schemaVersion !== 2 || !Array.isArray(manifest.entries)) throw new Error("Pilot index.json is not a v2 manifest.")
  return manifest
}

function writeManifest(options, entries) {
  const errors = validatePilotManifest(entries)
  if (errors.length) throw new Error(errors.join("\n"))
  writeFileSync(path.join(options.outputDir, "index.json"), serializeRenditionManifest(entries))
  if (options.writeModule) writeFileSync(options.writeModule, renderRenditionManifestModule(entries))
  return readManifest(options.outputDir)
}

function validateExistingOutput(options) {
  const manifest = readManifest(options.outputDir)
  const errors = validatePilotManifest(manifest.entries)
  for (const entry of manifest.entries) {
    for (const media of [...entry.renditions, ...Object.values(entry.posters)]) {
      const filePath = path.join(options.outputDir, media.url)
      if (!existsSync(filePath)) {
        errors.push(`${entry.backgroundId}: missing ${media.url}`)
        continue
      }
      if (statSync(filePath).size !== media.bytes) errors.push(`${entry.backgroundId}: byte mismatch for ${media.url}`)
      if (sha256File(filePath) !== media.sha256) errors.push(`${entry.backgroundId}: hash mismatch for ${media.url}`)
      if ("codec" in media) {
        const actual = probeMedia(filePath)
        errors.push(...validateRenditionMetadata(actual, {
          codec: media.codec === "h264" ? "h264" : "vp9",
          pixelFormat: "yuv420p",
          width: media.width,
          height: media.height,
          fps: media.fps,
          durationMs: media.durationMs,
          streamCount: 1,
        }))
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
  writeFileSync(path.join(options.outputDir, "validation.json"), `${JSON.stringify({ valid: true, entries: manifest.entries.length }, null, 2)}\n`)
  return manifest
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  ensureFfmpeg()
  mkdirSync(options.outputDir, { recursive: true })
  if (options.validateOnly) {
    const manifest = validateExistingOutput(options)
    if (options.writeModule) writeManifest(options, manifest.entries)
    console.log(`Validated ${manifest.entries.length} complete pilot entries.`)
    return
  }
  const server = await startServer(options)
  const browser = await chromium.launch({ headless: true })
  const tempVideoDir = await mkdtemp(path.join(tmpdir(), "massagelab-preview-pilot-"))
  try {
    const existing = readManifest(options.outputDir)
    const entriesById = new Map(existing.entries.map((entry) => [entry.backgroundId, entry]))
    for (const id of options.ids) {
      const recipe = getBackgroundPreviewRecipe(id)
      const renditions = []
      const posters = {}
      for (const aspect of PREVIEW_ASPECTS) {
        console.log(`Rendering ${id} ${aspect}...`)
        const result = await renderAspect(browser, recipe, aspect, options, tempVideoDir)
        renditions.push(...result.renditions)
        posters[aspect] = result.poster
      }
      entriesById.set(id, buildPilotManifestEntry({ recipe, renditions, posters }))
      writeManifest(options, [...entriesById.values()])
    }
    const manifest = validateExistingOutput(options)
    console.log(`Rendered and validated ${manifest.entries.length} complete pilot entries.`)
  } finally {
    await browser.close().catch(() => undefined)
    server?.kill()
    await rm(tempVideoDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
