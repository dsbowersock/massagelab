"use client"

import { useActionState, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { ADMIN_REASON_CODES } from "@/lib/admin/operation-contract"
import type { AdminGrantableFeatureKey } from "@/lib/admin/temporary-access"
import {
  grantTemporaryAccessAction,
  revokeTemporaryAccessAction,
  type TemporaryAccessActionState,
} from "./temporary-access-actions"

const INITIAL_ACTION_STATE: TemporaryAccessActionState = { status: "idle", message: "" }
const GRANT_CONFIRMATION = "CONFIRM_TEMPORARY_ACCESS_GRANT"
const REVOCATION_CONFIRMATION = "CONFIRM_TEMPORARY_ACCESS_REVOCATION"
const DAY_MS = 24 * 60 * 60 * 1_000
const DURATION_PRESETS = [7, 30, 90] as const
const FEATURE_OPTIONS: ReadonlyArray<{ key: AdminGrantableFeatureKey; label: string }> = [
  { key: "premium_backgrounds", label: "Premium backgrounds" },
  { key: "therapist_documentation_tools", label: "Therapist documentation tools" },
  { key: "calendar_basic_scheduling", label: "Basic calendar scheduling" },
  { key: "calendar_full_scheduling", label: "Full calendar scheduling" },
  { key: "external_calendar_sync", label: "External calendar sync" },
]
const FEATURE_LABELS = Object.fromEntries(FEATURE_OPTIONS.map(({ key, label }) => [key, label])) as Record<AdminGrantableFeatureKey, string>
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

export type TemporaryGrantPresentation = {
  grantId: string
  featureKey: AdminGrantableFeatureKey
  startsAt: string
  expiresAt: string
  revokeOperationId: string
}

/** Owns stable grant/revoke feedback while server refreshes replace consumed operation keys and snapshots. */
export function TemporaryAccessControls({
  userId,
  targetLabel,
  preparedAt,
  grantOperationId,
  expectedActiveGrantIds,
  grants,
  totalGrantCount,
  truncated,
  controlsAvailable,
}: {
  userId: string
  targetLabel: string
  preparedAt: string
  grantOperationId: string
  expectedActiveGrantIds: Record<AdminGrantableFeatureKey, string[]>
  grants: TemporaryGrantPresentation[]
  totalGrantCount: number
  truncated: boolean
  controlsAvailable: boolean
}) {
  const [grantState, grantAction, grantPending] = useActionState(
    grantTemporaryAccessAction.bind(null, userId),
    INITIAL_ACTION_STATE,
  )
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeTemporaryAccessAction.bind(null, userId),
    INITIAL_ACTION_STATE,
  )

  return (
    <article className="min-w-0 space-y-5 rounded-md border bg-background/60 p-4">
      <div className="space-y-1">
        <h3 className="font-medium">Temporary feature access</h3>
        <p className="break-words text-sm"><span className="font-medium">Target:</span> {targetLabel}</p>
        <p className="text-xs text-muted-foreground">
          Temporary grants expire automatically at request time. No scheduled cleanup job changes the ledger, and every overlapping source remains independent.
        </p>
      </div>

      {controlsAvailable ? (
        <GrantFields
          key={`${grantOperationId}:${preparedAt}`}
          userId={userId}
          preparedAt={preparedAt}
          operationId={grantOperationId}
          expectedActiveGrantIds={expectedActiveGrantIds}
          formAction={grantAction}
          isPending={grantPending}
        />
      ) : (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          Grant and revoke controls are unavailable until a complete active grant snapshot can be loaded. Refresh this account before trying again.
        </p>
      )}
      <ActionFeedback state={grantState} />

      <section className="space-y-3" aria-labelledby="active-temporary-grants-heading">
        <div>
          <h3 id="active-temporary-grants-heading" className="font-medium">Active temporary grants</h3>
          <p className="text-xs text-muted-foreground">
            Showing {grants.length} of {totalGrantCount} active temporary grants{truncated ? "; additional active grants are omitted from this bounded view." : "."}
          </p>
        </div>
        {grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active temporary grants.</p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {grants.map((grant) => (
              <article key={grant.grantId} data-temporary-grant="active" className="min-w-0 rounded-md border bg-background p-3 text-sm">
                <h4 className="font-medium">{FEATURE_LABELS[grant.featureKey]}</h4>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <DateEvidence label="Starts" value={grant.startsAt} />
                  <DateEvidence label="Expires" value={grant.expiresAt} />
                </dl>
                {controlsAvailable ? (
                  <RevokeGrantForm
                    key={grant.revokeOperationId}
                    userId={userId}
                    grant={grant}
                    expectedActiveGrantIds={expectedActiveGrantIds[grant.featureKey]}
                    formAction={revokeAction}
                    isPending={revokePending}
                  />
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <ActionFeedback state={revokeState} />
    </article>
  )
}

/** Owns one prepared-time preview and clears confirmation whenever feature or duration changes. */
function GrantFields({
  userId,
  preparedAt,
  operationId,
  expectedActiveGrantIds,
  formAction,
  isPending,
}: {
  userId: string
  preparedAt: string
  operationId: string
  expectedActiveGrantIds: Record<AdminGrantableFeatureKey, string[]>
  formAction: (payload: FormData) => void
  isPending: boolean
}) {
  const formId = useId()
  const [featureKey, setFeatureKey] = useState<AdminGrantableFeatureKey>("premium_backgrounds")
  const [durationDays, setDurationDays] = useState("7")
  const [reasonCode, setReasonCode] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const parsedDays = parseDays(durationDays)
  const startsAt = new Date(preparedAt)
  const expiresAt = parsedDays === null ? null : new Date(startsAt.getTime() + parsedDays * DAY_MS)
  const validPreview = Number.isFinite(startsAt.getTime()) && expiresAt !== null && Number.isFinite(expiresAt.getTime())
  const canSubmit = validPreview && reasonReady(reasonCode, internalNote) && confirmed && !isPending
  const updateFeature = (value: string) => {
    if (isFeatureKey(value)) setFeatureKey(value)
    setConfirmed(false)
  }
  const updateDuration = (value: string) => {
    setDurationDays(value)
    setConfirmed(false)
  }

  return (
    <form action={formAction} className="space-y-4">
      <StableFields userId={userId} operationId={operationId} />
      {expectedActiveGrantIds[featureKey].map((grantId) => (
        <input key={grantId} type="hidden" name="expectedActiveGrantIds" value={grantId} />
      ))}

      <div className="space-y-1">
        <label htmlFor={`${formId}-feature`} className="text-sm font-medium">Temporary feature</label>
        <select
          id={`${formId}-feature`}
          name="featureKey"
          value={featureKey}
          onChange={(event) => updateFeature(event.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {FEATURE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Duration</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Temporary access duration presets">
          {DURATION_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={durationDays === String(preset) ? "default" : "outline"}
              size="sm"
              aria-pressed={durationDays === String(preset)}
              onClick={() => updateDuration(String(preset))}
            >
              {preset} days
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${formId}-duration`} className="text-sm font-medium">Custom duration</label>
          <input
            id={`${formId}-duration`}
            name="durationDays"
            type="number"
            min={1}
            max={365}
            step={1}
            value={durationDays}
            onChange={(event) => updateDuration(event.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <dl className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2" aria-live="polite">
        <DateEvidence label="Starts" value={validPreview ? startsAt.toISOString() : null} preview="starts" />
        <DateEvidence label="Expires" value={validPreview ? expiresAt.toISOString() : null} preview="expires" />
      </dl>

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
          value={GRANT_CONFIRMATION}
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
          className="mt-1 size-4"
        />
        <span>I confirm this exact temporary grant gives {FEATURE_LABELS[featureKey]} access for {parsedDays ?? "the selected number of"} day{parsedDays === 1 ? "" : "s"}.</span>
      </label>
      <Button type="submit" disabled={!canSubmit}>
        {isPending ? "Granting temporary access…" : "Grant temporary access"}
      </Button>
    </form>
  )
}

/** Each visible grant owns a distinct server UUID while sharing the feature's full optimistic snapshot. */
function RevokeGrantForm({
  userId,
  grant,
  expectedActiveGrantIds,
  formAction,
  isPending,
}: {
  userId: string
  grant: TemporaryGrantPresentation
  expectedActiveGrantIds: string[]
  formAction: (payload: FormData) => void
  isPending: boolean
}) {
  const formId = useId()
  const [reasonCode, setReasonCode] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const canSubmit = reasonReady(reasonCode, internalNote) && confirmed && !isPending

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t pt-3">
      <StableFields userId={userId} operationId={grant.revokeOperationId} />
      <input type="hidden" name="grantId" value={grant.grantId} />
      {expectedActiveGrantIds.map((grantId) => (
        <input key={grantId} type="hidden" name="expectedActiveGrantIds" value={grantId} />
      ))}
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
          value={REVOCATION_CONFIRMATION}
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
          className="mt-1 size-4"
        />
        <span>I confirm this append-only revocation ends only this temporary grant. Other membership or temporary sources may keep the feature available.</span>
      </label>
      <Button type="submit" variant="destructive" disabled={!canSubmit}>
        {isPending ? "Revoking temporary grant…" : "Revoke this temporary grant"}
      </Button>
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

function StableFields({ userId, operationId }: { userId: string; operationId: string }) {
  return (
    <>
      <input type="hidden" name="targetUserId" value={userId} />
      <input type="hidden" name="operationId" value={operationId} />
    </>
  )
}

function DateEvidence({
  label,
  value,
  preview,
}: {
  label: string
  value: string | null
  preview?: "starts" | "expires"
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>{value ? <time data-temporary-preview={preview} dateTime={value}>{formatDateTime(value)}</time> : "Unavailable"}</dd>
    </div>
  )
}

function ActionFeedback({ state }: { state: TemporaryAccessActionState }) {
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

function parseDays(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null
  const days = Number(value)
  return Number.isSafeInteger(days) && days >= 1 && days <= 365 ? days : null
}

function isFeatureKey(value: string): value is AdminGrantableFeatureKey {
  return FEATURE_OPTIONS.some((option) => option.key === value)
}

function reasonReady(reasonCode: string, internalNote: string) {
  return Boolean(reasonCode) && (reasonCode !== "OTHER" || Boolean(internalNote.trim()))
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unavailable"
}
