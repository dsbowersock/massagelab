import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  loadAnatomimeSession,
  recordAnatomimeGuess,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"
import { anatomimeErrorResponse, anatomimeViewerFromRequest, objectBody } from "@/lib/anatomime-api"

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const authSession = await getCurrentSession()
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const viewer = anatomimeViewerFromRequest(request, authSession?.user?.id, body)

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
    return anatomimeErrorResponse(error, "Could not submit Anatomime guess.")
  }
}
