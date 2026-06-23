import { handlers } from "@/auth"
import { buildRegistrationLegalProviderRedirectPath } from "@/lib/legal-acceptance-gate"
import { NextRequest } from "next/server"

const GOOGLE_SIGN_IN_PATH = "/api/auth/signin/google"

/**
 * Wraps direct Google provider starts in the same legal-gated callback path as the login UI.
 */
async function withRegistrationLegalCallback(request: NextRequest) {
  const url = new URL(request.url)

  if (url.pathname !== GOOGLE_SIGN_IN_PATH) {
    return request
  }

  if (request.method === "GET") {
    url.searchParams.set("callbackUrl", buildRegistrationLegalProviderRedirectPath(url.searchParams.get("callbackUrl") ?? "/onboarding"))
    return new NextRequest(url, {
      headers: request.headers,
      method: request.method,
    })
  }

  const headers = new Headers(request.headers)
  const body = new URLSearchParams(await request.text())
  body.set("callbackUrl", buildRegistrationLegalProviderRedirectPath(body.get("callbackUrl") ?? "/onboarding"))
  headers.set("content-type", "application/x-www-form-urlencoded")
  headers.delete("content-length")

  return new NextRequest(url, {
    body: body.toString(),
    headers,
    method: request.method,
  })
}

export async function GET(request: NextRequest) {
  return handlers.GET(await withRegistrationLegalCallback(request))
}

export async function POST(request: NextRequest) {
  return handlers.POST(await withRegistrationLegalCallback(request))
}
