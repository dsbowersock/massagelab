import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { validatePilotManifest } from "./media-validation.mjs"
import { FULL_CATALOG_BATCHES, PILOT_BACKGROUND_IDS } from "./preview-recipes.mjs"
import { serializeCatalogRenditionManifest } from "./rendition-manifest-module.mjs"
import { copyApprovedPilotMedia } from "./approved-pilot-import-paths.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const outputDir = path.join(repoRoot, "public/chimer/background-preview-catalog")
const sourceArgument = process.argv[2]
if (!sourceArgument) throw new Error("Pass the approved pilot directory as the only argument.")
const sourceDir = path.resolve(sourceArgument)
if (!existsSync(path.join(sourceDir, "index.json"))) throw new Error("Approved pilot index.json is missing.")

const sourceManifest = JSON.parse(readFileSync(path.join(sourceDir, "index.json"), "utf8"))
const errors = validatePilotManifest(sourceManifest.entries)
if (errors.length) throw new Error(errors.join("\n"))
if (sourceManifest.entries.length !== PILOT_BACKGROUND_IDS.length
  || !PILOT_BACKGROUND_IDS.every((id) => sourceManifest.entries.some((entry) => entry.backgroundId === id))) {
  throw new Error("Approved pilot manifest does not contain the frozen eight-background set.")
}

copyApprovedPilotMedia(sourceManifest.entries, { sourceDir, outputDir })
mkdirSync(outputDir, { recursive: true })
const currentPath = path.join(outputDir, "index.json")
const current = existsSync(currentPath)
  ? JSON.parse(readFileSync(currentPath, "utf8"))
  : { schemaVersion: 3, entries: [] }
const entriesById = new Map(current.entries.map((entry) => [entry.backgroundId, entry]))
for (const entry of sourceManifest.entries) {
  entriesById.set(entry.backgroundId, {
    ...entry,
    mediaKind: "animated",
    reviewStatus: "approved",
    batchSlug: FULL_CATALOG_BATCHES.find(({ ids }) => ids.includes(entry.backgroundId))?.slug,
  })
}
writeFileSync(currentPath, serializeCatalogRenditionManifest([...entriesById.values()]), "utf8")
console.log(`Imported ${sourceManifest.entries.length} approved pilot entries into the local catalog.`)
