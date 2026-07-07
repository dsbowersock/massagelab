import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getBackgroundOptionsForCategory } from "../../components/backgrounds/backgroundRegistry.ts"

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

function buildVariant(entry, variant) {
  const filePath = path.join(outputDir, `${entry.id}${variant.suffix}.webm`)
  if (!existsSync(filePath)) {
    return null
  }

  return {
    key: variant.key,
    previewMediaType: "video",
    previewMediaUrl: `/chimer/background-previews/${entry.id}${variant.suffix}.webm`,
    width: variant.width,
    height: variant.height,
    durationMs: defaultDurationMs,
    fps: defaultFps,
    bytes: statSync(filePath).size,
    sha256: hashFile(filePath),
  }
}

function buildItem(entry) {
  const variantEntries = Object.fromEntries(
    variants
      .map((variant) => [variant.key, buildVariant(entry, variant)])
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
    previewSquareVideoUrl: variantEntries.square?.previewMediaUrl,
    previewVerticalVideoUrl: variantEntries.vertical?.previewMediaUrl,
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

console.log(`Wrote ${items.length} Chimer preview manifest entries.`)
