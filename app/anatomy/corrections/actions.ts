"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function createCorrectionFlagAction(formData: FormData) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const message = formString(formData, "message")

  if (!message) {
    return
  }

  await prisma.anatomyCorrectionFlag.create({
    data: {
      termId: formString(formData, "term_id") || null,
      issueType: formString(formData, "issue_type") || "content",
      message,
      createdById: session.user.id,
    },
  })

  revalidatePath("/anatomy/corrections")
}
