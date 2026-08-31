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
    applyProfile,
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
