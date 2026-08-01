import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { resolveAccessibleBackgroundDefinition } from "../components/backgrounds/backgroundRegistry.ts"
import { resolveBackgroundEffectProps } from "../components/backgrounds/resolveBackgroundEffectProps.ts"
import { resolveDnaTwistedCubesBackgroundHostProps } from "../lib/dna-twisted-cubes-background-host.js"
import { resolveImmersiveDisplayContext } from "../lib/immersive-display.js"
import { COMPUTED_CONSUMER_CONTRACTS } from "./browser/dna-twisted-cubes-consumer-contract.mjs"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("S6 ordinary action routes delegate to the shared Button family", async () => {
  const [chimer, pricing, anatomimeAlias] = await Promise.all([
    read("app/chimer/set-timer.tsx"),
    read("app/pricing/page.tsx"),
    read("app/anatomime/anatomime-action-button.tsx"),
  ])

  assert.match(chimer, /<Button[\s\S]*tone="setup"/)
  assert.match(chimer, /<MetalAttentionRing[\s\S]*metalMode=\{canAdvanceStep \? "always" : "off"\}[\s\S]*<Button/)
  assert.match(pricing, /variant="glow"[\s\S]*tone="pricing"[\s\S]*effect="glowFlicker"/)
  assert.match(anatomimeAlias, /<Button[\s\S]*tone="anatomime"/)
})

test("Chimer and Flashcards use the approved shared interaction hierarchy", async () => {
  const [chimer, chimerPage, globals, flashcardPage, flashcardBuilder, flashcardRunner] = await Promise.all([
    read("app/chimer/set-timer.tsx"),
    read("app/chimer/page.tsx"),
    read("app/globals.css"),
    read("app/education/flashcards/page.tsx"),
    read("app/education/flashcards/flashcard-setup-builder.tsx"),
    read("app/education/flashcards/flashcard-runner.tsx"),
  ])

  assert.doesNotMatch(chimer, /QUICK_TIME_PRESETS_MINUTES|quickPresetGrid/)
  assert.match(chimer, /<AcceleratingStepButton[\s\S]*step=\{1\}[\s\S]*doubleStep=\{5\}/)
  assert.match(chimer, /CHIMER_SETUP_STEP_SHORT_NAMES/)
  assert.doesNotMatch(chimer, /timerProofs|proofCarousel/)
  assert.match(chimer, /<details className=\{styles\.presetRecall\}>/)
  assert.match(chimer, /variant="ctaBlue"[\s\S]*size="compact"[\s\S]*Clock Mode/)
  assert.match(chimer, /<div className=\{styles\.durationHeader\}>[\s\S]*Clock Mode/)
  assert.match(chimerPage, /<MovingBackground[\s\S]*testId="chimer-setup-moving-background"/)
  assert.match(globals, /\.metal-fx-root\.ml-metal-attention-root\[data-ml-metal-full-width="true"\]/)
  assert.match(flashcardPage, /variant="secondary"[\s\S]*Browse starter decks/)
  assert.match(flashcardBuilder, /variant="secondary"[\s\S]*Select exact items/)
  assert.match(flashcardRunner, /variant="secondary"[\s\S]*Previous/)
  assert.match(await read("app/education/flashcards/flashcards-client.tsx"), /variant="ctaBlue"[\s\S]*Previous community decks/)
})

test("Business Planner ordinary actions avoid the outline-only treatment", async () => {
  const sources = await Promise.all([
    read("app/tools/business-planner/break-even/break-even-planner-client.tsx"),
    read("app/tools/business-planner/add-on-profit/add-on-profit-client.tsx"),
    read("app/tools/business-planner/launch-checklist/launch-checklist-client.tsx"),
    read("app/tools/business-planner/plan-outline/plan-outline-client.tsx"),
    read("app/tools/business-planner/service-menu/service-menu-client.tsx"),
  ])

  for (const source of sources) {
    assert.doesNotMatch(source, /variant="outline"/)
  }
})

test("theme switching keeps a directional reveal without displacing Glow children", async () => {
  const [themeSwitcher, globals] = await Promise.all([
    read("components/theme-switcher-multi-button.tsx"),
    read("app/globals.css"),
  ])
  const glowChildRule = globals.match(/\.ml-button-press-motion\.ml-button-glow > \* \{([^}]*)\}/)?.[1] ?? ""
  const themeKeyframes = globals.slice(
    globals.indexOf("@keyframes ml-theme-toggle-light-on"),
    globals.indexOf("@media (max-width: 639px)"),
  )

  assert.match(themeSwitcher, /data-theme-transition-fallback/)
  assert.match(globals, /@keyframes ml-theme-toggle-fallback-reveal/)
  assert.match(glowChildRule, /z-index:\s*1/)
  assert.doesNotMatch(glowChildRule, /position:/)
  assert.match(themeKeyframes, /brightness\(1\.65\) saturate\(1\.25\) blur\(14px\)/)
  assert.match(themeKeyframes, /brightness\(0\.72\) saturate\(0\.92\) blur\(12px\)/)
  assert.match(themeKeyframes, /brightness\(0\.78\) blur\(0\)/)
})

test("Wellness anatomical map remains outside the production rollout", async () => {
  const plan = await read("docs/superpowers/plans/2026-07-15-sitewide-control-system-rollout-actions.md")

  assert.match(plan, /Wellness anatomical map[\s\S]*excluded from S6 through S9/)
})
test("review fixes preserve live route controls and interaction cleanup", async () => {
  const [runningTimer, backgroundHost, controlCss, stepper, themeSwitcher, sidebar, reviewLab, flashcards, businessPlanner] = await Promise.all([
    read("app/chimer/running-timer.tsx"),
    read("components/backgrounds/BackgroundHost.tsx"),
    read("components/chimer-controls/chimer-controls.module.css"),
    read("components/ui/accelerating-step-button.tsx"),
    read("components/theme-switcher-multi-button.tsx"),
    read("components/sidebar/app-sidebar-client.tsx"),
    read("app/dev/buttons/page.tsx"),
    read("app/education/flashcards/flashcards-client.tsx"),
    read("app/tools/business-planner/page.tsx"),
  ])

  assert.doesNotMatch(runningTimer, /resolvePaletteDrivenColor|globalPalette/)
  assert.match(backgroundHost, /resolveBackgroundEffectProps/)
  assert.match(backgroundHost, /backgroundPalette/)
  assert.doesNotMatch(backgroundHost, /applyPaletteToBackgroundEffects/)
  assert.match(backgroundHost, /<BackgroundComponent \{\.\.\.effectProps\} \/>/)
  assert.doesNotMatch(backgroundHost, /<BackgroundComponent\s+mainColor=/)
  assert.equal((controlCss.match(/^\.harmonyList \{/gm) ?? []).length, 1)
  assert.equal((controlCss.match(/^\.globalColorGrid \{/gm) ?? []).length, 1)
  assert.match(stepper, /disabledRef\.current[\s\S]*onPointerCancel=\{\(\) => finishPointerPress\(false\)\}/)
  assert.match(themeSwitcher, /cleanupTransitionState\(\)[\s\S]*\[cleanupTransitionState\]/)
  assert.match(themeSwitcher, /activeTransitionRef\.current === transition/)
  assert.match(themeSwitcher, /transition\.finished[\s\S]*\.catch\(\(\) => undefined\)[\s\S]*\.finally/)
  assert.match(themeSwitcher, /activeThemeTransitionOwner !== transitionOwnerRef\.current/)
  assert.match(themeSwitcher, /let managesTransition = false[\s\S]*if \(managesTransition\)/)
  assert.match(sidebar, /\[activeGroupId, pathname\]/)
  assert.match(reviewLab, /Current rollout validation/)
  assert.match(flashcards, /\{sortedCommunityDecks\.length > 2 \? \(/)
  assert.match(businessPlanner, /<h1 id="business-tools-heading"/)
})

test("immersive display panels delegate toolbar actions to shared controls", async () => {
  const shell = await read("app/chimer/immersive-panel-shell.tsx")

  assert.match(shell, /<Button[\s\S]*hapticsEnabled=\{hapticsEnabled\}/)
  assert.match(shell, /<TooltipProvider/)
  assert.match(shell, /Clock[\s\S]*Visual[\s\S]*Background/)
})

test("Visual draft actions live in the responsive panel header while sync status stays in flow", async () => {
  const [styles, runningTimer] = await Promise.all([
    read("app/chimer/running-timer.module.css"),
    read("app/chimer/running-timer.tsx"),
  ])

  assert.doesNotMatch(styles, /\.visualDraftActions\s*\{[^}]*position:\s*sticky/)
  assert.match(styles, /\.immersiveVisualHeaderControls,\s*\.visualHeaderDraftActions\s*\{/)
  assert.match(styles, /:global\(\[data-immersive-layout="side"\]\) \.visualHeaderDraftButtonLabel\s*\{[^}]*display:\s*none/)
  assert.match(
    runningTimer,
    /className=\{styles\.immersiveVisualHeaderControls\}[\s\S]*aria-label="Visual draft actions"/,
  )
  assert.match(
    runningTimer,
    /className=\{styles\.visualDraftStatusRow\}[\s\S]*variant="cta" onClick=\{onRetryBackgroundVisualPreferences\}[\s\S]*Retry sync/,
  )
  assert.match(
    runningTimer,
    /aria-label="Undo"[\s\S]*aria-label="Redo"[\s\S]*variant="destructive" aria-label="Cancel"/,
  )
  assert.match(
    runningTimer,
    /variant="success" aria-label="Apply"[\s\S]*onClick=\{commitVisualDraft\}/,
  )
})

test("development review exposes the complete shared background palette matrix", async () => {
  const [page, gallery] = await Promise.all([
    read("app/dev/buttons/page.tsx"),
    read("app/dev/buttons/background-palette-gallery.tsx"),
  ])

  assert.match(page, /\{ value: "background-palettes", label: "Background palettes" \}/)
  assert.match(page, /<BackgroundPaletteGallery \/>/)
  assert.match(gallery, /BackgroundPaletteEditor/)
  assert.match(gallery, /BackgroundColorPresetManager/)
  assert.match(gallery, /BackgroundVisualPresetManager/)
  assert.match(gallery, /backgroundPaletteRegistry/)
  assert.match(gallery, /backgroundRegistry/)
  assert.match(gallery, /<BackgroundHost/)
  assert.match(gallery, /FEATURE_KEYS\.premiumBackgrounds/)
  assert.doesNotMatch(gallery, /FEATURE_KEYS\.chimerCustomColors/)
  assert.match(gallery, /Source[\s\S]*Custom[\s\S]*Harmony/)
  assert.match(gallery, /Not used by this background/)
  assert.match(gallery, /Shared roles/)
  assert.match(gallery, /Access locked/)
  assert.match(gallery, /Unsaved changes[\s\S]*Undo[\s\S]*Redo[\s\S]*Apply[\s\S]*Cancel/)
  assert.match(gallery, /Sync failed[\s\S]*Retry/)
  assert.match(gallery, /<Button size="compact" variant="success">Apply<\/Button>/)
  assert.match(gallery, /<Button size="compact" variant="destructive">Cancel<\/Button>/)
  assert.match(gallery, /className="mt-4" size="compact" variant="cta"[\s\S]*Retry/)
  assert.match(gallery, /const \[localPalette, setLocalPalette\] = useState/)
  assert.match(gallery, /const \[localMapping, setLocalMapping\] = useState/)
  assert.match(gallery, /const isInteractiveSpecimen = canCustomize && palette\.mode !== "source"/)
  assert.match(gallery, /onPaletteChange=\{isInteractiveSpecimen \? setLocalPalette : \(\) => undefined\}/)
  assert.match(gallery, /onMappingChange=\{isInteractiveSpecimen \? setLocalMapping : \(\) => undefined\}/)
  assert.match(gallery, /colorPresetFixtures[\s\S]*\{ length: 6 \}/)
  assert.match(gallery, /visualPresetFixtures[\s\S]*\{ length: 3 \}/)
  assert.match(gallery, /defaultPresetId="review-visual-1"/)
  assert.match(gallery, /Color mapping/)
  assert.match(gallery, /Use source colors/)
  assert.match(gallery, /Reset visual properties/)
  assert.match(gallery, /data-adapter-status/)
  assert.match(gallery, /data-renderer-family/)
  assert.match(gallery, /data-source-behavior/)
  assert.match(gallery, /data-unsupported-reason/)
  assert.match(gallery, /data-resolved-role-colors/)
  assert.match(gallery, /data-background-palette-live-selector/)
  assert.match(gallery, /useMusic/)
  assert.match(gallery, /data-music-session-id/)
  assert.match(gallery, /data-music-audio-elapsed/)
  assert.match(gallery, /window\.setInterval\(update,\s*500\)/)
  assert.doesNotMatch(gallery, /requestAnimationFrame\(update\)/)
  assert.match(gallery, /process\.env\.NODE_ENV/)
})

test("development review exposes the real DNA and Twisted Cubes acceptance matrix", async () => {
  const [gallery, browserSource, playwrightConfig, sliderSource, colorSliderSource] = await Promise.all([
    read("app/dev/buttons/background-palette-gallery.tsx"),
    read("tests/browser/dna-twisted-cubes-backgrounds.spec.ts"),
    read("playwright.config.ts"),
    read("components/ui/slider.tsx"),
    read("components/chimer-controls/ColorSlider.tsx"),
  ])

  const computedConsumerProjection = COMPUTED_CONSUMER_CONTRACTS.map((entry) => [
    entry.effectId,
    entry.label,
    entry.key,
    entry.target,
    entry.properties.join("|"),
    entry.allowedRenderChanges.join("|"),
    entry.allowedCouplings.join("|"),
  ])
  assert.equal(COMPUTED_CONSUMER_CONTRACTS.length, 22)
  assert.equal(new Set(COMPUTED_CONSUMER_CONTRACTS.map(({ key }) => key)).size, 22)
  assert.equal(
    COMPUTED_CONSUMER_CONTRACTS.some(({ key }) => key === "massageLabDnaShowBaseLetters"),
    false,
    "the boolean base-letter toggle has a direct add/remove DOM assertion instead of a numeric computed-style contract",
  )
  assert.match(browserSource, /baseLetterToggle[\s\S]*toHaveCount\(140\)/)
  assert.ok(COMPUTED_CONSUMER_CONTRACTS.every(({ allowedRenderChanges }) => (
    Object.isFrozen(allowedRenderChanges) && allowedRenderChanges.length > 0
  )))
  assert.deepEqual(computedConsumerProjection, [
    ["massage-lab-dna", "Node motion speed", "massageLabDnaNodeMotionSpeed", "strand > connector + [data-side]", "animationDuration|animationDelay|transform", "firstNodeDuration|firstNodeDelay", "connectorTransform|startNodeTransform|endNodeTransform|connectorDuration|connectorDelay|startNodeDuration|startNodeDelay|endNodeDuration|endNodeDelay"],
    ["massage-lab-dna", "Strand rotation speed", "massageLabDnaStrandRotationSpeed", ".scene > .composition", "animationDuration", "rotationDuration", "sceneDuration"],
    ["massage-lab-dna", "Strand count", "massageLabDnaStrandCount", ".scene grid + [data-side]", "count|height|animationDelay|transform", "strandCount|firstNodeDelay", "strandCount|nodeCount|strandHeight|connectorHeight|startNodeWidth|startNodeHeight|endNodeWidth|endNodeHeight|connectorDelay|startNodeDelay|endNodeDelay|connectorTransform|startNodeTransform|endNodeTransform"],
    ["massage-lab-dna", "Strand angle", "massageLabDnaStrandAngle", ".scene > .composition", "rotate", "strandAngle", "sceneRotate"],
    ["massage-lab-dna", "Strand spacing", "massageLabDnaStrandSpacing", ".scene > .composition", "rowGap|height|transform", "strandSpacing", "sceneRowGap|strandHeight|connectorHeight|startNodeWidth|startNodeHeight|endNodeWidth|endNodeHeight|connectorTransform|startNodeTransform|endNodeTransform"],
    ["massage-lab-dna", "Scale", "massageLabDnaScale", ":scope > .scene", "transform", "scale", "sceneTransform"],
    ["massage-lab-dna", "Position X", "massageLabDnaPositionX", ":scope > .scene", "transform", "positionX", "sceneTransform"],
    ["massage-lab-dna", "Position Y", "massageLabDnaPositionY", ":scope > .scene", "transform", "positionY", "sceneTransform"],
    ["massage-lab-dna", "Connector width", "massageLabDnaConnectorWidth", "strand > connector", "width|transform", "connectorWidth", "connectorWidth|connectorTransform"],
    ["massage-lab-dna", "Connector thickness", "massageLabDnaConnectorThickness", "strand > connector", "height|transform", "connectorThickness", "connectorHeight|connectorTransform"],
    ["massage-lab-dna", "Outline thickness", "massageLabDnaOutlineThickness", "connector + [data-side]", "borderTopWidth|size|transform", "outlineThickness", "connectorBorderWidth|startNodeBorderWidth|endNodeBorderWidth|connectorHeight|startNodeWidth|startNodeHeight|endNodeWidth|endNodeHeight|connectorTransform|startNodeTransform|endNodeTransform"],
    ["massage-lab-twisted-cubes", "Rotation speed", "massageLabTwistedCubesRotationSpeed", "[style*='--ml-twisted-cubes-outline'] > .view > .cube", "animationDuration|transform", "cycle", "cubeTransform|cubeDuration"],
    ["massage-lab-twisted-cubes", "Layer stagger", "massageLabTwistedCubesLayerStagger", "[style*='--ml-twisted-cubes-outline'] > .view > .cube", "animationDelay|transform", "firstDelay", "cubeTransform|cubeDelay"],
    ["massage-lab-twisted-cubes", "View angle X", "massageLabTwistedCubesViewAngleX", ".layer > .view", "transform", "viewAngleX", "viewTransform"],
    ["massage-lab-twisted-cubes", "View angle Y", "massageLabTwistedCubesViewAngleY", ".layer > .view", "transform", "viewAngleY", "viewTransform"],
    ["massage-lab-twisted-cubes", "Layer count", "massageLabTwistedCubesLayerCount", "[style*='--ml-twisted-cubes-outline'] > .view > .cube > .cuboid > .face", "count|depth|size|animationDelay|transform|opacity", "layerCount|middleOutline|firstAlpha|firstDelay|firstSize|secondDepth", "layerCount|faceCount|firstLayerTransform|secondLayerTransform|cubeTransform|cubeDelay|faceWidth|faceHeight|faceOpacity"],
    ["massage-lab-twisted-cubes", "Layer depth", "massageLabTwistedCubesLayerDepthSpacing", "[style*='--ml-twisted-cubes-outline']", "transform", "secondDepth", "firstLayerTransform|secondLayerTransform"],
    ["massage-lab-twisted-cubes", "Scale", "massageLabTwistedCubesScale", "inner cube faces", "size|transform", "scale|firstSize", "cubeTransform|faceWidth|faceHeight"],
    ["massage-lab-twisted-cubes", "Position X", "massageLabTwistedCubesPositionX", ":scope > .scene", "transform", "positionX", "sceneTransform"],
    ["massage-lab-twisted-cubes", "Position Y", "massageLabTwistedCubesPositionY", ":scope > .scene", "transform", "positionY", "sceneTransform"],
    ["massage-lab-twisted-cubes", "Fade falloff", "massageLabTwistedCubesOpacityFalloff", "first .face", "opacity", "firstAlpha", "faceOpacity"],
    ["massage-lab-twisted-cubes", "Relative outline thickness", "massageLabTwistedCubesOutlineThickness", "first .face", "borderTopWidth", "firstOutlineThickness", "faceBorderWidth"],
  ])

  assert.match(gallery, /DnaBackgroundControls/)
  assert.match(gallery, /TwistedCubesBackgroundControls/)
  assert.match(gallery, /createBackgroundVisualDraft/)
  assert.match(gallery, /reduceBackgroundVisualDraft/)
  assert.match(gallery, /data-track-4b-review/)
  assert.match(gallery, /Source[\s\S]*Custom[\s\S]*Harmony/)
  assert.match(gallery, /Subscriber access[\s\S]*Permanent owner[\s\S]*Access locked/)
  assert.match(gallery, /Dirty draft[\s\S]*Applied state/)
  assert.match(gallery, /data-track-4b-context="chimer"/)
  assert.match(gallery, /data-track-4b-context="clock"/)
  assert.match(gallery, /data-track-4b-context="music"/)
  assert.match(gallery, /BackgroundPreviewMediaReview/)
  assert.match(gallery, /backgroundPreviewManifest/)
  assert.match(gallery, /<BackgroundPreviewMedia/)
  assert.match(gallery, /data-track-4b-preview/)
  assert.match(gallery, /const nextDraft = createTrack4BReviewDraft\(nextId\)/)
  assert.match(gallery, /setDraft\(nextDraft\)/)
  assert.match(gallery, /setAppliedSnapshot\(nextDraft\.openingSnapshot\)/)
  assert.match(gallery, /data-current-palette/)
  assert.match(gallery, /data-current-mapping/)

  assert.match(browserSource, /desktop[\s\S]*phone portrait[\s\S]*short landscape/i)
  assert.match(browserSource, /reducedMotion/)
  assert.match(browserSource, /200% page scale/i)
  assert.match(browserSource, /data-track-4b-review/)
  assert.match(browserSource, /data-background-diagnostic-status/)
  assert.match(browserSource, /data-background-palette-music-continuity/)
  assert.match(browserSource, /scrollWidth/)
  assert.match(browserSource, /Emulation\.setPageScaleFactor/)
  assert.match(browserSource, /massage-lab-dna[\s\S]*massage-lab-twisted-cubes/)
  assert.match(browserSource, /interpolateTwistedCubeOutline/)
  assert.doesNotMatch(browserSource, /ALLOWED_RENDER_CHANGES/)
  assert.match(browserSource, /COMPUTED_CONSUMER_CONTRACTS\.filter/)
  assert.match(browserSource, /new Set\(allowedRenderChanges\)/)
  assert.match(browserSource, /new Set\(contract\.allowedCouplings\)/)
  assert.match(browserSource, /expectExactControlRender/)
  assert.match(browserSource, /expectExactReducedEffectState/)
  assert.match(browserSource, /getDnaStrandDelaySeconds/)
  assert.match(browserSource, /getTwistedCubeAlpha/)
  assert.match(browserSource, /captureComputedConsumerState/)
  assert.match(browserSource, /getComputedStyle\(connector\)/)
  assert.match(browserSource, /querySelector<HTMLElement>\('\[data-side="start"\]'\)/)
  assert.match(browserSource, /viewTransform/)
  assert.match(browserSource, /faceBorderWidth/)
  assert.match(browserSource, /scenePerspective:\s*"none"/)
  assert.match(browserSource, /strandAnimationName:\s*"none"[\s\S]*strandDuration:\s*"0s"[\s\S]*strandDelay:\s*"0s"/)
  assert.match(browserSource, /connectorAnimationName:\s*"none"[\s\S]*connectorDuration:\s*"0s"[\s\S]*connectorDelay:\s*"0s"/)
  assert.match(browserSource, /startNodeAnimationName:\s*"none"[\s\S]*startNodeDuration:\s*"0s"[\s\S]*startNodeDelay:\s*"0s"/)
  assert.match(browserSource, /endNodeAnimationName:\s*"none"[\s\S]*endNodeDuration:\s*"0s"[\s\S]*endNodeDelay:\s*"0s"/)
  assert.match(browserSource, /cubeAnimationName:\s*"none"[\s\S]*cubeDuration:\s*"0s"[\s\S]*cubeDelay:\s*"0s"/)
  assert.match(browserSource, /width:\s*"26vmin"[\s\S]*height:\s*"max\(240vmin, 230vmax\)"/)
  assert.match(browserSource, /width:\s*`\$\{TWISTED_CUBES_VIEWPORT_EXTENT_VMAX\}vmax`[\s\S]*height:\s*`\$\{TWISTED_CUBES_VIEWPORT_EXTENT_VMAX\}vmax`/)
  assert.doesNotMatch(browserSource, /test\.skip\(/)
  assert.match(playwrightConfig, /dna-twisted-cubes-backgrounds\.spec\.ts/)
  assert.match(sliderSource, /<SliderPrimitive\.Thumb[\s\S]*aria-label=\{ariaLabel\}/)
  assert.match(sliderSource, /aria-labelledby=\{ariaLabelledBy\}/)
  assert.match(sliderSource, /aria-describedby=\{ariaDescribedBy\}/)
  assert.match(colorSliderSource, /label=\{label\}/)
  assert.doesNotMatch(colorSliderSource, /aria-label=\{label\}/)
})

test("slider gallery copy and layout match the remaining color controls", async () => {
  const gallery = await read("app/dev/buttons/slider-gallery.tsx")
  const colorExamples = gallery.slice(gallery.indexOf('title="Color control examples"'))

  assert.match(colorExamples, /shared color slider wrapper and compact swatch/)
  assert.doesNotMatch(colorExamples, /reusable picker/)
  assert.doesNotMatch(colorExamples, /lg:grid-cols-\[/)
})

test("background palette browser review fails closed and reads real Host diagnostics", async () => {
  const browserSource = await read("tests/browser/background-palette.spec.ts")

  assert.doesNotMatch(browserSource, /PALETTE_SWEEP_START_INDEX/)
  assert.doesNotMatch(browserSource, /test\.skip\(/)
  assert.match(browserSource, /EXPECTED_ENABLED_BACKGROUND_COUNT/)
  assert.match(browserSource, /executedCaseCount/)
  assert.match(browserSource, /data-background-diagnostic-status/)
  assert.match(browserSource, /data-background-diagnostic-loaded-id/)
  assert.match(browserSource, /data-background-diagnostic-targets/)
  assert.match(browserSource, /mlab-proof-drone/)
  assert.match(browserSource, /Running Chimer timer/)
})

test("shared background access and palette resolver inputs stay authoritative and tick-stable", async () => {
  const [pageSource, runningSource, hostSource, pickerSource, indexSource] = await Promise.all([
    read("app/chimer/page.tsx"),
    read("app/chimer/running-timer.tsx"),
    read("components/backgrounds/BackgroundHost.tsx"),
    read("components/chimer-controls/GlobalColorPicker.tsx"),
    read("components/chimer-controls/index.ts"),
  ])

  assert.match(pageSource, /const backgroundAccess = useMemo/)
  assert.match(pageSource, /featureKeys,[\s\S]*resolveAuthoritativeBackgroundOwnership\([\s\S]*permanentlyOwnedBackgroundIds,[\s\S]*commerceOwnedBackgroundIds/)
  assert.match(runningSource, /backgroundAccess: BackgroundAccessSnapshot/)
  assert.match(runningSource, /<BackgroundHost[\s\S]*access=\{effectiveBackgroundAccess\}/)
  assert.match(runningSource, /const effectiveBackgroundPalette = useMemo/)
  assert.match(
    runningSource,
    /const ACCOUNT_COLOR_SETTING_KEYS = new Set\(\["clockModeFontColor"\]\)/,
  )
  assert.match(hostSource, /access: BackgroundAccessSnapshot/)
  assert.match(hostSource, /resolveAccessibleBackgroundDefinition\(selectedId, access, category\)/)
  assert.match(hostSource, /const effectPropsInputSignature = JSON\.stringify/)
  assert.match(hostSource, /const stableEffectPropsInput = useMemo/)
  assert.match(hostSource, /\[effectPropsInputSignature\]/)
  assert.match(hostSource, /resolveBackgroundEffectProps\(\{[\s\S]*effectProps: baseEffectProps/)
  assert.doesNotMatch(runningSource, /resolvePaletteDrivenColor|globalColors|globalPalette/)
  assert.doesNotMatch(pickerSource, /export function GlobalColorPicker|GlobalColorValues/)
  assert.doesNotMatch(indexSource, /\bGlobalColorPicker\b(?=\s*[},])/)
})

test("DNA and Twisted Cubes share compact options and host-owned responsive motion context", async () => {
  const [runningSource, hostSource, dnaEffect, cubesEffect, styles] = await Promise.all([
    read("app/chimer/running-timer.tsx"),
    read("components/backgrounds/BackgroundHost.tsx"),
    read("components/backgrounds/effects/massage-lab-dna-background.tsx"),
    read("components/backgrounds/effects/massage-lab-twisted-cubes-background.tsx"),
    read("app/chimer/running-timer.module.css"),
  ])

  assert.match(runningSource, /getDnaBackgroundOptionsFromChimerSettings/)
  assert.match(runningSource, /getTwistedCubesBackgroundOptionsFromChimerSettings/)
  assert.match(runningSource, /resolveDnaTwistedCubesBackgroundHostProps/)
  assert.match(runningSource, /\{\.\.\.effectiveDnaTwistedCubesHostProps\}/)
  assert.doesNotMatch(runningSource, /massageLabDnaStrandCount=|massageLabTwistedCubesLayerCount=/)
  assert.match(hostSource, /window\.matchMedia\("\(max-width: 479px\), \(max-height: 479px\)"\)/)
  assert.match(hostSource, /entry\.supportsReducedMotionStatic/)
  assert.match(hostSource, /reduceMotion,[\s\S]*compactViewport,/)
  assert.doesNotMatch(dnaEffect, /matchMedia|addEventListener\("resize"/)
  assert.doesNotMatch(cubesEffect, /matchMedia|addEventListener\("resize"/)
  assert.doesNotMatch(dnaEffect, /\bdocument\b|\bwindow\b|addEventListener|requestAnimationFrame/)
  assert.doesNotMatch(cubesEffect, /\bdocument\b|\bwindow\b|addEventListener|requestAnimationFrame/)
  assert.match(styles, /\.backgroundPropertyGroups\s*\{[^}]*\bmin-width:\s*0/)
  assert.match(styles, /\.backgroundPropertyGroup\s*\{[^}]*\bmin-width:\s*0/)
})

test("actual Chimer, ordinary Clock, Music, and ambient Host plumbing resolves all 23 values", async () => {
  const settings = {
    massageLabDnaStrandCount: 15,
    massageLabDnaShowBaseLetters: true,
    massageLabDnaNodeMotionSpeed: 1.25,
    massageLabDnaStrandRotationSpeed: 1.5,
    massageLabDnaStrandAngle: 45,
    massageLabDnaScale: 0.9,
    massageLabDnaPositionX: 5,
    massageLabDnaPositionY: -5,
    massageLabDnaStrandSpacing: 0.75,
    massageLabDnaConnectorWidth: 88,
    massageLabDnaConnectorThickness: 35,
    massageLabDnaOutlineThickness: 0.75,
    massageLabTwistedCubesLayerCount: 18,
    massageLabTwistedCubesRotationSpeed: 1.25,
    massageLabTwistedCubesLayerStagger: 0.15,
    massageLabTwistedCubesViewAngleX: -20,
    massageLabTwistedCubesViewAngleY: 20,
    massageLabTwistedCubesScale: 0.85,
    massageLabTwistedCubesPositionX: 8,
    massageLabTwistedCubesPositionY: -8,
    massageLabTwistedCubesLayerDepthSpacing: 42,
    massageLabTwistedCubesOpacityFalloff: 0.6,
    massageLabTwistedCubesOutlineThickness: 0.01,
  }
  const expectedDna = {
    strandCount: 15,
    showBaseLetters: true,
    nodeMotionSpeed: 1.25,
    strandRotationSpeed: 1.5,
    strandAngle: 45,
    scale: 0.9,
    positionX: 5,
    positionY: -5,
    strandSpacing: 0.75,
    connectorWidth: 88,
    connectorThickness: 35,
    outlineThickness: 0.75,
  }
  const expectedCubes = {
    layerCount: 18,
    rotationSpeed: 1.25,
    layerStagger: 0.15,
    viewAngleX: -20,
    viewAngleY: 20,
    scale: 0.85,
    positionX: 8,
    positionY: -8,
    layerDepthSpacing: 42,
    opacityFalloff: 0.6,
    outlineThickness: 0.01,
  }
  const access = {
    featureKeys: ["premium_backgrounds"],
    ownedBackgroundIds: [],
  }
  const contexts = [
    {
      label: "active Chimer",
      category: "chimer",
      route: { pathname: "/chimer", source: null },
      immersiveContext: "chimer",
    },
    {
      label: "ordinary Clock",
      category: "clock",
      route: { pathname: "/clock", source: null },
      immersiveContext: "clock",
    },
    {
      label: "Music visualizer",
      category: "music",
      route: { pathname: "/clock", source: "music" },
      immersiveContext: "musicVisualizer",
    },
    {
      label: "ambient Host",
      category: "ambient",
      route: null,
      immersiveContext: null,
    },
  ]
  const runningSource = await read("app/chimer/running-timer.tsx")

  assert.match(
    runningSource,
    /resolveDnaTwistedCubesBackgroundHostProps\(\{[^}]*settings: effectiveLiveBackgroundSettings,[^}]*category: backgroundCategory,[^}]*\}\)/,
  )
  assert.match(
    runningSource,
    /<BackgroundHost(?:(?!\/>)[\s\S])*?\{\.\.\.effectiveDnaTwistedCubesHostProps\}(?:(?!\/>)[\s\S])*?\/>/,
  )

  for (const { label, category, route, immersiveContext } of contexts) {
    if (route) {
      assert.equal(resolveImmersiveDisplayContext(route), immersiveContext, label)
    }

    const hostProps = resolveDnaTwistedCubesBackgroundHostProps({ settings, category })
    assert.deepEqual(hostProps, {
      massageLabDna: expectedDna,
      massageLabTwistedCubes: expectedCubes,
    }, label)

    assert.equal(
      resolveAccessibleBackgroundDefinition("massage-lab-dna", access, category).id,
      "massage-lab-dna",
      label,
    )
    assert.equal(
      resolveAccessibleBackgroundDefinition("massage-lab-twisted-cubes", access, category).id,
      "massage-lab-twisted-cubes",
      label,
    )
    const resolvedDna = resolveBackgroundEffectProps({
      selectedId: "massage-lab-dna",
      effectProps: hostProps,
      palette: null,
      mapping: {},
      canCustomize: false,
    })
    const resolvedCubes = resolveBackgroundEffectProps({
      selectedId: "massage-lab-twisted-cubes",
      effectProps: hostProps,
      palette: null,
      mapping: {},
      canCustomize: false,
    })

    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedDna).map((key) => [key, resolvedDna.massageLabDna?.[key]])),
      expectedDna,
      `${label} DNA Host prop`,
    )
    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedCubes).map((key) => [key, resolvedCubes.massageLabTwistedCubes?.[key]])),
      expectedCubes,
      `${label} Twisted Cubes Host prop`,
    )
  }
})
