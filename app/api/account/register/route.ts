import { NextResponse } from "next/server"
import { hashPassword, generateRandomToken, hashToken, normalizeEmail, tokenExpiresIn, verifyPassword } from "@/lib/auth-security"
import { registrationVerificationResponse } from "@/lib/auth-registration"
import { sendVerificationEmail } from "@/lib/auth-mail"
import { ensureUserRole } from "@/lib/auth-users"
import { assertRateLimit, rateLimitKey, recordFailedAttempt } from "@/lib/auth-rate-limit"
import {
  acceptedDocumentIdsFromInput,
  legalRequestMetadata,
  missingRequiredLegalDocuments,
  recordLegalAcceptances,
} from "@/lib/legal-acceptance"
import { requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const password = typeof body.password === "string" ? body.password : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown"
  const key = rateLimitKey(email, ip)
  const requiredDocuments = requiredLegalDocumentsForEvent("registration")
  const missingLegalDocuments = missingRequiredLegalDocuments({
    acceptedDocumentIds: acceptedDocumentIdsFromInput(body.acceptedLegalDocuments),
    documents: requiredDocuments,
  })

  await assertRateLimit("REGISTER", key)

  if (!email || password.length < 12) {
    await recordFailedAttempt("REGISTER", key)
    return NextResponse.json({ message: "Use a valid email and a password with at least 12 characters." }, { status: 400 })
  }

  if (missingLegalDocuments.length > 0) {
    await recordFailedAttempt("REGISTER", key)
    return NextResponse.json({
      message: `Accept ${missingLegalDocuments.map((document) => document.shortLabel).join(" and ")} before creating an account.`,
    }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { passwordCredential: true },
  })
  if (existingUser) {
    if (!existingUser.emailVerified && existingUser.passwordCredential) {
      const passwordIsValid = await verifyPassword(existingUser.passwordCredential.passwordHash, password)

      if (passwordIsValid) {
        const verificationToken = generateRandomToken()
        const resendRequestedAt = new Date()
        const emailVerificationToken = await prisma.emailVerificationToken.create({
          data: {
            userId: existingUser.id,
            email,
            tokenHash: hashToken(verificationToken),
            expiresAt: tokenExpiresIn(24 * 60),
          },
        })
        const resendResult = registrationVerificationResponse(await sendVerificationEmail(email, verificationToken))

        // Preserve usable links from overlapping resend requests; a successful resend only clears expired tokens.
        if (resendResult.status === 200) {
          await prisma.emailVerificationToken.deleteMany({
            where: {
              userId: existingUser.id,
              consumedAt: null,
              id: { not: emailVerificationToken.id },
              expiresAt: { lt: resendRequestedAt },
            },
          })
        } else {
          await prisma.emailVerificationToken.deleteMany({
            where: {
              id: emailVerificationToken.id,
            },
          })
        }

        return NextResponse.json(resendResult.body, { status: resendResult.status })
      }
    }

    await recordFailedAttempt("REGISTER", key)
    return NextResponse.json(
      { message: "An account already exists for that email. Sign in instead, or use forgot password to set or reset an email password." },
      { status: 409 },
    )
  }

  const verificationToken = generateRandomToken()
  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordCredential: {
        create: {
          passwordHash,
        },
      },
      profile: {
        create: {
          displayName: name,
        },
      },
      emailVerificationTokens: {
        create: {
          email,
          tokenHash: hashToken(verificationToken),
          expiresAt: tokenExpiresIn(24 * 60),
        },
      },
    },
  })

  await ensureUserRole(user.id, user.email)
  await recordLegalAcceptances({
    prismaClient: prisma,
    userId: user.id,
    documents: requiredDocuments,
    metadata: legalRequestMetadata(request),
  })
  const mailResult = await sendVerificationEmail(email, verificationToken)
  const response = registrationVerificationResponse(mailResult)

  return NextResponse.json(response.body, { status: response.status })
}
