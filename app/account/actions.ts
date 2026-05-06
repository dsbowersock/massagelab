"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Prisma, VerificationSourceType, VerificationStatus } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { roleStatusForCredentialStatus, shouldUpdateCredentialRole } from "@/lib/credential-verification-roles"
import { claimVerifiedCredential } from "@/lib/credential-claims"
import { getJurisdictionVerificationPlan } from "@/lib/license-verification"
import {
  OHIO_LICENSE_VERIFIER_NAME,
  ohioExpirationDateToDate,
  verifyOhioMassageLicense,
} from "@/lib/ohio-license-verifier"
import { prisma } from "@/lib/prisma"
import type { AccountRole, CredentialKind } from "@/lib/domain-types"

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

function credentialRole(kind: CredentialKind): AccountRole {
  if (kind === "MASSAGE_LICENSE") return "LICENSED_THERAPIST"
  if (kind === "STUDENT_ENROLLMENT") return "STUDENT"
  if (kind === "INTERSTATE_MASSAGE_COMPACT") return "LICENSED_THERAPIST"
  return "USER"
}

function credentialSource(kind: CredentialKind, jurisdictionCode: string): {
  sourceType: VerificationSourceType
  sourceUrl: string | null
  verificationPayload: Prisma.InputJsonObject & {
    supportStatus: string
    message: string
  }
} {
  if (kind === "MASSAGE_LICENSE") {
    const plan = getJurisdictionVerificationPlan(jurisdictionCode)
    return {
      sourceType: plan.sourceType as VerificationSourceType,
      sourceUrl: plan.sourceUrl,
      verificationPayload: {
        supportStatus: plan.supportStatus,
        message: plan.message,
      },
    }
  }

  if (kind === "STUDENT_ENROLLMENT") {
    return {
      sourceType: "DOCUMENT_REVIEW",
      sourceUrl: null,
      verificationPayload: {
        supportStatus: "MANUAL_REVIEW_REQUIRED",
        message: "Student enrollment needs date-bounded evidence review before verified status is granted.",
      },
    }
  }

  return {
    sourceType: "MANUAL_REVIEW",
    sourceUrl: null,
    verificationPayload: {
      supportStatus: "MANUAL_REVIEW_REQUIRED",
      message: "This credential needs review before verified status is granted.",
    },
  }
}

export async function requestCredentialVerificationAction(formData: FormData) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const rawKind = formString(formData, "credential_kind")
  const kind: CredentialKind = rawKind === "STUDENT_ENROLLMENT" ? "STUDENT_ENROLLMENT" : "MASSAGE_LICENSE"
  const role = credentialRole(kind)
  const jurisdictionCode = formString(formData, "jurisdiction_code").toUpperCase() || null
  const credentialNumber = formString(formData, "credential_number") || null
  const issuingAuthority = formString(formData, "issuing_authority") || null
  const evidenceDescription = formString(formData, "evidence_description") || null
  const legalFirstName = formString(formData, "legal_first_name")
  const legalMiddleName = formString(formData, "legal_middle_name")
  const legalLastName = formString(formData, "legal_last_name")
  const source = credentialSource(kind, jurisdictionCode ?? "")
  const isOhioMassageLicense = kind === "MASSAGE_LICENSE" && jurisdictionCode === "OH"
  const ohioResult = isOhioMassageLicense
    ? await verifyOhioMassageLicense({
        licenseNumber: credentialNumber ?? "",
        legalFirstName,
        legalMiddleName,
        legalLastName,
      })
    : null
  let verificationStatus = (ohioResult?.status ?? "PENDING") as VerificationStatus
  const checkedAt = ohioResult ? new Date(ohioResult.checkedAt) : null
  const expiresAt = ohioExpirationDateToDate(ohioResult?.proof?.expirationDate ?? null)
  const legalNameInput = {
    firstName: legalFirstName || null,
    middleName: legalMiddleName || null,
    lastName: legalLastName || null,
  }
  let verificationPayload: Prisma.InputJsonObject = ohioResult
    ? {
        ...source.verificationPayload,
        verifier: OHIO_LICENSE_VERIFIER_NAME,
        reasonCode: ohioResult.reasonCode,
        checkedAt: ohioResult.checkedAt,
        legalNameInput,
        match: ohioResult.match,
        proof: ohioResult.proof,
      }
    : {
        ...source.verificationPayload,
        legalNameInput,
      }

  const verificationData = {
    kind,
    role,
    status: verificationStatus,
    jurisdictionCode,
    credentialNumber,
    issuingAuthority,
    displayLabel: issuingAuthority || jurisdictionCode || kind,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    evidenceDescription,
    verificationPayload,
    checkedAt,
    verifiedAt: verificationStatus === "VERIFIED" ? checkedAt : null,
    expiresAt,
    rejectedAt: verificationStatus === "REJECTED" ? checkedAt : null,
  }

  const existingVerification =
    jurisdictionCode && credentialNumber
      ? await prisma.credentialVerification.findFirst({
          where: {
            userId: session.user.id,
            kind,
            jurisdictionCode,
            credentialNumber,
          },
        })
      : null

  let verification = existingVerification
    ? await prisma.credentialVerification.update({
        where: { id: existingVerification.id },
        data: verificationData,
      })
    : await prisma.credentialVerification.create({
        data: {
          userId: session.user.id,
          ...verificationData,
        },
      })

  if (verificationStatus === "VERIFIED" && jurisdictionCode && credentialNumber) {
    const credentialClaim = await claimVerifiedCredential({
      prismaClient: prisma,
      userId: session.user.id,
      kind,
      jurisdictionCode,
      credentialNumber,
      credentialVerificationId: verification.id,
      source: OHIO_LICENSE_VERIFIER_NAME,
      expiresAt,
    })

    verificationPayload = {
      ...verificationPayload,
      credentialClaim: {
        claimed: credentialClaim.claimed,
        reasonCode: credentialClaim.reasonCode,
        key: credentialClaim.key,
        existingClaim: credentialClaim.existingClaim,
      },
      reasonCode: credentialClaim.claimed ? ohioResult?.reasonCode ?? "OHIO_VERIFIED" : credentialClaim.reasonCode,
    }

    if (!credentialClaim.claimed) {
      verificationStatus = "PENDING"
    }

    verification = await prisma.credentialVerification.update({
      where: { id: verification.id },
      data: {
        status: verificationStatus,
        verificationPayload,
        verifiedAt: verificationStatus === "VERIFIED" ? checkedAt : null,
      },
    })
  }

  const existingRole = await prisma.userRole.findUnique({
    where: {
      userId_role: {
        userId: session.user.id,
        role,
      },
    },
  })

  const roleStatus = roleStatusForCredentialStatus(verificationStatus) as VerificationStatus
  const roleSource = ohioResult ? "ohio-elicense" : "credential-request"
  const verificationReasonCode =
    typeof verificationPayload.reasonCode === "string" ? verificationPayload.reasonCode : ohioResult?.reasonCode
  const roleMetadata: Prisma.InputJsonObject = ohioResult
    ? {
        credentialVerificationId: verification.id,
        jurisdictionCode,
        verifier: OHIO_LICENSE_VERIFIER_NAME,
        reasonCode: verificationReasonCode ?? ohioResult.reasonCode,
      }
    : {
        credentialVerificationId: verification.id,
      }

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: session.user.id,
        role,
        status: roleStatus,
        source: roleSource,
        metadata: roleMetadata,
        verifiedAt: roleStatus === "VERIFIED" ? checkedAt : null,
        expiresAt: roleStatus === "VERIFIED" ? expiresAt : null,
      },
    })
  } else if (shouldUpdateCredentialRole(existingRole.status, verificationStatus)) {
    await prisma.userRole.update({
      where: {
        userId_role: {
          userId: session.user.id,
          role,
        },
      },
      data: {
        status: roleStatus,
        source: roleSource,
        metadata: roleMetadata,
        verifiedAt: roleStatus === "VERIFIED" ? checkedAt : null,
        expiresAt: roleStatus === "VERIFIED" ? expiresAt : null,
      },
    })
  }

  revalidatePath("/account")
}
