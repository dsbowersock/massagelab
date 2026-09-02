import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { describe, it } from "node:test"
import {
  assertSpecializedProviderImportSurface,
  createSpecializedProviderBundleLoader,
  exerciseSpecializedProviderHarness,
} from "./helpers/specialized-provider-browser-harness.mjs"

const require = createRequire(import.meta.url)

describe("specialized account-shell provider browser harness", () => {
  it("rejects unsupported provider imports before webpack resolution", () => {
    assert.doesNotThrow(() => assertSpecializedProviderImportSurface(
      'import React from "react"; import { fetchJsonWithTimeout } from "@/lib/client-fetch";',
      "supported provider",
    ))
    assert.throws(
      () => assertSpecializedProviderImportSurface(
        'import value from "@/lib/unsupported-provider-dependency";',
        "unsupported provider",
      ),
      /Unsupported specialized provider import in unsupported provider: @\/lib\/unsupported-provider-dependency/,
    )
  })

  it("shares and caches a successful bundle build", { timeout: 1_000 }, async () => {
    let builds = 0
    let resolveBuild
    let markBuildStarted
    const buildStarted = new Promise((resolve) => { markBuildStarted = resolve })
    const loadBundle = createSpecializedProviderBundleLoader(() => {
      builds += 1
      markBuildStarted()
      return new Promise((resolve) => {
        resolveBuild = resolve
      })
    })

    const first = loadBundle()
    const concurrent = loadBundle()
    assert.equal(concurrent, first)
    assert.equal(builds, 0)

    await buildStarted
    assert.equal(builds, 1)
    resolveBuild("compiled bundle")
    assert.equal(await first, "compiled bundle")
    assert.equal(loadBundle(), first)
    assert.equal(builds, 1)
  })

  it("clears the exact failed build so the next load retries and caches success", async () => {
    let builds = 0
    const loadBundle = createSpecializedProviderBundleLoader(async () => {
      builds += 1
      if (builds === 1) throw new Error("synthetic bundle failure")
      return "recovered bundle"
    })

    const failed = loadBundle()
    await assert.rejects(failed, /synthetic bundle failure/)
    const retry = loadBundle()
    assert.notEqual(retry, failed)
    assert.equal(await retry, "recovered bundle")
    assert.equal(loadBundle(), retry)
    assert.equal(builds, 2)
  })

  it("surfaces an early bundle page error and removes its temporary listener", {
    timeout: 10_000,
  }, async () => {
    const { chromium } = require("playwright")
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      page.setDefaultTimeout(250)
      await page.addInitScript(() => {
        Object.defineProperty(window, "__specializedProviderBootstrap", {
          configurable: true,
          set() {
            throw new Error("synthetic specialized-provider bundle evaluation failure")
          },
        })
      })
      const initialPageErrorListeners = page.listenerCount("pageerror")

      await assert.rejects(
        exerciseSpecializedProviderHarness(page),
        (error) => (
          error instanceof Error
          && error.message === "synthetic specialized-provider bundle evaluation failure"
        ),
      )
      assert.equal(page.listenerCount("pageerror"), initialPageErrorListeners)
    } finally {
      await browser.close()
    }
  })

  it("defers profile and calendar reads until their real consumers require them", {
    timeout: 45_000,
  }, async () => {
    const { chromium } = require("playwright")
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      const result = await exerciseSpecializedProviderHarness(page)

      assert.equal(result.mounted.profileGets, 0)
      assert.equal(result.mounted.calendarGets, 0)
      assert.deepEqual(result.mounted.profileTimeouts, [])
      assert.deepEqual(result.mounted.calendarTimeouts, [])
      assert.equal(result.firstConsumer.profileGets, 1)
      assert.equal(result.firstConsumer.calendarGets, 0)
      assert.deepEqual(result.firstConsumer.profileTimeouts, [10_000])
      assert.deepEqual(result.firstConsumer.calendarTimeouts, [])
      assert.equal(result.concurrentConsumer.profileGets, 1)
      assert.deepEqual(result.concurrentConsumer.profileTimeouts, [10_000])
      assert.deepEqual(result.hydrated.consumerNames, [
        "Synthetic Therapist",
        "Synthetic Therapist",
      ])
      assert.equal(result.practiceEnabled.calendarGets, 1)
      assert.deepEqual(result.practiceEnabled.calendarTimeouts, [10_000])
      assert.equal(result.practiceEnabled.practiceId, "practice-inert")
      assert.deepEqual(result.practiceEnabled.errors, [])
    } finally {
      await browser.close()
    }
  })
})
