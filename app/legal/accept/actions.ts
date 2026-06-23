"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import {
  acceptedDocumentIdsFromInput,
  legalHeadersMetadata,
  missingRequiredLegalDocuments,
  recordLegalAcceptances,
} from "@/lib/legal-acceptance"
import {
  buildRegistrationLegalAcceptancePath,
  safePostLegalAcceptanceCallback,
} from "@/lib/legal-acceptance-gate"
import { requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
import { prisma } from "@/lib/prisma"

export async function acceptRegistrationLegalDocumentsAction(formData: FormData) {
  const callbackUrl = safePostLegalAcceptanceCallback(formData.get("callbackUrl"))
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(buildRegistrationLegalAcceptancePath(callbackUrl))}`)
  }

  const requiredDocuments = requiredLegalDocumentsForEvent("registration")
  const acceptedDocumentIds = acceptedDocumentIdsFromInput(formData.getAll("acceptedLegalDocuments"))
  const missingLegalDocuments = missingRequiredLegalDocuments({
    acceptedDocumentIds,
    documents: requiredDocuments,
  })

  if (missingLegalDocuments.length > 0) {
    redirect(`${buildRegistrationLegalAcceptancePath(callbackUrl)}&legal=registration-required`)
  }

  const requestHeaders = await headers()

  await recordLegalAcceptances({
    prismaClient: prisma,
    userId: session.user.id,
    documents: requiredDocuments,
    metadata: legalHeadersMetadata(requestHeaders),
  })

  redirect(callbackUrl)
}
