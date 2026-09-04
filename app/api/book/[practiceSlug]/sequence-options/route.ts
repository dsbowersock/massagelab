import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import { normalizeBookingPolicy } from "@/lib/booking-policy"
import { consumeOperationalRateLimit } from "@/lib/operational-rate-limit"
import {
  publicAvailabilityCacheKey,
  readPublicAvailabilityCache,
  writePublicAvailabilityCache,
} from "@/lib/public-booking-availability-cache"
import {
  cachedPublicBookingSequenceOptions,
  MAX_PUBLIC_ADD_ONS,
  normalizePublicBookingSequenceDescriptor,
  PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
} from "@/lib/public-booking-sequences"
import { prisma } from "@/lib/prisma"

const MAX_PUBLIC_AVAILABILITY_JSON_BYTES = 4096
const MAX_PUBLIC_BOOKING_IDENTIFIER_LENGTH = 191

export async function POST(
  request: Request,
  { params }: { params: Promise<{ practiceSlug: string }> },
) {
  const body = await readPublicAvailabilityJsonObject(request)
  let descriptor: ReturnType<typeof normalizePublicBookingSequenceDescriptor>

  if (!body || !publicAvailabilityDescriptorIsBounded(body)) {
    return NextResponse.json({ error: "Unable to load booking options." }, { status: 400 })
  }

  try {
    descriptor = normalizePublicBookingSequenceDescriptor(body)
  } catch {
    return NextResponse.json({ error: "Unable to load booking options." }, { status: 400 })
  }

  const { practiceSlug } = await params
  const publicPractice = await prisma.practice.findUnique({
    where: { slug: practiceSlug },
    select: { id: true },
  })

  if (!publicPractice) {
    return NextResponse.json({ error: "Practice not found" }, { status: 404 })
  }

  const networkIdentifier = authRequestNetworkIdentifier(request)
  const session = await getCurrentSession()
  const viewerUserId = session?.user?.id ?? ""
  const availabilityCacheKey = publicAvailabilityCacheKey({
    practiceId: publicPractice.id,
    accountMode: viewerUserId ? "signed-in" : "guest",
    descriptor,
    maxOptions: PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
  })
  const limiterDecision = await consumeOperationalRateLimit({
    operation: "BOOKING_AVAILABILITY",
    networkIdentifier,
    practiceId: publicPractice.id,
    ...(viewerUserId
      ? { account: { kind: "ACCOUNT_ID" as const, value: viewerUserId } }
      : {}),
  })

  if (!limiterDecision.allowed) {
    if (limiterDecision.reason === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Too many booking availability requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, Math.ceil(limiterDecision.retryAfterSeconds))) },
        },
      )
    }

    const cachedOptions = readPublicAvailabilityCache(availabilityCacheKey, { allowStale: true })
    if (cachedOptions !== null) {
      return NextResponse.json({ options: cachedOptions })
    }
    return NextResponse.json(
      { error: "Booking availability is temporarily unavailable." },
      { status: 503 },
    )
  }

  try {
    const practice = await prisma.practice.findUnique({
      where: { id: publicPractice.id },
      select: {
        id: true,
        bookingPolicy: true,
        providerBookingPolicies: {
          select: {
            providerUserId: true,
            requireClientAccount: true,
          },
        },
      },
    })

    if (!practice) {
      return NextResponse.json({ error: "Practice not found" }, { status: 404 })
    }

    const policy = normalizeBookingPolicy(practice.bookingPolicy)
    if (!viewerUserId && policy.requireClientAccount) {
      return NextResponse.json({ error: "Sign in to load appointment times for this practice.", code: "account-required" }, { status: 401 })
    }
    if (!viewerUserId && descriptor.preferredProviderId) {
      const selectedProviderPolicy = practice.providerBookingPolicies.find((providerPolicy) => (
        providerPolicy.providerUserId === descriptor.preferredProviderId
      ))
      if (selectedProviderPolicy?.requireClientAccount) {
        return NextResponse.json({ error: "Sign in to book this provider.", code: "account-required" }, { status: 401 })
      }
    }

    const context = await cachedPublicBookingSequenceOptions({
      practiceId: practice.id,
      ...descriptor,
      viewerUserId,
      maxOptions: PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
    })

    writePublicAvailabilityCache(availabilityCacheKey, context.options)
    return NextResponse.json({ options: context.options })
  } catch (error) {
    console.error("Unable to load public booking sequence options", error)
    return NextResponse.json({ error: "Unable to load booking options." }, { status: 400 })
  }
}

/**
 * Reads the public availability payload without allowing declared or streamed
 * body size to exceed the route's small JSON budget.
 */
async function readPublicAvailabilityJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (mediaType !== "application/json") return null

  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    const normalizedLength = declaredLength.trim()
    if (!/^\d+$/.test(normalizedLength)) return null
    const byteLength = Number(normalizedLength)
    if (!Number.isSafeInteger(byteLength) || byteLength > MAX_PUBLIC_AVAILABILITY_JSON_BYTES) return null
  }

  const reader = request.body?.getReader()
  if (!reader) return null

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_PUBLIC_AVAILABILITY_JSON_BYTES) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

/** Rejects oversized identifiers and add-on collections before reusable normalization. */
function publicAvailabilityDescriptorIsBounded(body: Record<string, unknown>): boolean {
  if (!publicBookingIdentifierIsBounded(body.primaryServiceVariantId, false)) return false

  const addOnIds = body.addOnServiceVariantIds
  if (addOnIds !== undefined) {
    if (!Array.isArray(addOnIds) || addOnIds.length > MAX_PUBLIC_ADD_ONS) return false
    if (addOnIds.some((value) => !publicBookingIdentifierIsBounded(value, false))) return false
  }

  return body.preferredProviderId === undefined
    || body.preferredProviderId === null
    || publicBookingIdentifierIsBounded(body.preferredProviderId, true)
}

function publicBookingIdentifierIsBounded(value: unknown, allowEmpty: boolean): boolean {
  if (typeof value !== "string" || value.length > MAX_PUBLIC_BOOKING_IDENTIFIER_LENGTH) return false
  const canonicalLength = value.trim().length
  return allowEmpty || canonicalLength > 0
}
