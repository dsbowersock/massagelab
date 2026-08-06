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
const gridDistortionSource = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-grid-distortion-background.tsx", import.meta.url),
  "utf8",
)
const faultyTerminalRendererSource = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-faulty-terminal-background.tsx", import.meta.url),
  "utf8",
)
const chimerSettingsSource = await readFile(new URL("../lib/chimer-timer.js", import.meta.url), "utf8")
const globalStylesSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8")
const browserPaletteSource = await readFile(
  new URL("./browser/background-palette.spec.ts", import.meta.url),
  "utf8",
)

function readAnimationPolicyBlock(rendererSource, rendererLabel) {
  const block = rendererSource.match(/shouldAnimateAmbientBackground\(\{[\s\S]*?\}\)/)?.[0]
  assert.ok(block, `${rendererLabel} must call the shared ambient-animation policy.`)
  return block
}

test("Gradient Blinds keeps its slats fixed while passive light moves through them", () => {
  assert.match(gradientBlindsSource, /const PASSIVE_LIGHT_SWEEP_RATE = 0\.22/)
  assert.match(gradientBlindsSource, /const PASSIVE_LIGHT_HORIZONTAL_TRAVEL = 0\.38/)
  assert.match(gradientBlindsSource, /Math\.sin\(sceneTime \* PASSIVE_LIGHT_SWEEP_RATE\)/)
  assert.match(gradientBlindsSource, /float t = clamp\(uvMod\.x, 0\.0, 1\.0\);/)
  assert.match(gradientBlindsSource, /const float MINIMUM_BLIND_VISIBILITY = 0\.34;/)
  assert.match(gradientBlindsSource, /float fixedBlindCoordinate = uvMod\.x \* blindCount;/)
  assert.match(gradientBlindsSource, /float stripe = fract\(fixedBlindCoordinate\);/)
  assert.match(gradientBlindsSource, /float flexEnvelope = sin\(3\.14159265 \* stripe\);/)
  assert.match(gradientBlindsSource, /float breezePush = sin\(\(blindCenter - offset\.x\) \* 6\.2831853\) \* BREEZE_FLEX;/)
  assert.match(gradientBlindsSource, /float flexedStripe = clamp\(stripe \+ breezePush \* flexEnvelope, 0\.0, 1\.0\);/)
  assert.match(gradientBlindsSource, /float blindVisibility = mix\(MINIMUM_BLIND_VISIBILITY, 1\.0, 1\.0 - flexedStripe\);/)
  assert.match(gradientBlindsSource, /float spotlightDistance = smoothstep\(0\.0, 1\.0, clamp\(d \/ r, 0\.0, 1\.0\)\);/)
  assert.match(gradientBlindsSource, /rand\(gl_FragCoord\.xy\)/)
  assert.doesNotMatch(gradientBlindsSource, /GRADIENT_DRIFT_RATE|BLIND_DRIFT_RATE/)
  assert.doesNotMatch(gradientBlindsSource, /uvMod\.x \+ iTime/)
  assert.doesNotMatch(gradientBlindsSource, /rand\(gl_FragCoord\.xy \+ iTime\)/)
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
  assert.match(gridDistortionSource, /uniform float uStrength;/)
  assert.match(gridDistortionSource, /vec2 ambientOffset = vec2\(/)
  assert.match(gridDistortionSource, /sin\(uv\.y \* 9\.0 \+ time \* 0\.73\)/)
  assert.match(gridDistortionSource, /cos\(uv\.x \* 7\.0 - time \* 0\.61\)/)
  assert.match(gridDistortionSource, /newUV = uv - offset \* 0\.02 \+ ambientOffset/)
  assert.match(gridDistortionSource, /uniform1f\(resources\.uniforms\.strength, options\.strength\)/)
})

test("all four repaired renderers opt in to scoped system reduced-motion precedence", () => {
  for (const [label, rendererSource] of [
    ["Gradient Blinds", gradientBlindsSource],
    ["Pixel Snow", pixelSnowSource],
    ["Faulty Terminal", faultyTerminalRendererSource],
    ["Grid Distortion", gridDistortionSource],
  ]) {
    assert.match(
      readAnimationPolicyBlock(rendererSource, label),
      /respectSystemReducedMotion:\s*true/,
      `${label} must preserve a static system-reduced-motion frame on route-owned surfaces.`,
    )
  }
})

test("Faulty Terminal and Grid Distortion opt in to compact viewport animation", () => {
  for (const [label, rendererSource] of [
    ["Faulty Terminal", faultyTerminalRendererSource],
    ["Grid Distortion", gridDistortionSource],
  ]) {
    assert.match(
      readAnimationPolicyBlock(rendererSource, label),
      /allowCompactViewport:\s*true/,
      `${label} must keep its RAF active at the exact 360px compact threshold.`,
    )
  }
})

test("route-owned reduced motion freezes the fallback for the five explicitly repaired backgrounds", () => {
  const scopedRule = globalStylesSource.match(
    /body:is\(\.chimer-running, \.chimer-alerting, \.chimer-preview-capture\)\s+:is\([\s\S]*?\) \.massagelab-background-fallback\s*\{[\s\S]*?\}/,
  )?.[0]
  assert.ok(scopedRule, "The exact route-owned fallback reduced-motion rule must remain present.")
  assert.deepEqual(
    [...scopedRule.matchAll(/data-background-id="([^"]+)"/g)].map((match) => match[1]),
    [
      "massage-lab-gradient-blinds",
      "massage-lab-pixel-snow",
      "massage-lab-faulty-terminal",
      "massage-lab-grid-distortion",
      "massage-lab-grid-motion",
    ],
  )
  assert.match(scopedRule, /animation:\s*none;/)
})

test("autonomy proofs write named screenshots directly to Playwright test output", () => {
  const start = browserPaletteSource.indexOf("async function proveAutonomousPhoneMotion")
  const end = browserPaletteSource.indexOf("/** Reads the stored alpha", start)
  assert.notEqual(start, -1, "The autonomous phone proof helpers must remain present.")
  assert.notEqual(end, -1, "The proof helper boundary must remain present.")
  const proofHelpers = browserPaletteSource.slice(start, end)

  assert.doesNotMatch(proofHelpers, /testInfo\.attach/)
  assert.doesNotMatch(proofHelpers, /\.toEqual\((?:moving|reduced|compact)Initial\)/)
  assert.equal([...proofHelpers.matchAll(/testInfo\.outputPath\(/g)].length, 6)
  assert.equal([...proofHelpers.matchAll(/Later\.equals\([^)]*Initial\)/g)].length, 3)
  assert.equal([...proofHelpers.matchAll(/scale:\s*"css"/g)].length, 6)
  assert.equal(
    [...proofHelpers.matchAll(/await normalizeAutonomyProofHostChrome\(host\)/g)].length,
    3,
  )
  assert.equal(
    [...proofHelpers.matchAll(/await waitForGridDistortionSeedToSettle\(page\)/g)].length,
    2,
  )
  assert.doesNotMatch(proofHelpers, /waitForTimeout\(1_200\)/)
  assert.match(
    browserPaletteSource,
    /fixtureCard\.style\.setProperty\("border-radius", "0px", "important"\)/,
  )
  assert.match(
    browserPaletteSource,
    /const GRID_DISTORTION_SEED_SETTLE_FRAMES = 160/,
  )
  assert.match(
    browserPaletteSource,
    /completedFrames >= frameCount/,
  )
  assert.match(
    browserPaletteSource,
    /Grid Distortion did not complete.*within 60 seconds[\s\S]*?60_000/,
  )
  for (const suffix of [
    "no-preference-initial.png",
    "no-preference-later.png",
    "reduce-initial.png",
    "reduce-later.png",
    "compact-no-preference-initial.png",
    "compact-no-preference-later.png",
  ]) {
    assert.ok(
      proofHelpers.includes("testInfo.outputPath(`${id}-" + suffix + "`)"),
      `${suffix} must be written directly to the current Playwright test output.`,
    )
  }
})
