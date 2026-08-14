"use client"

import { useActionState, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ADMIN_BACKGROUND_CREDIT_GRANT_MAX,
  ADMIN_BACKGROUND_CREDIT_GRANT_MIN,
  ADMIN_REASON_CODES,
} from "@/lib/admin/operation-contract"
import { grantBackgroundCreditsAction, type CreditGrantActionState } from "./credit-actions"

const CREDIT_GRANT_CONFIRMATION = "CONFIRM_BACKGROUND_CREDIT_GRANT"
const INITIAL_CREDIT_GRANT_STATE: CreditGrantActionState = { status: "idle", message: "" }
const CREDIT_PRESETS = [1, 2, 5, 10] as const
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

/**
 * Keeps action feedback stable while fresh server evidence remounts only the
 * mutable fields, clearing a consumed confirmation and operation key.
 */
export function CreditGrantControls({
  userId,
  targetLabel,
  preparedBalance,
  automaticInitialCredits,
  operationId,
}: {
  userId: string
  targetLabel: string
  preparedBalance: number
  automaticInitialCredits: number
  operationId: string
}) {
  const [actionState, formAction, isPending] = useActionState(
    grantBackgroundCreditsAction.bind(null, userId),
    INITIAL_CREDIT_GRANT_STATE,
  )

  return (
    <article className="min-w-0 space-y-4 rounded-md border bg-background/60 p-4">
      <div className="space-y-1">
        <h3 className="font-medium">Add background credits</h3>
        <p className="break-words text-sm"><span className="font-medium">Target:</span> {targetLabel}</p>
        <p className="text-xs text-muted-foreground">Positive goodwill grants use the permanent background-credit ledger and cannot reduce or replace a balance.</p>
      </div>

      <CreditGrantFields
        key={`${operationId}:${preparedBalance}`}
        userId={userId}
        preparedBalance={preparedBalance}
        automaticInitialCredits={automaticInitialCredits}
        operationId={operationId}
        formAction={formAction}
        isPending={isPending}
      />

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`text-sm text-emerald-700 dark:text-emerald-300 ${actionState.status === "success" ? "" : "sr-only"}`}
      >
        {actionState.status === "success" ? actionState.message : ""}
      </p>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`text-sm text-amber-700 dark:text-amber-300 ${actionState.status === "warning" ? "" : "sr-only"}`}
      >
        {actionState.status === "warning" ? actionState.message : ""}
      </p>
      <p
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={`text-sm text-destructive ${actionState.status === "error" ? "" : "sr-only"}`}
      >
        {actionState.status === "error" ? actionState.message : ""}
      </p>
    </article>
  )
}

/** Owns the exact amount preview plus the reason/note/confirmation state. */
function CreditGrantFields({
  userId,
  preparedBalance,
  automaticInitialCredits,
  operationId,
  formAction,
  isPending,
}: {
  userId: string
  preparedBalance: number
  automaticInitialCredits: number
  operationId: string
  formAction: (payload: FormData) => void
  isPending: boolean
}) {
  const formId = useId()
  const [amount, setAmount] = useState("1")
  const [reasonCode, setReasonCode] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const numericAmount = /^(?:0|[1-9]\d*)$/.test(amount) ? Number(amount) : null
  const parsedAmount = numericAmount !== null
    && numericAmount >= ADMIN_BACKGROUND_CREDIT_GRANT_MIN
    && numericAmount <= ADMIN_BACKGROUND_CREDIT_GRANT_MAX
    ? numericAmount
    : null
  const startingBalance = preparedBalance + automaticInitialCredits
  const resultingBalance = parsedAmount === null ? null : startingBalance + parsedAmount
  const canSubmit = parsedAmount !== null
    && Boolean(reasonCode)
    && confirmed
    && (reasonCode !== "OTHER" || Boolean(internalNote.trim()))
    && !isPending
  // A confirmation authorizes only the amount visible when it was checked.
  const updateAmount = (nextAmount: string) => {
    setAmount(nextAmount)
    setConfirmed(false)
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="targetUserId" value={userId} />
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="expectedBalance" value={preparedBalance} />

      <div className="space-y-2">
        <p className="text-sm font-medium">Credit amount</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Credit amount presets">
          {CREDIT_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={amount === String(preset) ? "default" : "outline"}
              size="sm"
              aria-pressed={amount === String(preset)}
              onClick={() => updateAmount(String(preset))}
            >
              +{preset}
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${formId}-amount`} className="text-sm font-medium">Custom credit amount</label>
          <input
            id={`${formId}-amount`}
            name="amount"
            type="number"
            min={ADMIN_BACKGROUND_CREDIT_GRANT_MIN}
            max={ADMIN_BACKGROUND_CREDIT_GRANT_MAX}
            step={1}
            value={amount}
            onChange={(event) => updateAmount(event.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1 rounded-md border p-3 text-sm" aria-live="polite">
        {automaticInitialCredits ? (
          <>
            <p>Current persisted balance: {preparedBalance}</p>
            <p>Automatic verified-account allocation: +{automaticInitialCredits}</p>
          </>
        ) : <p>Current balance: {preparedBalance}</p>}
        <p>Admin grant: {parsedAmount === null
          ? `Choose ${ADMIN_BACKGROUND_CREDIT_GRANT_MIN} through ${ADMIN_BACKGROUND_CREDIT_GRANT_MAX}`
          : `+${parsedAmount}`}</p>
        <p className="font-medium">
          Resulting balance: {resultingBalance === null
            ? "Unavailable until the amount is valid"
            : automaticInitialCredits
              ? `${preparedBalance + automaticInitialCredits} + ${parsedAmount} = ${resultingBalance}`
              : resultingBalance}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${formId}-reason`} className="text-sm font-medium">Reason</label>
        <select
          id={`${formId}-reason`}
          name="reasonCode"
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a reason</option>
          {ADMIN_REASON_CODES.map((reason) => <option key={reason} value={reason}>{REASON_LABELS[reason]}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${formId}-note`} className="text-sm font-medium">Internal note <span className="font-normal text-muted-foreground">(required for Other)</span></label>
        <textarea
          id={`${formId}-note`}
          name="internalNote"
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          required={reasonCode === "OTHER"}
          maxLength={500}
          rows={3}
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirmation"
          value={CREDIT_GRANT_CONFIRMATION}
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
          className="mt-1 size-4"
        />
        <span>I confirm that {parsedAmount ?? "the selected number of"} background credit{parsedAmount === 1 ? "" : "s"} will be added to this account.</span>
      </label>

      <Button type="submit" disabled={!canSubmit}>
        {isPending ? "Adding background credits…" : "Add background credits"}
      </Button>
    </form>
  )
}
