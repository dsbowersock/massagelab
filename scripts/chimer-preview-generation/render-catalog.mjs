import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { selectRenderPilotIds } from "./render-pilot-helpers.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const catalogRoot = path.join(repoRoot, "public/chimer/background-preview-catalog")
const productionRoot = path.join(repoRoot, "public/chimer/background-previews")
const pilotRoot = path.join(repoRoot, "public/chimer/background-preview-pilot")

function requiredValue(argv, index, option) {
  const value = argv[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`)
  return value
}

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
    switch (arg) {
      case "--base-url": options.baseUrl = requiredValue(argv, index, arg); index += 1; break
      case "--batch": options.batch = requiredValue(argv, index, arg); index += 1; break
      case "--force": options.force = true; break
      case "--ids": options.ids = requiredValue(argv, index, arg).split(",").map((value) => value.trim()).filter(Boolean); index += 1; break
      case "--output-dir": options.outputDir = path.resolve(repoRoot, requiredValue(argv, index, arg)); index += 1; break
      case "--port": options.port = requiredValue(argv, index, arg); index += 1; break
      case "--resume": options.resume = true; break
      case "--skip-server": options.skipServer = true; break
      case "--validate-only": options.validateOnly = true; break
      default: throw new Error(`Unknown option or positional argument: ${arg}`)
    }
  }
  // The package validation command is read-only and may safely target only
  // the fixed checked-in catalog root; generation still requires an explicit path.
  if (options.validateOnly && !options.outputDir) options.outputDir = catalogRoot
  if (!options.outputDir) throw new Error("Catalog output directory is required; pass --output-dir <path>.")
  if ([productionRoot, pilotRoot].includes(options.outputDir)) {
    throw new Error("Refusing production preview directory or approved pilot directory.")
  }
  if (options.outputDir !== catalogRoot) {
    throw new Error("Catalog output must be public/chimer/background-preview-catalog.")
  }
  options.ids = selectRenderPilotIds({
    catalogMode: true,
    batchSlug: options.batch,
    ids: options.ids,
  })
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
  if (result.status === null) {
    throw new Error(`Catalog renderer terminated without an exit code${result.signal ? ` after signal ${result.signal}` : ""}.`)
  }
  if (result.status !== 0) process.exitCode = result.status ?? 1
}

main()
