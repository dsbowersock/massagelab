import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createBoundedGenerativeFmWebProvider,
  createGenerativeFmProviderRequestStats,
  startAbortableGenerativeFmPrewarm,
  waitForAbortableGenerativeFmPrewarm,
} from "../lib/atmosphere/generative-fm-provider.js"

describe("Generative.fm provider wrapper", () => {
  it("aborts a pending lazy runtime consumer without starting stale station preparation", async () => {
    let resolveRuntime
    let runtimeLoadCount = 0
    let stationPreparationCount = 0
    const escapedRejections = []
    const recordEscapedRejection = (reason) => escapedRejections.push(reason)
    const sharedRuntime = {
      prewarmStation: async () => {
        stationPreparationCount += 1
      },
    }
    const sharedRuntimeLoad = new Promise((resolve) => {
      resolveRuntime = resolve
    })
    const loadRuntime = () => {
      runtimeLoadCount += 1
      return sharedRuntimeLoad
    }
    const prewarmStation = async (signal) => {
      const runtime = await startAbortableGenerativeFmPrewarm(loadRuntime, signal)
      signal?.throwIfAborted()
      await runtime.prewarmStation()
    }
    const controller = new AbortController()

    process.on("unhandledRejection", recordEscapedRejection)
    try {
      const stalePrewarm = prewarmStation(controller.signal)
      controller.abort(new DOMException("Category changed", "AbortError"))
      const staleOutcome = await Promise.race([
        stalePrewarm.then(
          () => "resolved",
          (error) => error?.name === "AbortError" ? "aborted" : "rejected",
        ),
        new Promise((resolve) => setTimeout(() => resolve("still-pending"), 25)),
      ])

      assert.equal(staleOutcome, "aborted")
      resolveRuntime(sharedRuntime)
      await sharedRuntimeLoad
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(stationPreparationCount, 0)
      assert.deepEqual(escapedRejections, [])

      await prewarmStation()
      assert.equal(runtimeLoadCount, 2)
      assert.equal(stationPreparationCount, 1)
    } finally {
      process.removeListener("unhandledRejection", recordEscapedRejection)
    }
  })

  it("does not construct preparation for an already-aborted consumer", async () => {
    const controller = new AbortController()
    let preparationStartCount = 0
    controller.abort(new DOMException("Unmounted", "AbortError"))

    await assert.rejects(
      startAbortableGenerativeFmPrewarm(() => {
        preparationStartCount += 1
        return Promise.reject(new Error("stale preparation escaped"))
      }, controller.signal),
      (error) => error?.name === "AbortError",
    )
    assert.equal(preparationStartCount, 0)
  })

  it("returns a rejected promise for an already-aborted shared wait", async () => {
    const controller = new AbortController()
    controller.abort(new DOMException("Unmounted", "AbortError"))

    const wait = waitForAbortableGenerativeFmPrewarm(
      Promise.resolve("unused"),
      controller.signal,
    )

    assert.ok(wait instanceof Promise)
    await assert.rejects(wait, (error) => error?.name === "AbortError")
  })

  it("aborts one prewarm wait without poisoning shared runtime preparation", async () => {
    let resolvePreparation
    const preparedRuntime = { pieceId: "shared-piece" }
    const sharedPreparation = new Promise((resolve) => {
      resolvePreparation = resolve
    })
    const controller = new AbortController()
    let payloadEscalationCount = 0
    const labPrewarm = (async () => {
      await waitForAbortableGenerativeFmPrewarm(sharedPreparation, controller.signal)
      controller.signal.throwIfAborted()
      payloadEscalationCount += 1
    })()

    controller.abort(new DOMException("Category changed", "AbortError"))
    await assert.rejects(labPrewarm, (error) => error?.name === "AbortError")
    resolvePreparation(preparedRuntime)

    assert.equal(await sharedPreparation, preparedRuntime)
    assert.equal(payloadEscalationCount, 0)
    assert.equal(
      await waitForAbortableGenerativeFmPrewarm(sharedPreparation),
      preparedRuntime,
    )
  })

  it("requests uncached sample URLs in bounded batches and preserves caller order", async () => {
    const requests = []
    const fakeBuffers = new Map()
    const stats = createGenerativeFmProviderRequestStats()
    const provider = createBoundedGenerativeFmWebProvider({
      maxBatchSize: 2,
      provider: {
        request: async (_audioContext, urls) => {
          requests.push([...urls])
          return urls.map((url) => {
            const buffer = { url }
            fakeBuffers.set(url, buffer)
            return buffer
          })
        },
      },
      stats,
    })

    const buffers = await provider.request({}, ["a.opus", "b.opus", "c.opus", "b.opus"])

    assert.deepEqual(requests, [["a.opus", "b.opus"], ["c.opus"]])
    assert.deepEqual(buffers, [
      fakeBuffers.get("a.opus"),
      fakeBuffers.get("b.opus"),
      fakeBuffers.get("c.opus"),
      fakeBuffers.get("b.opus"),
    ])
    assert.equal(stats.requestCount, 1)
    assert.equal(stats.requestedUrlCount, 4)
    assert.equal(stats.uniqueUrlCount, 3)
    assert.equal(stats.batchCount, 2)
    assert.equal(stats.maxBatchSize, 2)
  })

  it("reuses decoded buffers for the same audio context", async () => {
    let requestCount = 0
    const audioContext = {}
    const stats = createGenerativeFmProviderRequestStats()
    const provider = createBoundedGenerativeFmWebProvider({
      provider: {
        request: async (_audioContext, urls) => {
          requestCount += 1
          return urls.map((url) => ({ url }))
        },
      },
      stats,
    })

    const firstBuffers = await provider.request(audioContext, ["shared.opus"])
    const secondBuffers = await provider.request(audioContext, ["shared.opus"])

    assert.equal(requestCount, 1)
    assert.equal(secondBuffers[0], firstBuffers[0])
    assert.equal(stats.memoryHitUrlCount, 1)
  })

  it("reports sample progress as batches complete", async () => {
    const progressEvents = []
    const provider = createBoundedGenerativeFmWebProvider({
      maxBatchSize: 2,
      onSampleProgress: (progress) => progressEvents.push(progress),
      provider: {
        request: async (_audioContext, urls) => urls.map((url) => ({ url })),
      },
    })

    await provider.request({}, ["one.opus", "two.opus", "three.opus"])

    assert.deepEqual(progressEvents, [
      { loadedUniqueUrlCount: 0, totalUniqueUrlCount: 3, memoryHitUrlCount: 0 },
      { loadedUniqueUrlCount: 2, totalUniqueUrlCount: 3, memoryHitUrlCount: 0 },
      { loadedUniqueUrlCount: 3, totalUniqueUrlCount: 3, memoryHitUrlCount: 0 },
    ])
  })

  it("passes through provider request failures", async () => {
    const provider = createBoundedGenerativeFmWebProvider({
      provider: {
        request: async () => {
          throw new Error("decode failed")
        },
      },
    })

    await assert.rejects(
      () => provider.request({}, ["bad.opus"]),
      /decode failed/,
    )
  })

  it("rejects provider responses that cannot be mapped back to requested URLs", async () => {
    const shortResponseProvider = createBoundedGenerativeFmWebProvider({
      provider: {
        request: async () => [],
      },
    })
    const invalidBufferProvider = createBoundedGenerativeFmWebProvider({
      provider: {
        request: async () => [undefined],
      },
    })

    await assert.rejects(
      () => shortResponseProvider.request({}, ["missing.opus"]),
      /Provider returned 0 buffers but expected 1/,
    )
    await assert.rejects(
      () => invalidBufferProvider.request({}, ["invalid.opus"]),
      /Provider returned an invalid buffer at index 0 for invalid\.opus/,
    )
  })
})
