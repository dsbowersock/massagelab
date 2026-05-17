import Link from "next/link"
import { FileText, LockKeyhole, Map, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

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
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-5">
          <PageHeading>About MassageLab</PageHeading>
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-brand-orange" aria-hidden="true" />
                <CardTitle>Local-first tools for massage work</CardTitle>
              </div>
              <CardDescription>
                MassageLab is a private-alpha toolkit for massage therapists, massage students, educators, and small practices. It starts with practical treatment-room and classroom tools, then grows toward paid memberships that can fund compliant storage, practice operations, education, and research workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/about/derrick">About Derrick</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

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
                <Card key={tool.title} className="border-neutral-800 bg-card/90 backdrop-blur">
                  <CardHeader>
                    <Icon className="mb-2 h-5 w-5 text-brand-orange" aria-hidden="true" />
                    <CardTitle>{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </section>

        <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
          <CardHeader>
            <CardTitle>What guides the project</CardTitle>
            <CardDescription>
              The guiding line is simple: make your skills work for you, without pushing therapists into unsafe data practices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {priorities.map((priority) => (
                <div key={priority} className="rounded-md border border-brand-orange/30 bg-background/60 p-3 text-sm">
                  {priority}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
