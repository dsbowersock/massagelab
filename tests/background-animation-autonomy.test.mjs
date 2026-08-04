import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const gradientBlindsSource = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-gradient-blinds-background.tsx", import.meta.url),
  "utf8",
)
const source = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-pixel-snow-background.tsx", import.meta.url),
  "utf8",
)

test("Gradient Blinds animates its gradient and blind phase", () => {
  assert.match(gradientBlindsSource, /const float GRADIENT_DRIFT_RATE = 0\.11;/)
  assert.match(gradientBlindsSource, /const float BLIND_DRIFT_RATE = 0\.18;/)
  assert.match(gradientBlindsSource, /sin\(iTime \* GRADIENT_DRIFT_RATE\) \* 0\.12/)
  assert.match(gradientBlindsSource, /uvMod\.x \+ iTime \* BLIND_DRIFT_RATE/)
})

test("Pixel Snow animates compact viewports and avoids the time-zero singular frame", () => {
  assert.match(source, /const PIXEL_SNOW_SCENE_TIME_OFFSET = 11\.7/)
  assert.match(source, /allowCompactViewport:\s*true/)
  assert.match(source, /PIXEL_SNOW_SCENE_TIME_OFFSET \+ \(timestamp - startTime\) \* 0\.001/)
  assert.doesNotMatch(source, /const time = animate \? \(timestamp - startTime\) \* 0\.001 : 0/)
})
