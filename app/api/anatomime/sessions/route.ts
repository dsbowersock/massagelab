import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  createAnatomimeGameSession,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"
import { anatomimeErrorResponse, objectBody } from "@/lib/anatomime-api"

function sharedSessionDatabaseReady() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export async function POST(request: Request) {
  const body = objectBody(await request.json().catch(() => ({})))

  try {
    if (!sharedSessionDatabaseReady()) {
      return NextResponse.json({
        error: "Shared games need database access in this Vercel environment before they can be created.",
      }, { status: 503 })
    }

    const session = await getCurrentSession().catch(() => null)
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
