"use server"

import { revalidatePath } from "next/cache"
import { requireFullAdminUser } from "@/lib/admin/access"
import { deliverAdminEmailIntent } from "@/lib/admin/email-intents"
import {
  ADMIN_BACKGROUND_CREDIT_GRANT_MAX,
  ADMIN_BACKGROUND_CREDIT_GRANT_MIN,
  ADMIN_REASON_CODES,
  validateAdminReason,
  type AdminReasonCode,
} from "@/lib/admin/operation-contract"
import { grantAdminBackgroundCredits } from "@/lib/commerce/credit-service"
import { prisma } from "@/lib/prisma"
import { safeErrorCode } from "@/lib/safe-error-code"

export type CreditGrantActionState =
  | { status: "idle"; message: "" }
  | { status: "success" | "warning" | "error"; message: string }

const CREDIT_GRANT_CONFIRMATION = "CONFIRM_BACKGROUND_CREDIT_GRANT"
const SAFE_CREDIT_GRANT_ERRORS = new Set([
  "The background credit balance changed since this grant was prepared. Refresh the account and try again.",
  "Background credits require a verified target account with an email.",
])

type ParsedCreditGrant = {
  targetUserId: string
  operationId: string
  amount: number
  expectedBalance: number
  reasonCode: AdminReasonCode
  internalNote: string | null
}

/**
 * Applies one explicitly confirmed positive grant. Authority is checked before
 * form parsing, and the existing delivery owner runs only after the Task 14
 * transaction has committed.
 */
export async function grantBackgroundCreditsAction(
  userId: string,
  _previousState: CreditGrantActionState,
  formData: FormData,
): Promise<CreditGrantActionState> {
  const actor = await requireFullAdminUser()
  const parsed = parseCreditGrantForm(userId, formData)
  if (!parsed.ok) return { status: "error", message: parsed.message }

  let result: Awaited<ReturnType<typeof grantAdminBackgroundCredits>>
  try {
    result = await grantAdminBackgroundCredits({
      prismaClient: prisma,
      actorUserId: actor.id,
      targetUserId: parsed.value.targetUserId,
      amount: parsed.value.amount,
      expectedBalance: parsed.value.expectedBalance,
      reasonCode: parsed.value.reasonCode,
      internalNote: parsed.value.internalNote,
      idempotencyKey: parsed.value.operationId,
    })
  } catch (error) {
    console.error("Admin background-credit grant failed", { code: safeErrorCode(error) })
    return {
      status: "error",
      message: error instanceof Error && SAFE_CREDIT_GRANT_ERRORS.has(error.message)
        ? error.message
        : "Background credits could not be added. Refresh the account and try again.",
    }
  }

  let deliveryOutcome: { status: "DELIVERED" | "FAILED"; attempted: boolean } | null = null
  try {
    const delivery = await deliverAdminEmailIntent({
      prismaClient: prisma,
      intentId: result.emailIntentId,
    })
    deliveryOutcome = { status: delivery.status, attempted: delivery.attempted }
  } catch (error) {
    console.error("Admin background-credit notification failed", { code: safeErrorCode(error) })
  }

  revalidateCreditGrantSurfaces(userId)
  return creditGrantOutcome(result, deliveryOutcome, actor.id === parsed.value.targetUserId)
}

/** Parses only the immutable values displayed by the bound Access form. */
function parseCreditGrantForm(
  boundUserId: string,
  formData: FormData,
): { ok: true; value: ParsedCreditGrant } | { ok: false; message: string } {
  const targetUserId = formValue(formData, "targetUserId")
  if (!targetUserId || targetUserId !== boundUserId) {
    return { ok: false, message: "Refresh this account before adding background credits." }
  }

  const operationId = formValue(formData, "operationId")
  const amount = parseInteger(
    formValue(formData, "amount"),
    ADMIN_BACKGROUND_CREDIT_GRANT_MIN,
    ADMIN_BACKGROUND_CREDIT_GRANT_MAX,
  )
  const expectedBalance = parseInteger(formValue(formData, "expectedBalance"), 0, Number.MAX_SAFE_INTEGER)
  const confirmation = formValue(formData, "confirmation")
  if (!operationId || !isUuid(operationId) || amount === null || expectedBalance === null) {
    return {
      ok: false,
      message: `Refresh the account and provide a whole-number credit amount from ${ADMIN_BACKGROUND_CREDIT_GRANT_MIN} through ${ADMIN_BACKGROUND_CREDIT_GRANT_MAX}.`,
    }
  }
  if (confirmation !== CREDIT_GRANT_CONFIRMATION) {
    return { ok: false, message: "Confirm the exact positive background-credit grant." }
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
      operationId,
      amount,
      expectedBalance,
      reasonCode: reasonCode as AdminReasonCode,
      internalNote,
    },
  }
}

/** Invalidates both bounded target views plus the aggregate directory after commit. */
function revalidateCreditGrantSurfaces(userId: string) {
  const encodedUserId = encodeURIComponent(userId)
  revalidatePath(`/admin/users/${encodedUserId}`)
  revalidatePath("/admin/users")
}

function creditGrantOutcome(
  result: Awaited<ReturnType<typeof grantAdminBackgroundCredits>>,
  delivery: { status: "DELIVERED" | "FAILED"; attempted: boolean } | null,
  selfTarget: boolean,
): CreditGrantActionState {
  if (result.replayed) {
    const prefix = `This background-credit grant was already completed. The recorded grant changed the balance from ${result.previousBalance} to ${result.balanceAfter}.`
    if (delivery?.status === "DELIVERED" && delivery.attempted) {
      return { status: "success", message: `${prefix} Its pending email notification was delivered.` }
    }
    if (delivery?.status === "DELIVERED") {
      return { status: "success", message: `${prefix} The email notification was already delivered; this invocation made no new send attempt.` }
    }
    if (delivery?.status === "FAILED" && delivery.attempted) {
      return {
        status: "warning",
        message: `${prefix} Delivery of its pending email notification failed. ${activityRetryGuidance(selfTarget)}`,
      }
    }
    if (delivery?.status === "FAILED") {
      return failedWithoutAttemptOutcome(prefix, selfTarget)
    }
    return {
      status: "warning",
      message: selfTarget
        ? `${prefix} Email delivery could not be confirmed. Check Activity for the recorded notification status.`
        : `${prefix} Email delivery could not be confirmed. Check Activity before retrying.`,
    }
  }

  const credits = `${result.amount} background credit${result.amount === 1 ? "" : "s"}`
  const verb = result.amount === 1 ? "was" : "were"
  const prefix = `${credits} ${verb} added. The balance changed from ${result.previousBalance} to ${result.balanceAfter}.`
  if (delivery?.status === "DELIVERED") {
    return { status: "success", message: `${prefix} Email notification delivered.` }
  }
  if (delivery?.status === "FAILED" && delivery.attempted) {
    return {
      status: "warning",
      message: `${prefix} The email notification failed. ${activityRetryGuidance(selfTarget)}`,
    }
  }
  if (delivery?.status === "FAILED") {
    return failedWithoutAttemptOutcome(prefix, selfTarget)
  }
  return {
    status: "warning",
    message: selfTarget
      ? `${prefix} Email delivery could not be confirmed. Check Activity for the recorded notification status.`
      : `${prefix} Email delivery could not be confirmed. Check Activity before retrying.`,
  }
}

/**
 * Describes only this invocation's no-attempt result. Another concurrent
 * request may have made the attempt that persisted the observed FAILED state.
 */
function failedWithoutAttemptOutcome(prefix: string, selfTarget: boolean): CreditGrantActionState {
  const outcome = `${prefix} This invocation made no new email attempt because the notification is already recorded as failed.`
  return {
    status: "warning",
    message: `${outcome} ${activityRetryGuidance(selfTarget)}`,
  }
}

/** Points only to an Activity action that the current operator can actually use. */
function activityRetryGuidance(selfTarget: boolean): string {
  return selfTarget
    ? "Check Activity for the recorded notification status."
    : "Retry it from Activity."
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
