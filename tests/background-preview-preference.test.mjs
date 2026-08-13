import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY,
  readBackgroundPreviewPreference,
  writeBackgroundPreviewPreference,
} from "../lib/background-preview-preference.js"

function memoryStorage(initialValue = null) {
  let value = initialValue
  return {
    getItem(key) {
      assert.equal(key, BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY)
      return value
    },
    setItem(key, nextValue) {
      assert.equal(key, BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY)
      value = nextValue
    },
    value: () => value,
  }
}

describe("Background preview preference", () => {
  it("defaults to enabled and reads only explicit false as disabled", () => {
    assert.equal(readBackgroundPreviewPreference(memoryStorage()), true)
    assert.equal(readBackgroundPreviewPreference(memoryStorage("true")), true)
    assert.equal(readBackgroundPreviewPreference(memoryStorage("false")), false)
    assert.equal(readBackgroundPreviewPreference(memoryStorage("unexpected")), true)
  })

  it("writes the current device choice", () => {
    const storage = memoryStorage()
    assert.equal(writeBackgroundPreviewPreference(storage, false), true)
    assert.equal(storage.value(), "false")
    assert.equal(writeBackgroundPreviewPreference(storage, true), true)
    assert.equal(storage.value(), "true")
  })

  it("falls back safely when storage throws", () => {
    const storage = {
      getItem() { throw new DOMException("blocked", "SecurityError") },
      setItem() { throw new DOMException("blocked", "SecurityError") },
    }
    assert.equal(readBackgroundPreviewPreference(storage), true)
    assert.equal(writeBackgroundPreviewPreference(storage, false), false)
  })
})
