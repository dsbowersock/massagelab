// @ts-check

export const CAROUSEL_LAB_STORAGE_KEY = "massagelab-carousel-lab-v1"
export const CAROUSEL_LAB_PAIRS = Object.freeze([
  "backgrounds:existing", "backgrounds:cover-flow", "backgrounds:three-d",
  "stations:existing", "stations:cover-flow", "stations:three-d",
])

const sharedDefaults = {
  backgrounds: { cardWidth: 208, gap: 16, visibleRadius: 3, loop: false, motion: true },
  stations: { cardWidth: 208, gap: 20, visibleRadius: 2, loop: false, motion: true },
}
const adapterDefaults = {
  existing: { spread: 35, radius: 285, scaleFalloff: 0.08 },
  "cover-flow": {
    rotation: 33, centerScale: 1.2, edgeScale: 0.75, perspective: 900,
    reflection: true, reflectionOpacity: 0.4, reflectionGap: 8,
  },
  "three-d": {
    perspective: 320, arcAngle: 22, depth: 280, centerScale: 1.08,
    edgeScale: 0.78, nearMask: 0.9, farMask: 1.8,
  },
}

const ranges = {
  cardWidth: { backgrounds: [160, 280, 4], stations: [168, 320, 4] },
  gap: [0, 64, 2],
  visibleRadius: [1, 4, 1],
  spread: [15, 50, 1],
  radius: [160, 420, 5],
  scaleFalloff: [0.04, 0.15, 0.01],
  rotation: [0, 55, 1],
  centerScaleCover: [1, 1.35, 0.01],
  edgeScaleCover: [0.6, 1, 0.01],
  perspectiveCover: [400, 1600, 20],
  reflectionOpacity: [0, 0.65, 0.05],
  reflectionGap: [0, 24, 1],
  perspectiveThreeD: [240, 1200, 20],
  arcAngle: [12, 50, 1],
  depth: [80, 520, 10],
  centerScaleThreeD: [1, 1.3, 0.01],
  edgeScaleThreeD: [0.55, 1, 0.01],
  nearMask: [0.25, 1.5, 0.05],
  farMask: [1, 3, 0.05],
}

// Clamp and snap persisted values to the same increments exposed by Lab controls.
function numberAt(value, fallback, range) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  const [min, max, step] = range
  const clamped = Math.min(max, Math.max(min, numeric))
  return Number((Math.round(clamped / step) * step).toFixed(4))
}

export function getDefaultCarouselLabTuning(surface, presentation) {
  const common = sharedDefaults[surface] ?? sharedDefaults.backgrounds
  const adapter = adapterDefaults[presentation] ?? adapterDefaults.existing
  return { ...common, ...adapter }
}

export function sanitizeCarouselLabTuning(surface, presentation, value) {
  const input = value && typeof value === "object" ? value : {}
  const defaults = getDefaultCarouselLabTuning(surface, presentation)
  const output = {
    cardWidth: numberAt(input.cardWidth, defaults.cardWidth, ranges.cardWidth[surface] ?? ranges.cardWidth.backgrounds),
    gap: numberAt(input.gap, defaults.gap, ranges.gap),
    visibleRadius: numberAt(input.visibleRadius, defaults.visibleRadius, ranges.visibleRadius),
    loop: typeof input.loop === "boolean" ? input.loop : defaults.loop,
    motion: typeof input.motion === "boolean" ? input.motion : defaults.motion,
  }
  if (presentation === "existing") {
    if (surface === "stations") return output
    return {
      ...output,
      spread: numberAt(input.spread, defaults.spread, ranges.spread),
      radius: numberAt(input.radius, defaults.radius, ranges.radius),
      scaleFalloff: numberAt(input.scaleFalloff, defaults.scaleFalloff, ranges.scaleFalloff),
    }
  }
  if (presentation === "cover-flow") {
    return {
      ...output,
      rotation: numberAt(input.rotation, defaults.rotation, ranges.rotation),
      centerScale: numberAt(input.centerScale, defaults.centerScale, ranges.centerScaleCover),
      edgeScale: numberAt(input.edgeScale, defaults.edgeScale, ranges.edgeScaleCover),
      perspective: numberAt(input.perspective, defaults.perspective, ranges.perspectiveCover),
      reflection: typeof input.reflection === "boolean" ? input.reflection : defaults.reflection,
      reflectionOpacity: numberAt(input.reflectionOpacity, defaults.reflectionOpacity, ranges.reflectionOpacity),
      reflectionGap: numberAt(input.reflectionGap, defaults.reflectionGap, ranges.reflectionGap),
    }
  }
  return {
    ...output,
    perspective: numberAt(input.perspective, defaults.perspective, ranges.perspectiveThreeD),
    arcAngle: numberAt(input.arcAngle, defaults.arcAngle, ranges.arcAngle),
    depth: numberAt(input.depth, defaults.depth, ranges.depth),
    centerScale: numberAt(input.centerScale, defaults.centerScale, ranges.centerScaleThreeD),
    edgeScale: numberAt(input.edgeScale, defaults.edgeScale, ranges.edgeScaleThreeD),
    nearMask: numberAt(input.nearMask, defaults.nearMask, ranges.nearMask),
    farMask: numberAt(input.farMask, defaults.farMask, ranges.farMask),
  }
}

// Rebuild every pair independently so one malformed saved value cannot reset the others.
export function parseCarouselLabStorage(raw) {
  let values = {}
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : null
    values = parsed?.version === 1 && parsed.values && typeof parsed.values === "object" ? parsed.values : {}
  } catch {
    values = {}
  }
  return Object.fromEntries(CAROUSEL_LAB_PAIRS.map((key) => {
    const [surface, presentation] = key.split(":")
    return [key, sanitizeCarouselLabTuning(surface, presentation, values[key])]
  }))
}

export function serializeCarouselLabStorage(record) {
  const values = Object.fromEntries(CAROUSEL_LAB_PAIRS.map((key) => {
    const [surface, presentation] = key.split(":")
    return [key, sanitizeCarouselLabTuning(surface, presentation, record?.[key])]
  }))
  return JSON.stringify({ version: 1, values })
}

export function resolveEffectiveLoop(itemCount, visibleRadius, requested) {
  return Boolean(requested && itemCount > visibleRadius * 2 + 1)
}

// Stable, unique IDs are the identity contract shared by centering and nearby mounts.
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

export function reconcileCenteredId(items, preferredId, selectedId) {
  const uniqueItems = normalizeCarouselLabItems(items)
  const ids = new Set(uniqueItems.map(({ id }) => id))
  if (preferredId && ids.has(preferredId)) return preferredId
  if (selectedId && ids.has(selectedId)) return selectedId
  return uniqueItems[0]?.id ?? null
}

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
export function getPresentationVariables(presentation, surface, progress, tuning, reducedMotion) {
  if (reducedMotion || tuning.motion === false || (presentation === "existing" && surface === "stations")) {
    return {
      "--lab-x": "0px", "--lab-z": "0px", "--lab-rotate-y": "0deg",
      "--lab-scale": "1", "--lab-opacity": "1",
    }
  }
  const distance = Math.min(1, Math.abs(progress) / Math.max(1, tuning.visibleRadius))
  if (presentation === "existing") {
    const angle = progress * tuning.spread
    const radians = angle * Math.PI / 180
    return {
      "--lab-x": `${(Math.sin(radians) * tuning.radius).toFixed(2)}px`,
      "--lab-z": `${((Math.cos(radians) - 1) * tuning.radius).toFixed(2)}px`,
      "--lab-rotate-y": `${(-angle * 0.45).toFixed(2)}deg`,
      "--lab-scale": String(Math.max(0.65, 1 - Math.abs(progress) * tuning.scaleFalloff)),
      "--lab-opacity": String(Math.max(0.28, 1 - distance * 0.55)),
    }
  }
  if (presentation === "cover-flow") {
    return {
      "--lab-x": "0px", "--lab-z": `${(-distance * 90).toFixed(2)}px`,
      "--lab-rotate-y": `${-Math.sign(progress) * tuning.rotation * Math.min(1, Math.abs(progress))}deg`,
      "--lab-scale": String(tuning.centerScale + (tuning.edgeScale - tuning.centerScale) * distance),
      "--lab-opacity": String(Math.max(0.4, 1 - distance * 0.45)),
    }
  }
  return {
    "--lab-x": "0px",
    "--lab-z": `${(-distance * tuning.depth).toFixed(2)}px`,
    "--lab-rotate-y": `${(-progress * tuning.arcAngle).toFixed(2)}deg`,
    "--lab-scale": String(tuning.centerScale + (tuning.edgeScale - tuning.centerScale) * distance),
    "--lab-opacity": String(Math.max(0.18, 1 - distance * (tuning.farMask / 2.5))),
  }
}
