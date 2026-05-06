import Link from "next/link"
import { Activity, ClipboardList, FileText, HeartPulse, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

const noteTypes = [
  {
    title: "S.O.A.P. Notes",
    description: "Create, save locally, import, and export session notes.",
    icon: FileText,
    href: "/notes/soap",
    available: true,
  },
  {
    title: "Intake Forms",
    description: "Collect client intake details as local-first files.",
    icon: ClipboardList,
    href: "/notes/intake",
    available: true,
  },
  {
    title: "Client Journal",
    description: "Track pain, sensation, and incidents as local-first entries.",
    icon: HeartPulse,
    href: "/notes/journal",
    available: true,
  },
  {
    title: "Range of Motion",
    description: "Capture manual or phone-orientation movement measurements locally.",
    icon: Activity,
    href: "/notes/rom",
    available: true,
  },
]

const plannedTools = [
  "Postural assessment",
  "Muscle testing",
  "Gait assessment",
  "Orthopedic tests",
]

export default function NotesPage() {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeading>Local-First Documentation</PageHeading>

        <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-[#ff7043]" />
            <div>
              <CardTitle>PHI stays under user control</CardTitle>
              <CardDescription>
                MassageLab does not upload notes, intake forms, journals, or movement data in this alpha. Users are responsible for how exported files are stored or shared.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {noteTypes.map((note) => {
            const Icon = note.icon
            return (
              <Link key={note.href} href={note.href}>
                <Card className="h-full border-neutral-800 bg-card/90 backdrop-blur transition-colors hover:bg-accent">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-[#ff7043]" />
                      <CardTitle>{note.title}</CardTitle>
                    </div>
                    <CardDescription>{note.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Open {note.title.toLowerCase()}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Future compliant sync</CardTitle>
            <CardDescription>
              Cross-device clinical sync is planned, but hosted clinical data stays disabled until MassageLab can pay for compliant infrastructure, signed BAAs, risk review, audit controls, and PHI-safe operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/support">Support the sync roadmap</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-neutral-800 bg-[#202020]/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Planned Documentation Tools</CardTitle>
            <CardDescription>These remain off the alpha navigation until their workflows are implemented.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {plannedTools.map((tool) => (
                <span key={tool} className="rounded-sm border border-neutral-700 px-3 py-1 text-sm text-muted-foreground">
                  {tool}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
