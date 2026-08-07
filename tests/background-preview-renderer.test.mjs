import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { EventEmitter } from "node:events"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  resolveWinGetMediaTool,
  selectRenderPilotIds,
  stopPreviewServer,
  withPreviewResources,
} from "../scripts/chimer-preview-generation/render-pilot-helpers.mjs"
import { FULL_CATALOG_BATCHES } from "../scripts/chimer-preview-generation/preview-recipes.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const renderCatalogPath = path.join(repoRoot, "scripts/chimer-preview-generation/render-catalog.mjs")

describe("background preview renderer contracts", () => {
  it("rejects unrecognized render-catalog positional arguments", () => {
    const result = spawnSync(process.execPath, [renderCatalogPath, "unexpected-positional"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 30_000,
    })

    assert.equal(result.error, undefined, `render-catalog failed to start: ${result.error?.message}`)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Unknown option or positional argument: unexpected-positional/)
  })

  it("rejects a render-catalog option whose next token is another flag", () => {
    const result = spawnSync(process.execPath, [renderCatalogPath, "--batch", "--force"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 30_000,
    })

    assert.equal(result.error, undefined, `render-catalog failed to start: ${result.error?.message}`)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /--batch requires a value/)
  })

  it("selects exactly one known catalog batch and rejects invalid selection semantics", () => {
    const batch = FULL_CATALOG_BATCHES[2]
    assert.deepEqual(
      selectRenderPilotIds({ catalogMode: true, batchSlug: batch.slug, ids: [] }),
      batch.ids,
    )
    assert.throws(
      () => selectRenderPilotIds({ catalogMode: true, batchSlug: "unknown-batch", ids: [] }),
      /Unknown catalog batch/,
    )
    assert.throws(
      () => selectRenderPilotIds({ catalogMode: true, batchSlug: batch.slug, ids: [batch.ids[0]] }),
      /either --batch or --ids/,
    )
    assert.throws(
      () => selectRenderPilotIds({ catalogMode: false, batchSlug: batch.slug, ids: [] }),
      /only in catalog mode/,
    )
  })

  it("cleans resources acquired before a later acquisition failure", async () => {
    const cleanup = []
    const server = { pid: 123 }
    await assert.rejects(
      withPreviewResources({
        startServer: async () => server,
        launchBrowser: async () => { throw new Error("browser failed") },
        createTempVideoDir: async () => "unused",
        closeBrowser: async () => cleanup.push("browser"),
        stopServer: async (value) => cleanup.push(value === server ? "server" : "wrong-server"),
        removeTempVideoDir: async () => cleanup.push("temp"),
      }, async () => cleanup.push("render")),
      /browser failed/,
    )
    assert.deepEqual(cleanup, ["server"])
  })

  it("cleans browser and server when temporary directory acquisition fails", async () => {
    const cleanup = []
    const server = { pid: 123 }
    const browser = {}
    await assert.rejects(
      withPreviewResources({
        startServer: async () => server,
        launchBrowser: async () => browser,
        createTempVideoDir: async () => { throw new Error("temp failed") },
        closeBrowser: async (value) => cleanup.push(value === browser ? "browser" : "wrong-browser"),
        stopServer: async (value) => cleanup.push(value === server ? "server" : "wrong-server"),
        removeTempVideoDir: async () => cleanup.push("temp"),
      }, async () => cleanup.push("render")),
      /temp failed/,
    )
    assert.deepEqual(cleanup, ["browser", "server"])
  })

  it("aggregates cleanup failures after a successful render", async () => {
    const cleanupErrors = [new Error("browser cleanup"), new Error("server cleanup"), new Error("temp cleanup")]
    await assert.rejects(
      withPreviewResources({
        startServer: async () => ({ pid: 123 }),
        launchBrowser: async () => ({}),
        createTempVideoDir: async () => "temp",
        closeBrowser: async () => { throw cleanupErrors[0] },
        stopServer: async () => { throw cleanupErrors[1] },
        removeTempVideoDir: async () => { throw cleanupErrors[2] },
      }, async () => "rendered"),
      (error) => {
        assert.equal(error instanceof AggregateError, true)
        assert.deepEqual(error.errors, cleanupErrors)
        return true
      },
    )
  })

  it("preserves the render failure when cleanup also fails", async () => {
    const renderError = new Error("render failed")
    await assert.rejects(
      withPreviewResources({
        startServer: async () => ({ pid: 123 }),
        launchBrowser: async () => ({}),
        createTempVideoDir: async () => "temp",
        closeBrowser: async () => { throw new Error("browser cleanup") },
        stopServer: async () => { throw new Error("server cleanup") },
        removeTempVideoDir: async () => { throw new Error("temp cleanup") },
      }, async () => { throw renderError }),
      (error) => error === renderError,
    )
  })

  it("selects the newest usable WinGet FFmpeg candidate independent of directory order", () => {
    const packageRoot = path.join("C:\\", "winget", "ffmpeg")
    const entries = [
      { name: "ffmpeg-6.1-full_build", isDirectory: () => true },
      { name: "unrelated", isDirectory: () => true },
      { name: "ffmpeg-8.0-full_build", isDirectory: () => true },
      { name: "ffmpeg-7.2-full_build", isDirectory: () => true },
    ]
    const available = new Set([
      packageRoot,
      path.join(packageRoot, "ffmpeg-6.1-full_build", "bin", "ffmpeg.exe"),
      path.join(packageRoot, "ffmpeg-7.2-full_build", "bin", "ffmpeg.exe"),
    ])
    const resolve = (directoryEntries) => resolveWinGetMediaTool(packageRoot, "ffmpeg", {
      fileExists: (candidate) => available.has(candidate),
      readDirectory: () => directoryEntries,
    })

    const expected = path.join(packageRoot, "ffmpeg-7.2-full_build", "bin", "ffmpeg.exe")
    assert.equal(resolve(entries), expected)
    assert.equal(resolve([...entries].reverse()), expected)
    assert.equal(resolveWinGetMediaTool("missing", "ffmpeg", {
      fileExists: () => false,
      readDirectory: () => { throw new Error("must not read missing root") },
    }), null)
  })

  it("awaits normal POSIX exit and skips signaling an already-exited child", async () => {
    const child = new EventEmitter()
    child.pid = 42
    child.exitCode = null
    child.signalCode = null
    child.kill = (signal) => {
      assert.equal(signal, "SIGTERM")
      queueMicrotask(() => {
        child.exitCode = 0
        child.emit("exit", 0, null)
      })
      return true
    }
    await stopPreviewServer(child, { platform: "linux", timeoutMs: 50 })
    assert.equal(child.exitCode, 0)

    const exitedChild = { pid: 43, exitCode: 0, signalCode: null, kill: () => assert.fail("must not signal") }
    await stopPreviewServer(exitedChild, { platform: "linux", timeoutMs: 50 })
  })

  it("falls back to SIGKILL after the bounded POSIX grace period", async () => {
    const signals = []
    const child = {
      pid: 44,
      exitCode: null,
      signalCode: null,
      kill: (signal) => { signals.push(signal); return true },
    }
    const waits = [false, true]
    await stopPreviewServer(child, {
      platform: "linux",
      timeoutMs: 1,
      waitForExit: async () => waits.shift(),
    })
    assert.deepEqual(signals, ["SIGTERM", "SIGKILL"])
  })
})
