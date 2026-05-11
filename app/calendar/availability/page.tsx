import Link from "next/link"
import { CalendarOff, Clock } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { createAvailabilityRuleAction, createCalendarBlockAction } from "@/app/calendar/actions"
import { formatMinuteLabel } from "@/lib/calendar"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const weekdays = [
  ["0", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
] as const

function formatDateTime(value: Date, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

export default async function CalendarAvailabilityPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return (
      <AvailabilityShell>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Sign in to manage availability</CardTitle>
            <CardDescription>Availability belongs to a practice calendar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </AvailabilityShell>
    )
  }

  if (!(await isCalendarDatabaseReady())) {
    return (
      <AvailabilityShell>
        <CalendarUnavailableNotice />
      </AvailabilityShell>
    )
  }

  let membership

  try {
    membership = await prisma.practiceMembership.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ["OWNER", "THERAPIST"] },
      },
      include: { practice: true },
      orderBy: { createdAt: "asc" },
    })
  } catch {
    return (
      <AvailabilityShell>
        <CalendarUnavailableNotice />
      </AvailabilityShell>
    )
  }

  if (!membership) {
    return (
      <AvailabilityShell>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>No therapist calendar yet</CardTitle>
            <CardDescription>Create or join a practice calendar before setting availability.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
              <Link href="/calendar">Open calendar</Link>
            </Button>
          </CardContent>
        </Card>
      </AvailabilityShell>
    )
  }

  const [therapists, rules, blocks] = await Promise.all([
    prisma.practiceMembership.findMany({
      where: {
        practiceId: membership.practiceId,
        role: { in: ["OWNER", "THERAPIST"] },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.therapistAvailabilityRule.findMany({
      where: { practiceId: membership.practiceId },
      include: { therapist: { select: { name: true, email: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    }),
    prisma.calendarBlock.findMany({
      where: {
        practiceId: membership.practiceId,
        endsAt: { gte: new Date() },
      },
      include: { therapist: { select: { name: true, email: true } } },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
  ])

  const defaultTherapistId = therapists[0]?.userId ?? session.user.id

  return (
    <AvailabilityShell>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#ff7043]" />
              Working hours
            </CardTitle>
            <CardDescription>Add repeating weekly availability for {membership.practice.name}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAvailabilityRuleAction} className="grid gap-4">
              <input type="hidden" name="practiceId" value={membership.practiceId} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Therapist</Label>
                  <Select name="therapistId" defaultValue={defaultTherapistId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {therapists.map((therapist) => (
                        <SelectItem key={therapist.userId} value={therapist.userId}>
                          {therapist.user.name ?? therapist.user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select name="dayOfWeek" defaultValue="1">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekdays.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start</Label>
                  <Input id="startTime" name="startTime" type="time" defaultValue="09:00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End</Label>
                  <Input id="endTime" name="endTime" type="time" defaultValue="17:00" required />
                </div>
              </div>
              <Button type="submit" className="bg-[#ff7043] hover:bg-[#f4511e]">Add working hours</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-[#ff7043]" />
              Block time
            </CardTitle>
            <CardDescription>Blocks remove time from client booking and therapist scheduling.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCalendarBlockAction} className="grid gap-4">
              <input type="hidden" name="practiceId" value={membership.practiceId} />
              <div className="space-y-2">
                <Label>Therapist</Label>
                <Select name="therapistId" defaultValue={defaultTherapistId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {therapists.map((therapist) => (
                      <SelectItem key={therapist.userId} value={therapist.userId}>
                        {therapist.user.name ?? therapist.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startsAt">Starts</Label>
                  <Input id="startsAt" name="startsAt" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endsAt">Ends</Label>
                  <Input id="endsAt" name="endsAt" type="datetime-local" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" name="reason" placeholder="Lunch, admin, unavailable" />
              </div>
              <Button type="submit" className="bg-[#ff7043] hover:bg-[#f4511e]">Add block</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Current rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length > 0 ? rules.map((rule) => (
              <div key={rule.id} className="rounded-md border border-neutral-800 bg-background/70 p-3">
                <p className="font-medium">{weekdays[rule.dayOfWeek]?.[1] ?? "Day"}: {formatMinuteLabel(rule.startMinute)} - {formatMinuteLabel(rule.endMinute)}</p>
                <p className="text-sm text-muted-foreground">{rule.therapist.name ?? rule.therapist.email}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No working hours yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Upcoming blocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blocks.length > 0 ? blocks.map((block) => (
              <div key={block.id} className="rounded-md border border-neutral-800 bg-background/70 p-3">
                <p className="font-medium">{formatDateTime(block.startsAt, membership.practice.timezone)} - {formatDateTime(block.endsAt, membership.practice.timezone)}</p>
                <p className="text-sm text-muted-foreground">{block.therapist.name ?? block.therapist.email}{block.reason ? ` · ${block.reason}` : ""}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No upcoming blocked time.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AvailabilityShell>
  )
}

function AvailabilityShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeading>Calendar Availability</PageHeading>
          <Button asChild variant="outline">
            <Link href="/calendar">Back to calendar</Link>
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
        <CardTitle>Calendar is temporarily unavailable</CardTitle>
        <CardDescription>Availability tools are not available right now. Please try again later.</CardDescription>
      </CardHeader>
    </Card>
  )
}
