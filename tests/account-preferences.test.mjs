import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  USER_PREFERENCES_VERSION,
  buildTherapistProfilePayload,
  canSyncAccountPreferencesFromSession,
  buildUserPreferencePayload,
  canSyncAccountPreferences,
  choosePreferenceSource,
  createChimerPreferenceSyncRouter,
  createSerializedChimerPreferenceWriter,
  createChimerPreferenceSyncRequest,
  createChimerPreferenceSyncRetry,
  doesChimerPreferenceWriteResponseMatch,
  removeForbiddenPreferenceFields,
  resolveChimerPreferenceSyncRequest,
  resolveSupporterRoadmapInterestsAfterSave,
} from "../lib/account-preferences.js"
import {
  backgroundPreferenceNormalizationOptions,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"

describe("Account preference helpers", () => {
  it("builds a versioned sync payload from safe local settings", () => {
    const payload = buildUserPreferencePayload({
      appSettings: { appBarPosition: "bottom", sidebarPosition: "right", sidebarTriggerPosition: "bottom", themeMode: "system" },
      chimerSettings: { movingBackgroundEnabled: false },
      anatomimeSettings: { roundLimit: 8 },
      notePreferences: { defaultNoteType: "soap" },
      calendarPreferences: { defaultRange: "week", providerViewMode: "combined" },
    })

    assert.equal(payload.version, USER_PREFERENCES_VERSION)
    assert.deepEqual(payload.app_settings, { appBarPosition: "bottom", sidebarPosition: "right", sidebarTriggerPosition: "bottom", themeMode: "system" })
    assert.deepEqual(payload.chimer_settings, { movingBackgroundEnabled: false })
    assert.deepEqual(payload.anatomime_settings, { roundLimit: 8 })
    assert.deepEqual(payload.note_preferences, { defaultNoteType: "soap" })
    assert.deepEqual(payload.calendar_preferences, { defaultRange: "week", providerViewMode: "combined" })
  })

  it("round-trips sanitized nested background preferences without PHI-shaped fields", () => {
    const payload = buildUserPreferencePayload({
      chimerSettings: {
        minutes: 30,
        backgroundVisualPreferences: {
          version: 1,
          palette: {
            mode: "harmony",
            primaryColor: "#123456",
            harmony: "triadic",
          },
          visualPresetsByBackground: {
            "massage-lab-novatrix": [{
              id: "bounded",
              name: "Bounded",
              properties: {
                massageLabNovatrixSpeed: 999,
                soapDraft: "never sync",
                clientName: "never sync",
              },
              mapping: { field: 5, staleRole: 2 },
            }],
          },
        },
      },
    }, { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions })

    assert.equal(payload.chimer_settings.minutes, 30)
    assert.equal(payload.chimer_settings.backgroundVisualPreferences.version, 1)
    assert.equal(payload.chimer_settings.backgroundVisualPreferences.palette.mode, "harmony")
    assert.deepEqual(
      payload.chimer_settings.backgroundVisualPreferences
        .visualPresetsByBackground["massage-lab-novatrix"][0].properties,
      { massageLabNovatrixSpeed: 3 },
    )
    assert.deepEqual(
      payload.chimer_settings.backgroundVisualPreferences
        .visualPresetsByBackground["massage-lab-novatrix"][0].mapping,
      { field: 5 },
    )
    assert.doesNotMatch(JSON.stringify(payload.chimer_settings), /soapDraft|clientName|never sync|staleRole/)
  })

  it("serializes Account sync with the authoritative background inventory", async () => {
    const localPreferences = {
      appSettings: {
        themeMode: "system",
        clientName: "Never sync",
      },
      chimerSettings: {
        minutes: 30,
        backgroundVisualPreferences: {
          version: 1,
          mappingsByBackground: {
            "massage-lab-novatrix": {
              field: 2,
              staleRole: 6,
            },
            "unknown-background": {
              field: 4,
            },
          },
          visualPresetsByBackground: {
            "massage-lab-novatrix": [{
              id: "account-local",
              name: "Account local",
              properties: {
                massageLabNovatrixSpeed: 999,
                hours: 4,
                clientName: "Never sync",
              },
              mapping: { field: 6, staleVisualRole: 1 },
            }],
            "unknown-background": [{
              id: "unknown",
              name: "Unknown",
              properties: {
                unknownSpeed: 2,
              },
            }],
          },
        },
      },
      anatomimeSettings: {
        roundLimit: 8,
      },
      notePreferences: {
        defaultNoteType: "soap",
        soapDraft: "Never sync",
      },
      calendarPreferences: {
        defaultRange: "week",
      },
    }

    const payload = buildUserPreferencePayload(localPreferences, {
      backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
    })
    const requestBody = JSON.parse(JSON.stringify({
      appSettings: payload.app_settings,
      chimerSettings: payload.chimer_settings,
      anatomimeSettings: payload.anatomime_settings,
      notePreferences: payload.note_preferences,
      calendarPreferences: payload.calendar_preferences,
    }))

    assert.deepEqual(
      requestBody.chimerSettings.backgroundVisualPreferences.mappingsByBackground,
      { "massage-lab-novatrix": { field: 2 } },
    )
    assert.deepEqual(
      requestBody.chimerSettings.backgroundVisualPreferences
        .visualPresetsByBackground["massage-lab-novatrix"][0].properties,
      { massageLabNovatrixSpeed: 3 },
    )
    assert.deepEqual(
      requestBody.chimerSettings.backgroundVisualPreferences
        .visualPresetsByBackground["massage-lab-novatrix"][0].mapping,
      { field: 6 },
    )
    assert.doesNotMatch(
      JSON.stringify(requestBody),
      /unknown-background|staleRole|staleVisualRole|hours|clientName|soapDraft|Never sync/,
    )

    const withoutInventory = buildUserPreferencePayload(localPreferences)
    assert.deepEqual(
      withoutInventory.chimer_settings.backgroundVisualPreferences.mappingsByBackground,
      {},
    )
    assert.deepEqual(
      withoutInventory.chimer_settings.backgroundVisualPreferences.visualPresetsByBackground,
      {},
    )

  })

  it("retains the exact sanitized request body after a failed cloud write for retry", () => {
    const pending = createChimerPreferenceSyncRequest({
      minutes: 999,
      backgroundVisualPreferences: {
        version: 1,
        palette: { mode: "custom", primaryColor: "#abc" },
      },
    }, {
      backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
      requestId: 1,
    })
    const stale = resolveChimerPreferenceSyncRequest(pending, pending, false)

    assert.equal(pending.status, "pending")
    assert.equal(pending.requestId, 1)
    assert.deepEqual(pending.sanitizedSettings, JSON.parse(pending.requestBody).chimerSettings)
    assert.equal(stale.status, "stale")
    assert.equal(stale.requestBody, pending.requestBody)
    assert.equal(JSON.parse(stale.requestBody).chimerSettings.hours, 16)
    assert.equal(JSON.parse(stale.requestBody).chimerSettings.minutes, 39)
    assert.equal(
      JSON.parse(stale.requestBody).chimerSettings.backgroundVisualPreferences.palette.primaryColor,
      "#aabbcc",
    )
    assert.deepEqual(resolveChimerPreferenceSyncRequest(stale, stale, true), {
      status: "synced",
      requestBody: null,
      requestId: 1,
    })
  })

  it("marks a successful write stale when the server sanitizes the submitted Chimer snapshot", () => {
    const request = createChimerPreferenceSyncRequest(
      { minutes: 20 },
      {
        backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
        requestId: 1,
      },
    )
    const submittedSettings = JSON.parse(request.requestBody).chimerSettings

    assert.equal(doesChimerPreferenceWriteResponseMatch(
      request.requestBody,
      { chimerSettings: submittedSettings },
      { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions },
    ), true)
    const responseMatches = doesChimerPreferenceWriteResponseMatch(
      request.requestBody,
      { chimerSettings: { ...submittedSettings, minutes: 10 } },
      { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions },
    )
    assert.equal(responseMatches, false)
    assert.equal(
      resolveChimerPreferenceSyncRequest(request, request, responseMatches).status,
      "stale",
    )
    assert.equal(doesChimerPreferenceWriteResponseMatch(
      request.requestBody,
      {},
      { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions },
    ), false)
  })

  it("ignores out-of-order completions and retries only the latest failed body", () => {
    const first = createChimerPreferenceSyncRequest({ minutes: 10 }, { requestId: 1 })
    const second = createChimerPreferenceSyncRequest({ minutes: 20 }, { requestId: 2 })

    assert.deepEqual(resolveChimerPreferenceSyncRequest(second, first, false), second)
    const secondStale = resolveChimerPreferenceSyncRequest(second, second, false)
    assert.equal(secondStale.status, "stale")
    assert.equal(secondStale.requestBody, second.requestBody)

    const retry = createChimerPreferenceSyncRetry(secondStale, 3)
    assert.equal(retry.status, "pending")
    assert.equal(retry.requestBody, second.requestBody)
    assert.equal(retry.requestId, 3)
    assert.deepEqual(resolveChimerPreferenceSyncRequest(retry, second, true), retry)
    assert.deepEqual(resolveChimerPreferenceSyncRequest(retry, retry, false), {
      status: "stale",
      requestBody: second.requestBody,
      requestId: 3,
    })
  })

  it("serializes writes, supersedes queued bodies, and commits the newest payload last", async () => {
    const deferred = []
    const sentBodies = []
    const completions = []
    const writer = createSerializedChimerPreferenceWriter({
      send: (request) => {
        sentBodies.push(request.requestBody)
        return new Promise((resolve) => deferred.push(resolve))
      },
      onComplete: (request, succeeded) => {
        completions.push({ requestBody: request.requestBody, succeeded })
      },
    })
    const first = createChimerPreferenceSyncRequest({ minutes: 10 }, { requestId: 1 })
    const superseded = createChimerPreferenceSyncRequest({ minutes: 20 }, { requestId: 2 })
    const latest = createChimerPreferenceSyncRequest({ minutes: 30 }, { requestId: 3 })

    writer.enqueue(first)
    writer.enqueue(superseded)
    writer.enqueue(latest)
    assert.deepEqual(sentBodies, [first.requestBody])

    deferred.shift()(true)
    await Promise.resolve()
    await Promise.resolve()
    assert.deepEqual(sentBodies, [first.requestBody, latest.requestBody])

    deferred.shift()(true)
    await writer.whenIdle()
    assert.deepEqual(completions, [
      { requestBody: first.requestBody, succeeded: true },
      { requestBody: latest.requestBody, succeeded: true },
    ])
    assert.equal(
      JSON.parse(completions.at(-1).requestBody).chimerSettings.minutes,
      30,
    )
  })

  it("lets a newer successful write invalidate an in-flight stale retry body", async () => {
    const deferred = []
    let state = {
      status: "stale",
      requestBody: createChimerPreferenceSyncRequest({ minutes: 20 }).requestBody,
      requestId: 2,
    }
    const writer = createSerializedChimerPreferenceWriter({
      send: () => new Promise((resolve) => deferred.push(resolve)),
      onComplete: (request, succeeded) => {
        state = resolveChimerPreferenceSyncRequest(state, request, succeeded)
      },
    })
    const retry = createChimerPreferenceSyncRetry(state, 3)
    const latest = createChimerPreferenceSyncRequest({ minutes: 40 }, { requestId: 4 })

    state = retry
    writer.enqueue(retry)
    state = latest
    writer.enqueue(latest)

    deferred.shift()(false)
    await Promise.resolve()
    await Promise.resolve()
    assert.deepEqual(state, latest)

    deferred.shift()(true)
    await writer.whenIdle()
    assert.deepEqual(state, {
      status: "synced",
      requestBody: null,
      requestId: 4,
    })
  })

  it("continues draining and resolves idle when a completion observer throws", async () => {
    const sentRequestIds = []
    const completedRequestIds = []
    const writer = createSerializedChimerPreferenceWriter({
      send: async (request) => {
        sentRequestIds.push(request.requestId)
        return true
      },
      onComplete: (request) => {
        completedRequestIds.push(request.requestId)
        if (request.requestId === 1) {
          throw new Error("observer failed")
        }
      },
    })

    writer.enqueue(createChimerPreferenceSyncRequest({ minutes: 10 }, { requestId: 1 }))
    writer.enqueue(createChimerPreferenceSyncRequest({ minutes: 20 }, { requestId: 2 }))
    await writer.whenIdle()

    assert.deepEqual(sentRequestIds, [1, 2])
    assert.deepEqual(completedRequestIds, [1, 2])
  })

  it("routes automatic, Visual Apply, and Visual Retry through one writer", () => {
    const enqueued = []
    const router = createChimerPreferenceSyncRouter({
      enqueue: (request) => enqueued.push(request),
    })
    const automatic = createChimerPreferenceSyncRequest({ minutes: 10 }, { requestId: 1 })
    const visualApply = createChimerPreferenceSyncRequest({ minutes: 20 }, { requestId: 2 })
    const visualRetry = createChimerPreferenceSyncRetry(
      resolveChimerPreferenceSyncRequest(visualApply, visualApply, false),
      3,
    )

    router.automatic(automatic)
    router.visualApply(visualApply)
    router.visualRetry(visualRetry)

    assert.deepEqual(enqueued, [automatic, visualApply, visualRetry])
  })

  it("removes known PHI fields before account sync", () => {
    const payload = buildUserPreferencePayload({
      notePreferences: {
        defaultNoteType: "soap",
        soapDraft: "client symptoms",
        painJournal: [{ intensity: 8, notes: "neck pain" }],
        romMeasurements: [{ movement: "rotation", degrees: 45 }],
        nested: {
          clientName: "Jane Example",
          sensationJournal: "tingling",
          treatmentDetails: "session details",
          safeDefault: "include stretching prompt",
        },
      },
    })

    assert.deepEqual(payload.note_preferences, {
      defaultNoteType: "soap",
      nested: {
        safeDefault: "include stretching prompt",
      },
    })
    assert.deepEqual(removeForbiddenPreferenceFields([{ clientDob: "1990-01-01", safe: true }]), [{ safe: true }])
  })

  it("removes PHI-shaped keys from business planner app settings", () => {
    const payload = buildUserPreferencePayload({
      appSettings: {
        businessIncomePlannerIncome: {
          desiredTakeHomeIncome: 60000,
          clientName: "Jane Example",
          soapDraft: "session details",
          nested: {
            safeAssumption: "monthly rent",
            wellnessEntries: [{ summary: "neck pain" }],
          },
        },
      },
    })

    assert.deepEqual(payload.app_settings, {
      businessIncomePlannerIncome: {
        desiredTakeHomeIncome: 60000,
        nested: {
          safeAssumption: "monthly rent",
        },
      },
    })
  })

  it("keeps quick-action preferences while stripping PHI-shaped app settings", () => {
    const payload = buildUserPreferencePayload({
      appSettings: {
        onboarding: {
          primaryRole: "client",
          quickActions: ["wellness_quick_log", "start_public_music"],
          clientName: "Jane Example",
        },
      },
    })

    assert.deepEqual(payload.app_settings, {
      onboarding: {
        primaryRole: "client",
        quickActions: ["wellness_quick_log", "start_public_music"],
      },
    })
  })

  it("sanitizes supporter roadmap interests without replacing onboarding or other app settings", () => {
    const payload = buildUserPreferencePayload({
      appSettings: {
        onboarding: {
          useCases: ["learn_anatomy", "track_progress"],
        },
        musicVisualizer: { showClock: true },
        supporterRoadmapInterests: [
          "personal_wellness",
          "therapist_tools",
          "personal_wellness",
          "unknown_interest",
          "clientName",
          null,
          "professional_documentation",
        ],
      },
    })

    assert.deepEqual(payload.app_settings, {
      onboarding: {
        useCases: ["learn_anatomy", "track_progress"],
      },
      musicVisualizer: { showClock: true },
      supporterRoadmapInterests: [
        "personal_wellness",
        "therapist_tools",
        "professional_documentation",
      ],
    })
  })

  it("restores the persisted roadmap interests when an optimistic save fails", () => {
    const previousInterests = ["personal_wellness", "therapist_tools"]

    assert.deepEqual(resolveSupporterRoadmapInterestsAfterSave({
      previousInterests,
      responseInterests: ["practice_management"],
      saveSucceeded: false,
    }), previousInterests)

    assert.deepEqual(resolveSupporterRoadmapInterestsAfterSave({
      previousInterests,
      responseInterests: ["practice_management", "unknown_interest"],
      saveSucceeded: true,
    }), ["practice_management"])

    assert.deepEqual(resolveSupporterRoadmapInterestsAfterSave({
      previousInterests,
      responseInterests: [],
      submittedInterests: ["practice_management"],
      saveSucceeded: true,
    }), [])

    assert.deepEqual(resolveSupporterRoadmapInterestsAfterSave({
      previousInterests,
      responseInterests: "invalid-response-shape",
      submittedInterests: ["personal_wellness", "practice_management"],
      saveSucceeded: true,
    }), ["personal_wellness", "practice_management"])
  })

  it("preserves namespaced Music visualizer preferences while stripping forbidden nested keys", () => {
    const payload = buildUserPreferencePayload({
      appSettings: {
        musicVisualizer: {
          defaultBackgroundId: "aurora",
          showClock: true,
          clientName: "Do Not Sync",
          nested: {
            safePreference: "keep",
            soapDraft: "Do Not Sync",
          },
        },
      },
    })

    assert.deepEqual(payload.app_settings, {
      musicVisualizer: {
        defaultBackgroundId: "aurora",
        showClock: true,
        nested: {
          safePreference: "keep",
        },
      },
    })
  })

  it("uses cloud preferences after login when they exist", () => {
    const result = choosePreferenceSource({
      cloudPreferences: { app_settings: { sidebarPosition: "left", sidebarTriggerPosition: "top" } },
      localPreferences: { app_settings: { sidebarPosition: "right" } },
    })

    assert.equal(result.source, "cloud")
    assert.deepEqual(result.preferences, { app_settings: { sidebarPosition: "left", sidebarTriggerPosition: "top" } })
  })

  it("uses local preferences as the initial source when cloud is empty", () => {
    const result = choosePreferenceSource({
      cloudPreferences: null,
      localPreferences: { chimer_settings: { minutes: 45 } },
    })

    assert.equal(result.source, "local")
    assert.deepEqual(result.preferences, { chimer_settings: { minutes: 45 } })
  })

  it("maps local therapist settings into profile fields without client data", () => {
    assert.deepEqual(buildTherapistProfilePayload({
      name: "Alex Therapist",
      location: "Downtown",
      licenseNumber: "MT-123",
      licenseOrganization: "State Board",
      npiNumber: "1234567890",
      clientName: "Do Not Sync",
    }), {
      therapist_name: "Alex Therapist",
      therapist_location: "Downtown",
      license_number: "MT-123",
      license_organization: "State Board",
      npi_number: "1234567890",
    })
  })

  it("allows cloud account sync only for a signed-in user id", () => {
    assert.equal(canSyncAccountPreferences(null), false)
    assert.equal(canSyncAccountPreferences({}), false)
    assert.equal(canSyncAccountPreferences({ id: "" }), false)
    assert.equal(canSyncAccountPreferences({ id: "   " }), false)
    assert.equal(canSyncAccountPreferences({ id: "user_123" }), true)
  })

  it("allows cloud account sync only when client session data includes a user id", () => {
    assert.equal(canSyncAccountPreferencesFromSession(null), false)
    assert.equal(canSyncAccountPreferencesFromSession({}), false)
    assert.equal(canSyncAccountPreferencesFromSession({ user: null }), false)
    assert.equal(canSyncAccountPreferencesFromSession({ user: { email: "anonymous@example.com" } }), false)
    assert.equal(canSyncAccountPreferencesFromSession({ user: { id: "user_123", email: "alpha@example.com" } }), true)
  })
})
