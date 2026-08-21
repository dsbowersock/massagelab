import assert from "node:assert/strict"
import test from "node:test"

import {
  ATMOSPHERE_INTERRUPTION_PREFERENCE_KEY,
  DEFAULT_RESUME_AFTER_INTERRUPTION,
  readAtmosphereInterruptionPreference,
  writeAtmosphereInterruptionPreference,
} from "../lib/atmosphere/interruption-preference.js"

test("missing preference defaults to enabled", () => {
  assert.deepEqual(readAtmosphereInterruptionPreference(() => ({ getItem: () => null })), { value: true, available: true })
})

test("reads a valid versioned preference", () => {
  assert.deepEqual(readAtmosphereInterruptionPreference(() => ({ getItem: () => '{"version":1,"resumeAfterInterruption":false}' })), { value: false, available: true })
})

test("malformed and wrong-version values use the enabled default", () => {
  assert.equal(readAtmosphereInterruptionPreference(() => ({ getItem: () => "not json" })).value, true)
  assert.equal(readAtmosphereInterruptionPreference(() => ({ getItem: () => '{"version":2,"resumeAfterInterruption":false}' })).value, true)
})

test("blocked storage getter and read are safe", () => {
  assert.deepEqual(readAtmosphereInterruptionPreference(() => { throw new DOMException("blocked", "SecurityError") }), { value: true, available: false })
  assert.deepEqual(readAtmosphereInterruptionPreference(() => ({ getItem: () => { throw new Error("blocked") } })), { value: true, available: false })
})

test("writes the versioned preference", () => {
  let key
  let value
  const result = writeAtmosphereInterruptionPreference(() => ({ setItem: (nextKey, nextValue) => { key = nextKey; value = nextValue } }), false)
  assert.deepEqual(result, { value: false, available: true })
  assert.equal(key, ATMOSPHERE_INTERRUPTION_PREFERENCE_KEY)
  assert.equal(value, '{"version":1,"resumeAfterInterruption":false}')
  assert.equal(DEFAULT_RESUME_AFTER_INTERRUPTION, true)
})

test("blocked storage write preserves the requested in-memory preference", () => {
  assert.deepEqual(writeAtmosphereInterruptionPreference(() => ({ setItem: () => { throw new Error("blocked") } }), false), { value: false, available: false })
})
