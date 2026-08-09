"use server"

import { revalidatePath } from "next/cache"
import { requireFullAdminUser } from "@/lib/admin/access"
import { retryAdminEmailIntent } from "@/lib/admin/email-intents"
import { prisma } from "@/lib/prisma"

/**
 * Retries one already-failed, non-password account-change notification. The
 * durable service rechecks both the current full-Admin authority and intent
 * eligibility, while this action refreshes only the affected read-only view.
 */
export async function retryFailedEmailIntentAction(userId: string, formData: FormData) {
  const actor = await requireFullAdminUser()
  const intentId = formData.get("intentId")
  const operationId = formData.get("operationId")
  if (typeof intentId !== "string" || !intentId.trim() || intentId.length > 191) {
    throw new Error("Choose a valid failed email notification.")
  }
  if (typeof operationId !== "string" || !isUuid(operationId)) {
    throw new Error("Refresh this account before retrying the notification.")
  }

  await retryAdminEmailIntent({
    prismaClient: prisma,
    actorUserId: actor.id,
    expectedTargetUserId: userId,
    intentId,
    idempotencyKey: operationId,
  })
  revalidatePath(`/admin/users/${encodeURIComponent(userId)}`)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
