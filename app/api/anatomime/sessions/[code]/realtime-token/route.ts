import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { createAnatomimeRealtimeTokenRequest } from "@/lib/anatomime-realtime"
import { anatomimeViewerFromRequest, apiErrorMapper } from "@/lib/anatomime-api"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import {
  normalizeAnatomimeRoomIdentifier,
  preflightAnatomimeViewer,
  requireAnatomimeOperationalAllowance,
} from "@/lib/anatomime-traffic-server"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const { code } = await params
  const roomIdentifier = normalizeAnatomimeRoomIdentifier(code)
  const networkIdentifier = authRequestNetworkIdentifier(request)
  await requireAnatomimeOperationalAllowance({
    operation: "ANATOMIME_REALTIME_TOKEN_INGRESS",
    networkIdentifier,
  })

  const authSession = await getCurrentSession()
  const viewer = anatomimeViewerFromRequest(request, authSession?.user?.id)
  const preflight = await preflightAnatomimeViewer(roomIdentifier, viewer)

  if (preflight.kind === "ROOM_NOT_FOUND") {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  // Room-scoped accounting starts only after the narrow preflight proves the room exists.
  await requireAnatomimeOperationalAllowance({
    operation: "ANATOMIME_REALTIME_TOKEN_START",
    networkIdentifier,
    roomIdentifier: preflight.roomIdentifier,
  })

  if (preflight.kind !== "JOINED") {
    return NextResponse.json({ error: "Join this room before using realtime." }, { status: 403 })
  }

  await requireAnatomimeOperationalAllowance({
    operation: "ANATOMIME_REALTIME_TOKEN_ISSUE",
    playerId: preflight.playerId,
    roomId: preflight.roomId,
  })

  const tokenRequest = await createAnatomimeRealtimeTokenRequest(roomIdentifier, preflight.playerId)

  if (!tokenRequest) {
    return NextResponse.json({ error: "Realtime is not configured for this environment." }, { status: 503 })
  }

  return NextResponse.json(tokenRequest)
}, "Could not create Anatomime realtime token.")
