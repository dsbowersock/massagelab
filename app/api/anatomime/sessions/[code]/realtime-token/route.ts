import { NextResponse } from "next/server"
import { createAnatomimeRealtimeTokenRequest } from "@/lib/anatomime-realtime"

function objectBody(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = objectBody(await request.json().catch(() => ({})))
  const clientId = typeof body.clientId === "string" && body.clientId.trim()
    ? body.clientId.trim().slice(0, 120)
    : "anatomime-player"
  const tokenRequest = await createAnatomimeRealtimeTokenRequest(code, clientId)

  if (!tokenRequest) {
    return NextResponse.json({ error: "Realtime is not configured for this environment." }, { status: 503 })
  }

  return NextResponse.json(tokenRequest)
}
