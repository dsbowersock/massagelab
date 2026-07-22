"use server"

import { revalidatePath } from "next/cache"
import { requireCommerceAdminUser } from "../../../lib/commerce/admin-access.ts"
import {
  prepareCommerceAdminRefund,
  reconcileCommerceAdminIssue,
  type CommerceAdminReconciliationRequest,
} from "../../../lib/commerce/admin-service.ts"
import { prisma } from "../../../lib/prisma.ts"

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim().slice(0, 128) : ""
}

export async function refundCommerceOrderItemsAction(formData: FormData) {
  const admin = await requireCommerceAdminUser()
  const orderId = formString(formData, "orderId")
  const reasonCode = formString(formData, "reasonCode")
  const orderItemIds = formData.getAll("orderItemId")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
  await prepareCommerceAdminRefund({
    prismaClient: prisma,
    adminUser: admin,
    orderId,
    orderItemIds,
    reasonCode,
  })
  revalidatePath("/admin")
  revalidatePath("/admin/commerce")
  revalidatePath(`/admin/commerce/${orderId}`)
}

export async function reconcileCommerceOrderIssueAction(formData: FormData) {
  await requireCommerceAdminUser()
  const issue: CommerceAdminReconciliationRequest = {
    code: formString(formData, "code"),
    orderId: formString(formData, "orderId"),
    ...(formString(formData, "paymentId") ? { paymentId: formString(formData, "paymentId") } : {}),
    ...(formString(formData, "refundId") ? { refundId: formString(formData, "refundId") } : {}),
    ...(formString(formData, "disputeId") ? { disputeId: formString(formData, "disputeId") } : {}),
    ...(formString(formData, "ownershipId") ? { ownershipId: formString(formData, "ownershipId") } : {}),
  }
  await reconcileCommerceAdminIssue({ prismaClient: prisma, issue })
  revalidatePath("/admin")
  revalidatePath("/admin/commerce")
  revalidatePath(`/admin/commerce/${issue.orderId}`)
}
