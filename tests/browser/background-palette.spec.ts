import { expect, test, type Page } from "@playwright/test"

type AdapterInventoryRow = {
  id: string
  status: "supported" | "unsupported"
}

const MODES = ["source", "custom", "harmony"] as const

async function openPaletteGallery(page: Page) {
  const response = await page.goto("/dev/buttons")
  test.skip(response?.status() === 404, "The control-system review lab is development-only.")
  await expect(page.locator('[data-review-lab-ready="true"]')).toBeAttached()
  await page.getByRole("tab", { name: "Background palettes" }).click()
  await expect(page.getByRole("heading", { name: "Background palette review" })).toBeVisible()
}

test.describe("shared background palette review matrix", () => {
  test("sweeps every enabled background through Source, Custom, and Harmony", async ({ page }) => {
    test.setTimeout(600_000)
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })
    page.on("pageerror", (error) => pageErrors.push(error.message))

    await openPaletteGallery(page)
    const inventory = await page
      .locator("[data-palette-adapter-row]")
      .evaluateAll((rows) => rows.map((row) => ({
        id: row.getAttribute("data-background-id") ?? "",
        status: row.getAttribute("data-adapter-status") as AdapterInventoryRow["status"],
      })))
    expect(inventory.length).toBeGreaterThan(0)
    const requestedStart = Number.parseInt(process.env.PALETTE_SWEEP_START_INDEX ?? "0", 10)
    const startIndex = Number.isInteger(requestedStart) && requestedStart > 0 ? requestedStart : 0

    for (const [index, { id, status }] of inventory.entries()) {
      if (index < startIndex) continue
      await test.step(`${index + 1}/${inventory.length} ${id}`, async () => {
        if (index > 0 && index % 12 === 0) {
          await openPaletteGallery(page)
        }
        await page.getByLabel("Live background").selectOption(id)
        const live = page.locator("[data-background-palette-live-selector]")
        for (const mode of MODES) {
          await page.getByLabel("Live palette mode").selectOption(mode)
          await expect(live).toHaveAttribute("data-background-id", id)
          await expect(live).toHaveAttribute("data-adapter-status", status)
          await expect(live).toHaveAttribute("data-palette-mode", mode)
          await expect(live).not.toHaveAttribute("data-unexpected-fallback", "true")
          await expect(live).toHaveAttribute("data-resolved-role-colors", /^(?:\{\}|\{.+\})$/)
        }
        if (status === "supported") {
          const host = live.locator('[data-testid="background-palette-live-host"]')
          await expect(host).toHaveAttribute("data-background-id", id)
          await expect(host).toHaveAttribute("data-background-effect-mounted", "true")
          await expect(host).toHaveAttribute("data-background-fallback-only", "false")
          await expect(live).toHaveAttribute("data-render-result", "mounted")
        } else {
          await expect(live).toHaveAttribute("data-render-result", "intentional-unsupported")
          await expect(live).toHaveAttribute("data-unsupported-untinted", "true")
        }
      })
    }

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test("preserves the shared palette while labels and selected mapping change", async ({ page }) => {
    await openPaletteGallery(page)
    await page.getByLabel("Live palette mode").selectOption("custom")
    const live = page.locator("[data-background-palette-live-selector]")
    const originalSwatches = await live.getAttribute("data-shared-swatches")
    const firstId = await live.getAttribute("data-background-id")
    await page.getByLabel("Live background").selectOption("massage-lab-retro-grid")
    await expect(live).toHaveAttribute("data-shared-swatches", originalSwatches ?? "")
    await expect(live).not.toHaveAttribute("data-background-id", firstId ?? "")

    const mapping = page.locator("[data-live-palette-controls]").getByLabel(/color mapping$/).first()
    const beforeMapping = await live.getAttribute("data-active-mapping")
    await mapping.selectOption("6")
    await expect(live).not.toHaveAttribute("data-active-mapping", beforeMapping ?? "")
    await expect(live).toHaveAttribute("data-shared-swatches", originalSwatches ?? "")

    await page.getByLabel("Live palette mode").selectOption("source")
    await expect(live).toHaveAttribute("data-palette-mode", "source")
    await expect(live).toHaveAttribute("data-source-restored", "true")
  })

  test("proves special Source behavior, seven-role gradient, unsupported media, and continuity", async ({ page }) => {
    await openPaletteGallery(page)
    const live = page.locator("[data-background-palette-live-selector]")

    for (const [id, behavior] of [
      ["massage-lab-ripple-grid", "rainbow"],
      ["massage-lab-aurora-bars", "automatic"],
      ["massage-lab-tile-grid", "automatic"],
    ] as const) {
      await page.getByLabel("Live background").selectOption(id)
      await page.getByLabel("Live palette mode").selectOption("source")
      await expect(live).toHaveAttribute("data-source-behavior", behavior)
      await expect(live).toHaveAttribute("data-source-restored", "true")
    }

    await page.getByLabel("Live background").selectOption("massage-lab-gradient-animation")
    await page.getByLabel("Live palette mode").selectOption("custom")
    await expect(live).toHaveAttribute("data-role-count", "7")

    await page.getByLabel("Live background").selectOption("massage-lab-aurora")
    await expect(live).toHaveAttribute("data-render-result", "intentional-unsupported")
    await expect(live).toHaveAttribute("data-unsupported-untinted", "true")

    const continuity = page.locator("[data-background-palette-continuity]")
    const timerBefore = Number(await continuity.getAttribute("data-timer-continuity"))
    await page.getByRole("button", { name: "Start audio continuity probe" }).click()
    await expect(continuity).toHaveAttribute("data-audio-continuity", "playing")
    const audioBefore = Number(await continuity.getAttribute("data-audio-continuity-time"))
    await page.getByLabel("Live palette mode").selectOption("harmony")
    await expect.poll(async () => Number(await continuity.getAttribute("data-timer-continuity"))).toBeGreaterThan(timerBefore)
    await expect(continuity).toHaveAttribute("data-audio-continuity", "playing")
    await expect.poll(async () => Number(await continuity.getAttribute("data-audio-continuity-time")))
      .toBeGreaterThan(audioBefore)
  })

  test("keeps the review usable in short landscape with reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openPaletteGallery(page)
    await expect(page.locator("[data-background-palette-live-selector]")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
})
