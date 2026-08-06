import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"

function defaultIo() {
  return {
    exists: existsSync,
    read: (filePath) => readFileSync(filePath, "utf8"),
    writeAtomic(filePath, value) {
      mkdirSync(path.dirname(filePath), { recursive: true })
      const temporaryPath = `${filePath}.${process.pid}.tmp`
      writeFileSync(temporaryPath, value, "utf8")
      renameSync(temporaryPath, filePath)
    },
  }
}

/** Reads resumable per-aspect state while rejecting malformed checkpoints. */
export function readGenerationCheckpoint(outputDir, io = defaultIo()) {
  const filePath = path.join(outputDir, "generation-state.json")
  if (!io.exists(filePath)) return { schemaVersion: 1, aspects: {} }
  const value = JSON.parse(io.read(filePath))
  if (value?.schemaVersion !== 1 || !value.aspects || typeof value.aspects !== "object") {
    throw new Error(`${filePath}: invalid generation checkpoint`)
  }
  return value
}

/** Atomically records one aspect without erasing previously completed work. */
export function updateGenerationCheckpoint(outputDir, backgroundId, aspect, result, io = defaultIo()) {
  const filePath = path.join(outputDir, "generation-state.json")
  const current = readGenerationCheckpoint(outputDir, io)
  const next = {
    ...current,
    aspects: {
      ...current.aspects,
      [`${backgroundId}:${aspect}`]: { ...result, updatedAt: new Date().toISOString() },
    },
  }
  io.writeAtomic(filePath, `${JSON.stringify(next, null, 2)}\n`)
  return next
}

/** Prevents local paths and long process output from leaking into checkpoints. */
export function sanitizeGenerationError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/[A-Z]:\\[^\n]+/gi, "<local-path>").slice(0, 2000)
}
