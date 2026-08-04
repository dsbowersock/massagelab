import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const gradientBlindsSource = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-gradient-blinds-background.tsx", import.meta.url),
  "utf8",
)
const pixelSnowSource = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-pixel-snow-background.tsx", import.meta.url),
  "utf8",
)
const source = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-grid-distortion-background.tsx", import.meta.url),
  "utf8",
)
const faultyTerminalRendererSource = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-faulty-terminal-background.tsx", import.meta.url),
  "utf8",
)
const chimerSettingsSource = await readFile(new URL("../lib/chimer-timer.js", import.meta.url), "utf8")

test("Gradient Blinds animates its gradient and blind phase", () => {
  assert.match(gradientBlindsSource, /const float GRADIENT_DRIFT_RATE = 0\.11;/)
  assert.match(gradientBlindsSource, /const float BLIND_DRIFT_RATE = 0\.18;/)
  assert.match(gradientBlindsSource, /sin\(iTime \* GRADIENT_DRIFT_RATE\) \* 0\.12/)
  assert.match(gradientBlindsSource, /uvMod\.x \+ iTime \* BLIND_DRIFT_RATE/)
})

test("Pixel Snow animates compact viewports and avoids the time-zero singular frame", () => {
  assert.match(pixelSnowSource, /const PIXEL_SNOW_SCENE_TIME_OFFSET = 11\.7/)
  assert.match(pixelSnowSource, /allowCompactViewport:\s*true/)
  assert.match(pixelSnowSource, /PIXEL_SNOW_SCENE_TIME_OFFSET \+ \(timestamp - startTime\) \* 0\.001/)
  assert.doesNotMatch(pixelSnowSource, /const time = animate \? \(timestamp - startTime\) \* 0\.001 : 0/)
})

test("Faulty Terminal has autonomous structure with optional pointer enhancement", () => {
  assert.match(faultyTerminalRendererSource, /noiseAmp:\s*0\.24/)
  assert.match(chimerSettingsSource, /massageLabFaultyTerminalNoiseAmp:\s*0\.24/)
  assert.match(faultyTerminalRendererSource, /float amp = 0\.5 \* uNoiseAmp;/)
  assert.match(faultyTerminalRendererSource, /if\(uUseMouse > 0\.5\)/)
})

test("Grid Distortion combines ambient drift with pointer deformation", () => {
  assert.match(source, /uniform float uStrength;/)
  assert.match(source, /vec2 ambientOffset = vec2\(/)
  assert.match(source, /sin\(uv\.y \* 9\.0 \+ time \* 0\.73\)/)
  assert.match(source, /cos\(uv\.x \* 7\.0 - time \* 0\.61\)/)
  assert.match(source, /newUV = uv - offset \* 0\.02 \+ ambientOffset/)
  assert.match(source, /uniform1f\(resources\.uniforms\.strength, options\.strength\)/)
})
