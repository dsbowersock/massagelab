import Link from "next/link"
import { CalendarDays, CalendarOff, ClipboardList, Plus, Settings2, UsersRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { CalendarOperatorShell } from "../calendar-operator-shell"

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

export default async function NewCalendarItemPage({
  searchParams,
}: {
  searchParams?: Promise<{ startsAt?: string }>
}) {
  const session = await getCurrentSession()
  const startsAt = (await searchParams)?.startsAt ?? ""

  function withStartsAt(href: string) {
    return startsAt ? `${href}?startsAt=${encodeURIComponent(startsAt)}` : href
  }

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
      <AppSurface
        title={membership.practice.name}
        description={
          <>
            Create scheduling metadata only. Do not add SOAP notes, pain maps, transcripts, or clinical details to calendar payloads.
          </>
        }
        className={appCalloutClassName}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {flowCards.map((flow) => {
          const Icon = flow.icon

          return (
            <AppSurface
              key={flow.href}
              title={flow.title}
              description={flow.description}
              icon={<Icon className="h-5 w-5" aria-hidden="true" />}
              className="transition-colors hover:bg-accent"
            >
                <Button asChild variant="outline">
                  <Link href={withStartsAt(flow.href)}>Open</Link>
                </Button>
            </AppSurface>
          )
        })}
      </div>
    </CalendarCreateShell>
  )
}

function CalendarCreateShell({ children }: { children: React.ReactNode }) {
  return (
    <CalendarOperatorShell width="standard">
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/calendar">Back to calendar</Link>
        </Button>
      </div>
      {children}
    </CalendarOperatorShell>
  )
}

function CalendarCard({ title, description }: { title: string; description: string }) {
  return <AppSurface title={title} description={description} />
}
