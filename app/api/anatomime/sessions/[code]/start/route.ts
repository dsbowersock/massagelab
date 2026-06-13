import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  startAnatomimeGameSession,
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
    const gameSession = await startAnatomimeGameSession(code, {
      userId: authSession?.user?.id,
      playerId: typeof body.playerId === "string" ? body.playerId : undefined,
      playerToken: typeof body.playerToken === "string" ? body.playerToken : undefined,
    })

    return NextResponse.json({
      session: summarizeAnatomimeSession(gameSession, {
        userId: authSession?.user?.id,
        playerId: typeof body.playerId === "string" ? body.playerId : undefined,
        playerToken: typeof body.playerToken === "string" ? body.playerToken : undefined,
      }),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not start Anatomime game.",
    }, { status: 400 })
  }
}
