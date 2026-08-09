"use client"

import { useActionState, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { ADMIN_REASON_CODES } from "@/lib/admin/operation-contract"
import type { DelegatedAnatomyRole, ExpectedAnatomyRoleStatus } from "@/lib/admin/role-service"
import { changeAnatomyRoleAction, type RoleChangeActionState } from "./role-actions"

const ROLE_CHANGE_CONFIRMATION = "CONFIRM_ANATOMY_ROLE_CHANGE"
const INITIAL_ROLE_CHANGE_STATE: RoleChangeActionState = { status: "idle", message: "" }
const ROLE_LABELS: Record<DelegatedAnatomyRole, string> = {
  ANATOMY_REVIEWER: "Anatomy Reviewer",
  ANATOMY_EDITOR: "Anatomy Editor",
}
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

type RoleEvidence = {
  role: string
  status: string
  source?: string
  verifiedAt?: string | null
  revokedAt?: string | null
}

/** Explains the service's self-target protection without rendering a form. */
export function SelfRoleManagementNotice() {
  return (
    <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
      You cannot change delegated anatomy roles on your own account from this console.
    </p>
  )
}

/**
 * Owns the two delegated-role forms and their explicit confirmation state.
 * Operation IDs come from the server render and remain unchanged per form.
 */
export function RoleChangeControls({
  userId,
  roles,
  operationIds,
}: {
  userId: string
  roles: RoleEvidence[]
  operationIds: Record<DelegatedAnatomyRole, string>
}) {
  return (
    <div className="space-y-4" aria-labelledby="delegated-role-controls-heading">
      <div className="space-y-1">
        <h3 id="delegated-role-controls-heading" className="font-medium">Delegated anatomy access</h3>
        <p className="text-sm text-muted-foreground">Reviewer can review anatomy content. Editor can review and edit anatomy content.</p>
        <p className="text-xs text-muted-foreground">Each change invalidates the user&apos;s existing sign-in tokens. Full application administration is managed separately.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(["ANATOMY_REVIEWER", "ANATOMY_EDITOR"] as const).map((role) => (
          <RoleChangeForm
            key={role}
            userId={userId}
            role={role}
            evidence={roles.find((assignment) => assignment.role === role)}
            operationId={operationIds[role]}
          />
        ))}
      </div>
    </div>
  )
}

/** Renders one fail-closed assignment/revocation form from stored role evidence. */
function RoleChangeForm({
  userId,
  role,
  evidence,
  operationId,
}: {
  userId: string
  role: DelegatedAnatomyRole
  evidence?: RoleEvidence
  operationId: string
}) {
  const [actionState, formAction, isPending] = useActionState(
    changeAnatomyRoleAction.bind(null, userId),
    INITIAL_ROLE_CHANGE_STATE,
  )
  const status = evidence?.status ?? "ABSENT"
  const supportedStatus = status === "ABSENT" || status === "VERIFIED" || status === "REVOKED"
  const operation = status === "VERIFIED" ? "REVOKE" : "ASSIGN"
  const expectedStatus = status as ExpectedAnatomyRoleStatus
  const label = ROLE_LABELS[role]

  return (
    <article className="min-w-0 space-y-3 rounded-md border bg-background/60 p-4">
      <div>
        <h4 className="font-medium">{label}</h4>
        <p className="mt-1 text-sm"><span className="font-medium">Current state:</span> {currentState(status)}</p>
        {supportedStatus ? (
          <p className="text-sm"><span className="font-medium">After confirmation:</span> {operation === "ASSIGN" ? "Assigned (VERIFIED)" : "Not assigned (REVOKED)"}</p>
        ) : null}
        {evidence?.source ? <p className="mt-1 text-xs text-muted-foreground">Stored source: {evidence.source}</p> : null}
      </div>

      {!supportedStatus ? (
        <p className="text-sm text-muted-foreground">
          {status === "PENDING"
            ? "This role cannot be changed while its assignment is PENDING. Refresh or resolve it first."
            : `This role cannot be changed while its assignment is ${status || "UNKNOWN"}. Refresh or resolve it first.`}
        </p>
      ) : (
        <RoleChangeFields
          key={`${role}:${operationId}:${status}:${operation}`}
          userId={userId}
          role={role}
          operation={operation}
          expectedStatus={expectedStatus}
          operationId={operationId}
          label={label}
          formAction={formAction}
          actionState={actionState}
          isPending={isPending}
        />
      )}
    </article>
  )
}

/**
 * Owns only mutable confirmation fields. A new authoritative operation key or
 * state remounts this boundary so an Assign confirmation cannot authorize Revoke.
 */
function RoleChangeFields({
  userId,
  role,
  operation,
  expectedStatus,
  operationId,
  label,
  formAction,
  actionState,
  isPending,
}: {
  userId: string
  role: DelegatedAnatomyRole
  operation: "ASSIGN" | "REVOKE"
  expectedStatus: ExpectedAnatomyRoleStatus
  operationId: string
  label: string
  formAction: (payload: FormData) => void
  actionState: RoleChangeActionState
  isPending: boolean
}) {
  const formId = useId()
  const [reasonCode, setReasonCode] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const canSubmit = Boolean(reasonCode)
    && confirmed
    && (reasonCode !== "OTHER" || Boolean(internalNote.trim()))
    && !isPending

  return (
    <form action={formAction} className="space-y-3">
          <input type="hidden" name="targetUserId" value={userId} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="operation" value={operation} />
          <input type="hidden" name="expectedStatus" value={expectedStatus} />
          <input type="hidden" name="operationId" value={operationId} />

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
              value={ROLE_CHANGE_CONFIRMATION}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              required
              className="mt-1 size-4"
            />
            <span>I understand this exact change will sign the user out by invalidating all existing sign-in tokens.</span>
          </label>

          <Button type="submit" variant={operation === "REVOKE" ? "destructive" : "default"} disabled={!canSubmit}>
            {isPending ? "Changing role…" : `${operation === "ASSIGN" ? "Assign" : "Revoke"} ${label}`}
          </Button>
          {actionState.status !== "idle" ? (
            <p
              role={actionState.status === "error" ? "alert" : "status"}
              aria-live={actionState.status === "error" ? "assertive" : "polite"}
              className="text-sm text-muted-foreground"
            >
              {actionState.message}
            </p>
          ) : null}
    </form>
  )
}

function currentState(status: string) {
  if (status === "VERIFIED") return "Assigned (VERIFIED)"
  if (status === "ABSENT" || status === "REVOKED") return `Not assigned (${status})`
  return `Unavailable (${status || "UNKNOWN"})`
}
