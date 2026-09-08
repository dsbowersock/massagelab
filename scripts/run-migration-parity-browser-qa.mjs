import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { BROWSER_QA_TELEMETRY_ENVIRONMENT } from "./browser-qa-environment.mjs"

const require = createRequire(import.meta.url)
const DEFAULT_PLAYWRIGHT_CLI = require.resolve("@playwright/test/cli")

export const MIGRATION_PARITY_SPEC = "tests/browser/atmoshaper-repository-migration-parity.spec.ts"

/**
 * Reasserts explicit telemetry values in a Node-owned child environment.
 * Windows PowerShell omits empty environment variables when starting npm, but
 * Node child_process preserves the empty strings required by the QA preflight.
 */
export function resolveMigrationParityBrowserQaEnvironment(environment = process.env) {
  return {
    ...environment,
    ...BROWSER_QA_TELEMETRY_ENVIRONMENT,
  }
}

/** Launches the exact migration-parity spec while forwarding all npm CLI arguments. */
export function runMigrationParityBrowserQa({
  args = process.argv.slice(2),
  environment = process.env,
  executable = process.execPath,
  playwrightCli = DEFAULT_PLAYWRIGHT_CLI,
  spawn = spawnSync,
} = {}) {
  if (environment.ATMOSHAPER_MIGRATION_PARITY !== "1") {
    throw new Error("Migration parity runner requires ATMOSHAPER_MIGRATION_PARITY=1.")
  }
  return spawn(executable, [playwrightCli, "test", MIGRATION_PARITY_SPEC, ...args], {
    env: resolveMigrationParityBrowserQaEnvironment(environment),
    stdio: "inherit",
    shell: false,
  })
}

/** Propagates launch errors and preserves the Playwright child's status or signal. */
export function applyMigrationParityChildOutcome(result, {
  setExitCode = (status) => { process.exitCode = status },
  raiseSignal = (signal) => { process.kill(process.pid, signal) },
} = {}) {
  if (result.error) throw result.error
  if (result.signal) {
    raiseSignal(result.signal)
    return
  }
  setExitCode(result.status ?? 1)
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  applyMigrationParityChildOutcome(runMigrationParityBrowserQa())
}
