import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  createCompiledModuleLoader,
  findElement,
} from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const preferenceSyncSource = await readFile(
  new URL("../app/account/preference-sync.tsx", import.meta.url),
  "utf8",
)
const therapistSettingsProviderSource = await readFile(
  new URL("../components/providers/therapist-settings-provider.tsx", import.meta.url),
  "utf8",
)
const therapistSettingsStorageContract = loadCompiledModule(
  therapistSettingsProviderSource,
  "components/providers/therapist-settings-provider-preference-sync.test.tsx",
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

const localPreferenceKeys = {
  appSettings: "massage-lab-settings",
  therapistSettings: "massage-lab-therapist-settings",
  chimerSettings: "massagelab-chimer-settings",
  anatomimeSettings: "massagelab-anatomime-settings",
  notePreferences: "massagelab-note-preferences",
  calendarPreferences: "massagelab-calendar-preferences",
}

// Mirrors PreferenceSync's render-order useState calls so harness reads stay named.
const PREFERENCE_SYNC_STATE_SLOT = Object.freeze({
  STATUS: 0,
  IS_SYNCING: 1,
  DID_AUTO_SYNC: 2,
})

function deferred() {
  let reject
  let resolve
  const promise = new Promise((resolvePromise, rejectPromise) => {
    reject = rejectPromise
    resolve = resolvePromise
  })
  return { promise, reject, resolve }
}

/**
 * Runs PreferenceSync for one active owner with injectable storage and network
 * inputs. Its async cleanup drains component work before restoring process globals.
 */
async function loadPreferenceSync(ownerKey, {
  fetchImpl = async () => ({ ok: true }),
  getItem,
  hasCloudPreferences = false,
  values = new Map([
    ["massage-lab-therapist-settings", JSON.stringify({ name: "Ambiguous legacy owner" })],
    ["massage-lab-therapist-settings:account:owner-a", JSON.stringify({
      name: "Owner A",
      location: "Columbus",
      licenseNumber: "A-1",
      licenseOrganization: "Ohio Board",
      npiNumber: "111",
    })],
    ["massage-lab-therapist-settings:account:owner-b", JSON.stringify({
      name: "Owner B",
      location: "Cleveland",
      licenseNumber: "B-2",
      licenseOrganization: "Ohio Board",
      npiNumber: "222",
      soapDraft: "must not upload",
    })],
  ]),
} = {}) {
  const effects = []
  const effectCleanups = []
  const initiatedRequests = []
  const requests = []
  const storageReads = []
  const stateSlots = []
  let stateCursor = 0
  const provider = loadCompiledModule(
    preferenceSyncSource,
    "app/account/preference-sync.test.tsx",
    {
      react: {
        useCallback: (callback) => callback,
        useEffect: (effect) => effects.push(effect),
        useState: (initial) => {
          const cursor = stateCursor
          stateCursor += 1
          if (!stateSlots[cursor]) stateSlots[cursor] = { value: initial }
          return [stateSlots[cursor].value, (value) => {
            stateSlots[cursor].value = typeof value === "function"
              ? value(stateSlots[cursor].value)
              : value
          }]
        },
      },
      "lucide-react": { Cloud: "Cloud" },
      "@/lib/account-preferences": {
        LOCAL_PREFERENCE_KEYS: localPreferenceKeys,
        buildUserPreferencePayload: (preferences) => ({
          app_settings: preferences.appSettings,
          chimer_settings: preferences.chimerSettings,
          anatomime_settings: preferences.anatomimeSettings,
          note_preferences: preferences.notePreferences,
          calendar_preferences: preferences.calendarPreferences,
        }),
      },
      "@/components/backgrounds/backgroundPaletteRegistry": {
        backgroundPreferenceNormalizationOptions: {},
      },
      "@/components/providers/account-shell-bootstrap-provider": {
        useAccountShellBootstrap: () => ({ ownerKey }),
      },
      "@/components/providers/therapist-settings-provider": {
        projectStoredTherapistSettings:
          therapistSettingsStorageContract.projectStoredTherapistSettings,
        therapistSettingsStorageKey:
          therapistSettingsStorageContract.therapistSettingsStorageKey,
      },
      "@/components/ui/button": { Button: "Button" },
      "@/components/ui/loader": { Loader: "Loader" },
    },
  )

  // The compiled client component reads browser APIs directly. Keep the doubles
  // installed through every request continuation, then restore them in cleanup.
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const testWindow = {
    localStorage: {
      getItem: (key) => {
        storageReads.push(key)
        if (getItem) return getItem(key)
        return values.get(key) ?? null
      },
    },
  }
  const testFetch = (url, init) => {
    requests.push({ url, init })
    const request = Promise.resolve().then(() => fetchImpl(url, init))
    initiatedRequests.push(request)
    return request
  }
  let restored = false
  let effectsCleanedUp = false

  async function settleAsyncWork(maxPasses = 50) {
    let observedRequestCount = 0
    for (let pass = 1; pass <= maxPasses; pass += 1) {
      const requestsToSettle = initiatedRequests.slice(observedRequestCount)
      observedRequestCount = initiatedRequests.length
      await Promise.allSettled(requestsToSettle)
      await new Promise((resolve) => setImmediate(resolve))
      if (initiatedRequests.length === observedRequestCount) return
    }
    throw new Error(`PreferenceSync async work did not settle after ${maxPasses} passes`)
  }

  function invokeEffectCleanups() {
    if (effectsCleanedUp) return
    effectsCleanedUp = true
    for (const cleanup of effectCleanups.toReversed()) cleanup()
  }

  function restoreGlobals() {
    if (restored) return
    restored = true
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }

  async function finalize() {
    try {
      invokeEffectCleanups()
      await settleAsyncWork()
    } finally {
      restoreGlobals()
    }
  }

  globalThis.window = testWindow
  globalThis.fetch = testFetch

  try {
    const element = provider.PreferenceSync({ hasCloudPreferences })
    assert.equal(
      stateCursor,
      Object.keys(PREFERENCE_SYNC_STATE_SLOT).length,
      "PreferenceSync harness state-slot map must match rendered useState calls",
    )
    for (const effect of effects) {
      const cleanup = effect()
      if (typeof cleanup === "function") effectCleanups.push(cleanup)
    }
    const syncButton = findElement(element, ({ type }) => type === "Button")
    assert.ok(syncButton, "preference sync must render its manual sync button")
    const harness = {
      requests,
      storageReads,
      async syncLocalPreferences() {
        const componentWork = syncButton.props.onClick()
        await settleAsyncWork()
        return await componentWork
      },
      async cleanup() {
        await finalize()
      },
      get isSyncing() {
        return stateSlots[PREFERENCE_SYNC_STATE_SLOT.IS_SYNCING].value
      },
      get status() {
        return stateSlots[PREFERENCE_SYNC_STATE_SLOT.STATUS].value
      },
    }
    await settleAsyncWork()
    return harness
  } catch (error) {
    try {
      await finalize()
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "PreferenceSync harness and cleanup both failed")
    }
    throw error
  }
}

describe("Account preference sync therapist ownership", () => {
  it("uploads only the current owner's scoped therapist settings and ignores legacy data", async () => {
    const ownerA = await loadPreferenceSync("owner-a")
    try {
      const ownerAProfileRequest = ownerA.requests.find(({ url }) => url === "/api/account/profile")
      assert.deepEqual(JSON.parse(ownerAProfileRequest.init.body), {
        therapistSettings: {
          name: "Owner A",
          location: "Columbus",
          licenseNumber: "A-1",
          licenseOrganization: "Ohio Board",
          npiNumber: "111",
        },
      })
      assert.ok(ownerA.storageReads.includes("massage-lab-therapist-settings:account:owner-a"))
      assert.ok(!ownerA.storageReads.includes("massage-lab-therapist-settings"))
    } finally {
      await ownerA.cleanup()
    }

    const ownerB = await loadPreferenceSync("owner-b")
    try {
      const ownerBProfileRequest = ownerB.requests.find(({ url }) => url === "/api/account/profile")
      assert.deepEqual(JSON.parse(ownerBProfileRequest.init.body), {
        therapistSettings: {
          name: "Owner B",
          location: "Cleveland",
          licenseNumber: "B-2",
          licenseOrganization: "Ohio Board",
          npiNumber: "222",
        },
      })
      assert.ok(ownerB.storageReads.includes("massage-lab-therapist-settings:account:owner-b"))
      assert.ok(!ownerB.storageReads.includes("massage-lab-therapist-settings"))
    } finally {
      await ownerB.cleanup()
    }
  })

  it("skips profile migration when the current owner has no scoped therapist value", async () => {
    const sync = await loadPreferenceSync("owner-b", {
      values: new Map([
        ["massage-lab-therapist-settings", JSON.stringify({ name: "Ambiguous legacy owner" })],
        ["massage-lab-therapist-settings:account:owner-a", JSON.stringify({
          name: "Owner A",
          location: "Columbus",
          licenseNumber: "A-1",
          licenseOrganization: "Ohio Board",
          npiNumber: "111",
        })],
      ]),
    })
    try {
      assert.deepEqual(sync.requests.map(({ url }) => url), ["/api/account/preferences"])
      assert.equal(sync.status, "Local preferences synced to your account.")
      assert.ok(sync.storageReads.includes("massage-lab-therapist-settings:account:owner-b"))
      assert.ok(!sync.storageReads.includes("massage-lab-therapist-settings"))
      assert.ok(!sync.storageReads.includes("massage-lab-therapist-settings:owner-a"))
    } finally {
      await sync.cleanup()
    }
  })

  it("treats ownerless preference-only sync as successful without uploading a profile", async () => {
    const sync = await loadPreferenceSync(null)
    try {
      assert.deepEqual(sync.requests.map(({ url }) => url), ["/api/account/preferences"])
      assert.equal(sync.status, "Local preferences synced to your account.")
      assert.ok(!sync.storageReads.some((key) => key.startsWith("massage-lab-therapist-settings")))
    } finally {
      await sync.cleanup()
    }
  })

  it("skips valid JSON that is not the complete five-field therapist snapshot", async () => {
    const invalidSnapshots = [
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
    ]

    for (const snapshot of invalidSnapshots) {
      const sync = await loadPreferenceSync("owner-b", {
        values: new Map([
          ["massage-lab-therapist-settings:account:owner-b", JSON.stringify(snapshot)],
        ]),
      })
      try {
        assert.deepEqual(sync.requests.map(({ url }) => url), ["/api/account/preferences"])
        assert.equal(sync.status, "Local preferences synced to your account.")
      } finally {
        await sync.cleanup()
      }
    }
  })

  it("settles failed preference and profile requests without leaving sync pending", async () => {
    const preferenceRequest = deferred()
    const profileRequest = deferred()
    const unhandledRejections = []
    const onUnhandledRejection = (error) => unhandledRejections.push(error)
    process.on("unhandledRejection", onUnhandledRejection)
    let sync

    try {
      sync = await loadPreferenceSync("owner-b", {
        fetchImpl: (url) => (
          url === "/api/account/preferences"
            ? preferenceRequest.promise
            : profileRequest.promise
        ),
        hasCloudPreferences: true,
      })

      const result = sync.syncLocalPreferences()
      assert.equal(sync.isSyncing, true)
      preferenceRequest.reject(new Error("preferences unavailable"))
      profileRequest.reject(new Error("profile unavailable"))
      await assert.doesNotReject(result)
      assert.equal(sync.isSyncing, false)
      assert.equal(sync.status, "Preference sync failed. Sign in again and retry.")
      assert.deepEqual(unhandledRejections, [])
    } finally {
      await sync?.cleanup()
      process.off("unhandledRejection", onUnhandledRejection)
    }
  })

  it("clears pending and reports failure when browser storage cannot be read", async () => {
    const sync = await loadPreferenceSync(null, {
      getItem: () => {
        throw new Error("browser storage unavailable")
      },
      hasCloudPreferences: true,
    })

    try {
      await assert.doesNotReject(sync.syncLocalPreferences())
      assert.equal(sync.isSyncing, false)
      assert.equal(sync.status, "Preference sync failed. Sign in again and retry.")
      assert.deepEqual(sync.requests, [])
    } finally {
      await sync.cleanup()
    }
  })
})
