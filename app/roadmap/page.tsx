import Link from "next/link"
import { CalendarDays, Clock, FileText, HeartHandshake, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

const recentlyShipped = [
  {
    title: "Privacy-screened monitoring",
    description:
      "Sentry error monitoring and performance traces are live with diagnostic message scrubbing. Replay, User Feedback, and Logs stay off until clinical privacy rules are written.",
    icon: ShieldCheck,
  },
  {
    title: "Chimer responsive controls",
    description:
      "Treatment-room clock and timer controls now handle active sessions, mobile layouts, font sizing, fullscreen, alerts, and safe preference sync more reliably.",
    icon: Clock,
  },
  {
    title: "Cleaner alpha navigation",
    description:
      "The sidebar now groups Home, Tools, Documentation, and Games, with secondary support and roadmap links plus account actions in the account menu.",
    icon: CalendarDays,
  },
  {
    title: "Sidebar and brand polish",
    description:
      "Collapsed section icons, rail open controls, wordmark reveal, click-away collapse, updated brand assets, and PWA icons are in place.",
    icon: UserRound,
  },
]

const currentFocus = [
  {
    title: "Alpha release readiness",
    description:
      "Run the automated gate, walk the alpha QA checklist, and verify desktop/mobile layouts, sidebar states, PWA metadata, and local-first privacy expectations.",
    icon: FileText,
  },
  {
    title: "Chimer animation polish",
    description:
      "Refine timer/current-time swaps, control fades, settings transitions, completion alerts, moving backgrounds, and reduced-motion behavior.",
    icon: Clock,
  },
  {
    title: "Calendar creation design",
    description:
      "Plan appointment, client request, personal event, class, and reminder creation flows before adding more calendar UI.",
    icon: CalendarDays,
  },
]

const laterProductTracks = [
  {
    title: "Access and memberships",
    description:
      "Future membership levels will define which tools, education features, practice workflows, and sync capabilities each user can access.",
    icon: UserRound,
  },
  {
    title: "Anatomy-powered education",
    description:
      "The anatomy database should support multiple learning and clinical tools, including Anatomime, flashcards, body diagrams, intake workflows, and demonstrations.",
    icon: FileText,
  },
  {
    title: "Practice and therapist SaaS",
    description:
      "Practice owners, therapists, students, and clients need clear account experiences before MassageLab expands beyond alpha scheduling and local-first tools.",
    icon: CalendarDays,
  },
  {
    title: "Evidence-informed news and content",
    description:
      "A future News area can surface reputable massage, bodywork, anatomy, and research content with clear source attribution and editorial boundaries.",
    icon: FileText,
  },
  {
    title: "Legal, trust, and discoverability",
    description:
      "Terms, legal information, an About Me section, SEO, and public messaging should mature alongside wider release planning.",
    icon: ShieldCheck,
  },
]

const upfrontNeeds = [
  "HIPAA-compliant hosting and storage",
  "Business Associate Agreements with vendors",
  "Audit logging, access controls, encryption, and backups",
  "Security review, incident response planning, and legal/compliance review",
  "Ongoing operating costs for managed clinical records",
]

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-5">
          <PageHeading>MassageLab Roadmap</PageHeading>
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Current alpha direction</CardTitle>
              <CardDescription>
                The next phase is alpha stabilization: verify what already shipped, polish Chimer, and design calendar creation flows before adding larger product bets.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                <Link href="/register">Create an account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Choose a tool</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="#donate">
                  <HeartHandshake className="mr-2 h-4 w-4" />
                  Donate
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Recently shipped</h2>
            <p className="mt-1 text-sm text-muted-foreground">Alpha improvements landed from May 8-11, 2026.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {recentlyShipped.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border-neutral-800 bg-card/90 backdrop-blur">
                  <CardHeader>
                    <Icon className="mb-2 h-5 w-5 text-brand-orange" />
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Current alpha focus</h2>
            <p className="mt-1 text-sm text-muted-foreground">The next roadmap lane is release readiness before new product surfaces.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {currentFocus.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border-brand-orange/40 bg-primary/10 backdrop-blur">
                  <CardHeader>
                    <Icon className="mb-2 h-5 w-5 text-brand-orange" />
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Later product tracks</h2>
            <p className="mt-1 text-sm text-muted-foreground">These stay high-level until pricing, platform, source, and access decisions are ready.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {laterProductTracks.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border-neutral-800 bg-card/90 backdrop-blur">
                  <CardHeader>
                    <Icon className="mb-2 h-5 w-5 text-brand-orange" />
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Future compliance work</CardTitle>
              <CardDescription>
                Managed clinical sync is not the immediate alpha build. It needs funding and operational readiness before it can be offered responsibly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {upfrontNeeds.map((need) => (
                  <div key={need} className="rounded-md border border-brand-orange/30 bg-background/60 p-3 text-sm">
                    {need}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="donate" className="scroll-mt-20 border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Donate</CardTitle>
              <CardDescription>
                A donation/payment provider has not been wired into this alpha yet. This section is the placeholder for the donation link once the preferred provider is selected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Until then, the best ways to support the roadmap are to create an account, use the current tools, and share which paid features would matter most to your practice.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                  <Link href="/register">Create an account</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">Use MassageLab</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
