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
  it("opens compact theme choices without changing theme on the first phone tap", () => {
    const source = readFileSync(new URL("../components/theme-switcher-multi-button.tsx", import.meta.url), "utf8")

    assert.match(source, /function shouldOpenCompactPickerOnly/)
    assert.match(source, /suppressCompactActivationRef/)
    assert.match(source, /getComputedStyle\(inactiveOption\)\.display === "none"/)
    assert.match(source, /data-theme-selected/)
    assert.match(source, /onValueChange=\{\(value\) => \{\s*if \(suppressCompactActivationRef\.current\)/)
    assert.match(source, /event\.preventDefault\(\)/)
  })

  it("keeps the global theme control visible in the primary bar on narrow phones", () => {
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(topBarSource, /<ThemeSwitcherMultiButton\b/)
    assert.match(topBarSource, /gap-1 min-\[361px\]:gap-2/)
    assert.doesNotMatch(topBarSource, /ThemeSwitcherMultiButton className="max-\[360px\]:hidden"/)
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
    }), {
      appBarPosition: "bottom",
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "system",
      ambientMotionMode: "reduced",
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
    assert.match(globalsSource, /\.ml-main-bar-button \{[\s\S]*border: 1px solid hsl\(var\(--input\)\)/)
    assert.match(globalsSource, /\.ml-main-bar-button \{[\s\S]*background: hsl\(var\(--background\)\)/)
    assert.match(globalsSource, /\.ml-main-bar-button \{[\s\S]*inset 0 -2\.5px 0/)
    assert.match(globalsSource, /\.ml-main-bar-button span:not\(\.sr-only\) \{[\s\S]*display: none/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-main-bar-plus \{[\s\S]*width: 2\.625rem/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-main-bar-plus \{[\s\S]*outline-offset: -2px/)
    assert.match(themeSwitcherSource, /data-theme-value=\{value\}/)
    assert.match(themeSwitcherSource, /value === "dark"/)
    assert.match(themeSwitcherSource, /--ml-site-blue/)
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
