"use client"

import { useCallback, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMusic } from "./music-provider"

const NOTICE_DURATION_MS = 30_000

type MusicInterruptionNoticeProps = {
  placement: "top" | "bottom"
}

/**
 * Presents the per-session interruption choice for 30 seconds of active
 * reading time. Hover and focus share one remaining-time deadline so moving
 * between controls cannot accidentally reset or consume the notice timeout.
 */
export function MusicInterruptionNotice({ placement }: MusicInterruptionNoticeProps) {
  const music = useMusic()
  const sessionId = music.interruptionNoticeSessionId
  const dismissInterruptionNotice = music.dismissInterruptionNotice
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deadlineRef = useRef(0)
  const remainingRef = useRef(NOTICE_DURATION_MS)
  const hoveredRef = useRef(false)
  const focusedWithinRef = useRef(false)

  const clearDismissTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    if (sessionId === null) return
    clearDismissTimer()
    dismissInterruptionNotice(sessionId)
  }, [clearDismissTimer, dismissInterruptionNotice, sessionId])

  const scheduleDismiss = useCallback((remainingMs: number) => {
    clearDismissTimer()
    if (remainingMs <= 0) {
      dismiss()
      return
    }
    deadlineRef.current = Date.now() + remainingMs
    timerRef.current = setTimeout(dismiss, remainingMs)
  }, [clearDismissTimer, dismiss])

  const pauseTimer = useCallback(() => {
    if (timerRef.current === null) return
    remainingRef.current = Math.max(0, deadlineRef.current - Date.now())
    clearDismissTimer()
  }, [clearDismissTimer])

  const resumeTimerIfIdle = useCallback(() => {
    if (hoveredRef.current || focusedWithinRef.current) return
    scheduleDismiss(remainingRef.current)
  }, [scheduleDismiss])

  useEffect(() => {
    clearDismissTimer()
    if (sessionId === null) return
    hoveredRef.current = false
    focusedWithinRef.current = false
    remainingRef.current = NOTICE_DURATION_MS
    scheduleDismiss(NOTICE_DURATION_MS)
    return clearDismissTimer
  }, [clearDismissTimer, scheduleDismiss, sessionId])

  if (sessionId === null || !music.mediaIntegrationAvailable) {
    return null
  }

  return (
    <section
      className="ml-music-interruption-notice pointer-events-auto rounded-lg border border-border bg-card p-3 shadow-xl shadow-black/35"
      data-placement={placement}
      data-testid="music-interruption-notice"
      role="region"
      aria-label="Interruption preference"
      aria-live="polite"
      onMouseEnter={() => {
        hoveredRef.current = true
        pauseTimer()
      }}
      onMouseLeave={() => {
        hoveredRef.current = false
        resumeTimerIfIdle()
      }}
      onFocusCapture={() => {
        focusedWithinRef.current = true
        pauseTimer()
      }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        focusedWithinRef.current = false
        resumeTimerIfIdle()
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            Calls and other audio may temporarily pause or mute this station.
          </p>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--button-success-face))]"
              checked={music.resumeAfterInterruptionForSession}
              onChange={(event) => music.setSessionResumeAfterInterruption(event.currentTarget.checked)}
            />
            <span>Resume automatically when the interruption ends</span>
          </label>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label="Close"
          onClick={dismiss}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
