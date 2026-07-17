import {
  ArrowRight,
  Check,
  CreditCard,
  HeartHandshake,
  Save,
  Settings,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react"

import { AppSurface } from "@/components/ui/app-surface"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import { MetalAttentionButton, MetalAttentionRing } from "@/components/ui/metal-attention-button"
import { MetalRingGallery } from "./metal-ring-gallery"
import { ReviewState, ReviewStateGrid } from "./review-state-grid"

type ButtonVariant = NonNullable<ButtonProps["variant"]>

const variants: Array<{ variant: ButtonVariant; label: string; note: string }> = [
  { variant: "default", label: "Default", note: "Canonical primary action." },
  { variant: "secondary", label: "Secondary", note: "Lower-emphasis physical action." },
  { variant: "cta", label: "CTA", note: "Membership and signup action." },
  { variant: "ctaBlue", label: "CTA blue", note: "Blue/purple high-emphasis alternate." },
  { variant: "attention", label: "Attention", note: "Strategic action face used with the shared ring." },
  { variant: "glow", label: "Glow", note: "Glass/glow action treatment." },
  { variant: "destructive", label: "Destructive", note: "Irreversible or dangerous action." },
  { variant: "outline", label: "Outline", note: "Quiet physical action." },
  { variant: "ghost", label: "Ghost", note: "Utility action without a molded face." },
  { variant: "link", label: "Link", note: "Inline low-emphasis navigation." },
]

export function ButtonGallery() {
  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="button-family-heading">
        <div>
          <h2 id="button-family-heading" className="text-2xl font-semibold">Buttons</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Variants choose intent. Shared Button mechanics continue to own geometry, focus, press motion, disabled behavior, and haptics.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {variants.map((item) => (
            <AppSurface key={item.variant} title={item.label} description={item.note} variant="flat">
              <div className="flex flex-wrap items-center gap-3">
                {item.variant === "attention" ? (
                  <MetalAttentionButton>
                    Attention
                    <Sparkles aria-hidden="true" />
                  </MetalAttentionButton>
                ) : (
                  <Button variant={item.variant}>
                    {item.label}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
                <Button variant={item.variant} disabled>Disabled</Button>
              </div>
            </AppSurface>
          ))}
        </div>
      </section>

      <AppSurface
        title="Interaction state test"
        description="Use a pointer, press and hold, then Tab through these controls. The labels identify the behavior under review without faking browser pseudo-states."
      >
        <ReviewStateGrid>
          <ReviewState label="Base">
            <Button>Base action</Button>
          </ReviewState>
          <ReviewState label="Hover" note="Hover without adding route-owned lift.">
            <Button variant="secondary">Hover me</Button>
          </ReviewState>
          <ReviewState label="Pressed" note="Press and hold to inspect the shared depth response.">
            <Button variant="default">Hold press</Button>
          </ReviewState>
          <ReviewState label="Focus visible" note="Tab here; do not click first.">
            <Button variant="ctaBlue">Keyboard focus</Button>
          </ReviewState>
          <ReviewState label="Disabled">
            <Button disabled>Unavailable</Button>
          </ReviewState>
          <ReviewState label="Compact">
            <Button size="compact" variant="secondary">Compact action</Button>
          </ReviewState>
        </ReviewStateGrid>
      </AppSurface>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppSurface title="Icon and loading buttons" description="Icon treatment and busy content stay inside the shared action geometry.">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="icon" variant="outline" aria-label="Settings">
              <Settings aria-hidden="true" />
            </Button>
            <Button size="icon" variant="destructive" aria-label="Delete">
              <Trash2 aria-hidden="true" />
            </Button>
            <Button disabled aria-busy="true">
              <Loader aria-hidden="true" label="Saving" size={18} color="currentColor" />
              Saving
            </Button>
            <Button variant="ghost" aria-busy="true">
              <Loader aria-hidden="true" label="Loading" size={18} color="currentColor" />
              Quiet loading
            </Button>
          </div>
        </AppSurface>

        <AppSurface title="Reusable semantic tones" description="Setup, Anatomime, and pricing intent are shared options, not route-owned geometry.">
          <div className="flex flex-wrap items-center gap-3">
            <Button tone="setup">Setup action</Button>
            <Button tone="anatomime">
              <HeartHandshake aria-hidden="true" />
              Anatomime action
            </Button>
            <Button variant="glow" tone="pricing" effect="glowFlicker">
              <CreditCard aria-hidden="true" />
              Donation glow flicker
            </Button>
          </div>
        </AppSurface>
      </div>

      <AppSurface
        title="Pricing and account actions"
        description="Representative strategic actions preserve the approved Attention and CTA hierarchy."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <p className="text-sm font-semibold">Membership CTA</p>
            <MetalAttentionButton metalFullWidth>
              <UserPlus aria-hidden="true" />
              Get Started
            </MetalAttentionButton>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-semibold">Account save</p>
            <Button>
              <Save aria-hidden="true" />
              Save profile
            </Button>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-semibold">Project support</p>
            <Button variant="glow" tone="pricing" effect="glowFlicker">
              <CreditCard aria-hidden="true" />
              Donate
            </Button>
          </div>
        </div>
      </AppSurface>

      <AppSurface title="Metal attention effect" description="The ring remains a composable effect around a shared button face.">
        <MetalRingGallery />
        <div className="mt-4">
          <MetalAttentionRing metalMode="always">
            <Button variant="default">
              Always-on protected ring
              <Check aria-hidden="true" />
            </Button>
          </MetalAttentionRing>
        </div>
      </AppSurface>
    </div>
  )
}
