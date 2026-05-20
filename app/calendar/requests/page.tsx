import Link from "next/link"
import { Check, X } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { updateAppointmentRequestStatusAction } from "@/app/calendar/actions"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  const requests = await prisma.appointment.findMany({
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
  })

  return (
    <RequestsShell>
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Confirm or decline client appointment requests. Reviews create audit rows and internal notification intents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length > 0 ? requests.map((request) => (
            <div key={request.id} className="rounded-md border border-neutral-800 bg-background/70 p-4">
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
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No open appointment requests.</p>
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
  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
