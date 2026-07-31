import { expect, test, type Locator, type Page } from "@playwright/test"
import { backgroundPaletteRegistry } from "../../components/backgrounds/backgroundPaletteRegistry"
import { resolveBackgroundRoleColors } from "../../lib/background-palette.js"
import { interpolateTwistedCubeOutline } from "../../lib/twisted-cubes-background.js"

const EFFECTS = [
  {
    id: "massage-lab-dna",
    labels: [
      "Node motion speed", "Strand rotation speed", "Strand count", "Strand angle",
      "Strand spacing", "Scale", "Position X", "Position Y", "Connector width",
      "Connector thickness", "Outline thickness",
    ],
    scaleKey: "massageLabDnaScale",
    positionXKey: "massageLabDnaPositionX",
    positionYKey: "massageLabDnaPositionY",
    maxScale: 1.2,
  },
  {
    id: "massage-lab-twisted-cubes",
    labels: [
      "Rotation speed", "Layer stagger", "View angle X", "View angle Y", "Layer count",
      "Layer depth", "Scale", "Position X", "Position Y", "Fade falloff",
      "Relative outline thickness",
    ],
    scaleKey: "massageLabTwistedCubesScale",
    positionXKey: "massageLabTwistedCubesPositionX",
    positionYKey: "massageLabTwistedCubesPositionY",
    maxScale: 1.2,
  },
] as const

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

function parsedAttribute<T = Record<string, unknown>>(locator: Locator, name: string) {
  return locator.getAttribute(name).then((value) => {
    if (!value) throw new Error(`${name} was missing.`)
    return JSON.parse(value) as T
  })
}

function namedSlider(review: Locator, label: string) {
  return review.getByRole("slider", { name: label, exact: true })
}

function expectHealthy(health: RuntimeHealth) {
  expect(health.pageErrors).toEqual([])
  expect(health.consoleErrors).toEqual([])
}

async function selectEffect(review: Locator, host: Locator, id: typeof EFFECTS[number]["id"]) {
  await review.getByLabel("Track 4B background").selectOption(id)
  await expectLoaded(host, id)
}

async function expectRenderedContract(host: Locator, id: typeof EFFECTS[number]["id"], reducedMotion = false) {
  const root = effectRoot(host)
  await expect(root).toHaveAttribute("aria-hidden", "true")
  if (id === "massage-lab-dna") {
    const strands = root.locator('[style*="--ml-dna-start-color"]')
    expect(await strands.count()).toBeGreaterThan(0)
    expect(await strands.locator("[data-side]").count()).toBe((await strands.count()) * 2)
    const vars = await root.evaluate((element) => {
      const style = (element as HTMLElement).style
      return [
        "--ml-dna-background-color", "--ml-dna-node-color-0", "--ml-dna-node-color-3",
        "--ml-dna-connector-color", "--ml-dna-outline-color", "--ml-dna-strand-angle",
        "--ml-dna-strand-spacing", "--ml-dna-connector-width", "--ml-dna-connector-thickness",
        "--ml-dna-outline-thickness", "--ml-dna-rotation-duration",
      ].map((name) => style.getPropertyValue(name))
    })
    expect(vars.every(Boolean)).toBe(true)
    const sceneVars = await root.locator(":scope > div").evaluate((element) => {
      const style = (element as HTMLElement).style
      return ["--ml-dna-scale", "--ml-dna-position-x", "--ml-dna-position-y"]
        .map((name) => style.getPropertyValue(name))
    })
    expect(sceneVars.every(Boolean)).toBe(true)
    const animationName = await strands.first().evaluate((element) => getComputedStyle(element).animationName)
    if (reducedMotion) expect(animationName).toBe("none")
    else expect(animationName).toContain("mlDnaStrandRotate")
  } else {
    const layers = root.locator('[style*="--ml-twisted-cubes-outline"]')
    expect(await layers.count()).toBeGreaterThan(0)
    expect(await layers.locator(":scope > span > span > span").count()).toBe((await layers.count()) * 6)
    const vars = await root.evaluate((element) => {
      const style = (element as HTMLElement).style
      return [
        "--ml-twisted-cubes-background-color", "--ml-twisted-cubes-cycle",
        "--ml-twisted-cubes-view-angle-x", "--ml-twisted-cubes-view-angle-y",
      ].map((name) => style.getPropertyValue(name))
    })
    expect(vars.every(Boolean)).toBe(true)
    const sceneVars = await root.locator(":scope > div").evaluate((element) => {
      const style = (element as HTMLElement).style
      return [
        "--ml-twisted-cubes-scale", "--ml-twisted-cubes-position-x",
        "--ml-twisted-cubes-position-y",
      ].map((name) => style.getPropertyValue(name))
    })
    expect(sceneVars.every(Boolean)).toBe(true)
    const firstLayer = layers.first()
    const layerVars = await firstLayer.evaluate((element) => {
      const style = (element as HTMLElement).style
      return [
        "--ml-twisted-cubes-outline", "--ml-twisted-cubes-alpha",
        "--ml-twisted-cubes-delay", "--ml-twisted-cubes-depth",
        "--ml-twisted-cubes-outline-thickness",
      ].map((name) => style.getPropertyValue(name))
    })
    expect(layerVars.every(Boolean)).toBe(true)
    const animationName = await firstLayer.locator(":scope > span")
      .evaluate((element) => getComputedStyle(element).animationName)
    if (reducedMotion) expect(animationName).toBe("none")
    else expect(animationName).toContain("mlTwistedCubesRotate")
  }
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

  test("shared slider thumbs exclusively own their accessible names and descriptions", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const response = await page.goto("/dev/buttons")
    expect(response?.ok()).toBe(true)
    await expect(page.locator('[data-review-lab-ready="true"]')).toBeAttached()
    await page.getByRole("tab", { name: "Fields & color" }).click()

    const cases = [
      {
        name: "Lamp hue",
        description: "This is the ColorSlider wrapper after moving onto the shared split-pill range treatment.",
      },
      { name: "Sweep speed", description: "" },
      { name: "Example volume", description: "" },
    ]
    for (const specimen of cases) {
      const thumb = page.getByRole("slider", { name: specimen.name, exact: true })
      await expect(thumb).toHaveCount(1)
      await expect(thumb).toHaveAccessibleName(specimen.name)
      await expect(thumb).toHaveAccessibleDescription(specimen.description)
      const root = thumb.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ml-slider ')][1]")
      await expect(root).not.toHaveAttribute("aria-label", /.+/)
      await expect(root).not.toHaveAttribute("aria-labelledby", /.+/)
      await expect(root).not.toHaveAttribute("aria-describedby", /.+/)
      if (specimen.name === "Lamp hue") {
        await expect(thumb).not.toHaveAttribute("aria-label", /.+/)
        await expect(thumb).toHaveAttribute("aria-labelledby", /.+/)
        await expect(thumb).toHaveAttribute("aria-describedby", /.+/)
      }
    }
    expectHealthy(health)
  })

  test("DNA assignments survive palette and property edits, then refresh at equal counts and remount", async ({ page }) => {
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
    const harmonyPalette = await parsedAttribute(review, "data-current-palette")
    const harmonyMapping = await parsedAttribute<Record<string, string>>(review, "data-current-mapping")
    const expectedHarmony = resolveBackgroundRoleColors({
      palette: harmonyPalette as never,
      adapter: backgroundPaletteRegistry["massage-lab-dna"],
      mapping: harmonyMapping,
      canCustomize: true,
    })
    const harmonyRootColors = await effectRoot(host).evaluate((root) => {
      const style = (root as HTMLElement).style
      return {
        background: style.getPropertyValue("--ml-dna-background-color"),
        "node-one": style.getPropertyValue("--ml-dna-node-color-0"),
        "node-two": style.getPropertyValue("--ml-dna-node-color-1"),
        "node-three": style.getPropertyValue("--ml-dna-node-color-2"),
        "node-four": style.getPropertyValue("--ml-dna-node-color-3"),
        connector: style.getPropertyValue("--ml-dna-connector-color"),
        outline: style.getPropertyValue("--ml-dna-outline-color"),
      }
    })
    expect(harmonyRootColors).toEqual(expectedHarmony)
    expect({ one: harmonyRootColors["node-one"], four: harmonyRootColors["node-four"] })
      .not.toEqual(customRootColors)
    await namedSlider(review, "Strand angle").press("ArrowRight")
    expect(await dnaAssignments(host)).toEqual(initialAssignments)

    await namedSlider(review, "Strand count").press("ArrowRight")
    await expect.poll(async () => {
      const refreshed = await dnaAssignments(host)
      return refreshed.length === initialAssignments.length + 1
        && refreshed.slice(0, initialAssignments.length).some((value, index) => value !== initialAssignments[index])
    }).toBe(true)
    await namedSlider(review, "Strand count").press("ArrowLeft")
    await expect.poll(async () => {
      const refreshed = await dnaAssignments(host)
      return refreshed.length === initialAssignments.length
        && refreshed.some((value, index) => value !== initialAssignments[index])
    }).toBe(true)
    const equalCountSettledAssignments = await dnaAssignments(host)
    await selectEffect(review, host, "massage-lab-twisted-cubes")
    await selectEffect(review, host, "massage-lab-dna")
    const remountedAssignments = await dnaAssignments(host)
    expect(remountedAssignments).toHaveLength(equalCountSettledAssignments.length)
    expect(remountedAssignments).not.toEqual(equalCountSettledAssignments)
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
    const harmonyPalette = await parsedAttribute(review, "data-current-palette")
    const harmonyMapping = await parsedAttribute<Record<string, string>>(review, "data-current-mapping")
    const resolvedHarmony = resolveBackgroundRoleColors({
      palette: harmonyPalette as never,
      adapter: backgroundPaletteRegistry["massage-lab-twisted-cubes"],
      mapping: harmonyMapping,
      canCustomize: true,
    })
    const harmonyAnchors = Array.from({ length: 6 }, (_, index) => (
      resolvedHarmony[`outline-${["one", "two", "three", "four", "five", "six"][index]}`]
    ))
    const expectedHarmony = Array.from({ length: harmony.length }, (_, index) => (
      interpolateTwistedCubeOutline({
        anchors: harmonyAnchors,
        oneBasedIndex: index + 1,
        count: harmony.length,
      })
    ))
    expect(harmony).toEqual(expectedHarmony)
    expect(harmony[0]).toBe(harmonyAnchors[0])
    expect(harmony.at(-1)).toBe(harmonyAnchors.at(-1))
    expect(harmony[9]).toBe(expectedHarmony[9])
    expectHealthy(health)
  })

  test("each effect exposes 11 named real sliders with canonical draft, Cancel, Apply, and rendered output", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    const controls = review.locator("[data-track-4b-property-controls]")
    for (const effect of EFFECTS) {
      await selectEffect(review, host, effect.id)
      await expect(review).toHaveAttribute("data-draft-state", "clean")
      await expect(controls.getByRole("slider")).toHaveCount(11)
      expect(await controls.getByRole("slider").evaluateAll((sliders) => (
        sliders.map((slider) => slider.getAttribute("aria-labelledby"))
      ))).toHaveLength(11)
      for (const label of effect.labels) {
        const slider = namedSlider(review, label)
        await expect(slider).toHaveCount(1)
        const before = await review.getAttribute("data-current-properties")
        await slider.press("ArrowRight")
        await expect(review).not.toHaveAttribute("data-current-properties", before ?? "")
      }
      await expectRenderedContract(host, effect.id)
      await expect(review).toHaveAttribute("data-draft-state", "dirty")

      const edited = await review.getAttribute("data-current-properties")
      await review.getByRole("button", { name: "Undo", exact: true }).click()
      await expect(review).not.toHaveAttribute("data-current-properties", edited ?? "")
      await review.getByRole("button", { name: "Redo", exact: true }).click()
      await expect(review).toHaveAttribute("data-current-properties", edited ?? "")
      await review.getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(review).toHaveAttribute("data-draft-state", "clean")
      expect(await parsedAttribute(review, "data-current-properties"))
        .toEqual(await parsedAttribute(review, "data-opening-properties"))
    }

    await selectEffect(review, host, "massage-lab-twisted-cubes")
    const twistedOpening = await parsedAttribute(review, "data-current-properties")
    await namedSlider(review, "Rotation speed").press("ArrowRight")
    const twistedApplied = await parsedAttribute(review, "data-current-properties")
    expect(twistedApplied).not.toEqual(twistedOpening)
    await review.getByRole("button", { name: "Apply", exact: true }).click()
    await expect(review).toHaveAttribute("data-draft-state", "clean")
    expect(await parsedAttribute(review, "data-applied-properties")).toEqual(twistedApplied)
    await namedSlider(review, "Layer stagger").press("ArrowRight")
    await review.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(await parsedAttribute(review, "data-current-properties")).toEqual(twistedApplied)
    expect(JSON.parse(await page.evaluate(() => (
      localStorage.getItem("massage-lab:dev:track-4b-review-applied") ?? "null"
    )))).toMatchObject({ properties: twistedApplied })

    await selectEffect(review, host, "massage-lab-dna")
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
    expectHealthy(health)
  })

  test("each effect retains bounded geometry and static motion across responsive viewports and real 200% page scale", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    const cdp = await page.context().newCDPSession(page)
    try {
      for (const effect of EFFECTS) {
        await selectEffect(review, host, effect.id)
        await expect(host).toHaveAttribute("data-background-diagnostic-reduced-motion", "true")
        await namedSlider(review, "Scale").press("End")
        await namedSlider(review, "Position X").press("End")
        await namedSlider(review, "Position Y").press("End")
        const saved = await parsedAttribute<Record<string, number>>(review, "data-current-properties")
        expect(saved[effect.scaleKey]).toBe(effect.maxScale)
        expect(saved[effect.positionXKey]).toBe(35)
        expect(saved[effect.positionYKey]).toBe(35)

        for (const viewport of [
          { name: "desktop", width: 1280, height: 900 },
          { name: "phone portrait", width: 390, height: 844 },
          { name: "short landscape", width: 844, height: 390 },
        ]) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height })
          const current = await parsedAttribute<Record<string, number>>(review, "data-current-properties")
          expect(current[effect.scaleKey], viewport.name).toBe(effect.maxScale)
          expect(current[effect.positionXKey], viewport.name).toBe(35)
          expect(current[effect.positionYKey], viewport.name).toBe(35)
          expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), viewport.name).toBe(false)
          await expectRenderedContract(host, effect.id, true)
        }

        await page.setViewportSize({ width: 640, height: 450 })
        await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 })
        await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(2)
        const scaleSlider = namedSlider(review, "Scale")
        await scaleSlider.scrollIntoViewIfNeeded()
        await scaleSlider.focus()
        const scaledLayout = await page.evaluate(() => {
          const active = document.activeElement as HTMLElement | null
          const rect = active?.getBoundingClientRect()
          const viewport = window.visualViewport
          return {
            activeRole: active?.getAttribute("role"),
            scale: viewport?.scale,
            focusVisible: Boolean(rect && viewport
              && rect.left >= viewport.offsetLeft - 1
              && rect.right <= viewport.offsetLeft + viewport.width + 1
              && rect.top >= viewport.offsetTop - 1
              && rect.bottom <= viewport.offsetTop + viewport.height + 1),
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          }
        })
        expect(scaledLayout).toEqual({ activeRole: "slider", scale: 2, focusVisible: true, overflow: false })
        await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 })
        await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)

        await page.setViewportSize({ width: 390, height: 844 })
        const sceneStyle = await effectRoot(host).locator(":scope > div").evaluate((scene, id) => {
          const prefix = id === "massage-lab-dna" ? "--ml-dna" : "--ml-twisted-cubes"
          const style = (scene as HTMLElement).style
          return {
            scale: style.getPropertyValue(`${prefix}-scale`),
            x: style.getPropertyValue(`${prefix}-position-x`),
            y: style.getPropertyValue(`${prefix}-position-y`),
          }
        }, effect.id)
        expect(sceneStyle).toEqual({ scale: "1", x: "20%", y: "20%" })
        await expectRenderedContract(host, effect.id, true)
      }
    } finally {
      await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 })
      await cdp.detach()
    }
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

    for (const effect of EFFECTS) {
      await selectEffect(review, host, effect.id)
      await expect(namedSlider(review, effect.labels[0])).toBeEnabled()
      await expectRenderedContract(host, effect.id)
      await review.getByLabel("Track 4B access").selectOption("owner")
      await expectLoaded(host, effect.id)
      await expect(namedSlider(review, effect.labels[0])).toBeEnabled()
      await review.getByLabel("Track 4B access").selectOption("locked")
      await expect(host).not.toHaveAttribute("data-background-id", effect.id)
      await expect(namedSlider(review, effect.labels[0])).toBeDisabled()
      await review.getByLabel("Track 4B access").selectOption("subscriber")
      await expectLoaded(host, effect.id)
    }

    await selectEffect(review, host, "massage-lab-dna")
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
