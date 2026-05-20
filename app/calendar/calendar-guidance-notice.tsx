"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { ShieldCheck, X } from "lucide-react"
import { saveCalendarPreferencesAction } from "@/app/calendar/actions"
import {
  CALENDAR_NOTICE_AUTO_HIDE_VIEWS,
  shouldShowCalendarNotice,
} from "@/lib/calendar-preferences"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type NoticeState = {
  dismissed: boolean
  views: number
}

type CalendarPreferences = {
  defaultRange: string
  providerViewMode: string
  selectedProviderId: string | null
  showCancelledEvents: boolean
  showStatusBadges: boolean
  colorMode: string
  showStaffPhotos: boolean
  calendarDayStartMinute: number | null
  calendarDayEndMinute: number | null
  calendarSlotDensity: string
  appointmentAttributes: {
    confirmed: boolean
    unconfirmed: boolean
    customerBefore: boolean
    customerAfter: boolean
    newClient: boolean
  }
  noticeDismissals: Record<string, NoticeState>
}

function storageKey(noticeKey: string) {
  return `massagelab-calendar-notice:${noticeKey}`
}

function readLocalNotice(noticeKey: string): NoticeState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(noticeKey))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<NoticeState>
    return {
      dismissed: value.dismissed === true,
      views: Number.isFinite(value.views) && Number(value.views) > 0 ? Math.trunc(Number(value.views)) : 0,
    }
  } catch {
    return null
  }
}

function writeLocalNotice(noticeKey: string, value: NoticeState) {
  try {
    window.localStorage.setItem(storageKey(noticeKey), JSON.stringify(value))
  } catch {
    // Local persistence is best effort; signed-in users still get cloud preference sync.
  }
}

function mergeNoticeState(serverState: NoticeState | undefined, localState: NoticeState | null): NoticeState {
  return {
    dismissed: Boolean(serverState?.dismissed || localState?.dismissed),
    views: Math.max(serverState?.views ?? 0, localState?.views ?? 0),
  }
}

export function CalendarGuidanceNotice({
  noticeKey,
  title,
  description,
  preferences,
}: {
  noticeKey: string
  title: string
  description: string
  preferences: CalendarPreferences
}) {
  const [state, setState] = useState<NoticeState>(() => preferences.noticeDismissals[noticeKey] ?? { dismissed: false, views: 0 })
  const [isPending, startTransition] = useTransition()
  const visible = useMemo(() => (
    shouldShowCalendarNotice({
      ...preferences,
      noticeDismissals: { ...preferences.noticeDismissals, [noticeKey]: state },
    }, noticeKey)
  ), [noticeKey, preferences, state])

  function persist(nextState: NoticeState) {
    writeLocalNotice(noticeKey, nextState)
    startTransition(async () => {
      await saveCalendarPreferencesAction({
        noticeDismissals: {
          [noticeKey]: nextState,
        },
      })
    })
  }

  useEffect(() => {
    const merged = mergeNoticeState(preferences.noticeDismissals[noticeKey], readLocalNotice(noticeKey))
    const nextState = {
      dismissed: merged.dismissed,
      views: Math.min(merged.views + 1, CALENDAR_NOTICE_AUTO_HIDE_VIEWS),
    }
    setState(nextState)
    persist(nextState)
    // Run once per notice mount; preference updates are persisted asynchronously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeKey])

  if (!visible) return null

  return (
    <Alert className="border-border/80 bg-card/85 text-sm shadow-sm backdrop-blur">
      <ShieldCheck />
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="text-muted-foreground">{description}</AlertDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => {
            const nextState = { dismissed: true, views: Math.max(state.views, 1) }
            setState(nextState)
            persist(nextState)
          }}
          disabled={isPending}
          aria-label="Dismiss notice"
        >
          <X data-icon="inline-start" />
        </Button>
      </div>
    </Alert>
  )
}
