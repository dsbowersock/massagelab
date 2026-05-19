import Link from "next/link"
import * as React from "react"
import { CalendarOff, Clock } from "lucide-react"
import { getCurrentSession } from "@/auth"
import {
  createAvailabilityOverrideAction,
  createAvailabilityRuleAction,
  createAvailabilityScheduleAction,
  createCalendarBlockAction,
} from "@/app/calendar/actions"
import { formatMinuteLabel } from "@/lib/calendar"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
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
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/calendar">Open calendar</Link>
            </Button>
          </CardContent>
        </Card>
      </AvailabilityShell>
    )
  }

  const [therapists, rules, schedules, overrides, blocks] = await Promise.all([
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
    prisma.calendarAvailabilitySchedule.findMany({
      where: { practiceId: membership.practiceId },
      include: {
        therapist: { select: { name: true, email: true } },
        intervals: {
          orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
        },
      },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.calendarAvailabilityOverride.findMany({
      where: { practiceId: membership.practiceId },
      include: {
        therapist: { select: { name: true, email: true } },
        intervals: {
          orderBy: { startMinute: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: 40,
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
      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
          <TabsTrigger value="blocks">Blocks</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-orange" />
                Weekly working hours
              </CardTitle>
              <CardDescription>Add fallback weekly availability for {membership.practice.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createAvailabilityRuleAction} className="grid gap-4">
                <input type="hidden" name="practiceId" value={membership.practiceId} />
                <ProviderAndDayFields therapists={therapists} defaultTherapistId={defaultTherapistId} />
                <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Add weekly hours</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Named schedules</CardTitle>
              <CardDescription>Use date-ranged schedules for seasonal hours, alternate routines, or provider-specific availability plans.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createAvailabilityScheduleAction} className="grid gap-4">
                <input type="hidden" name="practiceId" value={membership.practiceId} />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Schedule name</Label>
                    <Input id="name" name="name" defaultValue="Primary schedule" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="effectiveFrom">Effective from</Label>
                    <Input id="effectiveFrom" name="effectiveFrom" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="effectiveTo">Effective to</Label>
                    <Input id="effectiveTo" name="effectiveTo" type="date" />
                  </div>
                </div>
                <ProviderAndDayFields therapists={therapists} defaultTherapistId={defaultTherapistId} />
                <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Add schedule interval</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>One-time changes and blackout days</CardTitle>
              <CardDescription>Closed, blackout, and holiday overrides take precedence over one-time open intervals and recurring schedules.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createAvailabilityOverrideAction} className="grid gap-4">
                <input type="hidden" name="practiceId" value={membership.practiceId} />
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Therapist</Label>
                    <ProviderSelect therapists={therapists} defaultTherapistId={defaultTherapistId} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" name="date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="kind" defaultValue="OPEN">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Open interval</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                        <SelectItem value="BLACKOUT">Blackout</SelectItem>
                        <SelectItem value="HOLIDAY">Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Input id="reason" name="reason" placeholder="Workshop, holiday, admin" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overrideStart">Open start</Label>
                    <Input id="overrideStart" name="startTime" type="time" defaultValue="09:00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overrideEnd">Open end</Label>
                    <Input id="overrideEnd" name="endTime" type="time" defaultValue="17:00" />
                  </div>
                </div>
                <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Add override</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-brand-orange" />
                Personal block
              </CardTitle>
              <CardDescription>Blocks remove time from client booking and therapist scheduling.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createCalendarBlockAction} className="grid gap-4">
                <input type="hidden" name="practiceId" value={membership.practiceId} />
                <input type="hidden" name="returnTo" value="/calendar/availability" />
                <div className="space-y-2">
                  <Label>Therapist</Label>
                  <ProviderSelect therapists={therapists} defaultTherapistId={defaultTherapistId} />
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
                <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Add block</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-4 lg:grid-cols-3">
            <AvailabilityList title="Weekly rules" empty="No weekly rules yet.">
              {rules.map((rule) => (
                <AvailabilityRow key={rule.id} title={`${weekdays[rule.dayOfWeek]?.[1] ?? "Day"}: ${formatMinuteLabel(rule.startMinute)} - ${formatMinuteLabel(rule.endMinute)}`} detail={rule.therapist.name ?? rule.therapist.email ?? "Provider"} />
              ))}
            </AvailabilityList>
            <AvailabilityList title="Named schedules" empty="No named schedules yet.">
              {schedules.map((schedule) => (
                <AvailabilityRow key={schedule.id} title={schedule.name} detail={`${schedule.therapist.name ?? schedule.therapist.email ?? "Provider"} · ${schedule.intervals.map((interval) => `${weekdays[interval.dayOfWeek]?.[1] ?? "Day"} ${formatMinuteLabel(interval.startMinute)}-${formatMinuteLabel(interval.endMinute)}`).join(", ")}`} />
              ))}
            </AvailabilityList>
            <AvailabilityList title="Overrides" empty="No one-time overrides yet.">
              {overrides.map((override) => (
                <AvailabilityRow key={override.id} title={`${override.kind}: ${override.date.toISOString().slice(0, 10)}`} detail={`${override.therapist.name ?? override.therapist.email ?? "Provider"}${override.reason ? ` · ${override.reason}` : ""}${override.intervals.length > 0 ? ` · ${override.intervals.map((interval) => `${formatMinuteLabel(interval.startMinute)}-${formatMinuteLabel(interval.endMinute)}`).join(", ")}` : ""}`} />
              ))}
            </AvailabilityList>
          </div>
        </TabsContent>
      </Tabs>

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

function ProviderSelect({
  therapists,
  defaultTherapistId,
}: {
  therapists: Array<{ userId: string; user: { name: string | null; email: string | null } }>
  defaultTherapistId: string
}) {
  return (
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
  )
}

function ProviderAndDayFields({
  therapists,
  defaultTherapistId,
}: {
  therapists: Array<{ userId: string; user: { name: string | null; email: string | null } }>
  defaultTherapistId: string
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <Label>Therapist</Label>
        <ProviderSelect therapists={therapists} defaultTherapistId={defaultTherapistId} />
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
  )
}

function AvailabilityList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {React.Children.count(children) > 0 ? children : <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  )
}

function AvailabilityRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-background/70 p-3">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
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
