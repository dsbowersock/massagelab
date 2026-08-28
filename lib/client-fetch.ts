/** Runs fetch plus caller-owned response consumption under one abort deadline. */
async function runWithFetchDeadline<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response) => Promise<T> | T,
) {
  const controller = new AbortController()
  const callerSignal = init.signal
  const abortFromCaller = () => controller.abort(callerSignal?.reason)

  if (callerSignal?.aborted) {
    abortFromCaller()
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true })
  }

  const timeoutId = globalThis.setTimeout(
    () => controller.abort(new DOMException("Request timed out.", "TimeoutError")),
    timeoutMs,
  )

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    return await consume(response)
  } finally {
    globalThis.clearTimeout(timeoutId)
    callerSignal?.removeEventListener("abort", abortFromCaller)
  }
}

/**
 * Fetches with a deadline while preserving a caller signal for request sequencing.
 * Caller abort reasons propagate unchanged; an elapsed deadline rejects as TimeoutError.
 */
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 1500) {
  return runWithFetchDeadline(input, init, timeoutMs, (response) => response)
}

/**
 * Fetches and parses a successful JSON response under one shared deadline.
 * Non-OK responses remain available to the caller without consuming their body.
 */
export async function fetchJsonWithTimeout<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 1500,
) {
  return runWithFetchDeadline(input, init, timeoutMs, async (response) => ({
    response,
    json: response.ok ? await response.json() as T : undefined,
  }))
}
