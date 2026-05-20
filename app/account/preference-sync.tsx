"use client"

import { useCallback, useEffect, useState } from "react"
import { Cloud, RefreshCcw } from "lucide-react"
import {
  LOCAL_PREFERENCE_KEYS,
  buildUserPreferencePayload,
} from "@/lib/account-preferences"
import { Button } from "@/components/ui/button"

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

export function PreferenceSync({ hasCloudPreferences }: PreferenceSyncProps) {
  const [status, setStatus] = useState("")
  const [isSyncing, setIsSyncing] = useState(false)
  const [didAutoSync, setDidAutoSync] = useState(false)

  const syncLocalPreferences = useCallback(async () => {
    setIsSyncing(true)
    setStatus("")

    const payload = buildUserPreferencePayload({
      appSettings: readJsonPreference(LOCAL_PREFERENCE_KEYS.appSettings),
      chimerSettings: readJsonPreference(LOCAL_PREFERENCE_KEYS.chimerSettings),
      anatomimeSettings: readJsonPreference(LOCAL_PREFERENCE_KEYS.anatomimeSettings),
      notePreferences: readJsonPreference(LOCAL_PREFERENCE_KEYS.notePreferences),
      calendarPreferences: readJsonPreference(LOCAL_PREFERENCE_KEYS.calendarPreferences),
    })

    const [preferencesResponse, profileResponse] = await Promise.all([
      fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appSettings: payload.app_settings,
          chimerSettings: payload.chimer_settings,
          anatomimeSettings: payload.anatomime_settings,
          notePreferences: payload.note_preferences,
          calendarPreferences: payload.calendar_preferences,
        }),
      }),
      fetch("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          therapistSettings: readJsonPreference(LOCAL_PREFERENCE_KEYS.therapistSettings),
        }),
      }),
    ])

    setIsSyncing(false)
    setStatus(
      preferencesResponse.ok && profileResponse.ok
        ? "Local preferences synced to your account."
        : "Preference sync failed. Sign in again and retry.",
    )
  }, [])

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
          {isSyncing ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
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
