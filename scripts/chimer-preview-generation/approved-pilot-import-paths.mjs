import { createHash } from "node:crypto"
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
} from "node:fs"
import path from "node:path"

/** Rejects any pilot media URL that is not one canonical relative POSIX path. */
export function assertCanonicalApprovedPilotMediaUrl(value, label) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label}: media URL must be a non-empty relative POSIX path.`)
  }
  if (value.includes("\\")) {
    throw new Error(`${label}: media URL must not contain backslashes.`)
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value)) {
    throw new Error(`${label}: media URL must be a relative POSIX path.`)
  }
  if (value.includes("?") || value.includes("#")) {
    throw new Error(`${label}: media URL must not contain a query string or fragment.`)
  }

  const segments = value.split("/")
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`${label}: media URL must be a canonical relative POSIX path without traversal.`)
  }
  for (const segment of segments) {
    let decodedSegment
    try {
      decodedSegment = decodeURIComponent(segment)
    } catch {
      throw new Error(`${label}: media URL contains invalid percent encoding.`)
    }
    if (decodedSegment === "." || decodedSegment === ".."
      || decodedSegment.includes("/") || decodedSegment.includes("\\")) {
      throw new Error(`${label}: media URL must not contain encoded traversal.`)
    }
  }
  return value
}

/** Resolves a validated media URL and independently proves root containment. */
export function resolveApprovedPilotContainedPath(rootDir, relativeUrl, label) {
  const canonicalUrl = assertCanonicalApprovedPilotMediaUrl(relativeUrl, label)
  const resolvedRoot = path.resolve(rootDir)
  const resolvedPath = path.resolve(resolvedRoot, ...canonicalUrl.split("/"))
  const relativeToRoot = path.relative(resolvedRoot, resolvedPath)
  if (!relativeToRoot
    || relativeToRoot === ".."
    || relativeToRoot.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeToRoot)) {
    throw new Error(`${label}: resolved media path escapes its approved root.`)
  }
  return resolvedPath
}

function createContainedCopyPlan({ sourceDir, outputDir, relativeUrl, label, bytes, sha256, required }) {
  return {
    relativeUrl,
    sourcePath: resolveApprovedPilotContainedPath(sourceDir, relativeUrl, `${label} source`),
    outputPath: resolveApprovedPilotContainedPath(outputDir, relativeUrl, `${label} output`),
    bytes,
    sha256,
    required,
    label,
  }
}

/** Hashes large approved media incrementally so integrity checks stay bounded. */
function sha256File(filePath) {
  const hash = createHash("sha256")
  const descriptor = openSync(filePath, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let bytesRead
    while ((bytesRead = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead))
    }
  } finally {
    closeSync(descriptor)
  }
  return hash.digest("hex")
}

/** Derives and revalidates the optional decoded-frame evidence path. */
export function approvedPilotFrameStripUrl(mediaUrl, label) {
  const canonicalUrl = assertCanonicalApprovedPilotMediaUrl(mediaUrl, label)
  const frameStripUrl = canonicalUrl.replace(/\.(webm|mp4)$/i, ".frames.png")
  if (frameStripUrl === canonicalUrl) {
    throw new Error(`${label}: rendition media URL must end in .webm or .mp4.`)
  }
  return assertCanonicalApprovedPilotMediaUrl(frameStripUrl, `${label} frame strip`)
}

/**
 * Preflights every source/output media and frame-strip path before any file is
 * read or written, preventing a later unsafe entry from causing partial copy.
 */
export function planApprovedPilotMediaCopies(entries, { sourceDir, outputDir }) {
  const plans = []
  for (const [entryIndex, entry] of entries.entries()) {
    const entryLabel = typeof entry?.backgroundId === "string"
      ? entry.backgroundId
      : `pilot entry ${entryIndex}`
    const renditions = Array.isArray(entry?.renditions) ? entry.renditions : []
    const posters = entry?.posters && typeof entry.posters === "object" && !Array.isArray(entry.posters)
      ? Object.values(entry.posters)
      : []
    for (const [mediaIndex, media] of [...renditions, ...posters].entries()) {
      const label = `${entryLabel} media ${mediaIndex}`
      const relativeUrl = assertCanonicalApprovedPilotMediaUrl(media?.url, label)
      plans.push(createContainedCopyPlan({
        sourceDir,
        outputDir,
        relativeUrl,
        label,
        bytes: media?.bytes,
        sha256: media?.sha256,
        required: true,
      }))
      if (media && typeof media === "object" && Object.hasOwn(media, "codec")) {
        const frameStripUrl = approvedPilotFrameStripUrl(relativeUrl, label)
        plans.push(createContainedCopyPlan({
          sourceDir,
          outputDir,
          relativeUrl: frameStripUrl,
          label: `${label} frame strip`,
          bytes: null,
          sha256: null,
          required: false,
        }))
      }
    }
  }
  return plans
}

/** Copies only paths from the complete preflight plan after required media matches. */
export function copyApprovedPilotMedia(entries, { sourceDir, outputDir }) {
  const plans = planApprovedPilotMediaCopies(entries, { sourceDir, outputDir })
  const copies = []
  for (const plan of plans) {
    if (!existsSync(plan.sourcePath)) {
      if (!plan.required) continue
      throw new Error(`${plan.label}: approved media is missing or has changed: ${plan.relativeUrl}`)
    }
    if (plan.required) {
      const sizeMatches = statSync(plan.sourcePath).size === plan.bytes
      const hashMatches = typeof plan.sha256 === "string" && sha256File(plan.sourcePath) === plan.sha256
      if (!sizeMatches || !hashMatches) {
        throw new Error(`${plan.label}: approved media is missing or has changed: ${plan.relativeUrl}`)
      }
    }
    copies.push(plan)
  }
  for (const plan of copies) {
    mkdirSync(path.dirname(plan.outputPath), { recursive: true })
    copyFileSync(plan.sourcePath, plan.outputPath)
  }
}
