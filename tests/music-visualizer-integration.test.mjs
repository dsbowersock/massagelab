import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const pageSource = await read("app/chimer/page.tsx")
const runningTimerSource = await read("app/chimer/running-timer.tsx")
const providerSource = await read("components/providers/music-provider.tsx")

test("RunningTimer accepts one compact immersive mode contract", () => {
  assert.match(runningTimerSource, /interface ImmersiveDisplayMode \{[\s\S]*context: "chimer" \| "clock" \| "musicVisualizer"[\s\S]*backgroundCategory: "chimer" \| "clock" \| "music"[\s\S]*selectedBackgroundId: string \| null[\s\S]*showClock: boolean[\s\S]*canToggleClock: boolean[\s\S]*initialPanel: ImmersivePanelId[\s\S]*unavailableBackgroundMessage: string \| null[\s\S]*storageStatus: MusicVisualizerState\["storageStatus"\][\s\S]*storageError: string \| null[\s\S]*onBackgroundChange: \(backgroundId: string\) => void[\s\S]*onClose: \(\) => void/)
  assert.match(runningTimerSource, /interface RunningTimerProps \{[\s\S]*mode: ImmersiveDisplayMode/)
  assert.doesNotMatch(runningTimerSource, /MusicVisualizerRunningTimer/)
  assert.doesNotMatch(pageSource, /MusicVisualizerRunningTimer/)
})

test("ChimerPage resolves and safely closes the shared Music visualizer route", () => {
  assert.match(pageSource, /useSearchParams/)
  assert.match(pageSource, /resolveImmersiveDisplayContext/)
  assert.match(pageSource, /sanitizeMusicVisualizerReturnTo/)
  assert.match(pageSource, /router\.replace\(safeReturnTo\)/)
  assert.match(pageSource, /immersiveContext === "musicVisualizer"/)
})

test("Music selection waits for hydration and uses explicit registry eligibility", () => {
  assert.match(pageSource, /isBackgroundId\(id\)\s*&&\s*canUseBackgroundId\(id, featureKeys, "music"\)/)
  assert.match(pageSource, /resolveMusicVisualizerBackground/)
  assert.match(pageSource, /storageStatus !== "loading"/)
  assert.match(pageSource, /accountStatus !== "loading"/)
  assert.match(pageSource, /accountSyncStatus !== "checking"/)
  assert.match(pageSource, /unavailableSavedId/)
  assert.match(runningTimerSource, /mode\.onBackgroundChange\(nextBackgroundId\)/)
  assert.match(runningTimerSource, /setActivePanel\(null\)/)
})

test("Clock visibility, wake policy, and Music account actions stay context aware", () => {
  assert.match(pageSource, /shouldRequestImmersiveWakeLock/)
  assert.match(runningTimerSource, /mode\.canToggleClock[\s\S]*label="Show clock"/)
  assert.match(runningTimerSource, /mode\.context === "chimer"[\s\S]*label="Keep timer screen awake"/)
  assert.match(runningTimerSource, /mode\.storageStatus/)
  assert.match(runningTimerSource, /Set as visualizer default/)
  assert.match(runningTimerSource, /Restore account default/)
  assert.match(runningTimerSource, /mode\.musicDefaultActions\??\.onRetry/)
  assert.match(providerSource, /export interface MusicVisualizerState/)
  assert.match(providerSource, /signedIn: boolean/)
})

test("the shared renderer owns Music BackgroundHost and hides its clock without stopping visuals", () => {
  assert.match(runningTimerSource, /mode\.selectedBackgroundId !== null/)
  assert.match(runningTimerSource, /mode\.showClock/)
  assert.match(runningTimerSource, /<BackgroundHost/)
  assert.match(runningTimerSource, /key=\{`\$\{mode\.context\}:\$\{backgroundId\}`\}/)
  assert.doesNotMatch(pageSource, /<BackgroundHost/)
})
