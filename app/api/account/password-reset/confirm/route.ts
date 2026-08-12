import { NextResponse } from "next/server"
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
  // Capture the authoritative claim time after the deliberately expensive hash
  // so a token that expires during Argon2 cannot be accepted by a stale clock.
  const confirmationNow = new Date()
  const result = await confirmPasswordReset({
    prismaClient: prisma,
    tokenHash,
    passwordHash,
    now: confirmationNow,
  })

  if (result.status === "INVALID") {
    return NextResponse.json({ message: "This reset link is expired or has already been used." }, { status: 400 })
  }

  return NextResponse.json({ message: "Password updated. You can sign in now." })
}
