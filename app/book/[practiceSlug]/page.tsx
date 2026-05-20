import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, LockKeyhole } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { buildAvailabilitySlots, isoDate } from "@/lib/calendar"
import { resolveAvailabilityForDate } from "@/lib/calendar-availability"
import { buildSequentialBookingOptions, normalizeBookingPolicy } from "@/lib/booking-policy"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { serviceVariantBookableMinutes } from "@/lib/service-catalog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingPicker } from "./booking-picker"

const ACTIVE_EVENT_STATUSES = ["REQUESTED", "CONFIRMED", "ACTIVE"] as const

function nextDates(count: number) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return isoDate(date)
  })
}

function addOnCombinations<T>(items: T[], maxItems = 3) {
  const combinations: T[][] = [[]]
  const capped = items.slice(0, 8)

  for (const item of capped) {
    const next = combinations
      .filter((combination) => combination.length < maxItems)
      .map((combination) => [...combination, item])
    combinations.push(...next)
  }

  return combinations
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
        bookingPolicy: true,
        providerBookingPolicies: true,
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

  const policy = normalizeBookingPolicy(practice.bookingPolicy)
  if (!policy.enabled) {
    return (
      <BookingShell practiceName={practice.name}>
        <CalendarUnavailableNotice />
      </BookingShell>
    )
  }

  const now = new Date()
  const [rules, schedules, overrides, blockingEvents, resourceBookings, capacityRules, existingAppointments] = await Promise.all([
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
        endsAt: { gte: now },
        event: {
          blocksAvailability: true,
          status: { in: [...ACTIVE_EVENT_STATUSES] },
        },
      },
      select: { resourceId: true, startsAt: true, endsAt: true },
    }),
    prisma.providerBookingCapacityRule.findMany({
      where: { practiceId: practice.id, active: true },
    }),
    prisma.appointment.findMany({
      where: {
        practiceId: practice.id,
        status: { in: ["REQUESTED", "CONFIRMED"] },
        endsAt: { gte: now },
      },
      select: {
        therapistId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        requestedPressureLevel: true,
        massageCapacityMinutes: true,
      },
    }),
  ])

  const dates = nextDates(policy.maxAdvanceDays)
  const bookableServices = practice.serviceTypes
    .map((service) => ({
      ...service,
      variants: service.variants.filter((variant) => variant.active && variant.clientVisible),
    }))
    .filter((service) => service.variants.length > 0)
  const primaryServices = bookableServices.filter((service) => service.bookingRole === "PRIMARY")
  const addOnServices = bookableServices.filter((service) => service.bookingRole === "ADD_ON")
  const providerPolicyByUserId = new Map(practice.providerBookingPolicies.map((policyRow) => [policyRow.providerUserId, policyRow]))
  const showStaffLabels = policy.staffVisibility === "PUBLIC_LABELS"
  const providers = practice.memberships.map((therapist) => {
    const providerPolicy = providerPolicyByUserId.get(therapist.userId)
    const fallbackLabel = therapist.user.name ?? therapist.user.email ?? "Provider"
    return {
      userId: therapist.userId,
      label: showStaffLabels ? (providerPolicy?.displayLabel || fallbackLabel) : "Available provider",
      publiclyBookable: providerPolicy?.publiclyBookable ?? true,
      minRestMinutes: providerPolicy?.minRestMinutes ?? 0,
      dailyAppointmentLimit: providerPolicy?.dailyAppointmentLimit ?? null,
      weeklyAppointmentLimit: providerPolicy?.weeklyAppointmentLimit ?? null,
    }
  })
  const slotsByVariantAndProvider: Record<string, Array<{ startsAt: Date }>> = {}
  const cutoff = new Date(now.getTime() + policy.minNoticeMinutes * 60_000)

  for (const service of bookableServices) {
    for (const variant of service.variants) {
      const variantResourceIds = variant.resourceRequirements
        .filter((requirement) => requirement.resource.active)
        .map((requirement) => requirement.resourceId)
      const variantResourceBlocks = resourceBookings.filter((booking) => variantResourceIds.includes(booking.resourceId))
      const eligibleTherapists = providers.filter((therapist) => (
        therapist.publiclyBookable &&
        (service.eligibleProviderIds.length === 0 || service.eligibleProviderIds.includes(therapist.userId))
      ))

      for (const therapist of eligibleTherapists) {
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
            now: cutoff,
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
        })

        slotsByVariantAndProvider[`${variant.id}:${therapist.userId}`] = slots
      }
    }
  }

  const addOnVariants = addOnServices.flatMap((service) => service.variants.map((variant) => ({ service, variant })))
  const publiclyBookableProviders = providers.filter((provider) => provider.publiclyBookable)
  const providerPreferences = [
    ...(policy.anyProviderEnabled && publiclyBookableProviders.length > 0 ? [{ id: "", label: "Any available provider" }] : []),
    ...publiclyBookableProviders.map((provider) => ({ id: provider.userId, label: provider.label })),
  ]
  const sequenceGroups = primaryServices.flatMap((service) => service.variants.flatMap((primaryVariant) => (
    addOnCombinations(addOnVariants).flatMap((addOns) => {
      const variants = [
        { service, variant: primaryVariant },
        ...addOns,
      ]
      const selections = variants.map((selection) => ({
        serviceVariantId: selection.variant.id,
        serviceName: selection.service.name,
        serviceVariantName: selection.variant.name,
        bookingRole: selection.service.bookingRole,
        bookableMinutes: serviceVariantBookableMinutes(selection.variant),
        durationMinutes: selection.variant.durationMinutes,
        massageCapacityMinutes: selection.service.countsTowardMassageCapacity ? selection.variant.durationMinutes : 0,
        countsTowardMassageCapacity: selection.service.countsTowardMassageCapacity,
        eligibleProviderIds: selection.service.eligibleProviderIds,
      }))
      return [1, 2, 3, 4, 5].flatMap((pressureLevel) => (
        providerPreferences.map((providerPreference) => ({
          primaryServiceVariantId: primaryVariant.id,
          addOnServiceVariantIds: addOns.map((addOn) => addOn.variant.id),
          requestedPressureLevel: pressureLevel,
          preferredProviderId: providerPreference.id,
          options: buildSequentialBookingOptions({
            practiceId: practice.id,
            timeZone: practice.timezone,
            pressureLevel,
            policy,
            providers,
            selections,
            slotsByVariantAndProvider,
            capacityRules,
            existingBookings: existingAppointments.map((appointment) => ({
              providerUserId: appointment.therapistId,
              startsAt: appointment.startsAt,
              endsAt: appointment.endsAt,
              status: appointment.status,
              requestedPressureLevel: appointment.requestedPressureLevel,
              massageCapacityMinutes: appointment.massageCapacityMinutes,
            })),
            preferredProviderId: providerPreference.id || null,
            maxOptions: 8,
          }),
        }))
      ))
    })
  )))

  const bookingModel = {
    practiceId: practice.id,
    practiceSlug: practice.slug,
    practiceName: practice.name,
    timeZone: practice.timezone,
    policy: {
      approvalMode: (policy.approvalMode === "AUTO_CONFIRM" ? "AUTO_CONFIRM" : "MANUAL") as "AUTO_CONFIRM" | "MANUAL",
      anyProviderEnabled: policy.anyProviderEnabled,
      dualTimezoneDisplay: policy.dualTimezoneDisplay,
    },
    primaryServices: primaryServices.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      variants: service.variants.map((variant) => ({
        id: variant.id,
        serviceId: service.id,
        serviceName: service.name,
        name: variant.name,
        durationMinutes: variant.durationMinutes,
        priceCents: variant.priceCents,
        currency: variant.currency,
      })),
    })),
    addOnServices: addOnServices.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      variants: service.variants.map((variant) => ({
        id: variant.id,
        serviceId: service.id,
        serviceName: service.name,
        name: variant.name,
        durationMinutes: variant.durationMinutes,
        priceCents: variant.priceCents,
        currency: variant.currency,
      })),
    })),
    providers: providerPreferences,
    sequenceGroups,
    proximity: {
      enabled: policy.proximityNoticeEnabled && typeof practice.publicLatitude === "number" && typeof practice.publicLongitude === "number",
      label: practice.publicLocationLabel,
      latitude: practice.publicLatitude,
      longitude: practice.publicLongitude,
      radiusMiles: policy.proximityRadiusMiles,
    },
  }

  return (
    <BookingShell practiceName={practice.name}>
      <Alert className="border-border/80 bg-card/80 backdrop-blur">
        <CalendarDays />
        <div>
          <AlertTitle>Request an appointment</AlertTitle>
          <AlertDescription>These requests store scheduling details only. Clinical notes are not part of this booking flow.</AlertDescription>
        </div>
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Client booking</Badge>
        <Badge variant="outline">{practice.timezone}</Badge>
      </div>

      {primaryServices.length === 0 || providerPreferences.length === 0 ? (
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>No online booking times available</CardTitle>
            <CardDescription>The practice needs at least one active primary service, publicly bookable provider, and availability rule.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <BookingPicker model={bookingModel} />
      )}
    </BookingShell>
  )
}

function BookingShell({ practiceName, children }: { practiceName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brand-orange">Online booking</p>
            <h1 className="text-3xl font-semibold tracking-normal text-foreground">{practiceName}</h1>
          </div>
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
