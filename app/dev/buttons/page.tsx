import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRight,
  BookOpen,
  Check,
  CreditCard,
  HeartHandshake,
  Save,
  Settings,
  Sparkles,
  Timer,
  UserPlus,
} from "lucide-react"

import "@/app/anatomime/styles.css"
import { CTAButton } from "@/components/chimer-controls/CTAButton"
import { GlowButton } from "@/components/chimer-controls/GlowButton"
import { TactileButton } from "@/components/chimer-controls/TactileButton"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button, type ButtonProps } from "@/components/ui/button"
import { MetalAttentionButton, MetalAttentionRing } from "@/components/ui/metal-attention-button"
import { MetalRingGallery } from "./metal-ring-gallery"
import { SliderGallery } from "./slider-gallery"
import { ToggleGallery } from "./toggle-gallery"
import { RouteControlGallery } from "./route-control-gallery"

export const metadata = {
  title: "Button Gallery",
  robots: {
    index: false,
    follow: false,
  },
}

type ButtonVariant = NonNullable<ButtonProps["variant"]>

const sharedVariants: Array<{
  variant: ButtonVariant
  label: string
  note: string
}> = [
  { variant: "default", label: "Default", note: "Canonical primary sunset physical button." },
  { variant: "secondary", label: "Secondary", note: "Less-emphatic sunset physical action." },
  { variant: "cta", label: "CTA", note: "Primary signup or account action." },
  { variant: "ctaBlue", label: "CTA Blue", note: "Blue/purple high-emphasis alternate." },
  { variant: "attention", label: "Attention", note: "Always-visible random play/pause metal-ring action." },
  { variant: "glow", label: "Glow", note: "Glass/glow visual action." },
  { variant: "outline", label: "Outline", note: "Blue/purple quiet physical action." },
  { variant: "destructive", label: "Destructive", note: "Red danger physical action." },
  { variant: "ghost", label: "Ghost", note: "Quiet utility action without a physical button face." },
  { variant: "link", label: "Link", note: "Inline text action for low-emphasis navigation." },
]

const shortcutExamples = [
  {
    title: "Study anatomy",
    description: "Open massage anatomy flashcards, try public prompts, and save mastery once signed in.",
    icon: BookOpen,
  },
  {
    title: "Run a session",
    description: "Open a practical massage session timer without account setup.",
    icon: Timer,
  },
  {
    title: "Support the roadmap",
    description: "Review membership and project-support options before broader rollout.",
    icon: HeartHandshake,
  },
]

const rolloutExamples: Array<{
  title: string
  description: string
  label: string
  variant: ButtonVariant
  className?: string
  icon: typeof ArrowRight
}> = [
  {
    title: "Auth submit",
    description: "Login, register, reset password, and verify email primary form actions.",
    label: "Continue",
    variant: "default",
    className: "w-full",
    icon: ArrowRight,
  },
  {
    title: "Account save",
    description: "Account profile saves, setup starts, and support form submit actions.",
    label: "Save profile",
    variant: "default",
    icon: Save,
  },
  {
    title: "Pricing account CTA",
    description: "Primary pricing-page account and membership-management actions.",
    label: "Open your account",
    variant: "cta",
    icon: ArrowRight,
  },
  {
    title: "Membership card CTA",
    description: "Plan-card account creation before checkout is available.",
    label: "Create account",
    variant: "ctaBlue",
    className: "w-full",
    icon: UserPlus,
  },
  {
    title: "About navigation",
    description: "About and creator-page navigation that should stay quieter than signup CTAs.",
    label: "Meet Derrick",
    variant: "secondary",
    icon: ArrowRight,
  },
  {
    title: "Roadmap support",
    description: "Donation and project-support actions that should read as high emphasis.",
    label: "Donate with Stripe",
    variant: "cta",
    icon: CreditCard,
  },
]

export default function ButtonGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <AppPageShell width="wide" contentClassName="gap-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Local development</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Button gallery</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Compare the current shared button variants, Chimer compatibility wrappers, sizes, disabled states, and the homepage shortcut pattern.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="shared-button-heading">
        <div>
          <h2 id="shared-button-heading" className="text-2xl font-semibold">Shared variants</h2>
          <p className="mt-1 text-sm text-muted-foreground">These are the variants available through `components/ui/button`.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sharedVariants.map((item) => (
            <AppSurface key={item.variant} title={item.label} description={item.note}>
              <div className="flex flex-wrap items-center gap-3">
                {item.variant === "attention" ? (
                  <MetalAttentionButton>
                    {item.label}
                    <Sparkles aria-hidden="true" />
                  </MetalAttentionButton>
                ) : (
                  <Button variant={item.variant}>
                    {item.label}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
                {item.variant === "attention" ? (
                  <MetalAttentionButton disabled>
                    Disabled
                  </MetalAttentionButton>
                ) : (
                  <Button variant={item.variant} disabled>
                    Disabled
                  </Button>
                )}
              </div>
            </AppSurface>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="rollout-examples-heading">
        <div>
          <h2 id="rollout-examples-heading" className="text-2xl font-semibold">Current rollout examples</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These match the public, auth, pricing, membership, about, roadmap, support, and account surfaces touched in this batch.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rolloutExamples.map((item) => {
            const Icon = item.icon
            return (
              <AppSurface key={item.title} title={item.title} description={item.description}>
                <Button variant={item.variant} className={item.className}>
                  {item.label}
                  <Icon aria-hidden="true" />
                </Button>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="metal-ring-heading">
        <div>
          <h2 id="metal-ring-heading" className="text-2xl font-semibold">Metal ring component</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use the standalone wrapper when a specific button needs extra attention.</p>
        </div>
        <AppSurface>
          <MetalRingGallery />
        </AppSurface>
      </section>

      <section className="space-y-4" aria-labelledby="chimer-wrapper-heading">
        <div>
          <h2 id="chimer-wrapper-heading" className="text-2xl font-semibold">Chimer wrappers</h2>
          <p className="mt-1 text-sm text-muted-foreground">Compatibility wrappers now render the same shared button variants used sitewide.</p>
        </div>
        <AppSurface>
          <div className="flex flex-wrap items-center gap-3">
            <TactileButton>Chimer tactile</TactileButton>
            <CTAButton>Chimer CTA</CTAButton>
            <GlowButton>Chimer glow</GlowButton>
          </div>
        </AppSurface>
      </section>

      <section className="space-y-4" aria-labelledby="sizes-heading">
        <div>
          <h2 id="sizes-heading" className="text-2xl font-semibold">Sizes and icon use</h2>
          <p className="mt-1 text-sm text-muted-foreground">This shows how the physical variants behave at common button sizes.</p>
        </div>
        <AppSurface>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm">
              Small
            </Button>
            <Button variant="secondary">Default</Button>
            <Button variant="cta" size="lg">
              Large CTA
              <ArrowRight aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Settings example">
              <Settings aria-hidden="true" />
            </Button>
          </div>
        </AppSurface>
      </section>

      <SliderGallery />

      <ToggleGallery />

      <RouteControlGallery />

      <section className="space-y-4" aria-labelledby="shortcut-heading">
        <div>
          <h2 id="shortcut-heading" className="text-2xl font-semibold">Homepage shortcut pattern</h2>
          <p className="mt-1 text-sm text-muted-foreground">This is the revised dense-text pattern from the homepage annotation.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {shortcutExamples.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.title}
                href="/dev/buttons"
                className="rounded-md border border-border/80 bg-background/70 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Button asChild variant="secondary" className="w-full justify-center gap-2" tabIndex={-1}>
                  <span>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{item.title}</span>
                  </span>
                </Button>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="states-heading">
        <div>
          <h2 id="states-heading" className="text-2xl font-semibold">State examples</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hover, press, focus, and disabled states are easiest to compare here.</p>
        </div>
        <AppSurface>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary">
              <Check aria-hidden="true" />
              Secondary
            </Button>
            <Button variant="cta">
              CTA
              <ArrowRight aria-hidden="true" />
            </Button>
            <MetalAttentionButton>
              Attention
              <Sparkles aria-hidden="true" />
            </MetalAttentionButton>
            <MetalAttentionRing>
              <Button variant="default">
                Ring wrapper
                <Sparkles aria-hidden="true" />
              </Button>
            </MetalAttentionRing>
            <Button variant="glow">
              Glow
              <Sparkles aria-hidden="true" />
            </Button>
          </div>
        </AppSurface>
      </section>
    </AppPageShell>
  )
}
