import { spawnSync } from "node:child_process"
import { resolveBrowserQaBuildEnvironment } from "./browser-qa-environment.mjs"

/** Builds the isolated client artifact whose module aliases include browser-QA hooks. */
const result = spawnSync(process.execPath, ["--run", "build:next"], {
  // Child-process only: Browser-QA aliases and RSC proof hooks are enabled,
  // telemetry is inert, and database URLs are either approved or blank.
  env: resolveBrowserQaBuildEnvironment(process.env),
  stdio: "inherit",
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
