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

function loadRoute({ savedSettings = ownedOnlySettings(), failAccess = false } = {}) {
  const calls = {
    snapshots: [],
    upserts: [],
  }
  const preferenceRecord = {
    version: USER_PREFERENCES_VERSION,
    appSettings: {},
    chimerSettings: savedSettings,
    anatomimeSettings: {},
    notePreferences: {},
    calendarPreferences: {},
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
  }
  const prisma = {
    userPreference: {
      findUnique: async () => preferenceRecord,
      upsert: async (input) => {
        calls.upserts.push(input)
        return {
          ...preferenceRecord,
          ...input.update,
        }
      },
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
        getUserEntitlementState: async () => {
          if (failAccess) {
            throw new Error("temporary membership lookup failure")
          }
          return {
            level: "free",
            features: [],
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

  return { ...route, calls }
}

function assertOwnedOnlySnapshot(settings) {
  assert.equal(settings.backgroundId, ownedBackgroundId)
  assert.equal(settings.massageLabStarsSpeed, 72)
  assert.equal(settings.backgroundVisualPreferences.palette.mode, "custom")
  assert.equal(settings.primaryFontColor, DEFAULT_CHIMER_SETTINGS.primaryFontColor)
}

function unownedSettings() {
  return {
    ...ownedOnlySettings(),
    backgroundId: unownedBackgroundId,
    massageLabAuroraSpeed: 88,
  }
}

function assertUnownedFallback(settings) {
  assert.equal(settings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
  assert.equal(
    Object.hasOwn(settings, "massageLabAuroraSpeed"),
    false,
    "unowned renderer settings must not survive sanitization",
  )
}

describe("account preference route ownership boundary", () => {
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
      /settingsChangedWhileSeeding[\s\S]*?serverChangedSeed[\s\S]*?setAccountSyncStatus\("conflict"\)/,
    )
    assert.match(
      chimerPageSource,
      /const accessibleInFlightSettings = sanitizeAccessibleChimerSettings\(\s*settingsRef\.current,[\s\S]*?featureKeys: reconciledSeed\.featureKeys,[\s\S]*?ownedBackgroundIds: reconciledSeed\.ownedBackgroundIds,/,
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

  it("PUT re-sanitizes retained Chimer settings when another preference section changes", async () => {
    const { PUT, calls } = loadRoute({ savedSettings: unownedSettings() })
    const response = await PUT(new Request("https://massagelab.app/api/account/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appSettings: { theme: "dark" } }),
    }))

    assert.equal(response.status, 200)
    assert.equal(calls.upserts.length, 1)
    assertUnownedFallback(calls.upserts[0].update.chimerSettings)
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
    assert.deepEqual(calls.upserts[0].update.chimerSettings, {})
    assert.deepEqual(response.body.chimerSettings, {})
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
