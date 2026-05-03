import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { SecurityPanel } from "@/app/account/security/security-panel"
import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/ui/page-heading"

export default async function SecurityPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeading>Security</PageHeading>
        <SecurityPanel twoFactorEnabled={session.user.twoFactorEnabled} />
        <Button asChild variant="outline">
          <Link href="/account">Back to account</Link>
        </Button>
      </div>
    </div>
  )
}
