import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fetchWithTimeout } from "../lib/client-fetch.ts"

function installStalledFetch() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (_input, init = {}) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
  })
  return () => {
    globalThis.fetch = originalFetch
  }
}

describe("fetchWithTimeout", () => {
  it("times out a stalled request even when the caller supplies a sequencing signal", { timeout: 250 }, async () => {
    const restoreFetch = installStalledFetch()
    const sequencingController = new AbortController()

    try {
      await assert.rejects(
        fetchWithTimeout("/stalled", { signal: sequencingController.signal }, 10),
        (error) => error instanceof DOMException && error.name === "TimeoutError",
      )
      assert.equal(sequencingController.signal.aborted, false)
    } finally {
      restoreFetch()
    }
  })

  it("preserves caller aborts for request sequencing", async () => {
    const restoreFetch = installStalledFetch()
    const sequencingController = new AbortController()

    try {
      const pendingRequest = fetchWithTimeout(
        "/superseded",
        { signal: sequencingController.signal },
        1_000,
      )
      sequencingController.abort(new DOMException("Superseded", "AbortError"))
      await assert.rejects(
        pendingRequest,
        (error) => error instanceof DOMException && error.name === "AbortError",
      )
    } finally {
      restoreFetch()
    }
  })
})
