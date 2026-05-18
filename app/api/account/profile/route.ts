import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { buildTherapistProfilePayload } from "@/lib/account-preferences"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({
    displayName: profile?.displayName ?? "",
    therapistName: profile?.therapistName ?? "",
    therapistLocation: profile?.therapistLocation ?? "",
    licenseNumber: profile?.licenseNumber ?? "",
    licenseOrganization: profile?.licenseOrganization ?? "",
    npiNumber: profile?.npiNumber ?? "",
    updatedAt: profile?.updatedAt ?? null,
  })
}

export async function PUT(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const therapistProfile = buildTherapistProfilePayload(body.therapistSettings ?? body)
  const profile = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      displayName: typeof body.displayName === "string" ? body.displayName.trim() : undefined,
      therapistName: therapistProfile.therapist_name,
      therapistLocation: therapistProfile.therapist_location,
      licenseNumber: therapistProfile.license_number,
      licenseOrganization: therapistProfile.license_organization,
      npiNumber: therapistProfile.npi_number,
    },
    update: {
      displayName: typeof body.displayName === "string" ? body.displayName.trim() : undefined,
      therapistName: therapistProfile.therapist_name,
      therapistLocation: therapistProfile.therapist_location,
      licenseNumber: therapistProfile.license_number,
      licenseOrganization: therapistProfile.license_organization,
      npiNumber: therapistProfile.npi_number,
    },
  })
  clearAccountSurfaceDataCache(session.user.id, "profile")

  return NextResponse.json({
    displayName: profile.displayName ?? "",
    therapistName: profile.therapistName ?? "",
    therapistLocation: profile.therapistLocation ?? "",
    licenseNumber: profile.licenseNumber ?? "",
    licenseOrganization: profile.licenseOrganization ?? "",
    npiNumber: profile.npiNumber ?? "",
    updatedAt: profile.updatedAt,
  })
}
