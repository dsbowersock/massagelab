import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getBackgroundOptionsForCategory } from "../../components/backgrounds/backgroundRegistry.ts"
import {
  LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL,
  normalizeGeneratedPreviewManifestItem,
} from "./manifest-url-normalization.mjs"
import { probeMediaDimensions } from "./probe-result.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const outputDir = path.join(repoRoot, "public/chimer/background-previews")
const manifestModulePath = path.join(repoRoot, "components/backgrounds/backgroundPreviewManifest.ts")
const defaultDurationMs = 6000
const defaultFps = 12

const variants = [
  {
    key: "landscape",
    suffix: "",
    width: 384,
    height: 216,
  },
  {
    key: "square",
    suffix: "-square",
    width: 384,
    height: 384,
  },
  {
    key: "vertical",
    suffix: "-vertical",
    width: 216,
    height: 384,
  },
]

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

/** Uses FFprobe to reject corrupt or incorrectly sized generated media before publishing metadata. */
function validateDimensions(filePath, expectedWidth, expectedHeight) {
  const { width, height } = probeMediaDimensions(filePath)
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${path.basename(filePath)} must decode at ${expectedWidth}x${expectedHeight}.`)
  }
}

function buildVariant(entry, variant) {
  const filePath = path.join(outputDir, `${entry.id}${variant.suffix}.webm`)
  const posterPath = path.join(outputDir, `${entry.id}${variant.suffix}.webp`)
  if (!existsSync(filePath)) {
    return null
  }

  const bytes = statSync(filePath).size
  if (bytes <= 0) throw new Error(`${path.basename(filePath)} is empty.`)
  validateDimensions(filePath, variant.width, variant.height)

  let posterUrl = {}
  let posterMetadata = {}
  if (existsSync(posterPath)) {
    const posterBytes = statSync(posterPath).size
    if (posterBytes <= 0) throw new Error(`${path.basename(posterPath)} is empty.`)
    validateDimensions(posterPath, variant.width, variant.height)
    posterUrl = {
      previewPosterUrl: `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/${entry.id}${variant.suffix}.webp`,
    }
    posterMetadata = {
      posterBytes,
      posterSha256: hashFile(posterPath),
    }
  }

  return {
    key: variant.key,
    previewMediaType: "video",
    previewMediaUrl: `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/${entry.id}${variant.suffix}.webm`,
    ...posterUrl,
    width: variant.width,
    height: variant.height,
    durationMs: defaultDurationMs,
    fps: defaultFps,
    bytes,
    sha256: hashFile(filePath),
    ...posterMetadata,
  }
}

function buildItem(entry) {
  const normalizedFallbackVariants = normalizeGeneratedPreviewManifestItem({
    variants: entry.previewVariants,
  }).variants
  const variantEntries = Object.fromEntries(
    variants
      .map((variant) => [
        variant.key,
        buildVariant(entry, variant)
          ?? normalizedFallbackVariants[variant.key],
      ])
      .filter(([, item]) => item),
  )
  const primary = variantEntries.landscape ?? Object.values(variantEntries)[0]

  if (!primary) {
    return null
  }

  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    previewMediaType: "video",
    previewMediaUrl: primary.previewMediaUrl,
    previewVideoUrl: primary.previewMediaUrl,
    previewImageUrl: primary.previewPosterUrl,
    previewSquareVideoUrl: variantEntries.square?.previewMediaUrl,
    previewSquareImageUrl: variantEntries.square?.previewPosterUrl,
    previewVerticalVideoUrl: variantEntries.vertical?.previewMediaUrl,
    previewVerticalImageUrl: variantEntries.vertical?.previewPosterUrl,
    variants: variantEntries,
  }
}

const items = getBackgroundOptionsForCategory("chimer")
  .map(buildItem)
  .filter(Boolean)
  .sort((left, right) => left.id.localeCompare(right.id))

writeFileSync(
  path.join(outputDir, "index.json"),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    category: "chimer",
    durationMs: defaultDurationMs,
    fps: defaultFps,
    items,
  }, null, 2)}\n`,
)

const manifestRecord = Object.fromEntries(
  items.map((item) => [
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
  "/** Resolves vertical preview assets through manifest fields before configured guessed paths. */",
  "export function resolveVerticalPreviewMediaUrls(",
  "  entry: BackgroundPreviewManifestEntry | undefined,",
  "  fallbackId: string,",
  ") {",
  "  const variant = entry?.variants?.vertical",
  "  return {",
  "    videoUrl: resolvePreviewMediaUrl(",
  "      variant?.previewMediaUrl",
  "        ?? entry?.previewVerticalVideoUrl",
  "        ?? `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/${fallbackId}-vertical.webm`,",
  "    ),",
  "    posterUrl: resolvePreviewMediaUrl(",
  "      variant?.previewPosterUrl",
  "        ?? entry?.previewVerticalImageUrl",
  "        ?? `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/${fallbackId}-vertical.webp`,",
  "    ),",
  "  }",
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

console.log(`Wrote ${items.length} Chimer preview manifest entries.`)
