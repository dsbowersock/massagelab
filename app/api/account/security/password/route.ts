import type { Prisma } from "@prisma/client"
import { after, NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { hashPassword, verifyPassword } from "@/lib/auth-security"
import { ensureVerifiedUserBackgroundCredits } from "@/lib/commerce/credit-service"
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === "string" ? body.password : ""
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""

  if (password.length < 12) {
    return NextResponse.json({ message: "Use a password with at least 12 characters." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      passwordCredential: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.passwordCredential) {
    const currentPasswordIsValid = await verifyPassword(user.passwordCredential.passwordHash, currentPassword)

    if (!currentPasswordIsValid) {
      return NextResponse.json({ message: "Current password was not accepted." }, { status: 400 })
    }
  }

  const passwordHash = await hashPassword(password)

  await runCommerceTransaction(prisma, async (txValue) => {
    const tx = txValue as Prisma.TransactionClient
    await tx.passwordCredential.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        passwordHash,
      },
      update: {
        passwordHash,
      },
    })

    if (!user.emailVerified) {
      await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      })
    }
  })
  // Keep password changes durable: credit provisioning is best-effort, and the
  // idempotent repair/backfill path reconciles any deferred credits.
  after(() => ensureVerifiedUserBackgroundCredits(prisma, user.id).catch((error) => {
    console.error("Background credit provisioning deferred after a password security update.", error)
  }))
  clearAccountSurfaceDataCache(user.id, "security")

  return NextResponse.json({
    message: user.passwordCredential ? "Password updated." : "Email/password sign-in enabled.",
    hasPasswordCredential: true,
  })
}
