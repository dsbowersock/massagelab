import Link from "next/link"
import { hashToken, isTokenUsable } from "@/lib/auth-security"
import { ensureUserRole } from "@/lib/auth-users"
import { prisma } from "@/lib/prisma"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const token = (await searchParams).token ?? ""
  let title = "Verification link required"
  let description = "Open the verification link from your email to activate your account."
  let verified = false

  if (token) {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })

    if (record && isTokenUsable(record)) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: record.userId },
          data: { emailVerified: new Date() },
        }),
        prisma.emailVerificationToken.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        }),
      ])
      await ensureUserRole(record.userId, record.email)
      title = "Email verified"
      description = "Your account is ready. You can sign in now."
      verified = true
    } else {
      title = "Verification failed"
      description = "This verification link is expired or has already been used."
    }
  }

  return (
    <AppPageShell title="Email Verification" width="narrow">
        <AppSurface title={title} description={description}>
            <Button asChild>
              <Link href={verified ? "/login?verified=1&callbackUrl=%2Fonboarding" : "/login"}>Go to login</Link>
            </Button>
        </AppSurface>
    </AppPageShell>
  )
}
