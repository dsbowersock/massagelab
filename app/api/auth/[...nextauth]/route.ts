import { handlers } from "@/auth"
import { buildRegistrationLegalAcceptancePath } from "@/lib/legal-acceptance-gate"
import { NextRequest } from "next/server"

const GOOGLE_SIGN_IN_PATH = "/api/auth/signin/google"

/**
 * Defaults direct Google provider starts to the same legal-gated onboarding path as the login UI.
 */
function withDefaultGoogleCallback(request: NextRequest) {
  const url = new URL(request.url)

  if (url.pathname === GOOGLE_SIGN_IN_PATH && !url.searchParams.has("callbackUrl")) {
    url.searchParams.set("callbackUrl", buildRegistrationLegalAcceptancePath("/onboarding"))
    return new NextRequest(url, {
      headers: request.headers,
      method: request.method,
    })
  }

  return request
}

export function GET(request: NextRequest) {
  return handlers.GET(withDefaultGoogleCallback(request))
}

export const POST = handlers.POST
