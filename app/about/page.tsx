import Link from "next/link"
import { FileText, LockKeyhole, Map, Timer } from "lucide-react"
import { AppPageShell, AppSurface, AppInset, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

const alphaTools = [
  {
    title: "Chimer",
    description: "Treatment-room interval timer and standalone clock mode, with paid custom color support.",
    icon: Timer,
  },
  {
    title: "Local-first documentation",
    description: "SOAP notes, intake forms, journals, and ROM sessions stay in the browser unless the user exports them.",
    icon: FileText,
  },
  {
    title: "Calendar foundation",
    description: "Small-practice scheduling, therapist availability, booking requests, and conflict prevention.",
    icon: Map,
  },
]

const priorities = [
  "Keep PHI-bearing alpha workflows under user control.",
  "Use memberships to fund security, compliance, education, and practice-management work.",
  "Verify existing tools before expanding into larger hosted clinical infrastructure.",
]

export default function AboutPage() {
  return (
    <AppPageShell title="About MassageLab" contentClassName="gap-8">
        <AppSurface
          title="Local-first tools for massage work"
          description={
            <>
                MassageLab is a private-alpha toolkit for massage therapists, massage students, educators, and small practices. It starts with practical treatment-room and classroom tools, then grows toward paid memberships that can fund compliant storage, practice operations, education, and research workflows.
            </>
          }
          icon={<LockKeyhole className="h-5 w-5" aria-hidden="true" />}
          contentClassName="flex flex-wrap gap-3"
        >
              <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/about/derrick">About Derrick</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/legal">Legal documents</Link>
              </Button>
        </AppSurface>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Current alpha</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The current priority is release readiness, stronger account surfaces, and clearer public documentation.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {alphaTools.map((tool) => {
              const Icon = tool.icon

              return (
                <AppSurface
                  key={tool.title}
                  title={tool.title}
                  description={tool.description}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                />
              )
            })}
          </div>
        </section>

        <AppSurface
          title="What guides the project"
          description={
            <>
              The guiding line is simple: make your skills work for you, without pushing therapists into unsafe data practices.
            </>
          }
          className={appCalloutClassName}
        >
            <div className="grid gap-3 md:grid-cols-3">
              {priorities.map((priority) => (
                <AppInset key={priority} className="p-3 text-sm">
                  {priority}
                </AppInset>
              ))}
            </div>
        </AppSurface>
    </AppPageShell>
  )
}
