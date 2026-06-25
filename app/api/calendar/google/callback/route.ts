import { type NextRequest, NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import { getGoogleCalendarSyncConfig } from "@/lib/calendar-sync-env"
import { createGoogleCalendarAdapter } from "@/lib/google-calendar-adapter"
import {
  saveGoogleCalendarConnection,
  syncGoogleConnectionSources,
  upsertGoogleCalendarSources,
} from "@/lib/calendar-sync-service"

export async function GET(request: NextRequest) {
  const session = await getCurrentSession()
  const baseUrl = getSiteUrl()

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", baseUrl))
  }

  const config = getGoogleCalendarSyncConfig()
  if (!config) {
    return NextResponse.redirect(new URL("/calendar/sync?google=unconfigured", baseUrl))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const expectedState = request.cookies.get("massagelab_google_calendar_state")?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/calendar/sync?google=state", baseUrl))
  }

  const adapter = createGoogleCalendarAdapter()
  const token = await adapter.exchangeCode({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    code,
  })

  if (!token.refresh_token) {
    return NextResponse.redirect(new URL("/calendar/sync?google=refresh", baseUrl))
  }

  const calendars = await adapter.listCalendars(token.access_token)
  const dedicatedCalendar = await adapter.ensureDedicatedCalendar(token.access_token)
  const connection = await saveGoogleCalendarConnection({
    userId: session.user.id,
    providerAccountId: session.user.email ?? session.user.id,
    accountEmail: session.user.email,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    grantedScopes: token.scope,
    dedicatedCalendarId: dedicatedCalendar.id,
    dedicatedCalendarSummary: dedicatedCalendar.summary,
  })

  await upsertGoogleCalendarSources({ connectionId: connection.id, calendars })
  await syncGoogleConnectionSources({ connectionId: connection.id, adapter })

  const response = NextResponse.redirect(new URL("/calendar/sync?google=connected", baseUrl))
  response.cookies.delete("massagelab_google_calendar_state")
  return response
}
