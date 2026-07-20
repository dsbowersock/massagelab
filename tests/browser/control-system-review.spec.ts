import { expect, test } from "@playwright/test"

test.describe("control-system review lab", () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto("/dev/buttons")
    test.skip(response?.status() === 404, "The control-system review lab is development-only.")
    await expect(page.getByRole("heading", { name: "Control system review", level: 1 })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await expect(page.locator('[data-review-lab-ready="true"]')).toBeAttached()
  })

  test("all review families are reachable and interactive", async ({ page }) => {
    const sections = [
      { tab: "Buttons", heading: "Buttons" },
      { tab: "Choices", heading: "Segmented controls, tabs, and pill choices" },
      { tab: "Fields & color", heading: "Text inputs and textareas" },
      { tab: "Cards & status", heading: "Selectable cards and control cards" },
      { tab: "Navigation & surfaces", heading: "Navigation controls" },
      { tab: "Protected routes", heading: "Protected route proofs" },
    ]

    for (const section of sections) {
      await page.getByRole("tab", { name: section.tab }).click()
      await expect(page.getByRole("heading", { name: section.heading })).toBeVisible()
    }

    await expect(page.getByText("Chimer duration entry", { exact: true })).toBeVisible()
    await expect(page.getByLabel("1 hours 30 minutes")).toBeVisible()
    await page.getByRole("button", { name: "Increase minutes" }).click()
    await expect(page.getByLabel("1 hours 31 minutes")).toBeVisible()
    await page.waitForTimeout(350)
    await page.getByRole("button", { name: "Increase minutes" }).dblclick()
    await expect(page.getByLabel("1 hours 36 minutes")).toBeVisible()

    await page.getByRole("tab", { name: "Cards & status" }).click()
    const upperBackControls = page.getByRole("button", { name: "Left upper back" })
    await expect(upperBackControls).toHaveCount(2)
    await upperBackControls.last().click()
    await expect(upperBackControls.last()).toHaveAttribute("aria-pressed", "false")
  })

  test("phone layout keeps the review tabs navigable without page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole("tab", { name: "Fields & color" }).click()
    await expect(page.getByRole("heading", { name: "Text inputs and textareas" })).toBeVisible()

    await page.getByRole("tab", { name: "Protected routes" }).click()
    await expect(page.getByRole("heading", { name: "Protected route proofs" })).toBeVisible()

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(pageOverflows).toBe(false)
  })

  test("Carousel Lab exposes six real combinations with center-before-action", async ({ page }, testInfo) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await expect(page.getByTestId("carousel-lab")).toBeVisible()

    for (const surface of ["Backgrounds", "Music Stations"]) {
      await page.getByRole("radio", { name: surface, exact: true }).click()
      for (const presentation of ["Existing", "Cover Flow", "3D Carousel"]) {
        await page.getByRole("radio", { name: presentation, exact: true }).click()
        await expect(page.getByTestId("carousel-lab-stage")).toHaveCount(1)
        await expect(page.getByTestId("carousel-lab-summary")).toContainText(surface)
        await expect(page.getByTestId("carousel-lab-summary")).toContainText(presentation)

        const pairSlides = page.locator('[data-carousel-slide="true"]')
        expect(await pairSlides.count()).toBeGreaterThan(0)
        const centeredFullCard = page.locator(
          '[data-carousel-slide="true"][data-centered="true"][data-detail-level="full"]',
        )
        await expect(centeredFullCard).toHaveCount(1)
        if (surface === "Backgrounds") {
          await expect(
            centeredFullCard.getByRole("button", { name: /^Select/ }),
          ).toBeVisible()
        } else {
          await expect(
            centeredFullCard
              .getByRole("button", {
                name: /^(?:Play|Restart|Stop|Favorite|Remove )/,
              })
              .first(),
          ).toBeVisible()
        }
      }
    }

    await page.getByRole("radio", { name: "Backgrounds", exact: true }).click()
    await page.getByRole("radio", { name: "Existing", exact: true }).click()
    const slides = page.locator('[data-carousel-slide="true"]')
    expect(await slides.count()).toBeGreaterThan(2)
    const originalSelected = await page
      .locator('[data-background-selected="true"]')
      .getAttribute("data-background-id")
    if (testInfo.project.name === "mobile-chromium") {
      await page.getByRole("button", { name: "Next carousel item" }).click()
    } else {
      await slides.nth(1).click()
    }
    await expect(slides.nth(1)).toHaveAttribute("data-centered", "true")
    expect(
      await page
        .locator('[data-background-selected="true"]')
        .getAttribute("data-background-id"),
    ).toBe(originalSelected)
  })

  test("Carousel Lab persists and resets tuning while access actions stay mutation-free", async ({ page }) => {
    const mutationRequests: string[] = []
    page.on("request", (request) => {
      const requestOrigin = new URL(request.url()).origin
      const pageOrigin = new URL(page.url()).origin
      if (
        requestOrigin === pageOrigin
        && request.method() !== "GET"
        && request.method() !== "HEAD"
      ) {
        mutationRequests.push(request.url())
      }
    })

    await page.getByRole("tab", { name: "Carousels" }).click()
    const width = page.getByTestId("carousel-tuning-cardWidth")
    await width.evaluate((input) => {
      const range = input as HTMLInputElement
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set
      nativeValueSetter?.call(range, "248")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("248px")

    await page.getByRole("radio", { name: "Cover Flow", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("208px")
    await width.evaluate((input) => {
      const range = input as HTMLInputElement
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set
      nativeValueSetter?.call(range, "232")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("232px")

    await page.getByRole("radio", { name: "Existing", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("248px")
    await page.reload()
    await page.getByRole("tab", { name: "Carousels" }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("248px")
    await page.getByRole("button", { name: "Reset current pair" }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("208px")
    await page.getByRole("radio", { name: "Cover Flow", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("232px")

    await page.getByRole("combobox", { name: "Access state fixture" }).click()
    await page.getByRole("option", { name: "Locked", exact: true }).click()
    await page
      .locator('[data-centered="true"]')
      .getByRole("button", { name: /^Select/ })
      .click()
    await expect(page.getByRole("button", { name: "Use free credit" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Buy for $1" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Unlock all" })).toBeVisible()
    await page.getByRole("button", { name: "Buy for $1" }).click()
    await expect(page.getByText("Dev preview: Buy for $1")).toBeVisible()
    expect(mutationRequests).toEqual([])

    expect(
      await page.locator('video[data-testid="carousel-background-video"]').count(),
    ).toBeLessThanOrEqual(1)
    await page
      .getByLabel("Background visual filter")
      .getByRole("radio", { name: "Video" })
      .click()
    expect(
      await page.locator('video[data-testid="carousel-background-video"]').count(),
    ).toBeLessThanOrEqual(1)
  })

  test("Carousel Lab restores a non-first station position across categories", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()

    const slides = page.locator('[data-carousel-slide="true"]')
    await expect(slides.nth(1)).toBeAttached()
    const restoredLabel = await slides.nth(1).getAttribute("aria-label")
    expect(restoredLabel).toBeTruthy()
    await slides.nth(1).click()
    await expect(slides.nth(1)).toHaveAttribute("data-centered", "true")

    const category = page.getByRole("combobox", { name: "Station category" })
    await category.click()
    await page.getByRole("option", { name: "Piano, bells, and mallets" }).click()
    await category.click()
    await page.getByRole("option", { name: "Treatment room starters" }).click()

    await expect(
      page.locator('[data-carousel-slide="true"][data-centered="true"]'),
    ).toHaveAttribute("aria-label", restoredLabel ?? "")
  })

  test("Carousel Lab supports keyboard, reduced motion, cleanup, and phone width", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })

    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("tab", { name: "Carousels" }).click()

    for (const presentation of ["Existing", "Cover Flow", "3D Carousel"]) {
      await page.getByRole("radio", { name: presentation, exact: true }).click()
      await expect(page.getByTestId("carousel-lab-summary")).toContainText(presentation)
    }
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Reduced-motion rail")

    const stage = page.getByTestId("carousel-lab-stage")
    await stage.focus()
    await stage.press("End")
    await expect(page.locator('[data-carousel-slide="true"]').last()).toHaveAttribute(
      "data-centered",
      "true",
    )
    await stage.press("Home")
    await expect(page.locator('[data-carousel-slide="true"]').first()).toHaveAttribute(
      "data-centered",
      "true",
    )
    await stage.press("Tab")
    await expect(page.locator('[data-carousel-slide="true"]:focus-within')).toHaveAttribute(
      "data-centered",
      "true",
    )

    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()
    await expect(page.locator('video[data-testid="carousel-background-video"]')).toHaveCount(0)
    const pageOverflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(pageOverflows).toBe(false)
    expect(consoleErrors).toEqual([])
  })
})
