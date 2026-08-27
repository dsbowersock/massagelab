import { existsSync, readFileSync, readdirSync } from "node:fs"
import { extname, join, resolve } from "node:path"

const staticRoot = resolve(".next", "static")
if (!existsSync(staticRoot)) throw new Error("Build .next before checking the production client bundle.")

/** Returns every file below the emitted static root for marker inspection. */
function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const forbiddenMarkers = [
  "massagelabAtmoShaperBrowserQa",
  "Browser QA injected failure",
  "failNextSourceIds",
]
const contaminated = filesUnder(staticRoot)
  .filter((path) => extname(path) === ".js")
  .filter((path) => forbiddenMarkers.some((marker) => readFileSync(path, "utf8").includes(marker)))

if (contaminated.length > 0) {
  throw new Error(`Ordinary production client bundle contains AtmoShaper QA hooks: ${contaminated.join(", ")}`)
}
console.log("AtmoShaper QA hooks are absent from the ordinary production client bundle.")
