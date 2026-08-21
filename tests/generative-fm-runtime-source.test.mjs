import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../lib/atmosphere/generative-fm-runtime.ts"),
  "utf8",
)

test("Generative.fm accepts a typed optional destination without breaking destination fallback", () => {
  assert.match(source, /import\s+type\s+\{\s*InputNode\s*\}/)
  assert.match(source, /destination\?:\s*InputNode/)
  assert.match(source, /if\s*\(destination\)\s*output\.connect\(destination\)/)
  assert.match(source, /else\s*output\.toDestination\(\)/)
})

test("Generative.fm returns a callable handle with private ramped volume control", () => {
  assert.match(source, /type\s+GenerativeFmPlaybackHandle\s*=\s*\(\(\)\s*=>\s*void\)\s*&/)
  assert.match(source, /dispose\(\):\s*Promise<void>/)
  assert.match(source, /stop\.setVolume\s*=\s*\(nextVolume[^)]*seconds\s*=\s*0\.08\)/)
  assert.match(source, /output\.volume\.rampTo\?*\.\(volumeToDecibels\(nextVolume\),\s*seconds\)/)
  assert.match(source, /stop\.dispose\s*=\s*beginCleanup/)
  assert.match(source, /return\s+stop\b/)
})

test("Generative.fm retains global volume updates and owner-aware deferred cleanup", () => {
  assert.match(source, /activeVolumeNode\.volume\.value\s*=\s*volumeToDecibels\(volume\)/)
  assert.match(source, /activeTransportOwner\s*===\s*transportOwner/)
  assert.match(source, /Tone\.Transport\.stop\(\)/)
  assert.match(source, /Tone\.Transport\.cancel\(\)/)
  assert.match(source, /endStage\?\.\(\)/)
  assert.match(source, /deactivate\(\)/)
  assert.match(source, /output\.dispose\(\)/)
  assert.match(source, /window\.setTimeout/)
})
