import { type NextRequest, NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import { getGoogleCalendarSyncAccess } from "@/lib/calendar-sync-access"
import { getGoogleCalendarSyncConfig } from "@/lib/calendar-sync-env"
import { createGoogleCalendarAdapter } from "@/lib/google-calendar-adapter"
import {
  saveGoogleCalendarConnection,
  syncGoogleConnectionSources,
  upsertGoogleCalendarSources,
} from "@/lib/calendar-sync-service"

function redirectToCalendarSync(baseUrl: string, status: string) {
  const response = NextResponse.redirect(new URL(`/calendar/sync?google=${status}`, baseUrl))
  response.cookies.delete("massagelab_google_calendar_state")
  return response
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession()
  const baseUrl = getSiteUrl()

  if (!session?.user?.id) {
    const response = NextResponse.redirect(new URL("/login", baseUrl))
    response.cookies.delete("massagelab_google_calendar_state")
    return response
  }
  const access = await getGoogleCalendarSyncAccess(session.user.id)
  if (!access.allowed) {
    return redirectToCalendarSync(baseUrl, "access")
  }

  const config = getGoogleCalendarSyncConfig()
  if (!config) {
    return redirectToCalendarSync(baseUrl, "unconfigured")
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const expectedState = request.cookies.get("massagelab_google_calendar_state")?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToCalendarSync(baseUrl, "state")
  }

  const adapter = createGoogleCalendarAdapter()
  try {
    const token = await adapter.exchangeCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
    })

    if (!token.refresh_token) {
      return redirectToCalendarSync(baseUrl, "refresh")
    }
    if (!token.googleUserId) {
      return redirectToCalendarSync(baseUrl, "identity")
    }

    const calendars = await adapter.listCalendars(token.access_token)
    const dedicatedCalendar = await adapter.ensureDedicatedCalendar(token.access_token)
    const connection = await saveGoogleCalendarConnection({
      userId: session.user.id,
      providerAccountId: token.googleUserId,
      accountEmail: token.googleUserEmail ?? null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      grantedScopes: token.scope,
      dedicatedCalendarId: dedicatedCalendar.id,
      dedicatedCalendarSummary: dedicatedCalendar.summary,
    })

    await upsertGoogleCalendarSources({
      connectionId: connection.id,
      calendars,
      excludedProviderCalendarIds: [dedicatedCalendar.id],
    })
    await syncGoogleConnectionSources({ connectionId: connection.id, adapter })
  } catch {
    return redirectToCalendarSync(baseUrl, "error")
  }

  const response = NextResponse.redirect(new URL("/calendar/sync?google=connected", baseUrl))
  response.cookies.delete("massagelab_google_calendar_state")
  return response
}
