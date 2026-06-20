import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  defaultAppSettings,
  getAudioPlayerToolbarPlacement,
  getSidebarButtonPosition,
  normalizeAppSettings,
  resolveSidebarButtonSettings,
} from "../lib/app-settings.js"
import {
  getSidebarRenderMode,
  shouldCollapseSidebarFromOutsidePointer,
  shouldExpandSidebarFromRail,
} from "../lib/sidebar-layout.js"

describe("App settings helpers", () => {
  it("defaults the app to dark mode with the portrait sidebar button at bottom left", () => {
    assert.deepEqual(normalizeAppSettings(null), defaultAppSettings)
    assert.equal(defaultAppSettings.sidebarPosition, "left")
    assert.equal(defaultAppSettings.sidebarTriggerPosition, "bottom")
    assert.equal(getSidebarButtonPosition(defaultAppSettings), "bottom-left")
  })

  it("preserves valid layout and theme preferences", () => {
    assert.deepEqual(normalizeAppSettings({
      appBarPosition: "bottom",
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "system",
    }), {
      appBarPosition: "bottom",
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "system",
    })
  })

  it("rejects invalid theme and sidebar values back to dark defaults", () => {
    assert.deepEqual(normalizeAppSettings({
      sidebarPosition: "center",
      sidebarTriggerPosition: "middle",
      appBarPosition: "middle",
      themeMode: "high-contrast",
    }), defaultAppSettings)
  })

  it("places the audio player toolbar opposite the app bar", () => {
    assert.equal(defaultAppSettings.appBarPosition, "top")
    assert.equal(getAudioPlayerToolbarPlacement(defaultAppSettings), "bottom")
    assert.equal(getAudioPlayerToolbarPlacement({ appBarPosition: "bottom" }), "top")
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
