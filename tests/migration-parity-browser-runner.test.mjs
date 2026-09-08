import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { BROWSER_QA_TELEMETRY_ENVIRONMENT } from "../scripts/browser-qa-environment.mjs"
import {
  MIGRATION_PARITY_SPEC,
  applyMigrationParityChildOutcome,
  resolveMigrationParityBrowserQaEnvironment,
  runMigrationParityBrowserQa,
} from "../scripts/run-migration-parity-browser-qa.mjs"

test("only the migration-parity npm script uses the Node environment bridge", async () => {
  const packageData = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

  assert.equal(packageData.scripts["test:browser"], "playwright test")
  assert.equal(
    packageData.scripts["test:browser:migration-parity"],
    "node scripts/run-migration-parity-browser-qa.mjs",
  )
})

test("migration-parity runner preserves the current environment and restores exact telemetry values", () => {
  const parentEnvironment = {
    KEEP_ME: "present",
    NEXT_PUBLIC_SENTRY_DSN: "inherited-public-dsn",
    SENTRY_DSN: "inherited-server-dsn",
    SENTRY_AUTH_TOKEN: "inherited-upload-token",
    NEXT_TELEMETRY_DISABLED: "0",
  }

  const childEnvironment = resolveMigrationParityBrowserQaEnvironment(parentEnvironment)

  assert.equal(childEnvironment.KEEP_ME, "present")
  assert.deepEqual(
    Object.fromEntries(Object.keys(BROWSER_QA_TELEMETRY_ENVIRONMENT).map((name) => [
      name,
      childEnvironment[name],
    ])),
    BROWSER_QA_TELEMETRY_ENVIRONMENT,
  )
  assert.equal(parentEnvironment.NEXT_PUBLIC_SENTRY_DSN, "inherited-public-dsn")
})

test("migration-parity runner refuses a missing or incorrect explicit mode before spawn", () => {
  for (const mode of [undefined, "0", "unexpected-mode-must-not-appear"]) {
    let spawnCalls = 0
    assert.throws(
      () => runMigrationParityBrowserQa({
        environment: mode === undefined ? {} : { ATMOSHAPER_MIGRATION_PARITY: mode },
        spawn() {
          spawnCalls += 1
          return { status: 0, signal: null }
        },
      }),
      (error) => (
        /requires ATMOSHAPER_MIGRATION_PARITY=1/.test(error.message)
        && !error.message.includes("unexpected-mode-must-not-appear")
      ),
    )
    assert.equal(spawnCalls, 0)
  }
})

test("migration-parity runner forwards CLI arguments without a shell", () => {
  const calls = []
  const result = runMigrationParityBrowserQa({
    args: ["--project=mobile-chromium", "--grep", "exact test"],
    environment: { KEEP_ME: "present", ATMOSHAPER_MIGRATION_PARITY: "1" },
    executable: "node-runtime",
    playwrightCli: "playwright-cli.js",
    spawn(command, args, options) {
      calls.push({ command, args, options })
      return { status: 0, signal: null }
    },
  })

  assert.deepEqual(result, { status: 0, signal: null })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, "node-runtime")
  assert.deepEqual(calls[0].args, [
    "playwright-cli.js",
    "test",
    MIGRATION_PARITY_SPEC,
    "--project=mobile-chromium",
    "--grep",
    "exact test",
  ])
  assert.equal(calls[0].options.env.KEEP_ME, "present")
  assert.equal(calls[0].options.stdio, "inherit")
  assert.equal(calls[0].options.shell, false)
})

test("migration-parity runner propagates child errors, exit status, and signals", () => {
  const childError = new Error("child launch failed")
  assert.throws(
    () => applyMigrationParityChildOutcome({ error: childError }),
    (error) => error === childError,
  )

  const exitCodes = []
  applyMigrationParityChildOutcome(
    { status: 7, signal: null },
    { setExitCode: (status) => exitCodes.push(status), raiseSignal: () => assert.fail("unexpected signal") },
  )
  assert.deepEqual(exitCodes, [7])

  const signals = []
  applyMigrationParityChildOutcome(
    { status: null, signal: "SIGTERM" },
    { setExitCode: () => assert.fail("unexpected exit status"), raiseSignal: (signal) => signals.push(signal) },
  )
  assert.deepEqual(signals, ["SIGTERM"])
})
