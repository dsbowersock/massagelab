import test from "node:test"
import assert from "node:assert/strict"
import { shouldAnimateAmbientBackground } from "../lib/motion-preferences.js"

test("shouldAnimateAmbientBackground disables ambient animation for reduced motion", () => {
  assert.equal(shouldAnimateAmbientBackground({
    prefersReducedMotion: true,
    compactViewport: false,
    documentHidden: false,
  }), false)
})

test("shouldAnimateAmbientBackground disables ambient animation on compact viewports", () => {
  assert.equal(shouldAnimateAmbientBackground({
    prefersReducedMotion: false,
    compactViewport: true,
    documentHidden: false,
  }), false)
})

test("shouldAnimateAmbientBackground disables ambient animation while hidden", () => {
  assert.equal(shouldAnimateAmbientBackground({
    prefersReducedMotion: false,
    compactViewport: false,
    documentHidden: true,
  }), false)
})

test("shouldAnimateAmbientBackground allows ambient animation on visible desktop without reduced motion", () => {
  assert.equal(shouldAnimateAmbientBackground({
    prefersReducedMotion: false,
    compactViewport: false,
    documentHidden: false,
  }), true)
})
