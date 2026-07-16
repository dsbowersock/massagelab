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
  assert.doesNotMatch(themeKeyframes, /blur\(/)
})

test("Wellness anatomical map remains outside the production rollout", async () => {
  const plan = await read("docs/superpowers/plans/2026-07-15-sitewide-control-system-rollout-actions.md")

  assert.match(plan, /Wellness anatomical map[\s\S]*excluded from S6 through S9/)
})