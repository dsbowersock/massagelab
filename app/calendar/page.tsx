import Link from "next/link"
import { Clock, ClipboardList, Plus, Settings2, ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { createPracticeAction } from "@/app/calendar/actions"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { normalizeCalendarPreferences } from "@/lib/calendar-preferences"
import { buildCalendarWorkspaceEvent } from "@/lib/calendar-workspace"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { CalendarWorkspace } from "./calendar-workspace"

const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED", "ACTIVE"] as const

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
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </CalendarShell>
    )
  }

  if (!(await isCalendarDatabaseReady())) {
    return (
      <CalendarShell>
        <CalendarUnavailableNotice />
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
        <CalendarUnavailableNotice />
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
              <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">
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
  const [events, services, therapists, preferenceRow, requestCount] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        practiceId: practice.id,
        startsAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        endsAt: { lte: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
      },
      include: {
        owner: { select: { name: true, email: true } },
        appointment: {
          include: {
            practiceClient: true,
            serviceType: true,
            serviceVariant: true,
            therapist: { select: { name: true, email: true } },
          },
        },
        personalBlock: {
          include: { therapist: { select: { name: true, email: true } } },
        },
        class: {
          include: { instructor: { select: { name: true, email: true } } },
        },
        reminder: true,
      },
      orderBy: { startsAt: "asc" },
      take: 500,
    }),
    prisma.serviceType.findMany({
      where: { practiceId: practice.id, active: true },
      include: {
        variants: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { durationMinutes: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.practiceMembership.findMany({
      where: {
        practiceId: practice.id,
        role: { in: ["OWNER", "THERAPIST"] },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: { calendarPreferences: true },
    }),
    prisma.appointment.count({
      where: { practiceId: practice.id, status: "REQUESTED" },
    }),
  ])
  const preferences = normalizeCalendarPreferences(preferenceRow?.calendarPreferences ?? {})
  const providers = therapists.map((therapist) => ({
    id: therapist.userId,
    label: therapist.user.name ?? therapist.user.email ?? "Provider",
  }))
  const workspaceEvents = events.map((event) => buildCalendarWorkspaceEvent(event, preferences))

  return (
    <CalendarShell>
      <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <ShieldCheck className="mt-1 h-5 w-5 text-brand-orange" />
          <div>
            <CardTitle>Scheduling metadata only</CardTitle>
            <CardDescription>
              Calendar events coordinate appointments, personal blocks, classes, and reminders. SOAP notes, transcripts, and pain maps remain local-first.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>{practice.name}</CardTitle>
                <CardDescription>Practice booking link: /book/{practice.slug}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/calendar/requests">Requests{requestCount ? ` (${requestCount})` : ""}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/calendar/availability">Availability</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/calendar/services">Services</Link>
                </Button>
                <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                  <Link href="/calendar/new">New item</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
          <CalendarWorkspace
            events={workspaceEvents}
            providers={providers}
            preferences={preferences}
            currentUserId={session.user.id}
          />
        </div>

        <div className="space-y-4">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-brand-orange" />
                Services
              </CardTitle>
              <CardDescription>Client booking and classes use service variants for duration, buffers, pricing, and resources.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3 rounded-md bg-background/70 p-3">
                  <div>
                    <span>{service.name}</span>
                    <p className="text-xs text-muted-foreground">{service.variants.length} active variant{service.variants.length === 1 ? "" : "s"}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {service.variants[0]?.durationMinutes ?? service.durationMinutes} min
                  </span>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full">
                <Link href="/calendar/services">Manage services</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Therapists</CardTitle>
              <CardDescription>Owners and therapists can receive bookings and blocking events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {therapists.map((therapist) => (
                <div key={therapist.id} className="flex items-center gap-2 rounded-md bg-background/70 p-3">
                  <Clock className="h-4 w-4 text-brand-orange" />
                  <span>{therapist.user.name ?? therapist.user.email}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-brand-orange" />
                Event index
              </CardTitle>
              <CardDescription>
                Active blocking events share one conflict model for appointments, personal blocks, and classes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Blocking statuses: {ACTIVE_STATUSES.join(", ")}. Cancelled, completed, and no-show events no longer block future booking.
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

function CalendarUnavailableNotice() {
  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle>Calendar is temporarily unavailable</CardTitle>
        <CardDescription>Practice scheduling is not available right now.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>Please try again later or contact support if this keeps happening.</p>
      </CardContent>
    </Card>
  )
}
