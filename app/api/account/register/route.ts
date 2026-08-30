import { after, NextResponse } from "next/server"
import { getAuthSecret } from "@/lib/auth-env"
import { sendAccountChangeEmail, sendPasswordSetupEmail, sendVerificationEmail } from "@/lib/auth-mail"
import { consumeEmailWorkRateLimit } from "@/lib/auth-rate-limit"
import {
  PUBLIC_ACCOUNT_ENTRY_MESSAGE,
  registerPasswordAccount,
} from "@/lib/auth-registration-service"
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
const EXISTING_ACCOUNT_NOTICE_SUBJECT = "MassageLab account sign-in request"
const EXISTING_ACCOUNT_NOTICE_MESSAGE =
  "A password registration request was received for this MassageLab account. Sign in with your existing password, or use account recovery if you need to reset it. If you did not make this request, no action is needed."

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
  if (!validPublicEmail(email) || password.length < 12) {
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
    networkIdentifier: requestIp(request),
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
    sendExistingAccountNotice: (recipient) => sendAccountChangeEmail(
      recipient,
      EXISTING_ACCOUNT_NOTICE_SUBJECT,
      EXISTING_ACCOUNT_NOTICE_MESSAGE,
    ),
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

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
}

function validPublicEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
