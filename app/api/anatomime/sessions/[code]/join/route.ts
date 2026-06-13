import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  joinAnatomimeGameSession,
  loadAnatomimeSession,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"

function objectBody(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const authSession = await getCurrentSession()
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))

  try {
    const joined = await joinAnatomimeGameSession(code, body, authSession?.user?.id)
    const gameSession = await loadAnatomimeSession(code)

    return NextResponse.json({
      player: {
        id: joined.player.id,
        token: joined.token,
        teamId: joined.player.teamId,
      },
      session: gameSession
        ? summarizeAnatomimeSession(gameSession, {
          userId: authSession?.user?.id,
          playerId: joined.player.id,
          playerToken: joined.token,
        })
        : null,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not join Anatomime game.",
    }, { status: 400 })
  }
}
