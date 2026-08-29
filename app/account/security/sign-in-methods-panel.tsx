"use client"

import { useEffect, useRef, useState } from "react"
import { signIn } from "next-auth/react"

import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type MethodActionState = "idle" | "proving" | "saving" | "redirecting" | "success" | "error"
type MethodResponse = { code?: string; message?: string; googleLinked?: boolean; hasPasswordCredential?: boolean }

/** Owns recoverable client states while server routes retain every proof and mutation rule. */
export function SignInMethodsPanel({
  hasPasswordCredential,
  googleLinked,
}: {
  hasPasswordCredential: boolean
  googleLinked: boolean
}) {
  const [passwordAvailable, setPasswordAvailable] = useState(hasPasswordCredential)
  const [googleAccountLinked, setGoogleAccountLinked] = useState(googleLinked)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [confirmChange, setConfirmChange] = useState(false)
  const [reauthComplete, setReauthComplete] = useState(false)
  const [actionState, setActionState] = useState<MethodActionState>("idle")
  const [message, setMessage] = useState("")
  const actionLock = useRef(false)
  const busy = actionState === "proving" || actionState === "saving" || actionState === "redirecting"

  useEffect(() => {
    setReauthComplete(new URLSearchParams(window.location.search).get("reauth") === "complete")
  }, [])

  function begin(action: MethodActionState, status: string) {
    if (actionLock.current) return false
    actionLock.current = true
    setActionState(action)
    setMessage(status)
    return true
  }

  function applyMethodResponse(result: MethodResponse) {
    if (typeof result.googleLinked === "boolean") setGoogleAccountLinked(result.googleLinked)
    if (typeof result.hasPasswordCredential === "boolean") setPasswordAvailable(result.hasPasswordCredential)
  }

  async function startGoogleProof(purpose: "SIGN_IN_OR_LINK" | "ADD_PASSWORD" | "REMOVE_PASSWORD") {
    if (!begin("proving", "Preparing secure Google confirmation…")) return
    let redirectStarted = false
    try {
      const response = await fetch("/api/auth/google/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose, callbackUrl: "/account?tab=security" }),
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; callbackUrl?: string }
      if (!response.ok || !result.ok || !result.callbackUrl) throw new Error("Google confirmation could not be started. Try again.")
      redirectStarted = true
      setActionState("redirecting")
      setMessage("Redirecting to Google confirmation…")
      await signIn("google", { redirectTo: result.callbackUrl })
    } catch (error) {
      setActionState("error")
      setMessage(error instanceof Error ? error.message : "Google confirmation could not be started. Try again.")
    } finally {
      actionLock.current = false
      if (!redirectStarted) setConfirmChange(false)
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!begin("saving", passwordAvailable ? "Changing password…" : "Adding password sign-in…")) return
    try {
      const mode = passwordAvailable ? "CHANGE" : "ADD"
      const response = await fetch("/api/account/security/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "CHANGE"
          ? { mode, currentPassword, newPassword, twoFactorCode, confirmed: confirmChange }
          : { mode, newPassword, confirmed: confirmChange }),
      })
      const result = await response.json().catch(() => ({})) as MethodResponse
      if (!response.ok) throw new Error(result.message ?? "The password change could not be saved. Try again.")
      applyMethodResponse(result)
      setActionState("success")
      setMessage(result.message ?? "Password sign-in was saved.")
      setCurrentPassword("")
      setNewPassword("")
      setTwoFactorCode("")
      setConfirmChange(false)
      setReauthComplete(false)
    } catch (error) {
      setActionState("error")
      setMessage(error instanceof Error ? error.message : "The password change could not be saved. Try again.")
    } finally {
      actionLock.current = false
      // The success/error state remains visible; the busy state always ends here.
    }
  }

  async function unlinkGoogle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!begin("saving", "Removing Google sign-in…")) return
    try {
      const response = await fetch("/api/account/security/google/unlink", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: currentPassword, twoFactorCode, confirmed: confirmChange }),
      })
      const result = await response.json().catch(() => ({})) as MethodResponse
      if (!response.ok) throw new Error(result.message ?? "Google sign-in could not be removed. Try again.")
      applyMethodResponse(result)
      setActionState("success")
      setMessage(result.message ?? "Google sign-in was removed.")
      setCurrentPassword("")
      setTwoFactorCode("")
      setConfirmChange(false)
    } catch (error) {
      setActionState("error")
      setMessage(error instanceof Error ? error.message : "Google sign-in could not be removed. Try again.")
    } finally {
      actionLock.current = false
      // The success/error state remains visible; the busy state always ends here.
    }
  }

  async function disablePassword() {
    if (!begin("saving", "Disabling password sign-in…")) return
    try {
      const response = await fetch("/api/account/security/password/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: confirmChange }),
      })
      const result = await response.json().catch(() => ({})) as MethodResponse
      if (!response.ok) throw new Error(result.message ?? "Password sign-in could not be disabled. Try again.")
      applyMethodResponse(result)
      setActionState("success")
      setMessage(result.message ?? "Password sign-in was disabled.")
      setConfirmChange(false)
      setReauthComplete(false)
    } catch (error) {
      setActionState("error")
      setMessage(error instanceof Error ? error.message : "Password sign-in could not be disabled. Try again.")
    } finally {
      actionLock.current = false
      // The success/error state remains visible; the busy state always ends here.
    }
  }

  const canAddPassword = !passwordAvailable && googleAccountLinked && reauthComplete
  const canDisablePassword = passwordAvailable && googleAccountLinked && reauthComplete

  return (
    <AppSurface
      title={<h2>Sign-in methods</h2>}
      description="Keep at least one verified way to sign in. A method is removed only after direct confirmation."
      contentClassName="gap-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <AppInset className="p-3">
          <p className="text-xs uppercase tracking-normal text-muted-foreground">Email/password</p>
          <p className="mt-1 text-sm font-medium">{passwordAvailable ? "Enabled" : "Not enabled"}</p>
        </AppInset>
        <AppInset className="p-3">
          <p className="text-xs uppercase tracking-normal text-muted-foreground">Google</p>
          <p className="mt-1 text-sm font-medium">{googleAccountLinked ? "Linked" : "Not linked"}</p>
        </AppInset>
      </div>

      {!googleAccountLinked ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => startGoogleProof("SIGN_IN_OR_LINK")}>
          {actionState === "redirecting" ? "Redirecting to Google…" : "Link Google sign-in"}
        </Button>
      ) : null}

      {!passwordAvailable && googleAccountLinked && !reauthComplete ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Confirm your linked Google account before adding a password.</p>
          <Button type="button" variant="outline" disabled={busy} onClick={() => startGoogleProof("ADD_PASSWORD")}>
            {actionState === "redirecting" ? "Redirecting to Google…" : "Add password"}
          </Button>
        </div>
      ) : null}

      {passwordAvailable || canAddPassword ? (
        <form className="space-y-3" onSubmit={savePassword} aria-busy={busy}>
          {passwordAvailable ? (
            <div className="space-y-2">
              <Label htmlFor="methodCurrentPassword">Current password</Label>
              <Input id="methodCurrentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={busy} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="methodNewPassword">{passwordAvailable ? "New password" : "Create password"}</Label>
            <Input id="methodNewPassword" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required disabled={busy} />
          </div>
          {passwordAvailable ? (
            <div className="space-y-2">
              <Label htmlFor="methodTwoFactorCode">Authenticator or backup code (if enabled)</Label>
              <Input id="methodTwoFactorCode" autoComplete="one-time-code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} disabled={busy} />
            </div>
          ) : null}
          <label className="flex gap-3 text-sm text-muted-foreground">
            <input type="checkbox" checked={confirmChange} onChange={(event) => setConfirmChange(event.target.checked)} disabled={busy} />
            <span>Confirm this password sign-in change.</span>
          </label>
          <Button type="submit" variant="outline" disabled={busy || !confirmChange}>
            {actionState === "saving" ? "Saving password…" : passwordAvailable ? "Update password" : "Add password sign-in"}
          </Button>
        </form>
      ) : null}

      {googleAccountLinked && passwordAvailable ? (
        <form className="space-y-3" onSubmit={unlinkGoogle} aria-busy={busy}>
          <div className="space-y-2">
            <Label htmlFor="unlinkCurrentPassword">Password to remove Google</Label>
            <Input id="unlinkCurrentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unlinkTwoFactorCode">Authenticator or backup code (if enabled)</Label>
            <Input id="unlinkTwoFactorCode" autoComplete="one-time-code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} disabled={busy} />
          </div>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <input type="checkbox" aria-label="Confirm remove Google sign-in" checked={confirmChange} onChange={(event) => setConfirmChange(event.target.checked)} disabled={busy} />
            <span>Confirm that Google sign-in should be removed.</span>
          </label>
          <Button type="submit" variant="outline" disabled={busy || !confirmChange}>
            {actionState === "saving" ? "Removing Google…" : "Unlink Google"}
          </Button>
        </form>
      ) : googleAccountLinked ? (
        <p className="text-sm text-muted-foreground">Add a password before removing Google so you keep at least one sign-in method.</p>
      ) : null}

      {passwordAvailable && googleAccountLinked && !reauthComplete ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => startGoogleProof("REMOVE_PASSWORD")}>
          {actionState === "redirecting" ? "Redirecting to Google…" : "Confirm Google to disable password"}
        </Button>
      ) : null}
      {canDisablePassword ? (
        <div className="space-y-3" aria-busy={busy}>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <input type="checkbox" aria-label="Confirm disable password sign-in" checked={confirmChange} onChange={(event) => setConfirmChange(event.target.checked)} disabled={busy} />
            <span>Confirm that password sign-in should be disabled.</span>
          </label>
          <Button type="button" variant="outline" disabled={busy || !confirmChange} onClick={disablePassword}>
            {actionState === "saving" ? "Disabling password…" : "Disable password sign-in"}
          </Button>
        </div>
      ) : null}

      {message ? (
        <AppInset className="p-3 text-sm">
          <p role={actionState === "error" ? "alert" : "status"} aria-live={actionState === "error" ? "assertive" : "polite"}>{message}</p>
        </AppInset>
      ) : null}
    </AppSurface>
  )
}
