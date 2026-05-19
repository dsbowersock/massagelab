"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { DateClickArg } from "@fullcalendar/interaction"
import type { EventDropArg } from "@fullcalendar/core"
import type { EventResizeDoneArg } from "@fullcalendar/interaction"
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Layers, ListFilter, UserRound } from "lucide-react"
import { rescheduleCalendarEventAction, saveCalendarPreferencesAction } from "@/app/calendar/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type WorkspaceProvider = {
  id: string
  label: string
}

type WorkspaceEvent = {
  id: string
  title: string
  start: string
  end: string
  backgroundColor?: string
  borderColor?: string
  editable?: boolean
  durationEditable?: boolean
  extendedProps: {
    kind?: string
    status?: string
    statusBadge?: string | null
    providerLabel?: string | null
    clientLabel?: string | null
    ownerUserId?: string | null
  }
}

type CalendarPreferences = {
  defaultRange: string
  providerViewMode: string
  selectedProviderId: string | null
  showCancelledEvents: boolean
  showStatusBadges: boolean
  colorMode: string
  showStaffPhotos: boolean
  appointmentAttributes: Record<string, boolean>
}

const VIEW_NAMES: Record<string, string> = {
  day: "timeGridDay",
  week: "timeGridWeek",
  "five-day": "timeGridFiveDay",
  month: "dayGridMonth",
}

const RANGE_LABELS = [
  ["day", "Day"],
  ["week", "Week"],
  ["five-day", "5-day"],
  ["month", "Month"],
] as const

const PROVIDER_VIEW_LABELS = [
  ["only-me", "Only me"],
  ["combined", "Combined"],
  ["split", "Split"],
] as const

export function CalendarWorkspace({
  events,
  providers,
  preferences,
  currentUserId,
}: {
  events: WorkspaceEvent[]
  providers: WorkspaceProvider[]
  preferences: CalendarPreferences
  currentUserId: string
}) {
  const calendarRef = useRef<FullCalendar | null>(null)
  const splitRefs = useRef<Record<string, FullCalendar | null>>({})
  const [range, setRange] = useState(preferences.defaultRange)
  const [providerViewMode, setProviderViewMode] = useState(preferences.providerViewMode)
  const [selectedProviderId, setSelectedProviderId] = useState(preferences.selectedProviderId ?? currentUserId)
  const [showCancelledEvents, setShowCancelledEvents] = useState(preferences.showCancelledEvents)
  const [showStatusBadges, setShowStatusBadges] = useState(preferences.showStatusBadges)
  const [colorMode, setColorMode] = useState(preferences.colorMode)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0]
  const visibleProviders = providerViewMode === "split" ? providers : [selectedProvider].filter(Boolean)
  const viewName = VIEW_NAMES[range] ?? VIEW_NAMES.week

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!showCancelledEvents && event.extendedProps.status === "CANCELLED") return false
      if (providerViewMode === "combined" || providerViewMode === "split") return true
      return event.extendedProps.ownerUserId === selectedProvider?.id
    })
  }, [events, providerViewMode, selectedProvider?.id, showCancelledEvents])

  function persistPreferencePatch(patch: Partial<CalendarPreferences>) {
    startTransition(async () => {
      await saveCalendarPreferencesAction({
        defaultRange: range,
        providerViewMode,
        selectedProviderId,
        showCancelledEvents,
        showStatusBadges,
        colorMode,
        showStaffPhotos: preferences.showStaffPhotos,
        appointmentAttributes: preferences.appointmentAttributes,
        ...patch,
      })
    })
  }

  function setCalendarRange(nextRange: string) {
    setRange(nextRange)
    persistPreferencePatch({ defaultRange: nextRange })
    const nextView = VIEW_NAMES[nextRange] ?? VIEW_NAMES.week
    calendarRef.current?.getApi().changeView(nextView)
    Object.values(splitRefs.current).forEach((calendar) => calendar?.getApi().changeView(nextView))
  }

  function navigate(direction: "prev" | "next" | "today") {
    const calendars = [calendarRef.current, ...Object.values(splitRefs.current)].filter(Boolean)
    for (const calendar of calendars) {
      const api = calendar?.getApi()
      if (direction === "today") api?.today()
      if (direction === "prev") api?.prev()
      if (direction === "next") api?.next()
    }
  }

  function gotoDate(value: string) {
    if (!value) return
    const calendars = [calendarRef.current, ...Object.values(splitRefs.current)].filter(Boolean)
    for (const calendar of calendars) {
      calendar?.getApi().gotoDate(value)
    }
  }

  async function persistEventChange(eventId: string, startsAt: string | null, endsAt: string | null, revert: () => void) {
    if (!startsAt || !endsAt) {
      revert()
      return
    }

    setMessage("Saving schedule change...")
    try {
      await rescheduleCalendarEventAction({ eventId, startsAt, endsAt })
      setMessage("Schedule updated.")
    } catch (error) {
      revert()
      setMessage(error instanceof Error ? error.message : "Schedule change failed.")
    }
  }

  function handleDateClick(info: DateClickArg) {
    const startsAt = info.dateStr.slice(0, 16)
    window.location.href = `/calendar/new/appointment?startsAt=${encodeURIComponent(startsAt)}`
  }

  function renderCalendar(provider?: WorkspaceProvider) {
    const calendarEvents = providerViewMode === "split" && provider
      ? filteredEvents.filter((event) => event.extendedProps.ownerUserId === provider.id)
      : filteredEvents

    return (
      <div key={provider?.id ?? "combined"} className="min-w-0">
        {providerViewMode === "split" && provider ? (
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <UserRound className="h-4 w-4 text-brand-orange" />
            {provider.label}
          </div>
        ) : null}
        <FullCalendar
          ref={(instance) => {
            if (providerViewMode === "split" && provider) {
              splitRefs.current[provider.id] = instance
            } else {
              calendarRef.current = instance
            }
          }}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={viewName}
          views={{
            timeGridFiveDay: {
              type: "timeGrid",
              duration: { days: 5 },
              buttonText: "5-day",
            },
          }}
          headerToolbar={false}
          height="auto"
          allDaySlot
          nowIndicator
          editable
          eventStartEditable
          eventDurationEditable
          selectable
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:15:00"
          events={calendarEvents}
          dateClick={handleDateClick}
          eventDrop={(info: EventDropArg) => {
            void persistEventChange(info.event.id, info.event.start?.toISOString() ?? null, info.event.end?.toISOString() ?? null, info.revert)
          }}
          eventResize={(info: EventResizeDoneArg) => {
            void persistEventChange(info.event.id, info.event.start?.toISOString() ?? null, info.event.end?.toISOString() ?? null, info.revert)
          }}
          eventContent={(arg) => (
            <div className="min-w-0 px-1 py-0.5 text-[11px] leading-tight">
              <div className="truncate font-semibold">{arg.event.title}</div>
              {showStatusBadges && arg.event.extendedProps.statusBadge ? (
                <div className="truncate opacity-90">{arg.event.extendedProps.statusBadge}</div>
              ) : null}
              {arg.event.extendedProps.clientLabel ? (
                <div className="truncate opacity-80">{arg.event.extendedProps.clientLabel}</div>
              ) : null}
            </div>
          )}
        />
      </div>
    )
  }

  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-orange" />
              Calendar workspace
            </CardTitle>
            <CardDescription>Drag or resize appointments, classes, and personal blocks. Conflicts are checked before changes are saved.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => navigate("prev")} aria-label="Previous range">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("today")}>Today</Button>
            <Button type="button" variant="outline" size="icon" onClick={() => navigate("next")} aria-label="Next range">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Range</Label>
            <Select value={range} onValueChange={setCalendarRange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGE_LABELS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>View</Label>
            <Select
              value={providerViewMode}
              onValueChange={(value) => {
                setProviderViewMode(value)
                persistPreferencePatch({ providerViewMode: value })
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDER_VIEW_LABELS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={selectedProvider?.id ?? ""}
              onValueChange={(value) => {
                setSelectedProviderId(value)
                persistPreferencePatch({ selectedProviderId: value })
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>{provider.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jumpDate">Date</Label>
            <Input id="jumpDate" type="date" onChange={(event) => gotoDate(event.currentTarget.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={showCancelledEvents}
              onCheckedChange={(checked) => {
                setShowCancelledEvents(checked)
                persistPreferencePatch({ showCancelledEvents: checked })
              }}
            />
            <ListFilter className="h-4 w-4" />
            Cancelled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={showStatusBadges}
              onCheckedChange={(checked) => {
                setShowStatusBadges(checked)
                persistPreferencePatch({ showStatusBadges: checked })
              }}
            />
            Badges
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={colorMode === "service"}
              onCheckedChange={(checked) => {
                const nextMode = checked ? "service" : "status"
                setColorMode(nextMode)
                persistPreferencePatch({ colorMode: nextMode })
              }}
            />
            {providerViewMode === "split" ? <Columns3 className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            Service color
          </label>
        </div>
        {message || isPending ? <p className="text-sm text-muted-foreground">{isPending ? "Saving preferences..." : message}</p> : null}
      </CardHeader>
      <CardContent>
        <div className={providerViewMode === "split" ? "grid gap-4 xl:grid-cols-2" : ""}>
          {providerViewMode === "split"
            ? visibleProviders.map((provider) => renderCalendar(provider))
            : renderCalendar()}
        </div>
      </CardContent>
    </Card>
  )
}
