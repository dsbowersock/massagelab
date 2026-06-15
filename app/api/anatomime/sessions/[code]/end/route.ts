import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  endAnatomimeRoomSession,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { anatomimeViewerFromRequest, apiErrorMapper, objectBody } from "@/lib/anatomime-api"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const authSession = await getCurrentSession()
  const { code } = await params
  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 })
  }

  const body = objectBody(parsedBody)
  const viewer = anatomimeViewerFromRequest(request, authSession?.user?.id, body)
  const room = await endAnatomimeRoomSession(code, viewer)

  return NextResponse.json({
    session: summarizeAnatomimeRoom(room, viewer),
  })
}, "Could not end Anatomime room.")
