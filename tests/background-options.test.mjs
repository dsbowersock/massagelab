import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  BACKGROUND_STORAGE_KEYS,
  DEFAULT_BACKGROUND_ID,
  isBackgroundId,
  normalizeBackgroundId,
} from "../lib/background-options.js"
import { FEATURE_KEYS, hasPremiumBackgroundAccess } from "../lib/membership.js"
import {
  backgroundRegistry,
  canUseBackgroundId,
  getBackgroundOptionsForCategory,
  resolveAccessibleBackgroundDefinition,
} from "../components/backgrounds/backgroundRegistry.ts"

const runningTimerStyles = readFileSync(
  new URL("../app/chimer/running-timer.module.css", import.meta.url),
  "utf8",
)
const runningTimerSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
const projectLogSource = readFileSync(new URL("../docs/project-log.md", import.meta.url), "utf8")

describe("premium background registry", () => {
  it("records the verified public MIT Neon Clock attribution", () => {
    assert.match(projectLogSource, /https:\/\/codepen\.io\/wheatup\/pen\/JjzdMbK/)
    assert.match(projectLogSource, /wheatup/)
    assert.match(projectLogSource, /public[\s\S]*MIT/)
    assert.match(projectLogSource, /adapt(?:ed|ation)[\s\S]*native React and CSS/i)
  })

  it("keeps display rotation bounded and reduced-motion safe", () => {
    assert.match(runningTimerStyles, /\.displayEffectBounds\s*\{[\s\S]*perspective:\s*45rem/)
    assert.match(runningTimerStyles, /@keyframes immersiveDisplayYaw/)
    assert.match(runningTimerStyles, /rotateY\(var\(--immersive-display-yaw-min, -10deg\)\)/)
    assert.match(runningTimerStyles, /rotateY\(var\(--immersive-display-yaw-max, 10deg\)\)/)
    assert.match(
      runningTimerStyles,
      /animation:\s*immersiveDisplayYaw var\(--immersive-display-yaw-duration, 40s\) ease-in-out infinite/,
    )
    assert.match(
      runningTimerStyles,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.displayRotationEnabled\s*\{[\s\S]*animation:\s*none/,
    )
  })

  it("keeps forward-glow projection layers bounded and visually clipped", () => {
    const forwardGlowRule = runningTimerStyles.match(/\.forwardGlowProjection\s*\{([^}]+)\}/)?.[1]
    assert.ok(forwardGlowRule)
    assert.match(forwardGlowRule, /rotateX\(-90\.1deg\)/)
    assert.match(forwardGlowRule, /scaleY\(var\(--immersive-forward-glow-length, 1\)\)/)
    assert.match(forwardGlowRule, /translateY\(calc\(var\(--immersive-forward-glow-gap, 16px\) - 0\.25em\)\)/)
    assert.match(forwardGlowRule, /translateZ\(2rem\)/)
    assert.doesNotMatch(runningTimerStyles, /\.forwardGlowProjection::before/)
    assert.doesNotMatch(
      runningTimerStyles,
      /\.forwardGlowLayer\s*\{[^}]*mask-image:/,
      "the projection must not use a full-layer mask or filled plane that can reveal rectangular bounds",
    )
    for (const className of ["forwardGlowBloom", "forwardGlowReflection"]) {
      const layerRule = runningTimerStyles.match(new RegExp(`\\.${className}\\s*\\{([^}]+)\\}`))?.[1]
      assert.ok(layerRule)
      assert.match(layerRule, /filter:[^;]*drop-shadow\([^;]*blur\(/)
      assert.match(layerRule, /opacity:/)
      assert.doesNotMatch(layerRule, /mask-image:/)
    }
    assert.match(runningTimerStyles, /\.forwardGlowLayer::before\s*\{[^}]*width:\s*400%;[^}]*height:\s*400%;/s)
    assert.match(runningTimerStyles, /\.forwardGlowBloom\s+\.currentTimeDigit[^}]*mask-image:\s*linear-gradient/s)
    assert.match(runningTimerStyles, /\.forwardGlowReflection\s+\.currentTimeDigit[^}]*mask-image:\s*linear-gradient/s)
    assert.match(runningTimerStyles, /\.primaryDisplay\s*\{[\s\S]*overflow:\s*hidden/)
    assert.match(runningTimerStyles, /\.primaryDisplayForwardGlowEnabled\s*\{[^}]*overflow:\s*visible/s)
    assert.match(runningTimerStyles, /\.secondaryDisplay\s*\{[\s\S]*overflow:\s*hidden/)
  })

  it("keeps forward-glow controls and calculations within their persisted bounds", () => {
    assert.match(runningTimerSource, /label="Projection length"[\s\S]*?max=\{4\}/)
    assert.match(runningTimerSource, /Math\.round\(\(clockForwardGlowLength \/ 4\) \* 100\)/)
    assert.match(runningTimerSource, /Math\.round\(\(clockForwardGlowBlur \/ 64\) \* 100\)/)
    assert.doesNotMatch(runningTimerSource, />Display effects</)
    assert.match(runningTimerSource, /Math\.sqrt\(clockForwardGlowStrength\)/)
    assert.match(runningTimerSource, /Math\.max\(1, clockForwardGlowBlur \* 0\.14\)/)
    assert.match(runningTimerSource, /Math\.max\(3, clockForwardGlowBlur \* 0\.32\)/)
    assert.match(runningTimerSource, /--immersive-forward-glow-dock-runway/)
    assert.match(runningTimerSource, /clockForwardGlowLength - 0\.5/)
    assert.equal((runningTimerSource.match(/styles\.primaryDisplayForwardGlowEnabled/g) ?? []).length, 2)
  })

  it("keeps the default background free and the Music key available for legacy reads", () => {
    assert.equal(DEFAULT_BACKGROUND_ID, "massage-lab-moving-gradient")
    assert.equal(backgroundRegistry.find((entry) => entry.id === DEFAULT_BACKGROUND_ID)?.label, "MassageLaba Lamp")
    assert.equal(BACKGROUND_STORAGE_KEYS.chimer, "massagelab.chimer.background")
    assert.equal(BACKGROUND_STORAGE_KEYS.music, "massagelab.music.background")
    assert.equal(canUseBackgroundId(DEFAULT_BACKGROUND_ID, []), true)
    assert.equal(canUseBackgroundId("static-gradient", []), true)
    assert.equal(resolveAccessibleBackgroundDefinition("unknown", []).id, DEFAULT_BACKGROUND_ID)
  })

  it("requires explicit known IDs before applying Music category eligibility", () => {
    assert.equal(isBackgroundId("static-gradient"), true)
    assert.equal(canUseBackgroundId("static-gradient", [], "music"), true)
    assert.equal(isBackgroundId("unknown-music-background"), false)
    assert.equal(canUseBackgroundId("unknown-music-background", [], "music"), true)
  })

  it("gates active premium backgrounds behind premium background access", () => {
    for (const backgroundId of [
      "massage-lab-aurora",
      "massage-lab-dotted-glow",
      "massage-lab-sparkles",
      "massage-lab-gradient-animation",
      "massage-lab-background-beams",
      "massage-lab-collision-beams",
      "massage-lab-background-lines",
      "massage-lab-glowing-stars",
      "massage-lab-meteors",
      "massage-lab-shooting-stars",
      "massage-lab-reveal-dots",
      "massage-lab-spotlight",
      "massage-lab-lamp-effect",
      "massage-lab-vortex",
      "massage-lab-wavy-background",
      "massage-lab-3d-globe",
      "massage-lab-pixel-liquid",
      "massage-lab-tile-grid",
      "massage-lab-hex-grid",
      "massage-lab-retro-grid",
      "massage-lab-aerial-rays",
      "massage-lab-aurora-bars",
      "massage-lab-bubble",
      "massage-lab-gradient",
      "massage-lab-stars",
      "massage-lab-hole",
      "massage-lab-light-speed",
      "massage-lab-electric-mist",
      "massage-lab-astral-flow",
      "massage-lab-deep-space-nebula",
      "massage-lab-grid-bloom",
      "massage-lab-chrome-flow",
      "massage-lab-wave-current",
      "massage-lab-synthesis",
      "massage-lab-ferrofluid",
      "massage-lab-lightfall",
      "massage-lab-liquid-ether",
      "massage-lab-prism",
      "massage-lab-dark-veil",
      "massage-lab-light-pillar",
      "massage-lab-silk",
      "massage-lab-floating-lines",
      "massage-lab-side-rays",
      "massage-lab-light-rays",
      "massage-lab-pixel-blast",
      "massage-lab-color-bends",
      "massage-lab-evil-eye",
      "massage-lab-line-waves",
      "massage-lab-radar",
      "massage-lab-soft-aurora",
      "massage-lab-plasma",
      "massage-lab-plasma-wave",
      "massage-lab-particles",
      "massage-lab-gradient-blinds",
      "massage-lab-grainient",
      "massage-lab-grid-scan",
      "massage-lab-beams",
      "massage-lab-pixel-snow",
      "massage-lab-lightning",
      "massage-lab-prismatic-burst",
      "massage-lab-galaxy",
      "massage-lab-dither",
      "massage-lab-faulty-terminal",
      "massage-lab-ripple-grid",
      "massage-lab-dot-field",
      "massage-lab-dot-grid",
      "massage-lab-threads",
      "massage-lab-iridescence",
      "massage-lab-waves",
      "massage-lab-grid-distortion",
      "massage-lab-orb",
      "massage-lab-letter-glitch",
      "massage-lab-grid-motion",
      "massage-lab-shape-grid",
      "massage-lab-liquid-chrome",
      "massage-lab-balatro",
      "massage-lab-novatrix",
      "massage-lab-matrix-rain",
      "massage-lab-photon-beam",
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
        DEFAULT_BACKGROUND_ID,
      )
      assert.equal(
        resolveAccessibleBackgroundDefinition(backgroundId, {
          ownedBackgroundIds: [backgroundId],
        }).id,
        backgroundId,
      )
    }
  })

  it("keeps premium use independent from the custom-color feature", () => {
    assert.equal(hasPremiumBackgroundAccess([FEATURE_KEYS.chimerCustomColors]), false)
    assert.equal(hasPremiumBackgroundAccess([FEATURE_KEYS.premiumBackgrounds]), true)
  })

  it("keeps paused draft backgrounds unavailable even with premium access", () => {
    assert.equal(canUseBackgroundId("massage-lab-noise-texture-draft", [FEATURE_KEYS.premiumBackgrounds]), false)
  })

  it("keeps Aurora Bars active only for subscribed users after license review", () => {
    const disabledIds = backgroundRegistry.filter((entry) => !entry.enabled).map((entry) => entry.id)

    assert.equal(disabledIds.includes("massage-lab-aurora-bars"), false)
    assert.equal(canUseBackgroundId("massage-lab-aurora-bars", [FEATURE_KEYS.premiumBackgrounds]), true)
    assert.equal(canUseBackgroundId("massage-lab-aurora-bars", []), false)
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
    assert.match(sourceDoc, /verify the current .* license from a primary source/)
    assert.doesNotMatch(sourceDoc, /Ali Imam/)
    assert.match(sourceDoc, /One-At-A-Time Review/)
    assert.match(sourceDoc, /Provider License Notes/)
    assert.match(sourceDoc, /reviewed on 2026-07-02/i)
    assert.match(sourceDoc, /reviewed on 2026-07-03/i)
    assert.match(sourceDoc, /reviewed on 2026-07-04/i)
    assert.match(sourceDoc, /reviewed on 2026-07-05/i)
    assert.match(sourceDoc, /internal app UI effects inside MassageLab/)
    assert.match(sourceDoc, /Users do not receive component source code/)
    assert.match(sourceDoc, /MIT \+ Commons Clause/)
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
    assert.match(sourceDoc, /MassageLab/)
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
    assert.ok(chimerOptions.includes("massage-lab-aurora"))
    assert.ok(chimerOptions.includes("massage-lab-dotted-glow"))
    assert.ok(chimerOptions.includes("massage-lab-sparkles"))
    assert.ok(chimerOptions.includes("massage-lab-gradient-animation"))
    assert.ok(chimerOptions.includes("massage-lab-background-beams"))
    assert.ok(chimerOptions.includes("massage-lab-collision-beams"))
    assert.ok(chimerOptions.includes("massage-lab-background-lines"))
    assert.ok(chimerOptions.includes("massage-lab-glowing-stars"))
    assert.ok(chimerOptions.includes("massage-lab-meteors"))
    assert.ok(chimerOptions.includes("massage-lab-shooting-stars"))
    assert.ok(chimerOptions.includes("massage-lab-reveal-dots"))
    assert.ok(chimerOptions.includes("massage-lab-spotlight"))
    assert.ok(chimerOptions.includes("massage-lab-lamp-effect"))
    assert.ok(chimerOptions.includes("massage-lab-vortex"))
    assert.ok(chimerOptions.includes("massage-lab-wavy-background"))
    assert.ok(chimerOptions.includes("massage-lab-3d-globe"))
    assert.ok(chimerOptions.includes("massage-lab-pixel-liquid"))
    assert.ok(chimerOptions.includes("massage-lab-tile-grid"))
    assert.ok(chimerOptions.includes("massage-lab-hex-grid"))
    assert.ok(chimerOptions.includes("massage-lab-retro-grid"))
    assert.ok(chimerOptions.includes("massage-lab-aerial-rays"))
    assert.ok(chimerOptions.includes("massage-lab-aurora-bars"))
    assert.ok(chimerOptions.includes("massage-lab-bubble"))
    assert.ok(chimerOptions.includes("massage-lab-gradient"))
    assert.ok(chimerOptions.includes("massage-lab-stars"))
    assert.ok(chimerOptions.includes("massage-lab-hole"))
    assert.ok(chimerOptions.includes("massage-lab-light-speed"))
    assert.ok(chimerOptions.includes("massage-lab-electric-mist"))
    assert.ok(chimerOptions.includes("massage-lab-astral-flow"))
    assert.ok(chimerOptions.includes("massage-lab-deep-space-nebula"))
    assert.ok(chimerOptions.includes("massage-lab-grid-bloom"))
    assert.ok(chimerOptions.includes("massage-lab-chrome-flow"))
    assert.ok(chimerOptions.includes("massage-lab-wave-current"))
    assert.ok(chimerOptions.includes("massage-lab-synthesis"))
    assert.ok(chimerOptions.includes("massage-lab-novatrix"))
    assert.ok(chimerOptions.includes("massage-lab-matrix-rain"))
    assert.ok(chimerOptions.includes("massage-lab-photon-beam"))
    assert.ok(chimerOptions.includes("massage-lab-liquid-ether"))
    assert.ok(chimerOptions.includes("massage-lab-prism"))
    assert.ok(chimerOptions.includes("massage-lab-dark-veil"))
    assert.ok(chimerOptions.includes("massage-lab-light-pillar"))
    assert.ok(chimerOptions.includes("massage-lab-silk"))
    assert.ok(chimerOptions.includes("massage-lab-floating-lines"))
    assert.ok(chimerOptions.includes("massage-lab-side-rays"))
    assert.ok(chimerOptions.includes("massage-lab-light-rays"))
    assert.ok(chimerOptions.includes("massage-lab-pixel-blast"))
    assert.ok(chimerOptions.includes("massage-lab-color-bends"))
    assert.ok(chimerOptions.includes("massage-lab-evil-eye"))
    assert.ok(chimerOptions.includes("massage-lab-line-waves"))
    assert.ok(chimerOptions.includes("massage-lab-radar"))
    assert.ok(chimerOptions.includes("massage-lab-soft-aurora"))
    assert.ok(chimerOptions.includes("massage-lab-plasma"))
    assert.ok(chimerOptions.includes("massage-lab-plasma-wave"))
    assert.ok(chimerOptions.includes("massage-lab-particles"))
    assert.ok(chimerOptions.includes("massage-lab-gradient-blinds"))
    assert.ok(chimerOptions.includes("massage-lab-grainient"))
    assert.ok(chimerOptions.includes("massage-lab-grid-scan"))
    assert.ok(chimerOptions.includes("massage-lab-beams"))
    assert.ok(chimerOptions.includes("massage-lab-pixel-snow"))
    assert.ok(chimerOptions.includes("massage-lab-lightning"))
    assert.ok(chimerOptions.includes("massage-lab-prismatic-burst"))
    assert.ok(chimerOptions.includes("massage-lab-galaxy"))
    assert.ok(chimerOptions.includes("massage-lab-dither"))
    assert.ok(chimerOptions.includes("massage-lab-faulty-terminal"))
    assert.ok(chimerOptions.includes("massage-lab-ripple-grid"))
    assert.ok(chimerOptions.includes("massage-lab-dot-field"))
    assert.ok(chimerOptions.includes("massage-lab-dot-grid"))
    assert.ok(chimerOptions.includes("massage-lab-threads"))
    assert.ok(chimerOptions.includes("massage-lab-iridescence"))
    assert.ok(chimerOptions.includes("massage-lab-waves"))
    assert.ok(chimerOptions.includes("massage-lab-grid-distortion"))
    assert.ok(chimerOptions.includes("massage-lab-orb"))
    assert.ok(chimerOptions.includes("massage-lab-letter-glitch"))
    assert.ok(chimerOptions.includes("massage-lab-grid-motion"))
    assert.ok(chimerOptions.includes("massage-lab-shape-grid"))
    assert.ok(chimerOptions.includes("massage-lab-liquid-chrome"))
    assert.ok(chimerOptions.includes("massage-lab-balatro"))
    assert.ok(clockOptions.includes("massage-lab-dotted-glow"))
    assert.ok(clockOptions.includes("massage-lab-sparkles"))
    assert.ok(clockOptions.includes("massage-lab-gradient-animation"))
    assert.ok(clockOptions.includes("massage-lab-background-beams"))
    assert.ok(clockOptions.includes("massage-lab-collision-beams"))
    assert.ok(clockOptions.includes("massage-lab-background-lines"))
    assert.ok(clockOptions.includes("massage-lab-glowing-stars"))
    assert.ok(clockOptions.includes("massage-lab-meteors"))
    assert.ok(clockOptions.includes("massage-lab-shooting-stars"))
    assert.ok(clockOptions.includes("massage-lab-reveal-dots"))
    assert.ok(clockOptions.includes("massage-lab-spotlight"))
    assert.ok(clockOptions.includes("massage-lab-lamp-effect"))
    assert.ok(clockOptions.includes("massage-lab-vortex"))
    assert.ok(clockOptions.includes("massage-lab-wavy-background"))
    assert.ok(clockOptions.includes("massage-lab-3d-globe"))
    assert.ok(clockOptions.includes("massage-lab-pixel-liquid"))
    assert.ok(clockOptions.includes("massage-lab-tile-grid"))
    assert.ok(clockOptions.includes("massage-lab-hex-grid"))
    assert.ok(clockOptions.includes("massage-lab-retro-grid"))
    assert.ok(clockOptions.includes("massage-lab-aerial-rays"))
    assert.ok(clockOptions.includes("massage-lab-aurora-bars"))
    assert.ok(clockOptions.includes("massage-lab-bubble"))
    assert.ok(clockOptions.includes("massage-lab-gradient"))
    assert.ok(clockOptions.includes("massage-lab-stars"))
    assert.ok(clockOptions.includes("massage-lab-hole"))
    assert.ok(clockOptions.includes("massage-lab-light-speed"))
    assert.ok(clockOptions.includes("massage-lab-electric-mist"))
    assert.ok(clockOptions.includes("massage-lab-astral-flow"))
    assert.ok(clockOptions.includes("massage-lab-deep-space-nebula"))
    assert.ok(clockOptions.includes("massage-lab-grid-bloom"))
    assert.ok(clockOptions.includes("massage-lab-chrome-flow"))
    assert.ok(clockOptions.includes("massage-lab-wave-current"))
    assert.ok(clockOptions.includes("massage-lab-synthesis"))
    assert.ok(clockOptions.includes("massage-lab-novatrix"))
    assert.ok(clockOptions.includes("massage-lab-matrix-rain"))
    assert.ok(clockOptions.includes("massage-lab-photon-beam"))
    assert.ok(clockOptions.includes("massage-lab-liquid-ether"))
    assert.ok(clockOptions.includes("massage-lab-prism"))
    assert.ok(clockOptions.includes("massage-lab-dark-veil"))
    assert.ok(clockOptions.includes("massage-lab-light-pillar"))
    assert.ok(clockOptions.includes("massage-lab-silk"))
    assert.ok(clockOptions.includes("massage-lab-floating-lines"))
    assert.ok(clockOptions.includes("massage-lab-side-rays"))
    assert.ok(clockOptions.includes("massage-lab-light-rays"))
    assert.ok(clockOptions.includes("massage-lab-pixel-blast"))
    assert.ok(clockOptions.includes("massage-lab-color-bends"))
    assert.ok(clockOptions.includes("massage-lab-evil-eye"))
    assert.ok(clockOptions.includes("massage-lab-line-waves"))
    assert.ok(clockOptions.includes("massage-lab-radar"))
    assert.ok(clockOptions.includes("massage-lab-soft-aurora"))
    assert.ok(clockOptions.includes("massage-lab-plasma"))
    assert.ok(clockOptions.includes("massage-lab-plasma-wave"))
    assert.ok(clockOptions.includes("massage-lab-particles"))
    assert.ok(clockOptions.includes("massage-lab-gradient-blinds"))
    assert.ok(clockOptions.includes("massage-lab-grainient"))
    assert.ok(clockOptions.includes("massage-lab-grid-scan"))
    assert.ok(clockOptions.includes("massage-lab-beams"))
    assert.ok(clockOptions.includes("massage-lab-pixel-snow"))
    assert.ok(clockOptions.includes("massage-lab-lightning"))
    assert.ok(clockOptions.includes("massage-lab-prismatic-burst"))
    assert.ok(clockOptions.includes("massage-lab-galaxy"))
    assert.ok(clockOptions.includes("massage-lab-dither"))
    assert.ok(clockOptions.includes("massage-lab-faulty-terminal"))
    assert.ok(clockOptions.includes("massage-lab-ripple-grid"))
    assert.ok(clockOptions.includes("massage-lab-dot-field"))
    assert.ok(clockOptions.includes("massage-lab-dot-grid"))
    assert.ok(clockOptions.includes("massage-lab-threads"))
    assert.ok(clockOptions.includes("massage-lab-iridescence"))
    assert.ok(clockOptions.includes("massage-lab-waves"))
    assert.ok(clockOptions.includes("massage-lab-grid-distortion"))
    assert.ok(clockOptions.includes("massage-lab-orb"))
    assert.ok(clockOptions.includes("massage-lab-letter-glitch"))
    assert.ok(clockOptions.includes("massage-lab-grid-motion"))
    assert.ok(clockOptions.includes("massage-lab-shape-grid"))
    assert.ok(clockOptions.includes("massage-lab-liquid-chrome"))
    assert.ok(clockOptions.includes("massage-lab-balatro"))
    assert.ok(musicOptions.includes("massage-lab-aurora"))
    assert.ok(musicOptions.includes("massage-lab-dotted-glow"))
    assert.ok(musicOptions.includes("massage-lab-sparkles"))
    assert.ok(musicOptions.includes("massage-lab-gradient-animation"))
    assert.ok(musicOptions.includes("massage-lab-background-beams"))
    assert.ok(musicOptions.includes("massage-lab-collision-beams"))
    assert.ok(musicOptions.includes("massage-lab-background-lines"))
    assert.ok(musicOptions.includes("massage-lab-glowing-stars"))
    assert.ok(musicOptions.includes("massage-lab-meteors"))
    assert.ok(musicOptions.includes("massage-lab-shooting-stars"))
    assert.ok(musicOptions.includes("massage-lab-reveal-dots"))
    assert.ok(musicOptions.includes("massage-lab-spotlight"))
    assert.ok(musicOptions.includes("massage-lab-lamp-effect"))
    assert.ok(musicOptions.includes("massage-lab-vortex"))
    assert.ok(musicOptions.includes("massage-lab-wavy-background"))
    assert.ok(musicOptions.includes("massage-lab-3d-globe"))
    assert.ok(musicOptions.includes("massage-lab-pixel-liquid"))
    assert.ok(musicOptions.includes("massage-lab-tile-grid"))
    assert.ok(musicOptions.includes("massage-lab-hex-grid"))
    assert.ok(musicOptions.includes("massage-lab-retro-grid"))
    assert.ok(musicOptions.includes("massage-lab-aerial-rays"))
    assert.ok(musicOptions.includes("massage-lab-aurora-bars"))
    assert.ok(musicOptions.includes("massage-lab-bubble"))
    assert.ok(musicOptions.includes("massage-lab-gradient"))
    assert.ok(musicOptions.includes("massage-lab-stars"))
    assert.ok(musicOptions.includes("massage-lab-hole"))
    assert.ok(musicOptions.includes("massage-lab-light-speed"))
    assert.ok(musicOptions.includes("massage-lab-electric-mist"))
    assert.ok(musicOptions.includes("massage-lab-astral-flow"))
    assert.ok(musicOptions.includes("massage-lab-deep-space-nebula"))
    assert.ok(musicOptions.includes("massage-lab-grid-bloom"))
    assert.ok(musicOptions.includes("massage-lab-chrome-flow"))
    assert.ok(musicOptions.includes("massage-lab-wave-current"))
    assert.ok(musicOptions.includes("massage-lab-synthesis"))
    assert.ok(musicOptions.includes("massage-lab-novatrix"))
    assert.ok(musicOptions.includes("massage-lab-matrix-rain"))
    assert.ok(musicOptions.includes("massage-lab-photon-beam"))
    assert.ok(musicOptions.includes("massage-lab-liquid-ether"))
    assert.ok(musicOptions.includes("massage-lab-prism"))
    assert.ok(musicOptions.includes("massage-lab-dark-veil"))
    assert.ok(musicOptions.includes("massage-lab-light-pillar"))
    assert.ok(musicOptions.includes("massage-lab-silk"))
    assert.ok(musicOptions.includes("massage-lab-floating-lines"))
    assert.ok(musicOptions.includes("massage-lab-side-rays"))
    assert.ok(musicOptions.includes("massage-lab-light-rays"))
    assert.ok(musicOptions.includes("massage-lab-pixel-blast"))
    assert.ok(musicOptions.includes("massage-lab-color-bends"))
    assert.ok(musicOptions.includes("massage-lab-evil-eye"))
    assert.ok(musicOptions.includes("massage-lab-line-waves"))
    assert.ok(musicOptions.includes("massage-lab-radar"))
    assert.ok(musicOptions.includes("massage-lab-soft-aurora"))
    assert.ok(musicOptions.includes("massage-lab-plasma"))
    assert.ok(musicOptions.includes("massage-lab-plasma-wave"))
    assert.ok(musicOptions.includes("massage-lab-particles"))
    assert.ok(musicOptions.includes("massage-lab-gradient-blinds"))
    assert.ok(musicOptions.includes("massage-lab-grainient"))
    assert.ok(musicOptions.includes("massage-lab-grid-scan"))
    assert.ok(musicOptions.includes("massage-lab-beams"))
    assert.ok(musicOptions.includes("massage-lab-pixel-snow"))
    assert.ok(musicOptions.includes("massage-lab-lightning"))
    assert.ok(musicOptions.includes("massage-lab-prismatic-burst"))
    assert.ok(musicOptions.includes("massage-lab-galaxy"))
    assert.ok(musicOptions.includes("massage-lab-dither"))
    assert.ok(musicOptions.includes("massage-lab-faulty-terminal"))
    assert.ok(musicOptions.includes("massage-lab-ripple-grid"))
    assert.ok(musicOptions.includes("massage-lab-dot-field"))
    assert.ok(musicOptions.includes("massage-lab-dot-grid"))
    assert.ok(musicOptions.includes("massage-lab-threads"))
    assert.ok(musicOptions.includes("massage-lab-iridescence"))
    assert.ok(musicOptions.includes("massage-lab-waves"))
    assert.ok(musicOptions.includes("massage-lab-grid-distortion"))
    assert.ok(musicOptions.includes("massage-lab-orb"))
    assert.ok(musicOptions.includes("massage-lab-letter-glitch"))
    assert.ok(musicOptions.includes("massage-lab-grid-motion"))
    assert.ok(musicOptions.includes("massage-lab-shape-grid"))
    assert.ok(musicOptions.includes("massage-lab-liquid-chrome"))
    assert.ok(musicOptions.includes("massage-lab-balatro"))
    assert.equal(chimerOptions.includes("massage-lab-noise-texture-draft"), false)
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

  it("keeps Aurora Bars dependency-free and outside the Music discovery page", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-aurora-bars-background.tsx", import.meta.url),
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
    assert.doesNotMatch(musicWorkspaceSource, /massage-lab-aurora-bars/)
    assert.doesNotMatch(musicWorkspaceSource, /visualizerActive/)
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

  it("keeps MassageLab Light Speed source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-light-speed-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-light-speed/)
    assert.match(registrySource, /Light Speed/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /MassageLabLightSpeedBackground/)
    assert.match(effectSource, /particleCount: 200/)
    assert.match(effectSource, /warpSpeed: 1/)
    assert.match(effectSource, /MASSAGE_LAB_LIGHT_SPEED_RENDER_SCALE = 0\.1/)
    assert.match(effectSource, /lightColor/)
    assert.match(effectSource, /intensity/)
    assert.match(effectSource, /radius/)
    assert.match(effectSource, /cylinderLength/)
    assert.match(effectSource, /createLinearGradient/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /massageLabLightSpeed/)
    assert.match(hostSource, /massageLabLightSpeed/)
    assert.match(runningSource, /massageLabLightSpeed=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabLightSpeed=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /rgba\(255, 255, 255/)
    assert.doesNotMatch(effectSource, /context\.arc\(head\.x/)
    for (const settingKey of [
      "massageLabLightSpeedWarpSpeed",
      "massageLabLightSpeedParticleCount",
      "massageLabLightSpeedLightColor",
      "massageLabLightSpeedIntensity",
      "massageLabLightSpeedRadius",
      "massageLabLightSpeedCylinderLength",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Electric Mist source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-electric-mist-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-electric-mist/)
    assert.match(registrySource, /Electric Mist/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /MassageLabElectricMistBackground/)
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
    assert.match(stylesSource, /massageLabElectricMist/)
    assert.match(hostSource, /massageLabElectricMist/)
    assert.match(runningSource, /massageLabElectricMist=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabElectricMist=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    for (const settingKey of [
      "massageLabElectricMistColor",
      "massageLabElectricMistSpeed",
      "massageLabElectricMistDetail",
      "massageLabElectricMistDistortion",
      "massageLabElectricMistBrightness",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Astral Flow source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-astral-flow-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-astral-flow/)
    assert.match(registrySource, /Astral Flow/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /MassageLabAstralFlowBackground/)
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
    assert.match(effectSource, /massageLabAstralFlowNoise/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /massageLabAstralFlow/)
    assert.match(hostSource, /massageLabAstralFlow/)
    assert.match(runningSource, /massageLabAstralFlow=\{\{/)
    assert.match(runningSource, /resolveMassageLabAstralFlowColors/)
    assert.match(setupSource, /getMassageLabAstralFlowDisplaySpeed/)
    assert.match(setupSource, /getMassageLabAstralFlowSourceSpeed/)
    assert.match(setupSource, /MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN = 0\.1/)
    assert.match(setupSource, /MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX = 3/)
    assert.match(setupSource, /MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN = 10/)
    assert.match(setupSource, /MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /massageLabAstralFlow=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    for (const settingKey of [
      "massageLabAstralFlowColorOne",
      "massageLabAstralFlowColorTwo",
      "massageLabAstralFlowColorThree",
      "massageLabAstralFlowPaletteMode",
      "massageLabAstralFlowPrimaryColor",
      "massageLabAstralFlowHarmony",
      "massageLabAstralFlowSpeed",
      "massageLabAstralFlowFlowMin",
      "massageLabAstralFlowFlowMax",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Deep Space Nebula source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-deep-space-nebula-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-deep-space-nebula/)
    assert.match(registrySource, /Deep Space Nebula/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /MassageLabDeepSpaceNebulaBackground/)
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
    assert.match(stylesSource, /massageLabDeepSpaceNebula/)
    assert.match(hostSource, /massageLabDeepSpaceNebula/)
    assert.match(runningSource, /massageLabDeepSpaceNebula=\{\{/)
    assert.match(runningSource, /resolveMassageLabDeepSpaceNebulaColors/)
    assert.match(setupSource, /getMassageLabDeepSpaceNebulaDisplaySpeed/)
    assert.match(setupSource, /getMassageLabDeepSpaceNebulaSourceSpeed/)
    assert.match(setupSource, /MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN = 0\.1/)
    assert.match(setupSource, /MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX = 5/)
    assert.match(setupSource, /MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN = 1/)
    assert.match(setupSource, /MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /massageLabDeepSpaceNebula=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    for (const settingKey of [
      "massageLabDeepSpaceNebulaColorOne",
      "massageLabDeepSpaceNebulaColorTwo",
      "massageLabDeepSpaceNebulaColorThree",
      "massageLabDeepSpaceNebulaPaletteMode",
      "massageLabDeepSpaceNebulaPrimaryColor",
      "massageLabDeepSpaceNebulaHarmony",
      "massageLabDeepSpaceNebulaSpeed",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Grid Bloom source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-grid-bloom-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-grid-bloom/)
    assert.match(registrySource, /Grid Bloom/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(registrySource, /cursor interaction intentionally omitted/)
    assert.match(effectSource, /MassageLabGridBloomBackground/)
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
    assert.match(stylesSource, /massageLabGridBloom/)
    assert.match(hostSource, /massageLabGridBloom/)
    assert.match(runningSource, /massageLabGridBloom=\{\{/)
    assert.match(setupSource, /getMassageLabGridBloomDisplaySpeed/)
    assert.match(setupSource, /getMassageLabGridBloomSourceSpeed/)
    assert.match(setupSource, /MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN = 0\.1/)
    assert.match(setupSource, /MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX = 3/)
    assert.match(setupSource, /MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN = 1/)
    assert.match(setupSource, /MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /massageLabGridBloom=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    assert.doesNotMatch(effectSource, /pointermove/)
    assert.doesNotMatch(effectSource, /iMouse/)
    assert.doesNotMatch(effectSource, /uMouseActive/)
    for (const settingKey of [
      "massageLabGridBloomColor",
      "massageLabGridBloomSpeed",
      "massageLabGridBloomGridScale",
      "massageLabGridBloomRotationSpeed",
      "massageLabGridBloomFadeFalloff",
      "massageLabGridBloomDistortionAmount",
      "massageLabGridBloomFlowSpeedX",
      "massageLabGridBloomFlowSpeedY",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Chrome Flow source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-chrome-flow-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-chrome-flow/)
    assert.match(registrySource, /Chrome Flow/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /MassageLabChromeFlowBackground/)
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
    assert.match(stylesSource, /massageLabChromeFlow/)
    assert.match(hostSource, /massageLabChromeFlow/)
    assert.match(runningSource, /massageLabChromeFlow=\{\{/)
    assert.match(runningSource, /resolveMassageLabChromeFlowColors/)
    assert.match(setupSource, /getMassageLabChromeFlowDisplayFlowSpeed/)
    assert.match(setupSource, /getMassageLabChromeFlowSourceFlowSpeed/)
    assert.match(setupSource, /getMassageLabChromeFlowDisplayTimeScale/)
    assert.match(setupSource, /getMassageLabChromeFlowSourceTimeScale/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN = 0\.01/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX = 2/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN = 1/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX = 100/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN = 0\.001/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX = 1/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN = 1/)
    assert.match(setupSource, /MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX = 100/)
    assert.doesNotMatch(pageSource, /massageLabChromeFlow=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "massageLabChromeFlowPaletteMode",
      "massageLabChromeFlowPrimaryColor",
      "massageLabChromeFlowHarmony",
      "massageLabChromeFlowColorOne",
      "massageLabChromeFlowColorTwo",
      "massageLabChromeFlowFlowSpeed",
      "massageLabChromeFlowTimeScale",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Wave Current source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-wave-current-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-wave-current/)
    assert.match(registrySource, /Waves/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabWaveCurrentBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGE_LAB_WAVES/)
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
    assert.match(stylesSource, /massageLabWaveCurrent/)
    assert.match(stylesSource, /massageLabWaveCurrentCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabWaveCurrent/)
    assert.match(runningSource, /massageLabWaveCurrent=\{\{/)
    assert.match(runningSource, /resolveMassageLabWaveCurrentColors/)
    assert.match(setupSource, /getMassageLabWaveCurrentDisplaySpeed/)
    assert.match(setupSource, /getMassageLabWaveCurrentSourceSpeed/)
    assert.match(setupSource, /MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN = 0\.001/)
    assert.match(setupSource, /MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX = 0\.1/)
    assert.match(setupSource, /MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN = 1/)
    assert.match(setupSource, /MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX = 100/)
    assert.doesNotMatch(pageSource, /massageLabWaveCurrent=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /shaderMaterial/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "massageLabWaveCurrentPaletteMode",
      "massageLabWaveCurrentPrimaryColor",
      "massageLabWaveCurrentHarmony",
      "massageLabWaveCurrentBackgroundColor",
      "massageLabWaveCurrentColorOne",
      "massageLabWaveCurrentColorTwo",
      "massageLabWaveCurrentColorThree",
      "massageLabWaveCurrentSpeedX",
      "massageLabWaveCurrentSpeedY",
      "massageLabWaveCurrentAmplitude",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Ferrofluid source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-ferrofluid-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-ferrofluid/)
    assert.match(registrySource, /Ferrofluid/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabFerrofluidBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_FERROFLUID/)
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
    assert.match(stylesSource, /massageLabFerrofluid/)
    assert.match(stylesSource, /massageLabFerrofluidCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabFerrofluid/)
    assert.match(runningSource, /massageLabFerrofluid=\{\{/)
    assert.match(runningSource, /resolveMassageLabFerrofluidColors/)
    assert.match(setupSource, /resolveMassageLabFerrofluidColors/)
    assert.doesNotMatch(pageSource, /massageLabFerrofluid=\{\{/)
    assert.match(docsSource, /Ferrofluid \|/)
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
      "massageLabFerrofluidPaletteMode",
      "massageLabFerrofluidPrimaryColor",
      "massageLabFerrofluidHarmony",
      "massageLabFerrofluidColorOne",
      "massageLabFerrofluidColorTwo",
      "massageLabFerrofluidColorThree",
      "massageLabFerrofluidSpeed",
      "massageLabFerrofluidScale",
      "massageLabFerrofluidTurbulence",
      "massageLabFerrofluidFluidity",
      "massageLabFerrofluidRimWidth",
      "massageLabFerrofluidSharpness",
      "massageLabFerrofluidShimmer",
      "massageLabFerrofluidGlow",
      "massageLabFerrofluidFlowDirection",
      "massageLabFerrofluidOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Lightfall source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-lightfall-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-lightfall/)
    assert.match(registrySource, /Lightfall/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabLightfallBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_LIGHTFALL/)
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
    assert.match(stylesSource, /massageLabLightfall/)
    assert.match(stylesSource, /massageLabLightfallCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabLightfall/)
    assert.match(runningSource, /massageLabLightfall=\{\{/)
    assert.match(runningSource, /resolveMassageLabLightfallColors/)
    assert.match(setupSource, /resolveMassageLabLightfallColors/)
    assert.doesNotMatch(pageSource, /massageLabLightfall=\{\{/)
    assert.match(docsSource, /Lightfall \|/)
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
      "massageLabLightfallPaletteMode",
      "massageLabLightfallPrimaryColor",
      "massageLabLightfallHarmony",
      "massageLabLightfallColorOne",
      "massageLabLightfallColorTwo",
      "massageLabLightfallColorThree",
      "massageLabLightfallBackgroundColor",
      "massageLabLightfallSpeed",
      "massageLabLightfallStreakCount",
      "massageLabLightfallStreakWidth",
      "massageLabLightfallStreakLength",
      "massageLabLightfallGlow",
      "massageLabLightfallDensity",
      "massageLabLightfallTwinkle",
      "massageLabLightfallZoom",
      "massageLabLightfallBackgroundGlow",
      "massageLabLightfallOpacity",
      "massageLabLightfallCursorEnabled",
      "massageLabLightfallCursorStrength",
      "massageLabLightfallCursorRadius",
      "massageLabLightfallCursorDampening",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Liquid Ether source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-liquid-ether-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-liquid-ether/)
    assert.match(registrySource, /Liquid Ether/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabLiquidEtherBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_LIQUID_ETHER/)
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
    assert.match(stylesSource, /massageLabLiquidEther/)
    assert.match(stylesSource, /massageLabLiquidEtherCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabLiquidEther/)
    assert.match(cssEffectsSource, /MassageLabLiquidEtherOptions/)
    assert.match(runningSource, /massageLabLiquidEther=\{\{/)
    assert.match(runningSource, /resolveMassageLabLiquidEtherColors/)
    assert.match(setupSource, /resolveMassageLabLiquidEtherColors/)
    assert.doesNotMatch(pageSource, /massageLabLiquidEther=\{\{/)
    assert.match(docsSource, /Liquid Ether \|/)
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
      "massageLabLiquidEtherPaletteMode",
      "massageLabLiquidEtherPrimaryColor",
      "massageLabLiquidEtherHarmony",
      "massageLabLiquidEtherColorOne",
      "massageLabLiquidEtherColorTwo",
      "massageLabLiquidEtherColorThree",
      "massageLabLiquidEtherCursorEnabled",
      "massageLabLiquidEtherMouseForce",
      "massageLabLiquidEtherCursorSize",
      "massageLabLiquidEtherIsViscous",
      "massageLabLiquidEtherViscous",
      "massageLabLiquidEtherIterationsViscous",
      "massageLabLiquidEtherIterationsPoisson",
      "massageLabLiquidEtherDt",
      "massageLabLiquidEtherBfecc",
      "massageLabLiquidEtherResolution",
      "massageLabLiquidEtherIsBounce",
      "massageLabLiquidEtherAutoDemo",
      "massageLabLiquidEtherAutoSpeed",
      "massageLabLiquidEtherAutoIntensity",
      "massageLabLiquidEtherAutoResumeDelay",
      "massageLabLiquidEtherAutoRampDuration",
      "massageLabLiquidEtherOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Prism source-shaped, raw WebGL, and cursor-optional", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-prism-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-prism/)
    assert.match(registrySource, /Prism/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabPrismBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_PRISM/)
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
    assert.match(stylesSource, /massageLabPrism/)
    assert.match(stylesSource, /massageLabPrismCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabPrism/)
    assert.match(cssEffectsSource, /MassageLabPrismOptions/)
    assert.match(runningSource, /massageLabPrism=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabPrism=\{\{/)
    assert.match(docsSource, /Prism \|/)
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
      "massageLabPrismHeight",
      "massageLabPrismBaseWidth",
      "massageLabPrismAnimationType",
      "massageLabPrismGlow",
      "massageLabPrismOffsetX",
      "massageLabPrismOffsetY",
      "massageLabPrismNoise",
      "massageLabPrismTransparent",
      "massageLabPrismScale",
      "massageLabPrismHueShift",
      "massageLabPrismColorFrequency",
      "massageLabPrismHoverStrength",
      "massageLabPrismInertia",
      "massageLabPrismBloom",
      "massageLabPrismTimeScale",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Dark Veil source-shaped, raw WebGL, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-dark-veil-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-dark-veil/)
    assert.match(registrySource, /Dark Veil/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabDarkVeilBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_DARK_VEIL/)
    assert.match(effectSource, /hueShift: 0/)
    assert.match(effectSource, /noiseIntensity: 0/)
    assert.match(effectSource, /scanlineIntensity: 0/)
    assert.match(effectSource, /speed: 0\.5/)
    assert.match(effectSource, /scanlineFrequency: 0/)
    assert.match(effectSource, /warpAmount: 0/)
    assert.match(effectSource, /resolutionScale: 1/)
    assert.match(effectSource, /cppn_fn/)
    assert.match(effectSource, /hueShiftRGB/)
    assert.match(effectSource, /rgb2yiq/)
    assert.match(effectSource, /yiq2rgb/)
    assert.match(effectSource, /sigmoid/)
    assert.match(effectSource, /uHueShift/)
    assert.match(effectSource, /uNoise/)
    assert.match(effectSource, /uScan/)
    assert.match(effectSource, /uScanFreq/)
    assert.match(effectSource, /uWarp/)
    assert.match(effectSource, /fragmentShaderSource/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("resize"/)
    assert.match(effectSource, /window\.removeEventListener\("resize"/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(stylesSource, /massageLabDarkVeil/)
    assert.match(stylesSource, /massageLabDarkVeilCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabDarkVeil/)
    assert.match(cssEffectsSource, /MassageLabDarkVeilOptions/)
    assert.match(runningSource, /massageLabDarkVeil=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabDarkVeil=\{\{/)
    assert.match(docsSource, /Dark Veil \|/)
    assert.match(docsSource, /DarkVeil\.jsx/)
    assert.match(docsSource, /DarkVeil\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /CPPN/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "massageLabDarkVeilHueShift",
      "massageLabDarkVeilNoiseIntensity",
      "massageLabDarkVeilScanlineIntensity",
      "massageLabDarkVeilSpeed",
      "massageLabDarkVeilScanlineFrequency",
      "massageLabDarkVeilWarpAmount",
      "massageLabDarkVeilResolutionScale",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Light Pillar source-shaped, raw WebGL, customizable, and cursor-optional", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-light-pillar-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-light-pillar/)
    assert.match(registrySource, /Light Pillar/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabLightPillarBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_LIGHT_PILLAR/)
    assert.match(effectSource, /topColor: "#5227FF"/)
    assert.match(effectSource, /bottomColor: "#FF9FFC"/)
    assert.match(effectSource, /intensity: 1/)
    assert.match(effectSource, /rotationSpeed: 0\.3/)
    assert.match(effectSource, /interactive: false/)
    assert.match(effectSource, /glowAmount: 0\.005/)
    assert.match(effectSource, /pillarWidth: 3/)
    assert.match(effectSource, /pillarHeight: 0\.4/)
    assert.match(effectSource, /noiseIntensity: 0\.5/)
    assert.match(effectSource, /mixBlendMode: "screen"/)
    assert.match(effectSource, /pillarRotation: 0/)
    assert.match(effectSource, /quality: "high"/)
    assert.match(effectSource, /QUALITY_SETTINGS/)
    assert.match(effectSource, /iterations: 80/)
    assert.match(effectSource, /waveIterations: 4/)
    assert.match(effectSource, /STEP_MULT/)
    assert.match(effectSource, /MAX_ITER/)
    assert.match(effectSource, /WAVE_ITER/)
    assert.match(effectSource, /uTopColor/)
    assert.match(effectSource, /uBottomColor/)
    assert.match(effectSource, /uIntensity/)
    assert.match(effectSource, /uInteractive/)
    assert.match(effectSource, /uGlowAmount/)
    assert.match(effectSource, /uPillarWidth/)
    assert.match(effectSource, /uPillarHeight/)
    assert.match(effectSource, /uNoiseIntensity/)
    assert.match(effectSource, /uPillarRotCos/)
    assert.match(effectSource, /uPillarRotSin/)
    assert.match(effectSource, /uWaveSin/)
    assert.match(effectSource, /uWaveCos/)
    assert.match(effectSource, /buildFragmentShaderSource/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("resize"/)
    assert.match(effectSource, /window\.removeEventListener\("resize"/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(stylesSource, /massageLabLightPillar/)
    assert.match(stylesSource, /massageLabLightPillarCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabLightPillar/)
    assert.match(cssEffectsSource, /MassageLabLightPillarOptions/)
    assert.match(setupSource, /resolveMassageLabLightPillarColors/)
    assert.match(runningSource, /massageLabLightPillar=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabLightPillar=\{\{/)
    assert.match(docsSource, /Light Pillar \|/)
    assert.match(docsSource, /LightPillar\.jsx/)
    assert.match(docsSource, /LightPillar\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /Three\.js shader/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /container\.addEventListener\("mousemove"/)
    for (const settingKey of [
      "massageLabLightPillarPaletteMode",
      "massageLabLightPillarPrimaryColor",
      "massageLabLightPillarHarmony",
      "massageLabLightPillarTopColor",
      "massageLabLightPillarBottomColor",
      "massageLabLightPillarIntensity",
      "massageLabLightPillarRotationSpeed",
      "massageLabLightPillarInteractive",
      "massageLabLightPillarGlowAmount",
      "massageLabLightPillarWidth",
      "massageLabLightPillarHeight",
      "massageLabLightPillarNoiseIntensity",
      "massageLabLightPillarBlendMode",
      "massageLabLightPillarRotation",
      "massageLabLightPillarQuality",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Silk source-shaped, raw WebGL, customizable, and passive", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-silk-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-silk/)
    assert.match(registrySource, /Silk/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabSilkBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_SILK/)
    assert.match(effectSource, /color: "#7B7481"/)
    assert.match(effectSource, /speed: 5/)
    assert.match(effectSource, /scale: 1/)
    assert.match(effectSource, /noiseIntensity: 1\.5/)
    assert.match(effectSource, /rotation: 0/)
    assert.match(effectSource, /uniform float uTime/)
    assert.match(effectSource, /uniform vec3\s+uColor/)
    assert.match(effectSource, /uniform float uSpeed/)
    assert.match(effectSource, /uniform float uScale/)
    assert.match(effectSource, /uniform float uRotation/)
    assert.match(effectSource, /uniform float uNoiseIntensity/)
    assert.match(effectSource, /float noise\(vec2 texCoord\)/)
    assert.match(effectSource, /vec2 rotateUvs\(vec2 uv, float angle\)/)
    assert.match(effectSource, /vec2\s+uv\s+= rotateUvs\(vUv \* uScale, uRotation\)/)
    assert.match(effectSource, /vec2\s+tex\s+= uv \* uScale/)
    assert.match(effectSource, /tex\.y \+= 0\.03 \* sin\(8\.0 \* tex\.x - tOffset\)/)
    assert.match(effectSource, /0\.02 \* tOffset/)
    assert.match(effectSource, /0\.1 \* tOffset/)
    assert.match(effectSource, /sourceTime = elapsedSeconds \* 0\.1/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("resize"/)
    assert.match(effectSource, /window\.removeEventListener\("resize"/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /deleteBuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(stylesSource, /massageLabSilk/)
    assert.match(stylesSource, /massageLabSilkCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabSilk/)
    assert.match(cssEffectsSource, /MassageLabSilkOptions/)
    assert.match(setupSource, /resolveMassageLabSilkColor/)
    assert.match(runningSource, /massageLabSilk=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabSilk=\{\{/)
    assert.match(docsSource, /Silk \|/)
    assert.match(docsSource, /Silk\.jsx/)
    assert.match(docsSource, /Silk\.css returned 404/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /Three\/R3F shader plane/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /pointermove/)
    assert.doesNotMatch(effectSource, /mousemove/)
    for (const settingKey of [
      "massageLabSilkPaletteMode",
      "massageLabSilkPrimaryColor",
      "massageLabSilkHarmony",
      "massageLabSilkColor",
      "massageLabSilkSpeed",
      "massageLabSilkScale",
      "massageLabSilkNoiseIntensity",
      "massageLabSilkRotation",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Floating Lines source-shaped, raw WebGL, customizable, and cursor-optional", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-floating-lines-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-floating-lines/)
    assert.match(registrySource, /Floating Lines/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabFloatingLinesBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_FLOATING_LINES/)
    assert.match(effectSource, /MAX_LINE_COUNT/)
    assert.match(effectSource, /lineGradient\[8\]/)
    assert.match(effectSource, /background_color/)
    assert.match(effectSource, /getLineColor/)
    assert.match(effectSource, /wave/)
    assert.match(effectSource, /rotate/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /animationSpeed:\s*1/)
    assert.match(effectSource, /interactive:\s*true/)
    assert.match(effectSource, /bendRadius:\s*5/)
    assert.match(effectSource, /bendStrength:\s*-0\.5/)
    assert.match(effectSource, /mouseDamping:\s*0\.05/)
    assert.match(effectSource, /parallax:\s*true/)
    assert.match(effectSource, /parallaxStrength:\s*0\.2/)
    assert.match(effectSource, /mixBlendMode:\s*"screen"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "ogl"/)

    assert.match(stylesSource, /massageLabFloatingLines/)
    assert.match(stylesSource, /massageLabFloatingLinesCanvas/)

    assert.match(hostSource, /massageLabFloatingLines/)
    assert.match(cssEffectsSource, /MassageLabFloatingLinesOptions/)
    assert.match(setupSource, /resolveMassageLabFloatingLinesGradient/)
    assert.match(runningSource, /massageLabFloatingLines=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabFloatingLines=\{\{/)
    assert.match(docsSource, /Floating Lines \|/)
    assert.match(docsSource, /FloatingLines\.jsx/)
    assert.match(docsSource, /FloatingLines\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /Three\.js/)

    const settingKeys = [
      "massageLabFloatingLinesPaletteMode",
      "massageLabFloatingLinesPrimaryColor",
      "massageLabFloatingLinesHarmony",
      "massageLabFloatingLinesColorOne",
      "massageLabFloatingLinesColorTwo",
      "massageLabFloatingLinesColorThree",
      "massageLabFloatingLinesEnableTop",
      "massageLabFloatingLinesEnableMiddle",
      "massageLabFloatingLinesEnableBottom",
      "massageLabFloatingLinesTopLineCount",
      "massageLabFloatingLinesMiddleLineCount",
      "massageLabFloatingLinesBottomLineCount",
      "massageLabFloatingLinesTopLineDistance",
      "massageLabFloatingLinesMiddleLineDistance",
      "massageLabFloatingLinesBottomLineDistance",
      "massageLabFloatingLinesTopWaveX",
      "massageLabFloatingLinesTopWaveY",
      "massageLabFloatingLinesTopWaveRotate",
      "massageLabFloatingLinesMiddleWaveX",
      "massageLabFloatingLinesMiddleWaveY",
      "massageLabFloatingLinesMiddleWaveRotate",
      "massageLabFloatingLinesBottomWaveX",
      "massageLabFloatingLinesBottomWaveY",
      "massageLabFloatingLinesBottomWaveRotate",
      "massageLabFloatingLinesAnimationSpeed",
      "massageLabFloatingLinesInteractive",
      "massageLabFloatingLinesBendRadius",
      "massageLabFloatingLinesBendStrength",
      "massageLabFloatingLinesMouseDamping",
      "massageLabFloatingLinesParallax",
      "massageLabFloatingLinesParallaxStrength",
      "massageLabFloatingLinesBlendMode",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Side Rays source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-side-rays-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-side-rays/)
    assert.match(registrySource, /Side Rays/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabSideRaysBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_SIDE_RAYS/)
    assert.match(effectSource, /rayStrength/)
    assert.match(effectSource, /originToFlip/)
    assert.match(effectSource, /iRayColor1/)
    assert.match(effectSource, /iRayColor2/)
    assert.match(effectSource, /iSpread/)
    assert.match(effectSource, /iFalloff/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /speed:\s*2\.5/)
    assert.match(effectSource, /rayColor1:\s*"#EAB308"/)
    assert.match(effectSource, /rayColor2:\s*"#96C8FF"/)
    assert.match(effectSource, /intensity:\s*2/)
    assert.match(effectSource, /spread:\s*2/)
    assert.match(effectSource, /origin:\s*"top-right"/)
    assert.match(effectSource, /saturation:\s*1\.5/)
    assert.match(effectSource, /blend:\s*0\.75/)
    assert.match(effectSource, /falloff:\s*1\.6/)
    assert.match(effectSource, /opacity:\s*1/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabSideRays/)
    assert.match(stylesSource, /massageLabSideRaysCanvas/)

    assert.match(hostSource, /massageLabSideRays/)
    assert.match(cssEffectsSource, /MassageLabSideRaysOptions/)
    assert.match(setupSource, /resolveMassageLabSideRaysColors/)
    assert.match(runningSource, /massageLabSideRays=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabSideRays=\{\{/)
    assert.match(docsSource, /Side Rays \|/)
    assert.match(docsSource, /SideRays\.jsx/)
    assert.match(docsSource, /SideRays\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabSideRaysPaletteMode",
      "massageLabSideRaysPrimaryColor",
      "massageLabSideRaysHarmony",
      "massageLabSideRaysColorOne",
      "massageLabSideRaysColorTwo",
      "massageLabSideRaysSpeed",
      "massageLabSideRaysIntensity",
      "massageLabSideRaysSpread",
      "massageLabSideRaysOrigin",
      "massageLabSideRaysTilt",
      "massageLabSideRaysSaturation",
      "massageLabSideRaysBlend",
      "massageLabSideRaysFalloff",
      "massageLabSideRaysOpacity",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps Light Rays source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-light-rays-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-light-rays/)
    assert.match(registrySource, /Light Rays/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabLightRaysBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_LIGHT_RAYS/)
    assert.match(effectSource, /rayStrength/)
    assert.match(effectSource, /getAnchorAndDir/)
    assert.match(effectSource, /mouseInfluence/)
    assert.match(effectSource, /noiseAmount/)
    assert.match(effectSource, /distortion/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /raysOrigin:\s*"top-center"/)
    assert.match(effectSource, /raysColor:\s*"#FFFFFF"/)
    assert.match(effectSource, /raysSpeed:\s*1/)
    assert.match(effectSource, /lightSpread:\s*1/)
    assert.match(effectSource, /rayLength:\s*2/)
    assert.match(effectSource, /pulsating:\s*false/)
    assert.match(effectSource, /followMouse:\s*false/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabLightRays/)
    assert.match(stylesSource, /massageLabLightRaysCanvas/)

    assert.match(hostSource, /massageLabLightRays/)
    assert.match(cssEffectsSource, /MassageLabLightRaysOptions/)
    assert.match(setupSource, /resolveMassageLabLightRaysColor/)
    assert.match(runningSource, /massageLabLightRays=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabLightRays=\{\{/)
    assert.match(docsSource, /Light Rays \|/)
    assert.match(docsSource, /LightRays\.jsx/)
    assert.match(docsSource, /LightRays\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabLightRaysPaletteMode",
      "massageLabLightRaysPrimaryColor",
      "massageLabLightRaysHarmony",
      "massageLabLightRaysColor",
      "massageLabLightRaysOrigin",
      "massageLabLightRaysSpeed",
      "massageLabLightRaysSpread",
      "massageLabLightRaysLength",
      "massageLabLightRaysPulsating",
      "massageLabLightRaysFadeDistance",
      "massageLabLightRaysSaturation",
      "massageLabLightRaysFollowMouse",
      "massageLabLightRaysMouseInfluence",
      "massageLabLightRaysNoiseAmount",
      "massageLabLightRaysDistortion",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Pixel Blast source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-pixel-blast-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-pixel-blast/)
    assert.match(registrySource, /Pixel Blast/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabPixelBlastBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_PIXEL_BLAST/)
    assert.match(effectSource, /Bayer8/)
    assert.match(effectSource, /fbm2/)
    assert.match(effectSource, /maskCircle/)
    assert.match(effectSource, /maskTriangle/)
    assert.match(effectSource, /maskDiamond/)
    assert.match(effectSource, /createTouchTexture/)
    assert.match(effectSource, /uTouchTexture/)
    assert.match(effectSource, /uClickPos/)
    assert.match(effectSource, /OES_standard_derivatives/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteTexture/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /variant:\s*"square"/)
    assert.match(effectSource, /pixelSize:\s*3/)
    assert.match(effectSource, /color:\s*"#B497CF"/)
    assert.match(effectSource, /patternScale:\s*2/)
    assert.match(effectSource, /patternDensity:\s*1/)
    assert.match(effectSource, /liquid:\s*false/)
    assert.match(effectSource, /enableRipples:\s*true/)
    assert.match(effectSource, /speed:\s*0\.5/)
    assert.match(effectSource, /transparent:\s*true/)
    assert.match(effectSource, /edgeFade:\s*0\.5/)
    assert.match(effectSource, /noiseAmount:\s*0/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "postprocessing"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabPixelBlast/)
    assert.match(stylesSource, /massageLabPixelBlastCanvas/)

    assert.match(hostSource, /massageLabPixelBlast/)
    assert.match(cssEffectsSource, /MassageLabPixelBlastOptions/)
    assert.match(setupSource, /resolveMassageLabPixelBlastColor/)
    assert.match(runningSource, /massageLabPixelBlast=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabPixelBlast=\{\{/)
    assert.match(docsSource, /Pixel Blast \|/)
    assert.match(docsSource, /PixelBlast\.jsx/)
    assert.match(docsSource, /PixelBlast\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /Three\.js/)
    assert.match(docsSource, /postprocessing/)

    const settingKeys = [
      "massageLabPixelBlastPaletteMode",
      "massageLabPixelBlastPrimaryColor",
      "massageLabPixelBlastHarmony",
      "massageLabPixelBlastColor",
      "massageLabPixelBlastVariant",
      "massageLabPixelBlastPixelSize",
      "massageLabPixelBlastAntialias",
      "massageLabPixelBlastPatternScale",
      "massageLabPixelBlastPatternDensity",
      "massageLabPixelBlastLiquid",
      "massageLabPixelBlastLiquidStrength",
      "massageLabPixelBlastLiquidRadius",
      "massageLabPixelBlastPixelSizeJitter",
      "massageLabPixelBlastEnableRipples",
      "massageLabPixelBlastRippleIntensityScale",
      "massageLabPixelBlastRippleThickness",
      "massageLabPixelBlastRippleSpeed",
      "massageLabPixelBlastLiquidWobbleSpeed",
      "massageLabPixelBlastAutoPauseOffscreen",
      "massageLabPixelBlastSpeed",
      "massageLabPixelBlastTransparent",
      "massageLabPixelBlastEdgeFade",
      "massageLabPixelBlastNoiseAmount",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Color Bends source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-color-bends-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-color-bends/)
    assert.match(registrySource, /Color Bends/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabColorBendsBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_COLOR_BENDS/)
    assert.match(effectSource, /uColorCount/)
    assert.match(effectSource, /uColors\[MAX_COLORS\]/)
    assert.match(effectSource, /uWarpStrength/)
    assert.match(effectSource, /uPointer/)
    assert.match(effectSource, /uMouseInfluence/)
    assert.match(effectSource, /uBandWidth/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /rotation:\s*90/)
    assert.match(effectSource, /speed:\s*0\.2/)
    assert.match(effectSource, /colors:\s*\[\]/)
    assert.match(effectSource, /autoRotate:\s*0/)
    assert.match(effectSource, /scale:\s*1/)
    assert.match(effectSource, /frequency:\s*1/)
    assert.match(effectSource, /warpStrength:\s*1/)
    assert.match(effectSource, /mouseInfluence:\s*1/)
    assert.match(effectSource, /parallax:\s*0\.5/)
    assert.match(effectSource, /noise:\s*0\.15/)
    assert.match(effectSource, /iterations:\s*1/)
    assert.match(effectSource, /intensity:\s*1\.5/)
    assert.match(effectSource, /bandWidth:\s*6/)
    assert.match(effectSource, /interactive:\s*false/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabColorBends/)
    assert.match(stylesSource, /massageLabColorBendsCanvas/)

    assert.match(hostSource, /massageLabColorBends/)
    assert.match(cssEffectsSource, /MassageLabColorBendsOptions/)
    assert.match(setupSource, /resolveMassageLabColorBendsColors/)
    assert.match(runningSource, /massageLabColorBends=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabColorBends=\{\{/)
    assert.match(docsSource, /Color Bends \|/)
    assert.match(docsSource, /ColorBends\.jsx/)
    assert.match(docsSource, /ColorBends\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /Three\.js/)

    const settingKeys = [
      "massageLabColorBendsPaletteMode",
      "massageLabColorBendsPrimaryColor",
      "massageLabColorBendsHarmony",
      "massageLabColorBendsColorOne",
      "massageLabColorBendsColorTwo",
      "massageLabColorBendsColorThree",
      "massageLabColorBendsColorFour",
      "massageLabColorBendsRotation",
      "massageLabColorBendsSpeed",
      "massageLabColorBendsTransparent",
      "massageLabColorBendsAutoRotate",
      "massageLabColorBendsScale",
      "massageLabColorBendsFrequency",
      "massageLabColorBendsWarpStrength",
      "massageLabColorBendsInteractive",
      "massageLabColorBendsMouseInfluence",
      "massageLabColorBendsParallax",
      "massageLabColorBendsNoise",
      "massageLabColorBendsIterations",
      "massageLabColorBendsIntensity",
      "massageLabColorBendsBandWidth",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Evil Eye source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-evil-eye-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-evil-eye/)
    assert.match(registrySource, /Evil Eye/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabEvilEyeBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_EVIL_EYE/)
    assert.match(effectSource, /generateNoiseTexture/)
    assert.match(effectSource, /uPupilSize/)
    assert.match(effectSource, /uIrisWidth/)
    assert.match(effectSource, /uGlowIntensity/)
    assert.match(effectSource, /uPupilFollow/)
    assert.match(effectSource, /uFlameSpeed/)
    assert.match(effectSource, /uEyeColor/)
    assert.match(effectSource, /uBgColor/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteTexture/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /eyeColor:\s*"#FF6F37"/)
    assert.match(effectSource, /backgroundColor:\s*"#000000"/)
    assert.match(effectSource, /intensity:\s*1\.5/)
    assert.match(effectSource, /pupilSize:\s*0\.6/)
    assert.match(effectSource, /irisWidth:\s*0\.25/)
    assert.match(effectSource, /glowIntensity:\s*0\.35/)
    assert.match(effectSource, /scale:\s*0\.8/)
    assert.match(effectSource, /noiseScale:\s*1/)
    assert.match(effectSource, /pupilFollow:\s*1/)
    assert.match(effectSource, /flameSpeed:\s*1/)
    assert.match(effectSource, /interactive:\s*false/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabEvilEye/)
    assert.match(stylesSource, /massageLabEvilEyeCanvas/)

    assert.match(hostSource, /massageLabEvilEye/)
    assert.match(cssEffectsSource, /MassageLabEvilEyeOptions/)
    assert.match(setupSource, /resolveMassageLabEvilEyeColor/)
    assert.match(runningSource, /massageLabEvilEye=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabEvilEye=\{\{/)
    assert.match(docsSource, /Evil Eye \|/)
    assert.match(docsSource, /EvilEye\.jsx/)
    assert.match(docsSource, /EvilEye\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabEvilEyePaletteMode",
      "massageLabEvilEyePrimaryColor",
      "massageLabEvilEyeHarmony",
      "massageLabEvilEyeColor",
      "massageLabEvilEyeBackgroundColor",
      "massageLabEvilEyeIntensity",
      "massageLabEvilEyePupilSize",
      "massageLabEvilEyeIrisWidth",
      "massageLabEvilEyeGlowIntensity",
      "massageLabEvilEyeScale",
      "massageLabEvilEyeNoiseScale",
      "massageLabEvilEyePupilFollow",
      "massageLabEvilEyeFlameSpeed",
      "massageLabEvilEyeInteractive",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Line Waves source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-line-waves-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-line-waves/)
    assert.match(registrySource, /Line Waves/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabLineWavesBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_LINE_WAVES/)
    assert.match(effectSource, /displaceA/)
    assert.match(effectSource, /displaceB/)
    assert.match(effectSource, /smoothNoise/)
    assert.match(effectSource, /uInnerLines/)
    assert.match(effectSource, /uOuterLines/)
    assert.match(effectSource, /uWarpIntensity/)
    assert.match(effectSource, /uColorCycleSpeed/)
    assert.match(effectSource, /uMouseInfluence/)
    assert.match(effectSource, /uEnableMouse/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /speed:\s*0\.3/)
    assert.match(effectSource, /innerLineCount:\s*32/)
    assert.match(effectSource, /outerLineCount:\s*36/)
    assert.match(effectSource, /warpIntensity:\s*1/)
    assert.match(effectSource, /rotation:\s*-45/)
    assert.match(effectSource, /edgeFadeWidth:\s*0/)
    assert.match(effectSource, /colorCycleSpeed:\s*1/)
    assert.match(effectSource, /brightness:\s*0\.2/)
    assert.match(effectSource, /color1:\s*"#FFFFFF"/)
    assert.match(effectSource, /color2:\s*"#FFFFFF"/)
    assert.match(effectSource, /color3:\s*"#FFFFFF"/)
    assert.match(effectSource, /enableMouseInteraction:\s*false/)
    assert.match(effectSource, /mouseInfluence:\s*2/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabLineWaves/)
    assert.match(stylesSource, /massageLabLineWavesCanvas/)

    assert.match(hostSource, /massageLabLineWaves/)
    assert.match(cssEffectsSource, /MassageLabLineWavesOptions/)
    assert.match(setupSource, /resolveMassageLabLineWavesColors/)
    assert.match(runningSource, /massageLabLineWaves=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabLineWaves=\{\{/)
    assert.match(docsSource, /Line Waves \|/)
    assert.match(docsSource, /LineWaves\.jsx/)
    assert.match(docsSource, /LineWaves\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabLineWavesPaletteMode",
      "massageLabLineWavesPrimaryColor",
      "massageLabLineWavesHarmony",
      "massageLabLineWavesColorOne",
      "massageLabLineWavesColorTwo",
      "massageLabLineWavesColorThree",
      "massageLabLineWavesSpeed",
      "massageLabLineWavesInnerLineCount",
      "massageLabLineWavesOuterLineCount",
      "massageLabLineWavesWarpIntensity",
      "massageLabLineWavesRotation",
      "massageLabLineWavesEdgeFadeWidth",
      "massageLabLineWavesColorCycleSpeed",
      "massageLabLineWavesBrightness",
      "massageLabLineWavesEnableMouseInteraction",
      "massageLabLineWavesMouseInfluence",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Radar source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-radar-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-radar/)
    assert.match(registrySource, /Radar/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabRadarBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_RADAR/)
    assert.match(effectSource, /uRingCount/)
    assert.match(effectSource, /uSpokeCount/)
    assert.match(effectSource, /uRingThickness/)
    assert.match(effectSource, /uSpokeThickness/)
    assert.match(effectSource, /uSweepSpeed/)
    assert.match(effectSource, /uSweepWidth/)
    assert.match(effectSource, /uSweepLobes/)
    assert.match(effectSource, /uFalloff/)
    assert.match(effectSource, /uBrightness/)
    assert.match(effectSource, /uEnableMouse/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /speed:\s*1/)
    assert.match(effectSource, /scale:\s*0\.5/)
    assert.match(effectSource, /ringCount:\s*10/)
    assert.match(effectSource, /spokeCount:\s*10/)
    assert.match(effectSource, /ringThickness:\s*0\.05/)
    assert.match(effectSource, /spokeThickness:\s*0\.01/)
    assert.match(effectSource, /sweepSpeed:\s*1/)
    assert.match(effectSource, /sweepWidth:\s*2/)
    assert.match(effectSource, /sweepLobes:\s*1/)
    assert.match(effectSource, /color:\s*"#9F29FF"/)
    assert.match(effectSource, /backgroundColor:\s*"#000000"/)
    assert.match(effectSource, /falloff:\s*2/)
    assert.match(effectSource, /brightness:\s*1/)
    assert.match(effectSource, /enableMouseInteraction:\s*false/)
    assert.match(effectSource, /mouseInfluence:\s*0\.1/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabRadar/)
    assert.match(stylesSource, /massageLabRadarCanvas/)

    assert.match(hostSource, /massageLabRadar/)
    assert.match(cssEffectsSource, /MassageLabRadarOptions/)
    assert.match(setupSource, /resolveMassageLabRadarColor/)
    assert.match(runningSource, /massageLabRadar=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabRadar=\{\{/)
    assert.match(docsSource, /Radar \|/)
    assert.match(docsSource, /Radar\.jsx/)
    assert.match(docsSource, /Radar\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabRadarPaletteMode",
      "massageLabRadarPrimaryColor",
      "massageLabRadarHarmony",
      "massageLabRadarColor",
      "massageLabRadarBackgroundColor",
      "massageLabRadarSpeed",
      "massageLabRadarScale",
      "massageLabRadarRingCount",
      "massageLabRadarSpokeCount",
      "massageLabRadarRingThickness",
      "massageLabRadarSpokeThickness",
      "massageLabRadarSweepSpeed",
      "massageLabRadarSweepWidth",
      "massageLabRadarSweepLobes",
      "massageLabRadarFalloff",
      "massageLabRadarBrightness",
      "massageLabRadarEnableMouseInteraction",
      "massageLabRadarMouseInfluence",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Soft Aurora source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-soft-aurora-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-soft-aurora/)
    assert.match(registrySource, /Soft Aurora/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabSoftAuroraBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_SOFT_AURORA/)
    assert.match(effectSource, /gradientHash/)
    assert.match(effectSource, /perlin3D/)
    assert.match(effectSource, /auroraGlow/)
    assert.match(effectSource, /cosineGradient/)
    assert.match(effectSource, /uNoiseFreq/)
    assert.match(effectSource, /uNoiseAmp/)
    assert.match(effectSource, /uBandHeight/)
    assert.match(effectSource, /uBandSpread/)
    assert.match(effectSource, /uOctaveDecay/)
    assert.match(effectSource, /uLayerOffset/)
    assert.match(effectSource, /uColorSpeed/)
    assert.match(effectSource, /uEnableMouse/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /alpha:\s*true/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /speed:\s*0\.6/)
    assert.match(effectSource, /scale:\s*1\.5/)
    assert.match(effectSource, /brightness:\s*1/)
    assert.match(effectSource, /color1:\s*"#F7F7F7"/)
    assert.match(effectSource, /color2:\s*"#E100FF"/)
    assert.match(effectSource, /noiseFrequency:\s*2\.5/)
    assert.match(effectSource, /noiseAmplitude:\s*1/)
    assert.match(effectSource, /bandHeight:\s*0\.5/)
    assert.match(effectSource, /bandSpread:\s*1/)
    assert.match(effectSource, /octaveDecay:\s*0\.1/)
    assert.match(effectSource, /layerOffset:\s*0/)
    assert.match(effectSource, /colorSpeed:\s*1/)
    assert.match(effectSource, /enableMouseInteraction:\s*false/)
    assert.match(effectSource, /mouseInfluence:\s*0\.25/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabSoftAurora/)
    assert.match(stylesSource, /massageLabSoftAuroraCanvas/)

    assert.match(hostSource, /massageLabSoftAurora/)
    assert.match(cssEffectsSource, /MassageLabSoftAuroraOptions/)
    assert.match(setupSource, /resolveMassageLabSoftAuroraColors/)
    assert.match(runningSource, /massageLabSoftAurora=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabSoftAurora=\{\{/)
    assert.match(docsSource, /Soft Aurora \|/)
    assert.match(docsSource, /SoftAurora\.jsx/)
    assert.match(docsSource, /SoftAurora\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabSoftAuroraPaletteMode",
      "massageLabSoftAuroraPrimaryColor",
      "massageLabSoftAuroraHarmony",
      "massageLabSoftAuroraColorOne",
      "massageLabSoftAuroraColorTwo",
      "massageLabSoftAuroraSpeed",
      "massageLabSoftAuroraScale",
      "massageLabSoftAuroraBrightness",
      "massageLabSoftAuroraNoiseFrequency",
      "massageLabSoftAuroraNoiseAmplitude",
      "massageLabSoftAuroraBandHeight",
      "massageLabSoftAuroraBandSpread",
      "massageLabSoftAuroraOctaveDecay",
      "massageLabSoftAuroraLayerOffset",
      "massageLabSoftAuroraColorSpeed",
      "massageLabSoftAuroraEnableMouseInteraction",
      "massageLabSoftAuroraMouseInfluence",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Plasma source-shaped, raw WebGL2, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-plasma-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-plasma/)
    assert.match(registrySource, /label:\s*"Plasma"/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabPlasmaBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_PLASMA/)
    assert.match(effectSource, /#version 300 es/)
    assert.match(effectSource, /getContext\("webgl2"/)
    assert.match(effectSource, /uCustomColor/)
    assert.match(effectSource, /uDirection/)
    assert.match(effectSource, /uOpacity/)
    assert.match(effectSource, /uMouseInteractive/)
    assert.match(effectSource, /pingpongDuration/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /color:\s*"#FFFFFF"/)
    assert.match(effectSource, /speed:\s*1/)
    assert.match(effectSource, /direction:\s*"forward"/)
    assert.match(effectSource, /scale:\s*1/)
    assert.match(effectSource, /opacity:\s*1/)
    assert.match(effectSource, /mouseInteractive:\s*false/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabPlasma/)
    assert.match(stylesSource, /massageLabPlasmaCanvas/)

    assert.match(hostSource, /massageLabPlasma/)
    assert.match(cssEffectsSource, /MassageLabPlasmaOptions/)
    assert.match(setupSource, /resolveMassageLabPlasmaColor/)
    assert.match(runningSource, /massageLabPlasma=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabPlasma=\{\{/)
    assert.match(docsSource, /Plasma \|/)
    assert.match(docsSource, /Plasma\.jsx/)
    assert.match(docsSource, /Plasma\.css/)
    assert.match(docsSource, /raw WebGL2/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabPlasmaPaletteMode",
      "massageLabPlasmaPrimaryColor",
      "massageLabPlasmaHarmony",
      "massageLabPlasmaColor",
      "massageLabPlasmaSpeed",
      "massageLabPlasmaDirection",
      "massageLabPlasmaScale",
      "massageLabPlasmaOpacity",
      "massageLabPlasmaMouseInteractive",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Plasma Wave source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-plasma-wave-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-plasma-wave/)
    assert.match(registrySource, /Plasma Wave/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabPlasmaWaveBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_PLASMA_WAVE/)
    assert.match(effectSource, /MAX_STEPS 14/)
    assert.match(effectSource, /uFocalLength/)
    assert.match(effectSource, /uSpeed1/)
    assert.match(effectSource, /uSpeed2/)
    assert.match(effectSource, /uDir2/)
    assert.match(effectSource, /uBend1/)
    assert.match(effectSource, /uBend2/)
    assert.match(effectSource, /uColor1/)
    assert.match(effectSource, /uColor2/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /"#A855F7"/)
    assert.match(effectSource, /"#06B6D4"/)
    assert.match(effectSource, /focalLength:\s*0\.8/)
    assert.match(effectSource, /speed1:\s*0\.05/)
    assert.match(effectSource, /speed2:\s*0\.05/)
    assert.match(effectSource, /bend1:\s*1/)
    assert.match(effectSource, /bend2:\s*0\.5/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabPlasmaWave/)
    assert.match(stylesSource, /massageLabPlasmaWaveCanvas/)

    assert.match(hostSource, /massageLabPlasmaWave/)
    assert.match(cssEffectsSource, /MassageLabPlasmaWaveOptions/)
    assert.match(setupSource, /resolveMassageLabPlasmaWaveColors/)
    assert.match(runningSource, /massageLabPlasmaWave=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabPlasmaWave=\{\{/)
    assert.match(docsSource, /Plasma Wave \|/)
    assert.match(docsSource, /PlasmaWave\.jsx/)
    assert.match(docsSource, /PlasmaWave\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabPlasmaWavePaletteMode",
      "massageLabPlasmaWavePrimaryColor",
      "massageLabPlasmaWaveHarmony",
      "massageLabPlasmaWaveColorOne",
      "massageLabPlasmaWaveColorTwo",
      "massageLabPlasmaWaveXOffset",
      "massageLabPlasmaWaveYOffset",
      "massageLabPlasmaWaveRotationDeg",
      "massageLabPlasmaWaveFocalLength",
      "massageLabPlasmaWaveSpeedOne",
      "massageLabPlasmaWaveSpeedTwo",
      "massageLabPlasmaWaveDirectionTwo",
      "massageLabPlasmaWaveBendOne",
      "massageLabPlasmaWaveBendTwo",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Particles source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-particles-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-particles/)
    assert.match(registrySource, /Particles/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabParticlesBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_PARTICLES/)
    assert.match(effectSource, /attribute vec3 position/)
    assert.match(effectSource, /attribute vec4 random/)
    assert.match(effectSource, /attribute vec3 color/)
    assert.match(effectSource, /gl_PointSize/)
    assert.match(effectSource, /gl\.POINTS/)
    assert.match(effectSource, /modelMatrix/)
    assert.match(effectSource, /projectionMatrix/)
    assert.match(effectSource, /setPerspectiveMatrix/)
    assert.match(effectSource, /createParticleData/)
    assert.match(effectSource, /particleCount:\s*200/)
    assert.match(effectSource, /particleSpread:\s*10/)
    assert.match(effectSource, /speed:\s*0\.1/)
    assert.match(effectSource, /particleBaseSize:\s*100/)
    assert.match(effectSource, /cameraDistance:\s*20/)
    assert.match(effectSource, /moveParticlesOnHover/)
    assert.match(effectSource, /pointermove/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /deleteProgram/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabParticles/)
    assert.match(stylesSource, /massageLabParticlesCanvas/)

    assert.match(hostSource, /massageLabParticles/)
    assert.match(cssEffectsSource, /MassageLabParticlesOptions/)
    assert.match(setupSource, /resolveMassageLabParticlesColors/)
    assert.match(runningSource, /massageLabParticles=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabParticles=\{\{/)
    assert.match(docsSource, /Particles \|/)
    assert.match(docsSource, /Particles\.jsx/)
    assert.match(docsSource, /Particles\.css/)
    assert.match(docsSource, /point-sprite particle cloud/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabParticlesPaletteMode",
      "massageLabParticlesPrimaryColor",
      "massageLabParticlesHarmony",
      "massageLabParticlesColorOne",
      "massageLabParticlesColorTwo",
      "massageLabParticlesColorThree",
      "massageLabParticlesCount",
      "massageLabParticlesSpread",
      "massageLabParticlesSpeed",
      "massageLabParticlesMoveOnHover",
      "massageLabParticlesHoverFactor",
      "massageLabParticlesAlpha",
      "massageLabParticlesBaseSize",
      "massageLabParticlesSizeRandomness",
      "massageLabParticlesCameraDistance",
      "massageLabParticlesDisableRotation",
      "massageLabParticlesPixelRatio",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Gradient Blinds source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-gradient-blinds-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-gradient-blinds/)
    assert.match(registrySource, /Gradient Blinds/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabGradientBlindsBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_GRADIENT_BLINDS/)
    assert.match(effectSource, /gradientColors:\s*\["#FF9FFC", "#5227FF"\]/)
    assert.match(effectSource, /noise:\s*0\.3/)
    assert.match(effectSource, /blindCount:\s*16/)
    assert.match(effectSource, /blindMinWidth:\s*60/)
    assert.match(effectSource, /mouseDampening:\s*0\.15/)
    assert.match(effectSource, /spotlightRadius:\s*0\.5/)
    assert.match(effectSource, /mixBlendMode:\s*"lighten"/)
    assert.match(effectSource, /uniform vec3 uColor0/)
    assert.match(effectSource, /uBlindCount/)
    assert.match(effectSource, /uSpotlightOpacity/)
    assert.match(effectSource, /uShineFlip/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /pointermove/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabGradientBlinds/)
    assert.match(stylesSource, /massageLabGradientBlindsCanvas/)
    assert.match(hostSource, /massageLabGradientBlinds/)
    assert.match(cssEffectsSource, /MassageLabGradientBlindsOptions/)
    assert.match(setupSource, /resolveMassageLabGradientBlindsColors/)
    assert.match(runningSource, /massageLabGradientBlinds=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabGradientBlinds=\{\{/)
    assert.match(docsSource, /Gradient Blinds \|/)
    assert.match(docsSource, /GradientBlinds\.jsx/)
    assert.match(docsSource, /GradientBlinds\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabGradientBlindsPaletteMode",
      "massageLabGradientBlindsPrimaryColor",
      "massageLabGradientBlindsHarmony",
      "massageLabGradientBlindsColorOne",
      "massageLabGradientBlindsColorTwo",
      "massageLabGradientBlindsAngle",
      "massageLabGradientBlindsNoise",
      "massageLabGradientBlindsBlindCount",
      "massageLabGradientBlindsBlindMinWidth",
      "massageLabGradientBlindsMouseDampening",
      "massageLabGradientBlindsMirror",
      "massageLabGradientBlindsSpotlightRadius",
      "massageLabGradientBlindsSpotlightSoftness",
      "massageLabGradientBlindsSpotlightOpacity",
      "massageLabGradientBlindsDistort",
      "massageLabGradientBlindsShineDirection",
      "massageLabGradientBlindsBlendMode",
      "massageLabGradientBlindsDpr",
      "massageLabGradientBlindsEnableMouseInteraction",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Grainient source-shaped, raw WebGL2, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-grainient-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-grainient/)
    assert.match(registrySource, /Grainient/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabGrainientBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_GRAINIENT/)
    assert.match(effectSource, /#version 300 es/)
    assert.match(effectSource, /getContext\("webgl2"/)
    assert.match(effectSource, /uTimeSpeed/)
    assert.match(effectSource, /uWarpStrength/)
    assert.match(effectSource, /uGrainAmount/)
    assert.match(effectSource, /timeSpeed:\s*0\.25/)
    assert.match(effectSource, /warpFrequency:\s*5/)
    assert.match(effectSource, /warpAmplitude:\s*50/)
    assert.match(effectSource, /rotationAmount:\s*500/)
    assert.match(effectSource, /grainAmount:\s*0\.1/)
    assert.match(effectSource, /contrast:\s*1\.5/)
    assert.match(effectSource, /zoom:\s*0\.9/)
    assert.match(effectSource, /color1:\s*"#FF9FFC"/)
    assert.match(effectSource, /color2:\s*"#5227FF"/)
    assert.match(effectSource, /color3:\s*"#B497CF"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabGrainient/)
    assert.match(stylesSource, /massageLabGrainientCanvas/)
    assert.match(hostSource, /massageLabGrainient/)
    assert.match(cssEffectsSource, /MassageLabGrainientOptions/)
    assert.match(setupSource, /resolveMassageLabGrainientColors/)
    assert.match(runningSource, /massageLabGrainient=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabGrainient=\{\{/)
    assert.match(docsSource, /Grainient \|/)
    assert.match(docsSource, /Grainient\.jsx/)
    assert.match(docsSource, /Grainient\.css/)
    assert.match(docsSource, /raw WebGL2/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabGrainientPaletteMode",
      "massageLabGrainientPrimaryColor",
      "massageLabGrainientHarmony",
      "massageLabGrainientColorOne",
      "massageLabGrainientColorTwo",
      "massageLabGrainientColorThree",
      "massageLabGrainientTimeSpeed",
      "massageLabGrainientColorBalance",
      "massageLabGrainientWarpStrength",
      "massageLabGrainientWarpFrequency",
      "massageLabGrainientWarpSpeed",
      "massageLabGrainientWarpAmplitude",
      "massageLabGrainientBlendAngle",
      "massageLabGrainientBlendSoftness",
      "massageLabGrainientRotationAmount",
      "massageLabGrainientNoiseScale",
      "massageLabGrainientGrainAmount",
      "massageLabGrainientGrainScale",
      "massageLabGrainientGrainAnimated",
      "massageLabGrainientContrast",
      "massageLabGrainientGamma",
      "massageLabGrainientSaturation",
      "massageLabGrainientCenterX",
      "massageLabGrainientCenterY",
      "massageLabGrainientZoom",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Grid Scan source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-grid-scan-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-grid-scan/)
    assert.match(registrySource, /Grid Scan/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabGridScanBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_GRID_SCAN/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /OES_standard_derivatives/)
    assert.match(effectSource, /uScanStarts/)
    assert.match(effectSource, /uScanCount/)
    assert.match(effectSource, /uLineThickness/)
    assert.match(effectSource, /uScanGlow/)
    assert.match(effectSource, /sensitivity:\s*0\.55/)
    assert.match(effectSource, /lineThickness:\s*1/)
    assert.match(effectSource, /gridScale:\s*0\.1/)
    assert.match(effectSource, /lineStyle:\s*"solid"/)
    assert.match(effectSource, /scanDirection:\s*"pingpong"/)
    assert.match(effectSource, /scanPhaseTaper:\s*0\.49/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /pointermove/)
    assert.match(effectSource, /pointerdown/)
    assert.match(effectSource, /visibilitychange/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /deleteProgram/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /face-api/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabGridScan/)
    assert.match(stylesSource, /massageLabGridScanCanvas/)
    assert.match(hostSource, /massageLabGridScan/)
    assert.match(cssEffectsSource, /MassageLabGridScanOptions/)
    assert.match(setupSource, /resolveMassageLabGridScanColors/)
    assert.match(runningSource, /massageLabGridScan=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabGridScan=\{\{/)
    assert.match(docsSource, /Grid Scan \|/)
    assert.match(docsSource, /GridScan\.jsx/)
    assert.match(docsSource, /GridScan\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /face-api\.js/)
    assert.match(docsSource, /postprocessing/)

    const settingKeys = [
      "massageLabGridScanPaletteMode",
      "massageLabGridScanPrimaryColor",
      "massageLabGridScanHarmony",
      "massageLabGridScanLinesColor",
      "massageLabGridScanScanColor",
      "massageLabGridScanSensitivity",
      "massageLabGridScanLineThickness",
      "massageLabGridScanScanOpacity",
      "massageLabGridScanGridScale",
      "massageLabGridScanLineStyle",
      "massageLabGridScanLineJitter",
      "massageLabGridScanDirection",
      "massageLabGridScanNoiseIntensity",
      "massageLabGridScanBloomOpacity",
      "massageLabGridScanScanGlow",
      "massageLabGridScanScanSoftness",
      "massageLabGridScanPhaseTaper",
      "massageLabGridScanScanDuration",
      "massageLabGridScanScanDelay",
      "massageLabGridScanEnablePointerInteraction",
      "massageLabGridScanScanOnClick",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Beams source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-beams-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-beams/)
    assert.match(registrySource, /Beams/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabBeamsBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_BEAMS/)
    assert.match(effectSource, /createStackedPlanesGeometry/)
    assert.match(effectSource, /cnoise/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /@react-three\/drei/)

    assert.match(stylesSource, /massageLabBeams/)
    assert.match(stylesSource, /massageLabBeamsCanvas/)
    assert.match(hostSource, /massageLabBeams/)
    assert.match(cssEffectsSource, /MassageLabBeamsOptions/)
    assert.match(setupSource, /resolveMassageLabBeamsColor/)
    assert.match(setupSource, /createMassageLabBeamsHarmonyColor/)
    assert.match(runningSource, /massageLabBeams=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabBeams=\{\{/)
    assert.match(docsSource, /Beams \|/)
    assert.match(docsSource, /Beams\.jsx/)
    assert.match(docsSource, /Beams\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /Three\/R3F\/Drei/)

    const settingKeys = [
      "massageLabBeamsPaletteMode",
      "massageLabBeamsPrimaryColor",
      "massageLabBeamsHarmony",
      "massageLabBeamsLightColor",
      "massageLabBeamsBeamWidth",
      "massageLabBeamsBeamHeight",
      "massageLabBeamsBeamNumber",
      "massageLabBeamsSpeed",
      "massageLabBeamsNoiseIntensity",
      "massageLabBeamsScale",
      "massageLabBeamsRotation",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Pixel Snow source-shaped, raw WebGL2, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-pixel-snow-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-pixel-snow/)
    assert.match(registrySource, /Pixel Snow/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabPixelSnowBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_PIXEL_SNOW/)
    assert.match(effectSource, /snowflakeDist/)
    assert.match(effectSource, /coord3/)
    assert.match(effectSource, /getContext\("webgl2"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabPixelSnowCanvas/)
    assert.match(hostSource, /massageLabPixelSnow/)
    assert.match(cssEffectsSource, /MassageLabPixelSnowOptions/)
    assert.match(setupSource, /resolveMassageLabPixelSnowColor/)
    assert.match(setupSource, /createMassageLabPixelSnowHarmonyColor/)
    assert.match(runningSource, /massageLabPixelSnow=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabPixelSnow=\{\{/)
    assert.match(docsSource, /Pixel Snow \|/)
    assert.match(docsSource, /PixelSnow\.jsx/)
    assert.match(docsSource, /PixelSnow\.css/)
    assert.match(docsSource, /raw WebGL2/)
    assert.match(docsSource, /Three\/R3F/)

    const settingKeys = [
      "massageLabPixelSnowPaletteMode",
      "massageLabPixelSnowPrimaryColor",
      "massageLabPixelSnowHarmony",
      "massageLabPixelSnowColor",
      "massageLabPixelSnowFlakeSize",
      "massageLabPixelSnowMinFlakeSize",
      "massageLabPixelSnowPixelResolution",
      "massageLabPixelSnowSpeed",
      "massageLabPixelSnowDepthFade",
      "massageLabPixelSnowFarPlane",
      "massageLabPixelSnowBrightness",
      "massageLabPixelSnowGamma",
      "massageLabPixelSnowDensity",
      "massageLabPixelSnowVariant",
      "massageLabPixelSnowDirection",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Lightning source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-lightning-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-lightning/)
    assert.match(registrySource, /Lightning/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabLightningBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_LIGHTNING/)
    assert.match(effectSource, /hsv2rgb/)
    assert.match(effectSource, /hash11/)
    assert.match(effectSource, /hash12/)
    assert.match(effectSource, /rotate2d/)
    assert.match(effectSource, /fbm/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabLightningCanvas/)
    assert.match(hostSource, /massageLabLightning/)
    assert.match(cssEffectsSource, /MassageLabLightningOptions/)
    assert.match(setupSource, /resolveMassageLabLightningHue/)
    assert.match(setupSource, /createMassageLabLightningHarmonyHue/)
    assert.match(runningSource, /massageLabLightning=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabLightning=\{\{/)
    assert.match(docsSource, /Lightning \|/)
    assert.match(docsSource, /Lightning\.jsx/)
    assert.match(docsSource, /Lightning\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /hsv2rgb/)

    const settingKeys = [
      "massageLabLightningPaletteMode",
      "massageLabLightningPrimaryColor",
      "massageLabLightningHarmony",
      "massageLabLightningColor",
      "massageLabLightningHue",
      "massageLabLightningXOffset",
      "massageLabLightningSpeed",
      "massageLabLightningIntensity",
      "massageLabLightningSize",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Prismatic Burst source-shaped, raw WebGL2, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-prismatic-burst-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-prismatic-burst/)
    assert.match(registrySource, /Prismatic Burst/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabPrismaticBurstBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_PRISMATIC_BURST/)
    assert.match(effectSource, /#version 300 es/)
    assert.match(effectSource, /getContext\("webgl2"/)
    assert.match(effectSource, /sampler2D/)
    assert.match(effectSource, /hash21/)
    assert.match(effectSource, /layeredNoise/)
    assert.match(effectSource, /edgeFade/)
    assert.match(effectSource, /rayDir/)
    assert.match(effectSource, /uGradient/)
    assert.match(effectSource, /uRayCount/)
    assert.match(effectSource, /updateGradientTexture/)
    assert.match(
      effectSource,
      /useMemo\(\s*\(\)\s*=>\s*resolvePrismaticBurstOptions\(massageLabPrismaticBurst\),\s*\[massageLabPrismaticBurst\],\s*\)/,
    )
    assert.doesNotMatch(effectSource, /colorKey/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /deleteTexture/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabPrismaticBurstCanvas/)
    assert.match(hostSource, /massageLabPrismaticBurst/)
    assert.match(cssEffectsSource, /MassageLabPrismaticBurstOptions/)
    assert.match(setupSource, /resolveMassageLabPrismaticBurstColors/)
    assert.match(setupSource, /createMassageLabPrismaticBurstHarmonyPalette/)
    assert.match(runningSource, /massageLabPrismaticBurst=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabPrismaticBurst=\{\{/)
    assert.match(docsSource, /Prismatic Burst \|/)
    assert.match(docsSource, /PrismaticBurst\.jsx/)
    assert.match(docsSource, /PrismaticBurst\.css/)
    assert.match(docsSource, /raw WebGL2/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabPrismaticBurstPaletteMode",
      "massageLabPrismaticBurstPrimaryColor",
      "massageLabPrismaticBurstHarmony",
      "massageLabPrismaticBurstColorOne",
      "massageLabPrismaticBurstColorTwo",
      "massageLabPrismaticBurstColorThree",
      "massageLabPrismaticBurstColorFour",
      "massageLabPrismaticBurstIntensity",
      "massageLabPrismaticBurstSpeed",
      "massageLabPrismaticBurstAnimationType",
      "massageLabPrismaticBurstDistort",
      "massageLabPrismaticBurstOffsetX",
      "massageLabPrismaticBurstOffsetY",
      "massageLabPrismaticBurstHoverDampness",
      "massageLabPrismaticBurstRayCount",
      "massageLabPrismaticBurstMixBlendMode",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Galaxy source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-galaxy-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-galaxy/)
    assert.match(registrySource, /Galaxy/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabGalaxyBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_GALAXY/)
    assert.match(effectSource, /Hash21/)
    assert.match(effectSource, /StarLayer/)
    assert.match(effectSource, /hsv2rgb/)
    assert.match(effectSource, /uMouseRepulsion/)
    assert.match(effectSource, /uAutoCenterRepulsion/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabGalaxyCanvas/)
    assert.match(hostSource, /massageLabGalaxy/)
    assert.match(cssEffectsSource, /MassageLabGalaxyOptions/)
    assert.match(setupSource, /resolveMassageLabGalaxyHueShift/)
    assert.match(setupSource, /createMassageLabGalaxyHarmonyHue/)
    assert.match(runningSource, /massageLabGalaxy=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabGalaxy=\{\{/)
    assert.match(docsSource, /Galaxy \|/)
    assert.match(docsSource, /Galaxy\.jsx/)
    assert.match(docsSource, /Galaxy\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /OGL/)

    const settingKeys = [
      "massageLabGalaxyPaletteMode",
      "massageLabGalaxyPrimaryColor",
      "massageLabGalaxyHarmony",
      "massageLabGalaxyColor",
      "massageLabGalaxyHueShift",
      "massageLabGalaxyFocalX",
      "massageLabGalaxyFocalY",
      "massageLabGalaxyRotationDeg",
      "massageLabGalaxyStarSpeed",
      "massageLabGalaxyDensity",
      "massageLabGalaxySpeed",
      "massageLabGalaxyMouseInteraction",
      "massageLabGalaxyGlowIntensity",
      "massageLabGalaxySaturation",
      "massageLabGalaxyMouseRepulsion",
      "massageLabGalaxyRepulsionStrength",
      "massageLabGalaxyTwinkleIntensity",
      "massageLabGalaxyRotationSpeed",
      "massageLabGalaxyAutoCenterRepulsion",
      "massageLabGalaxyTransparent",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Dither source-shaped, raw WebGL2, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-dither-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-dither/)
    assert.match(registrySource, /Dither/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabDitherBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_DITHER/)
    assert.match(effectSource, /cnoise/)
    assert.match(effectSource, /fbm/)
    assert.match(effectSource, /pattern/)
    assert.match(effectSource, /bayerMatrix8x8/)
    assert.match(effectSource, /texture\(inputBuffer/)
    assert.match(effectSource, /framebuffer/)
    assert.match(effectSource, /#version 300 es/)
    assert.match(effectSource, /getContext\("webgl2"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /deleteTexture/)
    assert.match(effectSource, /deleteFramebuffer/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "@react-three/)
    assert.doesNotMatch(effectSource, /from "postprocessing"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabDitherCanvas/)
    assert.match(hostSource, /massageLabDither/)
    assert.match(cssEffectsSource, /MassageLabDitherOptions/)
    assert.match(setupSource, /resolveMassageLabDitherColor/)
    assert.match(setupSource, /createMassageLabDitherHarmonyColor/)
    assert.match(runningSource, /massageLabDither=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabDither=\{\{/)
    assert.match(docsSource, /Dither \|/)
    assert.match(docsSource, /Dither\.jsx/)
    assert.match(docsSource, /Dither\.css/)
    assert.match(docsSource, /raw WebGL2/)
    assert.match(docsSource, /Bayer/)

    const settingKeys = [
      "massageLabDitherPaletteMode",
      "massageLabDitherPrimaryColor",
      "massageLabDitherHarmony",
      "massageLabDitherColor",
      "massageLabDitherWaveSpeed",
      "massageLabDitherWaveFrequency",
      "massageLabDitherWaveAmplitude",
      "massageLabDitherColorNum",
      "massageLabDitherPixelSize",
      "massageLabDitherMouseInteraction",
      "massageLabDitherMouseRadius",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Faulty Terminal source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-faulty-terminal-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-faulty-terminal/)
    assert.match(registrySource, /Faulty Terminal/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabFaultyTerminalBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_FAULTY_TERMINAL/)
    assert.match(effectSource, /hash21/)
    assert.match(effectSource, /fbm/)
    assert.match(effectSource, /pattern/)
    assert.match(effectSource, /digit/)
    assert.match(effectSource, /displace/)
    assert.match(effectSource, /barrel/)
    assert.match(effectSource, /uPageLoadProgress/)
    assert.match(effectSource, /uMouseStrength/)
    assert.match(effectSource, /uChromaticAberration/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabFaultyTerminalCanvas/)
    assert.match(hostSource, /massageLabFaultyTerminal/)
    assert.match(cssEffectsSource, /MassageLabFaultyTerminalOptions/)
    assert.match(setupSource, /resolveMassageLabFaultyTerminalTint/)
    assert.match(setupSource, /createMassageLabFaultyTerminalHarmonyColor/)
    assert.match(runningSource, /massageLabFaultyTerminal=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabFaultyTerminal=\{\{/)
    assert.match(docsSource, /Faulty Terminal \|/)
    assert.match(docsSource, /FaultyTerminal\.jsx/)
    assert.match(docsSource, /FaultyTerminal\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /CRT-like terminal digit shader/)

    const settingKeys = [
      "massageLabFaultyTerminalPaletteMode",
      "massageLabFaultyTerminalPrimaryColor",
      "massageLabFaultyTerminalHarmony",
      "massageLabFaultyTerminalTint",
      "massageLabFaultyTerminalScale",
      "massageLabFaultyTerminalGridMulX",
      "massageLabFaultyTerminalGridMulY",
      "massageLabFaultyTerminalDigitSize",
      "massageLabFaultyTerminalTimeScale",
      "massageLabFaultyTerminalScanlineIntensity",
      "massageLabFaultyTerminalGlitchAmount",
      "massageLabFaultyTerminalFlickerAmount",
      "massageLabFaultyTerminalNoiseAmp",
      "massageLabFaultyTerminalChromaticAberration",
      "massageLabFaultyTerminalDither",
      "massageLabFaultyTerminalCurvature",
      "massageLabFaultyTerminalMouseReact",
      "massageLabFaultyTerminalMouseStrength",
      "massageLabFaultyTerminalPageLoadAnimation",
      "massageLabFaultyTerminalBrightness",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Ripple Grid source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-ripple-grid-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-ripple-grid/)
    assert.match(registrySource, /Ripple Grid/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabRippleGridBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_RIPPLE_GRID/)
    assert.match(effectSource, /enableRainbow/)
    assert.match(effectSource, /gridColor/)
    assert.match(effectSource, /rippleIntensity/)
    assert.match(effectSource, /gridSize/)
    assert.match(effectSource, /gridThickness/)
    assert.match(effectSource, /fadeDistance/)
    assert.match(effectSource, /vignetteStrength/)
    assert.match(effectSource, /glowIntensity/)
    assert.match(effectSource, /gridRotation/)
    assert.match(effectSource, /mouseInteractionRadius/)
    assert.match(effectSource, /mat2 rotate/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /deleteProgram/)
    assert.match(effectSource, /deleteShader/)
    assert.match(effectSource, /deleteBuffer/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabRippleGridCanvas/)
    assert.match(hostSource, /massageLabRippleGrid/)
    assert.match(cssEffectsSource, /MassageLabRippleGridOptions/)
    assert.match(setupSource, /resolveMassageLabRippleGridColor/)
    assert.match(setupSource, /createMassageLabRippleGridHarmonyColor/)
    assert.match(runningSource, /massageLabRippleGrid=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabRippleGrid=\{\{/)
    assert.match(docsSource, /Ripple Grid \|/)
    assert.match(docsSource, /RippleGrid\.jsx/)
    assert.match(docsSource, /RippleGrid\.css/)
    assert.match(docsSource, /raw WebGL/)
    assert.match(docsSource, /ripple grid shader/)

    const settingKeys = [
      "massageLabRippleGridPaletteMode",
      "massageLabRippleGridPrimaryColor",
      "massageLabRippleGridHarmony",
      "massageLabRippleGridColor",
      "massageLabRippleGridRippleIntensity",
      "massageLabRippleGridGridSize",
      "massageLabRippleGridGridThickness",
      "massageLabRippleGridFadeDistance",
      "massageLabRippleGridVignetteStrength",
      "massageLabRippleGridGlowIntensity",
      "massageLabRippleGridOpacity",
      "massageLabRippleGridGridRotation",
      "massageLabRippleGridMouseInteraction",
      "massageLabRippleGridMouseInteractionRadius",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Dot Field source-shaped, canvas-based, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-dot-field-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-dot-field/)
    assert.match(registrySource, /Dot Field/)
    assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(registrySource, /enabled:\s*true/)

    assert.match(effectSource, /MassageLabDotFieldBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_DOT_FIELD/)
    assert.match(effectSource, /buildDots/)
    assert.match(effectSource, /cursorForce/)
    assert.match(effectSource, /bulgeStrength/)
    assert.match(effectSource, /glowRadius/)
    assert.match(effectSource, /sparkle/)
    assert.match(effectSource, /waveAmplitude/)
    assert.match(effectSource, /getContext\("2d"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(effectSource, /clearInterval/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)

    assert.match(stylesSource, /massageLabDotField/)
    assert.match(stylesSource, /massageLabDotFieldCanvas/)
    assert.match(stylesSource, /massageLabDotFieldGlowSvg/)
    assert.match(hostSource, /massageLabDotField/)
    assert.match(cssEffectsSource, /MassageLabDotFieldOptions/)
    assert.match(setupSource, /resolveMassageLabDotFieldColors/)
    assert.match(setupSource, /createMassageLabDotFieldHarmonyColors/)
    assert.match(runningSource, /massageLabDotField=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabDotField=\{\{/)
    assert.match(docsSource, /Dot Field \|/)
    assert.match(docsSource, /DotField\.jsx/)
    assert.match(docsSource, /DotField\.css/)
    assert.match(docsSource, /canvas\/SVG/)

    const settingKeys = [
      "massageLabDotFieldPaletteMode",
      "massageLabDotFieldPrimaryColor",
      "massageLabDotFieldHarmony",
      "massageLabDotFieldGradientFromColor",
      "massageLabDotFieldGradientFromAlpha",
      "massageLabDotFieldGradientToColor",
      "massageLabDotFieldGradientToAlpha",
      "massageLabDotFieldGlowColor",
      "massageLabDotFieldDotRadius",
      "massageLabDotFieldDotSpacing",
      "massageLabDotFieldCursorRadius",
      "massageLabDotFieldCursorForce",
      "massageLabDotFieldBulgeOnly",
      "massageLabDotFieldBulgeStrength",
      "massageLabDotFieldGlowRadius",
      "massageLabDotFieldSparkle",
      "massageLabDotFieldWaveAmplitude",
      "massageLabDotFieldCursorInteraction",
    ]

    for (const settingKey of settingKeys) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Dot Grid source-shaped, canvas-based, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-dot-grid-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-dot-grid/)
    assert.match(registrySource, /Dot Grid/)
    assert.match(effectSource, /MassageLabDotGridBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_DOT_GRID/)
    assert.match(effectSource, /applyImpulse/)
    assert.match(effectSource, /speedTrigger/)
    assert.match(effectSource, /shockStrength/)
    assert.match(effectSource, /returnDuration/)
    assert.match(effectSource, /getContext\("2d"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.doesNotMatch(effectSource, /from "gsap"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.match(stylesSource, /massageLabDotGrid/)
    assert.match(stylesSource, /massageLabDotGridCanvas/)
    assert.match(hostSource, /massageLabDotGrid/)
    assert.match(cssEffectsSource, /MassageLabDotGridOptions/)
    assert.match(setupSource, /resolveMassageLabDotGridColors/)
    assert.match(setupSource, /createMassageLabDotGridHarmonyColors/)
    assert.match(runningSource, /massageLabDotGrid=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabDotGrid=\{\{/)
    assert.match(docsSource, /Dot Grid \|/)
    assert.match(docsSource, /DotGrid\.jsx/)
    assert.match(docsSource, /DotGrid\.css/)
    assert.match(docsSource, /GSAP InertiaPlugin/)

    for (const settingKey of [
      "massageLabDotGridPaletteMode",
      "massageLabDotGridPrimaryColor",
      "massageLabDotGridHarmony",
      "massageLabDotGridBaseColor",
      "massageLabDotGridActiveColor",
      "massageLabDotGridDotSize",
      "massageLabDotGridGap",
      "massageLabDotGridProximity",
      "massageLabDotGridSpeedTrigger",
      "massageLabDotGridShockRadius",
      "massageLabDotGridShockStrength",
      "massageLabDotGridMaxSpeed",
      "massageLabDotGridResistance",
      "massageLabDotGridReturnDuration",
      "massageLabDotGridCursorInteraction",
      "massageLabDotGridClickShock",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Threads source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-threads-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-threads/)
    assert.match(registrySource, /Threads/)
    assert.match(effectSource, /MassageLabThreadsBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_THREADS/)
    assert.match(effectSource, /Perlin2D/)
    assert.match(effectSource, /u_line_count/)
    assert.match(effectSource, /MAX_RENDER_DIMENSION/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.match(stylesSource, /massageLabThreads/)
    assert.match(stylesSource, /massageLabThreadsCanvas/)
    assert.match(hostSource, /massageLabThreads/)
    assert.match(cssEffectsSource, /MassageLabThreadsOptions/)
    assert.match(setupSource, /resolveMassageLabThreadsColor/)
    assert.match(setupSource, /createMassageLabThreadsHarmonyColor/)
    assert.match(runningSource, /massageLabThreads=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabThreads=\{\{/)
    assert.match(docsSource, /Threads \|/)
    assert.match(docsSource, /Threads\.jsx/)
    assert.match(docsSource, /Threads\.css/)
    assert.match(docsSource, /OGL/)

    for (const settingKey of [
      "massageLabThreadsPaletteMode",
      "massageLabThreadsPrimaryColor",
      "massageLabThreadsHarmony",
      "massageLabThreadsColor",
      "massageLabThreadsAmplitude",
      "massageLabThreadsDistance",
      "massageLabThreadsEnableMouseInteraction",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Iridescence source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-iridescence-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-iridescence/)
    assert.match(registrySource, /Iridescence/)
    assert.match(effectSource, /MassageLabIridescenceBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_IRIDESCENCE/)
    assert.match(effectSource, /uAmplitude/)
    assert.match(effectSource, /uSpeed/)
    assert.match(effectSource, /uMouse/)
    assert.match(effectSource, /for \(float i = 0\.0; i < 8\.0; \+\+i\)/)
    assert.match(effectSource, /MAX_RENDER_DIMENSION/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.match(stylesSource, /massageLabIridescence/)
    assert.match(stylesSource, /massageLabIridescenceCanvas/)
    assert.match(hostSource, /massageLabIridescence/)
    assert.match(cssEffectsSource, /MassageLabIridescenceOptions/)
    assert.match(setupSource, /resolveMassageLabIridescenceColor/)
    assert.match(setupSource, /createMassageLabIridescenceHarmonyColor/)
    assert.match(runningSource, /massageLabIridescence=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabIridescence=\{\{/)
    assert.match(docsSource, /Iridescence \|/)
    assert.match(docsSource, /Iridescence\.jsx/)
    assert.match(docsSource, /Iridescence\.css/)
    assert.match(docsSource, /OGL/)

    for (const settingKey of [
      "massageLabIridescencePaletteMode",
      "massageLabIridescencePrimaryColor",
      "massageLabIridescenceHarmony",
      "massageLabIridescenceColor",
      "massageLabIridescenceSpeed",
      "massageLabIridescenceAmplitude",
      "massageLabIridescenceMouseReact",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Waves source-shaped, canvas-based, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-waves-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-waves/)
    assert.match(registrySource, /Waves/)
    assert.match(effectSource, /MassageLabWavesBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_WAVES/)
    assert.match(effectSource, /class Noise/)
    assert.match(effectSource, /perlin2/)
    assert.match(effectSource, /waveSpeedX/)
    assert.match(effectSource, /waveAmpX/)
    assert.match(effectSource, /maxCursorMove/)
    assert.match(effectSource, /getContext\("2d"/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.match(stylesSource, /massageLabWaves/)
    assert.match(stylesSource, /massageLabWavesCanvas/)
    assert.match(hostSource, /massageLabWaves/)
    assert.match(cssEffectsSource, /MassageLabWavesOptions/)
    assert.match(setupSource, /resolveMassageLabWavesLineColor/)
    assert.match(setupSource, /createMassageLabWavesHarmonyColor/)
    assert.match(runningSource, /massageLabWaves=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabWaves=\{\{/)
    assert.match(docsSource, /Waves \|/)
    assert.match(docsSource, /Waves\.jsx/)
    assert.match(docsSource, /Waves\.css/)
    assert.match(docsSource, /Perlin/)

    for (const settingKey of [
      "massageLabWavesPaletteMode",
      "massageLabWavesPrimaryColor",
      "massageLabWavesHarmony",
      "massageLabWavesLineColor",
      "massageLabWavesBackgroundColor",
      "massageLabWavesTransparentBackground",
      "massageLabWavesSpeedX",
      "massageLabWavesSpeedY",
      "massageLabWavesAmplitudeX",
      "massageLabWavesAmplitudeY",
      "massageLabWavesGapX",
      "massageLabWavesGapY",
      "massageLabWavesFriction",
      "massageLabWavesTension",
      "massageLabWavesMaxCursorMove",
      "massageLabWavesCursorInteraction",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Grid Distortion source-shaped, raw WebGL, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-grid-distortion-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-grid-distortion/)
    assert.match(registrySource, /Grid Distortion/)
    assert.match(effectSource, /MassageLabGridDistortionBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_GRID_DISTORTION/)
    assert.match(effectSource, /OES_texture_float/)
    assert.match(effectSource, /uDataTexture/)
    assert.match(effectSource, /uTexture/)
    assert.match(effectSource, /texture2D\(uTexture, uv - 0\.02 \* offset\.rg\)/)
    assert.match(effectSource, /texSubImage2D/)
    assert.match(effectSource, /strength \* 100/)
    assert.match(effectSource, /relaxation/)
    assert.match(effectSource, /getContext\("webgl"/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /new Image/)
    assert.doesNotMatch(effectSource, /imageSrc/)
    assert.match(stylesSource, /massageLabGridDistortion/)
    assert.match(stylesSource, /massageLabGridDistortionCanvas/)
    assert.match(hostSource, /massageLabGridDistortion/)
    assert.match(cssEffectsSource, /MassageLabGridDistortionOptions/)
    assert.match(setupSource, /resolveMassageLabGridDistortionColors/)
    assert.match(setupSource, /createMassageLabGridDistortionHarmonyPalette/)
    assert.match(runningSource, /massageLabGridDistortion=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabGridDistortion=\{\{/)
    assert.match(docsSource, /Grid Distortion \|/)
    assert.match(docsSource, /GridDistortion\.jsx/)
    assert.match(docsSource, /GridDistortion\.css/)
    assert.match(docsSource, /DataTexture|data texture/)

    for (const settingKey of [
      "massageLabGridDistortionPaletteMode",
      "massageLabGridDistortionPrimaryColor",
      "massageLabGridDistortionHarmony",
      "massageLabGridDistortionColorOne",
      "massageLabGridDistortionColorTwo",
      "massageLabGridDistortionColorThree",
      "massageLabGridDistortionGrid",
      "massageLabGridDistortionMouse",
      "massageLabGridDistortionStrength",
      "massageLabGridDistortionRelaxation",
      "massageLabGridDistortionCursorInteraction",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
      assert.match(pageSource, new RegExp(settingKey))
    }
  })

  it("keeps the latest MassageLab background ports source-shaped, customizable, and dependency-free", () => {
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

    const cases = [
      {
        id: "massage-lab-orb",
        label: "Orb",
        sourcePath: "orb",
        effectFile: "massage-lab-orb-background.tsx",
        hostProp: "massageLabOrb",
        optionType: "MassageLabOrbOptions",
        styleKeys: ["massageLabOrbCanvas"],
        docsPatterns: [/Orb \|/, /Orb\.jsx/, /Orb\.css/],
        effectPatterns: [
          /MassageLabOrbBackground/,
          /DEFAULT_MASSAGELAB_ORB/,
          /snoise3/,
          /adjustHue/,
          /hoverIntensity/,
          /rotateOnHover/,
          /getContext\("webgl"/,
          /shouldAnimateAmbientBackground/,
          /window\.addEventListener\("pointermove"/,
        ],
        negativePatterns: [/from "ogl"/, /from "three"/, /@react-three/],
        setupPatterns: [/resolveMassageLabOrbHue/, /createMassageLabOrbHarmonyHue/],
        settingKeys: [
          "massageLabOrbPaletteMode",
          "massageLabOrbPrimaryColor",
          "massageLabOrbHarmony",
          "massageLabOrbColor",
          "massageLabOrbHue",
          "massageLabOrbHoverIntensity",
          "massageLabOrbRotateOnHover",
          "massageLabOrbForceHoverState",
          "massageLabOrbBackgroundColor",
          "massageLabOrbCursorInteraction",
        ],
      },
      {
        id: "massage-lab-letter-glitch",
        label: "Letter Glitch",
        sourcePath: "letter-glitch",
        effectFile: "massage-lab-letter-glitch-background.tsx",
        hostProp: "massageLabLetterGlitch",
        optionType: "MassageLabLetterGlitchOptions",
        styleKeys: ["massageLabLetterGlitch", "massageLabLetterGlitchCanvas", "massageLabLetterGlitchOuterVignette"],
        docsPatterns: [/Letter Glitch \|/, /LetterGlitch\.jsx/],
        effectPatterns: [
          /MassageLabLetterGlitchBackground/,
          /DEFAULT_MASSAGELAB_LETTER_GLITCH/,
          /FONT_SIZE/,
          /CHAR_WIDTH/,
          /interpolateColor/,
          /massageLabLetterGlitchOuterVignette/,
        ],
        negativePatterns: [/Math\.random/, /from "gsap"/, /from "three"/, /from "ogl"/],
        setupPatterns: [/resolveMassageLabLetterGlitchColors/, /createMassageLabLetterGlitchHarmonyPalette/],
        settingKeys: [
          "massageLabLetterGlitchPaletteMode",
          "massageLabLetterGlitchPrimaryColor",
          "massageLabLetterGlitchHarmony",
          "massageLabLetterGlitchColorOne",
          "massageLabLetterGlitchColorTwo",
          "massageLabLetterGlitchColorThree",
          "massageLabLetterGlitchGlitchSpeed",
          "massageLabLetterGlitchCenterVignette",
          "massageLabLetterGlitchOuterVignette",
          "massageLabLetterGlitchSmooth",
          "massageLabLetterGlitchCharacters",
        ],
      },
      {
        id: "massage-lab-grid-motion",
        label: "Grid Motion",
        sourcePath: "grid-motion",
        effectFile: "massage-lab-grid-motion-background.tsx",
        hostProp: "massageLabGridMotion",
        optionType: "MassageLabGridMotionOptions",
        styleKeys: ["massageLabGridMotion", "massageLabGridMotionRow", "massageLabGridMotionItem"],
        docsPatterns: [/Grid Motion \|/, /GridMotion\.jsx/, /GridMotion\.css/],
        effectPatterns: [
          /MassageLabGridMotionBackground/,
          /DEFAULT_MASSAGELAB_GRID_MOTION/,
          /maxMoveAmount/,
          /baseDuration/,
          /requestAnimationFrame/,
        ],
        negativePatterns: [/from "gsap"/, /from "three"/, /from "ogl"/],
        setupPatterns: [/resolveMassageLabGridMotionColors/, /createMassageLabGridMotionHarmonyPalette/],
        settingKeys: [
          "massageLabGridMotionPaletteMode",
          "massageLabGridMotionPrimaryColor",
          "massageLabGridMotionHarmony",
          "massageLabGridMotionGradientColor",
          "massageLabGridMotionTileColor",
          "massageLabGridMotionTextColor",
          "massageLabGridMotionMaxMoveAmount",
          "massageLabGridMotionBaseDuration",
          "massageLabGridMotionCursorInteraction",
        ],
      },
      {
        id: "massage-lab-shape-grid",
        label: "Shape Grid",
        sourcePath: "shape-grid",
        effectFile: "massage-lab-shape-grid-background.tsx",
        hostProp: "massageLabShapeGrid",
        optionType: "MassageLabShapeGridOptions",
        styleKeys: ["massageLabShapeGridCanvas"],
        docsPatterns: [/Shape Grid \|/, /ShapeGrid\.jsx/, /ShapeGrid\.css/],
        effectPatterns: [
          /MassageLabShapeGridBackground/,
          /DEFAULT_MASSAGELAB_SHAPE_GRID/,
          /drawHex/,
          /drawTriangle/,
          /hoverTrailAmount/,
          /positiveModulo/,
        ],
        negativePatterns: [/from "gsap"/, /from "three"/, /from "ogl"/],
        setupPatterns: [/resolveMassageLabShapeGridColors/, /createMassageLabShapeGridHarmonyPalette/],
        settingKeys: [
          "massageLabShapeGridPaletteMode",
          "massageLabShapeGridPrimaryColor",
          "massageLabShapeGridHarmony",
          "massageLabShapeGridBorderColor",
          "massageLabShapeGridHoverFillColor",
          "massageLabShapeGridDirection",
          "massageLabShapeGridSpeed",
          "massageLabShapeGridSquareSize",
          "massageLabShapeGridShape",
          "massageLabShapeGridHoverTrailAmount",
          "massageLabShapeGridCursorInteraction",
        ],
      },
      {
        id: "massage-lab-liquid-chrome",
        label: "Chrome Flow",
        sourcePath: "liquid-chrome",
        effectFile: "massage-lab-liquid-chrome-background.tsx",
        hostProp: "massageLabLiquidChrome",
        optionType: "MassageLabLiquidChromeOptions",
        styleKeys: ["massageLabLiquidChromeCanvas"],
        docsPatterns: [/Liquid Chrome \|/, /LiquidChrome\.jsx/, /LiquidChrome\.css/],
        effectPatterns: [
          /MassageLabLiquidChromeBackground/,
          /DEFAULT_MASSAGELAB_LIQUID_CHROME/,
          /renderImage/,
          /uFrequencyX/,
          /uMouse/,
          /getContext\("webgl"/,
        ],
        negativePatterns: [/from "ogl"/, /from "three"/, /@react-three/],
        setupPatterns: [/resolveMassageLabLiquidChromeBaseColor/, /createMassageLabLiquidChromeHarmonyColor/],
        settingKeys: [
          "massageLabLiquidChromePaletteMode",
          "massageLabLiquidChromePrimaryColor",
          "massageLabLiquidChromeHarmony",
          "massageLabLiquidChromeBaseColor",
          "massageLabLiquidChromeSpeed",
          "massageLabLiquidChromeAmplitude",
          "massageLabLiquidChromeFrequencyX",
          "massageLabLiquidChromeFrequencyY",
          "massageLabLiquidChromeInteractive",
        ],
      },
      {
        id: "massage-lab-balatro",
        label: "Balatro",
        sourcePath: "balatro",
        effectFile: "massage-lab-balatro-background.tsx",
        hostProp: "massageLabBalatro",
        optionType: "MassageLabBalatroOptions",
        styleKeys: ["massageLabBalatroCanvas"],
        docsPatterns: [/Balatro \|/, /Balatro\.jsx/, /Balatro\.css/],
        effectPatterns: [
          /MassageLabBalatroBackground/,
          /DEFAULT_MASSAGELAB_BALATRO/,
          /uSpinRotation/,
          /uPixelFilter/,
          /uIsRotate/,
          /effect\(iResolution\.xy/,
        ],
        negativePatterns: [/from "ogl"/, /from "three"/, /@react-three/],
        setupPatterns: [/resolveMassageLabBalatroColors/, /createMassageLabBalatroHarmonyPalette/],
        settingKeys: [
          "massageLabBalatroPaletteMode",
          "massageLabBalatroPrimaryColor",
          "massageLabBalatroHarmony",
          "massageLabBalatroColorOne",
          "massageLabBalatroColorTwo",
          "massageLabBalatroColorThree",
          "massageLabBalatroSpinRotation",
          "massageLabBalatroSpinSpeed",
          "massageLabBalatroOffsetX",
          "massageLabBalatroOffsetY",
          "massageLabBalatroContrast",
          "massageLabBalatroLighting",
          "massageLabBalatroSpinAmount",
          "massageLabBalatroPixelFilter",
          "massageLabBalatroSpinEase",
          "massageLabBalatroIsRotate",
          "massageLabBalatroMouseInteraction",
        ],
      },
    ]

    for (const background of cases) {
      const effectSource = readFileSync(
        new URL(`../components/backgrounds/effects/${background.effectFile}`, import.meta.url),
        "utf8",
      )

      assert.match(registrySource, new RegExp(background.id))
      assert.match(registrySource, new RegExp(background.label))
      assert.equal(backgroundRegistry.find((entry) => entry.id === background.id)?.sourceUrl, "internal")
      assert.match(registrySource, /MIT \+ Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05/)
      assert.match(registrySource, /requiresSubscription:\s*true/)
      assert.match(hostSource, new RegExp(background.hostProp))
      assert.match(cssEffectsSource, new RegExp(background.optionType))
      assert.match(runningSource, new RegExp(`${background.hostProp}=\\{\\{`))
      assert.doesNotMatch(pageSource, new RegExp(`${background.hostProp}=\\{\\{`))

      for (const styleKey of background.styleKeys) {
        assert.match(stylesSource, new RegExp(styleKey))
      }

      for (const pattern of background.effectPatterns) {
        assert.match(effectSource, pattern)
      }

      for (const pattern of background.negativePatterns) {
        assert.doesNotMatch(effectSource, pattern)
      }

      for (const pattern of background.setupPatterns) {
        assert.match(setupSource, pattern)
      }

      for (const pattern of background.docsPatterns) {
        assert.match(docsSource, pattern)
      }

      for (const settingKey of background.settingKeys) {
        assert.match(setupSource, new RegExp(settingKey))
        assert.match(runningSource, new RegExp(settingKey))
        assert.match(pageSource, new RegExp(settingKey))
      }
    }
  })

  it("keeps MassageLab Novatrix source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-novatrix-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-novatrix/)
    assert.match(registrySource, /Novatrix Field/)
    assert.match(registrySource, /MassageLab repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabNovatrixBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGE_LAB_NOVATRIX/)
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
    assert.match(stylesSource, /massageLabNovatrixBackground/)
    assert.match(stylesSource, /massageLabNovatrixCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabNovatrix/)
    assert.match(cssEffectsSource, /MassageLabNovatrixOptions/)
    assert.match(runningSource, /massageLabNovatrix=\{\{/)
    assert.match(runningSource, /resolveMassageLabNovatrixColor/)
    assert.match(setupSource, /getMassageLabNovatrixDisplaySpeed/)
    assert.match(setupSource, /getMassageLabNovatrixSourceSpeed/)
    assert.match(setupSource, /getMassageLabNovatrixDisplayAmplitude/)
    assert.match(setupSource, /getMassageLabNovatrixSourceAmplitude/)
    assert.match(setupSource, /MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN = 0\.02/)
    assert.match(setupSource, /MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX = 3/)
    assert.match(setupSource, /MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN = 0\.01/)
    assert.match(setupSource, /MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX = 0\.45/)
    assert.doesNotMatch(pageSource, /massageLabNovatrix=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "massageLabNovatrixPaletteMode",
      "massageLabNovatrixPrimaryColor",
      "massageLabNovatrixHarmony",
      "massageLabNovatrixColor",
      "massageLabNovatrixSpeed",
      "massageLabNovatrixAmplitude",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Matrix Rain source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-matrix-rain-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-matrix-rain/)
    assert.match(registrySource, /Matrix Rain/)
    assert.match(registrySource, /MassageLab repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabMatrixRainBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGE_LAB_MATRIX_RAIN/)
    assert.match(effectSource, /color: "#00FF00"/)
    assert.match(effectSource, /fontSize: 14/)
    assert.match(effectSource, /speed: 1/)
    assert.match(effectSource, /MATRIX_RAIN_CHARACTERS/)
    assert.match(effectSource, /SOURCE_FRAME_INTERVAL_MS = 33/)
    assert.match(effectSource, /"rgba\(0, 0, 0, 0\.05\)"/)
    assert.match(effectSource, /monospace/)
    assert.match(effectSource, /drops/)
    assert.match(effectSource, /fillText/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /shouldAnimateAmbientBackground/)
    assert.match(stylesSource, /massageLabMatrixRainBackground/)
    assert.match(stylesSource, /massageLabMatrixRainCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabMatrixRain/)
    assert.match(cssEffectsSource, /MassageLabMatrixRainOptions/)
    assert.match(runningSource, /massageLabMatrixRain=\{\{/)
    assert.match(runningSource, /resolveMassageLabMatrixRainColor/)
    assert.match(setupSource, /getMassageLabMatrixRainDisplaySpeed/)
    assert.match(setupSource, /getMassageLabMatrixRainSourceSpeed/)
    assert.match(setupSource, /MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN = 0\.05/)
    assert.match(setupSource, /MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX = 3/)
    assert.doesNotMatch(pageSource, /massageLabMatrixRain=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)
    for (const settingKey of [
      "massageLabMatrixRainPaletteMode",
      "massageLabMatrixRainPrimaryColor",
      "massageLabMatrixRainHarmony",
      "massageLabMatrixRainColor",
      "massageLabMatrixRainSpeed",
      "massageLabMatrixRainFontSize",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Photon Beam source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-photon-beam-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-photon-beam/)
    assert.match(registrySource, /Photon Beam/)
    assert.match(registrySource, /MassageLab repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabPhotonBeamBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGE_LAB_PHOTON_BEAM/)
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
    assert.match(stylesSource, /massageLabPhotonBeamBackground/)
    assert.match(stylesSource, /massageLabPhotonBeamCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabPhotonBeam/)
    assert.match(cssEffectsSource, /MassageLabPhotonBeamOptions/)
    assert.match(runningSource, /massageLabPhotonBeam=\{\{/)
    assert.match(runningSource, /resolveMassageLabPhotonBeamColors/)
    assert.match(setupSource, /resolveMassageLabPhotonBeamColors/)
    assert.match(setupSource, /createMassageLabPhotonBeamHarmonyPalette/)
    assert.match(setupSource, /getMassageLabPhotonBeamDisplaySpeed/)
    assert.match(setupSource, /getMassageLabPhotonBeamSourceSpeed/)
    assert.match(setupSource, /MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN = 0\.02/)
    assert.match(setupSource, /MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX = 2/)
    assert.doesNotMatch(pageSource, /massageLabPhotonBeam=\{\{/)
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
      "massageLabPhotonBeamPaletteMode",
      "massageLabPhotonBeamPrimaryColor",
      "massageLabPhotonBeamHarmony",
      "massageLabPhotonBeamColorBg",
      "massageLabPhotonBeamColorLine",
      "massageLabPhotonBeamColorSignal",
      "massageLabPhotonBeamUseColor2",
      "massageLabPhotonBeamColorSignal2",
      "massageLabPhotonBeamUseColor3",
      "massageLabPhotonBeamColorSignal3",
      "massageLabPhotonBeamLineCount",
      "massageLabPhotonBeamSpreadHeight",
      "massageLabPhotonBeamSpreadDepth",
      "massageLabPhotonBeamCurveLength",
      "massageLabPhotonBeamStraightLength",
      "massageLabPhotonBeamCurvePower",
      "massageLabPhotonBeamWaveSpeed",
      "massageLabPhotonBeamWaveHeight",
      "massageLabPhotonBeamLineOpacity",
      "massageLabPhotonBeamSignalCount",
      "massageLabPhotonBeamSpeedGlobal",
      "massageLabPhotonBeamTrailLength",
      "massageLabPhotonBeamBloomStrength",
      "massageLabPhotonBeamBloomRadius",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab 3D Globe source-shaped, marker-aware, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-3d-globe-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-3d-globe/)
    assert.match(registrySource, /3D Globe/)
    assert.match(registrySource, /reviewed source license; component registry reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLab3DGlobeBackground/)
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
    assert.match(stylesSource, /massageLab3dGlobe/)
    assert.match(stylesSource, /massageLab3dGlobeCanvas/)
    assert.match(stylesSource, /massageLab3dGlobeMarkerCanvas/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLab3DGlobe/)
    assert.match(cssEffectsSource, /MassageLab3DGlobeOptions/)
    assert.match(runningSource, /massageLab3DGlobe=\{\{/)
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
    assert.match(setupSource, /settings\.massageLab3DGlobeEnablePan &&/)
    assert.match(runningSource, /massageLab3DGlobeEnablePan &&/)
    assert.match(setupSource, /max="10000"/)
    assert.match(runningSource, /max="10000"/)
    assert.doesNotMatch(pageSource, /massageLab3DGlobe=\{\{/)
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
      "massageLab3DGlobeViewStyle",
      "massageLab3DGlobeBackgroundColor",
      "massageLab3DGlobeGlobeColor",
      "massageLab3DGlobeGraphicMapColor",
      "massageLab3DGlobeGraphicGlowColor",
      "massageLab3DGlobeGraphicMarkerColor",
      "massageLab3DGlobeGraphicMapSamples",
      "massageLab3DGlobeAutoRotateSpeed",
      "massageLab3DGlobeScale",
      "massageLab3DGlobeBumpScale",
      "massageLab3DGlobeAmbientIntensity",
      "massageLab3DGlobePointLightIntensity",
      "massageLab3DGlobeLightingMode",
      "massageLab3DGlobeEnablePan",
      "massageLab3DGlobePanX",
      "massageLab3DGlobePanY",
      "massageLab3DGlobeShowAtmosphere",
      "massageLab3DGlobeAtmosphereColor",
      "massageLab3DGlobeAtmosphereIntensity",
      "massageLab3DGlobeAtmosphereBlur",
      "massageLab3DGlobeShowWireframe",
      "massageLab3DGlobeWireframeColor",
      "massageLab3DGlobeMarkerEnabled",
      "massageLab3DGlobeMarkerLat",
      "massageLab3DGlobeMarkerLng",
      "massageLab3DGlobeMarkerLabel",
      "massageLab3DGlobeMarkerIcon",
      "massageLab3DGlobeMarkerSize",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Retro Grid source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-retro-grid-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-retro-grid/)
    assert.match(registrySource, /Retro Grid/)
    assert.match(registrySource, /MassageLab repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabRetroGridBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGELAB_RETRO_GRID/)
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
    assert.match(stylesSource, /massageLabRetroGridBackground/)
    assert.match(stylesSource, /massageLabRetroGridCanvas/)
    assert.match(stylesSource, /massageLabRetroGridFallbackGrid/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabRetroGrid/)
    assert.match(cssEffectsSource, /MassageLabRetroGridOptions/)
    assert.match(runningSource, /massageLabRetroGrid=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabRetroGrid=\{\{/)
    assert.match(docsSource, /repository license were reviewed on 2026-07-04/)
    assert.match(docsSource, /angle`, `cellSize`, `opacity`, `lightLineColor`, and `darkLineColor`/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /from "ogl"/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /pointermove/)

    for (const settingKey of [
      "massageLabRetroGridBackgroundColor",
      "massageLabRetroGridLightLineColor",
      "massageLabRetroGridDarkLineColor",
      "massageLabRetroGridAngle",
      "massageLabRetroGridCellSize",
      "massageLabRetroGridOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Aerial Rays source-shaped, passive, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-aerial-rays-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-aerial-rays/)
    assert.match(registrySource, /Aerial Rays/)
    assert.match(registrySource, /MassageLab repository reviewed 2026-07-04/)
    assert.match(registrySource, /requiresSubscription:\s*true/)
    assert.match(effectSource, /MassageLabAerialRaysBackground/)
    assert.match(effectSource, /DEFAULT_MASSAGE_LAB_AERIAL_RAYS/)
    assert.match(effectSource, /backgroundColor: "#020617"/)
    assert.match(effectSource, /color: "#A0D2FF"/)
    assert.match(effectSource, /count: 7/)
    assert.match(effectSource, /blur: 36/)
    assert.match(effectSource, /speed: 14/)
    assert.match(effectSource, /length: 70/)
    assert.match(effectSource, /opacity: 0\.65/)
    assert.match(effectSource, /createRays/)
    assert.match(effectSource, /randomUnit/)
    assert.match(stylesSource, /massageLabAerialRaysBackground/)
    assert.match(stylesSource, /massageLabAerialRaysRay/)
    assert.match(stylesSource, /massageLabAerialRaysDrift/)
    assert.match(stylesSource, /mix-blend-mode: screen/)
    assert.match(stylesSource, /prefers-reduced-motion/)
    assert.match(stylesSource, /pointer-events: none/)
    assert.match(hostSource, /massageLabAerialRays/)
    assert.match(cssEffectsSource, /MassageLabAerialRaysOptions/)
    assert.match(runningSource, /massageLabAerialRays=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabAerialRays=\{\{/)
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
      "massageLabAerialRaysBackgroundColor",
      "massageLabAerialRaysColor",
      "massageLabAerialRaysCount",
      "massageLabAerialRaysBlur",
      "massageLabAerialRaysSpeed",
      "massageLabAerialRaysLength",
      "massageLabAerialRaysOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Synthesis source-shaped, customizable, and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/massage-lab-synthesis-background.tsx", import.meta.url),
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

    assert.match(registrySource, /massage-lab-synthesis/)
    assert.match(registrySource, /Synthesis/)
    assert.match(registrySource, /MIT; copyright 2026 Amarnath/)
    assert.match(effectSource, /MassageLabSynthesisBackground/)
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
    assert.match(stylesSource, /massageLabSynthesis/)
    assert.match(hostSource, /massageLabSynthesis/)
    assert.match(runningSource, /massageLabSynthesis=\{\{/)
    assert.match(runningSource, /resolveMassageLabSynthesisColors/)
    assert.match(setupSource, /getMassageLabSynthesisDisplaySpeed/)
    assert.match(setupSource, /getMassageLabSynthesisSourceSpeed/)
    assert.doesNotMatch(pageSource, /massageLabSynthesis=\{\{/)
    assert.doesNotMatch(effectSource, /Math\.random/)
    assert.doesNotMatch(effectSource, /@react-three/)
    assert.doesNotMatch(effectSource, /from "three"/)
    assert.doesNotMatch(effectSource, /postprocessing/)
    assert.doesNotMatch(effectSource, /createImageData/)
    assert.doesNotMatch(effectSource, /seededFraction/)
    for (const settingKey of [
      "massageLabSynthesisColorOne",
      "massageLabSynthesisColorTwo",
      "massageLabSynthesisColorThree",
      "massageLabSynthesisPaletteMode",
      "massageLabSynthesisPrimaryColor",
      "massageLabSynthesisHarmony",
      "massageLabSynthesisSpeed",
      "massageLabSynthesisComplexity",
      "massageLabSynthesisScale",
      "massageLabSynthesisDistortion",
      "massageLabSynthesisGlowIntensity",
      "massageLabSynthesisFlowFrequency",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps selected visual backgrounds off setup while restoring the shared site backdrop", () => {
    const pageSource = readFileSync(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")
    const runningSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(pageSource, /<BackgroundHost/)
    assert.match(pageSource, /!isTimerActive[\s\S]*<MovingBackground[\s\S]*chimer-setup-moving-background/)
    assert.doesNotMatch(pageSource, /chimer-setup-background/)
    assert.match(runningSource, /<BackgroundHost/)
    assert.match(runningSource, /<MovingBackground/)
  })

  it("keeps MassageLab Bubble non-interactive and dependency-free", () => {
    const effectSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const registrySource = readFileSync(
      new URL("../components/backgrounds/backgroundRegistry.ts", import.meta.url),
      "utf8",
    )

    assert.match(registrySource, /massage-lab-bubble/)
    assert.match(registrySource, /cursor interactivity and the sixth mouse-following bubble are intentionally omitted/)
    assert.match(effectSource, /MassageLabBubbleBackground/)
    assert.match(effectSource, /Cursor interaction from the source component is intentionally omitted/)
    assert.match(effectSource, /ml-bubble-goo/)
    assert.match(effectSource, /bubbleOrbFive/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    assert.doesNotMatch(effectSource, /mousemove/)
    assert.doesNotMatch(effectSource, /MassageLabBubbleBackground[\s\S]*pointermove[\s\S]*MassageLabGradientBackground/)
  })

  it("keeps MassageLab Gradient customizable and dependency-free", () => {
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

    assert.match(registrySource, /massage-lab-gradient/)
    assert.match(registrySource, /Gradient field/)
    assert.match(registrySource, /MIT \+ Commons Clause/)
    assert.match(effectSource, /MassageLabGradientBackground/)
    assert.match(effectSource, /createMassageLabGradientPalette/)
    assert.match(effectSource, /split-complementary/)
    assert.match(effectSource, /monochromatic/)
    assert.match(stylesSource, /mlMassageLabGradientShift/)
    assert.match(effectSource, /--ml-animate-gradient-opacity/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    for (const settingKey of [
      "massageLabGradientPrimaryColor",
      "massageLabGradientHarmony",
      "massageLabGradientOpacity",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Stars source-shaped, customizable, and dependency-free", () => {
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

    assert.match(registrySource, /massage-lab-stars/)
    assert.match(registrySource, /Star field/)
    assert.match(registrySource, /MIT \+ Commons Clause/)
    assert.match(effectSource, /MassageLabStarsBackground/)
    assert.match(effectSource, /buildMassageLabStarsShadow/)
    assert.match(effectSource, /1000 \* resolved\.density/)
    assert.match(effectSource, /400 \* resolved\.density/)
    assert.match(effectSource, /200 \* resolved\.density/)
    assert.match(effectSource, /window\.addEventListener\("pointermove"/)
    assert.match(effectSource, /window\.removeEventListener\("pointermove"/)
    assert.match(stylesSource, /mlMassageLabStarsDrift/)
    assert.match(stylesSource, /top: 2000px/)
    assert.match(hostSource, /massageLabStars/)
    assert.match(runningSource, /massageLabStars=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabStars=\{\{/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    for (const settingKey of [
      "massageLabStarsColor",
      "massageLabStarsSpeed",
      "massageLabStarsDensity",
      "massageLabStarsParallax",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })

  it("keeps MassageLab Hole customizable, cleaned up, and dependency-free", () => {
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

    assert.match(registrySource, /massage-lab-hole/)
    assert.match(registrySource, /Depth well/)
    assert.match(registrySource, /MIT \+ Commons Clause/)
    assert.match(effectSource, /MassageLabHoleBackground/)
    assert.match(effectSource, /Path2D/)
    assert.match(effectSource, /requestAnimationFrame/)
    assert.match(effectSource, /cancelAnimationFrame/)
    assert.match(effectSource, /ResizeObserver/)
    assert.match(effectSource, /numberOfLines/)
    assert.match(effectSource, /numberOfDiscs/)
    assert.match(effectSource, /particleColor/)
    assert.match(stylesSource, /mlMassageLabHoleGlow/)
    assert.match(hostSource, /massageLabHole/)
    assert.match(runningSource, /massageLabHole=\{\{/)
    assert.doesNotMatch(pageSource, /massageLabHole=\{\{/)
    assert.doesNotMatch(effectSource, /motion\/react/)
    assert.doesNotMatch(effectSource, /from "motion"/)
    for (const settingKey of [
      "massageLabHoleStrokeColor",
      "massageLabHoleParticleColor",
      "massageLabHoleLineCount",
      "massageLabHoleDiscCount",
    ]) {
      assert.match(setupSource, new RegExp(settingKey))
      assert.match(runningSource, new RegExp(settingKey))
    }
  })
})
