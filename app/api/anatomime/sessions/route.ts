import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  createAnatomimeGameSession,
  summarizeAnatomimeSession,
} from "@/lib/anatomime-session-server"

function objectBody(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

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
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Anatomime game could not be created.",
    }, { status: 400 })
  }
}
