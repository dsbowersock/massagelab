import Link from "next/link"
import { CalendarDays, Clock, Plus, ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { createPracticeAction } from "@/app/calendar/actions"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"

const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED"] as const

function calendarClientReady() {
  return Boolean((prisma as unknown as { practiceMembership?: unknown; practice?: unknown }).practiceMembership)
}

function formatDateTime(value: Date, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ practice?: string }>
}) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return (
      <CalendarShell>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Sign in to use practice scheduling</CardTitle>
            <CardDescription>Calendar data is cloud-backed practice metadata. Clinical notes remain local-first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </CalendarShell>
    )
  }

  if (!calendarClientReady()) {
    return (
      <CalendarShell>
        <CalendarSetupNotice />
      </CalendarShell>
    )
  }

  const selectedPracticeId = (await searchParams)?.practice
  let memberships

  try {
    memberships = await prisma.practiceMembership.findMany({
      where: { userId: session.user.id },
      include: {
        practice: true,
      },
      orderBy: { createdAt: "asc" },
    })
  } catch {
    return (
      <CalendarShell>
        <CalendarSetupNotice />
      </CalendarShell>
    )
  }

  if (memberships.length === 0) {
    return (
      <CalendarShell>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Create a practice calendar</CardTitle>
            <CardDescription>This creates a small-practice scheduling workspace with you as owner.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createPracticeAction} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="name">Practice name</Label>
                <Input id="name" name="name" placeholder="MassageLab Studio" required />
              </div>
              <Button type="submit" className="bg-[#ff7043] hover:bg-[#f4511e]">
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
            </form>
          </CardContent>
        </Card>
      </CalendarShell>
    )
  }

  const membership = memberships.find((row) => row.practiceId === selectedPracticeId) ?? memberships[0]
  const practice = membership.practice
  const [appointments, services, therapists] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        practiceId: practice.id,
        startsAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      include: {
        practiceClient: true,
        serviceType: true,
        therapist: { select: { name: true, email: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 30,
    }),
    prisma.serviceType.findMany({
      where: { practiceId: practice.id, active: true },
      orderBy: { durationMinutes: "asc" },
    }),
    prisma.practiceMembership.findMany({
      where: {
        practiceId: practice.id,
        role: { in: ["OWNER", "THERAPIST"] },
      },
      include: { user: { select: { name: true, email: true } } },
    }),
  ])

  return (
    <CalendarShell>
      <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <ShieldCheck className="mt-1 h-5 w-5 text-[#ff7043]" />
          <div>
            <CardTitle>Scheduling metadata only</CardTitle>
            <CardDescription>
              This module stores appointment logistics for practice coordination. SOAP notes, transcripts, and pain maps remain local-first.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#ff7043]" />
                {practice.name}
              </CardTitle>
              <CardDescription>Practice booking link: /book/{practice.slug}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/calendar/availability">Availability</Link>
              </Button>
              <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
                <Link href={`/book/${practice.slug}`}>Booking page</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.length > 0 ? (
              appointments.map((appointment) => (
                <div key={appointment.id} className="rounded-md border border-neutral-800 bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatDateTime(appointment.startsAt, practice.timezone)}</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.serviceType.name} with {appointment.therapist.name ?? appointment.therapist.email}
                      </p>
                    </div>
                    <span className="rounded-sm border border-neutral-700 px-2 py-1 text-xs text-muted-foreground">
                      {appointment.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Client: {appointment.practiceClient.displayName ?? appointment.practiceClient.email ?? "Client account"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No appointments yet. Add availability, then use the booking page to request an appointment.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>Client booking uses these active service durations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3 rounded-md bg-background/70 p-3">
                  <span>{service.name}</span>
                  <span className="text-sm text-muted-foreground">{service.durationMinutes} min</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Therapists</CardTitle>
              <CardDescription>Owners and therapists can receive bookings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {therapists.map((therapist) => (
                <div key={therapist.id} className="flex items-center gap-2 rounded-md bg-background/70 p-3">
                  <Clock className="h-4 w-4 text-[#ff7043]" />
                  <span>{therapist.user.name ?? therapist.user.email}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Conflict prevention</CardTitle>
              <CardDescription>
                Active appointments are checked in app logic and protected by a Postgres overlap constraint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Active statuses: {ACTIVE_STATUSES.join(", ")}. Cancelled, completed, and no-show appointments no longer block future booking.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </CalendarShell>
  )
}

function CalendarShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeading>Calendar</PageHeading>
        {children}
      </div>
    </div>
  )
}

function CalendarSetupNotice() {
  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle>Calendar setup needed</CardTitle>
        <CardDescription>
          The calendar module is installed, but the running app needs the generated Prisma client and database migration before practice scheduling can read data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Run `npm run prisma:generate`, apply the new migration, then restart the dev server.</p>
        <p>The rest of MassageLab remains available while scheduling setup is completed.</p>
      </CardContent>
    </Card>
  )
}
