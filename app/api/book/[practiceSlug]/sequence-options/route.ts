import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  cachedPublicBookingSequenceOptions,
  normalizePublicBookingSequenceDescriptor,
} from "@/lib/public-booking-sequences"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ practiceSlug: string }> },
) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { practiceSlug } = await params
  const body = await request.json().catch(() => null)

  try {
    const descriptor = normalizePublicBookingSequenceDescriptor(body)
    const practice = await prisma.practice.findUnique({
      where: { slug: practiceSlug },
      select: { id: true },
    })

    if (!practice) {
      return NextResponse.json({ error: "Practice not found" }, { status: 404 })
    }

    const context = await cachedPublicBookingSequenceOptions({
      practiceId: practice.id,
      ...descriptor,
      maxOptions: 8,
    })

    return NextResponse.json({ options: context.options })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load booking options."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
