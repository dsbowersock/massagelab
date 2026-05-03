"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function saveProfileAction(formData: FormData) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      displayName: formString(formData, "display_name"),
      therapistName: formString(formData, "therapist_name"),
      therapistLocation: formString(formData, "therapist_location"),
      licenseNumber: formString(formData, "license_number"),
      licenseOrganization: formString(formData, "license_organization"),
      npiNumber: formString(formData, "npi_number"),
    },
    update: {
      displayName: formString(formData, "display_name"),
      therapistName: formString(formData, "therapist_name"),
      therapistLocation: formString(formData, "therapist_location"),
      licenseNumber: formString(formData, "license_number"),
      licenseOrganization: formString(formData, "license_organization"),
      npiNumber: formString(formData, "npi_number"),
    },
  })

  revalidatePath("/account")
}
