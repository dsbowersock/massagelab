import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { projectAccountShellAppSettings } from "../lib/account-shell-bootstrap.js"
import * as accountPreferences from "../lib/account-preferences.js"
import { deferred } from "./helpers/async-control.mjs"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const providerSource = await readFile(
  new URL("../components/providers/account-shell-bootstrap-provider.tsx", import.meta.url),
  "utf8",
)
const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8")

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

/** Compiles inert React solely to exercise the provider's exported fallback coordinator. */
function loadProvider(loadPreferences) {
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
      "@/lib/account-preferences": accountPreferences,
      "@/lib/client-fetch": {
        fetchJsonWithTimeout: async () => ({}),
        fetchWithTimeout: async () => ({ ok: true }),
      },
    },
  ).createAccountShellBootstrapCoordinator({
    initialBootstrap: bootstrap(),
    loadPreferences,
  })
}

/**
 * Models Strict Mode effect cleanup and replay while retaining the provider's
 * hook state and ref slots across the simulated remount.
 */
function loadStrictModeProviderHarness(loadPreferences) {
  const effects = []
  const refs = []
  const states = []
  let replayCleanups = []
  let refCursor = 0
  let stateCursor = 0
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/account-shell-bootstrap-provider-strict-mode.test.tsx",
    {
      react: {
        createContext: () => ({ Provider: "AccountShellBootstrapContextProvider" }),
        useCallback: (callback) => callback,
        useContext: () => null,
        useEffect: (effect) => effects.push(effect),
        useMemo: (factory) => factory(),
        useRef: (value) => {
          const cursor = refCursor
          refCursor += 1
          if (!refs[cursor]) refs[cursor] = { current: value }
          return refs[cursor]
        },
        useState: (initial) => {
          const cursor = stateCursor
          stateCursor += 1
          if (!states[cursor]) {
            states[cursor] = { value: typeof initial === "function" ? initial() : initial }
          }
          return [states[cursor].value, (nextValue) => {
            states[cursor].value = typeof nextValue === "function"
              ? nextValue(states[cursor].value)
              : nextValue
          }]
        },
      },
      "@/lib/account-shell-bootstrap": { projectAccountShellAppSettings },
      "@/lib/account-preferences": accountPreferences,
      "@/lib/client-fetch": {
        fetchJsonWithTimeout: async (_url, init) => {
          const json = await loadPreferences({ ownerKey: "owner-a", signal: init.signal })
          return { response: { ok: true }, json }
        },
        fetchWithTimeout: async () => ({ ok: true }),
      },
    },
  )

  refCursor = 0
  stateCursor = 0
  provider.AccountShellBootstrapProvider({
    children: null,
    initialBootstrap: bootstrap({ preferenceStatus: "failed" }),
  })

  return {
    replayEffects() {
      const cleanups = effects.map((effect) => effect())
      for (const cleanup of cleanups) cleanup?.()
      replayCleanups = effects.map((effect) => effect())
    },
    cleanupReplayedEffects() {
      for (const cleanup of replayCleanups) cleanup?.()
      replayCleanups = []
    },
  }
}

describe("account shell bootstrap provider", () => {
  it("serializes and coalesces Settings and Music app-settings subpatches", async () => {
    const firstWrite = deferred()
    const sent = []
    let serverSettings = {}
    const writer = accountPreferences.createSerializedAppSettingsPatchWriter({
      async send({ ownerKey, patch }) {
        sent.push({ ownerKey, patch })
        if (sent.length === 1) await firstWrite.promise
        serverSettings = { ...serverSettings, ...patch }
        return true
      },
    })

    const firstSettings = writer.enqueue({
      ownerKey: "owner-a",
      patch: { themeMode: "light", sidebarPosition: "right" },
    })
    const music = writer.enqueue({
      ownerKey: "owner-a",
      patch: { musicVisualizer: { defaultBackgroundId: "linen", showClock: true } },
    })
    const latestSettings = writer.enqueue({
      ownerKey: "owner-a",
      patch: { themeMode: "dark", appBarPosition: "top" },
    })

    assert.equal(sent.length, 1)
    firstWrite.resolve()
    assert.deepEqual(await Promise.all([firstSettings, music, latestSettings]), [true, true, true])
    assert.equal(sent.length, 2)
    assert.deepEqual(sent[1].patch, {
      musicVisualizer: { defaultBackgroundId: "linen", showClock: true },
      themeMode: "dark",
      appBarPosition: "top",
    })
    assert.deepEqual(serverSettings, {
      themeMode: "dark",
      sidebarPosition: "right",
      musicVisualizer: { defaultBackgroundId: "linen", showClock: true },
      appBarPosition: "top",
    })
  })

  it("does not let a late old-owner patch evict queued work for the current owner", async () => {
    const firstWrite = deferred()
    const sent = []
    const writer = accountPreferences.createSerializedAppSettingsPatchWriter({
      async send(request) {
        sent.push(request)
        if (sent.length === 1) await firstWrite.promise
        return true
      },
    })

    const activeOwnerA = writer.enqueue({ ownerKey: "owner-a", patch: { themeMode: "light" } })
    const currentOwnerB = writer.enqueue({ ownerKey: "owner-b", patch: { themeMode: "dark" } })
    const lateOwnerA = writer.enqueue({ ownerKey: "owner-a", patch: { appBarPosition: "top" } })

    firstWrite.resolve()
    assert.deepEqual(await Promise.all([activeOwnerA, currentOwnerB, lateOwnerA]), [true, true, true])
    assert.deepEqual(sent, [
      { ownerKey: "owner-a", patch: { themeMode: "light" } },
      { ownerKey: "owner-b", patch: { themeMode: "dark" } },
      { ownerKey: "owner-a", patch: { appBarPosition: "top" } },
    ])
  })

  it("lets the active write finish while dispose rejects queued and future writes", async () => {
    const activeWrite = deferred()
    const sent = []
    const writer = accountPreferences.createSerializedAppSettingsPatchWriter({
      async send(request) {
        sent.push(request)
        await activeWrite.promise
        return true
      },
    })

    const active = writer.enqueue({ ownerKey: "owner-a", patch: { themeMode: "light" } })
    const queued = writer.enqueue({ ownerKey: "owner-b", patch: { themeMode: "dark" } })
    writer.dispose()
    const future = writer.enqueue({ ownerKey: "owner-c", patch: { appBarPosition: "top" } })

    assert.equal(await queued, false)
    assert.equal(await future, false)
    assert.deepEqual(sent, [{ ownerKey: "owner-a", patch: { themeMode: "light" } }])

    activeWrite.resolve()
    assert.equal(await active, true)
    assert.equal(sent.length, 1)
  })

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

  it("re-adopts an aborted fallback during Strict Mode effect replay", () => {
    const calls = []
    const harness = loadStrictModeProviderHarness(({ signal }) => {
      calls.push(signal)
      return new Promise(() => undefined)
    })

    try {
      harness.replayEffects()

      assert.equal(calls.length, 2)
      assert.equal(calls[0].aborted, true)
      assert.equal(calls[1].aborted, false)
    } finally {
      harness.cleanupReplayedEffects()
    }
    assert.equal(calls[1].aborted, true)
  })

  it("keeps projection, deadline, and owner-key layout contracts explicit", () => {
    assert.match(providerSource, /projectAccountShellAppSettings/)
    assert.match(
      providerSource,
      /fetchJsonWithTimeout<unknown>\(\s*"\/api\/account\/preferences",[\s\S]*?\b10_000\b[\s,]*\)/,
    )
    assert.match(layoutSource, /<AccountShellBootstrapProvider/)
    assert.match(layoutSource, /key=\{accountBootstrap\.ownerKey \?\? "anonymous"\}/)
    assert.match(layoutSource, /initialBootstrap=\{accountBootstrap\}/)
  })
})
