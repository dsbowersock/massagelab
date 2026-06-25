import type { Prisma } from "@prisma/client"
import { intervalsOverlap } from "./calendar.js"
import { prisma } from "./prisma.ts"

type CalendarDb = typeof prisma | Prisma.TransactionClient

export function externalBusyBlocksWhere({
  ownerUserId,
  startsAt,
  endsAt,
}: {
  ownerUserId: string
  startsAt: Date
  endsAt: Date
}) {
  return {
    ownerUserId,
    status: { in: ["BUSY"] },
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
    connection: { status: "ACTIVE" },
  } satisfies Prisma.ExternalCalendarBusyBlockWhereInput
}

export function externalBusyBlockConflicts({
  startsAt,
  endsAt,
  busyBlocks,
}: {
  startsAt: Date
  endsAt: Date
  busyBlocks: Array<{ startsAt: Date; endsAt: Date; status: string }>
}) {
  return busyBlocks.some((block) => (
    block.status === "BUSY" && intervalsOverlap(startsAt, endsAt, block.startsAt, block.endsAt)
  ))
}

export async function assertNoExternalCalendarBusyConflict({
  db = prisma,
  ownerUserId,
  startsAt,
  endsAt,
}: {
  db?: CalendarDb
  ownerUserId: string
  startsAt: Date
  endsAt: Date
}) {
  const busyBlocks = await db.externalCalendarBusyBlock.findMany({
    where: externalBusyBlocksWhere({ ownerUserId, startsAt, endsAt }),
    select: { startsAt: true, endsAt: true, status: true },
  })

  if (externalBusyBlockConflicts({ startsAt, endsAt, busyBlocks })) {
    throw new Error("That provider is busy on their connected Google Calendar.")
  }
}
