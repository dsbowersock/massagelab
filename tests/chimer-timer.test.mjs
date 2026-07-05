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
