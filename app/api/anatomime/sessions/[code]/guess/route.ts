import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  loadAnatomimeSession,
  recordAnatomimeGuess,
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
  const viewer = {
    userId: authSession?.user?.id,
    playerId: typeof body.playerId === "string" ? body.playerId : undefined,
    playerToken: typeof body.playerToken === "string" ? body.playerToken : undefined,
  }

  try {
    const result = await recordAnatomimeGuess(code, body, viewer)
    const gameSession = await loadAnatomimeSession(code)

    return NextResponse.json({
      result: {
        correct: result.correct,
        scoreAwarded: result.scoreAwarded,
      },
      session: gameSession ? summarizeAnatomimeSession(gameSession, viewer) : null,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not submit Anatomime guess.",
    }, { status: 400 })
  }
}
