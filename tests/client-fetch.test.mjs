import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  fetchJsonResponseWithTimeout,
  fetchJsonWithTimeout,
  fetchWithTimeout,
} from "../lib/client-fetch.ts"

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

    callerController.abort(new DOMException("Too late", "AbortError"))
    assert.equal(injectedInit.signal.aborted, false)
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

describe("fetchJsonResponseWithTimeout", () => {
  it("preserves valid non-OK JSON and response headers", async () => {
    const result = await fetchJsonResponseWithTimeout(
      "/limited",
      {},
      100,
      async () => new Response(JSON.stringify({ error: "Please wait." }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "Retry-After": "7",
        },
      }),
    )

    assert.equal(result.response.status, 429)
    assert.equal(result.response.headers.get("Retry-After"), "7")
    assert.deepEqual(result.json, { error: "Please wait." })
  })

  it("preserves malformed or empty non-OK responses with undefined JSON", async () => {
    for (const body of ["{", ""]) {
      const result = await fetchJsonResponseWithTimeout(
        "/invalid-error-body",
        {},
        100,
        async () => new Response(body, { status: 503, headers: { "Retry-After": "9" } }),
      )

      assert.equal(result.response.status, 503)
      assert.equal(result.response.headers.get("Retry-After"), "9")
      assert.equal(result.json, undefined)
    }
  })

  it("settles a stalled non-OK body at the deadline while preserving its response", { timeout: 250 }, async () => {
    const response = {
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "8" }),
    }
    const result = await fetchJsonResponseWithTimeout(
      "/stalled-error-body",
      {},
      10,
      async (_input, init = {}) => {
        response.json = () => new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
        })
        return response
      },
    )

    assert.equal(result.response, response)
    assert.equal(result.response.status, 429)
    assert.equal(result.response.headers.get("Retry-After"), "8")
    assert.equal(result.json, undefined)
  })

  it("preserves a caller abort during a stalled non-OK body", { timeout: 250 }, async () => {
    const controller = new AbortController()
    const callerReason = new DOMException("The caller moved on.", "AbortError")
    let markBodyStarted = () => {}
    const bodyStarted = new Promise((resolve) => { markBodyStarted = resolve })
    const pending = fetchJsonResponseWithTimeout(
      "/stalled-error-body",
      { signal: controller.signal },
      100,
      async (_input, init = {}) => ({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "8" }),
        json: () => new Promise((_resolve, reject) => {
          markBodyStarted()
          init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
        }),
      }),
    )

    await bodyStarted
    controller.abort(callerReason)

    await assert.rejects(pending, (error) => error === callerReason)
  })

  it("rejects a stalled successful body with TimeoutError", { timeout: 250 }, async () => {
    await assert.rejects(
      fetchJsonResponseWithTimeout(
        "/stalled-success-body",
        {},
        10,
        async (_input, init = {}) => ({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
          }),
        }),
      ),
      (error) => error instanceof DOMException && error.name === "TimeoutError",
    )
  })

  it("rejects a stalled transport with TimeoutError", { timeout: 250 }, async () => {
    await assert.rejects(
      fetchJsonResponseWithTimeout(
        "/stalled-transport",
        {},
        10,
        async (_input, init = {}) => new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
        }),
      ),
      (error) => error instanceof DOMException && error.name === "TimeoutError",
    )
  })
})
