import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  cachedPublicBookingSequenceOptions,
  normalizePublicBookingSequenceDescriptor,
  PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
} from "@/lib/public-booking-sequences"
import { normalizeBookingPolicy } from "@/lib/booking-policy"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ practiceSlug: string }> },
) {
  const session = await getCurrentSession()
  const viewerUserId = session?.user?.id ?? ""

  const { practiceSlug } = await params
  const body = await request.json().catch(() => null)

  try {
    const descriptor = normalizePublicBookingSequenceDescriptor(body)
    const practice = await prisma.practice.findUnique({
      where: { slug: practiceSlug },
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

    return NextResponse.json({ options: context.options })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load booking options."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
