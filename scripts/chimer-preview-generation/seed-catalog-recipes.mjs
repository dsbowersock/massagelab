import { existsSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { backgroundRegistry } from "../../components/backgrounds/backgroundRegistry.ts"
import { BACKGROUND_BRANDING_AUDIT_BATCHES } from "../background-branding/audit-batches.mjs"
import { APPROVED_PILOT_RECIPES } from "./approved-pilot-recipes.mjs"

const OUTPUT_PATH = fileURLToPath(new URL("../../data/background-preview-recipes.json", import.meta.url))
const ORDERED_IDS = BACKGROUND_BRANDING_AUDIT_BATCHES.flatMap(({ ids }) => ids)
const STATIC_IDS = new Set(["solid-color", "static-gradient"])

const timingByIntensity = Object.freeze({
  subtle: Object.freeze({ durationMs: 12000, posterTimeMs: 4000, crossfadeMs: 900, fps: 24 }),
  medium: Object.freeze({ durationMs: 10000, posterTimeMs: 3333, crossfadeMs: 800, fps: 24 }),
  high: Object.freeze({ durationMs: 8000, posterTimeMs: 2667, crossfadeMs: 600, fps: 30 }),
})

/** Seeds a review candidate without deriving timing in the production runtime. */
function candidateRecipe(definition) {
  const shared = {
    backgroundId: definition.id,
    recipeRevision: "recipe-1",
    reviewStatus: "candidate",
    warmupMs: 2200,
    passiveCaptureState: "default",
    framing: { landscape: null, square: null, vertical: null },
  }
  if (STATIC_IDS.has(definition.id)) {
    return {
      ...shared,
      mediaKind: "poster-only",
      durationMs: 0,
      posterTimeMs: 0,
      loopStrategy: "static",
      crossfadeMs: 0,
      fps: 0,
    }
  }
  const timing = timingByIntensity[definition.motionIntensity]
  if (!timing) throw new Error(`${definition.id}: unsupported motion intensity ${definition.motionIntensity}`)
  return {
    ...shared,
    mediaKind: "animated",
    ...timing,
    loopStrategy: "crossfade",
  }
}

const enabledById = new Map(backgroundRegistry.filter(({ enabled }) => enabled).map((entry) => [entry.id, entry]))
if (ORDERED_IDS.length !== enabledById.size || new Set(ORDERED_IDS).size !== ORDERED_IDS.length) {
  throw new Error(`Expected one ordered recipe ID for each of ${enabledById.size} enabled backgrounds.`)
}

/** Writes initial review candidates only when overwrite intent is explicit. */
export function seedCatalogRecipes({ outputPath = OUTPUT_PATH, force = false } = {}) {
  if (existsSync(outputPath) && !force) {
    throw new Error(`${outputPath}: recipe catalog already exists; pass --force to replace reviewed state.`)
  }
  const rows = Object.fromEntries(ORDERED_IDS.map((id) => {
    const definition = enabledById.get(id)
    if (!definition) throw new Error(`${id}: approved batch ID is not enabled in the canonical registry.`)
    return [id, APPROVED_PILOT_RECIPES[id] ?? candidateRecipe(definition)]
  }))

  writeFileSync(outputPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8")
  console.log(`Wrote ${Object.keys(rows).length} explicit background preview recipes to ${outputPath}.`)
  return rows
}

const directInvocation = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (directInvocation) seedCatalogRecipes({ force: process.argv.slice(2).includes("--force") })
