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
 * @returns {Record<string, unknown>}
 */
function sanitizeChimerPreferenceSnapshot(value) {
  const settings = objectOrEmpty(removeForbiddenPreferenceFields(value))
  if (!("backgroundVisualPreferences" in settings)) {
    return settings
  }
  return {
    ...settings,
    backgroundVisualPreferences: normalizeChimerBackgroundVisualPreferences(
      settings.backgroundVisualPreferences,
    ),
  }
}

/**
 * @param {Partial<Record<keyof typeof LOCAL_PREFERENCE_KEYS, unknown>>} snapshot
 */
export function buildUserPreferencePayload(snapshot = {}) {
  return {
    version: USER_PREFERENCES_VERSION,
    app_settings: sanitizeAppSettings(snapshot.appSettings),
    chimer_settings: sanitizeChimerPreferenceSnapshot(snapshot.chimerSettings),
    anatomime_settings: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.anatomimeSettings)),
    note_preferences: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.notePreferences)),
    calendar_preferences: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.calendarPreferences)),
  }
}

/**
 * Freezes one locally applied, fully sanitized Chimer payload as a request
 * body so a failed cloud write can retry byte-for-byte.
 *
 * @param {unknown} chimerSettings
 */
export function createChimerPreferenceSyncRequest(chimerSettings) {
  const safeSettings = sanitizeChimerSettings(
    objectOrEmpty(removeForbiddenPreferenceFields(chimerSettings)),
  )
  return {
    status: "pending",
    requestBody: JSON.stringify({ chimerSettings: safeSettings }),
  }
}

/**
 * Retains the exact pending body on failure and clears it only after success.
 *
 * @param {{ requestBody?: unknown } | null | undefined} request
 * @param {boolean} saveSucceeded
 */
export function resolveChimerPreferenceSyncRequest(request, saveSucceeded) {
  if (saveSucceeded) {
    return { status: "synced", requestBody: null }
  }
  return {
    status: "stale",
    requestBody: typeof request?.requestBody === "string" ? request.requestBody : null,
  }
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
