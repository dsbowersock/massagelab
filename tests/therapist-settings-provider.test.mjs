import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import { settlesWithin } from "./helpers/async-control.mjs"
import { drainEffectCleanups } from "./helpers/effect-cleanups.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const providerSource = await readFile(
  new URL("../components/providers/therapist-settings-provider.tsx", import.meta.url),
  "utf8",
)
const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8")

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const providerEffectCleanupOptions = Object.freeze({
  label: "Therapist settings Provider",
})

/** Returns fresh inert provider dependencies so compiled harnesses cannot share hook state. */
function inertProviderMocks({
  bootstrap = () => ({ ownerKey: null, syncEnabled: false }),
  clientFetch = {},
  react = {},
} = {}) {
  return {
    react: {
      createContext: () => ({ Provider: () => null }),
      useCallback: (callback) => callback,
      useContext: () => null,
      useEffect: () => undefined,
      useMemo: (factory) => factory(),
      useRef: (value) => ({ current: value }),
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => undefined],
      ...react,
    },
    "@/components/providers/account-shell-bootstrap-provider": {
      useAccountShellBootstrap: bootstrap,
    },
    "@/lib/client-fetch": {
      fetchJsonWithTimeout: async () => ({ response: { ok: false }, json: undefined }),
      fetchWithTimeout: async () => ({ ok: true }),
      ...clientFetch,
    },
  }
}

function loadCoordinator({ loadProfile, applyProfile = () => undefined }) {
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/therapist-settings-provider.test.tsx",
    inertProviderMocks(),
  )

  assert.equal(
    typeof provider.createTherapistSettingsCloudCoordinator,
    "function",
    "therapist settings must expose one testable owner-keyed cloud coordinator",
  )
  return provider.createTherapistSettingsCloudCoordinator({
    applyProfile,
    initialOwnerKey: "owner-a",
    initialSyncEnabled: true,
    loadProfile,
  })
}

function loadProfileWriter(send) {
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/therapist-profile-writer.test.tsx",
    inertProviderMocks(),
  )
  return provider.createTherapistProfileWriter({ send })
}

/** Compiles positional state doubles that replay the owned-settings updater; callers restore localStorage. */
function loadProviderUpdaterHarness({ profile = {}, storageWriteThrows = false } = {}) {
  const profileWrites = []
  const storageWrites = []
  // Production useState order is owned settings, coordinator, then cloud state.
  const OWNED_SETTINGS_STATE_SLOT = 1
  const CLOUD_STATE_SLOT = 3
  let stateCall = 0
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/therapist-settings-provider-updater.test.tsx",
    inertProviderMocks({
      bootstrap: () => ({ ownerKey: "owner-a", syncEnabled: true }),
      clientFetch: {
        fetchJsonWithTimeout: async () => ({ response: { ok: true }, json: profile }),
        fetchWithTimeout: async (...args) => {
          profileWrites.push(args)
          return { ok: true }
        },
      },
      react: {
        createContext: () => ({ Provider: "TherapistSettingsContextProvider" }),
        useState: (initial) => {
          stateCall += 1
          const value = typeof initial === "function" ? initial() : initial
          if (stateCall === OWNED_SETTINGS_STATE_SLOT) {
            return [value, (update) => {
              if (typeof update === "function") {
                // Replay functional updaters so side effects moved inside one fail this harness.
                update(value)
                update(value)
              }
            }]
          }
          if (stateCall === CLOUD_STATE_SLOT) {
            return [{ ownerKey: "owner-a", status: "ready", canSync: true }, () => undefined]
          }
          return [value, () => undefined]
        },
      },
    }),
  )
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: () => null,
    removeItem: () => undefined,
    setItem: (...args) => {
      if (storageWriteThrows) throw new DOMException("Storage denied", "SecurityError")
      storageWrites.push(args)
    },
  }

  try {
    const element = provider.TherapistSettingsProvider({ children: null })
    assert.equal(
      stateCall,
      CLOUD_STATE_SLOT,
      "provider updater harness must observe exactly owned settings, coordinator, and cloud state",
    )
    return {
      profileWrites,
      storageWrites,
      ensureCloudHydrated: element.props.value.ensureCloudHydrated,
      updateSettings: element.props.value.updateSettings,
      restore() {
        globalThis.localStorage = previousLocalStorage
      },
    }
  } catch (error) {
    globalThis.localStorage = previousLocalStorage
    throw error
  }
}

/**
 * Simulates owner-keyed renders and dependency-aware effect commits; callers
 * must call restore() to run cleanup and restore the prior browser globals.
 */
function loadProviderOwnerTransitionHarness({
  moduleSource = providerSource,
  storageGetThrows = false,
  storageRemoveThrows = false,
  writeProfile = async () => ({ ok: true }),
  storedValues = new Map([
    ["massage-lab-therapist-settings", JSON.stringify({ name: "Owner A" })],
    ["massage-lab-therapist-settings:account:owner-a", JSON.stringify({
      name: "Owner A",
      location: "Columbus",
      licenseNumber: "A-1",
      licenseOrganization: "Ohio Board",
      npiNumber: "111",
      soapDraft: "must not persist",
    })],
  ]),
} = {}) {
  let ownerKey = "owner-a"
  let syncEnabled = true
  const stateSlots = []
  const refSlots = []
  const callbackSlots = []
  const memoSlots = []
  const effectSlots = []
  const pendingEffects = new Map()
  const storageReads = []
  const storageWrites = []
  const storageRemovals = []
  const profileWrites = []
  const profileWriteSettlements = []
  const windowListeners = new Map()
  let profileRequests = 0
  let announceProfileRequestStarted
  const profileRequestStarted = new Promise((resolve) => {
    announceProfileRequestStarted = resolve
  })
  const profileResponse = deferred()
  let stateCursor = 0
  let refCursor = 0
  let callbackCursor = 0
  let memoCursor = 0
  let effectCursor = 0

  const sameDependencies = (left, right) => (
    Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => Object.is(value, right[index]))
  )
  const memoizedHook = (slots, cursor, valueFactory, dependencies) => {
    const slot = slots[cursor]
    if (!slot || !sameDependencies(slot.dependencies, dependencies)) {
      slots[cursor] = { dependencies, value: valueFactory() }
    }
    return slots[cursor].value
  }

  const previousLocalStorage = globalThis.localStorage
  const previousWindow = globalThis.window
  globalThis.localStorage = {
    getItem: (key) => {
      storageReads.push(key)
      if (storageGetThrows) throw new DOMException("Storage denied", "SecurityError")
      return storedValues.get(key) ?? null
    },
    removeItem: (key) => {
      storageRemovals.push(key)
      if (storageRemoveThrows) throw new DOMException("Storage denied", "SecurityError")
      storedValues.delete(key)
    },
    setItem: (key, value) => {
      storageWrites.push([key, value])
      storedValues.set(key, value)
    },
  }
  globalThis.window = {
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? new Set()
      listeners.add(listener)
      windowListeners.set(type, listeners)
    },
    removeEventListener(type, listener) {
      windowListeners.get(type)?.delete(listener)
    },
  }

  const loadOwnerTransitionProvider = () => loadCompiledModule(
    moduleSource,
    "components/providers/therapist-settings-provider-owner-transition.test.tsx",
    {
      react: {
        createContext: () => ({ Provider: "TherapistSettingsContextProvider" }),
        useCallback: (callback, dependencies) => {
          const cursor = callbackCursor
          callbackCursor += 1
          return memoizedHook(callbackSlots, cursor, () => callback, dependencies)
        },
        useContext: () => null,
        useEffect: (effect, dependencies) => {
          const cursor = effectCursor
          effectCursor += 1
          const slot = effectSlots[cursor]
          if (!slot || !sameDependencies(slot.dependencies, dependencies)) {
            // One pending entry per hook cursor lets a newer render replace an
            // unflushed effect instead of preserving a stale render's closure.
            pendingEffects.set(cursor, { dependencies, effect })
          } else {
            pendingEffects.delete(cursor)
          }
        },
        useMemo: (factory, dependencies) => {
          const cursor = memoCursor
          memoCursor += 1
          return memoizedHook(memoSlots, cursor, factory, dependencies)
        },
        useRef: (value) => {
          const cursor = refCursor
          refCursor += 1
          if (!refSlots[cursor]) refSlots[cursor] = { current: value }
          return refSlots[cursor]
        },
        useState: (initial) => {
          const cursor = stateCursor
          stateCursor += 1
          if (!stateSlots[cursor]) {
            stateSlots[cursor] = {
              value: typeof initial === "function" ? initial() : initial,
            }
          }
          return [stateSlots[cursor].value, (update) => {
            stateSlots[cursor].value = typeof update === "function"
              ? update(stateSlots[cursor].value)
              : update
          }]
        },
      },
      "@/components/providers/account-shell-bootstrap-provider": {
        useAccountShellBootstrap: () => ({ ownerKey, syncEnabled }),
      },
      "@/lib/client-fetch": {
        fetchJsonWithTimeout: async () => {
          profileRequests += 1
          announceProfileRequestStarted()
          return {
            response: { ok: true },
            json: await profileResponse.promise,
          }
        },
        fetchWithTimeout: (...args) => {
          profileWrites.push(args)
          const settlement = Promise.resolve().then(() => writeProfile(...args))
          profileWriteSettlements.push(settlement)
          return settlement
        },
      },
    },
  )

  let provider
  try {
    provider = loadOwnerTransitionProvider()
  } catch (error) {
    globalThis.localStorage = previousLocalStorage
    globalThis.window = previousWindow
    throw error
  }

  return {
    flushEffects() {
      const effectsToFlush = [...pendingEffects]
      pendingEffects.clear()
      for (const [cursor, { dependencies, effect }] of effectsToFlush) {
        effectSlots[cursor]?.cleanup?.()
        // Dependencies become committed only when the effect flushes; renders
        // before this point continue comparing with the last flushed snapshot.
        effectSlots[cursor] = {
          cleanup: effect(),
          dependencies,
        }
      }
    },
    render() {
      stateCursor = 0
      refCursor = 0
      callbackCursor = 0
      memoCursor = 0
      effectCursor = 0
      return provider.TherapistSettingsProvider({ children: null }).props.value
    },
    resolveProfileResponse(profile) {
      profileResponse.resolve(profile)
    },
    restore() {
      pendingEffects.clear()
      try {
        drainEffectCleanups(effectSlots, providerEffectCleanupOptions)
      } finally {
        globalThis.localStorage = previousLocalStorage
        globalThis.window = previousWindow
      }
    },
    dispatchOnline() {
      for (const listener of [...(windowListeners.get("online") ?? [])]) listener()
    },
    setOwner(nextOwnerKey) {
      ownerKey = nextOwnerKey
    },
    setSyncEnabled(nextSyncEnabled) {
      syncEnabled = nextSyncEnabled
    },
    get profileRequests() {
      return profileRequests
    },
    profileRequestStarted,
    /** Waits for every write started by the serialized writer, including batches queued while waiting. */
    async settleProfileWrites() {
      let settled = 0
      while (settled < profileWriteSettlements.length) {
        const batch = profileWriteSettlements.slice(settled)
        settled += batch.length
        await Promise.allSettled(batch)
      }
    },
    profileWrites,
    storageReads,
    storageRemovals,
    storageWrites,
  }
}

function loadStoredTherapistSettingsProjector() {
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/therapist-settings-provider-storage-contract.test.tsx",
    inertProviderMocks(),
  )
  assert.equal(
    typeof provider.projectStoredTherapistSettings,
    "function",
    "provider must export the single stored therapist snapshot projector",
  )
  return provider.projectStoredTherapistSettings
}

describe("therapist settings cloud hydration", () => {
  it("serializes a hydration correction before a newer local profile edit", async () => {
    const correctionGate = deferred()
    const sent = []
    let serverProfile = null
    const writer = loadProfileWriter(async ({ settings }) => {
      sent.push(settings)
      if (sent.length === 1) await correctionGate.promise
      serverProfile = settings
      return true
    })
    const correction = {
      name: "Hydration edit",
      location: "Cleveland",
      licenseNumber: "A-1",
      licenseOrganization: "Ohio Board",
      npiNumber: "111",
    }
    const newerEdit = { ...correction, name: "Newest local edit" }

    const correctionWrite = writer.enqueue({ ownerKey: "owner-a", settings: correction })
    const newerWrite = writer.enqueue({ ownerKey: "owner-a", settings: newerEdit })
    assert.deepEqual(sent, [correction])
    correctionGate.resolve()

    assert.deepEqual(await Promise.all([correctionWrite, newerWrite]), [true, true])
    assert.deepEqual(sent, [correction, newerEdit])
    assert.deepEqual(serverProfile, newerEdit)
  })

  it("retains and retries the latest profile snapshot after a non-2xx result", async () => {
    const attempted = []
    let shouldSucceed = false
    const writer = loadProfileWriter(async (request) => {
      attempted.push(request)
      return shouldSucceed
    })
    const latest = {
      name: "Retry me",
      location: "Columbus",
      licenseNumber: "A-2",
      licenseOrganization: "Ohio Board",
      npiNumber: "222",
    }

    assert.equal(await writer.enqueue({ ownerKey: "owner-a", settings: latest }), false)
    assert.deepEqual(writer.getFailed("owner-a"), latest)
    shouldSucceed = true
    assert.equal(await writer.retry("owner-a"), true)
    assert.deepEqual(attempted.map(({ settings }) => settings), [latest, latest])
    assert.equal(writer.getFailed("owner-a"), null)
  })

  it("retries one retained non-2xx profile write on a later explicit hydration demand", async () => {
    let writeAttempt = 0
    const harness = loadProviderOwnerTransitionHarness({
      writeProfile: async () => ({ ok: (writeAttempt += 1) > 1 }),
    })
    try {
      harness.render()
      harness.flushEffects()
      const initialView = harness.render()
      const hydration = initialView.ensureCloudHydrated()
      harness.resolveProfileResponse({ therapistName: "Cloud owner" })
      await hydration

      const readyView = harness.render()
      readyView.updateSettings({ name: "Retry on demand" })
      await harness.settleProfileWrites()
      assert.equal(harness.profileWrites.length, 1)

      await readyView.ensureCloudHydrated()
      assert.equal(harness.profileWrites.length, 2)
      assert.equal(harness.profileWrites[0][1].body, harness.profileWrites[1][1].body)

      await readyView.ensureCloudHydrated()
      assert.equal(harness.profileWrites.length, 2, "a successful retry must clear retained work")
    } finally {
      harness.restore()
    }
  })

  it("retries one retained non-2xx profile write when the browser comes online", async () => {
    let writeAttempt = 0
    const harness = loadProviderOwnerTransitionHarness({
      writeProfile: async () => ({ ok: (writeAttempt += 1) > 1 }),
    })
    try {
      harness.render()
      harness.flushEffects()
      const initialView = harness.render()
      const hydration = initialView.ensureCloudHydrated()
      harness.resolveProfileResponse({ therapistName: "Cloud owner" })
      await hydration

      harness.render().updateSettings({ name: "Retry online" })
      await harness.settleProfileWrites()
      assert.equal(harness.profileWrites.length, 1)

      harness.dispatchOnline()
      await harness.settleProfileWrites()
      assert.equal(harness.profileWrites.length, 2)
      assert.equal(harness.profileWrites[0][1].body, harness.profileWrites[1][1].body)

      harness.dispatchOnline()
      await harness.settleProfileWrites()
      assert.equal(harness.profileWrites.length, 2, "online recovery must not create a retry loop")
    } finally {
      harness.restore()
    }
  })

  it("does not load a profile merely because the provider owner mounted", async () => {
    let requests = 0
    const coordinator = loadCoordinator({
      loadProfile: async () => {
        requests += 1
        return {}
      },
    })

    await coordinator.adopt({ ownerKey: "owner-a", syncEnabled: true })

    assert.equal(requests, 0)
    assert.deepEqual(coordinator.getState(), {
      canSync: false,
      ownerKey: "owner-a",
      status: "idle",
    })
  })

  it("shares one first-consumer profile request and applies only five allowlisted fields", async () => {
    const request = deferred()
    const calls = []
    const applied = []
    const coordinator = loadCoordinator({
      loadProfile: ({ ownerKey, signal }) => {
        calls.push({ ownerKey, signal })
        return request.promise
      },
      applyProfile: (ownerKey, profile) => applied.push({ ownerKey, profile }),
    })

    const first = coordinator.ensureCloudHydrated()
    const second = coordinator.ensureCloudHydrated()
    assert.equal(first, second)
    assert.equal(calls.length, 1)

    request.resolve({
      therapistName: "Taylor",
      therapistLocation: "Columbus",
      licenseNumber: "MT-1",
      licenseOrganization: "State Board",
      npiNumber: "1234",
      displayName: "must-not-cross",
      soapDraft: "must-not-cross",
    })
    await first

    assert.deepEqual(applied, [{
      ownerKey: "owner-a",
      profile: {
        name: "Taylor",
        location: "Columbus",
        licenseNumber: "MT-1",
        licenseOrganization: "State Board",
        npiNumber: "1234",
      },
    }])
    assert.deepEqual(coordinator.getState(), {
      canSync: true,
      ownerKey: "owner-a",
      status: "ready",
    })
    assert.doesNotMatch(JSON.stringify(applied), /displayName|soapDraft/i)
  })

  it("preserves local defaults and disables PUT eligibility after profile failure", async () => {
    let applied = 0
    const coordinator = loadCoordinator({
      loadProfile: async () => {
        throw new Error("private profile failure")
      },
      applyProfile: () => {
        applied += 1
      },
    })

    await coordinator.ensureCloudHydrated()

    assert.equal(applied, 0)
    assert.deepEqual(coordinator.getState(), {
      canSync: false,
      ownerKey: "owner-a",
      status: "failed",
    })
  })

  it("retries the current owner's failed profile hydration on later demand", async () => {
    let requests = 0
    const applied = []
    const coordinator = loadCoordinator({
      loadProfile: async () => {
        requests += 1
        if (requests === 1) throw new Error("temporary profile failure")
        return { therapistName: "Recovered therapist" }
      },
      applyProfile: (ownerKey, profile) => applied.push({ ownerKey, profile }),
    })

    await coordinator.ensureCloudHydrated()
    assert.equal(coordinator.getState().status, "failed")

    await coordinator.ensureCloudHydrated()

    assert.equal(requests, 2)
    assert.deepEqual(applied, [{
      ownerKey: "owner-a",
      profile: {
        name: "Recovered therapist",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
        npiNumber: "",
      },
    }])
    assert.deepEqual(coordinator.getState(), {
      canSync: true,
      ownerKey: "owner-a",
      status: "ready",
    })
  })

  it("replaces a hydration aborted by Strict Mode disposal on replayed demand", async () => {
    const firstRequest = deferred()
    const calls = []
    const coordinator = loadCoordinator({
      loadProfile: ({ ownerKey, signal }) => {
        calls.push({ ownerKey, signal })
        return calls.length === 1
          ? firstRequest.promise
          : Promise.resolve({ therapistName: "Replayed therapist" })
      },
    })

    const firstHydration = coordinator.ensureCloudHydrated()
    coordinator.dispose()
    assert.equal(calls[0].signal.aborted, true)
    firstRequest.resolve({ therapistName: "Stale therapist" })
    await firstHydration

    await coordinator.ensureCloudHydrated()

    assert.equal(calls.length, 2)
    assert.equal(calls[1].ownerKey, "owner-a")
  })

  it("aborts and ignores owner A when owner B replaces a pending profile request", async () => {
    const ownerARequest = deferred()
    const ownerBRequest = deferred()
    const calls = []
    const applied = []
    const coordinator = loadCoordinator({
      loadProfile: ({ ownerKey, signal }) => {
        calls.push({ ownerKey, signal })
        return ownerKey === "owner-a" ? ownerARequest.promise : ownerBRequest.promise
      },
      applyProfile: (ownerKey, profile) => applied.push({ ownerKey, profile }),
    })

    const staleRequest = coordinator.ensureCloudHydrated()
    await coordinator.adopt({ ownerKey: "owner-b", syncEnabled: true })
    assert.equal(calls[0].signal.aborted, true)
    assert.deepEqual(coordinator.getState(), {
      canSync: false,
      ownerKey: "owner-b",
      status: "idle",
    })

    ownerARequest.resolve({ therapistName: "Owner A" })
    await staleRequest
    assert.deepEqual(applied, [])

    const currentRequest = coordinator.ensureCloudHydrated()
    ownerBRequest.resolve({ therapistName: "Owner B" })
    await currentRequest
    assert.deepEqual(applied, [{
      ownerKey: "owner-b",
      profile: {
        name: "Owner B",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
        npiNumber: "",
      },
    }])
  })

  it("keeps storage and profile PUT side effects outside replayable state updaters", () => {
    const harness = loadProviderUpdaterHarness()
    try {
      harness.updateSettings({ name: "Taylor" })

      assert.equal(harness.storageWrites.length, 1)
      assert.equal(harness.profileWrites.length, 1)
      assert.equal(harness.profileWrites[0][0], "/api/account/profile")
      assert.deepEqual(JSON.parse(harness.profileWrites[0][1].body), {
        therapistSettings: {
          name: "Taylor",
          location: "",
          licenseNumber: "",
          licenseOrganization: "",
          npiNumber: "",
        },
      })
    } finally {
      harness.restore()
    }
  })

  it("composes an immediate partial edit from the freshly hydrated cloud profile", async () => {
    const harness = loadProviderUpdaterHarness({
      profile: {
        therapistName: "Taylor",
        therapistLocation: "Columbus",
        licenseNumber: "MT-1",
        licenseOrganization: "State Board",
        npiNumber: "1234",
      },
    })
    try {
      await harness.ensureCloudHydrated()
      harness.updateSettings({ name: "Jordan" })

      assert.equal(harness.profileWrites.length, 1)
      assert.deepEqual(JSON.parse(harness.profileWrites[0][1].body), {
        therapistSettings: {
          name: "Jordan",
          location: "Columbus",
          licenseNumber: "MT-1",
          licenseOrganization: "State Board",
          npiNumber: "1234",
        },
      })
    } finally {
      harness.restore()
    }
  })

  it("continues in-memory and cloud updates when local storage rejects a write", () => {
    const harness = loadProviderUpdaterHarness({ storageWriteThrows: true })
    try {
      assert.doesNotThrow(() => harness.updateSettings({ name: "Taylor" }))
      assert.equal(harness.storageWrites.length, 0)
      assert.equal(harness.profileWrites.length, 1)
      assert.equal(JSON.parse(harness.profileWrites[0][1].body).therapistSettings.name, "Taylor")
    } finally {
      harness.restore()
    }
  })

  it("keeps edits made during cloud hydration over the older profile response", async () => {
    const harness = loadProviderOwnerTransitionHarness()
    try {
      harness.render()
      harness.flushEffects()
      const view = harness.render()
      const hydration = view.ensureCloudHydrated()

      view.updateSettings({ name: "Local edit" })
      harness.resolveProfileResponse({
        therapistName: "Older cloud name",
        therapistLocation: "Cleveland",
      })
      await hydration

      const reconciled = harness.render().settings
      assert.equal(reconciled.name, "Local edit")
      assert.equal(reconciled.location, "Cleveland")
      assert.equal(harness.profileWrites.length, 1)
      assert.deepEqual(JSON.parse(harness.profileWrites[0][1].body), {
        therapistSettings: reconciled,
      })
    } finally {
      harness.restore()
    }
  })

  it("restores the previous browser globals when owner-transition setup throws", () => {
    const previousLocalStorage = globalThis.localStorage
    const previousWindow = globalThis.window
    const sentinelLocalStorage = { sentinel: true }
    const sentinelWindow = { sentinel: true }
    globalThis.localStorage = sentinelLocalStorage
    globalThis.window = sentinelWindow

    try {
      assert.throws(
        () => loadProviderOwnerTransitionHarness({
          moduleSource: 'throw new Error("forced provider setup failure")',
        }),
        /forced provider setup failure/,
      )
      assert.equal(globalThis.localStorage, sentinelLocalStorage)
      assert.equal(globalThis.window, sentinelWindow)
    } finally {
      globalThis.localStorage = previousLocalStorage
      globalThis.window = previousWindow
    }
  })

  it("restores the previous browser globals when an effect cleanup throws", () => {
    const previousLocalStorage = globalThis.localStorage
    const previousWindow = globalThis.window
    const sentinelLocalStorage = { sentinel: "cleanup-local-storage" }
    const sentinelWindow = { sentinel: "cleanup-window" }
    globalThis.localStorage = sentinelLocalStorage
    globalThis.window = sentinelWindow

    try {
      const harness = loadProviderOwnerTransitionHarness({
        moduleSource: `
          import { useEffect } from "react"
          export function TherapistSettingsProvider() {
            useEffect(() => () => { throw new Error("forced cleanup failure") }, [])
            return { props: { value: {} } }
          }
        `,
      })
      harness.render()
      harness.flushEffects()

      assert.throws(() => harness.restore(), /forced cleanup failure/)
      assert.doesNotThrow(() => harness.restore(), "failed cleanup slots must be cleared before execution")
      assert.equal(globalThis.localStorage, sentinelLocalStorage)
      assert.equal(globalThis.window, sentinelWindow)
    } finally {
      globalThis.localStorage = previousLocalStorage
      globalThis.window = previousWindow
    }
  })

  it("never renders owner A fields while owner B storage and cloud settings hydrate", async () => {
    const harness = loadProviderOwnerTransitionHarness()
    try {
      harness.render()
      harness.flushEffects()
      const ownerAView = harness.render()
      assert.equal(ownerAView.settings.name, "Owner A")
      assert.equal(ownerAView.settings.location, "Columbus")

      harness.setOwner("owner-b")
      const ownerBTransitionView = harness.render()
      assert.deepEqual(ownerBTransitionView.settings, {
        name: "",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
        npiNumber: "",
      })
      assert.doesNotMatch(JSON.stringify(ownerBTransitionView.settings), /Owner A|Columbus/)

      harness.flushEffects()
      const ownerBLocalView = harness.render()
      const hydration = ownerBLocalView.ensureCloudHydrated()
      assert.doesNotMatch(JSON.stringify(harness.render().settings), /Owner A|Columbus/)

      harness.resolveProfileResponse({
        therapistName: "Owner B",
        therapistLocation: "Cleveland",
      })
      await hydration
      const ownerBCloudView = harness.render()
      assert.equal(ownerBCloudView.settings.name, "Owner B")
      assert.equal(ownerBCloudView.settings.location, "Cleveland")

      harness.setOwner(null)
      assert.doesNotMatch(JSON.stringify(harness.render().settings), /Owner A|Owner B|Columbus|Cleveland/)
      harness.flushEffects()
      assert.deepEqual(harness.render().settings, {
        name: "",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
        npiNumber: "",
      })
      assert.deepEqual(harness.storageReads, [
        "massage-lab-therapist-settings:account:owner-a",
        "massage-lab-therapist-settings:account:owner-b",
        "massage-lab-therapist-settings:anonymous",
      ])
      assert.deepEqual(harness.storageWrites.map(([key]) => key), [
        "massage-lab-therapist-settings:account:owner-a",
        "massage-lab-therapist-settings:account:owner-b",
      ])

      harness.setOwner("anonymous")
      harness.render()
      harness.flushEffects()
      assert.equal(
        harness.storageReads.at(-1),
        "massage-lab-therapist-settings:account:anonymous",
      )
    } finally {
      harness.restore()
    }
  })

  it("keeps an effect queued through an intervening render until flush", () => {
    const harness = loadProviderOwnerTransitionHarness()
    try {
      harness.render()
      harness.render()
      assert.deepEqual(harness.storageReads, [])

      harness.flushEffects()

      assert.deepEqual(harness.storageReads, [
        "massage-lab-therapist-settings:account:owner-a",
      ])
    } finally {
      harness.restore()
    }
  })

  it("replays mounted consumer demand after the same owner becomes sync-enabled", async () => {
    const harness = loadProviderOwnerTransitionHarness()
    try {
      harness.setSyncEnabled(false)
      harness.render()
      harness.flushEffects()
      const disabledView = harness.render()
      await disabledView.ensureCloudHydrated()
      assert.equal(harness.profileRequests, 0, "disabled ownership must remain network-free")

      harness.setSyncEnabled(true)
      const enabledView = harness.render()
      assert.notEqual(
        enabledView.ensureCloudHydrated,
        disabledView.ensureCloudHydrated,
        "the mounted consumer effect must receive a new demand callback",
      )

      const hydration = enabledView.ensureCloudHydrated()
      harness.flushEffects()
      await settlesWithin(
        harness.profileRequestStarted,
        1_000,
        "sync-enabled therapist profile request did not start",
      )
      assert.equal(harness.profileRequests, 1)

      harness.resolveProfileResponse({ therapistName: "Owner A cloud profile" })
      await hydration
      assert.equal(harness.render().settings.name, "Owner A cloud profile")
      assert.equal(harness.profileRequests, 1, "provider adoption must not reset demand deduplication")
    } finally {
      harness.restore()
    }
  })

  it("rejects malformed scoped snapshots and projects valid storage to five fields", () => {
    const projectStoredTherapistSettings = loadStoredTherapistSettingsProjector()
    for (const invalidSnapshot of [
      "scalar",
      42,
      [],
      { unexpected: true },
      {
        name: "Partial owner",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
      },
    ]) {
      assert.equal(projectStoredTherapistSettings(invalidSnapshot), null)
    }
    assert.deepEqual(projectStoredTherapistSettings({
      name: "Owner A",
      location: "Columbus",
      licenseNumber: "A-1",
      licenseOrganization: "Ohio Board",
      npiNumber: "111",
      soapDraft: "must not persist",
    }), {
      name: "Owner A",
      location: "Columbus",
      licenseNumber: "A-1",
      licenseOrganization: "Ohio Board",
      npiNumber: "111",
    })
  })

  it("removes invalid scoped storage without rewriting an empty snapshot", () => {
    const storageKey = "massage-lab-therapist-settings:account:owner-a"
    const harness = loadProviderOwnerTransitionHarness({
      storedValues: new Map([[storageKey, JSON.stringify({ unexpected: true })]]),
    })
    try {
      harness.render()
      harness.flushEffects()

      assert.deepEqual(harness.render().settings, {
        name: "",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
        npiNumber: "",
      })
      assert.deepEqual(harness.storageRemovals, [storageKey])
      assert.deepEqual(harness.storageWrites, [])
    } finally {
      harness.restore()
    }
  })

  it("keeps owner adoption non-fatal when storage reads or removals are denied", () => {
    const throwingRead = loadProviderOwnerTransitionHarness({ storageGetThrows: true })
    try {
      throwingRead.render()
      assert.doesNotThrow(() => throwingRead.flushEffects())
      assert.deepEqual(throwingRead.render().settings, {
        name: "",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
        npiNumber: "",
      })
    } finally {
      throwingRead.restore()
    }

    const storageKey = "massage-lab-therapist-settings:account:owner-a"
    const throwingRemove = loadProviderOwnerTransitionHarness({
      storageRemoveThrows: true,
      storedValues: new Map([[storageKey, "{malformed"]]),
    })
    try {
      throwingRemove.render()
      assert.doesNotThrow(() => throwingRemove.flushEffects())
      assert.deepEqual(throwingRemove.storageRemovals, [storageKey])
      assert.deepEqual(throwingRemove.render().settings, {
        name: "",
        location: "",
        licenseNumber: "",
        licenseOrganization: "",
        npiNumber: "",
      })
    } finally {
      throwingRemove.restore()
    }
  })

  it("keeps lazy hook, bounded GET, local-first storage, and exact PUT contracts explicit", () => {
    assert.match(providerSource, /useAccountShellBootstrap/)
    assert.match(providerSource, /fetchJsonWithTimeout[\s\S]*\/api\/account\/profile/)
    assert.match(providerSource, /massage-lab-therapist-settings/)
    assert.match(
      providerSource,
      /export function useTherapistSettings[\s\S]*useEffect\([\s\S]*ensureCloudHydrated/,
    )
    assert.match(providerSource, /method:\s*"PUT"/)
    assert.match(providerSource, /body:\s*JSON\.stringify\(\{ therapistSettings: nextSettings \}\)/)
    assert.match(layoutSource, /<TherapistSettingsProvider>/)
    assert.doesNotMatch(layoutSource, /<TherapistSettingsProvider\s+syncEnabled=/)
  })
})
