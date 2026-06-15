import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  startAnatomimeGameRun,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { anatomimeViewerFromRequest, apiErrorMapper, objectBody } from "@/lib/anatomime-api"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const authSession = await getCurrentSession()
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const viewer = anatomimeViewerFromRequest(request, authSession?.user?.id, body)
  const gameSession = await startAnatomimeGameRun(code, viewer)

  return NextResponse.json({
    session: summarizeAnatomimeRoom(gameSession, viewer),
  })
}, "Could not start Anatomime game.")
