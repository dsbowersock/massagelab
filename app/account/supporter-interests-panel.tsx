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
  const interestsRef = useRef<string[]>([])
  const persistedInterestsRef = useRef<string[]>([])
  const loadRequestRef = useRef(0)
  const saveRequestRef = useRef(0)
  const queuedInterestsRef = useRef<string[] | null>(null)
  const saveInFlightRef = useRef(false)

  /** Keeps state and the event-safe selection snapshot synchronized. */
  const replaceInterests = useCallback((nextInterests: string[]) => {
    interestsRef.current = nextInterests
    setInterests(nextInterests)
  }, [])

  /**
   * Gives each load an ID so only the latest mounted request may replace state
   * or clear the loading indicator.
   */
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

      const loadedInterests = normalizeSupporterRoadmapInterests(
        preferences.appSettings?.supporterRoadmapInterests,
      )
      persistedInterestsRef.current = loadedInterests
      replaceInterests(loadedInterests)
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
  }, [replaceInterests])

  useEffect(() => {
    void loadInterests()
    return () => {
      loadRequestRef.current += 1
      saveRequestRef.current += 1
    }
  }, [loadInterests])

  /**
   * Serializes preference writes. Rapid toggles replace the queued snapshot,
   * so a completed write may trigger at most one follow-up for the latest
   * optimistic selection instead of allowing concurrent PUTs to race.
   */
  async function flushQueuedInterests() {
    const requestId = saveRequestRef.current
    const isCurrentRequest = () => saveRequestRef.current === requestId

    try {
      while (queuedInterestsRef.current) {
        const submittedInterests = queuedInterestsRef.current
        queuedInterestsRef.current = null
        const previousInterests = persistedInterestsRef.current

        try {
          const response = await fetch("/api/account/preferences", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              appSettings: {
                supporterRoadmapInterests: submittedInterests,
              },
            }),
          })

          if (!response.ok) {
            throw new Error("Unable to save supporter roadmap interests")
          }

          const preferences = await response.json()
          if (!isCurrentRequest()) return

          const savedInterests = resolveSupporterRoadmapInterestsAfterSave({
            previousInterests,
            responseInterests: preferences?.appSettings?.supporterRoadmapInterests,
            // A successful write is authoritative even if a proxy omits the
            // saved array; the serialized final write owns the snapshot.
            submittedInterests,
            saveSucceeded: true,
          })
          persistedInterestsRef.current = savedInterests
          if (queuedInterestsRef.current) continue

          replaceInterests(savedInterests)
          setMessage({
            text: "Roadmap interests saved.",
            variant: "success",
          })
        } catch (error) {
          if (!isCurrentRequest()) return
          console.error("SupporterInterestsPanel failed to save roadmap interests", error)
          // A newer desired snapshot still has a chance to persist. Only the
          // final failed write rolls visible state back to confirmed storage.
          if (queuedInterestsRef.current) continue

          replaceInterests(resolveSupporterRoadmapInterestsAfterSave({
            previousInterests,
          }))
          setMessage({
            text: "Could not save roadmap interests. Please try again.",
            variant: "error",
          })
        }
      }
    } finally {
      saveInFlightRef.current = false
      if (!isCurrentRequest()) return
      if (queuedInterestsRef.current) {
        saveInFlightRef.current = true
        void flushQueuedInterests()
      } else {
        setIsSaving(false)
      }
    }
  }

  /** Queues the latest optimistic selection while preserving one in-flight write. */
  function saveInterests(nextInterests: string[]) {
    replaceInterests(nextInterests)
    queuedInterestsRef.current = nextInterests
    setIsSaving(true)
    setMessage(null)
    if (saveInFlightRef.current) return

    saveInFlightRef.current = true
    void flushQueuedInterests()
  }

  function toggleInterest(interestId: string, checked: boolean) {
    const currentInterests = interestsRef.current
    const nextInterests = checked
      ? normalizeSupporterRoadmapInterests([...currentInterests, interestId])
      : currentInterests.filter((interest) => interest !== interestId)

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
        <div
          className="grid gap-3 sm:grid-cols-2"
          aria-busy={isSaving}
        >
          {supporterRoadmapInterestOptions.map((option) => {
            const checked = interests.includes(option.id)

            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border/80 bg-background/80 p-3 text-sm font-medium shadow-sm transition hover:border-primary/60 hover:bg-accent"
              >
                <Checkbox
                  id={`supporter-roadmap-interest-${option.id}`}
                  checked={checked}
                  disabled={isLoading || !hasLoadedInterests}
                  onCheckedChange={(value) => toggleInterest(option.id, value === true)}
                />
                {option.label}
              </label>
            )
          })}
        </div>
        {isLoading ? <Loader label="Loading roadmap interests" size={18} color="currentColor" /> : null}
        <div className="flex flex-wrap items-center gap-3">
          <div aria-live="polite" aria-atomic="true">
            {message?.variant === "success" ? (
              <p className="text-sm text-muted-foreground">
                {message.text}
              </p>
            ) : null}
          </div>
          <div aria-live="assertive" aria-atomic="true">
            {message?.variant === "error" ? (
              <p className="text-sm text-destructive">
                {message.text}
              </p>
            ) : null}
          </div>
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
