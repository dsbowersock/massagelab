import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { generateBackupCodes, hashBackupCode } from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const twoFactorSecret = await prisma.twoFactorSecret.findUnique({
    where: { userId: session.user.id },
  })

  if (!twoFactorSecret?.enabledAt) {
    return NextResponse.json({ message: "Enable 2FA before generating backup codes." }, { status: 400 })
  }

  const backupCodes = generateBackupCodes()
  await prisma.$transaction([
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
  clearAccountSurfaceDataCache(session.user.id, "security")

  return NextResponse.json({ backupCodes })
}
