import { chromium } from "@playwright/test"
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
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
  validateCatalogManifest,
  validateLoopSeam,
  validatePilotManifest,
  validateRenditionMetadata,
} from "./media-validation.mjs"
import {
  FULL_CATALOG_BACKGROUND_IDS,
  FULL_CATALOG_BATCHES,
  PILOT_BACKGROUND_IDS,
  PREVIEW_ASPECTS,
  PREVIEW_RENDITION_LADDER,
  getBackgroundPreviewRecipe,
} from "./preview-recipes.mjs"
import {
  buildBackgroundPosterPlan,
  buildBackgroundRenditionPlan,
  buildPilotManifestEntry,
  buildPreviewPosterRelativePath,
  getPreviewRenditionMimeType,
} from "./rendition-plan.mjs"
import {
  sanitizeGenerationError,
  updateGenerationCheckpoint,
} from "./generation-checkpoint.mjs"
import {
  renderRenditionManifestModule,
  serializeCatalogRenditionManifest,
  serializeRenditionManifest,
} from "./rendition-manifest-module.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const productionPreviewDir = path.join(repoRoot, "public/chimer/background-previews")
const pilotPreviewDir = path.join(repoRoot, "public/chimer/background-preview-pilot")
const catalogPreviewDir = path.join(repoRoot, "public/chimer/background-preview-catalog")
const sidecarModulePath = path.join(repoRoot, "components/backgrounds/backgroundPreviewRenditionManifest.ts")
const defaultPreviewId = "massage-lab-moving-gradient"

/** Prefer WinGet's full GPL build on Windows because the LGPL build lacks x264. */
function resolveMediaTool(command) {
  const configuredBin = process.env.MASSAGELAB_FFMPEG_BIN
  if (configuredBin) {
    const configuredPath = path.join(configuredBin, `${command}${process.platform === "win32" ? ".exe" : ""}`)
    if (existsSync(configuredPath)) return configuredPath
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const packageRoot = path.join(
      process.env.LOCALAPPDATA,
      "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    )
    if (existsSync(packageRoot)) {
      const versionDir = readdirSync(packageRoot, { withFileTypes: true })
        .find((entry) => entry.isDirectory() && entry.name.startsWith("ffmpeg-"))
      const executable = versionDir && path.join(packageRoot, versionDir.name, "bin", `${command}.exe`)
      if (executable && existsSync(executable)) return executable
    }
  }
  return command
}

const ffmpegCommand = resolveMediaTool("ffmpeg")
const ffprobeCommand = resolveMediaTool("ffprobe")

function parseArgs(argv) {
  const options = {
    baseUrl: "",
    batchSlug: "",
    catalogMode: false,
    force: false,
    ids: [],
    outputDir: "",
    port: 3020,
    skipServer: false,
    refreshMetadata: false,
    resume: false,
    validateOnly: false,
    writeModule: "",
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    switch (arg) {
      case "--base-url": options.baseUrl = next ?? ""; index += 1; break
      case "--batch-slug": options.batchSlug = next ?? ""; index += 1; break
      case "--catalog-mode": options.catalogMode = true; break
      case "--force": options.force = true; break
      case "--ids": options.ids = (next ?? "").split(",").map((value) => value.trim()).filter(Boolean); index += 1; break
      case "--output-dir": options.outputDir = next ? path.resolve(repoRoot, next) : ""; index += 1; break
      case "--port": options.port = Number(next); index += 1; break
      case "--skip-server": options.skipServer = true; break
      case "--refresh-metadata": options.refreshMetadata = true; break
      case "--resume": options.resume = true; break
      case "--validate-only": options.validateOnly = true; break
      case "--write-module": options.writeModule = next ? path.resolve(repoRoot, next) : ""; index += 1; break
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`)
    }
  }
  if (!options.outputDir) throw new Error("Preview output directory is required; pass --output-dir <path>.")
  const relativeToProduction = path.relative(productionPreviewDir, options.outputDir)
  if (relativeToProduction === "" || (!relativeToProduction.startsWith("..") && !path.isAbsolute(relativeToProduction))) {
    throw new Error("Refusing production preview directory public/chimer/background-previews; use the pilot directory.")
  }
  if (options.catalogMode && path.resolve(options.outputDir) !== catalogPreviewDir) {
    throw new Error("Catalog mode may target only public/chimer/background-preview-catalog.")
  }
  if (options.catalogMode && path.resolve(options.outputDir) === pilotPreviewDir) {
    throw new Error("Catalog mode refuses the approved pilot directory.")
  }
  const allowedIds = options.catalogMode ? FULL_CATALOG_BACKGROUND_IDS : PILOT_BACKGROUND_IDS
  const unknownIds = options.ids.filter((id) => !allowedIds.includes(id))
  if (unknownIds.length) throw new Error(`Unknown preview background IDs: ${unknownIds.join(", ")}`)
  options.ids = options.ids.length ? [...new Set(options.ids)] : [...allowedIds]
  if (!options.ids.length) throw new Error("At least one preview background ID is required.")
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error("Pilot port is invalid.")
  if (options.catalogMode && options.writeModule) {
    throw new Error("Catalog mode writes JSON only; --write-module is pilot-only.")
  }
  if (options.writeModule && options.writeModule !== sidecarModulePath) {
    throw new Error("--write-module may target only components/backgrounds/backgroundPreviewRenditionManifest.ts")
  }
  // Match the dev server's own origin so Next.js permits hydration resources.
  options.baseUrl ||= `http://localhost:${options.port}`
  return options
}

function ensureMediaTools({ requireEncoders = true } = {}) {
  const ffmpegArgs = requireEncoders ? ["-hide_banner", "-encoders"] : ["-version"]
  const result = spawnSync(ffmpegCommand, ffmpegArgs, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  if (result.status !== 0) {
    throw new Error(requireEncoders
      ? "FFmpeg is required to render the preview pilot."
      : "FFmpeg is required to decode and validate the preview pilot.")
  }
  if (requireEncoders) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    for (const encoder of ["libvpx-vp9", "libx264", "libwebp"]) {
      if (!new RegExp(`\\b${encoder}\\b`).test(output)) throw new Error(`FFmpeg must include ${encoder}.`)
    }
  }
  const probe = spawnSync(ffprobeCommand, ["-version"], { encoding: "utf8" })
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
  const nextCommand = path.join(repoRoot, "node_modules/next/dist/bin/next")
  const server = spawn(process.execPath, [nextCommand, "dev", "-p", String(options.port)], {
    cwd: repoRoot,
    env: { ...process.env, BROWSER: "none", NEXT_TELEMETRY_DISABLED: "1" },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  })
  server.stdout.on("data", (chunk) => process.stdout.write(`[preview-server] ${chunk}`))
  server.stderr.on("data", (chunk) => process.stderr.write(`[preview-server] ${chunk}`))
  try {
    await waitForServer(options.baseUrl)
    await disableNextDevIndicator(options.baseUrl)
  } catch (error) {
    await stopServer(server)
    throw error
  }
  return server
}

/** Stops the exact locally spawned Next process tree, including Windows children. */
async function stopServer(server) {
  if (!server?.pid) return
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    return
  }
  server.kill("SIGTERM")
}

function attachCaptureDiagnostics(page, backgroundId, aspect) {
  page.on("pageerror", (error) => console.error(`[capture:${backgroundId}:${aspect}] ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`[capture:${backgroundId}:${aspect}] ${message.text()}`)
  })
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
  const result = spawnSync(ffprobeCommand, [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", filePath,
  ], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${filePath}: ${result.stderr?.trim() || "FFprobe failed"}`)
  return parseMediaProbe(result, filePath)
}

function rawCaptureDurationMs(filePath) {
  return probeMedia(filePath).durationMs
}

function decodeRgbSample(filePath, timeMs) {
  const result = spawnSync(ffmpegCommand, [
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

/** Decodes independent frame evidence so generation and later validation apply identical quality gates. */
function validateDecodedRendition({ filePath, backgroundId, loopStrategy, durationMs, fps }) {
  const frameStep = Math.max(100, Math.ceil(1000 / fps) * 2)
  const sampleTimes = [0, 0.25, 0.5, 0.75, 1].map((portion) =>
    Math.min(durationMs - frameStep, Math.round((durationMs - frameStep) * portion)))
  const samples = sampleTimes.map((timeMs) => decodeRgbSample(filePath, timeMs))
  const frameHashes = samples.map((sample) => createHash("sha256").update(sample).digest("hex"))
  const seamDifference = normalizedPixelDifference(samples[0], samples.at(-1))
  return {
    errors: [
      ...validateAnimatedFrameVariation({ backgroundId, motionIntensity: "medium", frameHashes }),
      ...validateLoopSeam({ strategy: loopStrategy, normalizedDifference: seamDifference }),
    ],
    frameHashes,
    frameVariation: calculateFrameVariation(frameHashes),
    seamDifference,
  }
}

async function writeFrameStrip(filePath, outputPath, durationMs) {
  const interval = (durationMs / 5000).toFixed(6)
  await runProcess(ffmpegCommand, [
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
  attachCaptureDiagnostics(page, recipe.backgroundId, aspect)
  try {
    const previewUrl = new URL(`/chimer/background-preview/${recipe.backgroundId}`, options.baseUrl)
    await page.goto(previewUrl.href, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await page.waitForSelector(
      `[data-testid="chimer-preview-background"][data-background-id="${recipe.backgroundId}"]`,
      { timeout: 45_000 },
    )
    await page.waitForSelector('[data-preview-ready="true"]', { timeout: 15_000 })
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
    await runProcess(ffmpegCommand, [
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

/** Captures a truthful static poster without fabricating a video timeline. */
async function captureStaticPoster(browser, recipe, aspect, options) {
  const dimensions = PREVIEW_RENDITION_LADDER[aspect].high
  const plan = buildBackgroundPosterPlan(recipe).find((item) => item.aspect === aspect)
  const posterPath = path.join(options.outputDir, plan.relativePath)
  mkdirSync(path.dirname(posterPath), { recursive: true })
  if (existsSync(posterPath) && statSync(posterPath).size > 0 && !options.force) return posterPath
  const pngPath = `${posterPath}.${process.pid}.png`
  const context = await browser.newContext({
    colorScheme: "dark",
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    viewport: dimensions,
  })
  const page = await context.newPage()
  attachCaptureDiagnostics(page, recipe.backgroundId, aspect)
  try {
    const previewUrl = new URL(`/chimer/background-preview/${recipe.backgroundId}`, options.baseUrl)
    await page.goto(previewUrl.href, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await page.waitForSelector(
      `[data-testid="chimer-preview-background"][data-background-id="${recipe.backgroundId}"]`,
      { timeout: 45_000 },
    )
    await page.waitForSelector('[data-preview-ready="true"]', { timeout: 15_000 })
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
    await page.waitForTimeout(recipe.warmupMs)
    await page.screenshot({ path: pngPath, type: "png" })
    await runProcess(ffmpegCommand, [
      "-y", "-v", "error", "-i", pngPath,
      "-frames:v", "1", "-c:v", "libwebp", "-quality", "84", posterPath,
    ])
    return posterPath
  } finally {
    await context.close().catch(() => undefined)
    rmSync(pngPath, { force: true })
  }
}

async function encodeAndValidateRendition(item, recipe, masterPath, options) {
  const outputPath = path.join(options.outputDir, item.relativePath)
  mkdirSync(path.dirname(outputPath), { recursive: true })
  if (options.force || !existsSync(outputPath) || statSync(outputPath).size <= 0) {
    await runProcess(ffmpegCommand, buildRenditionEncodeArgs({
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
  const decoded = validateDecodedRendition({
    filePath: outputPath,
    backgroundId: recipe.backgroundId,
    loopStrategy: recipe.loopStrategy,
    durationMs: expectedDurationMs,
    fps: item.fps,
  })
  const errors = [...metadataErrors, ...decoded.errors]
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
      frameHashes: decoded.frameHashes,
      frameVariation: decoded.frameVariation,
      frameStripUrl: path.relative(options.outputDir, frameStripPath).replaceAll("\\", "/"),
      seamDifference: decoded.seamDifference,
    },
  }
}

async function renderAspect(browser, recipe, aspect, options, tempVideoDir) {
  if (recipe.mediaKind === "poster-only") {
    const posterPath = await captureStaticPoster(browser, recipe, aspect, options)
    const high = PREVIEW_RENDITION_LADDER[aspect].high
    const posterRelativePath = buildPreviewPosterRelativePath({ ...recipe, aspect })
    const poster = {
      url: posterRelativePath,
      width: high.width,
      height: high.height,
      bytes: statSync(posterPath).size,
      sha256: sha256File(posterPath),
    }
    writeFileSync(path.join(path.dirname(posterPath), "validation.json"), `${JSON.stringify({
      backgroundId: recipe.backgroundId,
      aspect,
      mediaKind: "poster-only",
      recipeRevision: recipe.recipeRevision,
      poster,
    }, null, 2)}\n`)
    return { renditions: [], poster }
  }
  const masterPath = await captureMaster(browser, recipe, aspect, options, tempVideoDir)
  const high = PREVIEW_RENDITION_LADDER[aspect].high
  const posterRelativePath = buildPreviewPosterRelativePath({ ...recipe, aspect })
  const posterPath = path.join(options.outputDir, posterRelativePath)
  if (options.force || !existsSync(posterPath) || statSync(posterPath).size <= 0) {
    await runProcess(ffmpegCommand, buildPosterArgs({
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
    renditions: renditions.map(({ quality, codec, evidence: itemEvidence }) => ({ quality, codec, ...itemEvidence })),
  }
  writeFileSync(path.join(path.dirname(posterPath), "validation.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  return { renditions, poster }
}

function catalogBatchSlug(backgroundId) {
  return FULL_CATALOG_BATCHES.find(({ ids }) => ids.includes(backgroundId))?.slug ?? "unknown"
}

/** Builds the mixed schema-v3 entry used only by the local full catalog. */
function buildCatalogManifestEntry({ recipe, renditions, posters }) {
  if (recipe.mediaKind === "animated") {
    return {
      ...buildPilotManifestEntry({ recipe, renditions, posters }),
      mediaKind: "animated",
      reviewStatus: recipe.reviewStatus,
      batchSlug: catalogBatchSlug(recipe.backgroundId),
    }
  }
  if (!PREVIEW_ASPECTS.every((aspect) => posters?.[aspect]) || renditions.length !== 0) {
    throw new Error(`${recipe.backgroundId}: poster-only manifest requires three posters and no videos`)
  }
  return {
    backgroundId: recipe.backgroundId,
    recipeRevision: recipe.recipeRevision,
    mediaKind: "poster-only",
    reviewStatus: recipe.reviewStatus,
    batchSlug: catalogBatchSlug(recipe.backgroundId),
    loopStrategy: "static",
    loopBoundaryMs: 0,
    renditions: [],
    posters,
  }
}

function readManifest(outputDir, catalogMode = false) {
  const manifestPath = path.join(outputDir, "index.json")
  if (!existsSync(manifestPath)) return { schemaVersion: catalogMode ? 3 : 2, entries: [] }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  const expectedSchema = catalogMode ? 3 : 2
  if (manifest?.schemaVersion !== expectedSchema || !Array.isArray(manifest.entries)) {
    throw new Error(`Preview index.json is not a v${expectedSchema} manifest.`)
  }
  return manifest
}

function writeManifest(options, entries) {
  const errors = options.catalogMode ? validateCatalogManifest(entries) : validatePilotManifest(entries)
  if (errors.length) throw new Error(errors.join("\n"))
  writeFileSync(path.join(options.outputDir, "index.json"), options.catalogMode
    ? serializeCatalogRenditionManifest(entries)
    : serializeRenditionManifest(entries))
  if (options.writeModule) writeFileSync(options.writeModule, renderRenditionManifestModule(entries))
  return readManifest(options.outputDir, options.catalogMode)
}

/**
 * Rebuilds derived metadata from the canonical recipe catalog without
 * recapturing or re-encoding any approved media.
 */
function refreshManifestMetadata(entries, { catalogMode }) {
  return entries.map((entry) => ({
    ...entry,
    ...(catalogMode ? { reviewStatus: getBackgroundPreviewRecipe(entry.backgroundId).reviewStatus } : {}),
    renditions: entry.renditions.map((rendition) => ({
      ...rendition,
      mimeType: getPreviewRenditionMimeType(rendition.codec, rendition.quality),
    })),
  }))
}

function validateExistingOutput(options) {
  const manifest = readManifest(options.outputDir, options.catalogMode)
  const errors = options.catalogMode ? validateCatalogManifest(manifest.entries) : validatePilotManifest(manifest.entries)
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
        const metadataErrors = validateRenditionMetadata(actual, {
          codec: media.codec === "h264" ? "h264" : "vp9",
          pixelFormat: "yuv420p",
          width: media.width,
          height: media.height,
          fps: media.fps,
          durationMs: media.durationMs,
          streamCount: 1,
        })
        errors.push(...metadataErrors)
        if (metadataErrors.length === 0) {
          errors.push(...validateDecodedRendition({
            filePath,
            backgroundId: entry.backgroundId,
            loopStrategy: entry.loopStrategy,
            durationMs: media.durationMs,
            fps: media.fps,
          }).errors)
        }
      }
    }
  }
  if (options.catalogMode && options.validateOnly) {
    const renditionCount = manifest.entries.reduce((sum, entry) => sum + entry.renditions.length, 0)
    const posterCount = manifest.entries.reduce((sum, entry) => sum + Object.keys(entry.posters).length, 0)
    if (manifest.entries.length !== 84) errors.push(`catalog: expected 84 entries, received ${manifest.entries.length}`)
    if (renditionCount !== 1476) errors.push(`catalog: expected 1476 videos, received ${renditionCount}`)
    if (posterCount !== 252) errors.push(`catalog: expected 252 posters, received ${posterCount}`)
  }
  if (errors.length) throw new Error(errors.join("\n"))
  writeFileSync(path.join(options.outputDir, "validation.json"), `${JSON.stringify({ valid: true, entries: manifest.entries.length }, null, 2)}\n`)
  return manifest
}

/** Resume only trusts a complete manifest entry whose immutable files still match. */
function canResumeEntry(entry, options) {
  const diagnostics = options.catalogMode ? validateCatalogManifest([entry]) : validatePilotManifest([entry])
  if (diagnostics.length) return false
  return [...entry.renditions, ...Object.values(entry.posters)].every((media) => {
    const filePath = path.join(options.outputDir, media.url)
    return existsSync(filePath)
      && statSync(filePath).size === media.bytes
      && sha256File(filePath) === media.sha256
  })
}

/**
 * Removes only the current immutable recipe revision before rebuilding an
 * incomplete catalog entry. A manifest entry is the trust boundary for resume;
 * leftover encoder files from an interrupted process must never be reused.
 */
function resetIncompleteCatalogRecipe(recipe, options) {
  if (!options.catalogMode || !options.resume) return
  const recipeOutputDir = path.join(options.outputDir, recipe.backgroundId, recipe.recipeRevision)
  const relative = path.relative(options.outputDir, recipeOutputDir)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to reset unsafe recipe output: ${recipeOutputDir}`)
  }
  rmSync(recipeOutputDir, { recursive: true, force: true })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  // Metadata refreshes and validation decode existing files but never encode.
  ensureMediaTools({ requireEncoders: !options.validateOnly && !options.refreshMetadata })
  mkdirSync(options.outputDir, { recursive: true })
  if (options.refreshMetadata) {
    const current = readManifest(options.outputDir, options.catalogMode)
    const refreshed = writeManifest(options, refreshManifestMetadata(current.entries, options))
    validateExistingOutput(options)
    console.log(`Refreshed and validated metadata for ${refreshed.entries.length} complete ${options.catalogMode ? "catalog" : "pilot"} entries.`)
    return
  }
  if (options.validateOnly) {
    const manifest = validateExistingOutput(options)
    if (options.writeModule) writeManifest(options, manifest.entries)
    console.log(`Validated ${manifest.entries.length} complete ${options.catalogMode ? "catalog" : "pilot"} entries.`)
    return
  }
  const server = await startServer(options)
  const browser = await chromium.launch({ headless: true })
  const tempVideoDir = await mkdtemp(path.join(tmpdir(), "massagelab-preview-pilot-"))
  try {
    const existing = readManifest(options.outputDir, options.catalogMode)
    const entriesById = new Map(existing.entries.map((entry) => [entry.backgroundId, entry]))
    for (const id of options.ids) {
      const recipe = getBackgroundPreviewRecipe(id)
      const currentEntry = entriesById.get(id)
      if (options.resume && currentEntry && canResumeEntry(currentEntry, options)) {
        console.log(`Resuming past validated ${id}.`)
        continue
      }
      resetIncompleteCatalogRecipe(recipe, options)
      const renditions = []
      const posters = {}
      for (const aspect of PREVIEW_ASPECTS) {
        console.log(`Rendering ${id} ${aspect}...`)
        try {
          const result = await renderAspect(browser, recipe, aspect, options, tempVideoDir)
          renditions.push(...result.renditions)
          posters[aspect] = result.poster
          if (options.catalogMode) {
            updateGenerationCheckpoint(options.outputDir, id, aspect, {
              status: "complete",
              mediaKind: recipe.mediaKind,
              recipeRevision: recipe.recipeRevision,
              renditionCount: result.renditions.length,
              poster: result.poster,
            })
          }
        } catch (error) {
          if (options.catalogMode) {
            updateGenerationCheckpoint(options.outputDir, id, aspect, {
              status: "failed",
              diagnostic: sanitizeGenerationError(error),
            })
          }
          throw error
        }
      }
      entriesById.set(id, options.catalogMode
        ? buildCatalogManifestEntry({ recipe, renditions, posters })
        : buildPilotManifestEntry({ recipe, renditions, posters }))
      writeManifest(options, [...entriesById.values()])
    }
    const manifest = validateExistingOutput(options)
    console.log(`Rendered and validated ${manifest.entries.length} complete ${options.catalogMode ? "catalog" : "pilot"} entries.`)
  } finally {
    await browser.close().catch(() => undefined)
    await stopServer(server)
    await rm(tempVideoDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
