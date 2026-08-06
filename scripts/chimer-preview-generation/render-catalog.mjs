import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  FULL_CATALOG_BACKGROUND_IDS,
  FULL_CATALOG_BATCHES,
} from "./preview-recipes.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const catalogRoot = path.join(repoRoot, "public/chimer/background-preview-catalog")
const productionRoot = path.join(repoRoot, "public/chimer/background-previews")
const pilotRoot = path.join(repoRoot, "public/chimer/background-preview-pilot")

function parseArgs(argv) {
  const options = {
    baseUrl: "",
    batch: "",
    force: false,
    ids: [],
    outputDir: "",
    port: "",
    resume: false,
    skipServer: false,
    validateOnly: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    switch (arg) {
      case "--base-url": options.baseUrl = next ?? ""; index += 1; break
      case "--batch": options.batch = next ?? ""; index += 1; break
      case "--force": options.force = true; break
      case "--ids": options.ids = (next ?? "").split(",").map((value) => value.trim()).filter(Boolean); index += 1; break
      case "--output-dir": options.outputDir = next ? path.resolve(repoRoot, next) : ""; index += 1; break
      case "--port": options.port = next ?? ""; index += 1; break
      case "--resume": options.resume = true; break
      case "--skip-server": options.skipServer = true; break
      case "--validate-only": options.validateOnly = true; break
      default: if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`)
    }
  }
  if (!options.outputDir) throw new Error("Catalog output directory is required; pass --output-dir <path>.")
  if ([productionRoot, pilotRoot].includes(options.outputDir)) {
    throw new Error("Refusing production preview directory or approved pilot directory.")
  }
  if (options.outputDir !== catalogRoot) {
    throw new Error("Catalog output must be public/chimer/background-preview-catalog.")
  }
  if (options.batch && options.ids.length) throw new Error("Choose either --batch or --ids, not both.")
  const batch = options.batch ? FULL_CATALOG_BATCHES.find(({ slug }) => slug === options.batch) : null
  if (options.batch && !batch) throw new Error(`Unknown catalog batch: ${options.batch}`)
  const unknownIds = options.ids.filter((id) => !FULL_CATALOG_BACKGROUND_IDS.includes(id))
  if (unknownIds.length) throw new Error(`Unknown catalog background IDs: ${unknownIds.join(", ")}`)
  options.ids = batch ? [...batch.ids] : options.ids.length ? [...new Set(options.ids)] : [...FULL_CATALOG_BACKGROUND_IDS]
  return options
}

/**
 * Delegates to the proven pilot capture engine with a guarded catalog mode.
 * This command only writes local media and has no remote publication path.
 */
function main() {
  const options = parseArgs(process.argv.slice(2))
  const args = [
    "--experimental-strip-types",
    path.join(path.dirname(fileURLToPath(import.meta.url)), "render-pilot.mjs"),
    "--catalog-mode",
    "--output-dir", options.outputDir,
  ]
  if (!options.validateOnly) args.push("--ids", options.ids.join(","))
  if (options.baseUrl) args.push("--base-url", options.baseUrl)
  if (options.port) args.push("--port", options.port)
  if (options.force) args.push("--force")
  if (options.resume) args.push("--resume")
  if (options.skipServer) args.push("--skip-server")
  if (options.validateOnly) args.push("--validate-only")
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: "inherit" })
  if (result.error) throw result.error
  if (result.status !== 0) process.exitCode = result.status ?? 1
}

main()
