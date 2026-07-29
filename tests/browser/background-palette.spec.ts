import { expect, test, type Page } from "@playwright/test"

import {
  backgroundPaletteRegistry,
} from "../../components/backgrounds/backgroundPaletteRegistry"
import {
  backgroundRegistry,
} from "../../components/backgrounds/backgroundRegistry"
import {
  resolveBackgroundRoleColors,
} from "../../lib/background-palette.js"

type AdapterInventoryRow = {
  id: string
  status: "supported" | "unsupported"
  family: "css-dom" | "canvas" | "webgl"
}

const MODES = ["source", "custom", "harmony"] as const
const EXPECTED_ENABLED_BACKGROUND_COUNT = 81
const CUSTOM_SWATCHES = [
  "#ff5119",
  "#fbbf24",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const
const enabledRegistryEntries = backgroundRegistry.filter((entry) => entry.enabled)

function captureRuntimeErrors(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  return { consoleErrors, pageErrors }
}

async function openPaletteGallery(page: Page) {
  const response = await page.goto("/dev/buttons")
  if (!response) {
    throw new Error("Background palette review setup failed: /dev/buttons returned no response.")
  }
  if (response.status() === 404) {
    throw new Error(
      "Background palette review setup failed: /dev/buttons is development-only; "
      + "run the exact background-palette Playwright command so its dev server starts.",
    )
  }
  if (!response.ok()) {
    throw new Error(`Background palette review setup failed with HTTP ${response.status()}.`)
  }
  await expect(page.locator('[data-review-lab-ready="true"]')).toBeAttached()
  await page.getByRole("tab", { name: "Background palettes" }).click()
  await expect(page.getByRole("heading", { name: "Background palette review" })).toBeVisible()
}

function parseRecord(value: string | null, label: string) {
  if (!value) {
    throw new Error(`${label} diagnostic was missing.`)
  }
  return JSON.parse(value) as Record<string, unknown>
}

function paletteForMode(mode: typeof MODES[number]) {
  return {
    mode,
    primaryColor: CUSTOM_SWATCHES[0],
    harmony: "analogous",
    swatches: CUSTOM_SWATCHES,
  }
}

function hexHue(value: string) {
  const red = Number.parseInt(value.slice(1, 3), 16) / 255
  const green = Number.parseInt(value.slice(3, 5), 16) / 255
  const blue = Number.parseInt(value.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  if (delta === 0) return 0
  const sector = maximum === red
    ? ((green - blue) / delta) % 6
    : maximum === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4
  return Math.round((sector * 60 + 360) % 360)
}

function expectTargetColor(actual: unknown, expectedHex: string, target: string) {
  if (typeof actual === "number") {
    expect(actual, target).toBe(hexHue(expectedHex))
    return
  }
  if (typeof actual === "string" && actual.startsWith("rgba(")) {
    const expectedRgb = [
      Number.parseInt(expectedHex.slice(1, 3), 16),
      Number.parseInt(expectedHex.slice(3, 5), 16),
      Number.parseInt(expectedHex.slice(5, 7), 16),
    ]
    const actualRgb = actual.match(/[\d.]+/g)?.slice(0, 3).map(Number)
    expect(actualRgb, target).toEqual(expectedRgb)
    return
  }
  expect(actual, target).toBe(expectedHex)
}

async function expectLoadedPaletteMode(
  page: Page,
  id: string,
  status: AdapterInventoryRow["status"],
  mode: typeof MODES[number],
) {
  const live = page.locator("[data-background-palette-live-selector]")
  const host = live.getByTestId("background-palette-live-host")
  await page.getByLabel("Live palette mode").selectOption(mode)
  await expect(live).toHaveAttribute("data-background-id", id)
  await expect(live).toHaveAttribute("data-palette-mode", mode)
  await expect(host).toHaveAttribute("data-background-diagnostic-requested-id", id)
  await expect(host).toHaveAttribute("data-background-diagnostic-loaded-id", id)
  await expect(host).toHaveAttribute(
    "data-background-diagnostic-status",
    status === "supported" ? "loaded" : "unsupported",
  )
  await expect(host).toHaveAttribute(
    "data-background-diagnostic-family",
    backgroundPaletteRegistry[id].rendererFamily,
  )
  await expect(host).toHaveAttribute("data-background-diagnostic-fallback", "false")
  await expect(host).not.toHaveAttribute("data-background-diagnostic-error", /.+/)
  await expect(host).toHaveAttribute("data-background-effect-mounted", "true")

  const adapter = backgroundPaletteRegistry[id]
  const actualTargets = parseRecord(
    await host.getAttribute("data-background-diagnostic-targets"),
    `${id}:${mode}`,
  )
  if (adapter.status === "unsupported") {
    expect(actualTargets, `${id}:${mode}:unsupported targets`).toEqual({})
    await expect(host).toHaveAttribute("data-background-diagnostic-applied", "false")
    await expect(host).toHaveAttribute("data-background-diagnostic-application-changed", "false")
    return
  }

  await expect(host).toHaveAttribute("data-background-diagnostic-applied", "true")
  const mapping = parseRecord(
    await live.getAttribute("data-active-mapping"),
    `${id}:${mode}:mapping`,
  )
  const expectedRoleColors = resolveBackgroundRoleColors({
    palette: paletteForMode(mode),
    adapter,
    mapping,
    canCustomize: true,
  })
  const actualRoleColors = parseRecord(
    await live.getAttribute("data-resolved-role-colors"),
    `${id}:${mode}:roles`,
  )
  expect(actualRoleColors, `${id}:${mode}:role colors`).toEqual(expectedRoleColors)
  expect(Object.keys(actualRoleColors).sort(), `${id}:${mode}:role inventory`).toEqual(
    adapter.roles.map((role) => role.id).sort(),
  )
  for (const role of adapter.roles) {
    expect(String(actualRoleColors[role.id]).length, `${id}:${mode}:${role.id}`).toBeGreaterThan(0)
    const replacingOverride = (adapter.modeOverrides ?? []).find((override) => {
      const key = mode === "source" ? "sourceValue" : "customValue"
      return Object.hasOwn(override, key)
        && role.rendererTarget.startsWith(`${override.rendererTarget}[`)
    })
    if (replacingOverride) {
      continue
    }
    expectTargetColor(
      actualTargets[role.rendererTarget],
      expectedRoleColors[role.id],
      `${id}:${mode}:${role.rendererTarget}`,
    )
  }
  for (const override of adapter.modeOverrides ?? []) {
    const key = mode === "source" ? "sourceValue" : "customValue"
    if (Object.hasOwn(override, key)) {
      expect(actualTargets[override.rendererTarget], `${id}:${mode}:${override.rendererTarget}`)
        .toEqual(override[key])
    }
  }
}

async function selectBackground(page: Page, id: string) {
  await page.getByLabel("Live background").selectOption(id)
  await expect(page.locator("[data-background-palette-live-selector]"))
    .toHaveAttribute("data-background-id", id)
}

async function installPremiumAccount(page: Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "palette-review", email: "palette@example.com" } }),
    })
  })
  await page.route("**/api/account/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: ["premium_backgrounds", "chimer_custom_colors"],
        chimerSettings: {},
        appSettings: {},
      }),
    })
  })
}

async function startActiveChimer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("massagelab-chimer-settings", JSON.stringify({
      showTimerSeconds: true,
    }))
  })
  await installPremiumAccount(page)
  await page.goto("/chimer", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /^Continue$/i }).click()
  }
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()
  await expect(page.getByLabel("Running Chimer timer")).toBeVisible()
}

test.describe("shared background palette review matrix", () => {
  test("sweeps every enabled background through Source, Custom, and Harmony", async ({ page }) => {
    test.setTimeout(600_000)
    const health = captureRuntimeErrors(page)
    await openPaletteGallery(page)
    const inventory = await page
      .locator("[data-palette-adapter-row]")
      .evaluateAll((rows) => rows.map((row) => ({
        id: row.getAttribute("data-background-id") ?? "",
        status: row.getAttribute("data-adapter-status") as AdapterInventoryRow["status"],
        family: row.getAttribute("data-renderer-family") as AdapterInventoryRow["family"],
      })))

    expect(enabledRegistryEntries).toHaveLength(EXPECTED_ENABLED_BACKGROUND_COUNT)
    expect(inventory).toHaveLength(enabledRegistryEntries.length)
    expect(inventory.map(({ id }) => id).sort()).toEqual(
      enabledRegistryEntries.map(({ id }) => id).sort(),
    )
    let executedCaseCount = 0

    for (const [index, row] of inventory.entries()) {
      await test.step(`${index + 1}/${inventory.length} ${row.id}`, async () => {
        if (index > 0 && index % 12 === 0) {
          await openPaletteGallery(page)
        }
        const registryAdapter = backgroundPaletteRegistry[row.id]
        expect(row.status, `${row.id}:status`).toBe(registryAdapter.status)
        expect(row.family, `${row.id}:family`).toBe(registryAdapter.rendererFamily)
        await selectBackground(page, row.id)
        for (const mode of MODES) {
          await expectLoadedPaletteMode(page, row.id, row.status, mode)
          executedCaseCount += 1
        }
      })
    }

    expect(executedCaseCount).toBe(EXPECTED_ENABLED_BACKGROUND_COUNT * MODES.length)
    expect(health.pageErrors).toEqual([])
    expect(health.consoleErrors).toEqual([])
  })

  test("mounts truthful CSS/DOM, Canvas, and WebGL representatives", async ({ page }) => {
    await openPaletteGallery(page)
    for (const family of ["css-dom", "canvas", "webgl"] as const) {
      const representative = page.getByTestId(`background-palette-${family}-representative`)
      await expect(representative).toHaveAttribute("data-background-diagnostic-family", family)
      await expect(representative).toHaveAttribute("data-background-diagnostic-status", "loaded")
      await expect(representative).toHaveAttribute("data-background-effect-mounted", "true")
    }
    await expect(page.getByTestId("background-palette-live-host")).toHaveCount(1)
  })

  test("reports Canvas-backed Dotted Glow truthfully in every palette mode", async ({ page }) => {
    await openPaletteGallery(page)
    const dottedGlowRow = page.locator(
      '[data-palette-adapter-row][data-background-id="massage-lab-dotted-glow"]',
    )
    await expect(dottedGlowRow).toHaveAttribute("data-renderer-family", "canvas")
    await selectBackground(page, "massage-lab-dotted-glow")
    for (const mode of MODES) {
      await expectLoadedPaletteMode(page, "massage-lab-dotted-glow", "unsupported", mode)
    }
  })

  test("preserves swatches, changes real labels, and isolates selected mappings", async ({ page }) => {
    await openPaletteGallery(page)
    await page.getByLabel("Live palette mode").selectOption("custom")
    const live = page.locator("[data-background-palette-live-selector]")
    const originalSwatches = await live.getAttribute("data-shared-swatches")
    const originalLabels = await page.locator("[data-live-palette-controls]")
      .getByLabel(/color mapping$/).evaluateAll((selects) => (
        selects.map((select) => select.getAttribute("aria-label"))
      ))

    await selectBackground(page, "massage-lab-retro-grid")
    const retroLabels = await page.locator("[data-live-palette-controls]")
      .getByLabel(/color mapping$/).evaluateAll((selects) => (
        selects.map((select) => select.getAttribute("aria-label"))
      ))
    expect(retroLabels).not.toEqual(originalLabels)
    expect(retroLabels).toEqual([
      "Background color mapping",
      "Light grid lines color mapping",
      "Dark grid lines color mapping",
    ])
    await expect(live).toHaveAttribute("data-shared-swatches", originalSwatches ?? "")

    const retroMappingControl = page.locator("[data-live-palette-controls]")
      .getByLabel("Background color mapping")
    await retroMappingControl.selectOption("6")
    const changedRetroMapping = await live.getAttribute("data-active-mapping")

    await selectBackground(page, "massage-lab-aerial-rays")
    expect(await live.getAttribute("data-active-mapping")).not.toBe(changedRetroMapping)
    await selectBackground(page, "massage-lab-retro-grid")
    await expect(live).toHaveAttribute("data-active-mapping", changedRetroMapping ?? "")

    await expectLoadedPaletteMode(page, "massage-lab-retro-grid", "supported", "source")
    const sourceTargets = parseRecord(
      await live.getByTestId("background-palette-live-host")
        .getAttribute("data-background-diagnostic-targets"),
      "retro source targets",
    )
    const adapter = backgroundPaletteRegistry["massage-lab-retro-grid"]
    if (adapter.status === "unsupported") {
      throw new Error("Retro Grid must remain a supported palette adapter.")
    }
    for (const role of adapter.roles) {
      expectTargetColor(sourceTargets[role.rendererTarget], role.sourceColor, role.rendererTarget)
    }
  })

  test("proves special controls and unsupported no-op through Host diagnostics", async ({ page }) => {
    await openPaletteGallery(page)
    const host = page.getByTestId("background-palette-live-host")

    await selectBackground(page, "massage-lab-ripple-grid")
    await expectLoadedPaletteMode(page, "massage-lab-ripple-grid", "supported", "source")
    expect(parseRecord(
      await host.getAttribute("data-background-diagnostic-targets"),
      "ripple source",
    )["massageLabRippleGrid.enableRainbow"]).toBe(true)
    await expectLoadedPaletteMode(page, "massage-lab-ripple-grid", "supported", "custom")
    expect(parseRecord(
      await host.getAttribute("data-background-diagnostic-targets"),
      "ripple custom",
    )["massageLabRippleGrid.enableRainbow"]).toBe(false)

    for (const [id, target] of [
      ["massage-lab-aurora-bars", "auroraBars.paletteMode"],
      ["massage-lab-tile-grid", "tileGrid.paletteMode"],
    ] as const) {
      await selectBackground(page, id)
      await expectLoadedPaletteMode(page, id, "supported", "source")
      expect(parseRecord(await host.getAttribute("data-background-diagnostic-targets"), id)[target])
        .toBe("auto")
      await expectLoadedPaletteMode(page, id, "supported", "harmony")
      expect(parseRecord(await host.getAttribute("data-background-diagnostic-targets"), id)[target])
        .toBe("custom")
    }

    await selectBackground(page, "massage-lab-gradient-animation")
    await expectLoadedPaletteMode(page, "massage-lab-gradient-animation", "supported", "custom")
    const gradientAdapter = backgroundPaletteRegistry["massage-lab-gradient-animation"]
    if (gradientAdapter.status === "unsupported") {
      throw new Error("Gradient Animation must remain a supported palette adapter.")
    }
    const gradientTargets = parseRecord(
      await host.getAttribute("data-background-diagnostic-targets"),
      "gradient targets",
    )
    expect(gradientAdapter.roles).toHaveLength(7)
    expect(gradientAdapter.roles.map((role) => gradientTargets[role.rendererTarget])).toEqual(
      CUSTOM_SWATCHES,
    )

    await selectBackground(page, "massage-lab-aurora")
    for (const mode of MODES) {
      await expectLoadedPaletteMode(page, "massage-lab-aurora", "unsupported", mode)
    }
  })

  test("keeps the real Music Tone session alive during palette edits", async ({ page }) => {
    test.setTimeout(120_000)
    await openPaletteGallery(page)
    const continuity = page.locator("[data-background-palette-music-continuity]")
    await page.getByRole("button", { name: "Play MassageLab Proof Drone" }).click()
    await expect(continuity).toHaveAttribute("data-music-station-id", "mlab-proof-drone")
    await expect(continuity).toHaveAttribute("data-music-playback-state", "playing", {
      timeout: 30_000,
    })
    await expect(continuity).toHaveAttribute("data-music-audio-context-state", "running")
    const sessionId = await continuity.getAttribute("data-music-session-id")
    expect(sessionId).toMatch(/^\d+$/)
    const elapsedBefore = Number(await continuity.getAttribute("data-music-audio-elapsed"))

    await page.getByLabel("Live palette mode").selectOption("harmony")
    await page.locator("[data-live-palette-controls]").getByLabel(/color mapping$/).first()
      .selectOption("6")
    await expect(continuity).toHaveAttribute("data-music-session-id", sessionId ?? "")
    await expect(continuity).toHaveAttribute("data-music-playback-state", "playing")
    await expect.poll(async () => Number(await continuity.getAttribute("data-music-audio-elapsed")))
      .toBeGreaterThan(elapsedBefore)
  })

  test("keeps the actual Chimer timer identity and progress through a Visual draft edit", async ({ page }) => {
    test.setTimeout(120_000)
    await startActiveChimer(page)
    const timer = page.getByTestId("running-timer-clock")
    await expect(timer).toBeVisible()
    const timeBefore = (await timer.textContent())?.replace(/\s+/g, "")
    await page.evaluate(() => {
      Reflect.set(window, "__task9RunningTimer", document.querySelector(
        '[data-testid="running-timer-clock"]',
      ))
    })

    await page.getByRole("button", { name: "Visual", exact: true }).click()
    const visual = page.getByRole("dialog", { name: "Visual controls" })
    await visual.getByRole("radio", { name: "Custom", exact: true }).click()
    await visual.getByLabel(/color mapping$/).first().selectOption("6")

    expect(await page.evaluate(() => (
      Reflect.get(window, "__task9RunningTimer")
      === document.querySelector('[data-testid="running-timer-clock"]')
    ))).toBe(true)
    await expect.poll(async () => (
      (await timer.textContent())?.replace(/\s+/g, "")
    )).not.toBe(timeBefore)
  })

  test("loads a real static renderer in short landscape with reduced motion", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    await page.setViewportSize({ width: 844, height: 390 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openPaletteGallery(page)
    await selectBackground(page, "static-gradient")
    for (const mode of MODES) {
      await expectLoadedPaletteMode(page, "static-gradient", "unsupported", mode)
    }
    const host = page.getByTestId("background-palette-live-host")
    await expect(host).toHaveAttribute("data-background-diagnostic-reduced-motion", "true")
    await expect(host).toHaveAttribute("data-background-diagnostic-loaded-id", "static-gradient")
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
      .toBe(false)
    expect(health.pageErrors).toEqual([])
    expect(health.consoleErrors).toEqual([])
  })
})
