import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  loadAnatomimeRoom,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { anatomimeViewerFromRequest, apiErrorMapper } from "@/lib/anatomime-api"
import { AnatomimeSessionError } from "@/lib/anatomime-session-server"
import { getAuthSecret } from "@/lib/auth-env"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import {
  AnatomimeTrafficLimitError,
  createAnatomimePollShedder,
  normalizeAnatomimeRoomIdentifier,
  preflightLoadedAnatomimeViewer,
  requireAnatomimeOperationalAllowance,
  type AnatomimePollShedDecision,
} from "@/lib/anatomime-traffic-server"

const pollShedder: ReturnType<typeof createAnatomimePollShedder> | null = (() => {
  try {
    return createAnatomimePollShedder({ secret: getAuthSecret() })
  } catch {
    // A missing/invalid server secret must disable polling rather than retaining raw identifiers.
    try {
      console.error("Anatomime poll shedder unavailable.", {
        component: "ANATOMIME_POLL_SHEDDER",
        failureClass: "INITIALIZATION",
      })
    } catch {
      // Diagnostics must never weaken the fail-closed initialization boundary.
    }
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
  const gameSession = await loadAnatomimeRoom(roomIdentifier, viewer, {
    beforeResolve: async (room) => {
      const preflight = preflightLoadedAnatomimeViewer(room, viewer)
      if (preflight.kind === "JOINED") {
        requireLocalPollAllowance(pollShedder.consumeJoined({
          networkIdentifier,
          roomIdentifier: preflight.roomIdentifier,
          playerId: preflight.playerId,
        }))
        return
      }

      await requireAnatomimeOperationalAllowance({
        operation: "ANATOMIME_UNJOINED_LOOKUP",
        networkIdentifier,
        roomIdentifier: preflight.roomIdentifier,
      })
      if (preflight.kind === "INVALID") {
        throw new AnatomimeSessionError(403, "join-required", "Join this room before taking that action.")
      }
    },
  })

  if (!gameSession) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  return NextResponse.json({
    session: summarizeAnatomimeRoom(gameSession, viewer),
  })
}, "Could not load Anatomime game.")
