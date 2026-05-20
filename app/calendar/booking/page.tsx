import Link from "next/link"
import { CalendarCog, Clock, MapPin, SlidersHorizontal, UserRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import {
  saveBookingPolicyAction,
  saveProviderBookingPolicyAction,
  saveProviderCapacityRulesAction,
} from "@/app/calendar/actions"
import { normalizeBookingPolicy } from "@/lib/booking-policy"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
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

export default async function CalendarBookingSettingsPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return <BookingSettingsShell><Notice title="Sign in to manage booking" description="Online booking settings belong to a practice calendar." /></BookingSettingsShell>
  }

  if (!(await isCalendarDatabaseReady())) {
    return <BookingSettingsShell><Notice title="Calendar is temporarily unavailable" description="Booking settings are not available right now." /></BookingSettingsShell>
  }

  const membership = await prisma.practiceMembership.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "THERAPIST", "STAFF"] } },
    include: { practice: true },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    return <BookingSettingsShell><Notice title="No booking settings access" description="Create or join a practice calendar before managing online booking." /></BookingSettingsShell>
  }

  const practice = await prisma.practice.findUnique({
    where: { id: membership.practiceId },
    include: {
      bookingPolicy: true,
      providerBookingPolicies: true,
      providerBookingCapacityRules: {
        orderBy: [{ providerUserId: "asc" }, { period: "desc" }, { dayOfWeek: "asc" }, { pressureLevel: "asc" }],
      },
      memberships: {
        where: { role: { in: ["OWNER", "THERAPIST"] } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      serviceTypes: {
        where: { active: true },
        include: { variants: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { durationMinutes: "asc" }] } },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!practice) {
    return <BookingSettingsShell><Notice title="Practice not found" description="Choose a valid practice calendar." /></BookingSettingsShell>
  }

  const policy = normalizeBookingPolicy(practice.bookingPolicy)
  const canManagePracticePolicy = membership.role === "OWNER" || membership.role === "STAFF"
  const providerPolicyByUserId = new Map(practice.providerBookingPolicies.map((row) => [row.providerUserId, row]))

  return (
    <BookingSettingsShell>
      <Card className="border-border/80 bg-card/95 shadow-xl shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Online booking</Badge>
              <Badge variant="outline">{practice.timezone}</Badge>
            </div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarCog className="size-6 text-brand-orange" />
              Booking settings
            </CardTitle>
            <CardDescription>Approval mode, provider capacity, pressure limits, waitlist readiness, and public location notices.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/calendar/services">Services</Link></Button>
            <Button asChild variant="outline"><Link href="/calendar">Calendar</Link></Button>
          </div>
        </CardHeader>
      </Card>

      {canManagePracticePolicy ? (
        <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-brand-orange" />
              Practice booking policy
            </CardTitle>
            <CardDescription>These defaults control public booking before provider-specific capacity rules are applied.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveBookingPolicyAction} className="grid gap-4">
              <input type="hidden" name="practiceId" value={practice.id} />
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                  <Checkbox name="enabled" defaultChecked={policy.enabled} />
                  <span>Enable online booking</span>
                </label>
                <div className="space-y-2">
                  <Label>Approval mode</Label>
                  <Select name="approvalMode" defaultValue={policy.approvalMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">Manual approval</SelectItem>
                      <SelectItem value="AUTO_CONFIRM">Auto-confirm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Staff visibility</Label>
                  <Select name="staffVisibility" defaultValue={policy.staffVisibility}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC_LABELS">Show public labels</SelectItem>
                      <SelectItem value="HIDE_STAFF">Hide staff names</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minNoticeMinutes">Minimum notice minutes</Label>
                  <Input id="minNoticeMinutes" name="minNoticeMinutes" type="number" min="0" defaultValue={policy.minNoticeMinutes} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAdvanceDays">Max advance days</Label>
                  <Input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min="1" defaultValue={policy.maxAdvanceDays} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyAppointmentLimit">Practice daily appointment limit</Label>
                  <Input id="dailyAppointmentLimit" name="dailyAppointmentLimit" type="number" min="1" defaultValue={policy.dailyAppointmentLimit ?? ""} placeholder="No limit" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                  <Checkbox name="anyProviderEnabled" defaultChecked={policy.anyProviderEnabled} />
                  <span>Offer any-available provider</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                  <Checkbox name="teamSequencingEnabled" defaultChecked={policy.teamSequencingEnabled} />
                  <span>Allow team sequences</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                  <Checkbox name="dualTimezoneDisplay" defaultChecked={policy.dualTimezoneDisplay} />
                  <span>Show client-local time helper</span>
                </label>
              </div>

              <Separator />
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="publicLocationLabel">Public location label</Label>
                  <Input id="publicLocationLabel" name="publicLocationLabel" defaultValue={practice.publicLocationLabel ?? ""} placeholder="Downtown Columbus studio" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publicLatitude">Latitude</Label>
                  <Input id="publicLatitude" name="publicLatitude" type="number" step="0.000001" defaultValue={practice.publicLatitude ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publicLongitude">Longitude</Label>
                  <Input id="publicLongitude" name="publicLongitude" type="number" step="0.000001" defaultValue={practice.publicLongitude ?? ""} />
                </div>
                <label className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 p-3 text-sm md:col-span-2">
                  <Checkbox name="proximityNoticeEnabled" defaultChecked={policy.proximityNoticeEnabled} />
                  <span>Offer optional distance notice</span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="proximityRadiusMiles">Distance notice miles</Label>
                  <Input id="proximityRadiusMiles" name="proximityRadiusMiles" type="number" min="1" defaultValue={policy.proximityRadiusMiles} />
                </div>
              </div>

              <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">Save booking policy</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Notice title="Provider settings only" description="Therapists can manage their own public booking label, rest gap, and capacity rules. Owners and staff manage practice-wide policy." />
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {practice.memberships.map((provider) => {
          const providerPolicy = providerPolicyByUserId.get(provider.userId)
          const canManageProvider = membership.role !== "THERAPIST" || provider.userId === session.user.id
          const capacityRules = practice.providerBookingCapacityRules.filter((rule) => rule.providerUserId === provider.userId)
          const displayName = provider.user.name ?? provider.user.email ?? "Provider"

          return (
            <Card key={provider.userId} className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="size-5 text-brand-orange" />
                  {displayName}
                </CardTitle>
                <CardDescription>Rest gaps and massage-hour pressure capacity protect the provider&apos;s day and week.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form action={saveProviderBookingPolicyAction} className="grid gap-3">
                  <input type="hidden" name="practiceId" value={practice.id} />
                  <input type="hidden" name="providerUserId" value={provider.userId} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                      <Checkbox name="publiclyBookable" defaultChecked={providerPolicy?.publiclyBookable ?? true} disabled={!canManageProvider} />
                      <span>Publicly bookable</span>
                    </label>
                    <div className="space-y-2">
                      <Label>Public label</Label>
                      <Input name="displayLabel" defaultValue={providerPolicy?.displayLabel ?? ""} placeholder={displayName} disabled={!canManageProvider} />
                    </div>
                    <div className="space-y-2">
                      <Label>Rest minutes between sessions</Label>
                      <Input name="minRestMinutes" type="number" min="0" defaultValue={providerPolicy?.minRestMinutes ?? 0} disabled={!canManageProvider} />
                    </div>
                    <div className="space-y-2">
                      <Label>Daily appointment limit</Label>
                      <Input name="dailyAppointmentLimit" type="number" min="1" defaultValue={providerPolicy?.dailyAppointmentLimit ?? ""} placeholder="No limit" disabled={!canManageProvider} />
                    </div>
                    <div className="space-y-2">
                      <Label>Weekly appointment limit</Label>
                      <Input name="weeklyAppointmentLimit" type="number" min="1" defaultValue={providerPolicy?.weeklyAppointmentLimit ?? ""} placeholder="No limit" disabled={!canManageProvider} />
                    </div>
                  </div>
                  <Button type="submit" variant="outline" disabled={!canManageProvider}>Save provider policy</Button>
                </form>

                <Separator />

                <form action={saveProviderCapacityRulesAction} className="grid gap-3">
                  <input type="hidden" name="practiceId" value={practice.id} />
                  <input type="hidden" name="providerUserId" value={provider.userId} />
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-brand-orange" />
                    <p className="text-sm font-medium">Capacity rules</p>
                  </div>
                  <div className="grid gap-2">
                    {Array.from({ length: 12 }, (_, index) => {
                      const rule = capacityRules[index]
                      return (
                        <div key={rule?.id ?? index} className="grid gap-2 rounded-md border border-border/70 bg-background/60 p-2 md:grid-cols-[1fr_1fr_1fr_1fr]">
                          <Select name={`capacityPeriod${index}`} defaultValue={rule?.period ?? "WEEKLY"} disabled={!canManageProvider}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WEEKLY">Weekly</SelectItem>
                              <SelectItem value="DAILY">Daily</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select name={`capacityDayOfWeek${index}`} defaultValue={String(rule?.dayOfWeek ?? -1)} disabled={!canManageProvider}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-1">Any day</SelectItem>
                              {weekdays.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select name={`capacityPressureLevel${index}`} defaultValue={String(rule?.pressureLevel ?? 0)} disabled={!canManageProvider}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Total minutes</SelectItem>
                              {[1, 2, 3, 4, 5].map((level) => <SelectItem key={level} value={String(level)}>Pressure {level}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input name={`capacityMaxMinutes${index}`} type="number" min="0" defaultValue={rule?.maxMinutes ?? ""} placeholder="Max minutes" disabled={!canManageProvider} />
                        </div>
                      )
                    })}
                  </div>
                  <Button type="submit" variant="outline" disabled={!canManageProvider}>Save capacity rules</Button>
                </form>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border/80 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-brand-orange" />
            Service role guidance
          </CardTitle>
          <CardDescription>Primary services start a booking. Add-ons can be chained after a primary service.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {practice.serviceTypes.map((service) => (
            <Link key={service.id} href={`/calendar/services/${service.id}`} className="rounded-md border border-border/70 bg-background/60 p-3 hover:border-brand-orange/60">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">{service.variants.length} active variant{service.variants.length === 1 ? "" : "s"}</p>
                </div>
                <Badge variant={service.bookingRole === "PRIMARY" ? "secondary" : "outline"}>
                  {service.bookingRole === "PRIMARY" ? "Primary" : "Add-on"}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </BookingSettingsShell>
  )
}

function BookingSettingsShell({ children }: { children: React.ReactNode }) {
  return <CalendarOperatorShell width="wide">{children}</CalendarOperatorShell>
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
