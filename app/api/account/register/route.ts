import { NextResponse } from "next/server"
import { hashPassword, generateRandomToken, hashToken, normalizeEmail, tokenExpiresIn } from "@/lib/auth-security"
import { sendVerificationEmail } from "@/lib/auth-mail"
import { ensureUserRole } from "@/lib/auth-users"
import { assertRateLimit, rateLimitKey, recordFailedAttempt } from "@/lib/auth-rate-limit"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const password = typeof body.password === "string" ? body.password : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown"
  const key = rateLimitKey(email, ip)

  await assertRateLimit("REGISTER", key)

  if (!email || password.length < 12) {
    await recordFailedAttempt("REGISTER", key)
    return NextResponse.json({ message: "Use a valid email and a password with at least 12 characters." }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
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
  const mailResult = await sendVerificationEmail(email, verificationToken)

  return NextResponse.json({
    message: "Check your email to verify your account.",
    devLink: mailResult.devLink,
  })
}
