import Link from "next/link"
import {
  BookOpen,
  BriefcaseBusiness,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  Music2,
  ShieldCheck,
} from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/roadmap")

const foundationPrinciples = [
  {
    title: "Privacy and user control",
    description: "People should understand where their information lives and remain in control of how it is used.",
  },
  {
    title: "Accessible by design",
    description: "Learning, wellness, and practice tools should work across devices and support different ways of interacting.",
  },
  {
    title: "Consent before sharing",
    description: "Sensitive context should move between people or products only through clear, informed choices.",
  },
  {
    title: "Readiness before hosting",
    description: "Hosted sensitive-data features require security, compliance, legal, and operational readiness before launch.",
  },
] as const

// Keep five equally weighted, unordered tracks with current and long-term outcomes;
// capabilities are representative examples, not an exhaustive feature inventory.
const productTracks = [
  {
    title: "Education & Anatomy",
    purpose: "Help massage students and professionals build durable anatomy knowledge through active study.",
    availableNow:
      "Sourced anatomy flashcards, individual Anatomime practice, shared classroom games, and saved mastery progress.",
    longTermDirection:
      "Broader learning pathways, more reviewed anatomical media, stronger instructor tools, and carefully chosen spatial learning experiences.",
    capabilities: ["Adaptive study", "Anatomy games", "Classroom sessions"],
    icon: BookOpen,
  },
  {
    title: "Wellness Tools",
    purpose: "Give people approachable tools for relaxation, body awareness, and consistent wellness routines.",
    availableNow:
      "Chimer, Clock, guided breathing, Quick Log, body-sensation tracking, range-of-motion activities, and personal reminders.",
    longTermDirection:
      "More connected routines, clearer personal patterns, and user-controlled ways to carry useful context between wellness experiences.",
    capabilities: ["Timed sessions", "Breathing exercises", "Reflection and patterns"],
    icon: HeartPulse,
  },
  {
    title: "Therapist & Practice Tools",
    purpose: "Reduce the administrative load of running an independent massage practice or small team.",
    availableNow:
      "Practice scheduling, public booking, services and providers, calendar workflows, team roles, and business-planning tools.",
    longTermDirection:
      "A more connected workspace for practice operations, client relationships, team coordination, and sustainable business growth.",
    capabilities: ["Scheduling and booking", "Practice planning", "Team coordination"],
    icon: BriefcaseBusiness,
  },
  {
    title: "Local-First Records",
    purpose: "Help therapists manage sensitive professional records while keeping control close to the practitioner.",
    availableNow:
      "An encrypted browser vault for intake forms, SOAP notes, journals, and range-of-motion records, including local intake-to-SOAP continuity.",
    longTermDirection:
      "Stronger cross-device continuity, optional consent-based sharing, and therapist-reviewed assistance such as transcription or drafting, but only when the required safeguards are ready.",
    capabilities: ["Encrypted records", "Therapist-reviewed documentation", "User-controlled transfer"],
    icon: LockKeyhole,
  },
  {
    title: "Audio & Ambient Experiences",
    purpose: "Create calm, focused environments that can accompany sessions, study, rest, or other MassageLab tools.",
    availableNow:
      "A generative music catalog, persistent sitewide playback, clocks and timers, and customizable animated backgrounds.",
    longTermDirection:
      "More expressive ambient environments, deeper playback and visual customization, and smoother connections between audio, timing, and wellness experiences.",
    capabilities: ["Generative audio", "Ambient visuals", "Cross-tool playback"],
    icon: Music2,
  },
] as const

export default function RoadmapPage() {
  return (
    <AppPageShell width="full" contentClassName="gap-10">
      <header className="space-y-5 py-2 sm:py-4">
        <div className="max-w-4xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Product vision</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Where MassageLab is going
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            MassageLab is growing into a connected home for anatomy learning, personal wellness, therapeutic practice,
            professional records, and calm ambient experiences.
          </p>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            These tracks form an equal product portfolio. Their position on this page is not a release order, priority
            ranking, or delivery promise.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="cta">
            <Link href="/tools">Explore tools</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">View memberships</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing#one-time-support">
              <HeartHandshake className="mr-2 h-4 w-4" aria-hidden="true" />
              One-time support
            </Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby="roadmap-foundation-heading">
        <AppSurface
          title={<h2 id="roadmap-foundation-heading">Shared foundation</h2>}
          description="The same responsibilities guide every part of the MassageLab portfolio."
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Sensitive professional records remain local-first. Any future hosted sensitive-data capability must earn
            its place through informed consent and the required security, compliance, legal, and operational readiness.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {foundationPrinciples.map((principle) => (
              <AppInset key={principle.title} className="h-full p-4">
                <h3 className="text-sm font-semibold text-foreground">{principle.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.description}</p>
              </AppInset>
            ))}
          </div>
        </AppSurface>
      </section>

      <section aria-labelledby="product-portfolio-heading" className="space-y-4">
        <div className="max-w-3xl">
          <h2 id="product-portfolio-heading" className="text-2xl font-semibold text-foreground">
            Product portfolio
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Each track pairs value available today with a long-term direction. None is ranked above another.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {productTracks.map((track) => {
            const Icon = track.icon
            return (
              <AppSurface
                key={track.title}
                title={<h3>{track.title}</h3>}
                description={track.purpose}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                className="h-full"
                contentClassName="gap-4"
              >
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Available now</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{track.availableNow}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Long-term direction</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{track.longTermDirection}</p>
                </div>
                <ul className="mt-auto flex flex-wrap gap-2" aria-label={`${track.title} representative capabilities`}>
                  {track.capabilities.map((capability) => (
                    <li key={capability} className="rounded-md border border-border/80 bg-background/75 px-2.5 py-1 text-xs">
                      {capability}
                    </li>
                  ))}
                </ul>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="support-roadmap-heading">
        <AppSurface
          title={<h2 id="support-roadmap-heading">Support the mission</h2>}
          description="Memberships and one-time support help support the broader MassageLab mission. They do not determine feature order or guarantee delivery of a particular capability."
          contentClassName="gap-4"
        >
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="cta">
              <Link href="/pricing#one-time-support">One-time support</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">View memberships</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tools">Explore tools</Link>
            </Button>
          </div>
        </AppSurface>
      </section>
    </AppPageShell>
  )
}
