import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
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

function copyIo(overrides = {}) {
  return {
    exists: existsSync,
    readFile: readFileSync,
    mkdir: (directory) => mkdirSync(directory, { recursive: true }),
    writeFile: writeFileSync,
    copyFile: copyFileSync,
    ...overrides,
  }
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

/** Copies the exact approved byte snapshots only after every required file matches. */
export function copyApprovedPilotMedia(entries, { sourceDir, outputDir }, ioOverrides = {}) {
  const io = copyIo(ioOverrides)
  const plans = planApprovedPilotMediaCopies(entries, { sourceDir, outputDir })
  const copies = []
  for (const plan of plans) {
    if (!io.exists(plan.sourcePath)) {
      if (!plan.required) continue
      throw new Error(`${plan.label}: approved media is missing or has changed: ${plan.relativeUrl}`)
    }
    if (plan.required) {
      const body = io.readFile(plan.sourcePath)
      const hashMatches = typeof plan.sha256 === "string"
        && createHash("sha256").update(body).digest("hex") === plan.sha256
      if (body.length !== plan.bytes || !hashMatches) {
        throw new Error(`${plan.label}: approved media is missing or has changed: ${plan.relativeUrl}`)
      }
      copies.push({ ...plan, body })
      continue
    }
    copies.push(plan)
  }
  for (const plan of copies) {
    io.mkdir(path.dirname(plan.outputPath))
    if (plan.required) io.writeFile(plan.outputPath, plan.body)
    else io.copyFile(plan.sourcePath, plan.outputPath)
  }
}
