// @ts-check

import { normalizeSupporterRoadmapInterests } from "./onboarding-preferences.js"
import {
  normalizeChimerBackgroundVisualPreferences,
  sanitizeChimerSettings,
} from "./chimer-timer.js"

export const USER_PREFERENCES_VERSION = 1

export const LOCAL_PREFERENCE_KEYS = Object.freeze({
  appSettings: "massage-lab-settings",
  therapistSettings: "massage-lab-therapist-settings",
  chimerSettings: "massagelab-chimer-settings",
  anatomimeSettings: "massagelab-anatomime-settings",
  notePreferences: "massagelab-note-preferences",
  calendarPreferences: "massagelab-calendar-preferences",
})

/**
 * Resolves roadmap-interest state after an optimistic account-preference save.
 * Failed writes restore the last persisted selection, while successful writes
 * adopt the server-sanitized response.
 *
 * @param {{
 *   previousInterests?: unknown,
 *   responseInterests?: unknown,
 *   submittedInterests?: unknown,
 *   saveSucceeded?: boolean,
 * }} [input]
 * @returns {string[]}
 */
export function resolveSupporterRoadmapInterestsAfterSave({
  previousInterests,
  responseInterests,
  submittedInterests,
  saveSucceeded = false,
} = {}) {
  const successfulInterests = Array.isArray(responseInterests)
    ? responseInterests
    : submittedInterests ?? previousInterests

  return normalizeSupporterRoadmapInterests(
    saveSucceeded ? successfulInterests : previousInterests,
  )
}

const FORBIDDEN_SYNC_KEYS = new Set([
  "clientName",
  "clientDob",
  "clientDateOfBirth",
  "dateOfBirth",
  "dob",
  "intakeContent",
  "intakeDraft",
  "incidentJournal",
  "journalEntries",
  "movementData",
  "notes",
  "painJournal",
  "romDraft",
  "romMeasurements",
  "sensationJournal",
  "soapContent",
  "soapDraft",
  "treatmentDetails",
  "activityEntries",
  "bodySensationEntries",
  "clientWellnessEntries",
  "clientWellnessReminderSchedules",
  "emotionEntries",
  "sleepEntries",
  "wellnessEntries",
  "wellnessJournal",
  "wellnessReminderSchedules",
  "wellnessSummary",
])

/**
 * @param {unknown} user
 */
export function canSyncAccountPreferences(user) {
  const account = objectOrEmpty(user)
  return typeof account.id === "string" && account.id.trim().length > 0
}

/**
 * @param {unknown} session
 */
export function canSyncAccountPreferencesFromSession(session) {
  const sessionPayload = objectOrEmpty(session)
  return canSyncAccountPreferences(sessionPayload.user)
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function objectOrEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return /** @type {Record<string, unknown>} */ (value)
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function removeForbiddenPreferenceFields(value) {
  if (Array.isArray(value)) {
    return value.map(removeForbiddenPreferenceFields)
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.fromEntries(
    Object.entries(/** @type {Record<string, unknown>} */ (value))
      .filter(([key]) => !FORBIDDEN_SYNC_KEYS.has(key))
      .map(([key, nestedValue]) => [key, removeForbiddenPreferenceFields(nestedValue)]),
  )
}

/**
 * Preserves ordinary app settings while constraining roadmap interests to the
 * approved categorical values before they can reach UserPreference.appSettings.
 *
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function sanitizeAppSettings(value) {
  const settings = objectOrEmpty(removeForbiddenPreferenceFields(value))

  if (!("supporterRoadmapInterests" in settings)) {
    return settings
  }

  return {
    ...settings,
    supporterRoadmapInterests: normalizeSupporterRoadmapInterests(settings.supporterRoadmapInterests),
  }
}

/**
 * @param {unknown} value
 * @param {{ backgroundPreferenceOptions?: Record<string, unknown> }} [options]
 * @returns {Record<string, unknown>}
 */
function sanitizeChimerPreferenceSnapshot(value, options = {}) {
  const settings = objectOrEmpty(removeForbiddenPreferenceFields(value))
  if (!("backgroundVisualPreferences" in settings)) {
    return settings
  }
  return {
    ...settings,
    backgroundVisualPreferences: normalizeChimerBackgroundVisualPreferences(
      settings.backgroundVisualPreferences,
      options.backgroundPreferenceOptions,
    ),
  }
}

/**
 * @param {Partial<Record<keyof typeof LOCAL_PREFERENCE_KEYS, unknown>>} snapshot
 * @param {{ backgroundPreferenceOptions?: Record<string, unknown> }} [options]
 */
export function buildUserPreferencePayload(snapshot = {}, options = {}) {
  return {
    version: USER_PREFERENCES_VERSION,
    app_settings: sanitizeAppSettings(snapshot.appSettings),
    chimer_settings: sanitizeChimerPreferenceSnapshot(snapshot.chimerSettings, options),
    anatomime_settings: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.anatomimeSettings)),
    note_preferences: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.notePreferences)),
    calendar_preferences: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.calendarPreferences)),
  }
}

/**
 * Serializes Chimer preference writes and collapses not-yet-started work to the
 * newest complete snapshot. This prevents an older HTTP request from committing
 * after a newer Visual Apply while retaining completion identity for UI state.
 *
 * @param {{
 *   send: (request: { requestBody: string | null, requestId: number }) => Promise<boolean>,
 *   onComplete?: (
 *     request: { requestBody: string | null, requestId: number },
 *     succeeded: boolean,
 *   ) => void,
 * }} dependencies
 */
export function createSerializedChimerPreferenceWriter({
  send,
  onComplete = () => undefined,
}) {
  /** @type {{ requestBody: string | null, requestId: number } | null} */
  let activeRequest = null
  /** @type {{ requestBody: string | null, requestId: number } | null} */
  let queuedRequest = null
  /** @type {Array<() => void>} */
  let idleResolvers = []

  const resolveIdle = () => {
    if (activeRequest || queuedRequest) {
      return
    }
    const resolvers = idleResolvers
    idleResolvers = []
    for (const resolve of resolvers) {
      resolve()
    }
  }

  const drain = async () => {
    if (activeRequest) {
      return
    }

    while (queuedRequest) {
      const request = queuedRequest
      queuedRequest = null
      activeRequest = request
      let succeeded = false
      try {
        succeeded = await send(request)
      } catch {
        succeeded = false
      }
      onComplete(request, succeeded)
      activeRequest = null
    }

    resolveIdle()
  }

  return {
    /**
     * Supersedes only queued work. An in-flight request finishes before the
     * newest body starts, preserving server commit order.
     *
     * @param {{ requestBody: string | null, requestId: number }} request
     */
    enqueue(request) {
      if (!request.requestBody) {
        return
      }
      queuedRequest = request
      void drain()
    },
    whenIdle() {
      if (!activeRequest && !queuedRequest) {
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        idleResolvers.push(() => resolve(undefined))
      })
    },
  }
}

/**
 * Freezes one locally applied, fully sanitized Chimer payload as a request
 * body so a failed cloud write can retry byte-for-byte.
 *
 * @param {unknown} chimerSettings
 * @param {{
 *   backgroundPreferenceOptions?: Record<string, unknown>,
 *   requestId?: number,
 * }} [options]
 */
export function createChimerPreferenceSyncRequest(chimerSettings, options = {}) {
  const safeSettings = sanitizeChimerSettings(
    objectOrEmpty(removeForbiddenPreferenceFields(chimerSettings)),
    { backgroundPreferenceOptions: options.backgroundPreferenceOptions },
  )
  return {
    status: "pending",
    requestBody: JSON.stringify({ chimerSettings: safeSettings }),
    requestId: normalizePreferenceRequestId(options.requestId),
  }
}

/**
 * Starts a new attempt for the exact latest failed locally committed body.
 *
 * @param {{ requestBody?: unknown } | null | undefined} request
 * @param {number} requestId
 */
export function createChimerPreferenceSyncRetry(request, requestId) {
  const requestBody = typeof request?.requestBody === "string" ? request.requestBody : null
  return {
    status: requestBody ? "pending" : "local",
    requestBody,
    requestId: normalizePreferenceRequestId(requestId),
  }
}

/**
 * Applies a completion only when it belongs to the latest pending attempt.
 * Late results return the current state unchanged.
 *
 * @param {{ requestBody?: unknown, requestId?: unknown }} currentRequest
 * @param {{ requestBody?: unknown, requestId?: unknown }} completedRequest
 * @param {boolean} saveSucceeded
 */
export function resolveChimerPreferenceSyncRequest(currentRequest, completedRequest, saveSucceeded) {
  if (
    normalizePreferenceRequestId(currentRequest?.requestId)
      !== normalizePreferenceRequestId(completedRequest?.requestId)
    || currentRequest?.requestBody !== completedRequest?.requestBody
  ) {
    return currentRequest
  }
  if (saveSucceeded) {
    return {
      status: "synced",
      requestBody: null,
      requestId: normalizePreferenceRequestId(currentRequest.requestId),
    }
  }
  return {
    status: "stale",
    requestBody: typeof currentRequest?.requestBody === "string" ? currentRequest.requestBody : null,
    requestId: normalizePreferenceRequestId(currentRequest.requestId),
  }
}

/** @param {unknown} value */
function normalizePreferenceRequestId(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

/**
 * @param {unknown} therapistSettings
 */
export function buildTherapistProfilePayload(therapistSettings = {}) {
  const settings = objectOrEmpty(removeForbiddenPreferenceFields(therapistSettings))

  return {
    therapist_name: typeof settings.name === "string" ? settings.name : "",
    therapist_location: typeof settings.location === "string" ? settings.location : "",
    license_number: typeof settings.licenseNumber === "string" ? settings.licenseNumber : "",
    license_organization: typeof settings.licenseOrganization === "string" ? settings.licenseOrganization : "",
    npi_number: typeof settings.npiNumber === "string" ? settings.npiNumber : "",
  }
}

/**
 * @param {{
 *   cloudPreferences?: Record<string, unknown> | null
 *   localPreferences?: Record<string, unknown> | null
 * }} input
 */
export function choosePreferenceSource({ cloudPreferences, localPreferences }) {
  if (cloudPreferences && Object.keys(cloudPreferences).length > 0) {
    return {
      source: "cloud",
      preferences: cloudPreferences,
    }
  }

  return {
    source: "local",
    preferences: localPreferences ?? {},
  }
}
