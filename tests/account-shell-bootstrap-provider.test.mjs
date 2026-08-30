import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { projectAccountShellAppSettings } from "../lib/account-shell-bootstrap.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const providerSource = await readFile(
  new URL("../components/providers/account-shell-bootstrap-provider.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8")

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function projectedSettings(backgroundId = "aurora") {
  return projectAccountShellAppSettings({
    appBarPosition: "top",
    sidebarPosition: "right",
    themeMode: "system",
    musicVisualizer: {
      defaultBackgroundId: backgroundId,
      showClock: true,
    },
  })
}

function bootstrap({
  ownerKey = "owner-a",
  preferenceStatus = "ready",
  appSettings = projectedSettings(),
  syncEnabled = ownerKey !== null,
} = {}) {
  return {
    ownerKey,
    syncEnabled,
    preferenceStatus,
    appSettings,
    hasPracticeMembership: false,
  }
}

function loadProvider(loadPreferences) {
  assert.notEqual(providerSource, "", "account shell bootstrap provider must exist")

  return loadCompiledModule(
    providerSource,
    "components/providers/account-shell-bootstrap-provider.test.tsx",
    {
      react: {
        createContext: () => ({ Provider: () => null }),
        useCallback: (callback) => callback,
        useContext: () => null,
        useEffect: () => {},
        useMemo: (factory) => factory(),
        useRef: (value) => ({ current: value }),
        useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
      },
      "@/lib/account-shell-bootstrap": { projectAccountShellAppSettings },
      "@/lib/client-fetch": { fetchJsonWithTimeout: async () => ({}) },
    },
  ).createAccountShellBootstrapCoordinator({
    initialBootstrap: bootstrap(),
    loadPreferences,
  })
}

describe("account shell bootstrap provider", () => {
  it("makes no fallback request for a ready server bootstrap", async () => {
    let requests = 0
    const coordinator = loadProvider(async () => {
      requests += 1
      return { appSettings: {} }
    })

    await coordinator.adopt(bootstrap())
    await Promise.all([
      coordinator.retryFallback(),
      coordinator.retryFallback(),
    ])

    assert.equal(requests, 0)
    assert.equal(coordinator.getValue().status, "ready")
  })

  it("shares one failure-only request and projects raw fallback data immediately", async () => {
    const request = deferred()
    const calls = []
    const coordinator = loadProvider(({ ownerKey, signal }) => {
      calls.push({ ownerKey, signal })
      return request.promise
    })

    const automatic = coordinator.adopt(bootstrap({ preferenceStatus: "failed" }))
    const consumerA = coordinator.retryFallback()
    const consumerB = coordinator.retryFallback()

    assert.equal(calls.length, 1)
    assert.equal(consumerA, automatic)
    assert.equal(consumerB, automatic)
    assert.equal(coordinator.getValue().status, "fallback-loading")

    request.resolve({
      appSettings: {
        appBarPosition: "top",
        musicVisualizer: {
          defaultBackgroundId: "linen",
          showClock: true,
          token: "must-not-cross",
        },
        onboarding: { primaryRole: "therapist" },
        soapDraft: "must-not-cross",
      },
    })
    await automatic

    assert.deepEqual(coordinator.getValue(), {
      ownerKey: "owner-a",
      syncEnabled: true,
      status: "ready",
      appSettings: {
        app: {
          appBarPosition: "top",
          sidebarPosition: "left",
          sidebarTriggerPosition: "top",
          ambientMotionMode: "system",
          themeMode: "dark",
          hapticFeedbackEnabled: true,
        },
        musicVisualizer: {
          defaultBackgroundId: "linen",
          showClock: true,
        },
      },
    })
    assert.doesNotMatch(
      JSON.stringify(coordinator.getValue()),
      /soap|onboarding|token/i,
    )
  })

  it("retains safe defaults when fallback fails", async () => {
    const coordinator = loadProvider(async () => {
      throw new Error("private provider failure")
    })

    await coordinator.adopt(bootstrap({ preferenceStatus: "failed" }))

    assert.deepEqual(coordinator.getValue(), {
      ownerKey: "owner-a",
      syncEnabled: true,
      status: "failed",
      appSettings: projectAccountShellAppSettings(undefined),
    })
  })

  it("aborts and ignores an old owner's late fallback completion", async () => {
    const ownerARequest = deferred()
    let ownerASignal
    const coordinator = loadProvider(({ ownerKey, signal }) => {
      assert.equal(ownerKey, "owner-a")
      ownerASignal = signal
      return ownerARequest.promise
    })

    const staleRequest = coordinator.adopt(bootstrap({ preferenceStatus: "failed" }))
    await coordinator.adopt(bootstrap({
      ownerKey: "owner-b",
      appSettings: projectedSettings("owner-b-background"),
    }))
    ownerARequest.resolve({
      appSettings: {
        musicVisualizer: { defaultBackgroundId: "stale-owner-a" },
      },
    })
    await staleRequest

    assert.equal(ownerASignal.aborted, true)
    assert.deepEqual(coordinator.getValue(), {
      ownerKey: "owner-b",
      syncEnabled: true,
      status: "ready",
      appSettings: projectedSettings("owner-b-background"),
    })
  })

  it("clears old-owner data and makes no request after an anonymous transition", async () => {
    const ownerARequest = deferred()
    let requests = 0
    const coordinator = loadProvider(() => {
      requests += 1
      return ownerARequest.promise
    })

    const staleRequest = coordinator.adopt(bootstrap({ preferenceStatus: "failed" }))
    await coordinator.adopt(bootstrap({
      ownerKey: null,
      preferenceStatus: "anonymous",
      appSettings: projectAccountShellAppSettings(undefined),
      syncEnabled: false,
    }))
    ownerARequest.resolve({ appSettings: { appBarPosition: "top" } })
    await staleRequest

    assert.equal(requests, 1)
    assert.deepEqual(coordinator.getValue(), {
      ownerKey: null,
      syncEnabled: false,
      status: "anonymous",
      appSettings: projectAccountShellAppSettings(undefined),
    })
  })

  it("shares one explicit retry after a failed fallback", async () => {
    const retryRequest = deferred()
    let requests = 0
    const coordinator = loadProvider(() => {
      requests += 1
      if (requests === 1) {
        return Promise.reject(new Error("temporary failure"))
      }
      return retryRequest.promise
    })

    await coordinator.adopt(bootstrap({ preferenceStatus: "failed" }))
    const retryA = coordinator.retryFallback()
    const retryB = coordinator.retryFallback()

    assert.equal(requests, 2)
    assert.equal(retryA, retryB)
    retryRequest.resolve({
      appSettings: {
        musicVisualizer: { defaultBackgroundId: "retry-success" },
      },
    })
    await retryA
    assert.equal(coordinator.getValue().status, "ready")
    assert.equal(
      coordinator.getValue().appSettings.musicVisualizer.defaultBackgroundId,
      "retry-success",
    )
  })

  it("keeps projection, deadline, and owner-key layout contracts explicit", () => {
    assert.match(providerSource, /projectAccountShellAppSettings/)
    assert.match(providerSource, /fetchJsonWithTimeout[\s\S]*10_000/)
    assert.match(providerSource, /\/api\/account\/preferences/)
    assert.match(layoutSource, /<AccountShellBootstrapProvider/)
    assert.match(layoutSource, /key=\{accountBootstrap\.ownerKey \?\? "anonymous"\}/)
    assert.match(layoutSource, /initialBootstrap=\{accountBootstrap\}/)
  })
})
