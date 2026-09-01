import "server-only"

import type { Prisma } from "@prisma/client"
import { publicRequestOwner, type PublicRequestOwner, type PublicRequestSelectionComponent } from "./public-request-owner.ts"

const BOOKING_SELECTION_FIELDS = Object.freeze([
  "requestId",
  "primaryServiceVariantId",
  "addOnServiceVariantIds",
  "requestedPressureLevel",
  "requestedStartsAt",
  "preferredProviderId",
])
const WAITLIST_SELECTION_FIELDS = Object.freeze([
  "requestId",
  "primaryServiceVariantId",
  "addOnServiceVariantIds",
  "requestedPressureLevel",
  "preferredStartsAt",
  "preferredProviderId",
])
const PUBLIC_REQUEST_PREFIX = /^public-(?:booking|waitlist)-v1:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:$/

export type PublicBookingRequestSelection = Readonly<{
  requestId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds: readonly string[]
  requestedPressureLevel: number
  requestedStartsAt: string
  preferredProviderId: string
}>

export type PublicWaitlistRequestSelection = Readonly<{
  requestId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds: readonly string[]
  requestedPressureLevel: number
  preferredStartsAt: string
  preferredProviderId: string
}>

type PublicRequestLockTransaction = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>
}

/** Builds the booking row owner from immutable selection fields only. */
export function publicBookingRequestOwner(input: PublicBookingRequestSelection): PublicRequestOwner {
  assertExactSelectionFields(input, BOOKING_SELECTION_FIELDS)
  return publicRequestOwner({
    namespace: "public-booking-v1",
    requestId: input.requestId,
    selectionComponents: selectionComponents({
      primaryServiceVariantId: input.primaryServiceVariantId,
      addOnServiceVariantIds: input.addOnServiceVariantIds,
      requestedPressureLevel: input.requestedPressureLevel,
      startsAt: canonicalIso(input.requestedStartsAt, "requested start", false),
      startsAtLabel: "requestedStartsAt",
      preferredProviderId: input.preferredProviderId,
    }),
  })
}

/** Builds the waitlist row owner from immutable selection fields only. */
export function publicWaitlistRequestOwner(input: PublicWaitlistRequestSelection): PublicRequestOwner {
  assertExactSelectionFields(input, WAITLIST_SELECTION_FIELDS)
  return publicRequestOwner({
    namespace: "public-waitlist-v1",
    requestId: input.requestId,
    selectionComponents: selectionComponents({
      primaryServiceVariantId: input.primaryServiceVariantId,
      addOnServiceVariantIds: input.addOnServiceVariantIds,
      requestedPressureLevel: input.requestedPressureLevel,
      startsAt: canonicalIso(input.preferredStartsAt, "preferred start", true),
      startsAtLabel: "preferredStartsAt",
      preferredProviderId: input.preferredProviderId,
    }),
  })
}

/**
 * Reads only rows owned by the versioned UUID prefix. Callers must compare the
 * returned row's practice and authoritative account/guest owner separately.
 */
export async function findPublicBookingRequest(
  database: Pick<Prisma.TransactionClient, "bookingGroup">,
  owner: PublicRequestOwner,
) {
  assertPublicRequestOwner(owner)
  return database.bookingGroup.findFirst({
    where: { id: { startsWith: owner.prefix } },
    select: {
      id: true,
      practiceId: true,
      practiceClientId: true,
      createdById: true,
      requestedPressureLevel: true,
      status: true,
      practiceClient: { select: { userId: true, email: true } },
      appointments: {
        orderBy: { bookingGroupOrder: "asc" },
        select: {
          bookingGroupOrder: true,
          serviceVariantId: true,
          therapistId: true,
          startsAt: true,
        },
      },
    },
  })
}

/** Performs the corresponding bounded prefix read for an existing waitlist owner. */
export async function findPublicWaitlistRequest(
  database: Pick<Prisma.TransactionClient, "bookingWaitlistEntry">,
  owner: PublicRequestOwner,
) {
  assertPublicRequestOwner(owner)
  return database.bookingWaitlistEntry.findFirst({
    where: { id: { startsWith: owner.prefix } },
    select: {
      id: true,
      practiceId: true,
      practiceClientId: true,
      createdById: true,
      status: true,
      requestedPressureLevel: true,
      primaryServiceVariantId: true,
      addOnServiceVariantIds: true,
      preferredProviderId: true,
      preferredStartsAt: true,
      convertedBookingGroupId: true,
      practiceClient: { select: { userId: true, email: true } },
    },
  })
}

/**
 * Confirms same-selection replay using the complete digest-bearing row ID.
 * This does not prove caller ownership or practice membership; callers must
 * compare those authoritative row fields before returning replay success.
 */
export function hasExactPublicRequestSelection(
  existing: { id: string } | null | undefined,
  owner: PublicRequestOwner,
): boolean {
  assertPublicRequestOwner(owner)
  return existing?.id === owner.id
}

/**
 * Serializes every concrete selection sharing one UUID. The advisory key uses
 * only the versioned UUID prefix so changed-selection races cannot create two
 * domain rows before the transaction's repeated prefix lookup.
 */
export async function acquirePublicRequestLock(
  transaction: PublicRequestLockTransaction,
  owner: PublicRequestOwner,
): Promise<void> {
  assertPublicRequestOwner(owner)
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.prefix}, 0))`
}

function selectionComponents(input: {
  primaryServiceVariantId: string
  addOnServiceVariantIds: readonly string[]
  requestedPressureLevel: number
  startsAt: string
  startsAtLabel: "requestedStartsAt" | "preferredStartsAt"
  preferredProviderId: string
}): PublicRequestSelectionComponent[] {
  const primaryServiceVariantId = canonicalIdentifier(input.primaryServiceVariantId, "primary service variant")
  if (!Array.isArray(input.addOnServiceVariantIds)) {
    throw new Error("Provide valid public request selection fields.")
  }
  const addOnServiceVariantIds = [...new Set(input.addOnServiceVariantIds.map((value) => (
    canonicalIdentifier(value, "add-on service variant")
  )))].sort()
  if (!Number.isInteger(input.requestedPressureLevel)
    || input.requestedPressureLevel < 1
    || input.requestedPressureLevel > 5) {
    throw new Error("Provide valid public request selection fields.")
  }
  const preferredProviderId = optionalCanonicalIdentifier(input.preferredProviderId, "preferred provider")

  return [
    { label: "primaryServiceVariantId", value: primaryServiceVariantId },
    ...addOnServiceVariantIds.map((value) => ({ label: "addOnServiceVariantId", value })),
    { label: "requestedPressureLevel", value: String(input.requestedPressureLevel) },
    { label: input.startsAtLabel, value: input.startsAt },
    { label: "preferredProviderId", value: preferredProviderId },
  ]
}

function assertExactSelectionFields(input: object, expectedFields: readonly string[]): void {
  if (!input || Array.isArray(input)) {
    throw new Error("Provide valid public request selection fields.")
  }
  const actualFields = Object.keys(input).sort()
  const expected = [...expectedFields].sort()
  if (actualFields.length !== expected.length
    || actualFields.some((field, index) => field !== expected[index])) {
    throw new Error("Provide only the supported public request selection fields.")
  }
}

function canonicalIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || value !== value.trim() || value.length > 191) {
    throw new Error(`Provide a canonical ${label}.`)
  }
  return value
}

function optionalCanonicalIdentifier(value: unknown, label: string): string {
  return value === "" ? "" : canonicalIdentifier(value, label)
}

function canonicalIso(value: unknown, label: string, allowEmpty: boolean): string {
  if (allowEmpty && value === "") return ""
  if (typeof value !== "string") {
    throw new Error(`Provide a canonical ${label}.`)
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error(`Provide a canonical ${label}.`)
  }
  return value
}

function assertPublicRequestOwner(owner: PublicRequestOwner): void {
  if (!owner
    || !PUBLIC_REQUEST_PREFIX.test(owner.prefix)
    || !/^[0-9a-f]{64}$/.test(owner.selectionDigest)
    || owner.id !== `${owner.prefix}${owner.selectionDigest}`) {
    throw new Error("Provide a valid public request owner.")
  }
}
