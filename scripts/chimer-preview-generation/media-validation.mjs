import { PREVIEW_ASPECTS, PREVIEW_CODECS, PREVIEW_QUALITIES } from "./preview-recipes.mjs"
import { getPreviewRenditionMimeType } from "./rendition-plan.mjs"

const SHA256_PATTERN = /^[a-f0-9]{64}$/

function parseFrameRate(value) {
  const [numerator, denominator] = String(value ?? "0/0").split("/").map(Number)
  return denominator > 0 ? numerator / denominator : 0
}

/** Parses the exact metadata needed to accept a rendered preview rendition. */
export function parseMediaProbe(result, filePath) {
  let probe
  try {
    probe = JSON.parse(result?.stdout ?? result)
  } catch {
    throw new Error(`${filePath}: FFprobe did not return valid JSON`)
  }
  const videoStreams = Array.isArray(probe?.streams)
    ? probe.streams.filter((stream) => stream?.codec_type === "video")
    : []
  if (videoStreams.length !== 1 || probe.streams.length !== 1) {
    throw new Error(`${filePath}: expected exactly one video stream and no other streams`)
  }
  const stream = videoStreams[0]
  const durationSeconds = Number(probe?.format?.duration ?? stream.duration)
  const fps = parseFrameRate(stream.avg_frame_rate ?? stream.r_frame_rate)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(fps) || fps <= 0) {
    throw new Error(`${filePath}: FFprobe duration and frame rate must be positive`)
  }
  return {
    path: filePath,
    codec: stream.codec_name,
    pixelFormat: stream.pix_fmt,
    width: Number(stream.width),
    height: Number(stream.height),
    durationMs: Math.round(durationSeconds * 1000),
    fps,
    streamCount: probe.streams.length,
  }
}

export function validateRenditionMetadata(actual, expected) {
  const prefix = actual?.path ? `${actual.path}: ` : ""
  const errors = []
  for (const key of ["codec", "pixelFormat", "width", "height", "streamCount"]) {
    if (expected[key] !== undefined && actual?.[key] !== expected[key]) {
      errors.push(`${prefix}${key} ${actual?.[key]} does not match ${expected[key]}`)
    }
  }
  if (!Number.isFinite(actual?.fps) || Math.abs(actual.fps - expected.fps) > 0.02) {
    errors.push(`${prefix}fps ${actual?.fps} does not match ${expected.fps}`)
  }
  const durationToleranceMs = Math.max(50, Math.ceil(1000 / expected.fps) * 2)
  if (!Number.isFinite(actual?.durationMs) || Math.abs(actual.durationMs - expected.durationMs) > durationToleranceMs) {
    errors.push(`${prefix}duration ${actual?.durationMs}ms does not match ${expected.durationMs}ms`)
  }
  return errors
}

/** Ratio of distinct decoded samples beyond the first; zero proves no change. */
export function calculateFrameVariation(frameHashes) {
  if (!Array.isArray(frameHashes) || frameHashes.length < 2) return 0
  return (new Set(frameHashes).size - 1) / (frameHashes.length - 1)
}

export function validateAnimatedFrameVariation({ backgroundId, motionIntensity, frameHashes }) {
  if (motionIntensity === "static") return []
  return calculateFrameVariation(frameHashes) > 0
    ? []
    : [`${backgroundId}: decoded samples did not prove animation`]
}

/** Thresholds reject obviously discontinuous loops; they are not visual approval. */
export function validateLoopSeam({ strategy, normalizedDifference }) {
  const maximum = strategy === "natural" ? 0.080 : strategy === "crossfade" ? 0.120 : null
  if (maximum === null) return [`unsupported loop strategy: ${strategy}`]
  if (!Number.isFinite(normalizedDifference)) return [`${strategy} loop seam difference is not finite`]
  return normalizedDifference <= maximum
    ? []
    : [`${strategy} loop seam difference ${normalizedDifference.toFixed(3)} exceeds ${maximum.toFixed(3)}`]
}

function mediaFileErrors(item, root, label) {
  const errors = []
  if (typeof item?.url !== "string" || !item.url.startsWith(root)) errors.push(`${label}: URL must start with ${root}`)
  if (!Number.isInteger(item?.width) || item.width <= 0 || !Number.isInteger(item?.height) || item.height <= 0) {
    errors.push(`${label}: dimensions must be positive integers`)
  }
  if (!Number.isInteger(item?.bytes) || item.bytes <= 0) errors.push(`${label}: media must have positive bytes`)
  if (!SHA256_PATTERN.test(item?.sha256 ?? "")) errors.push(`${label}: SHA-256 must be 64 lowercase hex characters`)
  return errors
}

/** Validates a complete v2 pilot manifest without trusting generator state. */
export function validatePilotManifest(entries) {
  const errors = []
  if (!Array.isArray(entries)) return ["pilot manifest entries must be an array"]
  const seenIds = new Set()
  for (const entry of entries) {
    const id = entry?.backgroundId ?? "unknown"
    if (seenIds.has(id)) errors.push(`${id}: duplicate manifest entry`)
    seenIds.add(id)
    if (!/^recipe-\d+$/.test(entry?.recipeRevision ?? "")) errors.push(`${id}: invalid recipe revision`)
    if (!["natural", "crossfade"].includes(entry?.loopStrategy)) errors.push(`${id}: invalid loop strategy`)
    if (!Number.isInteger(entry?.loopBoundaryMs) || entry.loopBoundaryMs <= 0) errors.push(`${id}: loop boundary must be positive`)
    const root = `${id}/${entry?.recipeRevision}/`
    const renditions = Array.isArray(entry?.renditions) ? entry.renditions : []
    const renditionKeys = new Set(renditions.map((item) => `${item.aspect}:${item.quality}:${item.codec}`))
    if (renditions.length !== 18 || renditionKeys.size !== 18) errors.push(`${id}: expected exactly 18 renditions`)
    const expectedKeys = new Set(PREVIEW_ASPECTS.flatMap((aspect) => PREVIEW_QUALITIES.flatMap((quality) =>
      PREVIEW_CODECS.map((codec) => `${aspect}:${quality}:${codec}`))))
    for (const key of expectedKeys) if (!renditionKeys.has(key)) errors.push(`${id}: missing rendition ${key}`)
    const durationsByAspect = new Map()
    for (const item of renditions) {
      const label = `${id}:${item.aspect}:${item.quality}:${item.codec}`
      errors.push(...mediaFileErrors(item, root, label))
      if (getPreviewRenditionMimeType(item.codec, item.quality) !== item.mimeType) {
        errors.push(`${label}: MIME type does not match encoded codec profile and tier`)
      }
      if (!PREVIEW_ASPECTS.includes(item.aspect) || !PREVIEW_QUALITIES.includes(item.quality)
        || !PREVIEW_CODECS.includes(item.codec)) errors.push(`${label}: unsupported rendition key`)
      if (!Number.isInteger(item.durationMs) || item.durationMs <= 0) errors.push(`${label}: duration must be positive`)
      if (![24, 30].includes(item.fps)) errors.push(`${label}: fps must be 24 or 30`)
      const durations = durationsByAspect.get(item.aspect) ?? new Set()
      durations.add(item.durationMs)
      durationsByAspect.set(item.aspect, durations)
    }
    for (const aspect of PREVIEW_ASPECTS) {
      if ((durationsByAspect.get(aspect)?.size ?? 0) !== 1) errors.push(`${id}:${aspect}: renditions must share one duration`)
    }
    const posters = entry?.posters
    if (!posters || !PREVIEW_ASPECTS.every((aspect) => posters[aspect])) {
      errors.push(`${id}: expected exactly three posters`)
    } else {
      if (Object.keys(posters).length !== 3) errors.push(`${id}: expected exactly three posters`)
      for (const aspect of PREVIEW_ASPECTS) {
        errors.push(...mediaFileErrors(posters[aspect], `${root}${aspect}/`, `${id}:${aspect}:poster`))
      }
    }
  }
  return errors
}

/**
 * Validates mixed animated and poster-only catalog entries without weakening
 * the frozen v2 animated contract. Static visuals must never contain videos.
 */
export function validateCatalogManifest(entries) {
  if (!Array.isArray(entries)) return ["catalog manifest entries must be an array"]
  const errors = []
  const animatedEntries = []
  const seenIds = new Set()
  for (const entry of entries) {
    const id = entry?.backgroundId ?? "unknown"
    if (seenIds.has(id)) errors.push(`${id}: duplicate catalog manifest entry`)
    seenIds.add(id)
    if (entry?.mediaKind === "animated") {
      animatedEntries.push(entry)
      continue
    }
    if (entry?.mediaKind !== "poster-only") {
      errors.push(`${id}: media kind must be animated or poster-only`)
      continue
    }
    if (!/^recipe-\d+$/.test(entry?.recipeRevision ?? "")) errors.push(`${id}: invalid recipe revision`)
    if (entry?.loopStrategy !== "static") errors.push(`${id}: poster-only loop strategy must be static`)
    if (entry?.loopBoundaryMs !== 0) errors.push(`${id}: poster-only loop boundary must be zero`)
    if (!Array.isArray(entry?.renditions) || entry.renditions.length !== 0) {
      errors.push(`${id}: poster-only entry must not contain video renditions`)
    }
    const root = `${id}/${entry?.recipeRevision}/`
    const posters = entry?.posters
    if (!posters || Object.keys(posters).length !== 3 || !PREVIEW_ASPECTS.every((aspect) => posters[aspect])) {
      errors.push(`${id}: expected exactly three posters`)
      continue
    }
    for (const aspect of PREVIEW_ASPECTS) {
      errors.push(...mediaFileErrors(posters[aspect], `${root}${aspect}/`, `${id}:${aspect}:poster`))
    }
  }
  errors.push(...validatePilotManifest(animatedEntries))
  return errors
}
