import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { it } from "node:test"

import { resolveDevCandidateAudioSource } from "../lib/atmoshaper/dev-candidate-audio.js"

const sha256 = (value) => createHash("sha256").update(value).digest("hex")

it("rejects a same-size candidate audio replacement whose checksum changed", async (t) => {
  const sourceRoot = await mkdtemp(join(tmpdir(), "ml-dev-candidate-audio-hash-"))
  t.after(() => rm(sourceRoot, { recursive: true, force: true }))
  await mkdir(join(sourceRoot, "Snow Pack"))
  const sourcePath = join(sourceRoot, "Snow Pack", "step.wav")
  const scannedBytes = Buffer.from("snow-step")
  const replacementBytes = Buffer.from("road-step")
  assert.equal(replacementBytes.byteLength, scannedBytes.byteLength)
  await writeFile(sourcePath, scannedBytes)

  const sourceId = "a".repeat(64)
  const manifest = {
    sources: [{
      sourceId,
      relativePath: "Snow Pack/step.wav",
      byteSize: scannedBytes.byteLength,
      extension: ".wav",
      sha256: sha256(scannedBytes),
    }],
  }
  const resolveSource = () => resolveDevCandidateAudioSource({
    sourceId,
    manifest,
    sourceRoot,
    nodeEnv: "development",
  })

  const resolved = await resolveSource()
  await writeFile(sourcePath, replacementBytes)

  assert.deepEqual(resolved.bytes, scannedBytes)
  assert.equal("absolutePath" in resolved, false)

  await assert.rejects(resolveSource, (error) => {
    assert.match(error.message, /checksum|content|inventory/i)
    assert.doesNotMatch(error.message, new RegExp(sourceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    return true
  })
})

it("requires a valid inventory checksum before resolving candidate audio", async (t) => {
  const sourceRoot = await mkdtemp(join(tmpdir(), "ml-dev-candidate-audio-shape-"))
  t.after(() => rm(sourceRoot, { recursive: true, force: true }))
  await mkdir(join(sourceRoot, "Snow Pack"))
  const sourceBytes = Buffer.from("snow-step")
  await writeFile(join(sourceRoot, "Snow Pack", "step.wav"), sourceBytes)
  const sourceId = "b".repeat(64)
  const source = {
    sourceId,
    relativePath: "Snow Pack/step.wav",
    byteSize: sourceBytes.byteLength,
    extension: ".wav",
  }
  const resolveSource = (candidate) => resolveDevCandidateAudioSource({
    sourceId,
    manifest: { sources: [candidate] },
    sourceRoot,
    nodeEnv: "development",
  })

  for (const candidate of [source, { ...source, sha256: "not-a-checksum" }]) {
    await assert.rejects(() => resolveSource(candidate), /checksum|inventory/i)
  }
})
