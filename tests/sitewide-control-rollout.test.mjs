import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

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
  const [runningTimer, backgroundHost, controlCss, stepper, themeSwitcher, sidebar, reviewLab] = await Promise.all([
    read("app/chimer/running-timer.tsx"),
    read("components/backgrounds/BackgroundHost.tsx"),
    read("components/chimer-controls/chimer-controls.module.css"),
    read("components/ui/accelerating-step-button.tsx"),
    read("components/theme-switcher-multi-button.tsx"),
    read("components/sidebar/app-sidebar-client.tsx"),
    read("app/dev/buttons/page.tsx"),
  ])

  assert.match(runningTimer, /resolvedMovingBackgroundMainColor = resolvePaletteDrivenColor/)
  assert.match(runningTimer, /value: movingBackgroundOrbColor,[\s\S]*globalValue: globalPaletteSecondary/)
  assert.match(backgroundHost, /const effectProps = useMemo\(\(\) => applyPaletteToBackgroundEffects/)
  assert.equal((controlCss.match(/^\.harmonyList \{/gm) ?? []).length, 1)
  assert.equal((controlCss.match(/^\.globalColorGrid \{/gm) ?? []).length, 1)
  assert.match(stepper, /disabledRef\.current[\s\S]*onPointerCancel=\{\(\) => finishPointerPress\(false\)\}/)
  assert.match(themeSwitcher, /cleanupTransitionState\(\)[\s\S]*\[cleanupTransitionState\]/)
  assert.match(sidebar, /\[activeGroupId, pathname\]/)
  assert.match(reviewLab, /Current rollout validation/)
})
