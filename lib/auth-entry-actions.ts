"use client"

import { useRef, useState } from "react"
import { signIn } from "next-auth/react"

export type EntryAction = "idle" | "email" | "google"

/** Owns the synchronous single-flight lock shared by account-entry actions. */
export function useEntryAction() {
  const [entryAction, setEntryAction] = useState<EntryAction>("idle")
  const entryActionLock = useRef(false)

  function beginEntryAction(action: Exclude<EntryAction, "idle">): boolean {
    if (entryActionLock.current) return false
    entryActionLock.current = true
    setEntryAction(action)
    return true
  }

  function finishEntryAction(): void {
    entryActionLock.current = false
    setEntryAction("idle")
  }

  return { entryAction, beginEntryAction, finishEntryAction }
}

type GoogleAuthDependencies = {
  fetchImpl?: typeof fetch
  signInImpl?: (provider: "google", options: { redirectTo: string }) => Promise<unknown>
}

/**
 * Creates the private Google method intent, starts NextAuth navigation, and
 * returns only after navigation has been requested. Callers retain their lock
 * on the navigating outcome and release it only when this function rejects.
 */
export async function startGoogleAuthMethodIntent(
  googleRedirectTo: string,
  { fetchImpl = fetch, signInImpl = signIn }: GoogleAuthDependencies = {},
): Promise<"navigating"> {
  const response = await fetchImpl("/api/auth/google/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose: "SIGN_IN_OR_LINK", callbackUrl: googleRedirectTo }),
  })
  const result = await response.json().catch(() => ({})) as { ok?: boolean; callbackUrl?: string }
  if (!response.ok || !result.ok || !result.callbackUrl) throw new Error("Google intent unavailable")
  await signInImpl("google", { redirectTo: result.callbackUrl })
  return "navigating"
}
