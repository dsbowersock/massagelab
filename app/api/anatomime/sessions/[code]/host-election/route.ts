import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  requestAnatomimeHostElection,
  resolveAnatomimeHostElection,
  submitAnatomimeHostElectionBallot,
  summarizeAnatomimeRoom,
} from "@/lib/anatomime-room-server"
import { anatomimeViewerFromRequest, apiErrorMapper, objectBody } from "@/lib/anatomime-api"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const authSession = await getCurrentSession()
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const viewer = anatomimeViewerFromRequest(request, authSession?.user?.id, body)
  const action = typeof body.action === "string" ? body.action : "request"
  const room = action === "vote" || action === "ballot"
    ? await submitAnatomimeHostElectionBallot(code, body, viewer)
    : action === "resolve"
      ? await resolveAnatomimeHostElection(code)
      : await requestAnatomimeHostElection(code, viewer)

  return NextResponse.json({
    session: summarizeAnatomimeRoom(room, viewer),
  })
}, "Could not update Anatomime host election.")
