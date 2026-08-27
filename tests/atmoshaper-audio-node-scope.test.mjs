import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import test from "node:test"

const modulePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/atmoshaper/audio-node-scope.js",
)

async function loadNodeScope() {
  assert.equal(existsSync(modulePath), true, "audio-node-scope.js must exist")
  return import(pathToFileURL(modulePath))
}

test("an invalid source rolls back the output allocated before validation", async () => {
  const { withAtmoShaperNodeScope } = await loadNodeScope()
  const calls = []
  const output = { dispose() { calls.push("dispose:output") } }

  assert.throws(() => withAtmoShaperNodeScope((scope) => {
    scope.track(output)
    throw new Error("Unsupported AtmoShaper noise source: invalid")
  }), /Unsupported AtmoShaper noise source/)

  assert.deepEqual(calls, ["dispose:output"])
})

test("cleanup reaches every node and the output when stop or dispose throws", async () => {
  const { withAtmoShaperNodeScope } = await loadNodeScope()
  const calls = []
  const { disposeAll } = withAtmoShaperNodeScope((scope) => {
    scope.track({ dispose() { calls.push("dispose:output") } })
    scope.track({
      stop() { calls.push("stop:broken"); throw new Error("stop failed") },
      dispose() { calls.push("dispose:broken"); throw new Error("dispose failed") },
    })
    scope.track({
      stop() { calls.push("stop:source") },
      dispose() { calls.push("dispose:source") },
    })
    return "graph"
  })

  assert.doesNotThrow(() => disposeAll())
  assert.doesNotThrow(() => disposeAll())
  assert.deepEqual(calls, [
    "stop:source",
    "dispose:source",
    "stop:broken",
    "dispose:broken",
    "dispose:output",
  ])
})
