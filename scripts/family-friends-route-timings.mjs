#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

export const ANONYMOUS_REQUEST_TIMEOUT_MS = 15_000

export const READINESS_TIMING_ROUTES = Object.freeze([
  "/", "/login", "/register", "/pricing", "/clock", "/music", "/account",
])

/**
 * Parses the privacy-safe timing surface. Measurements are intentionally
 * restricted to a fixed route list, a loopback origin, and at most ten samples.
 */
export function parseReadinessTimingArgs(args) {
  const values = Object.fromEntries(args.map((argument) => {
    const [key, value = ""] = argument.split("=", 2)
    return [key, value]
  }))
  const baseUrl = values["--base-url"] || "http://127.0.0.1:3010"
  const parsedUrl = new URL(baseUrl)
  if (!["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
    throw new Error("Route timing is restricted to a loopback base URL.")
  }
  const samples = Number(values["--samples"] || 3)
  if (!Number.isInteger(samples) || samples < 1 || samples > 10) {
    throw new Error("--samples must be between 1 and 10.")
  }
  return { baseUrl: parsedUrl.origin, samples }
}

/**
 * Completes one successful anonymous HTML request within a fixed deadline. The
 * same abort signal covers connection and body consumption; unsuccessful HTTP
 * responses reject before they can become readiness timing samples.
 */
export async function fetchAnonymousHtml({
  url,
  fetchImpl = fetch,
  timeoutMs = ANONYMOUS_REQUEST_TIMEOUT_MS,
  createAbortController = () => new AbortController(),
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  const controller = createAbortController()
  let timedOut = false
  let timeoutId
  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeoutImpl(() => {
      timedOut = true
      reject(new Error("Anonymous route timing request timed out."))
      controller.abort()
    }, timeoutMs)
  })
  const request = (async () => {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      headers: { accept: "text/html" },
      signal: controller.signal,
    })
    const status = response.status
    await response.arrayBuffer()
    if (status < 200 || status >= 300) throw new Error("Anonymous route response was unsuccessful.")
    return { status }
  })()

  try {
    return await Promise.race([request, deadline])
  } catch {
    if (timedOut || controller.signal.aborted) {
      throw new Error("Anonymous route timing request timed out.")
    }
    throw new Error("Anonymous route timing request failed.")
  } finally {
    clearTimeoutImpl(timeoutId)
    // This also cancels a response body that won the race after its deadline.
    controller.abort()
  }
}

/**
 * Times anonymous GETs without sending account state or retaining response
 * content. The injected fetch and clock make the request contract repeatable.
 */
export async function measureReadinessRoutes({
  baseUrl,
  samples,
  fetchImpl = fetch,
  clock = () => performance.now(),
  requestTimeoutMs = ANONYMOUS_REQUEST_TIMEOUT_MS,
}) {
  const results = []
  for (const route of READINESS_TIMING_ROUTES) {
    for (let sample = 1; sample <= samples; sample += 1) {
      const startedAt = clock()
      const response = await fetchAnonymousHtml({
        url: new URL(route, baseUrl),
        fetchImpl,
        timeoutMs: requestTimeoutMs,
      })
      results.push({
        route,
        sampleKind: sample === 1 ? "first" : "warm",
        sample,
        status: response.status,
        durationMs: Math.max(0, Math.round(clock() - startedAt)),
      })
    }
  }
  return results
}

/** Formats only the allowlisted route and aggregate timing fields. */
export function formatReadinessTimingSummary(results) {
  return results.map((result) => [
    result.route,
    result.sampleKind,
    `sample=${result.sample}`,
    `status=${result.status}`,
    `durationMs=${result.durationMs}`,
  ].join(" ")).join("\n")
}

async function main() {
  const options = parseReadinessTimingArgs(process.argv.slice(2))
  console.log(formatReadinessTimingSummary(await measureReadinessRoutes(options)))
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Route timing failed.")
    process.exitCode = 1
  })
}
