"use client"

import { useEffect, useState } from "react"
import { canSyncAccountPreferencesFromSession } from "@/lib/account-preferences"
import { fetchWithTimeout } from "@/lib/client-fetch"

export function useAccountFeatureKeys() {
  const [featureKeys, setFeatureKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadFeatureKeys() {
      try {
        const sessionResponse = await fetchWithTimeout("/api/auth/session")
        const session = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null

        if (!isMounted) {
          return
        }

        if (!canSyncAccountPreferencesFromSession(session)) {
          setFeatureKeys([])
          setIsLoading(false)
          return
        }

        const response = await fetchWithTimeout("/api/account/preferences")
        const preferences = response.ok ? await response.json().catch(() => null) : null

        if (!isMounted) {
          return
        }

        setFeatureKeys(
          Array.isArray(preferences?.features)
            ? preferences.features.filter((feature: unknown) => typeof feature === "string")
            : [],
        )
      } catch {
        if (isMounted) {
          setFeatureKeys([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadFeatureKeys()

    return () => {
      isMounted = false
    }
  }, [])

  return { featureKeys, isLoading }
}
