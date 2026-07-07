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
      const response = await fetch(url, { cache: "no-store" })
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

  await waitForServer(options.baseUrl)
  await disableNextDevIndicator(options.baseUrl)
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

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

async function captureVariant(browser, entry, options, variant, tempVideoDir) {
  const outputPath = path.join(options.outputDir, `${entry.id}${variant.suffix}.webm`)

  if (existsSync(outputPath) && !options.force) {
    return {
      skipped: true,
      variant: buildVariantManifest(entry, outputPath, options, variant),
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
    await page.waitForTimeout(options.warmupMs + options.durationMs + 600)

    const video = page.video()
    await context.close()

    if (!video) {
      throw new Error("Playwright did not produce a video file.")
    }

    const sourcePath = await video.path()
    await encodeWebm(sourcePath, outputPath, options, variant)
    return {
      skipped: false,
      variant: buildVariantManifest(entry, outputPath, options, variant),
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

function buildVariantManifest(entry, outputPath, options, variant) {
  const stats = statSync(outputPath)
  return {
    key: variant.key,
    previewMediaType: "video",
    previewMediaUrl: `/chimer/background-previews/${entry.id}${variant.suffix}.webm`,
    width: variant.outputWidth,
    height: variant.outputHeight,
    durationMs: options.durationMs,
    fps: options.fps,
    bytes: stats.size,
    sha256: hashFile(outputPath),
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
    previewSquareVideoUrl: variants.square?.previewMediaUrl,
    previewVerticalVideoUrl: variants.vertical?.previewMediaUrl,
    variants,
  }
}

function writeManifest(items, options) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    category: options.category,
    durationMs: options.durationMs,
    fps: options.fps,
    items: items.sort((left, right) => left.id.localeCompare(right.id)),
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
        ...(item.previewSquareVideoUrl ? { previewSquareVideoUrl: item.previewSquareVideoUrl } : {}),
        ...(item.previewVerticalVideoUrl ? { previewVerticalVideoUrl: item.previewVerticalVideoUrl } : {}),
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
    "  previewMediaType: \"video\"",
    "  width: number",
    "  height: number",
    "  durationMs: number",
    "  fps: number",
    "  bytes: number",
    "  sha256: string",
    "}",
    "",
    "export type BackgroundPreviewManifestEntry = {",
    "  previewMediaUrl: string",
    "  previewMediaType: \"image\" | \"video\"",
    "  previewVideoUrl?: string",
    "  previewSquareVideoUrl?: string",
    "  previewVerticalVideoUrl?: string",
    "  variants?: Partial<Record<BackgroundPreviewVariantName, BackgroundPreviewVariant>>",
    "}",
    "",
    "const LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL = \"/chimer/background-previews\"",
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
    "    previewSquareVideoUrl: entry.previewSquareVideoUrl ? resolvePreviewMediaUrl(entry.previewSquareVideoUrl) : undefined,",
    "    previewVerticalVideoUrl: entry.previewVerticalVideoUrl ? resolvePreviewMediaUrl(entry.previewVerticalVideoUrl) : undefined,",
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
