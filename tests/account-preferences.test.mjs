import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  USER_PREFERENCES_VERSION,
  buildTherapistProfilePayload,
  buildUserPreferencePayload,
  choosePreferenceSource,
  removeForbiddenPreferenceFields,
} from "../lib/account-preferences.js"

describe("Account preference helpers", () => {
  it("builds a versioned sync payload from safe local settings", () => {
    const payload = buildUserPreferencePayload({
      appSettings: { sidebarPosition: "right" },
      chimerSettings: { movingBackgroundEnabled: false },
      anatomimeSettings: { roundLimit: 8 },
      notePreferences: { defaultNoteType: "soap" },
    })

    assert.equal(payload.version, USER_PREFERENCES_VERSION)
    assert.deepEqual(payload.app_settings, { sidebarPosition: "right" })
    assert.deepEqual(payload.chimer_settings, { movingBackgroundEnabled: false })
    assert.deepEqual(payload.anatomime_settings, { roundLimit: 8 })
    assert.deepEqual(payload.note_preferences, { defaultNoteType: "soap" })
  })

  it("removes known PHI fields before account sync", () => {
    const payload = buildUserPreferencePayload({
      notePreferences: {
        defaultNoteType: "soap",
        soapDraft: "client symptoms",
        nested: {
          clientName: "Jane Example",
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

  it("uses cloud preferences after login when they exist", () => {
    const result = choosePreferenceSource({
      cloudPreferences: { app_settings: { sidebarPosition: "left" } },
      localPreferences: { app_settings: { sidebarPosition: "right" } },
    })

    assert.equal(result.source, "cloud")
    assert.deepEqual(result.preferences, { app_settings: { sidebarPosition: "left" } })
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
})
