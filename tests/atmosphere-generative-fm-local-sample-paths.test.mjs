import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isIgnoredSampleInventoryPath } from "../lib/atmosphere/generative-fm-local-sample-paths.js"

describe("Generative.fm local sample paths", () => {
  it("ignores macOS archive sidecars at root and nested paths", () => {
    assert.equal(isIgnoredSampleInventoryPath("__macosx/signature samples/sample.wav"), true)
    assert.equal(isIgnoredSampleInventoryPath("signature samples/__macosx/sample.wav"), true)
    assert.equal(isIgnoredSampleInventoryPath("signature samples/._sample.wav"), true)
    assert.equal(isIgnoredSampleInventoryPath("signature samples/sample.wav"), false)
  })
})
