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
 * inputs, then exposes its captured requests and manual-sync callback.
 */
function loadPreferenceSync(ownerKey, {
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

  // The compiled client component reads browser APIs directly, so the harness
  // substitutes them only while rendering and running its initial effects.
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
  const testFetch = async (url, init) => {
    requests.push({ url, init })
    return fetchImpl(url, init)
  }
  globalThis.window = testWindow
  globalThis.fetch = testFetch

  try {
    const element = provider.PreferenceSync({ hasCloudPreferences })
    for (const effect of effects) effect()
    const syncButton = findElement(element, ({ type }) => type === "Button")
    assert.ok(syncButton, "preference sync must render its manual sync button")
    return {
      requests,
      storageReads,
      async syncLocalPreferences() {
        // Manual sync runs after initial setup has restored the process globals;
        // re-enter the isolated APIs for this call and always unwind afterward.
        const currentWindow = globalThis.window
        const currentFetch = globalThis.fetch
        globalThis.window = testWindow
        globalThis.fetch = testFetch
        try {
          return await syncButton.props.onClick()
        } finally {
          globalThis.window = currentWindow
          globalThis.fetch = currentFetch
        }
      },
      get isSyncing() {
        return stateSlots[1].value
      },
      get status() {
        return stateSlots[0].value
      },
    }
  } finally {
    // Restoration is mandatory because node:test shares these process globals
    // with the remaining tests even when component setup throws.
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
}

describe("Account preference sync therapist ownership", () => {
  it("uploads only the current owner's scoped therapist settings and ignores legacy data", () => {
    const ownerA = loadPreferenceSync("owner-a")
    const ownerB = loadPreferenceSync("owner-b")

    const ownerAProfileRequest = ownerA.requests.find(({ url }) => url === "/api/account/profile")
    const ownerBProfileRequest = ownerB.requests.find(({ url }) => url === "/api/account/profile")
    assert.deepEqual(JSON.parse(ownerAProfileRequest.init.body), {
      therapistSettings: {
        name: "Owner A",
        location: "Columbus",
        licenseNumber: "A-1",
        licenseOrganization: "Ohio Board",
        npiNumber: "111",
      },
    })
    assert.deepEqual(JSON.parse(ownerBProfileRequest.init.body), {
      therapistSettings: {
        name: "Owner B",
        location: "Cleveland",
        licenseNumber: "B-2",
        licenseOrganization: "Ohio Board",
        npiNumber: "222",
      },
    })
    assert.ok(ownerA.storageReads.includes("massage-lab-therapist-settings:account:owner-a"))
    assert.ok(ownerB.storageReads.includes("massage-lab-therapist-settings:account:owner-b"))
    assert.ok(!ownerA.storageReads.includes("massage-lab-therapist-settings"))
    assert.ok(!ownerB.storageReads.includes("massage-lab-therapist-settings"))
  })

  it("skips profile migration when the current owner has no scoped therapist value", async () => {
    const sync = loadPreferenceSync("owner-b", {
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
    await new Promise((resolve) => setImmediate(resolve))

    assert.deepEqual(sync.requests.map(({ url }) => url), ["/api/account/preferences"])
    assert.equal(sync.status, "Local preferences synced to your account.")
    assert.ok(sync.storageReads.includes("massage-lab-therapist-settings:account:owner-b"))
    assert.ok(!sync.storageReads.includes("massage-lab-therapist-settings"))
    assert.ok(!sync.storageReads.includes("massage-lab-therapist-settings:owner-a"))
  })

  it("treats ownerless preference-only sync as successful without uploading a profile", async () => {
    const sync = loadPreferenceSync(null)
    await new Promise((resolve) => setImmediate(resolve))

    assert.deepEqual(sync.requests.map(({ url }) => url), ["/api/account/preferences"])
    assert.equal(sync.status, "Local preferences synced to your account.")
    assert.ok(!sync.storageReads.some((key) => key.startsWith("massage-lab-therapist-settings")))
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
      const sync = loadPreferenceSync("owner-b", {
        values: new Map([
          ["massage-lab-therapist-settings:account:owner-b", JSON.stringify(snapshot)],
        ]),
      })
      await new Promise((resolve) => setImmediate(resolve))

      assert.deepEqual(sync.requests.map(({ url }) => url), ["/api/account/preferences"])
      assert.equal(sync.status, "Local preferences synced to your account.")
    }
  })

  it("settles failed preference and profile requests without leaving sync pending", async () => {
    const preferenceRequest = deferred()
    const profileRequest = deferred()
    const unhandledRejections = []
    const onUnhandledRejection = (error) => unhandledRejections.push(error)
    process.on("unhandledRejection", onUnhandledRejection)

    try {
      const sync = loadPreferenceSync("owner-b", {
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

      await assert.doesNotReject(result)
      profileRequest.reject(new Error("profile unavailable"))
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(sync.isSyncing, false)
      assert.equal(sync.status, "Preference sync failed. Sign in again and retry.")
      assert.deepEqual(unhandledRejections, [])
    } finally {
      process.off("unhandledRejection", onUnhandledRejection)
    }
  })

  it("clears pending and reports failure when browser storage cannot be read", async () => {
    const sync = loadPreferenceSync(null, {
      getItem: () => {
        throw new Error("browser storage unavailable")
      },
      hasCloudPreferences: true,
    })

    await assert.doesNotReject(sync.syncLocalPreferences())
    assert.equal(sync.isSyncing, false)
    assert.equal(sync.status, "Preference sync failed. Sign in again and retry.")
    assert.deepEqual(sync.requests, [])
  })
})
