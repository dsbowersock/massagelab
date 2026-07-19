import { expect, test, type Page } from "@playwright/test"

const VISUAL_PANEL_OPENED_STORAGE_KEY = "massagelab.chimer.visual-panel-opened.v1"

async function openClock(page: Page) {
  await page.goto("/clock", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).toHaveClass(/chimer-running/)
}

async function selectNextAvailableBackground(page: Page) {
  const background = page.getByRole("dialog", { name: "Background" })
  const next = background.getByRole("button", { name: "Next background" })

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const select = background.getByRole("button", { name: /^Select .* background$/ })
    if (await select.count() > 0 && await select.isEnabled()) {
      await select.click()
      return
    }
    await next.click()
  }

  throw new Error("No available unselected background was reachable from the carousel")
}

test("Clock and Visual switch one active panel and honor dismissal focus", async ({ page }) => {
  await openClock(page)
  const clockControl = page.getByRole("button", { name: "Clock", exact: true })
  const visualControl = page.getByRole("button", { name: "Visual", exact: true })

  await clockControl.click()
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toBeVisible()
  await visualControl.click()
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
  await expect(page.getByRole("dialog", { name: "Visual controls" })).toBeVisible()

  await page.getByRole("button", { name: "Close Visual panel" }).click()
  await expect(page.getByRole("dialog", { name: "Visual controls" })).toHaveCount(0)
  await expect(visualControl).toBeFocused()

  await clockControl.click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
  await expect(clockControl).toBeFocused()

  await clockControl.click()
  await page.locator("[data-protected-display]").click({ position: { x: 2, y: 2 } })
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
})

test("Escape in a portaled color picker closes only the picker", async ({ page }) => {
  await openClock(page)
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visual = page.getByRole("dialog", { name: "Visual controls" })
  const primaryPickerButton = visual.getByRole("button", { name: "Primary color picker" })

  await primaryPickerButton.click()
  const picker = page.getByRole("dialog", { name: "Primary color picker" })
  await expect(picker).toBeVisible()
  await picker.getByRole("slider", { name: "Primary color saturation and brightness" }).focus()
  await page.keyboard.press("Escape")

  await expect(picker).toHaveCount(0)
  await expect(visual).toBeVisible()
})

test("Background is modal, restores focus, and uses outside dismissal only when visible", async ({ page }) => {
  await openClock(page)
  const backgroundControl = page.getByRole("button", { name: "Background", exact: true })
  await backgroundControl.click()
  const background = page.getByRole("dialog", { name: "Background" })
  await expect(background).toBeVisible()

  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => {
      const panel = document.querySelector('[data-immersive-panel="background"]')
      return Boolean(panel && document.activeElement && panel.contains(document.activeElement))
    })).toBe(true)
  }

  const box = await background.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (box && viewport && (box.x > 0 || box.y > 0 || box.x + box.width < viewport.width || box.y + box.height < viewport.height)) {
    await page.mouse.click(1, 1)
    await expect(background).toHaveCount(0)
  } else {
    expect(box?.x).toBe(0)
    expect(box?.y).toBe(0)
    expect(box?.width).toBe(viewport?.width)
    expect(box?.height).toBe(viewport?.height)
    await page.keyboard.press("Escape")
    await expect(background).toHaveCount(0)
  }
  await expect(backgroundControl).toBeFocused()

  await backgroundControl.click()
  await page.getByRole("button", { name: "Close Background panel" }).click()
  await expect(background).toHaveCount(0)
  await expect(backgroundControl).toBeFocused()
})

test("an available Background selection closes immediately and gives the first Visual hint", async ({ page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)

  await expect(page.getByRole("dialog", { name: "Background" })).toHaveCount(0)
  const hint = page.getByRole("status", { name: "Customize this background in Visual." })
  await expect(hint).toBeVisible()
  const visualControl = page.getByRole("button", { name: "Visual", exact: true })
  await expect(visualControl).toHaveAttribute("aria-describedby", await hint.getAttribute("id") ?? "")
  await expect(page.locator("[data-protected-display]")).toBeVisible()
})

test("opening Visual records seen and suppresses later background hints", async ({ page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  const visualControl = page.getByRole("button", { name: "Visual", exact: true })
  await visualControl.click()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)).toBe("1")
  await page.getByRole("button", { name: "Close Visual panel" }).click()

  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)
})

test("pre-seen hydration suppresses the Visual hint", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)
})

test("storage denial falls back to in-memory Visual visit state", async ({ page }) => {
  await page.addInitScript((key) => {
    const originalGetItem = Storage.prototype.getItem
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.getItem = function getItem(storageKey) {
      if (storageKey === key) throw new DOMException("denied", "SecurityError")
      return originalGetItem.call(this, storageKey)
    }
    Storage.prototype.setItem = function setItem(storageKey, value) {
      if (storageKey === key) throw new DOMException("denied", "SecurityError")
      return originalSetItem.call(this, storageKey, value)
    }
  }, VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toBeVisible()

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  await page.getByRole("button", { name: "Close Visual panel" }).click()
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)
})

test("short viewport docks remain bounded and avoid the protected display", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openClock(page)

  for (const panelName of ["Clock", "Visual"] as const) {
    await page.getByRole("button", { name: panelName, exact: true }).click()
    const dock = page.locator("[data-immersive-dock]")
    await expect(dock).toBeVisible()
    await expect.poll(async () => {
      const [displayBox, dockBox] = await Promise.all([
        page.locator("[data-protected-display]").boundingBox(),
        dock.boundingBox(),
      ])
      if (!displayBox || !dockBox) return false
      const intersects = !(
        dockBox.x + dockBox.width <= displayBox.x
        || displayBox.x + displayBox.width <= dockBox.x
        || dockBox.y + dockBox.height <= displayBox.y
        || displayBox.y + displayBox.height <= dockBox.y
      )
      return !intersects
        && dockBox.x >= 0
        && dockBox.y >= 0
        && dockBox.x + dockBox.width <= 844
        && dockBox.y + dockBox.height <= 390
    }).toBe(true)
    await page.getByRole("button", { name: `Close ${panelName} panel` }).click()
  }
})
