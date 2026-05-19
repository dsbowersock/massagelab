import Link from "next/link"
import { getCurrentSession } from "@/auth"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"
import { AppointmentComposer } from "./appointment-composer"

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams?: Promise<{ startsAt?: string }>
}) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return <AppointmentShell><Notice title="Sign in to create appointments" description="Practice scheduling requires an account." /></AppointmentShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <AppointmentShell><Notice title="Calendar is temporarily unavailable" description="Appointment creation is not available right now." /></AppointmentShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <AppointmentShell><Notice title="No practice calendar yet" description="Create or join a practice before creating appointments." /></AppointmentShell>
  }

  const [therapists, clients, services] = await Promise.all([
    prisma.practiceMembership.findMany({
      where: {
        practiceId: membership.practiceId,
        role: { in: ["OWNER", "THERAPIST"] },
        ...(membership.role === "THERAPIST" ? { userId: session.user.id } : {}),
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.practiceClient.findMany({
      where: { practiceId: membership.practiceId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.serviceType.findMany({
      where: { practiceId: membership.practiceId, active: true },
      include: {
        variants: {
          where: { active: true },
          include: {
            resourceRequirements: {
              include: { resource: true },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { durationMinutes: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
  ])
  const serviceOptions = services.flatMap((service) => service.variants.map((variant) => ({
    id: variant.id,
    serviceName: service.name,
    variantName: variant.name,
    label: `${service.name} - ${variant.name}`,
    durationMinutes: variant.durationMinutes,
    processingMinutes: variant.processingMinutes,
    bufferBeforeMinutes: variant.bufferBeforeMinutes,
    bufferAfterMinutes: variant.bufferAfterMinutes,
    priceCents: variant.priceCents,
    currency: variant.currency,
    eligibleProviderIds: service.eligibleProviderIds,
    resourceNames: variant.resourceRequirements.map((requirement) => requirement.resource.name),
  })))
  const defaultStartsAt = (await searchParams)?.startsAt ?? ""

  return (
    <AppointmentShell>
      {clients.length === 0 || serviceOptions.length === 0 || therapists.length === 0 ? (
        <Notice title="Appointment setup needed" description="Appointment creation needs at least one practice client, active service, and therapist. Client booking requests create practice clients automatically." />
      ) : (
        <AppointmentComposer
          practiceId={membership.practiceId}
          therapists={therapists.map((therapist) => ({
            id: therapist.userId,
            label: therapist.user.name ?? therapist.user.email ?? "Provider",
          }))}
          clients={clients.map((client) => ({
            id: client.id,
            label: client.displayName ?? client.email ?? "Client account",
            email: client.email,
            phone: client.phone,
          }))}
          services={serviceOptions}
          defaultStartsAt={defaultStartsAt}
        />
      )}
    </AppointmentShell>
  )
}

function AppointmentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeading>Appointment</PageHeading>
          <Button asChild variant="outline"><Link href="/calendar/new">Creation menu</Link></Button>
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
