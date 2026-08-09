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
  if (typeof intentId !== "string" || !intentId.trim() || intentId.length > 191) {
    throw new Error("Choose a valid failed email notification.")
  }

  await retryAdminEmailIntent({
    prismaClient: prisma,
    actorUserId: actor.id,
    intentId,
    idempotencyKey: crypto.randomUUID(),
  })
  revalidatePath(`/admin/users/${encodeURIComponent(userId)}`)
}
