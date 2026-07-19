import assert from "node:assert/strict"
import test from "node:test"

const loadLayout = () => import("../app/chimer/immersive-panel-layout.js")

test("dock placement prefers an exact-fit bottom reservation", async () => {
  const { calculateDockPlacement } = await loadLayout()
  assert.deepEqual(calculateDockPlacement({ viewportHeight: 800, displayTop: 200, displayBottom: 640, panelHeight: 120 }), { edge: "bottom", reservedPx: 160, maxPanelPx: 144 })
})

test("dock placement uses top when bottom misses the boundary and top fits", async () => {
  const { calculateDockPlacement } = await loadLayout()
  assert.deepEqual(calculateDockPlacement({ viewportHeight: 800, displayTop: 300, displayBottom: 641, panelHeight: 144 }), { edge: "top", reservedPx: 160, maxPanelPx: 284 })
})

test("dock placement caps to the larger remainder without over-reserving", async () => {
  const { calculateDockPlacement } = await loadLayout()
  assert.deepEqual(calculateDockPlacement({ viewportHeight: 390, displayTop: 72, displayBottom: 300, panelHeight: 500 }), { edge: "bottom", reservedPx: 90, maxPanelPx: 74 })
  assert.deepEqual(calculateDockPlacement({ viewportHeight: 100, displayTop: 8, displayBottom: 96, panelHeight: 500 }), { edge: "top", reservedPx: 8, maxPanelPx: 0 })
})

test("dock placement normalizes non-finite and negative measurement inputs", async () => {
  const { calculateDockPlacement } = await loadLayout()
  assert.deepEqual(calculateDockPlacement({ viewportHeight: Number.NaN, displayTop: -10, displayBottom: Number.POSITIVE_INFINITY, panelHeight: -20 }), { edge: "bottom", reservedPx: 0, maxPanelPx: 0 })
})

test("dock placement includes measured edge insets in exact-fit reservations", async () => {
  const { calculateDockPlacement } = await loadLayout()

  assert.deepEqual(calculateDockPlacement({
    viewportHeight: 812,
    displayTop: 200,
    displayBottom: 640,
    panelHeight: 144,
    topInset: 24,
    bottomInset: 12,
  }), { edge: "bottom", reservedPx: 172, maxPanelPx: 144 })

  assert.deepEqual(calculateDockPlacement({
    viewportHeight: 800,
    displayTop: 184,
    displayBottom: 641,
    panelHeight: 144,
    topInset: 24,
    bottomInset: 12,
  }), { edge: "top", reservedPx: 184, maxPanelPx: 144 })
})

test("dock placement exposes the full safe edge capacity after reserving its minimum", async () => {
  const { calculateDockPlacement } = await loadLayout()

  assert.deepEqual(calculateDockPlacement({
    viewportHeight: 597,
    displayTop: 120,
    displayBottom: 280,
    panelHeight: 144,
    bottomInset: 12,
  }), { edge: "bottom", reservedPx: 172, maxPanelPx: 289 })
})

test("dock placement caps against usable edge space after measured insets", async () => {
  const { calculateDockPlacement } = await loadLayout()

  assert.deepEqual(calculateDockPlacement({
    viewportHeight: 390,
    displayTop: 72,
    displayBottom: 300,
    panelHeight: 500,
    topInset: 60,
    bottomInset: 30,
  }), { edge: "bottom", reservedPx: 90, maxPanelPx: 44 })
})

test("stable document bounds convert into visual-viewport coordinates", async () => {
  const { toVisualViewportBounds } = await loadLayout()

  assert.deepEqual(toVisualViewportBounds({
    layoutTop: 500,
    layoutBottom: 620,
    windowScrollY: 300,
    visualViewportOffsetTop: 40,
  }), { top: 160, bottom: 280 })
})
