import Link from "next/link"
import { CalendarClock, CheckCircle2, RefreshCw, Unplug } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { CalendarOperatorShell } from "@/app/calendar/calendar-operator-shell"
import { AppInset, AppSurface, appSurfaceClassName } from "@/components/ui/app-surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { hasGoogleCalendarSyncConfig } from "@/lib/calendar-sync-env"
import { prisma } from "@/lib/prisma"
import {
  connectGoogleCalendarAction,
  disconnectGoogleCalendarAction,
  refreshGoogleCalendarAction,
  saveGoogleCalendarSourceSelectionAction,
} from "./actions"

export default async function CalendarSyncPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return (
      <CalendarOperatorShell width="full">
        <AppSurface title="Sign in to connect calendars" description="Calendar sync belongs to provider accounts.">
          <Button asChild><Link href="/login">Go to login</Link></Button>
        </AppSurface>
      </CalendarOperatorShell>
    )
  }

  const [connection] = await prisma.calendarConnection.findMany({
    where: { userId: session.user.id, provider: "GOOGLE" },
    include: { sources: { orderBy: [{ selectedForBusySync: "desc" }, { label: "asc" }] } },
    orderBy: { updatedAt: "desc" },
    take: 1,
  })
  const configured = hasGoogleCalendarSyncConfig()

  return (
    <CalendarOperatorShell width="full">
      <AppSurface
        title="Calendar sync"
        description="Connect provider calendars as scheduling availability only. Personal Google event details stay out of practice views."
      >
        <Card className={appSurfaceClassName}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-5" aria-hidden="true" />
                  Google Calendar
                </CardTitle>
                <CardDescription>Read selected calendars as busy time and write MassageLab events to a dedicated MassageLab calendar.</CardDescription>
              </div>
              <Badge variant={connection?.status === "ACTIVE" ? "default" : "outline"}>
                {connection?.status ?? (configured ? "Not connected" : "Not configured")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            {!configured && (
              <AppInset className="p-4 text-sm text-muted-foreground">
                Google calendar sync is not configured for this environment.
              </AppInset>
            )}

            {configured && !connection && (
              <form action={connectGoogleCalendarAction}>
                <Button type="submit">Connect Google Calendar</Button>
              </form>
            )}

            {connection && (
              <>
                <div className="grid gap-2 text-sm">
                  <p><span className="font-medium">Account:</span> {connection.accountEmail ?? "Google account"}</p>
                  <p><span className="font-medium">Dedicated calendar:</span> {connection.dedicatedCalendarSummary ?? "MassageLab"}</p>
                  <p><span className="font-medium">Last sync:</span> {connection.lastSyncedAt ? connection.lastSyncedAt.toLocaleString() : "Not synced yet"}</p>
                </div>

                <form action={saveGoogleCalendarSourceSelectionAction} className="grid gap-3">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <div className="grid gap-2">
                    <h2 className="text-sm font-medium">Busy calendars</h2>
                    {connection.sources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No Google calendars found yet. Refresh sync after reconnecting.</p>
                    ) : connection.sources.map((source) => (
                      <label key={source.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                        <Checkbox name="sourceId" value={source.id} defaultChecked={source.selectedForBusySync} />
                        <span>
                          <span className="block font-medium">{source.label ?? "Google calendar"}</span>
                          <span className="block text-muted-foreground">Busy time only. Event titles and details are not imported.</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button type="submit" variant="secondary" className="w-fit">
                    <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                    Save busy calendars
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2">
                  <form action={refreshGoogleCalendarAction}>
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <Button type="submit" variant="outline">
                      <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                      Refresh now
                    </Button>
                  </form>
                  <form action={disconnectGoogleCalendarAction}>
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <Button type="submit" variant="outline">
                      <Unplug className="mr-2 size-4" aria-hidden="true" />
                      Disconnect
                    </Button>
                  </form>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </AppSurface>
    </CalendarOperatorShell>
  )
}
