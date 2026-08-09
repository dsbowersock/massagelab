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
  changeAnatomyRole,
  type AnatomyRoleOperation,
  type DelegatedAnatomyRole,
  type ExpectedAnatomyRoleStatus,
} from "@/lib/admin/role-service"
import { prisma } from "@/lib/prisma"
import { safeErrorCode } from "@/lib/safe-error-code"

export type RoleChangeActionState =
  | { status: "idle"; message: "" }
  | { status: "success" | "warning" | "error"; message: string }

const ROLE_CHANGE_CONFIRMATION = "CONFIRM_ANATOMY_ROLE_CHANGE"
const DELEGATED_ROLES = new Set<DelegatedAnatomyRole>(["ANATOMY_REVIEWER", "ANATOMY_EDITOR"])
const ROLE_OPERATIONS = new Set<AnatomyRoleOperation>(["ASSIGN", "REVOKE"])
const EXPECTED_ROLE_STATUSES = new Set<ExpectedAnatomyRoleStatus>(["ABSENT", "VERIFIED", "REVOKED"])

type ParsedRoleChange = {
  targetUserId: string
  role: DelegatedAnatomyRole
  operation: AnatomyRoleOperation
  expectedStatus: ExpectedAnatomyRoleStatus
  reasonCode: AdminReasonCode
  internalNote: string | null
  operationId: string
}

/**
 * Applies one explicitly confirmed delegated-role change. Full-Admin authority
 * is verified before form outcomes are handled; transport occurs only after the
 * local transaction has committed and cannot roll that mutation back.
 */
export async function changeAnatomyRoleAction(
  userId: string,
  _previousState: RoleChangeActionState,
  formData: FormData,
): Promise<RoleChangeActionState> {
  const actor = await requireFullAdminUser()
  const parsed = parseRoleChangeForm(userId, formData)
  if (!parsed.ok) return { status: "error", message: parsed.message }

  let result: Awaited<ReturnType<typeof changeAnatomyRole>>
  try {
    result = await changeAnatomyRole({
      prismaClient: prisma,
      actorUserId: actor.id,
      targetUserId: parsed.value.targetUserId,
      role: parsed.value.role,
      operation: parsed.value.operation,
      expectedStatus: parsed.value.expectedStatus,
      reasonCode: parsed.value.reasonCode,
      internalNote: parsed.value.internalNote,
      idempotencyKey: parsed.value.operationId,
    })
  } catch (error) {
    console.error("Admin anatomy role change failed", {
      code: safeErrorCode(error),
      role: parsed.value.role,
      operation: parsed.value.operation,
    })
    return { status: "error", message: "The anatomy role could not be changed. Refresh the account and try again." }
  }

  if (result.replayed) {
    revalidateRoleSurfaces(userId)
    return {
      status: "success",
      message: "This anatomy role change was already completed. No new notification was sent; check Activity for the recorded outcome.",
    }
  }

  let notificationOutcome: { status: "DELIVERED" | "FAILED"; attempted: boolean } | null = null
  try {
    const delivery = await deliverAdminEmailIntent({
      prismaClient: prisma,
      intentId: result.emailIntentId,
    })
    notificationOutcome = { status: delivery.status, attempted: delivery.attempted }
  } catch (error) {
    console.error("Admin anatomy role notification failed", {
      code: safeErrorCode(error),
      role: parsed.value.role,
      operation: parsed.value.operation,
    })
  }

  revalidateRoleSurfaces(userId)
  if (notificationOutcome?.status === "DELIVERED") {
    return { status: "success", message: "The anatomy role changed and the user was signed out. Email notification delivered." }
  }
  if (notificationOutcome?.status === "FAILED" && notificationOutcome.attempted) {
    return {
        status: "warning",
        message: "The anatomy role changed and the user was signed out, but the email notification failed. Retry it from Activity.",
    }
  }
  if (notificationOutcome?.status === "FAILED") {
    return {
      status: "warning",
      message: "The anatomy role changed and the user was signed out, but no email was sent. Check Activity for the notification status.",
    }
  }
  return {
    status: "warning",
    message: "The anatomy role changed and the user was signed out, but email delivery could not be confirmed. Check Activity before retrying.",
  }
}

function revalidateRoleSurfaces(userId: string) {
  revalidatePath(`/admin/users/${encodeURIComponent(userId)}`)
  revalidatePath("/admin/users")
}

/** Parses only the immutable fields displayed by the bound Access-section form. */
function parseRoleChangeForm(
  boundUserId: string,
  formData: FormData,
): { ok: true; value: ParsedRoleChange } | { ok: false; message: string } {
  const targetUserId = formValue(formData, "targetUserId")
  if (!targetUserId || targetUserId !== boundUserId) {
    return { ok: false, message: "Refresh this account before changing its role." }
  }

  const role = formValue(formData, "role")
  const operation = formValue(formData, "operation")
  const expectedStatus = formValue(formData, "expectedStatus")
  const operationId = formValue(formData, "operationId")
  const confirmation = formValue(formData, "confirmation")
  if (!role || !DELEGATED_ROLES.has(role as DelegatedAnatomyRole)) {
    return { ok: false, message: "Choose a supported delegated anatomy role." }
  }
  if (!operation || !ROLE_OPERATIONS.has(operation as AnatomyRoleOperation)) {
    return { ok: false, message: "Choose a valid anatomy role operation." }
  }
  if (!expectedStatus || !EXPECTED_ROLE_STATUSES.has(expectedStatus as ExpectedAnatomyRoleStatus)) {
    return { ok: false, message: "Refresh this account before changing its role." }
  }
  if (!operationId || !isUuid(operationId)) {
    return { ok: false, message: "Refresh this account before changing its role." }
  }
  if (confirmation !== ROLE_CHANGE_CONFIRMATION) {
    return { ok: false, message: "Confirm that this role change will sign the user out." }
  }

  const reasonCode = formValue(formData, "reasonCode")
  const rawInternalNote = formValue(formData, "internalNote") ?? ""
  if (!reasonCode || !ADMIN_REASON_CODES.includes(reasonCode as AdminReasonCode) || rawInternalNote.length > 500) {
    return { ok: false, message: "Choose a valid reason and check the internal note." }
  }
  const internalNote = rawInternalNote.trim() || null
  try {
    validateAdminReason(reasonCode, internalNote)
  } catch {
    return { ok: false, message: "Choose a valid reason and check the internal note." }
  }

  return {
    ok: true,
    value: {
      targetUserId,
      role: role as DelegatedAnatomyRole,
      operation: operation as AnatomyRoleOperation,
      expectedStatus: expectedStatus as ExpectedAnatomyRoleStatus,
      reasonCode: reasonCode as AdminReasonCode,
      internalNote,
      operationId,
    },
  }
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
