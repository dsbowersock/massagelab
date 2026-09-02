"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"

import { AsyncActionButton } from "@/components/forms/async-action-button"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PendingSecurityAction, SignInMethodAvailability } from "@/app/account/security/security-panel"

type MethodActionState = "idle" | "proving" | "saving" | "redirecting" | "success" | "error"
type MethodResponse = { code?: string; message?: string; googleLinked?: boolean; hasPasswordCredential?: boolean }

/** Owns recoverable client states while server routes retain every proof and mutation rule. */
export function SignInMethodsPanel({
  hasPasswordCredential,
  googleLinked,
  pendingAction,
  beginAction,
  finishAction,
  onMethodAvailabilityChange,
}: {
  hasPasswordCredential: boolean
  googleLinked: boolean
  pendingAction: PendingSecurityAction
  beginAction: (action: Exclude<PendingSecurityAction, null>) => boolean
  finishAction: (action: Exclude<PendingSecurityAction, null>) => void
  onMethodAvailabilityChange: (update: Partial<SignInMethodAvailability>) => void
}) {
  const passwordAvailable = hasPasswordCredential
  const googleAccountLinked = googleLinked
  const [addPassword, setAddPassword] = useState("")
  const [addPasswordConfirmed, setAddPasswordConfirmed] = useState(false)
  const [changeCurrentPassword, setChangeCurrentPassword] = useState("")
  const [changeNewPassword, setChangeNewPassword] = useState("")
  const [changeTwoFactorCode, setChangeTwoFactorCode] = useState("")
  const [changePasswordConfirmed, setChangePasswordConfirmed] = useState(false)
  const [unlinkPassword, setUnlinkPassword] = useState("")
  const [unlinkTwoFactorCode, setUnlinkTwoFactorCode] = useState("")
  const [unlinkGoogleConfirmed, setUnlinkGoogleConfirmed] = useState(false)
  const [disablePasswordConfirmed, setDisablePasswordConfirmed] = useState(false)
  const [reauthComplete, setReauthComplete] = useState(false)
  const [actionState, setActionState] = useState<MethodActionState>("idle")
  const [message, setMessage] = useState("")
  const busy = pendingAction !== null

  useEffect(() => {
    setReauthComplete(new URLSearchParams(window.location.search).get("reauth") === "complete")
  }, [])

  function begin(pending: Exclude<PendingSecurityAction, null>, action: MethodActionState, status: string) {
    if (!beginAction(pending)) return false
    setActionState(action)
    setMessage(status)
    return true
  }

  function applyMethodResponse(result: MethodResponse) {
    // Preserve the current method availability when a mutation omits both explicit availability fields.
    if (
      typeof result.googleLinked !== "boolean"
      && typeof result.hasPasswordCredential !== "boolean"
    ) return
    onMethodAvailabilityChange({
      ...(typeof result.googleLinked === "boolean" ? { googleLinked: result.googleLinked } : {}),
      ...(typeof result.hasPasswordCredential === "boolean"
        ? { hasPasswordCredential: result.hasPasswordCredential }
        : {}),
    })
  }

  async function startGoogleProof(purpose: "SIGN_IN_OR_LINK" | "ADD_PASSWORD" | "REMOVE_PASSWORD") {
    if (!begin("google-proof", "proving", "Preparing secure Google confirmation…")) return
    let documentNavigationStarted = false
    try {
      const response = await fetch("/api/auth/google/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(purpose === "SIGN_IN_OR_LINK"
          ? { purpose, callbackUrl: "/account?tab=security" }
          : { purpose }),
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; callbackUrl?: string }
      if (!response.ok || !result.ok || !result.callbackUrl) throw new Error("Google confirmation could not be started. Try again.")
      setActionState("redirecting")
      setMessage("Redirecting to Google confirmation…")
      const initialHref = window.location.href
      await signIn("google", { redirectTo: result.callbackUrl })
      documentNavigationStarted = window.location.href !== initialHref
      if (!documentNavigationStarted) throw new Error("Google navigation did not start")
    } catch {
      setActionState("error")
      setMessage("Something went wrong. Please try again.")
    } finally {
      if (!documentNavigationStarted) finishAction("google-proof")
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!begin("password", "saving", passwordAvailable ? "Changing password…" : "Adding password sign-in…")) return
    const mode = passwordAvailable ? "CHANGE" : "ADD"
    try {
      const response = await fetch("/api/account/security/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "CHANGE"
          ? { mode, currentPassword: changeCurrentPassword, newPassword: changeNewPassword, twoFactorCode: changeTwoFactorCode, confirmed: changePasswordConfirmed }
          : { mode, newPassword: addPassword, confirmed: addPasswordConfirmed }),
      })
      const result = await response.json().catch(() => ({})) as MethodResponse
      if (!response.ok) throw new Error(result.message ?? "The password change could not be saved. Try again.")
      applyMethodResponse(result)
      setActionState("success")
      setMessage(result.message ?? "Password sign-in was saved.")
      if (mode === "CHANGE") setChangePasswordConfirmed(false)
      else setAddPasswordConfirmed(false)
      setReauthComplete(false)
    } catch {
      setActionState("error")
      setMessage("Something went wrong. Please try again.")
    } finally {
      finishAction("password")
      if (mode === "CHANGE") {
        setChangeCurrentPassword("")
        setChangeNewPassword("")
        setChangeTwoFactorCode("")
      } else {
        setAddPassword("")
      }
    }
  }

  async function unlinkGoogle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!begin("unlink-google", "saving", "Removing Google sign-in…")) return
    try {
      const response = await fetch("/api/account/security/google/unlink", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: unlinkPassword, twoFactorCode: unlinkTwoFactorCode, confirmed: unlinkGoogleConfirmed }),
      })
      const result = await response.json().catch(() => ({})) as MethodResponse
      if (!response.ok) throw new Error(result.message ?? "Google sign-in could not be removed. Try again.")
      applyMethodResponse(result)
      setActionState("success")
      setMessage(result.message ?? "Google sign-in was removed.")
      setUnlinkGoogleConfirmed(false)
    } catch {
      setActionState("error")
      setMessage("Something went wrong. Please try again.")
    } finally {
      finishAction("unlink-google")
      setUnlinkPassword("")
      setUnlinkTwoFactorCode("")
    }
  }

  async function disablePassword() {
    if (!begin("disable-password", "saving", "Disabling password sign-in…")) return
    try {
      const response = await fetch("/api/account/security/password/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: disablePasswordConfirmed }),
      })
      const result = await response.json().catch(() => ({})) as MethodResponse
      if (!response.ok) throw new Error(result.message ?? "Password sign-in could not be disabled. Try again.")
      applyMethodResponse(result)
      setActionState("success")
      setMessage(result.message ?? "Password sign-in was disabled.")
      setDisablePasswordConfirmed(false)
      setReauthComplete(false)
    } catch {
      setActionState("error")
      setMessage("Something went wrong. Please try again.")
    } finally {
      finishAction("disable-password")
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
        <AsyncActionButton type="button" variant="outline" disabled={busy} pending={pendingAction === "google-proof"} idleLabel="Link Google sign-in" pendingLabel="Saving sign-in method…" onClick={() => startGoogleProof("SIGN_IN_OR_LINK")} />
      ) : null}

      {!passwordAvailable && googleAccountLinked && !reauthComplete ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Confirm your linked Google account before adding a password.</p>
          <AsyncActionButton type="button" variant="outline" disabled={busy} pending={pendingAction === "google-proof"} idleLabel="Add password" pendingLabel="Saving sign-in method…" onClick={() => startGoogleProof("ADD_PASSWORD")} />
        </div>
      ) : null}

      {passwordAvailable ? (
        <form className="space-y-3" onSubmit={savePassword} aria-busy={busy}>
          <div className="space-y-2">
            <Label htmlFor="changeCurrentPassword">Current password</Label>
            <Input id="changeCurrentPassword" type="password" autoComplete="current-password" value={changeCurrentPassword} onChange={(event) => setChangeCurrentPassword(event.target.value)} required disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="changeNewPassword">New password</Label>
            <Input id="changeNewPassword" type="password" autoComplete="new-password" minLength={12} value={changeNewPassword} onChange={(event) => setChangeNewPassword(event.target.value)} required disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="changeTwoFactorCode">Authenticator or backup code (if enabled)</Label>
            <Input id="changeTwoFactorCode" autoComplete="one-time-code" value={changeTwoFactorCode} onChange={(event) => setChangeTwoFactorCode(event.target.value)} disabled={busy} />
          </div>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <input type="checkbox" checked={changePasswordConfirmed} onChange={(event) => setChangePasswordConfirmed(event.target.checked)} disabled={busy} />
            <span>Confirm this password sign-in change.</span>
          </label>
          <AsyncActionButton type="submit" variant="outline" disabled={busy || !changePasswordConfirmed} pending={pendingAction === "password"} idleLabel="Update password" pendingLabel="Saving sign-in method…" />
        </form>
      ) : null}

      {canAddPassword ? (
        <form className="space-y-3" onSubmit={savePassword} aria-busy={busy}>
          <div className="space-y-2">
            <Label htmlFor="addPassword">Create password</Label>
            <Input id="addPassword" type="password" autoComplete="new-password" minLength={12} value={addPassword} onChange={(event) => setAddPassword(event.target.value)} required disabled={busy} />
          </div>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <input type="checkbox" checked={addPasswordConfirmed} onChange={(event) => setAddPasswordConfirmed(event.target.checked)} disabled={busy} />
            <span>Confirm this password sign-in change.</span>
          </label>
          <AsyncActionButton type="submit" variant="outline" disabled={busy || !addPasswordConfirmed} pending={pendingAction === "password"} idleLabel="Add password sign-in" pendingLabel="Saving sign-in method…" />
        </form>
      ) : null}

      {googleAccountLinked && passwordAvailable ? (
        <form className="space-y-3" onSubmit={unlinkGoogle} aria-busy={busy}>
          <div className="space-y-2">
            <Label htmlFor="unlinkPassword">Password to remove Google</Label>
            <Input id="unlinkPassword" type="password" autoComplete="current-password" value={unlinkPassword} onChange={(event) => setUnlinkPassword(event.target.value)} required disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unlinkTwoFactorCode">Authenticator or backup code to remove Google (if enabled)</Label>
            <Input id="unlinkTwoFactorCode" autoComplete="one-time-code" value={unlinkTwoFactorCode} onChange={(event) => setUnlinkTwoFactorCode(event.target.value)} disabled={busy} />
          </div>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <input type="checkbox" aria-label="Confirm remove Google sign-in" checked={unlinkGoogleConfirmed} onChange={(event) => setUnlinkGoogleConfirmed(event.target.checked)} disabled={busy} />
            <span>Confirm that Google sign-in should be removed.</span>
          </label>
          <AsyncActionButton type="submit" variant="outline" disabled={busy || !unlinkGoogleConfirmed} pending={pendingAction === "unlink-google"} idleLabel="Unlink Google" pendingLabel="Saving sign-in method…" />
        </form>
      ) : googleAccountLinked ? (
        <p className="text-sm text-muted-foreground">Add a password before removing Google so you keep at least one sign-in method.</p>
      ) : null}

      {passwordAvailable && googleAccountLinked && !reauthComplete ? (
        <AsyncActionButton type="button" variant="outline" disabled={busy} pending={pendingAction === "google-proof"} idleLabel="Confirm Google to disable password" pendingLabel="Saving sign-in method…" onClick={() => startGoogleProof("REMOVE_PASSWORD")} />
      ) : null}
      {canDisablePassword ? (
        <div className="space-y-3" aria-busy={busy}>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <input type="checkbox" aria-label="Confirm disable password sign-in" checked={disablePasswordConfirmed} onChange={(event) => setDisablePasswordConfirmed(event.target.checked)} disabled={busy} />
            <span>Confirm that password sign-in should be disabled.</span>
          </label>
          <AsyncActionButton type="button" variant="outline" disabled={busy || !disablePasswordConfirmed} pending={pendingAction === "disable-password"} idleLabel="Disable password sign-in" pendingLabel="Saving sign-in method…" onClick={disablePassword} />
        </div>
      ) : null}

      {message ? (
        <AppInset className="p-3 text-sm">
          <p role={actionState === "error" ? "alert" : busy ? undefined : "status"} aria-live={actionState === "error" ? "assertive" : busy ? undefined : "polite"}>{message}</p>
        </AppInset>
      ) : null}
    </AppSurface>
  )
}
