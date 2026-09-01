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
  normalizePublicBookingSequenceDescriptor,
  PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
} from "@/lib/public-booking-sequences"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ practiceSlug: string }> },
) {
  const body = await request.json().catch(() => null)
  let descriptor: ReturnType<typeof normalizePublicBookingSequenceDescriptor>

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
