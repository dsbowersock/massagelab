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
const appShellBrowserSource = await readFile(
  new URL("../tests/browser/app-shell.spec.ts", import.meta.url),
  "utf8",
)

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

describe("therapist settings cloud hydration", () => {
  it("retires the anonymous pre-change browser guard", () => {
    assert.doesNotMatch(
      appShellBrowserSource,
      /anonymous bootstrap leaves therapist and calendar specialization dormant/,
    )
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
