import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clampActiveTimerMs,
  DEFAULT_CHIMER_SETTINGS,
  formatCurrentTimeParts,
  formatDurationParts,
  getMassageLab3DGlobeScaleDisplayPercent,
  getMassageLab3DGlobeScaleFromDisplayPercent,
  getActiveTimerAlertSchedule,
  getIntervalMs,
  getTotalTimerMs,
  MAX_CHIMER_DURATION_MS,
  normalizeHexColor,
  normalizeInteger,
  sanitizeChimerSettings,
  sanitizeChimerSettingsForEntitlements,
} from "../lib/chimer-timer.js"
import {
  combineTileGridFadeParts,
  formatTileGridFadeDuration,
  splitTileGridFadeSeconds,
  TILE_GRID_FADE_SECONDS_MAX,
} from "../lib/tile-grid-background.js"

describe("Chimer timer helpers", () => {
  it("converts selected hours and minutes into milliseconds", () => {
    assert.equal(getTotalTimerMs(1, 30), 90 * 60 * 1000)
    assert.equal(getTotalTimerMs("0", "45"), 45 * 60 * 1000)
    assert.equal(getTotalTimerMs(0, 60), 60 * 60 * 1000)
  })

  it("defaults new timers to unset zero duration", () => {
    assert.equal(DEFAULT_CHIMER_SETTINGS.hours, 0)
    assert.equal(DEFAULT_CHIMER_SETTINGS.minutes, 0)
    assert.equal(sanitizeChimerSettings({}).hours, 0)
    assert.equal(sanitizeChimerSettings({}).minutes, 0)
  })

  it("clamps invalid number input instead of leaking NaN into timer state", () => {
    assert.equal(normalizeInteger("nope", 5, 1, 10), 5)
    assert.equal(normalizeInteger(-3, 5, 1, 10), 1)
    assert.equal(normalizeInteger(999, 5, 1, 10), 10)
  })

  it("formats remaining time into stable display parts", () => {
    assert.deepEqual(formatDurationParts(65_000), {
      hours: "00",
      minutes: "01",
      seconds: "05",
    })
  })

  it("formats hidden timer seconds as current whole-minute position", () => {
    assert.deepEqual(formatDurationParts(0, { showTimerSeconds: false }), {
      hours: "00",
      minutes: "00",
      seconds: "",
    })
    assert.deepEqual(formatDurationParts(30_000, { showTimerSeconds: false }), {
      hours: "00",
      minutes: "00",
      seconds: "",
    })
    assert.deepEqual(formatDurationParts(90_000, { showTimerSeconds: false }), {
      hours: "00",
      minutes: "01",
      seconds: "",
    })
    assert.deepEqual(formatDurationParts(65 * 60_000 + 1, { showTimerSeconds: false }), {
      hours: "01",
      minutes: "05",
      seconds: "",
    })
  })

  it("clamps active timer adjustments to the supported timer range", () => {
    assert.equal(clampActiveTimerMs(-60_000), 0)
    assert.equal(clampActiveTimerMs(Number.NaN), 0)
    assert.equal(clampActiveTimerMs(10_500), 10_500)
    assert.equal(clampActiveTimerMs(MAX_CHIMER_DURATION_MS + 60_000), MAX_CHIMER_DURATION_MS)
  })

  it("uses custom or preset interval minutes for interval alerts", () => {
    assert.equal(
      getIntervalMs({ ...DEFAULT_CHIMER_SETTINGS, intervalType: "custom", customInterval: 12 }, 60 * 60 * 1000),
      12 * 60 * 1000,
    )
  })

  it("schedules active chime interval edits from now or from resume time", () => {
    assert.deepEqual(getActiveTimerAlertSchedule({
      status: "running",
      now: 1_000,
      remainingMs: 10 * 60 * 1000,
      intervalMs: 5 * 60 * 1000,
    }), {
      nextAlertAtMs: 301_000,
      msUntilNextAlert: null,
    })

    assert.deepEqual(getActiveTimerAlertSchedule({
      status: "paused",
      now: 1_000,
      remainingMs: 10 * 60 * 1000,
      intervalMs: 5 * 60 * 1000,
    }), {
      nextAlertAtMs: null,
      msUntilNextAlert: 5 * 60 * 1000,
    })

    assert.deepEqual(getActiveTimerAlertSchedule({
      status: "running",
      now: 1_000,
      remainingMs: 4 * 60 * 1000,
      intervalMs: 5 * 60 * 1000,
    }), {
      nextAlertAtMs: null,
      msUntilNextAlert: null,
    })
  })

  it("divides total time by body areas for area-based alerts", () => {
    assert.equal(
      getIntervalMs({ ...DEFAULT_CHIMER_SETTINGS, intervalType: "areas", areasToMassage: 4 }, 80 * 60 * 1000),
      20 * 60 * 1000,
    )
  })

  it("sanitizes persisted settings before restoring them", () => {
    assert.deepEqual(sanitizeChimerSettings({ hours: 99, minutes: -1, intervalType: "bad", alertType: "bad" }), {
      ...DEFAULT_CHIMER_SETTINGS,
      hours: 23,
      minutes: 0,
    })
  })

  it("migrates old minute-only one-hour settings into hour and minute parts", () => {
    assert.deepEqual(sanitizeChimerSettings({ hours: 0, minutes: 60 }), {
      ...DEFAULT_CHIMER_SETTINGS,
      hours: 1,
      minutes: 0,
    })
  })

  it("defaults the moving background on for old or invalid persisted settings", () => {
    assert.equal(sanitizeChimerSettings({}).movingBackgroundEnabled, true)
    assert.equal(sanitizeChimerSettings({ movingBackgroundEnabled: "false" }).movingBackgroundEnabled, true)
  })

  it("preserves a saved moving background preference", () => {
    assert.equal(sanitizeChimerSettings({ movingBackgroundEnabled: false }).movingBackgroundEnabled, false)
  })

  it("defaults current-time display preferences for old persisted settings", () => {
    assert.equal(sanitizeChimerSettings({}).showTimerSeconds, true)
    assert.equal(sanitizeChimerSettings({}).showCurrentTimeSeconds, false)
    assert.equal(sanitizeChimerSettings({}).timeFormat, "12h")
    assert.equal(DEFAULT_CHIMER_SETTINGS.primaryFontColor, "#FFFFFF")
    assert.equal(DEFAULT_CHIMER_SETTINGS.secondaryFontColor, "#FF7A1A")
    assert.equal(DEFAULT_CHIMER_SETTINGS.clockModeFontColor, "#FFFFFF")
    assert.equal(sanitizeChimerSettings({}).primaryFontColor, "#FFFFFF")
    assert.equal(sanitizeChimerSettings({}).secondaryFontColor, "#FF7A1A")
    assert.equal(sanitizeChimerSettings({}).clockModeFontColor, "#FFFFFF")
  })

  it("normalizes haptic notification and alert intensity preferences", () => {
    assert.equal(DEFAULT_CHIMER_SETTINGS.alertVolume, 0.7)
    assert.equal(DEFAULT_CHIMER_SETTINGS.hapticIntensityMs, 15)
    assert.equal(sanitizeChimerSettings({ alertType: "haptic" }).alertType, "haptic")
    assert.equal(sanitizeChimerSettings({ alertType: "chime-haptic" }).alertType, "chime-haptic")
    assert.equal(sanitizeChimerSettings({ alertType: "flash-haptic" }).alertType, "flash-haptic")
    assert.equal(sanitizeChimerSettings({ alertType: "all" }).alertType, "all")

    const settings = sanitizeChimerSettings({
      alertVolume: 99,
      hapticIntensityMs: 99,
    })

    assert.equal(settings.alertVolume, 1)
    assert.equal(settings.hapticIntensityMs, 30)
    assert.equal(
      sanitizeChimerSettings({ alertVolume: "loud" }).alertVolume,
      DEFAULT_CHIMER_SETTINGS.alertVolume,
    )
    assert.equal(
      sanitizeChimerSettings({ hapticIntensityMs: "strong" }).hapticIntensityMs,
      DEFAULT_CHIMER_SETTINGS.hapticIntensityMs,
    )
  })

  it("normalizes clock appearance controls", () => {
    const settings = sanitizeChimerSettings({
      clockFontFamily: "mono",
      clockStrokeEnabled: true,
      clockStrokeColor: "#ff7a1a",
      clockStrokeWidth: 99,
      clockShadowEnabled: false,
      clockShadowColor: "#000000",
      clockShadowStrength: 99,
      clockGlowEnabled: false,
      clockGlowColor: "#4169e1",
      clockGlowStrength: 99,
    })

    assert.equal(settings.clockFontFamily, "mono")
    assert.equal(settings.clockStrokeEnabled, true)
    assert.equal(settings.clockStrokeColor, "#FF7A1A")
    assert.equal(settings.clockStrokeWidth, 3)
    assert.equal(settings.clockShadowEnabled, false)
    assert.equal(settings.clockShadowColor, "#000000")
    assert.equal(settings.clockShadowStrength, 1)
    assert.equal(settings.clockGlowEnabled, false)
    assert.equal(settings.clockGlowColor, "#4169E1")
    assert.equal(settings.clockGlowStrength, 1)
    assert.equal(
      sanitizeChimerSettings({ clockFontFamily: "comic" }).clockFontFamily,
      DEFAULT_CHIMER_SETTINGS.clockFontFamily,
    )
    assert.equal(
      sanitizeChimerSettings({ clockStrokeColor: "orange" }).clockStrokeColor,
      DEFAULT_CHIMER_SETTINGS.clockStrokeColor,
    )
  })

  it("preserves saved timer seconds and display position color preferences", () => {
    const settings = sanitizeChimerSettings({
      showTimerSeconds: false,
      primaryFontColor: "#ff7a1a",
      secondaryFontColor: "#4169e1",
      clockModeFontColor: "#ffffff",
    })

    assert.equal(settings.showTimerSeconds, false)
    assert.equal(settings.primaryFontColor, "#FF7A1A")
    assert.equal(settings.secondaryFontColor, "#4169E1")
    assert.equal(settings.clockModeFontColor, "#FFFFFF")
  })

  it("does not migrate legacy display-type color fields into position colors", () => {
    const settings = sanitizeChimerSettings({
      timerFontColor: "#000000",
      clockFontColor: "#ffffff",
    })

    assert.equal(settings.primaryFontColor, "#FFFFFF")
    assert.equal(settings.secondaryFontColor, "#FF7A1A")
    assert.equal(settings.clockModeFontColor, "#FFFFFF")
  })

  it("falls back for invalid timer seconds and display color preferences", () => {
    const settings = sanitizeChimerSettings({
      showTimerSeconds: "false",
      primaryFontColor: "orange",
      secondaryFontColor: "#12345",
      clockModeFontColor: "white",
    })

    assert.equal(settings.showTimerSeconds, DEFAULT_CHIMER_SETTINGS.showTimerSeconds)
    assert.equal(settings.primaryFontColor, DEFAULT_CHIMER_SETTINGS.primaryFontColor)
    assert.equal(settings.secondaryFontColor, DEFAULT_CHIMER_SETTINGS.secondaryFontColor)
    assert.equal(settings.clockModeFontColor, DEFAULT_CHIMER_SETTINGS.clockModeFontColor)
  })

  it("defaults timer screen awake on for old or invalid persisted settings", () => {
    assert.equal(DEFAULT_CHIMER_SETTINGS.keepTimerScreenAwake, true)
    assert.equal(sanitizeChimerSettings({}).keepTimerScreenAwake, true)
    assert.equal(sanitizeChimerSettings({ keepTimerScreenAwake: "false" }).keepTimerScreenAwake, true)
  })

  it("preserves a saved timer screen awake preference", () => {
    assert.equal(sanitizeChimerSettings({ keepTimerScreenAwake: false }).keepTimerScreenAwake, false)
  })

  it("defaults invalid immersive clock preferences to safe booleans", () => {
    const settings = sanitizeChimerSettings({
      showClockDisplay: "false",
      clockRotationEnabled: 1,
      clockForwardGlowEnabled: null,
    })

    assert.equal(DEFAULT_CHIMER_SETTINGS.showClockDisplay, true)
    assert.equal(DEFAULT_CHIMER_SETTINGS.clockRotationEnabled, false)
    assert.equal(DEFAULT_CHIMER_SETTINGS.clockForwardGlowEnabled, false)
    assert.equal(settings.showClockDisplay, true)
    assert.equal(settings.clockRotationEnabled, false)
    assert.equal(settings.clockForwardGlowEnabled, false)
  })

  it("preserves literal immersive clock booleans through local and account sanitization", () => {
    const input = {
      showClockDisplay: false,
      clockRotationEnabled: true,
      clockForwardGlowEnabled: true,
    }

    for (const settings of [
      sanitizeChimerSettings(input),
      sanitizeChimerSettingsForEntitlements(input, []),
    ]) {
      assert.equal(settings.showClockDisplay, false)
      assert.equal(settings.clockRotationEnabled, true)
      assert.equal(settings.clockForwardGlowEnabled, true)
    }
  })

  it("migrates legacy AM/PM settings into explicit time format", () => {
    assert.equal(sanitizeChimerSettings({ showCurrentTimeAmPm: false }).timeFormat, "24h")
    assert.equal(sanitizeChimerSettings({ showCurrentTimeAmPm: true }).timeFormat, "12h")
    assert.equal(sanitizeChimerSettings({ timeFormat: "24h", showCurrentTimeAmPm: true }).timeFormat, "24h")
  })

  it("falls back to 12-hour time for invalid explicit time format values", () => {
    assert.equal(sanitizeChimerSettings({ timeFormat: "bad", showCurrentTimeAmPm: false }).timeFormat, "12h")
  })

  it("formats current time into separate time and meridiem parts", () => {
    const morningDate = new Date(2026, 4, 8, 9, 5, 9)
    const eveningDate = new Date(2026, 4, 8, 18, 5, 9)

    assert.deepEqual(formatCurrentTimeParts(morningDate, { timeFormat: "12h" }, "en-US"), {
      time: "09:05",
      meridiem: "AM",
    })
    assert.deepEqual(formatCurrentTimeParts(morningDate, { timeFormat: "24h" }, "en-US"), {
      time: "09:05",
      meridiem: "",
    })
    assert.deepEqual(formatCurrentTimeParts(eveningDate, { timeFormat: "12h" }, "en-US"), {
      time: "06:05",
      meridiem: "PM",
    })
    assert.deepEqual(formatCurrentTimeParts(morningDate, { timeFormat: "24h", showCurrentTimeSeconds: true }, "en-US"), {
      time: "09:05:09",
      meridiem: "",
    })
  })

  it("normalizes moving background colors", () => {
    assert.equal(normalizeHexColor("#ff7a1a", "#000000"), "#FF7A1A")
    assert.equal(normalizeHexColor("not-a-color", "#4169E1"), "#4169E1")
    assert.equal(sanitizeChimerSettings({
      movingBackgroundMainColor: "#123abc",
      movingBackgroundOrbColor: "bad",
    }).movingBackgroundMainColor, "#123ABC")
    assert.equal(sanitizeChimerSettings({
      movingBackgroundMainColor: "#123abc",
      movingBackgroundOrbColor: "bad",
    }).movingBackgroundOrbColor, DEFAULT_CHIMER_SETTINGS.movingBackgroundOrbColor)
  })

  it("normalizes Spotlight background controls", () => {
    const settings = sanitizeChimerSettings({
      spotlightColor: "#aabbcc",
      spotlightOpacity: 9,
      spotlightWidth: 120,
      spotlightHeight: 3000,
      spotlightSmallWidth: 500,
      spotlightTranslateY: -900,
      spotlightDuration: 99,
      spotlightXOffset: -10,
    })

    assert.equal(settings.spotlightColor, "#AABBCC")
    assert.equal(settings.spotlightOpacity, 1.5)
    assert.equal(settings.spotlightWidth, 240)
    assert.equal(settings.spotlightHeight, 1800)
    assert.equal(settings.spotlightSmallWidth, 420)
    assert.equal(settings.spotlightTranslateY, -650)
    assert.equal(settings.spotlightDuration, 16)
    assert.equal(settings.spotlightXOffset, 0)
  })

  it("normalizes MassageLab Gradient field controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabGradientPrimaryColor: "#112233",
      massageLabGradientHarmony: "triad",
      massageLabGradientOpacity: 99,
    })

    assert.equal(settings.massageLabGradientPrimaryColor, "#112233")
    assert.equal(settings.massageLabGradientHarmony, "triad")
    assert.equal(settings.massageLabGradientOpacity, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientFromColor: "#445566" }).massageLabGradientPrimaryColor,
      "#445566",
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientPrimaryColor: "bad" }).massageLabGradientPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientHarmony: "rainbow" }).massageLabGradientHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientOpacity: "clear" }).massageLabGradientOpacity,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientOpacity,
    )
  })

  it("normalizes MassageLab Star field controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabStarsColor: "#aabbcc",
      massageLabStarsSpeed: 999,
      massageLabStarsDensity: 0,
      massageLabStarsParallax: 9,
    })

    assert.equal(settings.massageLabStarsColor, "#AABBCC")
    assert.equal(settings.massageLabStarsSpeed, 120)
    assert.equal(settings.massageLabStarsDensity, 0.25)
    assert.equal(settings.massageLabStarsParallax, 0.12)
    assert.equal(
      sanitizeChimerSettings({ massageLabStarsColor: "white" }).massageLabStarsColor,
      DEFAULT_CHIMER_SETTINGS.massageLabStarsColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabStarsSpeed: "fast" }).massageLabStarsSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabStarsSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabStarsDensity: "dense" }).massageLabStarsDensity,
      DEFAULT_CHIMER_SETTINGS.massageLabStarsDensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabStarsParallax: "more" }).massageLabStarsParallax,
      DEFAULT_CHIMER_SETTINGS.massageLabStarsParallax,
    )
  })

  it("normalizes MassageLab Depth well controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabHoleStrokeColor: "#112233",
      massageLabHoleParticleColor: "#aabbcc",
      massageLabHoleLineCount: 999,
      massageLabHoleDiscCount: 0,
    })

    assert.equal(settings.massageLabHoleStrokeColor, "#112233")
    assert.equal(settings.massageLabHoleParticleColor, "#AABBCC")
    assert.equal(settings.massageLabHoleLineCount, 96)
    assert.equal(settings.massageLabHoleDiscCount, 12)
    assert.equal(
      sanitizeChimerSettings({ massageLabHoleStrokeColor: "gray" }).massageLabHoleStrokeColor,
      DEFAULT_CHIMER_SETTINGS.massageLabHoleStrokeColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabHoleParticleColor: "white" }).massageLabHoleParticleColor,
      DEFAULT_CHIMER_SETTINGS.massageLabHoleParticleColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabHoleLineCount: "many" }).massageLabHoleLineCount,
      DEFAULT_CHIMER_SETTINGS.massageLabHoleLineCount,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabHoleDiscCount: "few" }).massageLabHoleDiscCount,
      DEFAULT_CHIMER_SETTINGS.massageLabHoleDiscCount,
    )
  })

  it("normalizes MassageLab Light Speed background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabLightSpeedWarpSpeed: 0,
      massageLabLightSpeedWarpSpeedVersion: 2,
      massageLabLightSpeedParticleCount: 9999,
      massageLabLightSpeedLightColor: "#33b2ff",
      massageLabLightSpeedIntensity: 99,
      massageLabLightSpeedRadius: 0,
      massageLabLightSpeedCylinderLength: 999,
    })

    assert.equal(settings.massageLabLightSpeedWarpSpeed, 0.1)
    assert.equal(settings.massageLabLightSpeedWarpSpeedVersion, 2)
    assert.equal(settings.massageLabLightSpeedParticleCount, 200)
    assert.equal(settings.massageLabLightSpeedLightColor, "#33B2FF")
    assert.equal(settings.massageLabLightSpeedIntensity, 6)
    assert.equal(settings.massageLabLightSpeedRadius, 6)
    assert.equal(settings.massageLabLightSpeedCylinderLength, 300)
    assert.equal(
      sanitizeChimerSettings({ massageLabLightSpeedWarpSpeed: 0.1 }).massageLabLightSpeedWarpSpeed,
      1,
    )
    assert.equal(
      sanitizeChimerSettings({
        massageLabLightSpeedWarpSpeed: 1,
        massageLabLightSpeedWarpSpeedVersion: 2,
      }).massageLabLightSpeedWarpSpeed,
      1,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightSpeedWarpSpeed: "warp" }).massageLabLightSpeedWarpSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedWarpSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightSpeedParticleCount: "many" }).massageLabLightSpeedParticleCount,
      DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedParticleCount,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightSpeedLightColor: "purple" }).massageLabLightSpeedLightColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedLightColor,
    )
  })

  it("normalizes MassageLab Electric Mist background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabElectricMistColor: "#33b2ff",
      massageLabElectricMistSpeed: 999,
      massageLabElectricMistControlVersion: 2,
      massageLabElectricMistDetail: 0,
      massageLabElectricMistDistortion: 99,
      massageLabElectricMistBrightness: 0,
    })

    assert.equal(settings.massageLabElectricMistColor, "#33B2FF")
    assert.equal(settings.massageLabElectricMistSpeed, 400)
    assert.equal(settings.massageLabElectricMistControlVersion, 2)
    assert.equal(settings.massageLabElectricMistDetail, 0.5)
    assert.equal(settings.massageLabElectricMistDistortion, 8)
    assert.equal(settings.massageLabElectricMistBrightness, 1)
    const legacySettings = sanitizeChimerSettings({
      massageLabElectricMistSpeed: 3.5,
      massageLabElectricMistBrightness: 0.5,
    })
    assert.equal(legacySettings.massageLabElectricMistSpeed, 350)
    assert.equal(legacySettings.massageLabElectricMistBrightness, 50)
    assert.equal(legacySettings.massageLabElectricMistControlVersion, 2)
    assert.equal(
      sanitizeChimerSettings({
        massageLabElectricMistControlVersion: 2,
        massageLabElectricMistBrightness: 1,
      }).massageLabElectricMistBrightness,
      1,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabElectricMistColor: "blue" }).massageLabElectricMistColor,
      DEFAULT_CHIMER_SETTINGS.massageLabElectricMistColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabElectricMistSpeed: "fast" }).massageLabElectricMistSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabElectricMistSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabElectricMistDetail: "dense" }).massageLabElectricMistDetail,
      DEFAULT_CHIMER_SETTINGS.massageLabElectricMistDetail,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabElectricMistDistortion: "warp" }).massageLabElectricMistDistortion,
      DEFAULT_CHIMER_SETTINGS.massageLabElectricMistDistortion,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabElectricMistBrightness: "bright" }).massageLabElectricMistBrightness,
      DEFAULT_CHIMER_SETTINGS.massageLabElectricMistBrightness,
    )
  })

  it("normalizes MassageLab Astral Flow background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabAstralFlowPaletteMode: "harmony",
      massageLabAstralFlowPrimaryColor: "#a0769a",
      massageLabAstralFlowHarmony: "triad",
      massageLabAstralFlowColorOne: "#05070a",
      massageLabAstralFlowColorTwo: "purple",
      massageLabAstralFlowColorThree: "#a0769a",
      massageLabAstralFlowSpeed: 99,
      massageLabAstralFlowFlowMin: 0,
      massageLabAstralFlowFlowMax: 99,
    })

    assert.equal(settings.massageLabAstralFlowPaletteMode, "harmony")
    assert.equal(settings.massageLabAstralFlowPrimaryColor, "#A0769A")
    assert.equal(settings.massageLabAstralFlowHarmony, "triad")
    assert.equal(settings.massageLabAstralFlowColorOne, "#05070A")
    assert.equal(settings.massageLabAstralFlowColorTwo, DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowColorTwo)
    assert.equal(settings.massageLabAstralFlowColorThree, "#A0769A")
    assert.equal(settings.massageLabAstralFlowSpeed, 3)
    assert.equal(settings.massageLabAstralFlowFlowMin, 0.5)
    assert.equal(settings.massageLabAstralFlowFlowMax, 12)
    assert.equal(
      sanitizeChimerSettings({ massageLabAstralFlowSpeed: "fast" }).massageLabAstralFlowSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabAstralFlowSpeed: 0 }).massageLabAstralFlowSpeed, 0.1)
    assert.equal(
      sanitizeChimerSettings({ massageLabAstralFlowPaletteMode: "demo" }).massageLabAstralFlowPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabAstralFlowPrimaryColor: "mauve" }).massageLabAstralFlowPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabAstralFlowHarmony: "rainbow" }).massageLabAstralFlowHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowHarmony,
    )
  })

  it("normalizes MassageLab Deep Space Nebula background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabDeepSpaceNebulaPaletteMode: "harmony",
      massageLabDeepSpaceNebulaPrimaryColor: "#763b65",
      massageLabDeepSpaceNebulaHarmony: "triad",
      massageLabDeepSpaceNebulaColorOne: "#5efff4",
      massageLabDeepSpaceNebulaColorTwo: "purple",
      massageLabDeepSpaceNebulaColorThree: "#1a0b2e",
      massageLabDeepSpaceNebulaSpeed: 99,
    })

    assert.equal(settings.massageLabDeepSpaceNebulaPaletteMode, "harmony")
    assert.equal(settings.massageLabDeepSpaceNebulaPrimaryColor, "#763B65")
    assert.equal(settings.massageLabDeepSpaceNebulaHarmony, "triad")
    assert.equal(settings.massageLabDeepSpaceNebulaColorOne, "#5EFFF4")
    assert.equal(settings.massageLabDeepSpaceNebulaColorTwo, DEFAULT_CHIMER_SETTINGS.massageLabDeepSpaceNebulaColorTwo)
    assert.equal(settings.massageLabDeepSpaceNebulaColorThree, "#1A0B2E")
    assert.equal(settings.massageLabDeepSpaceNebulaSpeed, 5)
    assert.equal(
      sanitizeChimerSettings({ massageLabDeepSpaceNebulaSpeed: "fast" }).massageLabDeepSpaceNebulaSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabDeepSpaceNebulaSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabDeepSpaceNebulaSpeed: 0 }).massageLabDeepSpaceNebulaSpeed, 0.1)
    assert.equal(
      sanitizeChimerSettings({ massageLabDeepSpaceNebulaPaletteMode: "demo" }).massageLabDeepSpaceNebulaPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabDeepSpaceNebulaPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDeepSpaceNebulaPrimaryColor: "mauve" }).massageLabDeepSpaceNebulaPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabDeepSpaceNebulaPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDeepSpaceNebulaHarmony: "rainbow" }).massageLabDeepSpaceNebulaHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabDeepSpaceNebulaHarmony,
    )
  })

  it("normalizes MassageLab Grid Bloom background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabGridBloomColor: "#e040fb",
      massageLabGridBloomSpeed: 99,
      massageLabGridBloomGridScale: 99,
      massageLabGridBloomRotationSpeed: -99,
      massageLabGridBloomFadeFalloff: 0,
      massageLabGridBloomDistortionAmount: 99,
      massageLabGridBloomFlowSpeedX: -99,
      massageLabGridBloomFlowSpeedY: 99,
    })

    assert.equal(settings.massageLabGridBloomColor, "#E040FB")
    assert.equal(settings.massageLabGridBloomSpeed, 3)
    assert.equal(settings.massageLabGridBloomGridScale, 32)
    assert.equal(settings.massageLabGridBloomRotationSpeed, -3)
    assert.equal(settings.massageLabGridBloomFadeFalloff, 1)
    assert.equal(settings.massageLabGridBloomDistortionAmount, 0.5)
    assert.equal(settings.massageLabGridBloomFlowSpeedX, -2)
    assert.equal(settings.massageLabGridBloomFlowSpeedY, 2)
    assert.equal(
      sanitizeChimerSettings({ massageLabGridBloomColor: "purple" }).massageLabGridBloomColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGridBloomColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridBloomSpeed: "fast" }).massageLabGridBloomSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabGridBloomSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabGridBloomSpeed: 0 }).massageLabGridBloomSpeed, 0.1)
    assert.equal(
      sanitizeChimerSettings({ massageLabGridBloomGridScale: "dense" }).massageLabGridBloomGridScale,
      DEFAULT_CHIMER_SETTINGS.massageLabGridBloomGridScale,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridBloomDistortionAmount: "warp" }).massageLabGridBloomDistortionAmount,
      DEFAULT_CHIMER_SETTINGS.massageLabGridBloomDistortionAmount,
    )
  })

  it("normalizes MassageLab Chrome Flow background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabChromeFlowPaletteMode: "harmony",
      massageLabChromeFlowPrimaryColor: "#c0c0c0",
      massageLabChromeFlowHarmony: "triad",
      massageLabChromeFlowColorOne: "#c0c0c0",
      massageLabChromeFlowColorTwo: "silver",
      massageLabChromeFlowFlowSpeed: 99,
      massageLabChromeFlowTimeScale: 99,
    })

    assert.equal(settings.massageLabChromeFlowPaletteMode, "harmony")
    assert.equal(settings.massageLabChromeFlowPrimaryColor, "#C0C0C0")
    assert.equal(settings.massageLabChromeFlowHarmony, "triad")
    assert.equal(settings.massageLabChromeFlowColorOne, "#C0C0C0")
    assert.equal(settings.massageLabChromeFlowColorTwo, DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowColorTwo)
    assert.equal(settings.massageLabChromeFlowFlowSpeed, 2)
    assert.equal(settings.massageLabChromeFlowTimeScale, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabChromeFlowFlowSpeed: "fast" }).massageLabChromeFlowFlowSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowFlowSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabChromeFlowFlowSpeed: 0 }).massageLabChromeFlowFlowSpeed, 0.01)
    assert.equal(
      sanitizeChimerSettings({ massageLabChromeFlowTimeScale: "warp" }).massageLabChromeFlowTimeScale,
      DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowTimeScale,
    )
    assert.equal(sanitizeChimerSettings({ massageLabChromeFlowTimeScale: 0 }).massageLabChromeFlowTimeScale, 0.001)
    assert.equal(
      sanitizeChimerSettings({ massageLabChromeFlowPaletteMode: "demo" }).massageLabChromeFlowPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabChromeFlowHarmony: "rainbow" }).massageLabChromeFlowHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowHarmony,
    )
  })

  it("normalizes MassageLab Wave Current background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabWaveCurrentPaletteMode: "harmony",
      massageLabWaveCurrentPrimaryColor: "#071697",
      massageLabWaveCurrentHarmony: "triad",
      massageLabWaveCurrentBackgroundColor: "#000000",
      massageLabWaveCurrentColorOne: "#071697",
      massageLabWaveCurrentColorTwo: "#00d4ff",
      massageLabWaveCurrentColorThree: "black",
      massageLabWaveCurrentSpeedX: 9,
      massageLabWaveCurrentSpeedY: 0,
      massageLabWaveCurrentAmplitude: 128,
    })

    assert.equal(settings.massageLabWaveCurrentPaletteMode, "harmony")
    assert.equal(settings.massageLabWaveCurrentPrimaryColor, "#071697")
    assert.equal(settings.massageLabWaveCurrentHarmony, "triad")
    assert.equal(settings.massageLabWaveCurrentBackgroundColor, "#000000")
    assert.equal(settings.massageLabWaveCurrentColorOne, "#071697")
    assert.equal(settings.massageLabWaveCurrentColorTwo, "#00D4FF")
    assert.equal(settings.massageLabWaveCurrentColorThree, DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentColorThree)
    assert.equal(settings.massageLabWaveCurrentSpeedX, 0.1)
    assert.equal(settings.massageLabWaveCurrentSpeedY, 0.001)
    assert.equal(settings.massageLabWaveCurrentAmplitude, 64)
    assert.equal(
      sanitizeChimerSettings({ massageLabWaveCurrentSpeedX: "fast" }).massageLabWaveCurrentSpeedX,
      DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentSpeedX,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWaveCurrentSpeedY: "fast" }).massageLabWaveCurrentSpeedY,
      DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentSpeedY,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWaveCurrentAmplitude: "big" }).massageLabWaveCurrentAmplitude,
      DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentAmplitude,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWaveCurrentPaletteMode: "demo" }).massageLabWaveCurrentPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWaveCurrentPrimaryColor: "blue" }).massageLabWaveCurrentPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWaveCurrentHarmony: "rainbow" }).massageLabWaveCurrentHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentHarmony,
    )
  })

  it("normalizes MassageLab Ferrofluid background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabFerrofluidPaletteMode: "harmony",
      massageLabFerrofluidPrimaryColor: "#ffffff",
      massageLabFerrofluidHarmony: "triad",
      massageLabFerrofluidColorOne: "#010203",
      massageLabFerrofluidColorTwo: "#aabbcc",
      massageLabFerrofluidColorThree: "white",
      massageLabFerrofluidSpeed: 9,
      massageLabFerrofluidScale: 9,
      massageLabFerrofluidTurbulence: -1,
      massageLabFerrofluidFluidity: 0,
      massageLabFerrofluidRimWidth: 9,
      massageLabFerrofluidSharpness: 9,
      massageLabFerrofluidShimmer: 9,
      massageLabFerrofluidGlow: 0,
      massageLabFerrofluidFlowDirection: "left",
      massageLabFerrofluidOpacity: 0,
    })

    assert.equal(settings.massageLabFerrofluidPaletteMode, "harmony")
    assert.equal(settings.massageLabFerrofluidPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabFerrofluidHarmony, "triad")
    assert.equal(settings.massageLabFerrofluidColorOne, "#010203")
    assert.equal(settings.massageLabFerrofluidColorTwo, "#AABBCC")
    assert.equal(settings.massageLabFerrofluidColorThree, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidColorThree)
    assert.equal(settings.massageLabFerrofluidSpeed, 2)
    assert.equal(settings.massageLabFerrofluidScale, 4)
    assert.equal(settings.massageLabFerrofluidTurbulence, 0)
    assert.equal(settings.massageLabFerrofluidFluidity, 0.001)
    assert.equal(settings.massageLabFerrofluidRimWidth, 0.5)
    assert.equal(settings.massageLabFerrofluidSharpness, 6)
    assert.equal(settings.massageLabFerrofluidShimmer, 4)
    assert.equal(settings.massageLabFerrofluidGlow, 0.1)
    assert.equal(settings.massageLabFerrofluidFlowDirection, "left")
    assert.equal(settings.massageLabFerrofluidOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidSpeed: "fast" }).massageLabFerrofluidSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidScale: "large" }).massageLabFerrofluidScale,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidScale,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidTurbulence: "storm" }).massageLabFerrofluidTurbulence,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidTurbulence,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidFluidity: "thin" }).massageLabFerrofluidFluidity,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidFluidity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidRimWidth: "wide" }).massageLabFerrofluidRimWidth,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidRimWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidSharpness: "crisp" }).massageLabFerrofluidSharpness,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidSharpness,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidShimmer: "bright" }).massageLabFerrofluidShimmer,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidShimmer,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidGlow: "bright" }).massageLabFerrofluidGlow,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidFlowDirection: "diagonal" }).massageLabFerrofluidFlowDirection,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidFlowDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidOpacity: "clear" }).massageLabFerrofluidOpacity,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidOpacity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidPaletteMode: "demo" }).massageLabFerrofluidPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidPrimaryColor: "white" }).massageLabFerrofluidPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFerrofluidHarmony: "rainbow" }).massageLabFerrofluidHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidHarmony,
    )
  })

  it("normalizes MassageLab Lightfall background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabLightfallPaletteMode: "harmony",
      massageLabLightfallPrimaryColor: "#a6c8ff",
      massageLabLightfallHarmony: "triad",
      massageLabLightfallColorOne: "#010203",
      massageLabLightfallColorTwo: "#aabbcc",
      massageLabLightfallColorThree: "white",
      massageLabLightfallBackgroundColor: "#0a29ff",
      massageLabLightfallSpeed: 9,
      massageLabLightfallStreakCount: 99,
      massageLabLightfallStreakWidth: 0,
      massageLabLightfallStreakLength: 9,
      massageLabLightfallGlow: 0,
      massageLabLightfallDensity: 0,
      massageLabLightfallTwinkle: 9,
      massageLabLightfallZoom: 99,
      massageLabLightfallBackgroundGlow: 99,
      massageLabLightfallOpacity: 0,
      massageLabLightfallCursorEnabled: true,
      massageLabLightfallCursorStrength: 9,
      massageLabLightfallCursorRadius: 0,
      massageLabLightfallCursorDampening: 9,
    })

    assert.equal(settings.massageLabLightfallPaletteMode, "harmony")
    assert.equal(settings.massageLabLightfallPrimaryColor, "#A6C8FF")
    assert.equal(settings.massageLabLightfallHarmony, "triad")
    assert.equal(settings.massageLabLightfallColorOne, "#010203")
    assert.equal(settings.massageLabLightfallColorTwo, "#AABBCC")
    assert.equal(settings.massageLabLightfallColorThree, DEFAULT_CHIMER_SETTINGS.massageLabLightfallColorThree)
    assert.equal(settings.massageLabLightfallBackgroundColor, "#0A29FF")
    assert.equal(settings.massageLabLightfallSpeed, 2)
    assert.equal(settings.massageLabLightfallStreakCount, 16)
    assert.equal(settings.massageLabLightfallStreakWidth, 0.2)
    assert.equal(settings.massageLabLightfallStreakLength, 3)
    assert.equal(settings.massageLabLightfallGlow, 0.1)
    assert.equal(settings.massageLabLightfallDensity, 0.05)
    assert.equal(settings.massageLabLightfallTwinkle, 1)
    assert.equal(settings.massageLabLightfallZoom, 6)
    assert.equal(settings.massageLabLightfallBackgroundGlow, 1.5)
    assert.equal(settings.massageLabLightfallOpacity, 0.05)
    assert.equal(settings.massageLabLightfallCursorEnabled, true)
    assert.equal(settings.massageLabLightfallCursorStrength, 2)
    assert.equal(settings.massageLabLightfallCursorRadius, 0.05)
    assert.equal(settings.massageLabLightfallCursorDampening, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallSpeed: "fast" }).massageLabLightfallSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallStreakCount: "many" }).massageLabLightfallStreakCount,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakCount,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallStreakWidth: "wide" }).massageLabLightfallStreakWidth,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallStreakLength: "long" }).massageLabLightfallStreakLength,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakLength,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallGlow: "bright" }).massageLabLightfallGlow,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallDensity: "dense" }).massageLabLightfallDensity,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallDensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallTwinkle: "sparkly" }).massageLabLightfallTwinkle,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallTwinkle,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallZoom: "close" }).massageLabLightfallZoom,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallZoom,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallBackgroundGlow: "bright" }).massageLabLightfallBackgroundGlow,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallBackgroundGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallOpacity: "clear" }).massageLabLightfallOpacity,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallOpacity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallCursorEnabled: "yes" }).massageLabLightfallCursorEnabled,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorEnabled,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallCursorStrength: "strong" }).massageLabLightfallCursorStrength,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorStrength,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallCursorRadius: "wide" }).massageLabLightfallCursorRadius,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorRadius,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallCursorDampening: "smooth" }).massageLabLightfallCursorDampening,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorDampening,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallPaletteMode: "demo" }).massageLabLightfallPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallPrimaryColor: "blue" }).massageLabLightfallPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallHarmony: "rainbow" }).massageLabLightfallHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightfallBackgroundColor: "blue" }).massageLabLightfallBackgroundColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallBackgroundColor,
    )
  })

  it("normalizes MassageLab Liquid Ether background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabLiquidEtherPaletteMode: "harmony",
      massageLabLiquidEtherPrimaryColor: "#5227ff",
      massageLabLiquidEtherHarmony: "triad",
      massageLabLiquidEtherColorOne: "#010203",
      massageLabLiquidEtherColorTwo: "#aabbcc",
      massageLabLiquidEtherColorThree: "white",
      massageLabLiquidEtherCursorEnabled: true,
      massageLabLiquidEtherMouseForce: 999,
      massageLabLiquidEtherCursorSize: 0,
      massageLabLiquidEtherIsViscous: true,
      massageLabLiquidEtherViscous: 999,
      massageLabLiquidEtherIterationsViscous: 99.9,
      massageLabLiquidEtherIterationsPoisson: 0,
      massageLabLiquidEtherDt: 0,
      massageLabLiquidEtherBfecc: false,
      massageLabLiquidEtherResolution: 99,
      massageLabLiquidEtherIsBounce: true,
      massageLabLiquidEtherAutoDemo: false,
      massageLabLiquidEtherAutoSpeed: 99,
      massageLabLiquidEtherAutoIntensity: -1,
      massageLabLiquidEtherAutoResumeDelay: 1,
      massageLabLiquidEtherAutoRampDuration: 9,
      massageLabLiquidEtherOpacity: 0,
    })

    assert.equal(settings.massageLabLiquidEtherPaletteMode, "harmony")
    assert.equal(settings.massageLabLiquidEtherPrimaryColor, "#5227FF")
    assert.equal(settings.massageLabLiquidEtherHarmony, "triad")
    assert.equal(settings.massageLabLiquidEtherColorOne, "#010203")
    assert.equal(settings.massageLabLiquidEtherColorTwo, "#AABBCC")
    assert.equal(settings.massageLabLiquidEtherColorThree, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherColorThree)
    assert.equal(settings.massageLabLiquidEtherCursorEnabled, true)
    assert.equal(settings.massageLabLiquidEtherMouseForce, 80)
    assert.equal(settings.massageLabLiquidEtherCursorSize, 20)
    assert.equal(settings.massageLabLiquidEtherIsViscous, true)
    assert.equal(settings.massageLabLiquidEtherViscous, 80)
    assert.equal(settings.massageLabLiquidEtherIterationsViscous, 64)
    assert.equal(settings.massageLabLiquidEtherIterationsPoisson, 4)
    assert.equal(settings.massageLabLiquidEtherDt, 0.004)
    assert.equal(settings.massageLabLiquidEtherBfecc, false)
    assert.equal(settings.massageLabLiquidEtherResolution, 1)
    assert.equal(settings.massageLabLiquidEtherIsBounce, true)
    assert.equal(settings.massageLabLiquidEtherAutoDemo, false)
    assert.equal(settings.massageLabLiquidEtherAutoSpeed, 2)
    assert.equal(settings.massageLabLiquidEtherAutoIntensity, 0)
    assert.equal(settings.massageLabLiquidEtherAutoResumeDelay, 250)
    assert.equal(settings.massageLabLiquidEtherAutoRampDuration, 3)
    assert.equal(settings.massageLabLiquidEtherOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherMouseForce: "strong" }).massageLabLiquidEtherMouseForce,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherMouseForce,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherCursorSize: "wide" }).massageLabLiquidEtherCursorSize,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherCursorSize,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherIsViscous: "yes" }).massageLabLiquidEtherIsViscous,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIsViscous,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherViscous: "thick" }).massageLabLiquidEtherViscous,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherViscous,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherIterationsViscous: "many" })
        .massageLabLiquidEtherIterationsViscous,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIterationsViscous,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherIterationsPoisson: "many" })
        .massageLabLiquidEtherIterationsPoisson,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIterationsPoisson,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherDt: "fast" }).massageLabLiquidEtherDt,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherDt,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherBfecc: "yes" }).massageLabLiquidEtherBfecc,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherBfecc,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherResolution: "sharp" }).massageLabLiquidEtherResolution,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherResolution,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherIsBounce: "yes" }).massageLabLiquidEtherIsBounce,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIsBounce,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherAutoDemo: "yes" }).massageLabLiquidEtherAutoDemo,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoDemo,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherAutoSpeed: "fast" }).massageLabLiquidEtherAutoSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherAutoIntensity: "strong" }).massageLabLiquidEtherAutoIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherAutoResumeDelay: "soon" })
        .massageLabLiquidEtherAutoResumeDelay,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoResumeDelay,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherAutoRampDuration: "slow" })
        .massageLabLiquidEtherAutoRampDuration,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoRampDuration,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherOpacity: "clear" }).massageLabLiquidEtherOpacity,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherOpacity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherPaletteMode: "demo" }).massageLabLiquidEtherPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherPrimaryColor: "purple" }).massageLabLiquidEtherPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLiquidEtherHarmony: "rainbow" }).massageLabLiquidEtherHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherHarmony,
    )
  })

  it("normalizes MassageLab Prism background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabPrismHeight: 99,
      massageLabPrismBaseWidth: 0,
      massageLabPrismAnimationType: "hover",
      massageLabPrismGlow: 99,
      massageLabPrismOffsetX: -999,
      massageLabPrismOffsetY: 999,
      massageLabPrismNoise: -1,
      massageLabPrismTransparent: false,
      massageLabPrismScale: 99,
      massageLabPrismHueShift: 99,
      massageLabPrismColorFrequency: 0,
      massageLabPrismHoverStrength: 99,
      massageLabPrismInertia: 0,
      massageLabPrismBloom: 99,
      massageLabPrismTimeScale: 99,
    })

    assert.equal(settings.massageLabPrismHeight, 8)
    assert.equal(settings.massageLabPrismBaseWidth, 0.5)
    assert.equal(settings.massageLabPrismAnimationType, "hover")
    assert.equal(settings.massageLabPrismGlow, 3)
    assert.equal(settings.massageLabPrismOffsetX, -400)
    assert.equal(settings.massageLabPrismOffsetY, 400)
    assert.equal(settings.massageLabPrismNoise, 0)
    assert.equal(settings.massageLabPrismTransparent, false)
    assert.equal(settings.massageLabPrismScale, 7)
    assert.equal(settings.massageLabPrismHueShift, Math.PI)
    assert.equal(settings.massageLabPrismColorFrequency, 0.1)
    assert.equal(settings.massageLabPrismHoverStrength, 4)
    assert.equal(settings.massageLabPrismInertia, 0.01)
    assert.equal(settings.massageLabPrismBloom, 3)
    assert.equal(settings.massageLabPrismTimeScale, 2)
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismHeight: "tall" }).massageLabPrismHeight,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismHeight,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismBaseWidth: "wide" }).massageLabPrismBaseWidth,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismBaseWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismAnimationType: "orbit" }).massageLabPrismAnimationType,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismAnimationType,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismGlow: "bright" }).massageLabPrismGlow,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismOffsetX: "left" }).massageLabPrismOffsetX,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismOffsetX,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismOffsetY: "up" }).massageLabPrismOffsetY,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismOffsetY,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismNoise: "grainy" }).massageLabPrismNoise,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismNoise,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismTransparent: "yes" }).massageLabPrismTransparent,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismTransparent,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismScale: "large" }).massageLabPrismScale,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismScale,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismHueShift: "purple" }).massageLabPrismHueShift,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismHueShift,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismColorFrequency: "many" }).massageLabPrismColorFrequency,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismColorFrequency,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismHoverStrength: "strong" }).massageLabPrismHoverStrength,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismHoverStrength,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismInertia: "slow" }).massageLabPrismInertia,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismInertia,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismBloom: "bright" }).massageLabPrismBloom,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismBloom,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismTimeScale: "fast" }).massageLabPrismTimeScale,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismTimeScale,
    )
  })

  it("normalizes MassageLab Dark Veil background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabDarkVeilHueShift: 999,
      massageLabDarkVeilNoiseIntensity: 99,
      massageLabDarkVeilScanlineIntensity: -1,
      massageLabDarkVeilSpeed: 99,
      massageLabDarkVeilScanlineFrequency: 99,
      massageLabDarkVeilWarpAmount: -1,
      massageLabDarkVeilResolutionScale: 0,
    })

    assert.equal(settings.massageLabDarkVeilHueShift, 180)
    assert.equal(settings.massageLabDarkVeilNoiseIntensity, 1)
    assert.equal(settings.massageLabDarkVeilScanlineIntensity, 0)
    assert.equal(settings.massageLabDarkVeilSpeed, 2)
    assert.equal(settings.massageLabDarkVeilScanlineFrequency, 40)
    assert.equal(settings.massageLabDarkVeilWarpAmount, 0)
    assert.equal(settings.massageLabDarkVeilResolutionScale, 0.25)
    assert.equal(
      sanitizeChimerSettings({ massageLabDarkVeilHueShift: "purple" }).massageLabDarkVeilHueShift,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilHueShift,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDarkVeilNoiseIntensity: "grainy" }).massageLabDarkVeilNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilNoiseIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDarkVeilScanlineIntensity: "strong" })
        .massageLabDarkVeilScanlineIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilScanlineIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDarkVeilSpeed: "fast" }).massageLabDarkVeilSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDarkVeilScanlineFrequency: "dense" })
        .massageLabDarkVeilScanlineFrequency,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilScanlineFrequency,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDarkVeilWarpAmount: "warped" }).massageLabDarkVeilWarpAmount,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilWarpAmount,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDarkVeilResolutionScale: "sharp" })
        .massageLabDarkVeilResolutionScale,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilResolutionScale,
    )
  })

  it("normalizes MassageLab Light Pillar background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabLightPillarPaletteMode: "harmony",
      massageLabLightPillarPrimaryColor: "#123456",
      massageLabLightPillarHarmony: "triad",
      massageLabLightPillarTopColor: "#abcdef",
      massageLabLightPillarBottomColor: "#fedcba",
      massageLabLightPillarIntensity: 99,
      massageLabLightPillarRotationSpeed: -1,
      massageLabLightPillarInteractive: true,
      massageLabLightPillarGlowAmount: 99,
      massageLabLightPillarWidth: 0,
      massageLabLightPillarHeight: 99,
      massageLabLightPillarNoiseIntensity: -1,
      massageLabLightPillarBlendMode: "normal",
      massageLabLightPillarRotation: 999,
      massageLabLightPillarQuality: "low",
    })

    assert.equal(settings.massageLabLightPillarPaletteMode, "harmony")
    assert.equal(settings.massageLabLightPillarPrimaryColor, "#123456")
    assert.equal(settings.massageLabLightPillarHarmony, "triad")
    assert.equal(settings.massageLabLightPillarTopColor, "#ABCDEF")
    assert.equal(settings.massageLabLightPillarBottomColor, "#FEDCBA")
    assert.equal(settings.massageLabLightPillarIntensity, 3)
    assert.equal(settings.massageLabLightPillarRotationSpeed, 0)
    assert.equal(settings.massageLabLightPillarInteractive, true)
    assert.equal(settings.massageLabLightPillarGlowAmount, 0.03)
    assert.equal(settings.massageLabLightPillarWidth, 0.5)
    assert.equal(settings.massageLabLightPillarHeight, 2)
    assert.equal(settings.massageLabLightPillarNoiseIntensity, 0)
    assert.equal(settings.massageLabLightPillarBlendMode, "normal")
    assert.equal(settings.massageLabLightPillarRotation, 180)
    assert.equal(settings.massageLabLightPillarQuality, "low")
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarPaletteMode: "auto" }).massageLabLightPillarPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarPrimaryColor: "purple" }).massageLabLightPillarPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarHarmony: "wild" }).massageLabLightPillarHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarTopColor: "violet" }).massageLabLightPillarTopColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarTopColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarBottomColor: "pink" }).massageLabLightPillarBottomColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarBottomColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarIntensity: "bright" }).massageLabLightPillarIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarRotationSpeed: "fast" }).massageLabLightPillarRotationSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarRotationSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarInteractive: "yes" }).massageLabLightPillarInteractive,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarInteractive,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarGlowAmount: "glow" }).massageLabLightPillarGlowAmount,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarGlowAmount,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarWidth: "wide" }).massageLabLightPillarWidth,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarHeight: "tall" }).massageLabLightPillarHeight,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarHeight,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarNoiseIntensity: "grainy" })
        .massageLabLightPillarNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarNoiseIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarBlendMode: "multiply" }).massageLabLightPillarBlendMode,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarBlendMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarRotation: "tilted" }).massageLabLightPillarRotation,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarRotation,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightPillarQuality: "ultra" }).massageLabLightPillarQuality,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarQuality,
    )
  })

  it("normalizes MassageLab Silk background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabSilkPaletteMode: "harmony",
      massageLabSilkPrimaryColor: "#123456",
      massageLabSilkHarmony: "triad",
      massageLabSilkColor: "#abcdef",
      massageLabSilkSpeed: 99,
      massageLabSilkScale: 0,
      massageLabSilkNoiseIntensity: 99,
      massageLabSilkRotation: 99,
    })

    assert.equal(settings.massageLabSilkPaletteMode, "harmony")
    assert.equal(settings.massageLabSilkPrimaryColor, "#123456")
    assert.equal(settings.massageLabSilkHarmony, "triad")
    assert.equal(settings.massageLabSilkColor, "#ABCDEF")
    assert.equal(settings.massageLabSilkSpeed, 10)
    assert.equal(settings.massageLabSilkScale, 0.2)
    assert.equal(settings.massageLabSilkNoiseIntensity, 4)
    assert.equal(settings.massageLabSilkRotation, Math.PI)
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkPaletteMode: "auto" }).massageLabSilkPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkPrimaryColor: "purple" }).massageLabSilkPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkHarmony: "wild" }).massageLabSilkHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkColor: "violet" }).massageLabSilkColor,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkSpeed: "fast" }).massageLabSilkSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkScale: "large" }).massageLabSilkScale,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkScale,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkNoiseIntensity: "grainy" }).massageLabSilkNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkNoiseIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSilkRotation: "tilted" }).massageLabSilkRotation,
      DEFAULT_CHIMER_SETTINGS.massageLabSilkRotation,
    )
  })

  it("normalizes MassageLab Floating Lines background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabFloatingLinesPaletteMode: "harmony",
      massageLabFloatingLinesPrimaryColor: "#123456",
      massageLabFloatingLinesHarmony: "triad",
      massageLabFloatingLinesColorOne: "#abcdef",
      massageLabFloatingLinesColorTwo: "#fedcba",
      massageLabFloatingLinesColorThree: "#010203",
      massageLabFloatingLinesEnableTop: false,
      massageLabFloatingLinesEnableMiddle: false,
      massageLabFloatingLinesEnableBottom: true,
      massageLabFloatingLinesTopLineCount: 99,
      massageLabFloatingLinesMiddleLineCount: -1,
      massageLabFloatingLinesBottomLineCount: 8,
      massageLabFloatingLinesTopLineDistance: 0,
      massageLabFloatingLinesMiddleLineDistance: 99,
      massageLabFloatingLinesBottomLineDistance: 4.5,
      massageLabFloatingLinesTopWaveX: 99,
      massageLabFloatingLinesTopWaveY: -99,
      massageLabFloatingLinesTopWaveRotate: 99,
      massageLabFloatingLinesMiddleWaveX: -99,
      massageLabFloatingLinesMiddleWaveY: 99,
      massageLabFloatingLinesMiddleWaveRotate: -99,
      massageLabFloatingLinesBottomWaveX: 1.5,
      massageLabFloatingLinesBottomWaveY: -1.5,
      massageLabFloatingLinesBottomWaveRotate: 0.75,
      massageLabFloatingLinesAnimationSpeed: 99,
      massageLabFloatingLinesInteractive: false,
      massageLabFloatingLinesBendRadius: 99,
      massageLabFloatingLinesBendStrength: -99,
      massageLabFloatingLinesMouseDamping: 99,
      massageLabFloatingLinesParallax: false,
      massageLabFloatingLinesParallaxStrength: 99,
      massageLabFloatingLinesBlendMode: "normal",
    })

    assert.equal(settings.massageLabFloatingLinesPaletteMode, "harmony")
    assert.equal(settings.massageLabFloatingLinesPrimaryColor, "#123456")
    assert.equal(settings.massageLabFloatingLinesHarmony, "triad")
    assert.equal(settings.massageLabFloatingLinesColorOne, "#ABCDEF")
    assert.equal(settings.massageLabFloatingLinesColorTwo, "#FEDCBA")
    assert.equal(settings.massageLabFloatingLinesColorThree, "#010203")
    assert.equal(settings.massageLabFloatingLinesEnableTop, false)
    assert.equal(settings.massageLabFloatingLinesEnableMiddle, false)
    assert.equal(settings.massageLabFloatingLinesEnableBottom, true)
    assert.equal(settings.massageLabFloatingLinesTopLineCount, 32)
    assert.equal(settings.massageLabFloatingLinesMiddleLineCount, 0)
    assert.equal(settings.massageLabFloatingLinesBottomLineCount, 8)
    assert.equal(settings.massageLabFloatingLinesTopLineDistance, 0.1)
    assert.equal(settings.massageLabFloatingLinesMiddleLineDistance, 20)
    assert.equal(settings.massageLabFloatingLinesBottomLineDistance, 4.5)
    assert.equal(settings.massageLabFloatingLinesTopWaveX, 20)
    assert.equal(settings.massageLabFloatingLinesTopWaveY, -4)
    assert.equal(settings.massageLabFloatingLinesTopWaveRotate, 4)
    assert.equal(settings.massageLabFloatingLinesMiddleWaveX, -20)
    assert.equal(settings.massageLabFloatingLinesMiddleWaveY, 4)
    assert.equal(settings.massageLabFloatingLinesMiddleWaveRotate, -4)
    assert.equal(settings.massageLabFloatingLinesBottomWaveX, 1.5)
    assert.equal(settings.massageLabFloatingLinesBottomWaveY, -1.5)
    assert.equal(settings.massageLabFloatingLinesBottomWaveRotate, 0.75)
    assert.equal(settings.massageLabFloatingLinesAnimationSpeed, 4)
    assert.equal(settings.massageLabFloatingLinesInteractive, false)
    assert.equal(settings.massageLabFloatingLinesBendRadius, 20)
    assert.equal(settings.massageLabFloatingLinesBendStrength, -2)
    assert.equal(settings.massageLabFloatingLinesMouseDamping, 1)
    assert.equal(settings.massageLabFloatingLinesParallax, false)
    assert.equal(settings.massageLabFloatingLinesParallaxStrength, 1)
    assert.equal(settings.massageLabFloatingLinesBlendMode, "normal")
    assert.equal(
      sanitizeChimerSettings({ massageLabFloatingLinesPaletteMode: "auto" }).massageLabFloatingLinesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFloatingLinesPrimaryColor: "purple" }).massageLabFloatingLinesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFloatingLinesHarmony: "wild" }).massageLabFloatingLinesHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFloatingLinesBlendMode: "multiply" }).massageLabFloatingLinesBlendMode,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBlendMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFloatingLinesAnimationSpeed: "fast" })
        .massageLabFloatingLinesAnimationSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesAnimationSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFloatingLinesInteractive: "yes" }).massageLabFloatingLinesInteractive,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesInteractive,
    )
  })

  it("normalizes MassageLab Side Rays background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabSideRaysPaletteMode: "harmony",
      massageLabSideRaysPrimaryColor: "#eab308",
      massageLabSideRaysHarmony: "triad",
      massageLabSideRaysColorOne: "#abcdef",
      massageLabSideRaysColorTwo: "#fedcba",
      massageLabSideRaysSpeed: 99,
      massageLabSideRaysIntensity: 99,
      massageLabSideRaysSpread: 0,
      massageLabSideRaysOrigin: "bottom-left",
      massageLabSideRaysTilt: -999,
      massageLabSideRaysSaturation: 99,
      massageLabSideRaysBlend: -1,
      massageLabSideRaysFalloff: 99,
      massageLabSideRaysOpacity: 2,
    })

    assert.equal(settings.massageLabSideRaysPaletteMode, "harmony")
    assert.equal(settings.massageLabSideRaysPrimaryColor, "#EAB308")
    assert.equal(settings.massageLabSideRaysHarmony, "triad")
    assert.equal(settings.massageLabSideRaysColorOne, "#ABCDEF")
    assert.equal(settings.massageLabSideRaysColorTwo, "#FEDCBA")
    assert.equal(settings.massageLabSideRaysSpeed, 8)
    assert.equal(settings.massageLabSideRaysIntensity, 6)
    assert.equal(settings.massageLabSideRaysSpread, 0.1)
    assert.equal(settings.massageLabSideRaysOrigin, "bottom-left")
    assert.equal(settings.massageLabSideRaysTilt, -90)
    assert.equal(settings.massageLabSideRaysSaturation, 3)
    assert.equal(settings.massageLabSideRaysBlend, 0)
    assert.equal(settings.massageLabSideRaysFalloff, 4)
    assert.equal(settings.massageLabSideRaysOpacity, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabSideRaysPaletteMode: "auto" }).massageLabSideRaysPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabSideRaysPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSideRaysPrimaryColor: "yellow" }).massageLabSideRaysPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabSideRaysPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSideRaysHarmony: "wild" }).massageLabSideRaysHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabSideRaysHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSideRaysColorOne: "gold" }).massageLabSideRaysColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabSideRaysColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSideRaysColorTwo: "blue" }).massageLabSideRaysColorTwo,
      DEFAULT_CHIMER_SETTINGS.massageLabSideRaysColorTwo,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSideRaysOrigin: "center" }).massageLabSideRaysOrigin,
      DEFAULT_CHIMER_SETTINGS.massageLabSideRaysOrigin,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSideRaysSpeed: "fast" }).massageLabSideRaysSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabSideRaysSpeed,
    )
  })

  it("normalizes Light Rays background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabLightRaysPaletteMode: "harmony",
      massageLabLightRaysPrimaryColor: "#ffffff",
      massageLabLightRaysHarmony: "triad",
      massageLabLightRaysColor: "#abcdef",
      massageLabLightRaysOrigin: "bottom-center",
      massageLabLightRaysSpeed: 99,
      massageLabLightRaysSpread: 0,
      massageLabLightRaysLength: 99,
      massageLabLightRaysPulsating: true,
      massageLabLightRaysFadeDistance: 99,
      massageLabLightRaysSaturation: 99,
      massageLabLightRaysFollowMouse: true,
      massageLabLightRaysMouseInfluence: -1,
      massageLabLightRaysNoiseAmount: 99,
      massageLabLightRaysDistortion: 99,
    })

    assert.equal(settings.massageLabLightRaysPaletteMode, "harmony")
    assert.equal(settings.massageLabLightRaysPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabLightRaysHarmony, "triad")
    assert.equal(settings.massageLabLightRaysColor, "#ABCDEF")
    assert.equal(settings.massageLabLightRaysOrigin, "bottom-center")
    assert.equal(settings.massageLabLightRaysSpeed, 4)
    assert.equal(settings.massageLabLightRaysSpread, 0.1)
    assert.equal(settings.massageLabLightRaysLength, 5)
    assert.equal(settings.massageLabLightRaysPulsating, true)
    assert.equal(settings.massageLabLightRaysFadeDistance, 3)
    assert.equal(settings.massageLabLightRaysSaturation, 3)
    assert.equal(settings.massageLabLightRaysFollowMouse, true)
    assert.equal(settings.massageLabLightRaysMouseInfluence, 0)
    assert.equal(settings.massageLabLightRaysNoiseAmount, 1)
    assert.equal(settings.massageLabLightRaysDistortion, 2)
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysPaletteMode: "auto" }).massageLabLightRaysPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysPrimaryColor: "white" }).massageLabLightRaysPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysHarmony: "wild" }).massageLabLightRaysHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysColor: "white" }).massageLabLightRaysColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysOrigin: "center" }).massageLabLightRaysOrigin,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysOrigin,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysSpeed: "fast" }).massageLabLightRaysSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysPulsating: "yes" }).massageLabLightRaysPulsating,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysPulsating,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightRaysFollowMouse: "yes" }).massageLabLightRaysFollowMouse,
      DEFAULT_CHIMER_SETTINGS.massageLabLightRaysFollowMouse,
    )
  })

  it("normalizes MassageLab Pixel Blast background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabPixelBlastPaletteMode: "harmony",
      massageLabPixelBlastPrimaryColor: "#ffffff",
      massageLabPixelBlastHarmony: "triad",
      massageLabPixelBlastColor: "#abcdef",
      massageLabPixelBlastVariant: "diamond",
      massageLabPixelBlastPixelSize: 99,
      massageLabPixelBlastAntialias: false,
      massageLabPixelBlastPatternScale: 99,
      massageLabPixelBlastPatternDensity: -1,
      massageLabPixelBlastLiquid: true,
      massageLabPixelBlastLiquidStrength: 99,
      massageLabPixelBlastLiquidRadius: 99,
      massageLabPixelBlastPixelSizeJitter: 99,
      massageLabPixelBlastEnableRipples: false,
      massageLabPixelBlastRippleIntensityScale: 99,
      massageLabPixelBlastRippleThickness: 99,
      massageLabPixelBlastRippleSpeed: 99,
      massageLabPixelBlastLiquidWobbleSpeed: 99,
      massageLabPixelBlastAutoPauseOffscreen: false,
      massageLabPixelBlastSpeed: 99,
      massageLabPixelBlastTransparent: false,
      massageLabPixelBlastEdgeFade: 99,
      massageLabPixelBlastNoiseAmount: 99,
    })

    assert.equal(settings.massageLabPixelBlastPaletteMode, "harmony")
    assert.equal(settings.massageLabPixelBlastPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabPixelBlastHarmony, "triad")
    assert.equal(settings.massageLabPixelBlastColor, "#ABCDEF")
    assert.equal(settings.massageLabPixelBlastVariant, "diamond")
    assert.equal(settings.massageLabPixelBlastPixelSize, 16)
    assert.equal(settings.massageLabPixelBlastAntialias, false)
    assert.equal(settings.massageLabPixelBlastPatternScale, 8)
    assert.equal(settings.massageLabPixelBlastPatternDensity, 0)
    assert.equal(settings.massageLabPixelBlastLiquid, true)
    assert.equal(settings.massageLabPixelBlastLiquidStrength, 0.4)
    assert.equal(settings.massageLabPixelBlastLiquidRadius, 4)
    assert.equal(settings.massageLabPixelBlastPixelSizeJitter, 1)
    assert.equal(settings.massageLabPixelBlastEnableRipples, false)
    assert.equal(settings.massageLabPixelBlastRippleIntensityScale, 4)
    assert.equal(settings.massageLabPixelBlastRippleThickness, 0.5)
    assert.equal(settings.massageLabPixelBlastRippleSpeed, 2)
    assert.equal(settings.massageLabPixelBlastLiquidWobbleSpeed, 10)
    assert.equal(settings.massageLabPixelBlastAutoPauseOffscreen, false)
    assert.equal(settings.massageLabPixelBlastSpeed, 3)
    assert.equal(settings.massageLabPixelBlastTransparent, false)
    assert.equal(settings.massageLabPixelBlastEdgeFade, 1)
    assert.equal(settings.massageLabPixelBlastNoiseAmount, 0.4)
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastPaletteMode: "auto" }).massageLabPixelBlastPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastPrimaryColor: "white" }).massageLabPixelBlastPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastHarmony: "wild" }).massageLabPixelBlastHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastColor: "white" }).massageLabPixelBlastColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastVariant: "hex" }).massageLabPixelBlastVariant,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastVariant,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastSpeed: "fast" }).massageLabPixelBlastSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastAntialias: "yes" }).massageLabPixelBlastAntialias,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastAntialias,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastLiquid: "yes" }).massageLabPixelBlastLiquid,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastLiquid,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastEnableRipples: "no" }).massageLabPixelBlastEnableRipples,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastEnableRipples,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastAutoPauseOffscreen: "no" }).massageLabPixelBlastAutoPauseOffscreen,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastAutoPauseOffscreen,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelBlastTransparent: "no" }).massageLabPixelBlastTransparent,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastTransparent,
    )
  })

  it("normalizes MassageLab Color Bends background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabColorBendsPaletteMode: "harmony",
      massageLabColorBendsPrimaryColor: "#ffffff",
      massageLabColorBendsHarmony: "triad",
      massageLabColorBendsColorOne: "#abcdef",
      massageLabColorBendsColorTwo: "#123456",
      massageLabColorBendsColorThree: "#654321",
      massageLabColorBendsColorFour: "#010203",
      massageLabColorBendsRotation: 999,
      massageLabColorBendsSpeed: 99,
      massageLabColorBendsTransparent: false,
      massageLabColorBendsAutoRotate: 999,
      massageLabColorBendsScale: 99,
      massageLabColorBendsFrequency: 99,
      massageLabColorBendsWarpStrength: 99,
      massageLabColorBendsInteractive: true,
      massageLabColorBendsMouseInfluence: 99,
      massageLabColorBendsParallax: 99,
      massageLabColorBendsNoise: 99,
      massageLabColorBendsIterations: 99,
      massageLabColorBendsIntensity: 99,
      massageLabColorBendsBandWidth: 99,
    })

    assert.equal(settings.massageLabColorBendsPaletteMode, "harmony")
    assert.equal(settings.massageLabColorBendsPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabColorBendsHarmony, "triad")
    assert.equal(settings.massageLabColorBendsColorOne, "#ABCDEF")
    assert.equal(settings.massageLabColorBendsColorTwo, "#123456")
    assert.equal(settings.massageLabColorBendsColorThree, "#654321")
    assert.equal(settings.massageLabColorBendsColorFour, "#010203")
    assert.equal(settings.massageLabColorBendsRotation, 360)
    assert.equal(settings.massageLabColorBendsSpeed, 3)
    assert.equal(settings.massageLabColorBendsTransparent, false)
    assert.equal(settings.massageLabColorBendsAutoRotate, 180)
    assert.equal(settings.massageLabColorBendsScale, 4)
    assert.equal(settings.massageLabColorBendsFrequency, 4)
    assert.equal(settings.massageLabColorBendsWarpStrength, 3)
    assert.equal(settings.massageLabColorBendsInteractive, true)
    assert.equal(settings.massageLabColorBendsMouseInfluence, 3)
    assert.equal(settings.massageLabColorBendsParallax, 2)
    assert.equal(settings.massageLabColorBendsNoise, 1)
    assert.equal(settings.massageLabColorBendsIterations, 5)
    assert.equal(settings.massageLabColorBendsIntensity, 4)
    assert.equal(settings.massageLabColorBendsBandWidth, 16)
    assert.equal(
      sanitizeChimerSettings({ massageLabColorBendsPaletteMode: "auto" }).massageLabColorBendsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabColorBendsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabColorBendsPrimaryColor: "white" }).massageLabColorBendsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabColorBendsPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabColorBendsHarmony: "wild" }).massageLabColorBendsHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabColorBendsHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabColorBendsColorOne: "white" }).massageLabColorBendsColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabColorBendsColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabColorBendsSpeed: "fast" }).massageLabColorBendsSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabColorBendsSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabColorBendsTransparent: "no" }).massageLabColorBendsTransparent,
      DEFAULT_CHIMER_SETTINGS.massageLabColorBendsTransparent,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabColorBendsInteractive: "yes" }).massageLabColorBendsInteractive,
      DEFAULT_CHIMER_SETTINGS.massageLabColorBendsInteractive,
    )
  })

  it("normalizes MassageLab Evil Eye background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabEvilEyePaletteMode: "harmony",
      massageLabEvilEyePrimaryColor: "#ffffff",
      massageLabEvilEyeHarmony: "triad",
      massageLabEvilEyeColor: "#abcdef",
      massageLabEvilEyeBackgroundColor: "#010203",
      massageLabEvilEyeIntensity: 99,
      massageLabEvilEyePupilSize: 99,
      massageLabEvilEyeIrisWidth: 99,
      massageLabEvilEyeGlowIntensity: 99,
      massageLabEvilEyeScale: 99,
      massageLabEvilEyeNoiseScale: 99,
      massageLabEvilEyePupilFollow: 99,
      massageLabEvilEyeFlameSpeed: 99,
      massageLabEvilEyeInteractive: true,
    })

    assert.equal(settings.massageLabEvilEyePaletteMode, "harmony")
    assert.equal(settings.massageLabEvilEyePrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabEvilEyeHarmony, "triad")
    assert.equal(settings.massageLabEvilEyeColor, "#ABCDEF")
    assert.equal(settings.massageLabEvilEyeBackgroundColor, "#010203")
    assert.equal(settings.massageLabEvilEyeIntensity, 3)
    assert.equal(settings.massageLabEvilEyePupilSize, 2)
    assert.equal(settings.massageLabEvilEyeIrisWidth, 1)
    assert.equal(settings.massageLabEvilEyeGlowIntensity, 1.5)
    assert.equal(settings.massageLabEvilEyeScale, 2)
    assert.equal(settings.massageLabEvilEyeNoiseScale, 4)
    assert.equal(settings.massageLabEvilEyePupilFollow, 2)
    assert.equal(settings.massageLabEvilEyeFlameSpeed, 3)
    assert.equal(settings.massageLabEvilEyeInteractive, true)
    assert.equal(
      sanitizeChimerSettings({ massageLabEvilEyePaletteMode: "auto" }).massageLabEvilEyePaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabEvilEyePaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabEvilEyePrimaryColor: "white" }).massageLabEvilEyePrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabEvilEyePrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabEvilEyeHarmony: "wild" }).massageLabEvilEyeHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabEvilEyeColor: "white" }).massageLabEvilEyeColor,
      DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabEvilEyeBackgroundColor: "black" }).massageLabEvilEyeBackgroundColor,
      DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeBackgroundColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabEvilEyeFlameSpeed: "fast" }).massageLabEvilEyeFlameSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeFlameSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabEvilEyeInteractive: "yes" }).massageLabEvilEyeInteractive,
      DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeInteractive,
    )
  })

  it("normalizes MassageLab Line Waves background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabLineWavesPaletteMode: "harmony",
      massageLabLineWavesPrimaryColor: "#ffffff",
      massageLabLineWavesHarmony: "triad",
      massageLabLineWavesColorOne: "#abcdef",
      massageLabLineWavesColorTwo: "#123456",
      massageLabLineWavesColorThree: "#654321",
      massageLabLineWavesSpeed: 99,
      massageLabLineWavesInnerLineCount: 999,
      massageLabLineWavesOuterLineCount: 999,
      massageLabLineWavesWarpIntensity: 99,
      massageLabLineWavesRotation: 999,
      massageLabLineWavesEdgeFadeWidth: 99,
      massageLabLineWavesColorCycleSpeed: 99,
      massageLabLineWavesBrightness: 99,
      massageLabLineWavesEnableMouseInteraction: true,
      massageLabLineWavesMouseInfluence: 99,
    })

    assert.equal(settings.massageLabLineWavesPaletteMode, "harmony")
    assert.equal(settings.massageLabLineWavesPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabLineWavesHarmony, "triad")
    assert.equal(settings.massageLabLineWavesColorOne, "#ABCDEF")
    assert.equal(settings.massageLabLineWavesColorTwo, "#123456")
    assert.equal(settings.massageLabLineWavesColorThree, "#654321")
    assert.equal(settings.massageLabLineWavesSpeed, 3)
    assert.equal(settings.massageLabLineWavesInnerLineCount, 96)
    assert.equal(settings.massageLabLineWavesOuterLineCount, 96)
    assert.equal(settings.massageLabLineWavesWarpIntensity, 3)
    assert.equal(settings.massageLabLineWavesRotation, 180)
    assert.equal(settings.massageLabLineWavesEdgeFadeWidth, 1)
    assert.equal(settings.massageLabLineWavesColorCycleSpeed, 4)
    assert.equal(settings.massageLabLineWavesBrightness, 1.5)
    assert.equal(settings.massageLabLineWavesEnableMouseInteraction, true)
    assert.equal(settings.massageLabLineWavesMouseInfluence, 4)
    assert.equal(
      sanitizeChimerSettings({ massageLabLineWavesPaletteMode: "auto" }).massageLabLineWavesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabLineWavesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLineWavesPrimaryColor: "white" }).massageLabLineWavesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLineWavesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLineWavesHarmony: "wild" }).massageLabLineWavesHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabLineWavesHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLineWavesColorOne: "white" }).massageLabLineWavesColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabLineWavesColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLineWavesSpeed: "fast" }).massageLabLineWavesSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLineWavesSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLineWavesEnableMouseInteraction: "yes" }).massageLabLineWavesEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabLineWavesEnableMouseInteraction,
    )
  })

  it("normalizes MassageLab Radar background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabRadarPaletteMode: "harmony",
      massageLabRadarPrimaryColor: "#ffffff",
      massageLabRadarHarmony: "triad",
      massageLabRadarColor: "#abcdef",
      massageLabRadarBackgroundColor: "#010203",
      massageLabRadarSpeed: 99,
      massageLabRadarScale: 99,
      massageLabRadarRingCount: 99,
      massageLabRadarSpokeCount: 99,
      massageLabRadarRingThickness: 99,
      massageLabRadarSpokeThickness: 99,
      massageLabRadarSweepSpeed: 99,
      massageLabRadarSweepWidth: 99,
      massageLabRadarSweepLobes: 99,
      massageLabRadarFalloff: 99,
      massageLabRadarBrightness: 99,
      massageLabRadarEnableMouseInteraction: true,
      massageLabRadarMouseInfluence: 99,
    })

    assert.equal(settings.massageLabRadarPaletteMode, "harmony")
    assert.equal(settings.massageLabRadarPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabRadarHarmony, "triad")
    assert.equal(settings.massageLabRadarColor, "#ABCDEF")
    assert.equal(settings.massageLabRadarBackgroundColor, "#010203")
    assert.equal(settings.massageLabRadarSpeed, 3)
    assert.equal(settings.massageLabRadarScale, 2)
    assert.equal(settings.massageLabRadarRingCount, 40)
    assert.equal(settings.massageLabRadarSpokeCount, 40)
    assert.equal(settings.massageLabRadarRingThickness, 0.25)
    assert.equal(settings.massageLabRadarSpokeThickness, 0.1)
    assert.equal(settings.massageLabRadarSweepSpeed, 4)
    assert.equal(settings.massageLabRadarSweepWidth, 12)
    assert.equal(settings.massageLabRadarSweepLobes, 12)
    assert.equal(settings.massageLabRadarFalloff, 8)
    assert.equal(settings.massageLabRadarBrightness, 3)
    assert.equal(settings.massageLabRadarEnableMouseInteraction, true)
    assert.equal(settings.massageLabRadarMouseInfluence, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabRadarPaletteMode: "auto" }).massageLabRadarPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabRadarPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRadarPrimaryColor: "white" }).massageLabRadarPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabRadarPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRadarHarmony: "wild" }).massageLabRadarHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabRadarHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRadarColor: "white" }).massageLabRadarColor,
      DEFAULT_CHIMER_SETTINGS.massageLabRadarColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRadarSpeed: "fast" }).massageLabRadarSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabRadarSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRadarEnableMouseInteraction: "yes" }).massageLabRadarEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabRadarEnableMouseInteraction,
    )
  })

  it("normalizes MassageLab Soft Aurora field controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabSoftAuroraPaletteMode: "harmony",
      massageLabSoftAuroraPrimaryColor: "#ffffff",
      massageLabSoftAuroraHarmony: "triad",
      massageLabSoftAuroraColorOne: "#abcdef",
      massageLabSoftAuroraColorTwo: "#010203",
      massageLabSoftAuroraSpeed: 99,
      massageLabSoftAuroraScale: 99,
      massageLabSoftAuroraBrightness: 99,
      massageLabSoftAuroraNoiseFrequency: 99,
      massageLabSoftAuroraNoiseAmplitude: 99,
      massageLabSoftAuroraBandHeight: -99,
      massageLabSoftAuroraBandSpread: 99,
      massageLabSoftAuroraOctaveDecay: 99,
      massageLabSoftAuroraLayerOffset: -99,
      massageLabSoftAuroraColorSpeed: 99,
      massageLabSoftAuroraEnableMouseInteraction: true,
      massageLabSoftAuroraMouseInfluence: 99,
    })

    assert.equal(settings.massageLabSoftAuroraPaletteMode, "harmony")
    assert.equal(settings.massageLabSoftAuroraPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabSoftAuroraHarmony, "triad")
    assert.equal(settings.massageLabSoftAuroraColorOne, "#ABCDEF")
    assert.equal(settings.massageLabSoftAuroraColorTwo, "#010203")
    assert.equal(settings.massageLabSoftAuroraSpeed, 3)
    assert.equal(settings.massageLabSoftAuroraScale, 4)
    assert.equal(settings.massageLabSoftAuroraBrightness, 3)
    assert.equal(settings.massageLabSoftAuroraNoiseFrequency, 8)
    assert.equal(settings.massageLabSoftAuroraNoiseAmplitude, 4)
    assert.equal(settings.massageLabSoftAuroraBandHeight, -1)
    assert.equal(settings.massageLabSoftAuroraBandSpread, 4)
    assert.equal(settings.massageLabSoftAuroraOctaveDecay, 1)
    assert.equal(settings.massageLabSoftAuroraLayerOffset, -6)
    assert.equal(settings.massageLabSoftAuroraColorSpeed, 4)
    assert.equal(settings.massageLabSoftAuroraEnableMouseInteraction, true)
    assert.equal(settings.massageLabSoftAuroraMouseInfluence, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabSoftAuroraPaletteMode: "auto" }).massageLabSoftAuroraPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSoftAuroraPrimaryColor: "white" }).massageLabSoftAuroraPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSoftAuroraHarmony: "wild" }).massageLabSoftAuroraHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSoftAuroraColorOne: "white" }).massageLabSoftAuroraColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSoftAuroraSpeed: "fast" }).massageLabSoftAuroraSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSoftAuroraEnableMouseInteraction: "yes" }).massageLabSoftAuroraEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraEnableMouseInteraction,
    )
  })

  it("normalizes MassageLab Plasma background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabPlasmaPaletteMode: "harmony",
      massageLabPlasmaPrimaryColor: "#ffffff",
      massageLabPlasmaHarmony: "triad",
      massageLabPlasmaColor: "#abcdef",
      massageLabPlasmaSpeed: 99,
      massageLabPlasmaDirection: "pingpong",
      massageLabPlasmaScale: 99,
      massageLabPlasmaOpacity: 99,
      massageLabPlasmaMouseInteractive: true,
    })

    assert.equal(settings.massageLabPlasmaPaletteMode, "harmony")
    assert.equal(settings.massageLabPlasmaPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabPlasmaHarmony, "triad")
    assert.equal(settings.massageLabPlasmaColor, "#ABCDEF")
    assert.equal(settings.massageLabPlasmaSpeed, 3)
    assert.equal(settings.massageLabPlasmaDirection, "pingpong")
    assert.equal(settings.massageLabPlasmaScale, 4)
    assert.equal(settings.massageLabPlasmaOpacity, 1)
    assert.equal(settings.massageLabPlasmaMouseInteractive, true)
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaPaletteMode: "auto" }).massageLabPlasmaPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaPrimaryColor: "white" }).massageLabPlasmaPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaHarmony: "wild" }).massageLabPlasmaHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaColor: "white" }).massageLabPlasmaColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaSpeed: "fast" }).massageLabPlasmaSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaDirection: "sideways" }).massageLabPlasmaDirection,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaMouseInteractive: "yes" }).massageLabPlasmaMouseInteractive,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaMouseInteractive,
    )
  })

  it("normalizes MassageLab Plasma Wave background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabPlasmaWavePaletteMode: "harmony",
      massageLabPlasmaWavePrimaryColor: "#ffffff",
      massageLabPlasmaWaveHarmony: "triad",
      massageLabPlasmaWaveColorOne: "#abcdef",
      massageLabPlasmaWaveColorTwo: "#010203",
      massageLabPlasmaWaveXOffset: 9999,
      massageLabPlasmaWaveYOffset: -9999,
      massageLabPlasmaWaveRotationDeg: 9999,
      massageLabPlasmaWaveFocalLength: 99,
      massageLabPlasmaWaveSpeedOne: 99,
      massageLabPlasmaWaveSpeedTwo: 99,
      massageLabPlasmaWaveDirectionTwo: -1,
      massageLabPlasmaWaveBendOne: 99,
      massageLabPlasmaWaveBendTwo: 99,
    })

    assert.equal(settings.massageLabPlasmaWavePaletteMode, "harmony")
    assert.equal(settings.massageLabPlasmaWavePrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabPlasmaWaveHarmony, "triad")
    assert.equal(settings.massageLabPlasmaWaveColorOne, "#ABCDEF")
    assert.equal(settings.massageLabPlasmaWaveColorTwo, "#010203")
    assert.equal(settings.massageLabPlasmaWaveXOffset, 800)
    assert.equal(settings.massageLabPlasmaWaveYOffset, -800)
    assert.equal(settings.massageLabPlasmaWaveRotationDeg, 180)
    assert.equal(settings.massageLabPlasmaWaveFocalLength, 2)
    assert.equal(settings.massageLabPlasmaWaveSpeedOne, 0.5)
    assert.equal(settings.massageLabPlasmaWaveSpeedTwo, 0.5)
    assert.equal(settings.massageLabPlasmaWaveDirectionTwo, -1)
    assert.equal(settings.massageLabPlasmaWaveBendOne, 3)
    assert.equal(settings.massageLabPlasmaWaveBendTwo, 3)
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaWavePaletteMode: "auto" }).massageLabPlasmaWavePaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWavePaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaWavePrimaryColor: "white" }).massageLabPlasmaWavePrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWavePrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaWaveHarmony: "wild" }).massageLabPlasmaWaveHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaWaveColorOne: "white" }).massageLabPlasmaWaveColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaWaveSpeedOne: "fast" }).massageLabPlasmaWaveSpeedOne,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveSpeedOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPlasmaWaveDirectionTwo: "reverse" }).massageLabPlasmaWaveDirectionTwo,
      DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveDirectionTwo,
    )
  })

  it("normalizes MassageLab Particles background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabParticlesPaletteMode: "harmony",
      massageLabParticlesPrimaryColor: "#ffffff",
      massageLabParticlesHarmony: "triad",
      massageLabParticlesColorOne: "#abcdef",
      massageLabParticlesColorTwo: "#010203",
      massageLabParticlesColorThree: "#111111",
      massageLabParticlesCount: 9999.6,
      massageLabParticlesSpread: 99,
      massageLabParticlesSpeed: 99,
      massageLabParticlesMoveOnHover: true,
      massageLabParticlesHoverFactor: 99,
      massageLabParticlesAlpha: true,
      massageLabParticlesBaseSize: 999,
      massageLabParticlesSizeRandomness: 99,
      massageLabParticlesCameraDistance: 999,
      massageLabParticlesDisableRotation: true,
      massageLabParticlesPixelRatio: 99,
    })

    assert.equal(settings.massageLabParticlesPaletteMode, "harmony")
    assert.equal(settings.massageLabParticlesPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabParticlesHarmony, "triad")
    assert.equal(settings.massageLabParticlesColorOne, "#ABCDEF")
    assert.equal(settings.massageLabParticlesColorTwo, "#010203")
    assert.equal(settings.massageLabParticlesColorThree, "#111111")
    assert.equal(settings.massageLabParticlesCount, 1500)
    assert.equal(settings.massageLabParticlesSpread, 30)
    assert.equal(settings.massageLabParticlesSpeed, 1)
    assert.equal(settings.massageLabParticlesMoveOnHover, true)
    assert.equal(settings.massageLabParticlesHoverFactor, 5)
    assert.equal(settings.massageLabParticlesAlpha, true)
    assert.equal(settings.massageLabParticlesBaseSize, 300)
    assert.equal(settings.massageLabParticlesSizeRandomness, 3)
    assert.equal(settings.massageLabParticlesCameraDistance, 60)
    assert.equal(settings.massageLabParticlesDisableRotation, true)
    assert.equal(settings.massageLabParticlesPixelRatio, 2)
    assert.equal(
      sanitizeChimerSettings({ massageLabParticlesPaletteMode: "auto" }).massageLabParticlesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabParticlesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabParticlesPrimaryColor: "white" }).massageLabParticlesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabParticlesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabParticlesHarmony: "wild" }).massageLabParticlesHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabParticlesHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabParticlesColorOne: "white" }).massageLabParticlesColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabParticlesColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabParticlesCount: "many" }).massageLabParticlesCount,
      DEFAULT_CHIMER_SETTINGS.massageLabParticlesCount,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabParticlesMoveOnHover: "yes" }).massageLabParticlesMoveOnHover,
      DEFAULT_CHIMER_SETTINGS.massageLabParticlesMoveOnHover,
    )
  })

  it("normalizes MassageLab Gradient Blinds background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabGradientBlindsPaletteMode: "harmony",
      massageLabGradientBlindsPrimaryColor: "#ff9ffc",
      massageLabGradientBlindsHarmony: "triad",
      massageLabGradientBlindsColorOne: "#abcdef",
      massageLabGradientBlindsColorTwo: "#010203",
      massageLabGradientBlindsAngle: 999,
      massageLabGradientBlindsNoise: 99,
      massageLabGradientBlindsBlindCount: 999.6,
      massageLabGradientBlindsBlindMinWidth: 999,
      massageLabGradientBlindsMouseDampening: 99,
      massageLabGradientBlindsMirror: true,
      massageLabGradientBlindsSpotlightRadius: 99,
      massageLabGradientBlindsSpotlightSoftness: 99,
      massageLabGradientBlindsSpotlightOpacity: 99,
      massageLabGradientBlindsDistort: 99,
      massageLabGradientBlindsShineDirection: "right",
      massageLabGradientBlindsBlendMode: "screen",
      massageLabGradientBlindsDpr: 99,
      massageLabGradientBlindsEnableMouseInteraction: true,
    })

    assert.equal(settings.massageLabGradientBlindsPaletteMode, "harmony")
    assert.equal(settings.massageLabGradientBlindsPrimaryColor, "#FF9FFC")
    assert.equal(settings.massageLabGradientBlindsHarmony, "triad")
    assert.equal(settings.massageLabGradientBlindsColorOne, "#ABCDEF")
    assert.equal(settings.massageLabGradientBlindsColorTwo, "#010203")
    assert.equal(settings.massageLabGradientBlindsAngle, 180)
    assert.equal(settings.massageLabGradientBlindsNoise, 1)
    assert.equal(settings.massageLabGradientBlindsBlindCount, 80)
    assert.equal(settings.massageLabGradientBlindsBlindMinWidth, 240)
    assert.equal(settings.massageLabGradientBlindsMouseDampening, 1)
    assert.equal(settings.massageLabGradientBlindsMirror, true)
    assert.equal(settings.massageLabGradientBlindsSpotlightRadius, 1.5)
    assert.equal(settings.massageLabGradientBlindsSpotlightSoftness, 4)
    assert.equal(settings.massageLabGradientBlindsSpotlightOpacity, 2)
    assert.equal(settings.massageLabGradientBlindsDistort, 5)
    assert.equal(settings.massageLabGradientBlindsShineDirection, "right")
    assert.equal(settings.massageLabGradientBlindsBlendMode, "screen")
    assert.equal(settings.massageLabGradientBlindsDpr, 2)
    assert.equal(settings.massageLabGradientBlindsEnableMouseInteraction, true)
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsPaletteMode: "auto" }).massageLabGradientBlindsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsPrimaryColor: "pink" }).massageLabGradientBlindsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsHarmony: "wild" }).massageLabGradientBlindsHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsColorOne: "pink" }).massageLabGradientBlindsColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsAngle: "wide" }).massageLabGradientBlindsAngle,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsAngle,
    )
    assert.equal(sanitizeChimerSettings({ massageLabGradientBlindsAngle: -999 }).massageLabGradientBlindsAngle, -180)
    assert.equal(sanitizeChimerSettings({ massageLabGradientBlindsNoise: -1 }).massageLabGradientBlindsNoise, 0)
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsBlindCount: "many" }).massageLabGradientBlindsBlindCount,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsBlindCount,
    )
    assert.equal(sanitizeChimerSettings({ massageLabGradientBlindsBlindCount: 0 }).massageLabGradientBlindsBlindCount, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsShineDirection: "center" })
        .massageLabGradientBlindsShineDirection,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsShineDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsBlendMode: "multiply" }).massageLabGradientBlindsBlendMode,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsBlendMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGradientBlindsEnableMouseInteraction: "yes" })
        .massageLabGradientBlindsEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsEnableMouseInteraction,
    )
  })

  it("normalizes MassageLab Grainient background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabGrainientPaletteMode: "harmony",
      massageLabGrainientPrimaryColor: "#ff9ffc",
      massageLabGrainientHarmony: "triad",
      massageLabGrainientColorOne: "#abcdef",
      massageLabGrainientColorTwo: "#010203",
      massageLabGrainientColorThree: "#111111",
      massageLabGrainientTimeSpeed: 99,
      massageLabGrainientColorBalance: 99,
      massageLabGrainientWarpStrength: 99,
      massageLabGrainientWarpFrequency: 99,
      massageLabGrainientWarpSpeed: 99,
      massageLabGrainientWarpAmplitude: 999,
      massageLabGrainientBlendAngle: 999,
      massageLabGrainientBlendSoftness: 99,
      massageLabGrainientRotationAmount: 9999,
      massageLabGrainientNoiseScale: 99,
      massageLabGrainientGrainAmount: 99,
      massageLabGrainientGrainScale: 99,
      massageLabGrainientGrainAnimated: true,
      massageLabGrainientContrast: 99,
      massageLabGrainientGamma: 99,
      massageLabGrainientSaturation: 99,
      massageLabGrainientCenterX: 99,
      massageLabGrainientCenterY: -99,
      massageLabGrainientZoom: 99,
    })

    assert.equal(settings.massageLabGrainientPaletteMode, "harmony")
    assert.equal(settings.massageLabGrainientPrimaryColor, "#FF9FFC")
    assert.equal(settings.massageLabGrainientHarmony, "triad")
    assert.equal(settings.massageLabGrainientColorOne, "#ABCDEF")
    assert.equal(settings.massageLabGrainientColorTwo, "#010203")
    assert.equal(settings.massageLabGrainientColorThree, "#111111")
    assert.equal(settings.massageLabGrainientTimeSpeed, 2)
    assert.equal(settings.massageLabGrainientColorBalance, 1)
    assert.equal(settings.massageLabGrainientWarpStrength, 5)
    assert.equal(settings.massageLabGrainientWarpFrequency, 20)
    assert.equal(settings.massageLabGrainientWarpSpeed, 6)
    assert.equal(settings.massageLabGrainientWarpAmplitude, 160)
    assert.equal(settings.massageLabGrainientBlendAngle, 180)
    assert.equal(settings.massageLabGrainientBlendSoftness, 1)
    assert.equal(settings.massageLabGrainientRotationAmount, 1200)
    assert.equal(settings.massageLabGrainientNoiseScale, 8)
    assert.equal(settings.massageLabGrainientGrainAmount, 1)
    assert.equal(settings.massageLabGrainientGrainScale, 12)
    assert.equal(settings.massageLabGrainientGrainAnimated, true)
    assert.equal(settings.massageLabGrainientContrast, 4)
    assert.equal(settings.massageLabGrainientGamma, 4)
    assert.equal(settings.massageLabGrainientSaturation, 3)
    assert.equal(settings.massageLabGrainientCenterX, 1)
    assert.equal(settings.massageLabGrainientCenterY, -1)
    assert.equal(settings.massageLabGrainientZoom, 3)
    assert.equal(
      sanitizeChimerSettings({ massageLabGrainientPaletteMode: "auto" }).massageLabGrainientPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabGrainientPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGrainientPrimaryColor: "pink" }).massageLabGrainientPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGrainientPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGrainientHarmony: "wild" }).massageLabGrainientHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabGrainientHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGrainientColorOne: "pink" }).massageLabGrainientColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabGrainientColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGrainientTimeSpeed: "fast" }).massageLabGrainientTimeSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabGrainientTimeSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabGrainientBlendAngle: -999 }).massageLabGrainientBlendAngle, -180)
    assert.equal(sanitizeChimerSettings({ massageLabGrainientWarpFrequency: 0 }).massageLabGrainientWarpFrequency, 0.1)
    assert.equal(
      sanitizeChimerSettings({ massageLabGrainientGrainAnimated: "yes" }).massageLabGrainientGrainAnimated,
      DEFAULT_CHIMER_SETTINGS.massageLabGrainientGrainAnimated,
    )
  })

  it("normalizes MassageLab Grid Scan background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabGridScanPaletteMode: "harmony",
      massageLabGridScanPrimaryColor: "#ff9ffc",
      massageLabGridScanHarmony: "triad",
      massageLabGridScanLinesColor: "#abcdef",
      massageLabGridScanScanColor: "#010203",
      massageLabGridScanSensitivity: 99,
      massageLabGridScanLineThickness: 99,
      massageLabGridScanScanOpacity: 99,
      massageLabGridScanGridScale: 99,
      massageLabGridScanLineStyle: "dotted",
      massageLabGridScanLineJitter: 99,
      massageLabGridScanDirection: "backward",
      massageLabGridScanNoiseIntensity: 99,
      massageLabGridScanBloomOpacity: 99,
      massageLabGridScanScanGlow: 99,
      massageLabGridScanScanSoftness: 99,
      massageLabGridScanPhaseTaper: 99,
      massageLabGridScanScanDuration: 99,
      massageLabGridScanScanDelay: 99,
      massageLabGridScanEnablePointerInteraction: true,
      massageLabGridScanScanOnClick: true,
    })

    assert.equal(settings.massageLabGridScanPaletteMode, "harmony")
    assert.equal(settings.massageLabGridScanPrimaryColor, "#FF9FFC")
    assert.equal(settings.massageLabGridScanHarmony, "triad")
    assert.equal(settings.massageLabGridScanLinesColor, "#ABCDEF")
    assert.equal(settings.massageLabGridScanScanColor, "#010203")
    assert.equal(settings.massageLabGridScanSensitivity, 1)
    assert.equal(settings.massageLabGridScanLineThickness, 6)
    assert.equal(settings.massageLabGridScanScanOpacity, 1)
    assert.equal(settings.massageLabGridScanGridScale, 0.5)
    assert.equal(settings.massageLabGridScanLineStyle, "dotted")
    assert.equal(settings.massageLabGridScanLineJitter, 1)
    assert.equal(settings.massageLabGridScanDirection, "backward")
    assert.equal(settings.massageLabGridScanNoiseIntensity, 0.25)
    assert.equal(settings.massageLabGridScanBloomOpacity, 2)
    assert.equal(settings.massageLabGridScanScanGlow, 3)
    assert.equal(settings.massageLabGridScanScanSoftness, 6)
    assert.equal(settings.massageLabGridScanPhaseTaper, 0.49)
    assert.equal(settings.massageLabGridScanScanDuration, 10)
    assert.equal(settings.massageLabGridScanScanDelay, 10)
    assert.equal(settings.massageLabGridScanEnablePointerInteraction, true)
    assert.equal(settings.massageLabGridScanScanOnClick, true)
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanPaletteMode: "auto" }).massageLabGridScanPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanPrimaryColor: "pink" }).massageLabGridScanPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanHarmony: "wild" }).massageLabGridScanHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanLinesColor: "pink" }).massageLabGridScanLinesColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanLinesColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanLineStyle: "double" }).massageLabGridScanLineStyle,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanLineStyle,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanDirection: "sideways" }).massageLabGridScanDirection,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanSensitivity: "fast" }).massageLabGridScanSensitivity,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanSensitivity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridScanEnablePointerInteraction: "yes" })
        .massageLabGridScanEnablePointerInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabGridScanEnablePointerInteraction,
    )
  })

  it("normalizes MassageLab Beams background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabBeamsPaletteMode: "harmony",
      massageLabBeamsPrimaryColor: "#abcdef",
      massageLabBeamsHarmony: "triad",
      massageLabBeamsLightColor: "#010203",
      massageLabBeamsBeamWidth: 99,
      massageLabBeamsBeamHeight: 99,
      massageLabBeamsBeamNumber: 99,
      massageLabBeamsSpeed: 99,
      massageLabBeamsNoiseIntensity: 99,
      massageLabBeamsScale: 99,
      massageLabBeamsRotation: 999,
    })

    assert.equal(settings.massageLabBeamsPaletteMode, "harmony")
    assert.equal(settings.massageLabBeamsPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabBeamsHarmony, "triad")
    assert.equal(settings.massageLabBeamsLightColor, "#010203")
    assert.equal(settings.massageLabBeamsBeamWidth, 6)
    assert.equal(settings.massageLabBeamsBeamHeight, 32)
    assert.equal(settings.massageLabBeamsBeamNumber, 48)
    assert.equal(settings.massageLabBeamsSpeed, 8)
    assert.equal(settings.massageLabBeamsNoiseIntensity, 4)
    assert.equal(settings.massageLabBeamsScale, 1.5)
    assert.equal(settings.massageLabBeamsRotation, 180)
    assert.equal(
      sanitizeChimerSettings({ massageLabBeamsPaletteMode: "auto" }).massageLabBeamsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabBeamsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabBeamsPrimaryColor: "white" }).massageLabBeamsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabBeamsPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabBeamsHarmony: "wild" }).massageLabBeamsHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabBeamsHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabBeamsLightColor: "white" }).massageLabBeamsLightColor,
      DEFAULT_CHIMER_SETTINGS.massageLabBeamsLightColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabBeamsSpeed: "fast" }).massageLabBeamsSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabBeamsSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabBeamsBeamNumber: 4.9 }).massageLabBeamsBeamNumber, 4)
    assert.equal(sanitizeChimerSettings({ massageLabBeamsRotation: -999 }).massageLabBeamsRotation, -180)
  })

  it("normalizes MassageLab Pixel Snow background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabPixelSnowPaletteMode: "harmony",
      massageLabPixelSnowPrimaryColor: "#abcdef",
      massageLabPixelSnowHarmony: "triad",
      massageLabPixelSnowColor: "#010203",
      massageLabPixelSnowFlakeSize: 99,
      massageLabPixelSnowMinFlakeSize: 99,
      massageLabPixelSnowPixelResolution: 9999,
      massageLabPixelSnowSpeed: 99,
      massageLabPixelSnowDepthFade: 99,
      massageLabPixelSnowFarPlane: 999,
      massageLabPixelSnowBrightness: 99,
      massageLabPixelSnowGamma: 99,
      massageLabPixelSnowDensity: 99,
      massageLabPixelSnowVariant: "snowflake",
      massageLabPixelSnowDirection: 999,
    })

    assert.equal(settings.massageLabPixelSnowPaletteMode, "harmony")
    assert.equal(settings.massageLabPixelSnowPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabPixelSnowHarmony, "triad")
    assert.equal(settings.massageLabPixelSnowColor, "#010203")
    assert.equal(settings.massageLabPixelSnowFlakeSize, 0.08)
    assert.equal(settings.massageLabPixelSnowMinFlakeSize, 6)
    assert.equal(settings.massageLabPixelSnowPixelResolution, 640)
    assert.equal(settings.massageLabPixelSnowSpeed, 5)
    assert.equal(settings.massageLabPixelSnowDepthFade, 40)
    assert.equal(settings.massageLabPixelSnowFarPlane, 80)
    assert.equal(settings.massageLabPixelSnowBrightness, 4)
    assert.equal(settings.massageLabPixelSnowGamma, 2)
    assert.equal(settings.massageLabPixelSnowDensity, 1)
    assert.equal(settings.massageLabPixelSnowVariant, "snowflake")
    assert.equal(settings.massageLabPixelSnowDirection, 360)
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelSnowPaletteMode: "auto" }).massageLabPixelSnowPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelSnowPrimaryColor: "white" }).massageLabPixelSnowPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelSnowHarmony: "wild" }).massageLabPixelSnowHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelSnowColor: "white" }).massageLabPixelSnowColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelSnowSpeed: "fast" }).massageLabPixelSnowSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPixelSnowVariant: "storm" }).massageLabPixelSnowVariant,
      DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowVariant,
    )
    assert.equal(sanitizeChimerSettings({ massageLabPixelSnowDirection: -1 }).massageLabPixelSnowDirection, 0)
  })

  it("normalizes MassageLab Lightning background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabLightningPaletteMode: "harmony",
      massageLabLightningPrimaryColor: "#abcdef",
      massageLabLightningHarmony: "triad",
      massageLabLightningColor: "#010203",
      massageLabLightningHue: 999,
      massageLabLightningXOffset: 99,
      massageLabLightningSpeed: 99,
      massageLabLightningIntensity: 99,
      massageLabLightningSize: 99,
    })

    assert.equal(settings.massageLabLightningPaletteMode, "harmony")
    assert.equal(settings.massageLabLightningPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabLightningHarmony, "triad")
    assert.equal(settings.massageLabLightningColor, "#010203")
    assert.equal(settings.massageLabLightningHue, 360)
    assert.equal(settings.massageLabLightningXOffset, 2)
    assert.equal(settings.massageLabLightningSpeed, 5)
    assert.equal(settings.massageLabLightningIntensity, 5)
    assert.equal(settings.massageLabLightningSize, 5)
    assert.equal(
      sanitizeChimerSettings({ massageLabLightningPaletteMode: "auto" }).massageLabLightningPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabLightningPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightningPrimaryColor: "white" }).massageLabLightningPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightningPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightningHarmony: "wild" }).massageLabLightningHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabLightningHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightningColor: "white" }).massageLabLightningColor,
      DEFAULT_CHIMER_SETTINGS.massageLabLightningColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabLightningSpeed: "fast" }).massageLabLightningSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLightningSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabLightningXOffset: -99 }).massageLabLightningXOffset, -2)
    assert.equal(sanitizeChimerSettings({ massageLabLightningIntensity: 0 }).massageLabLightningIntensity, 0.1)
    assert.equal(sanitizeChimerSettings({ massageLabLightningSize: 0 }).massageLabLightningSize, 0.2)
  })

  it("normalizes MassageLab Prismatic Burst background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabPrismaticBurstPaletteMode: "harmony",
      massageLabPrismaticBurstPrimaryColor: "#abcdef",
      massageLabPrismaticBurstHarmony: "triad",
      massageLabPrismaticBurstColorOne: "#010203",
      massageLabPrismaticBurstColorTwo: "#aabbcc",
      massageLabPrismaticBurstColorThree: "#ddeeff",
      massageLabPrismaticBurstColorFour: "#112233",
      massageLabPrismaticBurstIntensity: 99,
      massageLabPrismaticBurstSpeed: 99,
      massageLabPrismaticBurstAnimationType: "hover",
      massageLabPrismaticBurstDistort: 99,
      massageLabPrismaticBurstOffsetX: 9999,
      massageLabPrismaticBurstOffsetY: -9999,
      massageLabPrismaticBurstHoverDampness: 99,
      massageLabPrismaticBurstRayCount: 99,
      massageLabPrismaticBurstMixBlendMode: "screen",
    })

    assert.equal(settings.massageLabPrismaticBurstPaletteMode, "harmony")
    assert.equal(settings.massageLabPrismaticBurstPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabPrismaticBurstHarmony, "triad")
    assert.equal(settings.massageLabPrismaticBurstColorOne, "#010203")
    assert.equal(settings.massageLabPrismaticBurstColorTwo, "#AABBCC")
    assert.equal(settings.massageLabPrismaticBurstColorThree, "#DDEEFF")
    assert.equal(settings.massageLabPrismaticBurstColorFour, "#112233")
    assert.equal(settings.massageLabPrismaticBurstIntensity, 5)
    assert.equal(settings.massageLabPrismaticBurstSpeed, 3)
    assert.equal(settings.massageLabPrismaticBurstAnimationType, "hover")
    assert.equal(settings.massageLabPrismaticBurstDistort, 50)
    assert.equal(settings.massageLabPrismaticBurstOffsetX, 1000)
    assert.equal(settings.massageLabPrismaticBurstOffsetY, -1000)
    assert.equal(settings.massageLabPrismaticBurstHoverDampness, 1)
    assert.equal(settings.massageLabPrismaticBurstRayCount, 64)
    assert.equal(settings.massageLabPrismaticBurstMixBlendMode, "screen")
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstPaletteMode: "auto" }).massageLabPrismaticBurstPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstPrimaryColor: "white" }).massageLabPrismaticBurstPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstHarmony: "wild" }).massageLabPrismaticBurstHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstColorOne: "white" }).massageLabPrismaticBurstColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstSpeed: "fast" }).massageLabPrismaticBurstSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstAnimationType: "orbit" }).massageLabPrismaticBurstAnimationType,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstAnimationType,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstMixBlendMode: "multiply" }).massageLabPrismaticBurstMixBlendMode,
      DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstMixBlendMode,
    )
    assert.equal(sanitizeChimerSettings({ massageLabPrismaticBurstIntensity: -1 }).massageLabPrismaticBurstIntensity, 0)
    assert.equal(sanitizeChimerSettings({ massageLabPrismaticBurstDistort: -1 }).massageLabPrismaticBurstDistort, 0)
    assert.equal(sanitizeChimerSettings({ massageLabPrismaticBurstOffsetX: -9999 }).massageLabPrismaticBurstOffsetX, -1000)
    assert.equal(sanitizeChimerSettings({ massageLabPrismaticBurstOffsetY: 9999 }).massageLabPrismaticBurstOffsetY, 1000)
    assert.equal(
      sanitizeChimerSettings({ massageLabPrismaticBurstHoverDampness: -1 }).massageLabPrismaticBurstHoverDampness,
      0,
    )
    assert.equal(sanitizeChimerSettings({ massageLabPrismaticBurstRayCount: 10.9 }).massageLabPrismaticBurstRayCount, 10)
  })

  it("normalizes MassageLab Galaxy background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabGalaxyPaletteMode: "harmony",
      massageLabGalaxyPrimaryColor: "#abcdef",
      massageLabGalaxyHarmony: "triad",
      massageLabGalaxyColor: "#010203",
      massageLabGalaxyHueShift: 999,
      massageLabGalaxyFocalX: 99,
      massageLabGalaxyFocalY: -99,
      massageLabGalaxyRotationDeg: 999,
      massageLabGalaxyStarSpeed: 99,
      massageLabGalaxyDensity: 99,
      massageLabGalaxySpeed: 99,
      massageLabGalaxyMouseInteraction: false,
      massageLabGalaxyGlowIntensity: 99,
      massageLabGalaxySaturation: 99,
      massageLabGalaxyMouseRepulsion: false,
      massageLabGalaxyRepulsionStrength: 99,
      massageLabGalaxyTwinkleIntensity: 99,
      massageLabGalaxyRotationSpeed: 99,
      massageLabGalaxyAutoCenterRepulsion: 99,
      massageLabGalaxyTransparent: false,
    })

    assert.equal(settings.massageLabGalaxyPaletteMode, "harmony")
    assert.equal(settings.massageLabGalaxyPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabGalaxyHarmony, "triad")
    assert.equal(settings.massageLabGalaxyColor, "#010203")
    assert.equal(settings.massageLabGalaxyHueShift, 360)
    assert.equal(settings.massageLabGalaxyFocalX, 1)
    assert.equal(settings.massageLabGalaxyFocalY, 0)
    assert.equal(settings.massageLabGalaxyRotationDeg, 360)
    assert.equal(settings.massageLabGalaxyStarSpeed, 5)
    assert.equal(settings.massageLabGalaxyDensity, 3)
    assert.equal(settings.massageLabGalaxySpeed, 5)
    assert.equal(settings.massageLabGalaxyMouseInteraction, false)
    assert.equal(settings.massageLabGalaxyGlowIntensity, 2)
    assert.equal(settings.massageLabGalaxySaturation, 2)
    assert.equal(settings.massageLabGalaxyMouseRepulsion, false)
    assert.equal(settings.massageLabGalaxyRepulsionStrength, 6)
    assert.equal(settings.massageLabGalaxyTwinkleIntensity, 1)
    assert.equal(settings.massageLabGalaxyRotationSpeed, 2)
    assert.equal(settings.massageLabGalaxyAutoCenterRepulsion, 6)
    assert.equal(settings.massageLabGalaxyTransparent, false)
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxyPaletteMode: "auto" }).massageLabGalaxyPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxyPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxyPrimaryColor: "white" }).massageLabGalaxyPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxyPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxyHarmony: "wild" }).massageLabGalaxyHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxyHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxyColor: "white" }).massageLabGalaxyColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxyColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxySpeed: "fast" }).massageLabGalaxySpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxySpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxyMouseInteraction: "yes" }).massageLabGalaxyMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxyMouseInteraction,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxyMouseRepulsion: "yes" }).massageLabGalaxyMouseRepulsion,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxyMouseRepulsion,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGalaxyTransparent: "no" }).massageLabGalaxyTransparent,
      DEFAULT_CHIMER_SETTINGS.massageLabGalaxyTransparent,
    )
    assert.equal(sanitizeChimerSettings({ massageLabGalaxyDensity: 0 }).massageLabGalaxyDensity, 0.1)
    assert.equal(sanitizeChimerSettings({ massageLabGalaxyGlowIntensity: 0 }).massageLabGalaxyGlowIntensity, 0.01)
    assert.equal(sanitizeChimerSettings({ massageLabGalaxyRotationSpeed: -99 }).massageLabGalaxyRotationSpeed, -2)
  })

  it("normalizes MassageLab Dither background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabDitherPaletteMode: "harmony",
      massageLabDitherPrimaryColor: "#abcdef",
      massageLabDitherHarmony: "triad",
      massageLabDitherColor: "#010203",
      massageLabDitherWaveSpeed: 99,
      massageLabDitherWaveFrequency: 99,
      massageLabDitherWaveAmplitude: 99,
      massageLabDitherColorNum: 99,
      massageLabDitherPixelSize: 99,
      massageLabDitherMouseInteraction: false,
      massageLabDitherMouseRadius: 99,
    })

    assert.equal(settings.massageLabDitherPaletteMode, "harmony")
    assert.equal(settings.massageLabDitherPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabDitherHarmony, "triad")
    assert.equal(settings.massageLabDitherColor, "#010203")
    assert.equal(settings.massageLabDitherWaveSpeed, 0.5)
    assert.equal(settings.massageLabDitherWaveFrequency, 8)
    assert.equal(settings.massageLabDitherWaveAmplitude, 1)
    assert.equal(settings.massageLabDitherColorNum, 16)
    assert.equal(settings.massageLabDitherPixelSize, 24)
    assert.equal(settings.massageLabDitherMouseInteraction, false)
    assert.equal(settings.massageLabDitherMouseRadius, 3)
    assert.equal(
      sanitizeChimerSettings({ massageLabDitherPaletteMode: "auto" }).massageLabDitherPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabDitherPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDitherPrimaryColor: "white" }).massageLabDitherPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabDitherPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDitherHarmony: "wild" }).massageLabDitherHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabDitherHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDitherColor: "white" }).massageLabDitherColor,
      DEFAULT_CHIMER_SETTINGS.massageLabDitherColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDitherWaveSpeed: "fast" }).massageLabDitherWaveSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabDitherWaveSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDitherMouseInteraction: "yes" }).massageLabDitherMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabDitherMouseInteraction,
    )
    assert.equal(sanitizeChimerSettings({ massageLabDitherWaveFrequency: 0 }).massageLabDitherWaveFrequency, 0.5)
    assert.equal(sanitizeChimerSettings({ massageLabDitherWaveAmplitude: -1 }).massageLabDitherWaveAmplitude, 0)
    assert.equal(sanitizeChimerSettings({ massageLabDitherColorNum: 1 }).massageLabDitherColorNum, 2)
    assert.equal(sanitizeChimerSettings({ massageLabDitherPixelSize: 0 }).massageLabDitherPixelSize, 1)
    assert.equal(sanitizeChimerSettings({ massageLabDitherMouseRadius: 0 }).massageLabDitherMouseRadius, 0.05)
  })

  it("normalizes MassageLab Faulty Terminal background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabFaultyTerminalPaletteMode: "harmony",
      massageLabFaultyTerminalPrimaryColor: "#abcdef",
      massageLabFaultyTerminalHarmony: "triad",
      massageLabFaultyTerminalTint: "#010203",
      massageLabFaultyTerminalScale: 99,
      massageLabFaultyTerminalGridMulX: 99,
      massageLabFaultyTerminalGridMulY: 99,
      massageLabFaultyTerminalDigitSize: 99,
      massageLabFaultyTerminalTimeScale: 99,
      massageLabFaultyTerminalScanlineIntensity: 99,
      massageLabFaultyTerminalGlitchAmount: 99,
      massageLabFaultyTerminalFlickerAmount: 99,
      massageLabFaultyTerminalNoiseAmp: 99,
      massageLabFaultyTerminalChromaticAberration: 99,
      massageLabFaultyTerminalDither: 999,
      massageLabFaultyTerminalCurvature: 99,
      massageLabFaultyTerminalMouseReact: false,
      massageLabFaultyTerminalMouseStrength: 99,
      massageLabFaultyTerminalPageLoadAnimation: false,
      massageLabFaultyTerminalBrightness: 99,
    })

    assert.equal(settings.massageLabFaultyTerminalPaletteMode, "harmony")
    assert.equal(settings.massageLabFaultyTerminalPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabFaultyTerminalHarmony, "triad")
    assert.equal(settings.massageLabFaultyTerminalTint, "#010203")
    assert.equal(settings.massageLabFaultyTerminalScale, 4)
    assert.equal(settings.massageLabFaultyTerminalGridMulX, 6)
    assert.equal(settings.massageLabFaultyTerminalGridMulY, 6)
    assert.equal(settings.massageLabFaultyTerminalDigitSize, 4)
    assert.equal(settings.massageLabFaultyTerminalTimeScale, 2)
    assert.equal(settings.massageLabFaultyTerminalScanlineIntensity, 2)
    assert.equal(settings.massageLabFaultyTerminalGlitchAmount, 3)
    assert.equal(settings.massageLabFaultyTerminalFlickerAmount, 2)
    assert.equal(settings.massageLabFaultyTerminalNoiseAmp, 2)
    assert.equal(settings.massageLabFaultyTerminalChromaticAberration, 8)
    assert.equal(settings.massageLabFaultyTerminalDither, 255)
    assert.equal(settings.massageLabFaultyTerminalCurvature, 1)
    assert.equal(settings.massageLabFaultyTerminalMouseReact, false)
    assert.equal(settings.massageLabFaultyTerminalMouseStrength, 2)
    assert.equal(settings.massageLabFaultyTerminalPageLoadAnimation, false)
    assert.equal(settings.massageLabFaultyTerminalBrightness, 3)
    assert.equal(
      sanitizeChimerSettings({ massageLabFaultyTerminalPaletteMode: "auto" }).massageLabFaultyTerminalPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFaultyTerminalPrimaryColor: "white" }).massageLabFaultyTerminalPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFaultyTerminalHarmony: "wild" }).massageLabFaultyTerminalHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFaultyTerminalTint: "white" }).massageLabFaultyTerminalTint,
      DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalTint,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFaultyTerminalTimeScale: "fast" }).massageLabFaultyTerminalTimeScale,
      DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalTimeScale,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFaultyTerminalMouseReact: "yes" }).massageLabFaultyTerminalMouseReact,
      DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalMouseReact,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabFaultyTerminalPageLoadAnimation: "yes" })
        .massageLabFaultyTerminalPageLoadAnimation,
      DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalPageLoadAnimation,
    )
    assert.equal(sanitizeChimerSettings({ massageLabFaultyTerminalScale: 0 }).massageLabFaultyTerminalScale, 0.25)
    assert.equal(sanitizeChimerSettings({ massageLabFaultyTerminalDigitSize: 0 }).massageLabFaultyTerminalDigitSize, 0.5)
    assert.equal(sanitizeChimerSettings({ massageLabFaultyTerminalBrightness: 0 }).massageLabFaultyTerminalBrightness, 0.1)
  })

  it("normalizes MassageLab Ripple Grid background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabRippleGridPaletteMode: "harmony",
      massageLabRippleGridPrimaryColor: "#abcdef",
      massageLabRippleGridHarmony: "triad",
      massageLabRippleGridColor: "#010203",
      massageLabRippleGridRippleIntensity: 99,
      massageLabRippleGridGridSize: 99,
      massageLabRippleGridGridThickness: 99,
      massageLabRippleGridFadeDistance: 99,
      massageLabRippleGridVignetteStrength: 99,
      massageLabRippleGridGlowIntensity: 99,
      massageLabRippleGridOpacity: 99,
      massageLabRippleGridGridRotation: 999,
      massageLabRippleGridMouseInteraction: false,
      massageLabRippleGridMouseInteractionRadius: 99,
    })

    assert.equal(settings.massageLabRippleGridPaletteMode, "harmony")
    assert.equal(settings.massageLabRippleGridPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabRippleGridHarmony, "triad")
    assert.equal(settings.massageLabRippleGridColor, "#010203")
    assert.equal(settings.massageLabRippleGridRippleIntensity, 0.3)
    assert.equal(settings.massageLabRippleGridGridSize, 30)
    assert.equal(settings.massageLabRippleGridGridThickness, 50)
    assert.equal(settings.massageLabRippleGridFadeDistance, 5)
    assert.equal(settings.massageLabRippleGridVignetteStrength, 6)
    assert.equal(settings.massageLabRippleGridGlowIntensity, 1)
    assert.equal(settings.massageLabRippleGridOpacity, 1)
    assert.equal(settings.massageLabRippleGridGridRotation, 180)
    assert.equal(settings.massageLabRippleGridMouseInteraction, false)
    assert.equal(settings.massageLabRippleGridMouseInteractionRadius, 5)
    assert.equal(
      sanitizeChimerSettings({ massageLabRippleGridPaletteMode: "auto" }).massageLabRippleGridPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabRippleGridPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRippleGridPrimaryColor: "white" }).massageLabRippleGridPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabRippleGridPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRippleGridHarmony: "wild" }).massageLabRippleGridHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabRippleGridHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRippleGridColor: "white" }).massageLabRippleGridColor,
      DEFAULT_CHIMER_SETTINGS.massageLabRippleGridColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRippleGridRippleIntensity: "strong" }).massageLabRippleGridRippleIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabRippleGridRippleIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRippleGridMouseInteraction: "yes" }).massageLabRippleGridMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabRippleGridMouseInteraction,
    )
    assert.equal(sanitizeChimerSettings({ massageLabRippleGridRippleIntensity: -1 }).massageLabRippleGridRippleIntensity, 0)
    assert.equal(sanitizeChimerSettings({ massageLabRippleGridGridSize: 0 }).massageLabRippleGridGridSize, 2)
    assert.equal(sanitizeChimerSettings({ massageLabRippleGridGridThickness: 0 }).massageLabRippleGridGridThickness, 1)
    assert.equal(sanitizeChimerSettings({ massageLabRippleGridFadeDistance: 0 }).massageLabRippleGridFadeDistance, 0.2)
    assert.equal(sanitizeChimerSettings({ massageLabRippleGridVignetteStrength: 0 }).massageLabRippleGridVignetteStrength, 0.1)
    assert.equal(sanitizeChimerSettings({ massageLabRippleGridGridRotation: -999 }).massageLabRippleGridGridRotation, -180)
    assert.equal(
      sanitizeChimerSettings({ massageLabRippleGridMouseInteractionRadius: 0 }).massageLabRippleGridMouseInteractionRadius,
      0.1,
    )
  })

  it("normalizes MassageLab Dot Field background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabDotFieldPaletteMode: "harmony",
      massageLabDotFieldPrimaryColor: "#abcdef",
      massageLabDotFieldHarmony: "triad",
      massageLabDotFieldGradientFromColor: "#010203",
      massageLabDotFieldGradientFromAlpha: 99,
      massageLabDotFieldGradientToColor: "#040506",
      massageLabDotFieldGradientToAlpha: 99,
      massageLabDotFieldGlowColor: "#070809",
      massageLabDotFieldDotRadius: 99,
      massageLabDotFieldDotSpacing: 99,
      massageLabDotFieldCursorRadius: 9999,
      massageLabDotFieldCursorForce: 99,
      massageLabDotFieldBulgeOnly: false,
      massageLabDotFieldBulgeStrength: 999,
      massageLabDotFieldGlowRadius: 999,
      massageLabDotFieldSparkle: true,
      massageLabDotFieldWaveAmplitude: 999,
      massageLabDotFieldCursorInteraction: false,
    })

    assert.equal(settings.massageLabDotFieldPaletteMode, "harmony")
    assert.equal(settings.massageLabDotFieldPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabDotFieldHarmony, "triad")
    assert.equal(settings.massageLabDotFieldGradientFromColor, "#010203")
    assert.equal(settings.massageLabDotFieldGradientFromAlpha, 1)
    assert.equal(settings.massageLabDotFieldGradientToColor, "#040506")
    assert.equal(settings.massageLabDotFieldGradientToAlpha, 1)
    assert.equal(settings.massageLabDotFieldGlowColor, "#070809")
    assert.equal(settings.massageLabDotFieldDotRadius, 8)
    assert.equal(settings.massageLabDotFieldDotSpacing, 48)
    assert.equal(settings.massageLabDotFieldCursorRadius, 900)
    assert.equal(settings.massageLabDotFieldCursorForce, 1)
    assert.equal(settings.massageLabDotFieldBulgeOnly, false)
    assert.equal(settings.massageLabDotFieldBulgeStrength, 160)
    assert.equal(settings.massageLabDotFieldGlowRadius, 360)
    assert.equal(settings.massageLabDotFieldSparkle, true)
    assert.equal(settings.massageLabDotFieldWaveAmplitude, 48)
    assert.equal(settings.massageLabDotFieldCursorInteraction, false)
    assert.equal(
      sanitizeChimerSettings({ massageLabDotFieldPaletteMode: "auto" }).massageLabDotFieldPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabDotFieldPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotFieldPrimaryColor: "white" }).massageLabDotFieldPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabDotFieldPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotFieldHarmony: "wild" }).massageLabDotFieldHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabDotFieldHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotFieldGradientFromColor: "white" }).massageLabDotFieldGradientFromColor,
      DEFAULT_CHIMER_SETTINGS.massageLabDotFieldGradientFromColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotFieldBulgeOnly: "yes" }).massageLabDotFieldBulgeOnly,
      DEFAULT_CHIMER_SETTINGS.massageLabDotFieldBulgeOnly,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotFieldSparkle: "yes" }).massageLabDotFieldSparkle,
      DEFAULT_CHIMER_SETTINGS.massageLabDotFieldSparkle,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotFieldCursorInteraction: "yes" }).massageLabDotFieldCursorInteraction,
      DEFAULT_CHIMER_SETTINGS.massageLabDotFieldCursorInteraction,
    )
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldGradientFromAlpha: -1 }).massageLabDotFieldGradientFromAlpha, 0)
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldDotRadius: 0 }).massageLabDotFieldDotRadius, 0.5)
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldDotSpacing: 0 }).massageLabDotFieldDotSpacing, 4)
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldCursorRadius: 0 }).massageLabDotFieldCursorRadius, 60)
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldCursorForce: 0 }).massageLabDotFieldCursorForce, 0.01)
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldBulgeStrength: -1 }).massageLabDotFieldBulgeStrength, 0)
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldGlowRadius: -1 }).massageLabDotFieldGlowRadius, 0)
    assert.equal(sanitizeChimerSettings({ massageLabDotFieldWaveAmplitude: -1 }).massageLabDotFieldWaveAmplitude, 0)
  })

  it("normalizes MassageLab Dot Grid background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabDotGridPaletteMode: "harmony",
      massageLabDotGridPrimaryColor: "#abcdef",
      massageLabDotGridHarmony: "triad",
      massageLabDotGridBaseColor: "#010203",
      massageLabDotGridActiveColor: "#040506",
      massageLabDotGridDotSize: 99,
      massageLabDotGridGap: 99,
      massageLabDotGridProximity: 999,
      massageLabDotGridSpeedTrigger: 9999,
      massageLabDotGridShockRadius: 9999,
      massageLabDotGridShockStrength: 99,
      massageLabDotGridMaxSpeed: 99999,
      massageLabDotGridResistance: 9999,
      massageLabDotGridReturnDuration: 99,
      massageLabDotGridCursorInteraction: false,
      massageLabDotGridClickShock: false,
    })

    assert.equal(settings.massageLabDotGridPaletteMode, "harmony")
    assert.equal(settings.massageLabDotGridPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabDotGridHarmony, "triad")
    assert.equal(settings.massageLabDotGridBaseColor, "#010203")
    assert.equal(settings.massageLabDotGridActiveColor, "#040506")
    assert.equal(settings.massageLabDotGridDotSize, 40)
    assert.equal(settings.massageLabDotGridGap, 80)
    assert.equal(settings.massageLabDotGridProximity, 500)
    assert.equal(settings.massageLabDotGridSpeedTrigger, 1000)
    assert.equal(settings.massageLabDotGridShockRadius, 700)
    assert.equal(settings.massageLabDotGridShockStrength, 12)
    assert.equal(settings.massageLabDotGridMaxSpeed, 8000)
    assert.equal(settings.massageLabDotGridResistance, 1600)
    assert.equal(settings.massageLabDotGridReturnDuration, 4)
    assert.equal(settings.massageLabDotGridCursorInteraction, false)
    assert.equal(settings.massageLabDotGridClickShock, false)
    assert.equal(
      sanitizeChimerSettings({ massageLabDotGridPaletteMode: "auto" }).massageLabDotGridPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabDotGridPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotGridPrimaryColor: "white" }).massageLabDotGridPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabDotGridPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabDotGridHarmony: "wild" }).massageLabDotGridHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabDotGridHarmony,
    )
    assert.equal(sanitizeChimerSettings({ massageLabDotGridDotSize: 0 }).massageLabDotGridDotSize, 2)
    assert.equal(sanitizeChimerSettings({ massageLabDotGridGap: 0 }).massageLabDotGridGap, 4)
    assert.equal(sanitizeChimerSettings({ massageLabDotGridProximity: 0 }).massageLabDotGridProximity, 40)
    assert.equal(sanitizeChimerSettings({ massageLabDotGridShockStrength: -1 }).massageLabDotGridShockStrength, 0)
    assert.equal(sanitizeChimerSettings({ massageLabDotGridReturnDuration: 0 }).massageLabDotGridReturnDuration, 0.1)
  })

  it("normalizes MassageLab Threads background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabThreadsPaletteMode: "harmony",
      massageLabThreadsPrimaryColor: "#abcdef",
      massageLabThreadsHarmony: "triad",
      massageLabThreadsColor: "#010203",
      massageLabThreadsAmplitude: 99,
      massageLabThreadsDistance: 99,
      massageLabThreadsEnableMouseInteraction: true,
    })

    assert.equal(settings.massageLabThreadsPaletteMode, "harmony")
    assert.equal(settings.massageLabThreadsPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabThreadsHarmony, "triad")
    assert.equal(settings.massageLabThreadsColor, "#010203")
    assert.equal(settings.massageLabThreadsAmplitude, 3)
    assert.equal(settings.massageLabThreadsDistance, 1.5)
    assert.equal(settings.massageLabThreadsEnableMouseInteraction, true)
    assert.equal(
      sanitizeChimerSettings({ massageLabThreadsPaletteMode: "auto" }).massageLabThreadsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabThreadsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabThreadsPrimaryColor: "white" }).massageLabThreadsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabThreadsPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabThreadsHarmony: "wild" }).massageLabThreadsHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabThreadsHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabThreadsColor: "white" }).massageLabThreadsColor,
      DEFAULT_CHIMER_SETTINGS.massageLabThreadsColor,
    )
    assert.equal(sanitizeChimerSettings({ massageLabThreadsAmplitude: -1 }).massageLabThreadsAmplitude, 0)
    assert.equal(sanitizeChimerSettings({ massageLabThreadsDistance: -9 }).massageLabThreadsDistance, -1)
  })

  it("normalizes MassageLab Iridescence background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabIridescencePaletteMode: "harmony",
      massageLabIridescencePrimaryColor: "#abcdef",
      massageLabIridescenceHarmony: "triad",
      massageLabIridescenceColor: "#010203",
      massageLabIridescenceSpeed: 99,
      massageLabIridescenceAmplitude: 99,
      massageLabIridescenceMouseReact: false,
    })

    assert.equal(settings.massageLabIridescencePaletteMode, "harmony")
    assert.equal(settings.massageLabIridescencePrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabIridescenceHarmony, "triad")
    assert.equal(settings.massageLabIridescenceColor, "#010203")
    assert.equal(settings.massageLabIridescenceSpeed, 3)
    assert.equal(settings.massageLabIridescenceAmplitude, 1)
    assert.equal(settings.massageLabIridescenceMouseReact, false)
    assert.equal(
      sanitizeChimerSettings({ massageLabIridescencePaletteMode: "auto" }).massageLabIridescencePaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabIridescencePaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabIridescencePrimaryColor: "white" }).massageLabIridescencePrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabIridescencePrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabIridescenceHarmony: "wild" }).massageLabIridescenceHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabIridescenceHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabIridescenceColor: "white" }).massageLabIridescenceColor,
      DEFAULT_CHIMER_SETTINGS.massageLabIridescenceColor,
    )
    assert.equal(sanitizeChimerSettings({ massageLabIridescenceSpeed: -1 }).massageLabIridescenceSpeed, 0)
    assert.equal(sanitizeChimerSettings({ massageLabIridescenceAmplitude: -1 }).massageLabIridescenceAmplitude, 0)
  })

  it("normalizes MassageLab Waves background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabWavesPaletteMode: "harmony",
      massageLabWavesPrimaryColor: "#abcdef",
      massageLabWavesHarmony: "triad",
      massageLabWavesLineColor: "#010203",
      massageLabWavesBackgroundColor: "#040506",
      massageLabWavesTransparentBackground: false,
      massageLabWavesSpeedX: 99,
      massageLabWavesSpeedY: 99,
      massageLabWavesAmplitudeX: 999,
      massageLabWavesAmplitudeY: 999,
      massageLabWavesGapX: 999,
      massageLabWavesGapY: 999,
      massageLabWavesFriction: 99,
      massageLabWavesTension: 99,
      massageLabWavesMaxCursorMove: 999,
      massageLabWavesCursorInteraction: false,
    })

    assert.equal(settings.massageLabWavesPaletteMode, "harmony")
    assert.equal(settings.massageLabWavesPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabWavesHarmony, "triad")
    assert.equal(settings.massageLabWavesLineColor, "#010203")
    assert.equal(settings.massageLabWavesBackgroundColor, "#040506")
    assert.equal(settings.massageLabWavesTransparentBackground, false)
    assert.equal(settings.massageLabWavesSpeedX, 0.05)
    assert.equal(settings.massageLabWavesSpeedY, 0.05)
    assert.equal(settings.massageLabWavesAmplitudeX, 96)
    assert.equal(settings.massageLabWavesAmplitudeY, 96)
    assert.equal(settings.massageLabWavesGapX, 40)
    assert.equal(settings.massageLabWavesGapY, 96)
    assert.equal(settings.massageLabWavesFriction, 0.99)
    assert.equal(settings.massageLabWavesTension, 0.05)
    assert.equal(settings.massageLabWavesMaxCursorMove, 240)
    assert.equal(settings.massageLabWavesCursorInteraction, false)
    assert.equal(
      sanitizeChimerSettings({ massageLabWavesPaletteMode: "auto" }).massageLabWavesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabWavesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWavesPrimaryColor: "white" }).massageLabWavesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabWavesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWavesHarmony: "wild" }).massageLabWavesHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabWavesHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWavesLineColor: "black" }).massageLabWavesLineColor,
      DEFAULT_CHIMER_SETTINGS.massageLabWavesLineColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabWavesBackgroundColor: "black" }).massageLabWavesBackgroundColor,
      DEFAULT_CHIMER_SETTINGS.massageLabWavesBackgroundColor,
    )
    assert.equal(sanitizeChimerSettings({ massageLabWavesSpeedX: -1 }).massageLabWavesSpeedX, 0)
    assert.equal(sanitizeChimerSettings({ massageLabWavesSpeedY: -1 }).massageLabWavesSpeedY, 0)
    assert.equal(sanitizeChimerSettings({ massageLabWavesGapX: 0 }).massageLabWavesGapX, 4)
    assert.equal(sanitizeChimerSettings({ massageLabWavesGapY: 0 }).massageLabWavesGapY, 8)
    assert.equal(sanitizeChimerSettings({ massageLabWavesFriction: 0 }).massageLabWavesFriction, 0.8)
    assert.equal(sanitizeChimerSettings({ massageLabWavesTension: 0 }).massageLabWavesTension, 0.001)
    assert.equal(sanitizeChimerSettings({ massageLabWavesMaxCursorMove: -1 }).massageLabWavesMaxCursorMove, 0)
  })

  it("normalizes MassageLab Grid Distortion background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabGridDistortionPaletteMode: "harmony",
      massageLabGridDistortionPrimaryColor: "#abcdef",
      massageLabGridDistortionHarmony: "triad",
      massageLabGridDistortionColorOne: "#010203",
      massageLabGridDistortionColorTwo: "#040506",
      massageLabGridDistortionColorThree: "#070809",
      massageLabGridDistortionGrid: 999,
      massageLabGridDistortionMouse: 999,
      massageLabGridDistortionStrength: 999,
      massageLabGridDistortionRelaxation: 999,
      massageLabGridDistortionCursorInteraction: false,
    })

    assert.equal(settings.massageLabGridDistortionPaletteMode, "harmony")
    assert.equal(settings.massageLabGridDistortionPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabGridDistortionHarmony, "triad")
    assert.equal(settings.massageLabGridDistortionColorOne, "#010203")
    assert.equal(settings.massageLabGridDistortionColorTwo, "#040506")
    assert.equal(settings.massageLabGridDistortionColorThree, "#070809")
    assert.equal(settings.massageLabGridDistortionGrid, 40)
    assert.equal(settings.massageLabGridDistortionMouse, 0.5)
    assert.equal(settings.massageLabGridDistortionStrength, 0.6)
    assert.equal(settings.massageLabGridDistortionRelaxation, 0.99)
    assert.equal(settings.massageLabGridDistortionCursorInteraction, false)
    assert.equal(
      sanitizeChimerSettings({ massageLabGridDistortionPaletteMode: "auto" }).massageLabGridDistortionPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridDistortionPrimaryColor: "white" }).massageLabGridDistortionPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridDistortionHarmony: "wild" }).massageLabGridDistortionHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridDistortionColorOne: "black" }).massageLabGridDistortionColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridDistortionColorTwo: "black" }).massageLabGridDistortionColorTwo,
      DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionColorTwo,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabGridDistortionColorThree: "black" }).massageLabGridDistortionColorThree,
      DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionColorThree,
    )
    assert.equal(sanitizeChimerSettings({ massageLabGridDistortionGrid: 0 }).massageLabGridDistortionGrid, 4)
    assert.equal(sanitizeChimerSettings({ massageLabGridDistortionMouse: 0 }).massageLabGridDistortionMouse, 0.02)
    assert.equal(sanitizeChimerSettings({ massageLabGridDistortionStrength: -1 }).massageLabGridDistortionStrength, 0)
    assert.equal(sanitizeChimerSettings({ massageLabGridDistortionRelaxation: 0 }).massageLabGridDistortionRelaxation, 0.75)
  })

  it("normalizes the latest MassageLab background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabOrbPaletteMode: "harmony",
      massageLabOrbPrimaryColor: "#abcdef",
      massageLabOrbHarmony: "triad",
      massageLabOrbColor: "#010203",
      massageLabOrbHue: 999,
      massageLabOrbHoverIntensity: 999,
      massageLabOrbRotateOnHover: false,
      massageLabOrbForceHoverState: true,
      massageLabOrbBackgroundColor: "#112233",
      massageLabOrbCursorInteraction: false,
      massageLabLetterGlitchPaletteMode: "harmony",
      massageLabLetterGlitchPrimaryColor: "#abcdef",
      massageLabLetterGlitchHarmony: "triad",
      massageLabLetterGlitchColorOne: "#010203",
      massageLabLetterGlitchColorTwo: "#040506",
      massageLabLetterGlitchColorThree: "#070809",
      massageLabLetterGlitchGlitchSpeed: 999,
      massageLabLetterGlitchCenterVignette: true,
      massageLabLetterGlitchOuterVignette: false,
      massageLabLetterGlitchSmooth: false,
      massageLabLetterGlitchCharacters: "A".repeat(200),
      massageLabGridMotionPaletteMode: "harmony",
      massageLabGridMotionPrimaryColor: "#abcdef",
      massageLabGridMotionHarmony: "triad",
      massageLabGridMotionGradientColor: "#010203",
      massageLabGridMotionTileColor: "#040506",
      massageLabGridMotionTextColor: "#070809",
      massageLabGridMotionMaxMoveAmount: 999,
      massageLabGridMotionBaseDuration: 9,
      massageLabGridMotionCursorInteraction: false,
      massageLabShapeGridPaletteMode: "harmony",
      massageLabShapeGridPrimaryColor: "#abcdef",
      massageLabShapeGridHarmony: "triad",
      massageLabShapeGridBorderColor: "#010203",
      massageLabShapeGridHoverFillColor: "#040506",
      massageLabShapeGridDirection: "diagonal",
      massageLabShapeGridSpeed: 99,
      massageLabShapeGridSquareSize: 0,
      massageLabShapeGridShape: "hexagon",
      massageLabShapeGridHoverTrailAmount: 99,
      massageLabShapeGridCursorInteraction: false,
      massageLabLiquidChromePaletteMode: "harmony",
      massageLabLiquidChromePrimaryColor: "#abcdef",
      massageLabLiquidChromeHarmony: "triad",
      massageLabLiquidChromeBaseColor: "#010203",
      massageLabLiquidChromeSpeed: 9,
      massageLabLiquidChromeAmplitude: 9,
      massageLabLiquidChromeFrequencyX: 99,
      massageLabLiquidChromeFrequencyY: 0,
      massageLabLiquidChromeInteractive: false,
      massageLabBalatroPaletteMode: "harmony",
      massageLabBalatroPrimaryColor: "#abcdef",
      massageLabBalatroHarmony: "triad",
      massageLabBalatroColorOne: "#010203",
      massageLabBalatroColorTwo: "#040506",
      massageLabBalatroColorThree: "#070809",
      massageLabBalatroSpinRotation: 99,
      massageLabBalatroSpinSpeed: 99,
      massageLabBalatroOffsetX: -9,
      massageLabBalatroOffsetY: 9,
      massageLabBalatroContrast: 0,
      massageLabBalatroLighting: 9,
      massageLabBalatroSpinAmount: 9,
      massageLabBalatroPixelFilter: 9999,
      massageLabBalatroSpinEase: 9,
      massageLabBalatroIsRotate: true,
      massageLabBalatroMouseInteraction: false,
    })

    assert.equal(settings.massageLabOrbPaletteMode, "harmony")
    assert.equal(settings.massageLabOrbPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabOrbHarmony, "triad")
    assert.equal(settings.massageLabOrbColor, "#010203")
    assert.equal(settings.massageLabOrbHue, 360)
    assert.equal(settings.massageLabOrbHoverIntensity, 1)
    assert.equal(settings.massageLabOrbRotateOnHover, false)
    assert.equal(settings.massageLabOrbForceHoverState, true)
    assert.equal(settings.massageLabOrbBackgroundColor, "#112233")
    assert.equal(settings.massageLabOrbCursorInteraction, false)
    assert.equal(settings.massageLabLetterGlitchPaletteMode, "harmony")
    assert.equal(settings.massageLabLetterGlitchPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabLetterGlitchHarmony, "triad")
    assert.equal(settings.massageLabLetterGlitchColorOne, "#010203")
    assert.equal(settings.massageLabLetterGlitchColorTwo, "#040506")
    assert.equal(settings.massageLabLetterGlitchColorThree, "#070809")
    assert.equal(settings.massageLabLetterGlitchGlitchSpeed, 500)
    assert.equal(settings.massageLabLetterGlitchCenterVignette, true)
    assert.equal(settings.massageLabLetterGlitchOuterVignette, false)
    assert.equal(settings.massageLabLetterGlitchSmooth, false)
    assert.equal(settings.massageLabLetterGlitchCharacters.length, 120)
    assert.equal(settings.massageLabGridMotionPaletteMode, "harmony")
    assert.equal(settings.massageLabGridMotionPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabGridMotionHarmony, "triad")
    assert.equal(settings.massageLabGridMotionGradientColor, "#010203")
    assert.equal(settings.massageLabGridMotionTileColor, "#040506")
    assert.equal(settings.massageLabGridMotionTextColor, "#070809")
    assert.equal(settings.massageLabGridMotionMaxMoveAmount, 600)
    assert.equal(settings.massageLabGridMotionBaseDuration, 2)
    assert.equal(settings.massageLabGridMotionCursorInteraction, false)
    assert.equal(settings.massageLabShapeGridPaletteMode, "harmony")
    assert.equal(settings.massageLabShapeGridPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabShapeGridHarmony, "triad")
    assert.equal(settings.massageLabShapeGridBorderColor, "#010203")
    assert.equal(settings.massageLabShapeGridHoverFillColor, "#040506")
    assert.equal(settings.massageLabShapeGridDirection, "diagonal")
    assert.equal(settings.massageLabShapeGridSpeed, 8)
    assert.equal(settings.massageLabShapeGridSquareSize, 12)
    assert.equal(settings.massageLabShapeGridShape, "hexagon")
    assert.equal(settings.massageLabShapeGridHoverTrailAmount, 24)
    assert.equal(settings.massageLabShapeGridCursorInteraction, false)
    assert.equal(settings.massageLabLiquidChromePaletteMode, "harmony")
    assert.equal(settings.massageLabLiquidChromePrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabLiquidChromeHarmony, "triad")
    assert.equal(settings.massageLabLiquidChromeBaseColor, "#010203")
    assert.equal(settings.massageLabLiquidChromeSpeed, 3)
    assert.equal(settings.massageLabLiquidChromeAmplitude, 1)
    assert.equal(settings.massageLabLiquidChromeFrequencyX, 12)
    assert.equal(settings.massageLabLiquidChromeFrequencyY, 0.1)
    assert.equal(settings.massageLabLiquidChromeInteractive, false)
    assert.equal(settings.massageLabBalatroPaletteMode, "harmony")
    assert.equal(settings.massageLabBalatroPrimaryColor, "#ABCDEF")
    assert.equal(settings.massageLabBalatroHarmony, "triad")
    assert.equal(settings.massageLabBalatroColorOne, "#010203")
    assert.equal(settings.massageLabBalatroColorTwo, "#040506")
    assert.equal(settings.massageLabBalatroColorThree, "#070809")
    assert.equal(settings.massageLabBalatroSpinRotation, 8)
    assert.equal(settings.massageLabBalatroSpinSpeed, 14)
    assert.equal(settings.massageLabBalatroOffsetX, -1)
    assert.equal(settings.massageLabBalatroOffsetY, 1)
    assert.equal(settings.massageLabBalatroContrast, 0.5)
    assert.equal(settings.massageLabBalatroLighting, 1)
    assert.equal(settings.massageLabBalatroSpinAmount, 1)
    assert.equal(settings.massageLabBalatroPixelFilter, 1200)
    assert.equal(settings.massageLabBalatroSpinEase, 3)
    assert.equal(settings.massageLabBalatroIsRotate, true)
    assert.equal(settings.massageLabBalatroMouseInteraction, false)
    assert.equal(
      sanitizeChimerSettings({ massageLabOrbPaletteMode: "auto" }).massageLabOrbPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabOrbPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabShapeGridDirection: "sideways" }).massageLabShapeGridDirection,
      DEFAULT_CHIMER_SETTINGS.massageLabShapeGridDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabBalatroColorOne: "red" }).massageLabBalatroColorOne,
      DEFAULT_CHIMER_SETTINGS.massageLabBalatroColorOne,
    )
  })

  it("normalizes MassageLab Novatrix background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabNovatrixPaletteMode: "harmony",
      massageLabNovatrixPrimaryColor: "#ffffff",
      massageLabNovatrixHarmony: "triad",
      massageLabNovatrixColor: "white",
      massageLabNovatrixSpeed: 99,
      massageLabNovatrixAmplitude: 0,
    })

    assert.equal(settings.massageLabNovatrixPaletteMode, "harmony")
    assert.equal(settings.massageLabNovatrixPrimaryColor, "#FFFFFF")
    assert.equal(settings.massageLabNovatrixHarmony, "triad")
    assert.equal(settings.massageLabNovatrixColor, DEFAULT_CHIMER_SETTINGS.massageLabNovatrixColor)
    assert.equal(settings.massageLabNovatrixSpeed, 3)
    assert.equal(settings.massageLabNovatrixAmplitude, 0.01)
    assert.equal(
      sanitizeChimerSettings({ massageLabNovatrixSpeed: "fast" }).massageLabNovatrixSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabNovatrixSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabNovatrixAmplitude: "wide" }).massageLabNovatrixAmplitude,
      DEFAULT_CHIMER_SETTINGS.massageLabNovatrixAmplitude,
    )
    assert.equal(sanitizeChimerSettings({ massageLabNovatrixAmplitude: 10 }).massageLabNovatrixAmplitude, 0.45)
    assert.equal(
      sanitizeChimerSettings({ massageLabNovatrixPaletteMode: "demo" }).massageLabNovatrixPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabNovatrixPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabNovatrixPrimaryColor: "blue" }).massageLabNovatrixPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabNovatrixPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabNovatrixHarmony: "rainbow" }).massageLabNovatrixHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabNovatrixHarmony,
    )
  })

  it("normalizes MassageLab Matrix Rain background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabMatrixRainPaletteMode: "harmony",
      massageLabMatrixRainPrimaryColor: "#00d4ff",
      massageLabMatrixRainHarmony: "triad",
      massageLabMatrixRainColor: "green",
      massageLabMatrixRainSpeed: 99,
      massageLabMatrixRainFontSize: 4,
    })

    assert.equal(settings.massageLabMatrixRainPaletteMode, "harmony")
    assert.equal(settings.massageLabMatrixRainPrimaryColor, "#00D4FF")
    assert.equal(settings.massageLabMatrixRainHarmony, "triad")
    assert.equal(settings.massageLabMatrixRainColor, DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainColor)
    assert.equal(settings.massageLabMatrixRainSpeed, 3)
    assert.equal(settings.massageLabMatrixRainFontSize, 8)
    assert.equal(
      sanitizeChimerSettings({ massageLabMatrixRainSpeed: "fast" }).massageLabMatrixRainSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabMatrixRainFontSize: "wide" }).massageLabMatrixRainFontSize,
      DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainFontSize,
    )
    assert.equal(sanitizeChimerSettings({ massageLabMatrixRainSpeed: 0 }).massageLabMatrixRainSpeed, 0.05)
    assert.equal(sanitizeChimerSettings({ massageLabMatrixRainFontSize: 99 }).massageLabMatrixRainFontSize, 28)
    assert.equal(
      sanitizeChimerSettings({ massageLabMatrixRainPaletteMode: "demo" }).massageLabMatrixRainPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabMatrixRainPrimaryColor: "blue" }).massageLabMatrixRainPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabMatrixRainHarmony: "rainbow" }).massageLabMatrixRainHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainHarmony,
    )
  })

  it("normalizes MassageLab Photon Beam background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabPhotonBeamPaletteMode: "harmony",
      massageLabPhotonBeamPrimaryColor: "#00d4ff",
      massageLabPhotonBeamHarmony: "triad",
      massageLabPhotonBeamColorBg: "black",
      massageLabPhotonBeamColorLine: "#123456",
      massageLabPhotonBeamColorSignal: "#abcdef",
      massageLabPhotonBeamUseColor2: true,
      massageLabPhotonBeamColorSignal2: "#fedcba",
      massageLabPhotonBeamUseColor3: true,
      massageLabPhotonBeamColorSignal3: "#00ffff",
      massageLabPhotonBeamLineCount: 999,
      massageLabPhotonBeamSpreadHeight: 0,
      massageLabPhotonBeamSpreadDepth: 99,
      massageLabPhotonBeamCurveLength: 0,
      massageLabPhotonBeamStraightLength: 999,
      massageLabPhotonBeamCurvePower: 9,
      massageLabPhotonBeamWaveSpeed: -1,
      massageLabPhotonBeamWaveHeight: 9,
      massageLabPhotonBeamLineOpacity: 0,
      massageLabPhotonBeamSignalCount: -12,
      massageLabPhotonBeamSpeedGlobal: 99,
      massageLabPhotonBeamTrailLength: 99,
      massageLabPhotonBeamBloomStrength: 99,
      massageLabPhotonBeamBloomRadius: 99,
    })

    assert.equal(settings.massageLabPhotonBeamPaletteMode, "harmony")
    assert.equal(settings.massageLabPhotonBeamPrimaryColor, "#00D4FF")
    assert.equal(settings.massageLabPhotonBeamHarmony, "triad")
    assert.equal(settings.massageLabPhotonBeamColorBg, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamColorBg)
    assert.equal(settings.massageLabPhotonBeamColorLine, "#123456")
    assert.equal(settings.massageLabPhotonBeamColorSignal, "#ABCDEF")
    assert.equal(settings.massageLabPhotonBeamUseColor2, true)
    assert.equal(settings.massageLabPhotonBeamColorSignal2, "#FEDCBA")
    assert.equal(settings.massageLabPhotonBeamUseColor3, true)
    assert.equal(settings.massageLabPhotonBeamColorSignal3, "#00FFFF")
    assert.equal(settings.massageLabPhotonBeamLineCount, 160)
    assert.equal(settings.massageLabPhotonBeamSpreadHeight, 5)
    assert.equal(settings.massageLabPhotonBeamSpreadDepth, 60)
    assert.equal(settings.massageLabPhotonBeamCurveLength, 16)
    assert.equal(settings.massageLabPhotonBeamStraightLength, 220)
    assert.equal(settings.massageLabPhotonBeamCurvePower, 2)
    assert.equal(settings.massageLabPhotonBeamWaveSpeed, 0)
    assert.equal(settings.massageLabPhotonBeamWaveHeight, 1)
    assert.equal(settings.massageLabPhotonBeamLineOpacity, 0.05)
    assert.equal(settings.massageLabPhotonBeamSignalCount, 0)
    assert.equal(settings.massageLabPhotonBeamSpeedGlobal, 2)
    assert.equal(settings.massageLabPhotonBeamTrailLength, 16)
    assert.equal(settings.massageLabPhotonBeamBloomStrength, 6)
    assert.equal(settings.massageLabPhotonBeamBloomRadius, 1.5)
    assert.equal(
      sanitizeChimerSettings({ massageLabPhotonBeamPaletteMode: "demo" }).massageLabPhotonBeamPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPhotonBeamHarmony: "rainbow" }).massageLabPhotonBeamHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPhotonBeamUseColor2: "yes" }).massageLabPhotonBeamUseColor2,
      DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamUseColor2,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabPhotonBeamSpeedGlobal: "fast" }).massageLabPhotonBeamSpeedGlobal,
      DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSpeedGlobal,
    )
  })

  it("normalizes MassageLab 3D Globe background controls", () => {
    const longLabel = "A".repeat(96)
    const settings = sanitizeChimerSettings({
      massageLab3DGlobeViewStyle: "graphic",
      massageLab3DGlobeBackgroundColor: "#aabbcc",
      massageLab3DGlobeGlobeColor: "navy",
      massageLab3DGlobeGraphicMapColor: "#ddeeff",
      massageLab3DGlobeGraphicGlowColor: "white",
      massageLab3DGlobeGraphicMarkerColor: "#fb6415",
      massageLab3DGlobeGraphicMapSamples: 999999,
      massageLab3DGlobeAutoRotateSpeed: 99,
      massageLab3DGlobeReverseSpin: false,
      massageLab3DGlobeScale: 0,
      massageLab3DGlobeBumpScale: 99,
      massageLab3DGlobeAmbientIntensity: -1,
      massageLab3DGlobePointLightIntensity: 99,
      massageLab3DGlobeLightingMode: "sun",
      massageLab3DGlobeEnablePan: true,
      massageLab3DGlobePanX: -999,
      massageLab3DGlobePanY: 999,
      massageLab3DGlobeShowTilt: false,
      massageLab3DGlobeShowAtmosphere: true,
      massageLab3DGlobeAtmosphereColor: "#4da6ff",
      massageLab3DGlobeAtmosphereIntensity: 99,
      massageLab3DGlobeAtmosphereBlur: 0,
      massageLab3DGlobeShowWireframe: true,
      massageLab3DGlobeWireframeColor: "#4a9eff",
      massageLab3DGlobeMarkerEnabled: true,
      massageLab3DGlobeMarkerLat: 999,
      massageLab3DGlobeMarkerLng: -999,
      massageLab3DGlobeMarkerLabel: longLabel,
      massageLab3DGlobeMarkerIcon: "heart",
      massageLab3DGlobeMarkerSize: 1,
    })

    assert.equal(settings.massageLab3DGlobeViewStyle, "graphic")
    assert.equal(settings.massageLab3DGlobeBackgroundColor, "#AABBCC")
    assert.equal(settings.massageLab3DGlobeGlobeColor, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeGlobeColor)
    assert.equal(settings.massageLab3DGlobeGraphicMapColor, "#DDEEFF")
    assert.equal(settings.massageLab3DGlobeGraphicGlowColor, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeGraphicGlowColor)
    assert.equal(settings.massageLab3DGlobeGraphicMarkerColor, "#FB6415")
    assert.equal(settings.massageLab3DGlobeGraphicMapSamples, 10000)
    assert.equal(settings.massageLab3DGlobeAutoRotateSpeed, 2)
    assert.equal(settings.massageLab3DGlobeReverseSpin, true)
    assert.equal(settings.massageLab3DGlobeScale, 0.05)
    assert.equal(settings.massageLab3DGlobeBumpScale, 3)
    assert.equal(settings.massageLab3DGlobeAmbientIntensity, 0)
    assert.equal(settings.massageLab3DGlobePointLightIntensity, 4)
    assert.equal(settings.massageLab3DGlobeLightingMode, "sun")
    assert.equal(settings.massageLab3DGlobeEnablePan, true)
    assert.equal(settings.massageLab3DGlobePanX, -50)
    assert.equal(settings.massageLab3DGlobePanY, 50)
    assert.equal(settings.massageLab3DGlobeShowTilt, true)
    assert.equal(settings.massageLab3DGlobeShowAtmosphere, true)
    assert.equal(settings.massageLab3DGlobeAtmosphereColor, "#4DA6FF")
    assert.equal(settings.massageLab3DGlobeAtmosphereIntensity, 2)
    assert.equal(settings.massageLab3DGlobeAtmosphereBlur, 0.5)
    assert.equal(settings.massageLab3DGlobeShowWireframe, true)
    assert.equal(settings.massageLab3DGlobeWireframeColor, "#4A9EFF")
    assert.equal(settings.massageLab3DGlobeMarkerEnabled, true)
    assert.equal(settings.massageLab3DGlobeMarkerLat, 90)
    assert.equal(settings.massageLab3DGlobeMarkerLng, -180)
    assert.equal(settings.massageLab3DGlobeMarkerLabel, longLabel.slice(0, 80))
    assert.equal(settings.massageLab3DGlobeMarkerIcon, "heart")
    assert.equal(settings.massageLab3DGlobeMarkerSize, 0.16)
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeMarkerIcon: "bolt" }).massageLab3DGlobeMarkerIcon,
      DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerIcon,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeShowAtmosphere: "yes" }).massageLab3DGlobeShowAtmosphere,
      DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeShowAtmosphere,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeMarkerEnabled: "yes" }).massageLab3DGlobeMarkerEnabled,
      DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerEnabled,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeMarkerLabel: "" }).massageLab3DGlobeMarkerLabel,
      "",
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeLightingMode: "auto" }).massageLab3DGlobeLightingMode,
      DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeLightingMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeViewStyle: "wire" }).massageLab3DGlobeViewStyle,
      DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeViewStyle,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeGraphicMapSamples: 100 }).massageLab3DGlobeGraphicMapSamples,
      1000,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeEnablePan: "yes" }).massageLab3DGlobeEnablePan,
      DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeEnablePan,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLab3DGlobeReverseSpin: "yes" }).massageLab3DGlobeReverseSpin,
      DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeReverseSpin,
    )
    assert.equal(sanitizeChimerSettings({ massageLab3DGlobeReverseSpin: false }).massageLab3DGlobeReverseSpin, true)
    assert.equal(sanitizeChimerSettings({ massageLab3DGlobeShowTilt: false }).massageLab3DGlobeShowTilt, true)
    assert.equal(getMassageLab3DGlobeScaleDisplayPercent(0.05), 1)
    assert.equal(getMassageLab3DGlobeScaleDisplayPercent(0.95), 100)
    assert.equal(getMassageLab3DGlobeScaleFromDisplayPercent(1), 0.05)
    assert.equal(getMassageLab3DGlobeScaleFromDisplayPercent(100), 0.95)
  })

  it("normalizes MassageLab Retro Grid background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabRetroGridBackgroundColor: "black",
      massageLabRetroGridLightLineColor: "#aabbcc",
      massageLabRetroGridDarkLineColor: "#112233",
      massageLabRetroGridAngle: 99,
      massageLabRetroGridCellSize: 2,
      massageLabRetroGridOpacity: 0,
    })

    assert.equal(settings.massageLabRetroGridBackgroundColor, DEFAULT_CHIMER_SETTINGS.massageLabRetroGridBackgroundColor)
    assert.equal(settings.massageLabRetroGridLightLineColor, "#AABBCC")
    assert.equal(settings.massageLabRetroGridDarkLineColor, "#112233")
    assert.equal(settings.massageLabRetroGridAngle, 89)
    assert.equal(settings.massageLabRetroGridCellSize, 12)
    assert.equal(settings.massageLabRetroGridOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ massageLabRetroGridAngle: "steep" }).massageLabRetroGridAngle,
      DEFAULT_CHIMER_SETTINGS.massageLabRetroGridAngle,
    )
    assert.equal(sanitizeChimerSettings({ massageLabRetroGridAngle: -10 }).massageLabRetroGridAngle, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabRetroGridCellSize: "wide" }).massageLabRetroGridCellSize,
      DEFAULT_CHIMER_SETTINGS.massageLabRetroGridCellSize,
    )
    assert.equal(sanitizeChimerSettings({ massageLabRetroGridCellSize: 999 }).massageLabRetroGridCellSize, 160)
    assert.equal(
      sanitizeChimerSettings({ massageLabRetroGridOpacity: "solid" }).massageLabRetroGridOpacity,
      DEFAULT_CHIMER_SETTINGS.massageLabRetroGridOpacity,
    )
    assert.equal(sanitizeChimerSettings({ massageLabRetroGridOpacity: 99 }).massageLabRetroGridOpacity, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabRetroGridLightLineColor: "gray" }).massageLabRetroGridLightLineColor,
      DEFAULT_CHIMER_SETTINGS.massageLabRetroGridLightLineColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabRetroGridDarkLineColor: "gray" }).massageLabRetroGridDarkLineColor,
      DEFAULT_CHIMER_SETTINGS.massageLabRetroGridDarkLineColor,
    )
  })

  it("normalizes MassageLab Aerial Rays background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabAerialRaysBackgroundColor: "black",
      massageLabAerialRaysColor: "#a0d2ff",
      massageLabAerialRaysCount: 99,
      massageLabAerialRaysBlur: 999,
      massageLabAerialRaysSpeed: 0,
      massageLabAerialRaysLength: 999,
      massageLabAerialRaysOpacity: 0,
    })

    assert.equal(settings.massageLabAerialRaysBackgroundColor, DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysBackgroundColor)
    assert.equal(settings.massageLabAerialRaysColor, "#A0D2FF")
    assert.equal(settings.massageLabAerialRaysCount, 20)
    assert.equal(settings.massageLabAerialRaysBlur, 80)
    assert.equal(settings.massageLabAerialRaysSpeed, 2)
    assert.equal(settings.massageLabAerialRaysLength, 120)
    assert.equal(settings.massageLabAerialRaysOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ massageLabAerialRaysColor: "blue" }).massageLabAerialRaysColor,
      DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabAerialRaysCount: "many" }).massageLabAerialRaysCount,
      DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysCount,
    )
    assert.equal(sanitizeChimerSettings({ massageLabAerialRaysCount: 0 }).massageLabAerialRaysCount, 1)
    assert.equal(
      sanitizeChimerSettings({ massageLabAerialRaysBlur: "soft" }).massageLabAerialRaysBlur,
      DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysBlur,
    )
    assert.equal(sanitizeChimerSettings({ massageLabAerialRaysBlur: -1 }).massageLabAerialRaysBlur, 0)
    assert.equal(
      sanitizeChimerSettings({ massageLabAerialRaysSpeed: "slow" }).massageLabAerialRaysSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabAerialRaysSpeed: 999 }).massageLabAerialRaysSpeed, 40)
    assert.equal(
      sanitizeChimerSettings({ massageLabAerialRaysLength: "long" }).massageLabAerialRaysLength,
      DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysLength,
    )
    assert.equal(sanitizeChimerSettings({ massageLabAerialRaysLength: 0 }).massageLabAerialRaysLength, 24)
    assert.equal(
      sanitizeChimerSettings({ massageLabAerialRaysOpacity: "bright" }).massageLabAerialRaysOpacity,
      DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysOpacity,
    )
    assert.equal(sanitizeChimerSettings({ massageLabAerialRaysOpacity: 9 }).massageLabAerialRaysOpacity, 1)
  })

  it("normalizes MassageLab Synthesis background controls", () => {
    const settings = sanitizeChimerSettings({
      massageLabSynthesisPaletteMode: "harmony",
      massageLabSynthesisPrimaryColor: "#0ea5e9",
      massageLabSynthesisHarmony: "triad",
      massageLabSynthesisColorOne: "#0f172a",
      massageLabSynthesisColorTwo: "purple",
      massageLabSynthesisColorThree: "#0ea5e9",
      massageLabSynthesisSpeed: 99,
      massageLabSynthesisComplexity: 999,
      massageLabSynthesisScale: 0,
      massageLabSynthesisDistortion: -1,
      massageLabSynthesisGlowIntensity: 99,
      massageLabSynthesisFlowFrequency: 999,
    })

    assert.equal(settings.massageLabSynthesisPaletteMode, "harmony")
    assert.equal(settings.massageLabSynthesisPrimaryColor, "#0EA5E9")
    assert.equal(settings.massageLabSynthesisHarmony, "triad")
    assert.equal(settings.massageLabSynthesisColorOne, "#0F172A")
    assert.equal(settings.massageLabSynthesisColorTwo, DEFAULT_CHIMER_SETTINGS.massageLabSynthesisColorTwo)
    assert.equal(settings.massageLabSynthesisColorThree, "#0EA5E9")
    assert.equal(settings.massageLabSynthesisSpeed, 2)
    assert.equal(settings.massageLabSynthesisComplexity, 20)
    assert.equal(settings.massageLabSynthesisScale, 0.1)
    assert.equal(settings.massageLabSynthesisDistortion, 0)
    assert.equal(settings.massageLabSynthesisGlowIntensity, 2)
    assert.equal(settings.massageLabSynthesisFlowFrequency, 10)
    assert.equal(
      sanitizeChimerSettings({ massageLabSynthesisSpeed: "fast" }).massageLabSynthesisSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabSynthesisSpeed,
    )
    assert.equal(sanitizeChimerSettings({ massageLabSynthesisSpeed: 0 }).massageLabSynthesisSpeed, 0.004)
    assert.equal(
      sanitizeChimerSettings({ massageLabSynthesisPaletteMode: "demo" }).massageLabSynthesisPaletteMode,
      DEFAULT_CHIMER_SETTINGS.massageLabSynthesisPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSynthesisPrimaryColor: "cyan" }).massageLabSynthesisPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.massageLabSynthesisPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSynthesisHarmony: "rainbow" }).massageLabSynthesisHarmony,
      DEFAULT_CHIMER_SETTINGS.massageLabSynthesisHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ massageLabSynthesisComplexity: "many" }).massageLabSynthesisComplexity,
      DEFAULT_CHIMER_SETTINGS.massageLabSynthesisComplexity,
    )
  })

  it("normalizes Lamp Glow background controls", () => {
    const settings = sanitizeChimerSettings({
      lampBackgroundColor: "navy",
      lampColor: "#22d3ee",
      lampGlowOpacity: 9,
      lampBeamWidth: 120,
      lampGlowWidth: 1200,
      lampVerticalOffset: -900,
      lampPulseSpeed: 99,
    })

    assert.equal(settings.lampBackgroundColor, DEFAULT_CHIMER_SETTINGS.lampBackgroundColor)
    assert.equal(settings.lampColor, "#22D3EE")
    assert.equal(settings.lampGlowOpacity, 0.95)
    assert.equal(settings.lampBeamWidth, 240)
    assert.equal(settings.lampGlowWidth, 900)
    assert.equal(settings.lampVerticalOffset, -320)
    assert.equal(settings.lampPulseSpeed, 18)
  })

  it("normalizes Pixel Liquid background controls", () => {
    const settings = sanitizeChimerSettings({
      pixelLiquidBackgroundColor: "#0a0b0c",
      pixelLiquidBaseColor: "#123abc",
      pixelLiquidAccentColor: "not-a-color",
      pixelLiquidHighlightColor: "#fedcba",
      pixelLiquidPixelSize: 999,
      pixelLiquidDetail: "ultra",
      pixelLiquidMotionSpeed: 99,
    })

    assert.equal(settings.pixelLiquidBackgroundColor, "#0A0B0C")
    assert.equal(settings.pixelLiquidBaseColor, "#123ABC")
    assert.equal(settings.pixelLiquidAccentColor, DEFAULT_CHIMER_SETTINGS.pixelLiquidAccentColor)
    assert.equal(settings.pixelLiquidHighlightColor, "#FEDCBA")
    assert.equal(settings.pixelLiquidPixelSize, 18)
    assert.equal(settings.pixelLiquidDetail, DEFAULT_CHIMER_SETTINGS.pixelLiquidDetail)
    assert.equal(settings.pixelLiquidMotionSpeed, 1.4)

    const legacyPaletteSettings = sanitizeChimerSettings({
      pixelLiquidPalette: "ember",
    })

    assert.equal(legacyPaletteSettings.pixelLiquidBackgroundColor, "#110603")
    assert.equal(legacyPaletteSettings.pixelLiquidBaseColor, "#A4360C")
    assert.equal(legacyPaletteSettings.pixelLiquidAccentColor, "#FF7A1A")
    assert.equal(legacyPaletteSettings.pixelLiquidHighlightColor, "#FFE2AB")
  })

  it("normalizes Aurora Bars background controls", () => {
    const settings = sanitizeChimerSettings({
      auroraBarsBackgroundColor: "#010203",
      auroraBarsPaletteMode: "custom",
      auroraBarsPrimaryColor: "#334455",
      auroraBarsColorOne: "#aabbcc",
      auroraBarsColorTwo: "bad",
      auroraBarsColorThree: "#123abc",
      auroraBarsColorFour: "#fedcba",
      auroraBarsColorFive: "#112233",
      auroraBarsBarCount: 999,
      auroraBarsSpeed: 99,
      auroraBarsBlur: 99,
      auroraBarsGap: -1,
      auroraBarsMaxHeightRatio: 99,
      auroraBarsMinHeightRatio: 99,
    })

    assert.equal(settings.auroraBarsBackgroundColor, "#010203")
    assert.equal(settings.auroraBarsPaletteMode, "custom")
    assert.equal(settings.auroraBarsPrimaryColor, "#334455")
    assert.equal(settings.auroraBarsColorOne, "#AABBCC")
    assert.equal(settings.auroraBarsColorTwo, DEFAULT_CHIMER_SETTINGS.auroraBarsColorTwo)
    assert.equal(settings.auroraBarsColorThree, "#123ABC")
    assert.equal(settings.auroraBarsColorFour, "#FEDCBA")
    assert.equal(settings.auroraBarsColorFive, "#112233")
    assert.equal(settings.auroraBarsBarCount, 80)
    assert.equal(settings.auroraBarsSpeed, 2)
    assert.equal(settings.auroraBarsBlur, 18)
    assert.equal(settings.auroraBarsGap, 0)
    assert.equal(settings.auroraBarsMaxHeightRatio, 1)
    assert.equal(settings.auroraBarsMinHeightRatio, 0.78)
    assert.equal(
      sanitizeChimerSettings({ auroraBarsPaletteMode: "rainbow" }).auroraBarsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.auroraBarsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ auroraBarsPrimaryColor: "bad" }).auroraBarsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.auroraBarsPrimaryColor,
    )
  })

  it("normalizes MassageLab Tile Grid background controls", () => {
    const settings = sanitizeChimerSettings({
      tileGridPaletteMode: "custom",
      tileGridPrimaryColor: "#112233",
      tileGridColorOne: "#aabbcc",
      tileGridColorTwo: "bad",
      tileGridColorThree: "#123abc",
      tileGridColorFour: "#fedcba",
      tileGridColorFive: "#010203",
      tileGridTileSize: 999,
      tileGridJointSize: 0,
      tileGridChangeFrequency: 99,
      tileGridActivePercent: 0,
      tileGridOpacity: 99,
    })

    assert.equal(settings.tileGridPaletteMode, "custom")
    assert.equal(settings.tileGridPrimaryColor, "#112233")
    assert.equal(settings.tileGridColorOne, "#AABBCC")
    assert.equal(settings.tileGridColorTwo, DEFAULT_CHIMER_SETTINGS.tileGridColorTwo)
    assert.equal(settings.tileGridColorThree, "#123ABC")
    assert.equal(settings.tileGridColorFour, "#FEDCBA")
    assert.equal(settings.tileGridColorFive, "#010203")
    assert.equal(settings.tileGridTileSize, 120)
    assert.equal(settings.tileGridJointSize, 1)
    assert.equal(settings.tileGridChangeFrequency, 99)
    assert.equal(settings.tileGridActivePercent, 1)
    assert.equal(settings.tileGridOpacity, 1)

    assert.equal(
      sanitizeChimerSettings({ tileGridPaletteMode: "palette" }).tileGridPaletteMode,
      DEFAULT_CHIMER_SETTINGS.tileGridPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ tileGridOpacity: "faint" }).tileGridOpacity,
      DEFAULT_CHIMER_SETTINGS.tileGridOpacity,
    )
    assert.equal(
      sanitizeChimerSettings({ tileGridChangeFrequency: 900_000 }).tileGridChangeFrequency,
      TILE_GRID_FADE_SECONDS_MAX,
    )
  })

  it("normalizes MassageLab Hex Grid background controls", () => {
    const settings = sanitizeChimerSettings({
      hexGridPrimaryColor: "#112233",
      hexGridHarmony: "split-complementary",
      hexGridHexSize: 999,
      hexGridJointSize: 0,
      hexGridChangeFrequency: 99,
      hexGridActivePercent: 0,
      hexGridOpacity: 99,
    })

    assert.equal(settings.hexGridPrimaryColor, "#112233")
    assert.equal(settings.hexGridHarmony, "split-complementary")
    assert.equal(settings.hexGridHexSize, 120)
    assert.equal(settings.hexGridJointSize, 1)
    assert.equal(settings.hexGridChangeFrequency, 99)
    assert.equal(settings.hexGridActivePercent, 1)
    assert.equal(settings.hexGridOpacity, 1)

    assert.equal(
      sanitizeChimerSettings({ hexGridHarmony: "random" }).hexGridHarmony,
      DEFAULT_CHIMER_SETTINGS.hexGridHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ hexGridPrimaryColor: "bad" }).hexGridPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.hexGridPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ hexGridChangeFrequency: 900_000 }).hexGridChangeFrequency,
      TILE_GRID_FADE_SECONDS_MAX,
    )
  })

  it("formats and combines MassageLab Tile Grid fade durations", () => {
    assert.deepEqual(splitTileGridFadeSeconds(3661.5), {
      hours: 1,
      minutes: 1,
      seconds: 1.5,
    })
    assert.equal(combineTileGridFadeParts({ hours: 1, minutes: 2, seconds: 3.4 }), 3723.4)
    assert.equal(formatTileGridFadeDuration(1.2), "1.2s")
    assert.equal(formatTileGridFadeDuration(125), "2m 5s")
    assert.equal(formatTileGridFadeDuration(3661.5), "1h 01m 1.5s")
  })

  it("migrates the first Canvas reveal dot-grid defaults to the source-matched defaults", () => {
    const settings = sanitizeChimerSettings({
      canvasRevealDotsBackgroundColor: "#000000",
      canvasRevealDotsDotColor: "#00FFFF",
      canvasRevealDotsAccentColor: "#FF7A1A",
      canvasRevealDotsDotSize: 1.6,
      canvasRevealDotsDotSpacing: 8,
      canvasRevealDotsOpacity: 0.34,
      canvasRevealDotsAnimationSpeed: 0.4,
      canvasRevealDotsShowGradient: true,
    })

    assert.equal(settings.canvasRevealDotsBackgroundColor, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsBackgroundColor)
    assert.equal(settings.canvasRevealDotsDotColor, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotColor)
    assert.equal(settings.canvasRevealDotsAccentColor, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAccentColor)
    assert.equal(settings.canvasRevealDotsDotSize, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSize)
    assert.equal(settings.canvasRevealDotsDotSpacing, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSpacing)
    assert.equal(settings.canvasRevealDotsOpacity, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsOpacity)
    assert.equal(settings.canvasRevealDotsShowGradient, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsShowGradient)
  })
})
