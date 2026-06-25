import type { Prisma } from "@prisma/client"
import { calendarSyncWindow, GOOGLE_CALENDAR_PROVIDER } from "./calendar-sync-constants.ts"
import { getGoogleCalendarSyncConfig } from "./calendar-sync-env.ts"
import { decryptCalendarSyncSecret, encryptCalendarSyncSecret } from "./calendar-sync-secrets.ts"
import { createGoogleCalendarAdapter, type GoogleCalendarAdapter } from "./google-calendar-adapter.ts"
import {
  buildGoogleOutboundEventPayload,
  normalizeGoogleBusyBlock,
  sanitizeCalendarSyncError,
} from "./calendar-sync-normalization.ts"
import { prisma } from "./prisma.ts"

type CalendarDb = typeof prisma | Prisma.TransactionClient

export function selectedSourceUpdates({
  existingSources,
  selectedProviderCalendarIds,
}: {
  existingSources: Array<{ providerCalendarId: string }>
  selectedProviderCalendarIds: string[]
}) {
  const selected = new Set(selectedProviderCalendarIds)
  return existingSources.map((source) => ({
    providerCalendarId: source.providerCalendarId,
    selectedForBusySync: selected.has(source.providerCalendarId),
  }))
}

export function syncRunSuccessPatch({
  finishedAt,
  itemsSeen,
  itemsChanged,
}: {
  finishedAt: Date
  itemsSeen: number
  itemsChanged: number
}) {
  return {
    status: "SUCCEEDED" as const,
    finishedAt,
    itemsSeen,
    itemsChanged,
    errorCode: null,
    errorMessage: null,
  }
}

export function syncRunFailurePatch({ finishedAt, error }: { finishedAt: Date; error: unknown }) {
  return {
    status: "FAILED" as const,
    finishedAt,
    errorCode: "SYNC_FAILED",
    errorMessage: sanitizeCalendarSyncError(error),
  }
}

export async function refreshGoogleAccessToken(
  connectionId: string,
  adapter: GoogleCalendarAdapter = createGoogleCalendarAdapter(),
) {
  const config = getGoogleCalendarSyncConfig()
  if (!config) throw new Error("Google calendar sync is not configured.")

  const connection = await prisma.calendarConnection.findUnique({ where: { id: connectionId } })
  if (!connection || connection.provider !== GOOGLE_CALENDAR_PROVIDER || connection.status !== "ACTIVE") {
    throw new Error("Choose an active Google calendar connection.")
  }

  if (connection.encryptedAccessToken && connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptCalendarSyncSecret(connection.encryptedAccessToken)
  }

  const refreshToken = decryptCalendarSyncSecret(connection.encryptedRefreshToken)
  const token = await adapter.refreshAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
  })
  const accessTokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null

  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptCalendarSyncSecret(token.access_token),
      accessTokenExpiresAt,
      grantedScopes: token.scope ?? connection.grantedScopes,
      status: "ACTIVE",
      statusReason: null,
    },
  })

  return token.access_token
}

export async function syncGoogleConnectionSources({
  connectionId,
  adapter = createGoogleCalendarAdapter(),
  now = new Date(),
}: {
  connectionId: string
  adapter?: GoogleCalendarAdapter
  now?: Date
}) {
  const accessToken = await refreshGoogleAccessToken(connectionId, adapter)
  const connection = await prisma.calendarConnection.findUnique({
    where: { id: connectionId },
    include: { sources: true },
  })
  if (!connection) throw new Error("Choose an active Google calendar connection.")

  const window = calendarSyncWindow(now)
  let itemsSeen = 0
  let itemsChanged = 0

  for (const source of connection.sources.filter((item) => item.selectedForBusySync)) {
    const run = await prisma.calendarSyncRun.create({
      data: {
        connectionId: connection.id,
        sourceId: source.id,
        direction: "INBOUND",
        status: "STARTED",
        windowStart: window.startsAt,
        windowEnd: window.endsAt,
      },
    })

    try {
      const payload = await adapter.listEvents({
        accessToken,
        calendarId: source.providerCalendarId,
        timeMin: source.syncToken ? undefined : window.startsAt.toISOString(),
        timeMax: source.syncToken ? undefined : window.endsAt.toISOString(),
        syncToken: source.syncToken,
      })
      const blocks = (payload.items ?? [])
        .map((event) => normalizeGoogleBusyBlock({
          ownerUserId: connection.userId,
          connectionId: connection.id,
          sourceId: source.id,
          providerCalendarId: source.providerCalendarId,
          event,
        }))
        .filter((block): block is NonNullable<typeof block> => Boolean(block))

      itemsSeen += payload.items?.length ?? 0
      itemsChanged += blocks.length

      await prisma.$transaction(async (tx) => {
        for (const block of blocks) {
          await tx.externalCalendarBusyBlock.upsert({
            where: {
              sourceId_providerEventId: {
                sourceId: source.id,
                providerEventId: block.providerEventId,
              },
            },
            create: block,
            update: {
              providerEventEtag: block.providerEventEtag,
              startsAt: block.startsAt,
              endsAt: block.endsAt,
              timezone: block.timezone,
              allDay: block.allDay,
              transparency: block.transparency,
              status: block.status,
              cancelledAt: block.cancelledAt,
            },
          })
        }
        await tx.externalCalendarSource.update({
          where: { id: source.id },
          data: {
            syncToken: payload.nextSyncToken ?? source.syncToken,
            lastIncrementalSyncAt: source.syncToken ? new Date() : source.lastIncrementalSyncAt,
            lastFullSyncAt: source.syncToken ? source.lastFullSyncAt : new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        })
        await tx.calendarSyncRun.update({
          where: { id: run.id },
          data: syncRunSuccessPatch({
            finishedAt: new Date(),
            itemsSeen: payload.items?.length ?? 0,
            itemsChanged: blocks.length,
          }),
        })
      })
    } catch (error) {
      await prisma.calendarSyncRun.update({
        where: { id: run.id },
        data: syncRunFailurePatch({ finishedAt: new Date(), error }),
      })
      await prisma.externalCalendarSource.update({
        where: { id: source.id },
        data: { lastErrorCode: "SYNC_FAILED", lastErrorMessage: sanitizeCalendarSyncError(error) },
      })
    }
  }

  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  })

  return { itemsSeen, itemsChanged }
}

export async function upsertGoogleCalendarSources({
  db = prisma,
  connectionId,
  calendars,
}: {
  db?: CalendarDb
  connectionId: string
  calendars: Array<{ id: string; summary?: string; timeZone?: string; primary?: boolean }>
}) {
  for (const calendar of calendars) {
    await db.externalCalendarSource.upsert({
      where: {
        connectionId_providerCalendarId: {
          connectionId,
          providerCalendarId: calendar.id,
        },
      },
      create: {
        connectionId,
        providerCalendarId: calendar.id,
        label: calendar.summary ?? null,
        timezone: calendar.timeZone ?? null,
        selectedForBusySync: Boolean(calendar.primary),
      },
      update: {
        label: calendar.summary ?? null,
        timezone: calendar.timeZone ?? null,
      },
    })
  }
}

export function calendarEventShouldPushToGoogle(event: { kind?: string | null; ownerUserId?: string | null; status?: string | null }) {
  return Boolean(event.ownerUserId && ["APPOINTMENT", "CLASS", "PERSONAL"].includes(String(event.kind ?? "")))
}

export function outboundSyncActionForStatus(status?: string | null) {
  if (status === "CANCELLED") return "DELETE" as const
  if (status === "COMPLETED" || status === "NO_SHOW") return "SKIP" as const
  return "UPSERT" as const
}

export async function pushCalendarEventToGoogle(
  calendarEventId: string,
  adapter: GoogleCalendarAdapter = createGoogleCalendarAdapter(),
) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: calendarEventId },
    include: { externalCalendarLinks: true },
  })
  if (!event || !calendarEventShouldPushToGoogle(event) || !event.ownerUserId) return { skipped: true }

  const connection = await prisma.calendarConnection.findFirst({
    where: {
      userId: event.ownerUserId,
      provider: GOOGLE_CALENDAR_PROVIDER,
      status: "ACTIVE",
      dedicatedCalendarId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  })
  if (!connection?.dedicatedCalendarId) return { skipped: true }

  const accessToken = await refreshGoogleAccessToken(connection.id, adapter)
  const existingLink = event.externalCalendarLinks.find((link) => link.connectionId === connection.id) ?? null
  const action = outboundSyncActionForStatus(event.status)

  if (action === "SKIP") return { skipped: true }

  if (action === "DELETE" && existingLink) {
    await adapter.deleteEvent({
      accessToken,
      calendarId: connection.dedicatedCalendarId,
      eventId: existingLink.providerEventId,
    })
    await prisma.externalCalendarEventLink.delete({ where: { id: existingLink.id } })
    return { deleted: true }
  }

  if (action === "DELETE") return { skipped: true }

  const payload = buildGoogleOutboundEventPayload({
    calendarEventId: event.id,
    kind: event.kind,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
  })
  const pushed = await adapter.upsertEvent({
    accessToken,
    calendarId: connection.dedicatedCalendarId,
    eventId: existingLink?.providerEventId ?? null,
    payload,
  })

  await prisma.externalCalendarEventLink.upsert({
    where: {
      connectionId_calendarEventId: {
        connectionId: connection.id,
        calendarEventId: event.id,
      },
    },
    create: {
      connectionId: connection.id,
      calendarEventId: event.id,
      provider: GOOGLE_CALENDAR_PROVIDER,
      providerCalendarId: connection.dedicatedCalendarId,
      providerEventId: pushed.id,
      providerEventEtag: pushed.etag ?? null,
      lastPushedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    update: {
      providerCalendarId: connection.dedicatedCalendarId,
      providerEventId: pushed.id,
      providerEventEtag: pushed.etag ?? null,
      lastPushedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })

  return { pushed: true }
}
