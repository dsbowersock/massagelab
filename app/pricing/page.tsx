import Link from "next/link"
import { ShieldCheck, Sparkles } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { getMembershipPricingCatalog } from "@/lib/membership-pricing"
import { MembershipPricingCards } from "@/components/membership/pricing-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

export default async function PricingPage() {
  const [catalog, session] = await Promise.all([
    getMembershipPricingCatalog(),
    getCurrentSession(),
  ])
  const signedIn = Boolean(session?.user?.id)

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="space-y-5">
          <PageHeading>Pricing</PageHeading>
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-orange" aria-hidden="true" />
                <CardTitle>Memberships fund the alpha without removing free access</CardTitle>
              </div>
              <CardDescription>
                Basic Chimer and the local-first alpha tools remain available. Paid memberships currently unlock saved custom Chimer colors and establish the membership model for future account-backed features.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                <Link href={signedIn ? "/account?tab=membership" : "/register"}>
                  {signedIn ? "Manage membership" : "Create account"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/roadmap">View roadmap</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <MembershipPricingCards catalog={catalog} mode={signedIn ? "checkout" : "auth"} />

        <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-orange" aria-hidden="true" />
              <CardTitle>Clinical data boundary</CardTitle>
            </div>
            <CardDescription>
              Memberships do not change the local-first alpha boundary. Clinical notes, intake forms, journals, movement data, and other PHI-bearing workflows are not hosted in this alpha.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
