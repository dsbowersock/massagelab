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
  let room

  if (action === "vote" || action === "ballot") {
    room = await submitAnatomimeHostElectionBallot(code, body, viewer)
  } else if (action === "resolve") {
    room = await resolveAnatomimeHostElection(code)
  } else if (action === "request") {
    room = await requestAnatomimeHostElection(code, viewer)
  } else {
    return NextResponse.json({ error: "Unknown host election action." }, { status: 400 })
  }

  return NextResponse.json({
    session: summarizeAnatomimeRoom(room, viewer),
  })
}, "Could not update Anatomime host election.")
