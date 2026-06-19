import Link from "next/link"
import { HeartPulse, Radio, Wind } from "lucide-react"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { WellnessHubClient, type WellnessTimelineEntry } from "@/components/wellness/wellness-hub-client"
import type {
  ClientWellnessReminderSchedule,
  WellnessAppointmentSummary,
} from "@/components/wellness/wellness-calendar-companion"
import { Button } from "@/components/ui/button"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { normalizeClientWellnessReminderSchedules } from "@/lib/client-wellness-reminders"
import { prisma } from "@/lib/prisma"

const wellnessAppointmentInclude = {
  practice: { select: { name: true, timezone: true } },
  therapist: { select: { name: true } },
  event: { select: { title: true, startsAt: true, endsAt: true, timezone: true, status: true } },
  serviceItems: {
    select: {
      serviceName: true,
      serviceVariantName: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.AppointmentInclude

export default async function WellnessPage() {
  const session = await getCurrentSession()
  const userId = session?.user?.id
  const now = new Date()
  const reportWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const [entries, reportEntries, upcomingAppointments, pastAppointments, preference] = userId
    ? await Promise.all([
        prisma.clientWellnessEntry.findMany({
          where: { userId, deletedAt: null },
          orderBy: { occurredAt: "desc" },
          take: 25,
        }),
        // Pattern reports need the full bounded window; the visible timeline stays page-sized.
        prisma.clientWellnessEntry.findMany({
          where: { userId, deletedAt: null, occurredAt: { gte: reportWindowStart } },
          orderBy: { occurredAt: "desc" },
          take: 250,
        }),
        prisma.appointment.findMany({
          where: {
            practiceClient: { userId },
            endsAt: { gte: now },
          },
          include: wellnessAppointmentInclude,
          orderBy: { startsAt: "asc" },
          take: 12,
        }),
        prisma.appointment.findMany({
          where: {
            practiceClient: { userId },
            endsAt: { lt: now },
          },
          include: wellnessAppointmentInclude,
          orderBy: { startsAt: "desc" },
          take: 12,
        }),
        prisma.clientWellnessPreference.findUnique({
          where: { userId },
          select: { settings: true },
        }),
      ])
    : [[], [], [], [], null]

  return (
    <AppPageShell width="wide" contentClassName="gap-5">
      <AppSurface
        title="Atmosphere"
        description="Public wellness audio stations for massage-room pacing, study, and personal focus."
        icon={<Radio className="h-5 w-5" aria-hidden="true" />}
        badge="Public audio"
      >
        <Button asChild variant="outline">
          <Link href="/wellness/atmosphere">Open Atmosphere</Link>
        </Button>
      </AppSurface>

      <AppSurface
        title="Breathing guide"
        description="A public breathing pacer for settling before, during, or after a session."
        icon={<Wind className="h-5 w-5" aria-hidden="true" />}
        badge="Public tool"
      >
        <Button asChild variant="outline">
          <Link href="/wellness/breathing">Open Breathing Guide</Link>
        </Button>
      </AppSurface>

      <AppSurface
        title="Wellness"
        description="Client-owned self-tracking for quick check-ins, context notes, and range-of-motion measurements."
        icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
        badge={userId ? "Signed in" : "Practice mode"}
        className={appCalloutClassName}
      >
        <WellnessHubClient
          isSignedIn={Boolean(userId)}
          displayName={session?.user?.name ?? session?.user?.email ?? null}
          initialEntries={entries.map(serializeWellnessEntry)}
          initialReportEntries={reportEntries.map(serializeWellnessEntry)}
          appointments={[...upcomingAppointments, ...pastAppointments].map(serializeWellnessAppointment)}
          reminderSchedules={reminderSchedulesFromPreference(preference?.settings)}
        />
      </AppSurface>
    </AppPageShell>
  )
}

/**
 * Adapts a persisted wellness entry for the client timeline contract.
 *
 * The input is a database row with Date fields plus JSON-backed array/object
 * fields. Dates are emitted as ISO strings, regions/sensations/contexts are
 * filtered to string arrays, metadata is reduced to a plain object, and the
 * result is always marked as persisted because it came from signed-in storage.
 */
function serializeWellnessEntry(entry: {
  id: string
  category: string
  occurredAt: Date
  timezone: string
  summary: string | null
  intensity: number | null
  regions: unknown
  sensations: unknown
  contexts: unknown
  source: string
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}): WellnessTimelineEntry {
  return {
    id: entry.id,
    category: entry.category,
    occurredAt: entry.occurredAt.toISOString(),
    timezone: entry.timezone,
    summary: entry.summary,
    intensity: entry.intensity,
    regions: Array.isArray(entry.regions) ? entry.regions.filter(isString) : [],
    sensations: Array.isArray(entry.sensations) ? entry.sensations.filter(isString) : [],
    contexts: Array.isArray(entry.contexts) ? entry.contexts.filter(isString) : [],
    source: entry.source,
    metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
      ? (entry.metadata as Record<string, unknown>)
      : {},
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    persisted: true,
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

/**
 * Serializes appointment rows for the client-owned wellness calendar companion.
 *
 * The query intentionally avoids appointment notes and practice-client contact
 * fields, so this adapter only emits operational labels, timing, and status.
 */
function serializeWellnessAppointment(appointment: {
  id: string
  status: string
  source: string
  startsAt: Date
  endsAt: Date
  serviceName: string | null
  serviceVariantName: string | null
  practice: { name: string; timezone: string }
  therapist: { name: string | null }
  event: { title: string; startsAt: Date; endsAt: Date; timezone: string; status: string }
  serviceItems: Array<{ serviceName: string | null; serviceVariantName: string | null; sortOrder: number }>
}): WellnessAppointmentSummary {
  const serviceItemLabels = appointment.serviceItems
    .map((item) => [item.serviceName, item.serviceVariantName].filter(Boolean).join(" - "))
    .filter(Boolean)
  const serviceLabel = serviceItemLabels.length > 0
    ? serviceItemLabels.join(" + ")
    : [appointment.serviceName, appointment.serviceVariantName].filter(Boolean).join(" - ") || appointment.event.title || "Appointment"

  return {
    id: appointment.id,
    status: appointment.status,
    source: appointment.source,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    timezone: appointment.event.timezone || appointment.practice.timezone,
    practiceName: appointment.practice.name,
    therapistLabel: appointment.therapist.name ?? "Provider",
    serviceLabel,
  }
}

function reminderSchedulesFromPreference(settings: unknown): ClientWellnessReminderSchedule[] {
  const payload = settings && typeof settings === "object" && !Array.isArray(settings) ? settings as Record<string, unknown> : {}
  return normalizeClientWellnessReminderSchedules(payload.reminderSchedules) as ClientWellnessReminderSchedule[]
}
