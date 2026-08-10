"use server"

import { revalidatePath } from "next/cache"
import { requireFullAdminUser } from "@/lib/admin/access"
import { deliverAdminEmailIntent } from "@/lib/admin/email-intents"
import {
  ADMIN_REASON_CODES,
  validateAdminReason,
  type AdminReasonCode,
} from "@/lib/admin/operation-contract"
import {
  ADMIN_GRANTABLE_FEATURE_KEYS,
  grantTemporaryFeatureAccess,
  revokeTemporaryFeatureAccess,
  type AdminGrantableFeatureKey,
  type TemporaryFeatureAccessMutationResult,
} from "@/lib/admin/temporary-access"
import { prisma } from "@/lib/prisma"
import { safeErrorCode } from "@/lib/safe-error-code"

export type TemporaryAccessActionState =
  | { status: "idle"; message: "" }
  | { status: "success" | "warning" | "error"; message: string }

const GRANT_CONFIRMATION = "CONFIRM_TEMPORARY_ACCESS_GRANT"
const REVOCATION_CONFIRMATION = "CONFIRM_TEMPORARY_ACCESS_REVOCATION"
const MIN_DURATION_DAYS = 1
const MAX_DURATION_DAYS = 365
const MAX_ACTIVE_GRANTS_PER_FEATURE = 100
const FEATURE_LABELS: Record<AdminGrantableFeatureKey, string> = {
  premium_backgrounds: "Premium backgrounds",
  therapist_documentation_tools: "Therapist documentation tools",
  calendar_basic_scheduling: "Basic calendar scheduling",
  calendar_full_scheduling: "Full calendar scheduling",
  external_calendar_sync: "External calendar sync",
}
const SAFE_MUTATION_ERRORS = new Set([
  "Temporary access changed since this operation was prepared. Refresh the account and try again.",
  "Temporary access requires a verified target account with an email.",
  "Temporary access has too many active grants to change safely.",
  "Only an active temporary feature grant can be revoked.",
])

type ParsedCommon = {
  targetUserId: string
  operationId: string
  expectedActiveGrantIds: string[]
  reasonCode: AdminReasonCode
  internalNote: string | null
}

/** Grants one route-bound temporary source after fresh authority and strict form validation. */
export async function grantTemporaryAccessAction(
  userId: string,
  _previousState: TemporaryAccessActionState,
  formData: FormData,
): Promise<TemporaryAccessActionState> {
  const actor = await requireFullAdminUser()
  const common = parseCommon(userId, formData)
  if (!common.ok) return common.state
  const featureKey = formValue(formData, "featureKey")
  const durationDays = parseInteger(formValue(formData, "durationDays"), MIN_DURATION_DAYS, MAX_DURATION_DAYS)
  if (!featureKey || !isGrantableFeature(featureKey) || durationDays === null) {
    return { status: "error", message: "Select an available feature and a whole-number duration from 1 through 365 days." }
  }
  if (formValue(formData, "confirmation") !== GRANT_CONFIRMATION) {
    return { status: "error", message: "Confirm this exact temporary-access grant." }
  }

  let result: TemporaryFeatureAccessMutationResult
  try {
    result = await grantTemporaryFeatureAccess({
      prismaClient: prisma,
      actorUserId: actor.id,
      targetUserId: common.value.targetUserId,
      featureKey,
      durationDays,
      expectedActiveGrantIds: common.value.expectedActiveGrantIds,
      reasonCode: common.value.reasonCode,
      internalNote: common.value.internalNote,
      idempotencyKey: common.value.operationId,
    })
  } catch (error) {
    logMutationFailure("GRANT", error)
    return safeMutationError(error, "Temporary access could not be granted. Refresh the account and try again.")
  }

  const delivery = await deliverNotification(result.emailIntentId, "GRANT_EMAIL")
  revalidateTemporaryAccessSurfaces(userId)
  const prefix = result.replayed
    ? `This temporary-access grant was already completed. The recorded ${featureLabel(result.featureKey)} grant runs through ${result.expiresAt}.`
    : `Temporary ${featureLabel(result.featureKey)} access was granted through ${result.expiresAt}.`
  return notificationOutcome(prefix, delivery, result.replayed, actor.id === common.value.targetUserId)
}

/** Appends one route-bound revocation without claiming all effective feature sources ended. */
export async function revokeTemporaryAccessAction(
  userId: string,
  _previousState: TemporaryAccessActionState,
  formData: FormData,
): Promise<TemporaryAccessActionState> {
  const actor = await requireFullAdminUser()
  const common = parseCommon(userId, formData)
  if (!common.ok) return common.state
  const grantId = formValue(formData, "grantId")
  if (!grantId || !isSafeRecordId(grantId) || !common.value.expectedActiveGrantIds.includes(grantId)) {
    return { status: "error", message: "Refresh this account before revoking temporary access." }
  }
  if (formValue(formData, "confirmation") !== REVOCATION_CONFIRMATION) {
    return { status: "error", message: "Confirm this exact append-only revocation." }
  }

  let result: TemporaryFeatureAccessMutationResult
  try {
    result = await revokeTemporaryFeatureAccess({
      prismaClient: prisma,
      actorUserId: actor.id,
      targetUserId: common.value.targetUserId,
      grantId,
      expectedActiveGrantIds: common.value.expectedActiveGrantIds,
      reasonCode: common.value.reasonCode,
      internalNote: common.value.internalNote,
      idempotencyKey: common.value.operationId,
    })
  } catch (error) {
    logMutationFailure("REVOKE", error)
    return safeMutationError(error, "The temporary grant could not be revoked. Refresh the account and try again.")
  }

  const delivery = await deliverNotification(result.emailIntentId, "REVOKE_EMAIL")
  revalidateTemporaryAccessSurfaces(userId)
  const base = result.replayed
    ? `This temporary-access revocation was already completed. The recorded ${featureLabel(result.featureKey)} grant was revoked.`
    : `One temporary ${featureLabel(result.featureKey)} grant was revoked.`
  const overlap = result.effective ? " Another temporary grant remains active." : ""
  const prefix = `${base}${overlap} Other membership or temporary sources may still keep this feature available.`
  return notificationOutcome(prefix, delivery, result.replayed, actor.id === common.value.targetUserId)
}

/** Parses the immutable route target, operation key, optimistic snapshot, and shared reason evidence. */
function parseCommon(
  boundUserId: string,
  formData: FormData,
): { ok: true; value: ParsedCommon } | { ok: false; state: TemporaryAccessActionState } {
  const targetUserId = formValue(formData, "targetUserId")
  if (!targetUserId || targetUserId !== boundUserId) {
    return { ok: false, state: { status: "error", message: "Refresh this account before changing temporary access." } }
  }
  const operationId = formValue(formData, "operationId")
  const expectedActiveGrantIds = parseExpectedActiveGrantIds(formData)
  if (!operationId || !isUuid(operationId) || expectedActiveGrantIds === null) {
    return { ok: false, state: { status: "error", message: "Refresh this account before changing temporary access." } }
  }
  const reasonCode = formValue(formData, "reasonCode")
  const rawInternalNote = formValue(formData, "internalNote") ?? ""
  if (!reasonCode || !ADMIN_REASON_CODES.includes(reasonCode as AdminReasonCode) || rawInternalNote.length > 500) {
    return { ok: false, state: { status: "error", message: "Choose a valid reason and check the internal note." } }
  }
  const internalNote = rawInternalNote.trim() || null
  try {
    validateAdminReason(reasonCode, internalNote)
  } catch {
    return { ok: false, state: { status: "error", message: "Choose a valid reason and check the internal note." } }
  }
  return {
    ok: true,
    value: {
      targetUserId,
      operationId,
      expectedActiveGrantIds,
      reasonCode: reasonCode as AdminReasonCode,
      internalNote,
    },
  }
}

/** Requires a bounded, unique snapshot already sorted by the service's ordinal contract. */
function parseExpectedActiveGrantIds(formData: FormData): string[] | null {
  const values = formData.getAll("expectedActiveGrantIds")
  if (values.length > MAX_ACTIVE_GRANTS_PER_FEATURE || values.some((value) => typeof value !== "string" || !isSafeRecordId(value))) {
    return null
  }
  const grantIds = values as string[]
  if (new Set(grantIds).size !== grantIds.length) return null
  const sorted = [...grantIds].sort()
  return sorted.every((grantId, index) => grantId === grantIds[index]) ? grantIds : null
}

/** Initial delivery may recover only PENDING; the locked owner never resends FAILED or DELIVERED. */
async function deliverNotification(
  intentId: string,
  operation: string,
): Promise<{ status: "DELIVERED" | "FAILED"; attempted: boolean } | null> {
  try {
    const result = await deliverAdminEmailIntent({ prismaClient: prisma, intentId })
    return { status: result.status, attempted: result.attempted }
  } catch (error) {
    logMutationFailure(operation, error)
    return null
  }
}

function notificationOutcome(
  prefix: string,
  delivery: { status: "DELIVERED" | "FAILED"; attempted: boolean } | null,
  replayed: boolean,
  selfTarget: boolean,
): TemporaryAccessActionState {
  if (delivery?.status === "DELIVERED" && delivery.attempted) {
    return {
      status: "success",
      message: `${prefix} ${replayed ? "Its pending email notification was delivered." : "Email notification delivered."}`,
    }
  }
  if (delivery?.status === "DELIVERED") {
    return { status: "success", message: `${prefix} The email notification was already delivered; this invocation made no new send attempt.` }
  }
  if (delivery?.status === "FAILED" && delivery.attempted) {
    return { status: "warning", message: `${prefix} The email notification failed. ${activityGuidance(selfTarget)}` }
  }
  if (delivery?.status === "FAILED") {
    return {
      status: "warning",
      message: `${prefix} This invocation made no new email attempt because the notification is already recorded as failed. ${activityGuidance(selfTarget)}`,
    }
  }
  return {
    status: "warning",
    message: `${prefix} Email delivery could not be confirmed. ${selfTarget ? "Check Activity for the recorded notification status." : "Check Activity before retrying."}`,
  }
}

function activityGuidance(selfTarget: boolean) {
  return selfTarget ? "Check Activity for the recorded notification status." : "Retry it from Activity."
}

function safeMutationError(error: unknown, fallback: string): TemporaryAccessActionState {
  const message = error instanceof Error && (
    SAFE_MUTATION_ERRORS.has(error.message)
    || /^Temporary access has reached the active grant limit of 100 for this feature\.$/.test(error.message)
  ) ? error.message : fallback
  return { status: "error", message }
}

function revalidateTemporaryAccessSurfaces(userId: string) {
  revalidatePath(`/admin/users/${encodeURIComponent(userId)}`)
  revalidatePath("/admin/users")
  revalidatePath("/admin")
  revalidatePath("/account")
}

function featureLabel(featureKey: AdminGrantableFeatureKey) {
  return FEATURE_LABELS[featureKey]
}

function logMutationFailure(operation: string, error: unknown) {
  console.error("Admin temporary-access operation failed", { operation, code: safeErrorCode(error) })
}

function parseInteger(value: string | null, minimum: number, maximum: number) {
  if (!value || !/^(?:0|[1-9]\d*)$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : null
}

function isGrantableFeature(value: string): value is AdminGrantableFeatureKey {
  return ADMIN_GRANTABLE_FEATURE_KEYS.includes(value as AdminGrantableFeatureKey)
}

function isSafeRecordId(value: string) {
  return value.length <= 191 && /^[A-Za-z0-9_-]+$/.test(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
