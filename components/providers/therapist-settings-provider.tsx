"use client"

import { fetchWithTimeout } from "@/lib/client-fetch"
import { createContext, useContext, useEffect, useState } from "react"

interface TherapistSettings {
  name: string
  location: string
  licenseNumber: string
  licenseOrganization: string
  npiNumber: string
}

interface TherapistSettingsContextType {
  settings: TherapistSettings
  updateSettings: (newSettings: Partial<TherapistSettings>) => void
}

const defaultSettings: TherapistSettings = {
  name: "",
  location: "",
  licenseNumber: "",
  licenseOrganization: "",
  npiNumber: ""
}

const TherapistSettingsContext = createContext<TherapistSettingsContextType | undefined>(undefined)

export function TherapistSettingsProvider({
  children,
  syncEnabled = false,
}: {
  children: React.ReactNode
  syncEnabled?: boolean
}) {
  const [settings, setSettings] = useState<TherapistSettings>(defaultSettings)
  const [canSync, setCanSync] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadLocalSettings = () => {
      let nextSettings = defaultSettings
      const savedSettings = localStorage.getItem("massage-lab-therapist-settings")

      if (savedSettings) {
        try {
          nextSettings = { ...defaultSettings, ...JSON.parse(savedSettings) }
        } catch {
          localStorage.removeItem("massage-lab-therapist-settings")
        }
      }

      localStorage.setItem("massage-lab-therapist-settings", JSON.stringify(nextSettings))
      setSettings(nextSettings)
    }

    async function syncCloudSettings() {
      try {
        const response = await fetchWithTimeout("/api/account/profile")

        if (!isMounted) {
          return
        }

        if (!response.ok) {
          setCanSync(false)
          return
        }

        const profile = await response.json()

        if (!isMounted) {
          return
        }

        setCanSync(true)

        if (profile) {
          const nextSettings = {
            name: profile.therapistName ?? "",
            location: profile.therapistLocation ?? "",
            licenseNumber: profile.licenseNumber ?? "",
            licenseOrganization: profile.licenseOrganization ?? "",
            npiNumber: profile.npiNumber ?? "",
          }
          localStorage.setItem("massage-lab-therapist-settings", JSON.stringify(nextSettings))
          setSettings(nextSettings)
        }
      } catch {
        if (!isMounted) {
          return
        }
        setCanSync(false)
      }
    }

    loadLocalSettings()
    if (syncEnabled) {
      void syncCloudSettings()
    } else {
      setCanSync(false)
    }

    return () => {
      isMounted = false
    }
  }, [syncEnabled])

  const updateSettings = (newSettings: Partial<TherapistSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem("massage-lab-therapist-settings", JSON.stringify(updated))

      if (canSync) {
        void fetchWithTimeout("/api/account/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ therapistSettings: updated }),
        }).catch(() => undefined)
      }

      return updated
    })
  }

  return (
    <TherapistSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </TherapistSettingsContext.Provider>
  )
}

export function useTherapistSettings() {
  const context = useContext(TherapistSettingsContext)
  if (context === undefined) {
    throw new Error("useTherapistSettings must be used within a TherapistSettingsProvider")
  }
  return context
}

