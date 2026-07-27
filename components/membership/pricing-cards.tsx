import Link from "next/link"
import { BadgeDollarSign, CheckCircle2, Palette, ShieldCheck } from "lucide-react"
import { appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetalAttentionButton } from "@/components/ui/metal-attention-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  MembershipPriceCatalog,
  MembershipPriceValue as MembershipPrice,
} from "@/lib/account-surface-data"
import { BILLING_PORTAL_DESTINATIONS } from "@/lib/billing-portal-destinations"
import { getLegalDocumentByKey, legalDocumentAcceptanceId } from "@/lib/legal-documents"
import { resolveMembershipPriceForInterval } from "@/lib/membership-pricing"
import { cn } from "@/lib/utils"

type MembershipPlan = {
  membershipLevel: string
  name: string
  eyebrow: string
  description: string
  currentFeatures: string[]
  roadmapNotes: string[]
  amountChoices: Array<{
    id: string
    monthAmountCents: number
    yearAmountCents: number
    prices: MembershipPriceCatalog
  }>
}

type ResolvedAmountChoice = {
  choiceId: string
  price: MembershipPrice
}

type MembershipPricingCatalog = {
  defaultInterval: string
  intervals: ReadonlyArray<{
    id: string
    label: string
    nudge: string
  }>
  plans: MembershipPlan[]
}

type MembershipPricingCardsProps = {
  catalog: MembershipPricingCatalog
  activeMembershipLevel?: string | null
  mode: "checkout" | "auth" | "portal"
  portalActionAvailable?: boolean
  className?: string
}

export function MembershipPricingCards({
  catalog,
  activeMembershipLevel = null,
  mode,
  portalActionAvailable = true,
  className,
}: MembershipPricingCardsProps) {
  return (
    <section className={cn("space-y-4", className)} aria-labelledby="membership-pricing-heading">
      <div className={cn(appCalloutClassName, "flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-start")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand-orange/35 bg-background/50">
          <BadgeDollarSign className="h-5 w-5 text-brand-orange" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 id="membership-pricing-heading" className="text-base font-semibold text-foreground">
            Membership pricing
          </h2>
          <p className="text-sm text-muted-foreground">
            Current benefits are available now. Roadmap items are funding goals and are not active subscription features yet.
          </p>
        </div>
      </div>

      <Tabs defaultValue={catalog.defaultInterval} className="space-y-4">
        <TabsList className="ml-pricing-interval-tabs grid h-auto w-full grid-cols-2 gap-1 rounded-md border border-border/80 bg-background/80 p-1 sm:w-[26rem]">
          {catalog.intervals.map((interval) => (
            <TabsTrigger
              key={interval.id}
              value={interval.id}
              className="ml-pricing-interval-trigger flex h-auto flex-col items-center gap-0.5 whitespace-normal px-3 py-2 text-center"
            >
              <span>{interval.label}</span>
              <span className="text-[0.68rem] font-normal text-muted-foreground">{interval.nudge}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {catalog.intervals.map((interval) => (
          <TabsContent key={interval.id} value={interval.id} className="mt-0">
            <div className="grid gap-4">
              {catalog.plans.map((plan) => (
                <PlanCard
                  key={`${plan.membershipLevel}-${interval.id}`}
                  plan={plan}
                  interval={interval.id}
                  active={activeMembershipLevel === plan.membershipLevel}
                  mode={mode}
                  portalActionAvailable={portalActionAvailable}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}

function PlanCard({
  plan,
  interval,
  active,
  mode,
  portalActionAvailable,
}: {
  plan: MembershipPlan
  interval: string
  active: boolean
  mode: "checkout" | "auth" | "portal"
  portalActionAvailable: boolean
}) {
  const resolvedAmountChoices = plan.amountChoices.flatMap((choice) => {
    const price = resolveMembershipPriceForInterval(choice, interval)

    return price
      ? [{ choiceId: choice.id, price }]
      : []
  })
  // isConfigured means an environment catalog slot contains a Price ID;
  // isLookupAvailable means Stripe retrieval also verified its amount. Only
  // lookup-available choices may be advertised before authentication or as
  // Portal switching targets. Checkout still renders configured lookup
  // failures so the user sees the choice disabled instead of silently missing.
  const availableAmountChoices = resolvedAmountChoices.filter(
    ({ price }) => price.isLookupAvailable,
  )

  return (
    <Card className={cn(
      appSurfaceClassName,
      "flex h-full flex-col",
      active && "border-brand-orange/60",
    )}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className="border-border/80 text-muted-foreground">
            {plan.eyebrow}
          </Badge>
          {mode === "portal" && active ? (
            <Badge className="bg-primary text-primary-foreground">Current member</Badge>
          ) : mode === "portal" ? (
            <Badge variant="outline">Manage in portal</Badge>
          ) : active ? (
            <Badge className="bg-primary text-primary-foreground">Current plan</Badge>
          ) : null}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl">{plan.name}</CardTitle>
          <CardDescription>{plan.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="space-y-3 text-sm">
          <FeatureGroup
            icon="current"
            label="Current"
            items={plan.currentFeatures}
          />
          <FeatureGroup
            icon="roadmap"
            label="Roadmap"
            items={plan.roadmapNotes}
          />
        </div>
        {/* Existing members keep Portal access even when public pricing is unavailable. */}
        <PlanActions
          plan={plan}
          mode={mode}
          portalActionAvailable={portalActionAvailable}
          resolvedAmountChoices={resolvedAmountChoices}
          availableAmountChoices={availableAmountChoices}
        />
      </CardContent>
    </Card>
  )
}

/**
 * Renders the mode-specific membership actions. Portal is wholly gated by
 * `portalActionAvailable` and pairs lookup-verified amount tiles with the
 * Portal form; auth shows only lookup-verified choices; checkout shows every
 * resolved choice and lets the downstream amount action disable unavailable
 * choices.
 */
function PlanActions({
  plan,
  mode,
  portalActionAvailable,
  resolvedAmountChoices,
  availableAmountChoices,
}: {
  plan: MembershipPlan
  mode: "checkout" | "auth" | "portal"
  portalActionAvailable: boolean
  resolvedAmountChoices: ResolvedAmountChoice[]
  availableAmountChoices: ResolvedAmountChoice[]
}) {
  if (mode === "portal") {
    return portalActionAvailable ? (
      <div className="mt-auto space-y-3">
        {availableAmountChoices.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {availableAmountChoices.map(({ choiceId, price }) => (
              <div
                key={choiceId}
                data-membership-portal-amount-choice={choiceId}
                className="rounded-md border border-border/80 bg-background/70 p-3 text-center"
              >
                <span className="inline-flex items-baseline justify-center gap-1">
                  <span className="text-base font-semibold text-foreground">{price.displayPrice}</span>
                  <span className="text-xs text-muted-foreground">{price.displayInterval}</span>
                </span>
                <YearlySavings price={price} />
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Change your support amount or billing period directly. Use your billing account for payment methods, billing address, invoices, or cancellation.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <form action="/api/billing/portal" method="post">
            <input
              type="hidden"
              name="destination"
              value={BILLING_PORTAL_DESTINATIONS.SUBSCRIPTION_UPDATE}
            />
            <MetalAttentionButton
              type="submit"
              variant="attention"
              className="w-full"
              metalFullWidth
            >
              Change support amount or billing period
            </MetalAttentionButton>
          </form>
          <form action="/api/billing/portal" method="post">
            <input
              type="hidden"
              name="destination"
              value={BILLING_PORTAL_DESTINATIONS.MANAGE}
            />
            <Button type="submit" variant="outline" className="w-full">
              Manage billing account
            </Button>
          </form>
        </div>
      </div>
    ) : (
      <p className="mt-auto text-sm text-muted-foreground">
        Billing management is temporarily unavailable. Contact support if you need help with an existing membership.
      </p>
    )
  }

  // The Portal branch exits above, so child actions receive only their narrow
  // public action contract at both the filtering and rendering boundaries.
  const actionMode: "checkout" | "auth" = mode
  const displayedAmountChoices = actionMode === "auth"
    ? availableAmountChoices
    : resolvedAmountChoices

  return displayedAmountChoices.length === 0 ? (
    <p className="mt-auto text-sm text-muted-foreground">
      Membership pricing is temporarily unavailable. Please try again later.
    </p>
  ) : (
    <div className="mt-auto grid gap-3 sm:grid-cols-3">
      {displayedAmountChoices.map(({ choiceId, price }) => (
        <SupporterAmountChoice
          key={choiceId}
          plan={plan}
          choiceId={choiceId}
          price={price}
          mode={actionMode}
        />
      ))}
    </div>
  )
}

/** Displays the catalog-authored annual comparison wherever a yearly price appears. */
function YearlySavings({ price }: { price: MembershipPrice }) {
  return price.yearlySavings ? (
    <span className="block text-xs text-muted-foreground">
      {price.yearlySavings.description}
    </span>
  ) : null
}

function FeatureGroup({
  icon,
  label,
  items,
}: {
  icon: "current" | "roadmap"
  label: string
  items: string[]
}) {
  const Icon = icon === "current" ? CheckCircle2 : ShieldCheck

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-brand-orange" aria-hidden="true" />
        {label}
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-muted-foreground">
            <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Renders one public Supporter amount action. Auth mode receives only
 * lookup-available Prices and links to sign-in. Checkout distinguishes missing
 * catalog configuration from a configured Price whose Stripe lookup failed,
 * rendering the latter choice but disabling its submission. Portal mode is
 * handled by PlanCard and never reaches this component.
 */
function SupporterAmountChoice({
  plan,
  choiceId,
  price,
  mode,
}: {
  plan: MembershipPlan
  choiceId: string
  price: MembershipPrice
  mode: "checkout" | "auth"
}) {
  if (mode === "auth") {
    const callbackParams = new URLSearchParams({
      supporterAmountChoiceId: choiceId,
      interval: price.interval,
    })
    const callbackUrl = `/pricing?${callbackParams.toString()}`

    return (
      <MetalAttentionButton asChild variant="attention" className="w-full" metalFullWidth>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          data-membership-auth-amount-choice={choiceId}
        >
          <span>
            Choose {price.displayPrice}
            <YearlySavings price={price} />
          </span>
        </Link>
      </MetalAttentionButton>
    )
  }

  // No configured Price ID means there is no safe Checkout payload to render.
  if (!price.isConfigured) {
    return (
      <Button
        disabled
        data-membership-checkout-amount-choice={choiceId}
        className="w-full"
      >
        Pricing temporarily unavailable
      </Button>
    )
  }

  const billingTerms = getLegalDocumentByKey("membership-billing-refunds")
  const billingTermsId = legalDocumentAcceptanceId(billingTerms)

  return (
    <form
      action="/api/billing/checkout"
      method="post"
      data-membership-checkout-amount-choice={choiceId}
      className="space-y-3"
    >
      <input type="hidden" name="membershipLevel" value={plan.membershipLevel} />
      <input type="hidden" name="supporterAmountChoiceId" value={choiceId} />
      <input type="hidden" name="interval" value={price.interval} />
      <input type="hidden" name="acceptedLegalDocuments" value={billingTermsId} />
      <label className="flex gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-xs text-muted-foreground">
        <input type="checkbox" name="billingTermsAccepted" value="true" className="mt-1" required />
        <span>
          I agree to the{" "}
          <Link href={billingTerms.route} className="text-brand-orange underline-offset-4 hover:underline">
            {billingTerms.label}
          </Link>
          .
        </span>
      </label>
      <MetalAttentionButton
        type="submit"
        variant="attention"
        className="w-full"
        metalFullWidth
        // A configured ID remains non-actionable until Stripe verifies its amount.
        disabled={!price.isLookupAvailable}
      >
        <span>
          Support with {price.displayPrice}
          <YearlySavings price={price} />
        </span>
      </MetalAttentionButton>
    </form>
  )
}
