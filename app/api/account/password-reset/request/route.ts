import { NextResponse } from "next/server"
import { generateRandomToken, hashToken, normalizeEmail, tokenExpiresIn } from "@/lib/auth-security"
import { sendPasswordResetEmail } from "@/lib/auth-mail"
import { assertRateLimit, rateLimitKey, recordFailedAttempt } from "@/lib/auth-rate-limit"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown"
  const key = rateLimitKey(email, ip)

  await assertRateLimit("PASSWORD_RESET", key)

  if (!email) {
    await recordFailedAttempt("PASSWORD_RESET", key)
    return NextResponse.json({ message: "If that email is registered, a reset link has been sent." })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (user?.emailVerified) {
    const resetToken = generateRandomToken()
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(resetToken),
        expiresAt: tokenExpiresIn(60),
      },
    })
    const mailResult = await sendPasswordResetEmail(email, resetToken)

    return NextResponse.json({
      message: "If that email is registered, a reset link has been sent.",
      devLink: mailResult.devLink,
    })
  }

  return NextResponse.json({ message: "If that email is registered, a reset link has been sent." })
}
