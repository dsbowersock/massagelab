import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  BACKGROUND_STORAGE_KEYS,
  DEFAULT_BACKGROUND_ID,
  normalizeBackgroundId,
} from "../lib/background-options.js"
import { FEATURE_KEYS } from "../lib/membership.js"
import {
  backgroundRegistry,
  canUseBackgroundId,
  getBackgroundOptionsForCategory,
  resolveAccessibleBackgroundDefinition,
} from "../components/backgrounds/backgroundRegistry.ts"

describe("premium background registry", () => {
  it("keeps the default background free and namespaced storage keys stable", () => {
    assert.equal(DEFAULT_BACKGROUND_ID, "massage-lab-moving-gradient")
    assert.equal(backgroundRegistry.find((entry) => entry.id === DEFAULT_BACKGROUND_ID)?.label, "MassageLaba Lamp")
    assert.equal(BACKGROUND_STORAGE_KEYS.chimer, "massagelab.chimer.background")
    assert.equal(BACKGROUND_STORAGE_KEYS.music, "massagelab.music.background")
    assert.equal(canUseBackgroundId(DEFAULT_BACKGROUND_ID, []), true)
    assert.equal(canUseBackgroundId("static-gradient", []), true)
    assert.equal(resolveAccessibleBackgroundDefinition("unknown", []).id, DEFAULT_BACKGROUND_ID)
  })

  it("gates active premium backgrounds behind premium background access", () => {
    for (const backgroundId of [
      "aceternity-aurora",
      "aceternity-dotted-glow",
      "aceternity-sparkles",
      "aceternity-gradient-animation",
      "aceternity-background-beams",
      "aceternity-background-beams-collision",
      "aceternity-background-lines",
      "aceternity-glowing-stars",
      "aceternity-meteors",
      "aceternity-shooting-stars",
      "aceternity-canvas-reveal-dots",
      "aceternity-spotlight-new",
      "aceternity-lamp-effect",
      "aceternity-vortex",
      "aceternity-wavy-background",
      "unlumen-pixel-liquid",
      "massage-lab-tile-grid",
      "massage-lab-hex-grid",
      "unlumen-aurora-bars",
      "animate-ui-bubble",
      "animate-ui-gradient",
      "animate-ui-stars",
      "animate-ui-hole",
      "chamaac-light-speed",
      "chamaac-electric-mist",
      "chamaac-astral-flow",
      "chamaac-synthesis",
    ]) {
      assert.equal(canUseBackgroundId(backgroundId, []), false)
      assert.equal(
        resolveAccessibleBackgroundDefinition(backgroundId, []).id,
        DEFAULT_BACKGROUND_ID,
      )
      assert.equal(canUseBackgroundId(backgroundId, [FEATURE_KEYS.premiumBackgrounds]), true)
      assert.equal(
        resolveAccessibleBackgroundDefinition(backgroundId, [FEATURE_KEYS.premiumBackgrounds]).id,
        backgroundId,
      )
      assert.equal(
        resolveAccessibleBackgroundDefinition(backgroundId, [FEATURE_KEYS.chimerCustomColors]).id,
        backgroundId,
      )
    }
  })

  it("keeps paused draft backgrounds unavailable even with premium access", () => {
    assert.equal(canUseBackgroundId("magic-noise-texture", [FEATURE_KEYS.premiumBackgrounds]), false)
    assert.equal(canUseBackgroundId("chamaac-waves", [FEATURE_KEYS.premiumBackgrounds]), false)
  })

  it("keeps Aurora Bars active only for subscribed users after license review", () => {
    const disabledIds = backgroundRegistry.filter((entry) => !entry.enabled).map((entry) => entry.id)

    assert.equal(disabledIds.includes("unlumen-aurora-bars"), false)
    assert.equal(canUseBackgroundId("unlumen-aurora-bars", [FEATURE_KEYS.premiumBackgrounds]), true)
    assert.equal(canUseBackgroundId("unlumen-aurora-bars", []), false)
  })

  it("documents heavier candidates as a later review queue", () => {
    const sourceDoc = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(sourceDoc, /Deferred Candidate Disposition Review/)
    assert.match(sourceDoc, /Paused Draft Candidates/)
    assert.match(sourceDoc, /not source-matched implementations/)
    assert.match(sourceDoc, /Disabled during reset/)
    assert.match(sourceDoc, /Add next/)
    assert.match(sourceDoc, /More review/)
    assert.match(sourceDoc, /User review required/)
    assert.doesNotMatch(sourceDoc, /Hold unless licensed/)
    assert.doesNotMatch(sourceDoc, /Remove from background backlog/)
    assert.match(sourceDoc, /explicitly queued for later review/)
    assert.match(sourceDoc, /license confirmation, bundle\/performance review, reduced-motion behavior, cleanup validation/)
    assert.match(sourceDoc, /verify the current React Bits license from a primary source/)
    assert.doesNotMatch(sourceDoc, /Ali Imam/)
    assert.match(sourceDoc, /Aceternity One-At-A-Time Review/)
    assert.match(sourceDoc, /Provider License Notes/)
    assert.match(sourceDoc, /Aceternity License was reviewed on 2026-07-02/)
    assert.match(sourceDoc, /Aurora background/)
    assert.match(sourceDoc, /Dotted glow background/)
    assert.match(sourceDoc, /Sparkles/)
    assert.match(sourceDoc, /Gradient animation/)
    assert.match(sourceDoc, /Background beams/)
    assert.match(sourceDoc, /Background beams with collision/)
    assert.match(sourceDoc, /Background lines/)
    assert.match(sourceDoc, /Glowing stars/)
    assert.match(sourceDoc, /Meteors/)
    assert.match(sourceDoc, /Shooting stars and stars background/)
    assert.match(sourceDoc, /Canvas reveal dots/)
    assert.match(sourceDoc, /Spotlight New/)
    assert.match(sourceDoc, /Lamp Section Header/)
    assert.match(sourceDoc, /Vortex background/)
    assert.match(sourceDoc, /Wavy background/)
    assert.match(sourceDoc, /Pixel liquid background/)
    assert.match(sourceDoc, /MassageLab tile grid/)
    assert.match(sourceDoc, /MassageLab hex grid/)
    assert.match(sourceDoc, /Aurora bars/)
    assert.match(sourceDoc, /Bubble background/)
    assert.match(sourceDoc, /Gradient background/)
    assert.match(sourceDoc, /Hole background/)
    assert.match(sourceDoc, /Light Speed/)
    assert.match(sourceDoc, /Electric Mist/)
    assert.match(sourceDoc, /Astral Flow/)
    assert.match(sourceDoc, /Synthesis/)
    assert.match(sourceDoc, /light-speed\.json/)
    assert.match(sourceDoc, /electric-mist\.json/)
    assert.match(sourceDoc, /astral-flow\.json/)
    assert.match(sourceDoc, /Warp speed/)
    assert.match(sourceDoc, /high-energy glowing lightning shader/)
    assert.match(sourceDoc, /breathing radial shader/)
    assert.match(sourceDoc, /multi-layer cosmic flow/)
    assert.match(sourceDoc, /Color 1, Color 2, Color 3, Animation Speed, Flow Min, and Flow Max/)
    assert.match(sourceDoc, /Color 1, Color 2, Color 3, Animation Speed, Complexity, Zoom Scale, Distortion, Glow Intensity, and Flow Frequency/)
    assert.match(sourceDoc, /Animate UI/)
    assert.match(sourceDoc, /MIT \+ Commons Clause/)
    assert.match(sourceDoc, /Cursor interactivity and the sixth mouse-following bubble are intentionally omitted/)
    assert.match(sourceDoc, /components-backgrounds-gradient\.json/)
    assert.match(sourceDoc, /primary color, color harmony, and layer opacity/)
    assert.match(sourceDoc, /components-backgrounds-stars\.json/)
    assert.match(sourceDoc, /star color, speed, density, and parallax strength/)
    assert.match(sourceDoc, /components-backgrounds-hole\.json/)
    assert.match(sourceDoc, /stroke color, particle color, line count, and disc count/)
    assert.match(sourceDoc, /Enabled premium option/)
    assert.doesNotMatch(sourceDoc, /Square pattern \/ Pixel/)
  })

  it("filters options by category for Chimer and music surfaces", () => {
    const chimerOptions = getBackgroundOptionsForCategory("chimer").map((entry) => entry.id)
    const clockOptions = getBackgroundOptionsForCategory("clock").map((entry) => entry.id)
    const musicOptions = getBackgroundOptionsForCategory("music").map((entry) => entry.id)

    assert.ok(chimerOptions.includes(DEFAULT_BACKGROUND_ID))
    assert.ok(chimerOptions.includes("static-gradient"))
    assert.ok(musicOptions.includes(DEFAULT_BACKGROUND_ID))
    assert.ok(musicOptions.includes("static-gradient"))
    assert.ok(chimerOptions.includes("aceternity-aurora"))
    assert.ok(chimerOptions.includes("aceternity-dotted-glow"))
    assert.ok(chimerOptions.includes("aceternity-sparkles"))
    assert.ok(chimerOptions.includes("aceternity-gradient-animation"))
    assert.ok(chimerOptions.includes("aceternity-background-beams"))
    assert.ok(chimerOptions.includes("aceternity-background-beams-collision"))
    assert.ok(chimerOptions.includes("aceternity-background-lines"))
    assert.ok(chimerOptions.includes("aceternity-glowing-stars"))
    assert.ok(chimerOptions.includes("aceternity-meteors"))
    assert.ok(chimerOptions.includes("aceternity-shooting-stars"))
    assert.ok(chimerOptions.includes("aceternity-canvas-reveal-dots"))
    assert.ok(chimerOptions.includes("aceternity-spotlight-new"))
    assert.ok(chimerOptions.includes("aceternity-lamp-effect"))
    assert.ok(chimerOptions.includes("aceternity-vortex"))
    assert.ok(chimerOptions.includes("aceternity-wavy-background"))
    assert.ok(chimerOptions.includes("unlumen-pixel-liquid"))
    assert.ok(chimerOptions.includes("massage-lab-tile-grid"))
    assert.ok(chimerOptions.includes("massage-lab-hex-grid"))
    assert.ok(chimerOptions.includes("unlumen-aurora-bars"))
    assert.ok(chimerOptions.includes("animate-ui-bubble"))
    assert.ok(chimerOptions.includes("animate-ui-gradient"))
    assert.ok(chimerOptions.includes("animate-ui-stars"))
    assert.ok(chimerOptions.includes("animate-ui-hole"))
    assert.ok(chimerOptions.includes("chamaac-light-speed"))
    assert.ok(chimerOptions.includes("chamaac-electric-mist"))
    assert.ok(chimerOptions.includes("chamaac-astral-flow"))
    assert.ok(chimerOptions.includes("chamaac-synthesis"))
    assert.ok(clockOptions.includes("aceternity-dotted-glow"))
    assert.ok(clockOptions.includes("aceternity-sparkles"))
    assert.ok(clockOptions.includes("aceternity-gradient-animation"))
    assert.ok(clockOptions.includes("aceternity-background-beams"))
    assert.ok(clockOptions.includes("aceternity-background-beams-collision"))
    assert.ok(clockOptions.includes("aceternity-background-lines"))
    assert.ok(clockOptions.includes("aceternity-glowing-stars"))
    assert.ok(clockOptions.includes("aceternity-meteors"))
    assert.ok(clockOptions.includes("aceternity-shooting-stars"))
    assert.ok(clockOptions.includes("aceternity-canvas-reveal-dots"))
    assert.ok(clockOptions.includes("aceternity-spotlight-new"))
    assert.ok(clockOptions.includes("aceternity-lamp-effect"))
    assert.ok(clockOptions.includes("aceternity-vortex"))
    assert.ok(clockOptions.includes("aceternity-wavy-background"))
    assert.ok(clockOptions.includes("unlumen-pixel-liquid"))
    assert.ok(clockOptions.includes("massage-lab-tile-grid"))
    assert.ok(clockOptions.includes("massage-lab-hex-grid"))
    assert.ok(clockOptions.includes("unlumen-aurora-bars"))
    assert.ok(clockOptions.includes("animate-ui-bubble"))
    assert.ok(clockOptions.includes("animate-ui-gradient"))
    assert.ok(clockOptions.includes("animate-ui-stars"))
    assert.ok(clockOptions.includes("animate-ui-hole"))
    assert.ok(clockOptions.includes("chamaac-light-speed"))
    assert.ok(clockOptions.includes("chamaac-electric-mist"))
    assert.ok(clockOptions.includes("chamaac-astral-flow"))
    assert.ok(clockOptions.includes("chamaac-synthesis"))
    assert.ok(musicOptions.includes("aceternity-aurora"))
    assert.ok(musicOptions.includes("aceternity-dotted-glow"))
    assert.ok(musicOptions.includes("aceternity-sparkles"))
    assert.ok(musicOptions.includes("aceternity-gradient-animation"))
    assert.ok(musicOptions.includes("aceternity-background-beams"))
    assert.ok(musicOptions.includes("aceternity-background-beams-collision"))
    assert.ok(musicOptions.includes("aceternity-background-lines"))
    assert.ok(musicOptions.includes("aceternity-glowing-stars"))
    assert.ok(musicOptions.includes("aceternity-meteors"))
    assert.ok(musicOptions.includes("aceternity-shooting-stars"))
    assert.ok(musicOptions.includes("aceternity-canvas-reveal-dots"))
    assert.ok(musicOptions.includes("aceternity-spotlight-new"))
    assert.ok(musicOptions.includes("aceternity-lamp-effect"))
    assert.ok(musicOptions.includes("aceternity-vortex"))
    assert.ok(musicOptions.includes("aceternity-wavy-background"))
    assert.ok(musicOptions.includes("unlumen-pixel-liquid"))
    assert.ok(musicOptions.includes("massage-lab-tile-grid"))
    assert.ok(musicOptions.includes("massage-lab-hex-grid"))
    assert.ok(musicOptions.includes("unlumen-aurora-bars"))
    assert.ok(musicOptions.includes("animate-ui-bubble"))
    assert.ok(musicOptions.includes("animate-ui-gradient"))
    assert.ok(musicOptions.includes("animate-ui-stars"))
    assert.ok(musicOptions.includes("animate-ui-hole"))
    assert.ok(musicOptions.includes("chamaac-light-speed"))
    assert.ok(musicOptions.includes("chamaac-electric-mist"))
    assert.ok(musicOptions.includes("chamaac-astral-flow"))
    assert.ok(musicOptions.includes("chamaac-synthesis"))
    assert.equal(chimerOptions.includes("magic-noise-texture"), false)
    assert.equal(normalizeBackgroundId("missing"), DEFAULT_BACKGROUND_ID)
  })

  it("keeps the MassageLab tile grid deterministic and fade-time driven", () => {
    const source = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-tile-grid-background.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const fadeControlSource = readFileSync(
      new URL("../app/chimer/tile-grid-fade-time-control.tsx", import.meta.url),
      "utf8",
    )

    assert.doesNotMatch(source, /Math\.random/)
    assert.doesNotMatch(source, /activeCount/)
    assert.doesNotMatch(source, /nextChangeAt/)
    assert.doesNotMatch(source, /resolveTileGridOptions\(tileGrid\), \[tileGrid\]/)
    assert.match(source, /tileGrid\?\.changeFrequency/)
    assert.match(source, /tileGrid\?\.opacity/)
    assert.match(source, /return changeFrequency \* 1000/)
    assert.match(source, /const cycleDuration = fadeDuration \/ activeFraction/)
    assert.match(setupSource, /TileGridFadeTimeControl/)
    assert.match(runningSource, /TileGridFadeTimeControl/)
    assert.match(fadeControlSource, /Fade time \(/)
    assert.match(fadeControlSource, /Tile grid fade hours/)
    assert.match(fadeControlSource, /Tile grid fade minutes/)
    assert.match(fadeControlSource, /Tile grid fade seconds/)
    assert.doesNotMatch(setupSource, /Change interval/)
    assert.doesNotMatch(runningSource, /Change interval/)
  })

  it("keeps the MassageLab hex grid deterministic and harmony/fade-time driven", () => {
    const source = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-hex-grid-background.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(source, /Math\.random/)
    assert.doesNotMatch(source, /activeCount/)
    assert.doesNotMatch(source, /nextChangeAt/)
    assert.doesNotMatch(source, /resolveHexGridOptions\(hexGrid\), \[hexGrid\]/)
    assert.match(source, /hexGrid\?\.changeFrequency/)
    assert.match(source, /hexGrid\?\.harmony/)
    assert.match(source, /return changeFrequency \* 1000/)
    assert.match(source, /const cycleDuration = fadeDuration \/ activeFraction/)
    assert.match(setupSource, /massage-lab-hex-grid/)
    assert.match(setupSource, /COLOR_HARMONY_OPTIONS/)
    assert.match(setupSource, /hexGridChangeFrequency/)
    assert.match(runningSource, /massage-lab-hex-grid/)
    assert.match(runningSource, /COLOR_HARMONY_OPTIONS/)
    assert.match(runningSource, /hexGridChangeFrequency/)
    assert.match(runningSource, /hexGrid=\{\{/)
  })

  it("keeps Aurora Bars dependency-free and reactive only from Music playback", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/unlumen-aurora-bars-background.tsx", import.meta.url),
      "utf8",
    )
    const musicWorkspaceSource = readFileSync(new URL("../app/browse/workspace.tsx", import.meta.url), "utf8")
    const chimerPageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const chimerRunningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const setupControlsSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(effectSource, /from "motion"/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /visualizerActive/)
    assert.match(effectSource, /createMonochromaticPalette/)
    assert.match(musicWorkspaceSource, /backgroundId === "unlumen-aurora-bars"/)
    assert.match(musicWorkspaceSource, /music\.playbackState === "playing"/)
    assert.match(chimerRunningSource, /auroraBars=\{\{/)
    assert.doesNotMatch(chimerPageSource, /auroraBars=\{\{/)
    assert.match(setupControlsSource, /Auto monochrome/)
    assert.match(chimerRunningSource, /Auto monochrome/)
    for (const settingKey of [
      "auroraBarsBackgroundColor",
      "auroraBarsPaletteMode",
      "auroraBarsPrimaryColor",
      "auroraBarsColorOne",
      "auroraBarsColorTwo",
      "auroraBarsColorThree",
      "auroraBarsColorFour",
      "auroraBarsColorFive",
      "auroraBarsBarCount",
      "auroraBarsSpeed",
      "auroraBarsBlur",
      "auroraBarsGap",
      "auroraBarsMaxHeightRatio",
      "auroraBarsMinHeightRatio",
    ]) {
      assert.match(setupControlsSource, new RegExp(settingKey))
      assert.match(chimerRunningSource, new RegExp(settingKey))
    }
    assert.doesNotMatch(chimerPageSource, /visualizerActive:\s*true/)
    assert.doesNotMatch(chimerRunningSource, /visualizerActive:\s*true/)
  })

  it("keeps Chamaac Light Speed source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-light-speed-background.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )
    const hostSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
      "utf8",
    )
    const stylesSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /chamaac-light-speed/)
    assert.match(registrySource, /Light Speed/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /ChamaacLightSpeedBackground/)
    assert.match(effectSource, /particleCount: 200/)
    assert.match(effectSource, /warpSpeed: 1/)
    assert.match(effectSource, /CHAMAAC_LIGHT_SPEED_RENDER_SCALE = 0\.1/)
    assert.match(effectSource, /lightColor/)
    assert.match(effectSource, /intensity/)
    assert.match(effectSource, /radius/)
    assert.match(effectSource, /cylinderLength/)
    assert.match(effectSource, /createLinearGradient/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /chamaacLightSpeed/)
    assert.match(hostSource, /chamaacLightSpeed/)
    assert.match(runningSource, /chamaacLightSpeed=\{\{/)
    assert.doesNotMatch(pageSource, /chamaacLightSpeed=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /rgba\(255, 255, 255/)
    assert.doesNotMatch(effectSource, /context\.arc\(head\.x/)
    for (const settingKey of [
      "chamaacLightSpeedWarpSpeed",
      "chamaacLightSpeedParticleCount",
      "chamaacLightSpeedLightColor",
      "chamaacLightSpeedIntensity",
      "chamaacLightSpeedRadius",
      "chamaacLightSpeedCylinderLength",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Chamaac Electric Mist source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-electric-mist-background.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )
    const hostSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
      "utf8",
    )
    const stylesSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /chamaac-electric-mist/)
    assert.match(registrySource, /Electric Mist/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /ChamaacElectricMistBackground/)
    assert.match(effectSource, /color: "#191970"/)
    assert.match(effectSource, /speed: 100/)
    assert.match(effectSource, /detail: 1\.5/)
    assert.match(effectSource, /distortion: 3/)
    assert.match(effectSource, /brightness: 100/)
    assert.match(effectSource, /electricMask/)
    assert.match(effectSource, /options\.speed \/ 100/)
    assert.match(effectSource, /options\.brightness \/ 100/)
    assert.doesNotMatch(effectSource, /sin\(bp\.x/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /uDetail/)
    assert.match(effectSource, /uDistortion/)
    assert.match(effectSource, /uBrightness/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /chamaacElectricMist/)
    assert.match(hostSource, /chamaacElectricMist/)
    assert.match(runningSource, /chamaacElectricMist=\{\{/)
    assert.doesNotMatch(pageSource, /chamaacElectricMist=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    for (const settingKey of [
      "chamaacElectricMistColor",
      "chamaacElectricMistSpeed",
      "chamaacElectricMistDetail",
      "chamaacElectricMistDistortion",
      "chamaacElectricMistBrightness",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Chamaac Astral Flow source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-astral-flow-background.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )
    const hostSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
      "utf8",
    )
    const stylesSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /chamaac-astral-flow/)
    assert.match(registrySource, /Astral Flow/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /ChamaacAstralFlowBackground/)
    assert.match(effectSource, /color1: "#05070A"/)
    assert.match(effectSource, /color2: "#2E1A38"/)
    assert.match(effectSource, /color3: "#A0769A"/)
    assert.match(effectSource, /speed: 1\.5/)
    assert.match(effectSource, /flowMin: 3/)
    assert.match(effectSource, /flowMax: 7/)
    assert.match(effectSource, /snoise/)
    assert.match(effectSource, /fbm/)
    assert.match(effectSource, /uFlowMin/)
    assert.match(effectSource, /uFlowMax/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /chamaacAstralFlowNoise/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /chamaacAstralFlow/)
    assert.match(hostSource, /chamaacAstralFlow/)
    assert.match(runningSource, /chamaacAstralFlow=\{\{/)
    assert.match(runningSource, /resolveChamaacAstralFlowColors/)
    assert.match(setupSource, /getChamaacAstralFlowDisplaySpeed/)
    assert.match(setupSource, /getChamaacAstralFlowSourceSpeed/)
    assert.match(setupSource, /CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MIN = 0\.1/)
    assert.match(setupSource, /CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MAX = 3/)
    assert.match(setupSource, /CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN = 10/)
    assert.match(setupSource, /CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /chamaacAstralFlow=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    for (const settingKey of [
      "chamaacAstralFlowColorOne",
      "chamaacAstralFlowColorTwo",
      "chamaacAstralFlowColorThree",
      "chamaacAstralFlowPaletteMode",
      "chamaacAstralFlowPrimaryColor",
      "chamaacAstralFlowHarmony",
      "chamaacAstralFlowSpeed",
      "chamaacAstralFlowFlowMin",
      "chamaacAstralFlowFlowMax",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Chamaac Synthesis source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-synthesis-background.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )
    const hostSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
      "utf8",
    )
    const stylesSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /chamaac-synthesis/)
    assert.match(registrySource, /Synthesis/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /ChamaacSynthesisBackground/)
    assert.match(effectSource, /color1: "#0F172A"/)
    assert.match(effectSource, /color2: "#3B0764"/)
    assert.match(effectSource, /color3: "#0EA5E9"/)
    assert.match(effectSource, /speed: 0\.4/)
    assert.match(effectSource, /complexity: 6/)
    assert.match(effectSource, /scale: 1/)
    assert.match(effectSource, /distortion: 0\.6/)
    assert.match(effectSource, /glowIntensity: 0\.4/)
    assert.match(effectSource, /flowFrequency: 3/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /uComplexity/)
    assert.match(effectSource, /smoothstep/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /chamaacSynthesis/)
    assert.match(hostSource, /chamaacSynthesis/)
    assert.match(runningSource, /chamaacSynthesis=\{\{/)
    assert.match(runningSource, /resolveChamaacSynthesisColors/)
    assert.match(setupSource, /getChamaacSynthesisDisplaySpeed/)
    assert.match(setupSource, /getChamaacSynthesisSourceSpeed/)
    assert.doesNotMatch(pageSource, /chamaacSynthesis=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    assert.doesNotMatch(effectSource, /seededFraction/)
    for (const settingKey of [
      "chamaacSynthesisColorOne",
      "chamaacSynthesisColorTwo",
      "chamaacSynthesisColorThree",
      "chamaacSynthesisPaletteMode",
      "chamaacSynthesisPrimaryColor",
      "chamaacSynthesisHarmony",
      "chamaacSynthesisSpeed",
      "chamaacSynthesisComplexity",
      "chamaacSynthesisScale",
      "chamaacSynthesisDistortion",
      "chamaacSynthesisGlowIntensity",
      "chamaacSynthesisFlowFrequency",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps selected visual backgrounds off the Chimer setup page", () => {
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(pageSource, /<BackgroundHost/)
    assert.doesNotMatch(pageSource, /<MovingBackground/)
    assert.doesNotMatch(pageSource, /chimer-setup-background/)
    assert.match(runningSource, /<BackgroundHost/)
    assert.match(runningSource, /<MovingBackground/)
  })

  it("keeps Animate UI Bubble non-interactive and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )

    assert.match(registrySource, /animate-ui-bubble/)
    assert.match(registrySource, /cursor interactivity and the sixth mouse-following bubble are intentionally omitted/)
    assert.match(effectSource, /AnimateUiBubbleBackground/)
    assert.match(effectSource, /Cursor interaction from the source component is intentionally omitted/)
    assert.match(effectSource, /ml-bubble-goo/)
    assert.match(effectSource, /bubbleOrbFive/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /AnimateUiBubbleBackground[\s\S]*pointermove[\s\S]*AnimateUiGradientBackground/)
  })

  it("keeps Animate UI Gradient customizable and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )
    const stylesSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /animate-ui-gradient/)
    assert.match(registrySource, /Gradient background/)
    assert.match(registrySource, /MIT \+ Commons Clause/)
    assert.match(effectSource, /AnimateUiGradientBackground/)
    assert.match(effectSource, /createAnimateUiGradientPalette/)
    assert.match(effectSource, /split-complementary/)
    assert.match(effectSource, /monochromatic/)
    assert.match(stylesSource, /mlAnimateUiGradientShift/)
    assert.match(effectSource, /--ml-animate-gradient-opacity/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    for (const settingKey of [
      "animateUiGradientPrimaryColor",
      "animateUiGradientHarmony",
      "animateUiGradientOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Animate UI Stars source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )
    const stylesSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
      "utf8",
    )
    const hostSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /animate-ui-stars/)
    assert.match(registrySource, /Stars background/)
    assert.match(registrySource, /MIT \+ Commons Clause/)
    assert.match(effectSource, /AnimateUiStarsBackground/)
    assert.match(effectSource, /buildAnimateUiStarsShadow/)
    assert.match(effectSource, /1000 \* resolved\.density/)
    assert.match(effectSource, /400 \* resolved\.density/)
    assert.match(effectSource, /200 \* resolved\.density/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(stylesSource, /mlAnimateUiStarsDrift/)
    assert.match(stylesSource, /top: 2000px/)
    assert.match(hostSource, /animateUiStars/)
    assert.match(runningSource, /animateUiStars=\{\{/)
    assert.doesNotMatch(pageSource, /animateUiStars=\{\{/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    for (const settingKey of [
      "animateUiStarsColor",
      "animateUiStarsSpeed",
      "animateUiStarsDensity",
      "animateUiStarsParallax",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Animate UI Hole customizable, cleaned up, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )
    const stylesSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
      "utf8",
    )
    const hostSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /animate-ui-hole/)
    assert.match(registrySource, /Hole background/)
    assert.match(registrySource, /MIT \+ Commons Clause/)
    assert.match(effectSource, /AnimateUiHoleBackground/)
    assert.match(effectSource, /Path2D/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /numberOfLines/)
    assert.match(effectSource, /numberOfDiscs/)
    assert.match(effectSource, /particleColor/)
    assert.match(stylesSource, /mlAnimateUiHoleGlow/)
    assert.match(hostSource, /animateUiHole/)
    assert.match(runningSource, /animateUiHole=\{\{/)
    assert.doesNotMatch(pageSource, /animateUiHole=\{\{/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    for (const settingKey of [
      "animateUiHoleStrokeColor",
      "animateUiHoleParticleColor",
      "animateUiHoleLineCount",
      "animateUiHoleDiscCount",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })
})
