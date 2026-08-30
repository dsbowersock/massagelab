"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

import { AsyncActionButton } from "@/components/forms/async-action-button"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  GENERIC_GOOGLE_LINK_RECOVERY_MESSAGE,
  resolveCredentialLinkRecovery,
  resolveGoogleLinkConfirmationRecovery,
} from "@/lib/google-link-confirmation-recovery"

type LinkActionState = "idle" | "proving" | "saving" | "redirecting" | "success" | "error"

/** Confirms account ownership through Auth.js before sending a proof-free link request. */
export function LinkGoogleForm({ validIntent }: { validIntent: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [actionState, setActionState] = useState<LinkActionState>("idle")
  const [message, setMessage] = useState("")
  const actionLock = useRef(false)
  const busy = actionState === "proving" || actionState === "saving" || actionState === "redirecting"

  async function confirmSameAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (actionLock.current || !validIntent) return
    actionLock.current = true
    let completed = false
    setActionState("proving")
    setMessage("Checking your password sign-in…")
    try {
      const signInResult = await signIn("credentials", {
        email,
        password,
        twoFactorCode,
        redirect: false,
      })
      if (signInResult?.error) {
        const code = signInResult.code ?? signInResult.error
        const recovery = resolveCredentialLinkRecovery(code)
        if (recovery.needsTwoFactor) setNeedsTwoFactor(true)
        setActionState("error")
        setMessage(recovery.message)
        return
      }

      setActionState("saving")
      setMessage("Linking the confirmed sign-in methods…")
      const response = await fetch("/api/account/security/google/link/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      })
      const result = await response.json().catch(() => ({})) as { code?: unknown }
      if (!response.ok || result.code !== "GOOGLE_LINKED") {
        const recovery = resolveGoogleLinkConfirmationRecovery(response.status, result.code)
        setActionState("error")
        setMessage(recovery.message)
        return
      }

      completed = true
      setActionState("success")
      setMessage("The sign-in methods now belong to the same MassageLab account.")
      setActionState("redirecting")
      setMessage("Linked. Redirecting to account security…")
      router.push("/account?tab=security")
      router.refresh()
    } catch {
      setActionState("error")
      setMessage(GENERIC_GOOGLE_LINK_RECOVERY_MESSAGE)
    } finally {
      actionLock.current = false
      if (!completed) {
        setPassword("")
      }
    }
  }

  return (
    <AppSurface
      title={<h1>Confirm the same MassageLab account</h1>}
      description="A MassageLab account already uses this Google email. Confirm its password sign-in to make Google and password login two ways into that same MassageLab account."
      contentClassName="gap-5"
    >
      {!validIntent ? (
        <AppInset className="space-y-3 p-4">
          <p role="alert" aria-live="assertive" className="text-sm text-amber-100">
            This Google confirmation expired or belongs to another browser. Start Google sign-in again.
          </p>
          <Button asChild variant="outline"><Link href="/login">Return to sign in</Link></Button>
        </AppInset>
      ) : (
        <form className="space-y-4" onSubmit={confirmSameAccount} aria-busy={busy}>
          <div className="space-y-2">
            <Label htmlFor="linkAccountEmail">Account email</Label>
            <Input id="linkAccountEmail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkAccountPassword">Password</Label>
            <Input id="linkAccountPassword" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
          </div>
          {needsTwoFactor ? (
            <div className="space-y-2">
              <Label htmlFor="linkAccountTwoFactor">Authenticator or backup code</Label>
              <Input id="linkAccountTwoFactor" autoComplete="one-time-code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} required disabled={busy} />
            </div>
          ) : null}
          <AsyncActionButton
            type="submit"
            className="w-full"
            pending={busy}
            idleLabel="Confirm same MassageLab account"
            pendingLabel="Connecting Google…"
          />
        </form>
      )}
      {message ? (
        <AppInset className="p-3 text-sm">
          <p role={actionState === "error" ? "alert" : busy ? undefined : "status"} aria-live={actionState === "error" ? "assertive" : busy ? undefined : "polite"}>{message}</p>
        </AppInset>
      ) : null}
    </AppSurface>
  )
}
