import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { describe, it } from "node:test"
import {
  ANONYMOUS_REQUEST_TIMEOUT_MS,
  measureReadinessRoutes,
} from "../scripts/family-friends-route-timings.mjs"
import * as timingReceipt from "../scripts/family-friends-timing-receipt.mjs"

const {
  resolveBuildCommand,
  runFamilyFriendsTimingReceipt,
  stopBuiltServer,
  waitForBuiltServer,
} = timingReceipt

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
      requestTimeoutMs: ANONYMOUS_REQUEST_TIMEOUT_MS,
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

  it("awaits a successful child spawn and converts an asynchronous spawn error safely", async () => {
    const child = fakeChild()
    const started = timingReceipt.startBuiltServer({
      hostname: "127.0.0.1",
      port: 3034,
      nodeExecutable: "node-test-runtime",
      nextCli: "next-test-cli",
      spawnImpl: () => child,
    })

    queueMicrotask(() => child.emit("error", new Error("private spawn detail")))

    await assert.rejects(started, /Fresh production server failed to spawn/)
    assert.equal(child.listenerCount("error") > 0, true)
  })

  it("keeps supervising errors after spawn and settles the child lifecycle on error", async () => {
    assert.equal(typeof timingReceipt.superviseOwnedChild, "function")
    assert.equal(typeof timingReceipt.waitForOwnedChildSettlement, "function")
    const child = fakeChild()
    const started = timingReceipt.superviseOwnedChild(child)
    child.emit("spawn")
    assert.equal(await started, child)

    const settled = timingReceipt.waitForOwnedChildSettlement(child)
    child.emit("error", new Error("private runtime detail"))

    assert.deepEqual(await settled, { kind: "error" })
    assert.equal(child.listenerCount("error") > 0, true)
  })

  it("escalates an unresponsive owned child from SIGTERM to SIGKILL and awaits exit", async () => {
    const signals = []
    let delayCalls = 0
    const child = fakeChild({
      kill(signal) {
        signals.push(signal)
        if (signal === "SIGKILL") {
          queueMicrotask(() => {
            child.signalCode = "SIGKILL"
            child.emit("exit", null, "SIGKILL")
          })
        }
        return true
      },
    })

    await stopBuiltServer(child, {
      timeoutMs: 1,
      delayImpl: async () => {
        delayCalls += 1
        if (delayCalls > 1) return new Promise(() => {})
      },
    })

    assert.deepEqual(signals, ["SIGTERM", "SIGKILL"])
    assert.equal(delayCalls, 2)
    assert.equal(child.signalCode, "SIGKILL")
  })

  it("converts an asynchronous kill error into a fixed teardown failure", async () => {
    const signals = []
    const child = fakeChild({
      kill(signal) {
        signals.push(signal)
        if (signal === "SIGKILL") {
          queueMicrotask(() => child.emit("error", new Error("private kill detail")))
        }
        return true
      },
    })

    await assert.rejects(stopBuiltServer(child, {
      timeoutMs: 1,
      delayImpl: async () => {},
    }), /Owned timing server stop failed/)

    assert.deepEqual(signals, ["SIGTERM", "SIGKILL"])
  })

  it("aborts stalled readiness and still tears down only the owned server", async () => {
    const events = []
    const dependencies = receiptDependencies(events)
    let requestSignal
    let tick = 0
    dependencies.waitForReadiness = ({ baseUrl }) => waitForBuiltServer({
      baseUrl,
      timeoutMs: 5,
      requestTimeoutMs: 1,
      clock: () => { tick += 3; return tick },
      delayImpl: async () => {},
      fetchImpl: async (_url, init) => {
        requestSignal = init.signal
        assert.ok(requestSignal, "readiness must propagate an abort signal")
        return new Promise(() => {})
      },
    })

    await assert.rejects(runFamilyFriendsTimingReceipt({
      args: ["--base-url=http://127.0.0.1:3034", "--samples=1"],
      ...dependencies,
    }), /Timing server did not become ready/)

    assert.equal(requestSignal?.aborted, true)
    assert.equal(events.at(-1)[0], "stop")
    assert.equal(events.at(-1)[1], dependencies.ownedChild)
  })

  it("aborts stalled measurement and still tears down only the owned server", async () => {
    const events = []
    const dependencies = receiptDependencies(events)
    let requestSignal
    dependencies.measureRoutes = (options) => measureReadinessRoutes({
      ...options,
      requestTimeoutMs: 1,
      fetchImpl: async (_url, init) => {
        requestSignal = init.signal
        assert.ok(requestSignal, "measurement must propagate an abort signal")
        return new Promise(() => {})
      },
    })

    await assert.rejects(runFamilyFriendsTimingReceipt({
      args: ["--base-url=http://127.0.0.1:3034", "--samples=1"],
      ...dependencies,
    }), /Anonymous route timing failed/)

    assert.equal(requestSignal?.aborted, true)
    assert.equal(events.at(-1)[0], "stop")
    assert.equal(events.at(-1)[1], dependencies.ownedChild)
  })
})

function fakeChild(overrides = {}) {
  return Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
    stdout: null,
    stderr: null,
    kill: () => true,
  }, overrides)
}
