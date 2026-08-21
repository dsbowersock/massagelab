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
  "phone-portrait": Object.freeze({ cardWidth: 164, cardHeight: 312, spread: 22, visibleRadius: 2 }),
  "short-landscape": Object.freeze({ cardWidth: 200, cardHeight: 240, spread: 26, visibleRadius: 1 }),
  tablet: Object.freeze({ cardWidth: 220, cardHeight: 304, spread: 29, visibleRadius: 2 }),
  "compact-desktop": Object.freeze({ cardWidth: 256, cardHeight: 360, spread: 33, visibleRadius: 2 }),
  "wide-landscape": Object.freeze({ cardWidth: 280, cardHeight: 388, spread: 36, visibleRadius: 2 }),
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
  perspective: 900,
  scaleFalloff: 0.05,
})

export const STATION_CAROUSEL_LARGE_SCREEN_TUNING = Object.freeze({
  compactReferenceWidth: 375,
  compactMaxWidth: 768,
  compactMaxScale: 1.4,
  balancedFillHeightShare: 2 / 3,
  balancedFillAspectStart: 1,
  balancedFillAspectFull: 1.3,
  referenceWidth: 960,
  maxScale: 2.5,
  maxHeaderScale: 1.5,
  favoritesRatio: 1.3,
  fitRoundingBuffer: 2,
  minimumFavoritesGap: 8,
  preferredFavoritesGap: 30,
})

/**
 * Preserves the approved Station composition while allowing roomy phones,
 * tablets, laptops, and televisions to scale it as one unit. Width establishes
 * the baseline while increasingly tall stages blend in two-thirds of their
 * additional vertical opportunity. Inline and block fit remain hard bounds so
 * the 1.3x Favorites square stays complete. Constrained landscape retains its
 * separate height-first behavior.
 * @param {{ containerWidth: number, containerHeight: number, constrainedLandscape: boolean }} dimensions
 * @returns {AdaptiveCarouselTuning}
 */
export function getResponsiveStationCarouselTuning({
  containerWidth,
  containerHeight,
  constrainedLandscape,
}) {
  const safeWidth = Number.isFinite(containerWidth) ? containerWidth : 740
  const safeHeight = Number.isFinite(containerHeight) ? containerHeight : 224
  const compactWidthProgress = Math.max(0, Math.min(1, (
    safeWidth - STATION_CAROUSEL_LARGE_SCREEN_TUNING.compactReferenceWidth
  ) / (
    STATION_CAROUSEL_LARGE_SCREEN_TUNING.compactMaxWidth
      - STATION_CAROUSEL_LARGE_SCREEN_TUNING.compactReferenceWidth
  )))
  const compactWidthInfluence = Math.sqrt(compactWidthProgress)
  const compactWidthScale = 1 + (
    STATION_CAROUSEL_LARGE_SCREEN_TUNING.compactMaxScale - 1
  ) * compactWidthInfluence
  const largeScreenWidthScale = safeWidth
    / STATION_CAROUSEL_LARGE_SCREEN_TUNING.referenceWidth
  const widthScale = Math.max(compactWidthScale, largeScreenWidthScale)
  const stackedBaseHeight = STATION_CAROUSEL_TUNING.cardHeight
    + STATION_CAROUSEL_TUNING.cardWidth * STATION_CAROUSEL_LARGE_SCREEN_TUNING.favoritesRatio
  const heightScale = (
    safeHeight
      - STATION_CAROUSEL_LARGE_SCREEN_TUNING.minimumFavoritesGap
      - STATION_CAROUSEL_LARGE_SCREEN_TUNING.fitRoundingBuffer
  ) / stackedBaseHeight
  const tallStageInfluence = Math.max(0, Math.min(1, (
    safeHeight / Math.max(1, safeWidth)
      - STATION_CAROUSEL_LARGE_SCREEN_TUNING.balancedFillAspectStart
  ) / (
    STATION_CAROUSEL_LARGE_SCREEN_TUNING.balancedFillAspectFull
      - STATION_CAROUSEL_LARGE_SCREEN_TUNING.balancedFillAspectStart
  )))
  const balancedHeightScale = 1 + Math.max(0, heightScale - 1)
    * STATION_CAROUSEL_LARGE_SCREEN_TUNING.balancedFillHeightShare
  const balancedFillScale = widthScale + Math.max(0, balancedHeightScale - widthScale)
    * tallStageInfluence
    * compactWidthInfluence
  const inlineFitScale = (
    safeWidth - STATION_CAROUSEL_LARGE_SCREEN_TUNING.fitRoundingBuffer
  ) / (
    STATION_CAROUSEL_TUNING.cardWidth
      * STATION_CAROUSEL_LARGE_SCREEN_TUNING.favoritesRatio
  )
  const roomyScale = constrainedLandscape
    ? 1
    : Math.max(1, Math.min(
        STATION_CAROUSEL_LARGE_SCREEN_TUNING.maxScale,
        balancedFillScale,
        inlineFitScale,
        heightScale,
      ))
  const cardHeight = constrainedLandscape
    ? Math.max(72, Math.min(224, Math.floor(safeHeight)))
    : Math.round(STATION_CAROUSEL_TUNING.cardHeight * roomyScale)
  const cardWidth = constrainedLandscape
    ? Math.round(cardHeight * 192 / 224)
    : Math.round(STATION_CAROUSEL_TUNING.cardWidth * roomyScale)
  return {
    ...STATION_CAROUSEL_TUNING,
    cardWidth,
    cardHeight,
    radius: Math.round(STATION_CAROUSEL_TUNING.radius * roomyScale),
    perspective: Math.round(STATION_CAROUSEL_TUNING.perspective * roomyScale),
    // Preserve the approved 27-degree composition when room permits. At the
    // medium-width shell, pull the second pair of wings inward far enough to
    // remain recognizable instead of leaving only imperceptible slivers.
    spread: safeWidth < 700 && !constrainedLandscape
      ? 20
      : STATION_CAROUSEL_TUNING.spread,
  }
}

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
    const index = ((raw % items.length) + items.length) % items.length
    result.add(items[index].id)
  }
  return result
}

/**
 * Adds a unique, non-semantic copy of the nearest items to both ends of a
 * finite rail. Station carousels use this physical breathing room so the
 * curved presentation can always draw the same unique neighbors on the left
 * and right; the controller silently returns an edge copy to its real item.
 *
 * @template {AdaptiveCarouselItem} T
 * @param {readonly T[]} items
 * @param {number} requestedRadius
 * @param {boolean} enabled
 * @returns {readonly (T & { canonicalId?: string, loopClone?: boolean })[]}
 */
export function createAdaptiveCarouselLoopBuffer(items, requestedRadius, enabled) {
  if (!enabled || items.length < 3) return items
  const radius = Math.min(
    Math.max(1, Math.round(requestedRadius)),
    Math.floor((items.length - 1) / 2),
  )
  const originals = items.map((item) => ({
    ...item,
    canonicalId: item.id,
    loopClone: false,
  }))
  /** @param {T} item @param {"before" | "after"} side @param {number} index */
  const clone = (item, side, index) => ({
    ...item,
    id: `__ml-${side}-${index}-${item.id}`,
    canonicalId: item.id,
    loopClone: true,
  })
  return [
    ...items.slice(-radius).map((item, index) => clone(item, "before", index)),
    ...originals,
    ...items.slice(0, radius).map((item, index) => clone(item, "after", index)),
  ]
}

/**
 * Preserves the approved curved spacing when a loop uses a finite physical
 * buffer. The buffer's whole-slide positions must be translated back to the
 * same fractional ring steps that the visual presentation used before.
 *
 * @param {number} physicalProgress
 * @param {number} logicalItemCount
 * @param {boolean} buffered
 * @returns {number}
 */
export function getAdaptiveCarouselPresentationProgress(
  physicalProgress,
  logicalItemCount,
  buffered,
) {
  if (!buffered || logicalItemCount < 2) return physicalProgress
  return physicalProgress * ((logicalItemCount - 1) / logicalItemCount)
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
    // The fourth Station wing is nearly edge-on. Ease just that outer portion
    // inward so proportional scaling keeps a recognizable sliver at both
    // viewport edges without changing the approved first three card positions.
    const outerWingTuck = surface === "stations"
      ? Math.max(0, absoluteProgress - 3)
        * /** @type {number} */ (tuning.cardWidth) * 0.15
      : 0
    return {
      "--carousel-x": `${(
        Math.sin(radians) * /** @type {number} */ (tuning.radius)
        - linearOffset
        - Math.sign(progress) * outerWingTuck
      ).toFixed(2)}px`,
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
