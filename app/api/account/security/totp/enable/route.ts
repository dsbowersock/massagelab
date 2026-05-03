import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  decryptSecret,
  generateBackupCodes,
  hashBackupCode,
  verifyTotpCode,
} from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const code = typeof body.code === "string" ? body.code : ""
  const twoFactorSecret = await prisma.twoFactorSecret.findUnique({
    where: { userId: session.user.id },
  })

  if (!twoFactorSecret) {
    return NextResponse.json({ message: "Start 2FA setup first." }, { status: 400 })
  }

  const secret = decryptSecret(twoFactorSecret.encryptedSecret)
  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ message: "Authenticator code was not accepted." }, { status: 400 })
  }

  const backupCodes = generateBackupCodes()
  await prisma.$transaction([
    prisma.twoFactorSecret.update({
      where: { userId: session.user.id },
      data: { enabledAt: new Date() },
    }),
    prisma.backupCode.deleteMany({
      where: { userId: session.user.id },
    }),
    prisma.backupCode.createMany({
      data: await Promise.all(backupCodes.map(async (backupCode) => ({
        userId: session.user.id,
        codeHash: await hashBackupCode(backupCode),
      }))),
    }),
  ])

  return NextResponse.json({
    message: "Authenticator-app 2FA enabled.",
    backupCodes,
  })
}
