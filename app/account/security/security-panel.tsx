"use client"

import { useState } from "react"
import Image from "next/image"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SignInMethodsPanel } from "@/app/account/security/sign-in-methods-panel"

type SecurityPanelProps = {
  twoFactorEnabled: boolean
  hasPasswordCredential: boolean
  googleLinked: boolean
}

export function SecurityPanel({ twoFactorEnabled, hasPasswordCredential, googleLinked }: SecurityPanelProps) {
  const [qrCode, setQrCode] = useState("")
  const [manualCode, setManualCode] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [enabled, setEnabled] = useState(twoFactorEnabled)

  async function startSetup() {
    setStatus("")
    setBackupCodes([])
    const response = await fetch("/api/account/security/totp/setup", { method: "POST" })
    const result = await response.json()

    if (!response.ok) {
      setStatus(result.message ?? "2FA setup failed.")
      return
    }

    setQrCode(result.qrCode)
    setManualCode(result.manualCode)
    setStatus("Scan the QR code, then enter a code from your authenticator app.")
  }

  async function enableTwoFactor() {
    const response = await fetch("/api/account/security/totp/enable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: verificationCode }),
    })
    const result = await response.json()

    setStatus(result.message ?? (response.ok ? "2FA enabled." : "2FA setup failed."))
    if (response.ok) {
      setEnabled(true)
      setQrCode("")
      setManualCode("")
      setVerificationCode("")
      setBackupCodes(result.backupCodes ?? [])
    }
  }

  async function disableTwoFactor() {
    const response = await fetch("/api/account/security/totp/disable", { method: "POST" })
    const result = await response.json()
    setStatus(result.message ?? (response.ok ? "2FA disabled." : "Could not disable 2FA."))
    if (response.ok) {
      setEnabled(false)
      setBackupCodes([])
    }
  }

  async function regenerateBackupCodes() {
    const response = await fetch("/api/account/security/backup-codes", { method: "POST" })
    const result = await response.json()
    setStatus(response.ok ? "Backup codes regenerated. Store them now." : result.message ?? "Could not regenerate backup codes.")
    if (response.ok) {
      setBackupCodes(result.backupCodes ?? [])
    }
  }

  return (
    <div className="space-y-6">
      <SignInMethodsPanel hasPasswordCredential={hasPasswordCredential} googleLinked={googleLinked} />

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
              <Button type="button" onClick={startSetup}>
                Start setup
              </Button>
              {qrCode && (
                <AppInset className="space-y-4 p-4">
                  <Image src={qrCode} alt="Authenticator setup QR code" width={220} height={220} unoptimized />
                  <p className="break-all text-sm text-muted-foreground">Manual code: {manualCode}</p>
                  <div className="space-y-2">
                    <Label htmlFor="verificationCode">Authenticator code</Label>
                    <Input id="verificationCode" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} autoComplete="one-time-code" />
                  </div>
                  <Button type="button" variant="outline" onClick={enableTwoFactor}>
                    Verify and enable
                  </Button>
                </AppInset>
              )}
            </div>
          )}

          {enabled && (
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={regenerateBackupCodes}>
                Regenerate backup codes
              </Button>
              <Button type="button" variant="outline" onClick={disableTwoFactor}>
                Disable 2FA
              </Button>
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

          {status && <AppInset className="p-3 text-sm text-muted-foreground">{status}</AppInset>}
      </AppSurface>
    </div>
  )
}
