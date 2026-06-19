import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createBoundedGenerativeFmWebProvider,
  createGenerativeFmProviderRequestStats,
} from "../lib/atmosphere/generative-fm-provider.js"

describe("Generative.fm provider wrapper", () => {
  it("requests uncached sample URLs in bounded batches and preserves caller order", async () => {
    const requests = []
    const stats = createGenerativeFmProviderRequestStats()
    const provider = createBoundedGenerativeFmWebProvider({
      maxBatchSize: 2,
      provider: {
        request: async (_audioContext, urls) => {
          requests.push([...urls])
          return urls.map((url) => `buffer:${url}`)
        },
      },
      stats,
    })

    const buffers = await provider.request({}, ["a.opus", "b.opus", "c.opus", "b.opus"])

    assert.deepEqual(requests, [["a.opus", "b.opus"], ["c.opus"]])
    assert.deepEqual(buffers, ["buffer:a.opus", "buffer:b.opus", "buffer:c.opus", "buffer:b.opus"])
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
        request: async (_audioContext, urls) => urls.map((url) => `buffer:${url}`),
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
})
