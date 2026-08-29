#!/usr/bin/env node

import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { dirname, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { pathToFileURL } from "node:url"

import {
  ANONYMOUS_REQUEST_TIMEOUT_MS,
  fetchAnonymousHtml,
  formatReadinessTimingSummary,
  measureReadinessRoutes,
  parseReadinessTimingArgs,
} from "./family-friends-route-timings.mjs"

const READINESS_TIMEOUT_MS = 60_000
const READINESS_REQUEST_TIMEOUT_MS = 5_000
const STOP_TIMEOUT_MS = 5_000
const OUTPUT_BUFFER_LIMIT = 64 * 1024
const ownedChildLifecycles = new WeakMap()

/**
 * Probes one loopback port without contacting the application. The temporary
 * listener is closed before returning so an occupied port aborts before build.
 */
export async function checkReadinessPortAvailable({ hostname, port }) {
  return new Promise((resolvePromise, reject) => {
    const server = createServer()
    server.unref()
    server.once("error", (error) => {
      if (error?.code === "EADDRINUSE" || error?.code === "EACCES") {
        resolvePromise(false)
        return
      }
      reject(new Error("Unable to verify the timing receipt port."))
    })
    server.listen({ host: hostname, port, exclusive: true }, () => {
      server.close((error) => {
        if (error) {
          reject(new Error("Unable to release the timing receipt port probe."))
          return
        }
        resolvePromise(true)
      })
    })
  })
}

/** Captures bounded child output for diagnostics without printing it. */
function bufferChildOutput(child) {
  let buffered = ""
  const append = (chunk) => {
    buffered = `${buffered}${String(chunk)}`.slice(-OUTPUT_BUFFER_LIMIT)
  }
  child.stdout?.on("data", append)
  child.stderr?.on("data", append)
  return () => buffered
}

function waitForChild(child) {
  return new Promise((resolvePromise, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => resolvePromise({ code, signal }))
  })
}

function ownedChildLifecycle(child) {
  const existing = ownedChildLifecycles.get(child)
  if (existing) return existing

  let hasSpawned = false
  let isSettled = false
  let settledResult = null
  let resolveSettlement
  let resolveStarted
  let rejectStarted
  const settlement = new Promise((resolvePromise) => {
    resolveSettlement = resolvePromise
  })
  const started = new Promise((resolvePromise, reject) => {
    resolveStarted = resolvePromise
    rejectStarted = reject
  })
  // Teardown may begin with an injected child that was not started through
  // this helper. Keep that unused startup branch from becoming unhandled.
  started.catch(() => {})
  const settle = (result) => {
    if (isSettled) return
    isSettled = true
    settledResult = result
    resolveSettlement(result)
  }

  child.once("spawn", () => {
    if (isSettled) return
    hasSpawned = true
    resolveStarted(child)
  })
  // Keep this observer for the whole owned lifecycle. ChildProcess can emit an
  // error after its initial spawn, including from a Windows kill operation.
  child.on("error", () => {
    settle({ kind: "error" })
    if (!hasSpawned) {
      rejectStarted(new Error("Fresh production server failed to spawn."))
    }
  })
  child.once("exit", (code, signal) => {
    settle({ kind: "exit", code, signal })
    if (!hasSpawned) {
      rejectStarted(new Error("Fresh production server exited before spawn."))
    }
  })

  const lifecycle = {
    isSettled: () => isSettled,
    result: () => settledResult,
    settlement,
    started,
  }
  ownedChildLifecycles.set(child, lifecycle)

  if (child.exitCode !== null || child.signalCode !== null) {
    settle({ kind: "exit", code: child.exitCode, signal: child.signalCode })
    rejectStarted(new Error("Fresh production server exited before spawn."))
  }
  return lifecycle
}

/** Awaits the real ChildProcess spawn event while retaining lifecycle observers. */
export function superviseOwnedChild(child) {
  return ownedChildLifecycle(child).started
}

/** Resolves with sanitized error-or-exit evidence for exactly one owned child. */
export function waitForOwnedChildSettlement(child) {
  return ownedChildLifecycle(child).settlement
}

/** Runs a child to completion while keeping its output out of the receipt. */
async function runBufferedChild(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  bufferChildOutput(child)
  const result = await waitForChild(child)
  if (result.code !== 0) {
    throw new Error("Buffered child process failed.")
  }
}

/** Builds the current checkout through the repository's canonical build script. */
export function resolveBuildCommand({
  nodeExecutable = process.execPath,
  npmCli = process.env.npm_execpath || resolve(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  ),
} = {}) {
  return {
    command: nodeExecutable,
    args: [npmCli, "run", "build"],
  }
}

export async function buildCurrentHead() {
  const { command, args } = resolveBuildCommand()
  await runBufferedChild(command, args)
}

/** Starts the just-built Next production server as one directly owned process. */
export async function startBuiltServer({
  hostname,
  port,
  spawnImpl = spawn,
  nodeExecutable = process.execPath,
  nextCli = resolve("node_modules", "next", "dist", "bin", "next"),
}) {
  let child
  try {
    child = spawnImpl(nodeExecutable, [
      nextCli,
      "start",
      "--hostname",
      hostname,
      "--port",
      String(port),
    ], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
  } catch {
    throw new Error("Fresh production server failed to spawn.")
  }
  bufferChildOutput(child)
  return superviseOwnedChild(child)
}

/** Waits at most one minute for the anonymous root route to answer. */
export async function waitForBuiltServer({
  baseUrl,
  timeoutMs = READINESS_TIMEOUT_MS,
  requestTimeoutMs = READINESS_REQUEST_TIMEOUT_MS,
  fetchImpl = fetch,
  clock = () => Date.now(),
  delayImpl = delay,
}) {
  const deadline = clock() + timeoutMs
  while (clock() < deadline) {
    try {
      const remainingMs = Math.max(1, deadline - clock())
      await fetchAnonymousHtml({
        url: new URL("/", baseUrl),
        fetchImpl,
        timeoutMs: Math.min(requestTimeoutMs, remainingMs),
      })
      return
    } catch {
      const remainingMs = deadline - clock()
      if (remainingMs <= 0) break
      await delayImpl(Math.min(200, remainingMs))
    }
  }
  throw new Error("Timing server readiness timed out.")
}

/** Terminates and awaits only the production server created by this receipt. */
export async function stopBuiltServer(child, {
  timeoutMs = STOP_TIMEOUT_MS,
  delayImpl = delay,
} = {}) {
  const lifecycle = ownedChildLifecycle(child)
  if (lifecycle.isSettled() || child.exitCode !== null || child.signalCode !== null) {
    const outcome = lifecycle.result() ?? await lifecycle.settlement
    if (outcome.kind === "error") {
      throw new Error("Owned timing server stop failed.")
    }
    return
  }

  try {
    child.kill("SIGTERM")
  } catch {
    throw new Error("Owned timing server stop failed.")
  }
  const gracefulOutcome = await Promise.race([
    lifecycle.settlement,
    delayImpl(timeoutMs).then(() => null),
  ])
  if (gracefulOutcome?.kind === "exit") return
  if (gracefulOutcome?.kind === "error") {
    throw new Error("Owned timing server stop failed.")
  }

  try {
    child.kill("SIGKILL")
  } catch {
    throw new Error("Owned timing server stop failed.")
  }
  const forcedOutcome = await Promise.race([
    lifecycle.settlement,
    delayImpl(timeoutMs).then(() => null),
  ])
  if (forcedOutcome?.kind !== "exit") {
    throw new Error("Owned timing server stop failed.")
  }
}

async function runWhileOwnedChildLives(operation, child) {
  const lifecycle = ownedChildLifecycles.get(child)
  if (!lifecycle) return operation
  return Promise.race([
    operation,
    lifecycle.settlement.then(() => {
      throw new Error("Owned timing server stopped unexpectedly.")
    }),
  ])
}

/**
 * Creates a self-contained receipt from a fresh production build. All side
 * effects are injectable so unit tests never build, listen, or contact Next.
 */
export async function runFamilyFriendsTimingReceipt({
  args = process.argv.slice(2),
  checkPortAvailable = checkReadinessPortAvailable,
  runBuild = buildCurrentHead,
  startServer = startBuiltServer,
  waitForReadiness = waitForBuiltServer,
  measureRoutes = measureReadinessRoutes,
  stopOwnedServer = stopBuiltServer,
  writeSummary = (summary) => process.stdout.write(`${summary}\n`),
} = {}) {
  const { baseUrl, samples } = parseReadinessTimingArgs(args)
  const parsedBaseUrl = new URL(baseUrl)
  const hostname = parsedBaseUrl.hostname
  const port = Number(parsedBaseUrl.port || (parsedBaseUrl.protocol === "https:" ? 443 : 80))

  let portAvailable
  try {
    portAvailable = await checkPortAvailable({ hostname, port })
  } catch {
    throw new Error("Unable to verify the timing receipt port.")
  }
  if (!portAvailable) {
    throw new Error("Timing receipt port is already in use.")
  }

  try {
    await runBuild()
  } catch {
    throw new Error("Fresh production build failed.")
  }

  let ownedChild = null
  let results
  try {
    try {
      ownedChild = await startServer({ hostname, port })
    } catch {
      throw new Error("Fresh production server failed to start.")
    }
    try {
      await runWhileOwnedChildLives(
        waitForReadiness({ baseUrl, timeoutMs: READINESS_TIMEOUT_MS }),
        ownedChild,
      )
    } catch {
      throw new Error("Timing server did not become ready.")
    }
    try {
      results = await runWhileOwnedChildLives(
        measureRoutes({
          baseUrl,
          samples,
          requestTimeoutMs: ANONYMOUS_REQUEST_TIMEOUT_MS,
        }),
        ownedChild,
      )
    } catch {
      throw new Error("Anonymous route timing failed.")
    }
  } finally {
    if (ownedChild) {
      try {
        await stopOwnedServer(ownedChild)
      } catch {
        throw new Error("Owned timing server did not stop cleanly.")
      }
    }
  }

  writeSummary(formatReadinessTimingSummary(results))
  return results
}

async function main() {
  await runFamilyFriendsTimingReceipt()
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Timing receipt failed.")
    process.exitCode = 1
  })
}
