import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = async (path) => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8")
  } catch {
    return ""
  }
}

const shellSource = await read("app/chimer/immersive-panel-shell.tsx")
const shellStyles = await read("app/chimer/immersive-panel-shell.module.css")
const layoutSource = await read("app/chimer/immersive-panel-layout.js")
const runningTimerSource = await read("app/chimer/running-timer.tsx")
const runningTimerStyles = await read("app/chimer/running-timer.module.css")
const planSource = await read("docs/superpowers/plans/2026-07-18-clock-chimer-music-visualizer.md")
const specSource = await read("docs/superpowers/specs/2026-07-18-clock-chimer-music-visualizer-design.md")

test("exports the reusable controlled immersive panel contract", () => {
  assert.match(shellSource, /export type ImmersivePanelId = "clock" \| "visual" \| "background" \| null/)
  assert.match(shellSource, /interface ImmersivePanelShellProps \{[\s\S]*activePanel: ImmersivePanelId[\s\S]*onActivePanelChange: \(panel: ImmersivePanelId\) => void[\s\S]*protectedDisplayRef: RefObject<HTMLElement \| null>[\s\S]*clockContent: ReactNode[\s\S]*visualContent: ReactNode[\s\S]*backgroundContent: ReactNode[\s\S]*backgroundHeaderContent\?: ReactNode[\s\S]*backgroundUnavailableMessage\?: string \| null[\s\S]*hapticsEnabled: boolean/)
})

test("renders three accessible grouped panel toggles with responsive tooltips", () => {
  assert.match(shellSource, /role="group"[\s\S]*aria-label="Immersive display controls"/)
  for (const panel of ["clock", "visual", "background"]) {
    assert.match(shellSource, new RegExp(`id: "${panel}"`))
  }
  assert.match(shellSource, /aria-expanded=\{isActive\}/)
  assert.match(shellSource, /aria-controls=\{panelId\}/)
  assert.match(shellSource, /aria-label=\{label\}/)
  assert.match(shellSource, /<TooltipProvider[\s\S]*<Tooltip[\s\S]*<TooltipContent/)
  assert.match(shellSource, /onActivePanelChange\(isActive \? null : id\)/)
  assert.match(
    shellStyles,
    /\.toolbarLabel\s*\{[\s\S]{0,300}position:\s*absolute[\s\S]{0,300}clip:\s*rect\(0, 0, 0, 0\)/,
  )
})

test("keeps Clock and Visual nonmodal with complete dismissal mechanics", () => {
  assert.match(shellSource, /role="dialog"/)
  assert.match(shellSource, /aria-modal="false"/)
  assert.match(shellSource, /event\.key !== "Escape"/)
  assert.match(shellSource, /document\.addEventListener\("pointerdown"/)
  assert.match(shellSource, /target instanceof Element && target\.closest\(CHIMER_CONTROL_PORTAL_SELECTOR\)/)
  assert.match(shellSource, /shouldIgnoreNonmodalEscape\(event\.target\)/)
  assert.match(shellSource, /toolbarButtonRefs\.current\[panelToRestore\]\?\.focus\(\)/)
  assert.match(shellSource, /aria-label=\{`Close \$\{activePanelLabel\} panel`\}/)
})

test("uses a full-screen Radix modal for Background with default outside dismissal", () => {
  assert.match(shellSource, /@radix-ui\/react-dialog/)
  assert.match(shellSource, /data-immersive-panel="background"/)
  assert.doesNotMatch(shellSource, /onPointerDownOutside=\{\(event\) => event\.preventDefault\(\)\}/)
  assert.doesNotMatch(shellSource, /onInteractOutside=\{\(event\) => event\.preventDefault\(\)\}/)
  assert.match(shellSource, /onCloseAutoFocus=\{handleBackgroundCloseAutoFocus\}/)
  assert.match(shellSource, /<DialogPrimitive\.Title className=\{styles\.backgroundHeaderTitle\}>Background<\/DialogPrimitive\.Title>[\s\S]*\{backgroundHeaderContent\}[\s\S]*aria-label="Close Background panel"/)
  assert.doesNotMatch(shellSource, /<span>Close<\/span>/)
  assert.match(shellStyles, /--immersive-global-chrome-z:\s*10030/)
  assert.match(shellStyles, /\.backgroundOverlay[\s\S]*position:\s*fixed[\s\S]*inset:\s*0[\s\S]*z-index:\s*var\(--immersive-global-chrome-z\)/)
  assert.match(shellStyles, /\.backgroundPanel[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/)
})

test("measures a stable protected display and dock with bottom-first placement", () => {
  assert.match(shellSource, /import \{ calculateDockPlacement, toVisualViewportBounds \} from "\.\/immersive-panel-layout\.js"/)
  assert.match(shellSource, /function getStableVerticalBounds/)
  assert.doesNotMatch(shellSource, /currentProtectedDisplay\.getBoundingClientRect\(\)/)
  assert.match(layoutSource, /const bottomSpace =[\s\S]*if \(bottomSpace >= requestedPanelPx \+ SAFE_STAGE_GAP_PX \+ normalizedBottomInset\)/)
  assert.match(layoutSource, /const topSpace =[\s\S]*if \(topSpace >= requestedPanelPx \+ SAFE_STAGE_GAP_PX \+ normalizedTopInset\)/)
  assert.equal((shellSource.match(/new ResizeObserver/g) ?? []).length, 1)
  assert.match(shellSource, /resizeObserver\?\.observe\(protectedDisplay\)/)
  assert.match(shellSource, /resizeObserver\?\.observe\(dock\)/)
  assert.match(shellSource, /window\.addEventListener\("orientationchange", measure\)/)
  assert.match(shellSource, /window\.visualViewport\?\.addEventListener\("resize", measure\)/)
  assert.match(shellSource, /window\.visualViewport\?\.addEventListener\("scroll", measure\)/)
  assert.match(shellSource, /toVisualViewportBounds/)
  assert.match(shellSource, /visualViewportOffsetTop:\s*visualViewport\?\.offsetTop/)
  assert.match(shellSource, /topInset:\s*dockInsets\.top/)
  assert.match(shellSource, /bottomInset:\s*dockInsets\.bottom/)
  assert.match(shellSource, /--immersive-reserved-top/)
  assert.match(shellSource, /--immersive-reserved-bottom/)
  assert.match(shellSource, /--immersive-panel-max-height/)
  assert.match(runningTimerSource, /data-immersive-stage/)
  assert.match(runningTimerSource, /data-protected-display/)
  assert.match(shellSource, /data-immersive-dock=\{placement\.edge\}/)
  assert.match(shellSource, /data-immersive-inset-probe/)
  assert.doesNotMatch(shellStyles, /max-height:\s*max\(8rem,\s*var\(--immersive-panel-max-height\)\)/)
  assert.match(shellStyles, /@media \(max-width: 36rem\)[\s\S]*\.dock \{[\s\S]*width:\s*auto/)
})

test("RunningTimer owns one active panel without legacy settings tabs or auto-close", () => {
  assert.match(runningTimerSource, /useState<ImmersivePanelId>\(null\)/)
  assert.match(runningTimerSource, /<ImmersivePanelShell[\s\S]*activePanel=\{activePanel\}[\s\S]*onActivePanelChange=\{handleActivePanelChange\}/)
  assert.doesNotMatch(runningTimerSource, /type SettingsTab/)
  assert.doesNotMatch(runningTimerSource, /<Tabs(?:Content|List|Trigger)?\b/)
  assert.doesNotMatch(runningTimerSource, /settingsButton|SettingsButton|settingsAutoClose|SettingsAutoClose|SETTINGS_AUTO_CLOSE/)
  assert.doesNotMatch(runningTimerStyles, /settingsButton|settingsPanel|settingsTabs|settingsTabList|settingsTabTrigger/)
  assert.match(runningTimerSource, /visualContent=\{\([\s\S]*label="Keep timer screen awake"/)
  assert.doesNotMatch(runningTimerSource, /clockContent=\{\([\s\S]*label="Keep timer screen awake"[\s\S]*visualContent=/)
})

test("tracked docs clarify Background dismissal, selection, and Visual hint behavior", () => {
  for (const source of [planSource, specSource]) {
    assert.doesNotMatch(source, /close only through Close or `Escape`/i)
    assert.doesNotMatch(source, /outside overlay interaction does not close/i)
    assert.match(source, /Selecting an available background[\s\S]{0,300}closes Background/i)
    assert.match(source, /Customize this background in Visual\./)
  }
})

test("wires a non-blocking device-local Visual hint without changing the active-Chimer wake toggle", () => {
  assert.match(runningTimerSource, /readVisualPanelOpened/)
  assert.match(runningTimerSource, /writeVisualPanelOpened/)
  assert.match(runningTimerSource, /VISUAL_CUSTOMIZATION_HINT = "Customize this background in Visual\."/)
  assert.match(runningTimerSource, /visualHintMessage=\{visualHintMessage\}/)
  assert.match(shellSource, /aria-describedby=\{id === "visual" && visualHintMessage \? visualHintId : undefined\}/)
  assert.match(shellSource, /role="status"/)
  assert.match(shellStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.visualHintActive/)
  assert.match(runningTimerSource, /visualContent=\{\([\s\S]*!isClockMode[\s\S]*label="Keep timer screen awake"/)
})
