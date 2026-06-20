import "server-only"

import { Prisma } from "@prisma/client"
import {
  buildCalendarNotificationIntents,
  sanitizeCalendarAuditMetadata,
} from "@/lib/calendar-flows"

export async function writeCalendarAuditAndNotifications(
  tx: Prisma.TransactionClient,
  {
    practiceId,
    eventId,
    actorUserId,
    action,
    recipientUserIds,
    payload,
  }: {
    practiceId: string
    eventId: string
    actorUserId: string | null
    action: string
    recipientUserIds: string[]
    payload: Record<string, unknown>
  },
) {
  const safePayload = sanitizeCalendarAuditMetadata(payload)

  await tx.calendarAuditLog.create({
    data: {
      practiceId,
      eventId,
      actorUserId,
      action,
      metadata: safePayload as Prisma.InputJsonValue,
    },
  })

  const intents = buildCalendarNotificationIntents({
    eventId,
    actorUserId,
    action,
    recipientUserIds,
    payload: safePayload,
  })

  if (intents.length > 0) {
    await tx.calendarNotificationIntent.createMany({
      data: intents.map((intent) => ({
        eventId: intent.eventId,
        actorUserId: intent.actorUserId,
        recipientUserId: intent.recipientUserId,
        action: intent.action,
        channel: "INTERNAL" as const,
        deliveryStatus: "PENDING" as const,
        payload: intent.payload as Prisma.InputJsonValue,
      })) satisfies Prisma.CalendarNotificationIntentCreateManyInput[],
    })
  }
}
