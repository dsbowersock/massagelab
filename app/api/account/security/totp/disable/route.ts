import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.$transaction([
    prisma.twoFactorSecret.deleteMany({
      where: { userId: session.user.id },
    }),
    prisma.backupCode.deleteMany({
      where: { userId: session.user.id },
    }),
  ])
  clearAccountSurfaceDataCache(session.user.id, "security")

  return NextResponse.json({ message: "2FA disabled." })
}
