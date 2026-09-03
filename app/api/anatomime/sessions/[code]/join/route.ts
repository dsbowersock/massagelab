import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  joinAnatomimeRoom,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { apiErrorMapper, objectBody } from "@/lib/anatomime-api"
import {
  normalizeAnatomimeRoomIdentifier,
  requireAnatomimeOperationalAllowance,
} from "@/lib/anatomime-traffic-server"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const { code } = await params
  const networkIdentifier = authRequestNetworkIdentifier(request)
  const roomIdentifier = normalizeAnatomimeRoomIdentifier(code)
  await requireAnatomimeOperationalAllowance({
    operation: "ANATOMIME_ROOM_JOIN_INGRESS",
    networkIdentifier,
  })

  const authSession = await getCurrentSession()
  const body = objectBody(await request.json().catch(() => ({})))
  const joined = await joinAnatomimeRoom(code, body, authSession?.user?.id, {
    // Charge the room-scoped quota only after the service has verified the room exists
    // and admitted the request, but before it opens the write transaction.
    beforePersist: () => requireAnatomimeOperationalAllowance({
      operation: "ANATOMIME_ROOM_JOIN",
      networkIdentifier,
      roomIdentifier,
    }),
  })

  const viewer = {
    userId: authSession?.user?.id,
    playerId: joined.player.id,
    playerToken: joined.token,
  }

  return NextResponse.json({
    player: {
      id: joined.player.id,
      token: joined.token,
      teamId: joined.player.teamId,
    },
    session: summarizeAnatomimeRoom(joined.room, viewer),
  }, { status: 201 })
}, "Could not join Anatomime game.")
