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

  test("Carousel Lab exposes seven real combinations with center-before-action", async ({ page }, testInfo) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await expect(page.getByTestId("carousel-lab")).toBeVisible()

    for (const surface of ["Backgrounds", "Music Stations"]) {
      await page.getByRole("radio", { name: surface, exact: true }).click()
      const presentations = surface === "Music Stations"
        ? ["Existing", "Cover Flow", "3D Carousel", "Background Picker"]
        : ["Existing", "Cover Flow", "3D Carousel"]
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
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("192px")
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
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("268px")
    await page.getByRole("radio", { name: "Cover Flow", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("232px")

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

  test("Carousel Lab tuning changes live Cover Flow and 3D geometry", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await page.getByRole("radio", { name: "Cover Flow", exact: true }).click()

    const stage = page.getByTestId("carousel-lab-stage")
    const sideSlide = page.locator('[data-carousel-slide="true"]').nth(1)
    await expect(sideSlide).toBeAttached()
    await expect(page.getByText("Changes how strongly depth is projected; lower values exaggerate the 3D effect.")).toBeVisible()
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
      element.style.getPropertyValue("--lab-rotate-y"),
    )
    const rotation = page.getByTestId("carousel-tuning-rotation")
    await rotation.evaluate((input) => {
      const range = input as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(range, "50")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect.poll(() => sideSlide.evaluate((element) =>
      element.style.getPropertyValue("--lab-rotate-y"),
    )).not.toBe(initialRotation)

    const perspective = page.getByTestId("carousel-tuning-perspective")
    await perspective.evaluate((input) => {
      const range = input as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(range, "400")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect.poll(() => stage.evaluate((element) => getComputedStyle(element).perspective)).toBe("400px")

    await page.getByRole("radio", { name: "3D Carousel", exact: true }).click()
    const threeDSideSlide = page.locator('[data-carousel-slide="true"]').nth(1)
    const initialDepth = await threeDSideSlide.evaluate((element) =>
      element.style.getPropertyValue("--lab-z"),
    )
    const depth = page.getByTestId("carousel-tuning-depth")
    await depth.evaluate((input) => {
      const range = input as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(range, "1.5")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect.poll(() => threeDSideSlide.evaluate((element) =>
      element.style.getPropertyValue("--lab-z"),
    )).not.toBe(initialDepth)

    const initialMask = await stage.evaluate((element) => getComputedStyle(element).maskImage)
    const nearMask = page.getByTestId("carousel-tuning-nearMask")
    await nearMask.evaluate((input) => {
      const range = input as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(range, "1.5")
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect.poll(() => stage.evaluate((element) => getComputedStyle(element).maskImage)).not.toBe(initialMask)
  })

  test("Carousel Lab preserves presentation transforms across an Embla loop wrap", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await page.getByRole("radio", { name: "Cover Flow", exact: true }).click()

    const slides = page.locator('[data-carousel-slide="true"]')
    await slides.first().click()
    await expect(slides.first()).toHaveAttribute("data-centered", "true")
    await page.getByRole("button", { name: "Previous carousel item" }).click()
    await expect(slides.last()).toHaveAttribute("data-centered", "true")

    const wrappedSlide = slides.first()
    await expect.poll(() => wrappedSlide.evaluate((element) => element.style.transform)).not.toBe("")
    const visualTransform = wrappedSlide.locator('[data-carousel-transform="true"]')
    await expect(visualTransform).toHaveCount(1)
    await expect.poll(() => visualTransform.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none")
  })

  test("Carousel Lab places Background actions in preview corners and loops every Station sample", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()

    await expect(page.getByRole("radio", { name: "Background Picker", exact: true })).toHaveCount(0)
    for (const presentation of ["Existing", "Cover Flow", "3D Carousel"]) {
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
      if (presentation === "Cover Flow") {
        const sideReflection = await page
          .locator('[data-carousel-slide="true"][data-centered="false"] [data-carousel-artwork]')
          .first()
          .evaluate((element) => (
            getComputedStyle(element) as CSSStyleDeclaration & { webkitBoxReflect: string }
          ).webkitBoxReflect)
        expect(sideReflection).toContain("32%")
      }
    }

    await page.getByRole("radio", { name: "Music Stations", exact: true }).click()
    await expect(page.getByRole("radio", { name: "Background Picker", exact: true })).toBeVisible()
    for (const presentation of ["Existing", "Cover Flow", "3D Carousel", "Background Picker"]) {
      await page.getByRole("radio", { name: presentation, exact: true }).click()
      await expect(page.getByTestId("carousel-lab-summary")).toContainText("Loop: On")
      await expect(page.getByText("Loop unavailable for this item count")).toHaveCount(0)
      const slides = page.locator('[data-carousel-slide="true"]')
      await slides.first().click()
      await expect(slides.first()).toHaveAttribute("data-centered", "true")
      await page.getByRole("button", { name: "Previous carousel item" }).click()
      await expect(slides.last()).toHaveAttribute("data-centered", "true")
    }

    await page.getByRole("radio", { name: "Backgrounds", exact: true }).click()
    await expect(page.getByRole("radio", { name: "Background Picker", exact: true })).toHaveCount(0)
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Presentation: Existing")
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
