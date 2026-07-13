import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  defaultAppSettings,
  getAudioPlayerToolbarPlacement,
  getSidebarButtonPosition,
  normalizeAppSettings,
  resolveSidebarButtonSettings,
} from "../lib/app-settings.js"
import {
  mainBarItemIds,
  resolveMainBarItemOrder,
  getMusicPlayerPlacement,
} from "../lib/app-shell.js"
import {
  getSidebarRenderMode,
  shouldCollapseSidebarFromOutsidePointer,
  shouldExpandSidebarFromRail,
} from "../lib/sidebar-layout.js"

describe("App settings helpers", () => {
  it("uses a single theme toggle across app bar layouts", () => {
    const source = readFileSync(new URL("../components/theme-switcher-multi-button.tsx", import.meta.url), "utf8")

    assert.match(source, /ml-theme-toggle-button/)
    assert.match(source, /const nextToggledTheme: ThemeMode = resolvedTheme === "dark" \? "light" : "dark"/)
    assert.match(source, /variant=\{resolvedTheme === "light" \? "default" : "outline"\}/)
    assert.match(source, /data-theme-selected/)
    assert.doesNotMatch(source, /role="radiogroup"/)
    assert.doesNotMatch(source, /suppressCompactActivationRef/)
  })

  it("keeps the global theme control visible in the primary bar on narrow phones", () => {
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(topBarSource, /<ThemeSwitcherMultiButton\b/)
    assert.match(topBarSource, /gap-1 min-\[361px\]:gap-2/)
    assert.doesNotMatch(topBarSource, /ThemeSwitcherMultiButton className="max-\[360px\]:hidden"/)
  })

  it("keeps compact top-bar drawer and theme controls the same size", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const themeSwitcherSource = readFileSync(new URL("../components/theme-switcher-multi-button.tsx", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(globalsSource, /--ml-shell-compact-control-size:\s*1\.9375rem/)
    assert.match(globalsSource, /\.ml-app-topbar \.ml-shell-compact-control \{[\s\S]*height: var\(--ml-shell-compact-control-size\);[\s\S]*width: var\(--ml-shell-compact-control-size\)/)
    assert.match(themeSwitcherSource, /ml-shell-compact-control ml-shell-theme-button/)
    assert.match(topBarSource, /className="ml-shell-compact-control shrink-0"/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-theme-switcher \.ml-shell-theme-button \{[\s\S]*height: 2\.625rem;[\s\S]*width: 2\.625rem/)
  })

  it("keeps the collapsed brand link accessible without covering the drawer control", () => {
    const sidebarSource = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")

    assert.match(sidebarSource, /function SidebarLogoHomeLink\(\)/)
    assert.match(sidebarSource, /aria-label="MassageLab home"/)
    assert.doesNotMatch(sidebarSource, /TooltipContent[\s\S]*MassageLab home/)
  })

  it("uses the approved shared toggle treatment on representative route settings", () => {
    const accountSource = readFileSync(new URL("../app/account/app-settings-panel.tsx", import.meta.url), "utf8")
    const calendarSource = readFileSync(new URL("../app/calendar/calendar-workspace.tsx", import.meta.url), "utf8")
    const soapSource = readFileSync(new URL("../app/notes/soap/components/objective-entry-form.tsx", import.meta.url), "utf8")

    assert.match(accountSource, /<ToggleControl[\s\S]*label="Haptic feedback"/)
    assert.match(calendarSource, /<ToggleControl[\s\S]*density="dense"[\s\S]*tone="leaf"/)
    assert.match(soapSource, /<Switch[\s\S]*size="compact"[\s\S]*tone="alert"/)
  })

  it("keeps segmented selection independent from tooltip state", () => {
    const segmentedSource = readFileSync(new URL("../components/ui/segmented-toggle-group.tsx", import.meta.url), "utf8")
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

    assert.match(segmentedSource, /data-selected=\{option\.value === value\}/)
    assert.match(segmentedSource, /"--ml-segment-offset": `\$\{selectedIndex \* 100\}%`/)
    assert.match(globalsSource, /\.ml-toggle\[data-selected="true"\]/)
    assert.match(globalsSource, /\.ml-toggle-group-item\[data-selected="true"\]/)
    assert.match(globalsSource, /--ml-toggle-content:\s*222 100% 96%/)
    assert.match(globalsSource, /\.ml-toggle:is\(\[data-state="on"\], \[aria-pressed="true"\], \[data-selected="true"\]\) svg/)
    assert.match(globalsSource, /--ml-choice-slide-duration:\s*420ms/)
    assert.match(globalsSource, /--ml-choice-slide-easing:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\)/)
    assert.match(globalsSource, /\.ml-segmented-toggle-group::before[\s\S]*transform: translateX\(var\(--ml-segment-offset\)\)/)
    assert.match(globalsSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 120ms/)
  })

  it("shares the approved route-control styling with production Chimer and drawer routes", () => {
    const gallerySource = readFileSync(new URL("../app/dev/buttons/route-control-gallery.tsx", import.meta.url), "utf8")
    const chimerSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const chimerRunningStyles = readFileSync(new URL("../app/chimer/running-timer.module.css", import.meta.url), "utf8")
    const chimerSetupStyles = readFileSync(new URL("../app/chimer/set-timer.module.css", import.meta.url), "utf8")
    const sidebarSource = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

    assert.match(gallerySource, /ml-chimer-tabs/)
    assert.match(gallerySource, /ml-time-format-choice/)
    assert.match(gallerySource, /ml-sidebar-route/)
    assert.match(gallerySource, /data-active-tab=\{activeTab\}/)
    assert.match(gallerySource, /data-active-format=\{timeFormat\}/)
    assert.match(chimerSource, /data-active-tab=\{settingsTab\}[\s\S]*ml-chimer-tabs/)
    assert.match(chimerSource, /ml-time-format-choice[\s\S]*data-active-format=\{timeFormat\}/)
    assert.match(chimerRunningStyles, /\.clockCompactField select \{[\s\S]*appearance: none;[\s\S]*linear-gradient\(45deg/)
    assert.match(chimerRunningStyles, /\.selectRow select \{[\s\S]*appearance: none;[\s\S]*linear-gradient\(45deg/)
    assert.match(chimerRunningStyles, /\.selectRow select:focus-visible \{[\s\S]*outline: 2px solid hsl\(var\(--ring\) \/ 0\.48\)/)
    assert.match(chimerSetupStyles, /\.selectRow select \{[\s\S]*appearance: none;[\s\S]*linear-gradient\(45deg/)
    assert.match(chimerSetupStyles, /\.selectRow select:focus-visible \{[\s\S]*outline: 2px solid hsl\(var\(--ring\) \/ 0\.48\)/)
    assert.match(sidebarSource, /ml-sidebar-route/)
    assert.match(globalsSource, /\.ml-chimer-tabs\.ml-chimer-tabs \{[\s\S]*border-radius: 0\.5625rem/)
    assert.match(globalsSource, /\.ml-chimer-tabs \.ml-chimer-tab\[data-state="active"\]/)
    assert.match(globalsSource, /\.ml-time-format-choice \.ml-time-format-option\[aria-pressed="true"\]/)
    assert.match(globalsSource, /\.ml-time-format-choice \.ml-time-format-option:hover:not\(\[aria-pressed="true"\]\)/)
    assert.match(globalsSource, /\.ml-chimer-tabs\[data-active-tab="backgrounds"\]::before/)
    assert.match(globalsSource, /\.ml-time-format-choice\[data-active-format="24h"\]::before/)
    assert.match(globalsSource, /\.ml-sidebar-route\.ml-sidebar-route\[data-active="true"\]/)
  })

  it("defaults the app to dark mode with the portrait sidebar button at bottom left", () => {
    assert.deepEqual(normalizeAppSettings(null), defaultAppSettings)
    assert.equal(defaultAppSettings.sidebarPosition, "left")
    assert.equal(defaultAppSettings.sidebarTriggerPosition, "bottom")
    assert.equal(defaultAppSettings.ambientMotionMode, "system")
    assert.equal(getSidebarButtonPosition(defaultAppSettings), "bottom-left")
  })

  it("preserves valid layout and theme preferences", () => {
    assert.deepEqual(normalizeAppSettings({
      appBarPosition: "bottom",
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "system",
      ambientMotionMode: "reduced",
      hapticFeedbackEnabled: true,
    }), {
      appBarPosition: "bottom",
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "system",
      ambientMotionMode: "reduced",
      hapticFeedbackEnabled: true,
    })
  })

  it("rejects invalid theme and sidebar values back to dark defaults", () => {
    assert.deepEqual(normalizeAppSettings({
      sidebarPosition: "center",
      sidebarTriggerPosition: "middle",
      appBarPosition: "middle",
      themeMode: "high-contrast",
      ambientMotionMode: "full-motion",
    }), defaultAppSettings)
  })

  it("defaults to a bottom app bar and keeps the music player on the bottom", () => {
    assert.equal(defaultAppSettings.appBarPosition, "bottom")
    assert.equal(defaultAppSettings.sidebarPosition, "left")
    assert.equal(defaultAppSettings.sidebarTriggerPosition, "bottom")
    assert.equal(getAudioPlayerToolbarPlacement(defaultAppSettings), "bottom")
    assert.equal(getMusicPlayerPlacement(defaultAppSettings), "bottom")
    assert.equal(getMusicPlayerPlacement({ appBarPosition: "top" }), "bottom")
  })

  it("maps persisted sidebar settings to a four-corner button position", () => {
    assert.equal(getSidebarButtonPosition({ sidebarPosition: "left", sidebarTriggerPosition: "top" }), "top-left")
    assert.equal(getSidebarButtonPosition({ sidebarPosition: "right", sidebarTriggerPosition: "top" }), "top-right")
    assert.equal(getSidebarButtonPosition({ sidebarPosition: "left", sidebarTriggerPosition: "bottom" }), "bottom-left")
    assert.equal(getSidebarButtonPosition({ sidebarPosition: "right", sidebarTriggerPosition: "bottom" }), "bottom-right")
  })

  it("resolves a four-corner sidebar button position back to persisted settings", () => {
    assert.deepEqual(resolveSidebarButtonSettings("top-left"), {
      sidebarPosition: "left",
      sidebarTriggerPosition: "top",
    })
    assert.deepEqual(resolveSidebarButtonSettings("top-right"), {
      sidebarPosition: "right",
      sidebarTriggerPosition: "top",
    })
    assert.deepEqual(resolveSidebarButtonSettings("bottom-left"), {
      sidebarPosition: "left",
      sidebarTriggerPosition: "bottom",
    })
    assert.deepEqual(resolveSidebarButtonSettings("bottom-right"), {
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
    })
  })

  it("orders the main bar so More follows the selected drawer side", () => {
    assert.deepEqual(mainBarItemIds, ["more", "music", "clock", "quick-create", "calendar", "home", "theme"])
    assert.deepEqual(resolveMainBarItemOrder({ sidebarPosition: "left" }), [
      "more",
      "music",
      "clock",
      "quick-create",
      "calendar",
      "home",
      "theme",
    ])
    assert.deepEqual(resolveMainBarItemOrder({ sidebarPosition: "right" }), [
      "theme",
      "home",
      "calendar",
      "quick-create",
      "clock",
      "music",
      "more",
    ])
  })

  it("renders the mobile main bar and quick-action speed dial from the layout shell", () => {
    const layoutSource = readFileSync(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8")
    const mainBarSource = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
    const speedDialSource = readFileSync(new URL("../components/shell/quick-action-speed-dial.tsx", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(layoutSource, /<MobileMainBar\b/)
    assert.match(mainBarSource, /resolveMainBarItemOrder/)
    assert.match(mainBarSource, /aria-label="MassageLab main navigation"/)
    assert.match(mainBarSource, /QuickActionSpeedDial/)
    assert.match(speedDialSource, /aria-label="Quick create actions"/)
    assert.match(speedDialSource, /Escape/)
    assert.match(topBarSource, /QuickActionSpeedDial/)
    assert.match(topBarSource, /aria-label="Open quick actions"/)
  })

  it("clears Chimer-only body classes off non-Chimer routes so app bars stay visible", () => {
    const layoutSource = readFileSync(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8")
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

    assert.match(layoutSource, /const isChimerRoute = pathname\.startsWith\("\/chimer"\) \|\| pathname\.startsWith\("\/clock"\)/)
    assert.match(layoutSource, /if \(!isChimerRoute\) \{[\s\S]*document\.body\.classList\.remove\("chimer-running", "chimer-alerting"\)/)
    assert.match(layoutSource, /pathname\.startsWith\("\/anatomime"\)/)
    assert.match(globalsSource, /body\.chimer-running \.ml-app-topbar/)
    assert.match(globalsSource, /body\.chimer-running \.ml-mobile-main-bar/)
  })

  it("keeps the mobile main bar controls styled as physical buttons", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const mainBarSource = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
    const themeSwitcherSource = readFileSync(new URL("../components/theme-switcher-multi-button.tsx", import.meta.url), "utf8")

    assert.match(globalsSource, /--ml-site-blue:\s*225 73% 57%/)
    assert.match(mainBarSource, /pb-\[var\(--ml-safe-bottom\)\]/)
    assert.match(mainBarSource, /pt-0/)
    assert.match(globalsSource, /\.ml-main-bar-layout \{[\s\S]*align-items: center/)
    assert.match(globalsSource, /\.ml-main-bar-edge \{[\s\S]*align-items: center/)
    assert.match(globalsSource, /\.ml-main-bar-button \{[\s\S]*align-items: center/)
    assert.match(globalsSource, /\.ml-main-bar-button \{[\s\S]*justify-content: center/)
    assert.match(mainBarSource, /variant="outline" size="icon" className="ml-main-bar-button"/)
    assert.match(mainBarSource, /variant="default"[\s\S]*className=\{cn\("ml-main-bar-plus rounded-full"/)
    assert.doesNotMatch(globalsSource, /\.ml-button-press-motion\.ml-button-ghost\.ml-main-bar-button/)
    assert.match(globalsSource, /\.ml-main-bar-button span:not\(\.sr-only\) \{[\s\S]*display: none/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-main-bar-plus \{[\s\S]*width: 2\.625rem/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-main-bar-plus-open \{[\s\S]*border-bottom-width: 2px/)
    assert.match(themeSwitcherSource, /data-theme-value=\{currentTheme\.value\}/)
    assert.match(themeSwitcherSource, /ml-theme-switcher/)
    assert.match(themeSwitcherSource, /ml-theme-toggle-button/)
    assert.match(themeSwitcherSource, /resolvedTheme === "light" \? "default" : "outline"/)
    assert.doesNotMatch(themeSwitcherSource, /className="hidden gap-1 md:flex"/)
    assert.match(themeSwitcherSource, /resolvedTheme === "light" && "ml-button-default"/)
    assert.match(themeSwitcherSource, /resolvedTheme === "dark" && "ml-button-outline"/)
  })

  it("uses a drawer only in narrow portrait phone layouts", () => {
    assert.equal(getSidebarRenderMode({ width: 390, height: 844 }), "drawer")
    assert.equal(getSidebarRenderMode({ width: 655, height: 681 }), "desktop")
    assert.equal(getSidebarRenderMode({ width: 768, height: 1024 }), "desktop")
    assert.equal(getSidebarRenderMode({ width: 1024, height: 768 }), "desktop")
  })

  it("uses an icon rail in compact landscape phone layouts", () => {
    assert.equal(getSidebarRenderMode({ width: 667, height: 375 }), "compact-rail")
    assert.equal(getSidebarRenderMode({ width: 844, height: 390 }), "compact-rail")
  })

  it("expands when a collapsed non-phone rail control is selected", () => {
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "desktop", state: "collapsed" }), true)
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "compact-rail", state: "collapsed" }), true)
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "desktop", state: "expanded" }), false)
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "drawer", state: "collapsed" }), false)
  })

  it("collapses an expanded non-phone sidebar only from outside sidebar clicks", () => {
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), true)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "compact-rail",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), true)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "collapsed",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), false)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "drawer",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), false)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "expanded",
      targetInsideSidebar: true,
      targetInsideSidebarPortal: false,
    }), false)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: true,
    }), false)
  })
})
