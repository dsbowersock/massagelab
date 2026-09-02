import { cookies } from "next/headers"

import { LinkGoogleForm } from "./link-google-form"
import { getAuthSecret } from "@/lib/auth-env"
import { AUTH_METHOD_INTENT_COOKIE, resolveBoundAuthMethodIntent } from "@/lib/auth-method-intents"
import { prisma } from "@/lib/prisma"

/** Renders only a yes/no recovery surface; private intent proof stays server-side. */
export default async function LinkGooglePage() {
  const cookieStore = await cookies()
  const validIntent = Boolean(await resolveBoundAuthMethodIntent({
    prismaClient: prisma,
    cookieValue: cookieStore.get(AUTH_METHOD_INTENT_COOKIE)?.value,
    purpose: "SIGN_IN_OR_LINK",
    status: "PROVIDER_PROVEN",
    secret: getAuthSecret(),
  }))

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <LinkGoogleForm validIntent={validIntent} />
    </main>
  )
}
