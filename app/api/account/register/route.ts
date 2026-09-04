import { after, NextResponse } from "next/server"
import { getAuthSecret } from "@/lib/auth-env"
import { sendExistingAccountRegistrationNotice, sendPasswordSetupEmail, sendVerificationEmail } from "@/lib/auth-mail"
import { consumeEmailWorkRateLimit } from "@/lib/auth-rate-limit"
import { PUBLIC_ACCOUNT_ENTRY_MESSAGE } from "@/lib/auth-entry-messages"
import { authRequestNetworkIdentifier, isPublicAccountEmail } from "@/lib/auth-request"
import { registerPasswordAccount } from "@/lib/auth-registration-service"
import { sendRegistrationVerification } from "@/lib/auth-registration"
import { generateRandomToken, hashPassword, hashToken, normalizeEmail, tokenExpiresIn, verifyPassword } from "@/lib/auth-security"
import { ensureUserRole } from "@/lib/auth-users"
import {
  acceptedDocumentIdsFromInput,
  legalRequestMetadata,
  missingRequiredLegalDocuments,
  recordLegalAcceptances,
} from "@/lib/legal-acceptance"
import { safePostLegalAcceptanceCallback } from "@/lib/legal-acceptance-gate"
import { requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
import { prisma } from "@/lib/prisma"
import {
  getPublicLaunchControls,
  REGISTRATION_PAUSED_MESSAGE,
} from "@/lib/public-launch-controls"

const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later."
export async function POST(request: Request) {
  if (!getPublicLaunchControls().registrationOpen) {
    return NextResponse.json({ message: REGISTRATION_PAUSED_MESSAGE }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const password = typeof body.password === "string" ? body.password : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const callbackUrl = safePostLegalAcceptanceCallback(body.callbackUrl)
  const requiredDocuments = requiredLegalDocumentsForEvent("registration")
  const missingLegalDocuments = missingRequiredLegalDocuments({
    acceptedDocumentIds: acceptedDocumentIdsFromInput(body.acceptedLegalDocuments),
    documents: requiredDocuments,
  })

  // Invalid input is rejected before the service consumes quota or performs
  // expensive work; every valid request enters the same bounded service path.
  if (!isPublicAccountEmail(email) || password.length < 12) {
    return NextResponse.json({ message: "Use a valid email and a password with at least 12 characters." }, { status: 400 })
  }
  if (missingLegalDocuments.length > 0) {
    return NextResponse.json({
      message: `Accept ${missingLegalDocuments.map((document) => document.shortLabel).join(" and ")} before creating an account.`,
    }, { status: 400 })
  }

  const result = await registerPasswordAccount({
    prismaClient: prisma,
    email,
    password,
    name,
    callbackUrl,
    networkIdentifier: authRequestNetworkIdentifier(request),
    secret: getAuthSecret(),
    requiredDocuments,
    legalMetadata: legalRequestMetadata(request),
    consumeRateLimit: consumeEmailWorkRateLimit,
    hashPassword,
    verifyPassword,
    generateToken: generateRandomToken,
    hashToken,
    tokenExpiresAt: tokenExpiresIn,
    ensureUserRole,
    recordLegalAcceptances,
    sendVerification: (recipient, token, safeCallbackUrl) => (
      sendRegistrationVerification(sendVerificationEmail, recipient, token, safeCallbackUrl)
    ),
    sendPasswordSetup: sendPasswordSetupEmail,
    sendExistingAccountNotice: sendExistingAccountRegistrationNotice,
    scheduleAccountWork: (work) => after(work),
  })

  if (result.status === "RATE_LIMITED") {
    return NextResponse.json(
      { message: RATE_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
    )
  }
  return NextResponse.json({ message: PUBLIC_ACCOUNT_ENTRY_MESSAGE }, { status: 202 })
}
