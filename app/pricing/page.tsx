import type { CSSProperties } from "react"
import Link from "next/link"
import { HeartHandshake, ShieldCheck, Sparkles } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { DONATION_OPTIONS } from "@/lib/donations"
import { getMembershipPricingCatalog } from "@/lib/membership-pricing"
import { MembershipPricingCards } from "@/components/membership/pricing-cards"
import { AppNotice, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { MetalAttentionButton } from "@/components/ui/metal-attention-button"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/pricing")

type PricingPageProps = {
  searchParams?: Promise<{
    donation?: string
  }>
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const [catalog, session] = await Promise.all([
    getMembershipPricingCatalog(),
    getCurrentSession(),
  ])
  const params = await searchParams
  const oneTimeSupportNotice = pricingOneTimeSupportNotice(params?.donation)
  const signedIn = Boolean(session?.user?.id)

  return (
    <AppPageShell title="Pricing">
        {oneTimeSupportNotice ? (
          <AppNotice
            title={oneTimeSupportNotice.title}
            description={oneTimeSupportNotice.description}
            tone={oneTimeSupportNotice.tone}
          />
        ) : null}

        <AppSurface
          title="Memberships and one-time support fund the alpha without ads"
          description={
            <>
              Basic Chimer and the local-first alpha tools remain available. The Supporter membership unlocks the listed features and helps fund careful work toward account-backed, compliance-ready features.
            </>
          }
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          contentClassName="flex flex-wrap gap-3"
        >
              <MetalAttentionButton asChild variant="attention">
                <Link href={signedIn ? "/account?tab=membership" : "/register?callbackUrl=%2Fpricing"}>
                  {signedIn ? "Manage membership" : "Create account"}
                </Link>
              </MetalAttentionButton>
              <Button asChild variant="outline">
                <Link href="/roadmap">View roadmap</Link>
              </Button>
        </AppSurface>

        <MembershipPricingCards catalog={catalog} mode={signedIn ? "checkout" : "auth"} />

        <AppSurface
          id="one-time-support"
          title="One-time support"
          description={
            <>
              Use this path if you want to support MassageLab without starting a subscription.
            </>
          }
          icon={<HeartHandshake className="h-5 w-5" aria-hidden="true" />}
          contentClassName="gap-4"
        >
          <p className="text-sm text-muted-foreground">
            One-time support does not create a membership or unlock features. It is not a charitable donation and is not tax-deductible.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DONATION_OPTIONS.map((option, index) => (
              <form key={option.amountCents} action="/api/billing/donation" method="post">
                <input type="hidden" name="amountCents" value={option.amountCents} />
                <Button
                  type="submit"
                  variant="glow"
                  tone="pricing"
                  effect="glowFlicker"
                  size="lg"
                  className="h-full w-full"
                  style={{
                    "--ml-neon-flicker-delay": `${index * 0.65}s`,
                  } as CSSProperties}
                  aria-label={`${option.label} ${option.description}`}
                >
                  <span className="text-lg font-semibold">{option.label}</span>
                </Button>
              </form>
            ))}
          </div>
        </AppSurface>

        <AppSurface
          title="How MassageLab is funded"
          description={
            <>
              MassageLab does not sell user data and does not use advertising to fund the project. Memberships and one-time support fund product development, secure infrastructure, compliance review, BAA/vendor work, audit controls, and the operating costs needed before hosted PHI storage can responsibly exist.
            </>
          }
          className={appCalloutClassName}
        />

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

/**
 * Maps one-time support Checkout return codes from the compatibility route to
 * pricing-page notices.
 * Supported codes are `thanks`, `cancelled`, `invalid-amount`, and `checkout-error`.
 */
function pricingOneTimeSupportNotice(code?: string) {
  if (code === "thanks") {
    return {
      tone: "accent" as const,
      title: "One-time support checkout completed",
      description: "Thank you for supporting MassageLab. Stripe will send the payment receipt when available.",
    }
  }

  if (code === "cancelled") {
    return {
      tone: "default" as const,
      title: "One-time support checkout cancelled",
      description: "No one-time support payment was completed.",
    }
  }

  if (code === "invalid-amount") {
    return {
      tone: "destructive" as const,
      title: "One-time support amount unavailable",
      description: "Choose one of the listed one-time support amounts.",
    }
  }

  if (code === "checkout-error") {
    return {
      tone: "destructive" as const,
      title: "One-time support checkout unavailable",
      description: "We could not open one-time support checkout right now. Please try again or contact support if this continues.",
    }
  }

  return null
}
