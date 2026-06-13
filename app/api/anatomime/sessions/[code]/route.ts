import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  loadAnatomimeSession,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"
import { anatomimeViewerFromRequest } from "@/lib/anatomime-api"

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await getCurrentSession()
  const { code } = await params
  const gameSession = await loadAnatomimeSession(code)

  if (!gameSession) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  return NextResponse.json({
    session: summarizeAnatomimeSession(gameSession, anatomimeViewerFromRequest(request, session?.user?.id)),
  })
}
