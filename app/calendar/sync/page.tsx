import Link from "next/link"
import { ArrowLeft, CalendarClock, CheckCircle2, RefreshCw, Settings2, Unplug } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { CalendarOperatorShell } from "@/app/calendar/calendar-operator-shell"
import { AppInset, AppSurface, appSurfaceClassName } from "@/components/ui/app-surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getGoogleCalendarSyncAccess } from "@/lib/calendar-sync-access"
import { hasGoogleCalendarSyncConfig } from "@/lib/calendar-sync-env"
import { prisma } from "@/lib/prisma"
import {
  connectGoogleCalendarAction,
  disconnectGoogleCalendarAction,
  refreshGoogleCalendarAction,
  saveGoogleCalendarSourceSelectionAction,
} from "./actions"

const GOOGLE_SYNC_STATUS_MESSAGES = {
  access: "Calendar sync is available to provider accounts with external sync access.",
  connected: "Google Calendar is connected.",
  disconnected: "Google Calendar was disconnected.",
  error: "Google Calendar could not be connected. Try again from this page.",
  identity: "Google did not return the account identity needed to store this connection.",
  refresh: "Google did not return a refresh token. Reconnect and approve offline calendar access.",
  refreshed: "Google Calendar busy time was refreshed.",
  saved: "Blocking calendar selections saved.",
  state: "Google Calendar connection expired. Start the connection again.",
  unconfigured: "Google Calendar sync is not configured for this environment.",
} as const

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
  const googleStatus = typeof params?.google === "string" && Object.hasOwn(GOOGLE_SYNC_STATUS_MESSAGES, params.google)
    ? GOOGLE_SYNC_STATUS_MESSAGES[params.google as keyof typeof GOOGLE_SYNC_STATUS_MESSAGES]
    : null
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
        description="Choose which Google calendars should make you unavailable in MassageLab. You can come back here anytime to change these selections."
      >
        <Card className={appSurfaceClassName}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-5" aria-hidden="true" />
                  Google Calendar
                </CardTitle>
                <CardDescription>
                  Checked calendars are read as busy time only. MassageLab events are written to the dedicated MassageLab calendar.
                </CardDescription>
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
                {params?.google === "saved" ? " You can change these calendars later from this page." : ""}
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
                    <div className="grid gap-1">
                      <h2 className="text-sm font-medium">Calendars that block MassageLab scheduling</h2>
                      <p className="text-sm text-muted-foreground">
                        Select the Google calendars whose events should make you busy in MassageLab. Only event start and end times are used for conflict checks; titles, notes, locations, guests, and other details are not imported.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        You can update this list later from this page.
                      </p>
                    </div>
                    {connection.sources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No Google calendars found yet. Refresh sync after reconnecting.</p>
                    ) : connection.sources.map((source) => (
                      <label key={source.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                        <input
                          type="checkbox"
                          name="sourceId"
                          value={source.id}
                          defaultChecked={source.selectedForBusySync}
                          className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                        />
                        <span>
                          <span className="block font-medium">{source.label ?? "Google calendar"}</span>
                          <span className="block text-muted-foreground">
                            When selected, events on this calendar block overlapping MassageLab bookings.
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button type="submit" variant="secondary" className="w-fit">
                    <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                    Save blocking calendars
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

                <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                  <Button asChild variant="outline">
                    <Link href="/calendar">
                      <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                      Back to calendar
                    </Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/calendar/new">
                      <Settings2 className="mr-2 size-4" aria-hidden="true" />
                      Calendar tools
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </AppSurface>
    </CalendarOperatorShell>
  )
}
