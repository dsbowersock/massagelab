import Link from "next/link"
import { getCurrentSession } from "@/auth"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"
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
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeading>New Service</PageHeading>
          <Button asChild variant="outline"><Link href="/calendar/services">Services</Link></Button>
        </div>
        {children}
      </div>
    </div>
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
