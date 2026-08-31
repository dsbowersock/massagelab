"use client"

import { useCallback, useEffect, useState } from "react"
import { Cloud } from "lucide-react"
import {
  LOCAL_PREFERENCE_KEYS,
  buildUserPreferencePayload,
} from "@/lib/account-preferences"
import { backgroundPreferenceNormalizationOptions } from "@/components/backgrounds/backgroundPaletteRegistry"
import { useAccountShellBootstrap } from "@/components/providers/account-shell-bootstrap-provider"
import {
  projectStoredTherapistSettings,
  therapistSettingsStorageKey,
} from "@/components/providers/therapist-settings-provider"
import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"

type PreferenceSyncProps = {
  hasCloudPreferences: boolean
}

function readJsonPreference(key: string) {
  const rawValue = window.localStorage.getItem(key)

  if (!rawValue) {
    return {}
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    return {}
  }
}

/** Accepts only the provider's complete stored shape and drops every extra field. */
function readOptionalTherapistSettings(key: string) {
  const rawValue = window.localStorage.getItem(key)

  if (!rawValue) {
    return null
  }

  try {
    return projectStoredTherapistSettings(JSON.parse(rawValue))
  } catch {
    return null
  }
}

export function PreferenceSync({ hasCloudPreferences }: PreferenceSyncProps) {
  const { ownerKey } = useAccountShellBootstrap()
  const [status, setStatus] = useState("")
  const [isSyncing, setIsSyncing] = useState(false)
  const [didAutoSync, setDidAutoSync] = useState(false)

  const syncLocalPreferences = useCallback(async () => {
    setIsSyncing(true)
    setStatus("")

    try {
      const payload = buildUserPreferencePayload({
        appSettings: readJsonPreference(LOCAL_PREFERENCE_KEYS.appSettings),
        chimerSettings: readJsonPreference(LOCAL_PREFERENCE_KEYS.chimerSettings),
        anatomimeSettings: readJsonPreference(LOCAL_PREFERENCE_KEYS.anatomimeSettings),
        notePreferences: readJsonPreference(LOCAL_PREFERENCE_KEYS.notePreferences),
        calendarPreferences: readJsonPreference(LOCAL_PREFERENCE_KEYS.calendarPreferences),
      }, {
        backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
      })

      const therapistSettings = ownerKey
        ? readOptionalTherapistSettings(therapistSettingsStorageKey(ownerKey))
        : null
      const preferencesRequest = fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appSettings: payload.app_settings,
          chimerSettings: payload.chimer_settings,
          anatomimeSettings: payload.anatomime_settings,
          notePreferences: payload.note_preferences,
          calendarPreferences: payload.calendar_preferences,
        }),
      })
      const profileRequest = therapistSettings !== null
        ? fetch("/api/account/profile", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              therapistSettings,
            }),
          })
        : Promise.resolve(null)
      const [preferencesResponse, profileResponse] = await Promise.all([
        preferencesRequest,
        profileRequest,
      ])

      setStatus(
        preferencesResponse.ok && (profileResponse === null || profileResponse.ok)
          ? "Local preferences synced to your account."
          : "Preference sync failed. Sign in again and retry.",
      )
    } catch {
      setStatus("Preference sync failed. Sign in again and retry.")
    } finally {
      setIsSyncing(false)
    }
  }, [ownerKey])

  useEffect(() => {
    if (hasCloudPreferences || didAutoSync) {
      return
    }

    setDidAutoSync(true)
    void syncLocalPreferences()
  }, [didAutoSync, hasCloudPreferences, syncLocalPreferences])

  return (
    <div className="space-y-3 rounded-md border border-neutral-800 bg-background/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Preference sync</h3>
          <p className="text-sm text-muted-foreground">
            Account sync includes app settings, Chimer settings, Anatomime settings, calendar display settings, and note personalization defaults.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={syncLocalPreferences} disabled={isSyncing}>
          {isSyncing ? (
            <Loader aria-hidden="true" label="Syncing preferences" size={18} color="currentColor" />
          ) : (
            <Cloud aria-hidden="true" />
          )}
          Sync local preferences
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        SOAP notes, intake contents, journals, ROM measurements, client names, dates of birth, and treatment details are not read from local storage or sent to your account.
      </p>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  )
}
