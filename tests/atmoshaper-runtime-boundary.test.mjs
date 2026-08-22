import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import test from "node:test"

const testDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(testDirectory, "..")

function readRequiredSource(relativePath) {
  const absolutePath = resolve(projectRoot, relativePath)
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`)
  return readFileSync(absolutePath, "utf8")
}

function listSourceFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(path)
    return [path]
  }).filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)))
}

test("audio parameter helpers center binaural channels and clamp safe ramps", async () => {
  const modulePath = resolve(projectRoot, "lib/atmoshaper/audio-parameters.js")
  assert.equal(existsSync(modulePath), true, "audio-parameters.js must exist")
  const { binauralChannelFrequencies, rampSeconds } = await import(pathToFileURL(modulePath))

  assert.deepEqual(binauralChannelFrequencies(220, 10), { leftHz: 215, rightHz: 225 })
  assert.equal(rampSeconds(0), 0.03)
  assert.equal(rampSeconds(0.08), 0.08)
  assert.equal(rampSeconds(1), 0.25)
})

test("the provider and AtmoShaper UI keep Tone and mixer runtimes behind a lazy boundary", () => {
  const provider = readRequiredSource("components/providers/music-provider.tsx")
  assert.doesNotMatch(
    provider,
    /from\s+["'](?:tone(?:\/[^"']*)?|@\/lib\/atmoshaper\/(?:generated-audio-runtime|runtime))["']/,
  )

  for (const path of listSourceFiles(resolve(projectRoot, "components/atmoshaper"))) {
    const source = readFileSync(path, "utf8")
    assert.doesNotMatch(source, /from\s+["']tone(?:\/[^"']*)?["']/, relative(projectRoot, path))
    assert.doesNotMatch(source, /@generative-music\//, relative(projectRoot, path))
  }
})

test("runtime.ts is the sole AtmoShaper composition root", () => {
  const runtime = readRequiredSource("lib/atmoshaper/runtime.ts")
  assert.match(runtime, /from\s+["']\.\/mix-controller\.js["']/)
  assert.match(runtime, /from\s+["']\.\/generated-audio-runtime["']/)
  assert.match(runtime, /from\s+["']\.\.\/atmosphere\/stations\.js["']/)
  assert.match(runtime, /from\s+["']\.\.\/atmosphere\/generative-fm-runtime["']/)
  assert.match(runtime, /from\s+["']\.\.\/atmosphere\/tone-proof-runtime["']/)

  const forbiddenCompositionImports = /(?:mix-controller|atmosphere\/stations|generative-fm-runtime|tone-proof-runtime)/
  for (const path of listSourceFiles(resolve(projectRoot, "lib/atmoshaper"))) {
    if (path.endsWith(`${join("lib", "atmoshaper", "runtime.ts")}`)) continue
    const source = readFileSync(path, "utf8")
    assert.doesNotMatch(source, forbiddenCompositionImports, relative(projectRoot, path))
  }
})

test("generated adapters expose the complete controller lifecycle and reject ambient layers recoverably", () => {
  const generatedRuntime = readRequiredSource("lib/atmoshaper/generated-audio-runtime.ts")
  for (const method of ["fadeIn", "update", "pause", "resume", "fadeOutAndDispose"]) {
    assert.match(generatedRuntime, new RegExp(`\\b${method}\\s*\\(`), `missing generated handle method ${method}`)
  }
  assert.match(generatedRuntime, /binauralChannelFrequencies/)
  assert.match(generatedRuntime, /rampSeconds/)
  assert.match(generatedRuntime, /withAtmoShaperNodeScope/)
  for (const constructorName of ["Gain", "Noise", "Panner", "Oscillator", "LFO"]) {
    assert.match(
      generatedRuntime,
      new RegExp(`nodeScope\\.track\\(new ${constructorName}\\(`),
      `${constructorName} allocations must be tracked before connection or start`,
    )
  }

  const runtime = readRequiredSource("lib/atmoshaper/runtime.ts")
  assert.match(runtime, /createStationFoundationAdapter/)
  assert.match(runtime, /Unsupported AtmoShaper layer kind/)
})

test("station composition forwards controller ownership and awaits terminal cleanup", () => {
  const runtime = readRequiredSource("lib/atmoshaper/runtime.ts")
  assert.match(runtime, /createAdapter\(layer,\s*isCurrent\)/)
  assert.match(runtime, /createStationFoundationAdapter\(\{\s*layer,\s*destination:\s*master,\s*isCurrent\s*\}\)/)
  assert.match(runtime, /startToneProofDrone\(\{[\s\S]*?isCurrent,[\s\S]*?\}\)/)
  assert.match(runtime, /startGenerativeFmPiece\(\{[^}]*isCurrent[^}]*\}\)/)
  assert.match(runtime, /await\s+playback\.dispose\(\)/)
})

test("browser failure injection is a one-shot loopback-only adapter hook", () => {
  const runtime = readRequiredSource("lib/atmoshaper/runtime.ts")
  assert.match(runtime, /consumeAtmoShaperBrowserQaFailure/)
  assert.match(runtime, /(?:localhost|127\.0\.0\.1|::1)/)
  assert.match(runtime, /failNextSourceIds/)
  assert.match(runtime, /splice\(failureIndex, 1\)/)
  assert.ok(
    runtime.indexOf("consumeAtmoShaperBrowserQaFailure(layer)")
      < runtime.indexOf("return createGeneratedAtmoShaperAdapter"),
    "the test-only failure must be injected at the adapter composition boundary",
  )
})
