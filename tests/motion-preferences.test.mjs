import test from "node:test"
import assert from "node:assert/strict"
import {
  normalizeAmbientMotionMode,
  shouldAnimateAmbientBackground,
  shouldReduceAmbientMotion,
} from "../lib/motion-preferences.js"

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

test("shouldAnimateAmbientBackground can allow compact viewport animation for route-owned effects", () => {
  assert.equal(shouldAnimateAmbientBackground({
    prefersReducedMotion: false,
    compactViewport: true,
    allowCompactViewport: true,
    documentHidden: false,
  }), true)
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

test("ambient motion mode can force low-motion backgrounds", () => {
  assert.equal(normalizeAmbientMotionMode("reduced"), "reduced")
  assert.equal(normalizeAmbientMotionMode("full-motion"), "system")
  assert.equal(shouldReduceAmbientMotion({ ambientMotionMode: "reduced", prefersReducedMotion: false }), true)
  assert.equal(shouldAnimateAmbientBackground({
    ambientMotionMode: "reduced",
    prefersReducedMotion: false,
    compactViewport: false,
    documentHidden: false,
  }), false)
})

test("explicit route-owned motion can animate through the system reduced-motion signal", () => {
  assert.equal(shouldAnimateAmbientBackground({
    prefersReducedMotion: true,
    compactViewport: false,
    documentHidden: false,
    forceMotion: true,
  }), true)
})

test("app low-motion setting still wins over explicit route-owned motion", () => {
  assert.equal(shouldAnimateAmbientBackground({
    ambientMotionMode: "reduced",
    prefersReducedMotion: true,
    compactViewport: false,
    documentHidden: false,
    forceMotion: true,
  }), false)
})

test("Chimer running route class counts as route-owned motion", () => {
  const previousDocument = globalThis.document

  try {
    globalThis.document = {
      body: {
        classList: {
          contains: (className) => className === "chimer-running",
        },
      },
    }

    assert.equal(shouldAnimateAmbientBackground({
      prefersReducedMotion: true,
      compactViewport: false,
      documentHidden: false,
    }), true)
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = previousDocument
    }
  }
})

test("Chimer alerting route class counts as route-owned motion", () => {
  const previousDocument = globalThis.document

  try {
    globalThis.document = {
      body: {
        classList: {
          contains: (className) => className === "chimer-alerting",
        },
      },
    }

    assert.equal(shouldAnimateAmbientBackground({
      prefersReducedMotion: true,
      compactViewport: false,
      documentHidden: false,
    }), true)
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = previousDocument
    }
  }
})
