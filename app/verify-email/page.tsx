import Link from "next/link"
import { hashToken, isTokenUsable } from "@/lib/auth-security"
import { ensureUserRole } from "@/lib/auth-users"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

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
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeading>Email Verification</PageHeading>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
              <Link href={verified ? "/login?verified=1" : "/login"}>Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
