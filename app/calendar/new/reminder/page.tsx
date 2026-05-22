import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { createReminderAction } from "@/app/calendar/actions"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { AppSurface, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarOperatorShell } from "../../calendar-operator-shell"

export default async function NewReminderPage({
  searchParams,
}: {
  searchParams?: Promise<{ startsAt?: string }>
}) {
  const session = await getCurrentSession()
  const defaultStartsAt = (await searchParams)?.startsAt ?? ""

  if (!session?.user?.id) {
    return <ReminderShell><Notice title="Sign in to create reminders" description="Calendar reminders belong to a practice calendar." /></ReminderShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <ReminderShell><Notice title="Calendar is temporarily unavailable" description="Reminder creation is not available right now." /></ReminderShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <ReminderShell><Notice title="No practice calendar yet" description="Create or join a practice before creating reminders." /></ReminderShell>
  }

  const targets = await prisma.practiceMembership.findMany({
    where: {
      practiceId: membership.practiceId,
      role: { in: ["OWNER", "THERAPIST"] },
      ...(membership.role === "THERAPIST" ? { userId: session.user.id } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })

  return (
    <ReminderShell>
      <Card className={appSurfaceClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            Reminder
          </CardTitle>
          <CardDescription>Create an operational reminder. Keep clinical note content out of reminder payloads.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createReminderAction} className="grid gap-4">
            <input type="hidden" name="practiceId" value={membership.practiceId} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Reminder title</Label>
                <Input id="title" name="title" placeholder="Confirm room setup" required />
              </div>
              <div className="space-y-2">
                <Label>For</Label>
                <Select name="targetUserId" defaultValue={targets[0]?.userId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {targets.map((target) => (
                      <SelectItem key={target.userId} value={target.userId}>{target.user.name ?? target.user.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startsAt">When</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={defaultStartsAt} required />
              </div>
              <div className="space-y-2">
                <Label>Related to</Label>
                <Select name="relatedKind" defaultValue="GENERAL">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="APPOINTMENT">Appointment</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="CLASS">Class</SelectItem>
                    <SelectItem value="PERSONAL">Personal task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="relatedId">Related ID</Label>
                <Input id="relatedId" name="relatedId" placeholder="Optional appointment, class, or client identifier" />
              </div>
            </div>
            <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Create reminder</Button>
          </form>
        </CardContent>
      </Card>
    </ReminderShell>
  )
}

function ReminderShell({ children }: { children: React.ReactNode }) {
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
