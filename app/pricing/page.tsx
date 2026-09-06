import { randomUUID } from "node:crypto"
import Link from "next/link"
import { HeartHandshake, ShieldCheck, Sparkles } from "lucide-react"
import { getCurrentRscSession as getCurrentSession } from "@/lib/rsc-session"
import { DONATION_OPTIONS } from "@/lib/donations"
import {
  getUserMembershipPricingStatus,
  resolveMembershipPricingMode,
} from "@/lib/membership"
import { getMembershipPricingCatalog } from "@/lib/membership-pricing"
import { prisma } from "@/lib/prisma"
import { MembershipPricingCards } from "@/components/membership/pricing-cards"
import { DonationCheckoutForm } from "@/app/pricing/donation-checkout-form"
import { AppNotice, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { MetalAttentionButton } from "@/components/ui/metal-attention-button"
import { createPublicPageMetadata } from "@/lib/seo"
import { safeErrorCode } from "@/lib/safe-error-code"
import {
  getPublicLaunchControls,
  REGISTRATION_PAUSED_MESSAGE,
} from "@/lib/public-launch-controls"

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
  // Project both independent launch controls through this render: pausing new
  // registration must not close Supporter Checkout for existing accounts.
  const { registrationOpen, supporterCheckoutOpen } = getPublicLaunchControls()
  let membershipStatus: Awaited<ReturnType<typeof getUserMembershipPricingStatus>> | null = null
  let membershipStatusUnavailable = false
  if (session?.user?.id) {
    try {
      membershipStatus = await getUserMembershipPricingStatus(prisma, session.user.id)
    } catch (error) {
      membershipStatusUnavailable = true
      console.error("Unable to load membership pricing status", {
        code: safeErrorCode(error),
      })
    }
  }
  // Unknown authenticated subscription state must never expose new Checkout.
  const pricingMode = membershipStatusUnavailable
    ? "portal"
    : resolveMembershipPricingMode({
        signedIn,
        subscriptions: membershipStatus?.subscriptions ?? [],
      })

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
              {signedIn || registrationOpen ? (
                <MetalAttentionButton asChild variant="attention">
                  <Link href={signedIn ? "/account?tab=membership" : "/register?callbackUrl=%2Fpricing"}>
                    {signedIn ? "Manage membership" : "Create account"}
                  </Link>
                </MetalAttentionButton>
              ) : (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-muted-foreground" role="status">
                  {REGISTRATION_PAUSED_MESSAGE}
                </p>
              )}
              <Button asChild variant="outline">
                <Link href="/roadmap">View roadmap</Link>
              </Button>
        </AppSurface>

        <MembershipPricingCards
          catalog={catalog}
          activeMembershipLevel={membershipStatus?.activeMembershipLevel}
          mode={pricingMode}
          portalActionAvailable={Boolean(membershipStatus?.stripeCustomer)}
          supporterCheckoutOpen={supporterCheckoutOpen}
        />

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
            One-time support does not purchase goods or services, create a membership, or unlock features. It is not a charitable donation and is not tax-deductible.
          </p>
          <DonationCheckoutForm
            options={DONATION_OPTIONS}
            initialAttemptId={randomUUID()}
            returnCode={params?.donation}
          />
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
 * Includes fixed messages for terminal, bounded, unavailable, conflicting,
 * invalid, and provider-ambiguous one-time support outcomes.
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

  if (code === "invalid-request") {
    return {
      tone: "destructive" as const,
      title: "One-time support checkout request invalid",
      description: "Start a new checkout attempt and choose one of the listed amounts.",
    }
  }

  if (code === "rate-limited") {
    return {
      tone: "destructive" as const,
      title: "One-time support checkout temporarily paused",
      description: "Too many checkout attempts were started recently. Please wait a little while and try again.",
    }
  }

  if (code === "unavailable") {
    return {
      tone: "destructive" as const,
      title: "One-time support checkout temporarily unavailable",
      description: "Checkout protection is temporarily unavailable. Your attempt is saved; please try again later.",
    }
  }

  if (code === "conflict") {
    return {
      tone: "destructive" as const,
      title: "One-time support checkout attempt changed",
      description: "That checkout attempt no longer matches this request. Start a new attempt and choose the amount again.",
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
