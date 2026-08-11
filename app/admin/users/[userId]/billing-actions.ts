"use server"

import { revalidatePath } from "next/cache"
import { requireFullAdminUser } from "@/lib/admin/access"
import {
  applyInvoiceCredit,
  reconcileInvoiceCredit,
  type BillingGoodwillResult,
} from "@/lib/admin/billing-goodwill"
import { isBrowserBillingGoodwillMutationBlocked } from "@/lib/admin/browser-billing-goodwill-preview"
import { deliverAdminEmailIntent } from "@/lib/admin/email-intents"
import {
  ADMIN_REASON_CODES,
  validateAdminReason,
  type AdminReasonCode,
} from "@/lib/admin/operation-contract"
import { prisma } from "@/lib/prisma"
import { safeErrorCode } from "@/lib/safe-error-code"
import { getStripeClient } from "@/lib/stripe-billing"

export type BillingGoodwillActionState =
  | { status: "idle"; message: "" }
  | { status: "success" | "warning" | "error"; message: string }

type ParsedApplyForm = {
  targetUserId: string
  operationId: string
  amountCents: number
  expectedStartingCreditCents: number
  confirmationEmail: string
  reasonCode: AdminReasonCode
  internalNote: string | null
}

const BROWSER_QA_MUTATION_BLOCKED = "Billing goodwill mutation is disabled for browser QA. No Stripe change was attempted."

/** Applies only the route-bound, freshly authorized, exactly confirmed credit request. */
export async function applyBillingGoodwillAction(
  userId: string,
  _previousState: BillingGoodwillActionState,
  formData: FormData,
): Promise<BillingGoodwillActionState> {
  const actor = await requireFullAdminUser()
  if (isBrowserBillingGoodwillMutationBlocked(userId)) {
    return { status: "error", message: BROWSER_QA_MUTATION_BLOCKED }
  }
  const parsed = parseApplyForm(userId, formData)
  if (!parsed.ok) return { status: "error", message: parsed.message }

  let result: BillingGoodwillResult
  try {
    result = await applyInvoiceCredit({
      prismaClient: prisma,
      actorUserId: actor.id,
      targetUserId: parsed.value.targetUserId,
      amountCents: parsed.value.amountCents,
      confirmationEmail: parsed.value.confirmationEmail,
      expectedStartingCreditCents: parsed.value.expectedStartingCreditCents,
      reasonCode: parsed.value.reasonCode,
      internalNote: parsed.value.internalNote,
      idempotencyKey: parsed.value.operationId,
      stripeClient: getStripeClient(),
      env: process.env,
    })
  } catch (error) {
    console.error("Admin billing-goodwill apply failed", { code: safeErrorCode(error) })
    return { status: "error", message: "The invoice credit could not be applied. Refresh the billing preview and try again." }
  }

  const outcome = await presentGoodwillResult(result, "apply")
  revalidateBillingSurfaces(userId)
  return outcome
}

/** Reloads the immutable unresolved request and reuses its original Stripe idempotency key. */
export async function reconcileBillingGoodwillAction(
  userId: string,
  _previousState: BillingGoodwillActionState,
  formData: FormData,
): Promise<BillingGoodwillActionState> {
  const actor = await requireFullAdminUser()
  if (isBrowserBillingGoodwillMutationBlocked(userId)) {
    return { status: "error", message: BROWSER_QA_MUTATION_BLOCKED }
  }
  const targetUserId = formValue(formData, "targetUserId")
  const reconcileOperationId = formValue(formData, "reconcileOperationId")
  if (targetUserId !== userId || !reconcileOperationId || !isSafeIdentifier(reconcileOperationId)) {
    return { status: "error", message: "Refresh this account before reconciling billing goodwill." }
  }

  let operation: Awaited<ReturnType<typeof loadReconciliationOperation>>
  try {
    operation = await loadReconciliationOperation(reconcileOperationId, userId)
  } catch (error) {
    console.error("Admin billing-goodwill reconciliation load failed", { code: safeErrorCode(error) })
    return { status: "error", message: "This billing goodwill operation could not be loaded safely. Refresh the account before trying again." }
  }
  const reconciliationEmail = formValue(formData, "reconciliationEmail")
  const reconciliationAmount = parseExactUsd(formValue(formData, "reconciliationAmount"))
  const normalizedTargetEmail = normalizeExactEmail(operation?.target.email)
  if (!operation
    || operation.id !== reconcileOperationId
    || operation.targetUserId !== userId
    || !normalizedTargetEmail
    || reconciliationEmail !== normalizedTargetEmail
    || reconciliationAmount !== operation.amountCents
    || !Number.isSafeInteger(operation.amountCents)
    || operation.amountCents < 1
    || operation.amountCents > 10_000
    || !ADMIN_REASON_CODES.includes(operation.reasonCode as AdminReasonCode)) {
    return { status: "error", message: "This billing goodwill operation is no longer available for reconciliation." }
  }

  let result: BillingGoodwillResult
  try {
    result = await reconcileInvoiceCredit({
      prismaClient: prisma,
      actorUserId: actor.id,
      targetUserId: operation.targetUserId,
      amountCents: operation.amountCents,
      confirmationEmail: normalizedTargetEmail,
      expectedStartingCreditCents: operation.startingBalanceCents,
      reasonCode: operation.reasonCode as AdminReasonCode,
      internalNote: operation.internalNote,
      idempotencyKey: operation.idempotencyKey,
      stripeClient: getStripeClient(),
      env: process.env,
    })
  } catch (error) {
    console.error("Admin billing-goodwill reconciliation failed", { code: safeErrorCode(error) })
    return { status: "error", message: "Reconciliation could not be completed. Review the operation before trying again." }
  }

  const outcome = await presentGoodwillResult(result, "reconcile")
  revalidateBillingSurfaces(userId)
  return outcome
}

/** Loads only the stored immutable inputs needed for one route-owned replay. */
function loadReconciliationOperation(operationId: string, targetUserId: string) {
  return prisma.adminBillingGoodwillOperation.findFirst({
    where: { id: operationId, targetUserId, status: "RECONCILIATION_REQUIRED" },
    select: {
      id: true,
      targetUserId: true,
      amountCents: true,
      startingBalanceCents: true,
      reasonCode: true,
      internalNote: true,
      idempotencyKey: true,
      target: { select: { email: true } },
    },
  })
}

function parseApplyForm(
  boundUserId: string,
  formData: FormData,
): { ok: true; value: ParsedApplyForm } | { ok: false; message: string } {
  const targetUserId = formValue(formData, "targetUserId")
  if (!targetUserId || targetUserId !== boundUserId) {
    return { ok: false, message: "Refresh this account before applying billing goodwill." }
  }
  const operationId = formValue(formData, "operationId")
  const amountCents = parseInteger(formValue(formData, "amountCents"), 1, 10_000)
  const expectedStartingCreditCents = parseInteger(
    formValue(formData, "expectedStartingCreditCents"),
    0,
    Number.MAX_SAFE_INTEGER,
  )
  const confirmationEmail = formValue(formData, "confirmationEmail")
  const confirmationAmount = parseExactUsd(formValue(formData, "confirmationAmount"))
  if (!operationId || !isUuid(operationId) || amountCents === null || expectedStartingCreditCents === null) {
    return { ok: false, message: "Refresh the billing preview and provide a credit from $0.01 through $100.00." }
  }
  if (!confirmationEmail || confirmationEmail !== confirmationEmail.trim().toLowerCase()) {
    return { ok: false, message: "Type the exact normalized target email shown in the billing preview." }
  }
  if (confirmationAmount !== amountCents) {
    return { ok: false, message: "Type the exact dollar amount shown in the billing confirmation." }
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
      amountCents,
      expectedStartingCreditCents,
      confirmationEmail,
      reasonCode: reasonCode as AdminReasonCode,
      internalNote,
    },
  }
}

/** Notification delivery starts only after VERIFIED returned the committed bundle intent. */
async function presentGoodwillResult(
  result: BillingGoodwillResult,
  context: "apply" | "reconcile",
): Promise<BillingGoodwillActionState> {
  if (result.status === "RECONCILIATION_REQUIRED") {
    return {
      status: "warning",
      message: "Stripe may have applied this credit, but authoritative verification is incomplete. No email was sent. Use the single Reconcile action for this operation.",
    }
  }
  if (result.status === "FAILED_BEFORE_MUTATION") {
    return { status: "error", message: "The credit was not applied. Refresh the billing preview before trying again." }
  }
  if (result.status === "VERIFIED" && result.emailIntentId) {
    let delivered = false
    try {
      const delivery = await deliverAdminEmailIntent({ prismaClient: prisma, intentId: result.emailIntentId })
      delivered = delivery.status === "DELIVERED"
    } catch (error) {
      console.error("Admin billing-goodwill notification failed", { code: safeErrorCode(error) })
    }
    const verification = context === "reconcile"
      ? "The invoice credit is verified."
      : result.replayed
        ? "This invoice credit was already verified."
        : "The invoice credit was verified."
    const balance = result.endingCreditCents === null ? "" : ` The resulting Stripe credit is ${formatUsd(result.endingCreditCents)}.`
    return delivered
      ? { status: "success", message: `${verification}${balance} Email notification delivered.` }
      : { status: "warning", message: `${verification}${balance} Check Activity for the recorded notification status.` }
  }
  if (result.status === "VERIFIED") {
    return { status: "warning", message: "The invoice credit was verified, but notification evidence is unavailable. Check Activity before taking another action." }
  }
  return { status: "error", message: "The billing goodwill result could not be confirmed safely." }
}

function revalidateBillingSurfaces(userId: string) {
  revalidatePath(`/admin/users/${encodeURIComponent(userId)}`)
  revalidatePath("/admin/users")
  revalidatePath("/admin")
}

function parseExactUsd(value: string | null) {
  if (!value || !/^(?:0|[1-9]\d{0,2})\.\d{2}$/.test(value)) return null
  const [dollars, cents] = value.split(".")
  const amount = Number(dollars) * 100 + Number(cents)
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 10_000 ? amount : null
}

/** Requires the submitted value to equal the normalized target representation exactly. */
function normalizeExactEmail(value: string | null | undefined) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 && normalized.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null
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

function isSafeIdentifier(value: string) {
  return value.length <= 191 && /^[A-Za-z0-9_-]+$/.test(value)
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}
