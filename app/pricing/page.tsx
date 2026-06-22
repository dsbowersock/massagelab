import Link from "next/link"
import { ShieldCheck, Sparkles } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { getMembershipPricingCatalog } from "@/lib/membership-pricing"
import { MembershipPricingCards } from "@/components/membership/pricing-cards"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/pricing")

export default async function PricingPage() {
  const [catalog, session] = await Promise.all([
    getMembershipPricingCatalog(),
    getCurrentSession(),
  ])
  const signedIn = Boolean(session?.user?.id)

  return (
    <AppPageShell title="Pricing">
        <AppSurface
          title="Memberships fund the alpha without removing free access"
          description={
            <>
                Basic Chimer and the local-first alpha tools remain available. Paid memberships currently unlock saved custom Chimer colors and help fund careful work toward future account-backed, compliance-ready features.
            </>
          }
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          contentClassName="flex flex-wrap gap-3"
        >
              <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                <Link href={signedIn ? "/account?tab=membership" : "/register"}>
                  {signedIn ? "Manage membership" : "Create account"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/roadmap">View roadmap</Link>
              </Button>
        </AppSurface>

        <MembershipPricingCards catalog={catalog} mode={signedIn ? "checkout" : "auth"} />

        <AppSurface
          title="Clinical data boundary"
          description={
            <>
              Memberships do not change the local-first alpha boundary. Clinical notes, intake forms, journals, movement data, transcripts, and other PHI-bearing workflows are not hosted in this alpha.
            </>
          }
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        />
    </AppPageShell>
  )
}
