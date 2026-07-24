"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HeartHandshake } from "lucide-react"
import {
  normalizeSupporterRoadmapInterests,
  supporterRoadmapInterestOptions,
} from "@/lib/onboarding-preferences"
import { resolveSupporterRoadmapInterestsAfterSave } from "@/lib/account-preferences"
import { SettingsSurface } from "@/components/account/settings-surfaces"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader } from "@/components/ui/loader"

type PanelMessage = {
  text: string
  variant: "success" | "error"
}

/**
 * Collects optional, broad roadmap categories separately from membership
 * amount and features. The account-preferences API sanitizes this narrow
 * appSettings patch before merging it with the user's other preferences.
 */
export function SupporterInterestsPanel() {
  const [interests, setInterests] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedInterests, setHasLoadedInterests] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<PanelMessage | null>(null)
  const loadRequestRef = useRef(0)
  const saveRequestRef = useRef(0)

  const loadInterests = useCallback(async () => {
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    const isCurrentRequest = () => loadRequestRef.current === requestId

    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/account/preferences")
      if (!response.ok) {
        throw new Error("Unable to load supporter roadmap interests")
      }
      if (!isCurrentRequest()) {
        return
      }

      const preferences = await response.json()
      if (!isCurrentRequest()) {
        return
      }

      setInterests(normalizeSupporterRoadmapInterests(
        preferences.appSettings?.supporterRoadmapInterests,
      ))
      setHasLoadedInterests(true)
    } catch (error) {
      if (!isCurrentRequest()) {
        return
      }
      console.error("SupporterInterestsPanel failed to load roadmap interests", error)
      setMessage({
        text: "Could not load roadmap interests. Please try again.",
        variant: "error",
      })
    } finally {
      if (isCurrentRequest()) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadInterests()
    return () => {
      loadRequestRef.current += 1
      saveRequestRef.current += 1
    }
  }, [loadInterests])

  async function saveInterests(nextInterests: string[]) {
    const requestId = saveRequestRef.current + 1
    saveRequestRef.current = requestId
    const isCurrentRequest = () => saveRequestRef.current === requestId
    const previousInterests = interests
    setInterests(nextInterests)
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appSettings: {
            supporterRoadmapInterests: nextInterests,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Unable to save supporter roadmap interests")
      }

      const preferences = await response.json()
      if (!isCurrentRequest()) {
        return
      }
      setInterests(resolveSupporterRoadmapInterestsAfterSave({
        previousInterests,
        responseInterests: preferences.appSettings?.supporterRoadmapInterests,
        saveSucceeded: true,
      }))
      setMessage({
        text: "Roadmap interests saved.",
        variant: "success",
      })
    } catch (error) {
      if (!isCurrentRequest()) {
        return
      }
      console.error("SupporterInterestsPanel failed to save roadmap interests", error)
      setInterests(resolveSupporterRoadmapInterestsAfterSave({
        previousInterests,
      }))
      setMessage({
        text: "Could not save roadmap interests. Please try again.",
        variant: "error",
      })
    } finally {
      if (isCurrentRequest()) {
        setIsSaving(false)
      }
    }
  }

  function toggleInterest(interestId: string, checked: boolean) {
    const nextInterests = checked
      ? normalizeSupporterRoadmapInterests([...interests, interestId])
      : interests.filter((interest) => interest !== interestId)

    void saveInterests(nextInterests)
  }

  return (
    <SettingsSurface
      id="supporter-roadmap-interests"
      title="Roadmap interests"
      description="Choose the broad areas you would most like MassageLab to prioritize. This does not change your membership amount, benefits, or billing."
      icon={<HeartHandshake data-icon="inline-start" aria-hidden="true" />}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Select categories only. Do not include personal, client, or clinical details.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {supporterRoadmapInterestOptions.map((option) => {
            const checked = interests.includes(option.id)

            return (
              <label
                key={option.id}
                htmlFor={`supporter-roadmap-interest-${option.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border/80 bg-background/80 p-3 text-sm font-medium shadow-sm transition hover:border-primary/60 hover:bg-accent"
              >
                <Checkbox
                  id={`supporter-roadmap-interest-${option.id}`}
                  checked={checked}
                  disabled={isLoading || !hasLoadedInterests || isSaving}
                  onCheckedChange={(value) => toggleInterest(option.id, value === true)}
                />
                {option.label}
              </label>
            )
          })}
        </div>
        {isLoading ? <Loader label="Loading roadmap interests" size={18} color="currentColor" /> : null}
        <div
          className="flex flex-wrap items-center gap-3"
          role="status"
          aria-live={message?.variant === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {message ? (
            <p
              className="text-sm text-muted-foreground"
            >
              {message.text}
            </p>
          ) : null}
          {message?.variant === "error" && !hasLoadedInterests ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadInterests()}
            >
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </SettingsSurface>
  )
}
