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

  test("Carousel Lab exposes the two selected combinations with center-before-action", async ({ page }, testInfo) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await expect(page.getByTestId("carousel-lab")).toBeVisible()

    for (const surface of ["Backgrounds", "Music Stations"]) {
      await page.getByRole("radio", { name: surface, exact: true }).click()
      const presentations = surface === "Music Stations"
        ? ["Background Picker"]
        : ["Existing"]
      for (const presentation of presentations) {
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
      await page.getByRole("button", { name: "Next background" }).click()
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

  test("Carousel Lab persists and resets tuning while access actions stay mutation-free", async ({ page }, testInfo) => {
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
    await page.getByRole("switch", { name: "Responsive sizing" }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Screen fit: Manual")
    const width = page.getByTestId("carousel-tuning-cardWidth")
    const height = page.getByTestId("carousel-tuning-cardHeight")
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
    await height.evaluate((input) => {
      const range = input as HTMLInputElement
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set
      nativeValueSetter?.call(range, "420")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Height: 420px")
    await expect.poll(() => page
      .locator('[data-carousel-slide="true"][data-centered="true"] article')
      .evaluate((element) => ({
        width: (element as HTMLElement).offsetWidth,
        height: (element as HTMLElement).offsetHeight,
      }))).toEqual({ width: 248, height: 420 })

    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("192px")
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Height: 224px")
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

    await page.getByRole("radio", { name: "Backgrounds", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("248px")
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Height: 420px")
    await page.reload()
    await page.getByRole("tab", { name: "Carousels" }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("248px")
    await page.getByRole("button", { name: "Reset current pair" }).click()
    const resetProfile = testInfo.project.name === "mobile-chromium"
      ? { width: 164, label: "Phone portrait" }
      : { width: 256, label: "Compact desktop" }
    await expect(page.getByTestId("carousel-lab-summary")).toContainText(`${resetProfile.width}px`)
    await expect(page.getByTestId("carousel-lab-summary")).toContainText(`Screen fit: ${resetProfile.label}`)
    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("232px")
    await page.getByRole("radio", { name: "Backgrounds", exact: true }).click()

    await page.getByRole("combobox", { name: "Access state fixture" }).click()
    await page.getByRole("option", { name: "Locked", exact: true }).click()
    const centeredBackground = page.locator('[data-centered="true"]')
    await expect(centeredBackground.locator("article")).toHaveAttribute(
      "data-background-access-state",
      "locked",
    )
    const lockedAction = centeredBackground.getByRole("button", { name: /^Select/ })
    await lockedAction.scrollIntoViewIfNeeded()
    await expect.poll(() => lockedAction.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hitTarget = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      )
      return hitTarget === element || element.contains(hitTarget)
    })).toBe(true)
    await lockedAction.click()
    await expect(page.getByRole("button", { name: "Use free credit" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Buy for $1" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Unlock all" })).toBeVisible()
    await page.getByRole("button", { name: "Buy for $1" }).click()
    await expect(page.getByText("Dev preview: Buy for $1")).toBeVisible()
    expect(mutationRequests).toEqual([])

    expect(
      await page.locator('video[data-testid="carousel-background-video"]').count(),
    ).toBeLessThanOrEqual(9)
    await page
      .getByLabel("Background visual filter")
      .getByRole("radio", { name: "Video" })
      .click()
    expect(
      await page.locator('video[data-testid="carousel-background-video"]').count(),
    ).toBeGreaterThan(1)
  })

  test("Carousel Lab adapts Background profiles while Music Station dimensions stay universal", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()

    const profiles = [
      [{ width: 390, height: 844 }, "Phone portrait", 164, 312, 22],
      [{ width: 844, height: 390 }, "Short landscape", 200, 240, 26],
      [{ width: 779, height: 1121 }, "Tablet portrait", 220, 304, 29],
      [{ width: 1365, height: 820 }, "Compact desktop", 256, 360, 33],
      [{ width: 1121, height: 779 }, "Wide landscape", 280, 388, 36],
    ] as const

    const centered = page.locator('[data-carousel-slide="true"][data-centered="true"]')
    const centeredLabel = await centered.getAttribute("aria-label")
    for (const [viewport, label, cardWidth, cardHeight, sideRotation] of profiles) {
      await page.setViewportSize(viewport)
      await expect(page.getByTestId("carousel-lab-summary")).toContainText(`Screen fit: ${label}`)
      await expect(page.getByTestId("carousel-lab-summary")).toContainText(`Card width: ${cardWidth}px`)
      await expect(page.getByTestId("carousel-lab-summary")).toContainText(`Height: ${cardHeight}px`)
      await expect(page.getByTestId("carousel-lab-summary")).toContainText("Nearby radius: 2")
      await expect.poll(() => centered.locator("article").evaluate((element) => ({
        width: (element as HTMLElement).offsetWidth,
        height: (element as HTMLElement).offsetHeight,
      }))).toEqual({ width: cardWidth, height: cardHeight })
      await expect(centered).toHaveAttribute("aria-label", centeredLabel ?? "")
      const side = page.locator('[data-carousel-slide="true"][data-detail-level="summary"]').first()
      await expect.poll(() => side.evaluate((element) => Math.abs(
        Number.parseFloat(element.style.getPropertyValue("--carousel-rotate-y")),
      ))).toBeCloseTo(sideRotation, 0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
    }

    for (const viewport of [{ width: 390, height: 844 }, { width: 1180, height: 820 }]) {
      await page.setViewportSize(viewport)
      await page.getByRole("radio", { name: "Music Stations", exact: true }).click()
      await expect(page.getByTestId("carousel-lab-summary")).toContainText("Card width: 192px")
      await expect(page.getByTestId("carousel-lab-summary")).toContainText("Height: 224px")
      const centeredStation = page.locator('[data-carousel-slide="true"][data-centered="true"]')
      await expect.poll(() => centeredStation.locator("article").evaluate((element) => ({
        width: (element as HTMLElement).offsetWidth,
        height: (element as HTMLElement).offsetHeight,
      }))).toEqual({ width: 192, height: 224 })
      const summaryPresentation = page
        .locator('[data-carousel-slide="true"][data-detail-level="summary"]')
        .first()
        .locator('[data-carousel-transform="true"]')
      await expect.poll(() => summaryPresentation.evaluate((element) => (element as HTMLElement).offsetHeight))
        .toBe(193)
      await page.getByRole("radio", { name: "Backgrounds", exact: true }).click()
    }
  })

  test("Carousel Lab tuning changes the selected Station Background Picker geometry", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()

    const stage = page.getByTestId("carousel-lab-stage")
    const sideSlide = page.locator('[data-carousel-slide="true"]').nth(1)
    await expect(sideSlide).toBeAttached()
    await expect(page.getByText("Sets the angle between cards on the production-style radial arc.")).toBeVisible()
    const centerOffset = await page.locator('[data-carousel-slide="true"][data-centered="true"]').evaluate(
      (centered, stageElement) => {
        const cardRect = centered.getBoundingClientRect()
        const stageRect = (stageElement as HTMLElement).getBoundingClientRect()
        return Math.abs(
          (cardRect.left + cardRect.width / 2) - (stageRect.left + stageRect.width / 2),
        )
      },
      await stage.elementHandle(),
    )
    expect(centerOffset).toBeLessThanOrEqual(2)
    const centeredSlide = page.locator('[data-carousel-slide="true"][data-centered="true"]')
    const stacking = await Promise.all([
      centeredSlide.evaluate((element) => Number(getComputedStyle(element).zIndex)),
      sideSlide.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    ])
    expect(stacking[0]).toBeGreaterThan(stacking[1])

    const initialRotation = await sideSlide.evaluate((element) =>
      element.style.getPropertyValue("--carousel-rotate-y"),
    )
    const spread = page.getByTestId("carousel-tuning-spread")
    await spread.evaluate((input) => {
      const range = input as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(range, "40")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect.poll(() => sideSlide.evaluate((element) =>
      element.style.getPropertyValue("--carousel-rotate-y"),
    )).not.toBe(initialRotation)
  })

  test("Carousel Lab preserves presentation transforms across an Embla loop wrap", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()

    const slides = page.locator('[data-carousel-slide="true"]')
    await expect(slides.first()).toHaveAttribute("data-centered", "true")
    await page.getByRole("button", { name: "Previous station" }).click()
    await expect(slides.last()).toHaveAttribute("data-centered", "true")

    const wrappedSlide = slides.first()
    await expect.poll(() => wrappedSlide.evaluate((element) =>
      element.style.getPropertyValue("--carousel-x"),
    )).not.toBe("")
    const visualTransform = wrappedSlide.locator('[data-carousel-transform="true"]')
    await expect(visualTransform).toHaveCount(1)
    await expect.poll(() => visualTransform.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none")
  })

  test("Carousel Lab places Background actions in preview corners and loops every Station sample", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()

    await expect(page.getByRole("radio", { name: "Background Picker", exact: true })).toHaveCount(0)
    for (const presentation of ["Existing"]) {
      await page.getByRole("radio", { name: presentation, exact: true }).click()
      const centered = page.locator('[data-carousel-slide="true"][data-centered="true"]')
      const card = centered.locator("article")
      const select = centered.locator("[data-carousel-primary-action]")
      const favorite = centered.locator("[data-carousel-favorite-action]")
      const boxes = await Promise.all([
        card.boundingBox(),
        select.boundingBox(),
        favorite.boundingBox(),
      ])
      expect(boxes.every(Boolean)).toBe(true)
      const [cardBox, selectBox, favoriteBox] = boxes
      expect(selectBox!.x).toBeLessThan(cardBox!.x + cardBox!.width / 2)
      expect(favoriteBox!.x + favoriteBox!.width).toBeGreaterThan(cardBox!.x + cardBox!.width / 2)
      expect(selectBox!.y).toBeLessThanOrEqual(cardBox!.y + 24)
      expect(favoriteBox!.y).toBeLessThanOrEqual(cardBox!.y + 24)
      await expect(select).toHaveClass(/ml-button-glow/)
      await expect(favorite).toHaveClass(/ml-button-glow/)
      const favoritePurple = await favorite.evaluate((element) => {
        const styles = getComputedStyle(element)
        return {
          glow: styles.getPropertyValue("--brand-orange").trim(),
          cta: styles.getPropertyValue("--button-cta-face").trim(),
        }
      })
      expect(favoritePurple.glow).toBe(favoritePurple.cta)
      if (await favorite.getAttribute("aria-pressed") !== "true") await favorite.click()
      const backgroundMetalIcon = favorite.locator('[data-metal-icon-trace="true"]')
      await expect(backgroundMetalIcon).toHaveCount(1)
      await expect(backgroundMetalIcon).toHaveAttribute("fill", "hsl(var(--button-cta-face))")
      await expect(backgroundMetalIcon.locator("animateTransform")).toHaveCount(1)
    }

    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()
    await expect(page.getByRole("radio", { name: "Background Picker", exact: true })).toBeVisible()
    await expect(page.getByRole("radio", { name: "Existing", exact: true })).toHaveCount(0)
    await expect(page.getByRole("radio", { name: "Cover Flow", exact: true })).toHaveCount(0)
    await expect(page.getByRole("radio", { name: "3D Carousel", exact: true })).toHaveCount(0)
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Loop: On")
    await expect(page.getByText("Loop unavailable for this item count")).toHaveCount(0)
    const stationSlides = page.locator('[data-carousel-slide="true"]')
    const centeredStation = page.locator(
      '[data-carousel-slide="true"][data-centered="true"]',
    )
    const stationPlay = centeredStation.locator("[data-carousel-primary-action]")
    const stationFavorite = centeredStation.locator("[data-carousel-favorite-action]")
    await expect(stationPlay).toHaveClass(/ml-button-glow/)
    await expect(stationFavorite).toHaveClass(/ml-button-glow/)
    if (await stationFavorite.getAttribute("aria-pressed") !== "true") await stationFavorite.click()
    const stationMetalIcon = stationFavorite.locator('[data-metal-icon-trace="true"]')
    await expect(stationMetalIcon).toHaveCount(1)
    await expect(stationMetalIcon).toHaveAttribute("fill", "hsl(var(--button-cta-face))")
    await expect(stationMetalIcon.locator("animateTransform")).toHaveCount(1)
    const stationBoxes = await Promise.all([
      centeredStation.locator("article").boundingBox(),
      centeredStation.locator("[data-carousel-artwork]").boundingBox(),
      stationPlay.boundingBox(),
      stationFavorite.boundingBox(),
    ])
    expect(stationBoxes.every(Boolean)).toBe(true)
    expect(stationBoxes[2]!.x).toBeLessThan(stationBoxes[0]!.x + stationBoxes[0]!.width / 2)
    expect(stationBoxes[3]!.x + stationBoxes[3]!.width).toBeGreaterThan(
      stationBoxes[0]!.x + stationBoxes[0]!.width / 2,
    )
    expect(stationBoxes[2]!.y).toBeGreaterThanOrEqual(stationBoxes[1]!.y)
    expect(stationBoxes[2]!.y + stationBoxes[2]!.height).toBeLessThan(stationBoxes[1]!.y + stationBoxes[1]!.height)
    expect(stationBoxes[3]!.y).toBeGreaterThanOrEqual(stationBoxes[1]!.y)
    const details = centeredStation.locator("[data-carousel-station-details]")
    await expect(details).toBeVisible()
    await expect(details).toHaveText(/\S/)
    const detailsBox = await details.boundingBox()
    expect(detailsBox).toBeTruthy()
    expect(detailsBox!.y).toBeLessThan(stationBoxes[1]!.y + stationBoxes[1]!.height)
    expect(detailsBox!.height).toBeGreaterThan(stationBoxes[0]!.height * 0.5)
    await details.click()
    const detailsDialog = page.getByRole("dialog")
    await expect(detailsDialog).toBeVisible()
    await expect(detailsDialog.getByText(/Source and license|MassageLab original/)).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(detailsDialog).toBeHidden()
    await expect(stationSlides.first()).toHaveAttribute("data-centered", "true")
    await page.getByRole("button", { name: "Previous station" }).click()
    await expect(stationSlides.last()).toHaveAttribute("data-centered", "true")

    await page.getByRole("radio", { name: "Backgrounds", exact: true }).click()
    await expect(page.getByRole("radio", { name: "Background Picker", exact: true })).toHaveCount(0)
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Presentation: Existing")
    const backgroundCards = page.locator(
      '[data-carousel-slide="true"]:not([data-detail-level="shell"]) article',
    )
    const backgroundCopy = await backgroundCards.allInnerTexts()
    expect(backgroundCopy.every((copy) => !/\b(?:Shader|Video)\b/.test(copy))).toBe(true)
    await expect(
      page.locator('[data-carousel-slide="true"][data-centered="true"]').getByText(
        "MassageLab",
        { exact: true },
      ),
    ).toHaveCount(0)
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

    for (const presentation of ["Existing"]) {
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
