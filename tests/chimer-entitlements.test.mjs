import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { FEATURE_KEYS } from "../lib/membership.js"
import {
  DEFAULT_CHIMER_SETTINGS,
  sanitizeChimerSettingsForEntitlements,
} from "../lib/chimer-timer.js"

describe("Chimer entitlement-aware settings", () => {
  it("strips custom colors for users without the Chimer custom colors feature", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      secondaryFontColor: "#123456",
      clockModeFontColor: "#654321",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      movingBackgroundEnabled: false,
    }, [])

    assert.equal(settings.primaryFontColor, DEFAULT_CHIMER_SETTINGS.primaryFontColor)
    assert.equal(settings.secondaryFontColor, DEFAULT_CHIMER_SETTINGS.secondaryFontColor)
    assert.equal(settings.clockModeFontColor, DEFAULT_CHIMER_SETTINGS.clockModeFontColor)
    assert.equal(settings.movingBackgroundMainColor, DEFAULT_CHIMER_SETTINGS.movingBackgroundMainColor)
    assert.equal(settings.movingBackgroundOrbColor, DEFAULT_CHIMER_SETTINGS.movingBackgroundOrbColor)
    assert.equal(settings.movingBackgroundEnabled, false)
  })

  it("preserves custom colors for users with the Chimer custom colors feature", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      secondaryFontColor: "#123456",
      clockModeFontColor: "#654321",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
    }, [FEATURE_KEYS.chimerCustomColors])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.secondaryFontColor, "#123456")
    assert.equal(settings.clockModeFontColor, "#654321")
    assert.equal(settings.movingBackgroundMainColor, "#ABCDEF")
    assert.equal(settings.movingBackgroundOrbColor, "#FEDCBA")
  })
}
)
