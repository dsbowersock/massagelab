import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, LockKeyhole } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { requestAppointmentAction } from "@/app/calendar/actions"
import { buildAvailabilitySlots, isoDate } from "@/lib/calendar"
import { resolveAvailabilityForDate } from "@/lib/calendar-availability"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { serviceVariantBookableMinutes } from "@/lib/service-catalog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

const ACTIVE_EVENT_STATUSES = ["REQUESTED", "CONFIRMED", "ACTIVE"] as const

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
          where: { active: true, clientVisible: true },
          include: {
            variants: {
              where: { active: true, clientVisible: true },
              include: {
                resourceRequirements: {
                  include: { resource: true },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { durationMinutes: "asc" }],
            },
          },
          orderBy: { name: "asc" },
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
              <LockKeyhole className="h-5 w-5 text-brand-orange" />
              Sign in to request an appointment
            </CardTitle>
            <CardDescription>Client accounts are required before a booking request can be confirmed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </BookingShell>
    )
  }

  const now = new Date()
  const [rules, schedules, overrides, blockingEvents, resourceBookings] = await Promise.all([
    prisma.therapistAvailabilityRule.findMany({
      where: {
        practiceId: practice.id,
        active: true,
      },
    }),
    prisma.calendarAvailabilitySchedule.findMany({
      where: { practiceId: practice.id, active: true },
      include: { intervals: true },
      orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    }),
    prisma.calendarAvailabilityOverride.findMany({
      where: { practiceId: practice.id },
      include: { intervals: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: {
        practiceId: practice.id,
        blocksAvailability: true,
        status: { in: [...ACTIVE_EVENT_STATUSES] },
        endsAt: { gte: now },
      },
      select: { ownerUserId: true, startsAt: true, endsAt: true },
    }),
    prisma.calendarResourceBooking.findMany({
      where: {
        resource: { practiceId: practice.id },
        startsAt: { gte: now },
        event: {
          blocksAvailability: true,
          status: { in: [...ACTIVE_EVENT_STATUSES] },
        },
      },
      select: { resourceId: true, startsAt: true, endsAt: true },
    }),
  ])

  const dates = nextDates(7)
  const bookableServices = practice.serviceTypes
    .map((service) => ({
      ...service,
      variants: service.variants.filter((variant) => variant.active && variant.clientVisible),
    }))
    .filter((service) => service.variants.length > 0)

  return (
    <BookingShell practiceName={practice.name}>
      <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <CalendarDays className="mt-1 h-5 w-5 text-brand-orange" />
          <div>
            <CardTitle>Request an appointment</CardTitle>
            <CardDescription>These requests store scheduling details only. Clinical notes are not part of this booking flow.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {bookableServices.length === 0 || practice.memberships.length === 0 ? (
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>No online booking times available</CardTitle>
              <CardDescription>The practice needs at least one active service, therapist, and availability rule.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          bookableServices.map((service) => (
            <Card key={service.id} className="border-neutral-800 bg-card/90 backdrop-blur">
              <CardHeader>
                <CardTitle>{service.name}</CardTitle>
                <CardDescription>{service.description ?? "Choose a provider and time."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {service.variants.map((variant) => {
                  const variantResourceIds = variant.resourceRequirements
                    .filter((requirement) => requirement.resource.active)
                    .map((requirement) => requirement.resourceId)
                  const variantResourceBlocks = resourceBookings.filter((booking) => variantResourceIds.includes(booking.resourceId))

                  return (
                    <div key={variant.id} className="space-y-3 rounded-md border border-neutral-800 bg-background/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{variant.name}</div>
                          <p className="text-sm text-muted-foreground">
                            {variant.durationMinutes} min{variant.bufferAfterMinutes ? ` plus ${variant.bufferAfterMinutes} min buffer` : ""}
                          </p>
                        </div>
                        {variant.priceCents != null ? (
                          <span className="text-sm text-muted-foreground">{new Intl.NumberFormat(undefined, { style: "currency", currency: variant.currency }).format(variant.priceCents / 100)}</span>
                        ) : null}
                      </div>

                      {practice.memberships
                        .filter((therapist) => service.eligibleProviderIds.length === 0 || service.eligibleProviderIds.includes(therapist.userId))
                        .map((therapist) => {
                        const therapistRules = rules.filter((rule) => rule.therapistId === therapist.userId)
                        const therapistSchedules = schedules
                          .filter((schedule) => schedule.therapistId === therapist.userId)
                          .map((schedule) => ({
                            active: schedule.active,
                            effectiveFrom: schedule.effectiveFrom,
                            effectiveTo: schedule.effectiveTo,
                            intervals: schedule.intervals,
                          }))
                        const therapistOverrides = overrides
                          .filter((override) => override.therapistId === therapist.userId)
                          .map((override) => ({
                            date: override.date,
                            kind: override.kind,
                            intervals: override.intervals,
                          }))
                        const therapistBlocks = blockingEvents.filter((event) => event.ownerUserId === therapist.userId)
                        const slots = dates.flatMap((date) => {
                          const resolvedAvailability = resolveAvailabilityForDate({
                            date,
                            weeklyRules: therapistRules,
                            schedules: therapistSchedules,
                            overrides: therapistOverrides,
                          })
                          const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay()
                          return buildAvailabilitySlots({
                            date,
                            serviceDurationMinutes: serviceVariantBookableMinutes(variant),
                            now,
                            rules: resolvedAvailability.intervals.map((interval) => ({
                              dayOfWeek,
                              startMinute: interval.startMinute,
                              endMinute: interval.endMinute,
                              active: true,
                            })),
                            blocks: [...therapistBlocks, ...variantResourceBlocks],
                            appointments: [],
                            timeZone: practice.timezone,
                          })
                        }).slice(0, 8)

                        return (
                          <div key={`${variant.id}-${therapist.id}`} className="rounded-md bg-card/70 p-3">
                            <div className="mb-3 font-medium">{therapist.user.name ?? therapist.user.email}</div>
                            {slots.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {slots.map((slot) => (
                                  <form key={slot.startsAt.toISOString()} action={requestAppointmentAction}>
                                    <input type="hidden" name="practiceId" value={practice.id} />
                                    <input type="hidden" name="therapistId" value={therapist.userId} />
                                    <input type="hidden" name="serviceVariantId" value={variant.id} />
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
