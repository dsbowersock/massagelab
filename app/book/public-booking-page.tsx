import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, LockKeyhole } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { normalizeBookingPolicy } from "@/lib/booking-policy"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { normalizePublicBookingSlug, normalizePublicBookingStateSlug } from "@/lib/public-booking-url"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingPicker } from "./[practiceSlug]/booking-picker"

type PublicBookingLookup =
  | { kind: "legal"; practiceSlug: string }
  | { kind: "branded"; stateSlug: string; bookingSlug: string }

export async function renderPublicBookingPage({ lookup }: { lookup: PublicBookingLookup }) {
  const session = await getCurrentSession()
  const viewerUserId = session?.user?.id ?? ""

  if (!(await isCalendarDatabaseReady())) {
    return (
      <BookingShell practiceName="Booking">
        <BookingShellSection>
          <CalendarUnavailableNotice />
        </BookingShellSection>
      </BookingShell>
    )
  }

  const practiceWhere = lookup.kind === "legal"
    ? { slug: normalizePublicBookingSlug(lookup.practiceSlug) }
    : {
        publicBookingStateSlug: normalizePublicBookingStateSlug(lookup.stateSlug),
        publicBookingSlug: normalizePublicBookingSlug(lookup.bookingSlug),
      }

  let practice

  try {
    practice = await prisma.practice.findFirst({
      where: practiceWhere,
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
        <BookingShellSection>
          <CalendarUnavailableNotice />
        </BookingShellSection>
      </BookingShell>
    )
  }

  if (!practice) {
    notFound()
  }

  const policy = normalizeBookingPolicy(practice.bookingPolicy)
  const currentBookingPath = lookup.kind === "branded"
    ? `/book/${normalizePublicBookingStateSlug(lookup.stateSlug)}/${normalizePublicBookingSlug(lookup.bookingSlug)}`
    : `/book/${practice.slug}`

  if (!policy.enabled) {
    return (
      <BookingShell practiceName={practice.name}>
        <BookingShellSection>
          <CalendarUnavailableNotice />
        </BookingShellSection>
      </BookingShell>
    )
  }

  if (!viewerUserId && policy.requireClientAccount) {
    return (
      <BookingShell practiceName={practice.name}>
        <BookingShellSection>
          <AccountRequiredCard bookingPath={currentBookingPath} />
        </BookingShellSection>
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
      requireClientAccount: providerPolicy?.requireClientAccount ?? false,
    }
  })
  const publiclyBookableProviders = providers.filter((provider) => provider.publiclyBookable)
  const guestEligibleProviders = viewerUserId
    ? publiclyBookableProviders
    : publiclyBookableProviders.filter((provider) => !provider.requireClientAccount)
  const providerPreferences = [
    ...(policy.anyProviderEnabled && guestEligibleProviders.length > 0 ? [{ id: "", label: "Any available provider" }] : []),
    ...guestEligibleProviders.map((provider) => ({ id: provider.userId, label: provider.label })),
  ]

  const bookingModel = {
    practiceId: practice.id,
    practiceSlug: practice.slug,
    practiceName: practice.name,
    timeZone: practice.timezone,
    viewer: {
      isSignedIn: Boolean(viewerUserId),
    },
    policy: {
      approvalMode: (policy.approvalMode === "AUTO_CONFIRM" ? "AUTO_CONFIRM" : "MANUAL") as "AUTO_CONFIRM" | "MANUAL",
      anyProviderEnabled: policy.anyProviderEnabled,
      requireClientAccount: policy.requireClientAccount,
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
    <BookingShell practiceName={practice.name} heroAside={<BookingRequestNotice />}>
      {primaryServices.length === 0 || providerPreferences.length === 0 ? (
        publiclyBookableProviders.length > 0 && !viewerUserId ? (
          <BookingShellSection>
            <AccountRequiredCard bookingPath={currentBookingPath} />
          </BookingShellSection>
        ) : (
          <BookingShellSection>
            <Card className="border-neutral-800 bg-card/90 backdrop-blur">
              <CardHeader>
                <CardTitle>No online booking times available</CardTitle>
                <CardDescription>The practice needs at least one active primary service, publicly bookable provider, and availability rule.</CardDescription>
              </CardHeader>
            </Card>
          </BookingShellSection>
        )
      ) : (
        <BookingPicker model={bookingModel} />
      )}
    </BookingShell>
  )
}

function BookingRequestNotice() {
  return (
    <Alert className="w-full border-border/80 bg-card/80 backdrop-blur">
      <CalendarDays />
      <div>
        <AlertTitle>Request an appointment</AlertTitle>
        <AlertDescription>These requests store scheduling details only. Clinical notes are not part of this booking flow.</AlertDescription>
      </div>
    </Alert>
  )
}

function BookingShell({ practiceName, heroAside, children }: { practiceName: string; heroAside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent py-4 sm:py-6 lg:py-8">
      <div className="space-y-5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 lg:gap-6">
            <div className="min-w-0 flex-1 basis-80">
              <p className="text-sm font-medium text-brand-orange">Online booking with</p>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground">{practiceName}</h1>
            </div>
            {heroAside ? (
              <div className="w-full min-[960px]:w-auto min-[960px]:max-w-xl min-[960px]:flex-1 min-[960px]:basis-[28rem]">
                {heroAside}
              </div>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function BookingShellSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      {children}
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

function AccountRequiredCard({ bookingPath }: { bookingPath: string }) {
  const loginHref = `/login?callbackUrl=${encodeURIComponent(bookingPath)}`
  const registerHref = `/register?callbackUrl=${encodeURIComponent(bookingPath)}`

  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole className="h-5 w-5 text-brand-orange" />
          Sign in to request an appointment
        </CardTitle>
        <CardDescription>
          This practice requires a free client account before booking. Accounts keep your contact details ready and make it easier to follow request status.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-wrap gap-2">
        <Button asChild className="w-fit bg-primary hover:bg-brand-orange-glow">
          <Link href={registerHref}>Create free account</Link>
        </Button>
        <Button asChild variant="outline" className="w-fit">
          <Link href={loginHref}>Sign in</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
