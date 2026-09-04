import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fetchJsonWithTimeout, fetchWithTimeout } from "../lib/client-fetch.ts"

function installStalledFetch() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (_input, init = {}) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
  })
  return () => {
    globalThis.fetch = originalFetch
  }
}

/** Installs a response whose JSON reader settles only when its request signal aborts. */
function installStalledJsonFetch() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (_input, init = {}) => Promise.resolve({
    ok: true,
    json: () => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
    }),
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

describe("fetchJsonWithTimeout", () => {
  it("uses an injected fetch implementation", async () => {
    const input = "data:application/json,%7B%22source%22%3A%22global%22%7D"
    const callerController = new AbortController()
    let injectedFetchCalls = 0
    let injectedInput
    let injectedInit

    const result = await fetchJsonWithTimeout(
      input,
      { signal: callerController.signal },
      100,
      async (receivedInput, receivedInit) => {
        injectedFetchCalls += 1
        injectedInput = receivedInput
        injectedInit = receivedInit
        return new Response(JSON.stringify({ source: "injected" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      },
    )

    assert.equal(injectedFetchCalls, 1)
    assert.ok(injectedInit?.signal instanceof AbortSignal)
    assert.notEqual(injectedInit.signal, callerController.signal)
    assert.equal(injectedInit.signal.aborted, false)
    assert.equal(injectedInput, input)
    assert.deepEqual(result.json, { source: "injected" })
  })

  it("keeps the request deadline active while a successful response body is read", { timeout: 250 }, async () => {
    const restoreFetch = installStalledJsonFetch()

    try {
      await assert.rejects(
        fetchJsonWithTimeout("/stalled-body", {}, 10),
        (error) => error instanceof DOMException && error.name === "TimeoutError",
      )
    } finally {
      restoreFetch()
    }
  })
})
