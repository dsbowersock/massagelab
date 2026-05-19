import Link from "next/link"
import { Settings2 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

export default async function ServicesPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return <ServicesShell><Notice title="Sign in to manage services" description="Service management requires an account." /></ServicesShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <ServicesShell><Notice title="Calendar is temporarily unavailable" description="Service tools are not available right now." /></ServicesShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <ServicesShell><Notice title="No calendar workspace" description="Create or join a calendar workspace before managing services." /></ServicesShell>
  }

  const services = await prisma.serviceType.findMany({
    where: { practiceId: membership.practiceId },
    include: {
      variants: {
        orderBy: [{ sortOrder: "asc" }, { durationMinutes: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <ServicesShell>
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-brand-orange" />
              Services
            </CardTitle>
            <CardDescription>Service variants drive appointment and class duration, buffers, pricing display, and resources.</CardDescription>
          </div>
          <Button asChild className="bg-primary hover:bg-brand-orange-glow">
            <Link href="/calendar/services/new">New service</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.length > 0 ? services.map((service) => (
            <Link key={service.id} href={`/calendar/services/${service.id}`} className="block rounded-md border border-neutral-800 bg-background/70 p-4 hover:border-brand-orange/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.category ?? "Uncategorized"} · {service.modality ?? "No modality"} · {service.variants.length} variant{service.variants.length === 1 ? "" : "s"}
                  </p>
                  {service.bodyRegions.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{service.bodyRegions.join(", ")}</p>
                  ) : null}
                </div>
                <span className="rounded-sm border border-neutral-700 px-2 py-1 text-xs text-muted-foreground">
                  {service.active ? "Active" : "Inactive"} · {service.clientVisible ? "Bookable" : "Internal"}
                </span>
              </div>
            </Link>
          )) : (
            <p className="text-sm text-muted-foreground">No services yet. Add a service before opening client booking.</p>
          )}
        </CardContent>
      </Card>
    </ServicesShell>
  )
}

function ServicesShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeading>Services</PageHeading>
          <Button asChild variant="outline"><Link href="/calendar">Calendar</Link></Button>
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
