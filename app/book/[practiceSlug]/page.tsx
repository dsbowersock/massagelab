import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, LockKeyhole } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { requestAppointmentAction } from "@/app/calendar/actions"
import { buildAvailabilitySlots, isoDate } from "@/lib/calendar"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED"] as const

function formatSlot(value: Date, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

function nextDates(count: number) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return isoDate(date)
  })
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ practiceSlug: string }>
}) {
  const { practiceSlug } = await params
  const session = await getCurrentSession()

  if (!(await isCalendarDatabaseReady())) {
    return (
      <BookingShell practiceName="Booking">
        <CalendarUnavailableNotice />
      </BookingShell>
    )
  }

  let practice

  try {
    practice = await prisma.practice.findUnique({
      where: { slug: practiceSlug },
      include: {
        serviceTypes: {
          where: { active: true },
          orderBy: { durationMinutes: "asc" },
        },
        memberships: {
          where: { role: { in: ["OWNER", "THERAPIST"] } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  } catch {
    return (
      <BookingShell practiceName="Booking">
        <CalendarUnavailableNotice />
      </BookingShell>
    )
  }

  if (!practice) {
    notFound()
  }

  if (!session?.user?.id) {
    return (
      <BookingShell practiceName={practice.name}>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-[#ff7043]" />
              Sign in to request an appointment
            </CardTitle>
            <CardDescription>Client accounts are required before a booking request can be confirmed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </BookingShell>
    )
  }

  const now = new Date()
  const [rules, blocks, appointments] = await Promise.all([
    prisma.therapistAvailabilityRule.findMany({
      where: {
        practiceId: practice.id,
        active: true,
      },
    }),
    prisma.calendarBlock.findMany({
      where: {
        practiceId: practice.id,
        endsAt: { gte: now },
      },
      select: { therapistId: true, startsAt: true, endsAt: true },
    }),
    prisma.appointment.findMany({
      where: {
        practiceId: practice.id,
        status: { in: [...ACTIVE_STATUSES] },
        endsAt: { gte: now },
      },
      select: { therapistId: true, startsAt: true, endsAt: true, status: true },
    }),
  ])

  const dates = nextDates(7)

  return (
    <BookingShell practiceName={practice.name}>
      <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <CalendarDays className="mt-1 h-5 w-5 text-[#ff7043]" />
          <div>
            <CardTitle>Request an appointment</CardTitle>
            <CardDescription>These requests store scheduling details only. Clinical notes are not part of this booking flow.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {practice.serviceTypes.length === 0 || practice.memberships.length === 0 ? (
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>No online booking times available</CardTitle>
              <CardDescription>The practice needs at least one active service, therapist, and availability rule.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          practice.serviceTypes.map((service) => (
            <Card key={service.id} className="border-neutral-800 bg-card/90 backdrop-blur">
              <CardHeader>
                <CardTitle>{service.name}</CardTitle>
                <CardDescription>{service.durationMinutes} minutes{service.bufferMinutes ? ` plus ${service.bufferMinutes} minutes buffer` : ""}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {practice.memberships.map((therapist) => {
                  const therapistRules = rules.filter((rule) => rule.therapistId === therapist.userId)
                  const therapistBlocks = blocks.filter((block) => block.therapistId === therapist.userId)
                  const therapistAppointments = appointments.filter((appointment) => appointment.therapistId === therapist.userId)
                  const slots = dates.flatMap((date) => buildAvailabilitySlots({
                    date,
                    serviceDurationMinutes: service.durationMinutes + service.bufferMinutes,
                    now,
                    rules: therapistRules,
                    blocks: therapistBlocks,
                    appointments: therapistAppointments,
                    timeZone: practice.timezone,
                  })).slice(0, 8)

                  return (
                    <div key={therapist.id} className="rounded-md border border-neutral-800 bg-background/70 p-4">
                      <div className="mb-3 font-medium">{therapist.user.name ?? therapist.user.email}</div>
                      {slots.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot) => (
                            <form key={slot.startsAt.toISOString()} action={requestAppointmentAction}>
                              <input type="hidden" name="practiceId" value={practice.id} />
                              <input type="hidden" name="therapistId" value={therapist.userId} />
                              <input type="hidden" name="serviceTypeId" value={service.id} />
                              <input type="hidden" name="startsAt" value={slot.startsAt.toISOString()} />
                              <Button type="submit" variant="outline" size="sm">
                                {formatSlot(slot.startsAt, practice.timezone)}
                              </Button>
                            </form>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No available times in the next 7 days.</p>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </BookingShell>
  )
}

function BookingShell({ practiceName, children }: { practiceName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeading>{practiceName}</PageHeading>
          <Button asChild variant="outline">
            <Link href="/calendar">Calendar</Link>
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CalendarUnavailableNotice() {
  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle>Online booking is temporarily unavailable</CardTitle>
        <CardDescription>Appointment requests are not available right now. Please try again later.</CardDescription>
      </CardHeader>
    </Card>
  )
}
