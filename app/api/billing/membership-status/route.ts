import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getMembershipConvergenceStatus } from "@/lib/membership-convergence"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
}

/**
 * Returns only the signed-in user's current database projection. The request
 * is deliberately not parsed, so submitted redirect or provider identifiers
 * cannot become status authority.
 */
export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
      )
    }

    const status = await getMembershipConvergenceStatus({
      prismaClient: prisma,
      userId: session.user.id,
    })
    return NextResponse.json(status, { headers: PRIVATE_NO_STORE_HEADERS })
  } catch {
    return NextResponse.json(
      { error: "Membership status unavailable" },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
    )
  }
}
