#!/usr/bin/env node

import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { dirname, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { pathToFileURL } from "node:url"

import {
  formatReadinessTimingSummary,
  measureReadinessRoutes,
  parseReadinessTimingArgs,
} from "./family-friends-route-timings.mjs"

const READINESS_TIMEOUT_MS = 60_000
const STOP_TIMEOUT_MS = 5_000
const OUTPUT_BUFFER_LIMIT = 64 * 1024

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
export async function startBuiltServer({ hostname, port }) {
  const nextCli = resolve("node_modules", "next", "dist", "bin", "next")
  const child = spawn(process.execPath, [
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
  bufferChildOutput(child)
  return child
}

/** Waits at most one minute for the anonymous root route to answer. */
export async function waitForBuiltServer({
  baseUrl,
  timeoutMs = READINESS_TIMEOUT_MS,
  fetchImpl = fetch,
  clock = () => Date.now(),
  delayImpl = delay,
}) {
  const deadline = clock() + timeoutMs
  while (clock() < deadline) {
    try {
      const response = await fetchImpl(new URL("/", baseUrl), {
        method: "GET",
        redirect: "follow",
        headers: { accept: "text/html" },
      })
      await response.arrayBuffer()
      return
    } catch {
      await delayImpl(200)
    }
  }
  throw new Error("Timing server readiness timed out.")
}

function ownedChildExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }
  return new Promise((resolvePromise) => child.once("exit", resolvePromise))
}

/** Terminates and awaits only the production server created by this receipt. */
export async function stopBuiltServer(child) {
  const exited = ownedChildExit(child)
  if (child.exitCode !== null || child.signalCode !== null) {
    await exited
    return
  }

  child.kill("SIGTERM")
  const stopped = await Promise.race([
    exited.then(() => true),
    delay(STOP_TIMEOUT_MS).then(() => false),
  ])
  if (!stopped) {
    child.kill("SIGKILL")
    await exited
  }
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
      await waitForReadiness({ baseUrl, timeoutMs: READINESS_TIMEOUT_MS })
    } catch {
      throw new Error("Timing server did not become ready.")
    }
    try {
      results = await measureRoutes({ baseUrl, samples })
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
