import Link from "next/link"
import { CalendarDays, CalendarOff, ClipboardList, Plus, Settings2, UsersRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

const flowCards = [
  {
    title: "Appointment",
    description: "Create a confirmed staff appointment for an existing practice client.",
    href: "/calendar/new/appointment",
    icon: Plus,
  },
  {
    title: "Personal event",
    description: "Block non-clinical practitioner time from availability.",
    href: "/calendar/new/personal",
    icon: CalendarOff,
  },
  {
    title: "Class",
    description: "Create a group class with capacity, instructor, room, and visibility.",
    href: "/calendar/new/class",
    icon: UsersRound,
  },
  {
    title: "Reminder",
    description: "Create an operational reminder without clinical note content.",
    href: "/calendar/new/reminder",
    icon: ClipboardList,
  },
  {
    title: "Service",
    description: "Manage service variants, duration, buffers, resources, and operational policies.",
    href: "/calendar/services",
    icon: Settings2,
  },
  {
    title: "Requests",
    description: "Review client appointment requests and confirm or decline them.",
    href: "/calendar/requests",
    icon: CalendarDays,
  },
]

export default async function NewCalendarItemPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return (
      <CalendarCreateShell>
        <CalendarCard title="Sign in to create calendar items" description="Calendar creation belongs to practice scheduling." />
      </CalendarCreateShell>
    )
  }

  if (!(await isCalendarDatabaseReady())) {
    return (
      <CalendarCreateShell>
        <CalendarCard title="Calendar is temporarily unavailable" description="Creation tools are not available right now. Please try again later." />
      </CalendarCreateShell>
    )
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return (
      <CalendarCreateShell>
        <CalendarCard title="No practice calendar yet" description="Create or join a practice before adding calendar items." />
      </CalendarCreateShell>
    )
  }

  return (
    <CalendarCreateShell>
      <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
        <CardHeader>
          <CardTitle>{membership.practice.name}</CardTitle>
          <CardDescription>
            Create scheduling metadata only. Do not add SOAP notes, pain maps, transcripts, or clinical details to calendar payloads.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {flowCards.map((flow) => {
          const Icon = flow.icon

          return (
            <Card key={flow.href} className="border-neutral-800 bg-card/90 backdrop-blur transition-colors hover:bg-accent">
              <CardHeader>
                <Icon className="mb-2 h-5 w-5 text-brand-orange" aria-hidden="true" />
                <CardTitle>{flow.title}</CardTitle>
                <CardDescription>{flow.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={flow.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </CalendarCreateShell>
  )
}

function CalendarCreateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeading>New Calendar Item</PageHeading>
          <Button asChild variant="outline">
            <Link href="/calendar">Back to calendar</Link>
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CalendarCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
