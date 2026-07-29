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
import { DEFAULT_CHIMER_SETTINGS, sanitizeChimerSettingsForEntitlements } from "../lib/chimer-timer.js"
import { objectRecord } from "../lib/onboarding-preferences.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeSource = await readFile(
  new URL("../app/api/account/preferences/route.ts", import.meta.url),
  "utf8",
)
const ownedBackgroundId = "massage-lab-stars"

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

function loadRoute({ savedSettings = ownedOnlySettings() } = {}) {
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
      "@/lib/onboarding-preferences": {
        objectRecord,
      },
      "@/lib/chimer-timer": {
        sanitizeChimerSettingsForEntitlements,
      },
      "@/lib/membership": {
        getUserEntitlementState: async () => ({
          level: "free",
          features: [],
        }),
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

describe("account preference route ownership boundary", () => {
  it("GET retains an owned-only background, shared palette, and allowed renderer settings", async () => {
    const { GET, calls } = loadRoute()

    const response = await GET()

    assert.equal(response.status, 200)
    assertOwnedOnlySnapshot(response.body.chimerSettings)
    assert.deepEqual(response.body.ownedBackgroundIds, [ownedBackgroundId])
    assert.equal(calls.snapshots.length, 1)
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
    assertOwnedOnlySnapshot(calls.upserts[0].update.chimerSettings)
    assertOwnedOnlySnapshot(response.body.chimerSettings)
  })
})
