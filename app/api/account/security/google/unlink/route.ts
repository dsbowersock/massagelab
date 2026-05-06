import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { canUnlinkOAuthAccount } from "@/lib/auth-account-linking"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      accounts: {
        where: { provider: "google" },
      },
      passwordCredential: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.accounts.length === 0) {
    return NextResponse.json({ message: "Google is not linked to this account.", googleLinked: false }, { status: 404 })
  }

  const canUnlink = canUnlinkOAuthAccount({
    provider: "google",
    hasPasswordCredential: Boolean(user.passwordCredential),
    emailVerified: Boolean(user.emailVerified),
  })

  if (!canUnlink) {
    return NextResponse.json(
      { message: "Set an email/password login before unlinking Google so you do not lose account access." },
      { status: 400 },
    )
  }

  await prisma.account.deleteMany({
    where: {
      userId: user.id,
      provider: "google",
    },
  })

  return NextResponse.json({ message: "Google sign-in unlinked.", googleLinked: false })
}
