import type { BrowserContext } from "@playwright/test"
import { encode } from "next-auth/jwt"

type SignedInSessionIdentity = {
  id: string
  name: string
  email: string
}

/**
 * Installs the Auth.js JWT cookie that server-rendered layouts require before
 * they enable account-backed browser behavior. Client route mocks alone cannot
 * authenticate the server component tree.
 */
export async function installSignedInSessionCookie(
  context: BrowserContext,
  baseURL: string,
  identity: SignedInSessionIdentity,
) {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required for signed-in browser QA")
  const cookieName = new URL(baseURL).protocol === "https:"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
  const value = await encode({
    token: {
      id: identity.id,
      sub: identity.id,
      name: identity.name,
      email: identity.email,
      emailVerified: true,
      role: "USER",
      roles: ["USER"],
      roleAssignments: [{ role: "USER", status: "VERIFIED" }],
    },
    secret,
    salt: cookieName,
    maxAge: 60 * 60,
  })
  await context.addCookies([{
    name: cookieName,
    value,
    url: baseURL,
    httpOnly: true,
    sameSite: "Lax",
    // Auth.js __Secure- cookies require Secure so HTTPS fixtures retain authentication semantics.
    secure: cookieName.startsWith("__Secure-"),
  }])
}
