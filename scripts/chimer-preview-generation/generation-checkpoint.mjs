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
  const protectedUrls = []
  const messageWithoutHttpUrls = message.replace(/\bhttps?:\/\/[^\s"'<>]+/gi, (url) => {
    const token = `__MASSAGELAB_HTTP_URL_${protectedUrls.length}__`
    protectedUrls.push(url)
    return token
  })
  return messageWithoutHttpUrls
    .replace(/(["'])file:\/\/\/[^"'\r\n]+\1/gi, "<local-path>")
    .replace(/(["'])(?:[A-Z]:[\\/]|\/(?!\/))[^"'\r\n]+\1/gi, "<local-path>")
    .replace(/\bfile:\/\/\/(?:[A-Z]:\/)?[^\s"'<>|,:;!?)]+/gi, "<local-path>")
    .replace(/\b[A-Z]:[\\/][^\s"'<>|,:;!?)]+/gi, "<local-path>")
    .replace(/(?<![\w:/])\/(?!\/)[^\s"'<>|,:;!?)]+/g, "<local-path>")
    .replace(/__MASSAGELAB_HTTP_URL_(\d+)__/g, (_token, index) => protectedUrls[Number(index)])
    .slice(0, 2000)
}
