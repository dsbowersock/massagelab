import Link from "next/link"
import { CalendarClock, CheckCircle2, RefreshCw, Unplug } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { CalendarOperatorShell } from "@/app/calendar/calendar-operator-shell"
import { AppInset, AppSurface, appSurfaceClassName } from "@/components/ui/app-surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { getGoogleCalendarSyncAccess } from "@/lib/calendar-sync-access"
import { hasGoogleCalendarSyncConfig } from "@/lib/calendar-sync-env"
import { prisma } from "@/lib/prisma"
import {
  connectGoogleCalendarAction,
  disconnectGoogleCalendarAction,
  refreshGoogleCalendarAction,
  saveGoogleCalendarSourceSelectionAction,
} from "./actions"

const GOOGLE_SYNC_STATUS_MESSAGES: Record<string, string> = {
  access: "Calendar sync is available to provider accounts with external sync access.",
  connected: "Google Calendar is connected.",
  error: "Google Calendar could not be connected. Try again from this page.",
  identity: "Google did not return the account identity needed to store this connection.",
  refresh: "Google did not return a refresh token. Reconnect and approve offline calendar access.",
  state: "Google Calendar connection expired. Start the connection again.",
  unconfigured: "Google Calendar sync is not configured for this environment.",
}

export default async function CalendarSyncPage({
  searchParams,
}: {
  searchParams?: Promise<{ google?: string }>
}) {
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

  const params = await searchParams
  const googleStatus = params?.google ? GOOGLE_SYNC_STATUS_MESSAGES[params.google] : null
  const [connection, access] = await Promise.all([
    prisma.calendarConnection.findFirst({
      where: { userId: session.user.id, provider: "GOOGLE", status: "ACTIVE" },
      include: { sources: { orderBy: [{ selectedForBusySync: "desc" }, { label: "asc" }] } },
      orderBy: { updatedAt: "desc" },
    }),
    getGoogleCalendarSyncAccess(session.user.id),
  ])
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
            {googleStatus && (
              <AppInset className="p-4 text-sm text-muted-foreground">
                {googleStatus}
              </AppInset>
            )}
            {!access.allowed && (
              <AppInset className="p-4 text-sm text-muted-foreground">
                Calendar sync is available to provider accounts with external calendar sync access.
              </AppInset>
            )}
            {!access.allowed && connection && (
              <form action={disconnectGoogleCalendarAction}>
                <input type="hidden" name="connectionId" value={connection.id} />
                <Button type="submit" variant="outline">
                  <Unplug className="mr-2 size-4" aria-hidden="true" />
                  Disconnect Google Calendar
                </Button>
              </form>
            )}

            {configured && access.allowed && !connection && (
              <form action={connectGoogleCalendarAction}>
                <Button type="submit">Connect Google Calendar</Button>
              </form>
            )}

            {access.allowed && connection && (
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
