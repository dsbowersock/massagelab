import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  createAnatomimeRoom,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { apiErrorMapper, objectBody } from "@/lib/anatomime-api"

function sharedSessionDatabaseReady() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export const POST = apiErrorMapper(async (request: Request) => {
  const body = objectBody(await request.json().catch(() => ({})))

  if (!sharedSessionDatabaseReady()) {
    return NextResponse.json({
      error: "Shared games need database access in this Vercel environment before they can be created.",
    }, { status: 503 })
  }

  const session = await getCurrentSession().catch(() => null)
  const created = await createAnatomimeRoom(body.config ?? body, session?.user?.id)
  const hostPlayerId = created.room.hostPlayerId ?? created.room.players[0]?.id
  if (!hostPlayerId) throw new Error("Created Anatomime room is missing a host player.")

  const viewer = {
    userId: session?.user?.id,
    playerId: hostPlayerId,
    playerToken: created.hostToken,
  }

  return NextResponse.json({
    session: summarizeAnatomimeRoom(created.room, viewer),
    host: {
      playerId: hostPlayerId,
      token: created.hostToken,
    },
  }, { status: 201 })
}, "Anatomime game could not be created.")
