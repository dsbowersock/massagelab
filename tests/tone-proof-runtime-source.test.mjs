import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../lib/atmosphere/tone-proof-runtime.ts"),
  "utf8",
)

test("the proof drone accepts a typed optional destination without changing lazy runtime imports", () => {
  assert.match(source, /import\s+type\s+\{\s*InputNode\s*\}/)
  assert.match(source, /destination\?:\s*InputNode/)
  assert.match(source, /if\s*\(destination\)\s*output\.connect\(destination\)/)
  assert.match(source, /else\s*output\.toDestination\(\)/)
})

test("the proof drone returns a callable handle with private ramped volume control", () => {
  assert.match(source, /type\s+ToneProofDronePlaybackHandle\s*=\s*\(\(\)\s*=>\s*void\)\s*&/)
  assert.match(source, /stopPlayback\.setVolume\s*=\s*\(nextVolume[^)]*seconds\s*=\s*0\.08\)/)
  assert.match(source, /output\.volume\.rampTo\(volumeToDecibels\(nextVolume\),\s*seconds\)/)
  assert.match(source, /return\s+stopPlayback\b/)
})

test("the proof drone keeps global volume updates and disposes its complete graph once", () => {
  assert.match(source, /activeVolumeNode\.volume\.value\s*=\s*volumeToDecibels\(volume\)/)
  for (const node of ["baseOscillator", "detunedOscillator", "lowOscillator", "filter", "output"]) {
    assert.match(source, new RegExp(`disposeToneNode\\(${node}\\)`), `missing disposal for ${node}`)
  }
  assert.match(source, /if\s*\(disposed\)/)
  assert.match(source, /window\.setTimeout/)
})
