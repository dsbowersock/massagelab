import Link from "next/link"
import * as React from "react"
import { CalendarDays, CalendarOff, Clock, Layers3 } from "lucide-react"
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
import { AppSurface, appSurfaceClassName } from "@/components/ui/app-surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarOperatorShell } from "../calendar-operator-shell"

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

function formatPracticeDate(value: Date, timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export default async function CalendarAvailabilityPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return (
      <AvailabilityShell>
        <AppSurface title="Sign in to manage availability" description="Availability belongs to a practice calendar.">
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/login">Go to login</Link>
            </Button>
        </AppSurface>
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
        <AppSurface title="No therapist calendar yet" description="Create or join a practice calendar before setting availability.">
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/calendar">Open calendar</Link>
            </Button>
        </AppSurface>
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
  const activeRuleCount = rules.filter((rule) => rule.active).length
  const upcomingBlockCount = blocks.length
  const activeScheduleCount = schedules.filter((schedule) => schedule.active).length

  return (
    <AvailabilityShell>
      <Card className={appSurfaceClassName}>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Availability</Badge>
              <Badge variant="outline">{membership.practice.timezone}</Badge>
            </div>
            <CardTitle className="text-2xl">Provider schedules</CardTitle>
            <CardDescription>Baseline working hours, one-time changes, and blocked time for {membership.practice.name}.</CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/calendar">Back to calendar</Link>
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryMetric icon={Clock} label="Active rules" value={activeRuleCount} />
        <SummaryMetric icon={CalendarOff} label="Upcoming blocks" value={upcomingBlockCount} />
        <SummaryMetric icon={Layers3} label="Active schedules" value={activeScheduleCount} />
      </div>

      <WeeklyAvailabilityPlanner rules={rules} timeZone={membership.practice.timezone} />

      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="weekly">Working hours</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
          <TabsTrigger value="blocks">Blocked time</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className={appSurfaceClassName}>
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
                <ProviderAndDayFields idPrefix="weekly-rule" therapists={therapists} defaultTherapistId={defaultTherapistId} />
                <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Add weekly hours</Button>
              </form>
            </CardContent>
          </Card>

          <Card className={appSurfaceClassName}>
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
                <ProviderAndDayFields idPrefix="named-schedule" therapists={therapists} defaultTherapistId={defaultTherapistId} />
                <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Add schedule interval</Button>
              </form>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="overrides">
          <Card className={appSurfaceClassName}>
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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className={appSurfaceClassName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarOff data-icon="inline-start" className="text-brand-orange" />
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

          <AvailabilityList title="Upcoming blocks" empty="No upcoming blocked time.">
            {blocks.map((block) => (
              <AvailabilityRow
                key={block.id}
                title={`${formatDateTime(block.startsAt, membership.practice.timezone)} - ${formatDateTime(block.endsAt, membership.practice.timezone)}`}
                detail={`${block.therapist.name ?? block.therapist.email}${block.reason ? ` · ${block.reason}` : ""}`}
              />
            ))}
          </AvailabilityList>
          </div>
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
                <AvailabilityRow key={override.id} title={`${override.kind}: ${formatPracticeDate(override.date, membership.practice.timezone)}`} detail={`${override.therapist.name ?? override.therapist.email ?? "Provider"}${override.reason ? ` · ${override.reason}` : ""}${override.intervals.length > 0 ? ` · ${override.intervals.map((interval) => `${formatMinuteLabel(interval.startMinute)}-${formatMinuteLabel(interval.endMinute)}`).join(", ")}` : ""}`} />
              ))}
            </AvailabilityList>
          </div>
        </TabsContent>
      </Tabs>

    </AvailabilityShell>
  )
}

function AvailabilityShell({ children }: { children: React.ReactNode }) {
  return <CalendarOperatorShell width="wide">{children}</CalendarOperatorShell>
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
}) {
  return (
    <Card className={appSurfaceClassName}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-md border border-border/70 bg-background/70">
          <Icon className="size-4 text-brand-orange" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function WeeklyAvailabilityPlanner({
  rules,
  timeZone,
}: {
  rules: Array<{
    id: string
    dayOfWeek: number
    startMinute: number
    endMinute: number
    active: boolean
    therapist: { name: string | null; email: string | null }
  }>
  timeZone: string
}) {
  const activeRules = rules.filter((rule) => rule.active)
  const dayRows = weekdays.map(([value, label]) => ({
    value,
    label,
    rules: activeRules.filter((rule) => String(rule.dayOfWeek) === value),
  }))

  return (
    <Card className={appSurfaceClassName}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays data-icon="inline-start" className="text-brand-orange" />
              Weekly planner
            </CardTitle>
            <CardDescription>Current baseline working hours grouped by weekday. Overrides and blackout days still take priority.</CardDescription>
          </div>
          <Badge variant="outline">{timeZone}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 lg:grid-cols-7">
          {dayRows.map((day) => (
            <div key={day.value} className="min-h-36 rounded-lg border border-border/70 bg-background/50 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{day.label.slice(0, 3)}</p>
                <Badge variant={day.rules.length > 0 ? "secondary" : "outline"}>{day.rules.length}</Badge>
              </div>
              <div className="space-y-2">
                {day.rules.length > 0 ? day.rules.map((rule) => (
                  <div key={rule.id} className="rounded-md border border-border/70 bg-card/70 p-2">
                    <p className="text-sm font-medium">
                      {formatMinuteLabel(rule.startMinute)} - {formatMinuteLabel(rule.endMinute)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {rule.therapist.name ?? rule.therapist.email ?? "Provider"}
                    </p>
                  </div>
                )) : (
                  <p className="rounded-md border border-dashed border-border/70 p-2 text-xs text-muted-foreground">Closed or unset</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <p className="text-xs text-muted-foreground">
          Resolution order: blackout or closed day, one-time override, active named schedule, then weekly fallback.
        </p>
      </CardContent>
    </Card>
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
  idPrefix,
  therapists,
  defaultTherapistId,
}: {
  idPrefix: string
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
        <Label htmlFor={`${idPrefix}-startTime`}>Start</Label>
        <Input id={`${idPrefix}-startTime`} name="startTime" type="time" defaultValue="09:00" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-endTime`}>End</Label>
        <Input id={`${idPrefix}-endTime`} name="endTime" type="time" defaultValue="17:00" required />
      </div>
    </div>
  )
}

function AvailabilityList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <Card className={appSurfaceClassName}>
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
    <div className="rounded-md border border-border/70 bg-background/60 p-3">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function CalendarUnavailableNotice() {
  return <AppSurface title="Calendar is temporarily unavailable" description="Availability tools are not available right now. Please try again later." />
}
