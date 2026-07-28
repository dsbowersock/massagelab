#!/usr/bin/env node

/**
 * Vercel build entrypoint for the one-time Track 1 Production verification.
 *
 * Sensitive Production variables cannot be exported from Vercel, so the exact
 * GET-only Stripe readiness command must run inside the Production build where
 * those values are available. Preview builds skip the live check and use the
 * repository's existing build command unchanged.
 */
import { spawn } from "node:child_process"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const PRODUCTION_READINESS_ARGS = Object.freeze([
  "run",
  "stripe:readiness",
  "--",
  "--live",
  "--verify-stripe",
  "--no-dotenv",
])
const APPLICATION_BUILD_ARGS = Object.freeze(["run", "build"])

/**
 * Returns the ordered, secret-safe npm steps for a Vercel deployment.
 *
 * @param {NodeJS.ProcessEnv} env Vercel's build environment.
 * @returns {ReadonlyArray<{ label: string, args: ReadonlyArray<string> }>}
 * Production verifies live Stripe readiness before building; other
 * environments run only the normal application build.
 */
export function getVercelBuildSteps(env) {
  const steps = []
  if (env.VERCEL_ENV === "production") {
    steps.push({
      label: "Production Stripe readiness",
      args: PRODUCTION_READINESS_ARGS,
    })
  }
  steps.push({
    label: "application build",
    args: APPLICATION_BUILD_ARGS,
  })
  return steps
}

/**
 * Runs one npm step without a shell so environment values cannot be expanded
 * into the command line or logs.
 *
 * @param {ReadonlyArray<string>} args npm arguments for the step.
 * @returns {Promise<number>} Child exit code, defaulting to failure when absent.
 */
function runNpm(args) {
  const npmCliPath = process.env.npm_execpath?.trim()
  if (!npmCliPath) {
    throw new Error("npm_execpath is required for the Vercel build entrypoint.")
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCliPath, ...args], {
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    })
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })
}

/**
 * Runs the build steps sequentially and stops immediately when any step fails.
 *
 * @returns {Promise<number>} Zero only when every required step succeeds.
 */
export async function runVercelBuild() {
  for (const step of getVercelBuildSteps(process.env)) {
    console.log(`Running ${step.label}.`)
    const exitCode = await runNpm(step.args)
    if (exitCode !== 0) {
      return exitCode
    }
  }
  return 0
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  fileURLToPath(import.meta.url) === path.resolve(invokedPath)
) {
  process.exitCode = await runVercelBuild()
}
