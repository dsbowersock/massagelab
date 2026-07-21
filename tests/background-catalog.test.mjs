import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BACKGROUND_SAVED_IDS_STORAGE_KEY,
  BACKGROUND_VISUAL_FILTERS,
  getBackgroundPreviewMedia,
  getBackgroundVisualTags,
  matchesBackgroundVisualFilter,
  parseSavedBackgroundIds,
  readSavedBackgroundIds,
  writeSavedBackgroundIds,
} from "../lib/background-catalog.js"

const videoBackground = {
  id: "video",
  label: "Video field",
  provider: "MassageLab",
  sourceUrl: "https://example.test/demo",
  recommendedUse: "Animated ambient field",
  customizationSummary: "Interactive WebGL shader",
  motionIntensity: "medium",
  requiresSubscription: true,
  previewImageUrl: "/poster.webp",
  previewVideoUrl: "/preview.mp4",
}

describe("Background catalog helpers", () => {
  it("keeps the approved filter order", () => {
    assert.deepEqual(BACKGROUND_VISUAL_FILTERS.map(({ value }) => value), [
      "all", "static", "animated", "interactive", "shader",
      "image", "video", "premium", "saved",
    ])
  })

  it("selects preferred preview media deterministically", () => {
    assert.deepEqual(getBackgroundPreviewMedia(videoBackground, "landscape"), {
      type: "video",
      source: "/preview.mp4",
    })
    assert.equal(matchesBackgroundVisualFilter(videoBackground, "premium", []), true)
    assert.equal(matchesBackgroundVisualFilter(videoBackground, "saved", ["video"]), true)
    assert.deepEqual(getBackgroundVisualTags(videoBackground), [
      "Animated", "Interactive", "Shader", "Image", "Premium",
    ])
  })

  it("parses only unique string ids from storage", () => {
    assert.deepEqual(parseSavedBackgroundIds('["one",1,"one","two"]'), ["one", "two"])
    assert.deepEqual(parseSavedBackgroundIds("{broken"), [])
    assert.deepEqual(parseSavedBackgroundIds(null), [])
  })

  it("tolerates denied storage reads and writes", () => {
    const denied = {
      getItem() { throw new Error("denied") },
      setItem() { throw new Error("denied") },
    }
    assert.deepEqual(readSavedBackgroundIds(denied), [])
    assert.equal(writeSavedBackgroundIds(denied, ["one"]), false)

    const writes = []
    const storage = {
      getItem(key) {
        assert.equal(key, BACKGROUND_SAVED_IDS_STORAGE_KEY)
        return '["one"]'
      },
      setItem(key, value) { writes.push([key, value]) },
    }
    assert.deepEqual(readSavedBackgroundIds(storage), ["one"])
    assert.equal(writeSavedBackgroundIds(storage, ["one", "one", "two"]), true)
    assert.deepEqual(writes, [[BACKGROUND_SAVED_IDS_STORAGE_KEY, '["one","two"]']])
  })
})
