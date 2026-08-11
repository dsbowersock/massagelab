"use client"

import { useActionState, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { ADMIN_REASON_CODES } from "@/lib/admin/operation-contract"
import {
  applyBillingGoodwillAction,
  reconcileBillingGoodwillAction,
  type BillingGoodwillActionState,
} from "./billing-actions"

const INITIAL_STATE: BillingGoodwillActionState = { status: "idle", message: "" }
const PRESETS = [100, 200, 500, 1000, 2000, 5000] as const
const REASON_LABELS: Record<(typeof ADMIN_REASON_CODES)[number], string> = {
  USER_REQUEST: "User request", LOGIN_SUPPORT: "Login support", ACCESS_REMEDIATION: "Access remediation",
  BILLING_GOODWILL: "Billing goodwill", BACKGROUND_CREDIT_GOODWILL: "Background credit goodwill",
  ROLE_ASSIGNMENT: "Role assignment", ROLE_REVOCATION: "Role revocation", SECURITY_RECOVERY: "Security recovery",
  ADMIN_CORRECTION: "Admin correction", OTHER: "Other",
}

export type BillingGoodwillPresentation = {
  operationId: string
  targetLabel: string
  targetEmail: string
  subscriptionAmountCents: number | null
  subscriptionInterval: string | null
  subscriptionStatus: string
  currentCreditCents: number
  projectedNextInvoiceCents: number
}

export type BillingGoodwillReconciliation = {
  operationId: string
  confirmationNonce: string
  targetEmail: string
  amountCents: number
  startingCreditCents: number
  failureCode: string | null
  createdAt: string
}

/** Presents one stable-key apply form plus bounded same-key recovery actions. */
export function BillingGoodwillControls({
  userId,
  preview,
  reconciliations,
}: {
  userId: string
  preview: BillingGoodwillPresentation | null
  reconciliations: BillingGoodwillReconciliation[]
}) {
  const [applyState, applyAction] = useActionState(applyBillingGoodwillAction.bind(null, userId), INITIAL_STATE)
  const [reconcileState, reconcileAction] = useActionState(reconcileBillingGoodwillAction.bind(null, userId), INITIAL_STATE)
  return (
    <div className="space-y-4">
      {preview ? <article className="min-w-0 space-y-4 rounded-md border bg-background/60 p-4">
        <div className="space-y-1">
          <h3 className="font-medium">Add invoice credit</h3>
          <p className="break-words text-sm"><span className="font-medium">Target:</span> {preview.targetLabel}</p>
          <p className="text-xs text-muted-foreground">Positive USD goodwill applies to future invoices. Taxes or later account changes can change the actual next invoice.</p>
        </div>
        <BillingGoodwillFields key={`${preview.operationId}:${preview.currentCreditCents}`} preview={preview} action={applyAction} userId={userId} />
      </article> : <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">Invoice-credit controls are unavailable because a safe Stripe preview could not be loaded. No provider mutation was attempted.</p>}
      {reconciliations.map((operation) => (
        <ReconciliationCard key={`${operation.operationId}:${operation.confirmationNonce}`} userId={userId} operation={operation} action={reconcileAction} />
      ))}
      <ActionFeedback state={applyState} />
      <ActionFeedback state={reconcileState} />
    </div>
  )
}

function BillingGoodwillFields({ preview, action, userId }: {
  preview: BillingGoodwillPresentation
  action: (payload: FormData) => void
  userId: string
}) {
  const formId = useId()
  const [amountCents, setAmountCents] = useState(100)
  const [customDollars, setCustomDollars] = useState("1.00")
  const [reasonCode, setReasonCode] = useState("")
  const [note, setNote] = useState("")
  const [confirmationEmail, setConfirmationEmail] = useState("")
  const [confirmationAmount, setConfirmationAmount] = useState("")
  const parsedCustomCents = parseDollarsToCents(customDollars)
  const projectedShortcutAvailable = preview.projectedNextInvoiceCents >= 1 && preview.projectedNextInvoiceCents <= 10_000
  const canSubmit = parsedCustomCents === amountCents
    && confirmationEmail === preview.targetEmail
    && confirmationAmount === formatPlainUsd(amountCents)
    && Boolean(reasonCode)
    && (reasonCode !== "OTHER" || Boolean(note.trim()))
  const updateAmount = (cents: number) => {
    setAmountCents(cents)
    setCustomDollars(formatPlainUsd(cents))
    setConfirmationAmount("")
  }
  const updateCustom = (value: string) => {
    setCustomDollars(value)
    const cents = parseDollarsToCents(value)
    if (cents !== null) setAmountCents(cents)
    setConfirmationAmount("")
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="targetUserId" value={userId} />
      <input type="hidden" name="operationId" value={preview.operationId} />
      <input type="hidden" name="amountCents" value={amountCents} />
      <input type="hidden" name="expectedStartingCreditCents" value={preview.currentCreditCents} />

      <dl className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2" aria-live="polite">
        <Value label="Current subscription" value={preview.subscriptionAmountCents === null || !preview.subscriptionInterval ? "Amount or interval unavailable" : `${formatUsd(preview.subscriptionAmountCents)} / ${preview.subscriptionInterval}`} />
        <Value label="Subscription status" value={preview.subscriptionStatus} />
        <Value label="Current Stripe credit" value={formatUsd(preview.currentCreditCents)} />
        <Value label="Projected next invoice" value={formatUsd(preview.projectedNextInvoiceCents)} />
        <Value label="Requested credit" value={formatUsd(amountCents)} />
        <Value label="Resulting credit" value={formatUsd(preview.currentCreditCents + amountCents)} />
      </dl>

      <div className="space-y-2">
        <p className="text-sm font-medium">Credit amount</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Invoice credit presets">
          {PRESETS.map((value) => <Button key={value} type="button" size="sm" variant={amountCents === value ? "default" : "outline"} value={value} aria-pressed={amountCents === value} onClick={() => updateAmount(value)}>{formatUsd(value)}</Button>)}
          {projectedShortcutAvailable ? <Button type="button" size="sm" variant={amountCents === preview.projectedNextInvoiceCents ? "default" : "outline"} onClick={() => updateAmount(preview.projectedNextInvoiceCents)}>Use projected invoice</Button> : null}
        </div>
        <label className="block space-y-1" htmlFor={`${formId}-custom`}>
          <span className="text-sm font-medium">Custom amount ($0.01–$100.00)</span>
          <input id={`${formId}-custom`} aria-label="Custom invoice credit" type="number" inputMode="decimal" value={customDollars} onChange={(event) => updateCustom(event.target.value)} min={0.01} max={100} step={0.01} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
      </div>

      <label className="block space-y-1" htmlFor={`${formId}-reason`}>
        <span className="text-sm font-medium">Reason</span>
        <select id={`${formId}-reason`} name="reasonCode" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Select a reason</option>
          {ADMIN_REASON_CODES.map((reason) => <option key={reason} value={reason}>{REASON_LABELS[reason]}</option>)}
        </select>
      </label>
      <label className="block space-y-1" htmlFor={`${formId}-note`}>
        <span className="text-sm font-medium">Internal note <span className="font-normal text-muted-foreground">(required for Other)</span></span>
        <textarea id={`${formId}-note`} name="internalNote" value={note} onChange={(event) => setNote(event.target.value)} required={reasonCode === "OTHER"} maxLength={500} rows={3} className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block space-y-1" htmlFor={`${formId}-email`}>
        <span className="text-sm font-medium">Confirmation email</span>
        <span className="block text-xs text-muted-foreground">Type the target email exactly as shown: {preview.targetEmail}</span>
        <input id={`${formId}-email`} name="confirmationEmail" type="email" autoComplete="off" value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block space-y-1" htmlFor={`${formId}-amount-confirmation`}>
        <span className="text-sm font-medium">Exact dollar amount</span>
        <span className="block text-xs text-muted-foreground">Type the exact dollar amount {formatPlainUsd(amountCents)} without a dollar sign.</span>
        <input id={`${formId}-amount-confirmation`} name="confirmationAmount" inputMode="decimal" autoComplete="off" value={confirmationAmount} onChange={(event) => setConfirmationAmount(event.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <BillingSubmitButton disabled={!canSubmit} idleLabel="Apply invoice credit" pendingLabel="Applying invoice credit…" />
    </form>
  )
}

function ReconciliationCard({ userId, operation, action }: {
  userId: string
  operation: BillingGoodwillReconciliation
  action: (payload: FormData) => void
}) {
  const formId = useId()
  const [confirmationEmail, setConfirmationEmail] = useState("")
  const [confirmationAmount, setConfirmationAmount] = useState("")
  const storedAmount = formatPlainUsd(operation.amountCents)
  const canSubmit = Boolean(operation.targetEmail)
    && confirmationEmail === operation.targetEmail
    && confirmationAmount === storedAmount
  return (
    <article className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4" data-billing-reconciliation="required">
      <div><h3 className="font-medium">Billing goodwill requires reconciliation</h3><p className="text-sm text-muted-foreground">The Stripe outcome may be committed. Reconcile reuses this operation&apos;s original key and does not create a blind second credit.</p></div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2"><Value label="Requested credit" value={formatUsd(operation.amountCents)} /><Value label="Prepared credit" value={formatUsd(operation.startingCreditCents)} /><Value label="Recorded" value={operation.createdAt} /><Value label="Safe failure code" value={operation.failureCode ?? "Unavailable"} /></dl>
      <form action={action} className="space-y-3">
        <input type="hidden" name="targetUserId" value={userId} />
        <input type="hidden" name="reconcileOperationId" value={operation.operationId} />
        <label className="block space-y-1" htmlFor={`${formId}-reconciliation-email`}>
          <span className="text-sm font-medium">Reconciliation confirmation email</span>
          <span className="block text-xs text-muted-foreground">Type the target email exactly as shown: {operation.targetEmail || "Unavailable"}</span>
          <input id={`${formId}-reconciliation-email`} name="reconciliationEmail" type="email" autoComplete="off" value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1" htmlFor={`${formId}-reconciliation-amount`}>
          <span className="text-sm font-medium">Reconciliation exact dollar amount</span>
          <span className="block text-xs text-muted-foreground">Type the exact stored dollar amount {storedAmount} without a dollar sign.</span>
          <input id={`${formId}-reconciliation-amount`} name="reconciliationAmount" inputMode="decimal" autoComplete="off" value={confirmationAmount} onChange={(event) => setConfirmationAmount(event.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <BillingSubmitButton disabled={!canSubmit} idleLabel="Reconcile" pendingLabel="Reconciling…" />
      </form>
    </article>
  )
}

/** Keeps pending presentation scoped to the form that submitted the shared action. */
function BillingSubmitButton({ disabled, idleLabel, pendingLabel }: {
  disabled: boolean
  idleLabel: string
  pendingLabel: string
}) {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={disabled || pending}>{pending ? pendingLabel : idleLabel}</Button>
}

function ActionFeedback({ state }: { state: BillingGoodwillActionState }) {
  return <>
    <p role="status" aria-live="polite" aria-atomic="true" className={`text-sm text-emerald-700 dark:text-emerald-300 ${state.status === "success" ? "" : "sr-only"}`}>{state.status === "success" ? state.message : ""}</p>
    <p role="status" aria-live="polite" aria-atomic="true" className={`text-sm text-amber-700 dark:text-amber-300 ${state.status === "warning" ? "" : "sr-only"}`}>{state.status === "warning" ? state.message : ""}</p>
    <p role="alert" aria-live="assertive" aria-atomic="true" className={`text-sm text-destructive ${state.status === "error" ? "" : "sr-only"}`}>{state.status === "error" ? state.message : ""}</p>
  </>
}

function Value({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd>{value}</dd></div> }
function formatUsd(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100) }
function formatPlainUsd(cents: number) { return (cents / 100).toFixed(2) }
function parseDollarsToCents(value: string) {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{0,2})?$/.test(value)) return null
  const cents = Math.round(Number(value) * 100)
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 10_000 ? cents : null
}
