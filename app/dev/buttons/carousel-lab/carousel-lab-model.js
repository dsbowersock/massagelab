// @ts-check

/**
 * @typedef {"backgrounds" | "stations"} CarouselLabSurface
 * @typedef {"existing" | "cover-flow" | "three-d" | "background-picker"} CarouselLabPresentation
 * @typedef {"phone-portrait" | "short-landscape" | "tablet" | "compact-desktop" | "wide-landscape"} CarouselLabViewportProfile
 * @typedef {{ id: string }} CarouselLabItem
 * @typedef {{
 *   cardWidth: number,
 *   cardHeight: number,
 *   gap: number,
 *   visibleRadius: number,
 *   loop: boolean,
 *   motion: boolean,
 *   [key: string]: number | boolean,
 * }} CarouselLabTuning
 */

export const CAROUSEL_LAB_STORAGE_KEY = "massagelab-carousel-lab-v4"
export const CAROUSEL_LAB_PAIRS = Object.freeze([
  "backgrounds:existing", "stations:background-picker",
])

export const CAROUSEL_LAB_VIEWPORT_PROFILES = Object.freeze([
  "phone-portrait", "short-landscape", "tablet", "compact-desktop", "wide-landscape",
])

const viewportProfileLabels = Object.freeze({
  "phone-portrait": "Phone portrait",
  "short-landscape": "Short landscape",
  tablet: "Tablet portrait",
  "compact-desktop": "Compact desktop",
  "wide-landscape": "Wide landscape",
})

const backgroundExistingProfileDefaults = Object.freeze({
  "phone-portrait": { cardWidth: 164, cardHeight: 312, spread: 22 },
  "short-landscape": { cardWidth: 200, cardHeight: 240, spread: 26 },
  tablet: { cardWidth: 220, cardHeight: 304, spread: 29 },
  "compact-desktop": { cardWidth: 256, cardHeight: 360, spread: 33 },
  "wide-landscape": { cardWidth: 280, cardHeight: 388, spread: 36 },
})

const pairDefaults = {
  backgrounds: {
    existing: {
      cardWidth: 256, cardHeight: 360, gap: 0, visibleRadius: 2, loop: true, motion: true,
      responsive: true, spread: 33, radius: 420, scaleFalloff: 0.08,
    },
    "cover-flow": {
      cardWidth: 192, cardHeight: 304, gap: 0, visibleRadius: 4, loop: true, motion: true,
      rotation: 16, centerScale: 1.25, edgeScale: 0.6, perspective: 320,
      reflection: true, reflectionOpacity: 0.75, reflectionGap: 1,
    },
    "three-d": {
      cardWidth: 200, cardHeight: 304, gap: 0, visibleRadius: 4, loop: true, motion: true,
      perspective: 50, ringItems: 14, depth: 1, nearMask: 1, farMask: 2,
    },
  },
  stations: {
    existing: { cardWidth: 208, cardHeight: 304, gap: 20, visibleRadius: 2, loop: true, motion: true },
    "cover-flow": {
      cardWidth: 192, cardHeight: 304, gap: 0, visibleRadius: 4, loop: true, motion: true,
      rotation: 16, centerScale: 1.25, edgeScale: 0.6, perspective: 320,
      reflection: true, reflectionOpacity: 0.75, reflectionGap: 3,
    },
    "three-d": {
      cardWidth: 192, cardHeight: 304, gap: 0, visibleRadius: 4, loop: true, motion: true,
      perspective: 50, ringItems: 16, depth: 1, nearMask: 0.9, farMask: 1.8,
    },
    "background-picker": {
      cardWidth: 192, cardHeight: 224, gap: 0, visibleRadius: 4, loop: true, motion: true,
      spread: 27, radius: 420, scaleFalloff: 0.05,
    },
  },
}

const ranges = {
  cardWidth: { backgrounds: [160, 280, 4], stations: [168, 320, 4] },
  cardHeight: { backgrounds: [240, 480, 4], stations: [192, 520, 4] },
  gap: [0, 64, 2],
  visibleRadius: [1, 4, 1],
  spread: [15, 50, 1],
  radius: [160, 420, 5],
  scaleFalloff: [0.04, 0.24, 0.01],
  rotation: [0, 55, 1],
  centerScaleCover: [1, 1.35, 0.01],
  edgeScaleCover: [0.6, 1, 0.01],
  perspectiveCover: [320, 1600, 20],
  reflectionOpacity: [0, 1, 0.05],
  reflectionGap: [0, 24, 1],
  perspectiveThreeD: [50, 1500, 10],
  ringItems: [10, 50, 1],
  depth: [0.5, 1.5, 0.05],
  nearMask: [0, 5, 0.1],
  farMask: [0, 5, 0.1],
}

// Clamp and snap persisted values to the same increments exposed by Lab controls.
/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {readonly number[]} range
 * @returns {number}
 */
function numberAt(value, fallback, range) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  const [min, max, step] = range
  const clamped = Math.min(max, Math.max(min, numeric))
  return Number((Math.round(clamped / step) * step).toFixed(4))
}

/**
 * @param {CarouselLabSurface} surface
 * @param {CarouselLabPresentation} presentation
 * @returns {CarouselLabTuning}
 */
export function getDefaultCarouselLabTuning(surface, presentation) {
  const surfaceDefaults = /** @type {Record<string, CarouselLabTuning>} */ (
    pairDefaults[surface] ?? pairDefaults.backgrounds
  )
  return /** @type {CarouselLabTuning} */ ({
    ...(surfaceDefaults[presentation] ?? surfaceDefaults.existing),
  })
}

/**
 * Selects a visual profile from the space actually available to the carousel.
 * The short-landscape override runs first so a rotated phone does not inherit a
 * tablet or desktop card simply because its inline width increased.
 * @param {{ containerWidth: number, viewportWidth: number, viewportHeight: number }} dimensions
 * @returns {CarouselLabViewportProfile}
 */
export function resolveCarouselLabViewportProfile({ containerWidth, viewportWidth, viewportHeight }) {
  const safeContainerWidth = Number.isFinite(containerWidth) ? containerWidth : 800
  const safeViewportWidth = Number.isFinite(viewportWidth) ? viewportWidth : 1180
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 820
  if (safeViewportWidth > safeViewportHeight && safeViewportHeight <= 480) return "short-landscape"
  if (safeContainerWidth < 480) return "phone-portrait"
  if (safeContainerWidth < 760) return "tablet"
  if (safeContainerWidth < 960) return "compact-desktop"
  return "wide-landscape"
}

/** @param {CarouselLabViewportProfile} profile */
export function getCarouselLabViewportProfileLabel(profile) {
  return viewportProfileLabels[profile] ?? viewportProfileLabels["compact-desktop"]
}

/**
 * Resolves the approved Background geometry while preserving persisted
 * behavior switches and any manual fallback values.
 * @param {CarouselLabViewportProfile} profile
 * @param {CarouselLabTuning} tuning
 * @returns {CarouselLabTuning}
 */
export function getResponsiveBackgroundTuning(profile, tuning) {
  return {
    ...tuning,
    ...(backgroundExistingProfileDefaults[profile] ?? backgroundExistingProfileDefaults["compact-desktop"]),
    gap: 0,
    visibleRadius: 2,
    radius: 420,
    scaleFalloff: 0.08,
  }
}

/**
 * @param {CarouselLabSurface} surface
 * @param {CarouselLabPresentation} presentation
 * @param {unknown} value
 * @returns {CarouselLabTuning}
 */
export function sanitizeCarouselLabTuning(surface, presentation, value) {
  const input = value && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)
    : {}
  const defaults = getDefaultCarouselLabTuning(surface, presentation)
  const output = {
    cardWidth: numberAt(input.cardWidth, defaults.cardWidth, ranges.cardWidth[surface] ?? ranges.cardWidth.backgrounds),
    cardHeight: numberAt(input.cardHeight, defaults.cardHeight, ranges.cardHeight[surface] ?? ranges.cardHeight.backgrounds),
    gap: numberAt(input.gap, defaults.gap, ranges.gap),
    visibleRadius: numberAt(input.visibleRadius, defaults.visibleRadius, ranges.visibleRadius),
    loop: typeof input.loop === "boolean" ? input.loop : defaults.loop,
    motion: typeof input.motion === "boolean" ? input.motion : defaults.motion,
  }
  if (presentation === "existing" || presentation === "background-picker") {
    if (presentation === "existing" && surface === "stations") return output
    return {
      ...output,
      ...(surface === "backgrounds" && presentation === "existing"
        ? { responsive: typeof input.responsive === "boolean" ? input.responsive : defaults.responsive }
        : {}),
      spread: numberAt(input.spread, /** @type {number} */ (defaults.spread), ranges.spread),
      radius: numberAt(input.radius, /** @type {number} */ (defaults.radius), ranges.radius),
      scaleFalloff: numberAt(input.scaleFalloff, /** @type {number} */ (defaults.scaleFalloff), ranges.scaleFalloff),
    }
  }
  if (presentation === "cover-flow") {
    return {
      ...output,
      rotation: numberAt(input.rotation, /** @type {number} */ (defaults.rotation), ranges.rotation),
      centerScale: numberAt(input.centerScale, /** @type {number} */ (defaults.centerScale), ranges.centerScaleCover),
      edgeScale: numberAt(input.edgeScale, /** @type {number} */ (defaults.edgeScale), ranges.edgeScaleCover),
      perspective: numberAt(input.perspective, /** @type {number} */ (defaults.perspective), ranges.perspectiveCover),
      reflection: typeof input.reflection === "boolean" ? input.reflection : /** @type {boolean} */ (defaults.reflection),
      reflectionOpacity: numberAt(input.reflectionOpacity, /** @type {number} */ (defaults.reflectionOpacity), ranges.reflectionOpacity),
      reflectionGap: numberAt(input.reflectionGap, /** @type {number} */ (defaults.reflectionGap), ranges.reflectionGap),
    }
  }
  return {
    ...output,
    perspective: numberAt(input.perspective, /** @type {number} */ (defaults.perspective), ranges.perspectiveThreeD),
    ringItems: numberAt(input.ringItems, /** @type {number} */ (defaults.ringItems), ranges.ringItems),
    depth: numberAt(input.depth, /** @type {number} */ (defaults.depth), ranges.depth),
    nearMask: numberAt(input.nearMask, /** @type {number} */ (defaults.nearMask), ranges.nearMask),
    farMask: numberAt(input.farMask, /** @type {number} */ (defaults.farMask), ranges.farMask),
  }
}

// Rebuild every pair independently so one malformed saved value cannot reset the others.
/**
 * @param {string | null | undefined} raw
 * @returns {Record<string, CarouselLabTuning>}
 */
export function parseCarouselLabStorage(raw) {
  /** @type {Record<string, unknown>} */
  let values = {}
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : null
    values = parsed?.version === 4 && parsed.values && typeof parsed.values === "object" ? parsed.values : {}
  } catch {
    values = {}
  }
  return Object.fromEntries(CAROUSEL_LAB_PAIRS.map((key) => {
    const [surface, presentation] = /** @type {[CarouselLabSurface, CarouselLabPresentation]} */ (key.split(":"))
    return [key, sanitizeCarouselLabTuning(surface, presentation, values[key])]
  }))
}

/**
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {string}
 */
export function serializeCarouselLabStorage(record) {
  const values = Object.fromEntries(CAROUSEL_LAB_PAIRS.map((key) => {
    const [surface, presentation] = /** @type {[CarouselLabSurface, CarouselLabPresentation]} */ (key.split(":"))
    return [key, sanitizeCarouselLabTuning(surface, presentation, record?.[key])]
  }))
  return JSON.stringify({ version: 4, values })
}

/**
 * @param {number} itemCount
 * @param {number} visibleRadius
 * @param {boolean} requested
 * @returns {boolean}
 */
export function resolveEffectiveLoop(itemCount, visibleRadius, requested) {
  return Boolean(requested && itemCount >= 3)
}

// Stable, unique IDs are the identity contract shared by centering and nearby mounts.
/**
 * @template {CarouselLabItem} T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function normalizeCarouselLabItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) {
      if (process.env.NODE_ENV !== "production") console.warn("Carousel Lab ignored a missing or duplicate item id", item?.id)
      return false
    }
    seen.add(item.id)
    return true
  })
}

/**
 * @param {readonly CarouselLabItem[]} items
 * @param {string | null | undefined} preferredId
 * @param {string | null | undefined} selectedId
 * @returns {string | null}
 */
export function reconcileCenteredId(items, preferredId, selectedId) {
  const uniqueItems = normalizeCarouselLabItems(items)
  const ids = new Set(uniqueItems.map(({ id }) => id))
  if (preferredId && ids.has(preferredId)) return preferredId
  if (selectedId && ids.has(selectedId)) return selectedId
  return uniqueItems[0]?.id ?? null
}

/**
 * @param {readonly CarouselLabItem[]} items
 * @param {string | null | undefined} centeredId
 * @param {number} visibleRadius
 * @param {boolean} loop
 * @returns {Set<string>}
 */
export function getMountedItemIds(items, centeredId, visibleRadius, loop) {
  const result = new Set()
  const center = items.findIndex(({ id }) => id === centeredId)
  if (center < 0) return result
  for (let offset = -visibleRadius; offset <= visibleRadius; offset += 1) {
    const raw = center + offset
    if (!loop && (raw < 0 || raw >= items.length)) continue
    result.add(items[(raw + items.length) % items.length].id)
  }
  return result
}

// Presentation adapters consume plain tuning data and emit serializable CSS variables.
/**
 * @param {CarouselLabPresentation} presentation
 * @param {CarouselLabSurface} surface
 * @param {number} progress
 * @param {Record<string, number | boolean>} tuning
 * @param {boolean} reducedMotion
 * @param {number} [itemCount]
 * @returns {Record<string, string>}
 */
export function getPresentationVariables(presentation, surface, progress, tuning, reducedMotion, itemCount = 16) {
  if (reducedMotion || tuning.motion === false || (presentation === "existing" && surface === "stations")) {
    return {
      "--lab-x": "0px", "--lab-z": "0px", "--lab-rotate-y": "0deg",
      "--lab-scale": "1", "--lab-opacity": "1", "--lab-origin-x": "50%",
      "--lab-z-index": "1",
    }
  }
  const absoluteProgress = Math.abs(progress)
  const visibleRadius = Math.max(1, /** @type {number} */ (tuning.visibleRadius))
  const distance = Math.min(1, absoluteProgress / visibleRadius)
  if (presentation === "existing" || presentation === "background-picker") {
    const angle = progress * /** @type {number} */ (tuning.spread)
    const radians = angle * Math.PI / 180
    const linearOffset = progress * (
      /** @type {number} */ (tuning.cardWidth) + /** @type {number} */ (tuning.gap)
    )
    return {
      "--lab-x": `${(Math.sin(radians) * /** @type {number} */ (tuning.radius) - linearOffset).toFixed(2)}px`,
      "--lab-z": `${(-absoluteProgress * 28).toFixed(2).replace(".00", "")}px`,
      "--lab-rotate-y": `${(-angle).toFixed(2).replace(".00", "")}deg`,
      "--lab-scale": String(Math.max(0.65, 1 - Math.abs(progress) * /** @type {number} */ (tuning.scaleFalloff))),
      "--lab-opacity": String(Math.max(0.18, 1 - absoluteProgress * 0.36)),
      "--lab-origin-x": "50%",
      "--lab-z-index": String(Math.max(1, 20 - Math.round(absoluteProgress))),
    }
  }
  if (presentation === "cover-flow") {
    const nearDistance = Math.min(1, absoluteProgress)
    const edgeDistance = absoluteProgress <= 1
      ? 0
      : Math.min(1, (absoluteProgress - 1) / Math.max(1, visibleRadius - 1))
    const scale = absoluteProgress <= 1
      ? /** @type {number} */ (tuning.centerScale)
        + (1 - /** @type {number} */ (tuning.centerScale)) * nearDistance
      : 1 + (/** @type {number} */ (tuning.edgeScale) - 1) * edgeDistance
    const centerLift = (1 - nearDistance) * /** @type {number} */ (tuning.cardWidth) * 0.75
    const nearSweep = Math.sin(nearDistance * Math.PI) * /** @type {number} */ (tuning.cardWidth) * 0.15
    const edgeSweep = edgeDistance * /** @type {number} */ (tuning.cardWidth) * 0.8
    const horizontalSweep = Math.sign(progress) * (absoluteProgress <= 1 ? nearSweep : edgeSweep)
    return {
      "--lab-x": absoluteProgress === 0 ? "0px" : `${horizontalSweep.toFixed(2)}px`,
      "--lab-z": `${centerLift.toFixed(2)}px`,
      "--lab-rotate-y": `${(-Math.sign(progress) * /** @type {number} */ (tuning.rotation) * nearDistance).toFixed(2).replace(".00", "")}deg`,
      "--lab-scale": String(scale),
      "--lab-opacity": String(Math.max(0.25, 1 - edgeDistance * 0.75)),
      "--lab-origin-x": progress < 0 ? "100%" : progress > 0 ? "0%" : "50%",
      "--lab-z-index": String(Math.max(1, 100 - Math.round(absoluteProgress * 10))),
    }
  }
  const safeItemCount = Math.max(3, Math.round(
    /** @type {number} */ (tuning.ringItems ?? itemCount),
  ))
  const innerAngle = 360 / safeItemCount
  const angle = progress * innerAngle
  const radians = angle * Math.PI / 180
  const step = /** @type {number} */ (tuning.cardWidth) + /** @type {number} */ (tuning.gap)
  const sourceRadius = step / Math.sin(innerAngle * Math.PI / 180)
  const radius = sourceRadius * /** @type {number} */ (tuning.depth)
  const layoutOffset = progress * step
  const x = Math.sin(radians) * radius - layoutOffset
  const z = (Math.cos(radians) - 1) * radius
  return {
    "--lab-x": absoluteProgress === 0 ? "0px" : `${x.toFixed(2)}px`,
    "--lab-z": absoluteProgress === 0 ? "0px" : `${z.toFixed(2)}px`,
    "--lab-rotate-y": absoluteProgress === 0 ? "0deg" : `${Number(angle.toFixed(2))}deg`,
    "--lab-scale": "1",
    "--lab-opacity": "1",
    "--lab-origin-x": "50%",
    "--lab-z-index": String(Math.max(1, 100 - Math.round(distance * 50))),
  }
}
