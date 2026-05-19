import Link from "next/link"
import { UsersRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { createClassAction } from "@/app/calendar/actions"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default async function NewClassPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return <ClassShell><Notice title="Sign in to create classes" description="Class creation belongs to practice scheduling." /></ClassShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <ClassShell><Notice title="Calendar is temporarily unavailable" description="Class creation is not available right now." /></ClassShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "STAFF"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <ClassShell><Notice title="Practice scheduling access required" description="Owners and staff can create class events." /></ClassShell>
  }

  const [instructors, services] = await Promise.all([
    prisma.practiceMembership.findMany({
      where: { practiceId: membership.practiceId, role: { in: ["OWNER", "THERAPIST"] } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.serviceType.findMany({
      where: { practiceId: membership.practiceId, active: true, classEligible: true },
      include: {
        variants: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { durationMinutes: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
  ])
  const serviceOptions = services.flatMap((service) => service.variants.map((variant) => ({
    id: variant.id,
    label: `${service.name} - ${variant.name} (${variant.durationMinutes} min)`,
  })))

  return (
    <ClassShell>
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            Class
          </CardTitle>
          <CardDescription>Create a group class with capacity and client-facing visibility controls.</CardDescription>
        </CardHeader>
        <CardContent>
          {serviceOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a class-eligible service before adding class events. Service variants set class duration, buffers, and required resources.
            </p>
          ) : (
          <form action={createClassAction} className="grid gap-4">
            <input type="hidden" name="practiceId" value={membership.practiceId} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Class title</Label>
                <Input id="title" name="title" placeholder="Mobility class" required />
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select name="serviceVariantId" defaultValue={serviceOptions[0]?.id}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map((service) => (
                      <SelectItem key={service.id} value={service.id}>{service.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Instructor</Label>
                <Select name="instructorId" defaultValue={instructors[0]?.userId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {instructors.map((instructor) => (
                      <SelectItem key={instructor.userId} value={instructor.userId}>{instructor.user.name ?? instructor.user.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startsAt">Starts</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input id="capacity" name="capacity" type="number" min="1" defaultValue="8" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roomResource">Room or resource</Label>
                <Input id="roomResource" name="roomResource" placeholder="Studio A" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="clientVisible" />
              <span>Client-facing class</span>
            </label>
            <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Create class</Button>
          </form>
          )}
        </CardContent>
      </Card>
    </ClassShell>
  )
}

function ClassShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeading>Class</PageHeading>
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
