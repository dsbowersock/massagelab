import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  resolveBuildCommand,
  runFamilyFriendsTimingReceipt,
} from "../scripts/family-friends-timing-receipt.mjs"

const MEASURED_RESULT = Object.freeze([{
  route: "/",
  sampleKind: "first",
  sample: 1,
  status: 200,
  durationMs: 12,
}])

function receiptDependencies(events, {
  occupied = false,
  readinessError = null,
} = {}) {
  const ownedChild = { id: "owned-child" }
  return {
    checkPortAvailable: async (options) => {
      events.push(["port check", options])
      return !occupied
    },
    runBuild: async () => {
      events.push(["build"])
    },
    startServer: async (options) => {
      events.push(["start", options])
      return ownedChild
    },
    waitForReadiness: async (options) => {
      events.push(["ready", options])
      if (readinessError) throw readinessError
    },
    measureRoutes: async (options) => {
      events.push(["measure", options])
      return MEASURED_RESULT
    },
    stopOwnedServer: async (child) => {
      events.push(["stop", child])
    },
    writeSummary: (summary) => {
      events.push(["write", summary])
    },
    ownedChild,
  }
}

describe("family-and-friends self-contained timing receipt", () => {
  it("runs npm's CLI through Node so the fresh build stays shell-free on Windows", () => {
    assert.deepEqual(resolveBuildCommand({
      nodeExecutable: "C:\\runtime\\node.exe",
      npmCli: "C:\\runtime\\node_modules\\npm\\bin\\npm-cli.js",
    }), {
      command: "C:\\runtime\\node.exe",
      args: [
        "C:\\runtime\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "build",
      ],
    })
  })

  it("checks the port, freshly builds, starts, waits, measures, and stops its owned server", async () => {
    const events = []
    const dependencies = receiptDependencies(events)

    const result = await runFamilyFriendsTimingReceipt({
      args: ["--base-url=http://127.0.0.1:3034", "--samples=2"],
      ...dependencies,
    })

    assert.deepEqual(events.map(([event]) => event), [
      "port check", "build", "start", "ready", "measure", "stop", "write",
    ])
    assert.deepEqual(events[0][1], { hostname: "127.0.0.1", port: 3034 })
    assert.deepEqual(events[2][1], { hostname: "127.0.0.1", port: 3034 })
    assert.deepEqual(events[4][1], {
      baseUrl: "http://127.0.0.1:3034",
      samples: 2,
    })
    assert.equal(events[5][1], dependencies.ownedChild)
    assert.deepEqual(result, MEASURED_RESULT)
    assert.equal(events[6][1], "/ first sample=1 status=200 durationMs=12")
    assert.doesNotMatch(events[6][1], /cold|cookie|authorization|response body|\?/i)
  })

  it("stops only the server it started when readiness times out", async () => {
    const events = []
    const dependencies = receiptDependencies(events, {
      readinessError: new Error("private diagnostic detail"),
    })

    await assert.rejects(
      runFamilyFriendsTimingReceipt({
        args: ["--base-url=http://127.0.0.1:3034", "--samples=1"],
        ...dependencies,
      }),
      /Timing server did not become ready/,
    )

    assert.deepEqual(events.map(([event]) => event), [
      "port check", "build", "start", "ready", "stop",
    ])
    assert.equal(events.at(-1)[1], dependencies.ownedChild)
    assert.doesNotMatch(String(events), /private diagnostic detail/)
  })

  it("refuses an occupied port before building or measuring", async () => {
    const events = []
    const dependencies = receiptDependencies(events, { occupied: true })

    await assert.rejects(
      runFamilyFriendsTimingReceipt({
        args: ["--base-url=http://127.0.0.1:3034", "--samples=3"],
        ...dependencies,
      }),
      /already in use/,
    )

    assert.deepEqual(events.map(([event]) => event), ["port check"])
  })

  it("requires a successful fresh build before starting the production server", async () => {
    const events = []
    const dependencies = receiptDependencies(events)
    dependencies.runBuild = async () => {
      events.push(["build"])
      throw new Error("stale-build-output-sentinel")
    }

    await assert.rejects(
      runFamilyFriendsTimingReceipt({
        args: ["--base-url=http://127.0.0.1:3034", "--samples=1"],
        ...dependencies,
      }),
      /Fresh production build failed/,
    )

    assert.deepEqual(events.map(([event]) => event), ["port check", "build"])
  })
})
