import Link from "next/link"
import { CalendarDays, Clock, FileText, HeartHandshake, Mic, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

const roadmapFeatures = [
  {
    title: "HIPAA-ready note sync",
    description: "Managed SOAP notes, intake forms, pain maps, transcripts, and exports that can safely move between devices.",
    icon: ShieldCheck,
  },
  {
    title: "Client and therapist calendar",
    description: "Online booking, availability, appointment management, and reminders for small practices.",
    icon: CalendarDays,
  },
  {
    title: "Structured clinical documentation",
    description: "Better SOAP workflows, range-of-motion tracking, body maps, and reusable documentation templates.",
    icon: FileText,
  },
  {
    title: "Voice-to-text review tools",
    description: "Transcription workflows where therapists review and approve text before it enters clinical notes.",
    icon: Mic,
  },
  {
    title: "Treatment-room tools",
    description: "Chimer clock and timer improvements for calm, reliable treatment-room use.",
    icon: Clock,
  },
  {
    title: "Evidence-informed practice",
    description: "Structured, anonymized data exports that can eventually support outcomes tracking and research.",
    icon: UserRound,
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
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="space-y-5">
          <PageHeading>MassageLab Roadmap</PageHeading>
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Why some features are not available yet</CardTitle>
              <CardDescription>
                MassageLab can offer local-first tools today, but syncing PHI-bearing clinical records requires real upfront compliance and infrastructure costs before it can be offered responsibly.
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roadmapFeatures.map((feature) => {
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

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
            <CardHeader>
              <CardTitle>What funding unlocks</CardTitle>
              <CardDescription>
                The goal is not just to store notes online. The goal is to build a clinical product that protects clients, therapists, and the practice.
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
