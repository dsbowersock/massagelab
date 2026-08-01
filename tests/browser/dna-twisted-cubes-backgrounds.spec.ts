import { expect, test, type Locator, type Page } from "@playwright/test"
import { backgroundPaletteRegistry } from "../../components/backgrounds/backgroundPaletteRegistry"
import { resolveResponsiveBackgroundTransform } from "../../lib/background-effect-layout.js"
import { resolveBackgroundRoleColors } from "../../lib/background-palette.js"
import {
  getDnaNodeCycleSeconds,
  getDnaStrandDelaySeconds,
  getDnaStrandPhase,
  getDnaStrandRotationSeconds,
} from "../../lib/dna-background.js"
import {
  getTwistedCubeAlpha,
  getTwistedCubeCycleSeconds,
  getTwistedCubeDelaySeconds,
  getTwistedCubeSourceOutline,
  interpolateTwistedCubeOutline,
} from "../../lib/twisted-cubes-background.js"
import { COMPUTED_CONSUMER_CONTRACTS } from "./dna-twisted-cubes-consumer-contract.mjs"

const EFFECTS = [
  {
    id: "massage-lab-dna",
    labels: [
      "Node motion speed", "Strand rotation speed", "Strand count", "Strand angle",
      "Strand spacing", "Scale", "Position X", "Position Y", "Connector width",
      "Connector thickness", "Outline thickness",
    ],
    controls: COMPUTED_CONSUMER_CONTRACTS.filter(({ effectId }) => effectId === "massage-lab-dna"),
    scaleKey: "massageLabDnaScale",
    positionXKey: "massageLabDnaPositionX",
    positionYKey: "massageLabDnaPositionY",
    maxScale: 1.2,
    endValues: {
      massageLabDnaNodeMotionSpeed: 3,
      massageLabDnaStrandRotationSpeed: 3,
      massageLabDnaStrandCount: 25,
      massageLabDnaStrandAngle: 180,
      massageLabDnaStrandSpacing: 2,
      massageLabDnaScale: 1.2,
      massageLabDnaPositionX: 35,
      massageLabDnaPositionY: 35,
      massageLabDnaConnectorWidth: 100,
      massageLabDnaConnectorThickness: 60,
      massageLabDnaOutlineThickness: 1.5,
    },
  },
  {
    id: "massage-lab-twisted-cubes",
    labels: [
      "Rotation speed", "Layer stagger", "View angle X", "View angle Y", "Layer count",
      "Layer depth", "Scale", "Position X", "Position Y", "Fade falloff",
      "Relative outline thickness",
    ],
    controls: COMPUTED_CONSUMER_CONTRACTS.filter(({ effectId }) => effectId === "massage-lab-twisted-cubes"),
    scaleKey: "massageLabTwistedCubesScale",
    positionXKey: "massageLabTwistedCubesPositionX",
    positionYKey: "massageLabTwistedCubesPositionY",
    maxScale: 1.2,
    endValues: {
      massageLabTwistedCubesRotationSpeed: 3,
      massageLabTwistedCubesLayerStagger: 0.3,
      massageLabTwistedCubesViewAngleX: 80,
      massageLabTwistedCubesViewAngleY: 80,
      massageLabTwistedCubesLayerCount: 30,
      massageLabTwistedCubesLayerDepthSpacing: 70,
      massageLabTwistedCubesScale: 1.2,
      massageLabTwistedCubesPositionX: 35,
      massageLabTwistedCubesPositionY: 35,
      massageLabTwistedCubesOpacityFalloff: 0.95,
      massageLabTwistedCubesOutlineThickness: 0.02,
    },
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
    const animationName = await root.locator(":scope > div > div").evaluate((element) => getComputedStyle(element).animationName)
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
        "--ml-twisted-cubes-size", "--ml-twisted-cubes-outline-thickness",
      ].map((name) => style.getPropertyValue(name))
    })
    expect(layerVars.every(Boolean)).toBe(true)
    const animationName = await firstLayer.locator(":scope > span")
      .evaluate((element) => getComputedStyle(element).animationName)
    if (reducedMotion) expect(animationName).toBe("none")
    else expect(animationName).toContain("mlTwistedCubesRotate")
  }
}

async function captureControlRenderState(host: Locator, id: typeof EFFECTS[number]["id"]) {
  const root = effectRoot(host)
  if (id === "massage-lab-dna") {
    return root.evaluate((element) => {
      const rootElement = element as HTMLElement
      const rootStyle = rootElement.style
      const sceneStyle = (rootElement.firstElementChild as HTMLElement).style
      const strands = Array.from(rootElement.querySelectorAll<HTMLElement>('[style*="--ml-dna-start-color"]'))
      const firstStyle = strands[0]?.style
      return {
        background: rootStyle.getPropertyValue("--ml-dna-background-color"),
        nodeOne: rootStyle.getPropertyValue("--ml-dna-node-color-0"),
        nodeFour: rootStyle.getPropertyValue("--ml-dna-node-color-3"),
        connectorColor: rootStyle.getPropertyValue("--ml-dna-connector-color"),
        outlineColor: rootStyle.getPropertyValue("--ml-dna-outline-color"),
        strandAngle: rootStyle.getPropertyValue("--ml-dna-strand-angle"),
        strandSpacing: rootStyle.getPropertyValue("--ml-dna-strand-spacing"),
        connectorWidth: rootStyle.getPropertyValue("--ml-dna-connector-width"),
        connectorThickness: rootStyle.getPropertyValue("--ml-dna-connector-thickness"),
        outlineThickness: rootStyle.getPropertyValue("--ml-dna-outline-thickness"),
        rotationDuration: rootStyle.getPropertyValue("--ml-dna-rotation-duration"),
        scale: sceneStyle.getPropertyValue("--ml-dna-scale"),
        positionX: sceneStyle.getPropertyValue("--ml-dna-position-x"),
        positionY: sceneStyle.getPropertyValue("--ml-dna-position-y"),
        strandCount: strands.length,
        firstPhase: firstStyle?.getPropertyValue("--ml-dna-phase") ?? "",
        firstNodeDuration: firstStyle?.getPropertyValue("--ml-dna-node-duration") ?? "",
        firstNodeDelay: firstStyle?.getPropertyValue("--ml-dna-node-delay") ?? "",
      }
    })
  }

  return root.evaluate((element) => {
    const rootElement = element as HTMLElement
    const rootStyle = rootElement.style
    const sceneStyle = (rootElement.firstElementChild as HTMLElement).style
    const layers = Array.from(rootElement.querySelectorAll<HTMLElement>('[style*="--ml-twisted-cubes-outline"]'))
    const firstStyle = layers[0]?.style
    const secondStyle = layers[1]?.style
    const middleStyle = layers[Math.floor(layers.length / 2)]?.style
    return {
      background: rootStyle.getPropertyValue("--ml-twisted-cubes-background-color"),
      cycle: rootStyle.getPropertyValue("--ml-twisted-cubes-cycle"),
      viewAngleX: rootStyle.getPropertyValue("--ml-twisted-cubes-view-angle-x"),
      viewAngleY: rootStyle.getPropertyValue("--ml-twisted-cubes-view-angle-y"),
      scale: sceneStyle.getPropertyValue("--ml-twisted-cubes-scale"),
      positionX: sceneStyle.getPropertyValue("--ml-twisted-cubes-position-x"),
      positionY: sceneStyle.getPropertyValue("--ml-twisted-cubes-position-y"),
      layerCount: layers.length,
      firstOutline: firstStyle?.getPropertyValue("--ml-twisted-cubes-outline") ?? "",
      middleOutline: middleStyle?.getPropertyValue("--ml-twisted-cubes-outline") ?? "",
      firstAlpha: firstStyle?.getPropertyValue("--ml-twisted-cubes-alpha") ?? "",
      firstDelay: firstStyle?.getPropertyValue("--ml-twisted-cubes-delay") ?? "",
      secondDepth: secondStyle?.getPropertyValue("--ml-twisted-cubes-depth") ?? "",
      firstSize: firstStyle?.getPropertyValue("--ml-twisted-cubes-size") ?? "",
      firstOutlineThickness: firstStyle?.getPropertyValue("--ml-twisted-cubes-outline-thickness") ?? "",
    }
  })
}

/** Captures the concrete CSS consumers, not their custom-property declarations. */
async function captureComputedConsumerState(host: Locator, id: typeof EFFECTS[number]["id"]) {
  const root = effectRoot(host)
  if (id === "massage-lab-dna") {
    return root.evaluate((element) => {
      const rootElement = element as HTMLElement
      const scene = rootElement.firstElementChild as HTMLElement
      const strands = Array.from(rootElement.querySelectorAll<HTMLElement>('[style*="--ml-dna-start-color"]'))
      const first = strands[0]
      const last = strands.at(-1)
      const connector = first?.children[0] as HTMLElement
      const startNode = first?.querySelector<HTMLElement>('[data-side="start"]')
      const endNode = first?.querySelector<HTMLElement>('[data-side="end"]')
      for (const animation of rootElement.getAnimations({ subtree: true })) {
        animation.pause()
        animation.currentTime = 0
      }
      const rootCss = getComputedStyle(rootElement)
      const sceneCss = getComputedStyle(scene)
      const compositionCss = getComputedStyle(scene.firstElementChild as HTMLElement)
      const strandCss = getComputedStyle(first as HTMLElement)
      const lastCss = getComputedStyle(last as HTMLElement)
      const connectorCss = getComputedStyle(connector)
      const startCss = getComputedStyle(startNode as HTMLElement)
      const endCss = getComputedStyle(endNode as HTMLElement)
      return {
        rootBackground: rootCss.backgroundColor,
        rootFontSize: rootCss.fontSize,
        sceneTransform: sceneCss.transform,
        sceneRotate: compositionCss.rotate,
        sceneAnimationName: compositionCss.animationName,
        sceneDuration: compositionCss.animationDuration,
        sceneRowGap: compositionCss.rowGap,
        scenePerspective: sceneCss.perspective,
        sceneWidth: sceneCss.width,
        sceneHeight: sceneCss.height,
        strandCount: strands.length,
        nodeCount: rootElement.querySelectorAll("[data-side]").length,
        firstTop: strandCss.top,
        lastTop: lastCss.top,
        strandWidth: strandCss.width,
        strandHeight: strandCss.height,
        strandMarginLeft: strandCss.marginLeft,
        strandMarginTop: strandCss.marginTop,
        strandTransform: strandCss.transform,
        strandAnimationName: strandCss.animationName,
        strandDuration: strandCss.animationDuration,
        strandDelay: strandCss.animationDelay,
        connectorWidth: connectorCss.width,
        connectorHeight: connectorCss.height,
        connectorBorderWidth: connectorCss.borderTopWidth,
        connectorBorderColor: connectorCss.borderTopColor,
        connectorBackground: connectorCss.backgroundColor,
        connectorTransform: connectorCss.transform,
        connectorAnimationName: connectorCss.animationName,
        connectorDuration: connectorCss.animationDuration,
        connectorDelay: connectorCss.animationDelay,
        startNodeWidth: startCss.width,
        startNodeHeight: startCss.height,
        startNodeBorderWidth: startCss.borderTopWidth,
        startNodeBorderColor: startCss.borderTopColor,
        startNodeTransform: startCss.transform,
        startNodeAnimationName: startCss.animationName,
        startNodeDuration: startCss.animationDuration,
        startNodeDelay: startCss.animationDelay,
        endNodeWidth: endCss.width,
        endNodeHeight: endCss.height,
        endNodeBorderWidth: endCss.borderTopWidth,
        endNodeBorderColor: endCss.borderTopColor,
        endNodeTransform: endCss.transform,
        endNodeAnimationName: endCss.animationName,
        endNodeDuration: endCss.animationDuration,
        endNodeDelay: endCss.animationDelay,
      }
    })
  }

  return root.evaluate((element) => {
    const rootElement = element as HTMLElement
    const scene = rootElement.firstElementChild as HTMLElement
    const view = scene.firstElementChild as HTMLElement
    const layers = Array.from(rootElement.querySelectorAll<HTMLElement>('[style*="--ml-twisted-cubes-outline"]'))
    const firstLayer = layers[0]
    const secondLayer = layers[1]
    const firstCube = firstLayer?.firstElementChild as HTMLElement
    const firstFace = firstLayer?.querySelector<HTMLElement>(":scope > span > span > span")
    const cubeAnimation = firstCube?.getAnimations()[0]
    if (cubeAnimation) {
      cubeAnimation.pause()
      cubeAnimation.currentTime = 0
    }
    const rootCss = getComputedStyle(rootElement)
    const sceneCss = getComputedStyle(scene)
    const viewCss = getComputedStyle(view)
    const firstLayerCss = getComputedStyle(firstLayer)
    const secondLayerCss = getComputedStyle(secondLayer)
    const cubeCss = getComputedStyle(firstCube)
    const faceCss = getComputedStyle(firstFace as HTMLElement)
    return {
      rootBackground: rootCss.backgroundColor,
      sceneTransform: sceneCss.transform,
      scenePerspective: sceneCss.perspective,
      sceneWidth: sceneCss.width,
      sceneHeight: sceneCss.height,
      viewTransform: viewCss.transform,
      layerCount: layers.length,
      faceCount: rootElement.querySelectorAll('[style*="--ml-twisted-cubes-outline"] > span > span > span').length,
      firstLayerTransform: firstLayerCss.transform,
      secondLayerTransform: secondLayerCss.transform,
      cubeTransform: cubeCss.transform,
      cubeAnimationName: cubeCss.animationName,
      cubeDuration: cubeCss.animationDuration,
      cubeDelay: cubeCss.animationDelay,
      faceWidth: faceCss.width,
      faceHeight: faceCss.height,
      faceOpacity: faceCss.opacity,
      faceBorderWidth: faceCss.borderTopWidth,
      faceBorderColor: faceCss.borderTopColor,
      faceBackground: faceCss.backgroundColor,
    }
  })
}

async function normalizeComputedConsumer(
  host: Locator,
  styles: Record<string, string>,
  dimensions?: { width: string; height: string },
  containingBlock?: { width: string; height: string },
) {
  return host.evaluate((_, input: {
    styles: Record<string, string>
    dimensions?: { width: string; height: string }
    containingBlock?: { width: string; height: string }
  }) => {
    const { styles: inputStyles, dimensions: inputDimensions, containingBlock: inputContainingBlock } = input
    const specimen = document.createElement("span")
    specimen.style.position = "fixed"
    specimen.style.display = "block"
    if (inputDimensions) {
      specimen.style.width = inputDimensions.width
      specimen.style.height = inputDimensions.height
    }
    for (const [name, value] of Object.entries(inputStyles)) specimen.style.setProperty(name, value)
    const container = inputContainingBlock ? document.createElement("div") : null
    if (container && inputContainingBlock) {
      container.style.position = "fixed"
      container.style.width = inputContainingBlock.width
      container.style.height = inputContainingBlock.height
      container.append(specimen)
      document.body.append(container)
    } else {
      document.body.append(specimen)
    }
    const css = getComputedStyle(specimen)
const normalized = {
      transform: css.transform,
      backgroundColor: css.backgroundColor,
      borderTopWidth: css.borderTopWidth,
      borderTopColor: css.borderTopColor,
      opacity: css.opacity,
      animationDuration: css.animationDuration,
      animationDelay: css.animationDelay,
      top: css.top,
      width: css.width,
      height: css.height,
      perspective: css.perspective,
      rotate: css.rotate,
      rowGap: css.rowGap,
    }
    if (container) container.remove()
    else specimen.remove()
    return normalized
  }, { styles, dimensions, containingBlock })
}

async function normalizeTransformForTarget(target: Locator, transform: string) {
  return target.evaluate((element, expectedTransform) => {
    const specimen = element.cloneNode(false) as HTMLElement
    specimen.style.visibility = "hidden"
    specimen.style.animation = "none"
    specimen.style.transform = expectedTransform
    element.parentElement?.append(specimen)
    const normalized = getComputedStyle(specimen).transform
    specimen.remove()
    return normalized
  }, transform)
}

/** Reconstructs only the fixed source grid so percentage/vmin controls have an independent geometry oracle. */
async function normalizeDnaGeometry(
  host: Locator,
  input: { count: number; spacing: number; connectorWidth: number; connectorThickness: number; outlineThickness: number },
) {
  return host.evaluate((_, options) => {
    const scene = document.createElement("div")
    scene.style.cssText = `position:fixed;visibility:hidden;height:65vmin;aspect-ratio:2/5;display:grid;gap:${options.spacing}vmin`
    const strands = Array.from({ length: options.count }, () => {
      const strand = document.createElement("div")
      strand.style.cssText = "position:relative;display:flex;width:100%;min-block-size:0"
      const connector = document.createElement("span")
      connector.style.cssText = `position:absolute;box-sizing:border-box;width:${options.connectorWidth}%;height:${options.connectorThickness}%;border:${options.outlineThickness}vmin solid black`
      const node = document.createElement("span")
      node.style.cssText = `position:relative;box-sizing:border-box;height:100%;aspect-ratio:1;border:${options.outlineThickness}vmin solid black`
      strand.append(connector, node)
      scene.append(strand)
      return { strand, connector, node }
    })
    document.body.append(scene)
    const first = strands[0]
    const result = {
      sceneWidth: getComputedStyle(scene).width,
      sceneHeight: getComputedStyle(scene).height,
      rowGap: getComputedStyle(scene).rowGap,
      strandWidth: getComputedStyle(first.strand).width,
      strandHeight: getComputedStyle(first.strand).height,
      connectorWidth: getComputedStyle(first.connector).width,
      connectorHeight: getComputedStyle(first.connector).height,
      nodeWidth: getComputedStyle(first.node).width,
      nodeHeight: getComputedStyle(first.node).height,
    }
    scene.remove()
    return result
  }, input)
}

/** Independently samples a reconstructed animation at CSS time zero, including negative delays. */
async function normalizeAnimatedTransformForTarget(
  target: Locator,
  keyframes: Keyframe[],
  timing: { duration: number; delay: number; easing: string; iterations: number; direction?: PlaybackDirection },
) {
  return target.evaluate((element, input) => {
    const specimen = element.cloneNode(false) as HTMLElement
    specimen.style.visibility = "hidden"
    specimen.style.animation = "none"
    element.parentElement?.append(specimen)
    const animation = specimen.animate(input.keyframes, input.timing)
    animation.pause()
    animation.currentTime = 0
    const normalized = getComputedStyle(specimen).transform
    animation.cancel()
    specimen.remove()
    return normalized
  }, { keyframes, timing })
}

const ALLOWED_RENDER_CHANGES: Record<string, readonly string[]> = {
  massageLabDnaNodeMotionSpeed: ["firstNodeDuration", "firstNodeDelay"],
  massageLabDnaStrandRotationSpeed: ["rotationDuration"],
  massageLabDnaStrandCount: ["strandCount", "firstPhase", "firstNodeDelay"],
  massageLabDnaStrandAngle: ["strandAngle"],
  massageLabDnaStrandSpacing: ["strandSpacing"],
  massageLabDnaScale: ["scale"],
  massageLabDnaPositionX: ["positionX"],
  massageLabDnaPositionY: ["positionY"],
  massageLabDnaConnectorWidth: ["connectorWidth"],
  massageLabDnaConnectorThickness: ["connectorThickness"],
  massageLabDnaOutlineThickness: ["outlineThickness"],
  massageLabTwistedCubesRotationSpeed: ["cycle"],
  massageLabTwistedCubesLayerStagger: ["firstDelay"],
  massageLabTwistedCubesViewAngleX: ["viewAngleX"],
  massageLabTwistedCubesViewAngleY: ["viewAngleY"],
  massageLabTwistedCubesLayerCount: ["layerCount", "middleOutline", "firstAlpha", "firstDelay", "firstSize"],
  massageLabTwistedCubesLayerDepthSpacing: ["secondDepth"],
  massageLabTwistedCubesScale: ["scale"],
  massageLabTwistedCubesPositionX: ["positionX"],
  massageLabTwistedCubesPositionY: ["positionY"],
  massageLabTwistedCubesOpacityFalloff: ["firstAlpha"],
  massageLabTwistedCubesOutlineThickness: ["firstOutlineThickness"],
}

async function expectExactControlRender({
  review,
  host,
  id,
  key,
  properties,
  before,
}: {
  review: Locator
  host: Locator
  id: typeof EFFECTS[number]["id"]
  key: string
  properties: Record<string, number>
  before: Record<string, string | number>
}) {
  const compactViewport = await host.evaluate(() => (
    window.matchMedia("(max-width: 479px), (max-height: 479px)").matches
  ))
  if (key === "massageLabDnaStrandCount") {
    await expect.poll(() => effectRoot(host).locator('[style*="--ml-dna-start-color"]').count())
      .toBe(properties.massageLabDnaStrandCount)
  }
  if (key === "massageLabTwistedCubesLayerCount") {
    await expect.poll(() => effectRoot(host).locator('[style*="--ml-twisted-cubes-outline"]').count())
      .toBe(properties.massageLabTwistedCubesLayerCount)
  }
  const after = await captureControlRenderState(host, id) as Record<string, string | number>
  const allowedChanges = new Set(ALLOWED_RENDER_CHANGES[key] ?? [])
  for (const [sentinel, value] of Object.entries(before)) {
    if (!allowedChanges.has(sentinel)) expect(after[sentinel], `${key} changed ${sentinel}`).toBe(value)
  }

  if (id === "massage-lab-dna") {
    const count = properties.massageLabDnaStrandCount
    const firstPhase = getDnaStrandPhase({ oneBasedIndex: 1, total: count })
    const transform = resolveResponsiveBackgroundTransform({
      scale: properties.massageLabDnaScale,
      positionX: properties.massageLabDnaPositionX,
      positionY: properties.massageLabDnaPositionY,
      compactViewport,
    })
    const expectedByKey: Record<string, Partial<typeof after>> = {
      massageLabDnaNodeMotionSpeed: {
        firstNodeDuration: `${getDnaNodeCycleSeconds(properties.massageLabDnaNodeMotionSpeed)}s`,
        firstNodeDelay: `${getDnaStrandDelaySeconds({ oneBasedIndex: 1, total: count, speed: properties.massageLabDnaNodeMotionSpeed })}s`,
      },
      massageLabDnaStrandRotationSpeed: {
        rotationDuration: `${getDnaStrandRotationSeconds(properties.massageLabDnaStrandRotationSpeed)}s`,
      },
      massageLabDnaStrandCount: {
        strandCount: count,
        firstPhase: String(firstPhase),
        firstNodeDelay: `${getDnaStrandDelaySeconds({ oneBasedIndex: 1, total: count, speed: properties.massageLabDnaNodeMotionSpeed })}s`,
      },
      massageLabDnaStrandAngle: { strandAngle: `${properties.massageLabDnaStrandAngle}deg` },
      massageLabDnaStrandSpacing: {
        strandSpacing: `${properties.massageLabDnaStrandSpacing}vmin`,
      },
      massageLabDnaScale: { scale: String(transform.scale) },
      massageLabDnaPositionX: { positionX: `${transform.positionX}%` },
      massageLabDnaPositionY: { positionY: `${transform.positionY}%` },
      massageLabDnaConnectorWidth: {
        connectorWidth: `${properties.massageLabDnaConnectorWidth}%`,
      },
      massageLabDnaConnectorThickness: {
        connectorThickness: `${properties.massageLabDnaConnectorThickness}%`,
      },
      massageLabDnaOutlineThickness: { outlineThickness: `${properties.massageLabDnaOutlineThickness}vmin` },
    }
    expect(after).toMatchObject(expectedByKey[key])
    return
  }

  const count = properties.massageLabTwistedCubesLayerCount
  const transform = resolveResponsiveBackgroundTransform({
    scale: properties.massageLabTwistedCubesScale,
    positionX: properties.massageLabTwistedCubesPositionX,
    positionY: properties.massageLabTwistedCubesPositionY,
    compactViewport,
  })
  const roleColors = await resolveCurrentRoleColors(review, id)
  const outlineAnchors = ["one", "two", "three", "four", "five", "six"].map(
    (name) => roleColors[`outline-${name}`],
  )
  const middleOneBasedIndex = Math.floor(count / 2) + 1
  const middleOutline = await review.getAttribute("data-palette-mode") === "source"
    ? getTwistedCubeSourceOutline({ oneBasedIndex: middleOneBasedIndex, count })
    : interpolateTwistedCubeOutline({
      anchors: outlineAnchors,
      oneBasedIndex: middleOneBasedIndex,
      count,
    })
  const expectedByKey: Record<string, Partial<typeof after>> = {
    massageLabTwistedCubesRotationSpeed: {
      cycle: `${getTwistedCubeCycleSeconds(properties.massageLabTwistedCubesRotationSpeed)}s`,
    },
    massageLabTwistedCubesLayerStagger: {
      firstDelay: `${getTwistedCubeDelaySeconds({ oneBasedIndex: 1, count, stagger: properties.massageLabTwistedCubesLayerStagger })}s`,
      firstSize: `${50 / count}vmin`,
    },
    massageLabTwistedCubesViewAngleX: { viewAngleX: `${properties.massageLabTwistedCubesViewAngleX}deg` },
    massageLabTwistedCubesViewAngleY: { viewAngleY: `${properties.massageLabTwistedCubesViewAngleY}deg` },
    massageLabTwistedCubesLayerCount: {
      layerCount: count,
      middleOutline,
      firstAlpha: String(getTwistedCubeAlpha({ oneBasedIndex: 1, count, opacityFalloff: properties.massageLabTwistedCubesOpacityFalloff })),
      firstDelay: `${getTwistedCubeDelaySeconds({ oneBasedIndex: 1, count, stagger: properties.massageLabTwistedCubesLayerStagger })}s`,
      firstSize: `${50 / count}vmin`,
    },
    massageLabTwistedCubesLayerDepthSpacing: { secondDepth: `${-properties.massageLabTwistedCubesLayerDepthSpacing}vmin` },
    massageLabTwistedCubesScale: { scale: String(transform.scale) },
    massageLabTwistedCubesPositionX: { positionX: `${transform.positionX}%` },
    massageLabTwistedCubesPositionY: { positionY: `${transform.positionY}%` },
    massageLabTwistedCubesOpacityFalloff: {
      firstAlpha: String(getTwistedCubeAlpha({ oneBasedIndex: 1, count, opacityFalloff: properties.massageLabTwistedCubesOpacityFalloff })),
    },
    massageLabTwistedCubesOutlineThickness: {
      firstOutlineThickness: String(properties.massageLabTwistedCubesOutlineThickness),
    },
  }
  expect(after).toMatchObject(expectedByKey[key])
}

async function expectExactComputedConsumer({
  host,
  id,
  contract,
  properties,
  before,
}: {
  host: Locator
  id: typeof EFFECTS[number]["id"]
  contract: { key: string; allowedCouplings: readonly string[] }
  properties: Record<string, number>
  before: Record<string, string | number>
}) {
  const { key } = contract
  const after = await captureComputedConsumerState(host, id) as Record<string, string | number>
  const allowedChanges = new Set(contract.allowedCouplings)
  for (const [sentinel, value] of Object.entries(before)) {
    if (!allowedChanges.has(sentinel)) expect(after[sentinel], `${key} rewired computed ${sentinel}`).toBe(value)
  }
  const compactViewport = await host.evaluate(() => (
    window.matchMedia("(max-width: 479px), (max-height: 479px)").matches
  ))

  if (id === "massage-lab-dna") {
    const count = properties.massageLabDnaStrandCount
    const transform = resolveResponsiveBackgroundTransform({
      scale: properties.massageLabDnaScale,
      positionX: properties.massageLabDnaPositionX,
      positionY: properties.massageLabDnaPositionY,
      compactViewport,
    })
    const sceneExpected = await normalizeTransformForTarget(
      effectRoot(host).locator(":scope > div"),
      `translate(calc(-50% + ${transform.positionX}%), calc(-50% + ${transform.positionY}%)) scale(${transform.scale})`,
    )
    const sceneRotateExpected = await normalizeComputedConsumer(host, {
      rotate: `${properties.massageLabDnaStrandAngle}deg`,
    })
    const borderExpected = await normalizeComputedConsumer(host, {
      border: `${properties.massageLabDnaOutlineThickness}vmin solid black`,
    })
    const geometryExpected = await normalizeDnaGeometry(host, {
      count,
      spacing: properties.massageLabDnaStrandSpacing,
      connectorWidth: properties.massageLabDnaConnectorWidth,
      connectorThickness: properties.massageLabDnaConnectorThickness,
      outlineThickness: properties.massageLabDnaOutlineThickness,
    })
    const nodeDurationSeconds = getDnaNodeCycleSeconds(properties.massageLabDnaNodeMotionSpeed)
    const firstDelaySeconds = getDnaStrandDelaySeconds({
      oneBasedIndex: 1,
      total: count,
      speed: properties.massageLabDnaNodeMotionSpeed,
    })
    const connectorTiming = {
      duration: nodeDurationSeconds * 1000,
      delay: firstDelaySeconds * 1000,
      easing: "linear",
      iterations: Number.POSITIVE_INFINITY,
    }
    const nodeTiming = connectorTiming
    const firstStrand = effectRoot(host).locator('[style*="--ml-dna-start-color"]').first()
    const connectorTarget = firstStrand.locator(":scope > span").first()
    const startNodeTarget = firstStrand.locator('[data-side="start"]')
    const endNodeTarget = firstStrand.locator('[data-side="end"]')
    const expectedAnimatedTransforms = async () => ({
      connectorTransform: await normalizeAnimatedTransformForTarget(connectorTarget, [
        { transform: "translate3d(-50%, -50%, -2px) scaleX(1)", offset: 0 },
        { transform: "translate3d(-50%, -50%, -2px) scaleX(0)", offset: 0.25 },
        { transform: "translate3d(-50%, -50%, -2px) scaleX(1)", offset: 0.5 },
        { transform: "translate3d(-50%, -50%, -2px) scaleX(0)", offset: 0.75 },
        { transform: "translate3d(-50%, -50%, -2px) scaleX(1)", offset: 1 },
      ], connectorTiming),
      startNodeTransform: await normalizeAnimatedTransformForTarget(startNodeTarget, [
        { transform: "translateX(0)", offset: 0, easing: "ease-in-out" },
        { transform: "translateX(calc(26vmin - 100%))", offset: 0.5, easing: "ease-in-out" },
        { transform: "translateX(0)", offset: 1 },
      ], nodeTiming),
      endNodeTransform: await normalizeAnimatedTransformForTarget(endNodeTarget, [
        { transform: "translateX(0)", offset: 0, easing: "ease-in-out" },
        { transform: "translateX(calc(-26vmin + 100%))", offset: 0.5, easing: "ease-in-out" },
        { transform: "translateX(0)", offset: 1 },
      ], { ...nodeTiming, direction: "reverse" }),
    })
    const expectAnimatedTransforms = async () => {
      const expected = await expectedAnimatedTransforms()
      expect(after.connectorTransform).toBe(expected.connectorTransform)
      expect(after.startNodeTransform).toBe(expected.startNodeTransform)
      expect(after.endNodeTransform).toBe(expected.endNodeTransform)
    }

    switch (key) {
      case "massageLabDnaNodeMotionSpeed":
        {
          const timingExpected = await normalizeComputedConsumer(host, {
            "animation-duration": `${getDnaNodeCycleSeconds(properties[key])}s`,
            "animation-delay": `${getDnaStrandDelaySeconds({
              oneBasedIndex: 1,
              total: count,
              speed: properties[key],
            })}s`,
          })
          expect(after.connectorDuration).toBe(timingExpected.animationDuration)
          expect(after.startNodeDuration).toBe(timingExpected.animationDuration)
          expect(after.endNodeDuration).toBe(timingExpected.animationDuration)
          expect(after.connectorDelay).toBe(timingExpected.animationDelay)
          expect(after.startNodeDelay).toBe(timingExpected.animationDelay)
          expect(after.endNodeDelay).toBe(timingExpected.animationDelay)
          await expectAnimatedTransforms()
        }
        break
      case "massageLabDnaStrandRotationSpeed":
        {
          const timingExpected = await normalizeComputedConsumer(host, {
            "animation-duration": `${getDnaStrandRotationSeconds(properties[key])}s`,
          })
          expect(after.sceneDuration).toBe(timingExpected.animationDuration)
        }
        break
      case "massageLabDnaStrandCount":
        expect(after.strandCount).toBe(count)
        expect(after.nodeCount).toBe(count * 2)
        expect(after.strandHeight).toBe(geometryExpected.strandHeight)
        expect(after.connectorHeight).toBe(geometryExpected.connectorHeight)
        expect(after.startNodeWidth).toBe(geometryExpected.nodeWidth)
        expect(after.startNodeHeight).toBe(geometryExpected.nodeHeight)
        expect(after.endNodeWidth).toBe(geometryExpected.nodeWidth)
        expect(after.endNodeHeight).toBe(geometryExpected.nodeHeight)
        {
          const delayExpected = await normalizeComputedConsumer(host, {
            "animation-delay": `${firstDelaySeconds}s`,
          })
          expect(after.connectorDelay).toBe(delayExpected.animationDelay)
          expect(after.startNodeDelay).toBe(delayExpected.animationDelay)
          expect(after.endNodeDelay).toBe(delayExpected.animationDelay)
          await expectAnimatedTransforms()
        }
        break
      case "massageLabDnaStrandAngle":
        expect(after.sceneRotate).toBe(sceneRotateExpected.rotate)
        break
      case "massageLabDnaStrandSpacing":
        expect(after.sceneRowGap).toBe(geometryExpected.rowGap)
        expect(after.strandHeight).toBe(geometryExpected.strandHeight)
        expect(after.connectorHeight).toBe(geometryExpected.connectorHeight)
        expect(after.startNodeWidth).toBe(geometryExpected.nodeWidth)
        expect(after.startNodeHeight).toBe(geometryExpected.nodeHeight)
        expect(after.endNodeWidth).toBe(geometryExpected.nodeWidth)
        expect(after.endNodeHeight).toBe(geometryExpected.nodeHeight)
        await expectAnimatedTransforms()
        break
      case "massageLabDnaScale":
      case "massageLabDnaPositionX":
      case "massageLabDnaPositionY":
        expect(after.sceneTransform).toBe(sceneExpected)
        break
      case "massageLabDnaConnectorWidth":
        expect(after.connectorWidth).toBe(geometryExpected.connectorWidth)
        await expectAnimatedTransforms()
        break
      case "massageLabDnaConnectorThickness":
        expect(after.connectorHeight).toBe(geometryExpected.connectorHeight)
        await expectAnimatedTransforms()
        break
      case "massageLabDnaOutlineThickness":
        expect(after.connectorBorderWidth).toBe(borderExpected.borderTopWidth)
        expect(after.startNodeBorderWidth).toBe(borderExpected.borderTopWidth)
        expect(after.endNodeBorderWidth).toBe(borderExpected.borderTopWidth)
        expect(after.connectorHeight).toBe(geometryExpected.connectorHeight)
        expect(after.startNodeWidth).toBe(geometryExpected.nodeWidth)
        expect(after.startNodeHeight).toBe(geometryExpected.nodeHeight)
        expect(after.endNodeWidth).toBe(geometryExpected.nodeWidth)
        expect(after.endNodeHeight).toBe(geometryExpected.nodeHeight)
        await expectAnimatedTransforms()
        break
      default:
        throw new Error(`Missing DNA computed consumer assertion for ${key}.`)
    }
    return
  }

  const count = properties.massageLabTwistedCubesLayerCount
  const transform = resolveResponsiveBackgroundTransform({
    scale: properties.massageLabTwistedCubesScale,
    positionX: properties.massageLabTwistedCubesPositionX,
    positionY: properties.massageLabTwistedCubesPositionY,
    compactViewport,
  })
  const sceneExpected = await normalizeTransformForTarget(
    effectRoot(host).locator(":scope > div"),
    `translate(calc(-50% + ${transform.positionX}%), calc(-50% + ${transform.positionY}%)) scale(${transform.scale})`,
  )
  const viewExpected = await normalizeComputedConsumer(host, {
    transform: `rotateX(${properties.massageLabTwistedCubesViewAngleX}deg) rotateY(${properties.massageLabTwistedCubesViewAngleY}deg)`,
  })
  const secondLayerExpected = await normalizeComputedConsumer(host, {
    transform: `translateZ(${-properties.massageLabTwistedCubesLayerDepthSpacing}vmin)`,
  })
  const faceBorderExpected = await normalizeComputedConsumer(host, {
    border: `calc(${properties.massageLabTwistedCubesOutlineThickness} * 50vmin) solid black`,
  })
  const cubeDurationSeconds = getTwistedCubeCycleSeconds(properties.massageLabTwistedCubesRotationSpeed)
  const firstCubeDelaySeconds = getTwistedCubeDelaySeconds({
    oneBasedIndex: 1,
    count,
    stagger: properties.massageLabTwistedCubesLayerStagger,
  })
  const firstCube = effectRoot(host)
    .locator('[style*="--ml-twisted-cubes-outline"]')
    .first()
    .locator(":scope > span")
  const expectedCubeTransform = async () => normalizeAnimatedTransformForTarget(firstCube, [
    { transform: "translate(-50%, -50%) rotateZ(0deg) rotateX(0deg) rotateZ(0deg)", offset: 0, easing: "cubic-bezier(0.5, 0.1, 0.5, 0.9)" },
    { transform: "translate(-50%, -50%) rotateZ(90deg) rotateX(0deg) rotateZ(0deg)", offset: 0.33, easing: "cubic-bezier(0.5, 0.1, 0.5, 0.9)" },
    { transform: "translate(-50%, -50%) rotateZ(90deg) rotateX(90deg) rotateZ(0deg)", offset: 0.66, easing: "cubic-bezier(0.5, 0.1, 0.5, 0.9)" },
    { transform: "translate(-50%, -50%) rotateZ(90deg) rotateX(90deg) rotateZ(90deg)", offset: 1 },
  ], {
    duration: cubeDurationSeconds * 1000,
    delay: firstCubeDelaySeconds * 1000,
    easing: "linear",
    iterations: Number.POSITIVE_INFINITY,
  })

  switch (key) {
    case "massageLabTwistedCubesRotationSpeed":
      {
        const timingExpected = await normalizeComputedConsumer(host, {
          "animation-duration": `${getTwistedCubeCycleSeconds(properties[key])}s`,
        })
        expect(after.cubeDuration).toBe(timingExpected.animationDuration)
        expect(after.cubeTransform).toBe(await expectedCubeTransform())
      }
      break
    case "massageLabTwistedCubesLayerStagger":
      {
        const timingExpected = await normalizeComputedConsumer(host, {
          "animation-delay": `${getTwistedCubeDelaySeconds({
            oneBasedIndex: 1,
            count,
            stagger: properties[key],
          })}s`,
        })
        expect(after.cubeDelay).toBe(timingExpected.animationDelay)
        expect(after.cubeTransform).toBe(await expectedCubeTransform())
      }
      break
    case "massageLabTwistedCubesViewAngleX":
    case "massageLabTwistedCubesViewAngleY":
      expect(after.viewTransform).toBe(viewExpected.transform)
      break
    case "massageLabTwistedCubesLayerCount":
      expect(after.layerCount).toBe(count)
      expect(after.faceCount).toBe(count * 6)
      {
        const delayExpected = await normalizeComputedConsumer(host, {
          "animation-delay": `${firstCubeDelaySeconds}s`,
        })
        expect(after.cubeDelay).toBe(delayExpected.animationDelay)
        expect(after.cubeTransform).toBe(await expectedCubeTransform())
      }
      expect(Number(after.faceOpacity)).toBeCloseTo(getTwistedCubeAlpha({
        oneBasedIndex: 1,
        count,
        opacityFalloff: properties.massageLabTwistedCubesOpacityFalloff,
      }), 6)
      break
    case "massageLabTwistedCubesLayerDepthSpacing":
      expect(after.secondLayerTransform).toBe(secondLayerExpected.transform)
      break
    case "massageLabTwistedCubesScale":
    case "massageLabTwistedCubesPositionX":
    case "massageLabTwistedCubesPositionY":
      expect(after.sceneTransform).toBe(sceneExpected)
      break
    case "massageLabTwistedCubesOpacityFalloff":
      expect(Number(after.faceOpacity)).toBeCloseTo(getTwistedCubeAlpha({
        oneBasedIndex: 1,
        count,
        opacityFalloff: properties[key],
      }), 6)
      break
    case "massageLabTwistedCubesOutlineThickness":
      expect(after.faceBorderWidth).toBe(faceBorderExpected.borderTopWidth)
      break
    default:
      throw new Error(`Missing Twisted Cubes computed consumer assertion for ${key}.`)
  }
}

async function resolveCurrentRoleColors(review: Locator, id: typeof EFFECTS[number]["id"]) {
  return resolveBackgroundRoleColors({
    palette: await parsedAttribute(review, "data-current-palette") as never,
    adapter: backgroundPaletteRegistry[id],
    mapping: await parsedAttribute<Record<string, string>>(review, "data-current-mapping"),
    canCustomize: true,
  })
}

async function expectExactReducedEffectState(
  review: Locator,
  host: Locator,
  id: typeof EFFECTS[number]["id"],
  properties: Record<string, number>,
) {
  const root = effectRoot(host)
  const compactViewport = await host.evaluate(() => (
    window.matchMedia("(max-width: 479px), (max-height: 479px)").matches
  ))
  const roleColors = await resolveCurrentRoleColors(review, id)

  if (id === "massage-lab-dna") {
    const count = properties.massageLabDnaStrandCount
    const transform = resolveResponsiveBackgroundTransform({
      scale: properties.massageLabDnaScale,
      positionX: properties.massageLabDnaPositionX,
      positionY: properties.massageLabDnaPositionY,
      compactViewport,
    })
    await expect.poll(() => root.locator(":scope > div").evaluate((scene) => (
      (scene as HTMLElement).style.getPropertyValue("--ml-dna-scale")
    ))).toBe(String(transform.scale))
    const actual = await root.evaluate((element) => {
      const rootElement = element as HTMLElement
      const style = rootElement.style
      const sceneStyle = (rootElement.firstElementChild as HTMLElement).style
      const strands = Array.from(rootElement.querySelectorAll<HTMLElement>('[style*="--ml-dna-start-color"]'))
      return {
        root: {
          background: style.getPropertyValue("--ml-dna-background-color"),
          "node-one": style.getPropertyValue("--ml-dna-node-color-0"),
          "node-two": style.getPropertyValue("--ml-dna-node-color-1"),
          "node-three": style.getPropertyValue("--ml-dna-node-color-2"),
          "node-four": style.getPropertyValue("--ml-dna-node-color-3"),
          connector: style.getPropertyValue("--ml-dna-connector-color"),
          outline: style.getPropertyValue("--ml-dna-outline-color"),
          angle: style.getPropertyValue("--ml-dna-strand-angle"),
          spacing: style.getPropertyValue("--ml-dna-strand-spacing"),
          width: style.getPropertyValue("--ml-dna-connector-width"),
          thickness: style.getPropertyValue("--ml-dna-connector-thickness"),
          outlineThickness: style.getPropertyValue("--ml-dna-outline-thickness"),
          rotationDuration: style.getPropertyValue("--ml-dna-rotation-duration"),
        },
        scene: {
          scale: sceneStyle.getPropertyValue("--ml-dna-scale"),
          x: sceneStyle.getPropertyValue("--ml-dna-position-x"),
          y: sceneStyle.getPropertyValue("--ml-dna-position-y"),
        },
        strands: strands.map((strand) => ({
          phase: strand.style.getPropertyValue("--ml-dna-phase"),
          nodeDuration: strand.style.getPropertyValue("--ml-dna-node-duration"),
          nodeDelay: strand.style.getPropertyValue("--ml-dna-node-delay"),
          animation: getComputedStyle(strand).animationName,
        })),
        nodes: rootElement.querySelectorAll("[data-side]").length,
        childAnimations: Array.from(rootElement.querySelectorAll<HTMLElement>('[style*="--ml-dna-start-color"] > *'))
          .map((child) => getComputedStyle(child).animationName),
      }
    })
    expect(actual.root).toEqual({
      ...roleColors,
      angle: `${properties.massageLabDnaStrandAngle}deg`,
      spacing: `${properties.massageLabDnaStrandSpacing}vmin`,
      width: `${properties.massageLabDnaConnectorWidth}%`,
      thickness: `${properties.massageLabDnaConnectorThickness}%`,
      outlineThickness: `${properties.massageLabDnaOutlineThickness}vmin`,
      rotationDuration: `${getDnaStrandRotationSeconds(properties.massageLabDnaStrandRotationSpeed)}s`,
    })
    expect(actual.scene).toEqual({
      scale: String(transform.scale),
      x: `${transform.positionX}%`,
      y: `${transform.positionY}%`,
    })
    expect(actual.strands).toEqual(Array.from({ length: count }, (_, index) => {
      const oneBasedIndex = index + 1
      const phase = getDnaStrandPhase({ oneBasedIndex, total: count })
      return {
        phase: String(phase),
        nodeDuration: `${getDnaNodeCycleSeconds(properties.massageLabDnaNodeMotionSpeed)}s`,
        nodeDelay: `${getDnaStrandDelaySeconds({ oneBasedIndex, total: count, speed: properties.massageLabDnaNodeMotionSpeed })}s`,
        animation: "none",
      }
    }))
    expect(actual.nodes).toBe(count * 2)
    expect(actual.childAnimations.every((animation) => animation === "none")).toBe(true)
    const computed = await captureComputedConsumerState(host, id) as Record<string, string | number>
    const firstNodeEvidence = await root.locator('[style*="--ml-dna-start-color"]').first().evaluate((strand) => {
      const element = strand as HTMLElement
      const startNode = element.querySelector<HTMLElement>('[data-side="start"]') as HTMLElement
      const endNode = element.querySelector<HTMLElement>('[data-side="end"]') as HTMLElement
      return {
        startRole: element.style.getPropertyValue("--ml-dna-start-color"),
        endRole: element.style.getPropertyValue("--ml-dna-end-color"),
        startBackground: getComputedStyle(startNode).backgroundColor,
        endBackground: getComputedStyle(endNode).backgroundColor,
      }
    })
    const startRoleIndex = Number.parseInt(firstNodeEvidence.startRole.match(/node-color-(\d)/)?.[1] ?? "-1", 10)
    const endRoleIndex = Number.parseInt(firstNodeEvidence.endRole.match(/node-color-(\d)/)?.[1] ?? "-1", 10)
    expect(startRoleIndex).toBeGreaterThanOrEqual(0)
    expect(endRoleIndex).toBeGreaterThanOrEqual(0)
    const nodeRoleColors = [
      roleColors["node-one"], roleColors["node-two"], roleColors["node-three"], roleColors["node-four"],
    ]
    const rootExpected = await normalizeComputedConsumer(host, {
      "background-color": roleColors.background,
    })
    const sceneGeometryExpected = await normalizeComputedConsumer(host, {
      height: "65vmin",
      "aspect-ratio": "2 / 5",
    })
    const dnaGeometryExpected = await normalizeDnaGeometry(host, {
      count,
      spacing: properties.massageLabDnaStrandSpacing,
      connectorWidth: properties.massageLabDnaConnectorWidth,
      connectorThickness: properties.massageLabDnaConnectorThickness,
      outlineThickness: properties.massageLabDnaOutlineThickness,
    })
    const sceneExpected = await normalizeTransformForTarget(
      root.locator(":scope > div"),
      `translate(calc(-50% + ${transform.positionX}%), calc(-50% + ${transform.positionY}%)) scale(${transform.scale})`,
    )
    const sceneRotateExpected = await normalizeComputedConsumer(host, {
      rotate: `${properties.massageLabDnaStrandAngle + 180}deg`,
    })
    const connectorExpected = await normalizeComputedConsumer(host, {
      transform: "translate3d(-50%, -50%, -2px) scaleX(1)",
      "background-color": roleColors.connector,
      border: `${properties.massageLabDnaOutlineThickness}vmin solid ${roleColors.outline}`,
    }, { width: String(computed.connectorWidth), height: String(computed.connectorHeight) })
    const startNodeExpected = await normalizeComputedConsumer(host, {
      transform: "translateX(calc(26vmin - 100%))",
      "background-color": nodeRoleColors[startRoleIndex],
      border: `${properties.massageLabDnaOutlineThickness}vmin solid ${roleColors.outline}`,
    }, { width: String(computed.startNodeWidth), height: String(computed.startNodeHeight) })
    const endNodeExpected = await normalizeComputedConsumer(host, {
      transform: "translateX(calc(-26vmin + 100%))",
      "background-color": nodeRoleColors[endRoleIndex],
      border: `${properties.massageLabDnaOutlineThickness}vmin solid ${roleColors.outline}`,
    }, { width: String(computed.endNodeWidth), height: String(computed.endNodeHeight) })
    expect(computed).toMatchObject({
      rootBackground: rootExpected.backgroundColor,
      sceneTransform: sceneExpected,
      sceneRotate: sceneRotateExpected.rotate,
      sceneAnimationName: "none",
      sceneDuration: "0s",
      sceneRowGap: dnaGeometryExpected.rowGap,
      scenePerspective: "none",
      sceneWidth: sceneGeometryExpected.width,
      sceneHeight: sceneGeometryExpected.height,
      strandCount: count,
      nodeCount: count * 2,
      strandWidth: dnaGeometryExpected.strandWidth,
      strandHeight: dnaGeometryExpected.strandHeight,
      strandMarginLeft: "0px",
      strandMarginTop: "0px",
      strandTransform: "none",
      strandAnimationName: "none",
      strandDuration: "0s",
      strandDelay: "0s",
      connectorWidth: dnaGeometryExpected.connectorWidth,
      connectorHeight: dnaGeometryExpected.connectorHeight,
      connectorTransform: connectorExpected.transform,
      connectorAnimationName: "none",
      connectorDuration: "0s",
      connectorDelay: "0s",
      connectorBorderWidth: connectorExpected.borderTopWidth,
      connectorBorderColor: connectorExpected.borderTopColor,
      connectorBackground: connectorExpected.backgroundColor,
      startNodeWidth: dnaGeometryExpected.nodeWidth,
      startNodeHeight: dnaGeometryExpected.nodeHeight,
      startNodeTransform: startNodeExpected.transform,
      startNodeAnimationName: "none",
      startNodeDuration: "0s",
      startNodeDelay: "0s",
      startNodeBorderWidth: startNodeExpected.borderTopWidth,
      startNodeBorderColor: startNodeExpected.borderTopColor,
      endNodeWidth: dnaGeometryExpected.nodeWidth,
      endNodeHeight: dnaGeometryExpected.nodeHeight,
      endNodeTransform: endNodeExpected.transform,
      endNodeAnimationName: "none",
      endNodeDuration: "0s",
      endNodeDelay: "0s",
      endNodeBorderWidth: endNodeExpected.borderTopWidth,
      endNodeBorderColor: endNodeExpected.borderTopColor,
    })
    expect(firstNodeEvidence.startBackground).toBe(startNodeExpected.backgroundColor)
    expect(firstNodeEvidence.endBackground).toBe(endNodeExpected.backgroundColor)
    return
  }

  const count = properties.massageLabTwistedCubesLayerCount
  const transform = resolveResponsiveBackgroundTransform({
    scale: properties.massageLabTwistedCubesScale,
    positionX: properties.massageLabTwistedCubesPositionX,
    positionY: properties.massageLabTwistedCubesPositionY,
    compactViewport,
  })
  await expect.poll(() => root.locator(":scope > div").evaluate((scene) => (
    (scene as HTMLElement).style.getPropertyValue("--ml-twisted-cubes-scale")
  ))).toBe(String(transform.scale))
  const outlineRoleNames = ["one", "two", "three", "four", "five", "six"]
  const anchors = outlineRoleNames.map((name) => roleColors[`outline-${name}`])
  const actual = await root.evaluate((element) => {
    const rootElement = element as HTMLElement
    const style = rootElement.style
    const sceneStyle = (rootElement.firstElementChild as HTMLElement).style
    const layers = Array.from(rootElement.querySelectorAll<HTMLElement>('[style*="--ml-twisted-cubes-outline"]'))
    return {
      root: {
        background: style.getPropertyValue("--ml-twisted-cubes-background-color"),
        cycle: style.getPropertyValue("--ml-twisted-cubes-cycle"),
        x: style.getPropertyValue("--ml-twisted-cubes-view-angle-x"),
        y: style.getPropertyValue("--ml-twisted-cubes-view-angle-y"),
      },
      scene: {
        scale: sceneStyle.getPropertyValue("--ml-twisted-cubes-scale"),
        x: sceneStyle.getPropertyValue("--ml-twisted-cubes-position-x"),
        y: sceneStyle.getPropertyValue("--ml-twisted-cubes-position-y"),
      },
      layers: layers.map((layer) => ({
        outline: layer.style.getPropertyValue("--ml-twisted-cubes-outline"),
        alpha: layer.style.getPropertyValue("--ml-twisted-cubes-alpha"),
        delay: layer.style.getPropertyValue("--ml-twisted-cubes-delay"),
        depth: layer.style.getPropertyValue("--ml-twisted-cubes-depth"),
        size: layer.style.getPropertyValue("--ml-twisted-cubes-size"),
        thickness: layer.style.getPropertyValue("--ml-twisted-cubes-outline-thickness"),
        animation: getComputedStyle(layer.firstElementChild as HTMLElement).animationName,
        faceCount: layer.querySelectorAll(":scope > span > span > span").length,
      })),
    }
  })
  expect(actual.root).toEqual({
    background: roleColors.background,
    cycle: `${getTwistedCubeCycleSeconds(properties.massageLabTwistedCubesRotationSpeed)}s`,
    x: `${properties.massageLabTwistedCubesViewAngleX}deg`,
    y: `${properties.massageLabTwistedCubesViewAngleY}deg`,
  })
  expect(actual.scene).toEqual({
    scale: String(transform.scale),
    x: `${transform.positionX}%`,
    y: `${transform.positionY}%`,
  })
  expect(actual.layers).toEqual(Array.from({ length: count }, (_, index) => ({
    outline: interpolateTwistedCubeOutline({ anchors, oneBasedIndex: index + 1, count }),
    alpha: String(getTwistedCubeAlpha({
      oneBasedIndex: index + 1,
      count,
      opacityFalloff: properties.massageLabTwistedCubesOpacityFalloff,
    })),
    delay: `${getTwistedCubeDelaySeconds({
      oneBasedIndex: index + 1,
      count,
      stagger: properties.massageLabTwistedCubesLayerStagger,
    })}s`,
    depth: `${-index * properties.massageLabTwistedCubesLayerDepthSpacing}vmin`,
    size: `${((index + 1) / count) * 50}vmin`,
    thickness: String(properties.massageLabTwistedCubesOutlineThickness),
    animation: "none",
    faceCount: 6,
  })))
  const computed = await captureComputedConsumerState(host, id) as Record<string, string | number>
  const rootExpected = await normalizeComputedConsumer(host, {
    "background-color": roleColors.background,
  })
  const sceneGeometryExpected = await normalizeComputedConsumer(host, {
    width: "50vmin",
    height: "50vmin",
  })
  const sceneExpected = await normalizeTransformForTarget(
    root.locator(":scope > div"),
    `translate(calc(-50% + ${transform.positionX}%), calc(-50% + ${transform.positionY}%)) scale(${transform.scale})`,
  )
  const viewExpected = await normalizeComputedConsumer(host, {
    transform: `rotateX(${properties.massageLabTwistedCubesViewAngleX}deg) rotateY(${properties.massageLabTwistedCubesViewAngleY}deg)`,
  })
  const firstLayerExpected = await normalizeComputedConsumer(host, { transform: "translateZ(0vmin)" })
  const secondLayerExpected = await normalizeComputedConsumer(host, {
    transform: `translateZ(${-properties.massageLabTwistedCubesLayerDepthSpacing}vmin)`,
  })
  const cubeExpected = await normalizeComputedConsumer(host, {
    transform: "translate(-50%, -50%) rotateZ(90deg) rotateX(90deg) rotateZ(0deg)",
  }, { width: `${50 / count}vmin`, height: `${50 / count}vmin` })
  const firstFaceExpected = await normalizeComputedConsumer(host, {
    width: `${50 / count}vmin`,
    height: `${50 / count}vmin`,
    opacity: String(getTwistedCubeAlpha({
      oneBasedIndex: 1,
      count,
      opacityFalloff: properties.massageLabTwistedCubesOpacityFalloff,
    })),
    "background-color": roleColors.background,
    border: `calc(${properties.massageLabTwistedCubesOutlineThickness} * 50vmin) solid ${anchors[0]}`,
  })
  expect(computed).toMatchObject({
    rootBackground: rootExpected.backgroundColor,
    sceneTransform: sceneExpected,
    scenePerspective: (await normalizeComputedConsumer(host, { perspective: "100vmin" })).perspective,
    sceneWidth: sceneGeometryExpected.width,
    sceneHeight: sceneGeometryExpected.height,
    viewTransform: viewExpected.transform,
    layerCount: count,
    faceCount: count * 6,
    firstLayerTransform: firstLayerExpected.transform,
    secondLayerTransform: secondLayerExpected.transform,
    cubeTransform: cubeExpected.transform,
    cubeAnimationName: "none",
    cubeDuration: "0s",
    cubeDelay: "0s",
    faceWidth: firstFaceExpected.width,
    faceHeight: firstFaceExpected.height,
    faceOpacity: firstFaceExpected.opacity,
    faceBorderWidth: firstFaceExpected.borderTopWidth,
    faceBorderColor: firstFaceExpected.borderTopColor,
    faceBackground: firstFaceExpected.backgroundColor,
  })
}

test.describe("DNA and Twisted Cubes development acceptance", () => {
  test("compact review state follows the live viewport media query", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    await page.setViewportSize({ width: 800, height: 600 })
    const review = await openTrack4BReview(page)
    const compactState = review.locator('[data-track-4b-specimen="compact-viewport"]')

    await expect(compactState).toHaveAttribute("data-active", "false")
    await page.setViewportSize({ width: 479, height: 600 })
    await expect(compactState).toHaveAttribute("data-active", "true")
    await page.setViewportSize({ width: 800, height: 600 })
    await expect(compactState).toHaveAttribute("data-active", "false")
    await page.setViewportSize({ width: 800, height: 479 })
    await expect(compactState).toHaveAttribute("data-active", "true")
    expectHealthy(health)
  })

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
    expect(await cubeRoot.evaluate((element) => (
      (element as HTMLElement).style.getPropertyValue("--ml-twisted-cubes-background-color")
    ))).toBe("hsl(210 20% 12%)")
    expect(await layers.count()).toBeLessThanOrEqual(30)
    expect(await layers.locator(":scope > span > span > span").count()).toBeLessThanOrEqual(180)
    expect(await host.locator('[style*="--ml-dna-start-color"]').count()).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
    expectHealthy(health)
  })

  test("consecutive property patches merge against the latest draft snapshot", async ({ page }) => {
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const before = await parsedAttribute<Record<string, number>>(review, "data-current-properties")

    await review.getByRole("button", { name: "Apply consecutive property patches" }).click()
    await expect.poll(async () => {
      const current = await parsedAttribute<Record<string, number>>(review, "data-current-properties")
      return [
        current.massageLabDnaStrandAngle,
        current.massageLabTwistedCubesViewAngleX,
      ]
    }).toEqual([
      before.massageLabDnaStrandAngle + 1,
      before.massageLabTwistedCubesViewAngleX + 1,
    ])

    await review.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(review).toHaveAttribute("data-draft-state", "clean")
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

  test("each named slider changes only its canonical key and exact production renderer target", async ({ page }) => {
    test.setTimeout(120_000)
    const health = captureRuntimeErrors(page)
    const review = await openTrack4BReview(page)
    const host = review.getByTestId("track-4b-live-host")
    const controls = review.locator("[data-track-4b-property-controls]")
    for (const effect of EFFECTS) {
      await selectEffect(review, host, effect.id)
      await expect(review).toHaveAttribute("data-draft-state", "clean")
      await expect(controls.getByRole("slider")).toHaveCount(11)
      const labelledByIds = await controls.getByRole("slider").evaluateAll((sliders) => (
        sliders.map((slider) => slider.getAttribute("aria-labelledby"))
      ))
      expect(labelledByIds).toHaveLength(11)
      expect(labelledByIds.every(Boolean)).toBe(true)
      expect(new Set(labelledByIds).size).toBe(11)
      for (const contract of effect.controls) {
        const { label, key } = contract
        const slider = namedSlider(review, label)
        await expect(slider).toHaveCount(1)
        const before = await parsedAttribute<Record<string, number>>(review, "data-current-properties")
        const beforeRender = await captureControlRenderState(host, effect.id)
        const beforeComputed = await captureComputedConsumerState(host, effect.id)
        const keypress = key === "massageLabDnaOutlineThickness"
          ? "End"
          : key.endsWith("Scale")
            ? "Home"
            : "ArrowRight"
        await slider.press(keypress)
        await expect.poll(async () => (
          (await parsedAttribute<Record<string, number>>(review, "data-current-properties"))[key]
        )).not.toBe(before[key])
        const after = await parsedAttribute<Record<string, number>>(review, "data-current-properties")
        const changedKeys = Object.keys(after).filter((propertyKey) => after[propertyKey] !== before[propertyKey])
        expect(changedKeys, label).toEqual([key])
        expect(after[key], label).toBe(Number(await slider.getAttribute("aria-valuenow")))
        await expectExactControlRender({
          review,
          host,
          id: effect.id,
          key,
          properties: after,
          before: beforeRender,
        })
        await expectExactComputedConsumer({
          host,
          id: effect.id,
          contract,
          properties: after,
          before: beforeComputed,
        })
        await review.getByRole("button", { name: "Cancel", exact: true }).click()
        await expect(review).toHaveAttribute("data-draft-state", "clean")
        expect(await parsedAttribute(review, "data-current-properties"), label).toEqual(before)
      }
      await expectRenderedContract(host, effect.id)
      await namedSlider(review, effect.controls[0].label).press("ArrowRight")
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
        await review.getByRole("button", { name: "Harmony", exact: true }).click()
        for (const { label } of effect.controls) await namedSlider(review, label).press("End")
        const saved = await parsedAttribute<Record<string, number>>(review, "data-current-properties")
        expect(Object.fromEntries(Object.keys(effect.endValues).map((key) => [key, saved[key]])))
          .toEqual(effect.endValues)

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
          await expectExactReducedEffectState(review, host, effect.id, current)
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
        await expectExactReducedEffectState(
          review,
          host,
          effect.id,
          await parsedAttribute<Record<string, number>>(review, "data-current-properties"),
        )
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
    expect(contexts[0]).not.toBeNull()
    const sharedConfiguration = contexts[0]!
    expect(contexts[1]).toBe(sharedConfiguration)
    expect(contexts[2]).toBe(sharedConfiguration)

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
