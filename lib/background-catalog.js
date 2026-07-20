// @ts-check

export const BACKGROUND_SAVED_IDS_STORAGE_KEY = "massagelab-chimer-saved-background-ids-v1"

/** @typedef {"all"|"static"|"animated"|"interactive"|"shader"|"image"|"video"|"premium"|"saved"} BackgroundVisualFilter */
/** @type {ReadonlyArray<{ value: BackgroundVisualFilter, label: string }>} */
export const BACKGROUND_VISUAL_FILTERS = Object.freeze([
  { value: "all", label: "All" },
  { value: "static", label: "Static" },
  { value: "animated", label: "Animated" },
  { value: "interactive", label: "Interactive" },
  { value: "shader", label: "Shader" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "premium", label: "Premium" },
  { value: "saved", label: "Saved" },
])

const INTERACTIVE_HINTS = ["interactive", "hover", "cursor", "rotate", "orbit", "spin", "mouse", "tap", "drag", "pan"]
const SHADER_HINTS = ["shader", "canvas", "webgl", "glsl", "fragment", "uniform", "three", "custom"]
const IMAGE_SUFFIXES = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".heic", ".heif", ".svg"]
const VIDEO_SUFFIXES = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"]

/** @param {unknown} raw @returns {string[]} */
export function parseSavedBackgroundIds(raw) {
  if (typeof raw !== "string") return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((entry) => typeof entry === "string"))]
  } catch {
    return []
  }
}

/** @param {{ getItem(key: string): string | null }} storage */
export function readSavedBackgroundIds(storage) {
  try {
    return parseSavedBackgroundIds(storage.getItem(BACKGROUND_SAVED_IDS_STORAGE_KEY))
  } catch {
    return []
  }
}

/** @param {{ setItem(key: string, value: string): void }} storage @param {string[]} ids */
export function writeSavedBackgroundIds(storage, ids) {
  try {
    storage.setItem(BACKGROUND_SAVED_IDS_STORAGE_KEY, JSON.stringify([...new Set(ids.filter((id) => typeof id === "string"))]))
    return true
  } catch {
    return false
  }
}

/** @param {unknown} source */
function sourceType(source) {
  const normalized = String(source ?? "").toLowerCase()
  if (VIDEO_SUFFIXES.some((suffix) => normalized.includes(suffix))) return "video"
  if (IMAGE_SUFFIXES.some((suffix) => normalized.includes(suffix)) || normalized.includes("/media/")) return "image"
  return null
}

/** @param {Record<string, any>} option @param {"landscape"|"square"|"vertical"} [preferredVariant] */
export function getBackgroundPreviewMedia(option, preferredVariant = "landscape") {
  const videos = preferredVariant === "vertical"
    ? [option.previewVerticalVideoUrl, option.previewSquareVideoUrl, option.previewVideoUrl]
    : preferredVariant === "square"
      ? [option.previewSquareVideoUrl, option.previewVideoUrl, option.previewVerticalVideoUrl]
      : [option.previewVideoUrl, option.previewSquareVideoUrl, option.previewVerticalVideoUrl]
  const candidates = [
    ...videos.map((source) => ({ type: "video", source })),
    { type: option.previewMediaType, source: option.previewMediaUrl },
    { type: "image", source: option.previewImageUrl },
    { type: sourceType(option.sourceUrl), source: option.sourceUrl },
  ]
  const match = candidates.find(({ type, source }) => source && (type === "image" || type === "video"))
  return match ? { type: match.type, source: match.source } : null
}

/** @param {Record<string, any>} option */
function isInteractive(option) {
  const text = [option.id, option.label, option.recommendedUse, option.customizationSummary].join(" ").toLowerCase()
  return INTERACTIVE_HINTS.some((hint) => text.includes(hint))
}

/** @param {Record<string, any>} option */
function isShader(option) {
  const text = [option.id, option.label, option.provider, option.sourceUrl, option.recommendedUse, option.customizationSummary].join(" ").toLowerCase()
  return SHADER_HINTS.some((hint) => text.includes(hint))
}

/** @param {Record<string, any>} option @param {"image"|"video"} type */
function hasMedia(option, type) {
  const media = getBackgroundPreviewMedia(option)
  if (type === "image") return Boolean(option.previewImageUrl || media?.type === "image")
  return Boolean(option.previewVideoUrl || option.previewSquareVideoUrl || option.previewVerticalVideoUrl || media?.type === "video")
}

/** @param {Record<string, any>} option @param {string} filter @param {string[]} savedIds */
export function matchesBackgroundVisualFilter(option, filter, savedIds) {
  if (filter === "all") return true
  if (filter === "saved") return savedIds.includes(option.id)
  if (filter === "premium") return Boolean(option.requiresSubscription)
  if (filter === "static") return option.motionIntensity === "static"
  if (filter === "animated") return option.motionIntensity !== "static"
  if (filter === "interactive") return isInteractive(option)
  if (filter === "shader") return isShader(option)
  if (filter === "image") return hasMedia(option, "image")
  if (filter === "video") return hasMedia(option, "video")
  return true
}

/** @param {Record<string, any>} option */
export function getBackgroundVisualTags(option) {
  const tags = [option.motionIntensity === "static" ? "Static" : "Animated"]
  if (isInteractive(option)) tags.push("Interactive")
  if (isShader(option)) tags.push("Shader")
  if (hasMedia(option, "image")) tags.push("Image")
  else if (hasMedia(option, "video")) tags.push("Video")
  tags.push(option.requiresSubscription ? "Premium" : "Free")
  return [...new Set(tags)]
}
