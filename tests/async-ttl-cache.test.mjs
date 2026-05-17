import test from "node:test"
import assert from "node:assert/strict"
import { createAsyncKeyedTtlCache, createAsyncTtlCache } from "../lib/async-ttl-cache.js"

test("createAsyncTtlCache reuses resolved values until the ttl expires", async () => {
  let now = 1_000
  let loads = 0
  const cache = createAsyncTtlCache({
    ttlMs: 500,
    now: () => now,
    load: async () => {
      loads += 1
      return `value-${loads}`
    },
  })

  assert.equal(await cache.get(), "value-1")
  assert.equal(await cache.get(), "value-1")
  assert.equal(loads, 1)

  now += 501

  assert.equal(await cache.get(), "value-2")
  assert.equal(loads, 2)
})

test("createAsyncTtlCache deduplicates concurrent loads", async () => {
  let loads = 0
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  const cache = createAsyncTtlCache({
    ttlMs: 1_000,
    load: async () => {
      loads += 1
      await pending
      return "ready"
    },
  })

  const first = cache.get()
  const second = cache.get()

  assert.equal(loads, 1)
  release()

  assert.equal(await first, "ready")
  assert.equal(await second, "ready")
  assert.equal(loads, 1)
})

test("createAsyncTtlCache can be cleared explicitly", async () => {
  let loads = 0
  const cache = createAsyncTtlCache({
    ttlMs: 10_000,
    load: async () => {
      loads += 1
      return loads
    },
  })

  assert.equal(await cache.get(), 1)
  cache.clear()
  assert.equal(await cache.get(), 2)
})

test("createAsyncKeyedTtlCache caches and deduplicates per key", async () => {
  let now = 1_000
  let loads = 0
  const cache = createAsyncKeyedTtlCache({
    ttlMs: 500,
    now: () => now,
    load: async (key) => {
      loads += 1
      return `${key}-${loads}`
    },
  })

  assert.equal(await cache.get("user-a"), "user-a-1")
  assert.equal(await cache.get("user-a"), "user-a-1")
  assert.equal(await cache.get("user-b"), "user-b-2")
  assert.equal(loads, 2)

  now += 501

  assert.equal(await cache.get("user-a"), "user-a-3")
  assert.equal(loads, 3)
})

test("createAsyncKeyedTtlCache can clear one key without dropping others", async () => {
  let loads = 0
  const cache = createAsyncKeyedTtlCache({
    ttlMs: 10_000,
    load: async (key) => {
      loads += 1
      return `${key}-${loads}`
    },
  })

  assert.equal(await cache.get("user-a"), "user-a-1")
  assert.equal(await cache.get("user-b"), "user-b-2")

  cache.clear("user-a")

  assert.equal(await cache.get("user-a"), "user-a-3")
  assert.equal(await cache.get("user-b"), "user-b-2")
})
