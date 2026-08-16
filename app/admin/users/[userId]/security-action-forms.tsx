"use client"

import { useActionState, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { ADMIN_REASON_CODES } from "@/lib/admin/operation-contract"
import {
  resetUserTwoFactorAction,
  revokeUserSessionsAction,
  sendAdminPasswordResetAction,
  type SecurityActionState,
} from "./security-actions"

const SESSION_REVOCATION_CONFIRMATION = "CONFIRM_SECURITY_SESSION_REVOCATION"
const PASSWORD_RESET_CONFIRMATION = "CONFIRM_ADMIN_PASSWORD_RESET"
const INITIAL_SECURITY_STATE: SecurityActionState = { status: "idle", message: "" }
const REASON_LABELS: Record<(typeof ADMIN_REASON_CODES)[number], string> = {
  USER_REQUEST: "User request",
  LOGIN_SUPPORT: "Login support",
  ACCESS_REMEDIATION: "Access remediation",
  BILLING_GOODWILL: "Billing goodwill",
  BACKGROUND_CREDIT_GOODWILL: "Background credit goodwill",
  ROLE_ASSIGNMENT: "Role assignment",
  ROLE_REVOCATION: "Role revocation",
  SECURITY_RECOVERY: "Security recovery",
  ADMIN_CORRECTION: "Admin correction",
  OTHER: "Other",
}

type SecurityOperationIds = {
  revokeSessions: string
  passwordReset: string
  twoFactorReset: string
}

type CommonFormProps = {
  userId: string
  operationId: string
  submitLabel?: "Send password reset" | "Send a new reset link"
}

/** Explains the independent service guard while suppressing every self-target form. */
export function SelfSecurityManagementNotice() {
  return (
    <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
      You cannot perform security remediation on your own account from this console.
    </p>
  )
}

/**
 * Renders the three bounded remediation owners from fresh Security evidence.
 * Every operation key is supplied by the server render and remains stable for
 * the life of its form.
 */
export function SecurityActionControls({
  userId,
  targetEmail,
  emailVerified,
  passwordConfigured,
  twoFactorEnabled,
  expectedAuthSessionVersion,
  expectedSessionCount,
  operationIds,
}: {
  userId: string
  targetEmail: string | null
  emailVerified: boolean
  passwordConfigured: boolean
  twoFactorEnabled: boolean
  expectedAuthSessionVersion: number
  expectedSessionCount: number
  operationIds: SecurityOperationIds
}) {
  return (
    <section className="space-y-4" aria-labelledby="security-actions-heading">
      <div className="space-y-1">
        <h3 id="security-actions-heading" className="font-medium">Security remediation</h3>
        <p className="text-sm text-muted-foreground">
          Each action records immutable Admin and target-visible Activity evidence. Passwords and authentication secrets are never shown.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SecurityCard title="Revoke sign-in tokens and sessions">
          <p className="mt-2 text-sm"><span className="font-medium">Current state:</span> Existing tokens remain accepted only while their version matches; {expectedSessionCount} unexpired compatibility Session row{expectedSessionCount === 1 ? " is" : "s are"} recorded.</p>
          <p className="text-sm"><span className="font-medium">After confirmation:</span> The token version increments and compatibility Session rows are removed.</p>
          <p className="text-sm text-muted-foreground">
            Increments the canonical token version immediately and removes compatibility Session rows. Older cookies disappear only after Auth.js next completes a database-backed refresh.
          </p>
          <RevokeSessionsForm
            userId={userId}
            operationId={operationIds.revokeSessions}
            expectedAuthSessionVersion={expectedAuthSessionVersion}
            expectedSessionCount={expectedSessionCount}
          />
        </SecurityCard>

        <SecurityCard title="Send password reset">
          <p className="mt-2 text-sm"><span className="font-medium">Current state:</span> Password {passwordConfigured ? "configured" : "not configured"}; verified email {emailVerified ? "available" : "unavailable"}.</p>
          <p className="text-sm"><span className="font-medium">After confirmation:</span> One fresh 60-minute reset link is created and standard email delivery is attempted.</p>
          <p className="text-sm text-muted-foreground">
            Creates one fresh standard reset token and requests its normal 60-minute email. No password is visible or set here.
          </p>
          {emailVerified && targetEmail ? (
            <FreshPasswordResetForm userId={userId} operationId={operationIds.passwordReset} />
          ) : (
            <UnavailableNotice>Unavailable until the target account has a verified email address.</UnavailableNotice>
          )}
        </SecurityCard>

        <SecurityCard title="Reset two-factor authentication">
          <p className="mt-2 text-sm"><span className="font-medium">Current state:</span> Two-factor authentication {twoFactorEnabled ? "enabled" : "not enabled"}.</p>
          <p className="text-sm"><span className="font-medium">After confirmation:</span> Two-factor and recovery material are removed and older sign-in tokens are invalidated.</p>
          <p className="text-sm text-muted-foreground">
            Deletes enabled two-factor and recovery material, invalidates older sign-in tokens, and lets the user configure two-factor authentication again.
          </p>
          {targetEmail ? (
            <TwoFactorResetForm
              userId={userId}
              operationId={operationIds.twoFactorReset}
              targetEmail={targetEmail}
              twoFactorEnabled={twoFactorEnabled}
            />
          ) : (
            <UnavailableNotice>Two-factor authentication is not enabled for this account.</UnavailableNotice>
          )}
        </SecurityCard>
      </div>
    </section>
  )
}

/**
 * Used both on Security and on a failed PASSWORD_RESET Activity entry. A fresh
 * server-rendered key creates a new token/action/intent instead of retrying old
 * token material.
 */
export function FreshPasswordResetForm({
  userId,
  operationId,
  submitLabel = "Send password reset",
}: CommonFormProps) {
  const [actionState, formAction, isPending] = useActionState(
    sendAdminPasswordResetAction.bind(null, userId),
    INITIAL_SECURITY_STATE,
  )
  const formId = useId()
  const [reasonCode, setReasonCode] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const canSubmit = reasonReady(reasonCode, internalNote) && confirmed && !isPending

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <StableFields userId={userId} operationId={operationId} />
      <ReasonFields
        formId={formId}
        reasonCode={reasonCode}
        internalNote={internalNote}
        onReasonChange={setReasonCode}
        onNoteChange={setInternalNote}
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirmation"
          value={PASSWORD_RESET_CONFIRMATION}
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
          className="mt-1 size-4"
        />
        <span>I confirm this creates a fresh password-reset link and requests one standard email delivery.</span>
      </label>
      <Button type="submit" disabled={!canSubmit}>
        {isPending ? "Creating fresh reset link…" : submitLabel}
      </Button>
      <ActionFeedback state={actionState} />
    </form>
  )
}

function RevokeSessionsForm({
  userId,
  operationId,
  expectedAuthSessionVersion,
  expectedSessionCount,
}: CommonFormProps & { expectedAuthSessionVersion: number; expectedSessionCount: number }) {
  const [actionState, formAction, isPending] = useActionState(
    revokeUserSessionsAction.bind(null, userId),
    INITIAL_SECURITY_STATE,
  )
  const formId = useId()
  const [reasonCode, setReasonCode] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const canSubmit = reasonReady(reasonCode, internalNote) && confirmed && !isPending

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <StableFields userId={userId} operationId={operationId} />
      <input type="hidden" name="expectedAuthSessionVersion" value={expectedAuthSessionVersion} />
      <input type="hidden" name="expectedSessionCount" value={expectedSessionCount} />
      <ReasonFields
        formId={formId}
        reasonCode={reasonCode}
        internalNote={internalNote}
        onReasonChange={setReasonCode}
        onNoteChange={setInternalNote}
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirmation"
          value={SESSION_REVOCATION_CONFIRMATION}
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
          className="mt-1 size-4"
        />
        <span>I confirm that existing sign-in tokens will be invalidated and older sessions will require a successful database-backed refresh to observe sign-out.</span>
      </label>
      <Button type="submit" variant="destructive" disabled={!canSubmit}>
        {isPending ? "Invalidating sign-in tokens…" : "Revoke sign-in tokens and sessions"}
      </Button>
      <ActionFeedback state={actionState} />
    </form>
  )
}

/** Keeps committed feedback mounted when revalidation changes enabled 2FA to disabled. */
function TwoFactorResetForm({
  userId,
  operationId,
  targetEmail,
  twoFactorEnabled,
}: CommonFormProps & { targetEmail: string; twoFactorEnabled: boolean }) {
  const [actionState, formAction, isPending] = useActionState(
    resetUserTwoFactorAction.bind(null, userId),
    INITIAL_SECURITY_STATE,
  )
  const formId = useId()
  const [reasonCode, setReasonCode] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [confirmationEmail, setConfirmationEmail] = useState("")
  const emailMatches = normalizeEmail(confirmationEmail) === targetEmail
  const canSubmit = reasonReady(reasonCode, internalNote) && emailMatches && !isPending

  if (!twoFactorEnabled) {
    return (
      <div className="mt-3 space-y-3">
        <UnavailableNotice>Two-factor authentication is not enabled for this account.</UnavailableNotice>
        <ActionFeedback state={actionState} />
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <StableFields userId={userId} operationId={operationId} />
      <input type="hidden" name="expectedTwoFactorEnabled" value="true" />
      <ReasonFields
        formId={formId}
        reasonCode={reasonCode}
        internalNote={internalNote}
        onReasonChange={setReasonCode}
        onNoteChange={setInternalNote}
      />
      <div className="space-y-1">
        <label htmlFor={`${formId}-confirmation-email`} className="text-sm font-medium">Confirmation email</label>
        <input
          id={`${formId}-confirmation-email`}
          name="confirmationEmail"
          type="email"
          value={confirmationEmail}
          onChange={(event) => setConfirmationEmail(event.target.value)}
          placeholder={targetEmail}
          autoComplete="off"
          spellCheck={false}
          required
          className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">Type the target account&apos;s exact email address to confirm.</p>
      </div>
      <Button type="submit" variant="destructive" disabled={!canSubmit}>
        {isPending ? "Resetting two-factor authentication…" : "Reset two-factor authentication"}
      </Button>
      <ActionFeedback state={actionState} />
    </form>
  )
}

function ReasonFields({
  formId,
  reasonCode,
  internalNote,
  onReasonChange,
  onNoteChange,
}: {
  formId: string
  reasonCode: string
  internalNote: string
  onReasonChange: (value: string) => void
  onNoteChange: (value: string) => void
}) {
  return (
    <>
      <div className="space-y-1">
        <label htmlFor={`${formId}-reason`} className="text-sm font-medium">Reason</label>
        <select
          id={`${formId}-reason`}
          name="reasonCode"
          value={reasonCode}
          onChange={(event) => onReasonChange(event.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a reason</option>
          {ADMIN_REASON_CODES.map((reason) => <option key={reason} value={reason}>{REASON_LABELS[reason]}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${formId}-note`} className="text-sm font-medium">
          Internal note <span className="font-normal text-muted-foreground">(required for Other)</span>
        </label>
        <textarea
          id={`${formId}-note`}
          name="internalNote"
          value={internalNote}
          onChange={(event) => onNoteChange(event.target.value)}
          required={reasonCode === "OTHER"}
          maxLength={500}
          rows={3}
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </>
  )
}

function StableFields({ userId, operationId }: CommonFormProps) {
  return (
    <>
      <input type="hidden" name="targetUserId" value={userId} />
      <input type="hidden" name="operationId" value={operationId} />
    </>
  )
}

function ActionFeedback({ state }: { state: SecurityActionState }) {
  return (
    <>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`text-sm ${state.status === "success" ? "text-emerald-700 dark:text-emerald-300" : state.status === "warning" ? "text-amber-700 dark:text-amber-300" : "sr-only"}`}
      >
        {state.status === "success" || state.status === "warning" ? state.message : ""}
      </p>
      <p
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={`text-sm text-destructive ${state.status === "error" ? "" : "sr-only"}`}
      >
        {state.status === "error" ? state.message : ""}
      </p>
    </>
  )
}

function SecurityCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="min-w-0 rounded-md border bg-background/60 p-4">
      <h4 className="font-medium">{title}</h4>
      {children}
    </article>
  )
}

function UnavailableNotice({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-muted-foreground">{children}</p>
}

function reasonReady(reasonCode: string, internalNote: string) {
  return Boolean(reasonCode) && (reasonCode !== "OTHER" || Boolean(internalNote.trim()))
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}
