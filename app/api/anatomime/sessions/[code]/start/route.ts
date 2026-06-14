import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  startAnatomimeGameSession,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"
import { anatomimeErrorResponse, anatomimeViewerFromRequest, objectBody } from "@/lib/anatomime-api"

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const authSession = await getCurrentSession()
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const viewer = anatomimeViewerFromRequest(request, authSession?.user?.id, body)

  try {
    const gameSession = await startAnatomimeGameSession(code, viewer)

    return NextResponse.json({
      session: summarizeAnatomimeSession(gameSession, viewer),
    })
  } catch (error) {
    return anatomimeErrorResponse(error, "Could not start Anatomime game.")
  }
}
