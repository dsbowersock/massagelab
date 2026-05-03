import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { getCurrentSession } from "@/auth"
import { encryptSecret, generateTotpSecret } from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await getCurrentSession()

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const setup = generateTotpSecret(session.user.email)
  await prisma.twoFactorSecret.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      encryptedSecret: encryptSecret(setup.secret),
      enabledAt: null,
    },
    update: {
      encryptedSecret: encryptSecret(setup.secret),
      enabledAt: null,
    },
  })

  return NextResponse.json({
    qrCode: await QRCode.toDataURL(setup.otpauthUrl),
    manualCode: setup.secret,
  })
}
