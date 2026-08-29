"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { AsyncActionButton } from "@/components/forms/async-action-button"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SignInMethodsPanel } from "@/app/account/security/sign-in-methods-panel"

type SecurityPanelProps = {
  twoFactorEnabled: boolean
  hasPasswordCredential: boolean
  googleLinked: boolean
}

export type PendingSecurityAction =
  | "google-proof"
  | "password"
  | "unlink-google"
  | "disable-password"
  | "setup"
  | "enable"
  | "disable"
  | "backup-codes"
  | null

export function SecurityPanel({ twoFactorEnabled, hasPasswordCredential, googleLinked }: SecurityPanelProps) {
  const [qrCode, setQrCode] = useState("")
  const [manualCode, setManualCode] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [statusIsError, setStatusIsError] = useState(false)
  const [enabled, setEnabled] = useState(twoFactorEnabled)
  const [pendingAction, setPendingAction] = useState<PendingSecurityAction>(null)
  const actionLock = useRef<PendingSecurityAction>(null)

  function beginAction(action: Exclude<PendingSecurityAction, null>) {
    if (actionLock.current !== null) return false
    actionLock.current = action
    setPendingAction(action)
    setStatus("")
    setStatusIsError(false)
    return true
  }

  function finishAction(action: Exclude<PendingSecurityAction, null>) {
    if (actionLock.current !== action) return
    actionLock.current = null
    setPendingAction(null)
  }

  async function startSetup() {
    if (!beginAction("setup")) return
    setBackupCodes([])
    try {
      const response = await fetch("/api/account/security/totp/setup", { method: "POST" })
      const result = await response.json().catch(() => ({})) as { message?: string; qrCode?: string; manualCode?: string }
      if (!response.ok || !result.qrCode || !result.manualCode) {
        setStatus(result.message ?? "2FA setup failed.")
        setStatusIsError(true)
        return
      }
      setQrCode(result.qrCode)
      setManualCode(result.manualCode)
      setStatus("Scan the QR code, then enter a code from your authenticator app.")
    } catch {
      setStatus("Something went wrong. Please try again.")
      setStatusIsError(true)
    } finally {
      finishAction("setup")
    }
  }

  async function enableTwoFactor() {
    if (!beginAction("enable")) return
    try {
      const response = await fetch("/api/account/security/totp/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      })
      const result = await response.json().catch(() => ({})) as { message?: string; backupCodes?: string[] }
      setStatus(result.message ?? (response.ok ? "2FA enabled." : "2FA setup failed."))
      setStatusIsError(!response.ok)
      if (response.ok) {
        setEnabled(true)
        setQrCode("")
        setManualCode("")
        setVerificationCode("")
        setBackupCodes(result.backupCodes ?? [])
      }
    } catch {
      setStatus("Something went wrong. Please try again.")
      setStatusIsError(true)
    } finally {
      finishAction("enable")
    }
  }

  async function disableTwoFactor() {
    if (!beginAction("disable")) return
    try {
      const response = await fetch("/api/account/security/totp/disable", { method: "POST" })
      const result = await response.json().catch(() => ({})) as { message?: string }
      setStatus(result.message ?? (response.ok ? "2FA disabled." : "Could not disable 2FA."))
      setStatusIsError(!response.ok)
      if (response.ok) {
        setEnabled(false)
        setBackupCodes([])
      }
    } catch {
      setStatus("Something went wrong. Please try again.")
      setStatusIsError(true)
    } finally {
      finishAction("disable")
    }
  }

  async function regenerateBackupCodes() {
    if (!beginAction("backup-codes")) return
    try {
      const response = await fetch("/api/account/security/backup-codes", { method: "POST" })
      const result = await response.json().catch(() => ({})) as { message?: string; backupCodes?: string[] }
      setStatus(response.ok ? "Backup codes regenerated. Store them now." : result.message ?? "Could not regenerate backup codes.")
      setStatusIsError(!response.ok)
      if (response.ok) setBackupCodes(result.backupCodes ?? [])
    } catch {
      setStatus("Something went wrong. Please try again.")
      setStatusIsError(true)
    } finally {
      finishAction("backup-codes")
    }
  }

  return (
    <div className="space-y-6">
      <SignInMethodsPanel
        hasPasswordCredential={hasPasswordCredential}
        googleLinked={googleLinked}
        pendingAction={pendingAction}
        beginAction={beginAction}
        finishAction={finishAction}
      />

      <AppSurface
        title="Authenticator-app 2FA"
        description={
          <>
            Use an authenticator app for email/password sign-in. Google sign-in relies on Google account security in this alpha.
          </>
        }
        contentClassName="gap-5"
      >
          <p className="text-sm text-muted-foreground">Current status: {enabled ? "Enabled" : "Not enabled"}</p>

          {!enabled && (
            <div className="space-y-4">
              <AsyncActionButton type="button" disabled={pendingAction !== null} pending={pendingAction === "setup"} idleLabel="Start setup" pendingLabel="Updating two-factor security…" onClick={startSetup} />
              {qrCode && (
                <AppInset className="space-y-4 p-4">
                  <Image src={qrCode} alt="Authenticator setup QR code" width={220} height={220} unoptimized />
                  <p className="break-all text-sm text-muted-foreground">Manual code: {manualCode}</p>
                  <div className="space-y-2">
                    <Label htmlFor="verificationCode">Authenticator code</Label>
                    <Input id="verificationCode" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} autoComplete="one-time-code" />
                  </div>
                  <AsyncActionButton type="button" variant="outline" disabled={pendingAction !== null} pending={pendingAction === "enable"} idleLabel="Verify and enable" pendingLabel="Updating two-factor security…" onClick={enableTwoFactor} />
                </AppInset>
              )}
            </div>
          )}

          {enabled && (
            <div className="flex flex-wrap gap-3">
              <AsyncActionButton type="button" variant="outline" disabled={pendingAction !== null} pending={pendingAction === "backup-codes"} idleLabel="Regenerate backup codes" pendingLabel="Updating two-factor security…" onClick={regenerateBackupCodes} />
              <AsyncActionButton type="button" variant="outline" disabled={pendingAction !== null} pending={pendingAction === "disable"} idleLabel="Disable 2FA" pendingLabel="Updating two-factor security…" onClick={disableTwoFactor} />
            </div>
          )}

          {backupCodes.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="mb-2 font-medium">Store these backup codes now. They will not be shown again.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {backupCodes.map((backupCode) => (
                  <code key={backupCode} className="rounded-sm bg-black/30 px-2 py-1">
                    {backupCode}
                  </code>
                ))}
              </div>
            </div>
          )}

          {status && (
            <AppInset className={`p-3 text-sm ${statusIsError ? "text-amber-100" : "text-muted-foreground"}`}>
              <p role={statusIsError ? "alert" : "status"}>{status}</p>
            </AppInset>
          )}
      </AppSurface>
    </div>
  )
}
