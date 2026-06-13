import { NextResponse } from "next/server"
import { AnatomimeSessionError, type ViewerContext } from "./anatomime-session-server.ts"

export function objectBody(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/**
 * Builds a viewer context for shared-session routes. Player tokens are accepted
 * only from headers so guest credentials do not appear in request URLs.
 */
export function anatomimeViewerFromRequest(request: Request, userId?: string | null, body: Record<string, unknown> = {}): ViewerContext {
  const url = new URL(request.url)
  const headerPlayerId = request.headers.get("x-anatomime-player-id")
  const bodyPlayerId = typeof body.playerId === "string" ? body.playerId : undefined

  return {
    userId,
    playerId: headerPlayerId ?? bodyPlayerId ?? url.searchParams.get("playerId") ?? undefined,
    playerToken: request.headers.get("x-anatomime-player-token") ?? undefined,
  }
}

export function anatomimeErrorResponse(error: unknown, logContext: string) {
  if (error instanceof AnatomimeSessionError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(logContext, error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

/**
 * Maps thrown shared-session route errors into the same JSON shape used by
 * Anatomime mutation handlers.
 */
export function apiErrorMapper<TContext>(
  handler: (request: Request, context: TContext) => Promise<Response>,
  logContext = "Anatomime API request failed.",
) {
  return async (request: Request, context: TContext) => {
    try {
      return await handler(request, context)
    } catch (error) {
      return anatomimeErrorResponse(error, logContext)
    }
  }
}
