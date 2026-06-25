"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ComponentType, type CSSProperties } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { DateClickArg } from "@fullcalendar/interaction"
import type { EventDropArg } from "@fullcalendar/core"
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Layers,
  ListFilter,
  Settings2,
  SlidersHorizontal,
  UserRound,
} from "lucide-react"
import { rescheduleCalendarEventAction, saveCalendarPreferencesAction } from "@/app/calendar/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  deriveCalendarVisibleBounds,
  minuteToCalendarTime,
  minuteToTimeInput,
  scrollMinuteForCalendarBounds,
  slotHeightForDensity,
  timeInputToMinute,
} from "@/lib/calendar-display"
import { cn } from "@/lib/utils"

type WorkspaceProvider = {
  id: string
  label: string
}

type ProviderAvailabilityInterval = {
  providerId: string
  startMinute: number
  endMinute: number
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
  calendarDayStartMinute: number | null
  calendarDayEndMinute: number | null
  calendarSlotDensity: string
  appointmentAttributes: Record<string, boolean>
  noticeDismissals: Record<string, { dismissed: boolean; views: number }>
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

function renderDayHeader(date: Date) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date)
  const monthDay = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(date)

  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <span className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{weekday}</span>
      <span className="text-sm font-semibold text-foreground">{monthDay}</span>
    </div>
  )
}

export function CalendarWorkspace({
  events,
  providers,
  providerAvailability,
  preferences,
  currentUserId,
  initialDate,
}: {
  events: WorkspaceEvent[]
  providers: WorkspaceProvider[]
  providerAvailability: ProviderAvailabilityInterval[]
  preferences: CalendarPreferences
  currentUserId: string
  initialDate?: string
}) {
  const calendarRef = useRef<FullCalendar | null>(null)
  const splitRefs = useRef<Record<string, FullCalendar | null>>({})
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [viewTitle, setViewTitle] = useState("")
  const [range, setRange] = useState(preferences.defaultRange)
  const [providerViewMode, setProviderViewMode] = useState(preferences.providerViewMode)
  const [selectedProviderId, setSelectedProviderId] = useState(preferences.selectedProviderId ?? currentUserId)
  const [showCancelledEvents, setShowCancelledEvents] = useState(preferences.showCancelledEvents)
  const [showStatusBadges, setShowStatusBadges] = useState(preferences.showStatusBadges)
  const [colorMode, setColorMode] = useState(preferences.colorMode)
  const [calendarDayStartMinute, setCalendarDayStartMinute] = useState(preferences.calendarDayStartMinute)
  const [calendarDayEndMinute, setCalendarDayEndMinute] = useState(preferences.calendarDayEndMinute)
  const [calendarSlotDensity, setCalendarSlotDensity] = useState(preferences.calendarSlotDensity)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  const hasMultipleProviders = providers.length > 1
  const effectiveProviderViewMode = hasMultipleProviders ? providerViewMode : "only-me"
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0]
  const visibleProviders = effectiveProviderViewMode === "split" ? providers : [selectedProvider].filter(Boolean)
  const viewName = VIEW_NAMES[range] ?? VIEW_NAMES.week
  const visibleProviderIds = useMemo(() => (
    effectiveProviderViewMode === "combined" || effectiveProviderViewMode === "split"
      ? providers.map((provider) => provider.id)
      : [selectedProvider?.id].filter(Boolean)
  ), [effectiveProviderViewMode, providers, selectedProvider?.id])
  const visibleBounds = useMemo(() => deriveCalendarVisibleBounds({
    preferences: { calendarDayStartMinute, calendarDayEndMinute },
    providerAvailability,
    providerIds: visibleProviderIds,
  }), [calendarDayEndMinute, calendarDayStartMinute, providerAvailability, visibleProviderIds])
  const now = new Date()
  const scrollMinute = scrollMinuteForCalendarBounds({
    startMinute: visibleBounds.startMinute,
    endMinute: visibleBounds.endMinute,
    nowMinute: now.getHours() * 60 + now.getMinutes(),
  })
  const scrollTime = minuteToCalendarTime(scrollMinute)
  const slotHeight = slotHeightForDensity(calendarSlotDensity)
  const calendarSurfaceStyle = { "--ml-calendar-slot-height": slotHeight } as CSSProperties

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!showCancelledEvents && event.extendedProps.status === "CANCELLED") return false
      if (effectiveProviderViewMode === "combined" || effectiveProviderViewMode === "split") return true
      return event.extendedProps.ownerUserId === selectedProvider?.id
    })
  }, [effectiveProviderViewMode, events, selectedProvider?.id, showCancelledEvents])

  const calendarApis = useCallback(() => (
    [calendarRef.current, ...Object.values(splitRefs.current)]
      .map((calendar) => calendar?.getApi())
      .filter(Boolean)
  ), [])

  const updateCalendarLayout = useCallback(() => {
    window.requestAnimationFrame(() => {
      for (const api of calendarApis()) {
        api?.updateSize()
      }

      window.requestAnimationFrame(() => {
        for (const api of calendarApis()) {
          api?.scrollToTime(scrollTime)
        }
      })
    })
  }, [calendarApis, scrollTime])

  const scrollCalendarsToUsefulTime = useCallback(() => {
    updateCalendarLayout()
  }, [updateCalendarLayout])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateCalendarLayout)
      return () => window.removeEventListener("resize", updateCalendarLayout)
    }

    const resizeObserver = new ResizeObserver(updateCalendarLayout)
    resizeObserver.observe(surface)
    window.addEventListener("resize", updateCalendarLayout)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateCalendarLayout)
    }
  }, [updateCalendarLayout])

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      for (const api of calendarApis()) {
        api?.updateSize()
      }
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [calendarApis, effectiveProviderViewMode, range, visibleBounds.slotMaxTime, visibleBounds.slotMinTime])

  const persistPreferencePatch = useCallback((patch: Partial<CalendarPreferences>) => {
    startTransition(async () => {
      await saveCalendarPreferencesAction({
        defaultRange: range,
        providerViewMode: effectiveProviderViewMode,
        selectedProviderId,
        showCancelledEvents,
        showStatusBadges,
        colorMode,
        showStaffPhotos: preferences.showStaffPhotos,
        calendarDayStartMinute,
        calendarDayEndMinute,
        calendarSlotDensity,
        appointmentAttributes: preferences.appointmentAttributes,
        noticeDismissals: preferences.noticeDismissals,
        ...patch,
      })
    })
  }, [
    calendarDayEndMinute,
    calendarDayStartMinute,
    calendarSlotDensity,
    colorMode,
    effectiveProviderViewMode,
    preferences.appointmentAttributes,
    preferences.noticeDismissals,
    preferences.showStaffPhotos,
    range,
    selectedProviderId,
    showCancelledEvents,
    showStatusBadges,
  ])

  const setCalendarRange = useCallback((nextRange: string) => {
    setRange(nextRange)
    persistPreferencePatch({ defaultRange: nextRange })
    const nextView = VIEW_NAMES[nextRange] ?? VIEW_NAMES.week
    calendarApis().forEach((api) => api?.changeView(nextView))
    scrollCalendarsToUsefulTime()
  }, [calendarApis, persistPreferencePatch, scrollCalendarsToUsefulTime])

  const navigate = useCallback((direction: "prev" | "next" | "today") => {
    for (const api of calendarApis()) {
      if (direction === "today") api?.today()
      if (direction === "prev") api?.prev()
      if (direction === "next") api?.next()
      setSelectedDate(api?.getDate())
    }
    scrollCalendarsToUsefulTime()
  }, [calendarApis, scrollCalendarsToUsefulTime])

  const gotoDate = useCallback((value: string | Date | undefined) => {
    if (!value) return
    for (const api of calendarApis()) {
      api?.gotoDate(value)
      setSelectedDate(api?.getDate())
    }
    scrollCalendarsToUsefulTime()
  }, [calendarApis, scrollCalendarsToUsefulTime])

  useEffect(() => {
    if (!initialDate) return

    const animationFrame = window.requestAnimationFrame(() => gotoDate(initialDate))
    return () => window.cancelAnimationFrame(animationFrame)
  }, [gotoDate, initialDate])

  const updateProviderViewMode = useCallback((value: string) => {
    const nextMode = hasMultipleProviders ? value : "only-me"
    setProviderViewMode(nextMode)
    persistPreferencePatch({ providerViewMode: nextMode })
  }, [hasMultipleProviders, persistPreferencePatch])

  const updateSelectedProvider = useCallback((value: string) => {
    setSelectedProviderId(value)
    persistPreferencePatch({ selectedProviderId: value })
  }, [persistPreferencePatch])

  const updateShowCancelledEvents = useCallback((checked: boolean) => {
    setShowCancelledEvents(checked)
    persistPreferencePatch({ showCancelledEvents: checked })
  }, [persistPreferencePatch])

  const updateShowStatusBadges = useCallback((checked: boolean) => {
    setShowStatusBadges(checked)
    persistPreferencePatch({ showStatusBadges: checked })
  }, [persistPreferencePatch])

  const updateColorMode = useCallback((checked: boolean) => {
    const nextMode = checked ? "service" : "status"
    setColorMode(nextMode)
    persistPreferencePatch({ colorMode: nextMode })
  }, [persistPreferencePatch])

  const updateDayBounds = useCallback((startMinute: number | null, endMinute: number | null) => {
    setCalendarDayStartMinute(startMinute)
    setCalendarDayEndMinute(endMinute)
    persistPreferencePatch({ calendarDayStartMinute: startMinute, calendarDayEndMinute: endMinute })
  }, [persistPreferencePatch])

  const updateSlotDensity = useCallback((value: string) => {
    setCalendarSlotDensity(value)
    persistPreferencePatch({ calendarSlotDensity: value })
  }, [persistPreferencePatch])

  async function persistEventChange(eventId: string, startsAt: string | null, endsAt: string | null, revert: () => void) {
    if (!startsAt || !endsAt) {
      revert()
      return
    }

    setMessage("Saving schedule change...")
    try {
      await rescheduleCalendarEventAction({ eventId, startsAt, endsAt, allowOutsideAvailability: "false" })
      setMessage("Schedule updated.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Schedule change failed."
      if (message.includes("outside the provider's availability")) {
        const confirmed = window.confirm(`${message} Move this manual calendar item anyway?`)
        if (confirmed) {
          try {
            await rescheduleCalendarEventAction({ eventId, startsAt, endsAt, allowOutsideAvailability: "true" })
            setMessage("Schedule updated outside availability.")
            return
          } catch (retryError) {
            revert()
            setMessage(retryError instanceof Error ? retryError.message : "Schedule change failed.")
            return
          }
        }
      }
      revert()
      setMessage(message)
    }
  }

  function handleDateClick(info: DateClickArg) {
    const startsAt = info.dateStr.slice(0, 16)
    window.location.href = `/calendar/new?startsAt=${encodeURIComponent(startsAt)}`
  }

  function renderCalendar(provider?: WorkspaceProvider) {
    const calendarEvents = effectiveProviderViewMode === "split" && provider
      ? filteredEvents.filter((event) => event.extendedProps.ownerUserId === provider.id)
      : filteredEvents

    return (
      <div key={provider?.id ?? "combined"} className="min-h-0 h-full min-w-0">
        {effectiveProviderViewMode === "split" && provider ? (
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <UserRound data-icon="inline-start" className="text-brand-orange" />
            {provider.label}
          </div>
        ) : null}
        <FullCalendar
          ref={(instance) => {
            if (effectiveProviderViewMode === "split" && provider) {
              splitRefs.current[provider.id] = instance
            } else {
              calendarRef.current = instance
            }
          }}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={viewName}
          initialDate={initialDate}
          views={{
            timeGridFiveDay: {
              type: "timeGrid",
              duration: { days: 5 },
              buttonText: "5-day",
            },
          }}
          headerToolbar={false}
          height="100%"
          stickyHeaderDates
          expandRows={false}
          allDaySlot
          nowIndicator
          editable
          eventStartEditable
          eventDurationEditable={false}
          selectable
          slotMinTime={visibleBounds.slotMinTime}
          slotMaxTime={visibleBounds.slotMaxTime}
          slotDuration="00:15:00"
          scrollTime={scrollTime}
          scrollTimeReset={false}
          events={calendarEvents}
          dayHeaderContent={(arg) => renderDayHeader(arg.date)}
          datesSet={(arg) => {
            setViewTitle(arg.view.title)
            setSelectedDate(arg.view.calendar.getDate())
            scrollCalendarsToUsefulTime()
          }}
          dateClick={handleDateClick}
          eventDrop={(info: EventDropArg) => {
            void persistEventChange(info.event.id, info.event.start?.toISOString() ?? null, info.event.end?.toISOString() ?? null, info.revert)
          }}
          eventContent={(arg) => (
            <div className="flex min-w-0 flex-col gap-1 px-1 py-0.5 text-[11px] leading-tight">
              <div className="truncate font-semibold">{arg.event.title}</div>
              {showStatusBadges && arg.event.extendedProps.statusBadge ? (
                <Badge variant="secondary" className="w-fit max-w-full truncate px-1 py-0 text-[10px] leading-4">
                  {arg.event.extendedProps.statusBadge}
                </Badge>
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

  const toolbarControls = useMemo(() => (
    <CalendarToolbarControls
      range={range}
      viewTitle={viewTitle}
      selectedDate={selectedDate}
      providerViewMode={effectiveProviderViewMode}
      selectedProviderId={selectedProvider?.id ?? ""}
      providers={providers}
      showProviderControls={hasMultipleProviders}
      showCancelledEvents={showCancelledEvents}
      showStatusBadges={showStatusBadges}
      colorMode={colorMode}
      calendarDayStartMinute={calendarDayStartMinute}
      calendarDayEndMinute={calendarDayEndMinute}
      calendarSlotDensity={calendarSlotDensity}
      visibleBounds={visibleBounds}
      onNavigate={navigate}
      onGotoDate={gotoDate}
      onRangeChange={setCalendarRange}
      onProviderViewModeChange={updateProviderViewMode}
      onSelectedProviderChange={updateSelectedProvider}
      onShowCancelledEventsChange={updateShowCancelledEvents}
      onShowStatusBadgesChange={updateShowStatusBadges}
      onColorModeChange={updateColorMode}
      onDayBoundsChange={updateDayBounds}
      onSlotDensityChange={updateSlotDensity}
    />
  ), [
    calendarDayEndMinute,
    calendarDayStartMinute,
    calendarSlotDensity,
    colorMode,
    effectiveProviderViewMode,
    gotoDate,
    hasMultipleProviders,
    navigate,
    providers,
    range,
    selectedDate,
    selectedProvider?.id,
    setCalendarRange,
    showCancelledEvents,
    showStatusBadges,
    updateColorMode,
    updateDayBounds,
    updateProviderViewMode,
    updateSelectedProvider,
    updateShowCancelledEvents,
    updateShowStatusBadges,
    updateSlotDensity,
    viewTitle,
    visibleBounds,
  ])

  useEffect(() => {
    scrollCalendarsToUsefulTime()
  }, [scrollCalendarsToUsefulTime])

  return (
    <Card
      ref={surfaceRef}
      className="ml-calendar-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border/80 bg-card/95 shadow-none"
      style={calendarSurfaceStyle}
    >
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex shrink-0 items-center border-b border-border/70 bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
          {toolbarControls}
        </div>
        <p className={cn("border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground", !(message || isPending) && "sr-only")}>
          {isPending ? "Saving preferences..." : message || "Click a time to create. Drag existing items to reschedule."}
        </p>
        <div className={cn("min-h-0 flex-1 p-1 sm:p-2", effectiveProviderViewMode === "split" && "grid gap-3 xl:grid-cols-2")}>
          {effectiveProviderViewMode === "split"
            ? visibleProviders.map((provider) => renderCalendar(provider))
            : renderCalendar()}
        </div>
      </CardContent>
    </Card>
  )
}

function CalendarToolbarControls({
  range,
  viewTitle,
  selectedDate,
  providerViewMode,
  selectedProviderId,
  providers,
  showProviderControls,
  showCancelledEvents,
  showStatusBadges,
  colorMode,
  calendarDayStartMinute,
  calendarDayEndMinute,
  calendarSlotDensity,
  visibleBounds,
  onNavigate,
  onGotoDate,
  onRangeChange,
  onProviderViewModeChange,
  onSelectedProviderChange,
  onShowCancelledEventsChange,
  onShowStatusBadgesChange,
  onColorModeChange,
  onDayBoundsChange,
  onSlotDensityChange,
}: {
  range: string
  viewTitle: string
  selectedDate?: Date
  providerViewMode: string
  selectedProviderId: string
  providers: WorkspaceProvider[]
  showProviderControls: boolean
  showCancelledEvents: boolean
  showStatusBadges: boolean
  colorMode: string
  calendarDayStartMinute: number | null
  calendarDayEndMinute: number | null
  calendarSlotDensity: string
  visibleBounds: ReturnType<typeof deriveCalendarVisibleBounds>
  onNavigate: (direction: "prev" | "next" | "today") => void
  onGotoDate: (date: Date | string | undefined) => void
  onRangeChange: (range: string) => void
  onProviderViewModeChange: (mode: string) => void
  onSelectedProviderChange: (providerId: string) => void
  onShowCancelledEventsChange: (checked: boolean) => void
  onShowStatusBadgesChange: (checked: boolean) => void
  onColorModeChange: (checked: boolean) => void
  onDayBoundsChange: (startMinute: number | null, endMinute: number | null) => void
  onSlotDensityChange: (density: string) => void
}) {
  const rangeLabel = RANGE_LABELS.find(([value]) => value === range)?.[1] ?? "Week"
  const providerViewLabel = PROVIDER_VIEW_LABELS.find(([value]) => value === providerViewMode)?.[1] ?? "Only me"
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId)
  const settingsProps = {
    showCancelledEvents,
    showStatusBadges,
    colorMode,
    calendarDayStartMinute,
    calendarDayEndMinute,
    calendarSlotDensity,
    visibleBounds,
    onShowCancelledEventsChange,
    onShowStatusBadgesChange,
    onColorModeChange,
    onDayBoundsChange,
    onSlotDensityChange,
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <Button type="button" variant="outline" size="icon" onClick={() => onNavigate("prev")} aria-label="Previous range">
          <ChevronLeft data-icon="inline-start" />
        </Button>
        <DatePickerControl viewTitle={viewTitle} selectedDate={selectedDate} onGotoDate={onGotoDate} />
        <Button type="button" variant="outline" size="icon" onClick={() => onNavigate("next")} aria-label="Next range">
          <ChevronRight data-icon="inline-start" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("today")}>Today</Button>
        <DropdownControl label="Range" value={rangeLabel}>
          {RANGE_LABELS.map(([value, label]) => (
            <DropdownMenuItem key={value} onClick={() => onRangeChange(value)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownControl>
        {showProviderControls ? (
          <>
            <DropdownControl label="View" value={providerViewLabel}>
              {PROVIDER_VIEW_LABELS.map(([value, label]) => (
                <DropdownMenuItem key={value} onClick={() => onProviderViewModeChange(value)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownControl>
            <Select value={selectedProviderId} onValueChange={onSelectedProviderChange}>
              <SelectTrigger className="h-10 w-44 bg-background/70">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>{provider.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="md:hidden" aria-label="Calendar controls">
            <SlidersHorizontal data-icon="inline-start" />
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="max-h-[85dvh] overflow-y-auto border-border bg-card">
          <SheetHeader>
            <SheetTitle>Calendar controls</SheetTitle>
            <SheetDescription>Current range: {viewTitle || rangeLabel}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-[auto_1fr_auto] gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => onNavigate("prev")} aria-label="Previous range">
                <ChevronLeft data-icon="inline-start" />
              </Button>
              <Button type="button" variant="outline" onClick={() => onNavigate("today")}>Today</Button>
              <Button type="button" variant="outline" size="icon" onClick={() => onNavigate("next")} aria-label="Next range">
                <ChevronRight data-icon="inline-start" />
              </Button>
            </div>
            <DatePickerControl viewTitle={viewTitle} selectedDate={selectedDate} onGotoDate={onGotoDate} className="w-full justify-between" />
            <ToolbarSelect label="Range" value={range} onValueChange={onRangeChange} options={RANGE_LABELS} />
            {showProviderControls ? (
              <>
                <ToolbarSelect label="View" value={providerViewMode} onValueChange={onProviderViewModeChange} options={PROVIDER_VIEW_LABELS} />
                <ToolbarSelect
                  label="Provider"
                  value={selectedProviderId}
                  onValueChange={onSelectedProviderChange}
                  options={providers.map((provider) => [provider.id, provider.label] as const)}
                />
              </>
            ) : (
              <div className="rounded-md border border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
                Provider: {selectedProvider?.label ?? "Only me"}
              </div>
            )}
            <CalendarDisplaySettings {...settingsProps} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="hidden md:block">
        <CalendarDisplaySettings {...settingsProps} />
      </div>
    </div>
  )
}

function DatePickerControl({
  viewTitle,
  selectedDate,
  onGotoDate,
  className,
}: {
  viewTitle: string
  selectedDate?: Date
  onGotoDate: (date: Date | string | undefined) => void
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("h-10 gap-2 bg-background/70", className)}>
          <CalendarDays data-icon="inline-start" />
          <span className="text-muted-foreground">Date</span>
          <span className="max-w-40 truncate font-semibold">{viewTitle || "Today"}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto border-border bg-card p-0" align="start">
        <Calendar mode="single" selected={selectedDate} onSelect={onGotoDate} />
      </PopoverContent>
    </Popover>
  )
}

function DropdownControl({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-10 gap-2 bg-background/70">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold">{value}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="border-border bg-card">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ToolbarSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: ReadonlyArray<readonly [string, string]>
  onValueChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function CalendarDisplaySettings({
  showCancelledEvents,
  showStatusBadges,
  colorMode,
  calendarDayStartMinute,
  calendarDayEndMinute,
  calendarSlotDensity,
  visibleBounds,
  onShowCancelledEventsChange,
  onShowStatusBadgesChange,
  onColorModeChange,
  onDayBoundsChange,
  onSlotDensityChange,
}: {
  showCancelledEvents: boolean
  showStatusBadges: boolean
  colorMode: string
  calendarDayStartMinute: number | null
  calendarDayEndMinute: number | null
  calendarSlotDensity: string
  visibleBounds: ReturnType<typeof deriveCalendarVisibleBounds>
  onShowCancelledEventsChange: (checked: boolean) => void
  onShowStatusBadgesChange: (checked: boolean) => void
  onColorModeChange: (checked: boolean) => void
  onDayBoundsChange: (startMinute: number | null, endMinute: number | null) => void
  onSlotDensityChange: (density: string) => void
}) {
  const startValue = minuteToTimeInput(calendarDayStartMinute ?? visibleBounds.startMinute)
  const endValue = minuteToTimeInput(calendarDayEndMinute ?? Math.min(visibleBounds.endMinute, 24 * 60 - 1))

  function updateStart(value: string) {
    const nextStart = timeInputToMinute(value)
    if (nextStart == null) return
    const nextEnd = calendarDayEndMinute ?? visibleBounds.endMinute
    onDayBoundsChange(Math.min(nextStart, nextEnd - 15), nextEnd)
  }

  function updateEnd(value: string) {
    const nextEnd = timeInputToMinute(value)
    if (nextEnd == null) return
    const nextStart = calendarDayStartMinute ?? visibleBounds.startMinute
    onDayBoundsChange(nextStart, Math.max(nextEnd, nextStart + 15))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Calendar settings">
          <Settings2 data-icon="inline-start" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-border bg-card" align="end">
        <div className="grid gap-4">
          <div>
            <p className="font-semibold">Calendar settings</p>
            <p className="text-sm text-muted-foreground">Display preferences for this schedule view.</p>
          </div>
          <div className="grid gap-3">
            <SettingSwitch icon={ListFilter} label="Cancelled" checked={showCancelledEvents} onCheckedChange={onShowCancelledEventsChange} />
            <SettingSwitch label="Badges" checked={showStatusBadges} onCheckedChange={onShowStatusBadgesChange} />
            <SettingSwitch
              icon={colorMode === "service" ? Layers : Columns3}
              label="Service color"
              checked={colorMode === "service"}
              onCheckedChange={onColorModeChange}
            />
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="calendarDayStart">Day starts</Label>
                <Input id="calendarDayStart" type="time" value={startValue} onChange={(event) => updateStart(event.currentTarget.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendarDayEnd">Day ends</Label>
                <Input id="calendarDayEnd" type="time" value={endValue} onChange={(event) => updateEnd(event.currentTarget.value)} />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onDayBoundsChange(null, null)}>
              Use availability hours
            </Button>
          </div>
          <ToolbarSelect
            label="Cell height"
            value={calendarSlotDensity}
            onValueChange={onSlotDensityChange}
            options={[
              ["compact", "Compact"],
              ["comfortable", "Comfortable"],
              ["spacious", "Spacious"],
            ]}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SettingSwitch({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon?: ComponentType<{ className?: string }>
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-brand-orange" /> : null}
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}
