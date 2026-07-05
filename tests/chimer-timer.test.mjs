import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clampActiveTimerMs,
  DEFAULT_CHIMER_SETTINGS,
  formatCurrentTimeParts,
  formatDurationParts,
  getAceternity3DGlobeScaleDisplayPercent,
  getAceternity3DGlobeScaleFromDisplayPercent,
  getActiveTimerAlertSchedule,
  getIntervalMs,
  getTotalTimerMs,
  MAX_CHIMER_DURATION_MS,
  normalizeHexColor,
  normalizeInteger,
  sanitizeChimerSettings,
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

  it("normalizes Spotlight New background controls", () => {
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

  it("normalizes Animate UI Gradient background controls", () => {
    const settings = sanitizeChimerSettings({
      animateUiGradientPrimaryColor: "#112233",
      animateUiGradientHarmony: "triad",
      animateUiGradientOpacity: 99,
    })

    assert.equal(settings.animateUiGradientPrimaryColor, "#112233")
    assert.equal(settings.animateUiGradientHarmony, "triad")
    assert.equal(settings.animateUiGradientOpacity, 1)
    assert.equal(
      sanitizeChimerSettings({ animateUiGradientFromColor: "#445566" }).animateUiGradientPrimaryColor,
      "#445566",
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiGradientPrimaryColor: "bad" }).animateUiGradientPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.animateUiGradientPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiGradientHarmony: "rainbow" }).animateUiGradientHarmony,
      DEFAULT_CHIMER_SETTINGS.animateUiGradientHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiGradientOpacity: "clear" }).animateUiGradientOpacity,
      DEFAULT_CHIMER_SETTINGS.animateUiGradientOpacity,
    )
  })

  it("normalizes Animate UI Stars background controls", () => {
    const settings = sanitizeChimerSettings({
      animateUiStarsColor: "#aabbcc",
      animateUiStarsSpeed: 999,
      animateUiStarsDensity: 0,
      animateUiStarsParallax: 9,
    })

    assert.equal(settings.animateUiStarsColor, "#AABBCC")
    assert.equal(settings.animateUiStarsSpeed, 120)
    assert.equal(settings.animateUiStarsDensity, 0.25)
    assert.equal(settings.animateUiStarsParallax, 0.12)
    assert.equal(
      sanitizeChimerSettings({ animateUiStarsColor: "white" }).animateUiStarsColor,
      DEFAULT_CHIMER_SETTINGS.animateUiStarsColor,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiStarsSpeed: "fast" }).animateUiStarsSpeed,
      DEFAULT_CHIMER_SETTINGS.animateUiStarsSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiStarsDensity: "dense" }).animateUiStarsDensity,
      DEFAULT_CHIMER_SETTINGS.animateUiStarsDensity,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiStarsParallax: "more" }).animateUiStarsParallax,
      DEFAULT_CHIMER_SETTINGS.animateUiStarsParallax,
    )
  })

  it("normalizes Animate UI Hole background controls", () => {
    const settings = sanitizeChimerSettings({
      animateUiHoleStrokeColor: "#112233",
      animateUiHoleParticleColor: "#aabbcc",
      animateUiHoleLineCount: 999,
      animateUiHoleDiscCount: 0,
    })

    assert.equal(settings.animateUiHoleStrokeColor, "#112233")
    assert.equal(settings.animateUiHoleParticleColor, "#AABBCC")
    assert.equal(settings.animateUiHoleLineCount, 96)
    assert.equal(settings.animateUiHoleDiscCount, 12)
    assert.equal(
      sanitizeChimerSettings({ animateUiHoleStrokeColor: "gray" }).animateUiHoleStrokeColor,
      DEFAULT_CHIMER_SETTINGS.animateUiHoleStrokeColor,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiHoleParticleColor: "white" }).animateUiHoleParticleColor,
      DEFAULT_CHIMER_SETTINGS.animateUiHoleParticleColor,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiHoleLineCount: "many" }).animateUiHoleLineCount,
      DEFAULT_CHIMER_SETTINGS.animateUiHoleLineCount,
    )
    assert.equal(
      sanitizeChimerSettings({ animateUiHoleDiscCount: "few" }).animateUiHoleDiscCount,
      DEFAULT_CHIMER_SETTINGS.animateUiHoleDiscCount,
    )
  })

  it("normalizes Chamaac Light Speed background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacLightSpeedWarpSpeed: 0,
      chamaacLightSpeedWarpSpeedVersion: 2,
      chamaacLightSpeedParticleCount: 9999,
      chamaacLightSpeedLightColor: "#33b2ff",
      chamaacLightSpeedIntensity: 99,
      chamaacLightSpeedRadius: 0,
      chamaacLightSpeedCylinderLength: 999,
    })

    assert.equal(settings.chamaacLightSpeedWarpSpeed, 0.1)
    assert.equal(settings.chamaacLightSpeedWarpSpeedVersion, 2)
    assert.equal(settings.chamaacLightSpeedParticleCount, 200)
    assert.equal(settings.chamaacLightSpeedLightColor, "#33B2FF")
    assert.equal(settings.chamaacLightSpeedIntensity, 6)
    assert.equal(settings.chamaacLightSpeedRadius, 6)
    assert.equal(settings.chamaacLightSpeedCylinderLength, 300)
    assert.equal(
      sanitizeChimerSettings({ chamaacLightSpeedWarpSpeed: 0.1 }).chamaacLightSpeedWarpSpeed,
      1,
    )
    assert.equal(
      sanitizeChimerSettings({
        chamaacLightSpeedWarpSpeed: 1,
        chamaacLightSpeedWarpSpeedVersion: 2,
      }).chamaacLightSpeedWarpSpeed,
      1,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacLightSpeedWarpSpeed: "warp" }).chamaacLightSpeedWarpSpeed,
      DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedWarpSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacLightSpeedParticleCount: "many" }).chamaacLightSpeedParticleCount,
      DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedParticleCount,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacLightSpeedLightColor: "purple" }).chamaacLightSpeedLightColor,
      DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedLightColor,
    )
  })

  it("normalizes Chamaac Electric Mist background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacElectricMistColor: "#33b2ff",
      chamaacElectricMistSpeed: 999,
      chamaacElectricMistControlVersion: 2,
      chamaacElectricMistDetail: 0,
      chamaacElectricMistDistortion: 99,
      chamaacElectricMistBrightness: 0,
    })

    assert.equal(settings.chamaacElectricMistColor, "#33B2FF")
    assert.equal(settings.chamaacElectricMistSpeed, 400)
    assert.equal(settings.chamaacElectricMistControlVersion, 2)
    assert.equal(settings.chamaacElectricMistDetail, 0.5)
    assert.equal(settings.chamaacElectricMistDistortion, 8)
    assert.equal(settings.chamaacElectricMistBrightness, 1)
    const legacySettings = sanitizeChimerSettings({
      chamaacElectricMistSpeed: 3.5,
      chamaacElectricMistBrightness: 0.5,
    })
    assert.equal(legacySettings.chamaacElectricMistSpeed, 350)
    assert.equal(legacySettings.chamaacElectricMistBrightness, 50)
    assert.equal(legacySettings.chamaacElectricMistControlVersion, 2)
    assert.equal(
      sanitizeChimerSettings({
        chamaacElectricMistControlVersion: 2,
        chamaacElectricMistBrightness: 1,
      }).chamaacElectricMistBrightness,
      1,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacElectricMistColor: "blue" }).chamaacElectricMistColor,
      DEFAULT_CHIMER_SETTINGS.chamaacElectricMistColor,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacElectricMistSpeed: "fast" }).chamaacElectricMistSpeed,
      DEFAULT_CHIMER_SETTINGS.chamaacElectricMistSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacElectricMistDetail: "dense" }).chamaacElectricMistDetail,
      DEFAULT_CHIMER_SETTINGS.chamaacElectricMistDetail,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacElectricMistDistortion: "warp" }).chamaacElectricMistDistortion,
      DEFAULT_CHIMER_SETTINGS.chamaacElectricMistDistortion,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacElectricMistBrightness: "bright" }).chamaacElectricMistBrightness,
      DEFAULT_CHIMER_SETTINGS.chamaacElectricMistBrightness,
    )
  })

  it("normalizes Chamaac Astral Flow background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacAstralFlowPaletteMode: "harmony",
      chamaacAstralFlowPrimaryColor: "#a0769a",
      chamaacAstralFlowHarmony: "triad",
      chamaacAstralFlowColorOne: "#05070a",
      chamaacAstralFlowColorTwo: "purple",
      chamaacAstralFlowColorThree: "#a0769a",
      chamaacAstralFlowSpeed: 99,
      chamaacAstralFlowFlowMin: 0,
      chamaacAstralFlowFlowMax: 99,
    })

    assert.equal(settings.chamaacAstralFlowPaletteMode, "harmony")
    assert.equal(settings.chamaacAstralFlowPrimaryColor, "#A0769A")
    assert.equal(settings.chamaacAstralFlowHarmony, "triad")
    assert.equal(settings.chamaacAstralFlowColorOne, "#05070A")
    assert.equal(settings.chamaacAstralFlowColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowColorTwo)
    assert.equal(settings.chamaacAstralFlowColorThree, "#A0769A")
    assert.equal(settings.chamaacAstralFlowSpeed, 3)
    assert.equal(settings.chamaacAstralFlowFlowMin, 0.5)
    assert.equal(settings.chamaacAstralFlowFlowMax, 12)
    assert.equal(
      sanitizeChimerSettings({ chamaacAstralFlowSpeed: "fast" }).chamaacAstralFlowSpeed,
      DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowSpeed,
    )
    assert.equal(sanitizeChimerSettings({ chamaacAstralFlowSpeed: 0 }).chamaacAstralFlowSpeed, 0.1)
    assert.equal(
      sanitizeChimerSettings({ chamaacAstralFlowPaletteMode: "demo" }).chamaacAstralFlowPaletteMode,
      DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacAstralFlowPrimaryColor: "mauve" }).chamaacAstralFlowPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacAstralFlowHarmony: "rainbow" }).chamaacAstralFlowHarmony,
      DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowHarmony,
    )
  })

  it("normalizes Chamaac Deep Space Nebula background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacDeepSpaceNebulaPaletteMode: "harmony",
      chamaacDeepSpaceNebulaPrimaryColor: "#763b65",
      chamaacDeepSpaceNebulaHarmony: "triad",
      chamaacDeepSpaceNebulaColorOne: "#5efff4",
      chamaacDeepSpaceNebulaColorTwo: "purple",
      chamaacDeepSpaceNebulaColorThree: "#1a0b2e",
      chamaacDeepSpaceNebulaSpeed: 99,
    })

    assert.equal(settings.chamaacDeepSpaceNebulaPaletteMode, "harmony")
    assert.equal(settings.chamaacDeepSpaceNebulaPrimaryColor, "#763B65")
    assert.equal(settings.chamaacDeepSpaceNebulaHarmony, "triad")
    assert.equal(settings.chamaacDeepSpaceNebulaColorOne, "#5EFFF4")
    assert.equal(settings.chamaacDeepSpaceNebulaColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaColorTwo)
    assert.equal(settings.chamaacDeepSpaceNebulaColorThree, "#1A0B2E")
    assert.equal(settings.chamaacDeepSpaceNebulaSpeed, 5)
    assert.equal(
      sanitizeChimerSettings({ chamaacDeepSpaceNebulaSpeed: "fast" }).chamaacDeepSpaceNebulaSpeed,
      DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaSpeed,
    )
    assert.equal(sanitizeChimerSettings({ chamaacDeepSpaceNebulaSpeed: 0 }).chamaacDeepSpaceNebulaSpeed, 0.1)
    assert.equal(
      sanitizeChimerSettings({ chamaacDeepSpaceNebulaPaletteMode: "demo" }).chamaacDeepSpaceNebulaPaletteMode,
      DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacDeepSpaceNebulaPrimaryColor: "mauve" }).chamaacDeepSpaceNebulaPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacDeepSpaceNebulaHarmony: "rainbow" }).chamaacDeepSpaceNebulaHarmony,
      DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaHarmony,
    )
  })

  it("normalizes Chamaac Grid Bloom background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacGridBloomColor: "#e040fb",
      chamaacGridBloomSpeed: 99,
      chamaacGridBloomGridScale: 99,
      chamaacGridBloomRotationSpeed: -99,
      chamaacGridBloomFadeFalloff: 0,
      chamaacGridBloomDistortionAmount: 99,
      chamaacGridBloomFlowSpeedX: -99,
      chamaacGridBloomFlowSpeedY: 99,
    })

    assert.equal(settings.chamaacGridBloomColor, "#E040FB")
    assert.equal(settings.chamaacGridBloomSpeed, 3)
    assert.equal(settings.chamaacGridBloomGridScale, 32)
    assert.equal(settings.chamaacGridBloomRotationSpeed, -3)
    assert.equal(settings.chamaacGridBloomFadeFalloff, 1)
    assert.equal(settings.chamaacGridBloomDistortionAmount, 0.5)
    assert.equal(settings.chamaacGridBloomFlowSpeedX, -2)
    assert.equal(settings.chamaacGridBloomFlowSpeedY, 2)
    assert.equal(
      sanitizeChimerSettings({ chamaacGridBloomColor: "purple" }).chamaacGridBloomColor,
      DEFAULT_CHIMER_SETTINGS.chamaacGridBloomColor,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacGridBloomSpeed: "fast" }).chamaacGridBloomSpeed,
      DEFAULT_CHIMER_SETTINGS.chamaacGridBloomSpeed,
    )
    assert.equal(sanitizeChimerSettings({ chamaacGridBloomSpeed: 0 }).chamaacGridBloomSpeed, 0.1)
    assert.equal(
      sanitizeChimerSettings({ chamaacGridBloomGridScale: "dense" }).chamaacGridBloomGridScale,
      DEFAULT_CHIMER_SETTINGS.chamaacGridBloomGridScale,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacGridBloomDistortionAmount: "warp" }).chamaacGridBloomDistortionAmount,
      DEFAULT_CHIMER_SETTINGS.chamaacGridBloomDistortionAmount,
    )
  })

  it("normalizes Chamaac Liquid Chrome background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacLiquidChromePaletteMode: "harmony",
      chamaacLiquidChromePrimaryColor: "#c0c0c0",
      chamaacLiquidChromeHarmony: "triad",
      chamaacLiquidChromeColorOne: "#c0c0c0",
      chamaacLiquidChromeColorTwo: "silver",
      chamaacLiquidChromeFlowSpeed: 99,
      chamaacLiquidChromeTimeScale: 99,
    })

    assert.equal(settings.chamaacLiquidChromePaletteMode, "harmony")
    assert.equal(settings.chamaacLiquidChromePrimaryColor, "#C0C0C0")
    assert.equal(settings.chamaacLiquidChromeHarmony, "triad")
    assert.equal(settings.chamaacLiquidChromeColorOne, "#C0C0C0")
    assert.equal(settings.chamaacLiquidChromeColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeColorTwo)
    assert.equal(settings.chamaacLiquidChromeFlowSpeed, 2)
    assert.equal(settings.chamaacLiquidChromeTimeScale, 1)
    assert.equal(
      sanitizeChimerSettings({ chamaacLiquidChromeFlowSpeed: "fast" }).chamaacLiquidChromeFlowSpeed,
      DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeFlowSpeed,
    )
    assert.equal(sanitizeChimerSettings({ chamaacLiquidChromeFlowSpeed: 0 }).chamaacLiquidChromeFlowSpeed, 0.01)
    assert.equal(
      sanitizeChimerSettings({ chamaacLiquidChromeTimeScale: "warp" }).chamaacLiquidChromeTimeScale,
      DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeTimeScale,
    )
    assert.equal(sanitizeChimerSettings({ chamaacLiquidChromeTimeScale: 0 }).chamaacLiquidChromeTimeScale, 0.001)
    assert.equal(
      sanitizeChimerSettings({ chamaacLiquidChromePaletteMode: "demo" }).chamaacLiquidChromePaletteMode,
      DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromePaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacLiquidChromeHarmony: "rainbow" }).chamaacLiquidChromeHarmony,
      DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeHarmony,
    )
  })

  it("normalizes Chamaac Waves background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacWavesPaletteMode: "harmony",
      chamaacWavesPrimaryColor: "#071697",
      chamaacWavesHarmony: "triad",
      chamaacWavesBackgroundColor: "#000000",
      chamaacWavesColorOne: "#071697",
      chamaacWavesColorTwo: "#00d4ff",
      chamaacWavesColorThree: "black",
      chamaacWavesSpeedX: 9,
      chamaacWavesSpeedY: 0,
      chamaacWavesAmplitude: 128,
    })

    assert.equal(settings.chamaacWavesPaletteMode, "harmony")
    assert.equal(settings.chamaacWavesPrimaryColor, "#071697")
    assert.equal(settings.chamaacWavesHarmony, "triad")
    assert.equal(settings.chamaacWavesBackgroundColor, "#000000")
    assert.equal(settings.chamaacWavesColorOne, "#071697")
    assert.equal(settings.chamaacWavesColorTwo, "#00D4FF")
    assert.equal(settings.chamaacWavesColorThree, DEFAULT_CHIMER_SETTINGS.chamaacWavesColorThree)
    assert.equal(settings.chamaacWavesSpeedX, 0.1)
    assert.equal(settings.chamaacWavesSpeedY, 0.001)
    assert.equal(settings.chamaacWavesAmplitude, 64)
    assert.equal(
      sanitizeChimerSettings({ chamaacWavesSpeedX: "fast" }).chamaacWavesSpeedX,
      DEFAULT_CHIMER_SETTINGS.chamaacWavesSpeedX,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacWavesSpeedY: "fast" }).chamaacWavesSpeedY,
      DEFAULT_CHIMER_SETTINGS.chamaacWavesSpeedY,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacWavesAmplitude: "big" }).chamaacWavesAmplitude,
      DEFAULT_CHIMER_SETTINGS.chamaacWavesAmplitude,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacWavesPaletteMode: "demo" }).chamaacWavesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.chamaacWavesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacWavesPrimaryColor: "blue" }).chamaacWavesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.chamaacWavesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacWavesHarmony: "rainbow" }).chamaacWavesHarmony,
      DEFAULT_CHIMER_SETTINGS.chamaacWavesHarmony,
    )
  })

  it("normalizes React Bits Ferrofluid background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsFerrofluidPaletteMode: "harmony",
      reactBitsFerrofluidPrimaryColor: "#ffffff",
      reactBitsFerrofluidHarmony: "triad",
      reactBitsFerrofluidColorOne: "#010203",
      reactBitsFerrofluidColorTwo: "#aabbcc",
      reactBitsFerrofluidColorThree: "white",
      reactBitsFerrofluidSpeed: 9,
      reactBitsFerrofluidScale: 9,
      reactBitsFerrofluidTurbulence: -1,
      reactBitsFerrofluidFluidity: 0,
      reactBitsFerrofluidRimWidth: 9,
      reactBitsFerrofluidSharpness: 9,
      reactBitsFerrofluidShimmer: 9,
      reactBitsFerrofluidGlow: 0,
      reactBitsFerrofluidFlowDirection: "left",
      reactBitsFerrofluidOpacity: 0,
    })

    assert.equal(settings.reactBitsFerrofluidPaletteMode, "harmony")
    assert.equal(settings.reactBitsFerrofluidPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsFerrofluidHarmony, "triad")
    assert.equal(settings.reactBitsFerrofluidColorOne, "#010203")
    assert.equal(settings.reactBitsFerrofluidColorTwo, "#AABBCC")
    assert.equal(settings.reactBitsFerrofluidColorThree, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidColorThree)
    assert.equal(settings.reactBitsFerrofluidSpeed, 2)
    assert.equal(settings.reactBitsFerrofluidScale, 4)
    assert.equal(settings.reactBitsFerrofluidTurbulence, 0)
    assert.equal(settings.reactBitsFerrofluidFluidity, 0.001)
    assert.equal(settings.reactBitsFerrofluidRimWidth, 0.5)
    assert.equal(settings.reactBitsFerrofluidSharpness, 6)
    assert.equal(settings.reactBitsFerrofluidShimmer, 4)
    assert.equal(settings.reactBitsFerrofluidGlow, 0.1)
    assert.equal(settings.reactBitsFerrofluidFlowDirection, "left")
    assert.equal(settings.reactBitsFerrofluidOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidSpeed: "fast" }).reactBitsFerrofluidSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidScale: "large" }).reactBitsFerrofluidScale,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidScale,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidTurbulence: "storm" }).reactBitsFerrofluidTurbulence,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidTurbulence,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidFluidity: "thin" }).reactBitsFerrofluidFluidity,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidFluidity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidRimWidth: "wide" }).reactBitsFerrofluidRimWidth,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidRimWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidSharpness: "crisp" }).reactBitsFerrofluidSharpness,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidSharpness,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidShimmer: "bright" }).reactBitsFerrofluidShimmer,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidShimmer,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidGlow: "bright" }).reactBitsFerrofluidGlow,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidFlowDirection: "diagonal" }).reactBitsFerrofluidFlowDirection,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidFlowDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidOpacity: "clear" }).reactBitsFerrofluidOpacity,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidOpacity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidPaletteMode: "demo" }).reactBitsFerrofluidPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidPrimaryColor: "white" }).reactBitsFerrofluidPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFerrofluidHarmony: "rainbow" }).reactBitsFerrofluidHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidHarmony,
    )
  })

  it("normalizes React Bits Lightfall background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsLightfallPaletteMode: "harmony",
      reactBitsLightfallPrimaryColor: "#a6c8ff",
      reactBitsLightfallHarmony: "triad",
      reactBitsLightfallColorOne: "#010203",
      reactBitsLightfallColorTwo: "#aabbcc",
      reactBitsLightfallColorThree: "white",
      reactBitsLightfallBackgroundColor: "#0a29ff",
      reactBitsLightfallSpeed: 9,
      reactBitsLightfallStreakCount: 99,
      reactBitsLightfallStreakWidth: 0,
      reactBitsLightfallStreakLength: 9,
      reactBitsLightfallGlow: 0,
      reactBitsLightfallDensity: 0,
      reactBitsLightfallTwinkle: 9,
      reactBitsLightfallZoom: 99,
      reactBitsLightfallBackgroundGlow: 99,
      reactBitsLightfallOpacity: 0,
      reactBitsLightfallCursorEnabled: true,
      reactBitsLightfallCursorStrength: 9,
      reactBitsLightfallCursorRadius: 0,
      reactBitsLightfallCursorDampening: 9,
    })

    assert.equal(settings.reactBitsLightfallPaletteMode, "harmony")
    assert.equal(settings.reactBitsLightfallPrimaryColor, "#A6C8FF")
    assert.equal(settings.reactBitsLightfallHarmony, "triad")
    assert.equal(settings.reactBitsLightfallColorOne, "#010203")
    assert.equal(settings.reactBitsLightfallColorTwo, "#AABBCC")
    assert.equal(settings.reactBitsLightfallColorThree, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallColorThree)
    assert.equal(settings.reactBitsLightfallBackgroundColor, "#0A29FF")
    assert.equal(settings.reactBitsLightfallSpeed, 2)
    assert.equal(settings.reactBitsLightfallStreakCount, 16)
    assert.equal(settings.reactBitsLightfallStreakWidth, 0.2)
    assert.equal(settings.reactBitsLightfallStreakLength, 3)
    assert.equal(settings.reactBitsLightfallGlow, 0.1)
    assert.equal(settings.reactBitsLightfallDensity, 0.05)
    assert.equal(settings.reactBitsLightfallTwinkle, 1)
    assert.equal(settings.reactBitsLightfallZoom, 6)
    assert.equal(settings.reactBitsLightfallBackgroundGlow, 1.5)
    assert.equal(settings.reactBitsLightfallOpacity, 0.05)
    assert.equal(settings.reactBitsLightfallCursorEnabled, true)
    assert.equal(settings.reactBitsLightfallCursorStrength, 2)
    assert.equal(settings.reactBitsLightfallCursorRadius, 0.05)
    assert.equal(settings.reactBitsLightfallCursorDampening, 1)
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallSpeed: "fast" }).reactBitsLightfallSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallStreakCount: "many" }).reactBitsLightfallStreakCount,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakCount,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallStreakWidth: "wide" }).reactBitsLightfallStreakWidth,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallStreakLength: "long" }).reactBitsLightfallStreakLength,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakLength,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallGlow: "bright" }).reactBitsLightfallGlow,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallDensity: "dense" }).reactBitsLightfallDensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallDensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallTwinkle: "sparkly" }).reactBitsLightfallTwinkle,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallTwinkle,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallZoom: "close" }).reactBitsLightfallZoom,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallZoom,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallBackgroundGlow: "bright" }).reactBitsLightfallBackgroundGlow,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallBackgroundGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallOpacity: "clear" }).reactBitsLightfallOpacity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallOpacity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallCursorEnabled: "yes" }).reactBitsLightfallCursorEnabled,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorEnabled,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallCursorStrength: "strong" }).reactBitsLightfallCursorStrength,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorStrength,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallCursorRadius: "wide" }).reactBitsLightfallCursorRadius,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorRadius,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallCursorDampening: "smooth" }).reactBitsLightfallCursorDampening,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorDampening,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallPaletteMode: "demo" }).reactBitsLightfallPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallPrimaryColor: "blue" }).reactBitsLightfallPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallHarmony: "rainbow" }).reactBitsLightfallHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightfallBackgroundColor: "blue" }).reactBitsLightfallBackgroundColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallBackgroundColor,
    )
  })

  it("normalizes React Bits Liquid Ether background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsLiquidEtherPaletteMode: "harmony",
      reactBitsLiquidEtherPrimaryColor: "#5227ff",
      reactBitsLiquidEtherHarmony: "triad",
      reactBitsLiquidEtherColorOne: "#010203",
      reactBitsLiquidEtherColorTwo: "#aabbcc",
      reactBitsLiquidEtherColorThree: "white",
      reactBitsLiquidEtherCursorEnabled: true,
      reactBitsLiquidEtherMouseForce: 999,
      reactBitsLiquidEtherCursorSize: 0,
      reactBitsLiquidEtherIsViscous: true,
      reactBitsLiquidEtherViscous: 999,
      reactBitsLiquidEtherIterationsViscous: 99.9,
      reactBitsLiquidEtherIterationsPoisson: 0,
      reactBitsLiquidEtherDt: 0,
      reactBitsLiquidEtherBfecc: false,
      reactBitsLiquidEtherResolution: 99,
      reactBitsLiquidEtherIsBounce: true,
      reactBitsLiquidEtherAutoDemo: false,
      reactBitsLiquidEtherAutoSpeed: 99,
      reactBitsLiquidEtherAutoIntensity: -1,
      reactBitsLiquidEtherAutoResumeDelay: 1,
      reactBitsLiquidEtherAutoRampDuration: 9,
      reactBitsLiquidEtherOpacity: 0,
    })

    assert.equal(settings.reactBitsLiquidEtherPaletteMode, "harmony")
    assert.equal(settings.reactBitsLiquidEtherPrimaryColor, "#5227FF")
    assert.equal(settings.reactBitsLiquidEtherHarmony, "triad")
    assert.equal(settings.reactBitsLiquidEtherColorOne, "#010203")
    assert.equal(settings.reactBitsLiquidEtherColorTwo, "#AABBCC")
    assert.equal(settings.reactBitsLiquidEtherColorThree, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherColorThree)
    assert.equal(settings.reactBitsLiquidEtherCursorEnabled, true)
    assert.equal(settings.reactBitsLiquidEtherMouseForce, 80)
    assert.equal(settings.reactBitsLiquidEtherCursorSize, 20)
    assert.equal(settings.reactBitsLiquidEtherIsViscous, true)
    assert.equal(settings.reactBitsLiquidEtherViscous, 80)
    assert.equal(settings.reactBitsLiquidEtherIterationsViscous, 64)
    assert.equal(settings.reactBitsLiquidEtherIterationsPoisson, 4)
    assert.equal(settings.reactBitsLiquidEtherDt, 0.004)
    assert.equal(settings.reactBitsLiquidEtherBfecc, false)
    assert.equal(settings.reactBitsLiquidEtherResolution, 1)
    assert.equal(settings.reactBitsLiquidEtherIsBounce, true)
    assert.equal(settings.reactBitsLiquidEtherAutoDemo, false)
    assert.equal(settings.reactBitsLiquidEtherAutoSpeed, 2)
    assert.equal(settings.reactBitsLiquidEtherAutoIntensity, 0)
    assert.equal(settings.reactBitsLiquidEtherAutoResumeDelay, 250)
    assert.equal(settings.reactBitsLiquidEtherAutoRampDuration, 3)
    assert.equal(settings.reactBitsLiquidEtherOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherMouseForce: "strong" }).reactBitsLiquidEtherMouseForce,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherMouseForce,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherCursorSize: "wide" }).reactBitsLiquidEtherCursorSize,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherCursorSize,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherIsViscous: "yes" }).reactBitsLiquidEtherIsViscous,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIsViscous,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherViscous: "thick" }).reactBitsLiquidEtherViscous,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherViscous,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherIterationsViscous: "many" })
        .reactBitsLiquidEtherIterationsViscous,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIterationsViscous,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherIterationsPoisson: "many" })
        .reactBitsLiquidEtherIterationsPoisson,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIterationsPoisson,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherDt: "fast" }).reactBitsLiquidEtherDt,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherDt,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherBfecc: "yes" }).reactBitsLiquidEtherBfecc,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherBfecc,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherResolution: "sharp" }).reactBitsLiquidEtherResolution,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherResolution,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherIsBounce: "yes" }).reactBitsLiquidEtherIsBounce,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIsBounce,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherAutoDemo: "yes" }).reactBitsLiquidEtherAutoDemo,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoDemo,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherAutoSpeed: "fast" }).reactBitsLiquidEtherAutoSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherAutoIntensity: "strong" }).reactBitsLiquidEtherAutoIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherAutoResumeDelay: "soon" })
        .reactBitsLiquidEtherAutoResumeDelay,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoResumeDelay,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherAutoRampDuration: "slow" })
        .reactBitsLiquidEtherAutoRampDuration,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoRampDuration,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherOpacity: "clear" }).reactBitsLiquidEtherOpacity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherOpacity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherPaletteMode: "demo" }).reactBitsLiquidEtherPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherPrimaryColor: "purple" }).reactBitsLiquidEtherPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLiquidEtherHarmony: "rainbow" }).reactBitsLiquidEtherHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherHarmony,
    )
  })

  it("normalizes React Bits Prism background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsPrismHeight: 99,
      reactBitsPrismBaseWidth: 0,
      reactBitsPrismAnimationType: "hover",
      reactBitsPrismGlow: 99,
      reactBitsPrismOffsetX: -999,
      reactBitsPrismOffsetY: 999,
      reactBitsPrismNoise: -1,
      reactBitsPrismTransparent: false,
      reactBitsPrismScale: 99,
      reactBitsPrismHueShift: 99,
      reactBitsPrismColorFrequency: 0,
      reactBitsPrismHoverStrength: 99,
      reactBitsPrismInertia: 0,
      reactBitsPrismBloom: 99,
      reactBitsPrismTimeScale: 99,
    })

    assert.equal(settings.reactBitsPrismHeight, 8)
    assert.equal(settings.reactBitsPrismBaseWidth, 0.5)
    assert.equal(settings.reactBitsPrismAnimationType, "hover")
    assert.equal(settings.reactBitsPrismGlow, 3)
    assert.equal(settings.reactBitsPrismOffsetX, -400)
    assert.equal(settings.reactBitsPrismOffsetY, 400)
    assert.equal(settings.reactBitsPrismNoise, 0)
    assert.equal(settings.reactBitsPrismTransparent, false)
    assert.equal(settings.reactBitsPrismScale, 7)
    assert.equal(settings.reactBitsPrismHueShift, Math.PI)
    assert.equal(settings.reactBitsPrismColorFrequency, 0.1)
    assert.equal(settings.reactBitsPrismHoverStrength, 4)
    assert.equal(settings.reactBitsPrismInertia, 0.01)
    assert.equal(settings.reactBitsPrismBloom, 3)
    assert.equal(settings.reactBitsPrismTimeScale, 2)
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismHeight: "tall" }).reactBitsPrismHeight,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismHeight,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismBaseWidth: "wide" }).reactBitsPrismBaseWidth,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismBaseWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismAnimationType: "orbit" }).reactBitsPrismAnimationType,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismAnimationType,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismGlow: "bright" }).reactBitsPrismGlow,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismGlow,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismOffsetX: "left" }).reactBitsPrismOffsetX,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismOffsetX,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismOffsetY: "up" }).reactBitsPrismOffsetY,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismOffsetY,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismNoise: "grainy" }).reactBitsPrismNoise,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismNoise,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismTransparent: "yes" }).reactBitsPrismTransparent,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismTransparent,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismScale: "large" }).reactBitsPrismScale,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismScale,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismHueShift: "purple" }).reactBitsPrismHueShift,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismHueShift,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismColorFrequency: "many" }).reactBitsPrismColorFrequency,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismColorFrequency,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismHoverStrength: "strong" }).reactBitsPrismHoverStrength,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismHoverStrength,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismInertia: "slow" }).reactBitsPrismInertia,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismInertia,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismBloom: "bright" }).reactBitsPrismBloom,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismBloom,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismTimeScale: "fast" }).reactBitsPrismTimeScale,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismTimeScale,
    )
  })

  it("normalizes React Bits Dark Veil background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsDarkVeilHueShift: 999,
      reactBitsDarkVeilNoiseIntensity: 99,
      reactBitsDarkVeilScanlineIntensity: -1,
      reactBitsDarkVeilSpeed: 99,
      reactBitsDarkVeilScanlineFrequency: 99,
      reactBitsDarkVeilWarpAmount: -1,
      reactBitsDarkVeilResolutionScale: 0,
    })

    assert.equal(settings.reactBitsDarkVeilHueShift, 180)
    assert.equal(settings.reactBitsDarkVeilNoiseIntensity, 1)
    assert.equal(settings.reactBitsDarkVeilScanlineIntensity, 0)
    assert.equal(settings.reactBitsDarkVeilSpeed, 2)
    assert.equal(settings.reactBitsDarkVeilScanlineFrequency, 40)
    assert.equal(settings.reactBitsDarkVeilWarpAmount, 0)
    assert.equal(settings.reactBitsDarkVeilResolutionScale, 0.25)
    assert.equal(
      sanitizeChimerSettings({ reactBitsDarkVeilHueShift: "purple" }).reactBitsDarkVeilHueShift,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilHueShift,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDarkVeilNoiseIntensity: "grainy" }).reactBitsDarkVeilNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilNoiseIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDarkVeilScanlineIntensity: "strong" })
        .reactBitsDarkVeilScanlineIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilScanlineIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDarkVeilSpeed: "fast" }).reactBitsDarkVeilSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDarkVeilScanlineFrequency: "dense" })
        .reactBitsDarkVeilScanlineFrequency,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilScanlineFrequency,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDarkVeilWarpAmount: "warped" }).reactBitsDarkVeilWarpAmount,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilWarpAmount,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDarkVeilResolutionScale: "sharp" })
        .reactBitsDarkVeilResolutionScale,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilResolutionScale,
    )
  })

  it("normalizes React Bits Light Pillar background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsLightPillarPaletteMode: "harmony",
      reactBitsLightPillarPrimaryColor: "#123456",
      reactBitsLightPillarHarmony: "triad",
      reactBitsLightPillarTopColor: "#abcdef",
      reactBitsLightPillarBottomColor: "#fedcba",
      reactBitsLightPillarIntensity: 99,
      reactBitsLightPillarRotationSpeed: -1,
      reactBitsLightPillarInteractive: true,
      reactBitsLightPillarGlowAmount: 99,
      reactBitsLightPillarWidth: 0,
      reactBitsLightPillarHeight: 99,
      reactBitsLightPillarNoiseIntensity: -1,
      reactBitsLightPillarBlendMode: "normal",
      reactBitsLightPillarRotation: 999,
      reactBitsLightPillarQuality: "low",
    })

    assert.equal(settings.reactBitsLightPillarPaletteMode, "harmony")
    assert.equal(settings.reactBitsLightPillarPrimaryColor, "#123456")
    assert.equal(settings.reactBitsLightPillarHarmony, "triad")
    assert.equal(settings.reactBitsLightPillarTopColor, "#ABCDEF")
    assert.equal(settings.reactBitsLightPillarBottomColor, "#FEDCBA")
    assert.equal(settings.reactBitsLightPillarIntensity, 3)
    assert.equal(settings.reactBitsLightPillarRotationSpeed, 0)
    assert.equal(settings.reactBitsLightPillarInteractive, true)
    assert.equal(settings.reactBitsLightPillarGlowAmount, 0.03)
    assert.equal(settings.reactBitsLightPillarWidth, 0.5)
    assert.equal(settings.reactBitsLightPillarHeight, 2)
    assert.equal(settings.reactBitsLightPillarNoiseIntensity, 0)
    assert.equal(settings.reactBitsLightPillarBlendMode, "normal")
    assert.equal(settings.reactBitsLightPillarRotation, 180)
    assert.equal(settings.reactBitsLightPillarQuality, "low")
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarPaletteMode: "auto" }).reactBitsLightPillarPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarPrimaryColor: "purple" }).reactBitsLightPillarPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarHarmony: "wild" }).reactBitsLightPillarHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarTopColor: "violet" }).reactBitsLightPillarTopColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarTopColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarBottomColor: "pink" }).reactBitsLightPillarBottomColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarBottomColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarIntensity: "bright" }).reactBitsLightPillarIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarRotationSpeed: "fast" }).reactBitsLightPillarRotationSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarRotationSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarInteractive: "yes" }).reactBitsLightPillarInteractive,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarInteractive,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarGlowAmount: "glow" }).reactBitsLightPillarGlowAmount,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarGlowAmount,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarWidth: "wide" }).reactBitsLightPillarWidth,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarWidth,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarHeight: "tall" }).reactBitsLightPillarHeight,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarHeight,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarNoiseIntensity: "grainy" })
        .reactBitsLightPillarNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarNoiseIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarBlendMode: "multiply" }).reactBitsLightPillarBlendMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarBlendMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarRotation: "tilted" }).reactBitsLightPillarRotation,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarRotation,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightPillarQuality: "ultra" }).reactBitsLightPillarQuality,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarQuality,
    )
  })

  it("normalizes React Bits Silk background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsSilkPaletteMode: "harmony",
      reactBitsSilkPrimaryColor: "#123456",
      reactBitsSilkHarmony: "triad",
      reactBitsSilkColor: "#abcdef",
      reactBitsSilkSpeed: 99,
      reactBitsSilkScale: 0,
      reactBitsSilkNoiseIntensity: 99,
      reactBitsSilkRotation: 99,
    })

    assert.equal(settings.reactBitsSilkPaletteMode, "harmony")
    assert.equal(settings.reactBitsSilkPrimaryColor, "#123456")
    assert.equal(settings.reactBitsSilkHarmony, "triad")
    assert.equal(settings.reactBitsSilkColor, "#ABCDEF")
    assert.equal(settings.reactBitsSilkSpeed, 10)
    assert.equal(settings.reactBitsSilkScale, 0.2)
    assert.equal(settings.reactBitsSilkNoiseIntensity, 4)
    assert.equal(settings.reactBitsSilkRotation, Math.PI)
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkPaletteMode: "auto" }).reactBitsSilkPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkPrimaryColor: "purple" }).reactBitsSilkPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkHarmony: "wild" }).reactBitsSilkHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkColor: "violet" }).reactBitsSilkColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkSpeed: "fast" }).reactBitsSilkSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkScale: "large" }).reactBitsSilkScale,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkScale,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkNoiseIntensity: "grainy" }).reactBitsSilkNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkNoiseIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSilkRotation: "tilted" }).reactBitsSilkRotation,
      DEFAULT_CHIMER_SETTINGS.reactBitsSilkRotation,
    )
  })

  it("normalizes React Bits Floating Lines background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsFloatingLinesPaletteMode: "harmony",
      reactBitsFloatingLinesPrimaryColor: "#123456",
      reactBitsFloatingLinesHarmony: "triad",
      reactBitsFloatingLinesColorOne: "#abcdef",
      reactBitsFloatingLinesColorTwo: "#fedcba",
      reactBitsFloatingLinesColorThree: "#010203",
      reactBitsFloatingLinesEnableTop: false,
      reactBitsFloatingLinesEnableMiddle: false,
      reactBitsFloatingLinesEnableBottom: true,
      reactBitsFloatingLinesTopLineCount: 99,
      reactBitsFloatingLinesMiddleLineCount: -1,
      reactBitsFloatingLinesBottomLineCount: 8,
      reactBitsFloatingLinesTopLineDistance: 0,
      reactBitsFloatingLinesMiddleLineDistance: 99,
      reactBitsFloatingLinesBottomLineDistance: 4.5,
      reactBitsFloatingLinesTopWaveX: 99,
      reactBitsFloatingLinesTopWaveY: -99,
      reactBitsFloatingLinesTopWaveRotate: 99,
      reactBitsFloatingLinesMiddleWaveX: -99,
      reactBitsFloatingLinesMiddleWaveY: 99,
      reactBitsFloatingLinesMiddleWaveRotate: -99,
      reactBitsFloatingLinesBottomWaveX: 1.5,
      reactBitsFloatingLinesBottomWaveY: -1.5,
      reactBitsFloatingLinesBottomWaveRotate: 0.75,
      reactBitsFloatingLinesAnimationSpeed: 99,
      reactBitsFloatingLinesInteractive: false,
      reactBitsFloatingLinesBendRadius: 99,
      reactBitsFloatingLinesBendStrength: -99,
      reactBitsFloatingLinesMouseDamping: 99,
      reactBitsFloatingLinesParallax: false,
      reactBitsFloatingLinesParallaxStrength: 99,
      reactBitsFloatingLinesBlendMode: "normal",
    })

    assert.equal(settings.reactBitsFloatingLinesPaletteMode, "harmony")
    assert.equal(settings.reactBitsFloatingLinesPrimaryColor, "#123456")
    assert.equal(settings.reactBitsFloatingLinesHarmony, "triad")
    assert.equal(settings.reactBitsFloatingLinesColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsFloatingLinesColorTwo, "#FEDCBA")
    assert.equal(settings.reactBitsFloatingLinesColorThree, "#010203")
    assert.equal(settings.reactBitsFloatingLinesEnableTop, false)
    assert.equal(settings.reactBitsFloatingLinesEnableMiddle, false)
    assert.equal(settings.reactBitsFloatingLinesEnableBottom, true)
    assert.equal(settings.reactBitsFloatingLinesTopLineCount, 32)
    assert.equal(settings.reactBitsFloatingLinesMiddleLineCount, 0)
    assert.equal(settings.reactBitsFloatingLinesBottomLineCount, 8)
    assert.equal(settings.reactBitsFloatingLinesTopLineDistance, 0.1)
    assert.equal(settings.reactBitsFloatingLinesMiddleLineDistance, 20)
    assert.equal(settings.reactBitsFloatingLinesBottomLineDistance, 4.5)
    assert.equal(settings.reactBitsFloatingLinesTopWaveX, 20)
    assert.equal(settings.reactBitsFloatingLinesTopWaveY, -4)
    assert.equal(settings.reactBitsFloatingLinesTopWaveRotate, 4)
    assert.equal(settings.reactBitsFloatingLinesMiddleWaveX, -20)
    assert.equal(settings.reactBitsFloatingLinesMiddleWaveY, 4)
    assert.equal(settings.reactBitsFloatingLinesMiddleWaveRotate, -4)
    assert.equal(settings.reactBitsFloatingLinesBottomWaveX, 1.5)
    assert.equal(settings.reactBitsFloatingLinesBottomWaveY, -1.5)
    assert.equal(settings.reactBitsFloatingLinesBottomWaveRotate, 0.75)
    assert.equal(settings.reactBitsFloatingLinesAnimationSpeed, 4)
    assert.equal(settings.reactBitsFloatingLinesInteractive, false)
    assert.equal(settings.reactBitsFloatingLinesBendRadius, 20)
    assert.equal(settings.reactBitsFloatingLinesBendStrength, -2)
    assert.equal(settings.reactBitsFloatingLinesMouseDamping, 1)
    assert.equal(settings.reactBitsFloatingLinesParallax, false)
    assert.equal(settings.reactBitsFloatingLinesParallaxStrength, 1)
    assert.equal(settings.reactBitsFloatingLinesBlendMode, "normal")
    assert.equal(
      sanitizeChimerSettings({ reactBitsFloatingLinesPaletteMode: "auto" }).reactBitsFloatingLinesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFloatingLinesPrimaryColor: "purple" }).reactBitsFloatingLinesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFloatingLinesHarmony: "wild" }).reactBitsFloatingLinesHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFloatingLinesBlendMode: "multiply" }).reactBitsFloatingLinesBlendMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBlendMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFloatingLinesAnimationSpeed: "fast" })
        .reactBitsFloatingLinesAnimationSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesAnimationSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFloatingLinesInteractive: "yes" }).reactBitsFloatingLinesInteractive,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesInteractive,
    )
  })

  it("normalizes React Bits Side Rays background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsSideRaysPaletteMode: "harmony",
      reactBitsSideRaysPrimaryColor: "#eab308",
      reactBitsSideRaysHarmony: "triad",
      reactBitsSideRaysColorOne: "#abcdef",
      reactBitsSideRaysColorTwo: "#fedcba",
      reactBitsSideRaysSpeed: 99,
      reactBitsSideRaysIntensity: 99,
      reactBitsSideRaysSpread: 0,
      reactBitsSideRaysOrigin: "bottom-left",
      reactBitsSideRaysTilt: -999,
      reactBitsSideRaysSaturation: 99,
      reactBitsSideRaysBlend: -1,
      reactBitsSideRaysFalloff: 99,
      reactBitsSideRaysOpacity: 2,
    })

    assert.equal(settings.reactBitsSideRaysPaletteMode, "harmony")
    assert.equal(settings.reactBitsSideRaysPrimaryColor, "#EAB308")
    assert.equal(settings.reactBitsSideRaysHarmony, "triad")
    assert.equal(settings.reactBitsSideRaysColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsSideRaysColorTwo, "#FEDCBA")
    assert.equal(settings.reactBitsSideRaysSpeed, 8)
    assert.equal(settings.reactBitsSideRaysIntensity, 6)
    assert.equal(settings.reactBitsSideRaysSpread, 0.1)
    assert.equal(settings.reactBitsSideRaysOrigin, "bottom-left")
    assert.equal(settings.reactBitsSideRaysTilt, -90)
    assert.equal(settings.reactBitsSideRaysSaturation, 3)
    assert.equal(settings.reactBitsSideRaysBlend, 0)
    assert.equal(settings.reactBitsSideRaysFalloff, 4)
    assert.equal(settings.reactBitsSideRaysOpacity, 1)
    assert.equal(
      sanitizeChimerSettings({ reactBitsSideRaysPaletteMode: "auto" }).reactBitsSideRaysPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSideRaysPrimaryColor: "yellow" }).reactBitsSideRaysPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSideRaysHarmony: "wild" }).reactBitsSideRaysHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSideRaysColorOne: "gold" }).reactBitsSideRaysColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSideRaysColorTwo: "blue" }).reactBitsSideRaysColorTwo,
      DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysColorTwo,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSideRaysOrigin: "center" }).reactBitsSideRaysOrigin,
      DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysOrigin,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSideRaysSpeed: "fast" }).reactBitsSideRaysSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysSpeed,
    )
  })

  it("normalizes React Bits Light Rays background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsLightRaysPaletteMode: "harmony",
      reactBitsLightRaysPrimaryColor: "#ffffff",
      reactBitsLightRaysHarmony: "triad",
      reactBitsLightRaysColor: "#abcdef",
      reactBitsLightRaysOrigin: "bottom-center",
      reactBitsLightRaysSpeed: 99,
      reactBitsLightRaysSpread: 0,
      reactBitsLightRaysLength: 99,
      reactBitsLightRaysPulsating: true,
      reactBitsLightRaysFadeDistance: 99,
      reactBitsLightRaysSaturation: 99,
      reactBitsLightRaysFollowMouse: true,
      reactBitsLightRaysMouseInfluence: -1,
      reactBitsLightRaysNoiseAmount: 99,
      reactBitsLightRaysDistortion: 99,
    })

    assert.equal(settings.reactBitsLightRaysPaletteMode, "harmony")
    assert.equal(settings.reactBitsLightRaysPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsLightRaysHarmony, "triad")
    assert.equal(settings.reactBitsLightRaysColor, "#ABCDEF")
    assert.equal(settings.reactBitsLightRaysOrigin, "bottom-center")
    assert.equal(settings.reactBitsLightRaysSpeed, 4)
    assert.equal(settings.reactBitsLightRaysSpread, 0.1)
    assert.equal(settings.reactBitsLightRaysLength, 5)
    assert.equal(settings.reactBitsLightRaysPulsating, true)
    assert.equal(settings.reactBitsLightRaysFadeDistance, 3)
    assert.equal(settings.reactBitsLightRaysSaturation, 3)
    assert.equal(settings.reactBitsLightRaysFollowMouse, true)
    assert.equal(settings.reactBitsLightRaysMouseInfluence, 0)
    assert.equal(settings.reactBitsLightRaysNoiseAmount, 1)
    assert.equal(settings.reactBitsLightRaysDistortion, 2)
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysPaletteMode: "auto" }).reactBitsLightRaysPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysPrimaryColor: "white" }).reactBitsLightRaysPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysHarmony: "wild" }).reactBitsLightRaysHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysColor: "white" }).reactBitsLightRaysColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysOrigin: "center" }).reactBitsLightRaysOrigin,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysOrigin,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysSpeed: "fast" }).reactBitsLightRaysSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysPulsating: "yes" }).reactBitsLightRaysPulsating,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysPulsating,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightRaysFollowMouse: "yes" }).reactBitsLightRaysFollowMouse,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysFollowMouse,
    )
  })

  it("normalizes React Bits Pixel Blast background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsPixelBlastPaletteMode: "harmony",
      reactBitsPixelBlastPrimaryColor: "#ffffff",
      reactBitsPixelBlastHarmony: "triad",
      reactBitsPixelBlastColor: "#abcdef",
      reactBitsPixelBlastVariant: "diamond",
      reactBitsPixelBlastPixelSize: 99,
      reactBitsPixelBlastAntialias: false,
      reactBitsPixelBlastPatternScale: 99,
      reactBitsPixelBlastPatternDensity: -1,
      reactBitsPixelBlastLiquid: true,
      reactBitsPixelBlastLiquidStrength: 99,
      reactBitsPixelBlastLiquidRadius: 99,
      reactBitsPixelBlastPixelSizeJitter: 99,
      reactBitsPixelBlastEnableRipples: false,
      reactBitsPixelBlastRippleIntensityScale: 99,
      reactBitsPixelBlastRippleThickness: 99,
      reactBitsPixelBlastRippleSpeed: 99,
      reactBitsPixelBlastLiquidWobbleSpeed: 99,
      reactBitsPixelBlastAutoPauseOffscreen: false,
      reactBitsPixelBlastSpeed: 99,
      reactBitsPixelBlastTransparent: false,
      reactBitsPixelBlastEdgeFade: 99,
      reactBitsPixelBlastNoiseAmount: 99,
    })

    assert.equal(settings.reactBitsPixelBlastPaletteMode, "harmony")
    assert.equal(settings.reactBitsPixelBlastPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsPixelBlastHarmony, "triad")
    assert.equal(settings.reactBitsPixelBlastColor, "#ABCDEF")
    assert.equal(settings.reactBitsPixelBlastVariant, "diamond")
    assert.equal(settings.reactBitsPixelBlastPixelSize, 16)
    assert.equal(settings.reactBitsPixelBlastAntialias, false)
    assert.equal(settings.reactBitsPixelBlastPatternScale, 8)
    assert.equal(settings.reactBitsPixelBlastPatternDensity, 0)
    assert.equal(settings.reactBitsPixelBlastLiquid, true)
    assert.equal(settings.reactBitsPixelBlastLiquidStrength, 0.4)
    assert.equal(settings.reactBitsPixelBlastLiquidRadius, 4)
    assert.equal(settings.reactBitsPixelBlastPixelSizeJitter, 1)
    assert.equal(settings.reactBitsPixelBlastEnableRipples, false)
    assert.equal(settings.reactBitsPixelBlastRippleIntensityScale, 4)
    assert.equal(settings.reactBitsPixelBlastRippleThickness, 0.5)
    assert.equal(settings.reactBitsPixelBlastRippleSpeed, 2)
    assert.equal(settings.reactBitsPixelBlastLiquidWobbleSpeed, 10)
    assert.equal(settings.reactBitsPixelBlastAutoPauseOffscreen, false)
    assert.equal(settings.reactBitsPixelBlastSpeed, 3)
    assert.equal(settings.reactBitsPixelBlastTransparent, false)
    assert.equal(settings.reactBitsPixelBlastEdgeFade, 1)
    assert.equal(settings.reactBitsPixelBlastNoiseAmount, 0.4)
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastPaletteMode: "auto" }).reactBitsPixelBlastPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastPrimaryColor: "white" }).reactBitsPixelBlastPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastHarmony: "wild" }).reactBitsPixelBlastHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastColor: "white" }).reactBitsPixelBlastColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastVariant: "hex" }).reactBitsPixelBlastVariant,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastVariant,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastSpeed: "fast" }).reactBitsPixelBlastSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastAntialias: "yes" }).reactBitsPixelBlastAntialias,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastAntialias,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastLiquid: "yes" }).reactBitsPixelBlastLiquid,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastLiquid,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastEnableRipples: "no" }).reactBitsPixelBlastEnableRipples,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastEnableRipples,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastAutoPauseOffscreen: "no" }).reactBitsPixelBlastAutoPauseOffscreen,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastAutoPauseOffscreen,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelBlastTransparent: "no" }).reactBitsPixelBlastTransparent,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelBlastTransparent,
    )
  })

  it("normalizes React Bits Color Bends background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsColorBendsPaletteMode: "harmony",
      reactBitsColorBendsPrimaryColor: "#ffffff",
      reactBitsColorBendsHarmony: "triad",
      reactBitsColorBendsColorOne: "#abcdef",
      reactBitsColorBendsColorTwo: "#123456",
      reactBitsColorBendsColorThree: "#654321",
      reactBitsColorBendsColorFour: "#010203",
      reactBitsColorBendsRotation: 999,
      reactBitsColorBendsSpeed: 99,
      reactBitsColorBendsTransparent: false,
      reactBitsColorBendsAutoRotate: 999,
      reactBitsColorBendsScale: 99,
      reactBitsColorBendsFrequency: 99,
      reactBitsColorBendsWarpStrength: 99,
      reactBitsColorBendsInteractive: true,
      reactBitsColorBendsMouseInfluence: 99,
      reactBitsColorBendsParallax: 99,
      reactBitsColorBendsNoise: 99,
      reactBitsColorBendsIterations: 99,
      reactBitsColorBendsIntensity: 99,
      reactBitsColorBendsBandWidth: 99,
    })

    assert.equal(settings.reactBitsColorBendsPaletteMode, "harmony")
    assert.equal(settings.reactBitsColorBendsPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsColorBendsHarmony, "triad")
    assert.equal(settings.reactBitsColorBendsColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsColorBendsColorTwo, "#123456")
    assert.equal(settings.reactBitsColorBendsColorThree, "#654321")
    assert.equal(settings.reactBitsColorBendsColorFour, "#010203")
    assert.equal(settings.reactBitsColorBendsRotation, 360)
    assert.equal(settings.reactBitsColorBendsSpeed, 3)
    assert.equal(settings.reactBitsColorBendsTransparent, false)
    assert.equal(settings.reactBitsColorBendsAutoRotate, 180)
    assert.equal(settings.reactBitsColorBendsScale, 4)
    assert.equal(settings.reactBitsColorBendsFrequency, 4)
    assert.equal(settings.reactBitsColorBendsWarpStrength, 3)
    assert.equal(settings.reactBitsColorBendsInteractive, true)
    assert.equal(settings.reactBitsColorBendsMouseInfluence, 3)
    assert.equal(settings.reactBitsColorBendsParallax, 2)
    assert.equal(settings.reactBitsColorBendsNoise, 1)
    assert.equal(settings.reactBitsColorBendsIterations, 5)
    assert.equal(settings.reactBitsColorBendsIntensity, 4)
    assert.equal(settings.reactBitsColorBendsBandWidth, 16)
    assert.equal(
      sanitizeChimerSettings({ reactBitsColorBendsPaletteMode: "auto" }).reactBitsColorBendsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsColorBendsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsColorBendsPrimaryColor: "white" }).reactBitsColorBendsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsColorBendsPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsColorBendsHarmony: "wild" }).reactBitsColorBendsHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsColorBendsHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsColorBendsColorOne: "white" }).reactBitsColorBendsColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsColorBendsColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsColorBendsSpeed: "fast" }).reactBitsColorBendsSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsColorBendsSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsColorBendsTransparent: "no" }).reactBitsColorBendsTransparent,
      DEFAULT_CHIMER_SETTINGS.reactBitsColorBendsTransparent,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsColorBendsInteractive: "yes" }).reactBitsColorBendsInteractive,
      DEFAULT_CHIMER_SETTINGS.reactBitsColorBendsInteractive,
    )
  })

  it("normalizes React Bits Evil Eye background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsEvilEyePaletteMode: "harmony",
      reactBitsEvilEyePrimaryColor: "#ffffff",
      reactBitsEvilEyeHarmony: "triad",
      reactBitsEvilEyeColor: "#abcdef",
      reactBitsEvilEyeBackgroundColor: "#010203",
      reactBitsEvilEyeIntensity: 99,
      reactBitsEvilEyePupilSize: 99,
      reactBitsEvilEyeIrisWidth: 99,
      reactBitsEvilEyeGlowIntensity: 99,
      reactBitsEvilEyeScale: 99,
      reactBitsEvilEyeNoiseScale: 99,
      reactBitsEvilEyePupilFollow: 99,
      reactBitsEvilEyeFlameSpeed: 99,
      reactBitsEvilEyeInteractive: true,
    })

    assert.equal(settings.reactBitsEvilEyePaletteMode, "harmony")
    assert.equal(settings.reactBitsEvilEyePrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsEvilEyeHarmony, "triad")
    assert.equal(settings.reactBitsEvilEyeColor, "#ABCDEF")
    assert.equal(settings.reactBitsEvilEyeBackgroundColor, "#010203")
    assert.equal(settings.reactBitsEvilEyeIntensity, 3)
    assert.equal(settings.reactBitsEvilEyePupilSize, 2)
    assert.equal(settings.reactBitsEvilEyeIrisWidth, 1)
    assert.equal(settings.reactBitsEvilEyeGlowIntensity, 1.5)
    assert.equal(settings.reactBitsEvilEyeScale, 2)
    assert.equal(settings.reactBitsEvilEyeNoiseScale, 4)
    assert.equal(settings.reactBitsEvilEyePupilFollow, 2)
    assert.equal(settings.reactBitsEvilEyeFlameSpeed, 3)
    assert.equal(settings.reactBitsEvilEyeInteractive, true)
    assert.equal(
      sanitizeChimerSettings({ reactBitsEvilEyePaletteMode: "auto" }).reactBitsEvilEyePaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsEvilEyePaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsEvilEyePrimaryColor: "white" }).reactBitsEvilEyePrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsEvilEyePrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsEvilEyeHarmony: "wild" }).reactBitsEvilEyeHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsEvilEyeHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsEvilEyeColor: "white" }).reactBitsEvilEyeColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsEvilEyeColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsEvilEyeBackgroundColor: "black" }).reactBitsEvilEyeBackgroundColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsEvilEyeBackgroundColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsEvilEyeFlameSpeed: "fast" }).reactBitsEvilEyeFlameSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsEvilEyeFlameSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsEvilEyeInteractive: "yes" }).reactBitsEvilEyeInteractive,
      DEFAULT_CHIMER_SETTINGS.reactBitsEvilEyeInteractive,
    )
  })

  it("normalizes React Bits Line Waves background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsLineWavesPaletteMode: "harmony",
      reactBitsLineWavesPrimaryColor: "#ffffff",
      reactBitsLineWavesHarmony: "triad",
      reactBitsLineWavesColorOne: "#abcdef",
      reactBitsLineWavesColorTwo: "#123456",
      reactBitsLineWavesColorThree: "#654321",
      reactBitsLineWavesSpeed: 99,
      reactBitsLineWavesInnerLineCount: 999,
      reactBitsLineWavesOuterLineCount: 999,
      reactBitsLineWavesWarpIntensity: 99,
      reactBitsLineWavesRotation: 999,
      reactBitsLineWavesEdgeFadeWidth: 99,
      reactBitsLineWavesColorCycleSpeed: 99,
      reactBitsLineWavesBrightness: 99,
      reactBitsLineWavesEnableMouseInteraction: true,
      reactBitsLineWavesMouseInfluence: 99,
    })

    assert.equal(settings.reactBitsLineWavesPaletteMode, "harmony")
    assert.equal(settings.reactBitsLineWavesPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsLineWavesHarmony, "triad")
    assert.equal(settings.reactBitsLineWavesColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsLineWavesColorTwo, "#123456")
    assert.equal(settings.reactBitsLineWavesColorThree, "#654321")
    assert.equal(settings.reactBitsLineWavesSpeed, 3)
    assert.equal(settings.reactBitsLineWavesInnerLineCount, 96)
    assert.equal(settings.reactBitsLineWavesOuterLineCount, 96)
    assert.equal(settings.reactBitsLineWavesWarpIntensity, 3)
    assert.equal(settings.reactBitsLineWavesRotation, 180)
    assert.equal(settings.reactBitsLineWavesEdgeFadeWidth, 1)
    assert.equal(settings.reactBitsLineWavesColorCycleSpeed, 4)
    assert.equal(settings.reactBitsLineWavesBrightness, 1.5)
    assert.equal(settings.reactBitsLineWavesEnableMouseInteraction, true)
    assert.equal(settings.reactBitsLineWavesMouseInfluence, 4)
    assert.equal(
      sanitizeChimerSettings({ reactBitsLineWavesPaletteMode: "auto" }).reactBitsLineWavesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLineWavesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLineWavesPrimaryColor: "white" }).reactBitsLineWavesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLineWavesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLineWavesHarmony: "wild" }).reactBitsLineWavesHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsLineWavesHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLineWavesColorOne: "white" }).reactBitsLineWavesColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsLineWavesColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLineWavesSpeed: "fast" }).reactBitsLineWavesSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsLineWavesSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLineWavesEnableMouseInteraction: "yes" }).reactBitsLineWavesEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsLineWavesEnableMouseInteraction,
    )
  })

  it("normalizes React Bits Radar background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsRadarPaletteMode: "harmony",
      reactBitsRadarPrimaryColor: "#ffffff",
      reactBitsRadarHarmony: "triad",
      reactBitsRadarColor: "#abcdef",
      reactBitsRadarBackgroundColor: "#010203",
      reactBitsRadarSpeed: 99,
      reactBitsRadarScale: 99,
      reactBitsRadarRingCount: 99,
      reactBitsRadarSpokeCount: 99,
      reactBitsRadarRingThickness: 99,
      reactBitsRadarSpokeThickness: 99,
      reactBitsRadarSweepSpeed: 99,
      reactBitsRadarSweepWidth: 99,
      reactBitsRadarSweepLobes: 99,
      reactBitsRadarFalloff: 99,
      reactBitsRadarBrightness: 99,
      reactBitsRadarEnableMouseInteraction: true,
      reactBitsRadarMouseInfluence: 99,
    })

    assert.equal(settings.reactBitsRadarPaletteMode, "harmony")
    assert.equal(settings.reactBitsRadarPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsRadarHarmony, "triad")
    assert.equal(settings.reactBitsRadarColor, "#ABCDEF")
    assert.equal(settings.reactBitsRadarBackgroundColor, "#010203")
    assert.equal(settings.reactBitsRadarSpeed, 3)
    assert.equal(settings.reactBitsRadarScale, 2)
    assert.equal(settings.reactBitsRadarRingCount, 40)
    assert.equal(settings.reactBitsRadarSpokeCount, 40)
    assert.equal(settings.reactBitsRadarRingThickness, 0.25)
    assert.equal(settings.reactBitsRadarSpokeThickness, 0.1)
    assert.equal(settings.reactBitsRadarSweepSpeed, 4)
    assert.equal(settings.reactBitsRadarSweepWidth, 12)
    assert.equal(settings.reactBitsRadarSweepLobes, 12)
    assert.equal(settings.reactBitsRadarFalloff, 8)
    assert.equal(settings.reactBitsRadarBrightness, 3)
    assert.equal(settings.reactBitsRadarEnableMouseInteraction, true)
    assert.equal(settings.reactBitsRadarMouseInfluence, 1)
    assert.equal(
      sanitizeChimerSettings({ reactBitsRadarPaletteMode: "auto" }).reactBitsRadarPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsRadarPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRadarPrimaryColor: "white" }).reactBitsRadarPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsRadarPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRadarHarmony: "wild" }).reactBitsRadarHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsRadarHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRadarColor: "white" }).reactBitsRadarColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsRadarColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRadarSpeed: "fast" }).reactBitsRadarSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsRadarSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRadarEnableMouseInteraction: "yes" }).reactBitsRadarEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsRadarEnableMouseInteraction,
    )
  })

  it("normalizes React Bits Soft Aurora background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsSoftAuroraPaletteMode: "harmony",
      reactBitsSoftAuroraPrimaryColor: "#ffffff",
      reactBitsSoftAuroraHarmony: "triad",
      reactBitsSoftAuroraColorOne: "#abcdef",
      reactBitsSoftAuroraColorTwo: "#010203",
      reactBitsSoftAuroraSpeed: 99,
      reactBitsSoftAuroraScale: 99,
      reactBitsSoftAuroraBrightness: 99,
      reactBitsSoftAuroraNoiseFrequency: 99,
      reactBitsSoftAuroraNoiseAmplitude: 99,
      reactBitsSoftAuroraBandHeight: -99,
      reactBitsSoftAuroraBandSpread: 99,
      reactBitsSoftAuroraOctaveDecay: 99,
      reactBitsSoftAuroraLayerOffset: -99,
      reactBitsSoftAuroraColorSpeed: 99,
      reactBitsSoftAuroraEnableMouseInteraction: true,
      reactBitsSoftAuroraMouseInfluence: 99,
    })

    assert.equal(settings.reactBitsSoftAuroraPaletteMode, "harmony")
    assert.equal(settings.reactBitsSoftAuroraPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsSoftAuroraHarmony, "triad")
    assert.equal(settings.reactBitsSoftAuroraColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsSoftAuroraColorTwo, "#010203")
    assert.equal(settings.reactBitsSoftAuroraSpeed, 3)
    assert.equal(settings.reactBitsSoftAuroraScale, 4)
    assert.equal(settings.reactBitsSoftAuroraBrightness, 3)
    assert.equal(settings.reactBitsSoftAuroraNoiseFrequency, 8)
    assert.equal(settings.reactBitsSoftAuroraNoiseAmplitude, 4)
    assert.equal(settings.reactBitsSoftAuroraBandHeight, -1)
    assert.equal(settings.reactBitsSoftAuroraBandSpread, 4)
    assert.equal(settings.reactBitsSoftAuroraOctaveDecay, 1)
    assert.equal(settings.reactBitsSoftAuroraLayerOffset, -6)
    assert.equal(settings.reactBitsSoftAuroraColorSpeed, 4)
    assert.equal(settings.reactBitsSoftAuroraEnableMouseInteraction, true)
    assert.equal(settings.reactBitsSoftAuroraMouseInfluence, 1)
    assert.equal(
      sanitizeChimerSettings({ reactBitsSoftAuroraPaletteMode: "auto" }).reactBitsSoftAuroraPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsSoftAuroraPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSoftAuroraPrimaryColor: "white" }).reactBitsSoftAuroraPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsSoftAuroraPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSoftAuroraHarmony: "wild" }).reactBitsSoftAuroraHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsSoftAuroraHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSoftAuroraColorOne: "white" }).reactBitsSoftAuroraColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsSoftAuroraColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSoftAuroraSpeed: "fast" }).reactBitsSoftAuroraSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsSoftAuroraSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsSoftAuroraEnableMouseInteraction: "yes" }).reactBitsSoftAuroraEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsSoftAuroraEnableMouseInteraction,
    )
  })

  it("normalizes React Bits Plasma background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsPlasmaPaletteMode: "harmony",
      reactBitsPlasmaPrimaryColor: "#ffffff",
      reactBitsPlasmaHarmony: "triad",
      reactBitsPlasmaColor: "#abcdef",
      reactBitsPlasmaSpeed: 99,
      reactBitsPlasmaDirection: "pingpong",
      reactBitsPlasmaScale: 99,
      reactBitsPlasmaOpacity: 99,
      reactBitsPlasmaMouseInteractive: true,
    })

    assert.equal(settings.reactBitsPlasmaPaletteMode, "harmony")
    assert.equal(settings.reactBitsPlasmaPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsPlasmaHarmony, "triad")
    assert.equal(settings.reactBitsPlasmaColor, "#ABCDEF")
    assert.equal(settings.reactBitsPlasmaSpeed, 3)
    assert.equal(settings.reactBitsPlasmaDirection, "pingpong")
    assert.equal(settings.reactBitsPlasmaScale, 4)
    assert.equal(settings.reactBitsPlasmaOpacity, 1)
    assert.equal(settings.reactBitsPlasmaMouseInteractive, true)
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaPaletteMode: "auto" }).reactBitsPlasmaPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaPrimaryColor: "white" }).reactBitsPlasmaPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaHarmony: "wild" }).reactBitsPlasmaHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaColor: "white" }).reactBitsPlasmaColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaSpeed: "fast" }).reactBitsPlasmaSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaDirection: "sideways" }).reactBitsPlasmaDirection,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaMouseInteractive: "yes" }).reactBitsPlasmaMouseInteractive,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaMouseInteractive,
    )
  })

  it("normalizes React Bits Plasma Wave background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsPlasmaWavePaletteMode: "harmony",
      reactBitsPlasmaWavePrimaryColor: "#ffffff",
      reactBitsPlasmaWaveHarmony: "triad",
      reactBitsPlasmaWaveColorOne: "#abcdef",
      reactBitsPlasmaWaveColorTwo: "#010203",
      reactBitsPlasmaWaveXOffset: 9999,
      reactBitsPlasmaWaveYOffset: -9999,
      reactBitsPlasmaWaveRotationDeg: 9999,
      reactBitsPlasmaWaveFocalLength: 99,
      reactBitsPlasmaWaveSpeedOne: 99,
      reactBitsPlasmaWaveSpeedTwo: 99,
      reactBitsPlasmaWaveDirectionTwo: -1,
      reactBitsPlasmaWaveBendOne: 99,
      reactBitsPlasmaWaveBendTwo: 99,
    })

    assert.equal(settings.reactBitsPlasmaWavePaletteMode, "harmony")
    assert.equal(settings.reactBitsPlasmaWavePrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsPlasmaWaveHarmony, "triad")
    assert.equal(settings.reactBitsPlasmaWaveColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsPlasmaWaveColorTwo, "#010203")
    assert.equal(settings.reactBitsPlasmaWaveXOffset, 800)
    assert.equal(settings.reactBitsPlasmaWaveYOffset, -800)
    assert.equal(settings.reactBitsPlasmaWaveRotationDeg, 180)
    assert.equal(settings.reactBitsPlasmaWaveFocalLength, 2)
    assert.equal(settings.reactBitsPlasmaWaveSpeedOne, 0.5)
    assert.equal(settings.reactBitsPlasmaWaveSpeedTwo, 0.5)
    assert.equal(settings.reactBitsPlasmaWaveDirectionTwo, -1)
    assert.equal(settings.reactBitsPlasmaWaveBendOne, 3)
    assert.equal(settings.reactBitsPlasmaWaveBendTwo, 3)
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaWavePaletteMode: "auto" }).reactBitsPlasmaWavePaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaWavePaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaWavePrimaryColor: "white" }).reactBitsPlasmaWavePrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaWavePrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaWaveHarmony: "wild" }).reactBitsPlasmaWaveHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaWaveHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaWaveColorOne: "white" }).reactBitsPlasmaWaveColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaWaveColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaWaveSpeedOne: "fast" }).reactBitsPlasmaWaveSpeedOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaWaveSpeedOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPlasmaWaveDirectionTwo: "reverse" }).reactBitsPlasmaWaveDirectionTwo,
      DEFAULT_CHIMER_SETTINGS.reactBitsPlasmaWaveDirectionTwo,
    )
  })

  it("normalizes React Bits Particles background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsParticlesPaletteMode: "harmony",
      reactBitsParticlesPrimaryColor: "#ffffff",
      reactBitsParticlesHarmony: "triad",
      reactBitsParticlesColorOne: "#abcdef",
      reactBitsParticlesColorTwo: "#010203",
      reactBitsParticlesColorThree: "#111111",
      reactBitsParticlesCount: 9999.6,
      reactBitsParticlesSpread: 99,
      reactBitsParticlesSpeed: 99,
      reactBitsParticlesMoveOnHover: true,
      reactBitsParticlesHoverFactor: 99,
      reactBitsParticlesAlpha: true,
      reactBitsParticlesBaseSize: 999,
      reactBitsParticlesSizeRandomness: 99,
      reactBitsParticlesCameraDistance: 999,
      reactBitsParticlesDisableRotation: true,
      reactBitsParticlesPixelRatio: 99,
    })

    assert.equal(settings.reactBitsParticlesPaletteMode, "harmony")
    assert.equal(settings.reactBitsParticlesPrimaryColor, "#FFFFFF")
    assert.equal(settings.reactBitsParticlesHarmony, "triad")
    assert.equal(settings.reactBitsParticlesColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsParticlesColorTwo, "#010203")
    assert.equal(settings.reactBitsParticlesColorThree, "#111111")
    assert.equal(settings.reactBitsParticlesCount, 1500)
    assert.equal(settings.reactBitsParticlesSpread, 30)
    assert.equal(settings.reactBitsParticlesSpeed, 1)
    assert.equal(settings.reactBitsParticlesMoveOnHover, true)
    assert.equal(settings.reactBitsParticlesHoverFactor, 5)
    assert.equal(settings.reactBitsParticlesAlpha, true)
    assert.equal(settings.reactBitsParticlesBaseSize, 300)
    assert.equal(settings.reactBitsParticlesSizeRandomness, 3)
    assert.equal(settings.reactBitsParticlesCameraDistance, 60)
    assert.equal(settings.reactBitsParticlesDisableRotation, true)
    assert.equal(settings.reactBitsParticlesPixelRatio, 2)
    assert.equal(
      sanitizeChimerSettings({ reactBitsParticlesPaletteMode: "auto" }).reactBitsParticlesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsParticlesPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsParticlesPrimaryColor: "white" }).reactBitsParticlesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsParticlesPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsParticlesHarmony: "wild" }).reactBitsParticlesHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsParticlesHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsParticlesColorOne: "white" }).reactBitsParticlesColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsParticlesColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsParticlesCount: "many" }).reactBitsParticlesCount,
      DEFAULT_CHIMER_SETTINGS.reactBitsParticlesCount,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsParticlesMoveOnHover: "yes" }).reactBitsParticlesMoveOnHover,
      DEFAULT_CHIMER_SETTINGS.reactBitsParticlesMoveOnHover,
    )
  })

  it("normalizes React Bits Gradient Blinds background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsGradientBlindsPaletteMode: "harmony",
      reactBitsGradientBlindsPrimaryColor: "#ff9ffc",
      reactBitsGradientBlindsHarmony: "triad",
      reactBitsGradientBlindsColorOne: "#abcdef",
      reactBitsGradientBlindsColorTwo: "#010203",
      reactBitsGradientBlindsAngle: 999,
      reactBitsGradientBlindsNoise: 99,
      reactBitsGradientBlindsBlindCount: 999.6,
      reactBitsGradientBlindsBlindMinWidth: 999,
      reactBitsGradientBlindsMouseDampening: 99,
      reactBitsGradientBlindsMirror: true,
      reactBitsGradientBlindsSpotlightRadius: 99,
      reactBitsGradientBlindsSpotlightSoftness: 99,
      reactBitsGradientBlindsSpotlightOpacity: 99,
      reactBitsGradientBlindsDistort: 99,
      reactBitsGradientBlindsShineDirection: "right",
      reactBitsGradientBlindsBlendMode: "screen",
      reactBitsGradientBlindsDpr: 99,
      reactBitsGradientBlindsEnableMouseInteraction: true,
    })

    assert.equal(settings.reactBitsGradientBlindsPaletteMode, "harmony")
    assert.equal(settings.reactBitsGradientBlindsPrimaryColor, "#FF9FFC")
    assert.equal(settings.reactBitsGradientBlindsHarmony, "triad")
    assert.equal(settings.reactBitsGradientBlindsColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsGradientBlindsColorTwo, "#010203")
    assert.equal(settings.reactBitsGradientBlindsAngle, 180)
    assert.equal(settings.reactBitsGradientBlindsNoise, 1)
    assert.equal(settings.reactBitsGradientBlindsBlindCount, 80)
    assert.equal(settings.reactBitsGradientBlindsBlindMinWidth, 240)
    assert.equal(settings.reactBitsGradientBlindsMouseDampening, 1)
    assert.equal(settings.reactBitsGradientBlindsMirror, true)
    assert.equal(settings.reactBitsGradientBlindsSpotlightRadius, 1.5)
    assert.equal(settings.reactBitsGradientBlindsSpotlightSoftness, 4)
    assert.equal(settings.reactBitsGradientBlindsSpotlightOpacity, 2)
    assert.equal(settings.reactBitsGradientBlindsDistort, 5)
    assert.equal(settings.reactBitsGradientBlindsShineDirection, "right")
    assert.equal(settings.reactBitsGradientBlindsBlendMode, "screen")
    assert.equal(settings.reactBitsGradientBlindsDpr, 2)
    assert.equal(settings.reactBitsGradientBlindsEnableMouseInteraction, true)
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsPaletteMode: "auto" }).reactBitsGradientBlindsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsPrimaryColor: "pink" }).reactBitsGradientBlindsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsHarmony: "wild" }).reactBitsGradientBlindsHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsColorOne: "pink" }).reactBitsGradientBlindsColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsAngle: "wide" }).reactBitsGradientBlindsAngle,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsAngle,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsGradientBlindsAngle: -999 }).reactBitsGradientBlindsAngle, -180)
    assert.equal(sanitizeChimerSettings({ reactBitsGradientBlindsNoise: -1 }).reactBitsGradientBlindsNoise, 0)
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsBlindCount: "many" }).reactBitsGradientBlindsBlindCount,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsBlindCount,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsGradientBlindsBlindCount: 0 }).reactBitsGradientBlindsBlindCount, 1)
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsShineDirection: "center" })
        .reactBitsGradientBlindsShineDirection,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsShineDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsBlendMode: "multiply" }).reactBitsGradientBlindsBlendMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsBlendMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGradientBlindsEnableMouseInteraction: "yes" })
        .reactBitsGradientBlindsEnableMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsGradientBlindsEnableMouseInteraction,
    )
  })

  it("normalizes React Bits Grainient background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsGrainientPaletteMode: "harmony",
      reactBitsGrainientPrimaryColor: "#ff9ffc",
      reactBitsGrainientHarmony: "triad",
      reactBitsGrainientColorOne: "#abcdef",
      reactBitsGrainientColorTwo: "#010203",
      reactBitsGrainientColorThree: "#111111",
      reactBitsGrainientTimeSpeed: 99,
      reactBitsGrainientColorBalance: 99,
      reactBitsGrainientWarpStrength: 99,
      reactBitsGrainientWarpFrequency: 99,
      reactBitsGrainientWarpSpeed: 99,
      reactBitsGrainientWarpAmplitude: 999,
      reactBitsGrainientBlendAngle: 999,
      reactBitsGrainientBlendSoftness: 99,
      reactBitsGrainientRotationAmount: 9999,
      reactBitsGrainientNoiseScale: 99,
      reactBitsGrainientGrainAmount: 99,
      reactBitsGrainientGrainScale: 99,
      reactBitsGrainientGrainAnimated: true,
      reactBitsGrainientContrast: 99,
      reactBitsGrainientGamma: 99,
      reactBitsGrainientSaturation: 99,
      reactBitsGrainientCenterX: 99,
      reactBitsGrainientCenterY: -99,
      reactBitsGrainientZoom: 99,
    })

    assert.equal(settings.reactBitsGrainientPaletteMode, "harmony")
    assert.equal(settings.reactBitsGrainientPrimaryColor, "#FF9FFC")
    assert.equal(settings.reactBitsGrainientHarmony, "triad")
    assert.equal(settings.reactBitsGrainientColorOne, "#ABCDEF")
    assert.equal(settings.reactBitsGrainientColorTwo, "#010203")
    assert.equal(settings.reactBitsGrainientColorThree, "#111111")
    assert.equal(settings.reactBitsGrainientTimeSpeed, 2)
    assert.equal(settings.reactBitsGrainientColorBalance, 1)
    assert.equal(settings.reactBitsGrainientWarpStrength, 5)
    assert.equal(settings.reactBitsGrainientWarpFrequency, 20)
    assert.equal(settings.reactBitsGrainientWarpSpeed, 6)
    assert.equal(settings.reactBitsGrainientWarpAmplitude, 160)
    assert.equal(settings.reactBitsGrainientBlendAngle, 180)
    assert.equal(settings.reactBitsGrainientBlendSoftness, 1)
    assert.equal(settings.reactBitsGrainientRotationAmount, 1200)
    assert.equal(settings.reactBitsGrainientNoiseScale, 8)
    assert.equal(settings.reactBitsGrainientGrainAmount, 1)
    assert.equal(settings.reactBitsGrainientGrainScale, 12)
    assert.equal(settings.reactBitsGrainientGrainAnimated, true)
    assert.equal(settings.reactBitsGrainientContrast, 4)
    assert.equal(settings.reactBitsGrainientGamma, 4)
    assert.equal(settings.reactBitsGrainientSaturation, 3)
    assert.equal(settings.reactBitsGrainientCenterX, 1)
    assert.equal(settings.reactBitsGrainientCenterY, -1)
    assert.equal(settings.reactBitsGrainientZoom, 3)
    assert.equal(
      sanitizeChimerSettings({ reactBitsGrainientPaletteMode: "auto" }).reactBitsGrainientPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsGrainientPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGrainientPrimaryColor: "pink" }).reactBitsGrainientPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsGrainientPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGrainientHarmony: "wild" }).reactBitsGrainientHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsGrainientHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGrainientColorOne: "pink" }).reactBitsGrainientColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsGrainientColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGrainientTimeSpeed: "fast" }).reactBitsGrainientTimeSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsGrainientTimeSpeed,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsGrainientBlendAngle: -999 }).reactBitsGrainientBlendAngle, -180)
    assert.equal(sanitizeChimerSettings({ reactBitsGrainientWarpFrequency: 0 }).reactBitsGrainientWarpFrequency, 0.1)
    assert.equal(
      sanitizeChimerSettings({ reactBitsGrainientGrainAnimated: "yes" }).reactBitsGrainientGrainAnimated,
      DEFAULT_CHIMER_SETTINGS.reactBitsGrainientGrainAnimated,
    )
  })

  it("normalizes React Bits Grid Scan background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsGridScanPaletteMode: "harmony",
      reactBitsGridScanPrimaryColor: "#ff9ffc",
      reactBitsGridScanHarmony: "triad",
      reactBitsGridScanLinesColor: "#abcdef",
      reactBitsGridScanScanColor: "#010203",
      reactBitsGridScanSensitivity: 99,
      reactBitsGridScanLineThickness: 99,
      reactBitsGridScanScanOpacity: 99,
      reactBitsGridScanGridScale: 99,
      reactBitsGridScanLineStyle: "dotted",
      reactBitsGridScanLineJitter: 99,
      reactBitsGridScanDirection: "backward",
      reactBitsGridScanNoiseIntensity: 99,
      reactBitsGridScanBloomOpacity: 99,
      reactBitsGridScanScanGlow: 99,
      reactBitsGridScanScanSoftness: 99,
      reactBitsGridScanPhaseTaper: 99,
      reactBitsGridScanScanDuration: 99,
      reactBitsGridScanScanDelay: 99,
      reactBitsGridScanEnablePointerInteraction: true,
      reactBitsGridScanScanOnClick: true,
    })

    assert.equal(settings.reactBitsGridScanPaletteMode, "harmony")
    assert.equal(settings.reactBitsGridScanPrimaryColor, "#FF9FFC")
    assert.equal(settings.reactBitsGridScanHarmony, "triad")
    assert.equal(settings.reactBitsGridScanLinesColor, "#ABCDEF")
    assert.equal(settings.reactBitsGridScanScanColor, "#010203")
    assert.equal(settings.reactBitsGridScanSensitivity, 1)
    assert.equal(settings.reactBitsGridScanLineThickness, 6)
    assert.equal(settings.reactBitsGridScanScanOpacity, 1)
    assert.equal(settings.reactBitsGridScanGridScale, 0.5)
    assert.equal(settings.reactBitsGridScanLineStyle, "dotted")
    assert.equal(settings.reactBitsGridScanLineJitter, 1)
    assert.equal(settings.reactBitsGridScanDirection, "backward")
    assert.equal(settings.reactBitsGridScanNoiseIntensity, 0.25)
    assert.equal(settings.reactBitsGridScanBloomOpacity, 2)
    assert.equal(settings.reactBitsGridScanScanGlow, 3)
    assert.equal(settings.reactBitsGridScanScanSoftness, 6)
    assert.equal(settings.reactBitsGridScanPhaseTaper, 0.49)
    assert.equal(settings.reactBitsGridScanScanDuration, 10)
    assert.equal(settings.reactBitsGridScanScanDelay, 10)
    assert.equal(settings.reactBitsGridScanEnablePointerInteraction, true)
    assert.equal(settings.reactBitsGridScanScanOnClick, true)
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanPaletteMode: "auto" }).reactBitsGridScanPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanPrimaryColor: "pink" }).reactBitsGridScanPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanHarmony: "wild" }).reactBitsGridScanHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanLinesColor: "pink" }).reactBitsGridScanLinesColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanLinesColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanLineStyle: "double" }).reactBitsGridScanLineStyle,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanLineStyle,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanDirection: "sideways" }).reactBitsGridScanDirection,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanDirection,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanSensitivity: "fast" }).reactBitsGridScanSensitivity,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanSensitivity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGridScanEnablePointerInteraction: "yes" })
        .reactBitsGridScanEnablePointerInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsGridScanEnablePointerInteraction,
    )
  })

  it("normalizes React Bits Beams background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsBeamsPaletteMode: "harmony",
      reactBitsBeamsPrimaryColor: "#abcdef",
      reactBitsBeamsHarmony: "triad",
      reactBitsBeamsLightColor: "#010203",
      reactBitsBeamsBeamWidth: 99,
      reactBitsBeamsBeamHeight: 99,
      reactBitsBeamsBeamNumber: 99,
      reactBitsBeamsSpeed: 99,
      reactBitsBeamsNoiseIntensity: 99,
      reactBitsBeamsScale: 99,
      reactBitsBeamsRotation: 999,
    })

    assert.equal(settings.reactBitsBeamsPaletteMode, "harmony")
    assert.equal(settings.reactBitsBeamsPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsBeamsHarmony, "triad")
    assert.equal(settings.reactBitsBeamsLightColor, "#010203")
    assert.equal(settings.reactBitsBeamsBeamWidth, 6)
    assert.equal(settings.reactBitsBeamsBeamHeight, 32)
    assert.equal(settings.reactBitsBeamsBeamNumber, 48)
    assert.equal(settings.reactBitsBeamsSpeed, 8)
    assert.equal(settings.reactBitsBeamsNoiseIntensity, 4)
    assert.equal(settings.reactBitsBeamsScale, 1.5)
    assert.equal(settings.reactBitsBeamsRotation, 180)
    assert.equal(
      sanitizeChimerSettings({ reactBitsBeamsPaletteMode: "auto" }).reactBitsBeamsPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsBeamsPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsBeamsPrimaryColor: "white" }).reactBitsBeamsPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsBeamsPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsBeamsHarmony: "wild" }).reactBitsBeamsHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsBeamsHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsBeamsLightColor: "white" }).reactBitsBeamsLightColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsBeamsLightColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsBeamsSpeed: "fast" }).reactBitsBeamsSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsBeamsSpeed,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsBeamsBeamNumber: 4.9 }).reactBitsBeamsBeamNumber, 4)
    assert.equal(sanitizeChimerSettings({ reactBitsBeamsRotation: -999 }).reactBitsBeamsRotation, -180)
  })

  it("normalizes React Bits Pixel Snow background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsPixelSnowPaletteMode: "harmony",
      reactBitsPixelSnowPrimaryColor: "#abcdef",
      reactBitsPixelSnowHarmony: "triad",
      reactBitsPixelSnowColor: "#010203",
      reactBitsPixelSnowFlakeSize: 99,
      reactBitsPixelSnowMinFlakeSize: 99,
      reactBitsPixelSnowPixelResolution: 9999,
      reactBitsPixelSnowSpeed: 99,
      reactBitsPixelSnowDepthFade: 99,
      reactBitsPixelSnowFarPlane: 999,
      reactBitsPixelSnowBrightness: 99,
      reactBitsPixelSnowGamma: 99,
      reactBitsPixelSnowDensity: 99,
      reactBitsPixelSnowVariant: "snowflake",
      reactBitsPixelSnowDirection: 999,
    })

    assert.equal(settings.reactBitsPixelSnowPaletteMode, "harmony")
    assert.equal(settings.reactBitsPixelSnowPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsPixelSnowHarmony, "triad")
    assert.equal(settings.reactBitsPixelSnowColor, "#010203")
    assert.equal(settings.reactBitsPixelSnowFlakeSize, 0.08)
    assert.equal(settings.reactBitsPixelSnowMinFlakeSize, 6)
    assert.equal(settings.reactBitsPixelSnowPixelResolution, 640)
    assert.equal(settings.reactBitsPixelSnowSpeed, 5)
    assert.equal(settings.reactBitsPixelSnowDepthFade, 40)
    assert.equal(settings.reactBitsPixelSnowFarPlane, 80)
    assert.equal(settings.reactBitsPixelSnowBrightness, 4)
    assert.equal(settings.reactBitsPixelSnowGamma, 2)
    assert.equal(settings.reactBitsPixelSnowDensity, 1)
    assert.equal(settings.reactBitsPixelSnowVariant, "snowflake")
    assert.equal(settings.reactBitsPixelSnowDirection, 360)
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelSnowPaletteMode: "auto" }).reactBitsPixelSnowPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelSnowPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelSnowPrimaryColor: "white" }).reactBitsPixelSnowPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelSnowPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelSnowHarmony: "wild" }).reactBitsPixelSnowHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelSnowHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelSnowColor: "white" }).reactBitsPixelSnowColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelSnowColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelSnowSpeed: "fast" }).reactBitsPixelSnowSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelSnowSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPixelSnowVariant: "storm" }).reactBitsPixelSnowVariant,
      DEFAULT_CHIMER_SETTINGS.reactBitsPixelSnowVariant,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsPixelSnowDirection: -1 }).reactBitsPixelSnowDirection, 0)
  })

  it("normalizes React Bits Lightning background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsLightningPaletteMode: "harmony",
      reactBitsLightningPrimaryColor: "#abcdef",
      reactBitsLightningHarmony: "triad",
      reactBitsLightningColor: "#010203",
      reactBitsLightningHue: 999,
      reactBitsLightningXOffset: 99,
      reactBitsLightningSpeed: 99,
      reactBitsLightningIntensity: 99,
      reactBitsLightningSize: 99,
    })

    assert.equal(settings.reactBitsLightningPaletteMode, "harmony")
    assert.equal(settings.reactBitsLightningPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsLightningHarmony, "triad")
    assert.equal(settings.reactBitsLightningColor, "#010203")
    assert.equal(settings.reactBitsLightningHue, 360)
    assert.equal(settings.reactBitsLightningXOffset, 2)
    assert.equal(settings.reactBitsLightningSpeed, 5)
    assert.equal(settings.reactBitsLightningIntensity, 5)
    assert.equal(settings.reactBitsLightningSize, 5)
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightningPaletteMode: "auto" }).reactBitsLightningPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightningPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightningPrimaryColor: "white" }).reactBitsLightningPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightningPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightningHarmony: "wild" }).reactBitsLightningHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightningHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightningColor: "white" }).reactBitsLightningColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightningColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsLightningSpeed: "fast" }).reactBitsLightningSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightningSpeed,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsLightningXOffset: -99 }).reactBitsLightningXOffset, -2)
    assert.equal(sanitizeChimerSettings({ reactBitsLightningIntensity: 0 }).reactBitsLightningIntensity, 0.1)
    assert.equal(sanitizeChimerSettings({ reactBitsLightningSize: 0 }).reactBitsLightningSize, 0.2)
  })

  it("normalizes React Bits Prismatic Burst background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsPrismaticBurstPaletteMode: "harmony",
      reactBitsPrismaticBurstPrimaryColor: "#abcdef",
      reactBitsPrismaticBurstHarmony: "triad",
      reactBitsPrismaticBurstColorOne: "#010203",
      reactBitsPrismaticBurstColorTwo: "#aabbcc",
      reactBitsPrismaticBurstColorThree: "#ddeeff",
      reactBitsPrismaticBurstColorFour: "#112233",
      reactBitsPrismaticBurstIntensity: 99,
      reactBitsPrismaticBurstSpeed: 99,
      reactBitsPrismaticBurstAnimationType: "hover",
      reactBitsPrismaticBurstDistort: 99,
      reactBitsPrismaticBurstOffsetX: 9999,
      reactBitsPrismaticBurstOffsetY: -9999,
      reactBitsPrismaticBurstHoverDampness: 99,
      reactBitsPrismaticBurstRayCount: 99,
      reactBitsPrismaticBurstMixBlendMode: "screen",
    })

    assert.equal(settings.reactBitsPrismaticBurstPaletteMode, "harmony")
    assert.equal(settings.reactBitsPrismaticBurstPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsPrismaticBurstHarmony, "triad")
    assert.equal(settings.reactBitsPrismaticBurstColorOne, "#010203")
    assert.equal(settings.reactBitsPrismaticBurstColorTwo, "#AABBCC")
    assert.equal(settings.reactBitsPrismaticBurstColorThree, "#DDEEFF")
    assert.equal(settings.reactBitsPrismaticBurstColorFour, "#112233")
    assert.equal(settings.reactBitsPrismaticBurstIntensity, 5)
    assert.equal(settings.reactBitsPrismaticBurstSpeed, 3)
    assert.equal(settings.reactBitsPrismaticBurstAnimationType, "hover")
    assert.equal(settings.reactBitsPrismaticBurstDistort, 50)
    assert.equal(settings.reactBitsPrismaticBurstOffsetX, 1000)
    assert.equal(settings.reactBitsPrismaticBurstOffsetY, -1000)
    assert.equal(settings.reactBitsPrismaticBurstHoverDampness, 1)
    assert.equal(settings.reactBitsPrismaticBurstRayCount, 64)
    assert.equal(settings.reactBitsPrismaticBurstMixBlendMode, "screen")
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstPaletteMode: "auto" }).reactBitsPrismaticBurstPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismaticBurstPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstPrimaryColor: "white" }).reactBitsPrismaticBurstPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismaticBurstPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstHarmony: "wild" }).reactBitsPrismaticBurstHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismaticBurstHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstColorOne: "white" }).reactBitsPrismaticBurstColorOne,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismaticBurstColorOne,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstSpeed: "fast" }).reactBitsPrismaticBurstSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismaticBurstSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstAnimationType: "orbit" }).reactBitsPrismaticBurstAnimationType,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismaticBurstAnimationType,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstMixBlendMode: "multiply" }).reactBitsPrismaticBurstMixBlendMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsPrismaticBurstMixBlendMode,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsPrismaticBurstIntensity: -1 }).reactBitsPrismaticBurstIntensity, 0)
    assert.equal(sanitizeChimerSettings({ reactBitsPrismaticBurstDistort: -1 }).reactBitsPrismaticBurstDistort, 0)
    assert.equal(sanitizeChimerSettings({ reactBitsPrismaticBurstOffsetX: -9999 }).reactBitsPrismaticBurstOffsetX, -1000)
    assert.equal(sanitizeChimerSettings({ reactBitsPrismaticBurstOffsetY: 9999 }).reactBitsPrismaticBurstOffsetY, 1000)
    assert.equal(
      sanitizeChimerSettings({ reactBitsPrismaticBurstHoverDampness: -1 }).reactBitsPrismaticBurstHoverDampness,
      0,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsPrismaticBurstRayCount: 10.9 }).reactBitsPrismaticBurstRayCount, 10)
  })

  it("normalizes React Bits Galaxy background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsGalaxyPaletteMode: "harmony",
      reactBitsGalaxyPrimaryColor: "#abcdef",
      reactBitsGalaxyHarmony: "triad",
      reactBitsGalaxyColor: "#010203",
      reactBitsGalaxyHueShift: 999,
      reactBitsGalaxyFocalX: 99,
      reactBitsGalaxyFocalY: -99,
      reactBitsGalaxyRotationDeg: 999,
      reactBitsGalaxyStarSpeed: 99,
      reactBitsGalaxyDensity: 99,
      reactBitsGalaxySpeed: 99,
      reactBitsGalaxyMouseInteraction: false,
      reactBitsGalaxyGlowIntensity: 99,
      reactBitsGalaxySaturation: 99,
      reactBitsGalaxyMouseRepulsion: false,
      reactBitsGalaxyRepulsionStrength: 99,
      reactBitsGalaxyTwinkleIntensity: 99,
      reactBitsGalaxyRotationSpeed: 99,
      reactBitsGalaxyAutoCenterRepulsion: 99,
      reactBitsGalaxyTransparent: false,
    })

    assert.equal(settings.reactBitsGalaxyPaletteMode, "harmony")
    assert.equal(settings.reactBitsGalaxyPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsGalaxyHarmony, "triad")
    assert.equal(settings.reactBitsGalaxyColor, "#010203")
    assert.equal(settings.reactBitsGalaxyHueShift, 360)
    assert.equal(settings.reactBitsGalaxyFocalX, 1)
    assert.equal(settings.reactBitsGalaxyFocalY, 0)
    assert.equal(settings.reactBitsGalaxyRotationDeg, 360)
    assert.equal(settings.reactBitsGalaxyStarSpeed, 5)
    assert.equal(settings.reactBitsGalaxyDensity, 3)
    assert.equal(settings.reactBitsGalaxySpeed, 5)
    assert.equal(settings.reactBitsGalaxyMouseInteraction, false)
    assert.equal(settings.reactBitsGalaxyGlowIntensity, 2)
    assert.equal(settings.reactBitsGalaxySaturation, 2)
    assert.equal(settings.reactBitsGalaxyMouseRepulsion, false)
    assert.equal(settings.reactBitsGalaxyRepulsionStrength, 6)
    assert.equal(settings.reactBitsGalaxyTwinkleIntensity, 1)
    assert.equal(settings.reactBitsGalaxyRotationSpeed, 2)
    assert.equal(settings.reactBitsGalaxyAutoCenterRepulsion, 6)
    assert.equal(settings.reactBitsGalaxyTransparent, false)
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxyPaletteMode: "auto" }).reactBitsGalaxyPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxyPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxyPrimaryColor: "white" }).reactBitsGalaxyPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxyPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxyHarmony: "wild" }).reactBitsGalaxyHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxyHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxyColor: "white" }).reactBitsGalaxyColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxyColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxySpeed: "fast" }).reactBitsGalaxySpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxySpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxyMouseInteraction: "yes" }).reactBitsGalaxyMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxyMouseInteraction,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxyMouseRepulsion: "yes" }).reactBitsGalaxyMouseRepulsion,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxyMouseRepulsion,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsGalaxyTransparent: "no" }).reactBitsGalaxyTransparent,
      DEFAULT_CHIMER_SETTINGS.reactBitsGalaxyTransparent,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsGalaxyDensity: 0 }).reactBitsGalaxyDensity, 0.1)
    assert.equal(sanitizeChimerSettings({ reactBitsGalaxyGlowIntensity: 0 }).reactBitsGalaxyGlowIntensity, 0.01)
    assert.equal(sanitizeChimerSettings({ reactBitsGalaxyRotationSpeed: -99 }).reactBitsGalaxyRotationSpeed, -2)
  })

  it("normalizes React Bits Dither background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsDitherPaletteMode: "harmony",
      reactBitsDitherPrimaryColor: "#abcdef",
      reactBitsDitherHarmony: "triad",
      reactBitsDitherColor: "#010203",
      reactBitsDitherWaveSpeed: 99,
      reactBitsDitherWaveFrequency: 99,
      reactBitsDitherWaveAmplitude: 99,
      reactBitsDitherColorNum: 99,
      reactBitsDitherPixelSize: 99,
      reactBitsDitherMouseInteraction: false,
      reactBitsDitherMouseRadius: 99,
    })

    assert.equal(settings.reactBitsDitherPaletteMode, "harmony")
    assert.equal(settings.reactBitsDitherPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsDitherHarmony, "triad")
    assert.equal(settings.reactBitsDitherColor, "#010203")
    assert.equal(settings.reactBitsDitherWaveSpeed, 0.5)
    assert.equal(settings.reactBitsDitherWaveFrequency, 8)
    assert.equal(settings.reactBitsDitherWaveAmplitude, 1)
    assert.equal(settings.reactBitsDitherColorNum, 16)
    assert.equal(settings.reactBitsDitherPixelSize, 24)
    assert.equal(settings.reactBitsDitherMouseInteraction, false)
    assert.equal(settings.reactBitsDitherMouseRadius, 3)
    assert.equal(
      sanitizeChimerSettings({ reactBitsDitherPaletteMode: "auto" }).reactBitsDitherPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsDitherPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDitherPrimaryColor: "white" }).reactBitsDitherPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsDitherPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDitherHarmony: "wild" }).reactBitsDitherHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsDitherHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDitherColor: "white" }).reactBitsDitherColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsDitherColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDitherWaveSpeed: "fast" }).reactBitsDitherWaveSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsDitherWaveSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDitherMouseInteraction: "yes" }).reactBitsDitherMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsDitherMouseInteraction,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsDitherWaveFrequency: 0 }).reactBitsDitherWaveFrequency, 0.5)
    assert.equal(sanitizeChimerSettings({ reactBitsDitherWaveAmplitude: -1 }).reactBitsDitherWaveAmplitude, 0)
    assert.equal(sanitizeChimerSettings({ reactBitsDitherColorNum: 1 }).reactBitsDitherColorNum, 2)
    assert.equal(sanitizeChimerSettings({ reactBitsDitherPixelSize: 0 }).reactBitsDitherPixelSize, 1)
    assert.equal(sanitizeChimerSettings({ reactBitsDitherMouseRadius: 0 }).reactBitsDitherMouseRadius, 0.05)
  })

  it("normalizes React Bits Faulty Terminal background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsFaultyTerminalPaletteMode: "harmony",
      reactBitsFaultyTerminalPrimaryColor: "#abcdef",
      reactBitsFaultyTerminalHarmony: "triad",
      reactBitsFaultyTerminalTint: "#010203",
      reactBitsFaultyTerminalScale: 99,
      reactBitsFaultyTerminalGridMulX: 99,
      reactBitsFaultyTerminalGridMulY: 99,
      reactBitsFaultyTerminalDigitSize: 99,
      reactBitsFaultyTerminalTimeScale: 99,
      reactBitsFaultyTerminalScanlineIntensity: 99,
      reactBitsFaultyTerminalGlitchAmount: 99,
      reactBitsFaultyTerminalFlickerAmount: 99,
      reactBitsFaultyTerminalNoiseAmp: 99,
      reactBitsFaultyTerminalChromaticAberration: 99,
      reactBitsFaultyTerminalDither: 999,
      reactBitsFaultyTerminalCurvature: 99,
      reactBitsFaultyTerminalMouseReact: false,
      reactBitsFaultyTerminalMouseStrength: 99,
      reactBitsFaultyTerminalPageLoadAnimation: false,
      reactBitsFaultyTerminalBrightness: 99,
    })

    assert.equal(settings.reactBitsFaultyTerminalPaletteMode, "harmony")
    assert.equal(settings.reactBitsFaultyTerminalPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsFaultyTerminalHarmony, "triad")
    assert.equal(settings.reactBitsFaultyTerminalTint, "#010203")
    assert.equal(settings.reactBitsFaultyTerminalScale, 4)
    assert.equal(settings.reactBitsFaultyTerminalGridMulX, 6)
    assert.equal(settings.reactBitsFaultyTerminalGridMulY, 6)
    assert.equal(settings.reactBitsFaultyTerminalDigitSize, 4)
    assert.equal(settings.reactBitsFaultyTerminalTimeScale, 2)
    assert.equal(settings.reactBitsFaultyTerminalScanlineIntensity, 2)
    assert.equal(settings.reactBitsFaultyTerminalGlitchAmount, 3)
    assert.equal(settings.reactBitsFaultyTerminalFlickerAmount, 2)
    assert.equal(settings.reactBitsFaultyTerminalNoiseAmp, 2)
    assert.equal(settings.reactBitsFaultyTerminalChromaticAberration, 8)
    assert.equal(settings.reactBitsFaultyTerminalDither, 255)
    assert.equal(settings.reactBitsFaultyTerminalCurvature, 1)
    assert.equal(settings.reactBitsFaultyTerminalMouseReact, false)
    assert.equal(settings.reactBitsFaultyTerminalMouseStrength, 2)
    assert.equal(settings.reactBitsFaultyTerminalPageLoadAnimation, false)
    assert.equal(settings.reactBitsFaultyTerminalBrightness, 3)
    assert.equal(
      sanitizeChimerSettings({ reactBitsFaultyTerminalPaletteMode: "auto" }).reactBitsFaultyTerminalPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsFaultyTerminalPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFaultyTerminalPrimaryColor: "white" }).reactBitsFaultyTerminalPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsFaultyTerminalPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFaultyTerminalHarmony: "wild" }).reactBitsFaultyTerminalHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsFaultyTerminalHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFaultyTerminalTint: "white" }).reactBitsFaultyTerminalTint,
      DEFAULT_CHIMER_SETTINGS.reactBitsFaultyTerminalTint,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFaultyTerminalTimeScale: "fast" }).reactBitsFaultyTerminalTimeScale,
      DEFAULT_CHIMER_SETTINGS.reactBitsFaultyTerminalTimeScale,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFaultyTerminalMouseReact: "yes" }).reactBitsFaultyTerminalMouseReact,
      DEFAULT_CHIMER_SETTINGS.reactBitsFaultyTerminalMouseReact,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsFaultyTerminalPageLoadAnimation: "yes" })
        .reactBitsFaultyTerminalPageLoadAnimation,
      DEFAULT_CHIMER_SETTINGS.reactBitsFaultyTerminalPageLoadAnimation,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsFaultyTerminalScale: 0 }).reactBitsFaultyTerminalScale, 0.25)
    assert.equal(sanitizeChimerSettings({ reactBitsFaultyTerminalDigitSize: 0 }).reactBitsFaultyTerminalDigitSize, 0.5)
    assert.equal(sanitizeChimerSettings({ reactBitsFaultyTerminalBrightness: 0 }).reactBitsFaultyTerminalBrightness, 0.1)
  })

  it("normalizes React Bits Ripple Grid background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsRippleGridPaletteMode: "harmony",
      reactBitsRippleGridPrimaryColor: "#abcdef",
      reactBitsRippleGridHarmony: "triad",
      reactBitsRippleGridColor: "#010203",
      reactBitsRippleGridRippleIntensity: 99,
      reactBitsRippleGridGridSize: 99,
      reactBitsRippleGridGridThickness: 99,
      reactBitsRippleGridFadeDistance: 99,
      reactBitsRippleGridVignetteStrength: 99,
      reactBitsRippleGridGlowIntensity: 99,
      reactBitsRippleGridOpacity: 99,
      reactBitsRippleGridGridRotation: 999,
      reactBitsRippleGridMouseInteraction: false,
      reactBitsRippleGridMouseInteractionRadius: 99,
    })

    assert.equal(settings.reactBitsRippleGridPaletteMode, "harmony")
    assert.equal(settings.reactBitsRippleGridPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsRippleGridHarmony, "triad")
    assert.equal(settings.reactBitsRippleGridColor, "#010203")
    assert.equal(settings.reactBitsRippleGridRippleIntensity, 0.3)
    assert.equal(settings.reactBitsRippleGridGridSize, 30)
    assert.equal(settings.reactBitsRippleGridGridThickness, 50)
    assert.equal(settings.reactBitsRippleGridFadeDistance, 5)
    assert.equal(settings.reactBitsRippleGridVignetteStrength, 6)
    assert.equal(settings.reactBitsRippleGridGlowIntensity, 1)
    assert.equal(settings.reactBitsRippleGridOpacity, 1)
    assert.equal(settings.reactBitsRippleGridGridRotation, 180)
    assert.equal(settings.reactBitsRippleGridMouseInteraction, false)
    assert.equal(settings.reactBitsRippleGridMouseInteractionRadius, 5)
    assert.equal(
      sanitizeChimerSettings({ reactBitsRippleGridPaletteMode: "auto" }).reactBitsRippleGridPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsRippleGridPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRippleGridPrimaryColor: "white" }).reactBitsRippleGridPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsRippleGridPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRippleGridHarmony: "wild" }).reactBitsRippleGridHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsRippleGridHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRippleGridColor: "white" }).reactBitsRippleGridColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsRippleGridColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRippleGridRippleIntensity: "strong" }).reactBitsRippleGridRippleIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsRippleGridRippleIntensity,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsRippleGridMouseInteraction: "yes" }).reactBitsRippleGridMouseInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsRippleGridMouseInteraction,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsRippleGridRippleIntensity: -1 }).reactBitsRippleGridRippleIntensity, 0)
    assert.equal(sanitizeChimerSettings({ reactBitsRippleGridGridSize: 0 }).reactBitsRippleGridGridSize, 2)
    assert.equal(sanitizeChimerSettings({ reactBitsRippleGridGridThickness: 0 }).reactBitsRippleGridGridThickness, 1)
    assert.equal(sanitizeChimerSettings({ reactBitsRippleGridFadeDistance: 0 }).reactBitsRippleGridFadeDistance, 0.2)
    assert.equal(sanitizeChimerSettings({ reactBitsRippleGridVignetteStrength: 0 }).reactBitsRippleGridVignetteStrength, 0.1)
    assert.equal(sanitizeChimerSettings({ reactBitsRippleGridGridRotation: -999 }).reactBitsRippleGridGridRotation, -180)
    assert.equal(
      sanitizeChimerSettings({ reactBitsRippleGridMouseInteractionRadius: 0 }).reactBitsRippleGridMouseInteractionRadius,
      0.1,
    )
  })

  it("normalizes React Bits Dot Field background controls", () => {
    const settings = sanitizeChimerSettings({
      reactBitsDotFieldPaletteMode: "harmony",
      reactBitsDotFieldPrimaryColor: "#abcdef",
      reactBitsDotFieldHarmony: "triad",
      reactBitsDotFieldGradientFromColor: "#010203",
      reactBitsDotFieldGradientFromAlpha: 99,
      reactBitsDotFieldGradientToColor: "#040506",
      reactBitsDotFieldGradientToAlpha: 99,
      reactBitsDotFieldGlowColor: "#070809",
      reactBitsDotFieldDotRadius: 99,
      reactBitsDotFieldDotSpacing: 99,
      reactBitsDotFieldCursorRadius: 9999,
      reactBitsDotFieldCursorForce: 99,
      reactBitsDotFieldBulgeOnly: false,
      reactBitsDotFieldBulgeStrength: 999,
      reactBitsDotFieldGlowRadius: 999,
      reactBitsDotFieldSparkle: true,
      reactBitsDotFieldWaveAmplitude: 999,
      reactBitsDotFieldCursorInteraction: false,
    })

    assert.equal(settings.reactBitsDotFieldPaletteMode, "harmony")
    assert.equal(settings.reactBitsDotFieldPrimaryColor, "#ABCDEF")
    assert.equal(settings.reactBitsDotFieldHarmony, "triad")
    assert.equal(settings.reactBitsDotFieldGradientFromColor, "#010203")
    assert.equal(settings.reactBitsDotFieldGradientFromAlpha, 1)
    assert.equal(settings.reactBitsDotFieldGradientToColor, "#040506")
    assert.equal(settings.reactBitsDotFieldGradientToAlpha, 1)
    assert.equal(settings.reactBitsDotFieldGlowColor, "#070809")
    assert.equal(settings.reactBitsDotFieldDotRadius, 8)
    assert.equal(settings.reactBitsDotFieldDotSpacing, 48)
    assert.equal(settings.reactBitsDotFieldCursorRadius, 900)
    assert.equal(settings.reactBitsDotFieldCursorForce, 1)
    assert.equal(settings.reactBitsDotFieldBulgeOnly, false)
    assert.equal(settings.reactBitsDotFieldBulgeStrength, 160)
    assert.equal(settings.reactBitsDotFieldGlowRadius, 360)
    assert.equal(settings.reactBitsDotFieldSparkle, true)
    assert.equal(settings.reactBitsDotFieldWaveAmplitude, 48)
    assert.equal(settings.reactBitsDotFieldCursorInteraction, false)
    assert.equal(
      sanitizeChimerSettings({ reactBitsDotFieldPaletteMode: "auto" }).reactBitsDotFieldPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsDotFieldPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDotFieldPrimaryColor: "white" }).reactBitsDotFieldPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsDotFieldPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDotFieldHarmony: "wild" }).reactBitsDotFieldHarmony,
      DEFAULT_CHIMER_SETTINGS.reactBitsDotFieldHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDotFieldGradientFromColor: "white" }).reactBitsDotFieldGradientFromColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsDotFieldGradientFromColor,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDotFieldBulgeOnly: "yes" }).reactBitsDotFieldBulgeOnly,
      DEFAULT_CHIMER_SETTINGS.reactBitsDotFieldBulgeOnly,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDotFieldSparkle: "yes" }).reactBitsDotFieldSparkle,
      DEFAULT_CHIMER_SETTINGS.reactBitsDotFieldSparkle,
    )
    assert.equal(
      sanitizeChimerSettings({ reactBitsDotFieldCursorInteraction: "yes" }).reactBitsDotFieldCursorInteraction,
      DEFAULT_CHIMER_SETTINGS.reactBitsDotFieldCursorInteraction,
    )
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldGradientFromAlpha: -1 }).reactBitsDotFieldGradientFromAlpha, 0)
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldDotRadius: 0 }).reactBitsDotFieldDotRadius, 0.5)
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldDotSpacing: 0 }).reactBitsDotFieldDotSpacing, 4)
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldCursorRadius: 0 }).reactBitsDotFieldCursorRadius, 60)
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldCursorForce: 0 }).reactBitsDotFieldCursorForce, 0.01)
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldBulgeStrength: -1 }).reactBitsDotFieldBulgeStrength, 0)
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldGlowRadius: -1 }).reactBitsDotFieldGlowRadius, 0)
    assert.equal(sanitizeChimerSettings({ reactBitsDotFieldWaveAmplitude: -1 }).reactBitsDotFieldWaveAmplitude, 0)
  })

  it("normalizes Eldora Novatrix background controls", () => {
    const settings = sanitizeChimerSettings({
      eldoraNovatrixPaletteMode: "harmony",
      eldoraNovatrixPrimaryColor: "#ffffff",
      eldoraNovatrixHarmony: "triad",
      eldoraNovatrixColor: "white",
      eldoraNovatrixSpeed: 99,
      eldoraNovatrixAmplitude: 0,
    })

    assert.equal(settings.eldoraNovatrixPaletteMode, "harmony")
    assert.equal(settings.eldoraNovatrixPrimaryColor, "#FFFFFF")
    assert.equal(settings.eldoraNovatrixHarmony, "triad")
    assert.equal(settings.eldoraNovatrixColor, DEFAULT_CHIMER_SETTINGS.eldoraNovatrixColor)
    assert.equal(settings.eldoraNovatrixSpeed, 3)
    assert.equal(settings.eldoraNovatrixAmplitude, 0.01)
    assert.equal(
      sanitizeChimerSettings({ eldoraNovatrixSpeed: "fast" }).eldoraNovatrixSpeed,
      DEFAULT_CHIMER_SETTINGS.eldoraNovatrixSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraNovatrixAmplitude: "wide" }).eldoraNovatrixAmplitude,
      DEFAULT_CHIMER_SETTINGS.eldoraNovatrixAmplitude,
    )
    assert.equal(sanitizeChimerSettings({ eldoraNovatrixAmplitude: 10 }).eldoraNovatrixAmplitude, 0.45)
    assert.equal(
      sanitizeChimerSettings({ eldoraNovatrixPaletteMode: "demo" }).eldoraNovatrixPaletteMode,
      DEFAULT_CHIMER_SETTINGS.eldoraNovatrixPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraNovatrixPrimaryColor: "blue" }).eldoraNovatrixPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.eldoraNovatrixPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraNovatrixHarmony: "rainbow" }).eldoraNovatrixHarmony,
      DEFAULT_CHIMER_SETTINGS.eldoraNovatrixHarmony,
    )
  })

  it("normalizes Eldora Hacker background controls", () => {
    const settings = sanitizeChimerSettings({
      eldoraHackerPaletteMode: "harmony",
      eldoraHackerPrimaryColor: "#00d4ff",
      eldoraHackerHarmony: "triad",
      eldoraHackerColor: "green",
      eldoraHackerSpeed: 99,
      eldoraHackerFontSize: 4,
    })

    assert.equal(settings.eldoraHackerPaletteMode, "harmony")
    assert.equal(settings.eldoraHackerPrimaryColor, "#00D4FF")
    assert.equal(settings.eldoraHackerHarmony, "triad")
    assert.equal(settings.eldoraHackerColor, DEFAULT_CHIMER_SETTINGS.eldoraHackerColor)
    assert.equal(settings.eldoraHackerSpeed, 3)
    assert.equal(settings.eldoraHackerFontSize, 8)
    assert.equal(
      sanitizeChimerSettings({ eldoraHackerSpeed: "fast" }).eldoraHackerSpeed,
      DEFAULT_CHIMER_SETTINGS.eldoraHackerSpeed,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraHackerFontSize: "wide" }).eldoraHackerFontSize,
      DEFAULT_CHIMER_SETTINGS.eldoraHackerFontSize,
    )
    assert.equal(sanitizeChimerSettings({ eldoraHackerSpeed: 0 }).eldoraHackerSpeed, 0.05)
    assert.equal(sanitizeChimerSettings({ eldoraHackerFontSize: 99 }).eldoraHackerFontSize, 28)
    assert.equal(
      sanitizeChimerSettings({ eldoraHackerPaletteMode: "demo" }).eldoraHackerPaletteMode,
      DEFAULT_CHIMER_SETTINGS.eldoraHackerPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraHackerPrimaryColor: "blue" }).eldoraHackerPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.eldoraHackerPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraHackerHarmony: "rainbow" }).eldoraHackerHarmony,
      DEFAULT_CHIMER_SETTINGS.eldoraHackerHarmony,
    )
  })

  it("normalizes Eldora Photon Beam background controls", () => {
    const settings = sanitizeChimerSettings({
      eldoraPhotonBeamPaletteMode: "harmony",
      eldoraPhotonBeamPrimaryColor: "#00d4ff",
      eldoraPhotonBeamHarmony: "triad",
      eldoraPhotonBeamColorBg: "black",
      eldoraPhotonBeamColorLine: "#123456",
      eldoraPhotonBeamColorSignal: "#abcdef",
      eldoraPhotonBeamUseColor2: true,
      eldoraPhotonBeamColorSignal2: "#fedcba",
      eldoraPhotonBeamUseColor3: true,
      eldoraPhotonBeamColorSignal3: "#00ffff",
      eldoraPhotonBeamLineCount: 999,
      eldoraPhotonBeamSpreadHeight: 0,
      eldoraPhotonBeamSpreadDepth: 99,
      eldoraPhotonBeamCurveLength: 0,
      eldoraPhotonBeamStraightLength: 999,
      eldoraPhotonBeamCurvePower: 9,
      eldoraPhotonBeamWaveSpeed: -1,
      eldoraPhotonBeamWaveHeight: 9,
      eldoraPhotonBeamLineOpacity: 0,
      eldoraPhotonBeamSignalCount: -12,
      eldoraPhotonBeamSpeedGlobal: 99,
      eldoraPhotonBeamTrailLength: 99,
      eldoraPhotonBeamBloomStrength: 99,
      eldoraPhotonBeamBloomRadius: 99,
    })

    assert.equal(settings.eldoraPhotonBeamPaletteMode, "harmony")
    assert.equal(settings.eldoraPhotonBeamPrimaryColor, "#00D4FF")
    assert.equal(settings.eldoraPhotonBeamHarmony, "triad")
    assert.equal(settings.eldoraPhotonBeamColorBg, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorBg)
    assert.equal(settings.eldoraPhotonBeamColorLine, "#123456")
    assert.equal(settings.eldoraPhotonBeamColorSignal, "#ABCDEF")
    assert.equal(settings.eldoraPhotonBeamUseColor2, true)
    assert.equal(settings.eldoraPhotonBeamColorSignal2, "#FEDCBA")
    assert.equal(settings.eldoraPhotonBeamUseColor3, true)
    assert.equal(settings.eldoraPhotonBeamColorSignal3, "#00FFFF")
    assert.equal(settings.eldoraPhotonBeamLineCount, 160)
    assert.equal(settings.eldoraPhotonBeamSpreadHeight, 5)
    assert.equal(settings.eldoraPhotonBeamSpreadDepth, 60)
    assert.equal(settings.eldoraPhotonBeamCurveLength, 16)
    assert.equal(settings.eldoraPhotonBeamStraightLength, 220)
    assert.equal(settings.eldoraPhotonBeamCurvePower, 2)
    assert.equal(settings.eldoraPhotonBeamWaveSpeed, 0)
    assert.equal(settings.eldoraPhotonBeamWaveHeight, 1)
    assert.equal(settings.eldoraPhotonBeamLineOpacity, 0.05)
    assert.equal(settings.eldoraPhotonBeamSignalCount, 0)
    assert.equal(settings.eldoraPhotonBeamSpeedGlobal, 2)
    assert.equal(settings.eldoraPhotonBeamTrailLength, 16)
    assert.equal(settings.eldoraPhotonBeamBloomStrength, 6)
    assert.equal(settings.eldoraPhotonBeamBloomRadius, 1.5)
    assert.equal(
      sanitizeChimerSettings({ eldoraPhotonBeamPaletteMode: "demo" }).eldoraPhotonBeamPaletteMode,
      DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraPhotonBeamHarmony: "rainbow" }).eldoraPhotonBeamHarmony,
      DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraPhotonBeamUseColor2: "yes" }).eldoraPhotonBeamUseColor2,
      DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamUseColor2,
    )
    assert.equal(
      sanitizeChimerSettings({ eldoraPhotonBeamSpeedGlobal: "fast" }).eldoraPhotonBeamSpeedGlobal,
      DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSpeedGlobal,
    )
  })

  it("normalizes Aceternity 3D Globe background controls", () => {
    const longLabel = "A".repeat(96)
    const settings = sanitizeChimerSettings({
      aceternity3DGlobeViewStyle: "graphic",
      aceternity3DGlobeBackgroundColor: "#aabbcc",
      aceternity3DGlobeGlobeColor: "navy",
      aceternity3DGlobeGraphicMapColor: "#ddeeff",
      aceternity3DGlobeGraphicGlowColor: "white",
      aceternity3DGlobeGraphicMarkerColor: "#fb6415",
      aceternity3DGlobeGraphicMapSamples: 999999,
      aceternity3DGlobeAutoRotateSpeed: 99,
      aceternity3DGlobeReverseSpin: false,
      aceternity3DGlobeScale: 0,
      aceternity3DGlobeBumpScale: 99,
      aceternity3DGlobeAmbientIntensity: -1,
      aceternity3DGlobePointLightIntensity: 99,
      aceternity3DGlobeLightingMode: "sun",
      aceternity3DGlobeEnablePan: true,
      aceternity3DGlobePanX: -999,
      aceternity3DGlobePanY: 999,
      aceternity3DGlobeShowTilt: false,
      aceternity3DGlobeShowAtmosphere: true,
      aceternity3DGlobeAtmosphereColor: "#4da6ff",
      aceternity3DGlobeAtmosphereIntensity: 99,
      aceternity3DGlobeAtmosphereBlur: 0,
      aceternity3DGlobeShowWireframe: true,
      aceternity3DGlobeWireframeColor: "#4a9eff",
      aceternity3DGlobeMarkerEnabled: true,
      aceternity3DGlobeMarkerLat: 999,
      aceternity3DGlobeMarkerLng: -999,
      aceternity3DGlobeMarkerLabel: longLabel,
      aceternity3DGlobeMarkerIcon: "heart",
      aceternity3DGlobeMarkerSize: 1,
    })

    assert.equal(settings.aceternity3DGlobeViewStyle, "graphic")
    assert.equal(settings.aceternity3DGlobeBackgroundColor, "#AABBCC")
    assert.equal(settings.aceternity3DGlobeGlobeColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGlobeColor)
    assert.equal(settings.aceternity3DGlobeGraphicMapColor, "#DDEEFF")
    assert.equal(settings.aceternity3DGlobeGraphicGlowColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicGlowColor)
    assert.equal(settings.aceternity3DGlobeGraphicMarkerColor, "#FB6415")
    assert.equal(settings.aceternity3DGlobeGraphicMapSamples, 10000)
    assert.equal(settings.aceternity3DGlobeAutoRotateSpeed, 2)
    assert.equal(settings.aceternity3DGlobeReverseSpin, true)
    assert.equal(settings.aceternity3DGlobeScale, 0.05)
    assert.equal(settings.aceternity3DGlobeBumpScale, 3)
    assert.equal(settings.aceternity3DGlobeAmbientIntensity, 0)
    assert.equal(settings.aceternity3DGlobePointLightIntensity, 4)
    assert.equal(settings.aceternity3DGlobeLightingMode, "sun")
    assert.equal(settings.aceternity3DGlobeEnablePan, true)
    assert.equal(settings.aceternity3DGlobePanX, -50)
    assert.equal(settings.aceternity3DGlobePanY, 50)
    assert.equal(settings.aceternity3DGlobeShowTilt, true)
    assert.equal(settings.aceternity3DGlobeShowAtmosphere, true)
    assert.equal(settings.aceternity3DGlobeAtmosphereColor, "#4DA6FF")
    assert.equal(settings.aceternity3DGlobeAtmosphereIntensity, 2)
    assert.equal(settings.aceternity3DGlobeAtmosphereBlur, 0.5)
    assert.equal(settings.aceternity3DGlobeShowWireframe, true)
    assert.equal(settings.aceternity3DGlobeWireframeColor, "#4A9EFF")
    assert.equal(settings.aceternity3DGlobeMarkerEnabled, true)
    assert.equal(settings.aceternity3DGlobeMarkerLat, 90)
    assert.equal(settings.aceternity3DGlobeMarkerLng, -180)
    assert.equal(settings.aceternity3DGlobeMarkerLabel, longLabel.slice(0, 80))
    assert.equal(settings.aceternity3DGlobeMarkerIcon, "heart")
    assert.equal(settings.aceternity3DGlobeMarkerSize, 0.16)
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeMarkerIcon: "bolt" }).aceternity3DGlobeMarkerIcon,
      DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerIcon,
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeShowAtmosphere: "yes" }).aceternity3DGlobeShowAtmosphere,
      DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeShowAtmosphere,
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeMarkerEnabled: "yes" }).aceternity3DGlobeMarkerEnabled,
      DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerEnabled,
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeMarkerLabel: "" }).aceternity3DGlobeMarkerLabel,
      "",
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeLightingMode: "auto" }).aceternity3DGlobeLightingMode,
      DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeLightingMode,
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeViewStyle: "wire" }).aceternity3DGlobeViewStyle,
      DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeViewStyle,
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeGraphicMapSamples: 100 }).aceternity3DGlobeGraphicMapSamples,
      1000,
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeEnablePan: "yes" }).aceternity3DGlobeEnablePan,
      DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeEnablePan,
    )
    assert.equal(
      sanitizeChimerSettings({ aceternity3DGlobeReverseSpin: "yes" }).aceternity3DGlobeReverseSpin,
      DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeReverseSpin,
    )
    assert.equal(sanitizeChimerSettings({ aceternity3DGlobeReverseSpin: false }).aceternity3DGlobeReverseSpin, true)
    assert.equal(sanitizeChimerSettings({ aceternity3DGlobeShowTilt: false }).aceternity3DGlobeShowTilt, true)
    assert.equal(getAceternity3DGlobeScaleDisplayPercent(0.05), 1)
    assert.equal(getAceternity3DGlobeScaleDisplayPercent(0.95), 100)
    assert.equal(getAceternity3DGlobeScaleFromDisplayPercent(1), 0.05)
    assert.equal(getAceternity3DGlobeScaleFromDisplayPercent(100), 0.95)
  })

  it("normalizes Magic UI Retro Grid background controls", () => {
    const settings = sanitizeChimerSettings({
      magicRetroGridBackgroundColor: "black",
      magicRetroGridLightLineColor: "#aabbcc",
      magicRetroGridDarkLineColor: "#112233",
      magicRetroGridAngle: 99,
      magicRetroGridCellSize: 2,
      magicRetroGridOpacity: 0,
    })

    assert.equal(settings.magicRetroGridBackgroundColor, DEFAULT_CHIMER_SETTINGS.magicRetroGridBackgroundColor)
    assert.equal(settings.magicRetroGridLightLineColor, "#AABBCC")
    assert.equal(settings.magicRetroGridDarkLineColor, "#112233")
    assert.equal(settings.magicRetroGridAngle, 89)
    assert.equal(settings.magicRetroGridCellSize, 12)
    assert.equal(settings.magicRetroGridOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ magicRetroGridAngle: "steep" }).magicRetroGridAngle,
      DEFAULT_CHIMER_SETTINGS.magicRetroGridAngle,
    )
    assert.equal(sanitizeChimerSettings({ magicRetroGridAngle: -10 }).magicRetroGridAngle, 1)
    assert.equal(
      sanitizeChimerSettings({ magicRetroGridCellSize: "wide" }).magicRetroGridCellSize,
      DEFAULT_CHIMER_SETTINGS.magicRetroGridCellSize,
    )
    assert.equal(sanitizeChimerSettings({ magicRetroGridCellSize: 999 }).magicRetroGridCellSize, 160)
    assert.equal(
      sanitizeChimerSettings({ magicRetroGridOpacity: "solid" }).magicRetroGridOpacity,
      DEFAULT_CHIMER_SETTINGS.magicRetroGridOpacity,
    )
    assert.equal(sanitizeChimerSettings({ magicRetroGridOpacity: 99 }).magicRetroGridOpacity, 1)
    assert.equal(
      sanitizeChimerSettings({ magicRetroGridLightLineColor: "gray" }).magicRetroGridLightLineColor,
      DEFAULT_CHIMER_SETTINGS.magicRetroGridLightLineColor,
    )
    assert.equal(
      sanitizeChimerSettings({ magicRetroGridDarkLineColor: "gray" }).magicRetroGridDarkLineColor,
      DEFAULT_CHIMER_SETTINGS.magicRetroGridDarkLineColor,
    )
  })

  it("normalizes Magic UI Light Rays background controls", () => {
    const settings = sanitizeChimerSettings({
      magicLightRaysBackgroundColor: "black",
      magicLightRaysColor: "#a0d2ff",
      magicLightRaysCount: 99,
      magicLightRaysBlur: 999,
      magicLightRaysSpeed: 0,
      magicLightRaysLength: 999,
      magicLightRaysOpacity: 0,
    })

    assert.equal(settings.magicLightRaysBackgroundColor, DEFAULT_CHIMER_SETTINGS.magicLightRaysBackgroundColor)
    assert.equal(settings.magicLightRaysColor, "#A0D2FF")
    assert.equal(settings.magicLightRaysCount, 20)
    assert.equal(settings.magicLightRaysBlur, 80)
    assert.equal(settings.magicLightRaysSpeed, 2)
    assert.equal(settings.magicLightRaysLength, 120)
    assert.equal(settings.magicLightRaysOpacity, 0.05)
    assert.equal(
      sanitizeChimerSettings({ magicLightRaysColor: "blue" }).magicLightRaysColor,
      DEFAULT_CHIMER_SETTINGS.magicLightRaysColor,
    )
    assert.equal(
      sanitizeChimerSettings({ magicLightRaysCount: "many" }).magicLightRaysCount,
      DEFAULT_CHIMER_SETTINGS.magicLightRaysCount,
    )
    assert.equal(sanitizeChimerSettings({ magicLightRaysCount: 0 }).magicLightRaysCount, 1)
    assert.equal(
      sanitizeChimerSettings({ magicLightRaysBlur: "soft" }).magicLightRaysBlur,
      DEFAULT_CHIMER_SETTINGS.magicLightRaysBlur,
    )
    assert.equal(sanitizeChimerSettings({ magicLightRaysBlur: -1 }).magicLightRaysBlur, 0)
    assert.equal(
      sanitizeChimerSettings({ magicLightRaysSpeed: "slow" }).magicLightRaysSpeed,
      DEFAULT_CHIMER_SETTINGS.magicLightRaysSpeed,
    )
    assert.equal(sanitizeChimerSettings({ magicLightRaysSpeed: 999 }).magicLightRaysSpeed, 40)
    assert.equal(
      sanitizeChimerSettings({ magicLightRaysLength: "long" }).magicLightRaysLength,
      DEFAULT_CHIMER_SETTINGS.magicLightRaysLength,
    )
    assert.equal(sanitizeChimerSettings({ magicLightRaysLength: 0 }).magicLightRaysLength, 24)
    assert.equal(
      sanitizeChimerSettings({ magicLightRaysOpacity: "bright" }).magicLightRaysOpacity,
      DEFAULT_CHIMER_SETTINGS.magicLightRaysOpacity,
    )
    assert.equal(sanitizeChimerSettings({ magicLightRaysOpacity: 9 }).magicLightRaysOpacity, 1)
  })

  it("normalizes Chamaac Synthesis background controls", () => {
    const settings = sanitizeChimerSettings({
      chamaacSynthesisPaletteMode: "harmony",
      chamaacSynthesisPrimaryColor: "#0ea5e9",
      chamaacSynthesisHarmony: "triad",
      chamaacSynthesisColorOne: "#0f172a",
      chamaacSynthesisColorTwo: "purple",
      chamaacSynthesisColorThree: "#0ea5e9",
      chamaacSynthesisSpeed: 99,
      chamaacSynthesisComplexity: 999,
      chamaacSynthesisScale: 0,
      chamaacSynthesisDistortion: -1,
      chamaacSynthesisGlowIntensity: 99,
      chamaacSynthesisFlowFrequency: 999,
    })

    assert.equal(settings.chamaacSynthesisPaletteMode, "harmony")
    assert.equal(settings.chamaacSynthesisPrimaryColor, "#0EA5E9")
    assert.equal(settings.chamaacSynthesisHarmony, "triad")
    assert.equal(settings.chamaacSynthesisColorOne, "#0F172A")
    assert.equal(settings.chamaacSynthesisColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisColorTwo)
    assert.equal(settings.chamaacSynthesisColorThree, "#0EA5E9")
    assert.equal(settings.chamaacSynthesisSpeed, 2)
    assert.equal(settings.chamaacSynthesisComplexity, 20)
    assert.equal(settings.chamaacSynthesisScale, 0.1)
    assert.equal(settings.chamaacSynthesisDistortion, 0)
    assert.equal(settings.chamaacSynthesisGlowIntensity, 2)
    assert.equal(settings.chamaacSynthesisFlowFrequency, 10)
    assert.equal(
      sanitizeChimerSettings({ chamaacSynthesisSpeed: "fast" }).chamaacSynthesisSpeed,
      DEFAULT_CHIMER_SETTINGS.chamaacSynthesisSpeed,
    )
    assert.equal(sanitizeChimerSettings({ chamaacSynthesisSpeed: 0 }).chamaacSynthesisSpeed, 0.004)
    assert.equal(
      sanitizeChimerSettings({ chamaacSynthesisPaletteMode: "demo" }).chamaacSynthesisPaletteMode,
      DEFAULT_CHIMER_SETTINGS.chamaacSynthesisPaletteMode,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacSynthesisPrimaryColor: "cyan" }).chamaacSynthesisPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.chamaacSynthesisPrimaryColor,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacSynthesisHarmony: "rainbow" }).chamaacSynthesisHarmony,
      DEFAULT_CHIMER_SETTINGS.chamaacSynthesisHarmony,
    )
    assert.equal(
      sanitizeChimerSettings({ chamaacSynthesisComplexity: "many" }).chamaacSynthesisComplexity,
      DEFAULT_CHIMER_SETTINGS.chamaacSynthesisComplexity,
    )
  })

  it("normalizes Lamp Section Header background controls", () => {
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
