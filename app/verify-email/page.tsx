import type { Prisma } from "@prisma/client"
import Link from "next/link"
import { hashToken, isTokenUsable } from "@/lib/auth-security"
import { buildVerificationLoginPath, normalizeEmailVerificationParams } from "@/lib/auth-registration"
import { ensureUserRole } from "@/lib/auth-users"
import { ensureVerifiedUserBackgroundCredits } from "@/lib/commerce/credit-service"
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import { prisma } from "@/lib/prisma"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; callbackUrl?: string | string[] }>
}) {
  const { token, callbackUrl } = normalizeEmailVerificationParams(await searchParams)
  let title = "Verification link required"
  let description = "Open the verification link from your email to activate your account."
  let verified = false

  if (token) {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })

    if (record && isTokenUsable(record)) {
      await runCommerceTransaction(prisma, async (txValue) => {
        const tx = txValue as Prisma.TransactionClient
        await tx.user.update({
          where: { id: record.userId },
          data: { emailVerified: new Date() },
        })
        await tx.emailVerificationToken.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        })
        await ensureUserRole(record.userId, record.email, tx)
      })
      // Keep verification durable: wallet provisioning is best-effort, and the
      // idempotent repair/backfill path reconciles any deferred credits.
      await ensureVerifiedUserBackgroundCredits(prisma, record.userId).catch(() => {
        console.error("Background credit provisioning deferred after email verification.")
      })
      title = "Email verified"
      description = "Your account is ready. You can sign in now."
      verified = true
    } else {
      title = "Verification failed"
      description = "This verification link is expired or has already been used."
    }
  }

  // Preserve the normalized app-local destination while the shared builder
  // applies the verification-state fallback for unsuccessful verification.
  const loginHref = buildVerificationLoginPath(verified, callbackUrl)

  return (
    <AppPageShell title="Email Verification" width="narrow">
        <AppSurface title={title} description={description}>
            <Button asChild>
              <Link href={loginHref}>Go to login</Link>
            </Button>
        </AppSurface>
    </AppPageShell>
  )
}
