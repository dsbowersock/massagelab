import { after, NextResponse } from "next/server"
import { deliverAccountSecurityEmailIntent } from "@/lib/account-security-email-intents"
import { hashPassword, hashToken } from "@/lib/auth-security"
import {
  confirmPasswordReset,
  isPasswordResetTokenEligible,
} from "@/lib/password-reset-confirmation"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === "string" ? body.token : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!token || password.length < 12) {
    return NextResponse.json({ message: "Use a valid reset link and a password with at least 12 characters." }, { status: 400 })
  }

  const tokenHash = hashToken(token)
  const eligibilityNow = new Date()
  // This read only avoids unnecessary Argon2 work; confirmPasswordReset's
  // transactional compare-and-set remains the authority on token consumption.
  const eligible = await isPasswordResetTokenEligible({
    prismaClient: prisma,
    tokenHash,
    now: eligibilityNow,
  })
  if (!eligible) {
    return NextResponse.json({ message: "This reset link is expired or has already been used." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  // The service captures authoritative time inside every transaction attempt,
  // including retries after the deliberately expensive hash.
  const result = await confirmPasswordReset({
    prismaClient: prisma,
    tokenHash,
    passwordHash,
  })

  if (result.status === "INVALID") {
    return NextResponse.json({ message: "This reset link is expired or has already been used." }, { status: 400 })
  }

  // The transaction has committed before this delivery is scheduled, so a
  // transport failure cannot roll back password recovery or token consumption.
  after(() => deliverAccountSecurityEmailIntent({
    prismaClient: prisma,
    intentId: result.emailIntentId,
  }))

  return NextResponse.json({ message: "Password updated. You can sign in now." })
}
