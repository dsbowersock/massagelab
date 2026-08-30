import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  READINESS_TIMING_ROUTES,
  formatReadinessTimingSummary,
  measureReadinessRoutes,
  parseReadinessTimingArgs,
} from "../scripts/family-friends-route-timings.mjs"

describe("family-and-friends route timings", () => {
  it("uses a fixed anonymous launch-route allowlist and bounded samples", () => {
    assert.deepEqual(READINESS_TIMING_ROUTES, [
      "/", "/login", "/register", "/pricing", "/clock", "/music", "/account",
    ])
    assert.deepEqual(parseReadinessTimingArgs([
      "--base-url=http://127.0.0.1:3010",
      "--samples=3",
    ]), {
      baseUrl: "http://127.0.0.1:3010",
      samples: 3,
    })
    assert.throws(() => parseReadinessTimingArgs(["--samples=0"]), /between 1 and 10/)
    assert.throws(
      () => parseReadinessTimingArgs(["--base-url=https://example.com"]),
      /loopback/,
    )
  })

  it("labels the first and warm samples without logging bodies or caller URLs", async () => {
    const calls = []
    let tick = 0
    const results = await measureReadinessRoutes({
      baseUrl: "http://127.0.0.1:3010",
      samples: 2,
      clock: () => { tick += 7; return tick },
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        return { status: 200, arrayBuffer: async () => new ArrayBuffer(0) }
      },
    })

    assert.equal(calls.length, READINESS_TIMING_ROUTES.length * 2)
    assert.deepEqual(results.slice(0, 2).map(({ sampleKind }) => sampleKind), ["first", "warm"])
    assert.equal(calls.every(({ init }) => (
      init.method === "GET"
      && init.redirect === "follow"
      && init.headers.accept === "text/html"
      && !Object.hasOwn(init.headers, "cookie")
      && !Object.hasOwn(init.headers, "authorization")
    )), true)

    const summary = formatReadinessTimingSummary(results)
    assert.equal(summary.split("\n").length, READINESS_TIMING_ROUTES.length * 2)
    assert.doesNotMatch(summary, /cookie|authorization|response body|cold|\?/i)
    assert.equal(results.every(({ durationMs }) => Number.isInteger(durationMs)), true)
  })

  it("rejects unsuccessful route responses after consuming their bodies", async () => {
    for (const status of [500, 503]) {
      let bodyReads = 0

      await assert.rejects(measureReadinessRoutes({
        baseUrl: "http://127.0.0.1:3010",
        samples: 1,
        fetchImpl: async () => ({
          status,
          arrayBuffer: async () => {
            bodyReads += 1
            return new ArrayBuffer(0)
          },
        }),
      }), /Anonymous route timing request failed/)

      assert.equal(bodyReads, 1, `HTTP ${status} response body`)
    }
  })

  it("aborts and safely rejects a stalled route connection at its per-request deadline", async () => {
    let requestSignal

    await assert.rejects(measureReadinessRoutes({
      baseUrl: "http://127.0.0.1:3010",
      samples: 1,
      requestTimeoutMs: 5,
      fetchImpl: async (_url, init) => {
        requestSignal = init.signal
        assert.ok(requestSignal, "the anonymous request must receive an abort signal")
        return new Promise(() => {})
      },
    }), /Anonymous route timing request timed out/)

    assert.equal(requestSignal?.aborted, true)
  })

  it("aborts and safely rejects when the response body stalls", async () => {
    let requestSignal

    await assert.rejects(measureReadinessRoutes({
      baseUrl: "http://127.0.0.1:3010",
      samples: 1,
      requestTimeoutMs: 5,
      fetchImpl: async (_url, init) => {
        requestSignal = init.signal
        return {
          status: 200,
          arrayBuffer: async () => {
            assert.ok(requestSignal, "the response body must share the request abort signal")
            return new Promise(() => {})
          },
        }
      },
    }), /Anonymous route timing request timed out/)

    assert.equal(requestSignal?.aborted, true)
  })
})
