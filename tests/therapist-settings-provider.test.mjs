import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

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

function loadCoordinator({ loadProfile, applyProfile = () => undefined }) {
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/therapist-settings-provider.test.tsx",
    {
      react: {
        createContext: () => ({ Provider: () => null }),
        useCallback: (callback) => callback,
        useContext: () => null,
        useEffect: () => undefined,
        useMemo: (factory) => factory(),
        useRef: (value) => ({ current: value }),
        useState: (initial) => [typeof initial === "function" ? initial() : initial, () => undefined],
      },
      "@/components/providers/account-shell-bootstrap-provider": {
        useAccountShellBootstrap: () => ({ ownerKey: null, syncEnabled: false }),
      },
      "@/lib/client-fetch": {
        fetchJsonWithTimeout: async () => ({ response: { ok: false }, json: undefined }),
        fetchWithTimeout: async () => ({ ok: true }),
      },
    },
  )

  assert.equal(
    typeof provider.createTherapistSettingsCloudCoordinator,
    "function",
    "therapist settings must expose one testable owner-keyed cloud coordinator",
  )
  return provider.createTherapistSettingsCloudCoordinator({
    applyProfile: (_ownerKey, settings) => applyProfile(settings),
    initialOwnerKey: "owner-a",
    initialSyncEnabled: true,
    loadProfile,
  })
}

function loadProviderUpdaterHarness({ profile = {} } = {}) {
  const profileWrites = []
  const storageWrites = []
  let stateCall = 0
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/therapist-settings-provider-updater.test.tsx",
    {
      react: {
        createContext: () => ({ Provider: "TherapistSettingsContextProvider" }),
        useCallback: (callback) => callback,
        useContext: () => null,
        useEffect: () => undefined,
        useMemo: (factory) => factory(),
        useRef: (value) => ({ current: value }),
        useState: (initial) => {
          stateCall += 1
          const value = typeof initial === "function" ? initial() : initial
          if (stateCall === 1) {
            return [value, (update) => {
              if (typeof update === "function") {
                update(value)
                update(value)
              }
            }]
          }
          if (stateCall === 3) {
            return [{ ownerKey: "owner-a", status: "ready", canSync: true }, () => undefined]
          }
          return [value, () => undefined]
        },
      },
      "@/components/providers/account-shell-bootstrap-provider": {
        useAccountShellBootstrap: () => ({ ownerKey: "owner-a", syncEnabled: true }),
      },
      "@/lib/client-fetch": {
        fetchJsonWithTimeout: async () => ({ response: { ok: true }, json: profile }),
        fetchWithTimeout: async (...args) => {
          profileWrites.push(args)
          return { ok: true }
        },
      },
    },
  )
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: () => null,
    removeItem: () => undefined,
    setItem: (...args) => storageWrites.push(args),
  }

  try {
    const element = provider.TherapistSettingsProvider({ children: null })
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

function loadProviderOwnerTransitionHarness({
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
  const pendingEffects = []
  const storageReads = []
  const storageWrites = []
  const storageRemovals = []
  let profileRequests = 0
  const ownerBProfile = deferred()
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
  globalThis.localStorage = {
    getItem: (key) => {
      storageReads.push(key)
      return storedValues.get(key) ?? null
    },
    removeItem: (key) => {
      storageRemovals.push(key)
      storedValues.delete(key)
    },
    setItem: (key, value) => {
      storageWrites.push([key, value])
      storedValues.set(key, value)
    },
  }

  const provider = loadCompiledModule(
    providerSource,
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
            effectSlots[cursor] = { ...slot, dependencies }
            pendingEffects.push({ cursor, effect })
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
          return {
            response: { ok: true },
            json: await ownerBProfile.promise,
          }
        },
        fetchWithTimeout: async () => ({ ok: true }),
      },
    },
  )

  return {
    flushEffects() {
      for (const { cursor, effect } of pendingEffects.splice(0)) {
        effectSlots[cursor].cleanup?.()
        effectSlots[cursor].cleanup = effect()
      }
    },
    render() {
      stateCursor = 0
      refCursor = 0
      callbackCursor = 0
      memoCursor = 0
      effectCursor = 0
      pendingEffects.length = 0
      return provider.TherapistSettingsProvider({ children: null }).props.value
    },
    resolveOwnerBProfile(profile) {
      ownerBProfile.resolve(profile)
    },
    restore() {
      for (const slot of effectSlots) slot?.cleanup?.()
      globalThis.localStorage = previousLocalStorage
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
    storageReads,
    storageRemovals,
    storageWrites,
  }
}

function loadStoredTherapistSettingsProjector() {
  const provider = loadCompiledModule(
    providerSource,
    "components/providers/therapist-settings-provider-storage-contract.test.tsx",
    {
      "@/components/providers/account-shell-bootstrap-provider": {
        useAccountShellBootstrap: () => ({ ownerKey: null, syncEnabled: false }),
      },
      "@/lib/client-fetch": {
        fetchJsonWithTimeout: async () => ({ response: { ok: false }, json: undefined }),
        fetchWithTimeout: async () => ({ ok: true }),
      },
    },
  )
  assert.equal(
    typeof provider.projectStoredTherapistSettings,
    "function",
    "provider must export the single stored therapist snapshot projector",
  )
  return provider.projectStoredTherapistSettings
}

describe("therapist settings cloud hydration", () => {
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
      applyProfile: (profile) => applied.push(profile),
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
      name: "Taylor",
      location: "Columbus",
      licenseNumber: "MT-1",
      licenseOrganization: "State Board",
      npiNumber: "1234",
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
      applyProfile: (profile) => applied.push(profile),
    })

    await coordinator.ensureCloudHydrated()
    assert.equal(coordinator.getState().status, "failed")

    await coordinator.ensureCloudHydrated()

    assert.equal(requests, 2)
    assert.deepEqual(applied, [{
      name: "Recovered therapist",
      location: "",
      licenseNumber: "",
      licenseOrganization: "",
      npiNumber: "",
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
      applyProfile: (profile) => applied.push(profile),
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
      name: "Owner B",
      location: "",
      licenseNumber: "",
      licenseOrganization: "",
      npiNumber: "",
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

      harness.resolveOwnerBProfile({
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
      await Promise.resolve()
      assert.equal(harness.profileRequests, 1)

      harness.resolveOwnerBProfile({ therapistName: "Owner A cloud profile" })
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

  it("keeps lazy hook, bounded GET, local-first storage, and exact PUT contracts explicit", () => {
    assert.match(providerSource, /useAccountShellBootstrap/)
    assert.match(providerSource, /fetchJsonWithTimeout[\s\S]*\/api\/account\/profile/)
    assert.match(providerSource, /massage-lab-therapist-settings/)
    assert.match(
      providerSource,
      /export function useTherapistSettings[\s\S]*useEffect\([\s\S]*ensureCloudHydrated/,
    )
    assert.match(providerSource, /method:\s*"PUT"/)
    assert.match(providerSource, /body:\s*JSON\.stringify\(\{ therapistSettings: updated \}\)/)
    assert.match(layoutSource, /<TherapistSettingsProvider>/)
    assert.doesNotMatch(layoutSource, /<TherapistSettingsProvider\s+syncEnabled=/)
  })
})
