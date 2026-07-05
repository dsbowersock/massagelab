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
      "aceternity-3d-globe",
      "unlumen-pixel-liquid",
      "massage-lab-tile-grid",
      "massage-lab-hex-grid",
      "magicui-retro-grid",
      "magicui-light-rays",
      "unlumen-aurora-bars",
      "animate-ui-bubble",
      "animate-ui-gradient",
      "animate-ui-stars",
      "animate-ui-hole",
      "chamaac-light-speed",
      "chamaac-electric-mist",
      "chamaac-astral-flow",
      "chamaac-deep-space-nebula",
      "chamaac-grid-bloom",
      "chamaac-liquid-chrome",
      "chamaac-waves",
      "chamaac-synthesis",
      "react-bits-ferrofluid",
      "react-bits-lightfall",
      "react-bits-liquid-ether",
      "react-bits-prism",
      "eldora-novatrix-background",
      "eldora-hacker-background",
      "eldora-photon-beam",
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
    assert.match(sourceDoc, /3D Globe/)
    assert.match(sourceDoc, /Pixel liquid background/)
    assert.match(sourceDoc, /MassageLab tile grid/)
    assert.match(sourceDoc, /MassageLab hex grid/)
    assert.match(sourceDoc, /Light Rays/)
    assert.match(sourceDoc, /Aurora bars/)
    assert.match(sourceDoc, /Bubble background/)
    assert.match(sourceDoc, /Gradient background/)
    assert.match(sourceDoc, /Hole background/)
    assert.match(sourceDoc, /Light Speed/)
    assert.match(sourceDoc, /Electric Mist/)
    assert.match(sourceDoc, /Astral Flow/)
    assert.match(sourceDoc, /Deep Space Nebula/)
    assert.match(sourceDoc, /Grid Bloom/)
    assert.match(sourceDoc, /Waves/)
    assert.match(sourceDoc, /Synthesis/)
    assert.match(sourceDoc, /Novatrix Background/)
    assert.match(sourceDoc, /Hacker Background/)
    assert.match(sourceDoc, /Photon Beam/)
    assert.match(sourceDoc, /Ferrofluid/)
    assert.match(sourceDoc, /Liquid Ether/)
    assert.match(sourceDoc, /Prism/)
    assert.match(sourceDoc, /light-speed\.json/)
    assert.match(sourceDoc, /electric-mist\.json/)
    assert.match(sourceDoc, /astral-flow\.json/)
    assert.match(sourceDoc, /nebula\.json/)
    assert.match(sourceDoc, /grid-bloom\.json/)
    assert.match(sourceDoc, /waves\.json/)
    assert.match(sourceDoc, /novatrix-background\.json/)
    assert.match(sourceDoc, /hacker-background\.tsx/)
    assert.match(sourceDoc, /photon-beam\.tsx/)
    assert.match(sourceDoc, /Ferrofluid\.jsx/)
    assert.match(sourceDoc, /Lightfall\.jsx/)
    assert.match(sourceDoc, /LiquidEther\.jsx/)
    assert.match(sourceDoc, /LiquidEther\.css/)
    assert.match(sourceDoc, /Prism\.jsx/)
    assert.match(sourceDoc, /Prism\.css/)
    assert.match(sourceDoc, /reactbits\.dev\/backgrounds\/ferrofluid/)
    assert.match(sourceDoc, /reactbits\.dev\/backgrounds\/lightfall/)
    assert.match(sourceDoc, /reactbits\.dev\/backgrounds\/liquid-ether/)
    assert.match(sourceDoc, /reactbits\.dev\/backgrounds\/prism/)
    assert.match(sourceDoc, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(sourceDoc, /cursor interaction is intentionally omitted/)
    assert.match(sourceDoc, /light-rays\.tsx/)
    assert.match(sourceDoc, /3d-globe\.json/)
    assert.match(sourceDoc, /realistic globe component with tooltips and avatar tips/)
    assert.match(sourceDoc, /@react-three\/drei/)
    assert.match(sourceDoc, /icon-based user marker/)
    assert.match(sourceDoc, /dependency-free native WebGL sphere renderer/)
    assert.match(sourceDoc, /`count`, `color`, `blur`, `opacity`, `speed`, and `length`/)
    assert.match(sourceDoc, /dependency-free CSS keyframes/)
    assert.match(sourceDoc, /declares `ogl`/)
    assert.match(sourceDoc, /Matrix-style falling characters background animation component/)
    assert.match(sourceDoc, /`color`, `fontSize`, and `speed`/)
    assert.match(sourceDoc, /WebGL background with animated light trails, bloom, and customizable colors/)
    assert.match(sourceDoc, /`colorBg`, `colorLine`, `colorSignal`/)
    assert.match(sourceDoc, /`lineCount`, `spreadHeight`, `spreadDepth`/)
    assert.match(sourceDoc, /`bloomStrength`, and `bloomRadius`/)
    assert.match(sourceDoc, /importing `three` plus postprocessing passes/)
    assert.match(sourceDoc, /source `0\.02`-`3`/)
    assert.match(sourceDoc, /source `0\.02`-`2` internally while displaying `1%`-`100%`/)
    assert.match(sourceDoc, /source `0\.01`-`0\.45`/)
    assert.match(sourceDoc, /source `0\.05`-`3` internally while displaying `1%`-`100%`/)
    assert.match(sourceDoc, /Warp speed/)
    assert.match(sourceDoc, /high-energy glowing lightning shader/)
    assert.match(sourceDoc, /breathing radial shader/)
    assert.match(sourceDoc, /deep-space nebula effect with fractional distortion/)
    assert.match(sourceDoc, /shader-driven grid pattern with pulsing wave interference/)
    assert.match(sourceDoc, /smooth shader-based wave animation/)
    assert.match(sourceDoc, /multi-layer cosmic flow/)
    assert.match(sourceDoc, /Color 1, Color 2, Color 3, Animation Speed, Flow Min, and Flow Max/)
    assert.match(sourceDoc, /source `0\.1`-`5` range internally while displaying it as `1%`-`100%`/)
    assert.match(sourceDoc, /source `0\.1`-`3` range internally while displaying it as `1%`-`100%`/)
    assert.match(sourceDoc, /source `0\.001`-`0\.1` range internally while displaying it as `1%`-`100%`/)
    assert.match(sourceDoc, /cursor interaction and hover controls are intentionally omitted/)
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
    assert.ok(chimerOptions.includes("aceternity-3d-globe"))
    assert.ok(chimerOptions.includes("unlumen-pixel-liquid"))
    assert.ok(chimerOptions.includes("massage-lab-tile-grid"))
    assert.ok(chimerOptions.includes("massage-lab-hex-grid"))
    assert.ok(chimerOptions.includes("magicui-retro-grid"))
    assert.ok(chimerOptions.includes("magicui-light-rays"))
    assert.ok(chimerOptions.includes("unlumen-aurora-bars"))
    assert.ok(chimerOptions.includes("animate-ui-bubble"))
    assert.ok(chimerOptions.includes("animate-ui-gradient"))
    assert.ok(chimerOptions.includes("animate-ui-stars"))
    assert.ok(chimerOptions.includes("animate-ui-hole"))
    assert.ok(chimerOptions.includes("chamaac-light-speed"))
    assert.ok(chimerOptions.includes("chamaac-electric-mist"))
    assert.ok(chimerOptions.includes("chamaac-astral-flow"))
    assert.ok(chimerOptions.includes("chamaac-deep-space-nebula"))
    assert.ok(chimerOptions.includes("chamaac-grid-bloom"))
    assert.ok(chimerOptions.includes("chamaac-liquid-chrome"))
    assert.ok(chimerOptions.includes("chamaac-waves"))
    assert.ok(chimerOptions.includes("chamaac-synthesis"))
    assert.ok(chimerOptions.includes("eldora-novatrix-background"))
    assert.ok(chimerOptions.includes("eldora-hacker-background"))
    assert.ok(chimerOptions.includes("eldora-photon-beam"))
    assert.ok(chimerOptions.includes("react-bits-liquid-ether"))
    assert.ok(chimerOptions.includes("react-bits-prism"))
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
    assert.ok(clockOptions.includes("aceternity-3d-globe"))
    assert.ok(clockOptions.includes("unlumen-pixel-liquid"))
    assert.ok(clockOptions.includes("massage-lab-tile-grid"))
    assert.ok(clockOptions.includes("massage-lab-hex-grid"))
    assert.ok(clockOptions.includes("magicui-retro-grid"))
    assert.ok(clockOptions.includes("magicui-light-rays"))
    assert.ok(clockOptions.includes("unlumen-aurora-bars"))
    assert.ok(clockOptions.includes("animate-ui-bubble"))
    assert.ok(clockOptions.includes("animate-ui-gradient"))
    assert.ok(clockOptions.includes("animate-ui-stars"))
    assert.ok(clockOptions.includes("animate-ui-hole"))
    assert.ok(clockOptions.includes("chamaac-light-speed"))
    assert.ok(clockOptions.includes("chamaac-electric-mist"))
    assert.ok(clockOptions.includes("chamaac-astral-flow"))
    assert.ok(clockOptions.includes("chamaac-deep-space-nebula"))
    assert.ok(clockOptions.includes("chamaac-grid-bloom"))
    assert.ok(clockOptions.includes("chamaac-liquid-chrome"))
    assert.ok(clockOptions.includes("chamaac-waves"))
    assert.ok(clockOptions.includes("chamaac-synthesis"))
    assert.ok(clockOptions.includes("eldora-novatrix-background"))
    assert.ok(clockOptions.includes("eldora-hacker-background"))
    assert.ok(clockOptions.includes("eldora-photon-beam"))
    assert.ok(clockOptions.includes("react-bits-liquid-ether"))
    assert.ok(clockOptions.includes("react-bits-prism"))
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
    assert.ok(musicOptions.includes("aceternity-3d-globe"))
    assert.ok(musicOptions.includes("unlumen-pixel-liquid"))
    assert.ok(musicOptions.includes("massage-lab-tile-grid"))
    assert.ok(musicOptions.includes("massage-lab-hex-grid"))
    assert.ok(musicOptions.includes("magicui-retro-grid"))
    assert.ok(musicOptions.includes("magicui-light-rays"))
    assert.ok(musicOptions.includes("unlumen-aurora-bars"))
    assert.ok(musicOptions.includes("animate-ui-bubble"))
    assert.ok(musicOptions.includes("animate-ui-gradient"))
    assert.ok(musicOptions.includes("animate-ui-stars"))
    assert.ok(musicOptions.includes("animate-ui-hole"))
    assert.ok(musicOptions.includes("chamaac-light-speed"))
    assert.ok(musicOptions.includes("chamaac-electric-mist"))
    assert.ok(musicOptions.includes("chamaac-astral-flow"))
    assert.ok(musicOptions.includes("chamaac-deep-space-nebula"))
    assert.ok(musicOptions.includes("chamaac-grid-bloom"))
    assert.ok(musicOptions.includes("chamaac-liquid-chrome"))
    assert.ok(musicOptions.includes("chamaac-waves"))
    assert.ok(musicOptions.includes("chamaac-synthesis"))
    assert.ok(musicOptions.includes("eldora-novatrix-background"))
    assert.ok(musicOptions.includes("eldora-hacker-background"))
    assert.ok(musicOptions.includes("eldora-photon-beam"))
    assert.ok(musicOptions.includes("react-bits-liquid-ether"))
    assert.ok(musicOptions.includes("react-bits-prism"))
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

  it("keeps Chamaac Deep Space Nebula source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-deep-space-nebula-background.tsx", import.meta.url),
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

    assert.match(registrySource, /chamaac-deep-space-nebula/)
    assert.match(registrySource, /Deep Space Nebula/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /ChamaacDeepSpaceNebulaBackground/)
    assert.match(effectSource, /color1: "#5EFFF4"/)
    assert.match(effectSource, /color2: "#763B65"/)
    assert.match(effectSource, /color3: "#1A0B2E"/)
    assert.match(effectSource, /speed: 2/)
    assert.match(effectSource, /random/)
    assert.match(effectSource, /noise/)
    assert.match(effectSource, /fbm/)
    assert.match(effectSource, /uSpeed/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /1000 \/ 30/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /chamaacDeepSpaceNebula/)
    assert.match(hostSource, /chamaacDeepSpaceNebula/)
    assert.match(runningSource, /chamaacDeepSpaceNebula=\{\{/)
    assert.match(runningSource, /resolveChamaacDeepSpaceNebulaColors/)
    assert.match(setupSource, /getChamaacDeepSpaceNebulaDisplaySpeed/)
    assert.match(setupSource, /getChamaacDeepSpaceNebulaSourceSpeed/)
    assert.match(setupSource, /CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN = 0\.1/)
    assert.match(setupSource, /CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX = 5/)
    assert.match(setupSource, /CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN = 1/)
    assert.match(setupSource, /CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /chamaacDeepSpaceNebula=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    for (const settingKey of [
      "chamaacDeepSpaceNebulaColorOne",
      "chamaacDeepSpaceNebulaColorTwo",
      "chamaacDeepSpaceNebulaColorThree",
      "chamaacDeepSpaceNebulaPaletteMode",
      "chamaacDeepSpaceNebulaPrimaryColor",
      "chamaacDeepSpaceNebulaHarmony",
      "chamaacDeepSpaceNebulaSpeed",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Chamaac Grid Bloom source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-grid-bloom-background.tsx", import.meta.url),
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

    assert.match(registrySource, /chamaac-grid-bloom/)
    assert.match(registrySource, /Grid Bloom/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(registrySource, /cursor interaction intentionally omitted/)
    assert.match(effectSource, /ChamaacGridBloomBackground/)
    assert.match(effectSource, /color: "#E040FB"/)
    assert.match(effectSource, /speed: 1/)
    assert.match(effectSource, /gridScale: 12/)
    assert.match(effectSource, /rotationSpeed: 0/)
    assert.match(effectSource, /fadeFalloff: 10/)
    assert.match(effectSource, /distortionAmount: 0\.05/)
    assert.match(effectSource, /flowSpeedX: -0\.2/)
    assert.match(effectSource, /flowSpeedY: -0\.4/)
    assert.match(effectSource, /snoise/)
    assert.match(effectSource, /uGridScale/)
    assert.match(effectSource, /uRotationSpeed/)
    assert.match(effectSource, /uFadeFalloff/)
    assert.match(effectSource, /uDistortionAmount/)
    assert.match(effectSource, /uFlowSpeedX/)
    assert.match(effectSource, /uFlowSpeedY/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /blendFunc\(context\.SRC_ALPHA, context\.ONE\)/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /chamaacGridBloom/)
    assert.match(hostSource, /chamaacGridBloom/)
    assert.match(runningSource, /chamaacGridBloom=\{\{/)
    assert.match(setupSource, /getChamaacGridBloomDisplaySpeed/)
    assert.match(setupSource, /getChamaacGridBloomSourceSpeed/)
    assert.match(setupSource, /CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MIN = 0\.1/)
    assert.match(setupSource, /CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MAX = 3/)
    assert.match(setupSource, /CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN = 1/)
    assert.match(setupSource, /CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /chamaacGridBloom=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    assert.doesNotMatch(effectSource, /pointermove/)
    assert.doesNotMatch(effectSource, /iMouse/)
    assert.doesNotMatch(effectSource, /uMouseActive/)
    for (const settingKey of [
      "chamaacGridBloomColor",
      "chamaacGridBloomSpeed",
      "chamaacGridBloomGridScale",
      "chamaacGridBloomRotationSpeed",
      "chamaacGridBloomFadeFalloff",
      "chamaacGridBloomDistortionAmount",
      "chamaacGridBloomFlowSpeedX",
      "chamaacGridBloomFlowSpeedY",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Chamaac Liquid Chrome source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-liquid-chrome-background.tsx", import.meta.url),
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

    assert.match(registrySource, /chamaac-liquid-chrome/)
    assert.match(registrySource, /Liquid Chrome/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /ChamaacLiquidChromeBackground/)
    assert.match(effectSource, /speed: 0\.35/)
    assert.match(effectSource, /timeScale: 0\.225/)
    assert.match(effectSource, /color: "#C0C0C0"/)
    assert.match(effectSource, /color2: "#4A4A4A"/)
    assert.match(effectSource, /Domain/)
    assert.match(effectSource, /snoise/)
    assert.match(effectSource, /uTimeScale/)
    assert.match(effectSource, /uColor2/)
    assert.match(effectSource, /reflect/)
    assert.match(effectSource, /fresnel/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /chamaacLiquidChrome/)
    assert.match(hostSource, /chamaacLiquidChrome/)
    assert.match(runningSource, /chamaacLiquidChrome=\{\{/)
    assert.match(runningSource, /resolveChamaacLiquidChromeColors/)
    assert.match(setupSource, /getChamaacLiquidChromeDisplayFlowSpeed/)
    assert.match(setupSource, /getChamaacLiquidChromeSourceFlowSpeed/)
    assert.match(setupSource, /getChamaacLiquidChromeDisplayTimeScale/)
    assert.match(setupSource, /getChamaacLiquidChromeSourceTimeScale/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN = 0\.01/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX = 2/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN = 1/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX = 100/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN = 0\.001/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX = 1/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN = 1/)
    assert.match(setupSource, /CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX = 100/)
    assert.doesNotMatch(pageSource, /chamaacLiquidChrome=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "chamaacLiquidChromePaletteMode",
      "chamaacLiquidChromePrimaryColor",
      "chamaacLiquidChromeHarmony",
      "chamaacLiquidChromeColorOne",
      "chamaacLiquidChromeColorTwo",
      "chamaacLiquidChromeFlowSpeed",
      "chamaacLiquidChromeTimeScale",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Chamaac Waves source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/chamaac-waves-background.tsx", import.meta.url),
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

    assert.match(registrySource, /chamaac-waves/)
    assert.match(registrySource, /Waves/)
    assert.match(registrySource, /https:\/\/www\.chamaac\.com\/components\/backgrounds\/waves/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /ChamaacWavesBackground/)
    assert.match(effectSource, /DEFAULT_CHAMAAC_WAVES/)
    assert.match(effectSource, /backgroundColor: "#000000"/)
    assert.match(effectSource, /waveColor1: "#071697"/)
    assert.match(effectSource, /waveColor2: "#00D4FF"/)
    assert.match(effectSource, /waveColor3: "#000000"/)
    assert.match(effectSource, /waveSpeedX: 0\.0125/)
    assert.match(effectSource, /waveSpeedY: 0\.005/)
    assert.match(effectSource, /waveAmpX: 32/)
    assert.match(effectSource, /WAVES_GRID_SEGMENTS = 128/)
    assert.match(effectSource, /snoise\(vec3/)
    assert.match(effectSource, /options\.waveSpeedX \* 10\.0/)
    assert.match(effectSource, /options\.waveSpeedY \* 10\.0/)
    assert.match(effectSource, /context\.drawElements/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(stylesSource, /chamaacWaves/)
    assert.match(stylesSource, /chamaacWavesCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /chamaacWaves/)
    assert.match(runningSource, /chamaacWaves=\{\{/)
    assert.match(runningSource, /resolveChamaacWavesColors/)
    assert.match(setupSource, /getChamaacWavesDisplaySpeed/)
    assert.match(setupSource, /getChamaacWavesSourceSpeed/)
    assert.match(setupSource, /CHAMAAC_WAVES_SOURCE_SPEED_MIN = 0\.001/)
    assert.match(setupSource, /CHAMAAC_WAVES_SOURCE_SPEED_MAX = 0\.1/)
    assert.match(setupSource, /CHAMAAC_WAVES_DISPLAY_SPEED_MIN = 1/)
    assert.match(setupSource, /CHAMAAC_WAVES_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /chamaacWaves=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /shaderMaterial/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "chamaacWavesPaletteMode",
      "chamaacWavesPrimaryColor",
      "chamaacWavesHarmony",
      "chamaacWavesBackgroundColor",
      "chamaacWavesColorOne",
      "chamaacWavesColorTwo",
      "chamaacWavesColorThree",
      "chamaacWavesSpeedX",
      "chamaacWavesSpeedY",
      "chamaacWavesAmplitude",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps React Bits Ferrofluid source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/react-bits-ferrofluid-background.tsx", import.meta.url),
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
    const docsSource = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(registrySource, /react-bits-ferrofluid/)
    assert.match(registrySource, /Ferrofluid/)
    assert.match(registrySource, /https:\/\/reactbits\.dev\/backgrounds\/ferrofluid/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /ReactBitsFerrofluidBackground/)
    assert.match(effectSource, /DEFAULT_REACT_BITS_FERROFLUID/)
    assert.match(effectSource, /colors: \["#FFFFFF", "#FFFFFF", "#FFFFFF"\]/)
    assert.match(effectSource, /speed: 0\.5/)
    assert.match(effectSource, /scale: 1\.6/)
    assert.match(effectSource, /turbulence: 1/)
    assert.match(effectSource, /fluidity: 0\.1/)
    assert.match(effectSource, /rimWidth: 0\.2/)
    assert.match(effectSource, /sharpness: 2\.5/)
    assert.match(effectSource, /shimmer: 1\.5/)
    assert.match(effectSource, /glow: 2/)
    assert.match(effectSource, /flowDirection: "down"/)
    assert.match(effectSource, /opacity: 1/)
    assert.match(effectSource, /uMouseEnabled/)
    assert.match(effectSource, /uniform1f\(resources\.uniforms\.mouseEnabled, 0\)/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(stylesSource, /reactBitsFerrofluid/)
    assert.match(stylesSource, /reactBitsFerrofluidCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /reactBitsFerrofluid/)
    assert.match(runningSource, /reactBitsFerrofluid=\{\{/)
    assert.match(runningSource, /resolveReactBitsFerrofluidColors/)
    assert.match(setupSource, /resolveReactBitsFerrofluidColors/)
    assert.doesNotMatch(pageSource, /reactBitsFerrofluid=\{\{/)
    assert.match(docsSource, /Ferrofluid \| https:\/\/reactbits\.dev\/backgrounds\/ferrofluid/)
    assert.match(docsSource, /Ferrofluid\.jsx/)
    assert.match(docsSource, /native WebGL/)
    assert.match(docsSource, /cursor interaction is intentionally omitted/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /pointermove/)
    assert.doesNotMatch(effectSource, /mousemove/)
    for (const settingKey of [
      "reactBitsFerrofluidPaletteMode",
      "reactBitsFerrofluidPrimaryColor",
      "reactBitsFerrofluidHarmony",
      "reactBitsFerrofluidColorOne",
      "reactBitsFerrofluidColorTwo",
      "reactBitsFerrofluidColorThree",
      "reactBitsFerrofluidSpeed",
      "reactBitsFerrofluidScale",
      "reactBitsFerrofluidTurbulence",
      "reactBitsFerrofluidFluidity",
      "reactBitsFerrofluidRimWidth",
      "reactBitsFerrofluidSharpness",
      "reactBitsFerrofluidShimmer",
      "reactBitsFerrofluidGlow",
      "reactBitsFerrofluidFlowDirection",
      "reactBitsFerrofluidOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps React Bits Lightfall source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/react-bits-lightfall-background.tsx", import.meta.url),
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
    const docsSource = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(registrySource, /react-bits-lightfall/)
    assert.match(registrySource, /Lightfall/)
    assert.match(registrySource, /https:\/\/reactbits\.dev\/backgrounds\/lightfall/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /ReactBitsLightfallBackground/)
    assert.match(effectSource, /DEFAULT_REACT_BITS_LIGHTFALL/)
    assert.match(effectSource, /colors: \["#A6C8FF", "#5227FF", "#FF9FFC"\]/)
    assert.match(effectSource, /backgroundColor: "#0A29FF"/)
    assert.match(effectSource, /speed: 0\.5/)
    assert.match(effectSource, /streakCount: 2/)
    assert.match(effectSource, /streakWidth: 1/)
    assert.match(effectSource, /streakLength: 1/)
    assert.match(effectSource, /glow: 1/)
    assert.match(effectSource, /density: 0\.6/)
    assert.match(effectSource, /twinkle: 1/)
    assert.match(effectSource, /zoom: 3/)
    assert.match(effectSource, /backgroundGlow: 0\.5/)
    assert.match(effectSource, /opacity: 1/)
    assert.match(effectSource, /mouseInteraction: false/)
    assert.match(effectSource, /mouseStrength: 0\.5/)
    assert.match(effectSource, /mouseRadius: 1/)
    assert.match(effectSource, /mouseDampening: 0\.15/)
    assert.match(effectSource, /uMouseEnabled/)
    assert.match(effectSource, /uniform1f\(resources\.uniforms\.mouseEnabled, options\.mouseInteraction \? 1 : 0\)/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(stylesSource, /reactBitsLightfall/)
    assert.match(stylesSource, /reactBitsLightfallCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /reactBitsLightfall/)
    assert.match(runningSource, /reactBitsLightfall=\{\{/)
    assert.match(runningSource, /resolveReactBitsLightfallColors/)
    assert.match(setupSource, /resolveReactBitsLightfallColors/)
    assert.doesNotMatch(pageSource, /reactBitsLightfall=\{\{/)
    assert.match(docsSource, /Lightfall \| https:\/\/reactbits\.dev\/backgrounds\/lightfall/)
    assert.match(docsSource, /Lightfall\.jsx/)
    assert.match(docsSource, /native WebGL/)
    assert.match(docsSource, /cursor interaction is disabled by default/)
    assert.match(docsSource, /cursor strength, radius, and smoothing controls/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    for (const settingKey of [
      "reactBitsLightfallPaletteMode",
      "reactBitsLightfallPrimaryColor",
      "reactBitsLightfallHarmony",
      "reactBitsLightfallColorOne",
      "reactBitsLightfallColorTwo",
      "reactBitsLightfallColorThree",
      "reactBitsLightfallBackgroundColor",
      "reactBitsLightfallSpeed",
      "reactBitsLightfallStreakCount",
      "reactBitsLightfallStreakWidth",
      "reactBitsLightfallStreakLength",
      "reactBitsLightfallGlow",
      "reactBitsLightfallDensity",
      "reactBitsLightfallTwinkle",
      "reactBitsLightfallZoom",
      "reactBitsLightfallBackgroundGlow",
      "reactBitsLightfallOpacity",
      "reactBitsLightfallCursorEnabled",
      "reactBitsLightfallCursorStrength",
      "reactBitsLightfallCursorRadius",
      "reactBitsLightfallCursorDampening",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps React Bits Liquid Ether source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/react-bits-liquid-ether-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const docsSource = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(registrySource, /react-bits-liquid-ether/)
    assert.match(registrySource, /Liquid Ether/)
    assert.match(registrySource, /https:\/\/reactbits\.dev\/backgrounds\/liquid-ether/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /ReactBitsLiquidEtherBackground/)
    assert.match(effectSource, /DEFAULT_REACT_BITS_LIQUID_ETHER/)
    assert.match(effectSource, /colors: \["#5227FF", "#FF9FFC", "#B497CF"\]/)
    assert.match(effectSource, /mouseInteraction: false/)
    assert.match(effectSource, /mouseForce: 20/)
    assert.match(effectSource, /cursorSize: 100/)
    assert.match(effectSource, /isViscous: false/)
    assert.match(effectSource, /viscous: 30/)
    assert.match(effectSource, /iterationsViscous: 32/)
    assert.match(effectSource, /iterationsPoisson: 32/)
    assert.match(effectSource, /dt: 0\.014/)
    assert.match(effectSource, /bfecc: true/)
    assert.match(effectSource, /resolution: 0\.5/)
    assert.match(effectSource, /isBounce: false/)
    assert.match(effectSource, /autoDemo: true/)
    assert.match(effectSource, /autoSpeed: 0\.5/)
    assert.match(effectSource, /autoIntensity: 2\.2/)
    assert.match(effectSource, /autoResumeDelay: 1000/)
    assert.match(effectSource, /autoRampDuration: 0\.6/)
    assert.match(effectSource, /opacity: 1/)
    assert.match(effectSource, /advectionFragment/)
    assert.match(effectSource, /externalForceFragment/)
    assert.match(effectSource, /viscousFragment/)
    assert.match(effectSource, /divergenceFragment/)
    assert.match(effectSource, /poissonFragment/)
    assert.match(effectSource, /pressureFragment/)
    assert.match(effectSource, /colorFragment/)
    assert.match(effectSource, /texture2D\(velocity, uv\)/)
    assert.match(effectSource, /texture2D\(palette, vec2\(lenv, 0\.5\)\)/)
    assert.match(effectSource, /OES_texture_float/)
    assert.match(effectSource, /OES_texture_half_float/)
    assert.match(effectSource, /WEBGL_color_buffer_float/)
    assert.match(effectSource, /EXT_color_buffer_half_float/)
    assert.match(effectSource, /createFluidTargets/)
    assert.match(effectSource, /createRenderTarget/)
    assert.match(effectSource, /framebufferTexture2D/)
    assert.match(effectSource, /runAdvectionPass/)
    assert.match(effectSource, /runExternalForcePass/)
    assert.match(effectSource, /runViscousPass/)
    assert.match(effectSource, /runDivergencePass/)
    assert.match(effectSource, /runPoissonPass/)
    assert.match(effectSource, /runPressurePass/)
    assert.match(effectSource, /runColorPass/)
    assert.match(effectSource, /updateAutoDriver/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(effectSource, /deleteTexture/)
    assert.match(effectSource, /deleteFramebuffer/)
    assert.match(stylesSource, /reactBitsLiquidEther/)
    assert.match(stylesSource, /reactBitsLiquidEtherCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /reactBitsLiquidEther/)
    assert.match(cssEffectsSource, /ReactBitsLiquidEtherOptions/)
    assert.match(runningSource, /reactBitsLiquidEther=\{\{/)
    assert.match(runningSource, /resolveReactBitsLiquidEtherColors/)
    assert.match(setupSource, /resolveReactBitsLiquidEtherColors/)
    assert.doesNotMatch(pageSource, /reactBitsLiquidEther=\{\{/)
    assert.match(docsSource, /Liquid Ether \| https:\/\/reactbits\.dev\/backgrounds\/liquid-ether/)
    assert.match(docsSource, /LiquidEther\.jsx/)
    assert.match(docsSource, /LiquidEther\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /advection, external-force, viscosity, divergence, Poisson, pressure, and palette-output/)
    assert.match(docsSource, /cursor interaction is disabled by default/)
    assert.match(docsSource, /window pointer listener only while cursor fluid push is enabled/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /mousemove/)
    for (const settingKey of [
      "reactBitsLiquidEtherPaletteMode",
      "reactBitsLiquidEtherPrimaryColor",
      "reactBitsLiquidEtherHarmony",
      "reactBitsLiquidEtherColorOne",
      "reactBitsLiquidEtherColorTwo",
      "reactBitsLiquidEtherColorThree",
      "reactBitsLiquidEtherCursorEnabled",
      "reactBitsLiquidEtherMouseForce",
      "reactBitsLiquidEtherCursorSize",
      "reactBitsLiquidEtherIsViscous",
      "reactBitsLiquidEtherViscous",
      "reactBitsLiquidEtherIterationsViscous",
      "reactBitsLiquidEtherIterationsPoisson",
      "reactBitsLiquidEtherDt",
      "reactBitsLiquidEtherBfecc",
      "reactBitsLiquidEtherResolution",
      "reactBitsLiquidEtherIsBounce",
      "reactBitsLiquidEtherAutoDemo",
      "reactBitsLiquidEtherAutoSpeed",
      "reactBitsLiquidEtherAutoIntensity",
      "reactBitsLiquidEtherAutoResumeDelay",
      "reactBitsLiquidEtherAutoRampDuration",
      "reactBitsLiquidEtherOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps React Bits Prism source-shaped, raw WebGL, and cursor-optional", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/react-bits-prism-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const docsSource = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(registrySource, /react-bits-prism/)
    assert.match(registrySource, /Prism/)
    assert.match(registrySource, /https:\/\/reactbits\.dev\/backgrounds\/prism/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /ReactBitsPrismBackground/)
    assert.match(effectSource, /DEFAULT_REACT_BITS_PRISM/)
    assert.match(effectSource, /height: 3\.5/)
    assert.match(effectSource, /baseWidth: 5\.5/)
    assert.match(effectSource, /animationType: "rotate"/)
    assert.match(effectSource, /glow: 1/)
    assert.match(effectSource, /offsetX: 0/)
    assert.match(effectSource, /offsetY: 0/)
    assert.match(effectSource, /noise: 0\.5/)
    assert.match(effectSource, /transparent: true/)
    assert.match(effectSource, /scale: 3\.6/)
    assert.match(effectSource, /hueShift: 0/)
    assert.match(effectSource, /colorFrequency: 1/)
    assert.match(effectSource, /hoverStrength: 2/)
    assert.match(effectSource, /inertia: 0\.05/)
    assert.match(effectSource, /bloom: 1/)
    assert.match(effectSource, /timeScale: 0\.5/)
    assert.match(effectSource, /sdOctaAnisoInv/)
    assert.match(effectSource, /sdPyramidUpInv/)
    assert.match(effectSource, /hueRotation/)
    assert.match(effectSource, /tanh4/)
    assert.match(effectSource, /uUseBaseWobble/)
    assert.match(effectSource, /setMat3FromEuler/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(stylesSource, /reactBitsPrism/)
    assert.match(stylesSource, /reactBitsPrismCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /reactBitsPrism/)
    assert.match(cssEffectsSource, /ReactBitsPrismOptions/)
    assert.match(runningSource, /reactBitsPrism=\{\{/)
    assert.doesNotMatch(pageSource, /reactBitsPrism=\{\{/)
    assert.match(docsSource, /Prism \| https:\/\/reactbits\.dev\/backgrounds\/prism/)
    assert.match(docsSource, /Prism\.jsx/)
    assert.match(docsSource, /Prism\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /cursor hover/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /mousemove/)
    for (const settingKey of [
      "reactBitsPrismHeight",
      "reactBitsPrismBaseWidth",
      "reactBitsPrismAnimationType",
      "reactBitsPrismGlow",
      "reactBitsPrismOffsetX",
      "reactBitsPrismOffsetY",
      "reactBitsPrismNoise",
      "reactBitsPrismTransparent",
      "reactBitsPrismScale",
      "reactBitsPrismHueShift",
      "reactBitsPrismColorFrequency",
      "reactBitsPrismHoverStrength",
      "reactBitsPrismInertia",
      "reactBitsPrismBloom",
      "reactBitsPrismTimeScale",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Eldora Novatrix source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/eldora-novatrix-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /eldora-novatrix-background/)
    assert.match(registrySource, /Novatrix Background/)
    assert.match(registrySource, /https:\/\/www\.eldoraui\.site\/docs\/components\/novatrix-background/)
    assert.match(registrySource, /MIT; Eldora UI repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /EldoraNovatrixBackground/)
    assert.match(effectSource, /DEFAULT_ELDORA_NOVATRIX/)
    assert.match(effectSource, /color: "#FFFFFF"/)
    assert.match(effectSource, /speed: 1/)
    assert.match(effectSource, /amplitude: 0\.1/)
    assert.match(effectSource, /uResolution/)
    assert.match(effectSource, /uMouse/)
    assert.match(effectSource, /uAmplitude/)
    assert.match(effectSource, /uSpeed/)
    assert.match(effectSource, /for \(float i = 0\.0; i < 8\.0; \+\+i\)/)
    assert.match(effectSource, /passive drift/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(stylesSource, /eldoraNovatrixBackground/)
    assert.match(stylesSource, /eldoraNovatrixCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /eldoraNovatrix/)
    assert.match(cssEffectsSource, /EldoraNovatrixOptions/)
    assert.match(runningSource, /eldoraNovatrix=\{\{/)
    assert.match(runningSource, /resolveEldoraNovatrixColor/)
    assert.match(setupSource, /getEldoraNovatrixDisplaySpeed/)
    assert.match(setupSource, /getEldoraNovatrixSourceSpeed/)
    assert.match(setupSource, /getEldoraNovatrixDisplayAmplitude/)
    assert.match(setupSource, /getEldoraNovatrixSourceAmplitude/)
    assert.match(setupSource, /ELDORA_NOVATRIX_SOURCE_SPEED_MIN = 0\.02/)
    assert.match(setupSource, /ELDORA_NOVATRIX_SOURCE_SPEED_MAX = 3/)
    assert.match(setupSource, /ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MIN = 0\.01/)
    assert.match(setupSource, /ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MAX = 0\.45/)
    assert.doesNotMatch(pageSource, /eldoraNovatrix=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "eldoraNovatrixPaletteMode",
      "eldoraNovatrixPrimaryColor",
      "eldoraNovatrixHarmony",
      "eldoraNovatrixColor",
      "eldoraNovatrixSpeed",
      "eldoraNovatrixAmplitude",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Eldora Hacker source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/eldora-hacker-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /eldora-hacker-background/)
    assert.match(registrySource, /Hacker Background/)
    assert.match(registrySource, /https:\/\/www\.eldoraui\.site\/docs\/components\/hacker-background/)
    assert.match(registrySource, /MIT; Eldora UI repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /EldoraHackerBackground/)
    assert.match(effectSource, /DEFAULT_ELDORA_HACKER/)
    assert.match(effectSource, /color: "#00FF00"/)
    assert.match(effectSource, /fontSize: 14/)
    assert.match(effectSource, /speed: 1/)
    assert.match(effectSource, /HACKER_CHARACTERS/)
    assert.match(effectSource, /SOURCE_FRAME_INTERVAL_MS = 33/)
    assert.match(effectSource, /"rgba\(0, 0, 0, 0\.05\)"/)
    assert.match(effectSource, /monospace/)
    assert.match(effectSource, /drops/)
    assert.match(effectSource, /fillText/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /eldoraHackerBackground/)
    assert.match(stylesSource, /eldoraHackerCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /eldoraHacker/)
    assert.match(cssEffectsSource, /EldoraHackerOptions/)
    assert.match(runningSource, /eldoraHacker=\{\{/)
    assert.match(runningSource, /resolveEldoraHackerColor/)
    assert.match(setupSource, /getEldoraHackerDisplaySpeed/)
    assert.match(setupSource, /getEldoraHackerSourceSpeed/)
    assert.match(setupSource, /ELDORA_HACKER_SOURCE_SPEED_MIN = 0\.05/)
    assert.match(setupSource, /ELDORA_HACKER_SOURCE_SPEED_MAX = 3/)
    assert.doesNotMatch(pageSource, /eldoraHacker=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "eldoraHackerPaletteMode",
      "eldoraHackerPrimaryColor",
      "eldoraHackerHarmony",
      "eldoraHackerColor",
      "eldoraHackerSpeed",
      "eldoraHackerFontSize",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Eldora Photon Beam source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/eldora-photon-beam-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(registrySource, /eldora-photon-beam/)
    assert.match(registrySource, /Photon Beam/)
    assert.match(registrySource, /https:\/\/www\.eldoraui\.site\/docs\/components\/photon-beam/)
    assert.match(registrySource, /MIT; Eldora UI repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /EldoraPhotonBeamBackground/)
    assert.match(effectSource, /DEFAULT_ELDORA_PHOTON_BEAM/)
    assert.match(effectSource, /colorBg: "#080808"/)
    assert.match(effectSource, /colorLine: "#005F6F"/)
    assert.match(effectSource, /colorSignal: "#00D9FF"/)
    assert.match(effectSource, /useColor2: false/)
    assert.match(effectSource, /colorSignal2: "#00FFFF"/)
    assert.match(effectSource, /useColor3: false/)
    assert.match(effectSource, /colorSignal3: "#00B8D4"/)
    assert.match(effectSource, /lineCount: 80/)
    assert.match(effectSource, /spreadHeight: 30\.33/)
    assert.match(effectSource, /spreadDepth: 0/)
    assert.match(effectSource, /curveLength: 50/)
    assert.match(effectSource, /straightLength: 100/)
    assert.match(effectSource, /curvePower: 0\.8265/)
    assert.match(effectSource, /waveSpeed: 2\.48/)
    assert.match(effectSource, /waveHeight: 0\.145/)
    assert.match(effectSource, /lineOpacity: 0\.557/)
    assert.match(effectSource, /signalCount: 94/)
    assert.match(effectSource, /speedGlobal: 0\.345/)
    assert.match(effectSource, /trailLength: 3/)
    assert.match(effectSource, /bloomStrength: 3/)
    assert.match(effectSource, /bloomRadius: 0\.5/)
    assert.match(effectSource, /SEGMENT_COUNT = 150/)
    assert.match(effectSource, /getPathPoint/)
    assert.match(effectSource, /options\.curveLength/)
    assert.match(effectSource, /options\.straightLength/)
    assert.match(effectSource, /options\.curvePower/)
    assert.match(effectSource, /options\.waveSpeed/)
    assert.match(effectSource, /options\.waveHeight/)
    assert.match(effectSource, /globalCompositeOperation = "lighter"/)
    assert.match(effectSource, /shadowBlur/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /eldoraPhotonBeamBackground/)
    assert.match(stylesSource, /eldoraPhotonBeamCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /eldoraPhotonBeam/)
    assert.match(cssEffectsSource, /EldoraPhotonBeamOptions/)
    assert.match(runningSource, /eldoraPhotonBeam=\{\{/)
    assert.match(runningSource, /resolveEldoraPhotonBeamColors/)
    assert.match(setupSource, /resolveEldoraPhotonBeamColors/)
    assert.match(setupSource, /createEldoraPhotonBeamHarmonyPalette/)
    assert.match(setupSource, /getEldoraPhotonBeamDisplaySpeed/)
    assert.match(setupSource, /getEldoraPhotonBeamSourceSpeed/)
    assert.match(setupSource, /ELDORA_PHOTON_BEAM_SOURCE_SPEED_MIN = 0\.02/)
    assert.match(setupSource, /ELDORA_PHOTON_BEAM_SOURCE_SPEED_MAX = 2/)
    assert.doesNotMatch(pageSource, /eldoraPhotonBeam=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /EffectComposer/)
    assert.doesNotMatch(effectSource, /RenderPass/)
    assert.doesNotMatch(effectSource, /UnrealBloomPass/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "eldoraPhotonBeamPaletteMode",
      "eldoraPhotonBeamPrimaryColor",
      "eldoraPhotonBeamHarmony",
      "eldoraPhotonBeamColorBg",
      "eldoraPhotonBeamColorLine",
      "eldoraPhotonBeamColorSignal",
      "eldoraPhotonBeamUseColor2",
      "eldoraPhotonBeamColorSignal2",
      "eldoraPhotonBeamUseColor3",
      "eldoraPhotonBeamColorSignal3",
      "eldoraPhotonBeamLineCount",
      "eldoraPhotonBeamSpreadHeight",
      "eldoraPhotonBeamSpreadDepth",
      "eldoraPhotonBeamCurveLength",
      "eldoraPhotonBeamStraightLength",
      "eldoraPhotonBeamCurvePower",
      "eldoraPhotonBeamWaveSpeed",
      "eldoraPhotonBeamWaveHeight",
      "eldoraPhotonBeamLineOpacity",
      "eldoraPhotonBeamSignalCount",
      "eldoraPhotonBeamSpeedGlobal",
      "eldoraPhotonBeamTrailLength",
      "eldoraPhotonBeamBloomStrength",
      "eldoraPhotonBeamBloomRadius",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Aceternity 3D Globe source-shaped, marker-aware, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/aceternity-3d-globe-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const docsSource = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(registrySource, /aceternity-3d-globe/)
    assert.match(registrySource, /3D Globe/)
    assert.match(registrySource, /https:\/\/ui\.aceternity\.com\/components\/3d-globe/)
    assert.match(registrySource, /Aceternity License; component registry reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /Aceternity3DGlobeBackground/)
    assert.match(effectSource, /DEFAULT_EARTH_TEXTURE/)
    assert.match(effectSource, /earth-blue-marble\.jpg/)
    assert.match(effectSource, /DEFAULT_BUMP_TEXTURE/)
    assert.match(effectSource, /earth-topology\.png/)
    assert.match(effectSource, /autoRotateSpeed: 0\.3/)
    assert.match(effectSource, /globeColor: "#1A1A2E"/)
    assert.match(effectSource, /lightingMode: "manual"/)
    assert.match(effectSource, /EARTH_AXIAL_TILT_DEGREES/)
    assert.match(effectSource, /FIXED_SUN_LIGHT_VECTOR/)
    assert.match(effectSource, /MASSAGELAB_MARKER/)
    assert.match(effectSource, /MASSAGELAB_MARKER_ICON_SOURCE/)
    assert.match(effectSource, /massagelab-mark-square-tight\.png/)
    assert.match(effectSource, /label: ""/)
    assert.match(effectSource, /panX: 0/)
    assert.match(effectSource, /panY: 0/)
    assert.match(effectSource, /showTilt: true/)
    assert.match(effectSource, /markerLat/)
    assert.match(effectSource, /markerLng/)
    assert.match(effectSource, /markerIcon: "pin"/)
    assert.match(effectSource, /WEBGL_GLOBE_FRAGMENT_SHADER/)
    assert.match(effectSource, /createGlobeRenderer/)
    assert.match(effectSource, /uploadGlobeTexture/)
    assert.match(effectSource, /UNPACK_FLIP_Y_WEBGL,\s*false/)
    assert.match(effectSource, /getSunState/)
    assert.match(effectSource, /getAxialTiltDegrees/)
    assert.match(effectSource, /normal\.x \* c \+ normal\.y \* s/)
    assert.match(effectSource, /u_sunLighting/)
    assert.match(effectSource, /u_graphicMode/)
    assert.match(effectSource, /u_graphicMapSamples/)
    assert.match(effectSource, /createGraphicMapPoints/)
    assert.match(effectSource, /drawGraphicMapDots/)
    assert.match(effectSource, /new Path2D/)
    assert.match(effectSource, /COBE_WORLD_MAP_MASK/)
    assert.match(effectSource, /createGraphicMapPoints\(graphicMapMask, resolved\.graphicMapSamples, "cobe"\)/)
    assert.match(effectSource, /graphicMapSamples: isGraphicMode \? 0 : resolved\.graphicMapSamples/)
    assert.match(effectSource, /graphicMapSamples: 8000/)
    assert.match(effectSource, /Math\.min\(10000/)
    assert.match(effectSource, /GRAPHIC_FIBONACCI_GOLDEN_ANGLE/)
    assert.match(effectSource, /densityBudget/)
    assert.match(effectSource, /getGraphicMaskBrightness/)
    assert.doesNotMatch(effectSource, /points\.length > targetCount/)
    assert.doesNotMatch(effectSource, /hashUnit/)
    assert.match(effectSource, /drawGraphicLocationMarker/)
    assert.match(effectSource, /toGraphicMapLongitude/)
    assert.match(effectSource, /useGraphicMapSpace/)
    assert.match(effectSource, /overlayCenterLongitude/)
    assert.match(effectSource, /viewStyle: "realistic"/)
    assert.match(effectSource, /smoothstep\(-0\.035,\s*0\.035,\s*ndl\)/)
    assert.match(effectSource, /sunNightShade/)
    assert.match(effectSource, /projectLatLngToGlobe/)
    assert.match(effectSource, /drawLocationMarker/)
    assert.match(effectSource, /drawMarkerIcon/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /aceternity3dGlobe/)
    assert.match(stylesSource, /aceternity3dGlobeCanvas/)
    assert.match(stylesSource, /aceternity3dGlobeMarkerCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /aceternity3DGlobe/)
    assert.match(cssEffectsSource, /Aceternity3DGlobeOptions/)
    assert.match(runningSource, /aceternity3DGlobe=\{\{/)
    assert.doesNotMatch(runningSource, /accountMarkerAvatarUrl/)
    assert.doesNotMatch(pageSource, /sessionUserString/)
    assert.doesNotMatch(pageSource, /accountMarkerAvatarUrl/)
    assert.match(runningSource, /navigator\.geolocation\.getCurrentPosition/)
    assert.match(setupSource, /navigator\.geolocation\.getCurrentPosition/)
    assert.match(setupSource, /Use my location/)
    assert.match(setupSource, /Follow Sun/)
    assert.match(runningSource, /Follow Sun/)
    assert.doesNotMatch(setupSource, /Reverse spin/)
    assert.doesNotMatch(runningSource, /Reverse spin/)
    assert.doesNotMatch(setupSource, /Show Earth tilt/)
    assert.doesNotMatch(runningSource, /Show Earth tilt/)
    assert.match(setupSource, /Outer Glow/)
    assert.match(runningSource, /Outer Glow/)
    assert.match(setupSource, /Pan X Left\/Right/)
    assert.match(setupSource, /Pan Y Up\/Down/)
    assert.match(runningSource, /Pan X Left\/Right/)
    assert.match(runningSource, /Pan Y Up\/Down/)
    assert.match(setupSource, /settings\.aceternity3DGlobeEnablePan &&/)
    assert.match(runningSource, /aceternity3DGlobeEnablePan &&/)
    assert.match(setupSource, /max="10000"/)
    assert.match(runningSource, /max="10000"/)
    assert.doesNotMatch(pageSource, /aceternity3DGlobe=\{\{/)
    assert.match(docsSource, /3D Globe \| https:\/\/ui\.aceternity\.com\/components\/3d-globe/)
    assert.match(docsSource, /3d-globe\.json/)
    assert.match(docsSource, /three`, `@react-three\/fiber`, `@react-three\/drei`, and `@types\/three`/)
    assert.match(docsSource, /avatar tips/)
    assert.match(docsSource, /icon-based user marker/)
    assert.match(docsSource, /MassageLab Ashland, OH marker/)
    assert.match(docsSource, /native WebGL sphere renderer/)
    assert.match(docsSource, /cobe-globe\.json/)
    assert.match(docsSource, /react-spring`, `cobe`, and `react`/)
    assert.match(docsSource, /Graphic view style/)
    assert.match(docsSource, /structured/)
    assert.match(docsSource, /10k/)
    assert.match(docsSource, /dependency-free/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "cobe"/)
    assert.doesNotMatch(effectSource, /react-spring/)
    assert.doesNotMatch(effectSource, /@react-three\/fiber/)
    assert.doesNotMatch(effectSource, /@react-three\/drei/)
    assert.doesNotMatch(effectSource, /OrbitControls/)
    assert.doesNotMatch(effectSource, /useTexture/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)

    for (const settingKey of [
      "aceternity3DGlobeViewStyle",
      "aceternity3DGlobeBackgroundColor",
      "aceternity3DGlobeGlobeColor",
      "aceternity3DGlobeGraphicMapColor",
      "aceternity3DGlobeGraphicGlowColor",
      "aceternity3DGlobeGraphicMarkerColor",
      "aceternity3DGlobeGraphicMapSamples",
      "aceternity3DGlobeAutoRotateSpeed",
      "aceternity3DGlobeScale",
      "aceternity3DGlobeBumpScale",
      "aceternity3DGlobeAmbientIntensity",
      "aceternity3DGlobePointLightIntensity",
      "aceternity3DGlobeLightingMode",
      "aceternity3DGlobeEnablePan",
      "aceternity3DGlobePanX",
      "aceternity3DGlobePanY",
      "aceternity3DGlobeShowAtmosphere",
      "aceternity3DGlobeAtmosphereColor",
      "aceternity3DGlobeAtmosphereIntensity",
      "aceternity3DGlobeAtmosphereBlur",
      "aceternity3DGlobeShowWireframe",
      "aceternity3DGlobeWireframeColor",
      "aceternity3DGlobeMarkerEnabled",
      "aceternity3DGlobeMarkerLat",
      "aceternity3DGlobeMarkerLng",
      "aceternity3DGlobeMarkerLabel",
      "aceternity3DGlobeMarkerIcon",
      "aceternity3DGlobeMarkerSize",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Magic UI Retro Grid source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/magicui-retro-grid-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const docsSource = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(registrySource, /magicui-retro-grid/)
    assert.match(registrySource, /Retro Grid/)
    assert.match(registrySource, /https:\/\/magicui\.design\/docs\/components\/retro-grid/)
    assert.match(registrySource, /MIT; Magic UI repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MagicRetroGridBackground/)
    assert.match(effectSource, /DEFAULT_MAGIC_RETRO_GRID/)
    assert.match(effectSource, /angle: 65/)
    assert.match(effectSource, /cellSize: 60/)
    assert.match(effectSource, /opacity: 0\.5/)
    assert.match(effectSource, /lightLineColor: "#808080"/)
    assert.match(effectSource, /darkLineColor: "#808080"/)
    assert.match(effectSource, /ANIMATION_DURATION_SECONDS = 15/)
    assert.match(effectSource, /PERSPECTIVE_PX = 200/)
    assert.match(effectSource, /OES_standard_derivatives/)
    assert.match(effectSource, /fwidth\(patternPosition\)/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /IntersectionObserver/)
    assert.match(effectSource, /MutationObserver/)
    assert.match(stylesSource, /magicRetroGridBackground/)
    assert.match(stylesSource, /magicRetroGridCanvas/)
    assert.match(stylesSource, /magicRetroGridFallbackGrid/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /magicRetroGrid/)
    assert.match(cssEffectsSource, /MagicRetroGridOptions/)
    assert.match(runningSource, /magicRetroGrid=\{\{/)
    assert.doesNotMatch(pageSource, /magicRetroGrid=\{\{/)
    assert.match(docsSource, /Retro Grid \| https:\/\/magicui\.design\/docs\/components\/retro-grid/)
    assert.match(docsSource, /Magic UI repository reviewed 2026-07-04/)
    assert.match(docsSource, /angle`, `cellSize`, `opacity`, `lightLineColor`, and `darkLineColor`/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)

    for (const settingKey of [
      "magicRetroGridBackgroundColor",
      "magicRetroGridLightLineColor",
      "magicRetroGridDarkLineColor",
      "magicRetroGridAngle",
      "magicRetroGridCellSize",
      "magicRetroGridOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps Magic UI Light Rays source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/magicui-light-rays-background.tsx", import.meta.url),
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
    const cssEffectsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const setupSource = readFileSync(new URL("../app/chimer/set-timer.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const docsSource = readFileSync(new URL("../docs/background-sources.md", import.meta.url), "utf8")

    assert.match(registrySource, /magicui-light-rays/)
    assert.match(registrySource, /Light Rays/)
    assert.match(registrySource, /https:\/\/magicui\.design\/docs\/components\/light-rays/)
    assert.match(registrySource, /MIT; Magic UI repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MagicLightRaysBackground/)
    assert.match(effectSource, /DEFAULT_MAGIC_LIGHT_RAYS/)
    assert.match(effectSource, /backgroundColor: "#020617"/)
    assert.match(effectSource, /color: "#A0D2FF"/)
    assert.match(effectSource, /count: 7/)
    assert.match(effectSource, /blur: 36/)
    assert.match(effectSource, /speed: 14/)
    assert.match(effectSource, /length: 70/)
    assert.match(effectSource, /opacity: 0\.65/)
    assert.match(effectSource, /createRays/)
    assert.match(effectSource, /randomUnit/)
    assert.match(stylesSource, /magicLightRaysBackground/)
    assert.match(stylesSource, /magicLightRaysRay/)
    assert.match(stylesSource, /magicLightRaysDrift/)
    assert.match(stylesSource, /mix-blend-mode: screen/)
    assert.match(stylesSource, /prefers-reduced-motion/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /magicLightRays/)
    assert.match(cssEffectsSource, /MagicLightRaysOptions/)
    assert.match(runningSource, /magicLightRays=\{\{/)
    assert.doesNotMatch(pageSource, /magicLightRays=\{\{/)
    assert.match(docsSource, /Light Rays \| https:\/\/magicui\.design\/docs\/components\/light-rays/)
    assert.match(docsSource, /light-rays\.tsx/)
    assert.match(docsSource, /`count`, `color`, `blur`, `opacity`, `speed`, and `length`/)
    assert.match(docsSource, /dependency-free CSS keyframes/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)

    for (const settingKey of [
      "magicLightRaysBackgroundColor",
      "magicLightRaysColor",
      "magicLightRaysCount",
      "magicLightRaysBlur",
      "magicLightRaysSpeed",
      "magicLightRaysLength",
      "magicLightRaysOpacity",
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
