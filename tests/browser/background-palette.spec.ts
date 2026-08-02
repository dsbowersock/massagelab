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
import { TRACK_4B_CUSTOM_SWATCHES as CUSTOM_SWATCHES } from "../../app/dev/buttons/background-palette-review-fixtures"
import { normalizeBrowserColor } from "../helpers/browser-color"

type AdapterInventoryRow = {
  id: string
  status: "supported" | "unsupported"
  family: "css-dom" | "canvas" | "webgl"
}

type PreviewMediaProbeSnapshot = {
  playCalls: number
  pauseCalls: number
  visibilityListenerCount: number
}

const MODES = ["source", "custom", "harmony"] as const
const EXPECTED_ENABLED_BACKGROUND_COUNT = 83
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

/** Parses six-digit hex or hsl() input and returns a hue normalized to 0-359 degrees. */
function colorHue(value: string) {
  if (value.startsWith("#")) return hexHue(value)
  const hsl = /^hsl\(\s*([+-]?\d+(?:\.\d+)?)/i.exec(value)
  if (!hsl) throw new Error(`Cannot derive a hue from ${value}.`)
  return ((Number(hsl[1]) % 360) + 360) % 360
}

/**
 * Compares hue numbers, general CSS colors, rgba channels, or exact strings.
 * The rgba-channel branch is reached only when the expected color is six-digit hex.
 */
async function expectTargetColor(
  page: Page,
  actual: unknown,
  expectedColor: string,
  target: string,
) {
  if (typeof actual === "number") {
    expect(actual, target).toBe(colorHue(expectedColor))
    return
  }
  if (!/^#[\da-f]{6}$/i.test(expectedColor) && typeof actual === "string") {
    const [resolvedTargetColor, declaredColor] = await Promise.all([
      normalizeBrowserColor(page, actual),
      normalizeBrowserColor(page, expectedColor),
    ])
    expect(resolvedTargetColor, target).toBe(declaredColor)
    return
  }
  if (typeof actual === "string" && /^rgba?\(/.test(actual)) {
    const expectedRgb = [
      Number.parseInt(expectedColor.slice(1, 3), 16),
      Number.parseInt(expectedColor.slice(3, 5), 16),
      Number.parseInt(expectedColor.slice(5, 7), 16),
    ]
    const actualRgb = actual.match(/[\d.]+/g)?.slice(0, 3).map(Number)
    expect(actualRgb, target).toEqual(expectedRgb)
    return
  }
  expect(actual, target).toBe(expectedColor)
}

/** Reads the addInitScript-installed __previewMediaProbe global as a stable snapshot. */
async function readPreviewMediaProbe(page: Page): Promise<PreviewMediaProbeSnapshot> {
  return page.evaluate(() => {
    const rawProbe = Reflect.get(window, "__previewMediaProbe")
    if (
      !rawProbe
      || typeof rawProbe.playCalls !== "number"
      || typeof rawProbe.pauseCalls !== "number"
      || !(rawProbe.visibilityListeners instanceof Set)
    ) {
      throw new Error("Preview media probe was not initialized.")
    }
    return {
      playCalls: rawProbe.playCalls,
      pauseCalls: rawProbe.pauseCalls,
      visibilityListenerCount: rawProbe.visibilityListeners.size,
    }
  })
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
    const expectedTargetColor = mode === "source" && role.sourceColorFormat === "css"
      ? role.sourceColor
      : expectedRoleColors[role.id]
    await expectTargetColor(
      page,
      actualTargets[role.rendererTarget],
      expectedTargetColor,
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
        accessAuthoritative: true,
        features: ["premium_backgrounds", "chimer_custom_colors"],
        ownedBackgroundIds: [],
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
  const increaseMinutesButton = page.getByRole("button", { name: /^Increase minutes$/i })
  await expect(increaseMinutesButton).toBeEnabled()
  await increaseMinutesButton.click()
  for (let step = 0; step < 4; step += 1) {
    const continueButton = page.getByRole("button", { name: /^Continue$/i })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
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

  test("animates the selected real effect for development review even with ambient reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openPaletteGallery(page)
    await selectBackground(page, "massage-lab-dna")
    await expectLoadedPaletteMode(page, "massage-lab-dna", "supported", "custom")

    const host = page.getByTestId("background-palette-live-host")
    await expect(host).toHaveAttribute("data-background-diagnostic-reduced-motion", "false")
    await expect(host).toHaveAttribute("data-background-review-motion-forced", "true")
    await expect(host).toHaveAttribute("data-background-fallback-only", "false")

    const effectLayer = host.locator('[style*="--ml-dna-background-color"]')
    await expect(effectLayer).toBeVisible()
    const effectBounds = await effectLayer.boundingBox()
    expect(effectBounds?.width).toBeGreaterThan(0)
    expect(effectBounds?.height).toBeGreaterThan(0)
    expect(await effectLayer.evaluate((element) => {
      const root = element as HTMLElement
      const composition = root.firstElementChild?.firstElementChild
      if (!(composition instanceof HTMLElement)) {
        throw new Error("The DNA review composition element is missing.")
      }
      return {
        background: root.style.getPropertyValue("--ml-dna-background-color"),
        nodeOne: root.style.getPropertyValue("--ml-dna-node-color-0"),
        animation: getComputedStyle(composition).animationName,
      }
    })).toEqual({
      background: CUSTOM_SWATCHES[3],
      nodeOne: CUSTOM_SWATCHES[0],
      animation: expect.stringContaining("mlDnaStrandRotate"),
    })
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
      await expectTargetColor(page, sourceTargets[role.rendererTarget], role.sourceColor, role.rendererTarget)
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
    await expect(host).toHaveAttribute("data-background-diagnostic-reduced-motion", "false")
    await expect(host).toHaveAttribute("data-background-diagnostic-loaded-id", "static-gradient")
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
      .toBe(false)
    expect(health.pageErrors).toEqual([])
    expect(health.consoleErrors).toEqual([])
  })

  test("preview media uses posters, playback, fallbacks, and listener cleanup", async ({ page }) => {
    // Patch playback and visibility-listener prototypes for this test. The post-mount
    // baseline isolates the carousel listener; __restorePreviewMediaProbe restores both.
    await page.addInitScript(() => {
      type PreviewMediaProbe = {
        playCalls: number
        pauseCalls: number
        rejectPlayAs: "AbortError" | "NotAllowedError" | null
        visibilityListeners: Set<EventListenerOrEventListenerObject>
      }
      const probe: PreviewMediaProbe = {
        playCalls: 0,
        pauseCalls: 0,
        rejectPlayAs: null,
        visibilityListeners: new Set(),
      }
      Reflect.set(window, "__previewMediaProbe", probe)

      const playOriginal = HTMLMediaElement.prototype.play
      const pauseOriginal = HTMLMediaElement.prototype.pause
      HTMLMediaElement.prototype.play = function play() {
        if (this.dataset.testid === "carousel-background-video") {
          probe.playCalls += 1
          if (probe.rejectPlayAs) {
            return Promise.reject(new DOMException("Preview playback rejected", probe.rejectPlayAs))
          }
          return Promise.resolve()
        }
        return playOriginal.call(this)
      }
      HTMLMediaElement.prototype.pause = function pause() {
        if (this.dataset.testid === "carousel-background-video") probe.pauseCalls += 1
        return pauseOriginal.call(this)
      }

      const addEventListener = Document.prototype.addEventListener as (
        this: Document,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) => void
      const removeEventListener = Document.prototype.removeEventListener as (
        this: Document,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
      ) => void
      Document.prototype.addEventListener = function add(
        this: Document,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (type === "visibilitychange") probe.visibilityListeners.add(listener)
        return addEventListener.call(this, type, listener, options)
      } as Document["addEventListener"]
      Document.prototype.removeEventListener = function remove(
        this: Document,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
      ) {
        if (type === "visibilitychange") probe.visibilityListeners.delete(listener)
        return removeEventListener.call(this, type, listener, options)
      } as Document["removeEventListener"]
      Reflect.set(window, "__restorePreviewMediaProbe", () => {
        HTMLMediaElement.prototype.play = playOriginal
        HTMLMediaElement.prototype.pause = pauseOriginal
        Document.prototype.addEventListener = addEventListener
        Document.prototype.removeEventListener = removeEventListener
      })
    })

    try {
      await openPaletteGallery(page)
      const fixture = page.getByTestId("background-preview-media-review")
      const video = fixture.getByTestId("carousel-background-video")
      const poster = fixture.getByTestId("background-preview-poster")
      const fallback = fixture.getByTestId("background-preview-fallback")
      await expect(fixture).toBeVisible()
      await expect(poster).toBeVisible()
      await expect(video).toHaveCount(0)
      const baselineListeners = (await readPreviewMediaProbe(page)).visibilityListenerCount

      await fixture.getByRole("button", { name: "Activate preview" }).click()
      await expect(video).toBeVisible()
      await expect(video).toHaveAttribute("poster", /massage-lab-dna-vertical\.webp$/)
      await expect.poll(async () => (await readPreviewMediaProbe(page)).playCalls).toBeGreaterThan(0)
      await expect.poll(async () => (
        await readPreviewMediaProbe(page)
      ).visibilityListenerCount).toBe(baselineListeners + 1)

      const playsBeforeSourceSwap = (await readPreviewMediaProbe(page)).playCalls
      await fixture.getByRole("button", { name: "Swap preview source" }).click()
      await expect(video).toHaveAttribute("src", /massage-lab-twisted-cubes-vertical\.webm$/)
      await expect(video).toHaveAttribute("poster", /massage-lab-twisted-cubes-vertical\.webp$/)
      await expect.poll(async () => (await readPreviewMediaProbe(page)).playCalls)
        .toBeGreaterThan(playsBeforeSourceSwap)

      const pausesBeforeHidden = (await readPreviewMediaProbe(page)).pauseCalls
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
        document.dispatchEvent(new Event("visibilitychange"))
      })
      await expect.poll(async () => (await readPreviewMediaProbe(page)).pauseCalls)
        .toBeGreaterThan(pausesBeforeHidden)
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
        document.dispatchEvent(new Event("visibilitychange"))
      })

      await video.dispatchEvent("error")
      await expect(video).toHaveCount(0)
      await expect(poster).toBeVisible()
      await expect.poll(async () => (
        await readPreviewMediaProbe(page)
      ).visibilityListenerCount).toBe(baselineListeners)

      await poster.dispatchEvent("error")
      await expect(poster).toHaveCount(0)
      await expect(fallback).toHaveCSS("background-color", "rgb(18, 52, 86)")

      await fixture.getByRole("button", { name: "Unmount preview" }).click()
      await fixture.getByRole("button", { name: "Mount preview" }).click()
      await expect(video).toBeVisible()
      await expect.poll(async () => (
        await readPreviewMediaProbe(page)
      ).visibilityListenerCount).toBe(baselineListeners + 1)
      await fixture.getByRole("button", { name: "Unmount preview" }).click()
      await expect(video).toHaveCount(0)
      await expect.poll(async () => (
        await readPreviewMediaProbe(page)
      ).visibilityListenerCount).toBe(baselineListeners)

      await page.evaluate(() => {
        Reflect.get(window, "__previewMediaProbe").rejectPlayAs = "AbortError"
      })
      await fixture.getByRole("button", { name: "Mount preview" }).click()
      await expect(video).toBeVisible()
      await fixture.getByRole("button", { name: "Unmount preview" }).click()

      await page.evaluate(() => {
        Reflect.get(window, "__previewMediaProbe").rejectPlayAs = "NotAllowedError"
      })
      await fixture.getByRole("button", { name: "Mount preview" }).click()
      await expect(video).toHaveCount(0)
      await expect(poster).toBeVisible()
      await expect.poll(async () => (
        await readPreviewMediaProbe(page)
      ).visibilityListenerCount).toBe(baselineListeners)
      await fixture.getByRole("button", { name: "Unmount preview" }).click()
    } finally {
      await page.evaluate(() => {
        const restore = Reflect.get(window, "__restorePreviewMediaProbe")
        if (typeof restore === "function") restore()
      })
    }
  })
})
