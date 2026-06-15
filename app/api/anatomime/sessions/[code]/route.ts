import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  loadAnatomimeRoom,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { anatomimeViewerFromRequest, apiErrorMapper } from "@/lib/anatomime-api"

export const GET = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const session = await getCurrentSession()
  const { code } = await params
  const viewer = anatomimeViewerFromRequest(request, session?.user?.id)
  const gameSession = await loadAnatomimeRoom(code, viewer)

  if (!gameSession) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  return NextResponse.json({
    session: summarizeAnatomimeRoom(gameSession, viewer),
  })
}, "Could not load Anatomime game.")
