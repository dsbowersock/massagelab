import Link from "next/link"
import { CalendarOff } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { createPersonalEventAction } from "@/app/calendar/actions"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { AppSurface, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarOperatorShell } from "../../calendar-operator-shell"

export default async function NewPersonalEventPage({
  searchParams,
}: {
  searchParams?: Promise<{ startsAt?: string }>
}) {
  const session = await getCurrentSession()
  const defaultStartsAt = (await searchParams)?.startsAt ?? ""

  if (!session?.user?.id) {
    return <PersonalShell><Notice title="Sign in to block time" description="Personal calendar blocks belong to a practice calendar." /></PersonalShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <PersonalShell><Notice title="Calendar is temporarily unavailable" description="Personal event creation is not available right now." /></PersonalShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <PersonalShell><Notice title="No therapist calendar yet" description="Owners and therapists can create personal blocked time." /></PersonalShell>
  }

  const therapists = await prisma.practiceMembership.findMany({
    where: {
      practiceId: membership.practiceId,
      role: { in: ["OWNER", "THERAPIST"] },
      ...(membership.role === "THERAPIST" ? { userId: session.user.id } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })

  return (
    <PersonalShell>
      <Card className={appSurfaceClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            Personal Event
          </CardTitle>
          <CardDescription>Block non-clinical time from availability without creating an appointment record.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPersonalEventAction} className="grid gap-4">
            <input type="hidden" name="practiceId" value={membership.practiceId} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Therapist</Label>
                <Select name="therapistId" defaultValue={therapists[0]?.userId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {therapists.map((therapist) => (
                      <SelectItem key={therapist.userId} value={therapist.userId}>{therapist.user.name ?? therapist.user.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Label</Label>
                <Input id="reason" name="reason" placeholder="Lunch, admin, unavailable" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startsAt">Starts</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={defaultStartsAt} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Ends</Label>
                <Input id="endsAt" name="endsAt" type="datetime-local" required />
              </div>
            </div>
            <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Create personal event</Button>
          </form>
        </CardContent>
      </Card>
    </PersonalShell>
  )
}

function PersonalShell({ children }: { children: React.ReactNode }) {
  return (
    <CalendarOperatorShell width="standard">
      <div className="flex justify-end">
        <Button asChild variant="outline"><Link href="/calendar/new">Creation menu</Link></Button>
      </div>
      {children}
    </CalendarOperatorShell>
  )
}

function Notice({ title, description }: { title: string; description: string }) {
  return <AppSurface title={title} description={description} />
}
