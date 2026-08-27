import assert from "node:assert/strict"
import test from "node:test"

import { resumeAtmoShaperAudioContext } from "../lib/atmoshaper/audio-activation.js"

test("AtmoShaper requests AudioContext resume in the initiating call stack", async () => {
  const calls = []
  let releaseResume
  const resumed = new Promise((resolve) => {
    releaseResume = resolve
  })
  const unlock = resumeAtmoShaperAudioContext({
    getAtmosphereAudioContext() {
      return { state: "suspended" }
    },
    startAtmosphereAudioContext() {
      calls.push("resume")
      return resumed
    },
  })

  assert.deepEqual(calls, ["resume"])
  releaseResume()
  await unlock
})

test("AtmoShaper does not resume an already running AudioContext", async () => {
  let resumeCalls = 0
  await resumeAtmoShaperAudioContext({
    getAtmosphereAudioContext() {
      return {
        state: "running",
      }
    },
    startAtmosphereAudioContext() {
      resumeCalls += 1
      return Promise.resolve()
    },
  })

  assert.equal(resumeCalls, 0)
})

test("AtmoShaper fails closed until the shared audio runtime is prepared", async () => {
  await assert.rejects(
    resumeAtmoShaperAudioContext(null),
    /audio setup is still preparing/i,
  )
})
