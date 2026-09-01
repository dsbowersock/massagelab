"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { signIn, signOut } from "next-auth/react"

import type {
  PendingSecurityAction,
  TwoFactorGoogleReauthPurpose,
} from "@/app/account/security/security-panel"
import { AsyncActionButton } from "@/components/forms/async-action-button"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resolveTwoFactorManagementRecovery } from "@/lib/two-factor-management-recovery"

type ProofMethod = "PASSWORD" | "GOOGLE"
type EnrollmentData = { qrCode: string; manualCode: string }
type Feedback = { kind: "error" | "success"; message: string }
type SetupState = {
  proofMethod: ProofMethod
  password: string
  confirmed: boolean
  code: string
  enableConfirmed: boolean
  enrollment: EnrollmentData | null
}
type ManagementState = {
  proofMethod: ProofMethod
  password: string
  twoFactorCode: string
  confirmed: boolean
}

type TwoFactorManagementPanelProps = {
  twoFactorEnabled: boolean
  hasPasswordCredential: boolean
  googleLinked: boolean
  googleReauthReturnHint: TwoFactorGoogleReauthPurpose | null
  pendingAction: PendingSecurityAction
  beginAction: (action: Exclude<PendingSecurityAction, null>) => boolean
  finishAction: (action: Exclude<PendingSecurityAction, null>) => void
}

const REAUTH_CALLBACK = "/login?security=two-factor-changed"

/**
 * Owns the complete client-side two-factor workflow while treating URL return
 * state as display-only. Every mutation still sends the route's exact proof and
 * confirmation body, and all secrets remain only in this component's memory.
 */
export function TwoFactorManagementPanel({
  twoFactorEnabled,
  hasPasswordCredential,
  googleLinked,
  googleReauthReturnHint,
  pendingAction,
  beginAction,
  finishAction,
}: TwoFactorManagementPanelProps) {
  const [enabled, setEnabled] = useState(twoFactorEnabled)
  const [setup, setSetup] = useState<SetupState>({
    proofMethod: initialProofMethod("ENROLL_TWO_FACTOR", googleLinked, googleReauthReturnHint),
    password: "",
    confirmed: false,
    code: "",
    enableConfirmed: false,
    enrollment: null,
  })
  const [disable, setDisable] = useState<ManagementState>({
    proofMethod: initialProofMethod("DISABLE_TWO_FACTOR", googleLinked, googleReauthReturnHint),
    password: "",
    twoFactorCode: "",
    confirmed: false,
  })
  const [regenerate, setRegenerate] = useState<ManagementState>({
    proofMethod: initialProofMethod("REGENERATE_TWO_FACTOR_BACKUP_CODES", googleLinked, googleReauthReturnHint),
    password: "",
    twoFactorCode: "",
    confirmed: false,
  })
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [backupCodesAcknowledged, setBackupCodesAcknowledged] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [reauthRequired, setReauthRequired] = useState(false)
  const [activeGoogleReauthReturnHint, setActiveGoogleReauthReturnHint] = useState(googleReauthReturnHint)
  const setupSurfaceRef = useRef<HTMLDivElement>(null)
  const disableSurfaceRef = useRef<HTMLDivElement>(null)
  const regenerateSurfaceRef = useRef<HTMLDivElement>(null)
  const googleSurfaceRef = useRef<HTMLDivElement>(null)
  const backupCodesRecoveryRef = useRef<HTMLDivElement>(null)
  const reauthRecoveryRef = useRef<HTMLDivElement>(null)
  const busy = pendingAction !== null
  const hasUsablePrimaryMethod = hasPasswordCredential || googleLinked
  const setupAvailable = !enabled && hasPasswordCredential

  useEffect(() => {
    if (backupCodes.length > 0) focusSurface(backupCodesRecoveryRef)
  }, [backupCodes])

  useEffect(() => {
    if (reauthRequired) focusSurface(reauthRecoveryRef)
  }, [reauthRequired])

  function proofReady(method: ProofMethod, purpose: TwoFactorGoogleReauthPurpose) {
    return method === "PASSWORD"
      ? hasPasswordCredential
      : googleLinked && activeGoogleReauthReturnHint === purpose
  }

  function fail(
    status: number,
    result: unknown,
    purpose?: TwoFactorGoogleReauthPurpose,
  ) {
    if (purpose && status === 403 && isResultCode(result, "GOOGLE_PROOF_EXPIRED")) {
      setActiveGoogleReauthReturnHint((current) => current === purpose ? null : current)
    }
    setFeedback({ kind: "error", ...resolveTwoFactorManagementRecovery(status, result) })
  }

  function failGeneric() {
    fail(0, null)
  }

  async function startGoogleProof(
    purpose: TwoFactorGoogleReauthPurpose,
    action: "google-proof-enroll" | "google-proof-disable" | "google-proof-backup-codes",
  ) {
    if (!beginAction(action)) return
    setFeedback(null)
    let redirecting = false
    try {
      const initialHref = window.location.href
      const response = await fetch("/api/auth/google/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose }),
      })
      const result = await readJson(response)
      if (!response.ok || !isJsonObject(result) || result.ok !== true || typeof result.callbackUrl !== "string") {
        fail(response.status, result)
        return
      }
      await signIn("google", { redirectTo: result.callbackUrl })
      redirecting = window.location.href !== initialHref
      if (!redirecting) throw new Error("Google sign-in returned without navigation.")
    } catch {
      redirecting = false
      failGeneric()
    } finally {
      if (!redirecting) {
        finishAction(action)
        focusSurface(googleSurfaceRef)
      }
    }
  }

  async function startSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !setupAvailable
      || !setup.confirmed
      || !proofReady(setup.proofMethod, "ENROLL_TWO_FACTOR")
      || (setup.proofMethod === "PASSWORD" && !setup.password)
      || !beginAction("setup")
    ) return
    setFeedback(null)
    setBackupCodes([])
    setBackupCodesAcknowledged(false)
    try {
      const response = await fetch("/api/account/security/totp/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(setup.proofMethod === "PASSWORD"
          ? { proofMethod: "PASSWORD", password: setup.password, confirmed: true }
          : { proofMethod: "GOOGLE", confirmed: true }),
      })
      const result = await readJson(response)
      if (!response.ok || !isSetupReady(result)) {
        fail(response.status, result, "ENROLL_TWO_FACTOR")
        return
      }
      setSetup((current) => ({
        ...current,
        password: "",
        confirmed: false,
        code: "",
        enableConfirmed: false,
        enrollment: { qrCode: result.qrCode, manualCode: result.manualCode },
      }))
      setFeedback({
        kind: "success",
        message: "Scan the QR code, save the manual code, then verify a new authenticator code.",
      })
    } catch {
      failGeneric()
    } finally {
      finishAction("setup")
      focusSurface(setupSurfaceRef)
    }
  }

  async function enableTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!setup.enrollment || !setup.code || !setup.enableConfirmed || !beginAction("enable")) return
    setFeedback(null)
    let enabledSuccessfully = false
    try {
      const response = await fetch("/api/account/security/totp/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: setup.code, confirmed: true }),
      })
      const result = await readJson(response)
      if (!response.ok || !isBackupCodeSuccess(result, "TWO_FACTOR_ENABLED")) {
        if (isResultCode(result, "ENROLLMENT_EXPIRED")) {
          setSetup((current) => ({ ...current, code: "", enableConfirmed: false, enrollment: null }))
        }
        fail(response.status, result)
        return
      }
      setEnabled(true)
      setSetup((current) => ({
        ...current,
        password: "",
        confirmed: false,
        code: "",
        enableConfirmed: false,
        enrollment: null,
      }))
      setBackupCodes(result.backupCodes)
      setBackupCodesAcknowledged(false)
      setFeedback({ kind: "success", message: "Two-factor authentication is enabled. Save every backup code before signing in again." })
      enabledSuccessfully = true
    } catch {
      failGeneric()
    } finally {
      finishAction("enable")
      if (!enabledSuccessfully) focusSurface(setupSurfaceRef)
    }
  }

  async function disableTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmitManagement(disable, (method) => proofReady(method, "DISABLE_TWO_FACTOR")) || !beginAction("disable")) return
    setFeedback(null)
    let disabledSuccessfully = false
    try {
      const response = await fetch("/api/account/security/totp/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(managementBody(disable)),
      })
      const result = await readJson(response)
      if (!response.ok || !isResultCode(result, "TWO_FACTOR_DISABLED")) {
        fail(response.status, result, "DISABLE_TWO_FACTOR")
        return
      }
      setEnabled(false)
      setDisable((current) => emptyManagementState(current.proofMethod))
      setBackupCodes([])
      setBackupCodesAcknowledged(false)
      setReauthRequired(true)
      setFeedback({ kind: "success", message: "Two-factor authentication is disabled. Your sessions were ended; sign in again to continue." })
      disabledSuccessfully = true
    } catch {
      failGeneric()
    } finally {
      finishAction("disable")
      if (!disabledSuccessfully) focusSurface(disableSurfaceRef)
    }
  }

  async function regenerateBackupCodes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmitManagement(regenerate, (method) => proofReady(method, "REGENERATE_TWO_FACTOR_BACKUP_CODES")) || !beginAction("backup-codes")) return
    setFeedback(null)
    try {
      const response = await fetch("/api/account/security/backup-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(managementBody(regenerate)),
      })
      const result = await readJson(response)
      if (!response.ok || !isBackupCodeSuccess(result, "BACKUP_CODES_REGENERATED")) {
        fail(response.status, result, "REGENERATE_TWO_FACTOR_BACKUP_CODES")
        return
      }
      setRegenerate((current) => emptyManagementState(current.proofMethod))
      setBackupCodes(result.backupCodes)
      setBackupCodesAcknowledged(false)
      setFeedback({ kind: "success", message: "New backup codes are ready. Save every code before signing in again." })
    } catch {
      failGeneric()
    } finally {
      finishAction("backup-codes")
      focusSurface(regenerateSurfaceRef)
    }
  }

  async function signInAgainAfterCodes() {
    if (
      !backupCodesAcknowledged
      || backupCodes.length === 0
      || !beginAction("backup-codes-sign-out")
    ) return
    setFeedback(null)
    try {
      await signOut({ redirectTo: REAUTH_CALLBACK })
      setBackupCodes([])
      setBackupCodesAcknowledged(false)
    } catch {
      failGeneric()
    } finally {
      finishAction("backup-codes-sign-out")
    }
  }

  async function signInAgain() {
    if (!beginAction("two-factor-sign-out")) return
    setFeedback(null)
    try {
      await signOut({ redirectTo: REAUTH_CALLBACK })
    } catch {
      failGeneric()
    } finally {
      finishAction("two-factor-sign-out")
    }
  }

  return (
    <AppSurface
      title={<h2>Authenticator-app 2FA</h2>}
      description="Protect password sign-in with an authenticator app. Security changes end existing sessions after they commit."
      contentClassName="gap-5"
    >
      <p className="text-sm text-muted-foreground">Current status: {enabled ? "Enabled" : "Not enabled"}</p>

      {googleLinked && (enabled || hasPasswordCredential) ? (
        <div ref={googleSurfaceRef} tabIndex={-1} className="space-y-2" data-two-factor-surface="google-proof">
          {activeGoogleReauthReturnHint ? (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Google confirmation return detected for {googleProofLabel(activeGoogleReauthReturnHint)}. The server still verifies the private proof when you submit.
            </p>
          ) : <p className="text-sm text-muted-foreground">Use your password, or confirm your linked Google account for the exact two-factor change you want to make.</p>}
          <div className="flex flex-wrap gap-2">
            {!enabled && hasPasswordCredential && activeGoogleReauthReturnHint !== "ENROLL_TWO_FACTOR" ? (
              <AsyncActionButton
                type="button"
                variant="outline"
                disabled={busy}
                pending={pendingAction === "google-proof-enroll"}
                idleLabel="Confirm with Google for setup"
                pendingLabel="Redirecting to Google…"
                onClick={() => startGoogleProof("ENROLL_TWO_FACTOR", "google-proof-enroll")}
              />
            ) : null}
            {enabled && activeGoogleReauthReturnHint !== "REGENERATE_TWO_FACTOR_BACKUP_CODES" ? (
              <AsyncActionButton
                type="button"
                variant="outline"
                disabled={busy}
                pending={pendingAction === "google-proof-backup-codes"}
                idleLabel="Confirm with Google for backup codes"
                pendingLabel="Redirecting to Google…"
                onClick={() => startGoogleProof("REGENERATE_TWO_FACTOR_BACKUP_CODES", "google-proof-backup-codes")}
              />
            ) : null}
            {enabled && activeGoogleReauthReturnHint !== "DISABLE_TWO_FACTOR" ? (
              <AsyncActionButton
                type="button"
                variant="outline"
                disabled={busy}
                pending={pendingAction === "google-proof-disable"}
                idleLabel="Confirm with Google to disable 2FA"
                pendingLabel="Redirecting to Google…"
                onClick={() => startGoogleProof("DISABLE_TWO_FACTOR", "google-proof-disable")}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {!enabled && !hasPasswordCredential && googleLinked ? (
        <AppInset className="p-4 text-sm text-muted-foreground">
          <p><strong>Add a password first.</strong> Use the Sign-in methods section above before setting up two-factor authentication.</p>
        </AppInset>
      ) : null}

      {!enabled && !hasPasswordCredential && !googleLinked ? (
        <AdminRecoveryGuidance />
      ) : null}

      {setupAvailable ? (
        <div ref={setupSurfaceRef} tabIndex={-1} className="space-y-4" data-two-factor-surface="setup">
          <h3 className="font-medium">Set up authenticator-app 2FA</h3>
          {!setup.enrollment ? (
            <form data-two-factor-action="setup" className="space-y-3" aria-busy={busy} onSubmit={startSetup}>
              <ProofMethodFields
                idPrefix="setup"
                value={setup.proofMethod}
                hasPasswordCredential={hasPasswordCredential}
                googleLinked={googleLinked}
                googleReturnHintMatches={activeGoogleReauthReturnHint === "ENROLL_TWO_FACTOR"}
                busy={busy}
                onChange={(proofMethod) => setSetup((current) => ({ ...current, proofMethod }))}
              />
              {setup.proofMethod === "PASSWORD" ? (
                <div className="space-y-2">
                  <Label htmlFor="setupPassword">Password for two-factor setup</Label>
                  <Input id="setupPassword" type="password" autoComplete="current-password" required disabled={busy} value={setup.password} onChange={(event) => setSetup((current) => ({ ...current, password: event.target.value }))} />
                </div>
              ) : null}
              <label className="flex gap-3 text-sm text-muted-foreground">
                <input id="setupConfirmed" aria-label="Confirm two-factor setup" type="checkbox" disabled={busy} checked={setup.confirmed} onChange={(event) => setSetup((current) => ({ ...current, confirmed: event.target.checked }))} />
                <span>Confirm that this account should begin a new authenticator setup.</span>
              </label>
              <AsyncActionButton
                type="submit"
                variant="outline"
                disabled={busy || !setup.confirmed || !proofReady(setup.proofMethod, "ENROLL_TWO_FACTOR") || (setup.proofMethod === "PASSWORD" && !setup.password)}
                pending={pendingAction === "setup"}
                idleLabel="Start two-factor setup"
                pendingLabel="Preparing two-factor setup…"
              />
            </form>
          ) : (
            <AppInset className="space-y-4 p-4">
              <Image src={setup.enrollment.qrCode} alt="Authenticator setup QR code" width={220} height={220} unoptimized />
              <p className="break-all text-sm text-muted-foreground">Manual code: <code>{setup.enrollment.manualCode}</code></p>
              <form data-two-factor-action="enable" className="space-y-3" aria-busy={busy} onSubmit={enableTwoFactor}>
                <div className="space-y-2">
                  <Label htmlFor="enableCode">New authenticator code</Label>
                  <Input id="enableCode" autoComplete="one-time-code" inputMode="numeric" required disabled={busy} value={setup.code} onChange={(event) => setSetup((current) => ({ ...current, code: event.target.value }))} />
                </div>
                <label className="flex gap-3 text-sm text-muted-foreground">
                  <input id="enableConfirmed" aria-label="Confirm enable two-factor authentication" type="checkbox" disabled={busy} checked={setup.enableConfirmed} onChange={(event) => setSetup((current) => ({ ...current, enableConfirmed: event.target.checked }))} />
                  <span>Confirm that this new authenticator should protect the account.</span>
                </label>
                <AsyncActionButton
                  type="submit"
                  variant="outline"
                  disabled={busy || !setup.code || !setup.enableConfirmed}
                  pending={pendingAction === "enable"}
                  idleLabel="Verify and enable"
                  pendingLabel="Enabling two-factor authentication…"
                />
              </form>
            </AppInset>
          )}
        </div>
      ) : null}

      {enabled && hasUsablePrimaryMethod ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ManagementForm
            action="backup-codes"
            title="Regenerate backup codes"
            idPrefix="regenerate"
            state={regenerate}
            setState={setRegenerate}
            surfaceRef={regenerateSurfaceRef}
            hasPasswordCredential={hasPasswordCredential}
            googleLinked={googleLinked}
            googleReturnHintMatches={activeGoogleReauthReturnHint === "REGENERATE_TWO_FACTOR_BACKUP_CODES"}
            busy={busy}
            pending={pendingAction === "backup-codes"}
            idleLabel="Regenerate backup codes"
            pendingLabel="Regenerating backup codes…"
            onSubmit={regenerateBackupCodes}
            canSubmit={canSubmitManagement(regenerate, (method) => proofReady(method, "REGENERATE_TWO_FACTOR_BACKUP_CODES"))}
          />
          <ManagementForm
            action="disable"
            title="Disable two-factor authentication"
            idPrefix="disable"
            state={disable}
            setState={setDisable}
            surfaceRef={disableSurfaceRef}
            hasPasswordCredential={hasPasswordCredential}
            googleLinked={googleLinked}
            googleReturnHintMatches={activeGoogleReauthReturnHint === "DISABLE_TWO_FACTOR"}
            busy={busy}
            pending={pendingAction === "disable"}
            idleLabel="Disable two-factor authentication"
            pendingLabel="Disabling two-factor authentication…"
            onSubmit={disableTwoFactor}
            canSubmit={canSubmitManagement(disable, (method) => proofReady(method, "DISABLE_TWO_FACTOR"))}
          />
        </div>
      ) : null}

      {enabled && !hasUsablePrimaryMethod ? <AdminRecoveryGuidance /> : null}

      {backupCodes.length > 0 || pendingAction === "backup-codes-sign-out" ? (
        <div
          ref={backupCodesRecoveryRef}
          tabIndex={-1}
          aria-busy={pendingAction === "backup-codes-sign-out"}
          data-two-factor-recovery="backup-codes"
          className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          <AppInset className="space-y-4 border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            {backupCodes.length > 0 ? (
              <>
                <p className="font-medium">Save these backup codes now. They will not be shown again.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {backupCodes.map((backupCode) => <code key={backupCode} className="rounded-sm bg-black/30 px-2 py-1">{backupCode}</code>)}
                </div>
                <label className="flex gap-3 text-sm text-muted-foreground">
                  <input id="backupCodesAcknowledged" aria-label="I saved these backup codes" type="checkbox" disabled={busy} checked={backupCodesAcknowledged} onChange={(event) => setBackupCodesAcknowledged(event.target.checked)} />
                  <span>I saved these backup codes somewhere secure.</span>
                </label>
              </>
            ) : null}
            <AsyncActionButton
              type="button"
              variant="outline"
              disabled={busy || !backupCodesAcknowledged}
              pending={pendingAction === "backup-codes-sign-out"}
              idleLabel="I saved these codes; sign in again"
              pendingLabel="Signing out…"
              onClick={signInAgainAfterCodes}
            />
          </AppInset>
        </div>
      ) : null}

      {reauthRequired ? (
        <div
          ref={reauthRecoveryRef}
          tabIndex={-1}
          aria-busy={pendingAction === "two-factor-sign-out"}
          data-two-factor-recovery="reauth"
          className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          <AppInset className="space-y-3 p-4 text-sm">
            <p>Two-factor authentication is disabled. Sign in again to continue with the newly secured session state.</p>
            <AsyncActionButton
              type="button"
              variant="outline"
              disabled={busy}
              pending={pendingAction === "two-factor-sign-out"}
              idleLabel="Sign in again"
              pendingLabel="Signing out…"
              onClick={signInAgain}
            />
          </AppInset>
        </div>
      ) : null}

      {feedback ? (
        <AppInset className="p-3 text-sm">
          <p role={feedback.kind === "error" ? "alert" : "status"} aria-live={feedback.kind === "error" ? "assertive" : "polite"}>
            {feedback.message}
          </p>
        </AppInset>
      ) : null}
    </AppSurface>
  )
}

function ProofMethodFields({
  idPrefix,
  value,
  hasPasswordCredential,
  googleLinked,
  googleReturnHintMatches,
  busy,
  onChange,
}: {
  idPrefix: string
  value: ProofMethod
  hasPasswordCredential: boolean
  googleLinked: boolean
  googleReturnHintMatches: boolean
  busy: boolean
  onChange: (value: ProofMethod) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Primary proof</legend>
      {hasPasswordCredential ? (
        <label className="flex gap-3 text-sm text-muted-foreground">
          <input id={`${idPrefix}ProofPassword`} type="radio" name={`${idPrefix}ProofMethod`} value="PASSWORD" checked={value === "PASSWORD"} disabled={busy} onChange={() => onChange("PASSWORD")} />
          <span>Use your password</span>
        </label>
      ) : null}
      {googleLinked ? (
        <label className="flex gap-3 text-sm text-muted-foreground">
          <input id={`${idPrefix}ProofGoogle`} type="radio" name={`${idPrefix}ProofMethod`} value="GOOGLE" checked={value === "GOOGLE"} disabled={busy || !googleReturnHintMatches} onChange={() => onChange("GOOGLE")} />
          <span>Use the completed Google confirmation</span>
        </label>
      ) : null}
    </fieldset>
  )
}

function ManagementForm({
  action,
  title,
  idPrefix,
  state,
  setState,
  surfaceRef,
  hasPasswordCredential,
  googleLinked,
  googleReturnHintMatches,
  busy,
  pending,
  idleLabel,
  pendingLabel,
  onSubmit,
  canSubmit,
}: {
  action: "backup-codes" | "disable"
  title: string
  idPrefix: "regenerate" | "disable"
  state: ManagementState
  setState: React.Dispatch<React.SetStateAction<ManagementState>>
  surfaceRef: React.RefObject<HTMLDivElement | null>
  hasPasswordCredential: boolean
  googleLinked: boolean
  googleReturnHintMatches: boolean
  busy: boolean
  pending: boolean
  idleLabel: string
  pendingLabel: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  canSubmit: boolean
}) {
  return (
    <div ref={surfaceRef} tabIndex={-1} className="space-y-3" data-two-factor-surface={idPrefix}>
      <h3 className="font-medium">{title}</h3>
      <form data-two-factor-action={action} className="space-y-3" aria-busy={busy} onSubmit={onSubmit}>
        <ProofMethodFields
          idPrefix={idPrefix}
          value={state.proofMethod}
          hasPasswordCredential={hasPasswordCredential}
          googleLinked={googleLinked}
          googleReturnHintMatches={googleReturnHintMatches}
          busy={busy}
          onChange={(proofMethod) => setState((current) => ({ ...current, proofMethod }))}
        />
        {state.proofMethod === "PASSWORD" ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}Password`}>Password for {idPrefix === "disable" ? "disabling two-factor authentication" : "regenerating backup codes"}</Label>
            <Input id={`${idPrefix}Password`} type="password" autoComplete="current-password" required disabled={busy} value={state.password} onChange={(event) => setState((current) => ({ ...current, password: event.target.value }))} />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}TwoFactorCode`}>Current authenticator or backup code</Label>
          <Input id={`${idPrefix}TwoFactorCode`} autoComplete="one-time-code" required disabled={busy} value={state.twoFactorCode} onChange={(event) => setState((current) => ({ ...current, twoFactorCode: event.target.value }))} />
        </div>
        <label className="flex gap-3 text-sm text-muted-foreground">
          <input id={`${idPrefix}Confirmed`} aria-label={`Confirm ${idPrefix === "disable" ? "disable two-factor authentication" : "regenerate backup codes"}`} type="checkbox" disabled={busy} checked={state.confirmed} onChange={(event) => setState((current) => ({ ...current, confirmed: event.target.checked }))} />
          <span>Confirm this security change and end existing sessions.</span>
        </label>
        <AsyncActionButton type="submit" variant="outline" disabled={busy || !canSubmit} pending={pending} idleLabel={idleLabel} pendingLabel={pendingLabel} />
      </form>
    </div>
  )
}

function AdminRecoveryGuidance() {
  return (
    <AppInset className="p-4 text-sm text-muted-foreground">
      <p>Self-service is unavailable because this account has no usable primary sign-in method. Ask a full administrator to use the existing two-factor recovery process.</p>
    </AppInset>
  )
}

function initialProofMethod(
  purpose: TwoFactorGoogleReauthPurpose,
  googleLinked: boolean,
  returnHint: TwoFactorGoogleReauthPurpose | null,
): ProofMethod {
  return googleLinked && returnHint === purpose ? "GOOGLE" : "PASSWORD"
}

function googleProofLabel(purpose: TwoFactorGoogleReauthPurpose) {
  if (purpose === "ENROLL_TWO_FACTOR") return "authenticator setup"
  if (purpose === "DISABLE_TWO_FACTOR") return "disabling two-factor authentication"
  return "regenerating backup codes"
}

function canSubmitManagement(state: ManagementState, proofReady: (method: ProofMethod) => boolean) {
  return state.confirmed
    && Boolean(state.twoFactorCode)
    && proofReady(state.proofMethod)
    && (state.proofMethod !== "PASSWORD" || Boolean(state.password))
}

function managementBody(state: ManagementState) {
  return state.proofMethod === "PASSWORD"
    ? { proofMethod: "PASSWORD" as const, password: state.password, twoFactorCode: state.twoFactorCode, confirmed: true as const }
    : { proofMethod: "GOOGLE" as const, twoFactorCode: state.twoFactorCode, confirmed: true as const }
}

function emptyManagementState(proofMethod: ProofMethod): ManagementState {
  return { proofMethod, password: "", twoFactorCode: "", confirmed: false }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isResultCode(value: unknown, code: string): value is Record<string, unknown> & { code: string } {
  return isJsonObject(value) && value.code === code
}

function isSetupReady(value: unknown): value is { code: "TWO_FACTOR_SETUP_READY"; qrCode: string; manualCode: string } {
  return isResultCode(value, "TWO_FACTOR_SETUP_READY")
    && typeof value.qrCode === "string"
    && typeof value.manualCode === "string"
}

function isBackupCodeSuccess(
  value: unknown,
  code: "TWO_FACTOR_ENABLED" | "BACKUP_CODES_REGENERATED",
): value is { code: string; backupCodes: string[] } {
  return isResultCode(value, code)
    && Array.isArray(value.backupCodes)
    && value.backupCodes.length > 0
    && value.backupCodes.every((backupCode) => typeof backupCode === "string" && backupCode.length > 0)
}

function focusSurface(ref: React.RefObject<HTMLDivElement | null>) {
  ref.current?.focus({ preventScroll: true })
}
