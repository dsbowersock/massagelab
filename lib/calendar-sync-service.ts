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
const GOOGLE_API_STATUS_ERROR_PATTERN = /^Google Calendar request failed with status (\d+)\.$/

/**
 * Produces source selection updates without deleting source rows.
 * Existing calendars remain available for later re-selection.
 */
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

/** Builds the successful CalendarSyncRun patch shared by inbound sync writes. */
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

/** Builds the failed CalendarSyncRun patch with a sanitized provider error. */
export function syncRunFailurePatch({ finishedAt, error }: { finishedAt: Date; error: unknown }) {
  return {
    status: "FAILED" as const,
    finishedAt,
    errorCode: "SYNC_FAILED",
    errorMessage: sanitizeCalendarSyncError(error),
  }
}

/** Extracts the sanitized Google API status code from adapter errors. */
export function googleCalendarSyncErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "")
  const match = GOOGLE_API_STATUS_ERROR_PATTERN.exec(message)
  return match ? Number(match[1]) : null
}

/**
 * Builds the source failure patch. Google 410 means the incremental sync token
 * is stale, so the next run must fall back to a time-windowed full import.
 */
export function syncSourceFailurePatch(error: unknown) {
  const patch = {
    lastErrorCode: "SYNC_FAILED" as const,
    lastErrorMessage: sanitizeCalendarSyncError(error),
  }
  return googleCalendarSyncErrorStatus(error) === 410
    ? { ...patch, syncToken: null }
    : patch
}

/**
 * Returns cancelled Google tombstones that no longer include usable event times.
 * These must delete existing busy rows because they cannot be normalized.
 */
export function cancelledGoogleEventIds(
  events: Array<{ id?: string | null; status?: string | null; start?: unknown; end?: unknown }>,
) {
  return events
    .filter((event) => event.status === "cancelled" && Boolean(event.id) && !event.start && !event.end)
    .map((event) => String(event.id))
}

/**
 * Returns a usable access token for an active Google connection.
 * Cached encrypted access tokens are reused until near expiry; otherwise the
 * stored refresh token is exchanged and the refreshed token is persisted.
 */
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

/**
 * Imports selected Google calendars into generic busy blocks for one connection.
 * It locks the parent connection row while writing busy data so scheduling
 * transactions can coordinate against concurrent inbound sync writes.
 */
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
      const events = payload.items ?? []
      const deletedProviderEventIds = cancelledGoogleEventIds(events)
      const blocks = events
        .map((event) => normalizeGoogleBusyBlock({
          ownerUserId: connection.userId,
          connectionId: connection.id,
          sourceId: source.id,
          providerCalendarId: source.providerCalendarId,
          sourceTimezone: source.timezone,
          event,
        }))
        .filter((block): block is NonNullable<typeof block> => Boolean(block))

      itemsSeen += events.length

      const { sourceItemsChanged } = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM "CalendarConnection"
          WHERE id = ${connection.id}
          FOR UPDATE
        `
        const deletedBusyBlocks = deletedProviderEventIds.length
          ? await tx.externalCalendarBusyBlock.deleteMany({
              where: {
                sourceId: source.id,
                providerEventId: { in: deletedProviderEventIds },
              },
            })
          : { count: 0 }
        const sourceItemsChanged = blocks.length + deletedBusyBlocks.count

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
            itemsSeen: events.length,
            itemsChanged: sourceItemsChanged,
          }),
        })
        return { sourceItemsChanged }
      })
      itemsChanged += sourceItemsChanged
    } catch (error) {
      await prisma.calendarSyncRun.update({
        where: { id: run.id },
        data: syncRunFailurePatch({ finishedAt: new Date(), error }),
      })
      await prisma.externalCalendarSource.update({
        where: { id: source.id },
        data: syncSourceFailurePatch(error),
      })
    }
  }

  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  })

  return { itemsSeen, itemsChanged }
}

/** Upserts available Google calendars without changing existing selections. */
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

/** Returns whether a MassageLab calendar event should be mirrored to Google. */
export function calendarEventShouldPushToGoogle(event: { kind?: string | null; ownerUserId?: string | null; status?: string | null }) {
  return Boolean(event.ownerUserId && ["APPOINTMENT", "CLASS", "PERSONAL"].includes(String(event.kind ?? "")))
}

/** Maps MassageLab event status to the Google outbound operation. */
export function outboundSyncActionForStatus(status?: string | null) {
  if (status === "CANCELLED") return "DELETE" as const
  if (status === "COMPLETED" || status === "NO_SHOW") return "SKIP" as const
  return "UPSERT" as const
}

/** Builds the error patch stored on existing outbound event links. */
export function outboundSyncFailurePatch(error: unknown) {
  return {
    lastErrorCode: "PUSH_FAILED",
    lastErrorMessage: sanitizeCalendarSyncError(error),
  }
}

/**
 * Pushes one eligible MassageLab calendar event into the dedicated Google
 * calendar and stores the Google event link for future reconciliation.
 */
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

/**
 * Best-effort outbound sync wrapper for already-committed calendar mutations.
 * Google failures are recorded on existing links when possible, but they do not
 * make the primary MassageLab save look failed to the user.
 */
export async function pushCalendarEventToGoogleBestEffort(
  calendarEventId: string,
  adapter: GoogleCalendarAdapter = createGoogleCalendarAdapter(),
) {
  try {
    return await pushCalendarEventToGoogle(calendarEventId, adapter)
  } catch (error) {
    await recordGoogleCalendarEventPushFailure({ calendarEventId, error })
    return { pushed: false, error: sanitizeCalendarSyncError(error) }
  }
}

async function recordGoogleCalendarEventPushFailure({
  calendarEventId,
  error,
}: {
  calendarEventId: string
  error: unknown
}) {
  try {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: calendarEventId },
      include: { externalCalendarLinks: true },
    })
    if (!event?.ownerUserId) return

    const connection = await prisma.calendarConnection.findFirst({
      where: {
        userId: event.ownerUserId,
        provider: GOOGLE_CALENDAR_PROVIDER,
        status: "ACTIVE",
        dedicatedCalendarId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    })
    const existingLink = event.externalCalendarLinks.find((link) => link.connectionId === connection?.id)
    if (!existingLink) return

    await prisma.externalCalendarEventLink.update({
      where: { id: existingLink.id },
      data: outboundSyncFailurePatch(error),
    })
  } catch {
    // Preserve the primary calendar action even if failure bookkeeping fails.
  }
}

/**
 * Persists a single active Google connection for the provider.
 * Connecting another Google account deletes older Google sync state so outbound
 * sync never chooses between multiple active calendars.
 */
export async function saveGoogleCalendarConnection({
  userId,
  providerAccountId,
  accountEmail,
  accessToken,
  refreshToken,
  expiresIn,
  grantedScopes,
  dedicatedCalendarId,
  dedicatedCalendarSummary,
}: {
  userId: string
  providerAccountId: string
  accountEmail?: string | null
  accessToken: string
  refreshToken: string
  expiresIn?: number | null
  grantedScopes?: string | null
  dedicatedCalendarId?: string | null
  dedicatedCalendarSummary?: string | null
}) {
  const accessTokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null

  return prisma.$transaction(async (tx) => {
    await tx.calendarConnection.deleteMany({
      where: {
        userId,
        provider: GOOGLE_CALENDAR_PROVIDER,
        providerAccountId: { not: providerAccountId },
      },
    })

    return tx.calendarConnection.upsert({
      where: {
        userId_provider_providerAccountId: {
          userId,
          provider: GOOGLE_CALENDAR_PROVIDER,
          providerAccountId,
        },
      },
      create: {
        userId,
        provider: GOOGLE_CALENDAR_PROVIDER,
        providerAccountId,
        accountEmail,
        encryptedRefreshToken: encryptCalendarSyncSecret(refreshToken),
        encryptedAccessToken: encryptCalendarSyncSecret(accessToken),
        accessTokenExpiresAt,
        grantedScopes: grantedScopes ?? "",
        status: "ACTIVE",
        statusReason: null,
        dedicatedCalendarId,
        dedicatedCalendarSummary,
      },
      update: {
        accountEmail,
        encryptedRefreshToken: encryptCalendarSyncSecret(refreshToken),
        encryptedAccessToken: encryptCalendarSyncSecret(accessToken),
        accessTokenExpiresAt,
        grantedScopes: grantedScopes ?? "",
        status: "ACTIVE",
        statusReason: null,
        dedicatedCalendarId,
        dedicatedCalendarSummary,
      },
    })
  })
}
