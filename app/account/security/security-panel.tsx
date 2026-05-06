"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  const [passwordAvailable, setPasswordAvailable] = useState(hasPasswordCredential)
  const [googleAccountLinked, setGoogleAccountLinked] = useState(googleLinked)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")

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

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch("/api/account/security/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        password: newPassword,
      }),
    })
    const result = await response.json()

    setStatus(result.message ?? (response.ok ? "Password saved." : "Could not save password."))
    if (response.ok) {
      setPasswordAvailable(true)
      setCurrentPassword("")
      setNewPassword("")
    }
  }

  async function unlinkGoogle() {
    const response = await fetch("/api/account/security/google/unlink", { method: "POST" })
    const result = await response.json()

    setStatus(result.message ?? (response.ok ? "Google sign-in unlinked." : "Could not unlink Google sign-in."))
    if (response.ok) {
      setGoogleAccountLinked(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Sign-in methods</CardTitle>
          <CardDescription>
            Keep at least one verified way to sign in. Google can be unlinked only after email/password sign-in is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-800 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-normal text-muted-foreground">Email/password</p>
              <p className="mt-1 text-sm font-medium">{passwordAvailable ? "Enabled" : "Not enabled"}</p>
            </div>
            <div className="rounded-md border border-neutral-800 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-normal text-muted-foreground">Google</p>
              <p className="mt-1 text-sm font-medium">{googleAccountLinked ? "Linked" : "Not linked"}</p>
            </div>
          </div>

          <form className="space-y-3" onSubmit={savePassword}>
            {passwordAvailable ? (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="newPassword">{passwordAvailable ? "New password" : "Create password"}</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="outline">
              {passwordAvailable ? "Update password" : "Enable email/password"}
            </Button>
          </form>

          {googleAccountLinked ? (
            <Button type="button" variant="outline" onClick={unlinkGoogle} disabled={!passwordAvailable}>
              Unlink Google
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Authenticator-app 2FA</CardTitle>
          <CardDescription>
            Use an authenticator app for email/password sign-in. Google sign-in relies on Google account security in this alpha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">Current status: {enabled ? "Enabled" : "Not enabled"}</p>

          {!enabled && (
            <div className="space-y-4">
              <Button type="button" className="bg-[#ff7043] hover:bg-[#f4511e]" onClick={startSetup}>
                Start setup
              </Button>
              {qrCode && (
                <div className="space-y-4 rounded-md border border-neutral-800 bg-background/70 p-4">
                  <Image src={qrCode} alt="Authenticator setup QR code" width={220} height={220} unoptimized />
                  <p className="break-all text-sm text-muted-foreground">Manual code: {manualCode}</p>
                  <div className="space-y-2">
                    <Label htmlFor="verificationCode">Authenticator code</Label>
                    <Input id="verificationCode" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} autoComplete="one-time-code" />
                  </div>
                  <Button type="button" variant="outline" onClick={enableTwoFactor}>
                    Verify and enable
                  </Button>
                </div>
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

          {status && <p className="rounded-md border border-neutral-800 bg-background/70 p-3 text-sm text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
