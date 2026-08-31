import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { describe, it } from "node:test"
import {
  assertSpecializedProviderImportSurface,
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
      assert.equal(result.firstConsumer.profileGets, 1)
      assert.equal(result.firstConsumer.calendarGets, 0)
      assert.equal(result.concurrentConsumer.profileGets, 1)
      assert.deepEqual(result.hydrated.consumerNames, [
        "Synthetic Therapist",
        "Synthetic Therapist",
      ])
      assert.equal(result.practiceEnabled.calendarGets, 1)
      assert.equal(result.practiceEnabled.practiceId, "practice-inert")
      assert.deepEqual(result.practiceEnabled.errors, [])
    } finally {
      await browser.close()
    }
  })
})
