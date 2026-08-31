import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  loadAnatomimeRoom,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { anatomimeViewerFromRequest, apiErrorMapper } from "@/lib/anatomime-api"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import {
  AnatomimeTrafficLimitError,
  createAnatomimePollShedder,
  normalizeAnatomimeRoomIdentifier,
  preflightAnatomimeViewer,
  requireAnatomimeOperationalAllowance,
  type AnatomimePollShedDecision,
} from "@/lib/anatomime-traffic-server"

const pollShedder: ReturnType<typeof createAnatomimePollShedder> | null = (() => {
  try {
    return createAnatomimePollShedder({ secret: process.env.AUTH_SECRET ?? "" })
  } catch {
    // A missing/invalid server secret must disable polling rather than retaining raw identifiers.
    return null
  }
})()

function requireLocalPollAllowance(decision: AnatomimePollShedDecision) {
  if (!decision.allowed) throw new AnatomimeTrafficLimitError(429, decision.retryAfterSeconds)
}

export const GET = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const { code } = await params
  const roomIdentifier = normalizeAnatomimeRoomIdentifier(code)
  const networkIdentifier = authRequestNetworkIdentifier(request)
  if (!pollShedder) throw new AnatomimeTrafficLimitError(503)
  requireLocalPollAllowance(pollShedder.consumeIngress({ networkIdentifier, roomIdentifier }))

  const session = await getCurrentSession()
  const viewer = anatomimeViewerFromRequest(request, session?.user?.id)
  const preflight = await preflightAnatomimeViewer(roomIdentifier, viewer)

  if (preflight.kind === "ROOM_NOT_FOUND") {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  if (preflight.kind === "JOINED") {
    requireLocalPollAllowance(pollShedder.consumeJoined({ playerId: preflight.playerId }))
  } else {
    await requireAnatomimeOperationalAllowance({
      operation: "ANATOMIME_UNJOINED_LOOKUP",
      networkIdentifier,
      roomIdentifier: preflight.roomIdentifier,
    })
    if (preflight.kind === "INVALID") {
      return NextResponse.json({ error: "Join this room before taking that action." }, { status: 403 })
    }
  }

  const gameSession = await loadAnatomimeRoom(roomIdentifier, viewer)

  if (!gameSession) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  return NextResponse.json({
    session: summarizeAnatomimeRoom(gameSession, viewer),
  })
}, "Could not load Anatomime game.")
