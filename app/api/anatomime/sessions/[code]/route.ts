import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  loadAnatomimeSession,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"

function viewerFromRequest(request: Request, userId?: string) {
  const url = new URL(request.url)

  return {
    userId,
    playerId: url.searchParams.get("playerId") ?? request.headers.get("x-anatomime-player-id") ?? undefined,
    playerToken: url.searchParams.get("playerToken") ?? request.headers.get("x-anatomime-player-token") ?? undefined,
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await getCurrentSession()
  const { code } = await params
  const gameSession = await loadAnatomimeSession(code)

  if (!gameSession) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  return NextResponse.json({
    session: summarizeAnatomimeSession(gameSession, viewerFromRequest(request, session?.user?.id)),
  })
}
