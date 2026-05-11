import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  defaultAppSettings,
  normalizeAppSettings,
} from "../lib/app-settings.js"

describe("App settings helpers", () => {
  it("defaults the app to dark mode with the standard sidebar layout", () => {
    assert.deepEqual(normalizeAppSettings(null), defaultAppSettings)
  })

  it("preserves valid layout and theme preferences", () => {
    assert.deepEqual(normalizeAppSettings({
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "light",
    }), {
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "light",
    })
  })

  it("rejects invalid theme and sidebar values back to dark defaults", () => {
    assert.deepEqual(normalizeAppSettings({
      sidebarPosition: "center",
      sidebarTriggerPosition: "middle",
      themeMode: "system",
    }), defaultAppSettings)
  })
})
