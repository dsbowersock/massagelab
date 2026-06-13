import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  createAnatomimeGameSession,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"
import { anatomimeErrorResponse, objectBody } from "@/lib/anatomime-api"

export async function POST(request: Request) {
  const session = await getCurrentSession()
  const body = objectBody(await request.json().catch(() => ({})))

  try {
    const created = await createAnatomimeGameSession(body.config ?? body, session?.user?.id)
    const summary = summarizeAnatomimeSession(created.session, {
      userId: session?.user?.id,
      playerId: created.host.playerId,
      playerToken: created.host.token,
    })

    return NextResponse.json({
      session: summary,
      host: created.host,
    }, { status: 201 })
  } catch (error) {
    return anatomimeErrorResponse(error, "Anatomime game could not be created.")
  }
}
