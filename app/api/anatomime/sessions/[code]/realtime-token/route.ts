import { NextResponse } from "next/server"
import { createAnatomimeRealtimeTokenRequest } from "@/lib/anatomime-realtime"
import { loadAnatomimeSession } from "@/lib/anatomime-session-server"
import { apiErrorMapper, objectBody } from "@/lib/anatomime-api"

export const POST = apiErrorMapper(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const clientId = typeof body.clientId === "string" && body.clientId.trim()
    ? body.clientId.trim().slice(0, 120)
    : "anatomime-player"
  const gameSession = await loadAnatomimeSession(code)

  if (!gameSession) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  const tokenRequest = await createAnatomimeRealtimeTokenRequest(code, clientId)

  if (!tokenRequest) {
    return NextResponse.json({ error: "Realtime is not configured for this environment." }, { status: 503 })
  }

  return NextResponse.json(tokenRequest)
}, "Could not create Anatomime realtime token.")
