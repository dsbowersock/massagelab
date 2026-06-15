import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  submitAnatomimeRoomGuess,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { anatomimeViewerFromRequest, apiErrorMapper, objectBody } from "@/lib/anatomime-api"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const authSession = await getCurrentSession()
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const viewer = anatomimeViewerFromRequest(request, authSession?.user?.id, body)
  const result = await submitAnatomimeRoomGuess(code, body, viewer)

  return NextResponse.json({
    result: {
      correct: result.correct,
      scoreAwarded: result.guess.scoreAwarded,
      feedbackKind: result.resolution.feedbackKind,
    },
    session: summarizeAnatomimeRoom(result.room, viewer),
  })
}, "Could not submit Anatomime guess.")
