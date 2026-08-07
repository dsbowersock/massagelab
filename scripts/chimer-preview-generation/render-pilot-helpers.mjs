import { spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import path from "node:path"

import {
  FULL_CATALOG_BACKGROUND_IDS,
  FULL_CATALOG_BATCHES,
  PILOT_BACKGROUND_IDS,
} from "./preview-recipes.mjs"

/**
 * Resolves the exact render selection while keeping catalog batches unavailable
 * to the smaller approved-pilot workflow.
 */
export function selectRenderPilotIds({ catalogMode, batchSlug, ids }) {
  if (batchSlug && !catalogMode) {
    throw new Error("--batch is available only in catalog mode.")
  }
  if (batchSlug && ids.length) {
    throw new Error("Choose either --batch or --ids, not both.")
  }

  const batch = batchSlug
    ? FULL_CATALOG_BATCHES.find(({ slug }) => slug === batchSlug)
    : null
  if (batchSlug && !batch) throw new Error(`Unknown catalog batch: ${batchSlug}`)

  const allowedIds = catalogMode ? FULL_CATALOG_BACKGROUND_IDS : PILOT_BACKGROUND_IDS
  const unknownIds = ids.filter((id) => !allowedIds.includes(id))
  if (unknownIds.length) throw new Error(`Unknown preview background IDs: ${unknownIds.join(", ")}`)

  return batch
    ? [...batch.ids]
    : ids.length
      ? [...new Set(ids)]
      : [...allowedIds]
}

/**
 * Chooses the newest usable WinGet FFmpeg package deterministically. A stale or
 * partially installed newer directory cannot hide an older working executable.
 */
export function resolveWinGetMediaTool(packageRoot, command, {
  fileExists = existsSync,
  readDirectory = readdirSync,
} = {}) {
  if (!fileExists(packageRoot)) return null
  const candidates = readDirectory(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ffmpeg-"))
    .map((entry) => ({
      name: entry.name,
      executable: path.join(packageRoot, entry.name, "bin", `${command}.exe`),
    }))
    .filter(({ executable }) => fileExists(executable))
    .sort((left, right) => right.name.localeCompare(left.name, "en", { numeric: true }))
  return candidates[0]?.executable ?? null
}

function childHasExited(child) {
  return child.exitCode !== null && child.exitCode !== undefined
    || child.signalCode !== null && child.signalCode !== undefined
}

/** Waits for an exit event without allowing a stuck child to block cleanup forever. */
export function waitForChildExit(child, timeoutMs) {
  if (childHasExited(child)) return Promise.resolve(true)
  return new Promise((resolve) => {
    let timer
    const finish = (exited) => {
      clearTimeout(timer)
      child.removeListener("exit", onExit)
      resolve(exited)
    }
    const onExit = () => finish(true)
    child.once("exit", onExit)
    timer = setTimeout(() => finish(childHasExited(child)), timeoutMs)
  })
}

/**
 * Stops the exact spawned server tree. POSIX shutdown waits for SIGTERM and
 * escalates to SIGKILL only after a bounded grace period.
 */
export async function stopPreviewServer(server, {
  platform = process.platform,
  spawnProcessSync = spawnSync,
  timeoutMs = 5_000,
  waitForExit = waitForChildExit,
} = {}) {
  if (!server?.pid) return
  if (platform === "win32") {
    spawnProcessSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    return
  }
  if (childHasExited(server)) return

  const gracefulExit = waitForExit(server, timeoutMs)
  server.kill("SIGTERM")
  if (await gracefulExit || childHasExited(server)) return

  const forcedExit = waitForExit(server, timeoutMs)
  server.kill("SIGKILL")
  if (!await forcedExit && !childHasExited(server)) {
    throw new Error(`Preview server ${server.pid} did not exit after SIGKILL.`)
  }
}

/**
 * Acquires renderer resources inside one guard so every successfully acquired
 * handle is released even when a later acquisition or the render body fails.
 */
export async function withPreviewResources(resources, render) {
  let server = null
  let browser = null
  let tempVideoDir = null
  let operationFailed = false
  let operationError
  let result
  const cleanupErrors = []
  try {
    server = await resources.startServer()
    browser = await resources.launchBrowser()
    tempVideoDir = await resources.createTempVideoDir()
    result = await render({ browser, tempVideoDir })
  } catch (error) {
    operationFailed = true
    operationError = error
  } finally {
    if (browser) {
      try { await resources.closeBrowser(browser) } catch (error) { cleanupErrors.push(error) }
    }
    if (server) {
      try { await resources.stopServer(server) } catch (error) { cleanupErrors.push(error) }
    }
    if (tempVideoDir) {
      try { await resources.removeTempVideoDir(tempVideoDir) } catch (error) { cleanupErrors.push(error) }
    }
  }
  if (operationFailed) throw operationError
  if (cleanupErrors.length === 1) throw cleanupErrors[0]
  if (cleanupErrors.length > 1) throw new AggregateError(cleanupErrors, "Preview renderer cleanup failed.")
  return result
}
