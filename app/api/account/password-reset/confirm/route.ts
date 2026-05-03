import { NextResponse } from "next/server"
import { hashPassword, hashToken, isTokenUsable } from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === "string" ? body.token : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!token || password.length < 12) {
    return NextResponse.json({ message: "Use a valid reset link and a password with at least 12 characters." }, { status: 400 })
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  })

  if (!resetToken || !isTokenUsable(resetToken)) {
    return NextResponse.json({ message: "This reset link is expired or has already been used." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  await prisma.$transaction([
    prisma.passwordCredential.upsert({
      where: { userId: resetToken.userId },
      create: {
        userId: resetToken.userId,
        passwordHash,
      },
      update: {
        passwordHash,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { consumedAt: new Date() },
    }),
  ])

  return NextResponse.json({ message: "Password updated. You can sign in now." })
}
