"use server"

import { revalidatePath } from "next/cache"
import { requireFullAdminUser } from "@/lib/admin/access"
import { retryAdminEmailIntent } from "@/lib/admin/email-intents"
import { prisma } from "@/lib/prisma"
import { safeErrorCode } from "@/lib/safe-error-code"

export type RetryEmailActionState =
  | { status: "idle"; message: "" }
  | { status: "success"; message: string }
  | { status: "error"; message: string }

/**
 * Retries one already-failed, non-password account-change notification. The
 * durable service rechecks both the current full-Admin authority and intent
 * eligibility. Expected validation and delivery failures become safe UI state;
 * authorization failures still reject before those outcomes are handled.
 */
export async function retryFailedEmailIntentAction(
  userId: string,
  _previousState: RetryEmailActionState,
  formData: FormData,
): Promise<RetryEmailActionState> {
  const actor = await requireFullAdminUser()
  const intentId = formData.get("intentId")
  const operationId = formData.get("operationId")
  if (typeof intentId !== "string" || !intentId.trim() || intentId.length > 191) {
    return { status: "error", message: "Choose a valid failed email notification." }
  }
  if (typeof operationId !== "string" || !isUuid(operationId)) {
    return { status: "error", message: "Refresh this account before retrying the notification." }
  }

  let result: Awaited<ReturnType<typeof retryAdminEmailIntent>>
  try {
    result = await retryAdminEmailIntent({
      prismaClient: prisma,
      actorUserId: actor.id,
      expectedTargetUserId: userId,
      intentId,
      idempotencyKey: operationId,
    })
  } catch (error) {
    console.error("Admin email retry failed", {
      intentId,
      code: safeErrorCode(error),
    })
    return { status: "error", message: "The email retry could not be completed." }
  }

  revalidatePath(`/admin/users/${encodeURIComponent(userId)}`)
  if (result.status === "DELIVERED") {
    if (!result.attempted) {
      return {
        status: "success",
        message: "The email notification was already delivered; no new send was attempted.",
      }
    }
    return { status: "success", message: "Email notification retried." }
  }
  if (result.status === "FAILED") {
    if (!result.attempted) {
      return {
        status: "error",
        message: "The earlier email delivery attempt failed; no new send was attempted. You can retry again.",
      }
    }
    return { status: "error", message: "The email could not be delivered. You can retry again." }
  }
  return {
    status: "error",
    message: "Email delivery could not be confirmed. Check Activity before retrying.",
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
