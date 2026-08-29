import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { describe, it } from "node:test"
import { exerciseSpecializedProviderHarness } from "./helpers/specialized-provider-browser-harness.mjs"

const require = createRequire(import.meta.url)

describe("specialized account-shell provider browser harness", () => {
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
