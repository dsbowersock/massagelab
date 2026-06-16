"use client"

import { useMemo, useState, useTransition } from "react"
import { Bell, CalendarDays, Plus, Trash2 } from "lucide-react"
import { updateClientWellnessReminderSchedulesAction } from "@/app/wellness/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CLIENT_WELLNESS_REMINDER_KINDS,
  nextClientWellnessReminderOccurrences,
  normalizeClientWellnessReminderSchedules,
} from "@/lib/client-wellness-reminders"
import { cn } from "@/lib/utils"

export type ClientWellnessReminderSchedule = {
  id: string
  kind: string
  cadence: string
  timeOfDay: string
  weekdays: number[]
  enabled: boolean
}

export type WellnessAppointmentSummary = {
  id: string
  status: string
  source: string
  startsAt: string
  endsAt: string
  timezone: string
  practiceName: string
  therapistLabel: string
  serviceLabel: string
}

type ReminderActionData = {
  reminderSchedules?: ClientWellnessReminderSchedule[]
}

const cadenceOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
]

const weekdayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
]

export function WellnessCalendarCompanion({
  isSignedIn,
  appointments,
  reminderSchedules,
}: {
  isSignedIn: boolean
  appointments: WellnessAppointmentSummary[]
  reminderSchedules: ClientWellnessReminderSchedule[]
}) {
  const [schedules, setSchedules] = useState(() => normalizeClientWellnessReminderSchedules(reminderSchedules))
  const [kind, setKind] = useState("check_in")
  const [cadence, setCadence] = useState("daily")
  const [timeOfDay, setTimeOfDay] = useState("09:00")
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const nowTime = Date.now()
  const upcomingAppointments = useMemo(() => appointments
    .filter((appointment) => new Date(appointment.endsAt).getTime() >= nowTime)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 4), [appointments, nowTime])
  const pastAppointments = useMemo(() => appointments
    .filter((appointment) => new Date(appointment.endsAt).getTime() < nowTime)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, 4), [appointments, nowTime])
  const nextReminders = useMemo(() => (
    nextClientWellnessReminderOccurrences(schedules, new Date(), 4)
  ), [schedules])

  const persistSchedules = (nextSchedules: ClientWellnessReminderSchedule[], successMessage: string) => {
    const normalizedSchedules = normalizeClientWellnessReminderSchedules(nextSchedules)
    setSchedules(normalizedSchedules)
    setError(null)

    if (!isSignedIn) {
      setStatus("Practice reminder schedules stay in this page session. Sign in before saving reminders.")
      return
    }

    const formData = new FormData()
    formData.set("reminderSchedules", JSON.stringify(normalizedSchedules))

    startTransition(async () => {
      const result = await updateClientWellnessReminderSchedulesAction(formData)

      if (!result.ok) {
        setError(actionReason(result.reason, "Could not save reminder schedules."))
        return
      }

      const data = reminderActionData(result.data)
      setSchedules(normalizeClientWellnessReminderSchedules(data.reminderSchedules ?? normalizedSchedules))
      setStatus(successMessage)
    })
  }

  const addSchedule = () => {
    const nextSchedule = {
      id: `reminder-${kind}-${Date.now()}`,
      kind,
      cadence,
      timeOfDay,
      weekdays,
      enabled: true,
    }
    const nextSchedules = normalizeClientWellnessReminderSchedules([...schedules, nextSchedule])

    if (nextSchedules.length === schedules.length) {
      setError("Choose a reminder type and valid time.")
      return
    }

    persistSchedules(nextSchedules, "Reminder schedule saved.")
  }

  const removeSchedule = (id: string) => {
    persistSchedules(schedules.filter((schedule) => schedule.id !== id), "Reminder schedule removed.")
  }

  const toggleSchedule = (id: string) => {
    persistSchedules(
      schedules.map((schedule) => schedule.id === id ? { ...schedule, enabled: !schedule.enabled } : schedule),
      "Reminder schedule updated.",
    )
  }

  return (
    <section className="rounded-md border border-border/80 bg-card/95 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            Calendar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignedIn ? "Appointment summaries and generic wellness reminders." : "Try reminder setup here; sign in to save schedules."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{upcomingAppointments.length} upcoming</Badge>
          <Badge variant="secondary">{schedules.length} reminders</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-3">
          <AppointmentList title="Upcoming" appointments={upcomingAppointments} emptyLabel={isSignedIn ? "No upcoming appointments found." : "Sign in to see appointment summaries."} />
          <AppointmentList title="Past" appointments={pastAppointments} emptyLabel={isSignedIn ? "No past appointments found." : "Saved appointment history requires sign-in."} />
        </div>

        <div className="rounded-md border border-border/80 bg-background/85 p-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-brand-orange" aria-hidden="true" />
            Reminders
          </h3>

          <div className="mt-3 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wellnessReminderKind">Reminder</Label>
                <select
                  id="wellnessReminderKind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CLIENT_WELLNESS_REMINDER_KINDS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wellnessReminderCadence">Repeat</Label>
                <select
                  id="wellnessReminderCadence"
                  value={cadence}
                  onChange={(event) => setCadence(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {cadenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="wellnessReminderTime">Time</Label>
                <Input
                  id="wellnessReminderTime"
                  type="time"
                  value={timeOfDay}
                  onChange={(event) => setTimeOfDay(event.target.value)}
                />
              </div>
            </div>

            {cadence !== "daily" ? (
              <fieldset>
                <legend className="text-sm font-medium">Days</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {weekdayOptions.map((day) => (
                    <label
                      key={day.value}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={weekdays.includes(day.value)}
                        onChange={() => setWeekdays((current) => current.includes(day.value)
                          ? current.filter((value) => value !== day.value)
                          : [...current, day.value].sort((a, b) => a - b))}
                        className="h-4 w-4"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <Button type="button" onClick={addSchedule} disabled={isPending}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add reminder
            </Button>
          </div>

          {schedules.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/80 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{reminderKindLabel(schedule.kind)}</p>
                    <p className="text-xs text-muted-foreground">{scheduleLabel(schedule)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={schedule.enabled}
                      onCheckedChange={() => toggleSchedule(schedule.id)}
                      aria-label={schedule.enabled ? "Disable reminder" : "Enable reminder"}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSchedule(schedule.id)} disabled={isPending} aria-label="Remove reminder">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-border/80 bg-card/80 p-3 text-sm text-muted-foreground">
              No reminder schedules yet.
            </p>
          )}

          {nextReminders.length > 0 ? (
            <div className="mt-4 border-t border-border/80 pt-3">
              <p className="text-sm font-medium">Next reminders</p>
              <div className="mt-2 grid gap-2">
                {nextReminders.map((reminder) => (
                  <div key={`${reminder.scheduleId}-${reminder.startsAt.toISOString()}`} className="flex items-center justify-between gap-3 text-sm">
                    <span>{reminder.label}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(reminder.startsAt.toISOString())}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(status || error || isPending) ? (
            <p
              className={cn(
                "mt-3 rounded-md border p-2 text-sm",
                error ? "border-destructive/40 bg-destructive/10" : "border-primary/50 bg-primary/10",
              )}
              role="status"
            >
              {isPending ? "Saving reminders..." : error ?? status}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function AppointmentList({
  title,
  appointments,
  emptyLabel,
}: {
  title: string
  appointments: WellnessAppointmentSummary[]
  emptyLabel: string
}) {
  return (
    <div className="rounded-md border border-border/80 bg-background/85 p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {appointments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-md border border-border/80 bg-card/80 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{appointment.serviceLabel}</p>
                  <p className="text-xs text-muted-foreground">{appointment.practiceName}</p>
                </div>
                <Badge variant="outline">{appointment.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDateTime(appointment.startsAt)} with {appointment.therapistLabel}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function reminderKindLabel(kind: string) {
  return CLIENT_WELLNESS_REMINDER_KINDS.find((option) => option.id === kind)?.label ?? "Wellness reminder"
}

function scheduleLabel(schedule: ClientWellnessReminderSchedule) {
  if (schedule.cadence === "daily") {
    return `Daily at ${schedule.timeOfDay}`
  }

  const days = schedule.weekdays
    .map((day) => weekdayOptions.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(", ")

  return `${schedule.cadence === "weekdays" ? "Weekdays" : "Weekly"} at ${schedule.timeOfDay}${days ? ` (${days})` : ""}`
}

function reminderActionData(value: unknown): ReminderActionData {
  return value && typeof value === "object" ? value as ReminderActionData : {}
}

function actionReason(reason: string | undefined, fallback: string) {
  if (reason === "sign-in-required") {
    return "Sign in before saving reminder schedules."
  }
  return fallback
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}
