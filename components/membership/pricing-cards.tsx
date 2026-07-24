import Link from "next/link"
import { BadgeDollarSign, CheckCircle2, Palette, ShieldCheck } from "lucide-react"
import { appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetalAttentionButton } from "@/components/ui/metal-attention-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLegalDocumentByKey, legalDocumentAcceptanceId } from "@/lib/legal-documents"
import { cn } from "@/lib/utils"

type MembershipPrice = {
  membershipLevel: string
  interval: string
  priceId: string | null
  displayPrice: string
  displayInterval: string
  isConfigured: boolean
  isLookupAvailable: boolean
  yearlySavings: {
    displayAmount: string
    description: string
    percent: number
  } | null
}

type MembershipPlan = {
  membershipLevel: string
  name: string
  eyebrow: string
  description: string
  currentFeatures: string[]
  roadmapNotes: string[]
  amountChoices: Array<{
    id: string
    month: number
    year: number
    prices: Record<string, MembershipPrice>
  }>
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
  mode: "checkout" | "auth"
  className?: string
}

export function MembershipPricingCards({
  catalog,
  activeMembershipLevel = null,
  mode,
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
}: {
  plan: MembershipPlan
  interval: string
  active: boolean
  mode: "checkout" | "auth"
}) {
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
          {active ? (
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
        <div className="mt-auto grid gap-3 sm:grid-cols-3">
          {plan.amountChoices.map((choice) => (
            <SupporterAmountChoice
              key={choice.id}
              plan={plan}
              choiceId={choice.id}
              price={choice.prices[interval] ?? choice.prices.year ?? choice.prices.month}
              mode={mode}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
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
    return (
      <MetalAttentionButton asChild variant="attention" className="w-full" metalFullWidth>
        <Link href="/login?callbackUrl=%2Fpricing">Choose {price.displayPrice}</Link>
      </MetalAttentionButton>
    )
  }

  if (!price.isConfigured) {
    return (
      <Button disabled className="w-full">
        Pricing temporarily unavailable
      </Button>
    )
  }

  const billingTerms = getLegalDocumentByKey("membership-billing-refunds")
  const billingTermsId = legalDocumentAcceptanceId(billingTerms)

  return (
    <form action="/api/billing/checkout" method="post" className="space-y-3">
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
        disabled={!price.isLookupAvailable}
      >
        Support with {price.displayPrice}
      </MetalAttentionButton>
    </form>
  )
}
