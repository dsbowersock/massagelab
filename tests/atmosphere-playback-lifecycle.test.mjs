import assert from "node:assert/strict"
import test from "node:test"

import { createAtmospherePlaybackLifecycle, transitionAtmospherePlayback } from "../lib/atmosphere/playback-lifecycle.js"

const playing = { ...createAtmospherePlaybackLifecycle(true), status: "playing", sessionId: 1, explicitIntent: "play" }

test("starts an in-app session and opens a visible supported notice", () => {
  const result = transitionAtmospherePlayback(createAtmospherePlaybackLifecycle(false), { type: "BEGIN_IN_APP_SESSION", savedDefault: false, documentVisible: true, integrationAvailable: true })
  assert.equal(result.state.status, "loading")
  assert.equal(result.state.sessionId, 1)
  assert.equal(result.state.resumeAfterInterruption, false)
  assert.equal(result.state.noticeSessionId, 1)
  assert.deepEqual(result.effects, ["START_GENERATOR"])
})

test("external sessions never open a notice and do not mutate the saved default", () => {
  const state = createAtmospherePlaybackLifecycle(true)
  const result = transitionAtmospherePlayback(state, { type: "BEGIN_EXTERNAL_SESSION", savedDefault: false })
  assert.equal(result.state.resumeAfterInterruption, true)
  assert.equal(result.state.noticeSessionId, null)
})

test("interruption resumes when enabled and pauses when disabled", () => {
  const interrupted = transitionAtmospherePlayback(playing, { type: "INTERRUPTION_STARTED" })
  assert.equal(interrupted.state.status, "interrupted")
  assert.equal(interrupted.state.interruptionObserved, true)
  assert.deepEqual(transitionAtmospherePlayback(interrupted.state, { type: "INTERRUPTION_ENDED" }).effects, ["RESUME_GENERATOR"])
  const disabled = transitionAtmospherePlayback({ ...playing, resumeAfterInterruption: false }, { type: "INTERRUPTION_STARTED" })
  assert.equal(disabled.state.status, "paused")
  assert.deepEqual(disabled.effects, ["STOP_GENERATOR_RETAIN_MEDIA"])
})

test("explicit stop wins over late recovery", () => {
  const interrupted = transitionAtmospherePlayback(playing, { type: "INTERRUPTION_STARTED" }).state
  const stopped = transitionAtmospherePlayback(interrupted, { type: "EXPLICIT_STOP" }).state
  const lateRecovery = transitionAtmospherePlayback(stopped, { type: "INTERRUPTION_ENDED" })
  assert.equal(lateRecovery.state.status, "stopped")
  assert.deepEqual(lateRecovery.effects, ["NONE"])
})

test("ambiguous pause remains paused and session setting changes do not alter saved defaults", () => {
  const paused = transitionAtmospherePlayback({ ...playing, resumeAfterInterruption: true }, { type: "EXPLICIT_PAUSE" }).state
  assert.equal(paused.status, "paused")
  const changed = transitionAtmospherePlayback(paused, { type: "SET_SESSION_RESUME", value: false })
  assert.equal(changed.state.resumeAfterInterruption, false)
  assert.equal(changed.state.savedDefault, undefined)
})

test("notice is gated by visibility and integration support", () => {
  for (const event of [
    { type: "BEGIN_IN_APP_SESSION", savedDefault: true, documentVisible: false, integrationAvailable: true },
    { type: "BEGIN_IN_APP_SESSION", savedDefault: true, documentVisible: true, integrationAvailable: false },
  ]) assert.equal(transitionAtmospherePlayback(createAtmospherePlaybackLifecycle(true), event).state.noticeSessionId, null)
})

test("unknown lifecycle events throw", () => {
  assert.throws(() => transitionAtmospherePlayback(playing, { type: "UNKNOWN" }), /Unknown atmosphere playback event/)
})
