/**
 * Fetches with a deadline while preserving a caller signal for request sequencing.
 * Caller abort reasons propagate unchanged; an elapsed deadline rejects as TimeoutError.
 */
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 1500) {
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
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    globalThis.clearTimeout(timeoutId)
    callerSignal?.removeEventListener("abort", abortFromCaller)
  }
}
