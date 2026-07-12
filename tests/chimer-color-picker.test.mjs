import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pickerSource = await readFile(
  new URL("../components/chimer-controls/GlobalColorPicker.tsx", import.meta.url),
  "utf8",
)
const runningTimerSource = await readFile(
  new URL("../app/chimer/running-timer.tsx", import.meta.url),
  "utf8",
)
const setTimerSource = await readFile(
  new URL("../app/chimer/set-timer.tsx", import.meta.url),
  "utf8",
)
const formPickerSource = await readFile(
  new URL("../components/chimer-controls/ColorPickerFormInput.tsx", import.meta.url),
  "utf8",
)
const serviceFormSource = await readFile(
  new URL("../app/calendar/services/service-form.tsx", import.meta.url),
  "utf8",
)

test("global color updates notify the parent outside the React state updater", () => {
  assert.match(
    pickerSource,
    /draftColorsRef\.current = nextValues\s+setDraftColors\(nextValues\)\s+onChange\(nextValues\)/,
  )
  assert.doesNotMatch(
    pickerSource,
    /setDraftColors\(\(current\) => \{[\s\S]*?onChange\(/,
  )
})

test("Clock settings keep the portaled color picker inside their interaction boundary", () => {
  assert.match(pickerSource, /data-chimer-control-portal="true"/)
  assert.match(
    runningTimerSource,
    /target instanceof Element && target\.closest\(CHIMER_CONTROL_PORTAL_SELECTOR\)/,
  )
})

test("shared color fields use explicit string values instead of synthetic native events", () => {
  assert.match(pickerSource, /onValueChange: \(value: string\) => void/)
  assert.doesNotMatch(pickerSource, /ReactChangeEvent|ChangeEventHandler|target: input/)
  assert.equal((runningTimerSource.match(/<ColorPickerInput/g) ?? []).length, 216)
  assert.equal((setTimerSource.match(/<ColorPickerInput/g) ?? []).length, 211)
  assert.doesNotMatch(runningTimerSource, /type="color"/)
  assert.doesNotMatch(setTimerSource, /type="color"/)
})

test("calendar forms submit the shared picker value without restoring a native color control", () => {
  assert.match(formPickerSource, /type="hidden"/)
  assert.match(formPickerSource, /name=\{name\}/)
  assert.match(formPickerSource, /onValueChange=\{setValue\}/)
  assert.match(serviceFormSource, /<ColorPickerFormInput/)
  assert.doesNotMatch(serviceFormSource, /type="color"/)
})
