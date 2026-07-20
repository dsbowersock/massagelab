import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const pageSource = await read("app/chimer/page.tsx")
const runningTimerSource = await read("app/chimer/running-timer.tsx")
const runningTimerStyles = await read("app/chimer/running-timer.module.css")
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
  assert.match(runningTimerSource, /clockHeaderAction=\{mode\.canToggleClock[\s\S]*aria-label=\{`Show clock:/)
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

test("shared Clock controls expose optional display effects without duplicated tuning controls", () => {
  assert.match(pageSource, /clockRotationEnabled=\{settings\.clockRotationEnabled\}/)
  assert.match(pageSource, /clockRotationRange=\{settings\.clockRotationRange\}/)
  assert.match(pageSource, /clockRotationDuration=\{settings\.clockRotationDuration\}/)
  assert.match(pageSource, /clockForwardGlowEnabled=\{settings\.clockForwardGlowEnabled\}/)
  assert.match(pageSource, /clockForwardGlowStrength=\{settings\.clockForwardGlowStrength\}/)
  assert.match(pageSource, /clockForwardGlowLength=\{settings\.clockForwardGlowLength\}/)
  assert.match(pageSource, /clockForwardGlowBlur=\{settings\.clockForwardGlowBlur\}/)
  assert.equal((runningTimerSource.match(/label="Display rotation"/g) ?? []).length, 1)
  assert.equal((runningTimerSource.match(/label="Forward glow"/g) ?? []).length, 1)
  assert.match(
    runningTimerSource,
    /label="Display rotation"[\s\S]*checked=\{clockRotationEnabled\}[\s\S]*disabled=\{mode\.canToggleClock && !mode\.showClock\}[\s\S]*handleSettingsChange\(\{ clockRotationEnabled: value \}\)/,
  )
  assert.match(
    runningTimerSource,
    /label="Forward glow"[\s\S]*checked=\{clockForwardGlowEnabled\}[\s\S]*disabled=\{mode\.canToggleClock && !mode\.showClock\}[\s\S]*handleSettingsChange\(\{ clockForwardGlowEnabled: value \}\)/,
  )
  for (const label of [
    "Rotation range",
    "Rotation cycle",
    "Glow intensity",
    "Projection length",
    "Glow blur",
  ]) {
    assert.equal((runningTimerSource.match(new RegExp(`label="${label}"`, "g")) ?? []).length, 1)
  }
})

test("center display effects preserve measured bounds and reuse the existing display data", () => {
  assert.match(
    runningTimerSource,
    /className=\{styles\.protectedDisplay\}[\s\S]*data-protected-display=[\s\S]*renderDisplayEffectLayers\("timer", isTimerPrimary\)/,
  )
  assert.match(
    runningTimerSource,
    /className=\{styles\.protectedDisplay\}[\s\S]*data-protected-display=[\s\S]*renderDisplayEffectLayers\("currentTime", isCurrentTimePrimary\)/,
  )
  assert.match(runningTimerSource, /clockRotationEnabled && isCentered/)
  assert.equal((runningTimerSource.match(/data-display-rotation-layer/g) ?? []).length, 1)
  assert.match(runningTimerSource, /clockForwardGlowEnabled && isCentered/)
  assert.equal((runningTimerSource.match(/data-forward-projection/g) ?? []).length, 1)
  assert.match(runningTimerSource, /aria-hidden="true"/)
  assert.match(
    runningTimerSource,
    /display === "timer"[\s\S]*renderTimerDisplay\(\)[\s\S]*renderCurrentTimeDisplay\(isCentered\)/,
  )
  assert.match(
    runningTimerSource,
    /display === "timer"[\s\S]*resolvedTimerDisplayColor[\s\S]*resolvedCurrentTimeDisplayColor/,
  )
  assert.equal((runningTimerSource.match(/setInterval\(/g) ?? []).length, 0)
  assert.match(runningTimerStyles, /\.protectedDisplay\s*\{[\s\S]*transform:\s*none/)
  assert.match(runningTimerStyles, /\.primaryDisplayForwardGlowEnabled\s*\{[^}]*overflow:\s*visible/s)
  assert.equal((runningTimerSource.match(/styles\.primaryDisplayForwardGlowEnabled/g) ?? []).length, 2)
  assert.match(runningTimerStyles, /\.forwardGlowProjection\s*\{[\s\S]*pointer-events:\s*none/)
  assert.match(runningTimerStyles, /\.forwardGlowBloom\s+\.currentTimeDigit[^}]*mask-image:/s)
  assert.match(runningTimerStyles, /\.forwardGlowReflection\s+\.currentTimeDigit[^}]*mask-image:/s)
})

test("visual pause keeps the selected background mounted and zero glow blur remains unblurred", () => {
  assert.match(pageSource, /movingBackgroundEnabled=\{runWithoutAnimatedBackground \? false : settings\.movingBackgroundEnabled\}/)
  assert.match(runningTimerSource, /const shouldRenderLiveBackground = mode\.selectedBackgroundId !== null[\s\S]*isLiveBackgroundSession/)
  assert.match(runningTimerSource, /motionEnabled=\{movingBackgroundEnabled\}/)
  assert.match(runningTimerSource, /aria-label=\{`Background animation:/)
  assert.match(runningTimerSource, /--immersive-forward-glow-blur": `\$\{clockForwardGlowBlur\}px`/)
  assert.match(runningTimerSource, /clockForwardGlowBlur \* 0\.08/)
})
