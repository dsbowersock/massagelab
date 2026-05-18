// @ts-check

export const USER_PREFERENCES_VERSION = 1

export const LOCAL_PREFERENCE_KEYS = Object.freeze({
  appSettings: "massage-lab-settings",
  therapistSettings: "massage-lab-therapist-settings",
  chimerSettings: "massagelab-chimer-settings",
  anatomimeSettings: "massagelab-anatomime-settings",
  notePreferences: "massagelab-note-preferences",
})

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
 * @param {Partial<Record<keyof typeof LOCAL_PREFERENCE_KEYS, unknown>>} snapshot
 */
export function buildUserPreferencePayload(snapshot = {}) {
  return {
    version: USER_PREFERENCES_VERSION,
    app_settings: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.appSettings)),
    chimer_settings: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.chimerSettings)),
    anatomime_settings: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.anatomimeSettings)),
    note_preferences: objectOrEmpty(removeForbiddenPreferenceFields(snapshot.notePreferences)),
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
