// @ts-check

/**
 * @typedef {"backgrounds" | "stations"} AdaptiveCarouselSurface
 * @typedef {"existing" | "cover-flow" | "three-d" | "background-picker"} AdaptiveCarouselPresentation
 * @typedef {"phone-portrait" | "short-landscape" | "tablet" | "compact-desktop" | "wide-landscape"} AdaptiveCarouselViewportProfile
 * @typedef {{ id: string }} AdaptiveCarouselItem
 * @typedef {{
 *   cardWidth: number,
 *   cardHeight: number,
 *   gap: number,
 *   visibleRadius: number,
 *   loop: boolean,
 *   motion: boolean,
 *   [key: string]: number | boolean,
 * }} AdaptiveCarouselTuning
 */

export const ADAPTIVE_CAROUSEL_VIEWPORT_PROFILES = Object.freeze([
  "phone-portrait", "short-landscape", "tablet", "compact-desktop", "wide-landscape",
])

const viewportProfileLabels = Object.freeze({
  "phone-portrait": "Phone portrait",
  "short-landscape": "Short landscape",
  tablet: "Tablet portrait",
  "compact-desktop": "Compact desktop",
  "wide-landscape": "Wide landscape",
})

export const BACKGROUND_CAROUSEL_PROFILE_DEFAULTS = Object.freeze({
  "phone-portrait": Object.freeze({ cardWidth: 164, cardHeight: 312, spread: 22 }),
  "short-landscape": Object.freeze({ cardWidth: 200, cardHeight: 240, spread: 26 }),
  tablet: Object.freeze({ cardWidth: 220, cardHeight: 304, spread: 29 }),
  "compact-desktop": Object.freeze({ cardWidth: 256, cardHeight: 360, spread: 33 }),
  "wide-landscape": Object.freeze({ cardWidth: 280, cardHeight: 388, spread: 36 }),
})

export const BACKGROUND_CAROUSEL_BASE_TUNING = Object.freeze({
  cardWidth: 256,
  cardHeight: 360,
  gap: 0,
  visibleRadius: 2,
  loop: true,
  motion: true,
  spread: 33,
  radius: 420,
  scaleFalloff: 0.08,
})

export const STATION_CAROUSEL_TUNING = Object.freeze({
  cardWidth: 192,
  cardHeight: 224,
  gap: 0,
  visibleRadius: 4,
  loop: true,
  motion: true,
  spread: 27,
  radius: 420,
  scaleFalloff: 0.05,
})

/**
 * Selects Background geometry from the width available to the carousel. The
 * short-landscape override runs first so a rotated phone stays vertically
 * usable even when its inline width resembles a tablet.
 * @param {{ containerWidth: number, viewportWidth: number, viewportHeight: number }} dimensions
 * @returns {AdaptiveCarouselViewportProfile}
 */
export function resolveAdaptiveCarouselViewportProfile({
  containerWidth,
  viewportWidth,
  viewportHeight,
}) {
  const safeContainerWidth = Number.isFinite(containerWidth) ? containerWidth : 800
  const safeViewportWidth = Number.isFinite(viewportWidth) ? viewportWidth : 1180
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 820
  if (safeViewportWidth > safeViewportHeight && safeViewportHeight <= 480) return "short-landscape"
  if (safeContainerWidth < 480) return "phone-portrait"
  if (safeContainerWidth < 760) return "tablet"
  if (safeContainerWidth < 960) return "compact-desktop"
  return "wide-landscape"
}

/** @param {AdaptiveCarouselViewportProfile} profile */
export function getAdaptiveCarouselViewportProfileLabel(profile) {
  return viewportProfileLabels[profile] ?? viewportProfileLabels["compact-desktop"]
}

/**
 * Returns the approved responsive Background tuning without mutating the
 * shared base preset.
 * @param {AdaptiveCarouselViewportProfile} profile
 * @param {Partial<AdaptiveCarouselTuning>} [overrides]
 * @returns {AdaptiveCarouselTuning}
 */
export function getResponsiveBackgroundCarouselTuning(profile, overrides = {}) {
  return /** @type {AdaptiveCarouselTuning} */ ({
    ...BACKGROUND_CAROUSEL_BASE_TUNING,
    ...overrides,
    ...(BACKGROUND_CAROUSEL_PROFILE_DEFAULTS[profile]
      ?? BACKGROUND_CAROUSEL_PROFILE_DEFAULTS["compact-desktop"]),
    gap: 0,
    visibleRadius: 2,
    radius: 420,
    scaleFalloff: 0.08,
  })
}

/**
 * @param {number} itemCount
 * @param {number} visibleRadius
 * @param {boolean} requested
 */
export function resolveEffectiveCarouselLoop(itemCount, visibleRadius, requested) {
  return Boolean(requested && itemCount >= 3)
}

/**
 * Normalizes item identity once so keys, positions, and mounted-card budgets
 * cannot disagree.
 * @template {AdaptiveCarouselItem} T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function normalizeAdaptiveCarouselItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Adaptive carousel ignored a missing or duplicate item id", item?.id)
      }
      return false
    }
    seen.add(item.id)
    return true
  })
}

/**
 * @template {AdaptiveCarouselItem} T
 * @param {readonly T[]} items
 * @param {string | null | undefined} preferredId
 * @param {string | null | undefined} selectedId
 */
export function reconcileAdaptiveCarouselCenter(items, preferredId, selectedId) {
  const uniqueItems = normalizeAdaptiveCarouselItems(items)
  const ids = new Set(uniqueItems.map(({ id }) => id))
  if (preferredId && ids.has(preferredId)) return preferredId
  if (selectedId && ids.has(selectedId)) return selectedId
  return uniqueItems[0]?.id ?? null
}

/**
 * Returns the centered item plus the configured number of nearby renderers.
 * Distant slides retain semantics through lightweight shells.
 * @param {readonly AdaptiveCarouselItem[]} items
 * @param {string | null | undefined} centeredId
 * @param {number} visibleRadius
 * @param {boolean} loop
 */
export function getMountedAdaptiveCarouselItemIds(items, centeredId, visibleRadius, loop) {
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

/**
 * Converts continuous Embla progress into presentation-owned CSS variables.
 * @param {AdaptiveCarouselPresentation} presentation
 * @param {AdaptiveCarouselSurface} surface
 * @param {number} progress
 * @param {Record<string, number | boolean>} tuning
 * @param {boolean} reducedMotion
 * @param {number} [itemCount]
 * @returns {Record<string, string>}
 */
export function getAdaptiveCarouselPresentationVariables(
  presentation,
  surface,
  progress,
  tuning,
  reducedMotion,
  itemCount = 16,
) {
  if (reducedMotion || tuning.motion === false || (presentation === "existing" && surface === "stations")) {
    return {
      "--carousel-x": "0px",
      "--carousel-z": "0px",
      "--carousel-rotate-y": "0deg",
      "--carousel-scale": "1",
      "--carousel-opacity": "1",
      "--carousel-origin-x": "50%",
      "--carousel-z-index": "1",
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
      "--carousel-x": `${(Math.sin(radians) * /** @type {number} */ (tuning.radius) - linearOffset).toFixed(2)}px`,
      "--carousel-z": `${(-absoluteProgress * 28).toFixed(2).replace(".00", "")}px`,
      "--carousel-rotate-y": `${(-angle).toFixed(2).replace(".00", "")}deg`,
      "--carousel-scale": String(Math.max(0.65, 1 - absoluteProgress * /** @type {number} */ (tuning.scaleFalloff))),
      "--carousel-opacity": String(Math.max(0.18, 1 - absoluteProgress * 0.36)),
      "--carousel-origin-x": "50%",
      "--carousel-z-index": String(Math.max(1, 20 - Math.round(absoluteProgress))),
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
      "--carousel-x": absoluteProgress === 0 ? "0px" : `${horizontalSweep.toFixed(2)}px`,
      "--carousel-z": `${centerLift.toFixed(2)}px`,
      "--carousel-rotate-y": `${(-Math.sign(progress) * /** @type {number} */ (tuning.rotation) * nearDistance).toFixed(2).replace(".00", "")}deg`,
      "--carousel-scale": String(scale),
      "--carousel-opacity": String(Math.max(0.25, 1 - edgeDistance * 0.75)),
      "--carousel-origin-x": progress < 0 ? "100%" : progress > 0 ? "0%" : "50%",
      "--carousel-z-index": String(Math.max(1, 100 - Math.round(absoluteProgress * 10))),
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
    "--carousel-x": absoluteProgress === 0 ? "0px" : `${x.toFixed(2)}px`,
    "--carousel-z": absoluteProgress === 0 ? "0px" : `${z.toFixed(2)}px`,
    "--carousel-rotate-y": absoluteProgress === 0 ? "0deg" : `${Number(angle.toFixed(2))}deg`,
    "--carousel-scale": "1",
    "--carousel-opacity": "1",
    "--carousel-origin-x": "50%",
    "--carousel-z-index": String(Math.max(1, 100 - Math.round(distance * 50))),
  }
}
