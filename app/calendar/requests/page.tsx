import Link from "next/link"
import { Check, Clock, X } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { convertWaitlistEntryAction, updateAppointmentRequestStatusAction } from "@/app/calendar/actions"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { AppInset, AppSurface, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarOperatorShell } from "../calendar-operator-shell"

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

export default async function CalendarRequestsPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return <RequestsShell><Notice title="Sign in to review requests" description="Request review belongs to practice scheduling." /></RequestsShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <RequestsShell><Notice title="Calendar is temporarily unavailable" description="Appointment requests are not available right now." /></RequestsShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <RequestsShell><Notice title="No request review access" description="Owners, staff, and assigned therapists can review appointment requests." /></RequestsShell>
  }

  const [requests, waitlistEntries, providers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        practiceId: membership.practiceId,
        status: "REQUESTED",
        ...(membership.role === "THERAPIST" ? { therapistId: session.user.id } : {}),
      },
      include: {
        event: true,
        practiceClient: true,
        serviceType: true,
        therapist: { select: { name: true, email: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
    prisma.bookingWaitlistEntry.findMany({
      where: {
        practiceId: membership.practiceId,
        status: "OPEN",
      },
      include: {
        practiceClient: true,
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.practiceMembership.findMany({
      where: { practiceId: membership.practiceId, role: { in: ["OWNER", "THERAPIST"] } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])
  const waitlistVariantIds = [...new Set(waitlistEntries.flatMap((entry) => [
    entry.primaryServiceVariantId,
    ...entry.addOnServiceVariantIds,
  ]).filter(Boolean) as string[])]
  const waitlistVariants = await prisma.serviceVariant.findMany({
    where: { id: { in: waitlistVariantIds } },
    include: { serviceType: { select: { name: true } } },
  })
  const variantLabelById = new Map(waitlistVariants.map((variant) => [
    variant.id,
    `${variant.serviceType.name} · ${variant.name}`,
  ]))

  return (
    <RequestsShell>
      <Card className={appSurfaceClassName}>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Confirm or decline client appointment requests. Reviews create audit rows and internal notification intents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length > 0 ? requests.map((request) => (
            <AppInset key={request.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatDateTime(request.startsAt, membership.practice.timezone)}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.serviceType.name} with {request.therapist.name ?? request.therapist.email}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Client: {request.practiceClient.displayName ?? request.practiceClient.email ?? "Client account"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={updateAppointmentRequestStatusAction}>
                    <input type="hidden" name="appointmentId" value={request.id} />
                    <input type="hidden" name="status" value="CONFIRMED" />
                    <Button type="submit" size="sm" className="bg-primary hover:bg-brand-orange-glow">
                      <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                      Confirm
                    </Button>
                  </form>
                  <form action={updateAppointmentRequestStatusAction}>
                    <input type="hidden" name="appointmentId" value={request.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <Button type="submit" size="sm" variant="outline">
                      <X className="mr-2 h-4 w-4" aria-hidden="true" />
                      Decline
                    </Button>
                  </form>
                </div>
              </div>
            </AppInset>
          )) : (
            <p className="text-sm text-muted-foreground">No open appointment requests.</p>
          )}
        </CardContent>
      </Card>

      <Card className={appSurfaceClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand-orange" />
            Waitlist
          </CardTitle>
          <CardDescription>Convert capacity waitlist entries into confirmed appointments when a sequence opens up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {waitlistEntries.length > 0 ? waitlistEntries.map((entry) => {
            const serviceLabels = [
              entry.primaryServiceVariantId ? variantLabelById.get(entry.primaryServiceVariantId) : null,
              ...entry.addOnServiceVariantIds.map((id) => variantLabelById.get(id)),
            ].filter(Boolean)
            const startHelpId = `waitlist-start-help-${entry.id}`

            return (
              <AppInset key={entry.id} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                  <div>
                    <p className="font-medium">{serviceLabels.join(" + ") || "Requested services"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Client: {entry.practiceClient.displayName ?? entry.practiceClient.email ?? "Client account"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pressure preference: {entry.requestedPressureLevel}
                    </p>
                  </div>
                  <form action={convertWaitlistEntryAction} className="grid gap-3">
                    <input type="hidden" name="waitlistEntryId" value={entry.id} />
                    <div className="space-y-2">
                      <Label htmlFor={`waitlist-start-${entry.id}`}>Confirmed start</Label>
                      <Input id={`waitlist-start-${entry.id}`} name="startsAt" type="datetime-local" aria-describedby={startHelpId} required />
                      <p id={startHelpId} className="text-xs text-muted-foreground">
                        Enter the start time in {membership.practice.timezone}.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`waitlist-provider-${entry.id}`}>Primary provider</Label>
                      <select
                        id={`waitlist-provider-${entry.id}`}
                        name="preferredProviderId"
                        defaultValue={entry.preferredProviderId ?? providers[0]?.userId ?? ""}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {providers.map((provider) => (
                          <option key={provider.userId} value={provider.userId}>
                            {provider.user.name ?? provider.user.email ?? "Provider"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" size="sm" className="bg-primary hover:bg-brand-orange-glow">Convert to appointment</Button>
                  </form>
                </div>
              </AppInset>
            )
          }) : (
            <p className="text-sm text-muted-foreground">No open waitlist entries.</p>
          )}
        </CardContent>
      </Card>
    </RequestsShell>
  )
}

function RequestsShell({ children }: { children: React.ReactNode }) {
  return (
    <CalendarOperatorShell width="standard">
      <div className="flex justify-end">
        <Button asChild variant="outline"><Link href="/calendar">Back to calendar</Link></Button>
      </div>
      {children}
    </CalendarOperatorShell>
  )
}

function Notice({ title, description }: { title: string; description: string }) {
  return <AppSurface title={title} description={description} />
}
