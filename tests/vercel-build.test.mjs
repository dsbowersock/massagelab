import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { describe, it } from "node:test"
import {
  getVercelBuildSteps,
  runVercelBuild,
} from "../scripts/vercel-build.mjs"

function createSpawnHarness() {
  const calls = []
  const children = []
  return {
    calls,
    children,
    spawnImpl(command, args, options) {
      const child = new EventEmitter()
      calls.push({ command, args, options })
      children.push(child)
      return child
    },
  }
}

function afterEventLoopTurn() {
  return new Promise((resolve) => setImmediate(resolve))
}

describe("Vercel build plan", () => {
  it("runs the exact GET-only live readiness check before a Production build", () => {
    assert.deepEqual(getVercelBuildSteps({ VERCEL_ENV: "production" }), [
      {
        label: "Production Stripe readiness",
        args: [
          "run",
          "stripe:readiness",
          "--",
          "--live",
          "--verify-stripe",
          "--no-dotenv",
        ],
      },
      {
        label: "application build",
        args: ["run", "build"],
      },
    ])
  })

  for (const vercelEnvironment of ["preview", "development", undefined]) {
    it(`keeps the normal build unchanged for ${vercelEnvironment ?? "local"} execution`, () => {
      assert.deepEqual(
        getVercelBuildSteps({ VERCEL_ENV: vercelEnvironment }),
        [
          {
            label: "application build",
            args: ["run", "build"],
          },
        ],
      )
    })
  }
})

describe("Vercel build execution", () => {
  const productionEnv = {
    VERCEL_ENV: "production",
    npm_execpath: "/safe/npm-cli.js",
  }

  it("runs shell-free Production steps sequentially", async () => {
    const harness = createSpawnHarness()
    const result = runVercelBuild({
      env: productionEnv,
      execPath: "/safe/node",
      spawnImpl: harness.spawnImpl,
      log() {},
    })

    assert.equal(harness.calls.length, 1)
    assert.deepEqual(harness.calls[0], {
      command: "/safe/node",
      args: [
        "/safe/npm-cli.js",
        "run",
        "stripe:readiness",
        "--",
        "--live",
        "--verify-stripe",
        "--no-dotenv",
      ],
      options: {
        env: productionEnv,
        shell: false,
        stdio: "inherit",
        windowsHide: true,
      },
    })

    harness.children[0].emit("exit", 0)
    await afterEventLoopTurn()
    assert.equal(harness.calls.length, 2)
    assert.deepEqual(harness.calls[1].args, [
      "/safe/npm-cli.js",
      "run",
      "build",
    ])

    harness.children[1].emit("exit", 0)
    assert.equal(await result, 0)
  })

  it("stops immediately when a step exits unsuccessfully", async () => {
    const harness = createSpawnHarness()
    const result = runVercelBuild({
      env: productionEnv,
      spawnImpl: harness.spawnImpl,
      log() {},
    })

    harness.children[0].emit("exit", 7)
    assert.equal(await result, 7)
    assert.equal(harness.calls.length, 1)
  })

  it("rejects a child-process spawn error", async () => {
    const harness = createSpawnHarness()
    const result = runVercelBuild({
      env: productionEnv,
      spawnImpl: harness.spawnImpl,
      log() {},
    })

    harness.children[0].emit("error", new Error("spawn unavailable"))
    await assert.rejects(result, /spawn unavailable/)
    assert.equal(harness.calls.length, 1)
  })
})
