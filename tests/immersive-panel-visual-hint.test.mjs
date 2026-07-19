import assert from "node:assert/strict"
import test from "node:test"

const loadHintStorage = () => import("../app/chimer/immersive-panel-visual-hint.js")

test("Visual opened state uses one narrowly named non-sensitive device key", async () => {
  const { VISUAL_PANEL_OPENED_STORAGE_KEY, readVisualPanelOpened, writeVisualPanelOpened } = await loadHintStorage()
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(VISUAL_PANEL_OPENED_STORAGE_KEY, "massagelab.chimer.visual-panel-opened.v1")
  assert.equal(readVisualPanelOpened(storage), false)
  assert.equal(writeVisualPanelOpened(storage), true)
  assert.equal(values.get(VISUAL_PANEL_OPENED_STORAGE_KEY), "1")
  assert.equal(readVisualPanelOpened(storage), true)
})

test("Visual opened storage denial degrades without throwing", async () => {
  const { readVisualPanelOpened, writeVisualPanelOpened } = await loadHintStorage()
  const deniedStorage = { getItem: () => { throw new DOMException("denied", "SecurityError") }, setItem: () => { throw new DOMException("denied", "SecurityError") } }
  assert.doesNotThrow(() => readVisualPanelOpened(deniedStorage))
  assert.equal(readVisualPanelOpened(deniedStorage), false)
  assert.doesNotThrow(() => writeVisualPanelOpened(deniedStorage))
  assert.equal(writeVisualPanelOpened(deniedStorage), false)
})
