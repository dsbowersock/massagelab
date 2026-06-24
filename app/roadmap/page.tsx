import Link from "next/link"
import { CalendarDays, Clock, FileText, HeartHandshake, ShieldCheck, UserRound } from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/roadmap")

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
      "Treatment-room clock and timer controls now handle active sessions, mobile layouts, full-viewport clock centering, position-stable switch animation, display colors, digit glow, hidden-seconds display, font sizing, fullscreen, alerts, and safe preference sync more reliably.",
    icon: Clock,
  },
  {
    title: "Cleaner alpha navigation",
    description:
      "The sidebar now uses the brand mark as the home link, groups product routes under Tools, Documentation, Games, and About, and keeps support links inside the account menu.",
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
    title: "Chimer display regression QA",
    description:
      "The timer/current-time animation correction has shipped; remaining alpha work is to verify Chimer layout, reduced motion, controls, settings, completion alerts, and large-font behavior across viewports.",
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
    <AppPageShell title="MassageLab Roadmap" contentClassName="gap-8">
        <AppSurface
          title="Current alpha direction"
          description={
            <>
                The next phase is alpha stabilization: verify what already shipped, regression-check Chimer polish, and design calendar creation flows before adding larger product bets.
            </>
          }
          contentClassName="flex flex-wrap gap-3"
        >
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
        </AppSurface>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Recently shipped</h2>
            <p className="mt-1 text-sm text-muted-foreground">Alpha improvements landed from May 8-13, 2026.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {recentlyShipped.map((feature) => {
              const Icon = feature.icon
              return (
                <AppSurface
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                />
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
                <AppSurface
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                  className={appCalloutClassName}
                />
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
                <AppSurface
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                />
              )
            })}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <AppSurface
            title="Future compliance work"
            description={
              <>
                Managed clinical sync is not the immediate alpha build. It needs funding and operational readiness before it can be offered responsibly.
              </>
            }
          >
              <div className="grid gap-3">
                {upfrontNeeds.map((need) => (
                  <AppInset key={need} className="p-3 text-sm">
                    {need}
                  </AppInset>
                ))}
              </div>
          </AppSurface>

          <AppSurface
            id="donate"
            title="Donate"
            description={
              <>
                Donations help fund the compliance, infrastructure, and review work needed for future managed clinical sync.
              </>
            }
            className="scroll-mt-20"
            contentClassName="gap-4"
          >
              <p className="text-sm text-muted-foreground">
                Memberships and donations are separate from the local-first alpha tools. Notes, intake forms, journals, and ROM data remain under user control.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                  <Link href="/pricing#donate">Donate with Stripe</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/pricing">View memberships</Link>
                </Button>
              </div>
          </AppSurface>
        </div>
    </AppPageShell>
  )
}
