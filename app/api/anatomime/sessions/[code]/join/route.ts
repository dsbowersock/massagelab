import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  joinAnatomimeRoom,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { apiErrorMapper, objectBody } from "@/lib/anatomime-api"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const authSession = await getCurrentSession()
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const joined = await joinAnatomimeRoom(code, body, authSession?.user?.id)

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
