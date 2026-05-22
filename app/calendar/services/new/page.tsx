import Link from "next/link"
import { getCurrentSession } from "@/auth"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { CalendarOperatorShell } from "../../calendar-operator-shell"
import { ServiceForm } from "../service-form"

export default async function NewServicePage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return <ServiceShell><Notice title="Sign in to create services" description="Service management requires an account." /></ServiceShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <ServiceShell><Notice title="Calendar is temporarily unavailable" description="Service tools are not available right now." /></ServiceShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <ServiceShell><Notice title="No calendar workspace" description="Create or join a calendar workspace before creating services." /></ServiceShell>
  }

  const providers = await prisma.practiceMembership.findMany({
    where: {
      practiceId: membership.practiceId,
      role: { in: ["OWNER", "THERAPIST"] },
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })

  return (
    <ServiceShell>
      <ServiceForm practiceId={membership.practiceId} providers={providers} />
    </ServiceShell>
  )
}

function ServiceShell({ children }: { children: React.ReactNode }) {
  return (
    <CalendarOperatorShell width="standard">
      <div className="flex justify-end">
        <Button asChild variant="outline"><Link href="/calendar/services">Services</Link></Button>
      </div>
      {children}
    </CalendarOperatorShell>
  )
}

function Notice({ title, description }: { title: string; description: string }) {
  return <AppSurface title={title} description={description} />
}
