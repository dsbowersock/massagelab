export const BROWSER_QA_PROJECT_NAMES = [
  "desktop-chromium",
  "mobile-chromium",
]

export const ORDINARY_BROWSER_QA_SPEC_FILES = [
  "admin-user-operations.spec.ts",
  "app-shell.spec.ts",
  "background-commerce.spec.ts",
  "control-system-review.spec.ts",
  "immersive-panel-shell.spec.ts",
  "local-first.spec.ts",
  "music-visualizer.spec.ts",
  "public-routes.spec.ts",
  "pwa.spec.ts",
]

export const BROWSER_QA_LANES = {
  "1": {
    "desktop-chromium": [
      "local-first.spec.ts",
      "pwa.spec.ts",
      "admin-user-operations.spec.ts",
    ],
    "mobile-chromium": [
      "public-routes.spec.ts",
      "admin-user-operations.spec.ts",
    ],
  },
  "2": {
    "desktop-chromium": [
      "public-routes.spec.ts",
      "app-shell.spec.ts",
      "immersive-panel-shell.spec.ts",
      "control-system-review.spec.ts",
    ],
  },
  "3": {
    "mobile-chromium": [
      "background-commerce.spec.ts",
      "app-shell.spec.ts",
      "immersive-panel-shell.spec.ts",
    ],
  },
  "4": {
    "desktop-chromium": [
      "background-commerce.spec.ts",
      "music-visualizer.spec.ts",
    ],
    "mobile-chromium": [
      "music-visualizer.spec.ts",
      "control-system-review.spec.ts",
      "local-first.spec.ts",
      "pwa.spec.ts",
    ],
  },
}

/**
 * Validates that browser-QA lanes provide exact-once coverage of every ordinary
 * Playwright project/spec pair, rejecting partitions that could omit or repeat QA.
 */
export function assertBrowserQaLaneCoverage(lanes = BROWSER_QA_LANES) {
  if (!lanes || typeof lanes !== "object" || Array.isArray(lanes)) {
    throw new Error("Browser QA lanes must be an object with exactly four lane IDs")
  }

  const laneEntries = Object.entries(lanes)
  if (laneEntries.length !== 4) {
    throw new Error(`Browser QA lanes must contain exactly four lane IDs; found ${laneEntries.length}`)
  }
  const expectedLaneIds = ["1", "2", "3", "4"]
  const laneIds = laneEntries.map(([laneId]) => laneId)
  if (!expectedLaneIds.every((laneId) => laneIds.includes(laneId))) {
    throw new Error(`Browser QA lanes must use exact lane IDs 1, 2, 3, and 4; found ${laneIds.join(", ")}`)
  }

  const expectedPairs = new Set(
    BROWSER_QA_PROJECT_NAMES.flatMap((projectName) => (
      ORDINARY_BROWSER_QA_SPEC_FILES.map((spec) => `${projectName}:${spec}`)
    )),
  )
  const coveredPairs = new Set()

  for (const [laneId, laneProjects] of laneEntries) {
    if (!laneProjects || typeof laneProjects !== "object" || Array.isArray(laneProjects)) {
      throw new Error(`Browser QA lane ${laneId} must contain at least one project/spec assignment`)
    }

    let hasAssignments = false
    for (const [projectName, specs] of Object.entries(laneProjects)) {
      if (!BROWSER_QA_PROJECT_NAMES.includes(projectName)) {
        throw new Error(`Browser QA lane ${laneId} uses unknown Playwright project: ${projectName}`)
      }
      if (!Array.isArray(specs)) {
        throw new Error(`Browser QA lane ${laneId} project ${projectName} must list ordinary specs`)
      }

      for (const spec of specs) {
        if (!ORDINARY_BROWSER_QA_SPEC_FILES.includes(spec)) {
          throw new Error(`Browser QA lane ${laneId} uses unknown ordinary spec: ${spec}`)
        }

        hasAssignments = true
        const pair = `${projectName}:${spec}`
        if (coveredPairs.has(pair)) {
          throw new Error(`Browser QA lanes duplicate project/spec pair: ${pair}`)
        }
        coveredPairs.add(pair)
      }
    }

    if (!hasAssignments) {
      throw new Error(`Browser QA lane ${laneId} must not be empty`)
    }
  }

  for (const pair of expectedPairs) {
    if (!coveredPairs.has(pair)) {
      throw new Error(`Browser QA lanes are missing project/spec pair: ${pair}`)
    }
  }
}

/**
 * Resolves a requested CI lane to its non-empty Playwright project descriptors.
 * A missing lane preserves the ordinary local project matrix unchanged.
 */
export function resolveCiBrowserQaLaneProjects(laneId) {
  if (typeof laneId !== "string" || laneId.trim().length === 0) return null

  assertBrowserQaLaneCoverage()
  const normalizedLaneId = laneId.trim()
  const lane = BROWSER_QA_LANES[normalizedLaneId]
  if (!lane) throw new Error(`Unknown browser QA lane: ${normalizedLaneId}`)

  return Object.entries(lane)
    .filter(([, specs]) => specs.length > 0)
    .map(([name, specs]) => ({
      name,
      testMatch: specs.map((spec) => `**/${spec}`),
    }))
}
