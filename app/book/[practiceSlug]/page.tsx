import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, LockKeyhole } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { normalizeBookingPolicy } from "@/lib/booking-policy"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingPicker } from "./booking-picker"

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
  const publiclyBookableProviders = providers.filter((provider) => provider.publiclyBookable)
  const providerPreferences = [
    ...(policy.anyProviderEnabled && publiclyBookableProviders.length > 0 ? [{ id: "", label: "Any available provider" }] : []),
    ...publiclyBookableProviders.map((provider) => ({ id: provider.userId, label: provider.label })),
  ]

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
