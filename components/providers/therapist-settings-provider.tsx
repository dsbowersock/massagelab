"use client"

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

export function TherapistSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TherapistSettings>(defaultSettings)

  useEffect(() => {
    const savedSettings = localStorage.getItem("massage-lab-therapist-settings")
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }, [])

  const updateSettings = (newSettings: Partial<TherapistSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem("massage-lab-therapist-settings", JSON.stringify(updated))
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

