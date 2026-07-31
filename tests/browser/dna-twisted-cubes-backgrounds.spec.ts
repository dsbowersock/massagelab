import { expect, test, type Locator, type Page } from "@playwright/test"

type RuntimeHealth = ReturnType<typeof captureRuntimeErrors>

function captureRuntimeErrors(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  return { consoleErrors, pageErrors }
}

async function openTrack4BReview(page: Page) {
  const response = await page.goto("/dev/buttons")
  if (!response) throw new Error("Track 4B review returned no response.")
  if (response.status() === 404) {
    throw new Error("Track 4B review is development-only; run the exact Task 8 spec command.")
  }
  expect(response.ok()).toBe(true)
  await expect(page.locator('[data-review-lab-ready="true"]')).toBeAttached()
  await page.getByRole("tab", { name: "Background palettes" }).click()
  const review = page.locator("[data-track-4b-review]")
  await expect(review).toBeVisible()
  return review
}

async function expectLoaded(host: Locator, id: string) {
  await expect(host).toHaveAttribute("data-background-id", id)
  await expect(host).toHaveAttribute("data-background-diagnostic-status", "loaded")
  await expect(host).toHaveAttribute("data-background-diagnostic-loaded-id", id)
  await expect(host).toHaveAttribute("data-background-effect-mounted", "true")
  await expect(host).toHaveAttribute("data-background-fallback-only", "false")
  await expect(host).not.toHaveAttribute("data-background-diagnostic-error", /.+/)
}

function effectRoot(host: Locator) {
  return host.locator(":scope > div").nth(1)
}

async function dnaAssignments(host: Locator) {
  return effectRoot(host).locator('[style*="--ml-dna-start-color"]').evaluateAll((strands) => (
    strands.map((strand) => [
      (strand as HTMLElement).style.getPropertyValue("--ml-dna-start-color"),
      (strand as HTMLElement).style.getPropertyValue("--ml-dna-end-color"),
    ].join("|"))
  ))
}

async function cubeOutlines(host: Locator) {
  return effectRoot(host).locator('[style*="--ml-twisted-cubes-outline"]').evaluateAll((layers) => (
    layers.map((layer) => (
      (layer as HTMLElement).style.getPropertyValue("--ml-twisted-cubes-outline")
    ))
  ))
}

function parsedAttribute(locator: Locator, name: string) {
  return locator.getAttribute(name).then((value) => {
    if (!value) throw new Error(`${name} was missing.`)
    return JSON.parse(value) as Record<string, unknown>
  })
}

function namedSlider(review: Locator, label: string) {
  return review.getByRole("slider", { name: label, exact: true })
}

function expectHealthy(health: RuntimeHealth) {
  expect(health.pageErrors).toEqual([])
  expect(health.consoleErrors).toEqual([])
}

test.describe("DNA and Twisted Cubes development acceptance", () => {
  test("source defaults mount through the real Host with bounded, inert effect DOM", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    await expectLoaded(host, "massage-lab-dna")

    await expect(review).toHaveAttribute("data-palette-mode", "source")
    expect(JSON.parse(await review.getAttribute("data-role-labels") ?? "[]")).toEqual([
      "Background", "Node 1", "Node 2", "Node 3", "Node 4", "Connector", "Outline",
    ])
    const dnaRoot = effectRoot(host)
    await expect(dnaRoot).toBeVisible()
    expect(await dnaRoot.locator('[style*="--ml-dna-start-color"]').count()).toBeLessThanOrEqual(25)
    expect(await dnaRoot.locator("[data-side]").count()).toBeLessThanOrEqual(50)
    await expect(dnaRoot).toHaveAttribute("aria-hidden", "true")
    await expect(dnaRoot).not.toHaveAttribute("tabindex", /.+/)
    expect(await review.getByRole("button", { name: /shuffle/i }).count()).toBe(0)
    expect(await review.getByText(/drag/i).count()).toBe(0)

    await review.getByLabel("Track 4B background").selectOption("massage-lab-twisted-cubes")
    await expectLoaded(host, "massage-lab-twisted-cubes")
    const cubeRoot = effectRoot(host)
    const layers = cubeRoot.locator('[style*="--ml-twisted-cubes-outline"]')
    expect(await layers.count()).toBeLessThanOrEqual(30)
    expect(await layers.locator(":scope > span > span > span").count()).toBeLessThanOrEqual(180)
    expect(await host.locator('[style*="--ml-dna-start-color"]').count()).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
    expectHealthy(health)
  })

  test("generated DNA and Twisted Cubes posters back the production preview player", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const dna = review.locator('[data-track-4b-preview="massage-lab-dna"]')
    const cubes = review.locator('[data-track-4b-preview="massage-lab-twisted-cubes"]')
    await expect(dna.getByTestId("background-preview-poster")).toHaveAttribute(
      "src",
      /massage-lab-dna-vertical\.webp$/,
    )
    await expect(cubes.getByTestId("background-preview-poster")).toHaveAttribute(
      "src",
      /massage-lab-twisted-cubes-vertical\.webp$/,
    )

    await review.getByRole("button", { name: "Play DNA preview" }).click()
    await expect(dna.getByTestId("carousel-background-video")).toHaveAttribute(
      "src",
      /massage-lab-dna-vertical\.webm$/,
    )
    await expect(dna.getByTestId("carousel-background-video")).toHaveAttribute(
      "poster",
      /massage-lab-dna-vertical\.webp$/,
    )
    await review.getByRole("button", { name: "Play Twisted Cubes preview" }).click()
    await expect(dna.getByTestId("carousel-background-video")).toHaveCount(0)
    await expect(cubes.getByTestId("carousel-background-video")).toHaveAttribute(
      "src",
      /massage-lab-twisted-cubes-vertical\.webm$/,
    )
    await expect(cubes.getByTestId("carousel-background-video")).toHaveAttribute(
      "poster",
      /massage-lab-twisted-cubes-vertical\.webp$/,
    )
    expectHealthy(health)
  })

  test("DNA assignments survive palette and property edits, then refresh with count/remount", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    await expectLoaded(host, "massage-lab-dna")
    const initialAssignments = await dnaAssignments(host)
    const sourceRootColors = await effectRoot(host).evaluate((root) => ({
      one: (root as HTMLElement).style.getPropertyValue("--ml-dna-node-color-0"),
      four: (root as HTMLElement).style.getPropertyValue("--ml-dna-node-color-3"),
    }))

    await review.getByRole("button", { name: "Custom", exact: true }).click()
    await expect(review).toHaveAttribute("data-palette-mode", "custom")
    expect(await dnaAssignments(host)).toEqual(initialAssignments)
    const customRootColors = await effectRoot(host).evaluate((root) => ({
      one: (root as HTMLElement).style.getPropertyValue("--ml-dna-node-color-0"),
      four: (root as HTMLElement).style.getPropertyValue("--ml-dna-node-color-3"),
    }))
    expect(customRootColors).not.toEqual(sourceRootColors)

    await review.getByRole("button", { name: "Harmony", exact: true }).click()
    await expect(review).toHaveAttribute("data-palette-mode", "harmony")
    expect(await dnaAssignments(host)).toEqual(initialAssignments)
    await namedSlider(review, "Strand angle").press("ArrowRight")
    expect(await dnaAssignments(host)).toEqual(initialAssignments)

    await namedSlider(review, "Strand count").press("ArrowRight")
    await expect.poll(() => dnaAssignments(host)).not.toEqual(initialAssignments)
    await review.getByLabel("Track 4B background").selectOption("massage-lab-twisted-cubes")
    await expectLoaded(host, "massage-lab-twisted-cubes")
    await review.getByLabel("Track 4B background").selectOption("massage-lab-dna")
    await expectLoaded(host, "massage-lab-dna")
    expect(await dnaAssignments(host)).not.toEqual(initialAssignments)
    expectHealthy(health)
  })

  test("Twisted Source stays continuous while Custom and Harmony interpolate exact anchors", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    await review.getByLabel("Track 4B background").selectOption("massage-lab-twisted-cubes")
    await expectLoaded(host, "massage-lab-twisted-cubes")

    const source = await cubeOutlines(host)
    expect(source).toHaveLength(20)
    expect(source[0]).toBe("hsl(180 80% 60%)")
    expect(source.at(-1)).toBe("hsl(340 80% 60%)")
    expect(new Set(source).size).toBe(source.length)

    await review.getByRole("button", { name: "Custom", exact: true }).click()
    const custom = await cubeOutlines(host)
    expect(custom[0]).toBe("#ff5119")
    expect(custom.at(-1)).toBe("#ec4899")
    expect(custom.slice(1, -1).every((color) => color.startsWith("rgb("))).toBe(true)
    expect(new Set(custom).size).toBeGreaterThan(6)

    await review.getByRole("button", { name: "Harmony", exact: true }).click()
    const harmony = await cubeOutlines(host)
    expect(harmony[0]).toMatch(/^#[\da-f]{6}$/i)
    expect(harmony.at(-1)).toMatch(/^#[\da-f]{6}$/i)
    expect(harmony.slice(1, -1).every((color) => color.startsWith("rgb("))).toBe(true)
    expect(new Set(harmony).size).toBeGreaterThan(6)
    expectHealthy(health)
  })

  test("every real slider updates the draft and canonical Undo, Redo, Cancel, Apply, and presets stay separated", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const controls = review.locator("[data-track-4b-property-controls]")
    const sliders = await controls.getByRole("slider").all()
    expect(sliders).toHaveLength(11)
    for (const slider of sliders) {
      const before = await review.getAttribute("data-current-properties")
      await slider.press("ArrowRight")
      await expect(review).not.toHaveAttribute("data-current-properties", before ?? "")
    }
    await expect(review).toHaveAttribute("data-draft-state", "dirty")

    const edited = await review.getAttribute("data-current-properties")
    await review.getByRole("button", { name: "Undo", exact: true }).click()
    await expect(review).not.toHaveAttribute("data-current-properties", edited ?? "")
    await review.getByRole("button", { name: "Redo", exact: true }).click()
    await expect(review).toHaveAttribute("data-current-properties", edited ?? "")
    await review.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(review).toHaveAttribute("data-draft-state", "clean")

    const sourceProperties = await parsedAttribute(review, "data-current-properties")
    const sourcePalette = await review.getAttribute("data-palette-mode")
    await review.getByRole("button", { name: "Apply Visual preset" }).click()
    const visualProperties = await parsedAttribute(review, "data-current-properties")
    expect(visualProperties.massageLabDnaStrandAngle).toBe(72)
    expect(visualProperties.massageLabTwistedCubesViewAngleX).toBe(-18)
    expect(visualProperties.massageLabDnaStrandCount).toBe(sourceProperties.massageLabDnaStrandCount)
    await expect(review).toHaveAttribute("data-palette-mode", sourcePalette ?? "source")

    await review.getByRole("button", { name: "Apply Color preset" }).click()
    expect(await parsedAttribute(review, "data-current-properties")).toEqual(visualProperties)
    await expect(review).toHaveAttribute("data-palette-mode", "custom")
    await review.getByRole("button", { name: "Apply", exact: true }).click()
    await expect(review).toHaveAttribute("data-draft-state", "clean")
    expect(await parsedAttribute(review, "data-applied-properties")).toEqual(visualProperties)
    expect(JSON.parse(await page.evaluate(() => (
      localStorage.getItem("massage-lab:dev:track-4b-review-applied") ?? "null"
    )))).toMatchObject({ properties: visualProperties })
    expectHealthy(health)
  })

  test("desktop, phone portrait, short landscape, 200% zoom, and reduced motion retain bounded saved geometry", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    await expectLoaded(host, "massage-lab-dna")
    await expect(host).toHaveAttribute("data-background-diagnostic-reduced-motion", "true")

    await namedSlider(review, "Scale").press("End")
    await namedSlider(review, "Position X").press("End")
    await namedSlider(review, "Position Y").press("End")
    const saved = await parsedAttribute(review, "data-current-properties")
    expect(saved.massageLabDnaScale).toBe(1.2)
    expect(saved.massageLabDnaPositionX).toBe(35)
    expect(saved.massageLabDnaPositionY).toBe(35)

    for (const viewport of [
      { name: "desktop", width: 1280, height: 900 },
      { name: "phone portrait", width: 390, height: 844 },
      { name: "short landscape", width: 844, height: 390 },
      { name: "200% zoom", width: 640, height: 450 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      if (viewport.name === "200% zoom") await page.evaluate(() => { document.body.style.zoom = "2" })
      const current = await parsedAttribute(review, "data-current-properties")
      expect(current.massageLabDnaScale, viewport.name).toBe(1.2)
      expect(current.massageLabDnaPositionX, viewport.name).toBe(35)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), viewport.name).toBe(false)
    }

    await page.evaluate(() => { document.body.style.zoom = "1" })
    await page.setViewportSize({ width: 390, height: 844 })
    const sceneStyle = await effectRoot(host).locator(":scope > div").evaluate((scene) => ({
      scale: (scene as HTMLElement).style.getPropertyValue("--ml-dna-scale"),
      x: (scene as HTMLElement).style.getPropertyValue("--ml-dna-position-x"),
      y: (scene as HTMLElement).style.getPropertyValue("--ml-dna-position-y"),
    }))
    expect(sceneStyle).toEqual({ scale: "1", x: "20%", y: "20%" })
    expect(await effectRoot(host).locator('[style*="--ml-dna-start-color"]').first().evaluate((strand) => (
      getComputedStyle(strand).animationName
    ))).toBe("none")
    expectHealthy(health)
  })

  test("canonical access and shared contexts survive effect unmount without disturbing Music", async ({ page }) => {
    test.setTimeout(120_000)
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    const continuity = page.locator("[data-background-palette-music-continuity]")
    const contexts = await Promise.all(["chimer", "clock", "music"].map((context) => (
      review.locator(`[data-track-4b-context="${context}"]`).getAttribute("data-config")
    )))
    expect(contexts[1]).toBe(contexts[0])
    expect(contexts[2]).toBe(contexts[0])

    await review.getByLabel("Track 4B access").selectOption("owner")
    await expectLoaded(host, "massage-lab-dna")
    await review.getByLabel("Track 4B access").selectOption("locked")
    await expect(host).not.toHaveAttribute("data-background-id", "massage-lab-dna")
    await expect(namedSlider(review, "Strand count")).toBeDisabled()
    await review.getByLabel("Track 4B access").selectOption("subscriber")
    await expectLoaded(host, "massage-lab-dna")

    await page.getByRole("button", { name: "Play MassageLab Proof Drone" }).click()
    await expect(continuity).toHaveAttribute("data-music-playback-state", "playing", { timeout: 30_000 })
    await expect(continuity).toHaveAttribute("data-music-session-id", /^\d+$/)
    const sessionId = await continuity.getAttribute("data-music-session-id")
    const elapsed = Number(await continuity.getAttribute("data-music-audio-elapsed"))
    await review.getByLabel("Track 4B background").selectOption("massage-lab-twisted-cubes")
    await expectLoaded(host, "massage-lab-twisted-cubes")
    expect(await host.locator('[style*="--ml-dna-start-color"]').count()).toBe(0)
    await expect(continuity).toHaveAttribute("data-music-session-id", sessionId ?? "")
    await expect.poll(async () => Number(await continuity.getAttribute("data-music-audio-elapsed")))
      .toBeGreaterThan(elapsed)
    await review.getByLabel("Track 4B background").selectOption("massage-lab-dna")
    await expectLoaded(host, "massage-lab-dna")
    expect(await host.locator('[style*="--ml-twisted-cubes-outline"]').count()).toBe(0)
    expectHealthy(health)
  })
})
