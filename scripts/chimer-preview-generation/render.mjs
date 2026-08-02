import { chromium } from "@playwright/test"
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getBackgroundOptionsForCategory } from "../../components/backgrounds/backgroundRegistry.ts"
import {
  LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL,
  normalizeGeneratedPreviewManifestItem,
} from "./manifest-url-normalization.mjs"
import { parseProbeDimensions, parseProbeDurationSeconds } from "./probe-result.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const defaultOutputDir = path.join(repoRoot, "public/chimer/background-previews")
const manifestModulePath = path.join(repoRoot, "components/backgrounds/backgroundPreviewManifest.ts")
const defaultPreviewId = "massage-lab-moving-gradient"

function parseArgs(argv) {
  const options = {
    baseUrl: "",
    category: "chimer",
    crf: 44,
    durationMs: 6000,
    force: false,
    fps: 12,
    height: 216,
    ids: [],
    limit: 0,
    outputDir: defaultOutputDir,
    port: 3020,
    skipServer: false,
    squareSize: 384,
    variants: ["landscape", "square", "vertical"],
    verticalHeight: 384,
    verticalWidth: 216,
    warmupMs: 1800,
    width: 384,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    switch (arg) {
      case "--base-url":
        options.baseUrl = next ?? ""
        index += 1
        break
      case "--category":
        options.category = next ?? options.category
        index += 1
        break
      case "--crf":
        options.crf = Number(next)
        index += 1
        break
      case "--duration-ms":
        options.durationMs = Number(next)
        index += 1
        break
      case "--force":
        options.force = true
        break
      case "--fps":
        options.fps = Number(next)
        index += 1
        break
      case "--height":
        options.height = Number(next)
        index += 1
        break
      case "--ids":
        options.ids = (next ?? "").split(",").map((value) => value.trim()).filter(Boolean)
        index += 1
        break
      case "--limit":
        options.limit = Number(next)
        index += 1
        break
      case "--output-dir":
        options.outputDir = path.resolve(repoRoot, next ?? options.outputDir)
        index += 1
        break
      case "--port":
        options.port = Number(next)
        index += 1
        break
      case "--skip-server":
        options.skipServer = true
        break
      case "--square-size":
        options.squareSize = Number(next)
        index += 1
        break
      case "--variants":
        options.variants = (next ?? "").split(",").map((value) => value.trim()).filter(Boolean)
        index += 1
        break
      case "--vertical-height":
        options.verticalHeight = Number(next)
        index += 1
        break
      case "--vertical-width":
        options.verticalWidth = Number(next)
        index += 1
        break
      case "--warmup-ms":
        options.warmupMs = Number(next)
        index += 1
        break
      case "--width":
        options.width = Number(next)
        index += 1
        break
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`)
        }
    }
  }

  options.baseUrl ||= `http://127.0.0.1:${options.port}`
  return options
}

function getVariantConfigs(options) {
  const variantsByName = {
    landscape: {
      key: "landscape",
      suffix: "",
      outputWidth: options.width,
      outputHeight: options.height,
      viewportWidth: 640,
      viewportHeight: 360,
    },
    square: {
      key: "square",
      suffix: "-square",
      outputWidth: options.squareSize,
      outputHeight: options.squareSize,
      viewportWidth: 512,
      viewportHeight: 512,
    },
    vertical: {
      key: "vertical",
      suffix: "-vertical",
      outputWidth: options.verticalWidth,
      outputHeight: options.verticalHeight,
      viewportWidth: 360,
      viewportHeight: 640,
    },
  }

  const variants = options.variants.map((variant) => {
    const config = variantsByName[variant]
    if (!config) {
      throw new Error(`Unknown preview variant: ${variant}`)
    }
    return config
  })

  if (!variants.length) {
    throw new Error("At least one preview variant is required.")
  }

  return variants
}

function ensureFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error("FFmpeg is required to render Chimer preview assets. Install FFmpeg or add it to PATH.")
  }
}

async function waitForServer(baseUrl, timeoutMs = 120_000) {
  const startedAt = Date.now()
  const url = new URL(`/chimer/background-preview/${defaultPreviewId}`, baseUrl)

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        // A dev server can accept the connection while its first route compile
        // stalls. Bound each probe so the outer startup timeout remains real.
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        return
      }
    } catch {
      // Keep waiting while Next starts.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`Timed out waiting for preview server at ${baseUrl}`)
}

async function disableNextDevIndicator(baseUrl) {
  try {
    await fetch(new URL("/__nextjs_disable_dev_indicator", baseUrl), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Production servers do not expose the dev indicator endpoint.
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
    // Start a local dev server below.
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
  const server = spawn(npmCommand, ["run", "dev", "--", "-p", String(options.port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BROWSER: "none",
      NEXT_TELEMETRY_DISABLED: "1",
    },
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

function pickBackgrounds(options) {
  const entries = getBackgroundOptionsForCategory(options.category)
    .filter((entry) => entry.enabled)
    .filter((entry) => !options.ids.length || options.ids.includes(entry.id))

  return options.limit > 0 ? entries.slice(0, options.limit) : entries
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] })
    const stderr = []

    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`))
    })
  })
}

async function encodeWebm(sourcePath, outputPath, options, variant) {
  const sharedArgs = [
    "-y",
    "-i", sourcePath,
    "-ss", (options.warmupMs / 1000).toFixed(3),
    "-t", (options.durationMs / 1000).toFixed(3),
    "-an",
    "-vf", `fps=${options.fps},scale=${variant.outputWidth}:${variant.outputHeight}:flags=lanczos,format=yuv420p`,
  ]

  try {
    await runProcess("ffmpeg", [
      ...sharedArgs,
      "-c:v", "libvpx-vp9",
      "-deadline", "good",
      "-cpu-used", "4",
      "-row-mt", "1",
      "-crf", String(options.crf),
      "-b:v", "0",
      outputPath,
    ])
  } catch (error) {
    console.warn(`VP9 encode failed for ${path.basename(outputPath)}; retrying with VP8. ${error.message}`)
    await runProcess("ffmpeg", [
      ...sharedArgs,
      "-c:v", "libvpx",
      "-quality", "good",
      "-cpu-used", "4",
      "-b:v", "280k",
      outputPath,
    ])
  }
}

/**
 * Reads the encoded asset duration so reused videos cannot seek past their
 * actual end. A successful probe with no usable duration may fall back to the
 * capture duration already known by this generator; process failures still
 * surface their original diagnostic.
 */
function probeVideoDurationSeconds(videoPath, fallbackDurationMs) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ], { encoding: "utf8" })
  try {
    return parseProbeDurationSeconds(result, videoPath)
  } catch (error) {
    const output = result.stdout?.trim() ?? ""
    const fallbackSeconds = Number(fallbackDurationMs) / 1000
    if (
      !result.error
      && result.status === 0
      && (!output || output === "N/A")
      && Number.isFinite(fallbackSeconds)
      && fallbackSeconds > 0
    ) {
      return fallbackSeconds
    }
    throw error
  }
}

/** Extracts a stable representative frame one-third through the encoded video. */
async function encodePoster(videoPath, posterPath, fallbackDurationMs) {
  const seekSeconds = probeVideoDurationSeconds(videoPath, fallbackDurationMs) / 3
  await runProcess("ffmpeg", [
    "-y",
    "-ss", seekSeconds.toFixed(3),
    "-i", videoPath,
    "-frames:v", "1",
    "-c:v", "libwebp",
    "-quality", "78",
    posterPath,
  ])

  if (!existsSync(posterPath) || statSync(posterPath).size <= 0) {
    throw new Error(`${path.basename(posterPath)} is empty after poster encoding.`)
  }
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

/** Verifies that a reusable video or poster is readable at the declared variant size. */
function mediaMatchesVariant(filePath, variant) {
  if (!existsSync(filePath) || statSync(filePath).size <= 0) return false
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=s=x:p=0",
    filePath,
  ], { encoding: "utf8" })
  try {
    const dimensions = parseProbeDimensions(result, filePath)
    return dimensions.width === variant.outputWidth
      && dimensions.height === variant.outputHeight
  } catch {
    return false
  }
}

/** Prevents invalid media from being published into the generated manifest. */
function assertVariantMedia(outputPath, posterPath, variant) {
  if (!mediaMatchesVariant(outputPath, variant)) {
    throw new Error(`${path.basename(outputPath)} is not valid ${variant.outputWidth}x${variant.outputHeight} video.`)
  }
  if (!mediaMatchesVariant(posterPath, variant)) {
    throw new Error(`${path.basename(posterPath)} is not valid ${variant.outputWidth}x${variant.outputHeight} poster.`)
  }
}

async function captureVariant(browser, entry, options, variant, tempVideoDir) {
  const outputPath = path.join(options.outputDir, `${entry.id}${variant.suffix}.webm`)
  const posterPath = path.join(options.outputDir, `${entry.id}${variant.suffix}.webp`)

  const videoIsUsable = mediaMatchesVariant(outputPath, variant)
  const posterIsUsable = mediaMatchesVariant(posterPath, variant)
  if (videoIsUsable && posterIsUsable && !options.force) {
    return {
      skipped: true,
      variant: buildVariantManifest(entry, outputPath, posterPath, options, variant),
    }
  }

  // A prior interrupted run may have a valid video but no poster. Complete the
  // pair without paying the browser-recording cost again unless --force is set.
  if (videoIsUsable && !options.force) {
    await encodePoster(outputPath, posterPath, options.durationMs)
    assertVariantMedia(outputPath, posterPath, variant)
    return {
      skipped: false,
      variant: buildVariantManifest(entry, outputPath, posterPath, options, variant),
    }
  }

  const context = await browser.newContext({
    colorScheme: "dark",
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tempVideoDir,
      size: {
        width: variant.viewportWidth,
        height: variant.viewportHeight,
      },
    },
    reducedMotion: "no-preference",
    viewport: {
      width: variant.viewportWidth,
      height: variant.viewportHeight,
    },
  })
  const page = await context.newPage()

  try {
    const previewUrl = new URL(`/chimer/background-preview/${entry.id}`, options.baseUrl)
    await page.goto(previewUrl.href, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await page.waitForSelector(
      `[data-testid="chimer-preview-background"][data-background-id="${entry.id}"]`,
      { timeout: 45_000 },
    )
    await page.waitForFunction(
      () => document.body.classList.contains("chimer-preview-capture"),
      undefined,
      { timeout: 10_000 },
    )
    // Next's development indicator is injected after hydration. Keep that
    // tooling chrome out of generated product media even when capture reuses
    // an already-running local dev server.
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    })
    await page.waitForTimeout(options.warmupMs + options.durationMs + 600)

    const video = page.video()
    await context.close()

    if (!video) {
      throw new Error("Playwright did not produce a video file.")
    }

    const sourcePath = await video.path()
    await encodeWebm(sourcePath, outputPath, options, variant)
    await encodePoster(outputPath, posterPath, options.durationMs)
    assertVariantMedia(outputPath, posterPath, variant)
    return {
      skipped: false,
      variant: buildVariantManifest(entry, outputPath, posterPath, options, variant),
    }
  } catch (error) {
    await context.close().catch(() => undefined)
    throw error
  }
}

async function captureBackground(browser, entry, options, variants, tempVideoDir) {
  const variantItems = {}
  let skipped = true

  for (const variant of variants) {
    const result = await captureVariant(browser, entry, options, variant, tempVideoDir)
    variantItems[variant.key] = result.variant
    skipped = skipped && result.skipped
  }

  return {
    skipped,
    item: buildManifestItem(entry, variantItems),
  }
}

function buildVariantManifest(entry, outputPath, posterPath, options, variant) {
  const stats = statSync(outputPath)
  const posterStats = statSync(posterPath)
  return {
    key: variant.key,
    previewMediaType: "video",
    previewMediaUrl: `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/${entry.id}${variant.suffix}.webm`,
    previewPosterUrl: `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/${entry.id}${variant.suffix}.webp`,
    width: variant.outputWidth,
    height: variant.outputHeight,
    durationMs: options.durationMs,
    fps: options.fps,
    bytes: stats.size,
    sha256: hashFile(outputPath),
    posterBytes: posterStats.size,
    posterSha256: hashFile(posterPath),
  }
}

function buildManifestItem(entry, variants) {
  const primary = variants.landscape ?? Object.values(variants)[0]

  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    previewMediaType: "video",
    previewMediaUrl: primary.previewMediaUrl,
    previewVideoUrl: primary.previewMediaUrl,
    previewImageUrl: primary.previewPosterUrl,
    previewSquareVideoUrl: variants.square?.previewMediaUrl,
    previewSquareImageUrl: variants.square?.previewPosterUrl,
    previewVerticalVideoUrl: variants.vertical?.previewMediaUrl,
    previewVerticalImageUrl: variants.vertical?.previewPosterUrl,
    variants,
  }
}

function writeManifest(items, options) {
  // Registry entries are re-read and normalized so partial --only runs retain
  // untouched media, while freshly rendered items overwrite matching IDs.
  const existingItems = getBackgroundOptionsForCategory(options.category)
    .filter((entry) => entry.previewVariants && Object.keys(entry.previewVariants).length > 0)
    .map((entry) => normalizeGeneratedPreviewManifestItem({
      id: entry.id,
      label: entry.label,
      provider: entry.provider,
      previewMediaType: "video",
      previewMediaUrl: entry.previewVideoUrl ?? entry.previewMediaUrl,
      previewVideoUrl: entry.previewVideoUrl ?? entry.previewMediaUrl,
      previewImageUrl: entry.previewImageUrl,
      previewSquareVideoUrl: entry.previewSquareVideoUrl,
      previewSquareImageUrl: entry.previewSquareImageUrl,
      previewVerticalVideoUrl: entry.previewVerticalVideoUrl,
      previewVerticalImageUrl: entry.previewVerticalImageUrl,
      variants: entry.previewVariants,
    }))
  const mergedItems = new Map(existingItems.map((item) => [item.id, item]))
  for (const item of items) mergedItems.set(item.id, item)

  const manifest = {
    generatedAt: new Date().toISOString(),
    category: options.category,
    durationMs: options.durationMs,
    fps: options.fps,
    items: [...mergedItems.values()].sort((left, right) => left.id.localeCompare(right.id)),
  }

  writeFileSync(
    path.join(options.outputDir, "index.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  const manifestRecord = Object.fromEntries(
    manifest.items.map((item) => [
      item.id,
      {
        previewMediaUrl: item.previewMediaUrl,
        previewMediaType: item.previewMediaType,
        previewVideoUrl: item.previewVideoUrl,
        ...(item.previewImageUrl ? { previewImageUrl: item.previewImageUrl } : {}),
        ...(item.previewSquareVideoUrl ? { previewSquareVideoUrl: item.previewSquareVideoUrl } : {}),
        ...(item.previewSquareImageUrl ? { previewSquareImageUrl: item.previewSquareImageUrl } : {}),
        ...(item.previewVerticalVideoUrl ? { previewVerticalVideoUrl: item.previewVerticalVideoUrl } : {}),
        ...(item.previewVerticalImageUrl ? { previewVerticalImageUrl: item.previewVerticalImageUrl } : {}),
        variants: item.variants,
      },
    ]),
  )

  const lines = [
    "export type BackgroundPreviewVariantName = \"landscape\" | \"square\" | \"vertical\"",
    "",
    "export type BackgroundPreviewVariant = {",
    "  key: BackgroundPreviewVariantName",
    "  previewMediaUrl: string",
    "  previewPosterUrl?: string",
    "  previewMediaType: \"video\"",
    "  width: number",
    "  height: number",
    "  durationMs: number",
    "  fps: number",
    "  bytes: number",
    "  sha256: string",
    "  posterBytes?: number",
    "  posterSha256?: string",
    "}",
    "",
    "export type BackgroundPreviewManifestEntry = {",
    "  previewMediaUrl: string",
    "  previewMediaType: \"image\" | \"video\"",
    "  previewVideoUrl?: string",
    "  previewImageUrl?: string",
    "  previewSquareVideoUrl?: string",
    "  previewSquareImageUrl?: string",
    "  previewVerticalVideoUrl?: string",
    "  previewVerticalImageUrl?: string",
    "  variants?: Partial<Record<BackgroundPreviewVariantName, BackgroundPreviewVariant>>",
    "}",
    "",
    `const LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL = ${JSON.stringify(LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL)}`,
    "const HOSTED_CHIMER_PREVIEW_MEDIA_BASE_URL = \"https://media.massagelab.app/chimer/background-previews\"",
    "const CHIMER_PREVIEW_MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL || (process.env.NODE_ENV === \"production\" ? HOSTED_CHIMER_PREVIEW_MEDIA_BASE_URL : LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL)).replace(/\\/+$/, \"\")",
    "",
    "function resolvePreviewMediaUrl(url: string) {",
    "  const prefix = `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/`",
    "  return url.startsWith(prefix) ? `${CHIMER_PREVIEW_MEDIA_BASE_URL}/${url.slice(prefix.length)}` : url",
    "}",
    "",
    "function resolvePreviewManifestVariants(variants: BackgroundPreviewManifestEntry[\"variants\"]) {",
    "  if (!variants) {",
    "    return undefined",
    "  }",
    "",
    "  const resolved: Partial<Record<BackgroundPreviewVariantName, BackgroundPreviewVariant>> = {}",
    "  for (const key of Object.keys(variants) as BackgroundPreviewVariantName[]) {",
    "    const variant = variants[key]",
    "    if (variant) {",
    "      resolved[key] = {",
    "        ...variant,",
    "        previewMediaUrl: resolvePreviewMediaUrl(variant.previewMediaUrl),",
    "        previewPosterUrl: variant.previewPosterUrl ? resolvePreviewMediaUrl(variant.previewPosterUrl) : undefined,",
    "      }",
    "    }",
    "  }",
    "",
    "  return resolved",
    "}",
    "",
    "function resolvePreviewManifestEntry(entry: BackgroundPreviewManifestEntry): BackgroundPreviewManifestEntry {",
    "  return {",
    "    ...entry,",
    "    previewMediaUrl: resolvePreviewMediaUrl(entry.previewMediaUrl),",
    "    previewVideoUrl: entry.previewVideoUrl ? resolvePreviewMediaUrl(entry.previewVideoUrl) : undefined,",
    "    previewImageUrl: entry.previewImageUrl ? resolvePreviewMediaUrl(entry.previewImageUrl) : undefined,",
    "    previewSquareVideoUrl: entry.previewSquareVideoUrl ? resolvePreviewMediaUrl(entry.previewSquareVideoUrl) : undefined,",
    "    previewSquareImageUrl: entry.previewSquareImageUrl ? resolvePreviewMediaUrl(entry.previewSquareImageUrl) : undefined,",
    "    previewVerticalVideoUrl: entry.previewVerticalVideoUrl ? resolvePreviewMediaUrl(entry.previewVerticalVideoUrl) : undefined,",
    "    previewVerticalImageUrl: entry.previewVerticalImageUrl ? resolvePreviewMediaUrl(entry.previewVerticalImageUrl) : undefined,",
    "    variants: resolvePreviewManifestVariants(entry.variants),",
    "  }",
    "}",
    "",
    `const rawBackgroundPreviewManifest = ${JSON.stringify(manifestRecord, null, 2)} satisfies Record<string, BackgroundPreviewManifestEntry>`,
    "",
    "export const backgroundPreviewManifest = Object.fromEntries(",
    "  Object.entries(rawBackgroundPreviewManifest).map(([id, entry]) => [id, resolvePreviewManifestEntry(entry)]),",
    ") as Record<string, BackgroundPreviewManifestEntry>",
  ]

  writeFileSync(manifestModulePath, `${lines.join("\n")}\n`)
  return manifest
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  ensureFfmpeg()
  mkdirSync(options.outputDir, { recursive: true })

  const backgrounds = pickBackgrounds(options)
  const variants = getVariantConfigs(options)
  if (!backgrounds.length) {
    throw new Error("No matching backgrounds found.")
  }

  const tempVideoDir = path.join(tmpdir(), `massagelab-chimer-previews-${Date.now()}`)
  mkdirSync(tempVideoDir, { recursive: true })

  let server = null
  const browser = await chromium.launch({ headless: true })
  const items = []
  const failures = []

  try {
    server = await startServer(options)

    for (const [index, entry] of backgrounds.entries()) {
      const prefix = `[${index + 1}/${backgrounds.length}] ${entry.id}`
      try {
        console.log(`${prefix}: rendering ${variants.map((variant) => variant.key).join(", ")}`)
        const result = await captureBackground(browser, entry, options, variants, tempVideoDir)
        items.push(result.item)
        const totalBytes = Object.values(result.item.variants).reduce((total, variant) => total + variant.bytes, 0)
        console.log(`${prefix}: ${result.skipped ? "kept existing" : "wrote"} ${totalBytes} bytes`)
      } catch (error) {
        failures.push({ id: entry.id, message: error.message })
        console.error(`${prefix}: failed: ${error.message}`)
      }
    }
  } finally {
    await browser.close().catch(() => undefined)
    if (server) {
      server.kill()
    }
    rmSync(tempVideoDir, { recursive: true, force: true })
  }

  const manifest = writeManifest(items, options)
  console.log(`Wrote ${manifest.items.length} preview manifest entries to ${options.outputDir}`)

  if (failures.length) {
    console.error("Preview generation failures:")
    for (const failure of failures) {
      console.error(`- ${failure.id}: ${failure.message}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
