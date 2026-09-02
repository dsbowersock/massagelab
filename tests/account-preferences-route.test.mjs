import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  USER_PREFERENCES_VERSION,
  buildUserPreferencePayload,
} from "../lib/account-preferences.js"
import {
  backgroundPreferenceNormalizationOptions,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"
import { DEFAULT_CHIMER_SETTINGS } from "../lib/chimer-timer.js"
import { sanitizeAccessibleChimerSettings } from "../lib/chimer-accessible-settings.ts"
import { objectRecord } from "../lib/onboarding-preferences.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeSource = await readFile(
  new URL("../app/api/account/preferences/route.ts", import.meta.url),
  "utf8",
)
const chimerPageSource = await readFile(
  new URL("../app/chimer/page.tsx", import.meta.url),
  "utf8",
)
const ownedBackgroundId = "massage-lab-stars"
const unownedBackgroundId = "massage-lab-aurora"

function ownedOnlySettings() {
  return {
    backgroundId: ownedBackgroundId,
    massageLabStarsSpeed: 72,
    primaryFontColor: "#010203",
    backgroundVisualPreferences: {
      palette: {
        mode: "custom",
        primaryColor: "#112233",
        harmony: "analogous",
        swatches: [
          "#112233",
          "#223344",
          "#334455",
          "#445566",
          "#556677",
          "#667788",
          "#778899",
        ],
      },
    },
  }
}

function deferred() {
  let resolve
  const promise = new Promise((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** Bounds manual transaction gates so an ordering regression fails instead of hanging the test process. */
async function boundedLatch(promise, label, timeoutMs = 1_000) {
  let timeout
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

/** Attaches both handlers immediately while preserving the request outcome for later assertions. */
function observeOutcome(promise) {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ reason, status: "rejected" }),
  )
}

function loadRoute({
  savedSettings = ownedOnlySettings(),
  failAccess = false,
  featureAccess = [],
  pauseFirstUpsert = false,
} = {}) {
  const calls = {
    entitlementReads: 0,
    lockAcquisitions: [],
    lockAttempts: [],
    locks: [],
    reads: [],
    snapshots: [],
    transactionStarts: [],
    transactions: 0,
    upsertTransactions: [],
    upserts: [],
  }
  let preferenceRecord = {
    version: USER_PREFERENCES_VERSION,
    appSettings: {},
    chimerSettings: savedSettings,
    anatomimeSettings: {},
    notePreferences: {},
    calendarPreferences: {},
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
  }
  const firstUpsertStarted = deferred()
  const releaseFirstUpsert = deferred()
  const secondLockAttempted = deferred()
  const ownerLocks = new Map()
  let upsertCount = 0
  const userPreferenceFor = (transactionId) => ({
    findUnique: async () => {
      calls.reads.push(transactionId)
      return preferenceRecord
    },
    upsert: async (input) => {
      calls.upserts.push(input)
      calls.upsertTransactions.push(transactionId)
      upsertCount += 1
      if (pauseFirstUpsert && upsertCount === 1) {
        firstUpsertStarted.resolve()
        await releaseFirstUpsert.promise
      }
      preferenceRecord = {
        ...preferenceRecord,
        ...input.update,
      }
      return preferenceRecord
    },
  })
  const userPreference = userPreferenceFor(0)
  const prisma = {
    userPreference,
    $transaction: async (callback) => {
      calls.transactions += 1
      const transactionId = calls.transactions
      calls.transactionStarts.push(transactionId)
      // PostgreSQL row locks are transaction-reentrant even after another
      // transaction has queued for the same owner.
      const heldOwnerLocks = new Set()
      const releaseOwnerLocks = []
      try {
        return await callback({
          userPreference: userPreferenceFor(transactionId),
          $queryRaw: async (...query) => {
            calls.locks.push(query)
            const userId = query[1]
            calls.lockAttempts.push(transactionId)
            if (calls.lockAttempts.length === 2) secondLockAttempted.resolve()

            if (heldOwnerLocks.has(userId)) {
              calls.lockAcquisitions.push(transactionId)
              return []
            }

            // Transactions begin independently. Only the simulated stable User
            // row lock queues work for the same owner, matching PostgreSQL's
            // FOR UPDATE boundary closely enough to catch a read-before-lock.
            const precedingOwnerLock = ownerLocks.get(userId)
            const currentOwnerLock = deferred()
            ownerLocks.set(userId, currentOwnerLock)
            if (precedingOwnerLock) await precedingOwnerLock.promise
            heldOwnerLocks.add(userId)
            calls.lockAcquisitions.push(transactionId)
            releaseOwnerLocks.push(() => {
              if (ownerLocks.get(userId) === currentOwnerLock) ownerLocks.delete(userId)
              currentOwnerLock.resolve()
            })
            return []
          },
        })
      } finally {
        for (const releaseOwnerLock of releaseOwnerLocks.toReversed()) releaseOwnerLock()
      }
    },
  }
  const route = loadCompiledModule(
    routeSource,
    "app/api/account/preferences/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
        },
      },
      "@/auth": {
        getCurrentSession: async () => ({ user: { id: "owned-only-user" } }),
      },
      "@/lib/account-preferences": {
        USER_PREFERENCES_VERSION,
        buildUserPreferencePayload,
      },
      "@/lib/account-surface-data": {
        clearAccountSurfaceDataCache: () => undefined,
      },
      "@/components/backgrounds/backgroundPaletteRegistry": {
        backgroundPreferenceNormalizationOptions,
      },
      "@/lib/chimer-accessible-settings": {
        sanitizeAccessibleChimerSettings,
      },
      "@/lib/onboarding-preferences": {
        objectRecord,
      },
      "@/lib/membership": {
        FEATURE_KEYS: { premiumBackgrounds: "premium_backgrounds" },
        getUserEntitlementState: async () => {
          calls.entitlementReads += 1
          if (failAccess) {
            throw new Error("temporary membership lookup failure")
          }
          return {
            level: "free",
            features: featureAccess.map(({ featureKey }) => featureKey),
            featureAccess,
          }
        },
      },
      "@/lib/commerce/snapshot-service": {
        getBackgroundCommerceSnapshot: async (input) => {
          calls.snapshots.push(input)
          return { ownedBackgroundIds: [ownedBackgroundId] }
        },
      },
      "@/lib/prisma": {
        prisma,
      },
    },
  )

  return {
    ...route,
    calls,
    firstUpsertStarted: firstUpsertStarted.promise,
    releaseFirstUpsert: releaseFirstUpsert.resolve,
    readPreferenceRecord: () => preferenceRecord,
    secondLockAttempted: secondLockAttempted.promise,
  }
}

function assertOwnedOnlySnapshot(settings) {
  assert.equal(settings.backgroundId, ownedBackgroundId)
  assert.equal(settings.massageLabStarsSpeed, 72)
  assert.equal(settings.backgroundVisualPreferences.palette.mode, "custom")
  assert.equal(settings.primaryFontColor, "#010203")
}

function unownedSettings() {
  return {
    ...ownedOnlySettings(),
    backgroundId: unownedBackgroundId,
    massageLabAuroraUnsupportedControl: 88,
  }
}

function assertUnownedFallback(settings) {
  assert.equal(settings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
  assert.equal(
    Object.hasOwn(settings, "massageLabAuroraUnsupportedControl"),
    false,
    "unowned renderer settings must not survive sanitization",
  )
}

describe("account preference route ownership boundary", () => {
  it("rejects non-record JSON bodies before access or preference storage", async () => {
    for (const body of [null, [], "settings", 42, true]) {
      const route = loadRoute()
      const response = await route.PUT(new Request("https://massagelab.app/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }))

      assert.equal(response.status, 400)
      assert.equal(route.calls.entitlementReads, 0)
      assert.equal(route.calls.snapshots.length, 0)
      assert.equal(route.calls.transactions, 0)
      assert.equal(route.calls.upserts.length, 0)
    }
  })

  it("rejects malformed JSON before access or preference storage", async () => {
    const route = loadRoute()
    const response = await route.PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{malformed",
    }))

    assert.equal(response.status, 400)
    assert.equal(route.calls.entitlementReads, 0)
    assert.equal(route.calls.snapshots.length, 0)
    assert.equal(route.calls.transactions, 0)
    assert.equal(route.calls.upserts.length, 0)
  })

  it("retains renderer tuning for an owned Music background when Chimer selects another visual", () => {
    const settings = sanitizeAccessibleChimerSettings({
      backgroundId: DEFAULT_CHIMER_SETTINGS.backgroundId,
      massageLabStarsSpeed: 72,
    }, {
      featureKeys: [],
      ownedBackgroundIds: [ownedBackgroundId],
    })

    assert.equal(settings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(settings.massageLabStarsSpeed, 72)
    assert.match(
      chimerPageSource,
      /sanitizeAccessibleChimerSettings\(\s*preferences\.chimerSettings,/,
    )
    assert.match(
      chimerPageSource,
      /sanitizeAccessibleChimerSettings\(\s*settingsRef\.current,/,
    )
    assert.match(
      chimerPageSource,
      /settingsRef\.current = seedSettings\s+setSettings\(seedSettings\)[\s\S]*?resolveChimerPreferenceSeedResult\(seedResponseBody,/,
    )
    assert.match(
      chimerPageSource,
      /const nextPremiumBackgroundAccessSource = normalizePremiumBackgroundAccessSource\([\s\S]*?setFeatureKeys\(nextFeatureKeys\)[\s\S]*?setPremiumBackgroundAccessSource\(nextPremiumBackgroundAccessSource\)/,
    )
    assert.match(
      chimerPageSource,
      /setFeatureKeys\(reconciledSeed\.featureKeys\)[\s\S]*?setPremiumBackgroundAccessSource\(reconciledSeed\.premiumBackgroundAccessSource\)/,
    )
    assert.match(
      chimerPageSource,
      /mergeBackgroundAccessOwnership\(\{[\s\S]*?featureKeys,[\s\S]*?premiumBackgroundAccessSource,[\s\S]*?ownedBackgroundIds:/,
    )
    assert.match(
      chimerPageSource,
      /settingsChangedWhileSeeding[\s\S]*?serverChangedSeed[\s\S]*?setAccountSyncStatus\("conflict"\)/,
    )
    assert.match(
      chimerPageSource,
      /const accessibleInFlightSettings = sanitizeAccessibleChimerSettings\(\s*settingsRef\.current,[\s\S]*?featureKeys: reconciledSeed\.featureKeys,[\s\S]*?ownedBackgroundIds: reconciledSeed\.ownedBackgroundIds,/,
    )
    assert.match(
      chimerPageSource,
      /const reconciledWrite = resolveChimerPreferenceSeedResult\(responseBody,[\s\S]*?setFeatureKeys\(reconciledWrite\.featureKeys\)[\s\S]*?setPremiumBackgroundAccessSource\(reconciledWrite\.premiumBackgroundAccessSource\)[\s\S]*?setPermanentlyOwnedBackgroundIds\(reconciledWrite\.ownedBackgroundIds\)[\s\S]*?doesChimerPreferenceWriteResponseMatch/,
    )
    const conflictResolutionStart = chimerPageSource.indexOf("const useDeviceSettingsForAccount")
    const conflictResolutionEnd = chimerPageSource.indexOf(
      "const useSavedAccountSettings",
      conflictResolutionStart,
    )
    const conflictResolutionSource = chimerPageSource.slice(
      conflictResolutionStart,
      conflictResolutionEnd,
    )
    assert.match(
      conflictResolutionSource,
      /resolveChimerPreferenceSeedResult\(responseBody,[\s\S]*?setFeatureKeys\(reconciledWrite\.featureKeys\)[\s\S]*?setPremiumBackgroundAccessSource\(reconciledWrite\.premiumBackgroundAccessSource\)[\s\S]*?setPermanentlyOwnedBackgroundIds\(reconciledWrite\.ownedBackgroundIds\)/,
    )
    assert.match(
      conflictResolutionSource,
      /settingsChangedWhileResolving[\s\S]*?sanitizeAccessibleChimerSettings\(settingsRef\.current,[\s\S]*?setAccountSyncStatus\("conflict"\)/,
    )
    assert.match(
      chimerPageSource,
      /settingsRef\.current = nextSanitizedSettings\s+setSettings\(nextSanitizedSettings\)/,
    )
    assert.match(
      chimerPageSource,
      /const nextSanitizedSettings = sanitizeChimerSettingsPatchForEntitlements\(\s*settingsRef\.current,\s*nextSettings,\s*accessOverride \?\? backgroundAccessRef\.current,/,
    )
  })

  it("GET retains an owned-only background, shared palette, and allowed renderer settings", async () => {
    const { GET, calls } = loadRoute()

    const response = await GET()

    assert.equal(response.status, 200)
    assert.equal(response.body.accessAuthoritative, true)
    assertOwnedOnlySnapshot(response.body.chimerSettings)
    assert.deepEqual(response.body.ownedBackgroundIds, [ownedBackgroundId])
    assert.equal(calls.snapshots.length, 1)
    assert.doesNotMatch(
      JSON.stringify(response.body),
      /paymentIntent|customerId|stripeCustomer|checkoutSession/,
    )
  })

  it("GET and PUT preserve authoritative premium-background provenance", async () => {
    const temporaryFeatureAccess = [{
      featureKey: "premium_backgrounds",
      sources: [{ source: "temporary", expiresAt: "2026-09-01T00:00:00.000Z" }],
    }]
    const overlappingFeatureAccess = [{
      featureKey: "premium_backgrounds",
      sources: [
        { source: "membership", expiresAt: null },
        { source: "temporary", expiresAt: "2026-09-01T00:00:00.000Z" },
      ],
    }]

    const temporary = loadRoute({ featureAccess: temporaryFeatureAccess })
    const temporaryGet = await temporary.GET()
    const temporaryPut = await temporary.PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chimerSettings: ownedOnlySettings() }),
    }))
    const overlapping = loadRoute({ featureAccess: overlappingFeatureAccess })
    const administrative = loadRoute({
      featureAccess: [{
        featureKey: "premium_backgrounds",
        sources: [{ source: "admin", expiresAt: null }],
      }],
    })

    assert.equal(temporaryGet.body.premiumBackgroundAccessSource, "temporary")
    assert.equal(temporaryPut.body.premiumBackgroundAccessSource, "temporary")
    assert.equal((await overlapping.GET()).body.premiumBackgroundAccessSource, "subscription")
    assert.equal((await administrative.GET()).body.premiumBackgroundAccessSource, "admin")
  })

  it("GET falls back when the saved background is not owned", async () => {
    const { GET, calls } = loadRoute({ savedSettings: unownedSettings() })

    const response = await GET()

    assert.equal(response.status, 200)
    assert.equal(response.body.accessAuthoritative, true)
    assertUnownedFallback(response.body.chimerSettings)
    assert.deepEqual(response.body.ownedBackgroundIds, [ownedBackgroundId])
    assert.equal(calls.snapshots.length, 1)
  })

  it("GET preserves an empty Chimer preference so device settings can seed the account", async () => {
    const { GET, calls } = loadRoute({ savedSettings: {} })

    const response = await GET()

    assert.equal(response.status, 200)
    assert.equal(response.body.accessAuthoritative, true)
    assert.deepEqual(response.body.chimerSettings, {})
    assert.equal(calls.snapshots.length, 1)
  })

  it("marks access failures non-authoritative without returning a downgraded Chimer snapshot", async () => {
    const { GET } = loadRoute({ failAccess: true })

    const response = await GET()

    assert.equal(response.status, 200)
    assert.equal(response.body.accessAuthoritative, false)
    assert.equal(response.body.membershipLevel, null)
    assert.deepEqual(response.body.features, [])
    assert.equal(response.body.premiumBackgroundAccessSource, null)
    assert.deepEqual(response.body.ownedBackgroundIds, [])
    assert.deepEqual(response.body.chimerSettings, {})
  })

  it("PUT sanitizes with the same owned-only snapshot before persistence", async () => {
    const { PUT, calls } = loadRoute()
    const response = await PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chimerSettings: ownedOnlySettings() }),
    }))

    assert.equal(response.status, 200)
    assert.equal(calls.snapshots.length, 1)
    assert.equal(calls.upserts.length, 1)
    assert.deepEqual(Object.keys(calls.upserts[0].update).sort(), ["chimerSettings", "version"])
    assert.equal(response.body.accessAuthoritative, true)
    assert.deepEqual(response.body.ownedBackgroundIds, [ownedBackgroundId])
    assertOwnedOnlySnapshot(calls.upserts[0].update.chimerSettings)
    assertOwnedOnlySnapshot(response.body.chimerSettings)
  })

  it("PUT persists and returns the fallback for an unowned submitted background", async () => {
    const { PUT, calls } = loadRoute()
    const response = await PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chimerSettings: unownedSettings() }),
    }))

    assert.equal(response.status, 200)
    assert.equal(calls.snapshots.length, 1)
    assert.equal(calls.upserts.length, 1)
    assertUnownedFallback(calls.upserts[0].update.chimerSettings)
    assertUnownedFallback(response.body.chimerSettings)
  })

  it("PUT projects retained Chimer settings safely without rewriting the omitted column", async () => {
    const { PUT, calls, readPreferenceRecord } = loadRoute({ savedSettings: unownedSettings() })
    const response = await PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appSettings: { theme: "dark" } }),
    }))

    assert.equal(response.status, 200)
    assert.equal(calls.upserts.length, 1)
    assert.deepEqual(Object.keys(calls.upserts[0].update).sort(), ["appSettings", "version"])
    assert.equal(readPreferenceRecord().chimerSettings.backgroundId, unownedBackgroundId)
    assertUnownedFallback(response.body.chimerSettings)
  })

  it("PUT preserves an empty retained Chimer preference during unrelated partial writes", async () => {
    const { PUT, calls } = loadRoute({ savedSettings: {} })
    const response = await PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appSettings: { theme: "dark" } }),
    }))

    assert.equal(response.status, 200)
    assert.equal(calls.upserts.length, 1)
    assert.deepEqual(Object.keys(calls.upserts[0].update).sort(), ["appSettings", "version"])
    assert.deepEqual(response.body.chimerSettings, {})
  })

  it("serializes concurrent app-settings and Chimer patches without losing either write", { timeout: 5_000 }, async () => {
    const route = loadRoute({ savedSettings: {}, pauseFirstUpsert: true })
    let appSettingsOutcome
    let chimerOutcome
    try {
      appSettingsOutcome = observeOutcome(route.PUT(new Request("https://massagelab.app/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appSettings: { showClock: false } }),
      })))
      await boundedLatch(route.firstUpsertStarted, "first upsert start")

      chimerOutcome = observeOutcome(route.PUT(new Request("https://massagelab.app/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chimerSettings: ownedOnlySettings() }),
      })))
      await boundedLatch(route.secondLockAttempted, "second owner-lock attempt")

      assert.deepEqual(route.calls.transactionStarts, [1, 2], "both transactions must begin")
      assert.deepEqual(route.calls.lockAttempts, [1, 2], "both transactions must reach the owner lock")
      assert.deepEqual(route.calls.lockAcquisitions, [1], "the second owner lock must still be waiting")
      assert.deepEqual(
        route.calls.reads,
        [1],
        "a lock moved after findUnique would let the second transaction read stale state here",
      )
      assert.deepEqual(route.calls.upsertTransactions, [1])
      assert.equal(route.calls.upserts.length, 1, "the second writer must wait for the owner lock")
    } finally {
      // Always unblock the first request so a failed ordering assertion cannot
      // strand either simulated transaction or hang the test process.
      route.releaseFirstUpsert()
    }
    const outcomes = await boundedLatch(
      Promise.all([appSettingsOutcome, chimerOutcome]),
      "serialized preference writes",
    )
    assert.deepEqual(
      outcomes.map(({ status }) => status),
      ["fulfilled", "fulfilled"],
      outcomes
        .map(({ reason }) => reason instanceof Error ? reason.stack ?? reason.message : String(reason))
        .join("\n"),
    )
    const [appSettingsResponse, chimerResponse] = outcomes.map(({ value }) => value)
    const saved = route.readPreferenceRecord()

    assert.equal(appSettingsResponse.status, 200)
    assert.equal(chimerResponse.status, 200)
    assert.equal(route.calls.transactions, 2)
    assert.equal(route.calls.locks.length, 2)
    assert.deepEqual(route.calls.lockAcquisitions, [1, 2])
    assert.deepEqual(route.calls.reads, [1, 2])
    assert.deepEqual(route.calls.upsertTransactions, [1, 2])
    assert.match(
      route.calls.locks.map(([query]) => query.join(" ")).join(" "),
      /FROM "User"[\s\S]*FOR UPDATE/,
    )
    assert.deepEqual(route.calls.locks.map(([, userId]) => userId), [
      "owned-only-user",
      "owned-only-user",
    ])
    assert.equal(saved.appSettings.showClock, false)
    assertOwnedOnlySnapshot(saved.chimerSettings)
    assert.deepEqual(Object.keys(route.calls.upserts[0].update).sort(), ["appSettings", "version"])
    assert.deepEqual(Object.keys(route.calls.upserts[1].update).sort(), ["chimerSettings", "version"])
    assert.equal(
      Object.hasOwn(route.calls.upserts[1].update, "appSettings"),
      false,
      "an independent patch must not rewrite an unchanged column",
    )
    assert.equal(chimerResponse.body.appSettings.showClock, false)
  })

  it("PUT retains owned Music tuning when Chimer uses a different background", async () => {
    const { PUT, calls } = loadRoute()
    const response = await PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chimerSettings: {
          ...ownedOnlySettings(),
          backgroundId: DEFAULT_CHIMER_SETTINGS.backgroundId,
          massageLabStarsSpeed: 72,
        },
      }),
    }))

    assert.equal(response.status, 200)
    assert.equal(calls.upserts[0].update.chimerSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(calls.upserts[0].update.chimerSettings.massageLabStarsSpeed, 72)
    assert.equal(response.body.chimerSettings.massageLabStarsSpeed, 72)
  })
})
