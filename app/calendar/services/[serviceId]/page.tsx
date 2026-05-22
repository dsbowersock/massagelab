import Link from "next/link"
import { notFound } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { CalendarOperatorShell } from "../../calendar-operator-shell"
import { ServiceForm } from "../service-form"

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const session = await getCurrentSession()
  const { serviceId } = await params

  if (!session?.user?.id) {
    return <ServiceShell><Notice title="Sign in to edit services" description="Service management requires an account." /></ServiceShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <ServiceShell><Notice title="Calendar is temporarily unavailable" description="Service tools are not available right now." /></ServiceShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <ServiceShell><Notice title="No calendar workspace" description="Create or join a calendar workspace before editing services." /></ServiceShell>
  }

  const [service, providers] = await Promise.all([
    prisma.serviceType.findFirst({
      where: { id: serviceId, practiceId: membership.practiceId },
      include: {
        variants: {
          include: {
            resourceRequirements: {
              include: { resource: true },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { durationMinutes: "asc" }],
        },
      },
    }),
    prisma.practiceMembership.findMany({
      where: {
        practiceId: membership.practiceId,
        role: { in: ["OWNER", "THERAPIST"] },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  if (!service) {
    notFound()
  }

  return (
    <ServiceShell>
      <ServiceForm practiceId={membership.practiceId} providers={providers} service={service} />
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
